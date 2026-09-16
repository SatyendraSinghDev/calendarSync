import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import { google } from 'googleapis';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoUsers, demoEvents } from './demoData.js';

const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(backendDirectory, '../../.env') });

const app = express();
const port = Number(process.env.PORT || 5000);
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
const currentDate = () => new Date().toISOString().slice(0, 10);

app.use(cors({ origin: frontendUrl, credentials: true }));
app.set('trust proxy', 1);
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'calendar-sync-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // Frontend and API are separate Vercel sites in production, so the
      // session cookie must be allowed on cross-site credentialed requests.
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);

app.get('/', (_req, res) => {
  res.json({
    service: 'calendarSync API',
    status: 'ok',
    health: '/api/health'
  });
});

const isPlaceholderValue = (value) => !value || value.includes('your-google') || value.includes('demo-client');

const hasGoogleConfig = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET &&
  !isPlaceholderValue(process.env.GOOGLE_CLIENT_ID) &&
  !isPlaceholderValue(process.env.GOOGLE_CLIENT_SECRET)
);
const googleProjectNumber = process.env.GOOGLE_CLIENT_ID?.split('-')[0] || '';

const getGoogleAccountFromToken = (tokens) => {
  if (!tokens.id_token) return null;
  const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString('utf8'));
  return {
    name: payload.name || payload.email || 'Google user',
    email: payload.email || ''
  };
};

const oauth2Client = hasGoogleConfig
  ? new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback'
    )
  : null;

const userMap = Object.fromEntries(demoUsers.map((user) => [user.id, user]));

const normalizeEvent = (event, userOverride = null) => ({
  ...event,
  user: userOverride || userMap[event.userId] || { id: event.userId, name: 'Unknown user', color: '#6c63ff' },
  start: new Date(event.start).toISOString(),
  end: new Date(event.end).toISOString(),
  date: new Date(event.start).toISOString().slice(0, 10)
});

const normalizeGoogleEvent = (event, calendar) => {
  const startValue = event.start?.dateTime || event.start?.date;
  const endValue = event.end?.dateTime || event.end?.date;

  return {
    id: event.id,
    userId: `google-calendar-${calendar.id}`,
    title: event.summary || 'Untitled event',
    start: startValue,
    end: endValue,
    location: event.location || 'No location',
    meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri || null,
    type: event.eventType || 'event',
    busy: event.transparency !== 'transparent',
    user: {
      id: `google-calendar-${calendar.id}`,
      name: calendar.summary || 'Google Calendar',
      email: calendar.id,
      color: calendar.backgroundColor || '#1a73e8'
    }
  };
};

const getDemoEventsForDate = (dateString) => {
  const targetDate = new Date(`${dateString}T00:00:00`);
  const dayStart = new Date(targetDate.getTime());
  const dayEnd = new Date(targetDate.getTime());
  dayEnd.setHours(23, 59, 59, 999);

  return demoEvents
    .filter((event) => {
      const eventDate = new Date(event.start);
      return eventDate >= dayStart && eventDate <= dayEnd;
    })
    .map((event) => normalizeEvent(event));
};

const formatDateLabel = (dateString) => {
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
};

const hasOverlap = (a, b) => {
  const startA = new Date(a.start).getTime();
  const endA = new Date(a.end).getTime();
  const startB = new Date(b.start).getTime();
  const endB = new Date(b.end).getTime();

  return startA < endB && startB < endA;
};

const findConflicts = (events) => {
  const conflicts = [];

  for (let i = 0; i < events.length; i += 1) {
    for (let j = i + 1; j < events.length; j += 1) {
      const eventA = events[i];
      const eventB = events[j];

      if (eventA.userId === eventB.userId) {
        continue;
      }

      if (hasOverlap(eventA, eventB)) {
        const overlapStart = new Date(Math.max(new Date(eventA.start).getTime(), new Date(eventB.start).getTime()));
        const overlapEnd = new Date(Math.min(new Date(eventA.end).getTime(), new Date(eventB.end).getTime()));

        conflicts.push({
          id: `${eventA.id}-${eventB.id}`,
          eventA,
          eventB,
          overlapStart: overlapStart.toISOString(),
          overlapEnd: overlapEnd.toISOString(),
          durationMinutes: Math.round((overlapEnd - overlapStart) / 60000)
        });
      }
    }
  }

  return conflicts;
};

const generateCommonFreeSlots = (dateString, events) => {
  const selectedDay = new Date(`${dateString}T00:00:00`);
  const slots = [];
  const uniqueUsers = [...new Set(events.map((event) => event.userId))];

  for (let hour = 9; hour <= 18; hour += 1) {
    const start = new Date(selectedDay);
    start.setHours(hour, 0, 0, 0);

    const end = new Date(selectedDay);
    end.setHours(hour + 1, 0, 0, 0);

    const userAvailability = uniqueUsers.map((userId) => {
      const personalEvents = events.filter((event) => event.userId === userId);

      return personalEvents.every(
        (event) => new Date(event.end).getTime() <= start.getTime() || end.getTime() <= new Date(event.start).getTime()
      );
    });

    if (userAvailability.every(Boolean) && uniqueUsers.length > 0) {
      slots.push({
        start: start.toISOString(),
        end: end.toISOString()
      });
    }
  }

  return slots.slice(0, 10);
};

const getGoogleEventsForDate = async (dateString, req) => {
  if (!req.session?.googleTokens || !oauth2Client) {
    return [];
  }

  try {
    oauth2Client.setCredentials(req.session.googleTokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const selectedDate = new Date(`${dateString}T00:00:00`);
    const timeMin = new Date(selectedDate);
    const timeMax = new Date(selectedDate);
    timeMax.setHours(23, 59, 59, 999);

    const calendarListResponse = await calendar.calendarList.list({
      minAccessRole: 'reader',
      showHidden: false
    });

    const calendars = calendarListResponse.data.items || [];
    const primaryCalendar = calendars.find((item) => item.primary) || calendars[0];
    if (primaryCalendar && !req.session.googleAccount) {
      req.session.googleAccount = {
        name: primaryCalendar.summary || primaryCalendar.summaryOverride || 'Google user',
        email: primaryCalendar.id
      };
    }
    const eventResponses = await Promise.all(
      calendars.map((connectedCalendar) =>
        calendar.events.list({
          calendarId: connectedCalendar.id,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: 'startTime'
        })
      )
    );

    const events = eventResponses.flatMap((response, index) =>
      (response.data.items || [])
        .filter((item) => item.status !== 'cancelled')
        .map((event) => normalizeGoogleEvent(event, calendars[index]))
    );

    return events;
  } catch (error) {
    console.warn('Google Calendar fetch failed.', error.message);
    const apiMessage = error.response?.data?.error?.message || error.message;
    const reason = error.response?.data?.error?.errors?.[0]?.reason;
    if (reason === 'insufficientPermissions') {
      await new Promise((resolve) => req.session.destroy(resolve));
      throw new Error(
        'Google Calendar permission was missing. Your session was reset; click Reconnect Google and allow both Calendar permissions.'
      );
    }
    if (reason === 'accessNotConfigured') {
      throw new Error(
        `Google Calendar API is not enabled for the OAuth project (${googleProjectNumber}). ` +
        'Open https://console.cloud.google.com/apis/library/calendar-json.googleapis.com, select the project that owns this OAuth client, click Enable, then logout and reconnect.'
      );
    }
    throw new Error(`Unable to load Google Calendar events: ${apiMessage}`);
  }
};

const getEventsForDate = async (dateString, req) => {
  if (!req.session?.googleTokens || !oauth2Client) {
    return [];
  }

  return getGoogleEventsForDate(dateString, req);
};

const getUsersForEvents = (events, googleConnected) => {
  if (!googleConnected) {
    return [];
  }

  return [...new Map(events.map((event) => [event.user.id, event.user])).values()];
};

const connectMongo = async () => {
  if (!process.env.MONGODB_URI) {
    console.log('MongoDB not configured: running in demo mode.');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully.');
  } catch (error) {
    console.warn('MongoDB connection failed. Falling back to demo mode.', error.message);
  }
};

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: hasGoogleConfig ? 'google-oauth' : 'demo',
    googleConnected: Boolean(req.session?.googleTokens),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/users', (_req, res) => {
  res.json(demoUsers);
});

app.get('/api/auth/google-url', (_req, res) => {
  if (!oauth2Client) {
    return res.status(400).json({
      configured: false,
      message: 'Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env and restart the backend.'
    });
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    include_granted_scopes: false,
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
      'openid',
      'email',
      'profile'
    ],
    prompt: 'consent'
  });

  return res.json({ configured: true, url: authUrl });
});

app.get('/api/auth/google/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ message: 'Missing Google OAuth code.' });
  }

  if (!oauth2Client) {
    return res.status(400).json({
      status: 'error',
      message: 'Google auth is not configured. Add your OAuth client credentials in .env.'
    });
  }

  try {
    const { tokens } = await oauth2Client.getToken(String(code));
    req.session.googleTokens = tokens;
    req.session.googleAccount = getGoogleAccountFromToken(tokens);
    return res.redirect(`${frontendUrl}/?google=connected`);
  } catch (error) {
    return res.redirect(`${frontendUrl}/?google=error&message=${encodeURIComponent(error.message)}`);
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ status: 'logged_out' });
  });
});

app.post('/api/events', async (req, res) => {
  if (!req.session?.googleTokens || !oauth2Client) {
    return res.status(401).json({ message: 'Connect Google Calendar before creating an event.' });
  }

  const { title, start, end, location, description } = req.body;
  if (!title || !start || !end) {
    return res.status(400).json({ message: 'Title, start, and end are required.' });
  }

  try {
    oauth2Client.setCredentials(req.session.googleTokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: title,
        location: location || undefined,
        description: description || undefined,
        start: { dateTime: new Date(start).toISOString() },
        end: { dateTime: new Date(end).toISOString() }
      }
    });

    return res.status(201).json({ event: response.data });
  } catch (error) {
    return res.status(502).json({ message: error.response?.data?.error?.message || error.message });
  }
});

app.get('/api/calendar', async (req, res) => {
  const date = String(req.query.date || '2026-09-15');
  const googleConnected = Boolean(req.session?.googleTokens);

  try {
    const events = await getEventsForDate(date, req);
    return res.json({
      date,
      label: formatDateLabel(date),
      users: getUsersForEvents(events, googleConnected),
      events,
      conflictCount: findConflicts(events).length,
      googleConnected
    });
  } catch (error) {
    return res.status(502).json({ message: error.message });
  }
});

app.get('/api/conflicts', async (req, res) => {
  const date = String(req.query.date || currentDate());
  try {
    const events = await getEventsForDate(date, req);
    const conflicts = findConflicts(events);
    return res.json({
      date,
      label: formatDateLabel(date),
      conflicts,
      total: conflicts.length,
      googleConnected: Boolean(req.session?.googleTokens)
    });
  } catch (error) {
    return res.status(502).json({ message: error.message });
  }
});

app.get('/api/availability', async (req, res) => {
  const date = String(req.query.date || currentDate());
  try {
    const events = await getEventsForDate(date, req);
    return res.json({
      date,
      label: formatDateLabel(date),
      commonFreeSlots: generateCommonFreeSlots(date, events),
      googleConnected: Boolean(req.session?.googleTokens)
    });
  } catch (error) {
    return res.status(502).json({ message: error.message });
  }
});

app.get('/api/dashboard', async (req, res) => {
  const date = String(req.query.date || currentDate());
  const googleConnected = Boolean(req.session?.googleTokens);

  try {
    const events = await getEventsForDate(date, req);
    const conflicts = findConflicts(events);
    const commonFreeSlots = generateCommonFreeSlots(date, events);
    const users = getUsersForEvents(events, googleConnected);

    return res.json({
      date,
      label: formatDateLabel(date),
      users,
      events,
      conflicts,
      commonFreeSlots,
      googleConnected,
      googleAccount: req.session.googleAccount || null,
      summary: {
        totalUsers: users.length,
        totalEvents: events.length,
        conflictCount: conflicts.length,
        nextAvailableSlot: commonFreeSlots[0] || null
      }
    });
  } catch (error) {
    return res.status(502).json({ message: error.message });
  }
});

const startServer = async () => {
  await connectMongo();

  app.listen(port, () => {
    console.log(`Calendar sync backend running on http://localhost:${port}`);
    console.log(`Google OAuth configured: ${hasGoogleConfig ? 'yes' : 'no'}`);
  });
};

if (!process.env.VERCEL) {
  startServer();
}

export default app;
