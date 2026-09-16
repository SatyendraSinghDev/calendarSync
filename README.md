# CalendarSync

CalendarSync is a shared Google Calendar and conflict-detection application. It connects a Google account with OAuth 2.0, reads the calendars that the account can access, normalizes events into one format, detects overlaps, and displays the result in a Google Calendar-style interface.

<img width="959" height="467" alt="image" src="https://github.com/user-attachments/assets/d606633d-05dc-4c00-a517-7428c94c09fb" />


## 1. Architecture at a glance

```text
Browser
  |
  | React + TypeScript + Vite
  | http://localhost:5173
  | https://calendar-sync-frontend.vercel.app
  v
Express API
  |
  | OAuth session
  | Google Calendar API
  | Conflict and availability engine
  | http://localhost:5000
  | https://calendar-sync-backend.vercel.app
  v
Google Calendar API
  |
  v
Google calendars and events
```

MongoDB is optional in the current implementation. If `MONGODB_URI` is not set, the backend continues without a database connection; Google event data is fetched through the OAuth session.

## 1.1 Real deployment credentials: where to get each value

For a real deployment, configure these four values before connecting the app to Google Calendar:

| Variable | Where it comes from |
|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud Console OAuth 2.0 Web client |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console, on the same OAuth client |
| `GOOGLE_REDIRECT_URI` | Your backend OAuth callback URL; you create this from the deployment URL |
| `MONGODB_URI` | MongoDB Atlas connection string; optional for this project |

### Step 1: Create or select a Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select an existing project or click **New Project**.
3. Open [Google Calendar API in API Library](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com).
4. Click **Enable**.

### Step 2: Create the OAuth client and extract Google credentials

1. Open [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials).
2. Select the same project.
3. Click **Create Credentials → OAuth client ID**.
4. Choose **Web application**.
5. Give the client a name such as `CalendarSync Web`.
6. Copy the displayed **Client ID** into:

   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

7. Copy the displayed **Client secret** into:

   ```env
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

If the OAuth client already exists, open it from **OAuth 2.0 Client IDs** and copy both values from its details page. Never put the client secret in GitHub, README files, or frontend code. If it has been exposed, use **Add secret** or regenerate it and update the deployment variable.

### Step 3: Configure the redirect URL

`GOOGLE_REDIRECT_URI` is not copied from Google. It is the exact callback route implemented by this backend:

```text
/api/auth/google/callback
```

For localhost, combine it with the backend URL:

```env
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
```

For the live Vercel backend, use:

```env
GOOGLE_REDIRECT_URI=https://calendar-sync-backend.vercel.app/api/auth/google/callback
```

Now open [Google Cloud OAuth credentials](https://console.cloud.google.com/apis/credentials), open the Web client, and add both URLs under **Authorized redirect URIs**:

```text
http://localhost:5000/api/auth/google/callback
https://calendar-sync-backend.vercel.app/api/auth/google/callback
```

Under **Authorized JavaScript origins**, add:

```text
http://localhost:5173
https://calendar-sync-frontend.vercel.app
```

The URI must match exactly, including `http`/`https`, hostname, port, path, and trailing characters.

### Step 4: Create and extract `MONGODB_URI` (optional)

Google Calendar works without MongoDB in this project. To add MongoDB persistence:

1. Open [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create an account or sign in.
3. Create a free cluster.
4. Go to **Security → Database Access → Add New Database User** and create a user.
5. Go to **Security → Network Access** and allow your development IP.
6. Open the cluster and choose **Connect → Drivers**.
7. Select **Node.js** and copy the connection string.
8. Replace the username, password, and database name:

   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/calendarSync?retryWrites=true&w=majority
   ```

If the password contains characters such as `@`, `#`, `%`, `/`, or `:`, URL-encode them. Do not use `0.0.0.0/0` permanently in production; restrict network access where possible.

### Step 5: Put the values in the correct environment

For localhost, place them in the repository root `.env`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/calendarSync?retryWrites=true&w=majority
```

For the live backend, add the same variables in [Vercel backend Environment Variables](https://vercel.com/satyendra-singh-s-projects/calendar-sync-backend/settings/environment-variables), using the production callback:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://calendar-sync-backend.vercel.app/api/auth/google/callback
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/calendarSync?retryWrites=true&w=majority
```

After saving production variables, redeploy the backend. Then open the [live frontend](https://calendar-sync-frontend.vercel.app/) and click **Connect Google Calendar**.

### How the OAuth access token is used

The app does not ask the user to paste an access token. After the user clicks **Connect Google Calendar** and grants permission:

1. Google redirects to `GOOGLE_REDIRECT_URI` with a temporary authorization code.
2. The backend exchanges that code with Google for access and refresh tokens.
3. The backend stores the tokens in the authenticated Express session.
4. Calendar API requests use those session credentials for that user.
5. The frontend receives normalized calendar data, not the raw client secret.

## 2. Localhost setup

### Prerequisites

- Node.js 18 or newer
- npm
- A Google Cloud project with:
  - Google Calendar API enabled
  - OAuth 2.0 Web application client
  - `http://localhost:5000/api/auth/google/callback` in Authorized redirect URIs

### Install

From the repository root:

```bash
npm install
```

The root workspace installs dependencies for both `backend` and `frontend`.

### Environment file

Create `.env` in the repository root:

```env
PORT=5000
NODE_ENV=development
SESSION_SECRET=replace-with-a-long-random-secret
FRONTEND_URL=http://localhost:5173

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

MONGODB_URI=
VITE_API_URL=http://localhost:5000/api
```

Never commit `.env`. It is ignored by Git. Keep Google client secrets only in local environment variables or the deployment provider's encrypted environment-variable store.

### Start both applications

```bash
npm run dev
```

This starts:

| Process | URL | Command |
|---|---|---|
| Frontend | http://localhost:5173 | `npm run dev --prefix frontend` |
| Backend | http://localhost:5000 | `npm run dev --prefix backend` |

You can also start them separately:

```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

Open [http://localhost:5173](http://localhost:5173).

## 3. Local UI flow

### UI blocks

```text
Calendar page
├── Header
│   ├── Sidebar toggle
│   ├── Today button
│   ├── Previous / next date
│   ├── Selected date heading
│   ├── Day / Week / Month / Year view selector
│   └── Google account menu
├── Auth status banner
├── Sidebar
│   ├── Create button
│   ├── Mini month calendar
│   ├── My calendars
│   └── Other calendars
└── Main calendar
    ├── Timezone and selected day
    ├── Timeline
    ├── Google events
    ├── Conflict highlighting
    └── Event details / create-event modal
```

### Initial page load

1. React calculates the browser's current local date.
2. The frontend calls `GET /api/dashboard?date=YYYY-MM-DD`.
3. The backend checks the Express session.
4. If Google is connected, the backend reads accessible Google calendars and events.
5. Events are normalized.
6. Conflicts and common free slots are calculated.
7. The frontend renders the selected view.

The initial date is always the current browser date. The `Today` button returns to that same date.

### Connect Google Calendar

```text
Click Connect Google
  -> GET /api/auth/google-url
  -> browser navigates to Google's OAuth consent screen
  -> user grants Calendar permission
  -> Google redirects to /api/auth/google/callback
  -> backend exchanges code for tokens
  -> backend stores tokens in the session
  -> backend redirects to /?google=connected
  -> frontend reloads the dashboard with credentials included
```

The current OAuth scopes are:

- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/calendar.events`
- `openid`
- `email`
- `profile`

### Create an event

```text
Click Create
  -> enter title, start, end, and optional location
  -> POST /api/events
  -> backend calls Google Calendar events.insert()
  -> frontend reloads the selected date
```

Creating an event requires an authenticated Google session and the calendar-events scope.

### Logout and reconnect

- **Reconnect** starts OAuth again and refreshes the session.
- **Logout** calls `POST /api/auth/logout`, destroys the session, and reloads the UI.
- If an API request returns an authentication error, the UI offers a reconnect action.

## 4. Local API calling model

The frontend uses:

```ts
const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
```

All session-aware requests use browser credentials:

```ts
fetch(`${API_BASE_URL}/dashboard?date=${date}`, {
  credentials: 'include'
});
```

For local development, `VITE_API_URL` points to the backend:

```text
http://localhost:5000/api
```

For production, it points to:

```text
https://calendar-sync-backend.vercel.app/api
```

## 5. Production flow and pipeline

### Production topology

```text
GitHub main branch
        |
        +--> Vercel frontend project
        |      root: frontend
        |      build: Vite
        |      URL: https://calendar-sync-frontend.vercel.app
        |
        +--> Vercel backend project
               root: backend
               entry: backend/api/index.js
               runtime: @vercel/node
               URL: https://calendar-sync-backend.vercel.app
```

The backend is deployed as a Vercel serverless function. The Express app is exported from `backend/src/index.js` and wrapped by `backend/api/index.js`.

### Production request flow

```text
User opens Vercel frontend
  -> frontend requests backend API with credentials: include
  -> backend CORS allows the frontend origin
  -> backend reads the secure production session cookie
  -> backend calls Google Calendar API
  -> backend returns normalized JSON
  -> frontend renders calendar, conflicts, and availability
```

The production session cookie uses:

- `httpOnly: true`
- `secure: true`
- `sameSite: 'none'`

This is required because frontend and backend are hosted on separate Vercel domains.

### Deployment pipeline

```text
1. Edit code locally
2. Run targeted validation
3. Commit changes
4. Push to GitHub main
5. Vercel detects the push
6. Vercel installs dependencies
7. Frontend runs TypeScript and Vite build
8. Backend builds the serverless function
9. Vercel assigns the production deployment
10. Smoke-test frontend and /api/health
```

### Pipeline validation

Run these checks before pushing:

```bash
npm run build
node --check backend/src/index.js
```

Production smoke tests:

```text
GET https://calendar-sync-backend.vercel.app/
GET https://calendar-sync-backend.vercel.app/api/health
GET https://calendar-sync-frontend.vercel.app/
```

Expected health response shape:

```json
{
  "status": "ok",
  "mode": "google-oauth",
  "googleConnected": false,
  "timestamp": "2026-09-16T00:00:00.000Z"
}
```

After OAuth, `googleConnected` becomes `true` for that browser session.

## 6. Live hosting

| Application | Live URL |
|---|---|
| Frontend | https://calendar-sync-frontend.vercel.app |
| Backend root | https://calendar-sync-backend.vercel.app |
| Backend health | https://calendar-sync-backend.vercel.app/api/health |
| OAuth URL inspection | https://calendar-sync-backend.vercel.app/api/auth/google-url |

The old Render URL is not the active backend. The live application uses the Vercel backend URL above.

## 7. Environment variables

### कहाँ से environment values लें

### Complete extraction and configuration checklist

इसे इसी क्रम में follow करें:

1. [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials) खोलकर सही project select करें।
2. **APIs & Services → Library → Google Calendar API → Enable** करें।
3. **APIs & Services → Credentials → OAuth 2.0 Client IDs** में अपना **Web application** client खोलें।
4. वहाँ से **Client ID** copy करके `GOOGLE_CLIENT_ID` में रखें।
5. उसी page से **Client secret** copy करके `GOOGLE_CLIENT_SECRET` में रखें।
6. Google OAuth client के **Authorized redirect URIs** में ये दोनों exact URLs add करें:

   ```text
   http://localhost:5000/api/auth/google/callback
   https://calendar-sync-backend.vercel.app/api/auth/google/callback
   ```

7. उसी client के **Authorized JavaScript origins** में ये दोनों URLs add करें:

   ```text
   http://localhost:5173
   https://calendar-sync-frontend.vercel.app
   ```

8. Local development के लिए `GOOGLE_REDIRECT_URI` यह रखें:

   ```env
   GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
   ```

9. Production/Vercel backend के लिए `GOOGLE_REDIRECT_URI` यह रखें:

   ```env
   GOOGLE_REDIRECT_URI=https://calendar-sync-backend.vercel.app/api/auth/google/callback
   ```

10. अगर MongoDB चाहिए, [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) में free cluster बनाएं।
11. Atlas में **Database Access → Add New Database User** से user बनाएं।
12. Atlas में **Network Access** configure करें।
13. **Cluster → Connect → Drivers → Node.js** से connection string copy करें।
14. Connection string में username, password और database name भरकर `MONGODB_URI` बनाएं।
15. Local values को repository root की `.env` file में डालें।
16. Vercel backend project में production values add करें:

    ```text
    Vercel → calendar-sync-backend → Settings → Environment Variables
    ```

17. Vercel frontend project में यह value add करें:

    ```env
    VITE_API_URL=https://calendar-sync-backend.vercel.app/api
    ```

18. दोनों Vercel projects को redeploy करें।
19. Backend check करें:

    ```text
    https://calendar-sync-backend.vercel.app/api/health
    ```

20. Frontend खोलकर **Connect Google Calendar** click करें और OAuth flow complete करें।

Local `.env` का final shape:

```env
GOOGLE_CLIENT_ID=1004322717244-xxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/calendarSync?retryWrites=true&w=majority
```

Production Vercel backend में केवल `GOOGLE_REDIRECT_URI` अलग होगा:

```env
GOOGLE_REDIRECT_URI=https://calendar-sync-backend.vercel.app/api/auth/google/callback
```

`GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` और MongoDB password को public repository, README में actual value के रूप में, या frontend variables में कभी न रखें।

#### `GOOGLE_CLIENT_ID` और `GOOGLE_CLIENT_SECRET`

1. [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials) खोलें।
2. ऊपर सही Google Cloud project select करें।
3. **APIs & Services → Credentials** पर जाएँ।
4. **OAuth 2.0 Client IDs** में अपना **Web application** client खोलें।
5. उसी page पर:
   - **Client ID** को `GOOGLE_CLIENT_ID` में रखें।
   - **Client secret** को `GOOGLE_CLIENT_SECRET` में रखें।

Example:

```env
GOOGLE_CLIENT_ID=1004322717244-xxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
```

Google Calendar API भी enable होना चाहिए:

```text
Google Cloud Console
  → APIs & Services
  → Library
  → Google Calendar API
  → Enable
```

> Client secret को GitHub, README या frontend code में commit न करें। इसे केवल local `.env` या Vercel Environment Variables में रखें। अगर secret पहले share हो चुका है, तो Google Cloud Console में उसे rotate करें।

#### `GOOGLE_REDIRECT_URI`

यह Google से extract नहीं होता। यह आपके backend OAuth callback route का exact URL है।

Local development:

```env
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
```

Production:

```env
GOOGLE_REDIRECT_URI=https://calendar-sync-backend.vercel.app/api/auth/google/callback
```

Google Cloud OAuth client में दोनों URLs add करें:

```text
APIs & Services
  → Credentials
  → OAuth 2.0 Client IDs
  → आपका Web client
  → Authorized redirect URIs
```

```text
http://localhost:5000/api/auth/google/callback
https://calendar-sync-backend.vercel.app/api/auth/google/callback
```

**Authorized JavaScript origins** में ये URLs add करें:

```text
http://localhost:5173
https://calendar-sync-frontend.vercel.app
```

Redirect URI protocol, hostname, path और trailing characters सहित बिल्कुल exact match होना चाहिए।

#### `MONGODB_URI`

MongoDB database optional है। Google Calendar integration MongoDB के बिना भी चल सकती है। Database use करना हो तो:

1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) में login करें।
2. Free cluster create करें।
3. **Security → Database Access → Add New Database User** से database user बनाएं।
4. **Security → Network Access** में अपने development IP को allow करें।
5. Cluster page पर **Connect → Drivers** चुनें।
6. Driver के रूप में **Node.js** select करें।
7. Connection string copy करें।
8. `<username>`, `<password>` और database name replace करें।

Example:

```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/calendarSync?retryWrites=true&w=majority
```

अगर password में `@`, `#`, `%`, `/` या `:` जैसे special characters हों, तो उन्हें URL-encode करें। MongoDB Atlas में `0.0.0.0/0` केवल temporary development use के लिए रखें; production में restricted network access बेहतर है।

### Local `.env`

```env
PORT=5000
NODE_ENV=development
SESSION_SECRET=long-random-local-secret
FRONTEND_URL=http://localhost:5173

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

MONGODB_URI=
VITE_API_URL=http://localhost:5000/api
```

### Vercel backend project

Set these in the `calendar-sync-backend` project under Production Environment Variables:

```env
NODE_ENV=production
SESSION_SECRET=long-random-production-secret
FRONTEND_URL=https://calendar-sync-frontend.vercel.app

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://calendar-sync-backend.vercel.app/api/auth/google/callback

MONGODB_URI=
```

### Vercel frontend project

Set:

```env
VITE_API_URL=https://calendar-sync-backend.vercel.app/api
```

### Google Cloud OAuth URIs

Authorized JavaScript origins:

```text
http://localhost:5173
https://calendar-sync-frontend.vercel.app
```

Authorized redirect URIs:

```text
http://localhost:5000/api/auth/google/callback
https://calendar-sync-backend.vercel.app/api/auth/google/callback
```

OAuth redirect URIs must match exactly, including protocol, hostname, path, and trailing characters.

## 8. API endpoints

All `/api` examples below use the local API base:

```text
http://localhost:5000/api
```

Replace it with `https://calendar-sync-backend.vercel.app/api` in production.

### `GET backend-root /`

Health-style service metadata.

This endpoint is outside the `/api` prefix:

```text
GET http://localhost:5000/
```

Response:

```json
{
  "service": "calendarSync API",
  "status": "ok",
  "health": "/api/health"
}
```

### `GET /health`

Returns service status and whether the current session has Google tokens.

Response:

```json
{
  "status": "ok",
  "mode": "google-oauth",
  "googleConnected": true,
  "timestamp": "2026-09-16T06:20:00.000Z"
}
```

### `GET /users`

Returns the demo user list used by the non-Google data model.

Response:

```json
[
  {
    "id": "user-1",
    "name": "Satyendra",
    "email": "satyendra@example.com",
    "color": "#4285f4"
  }
]
```

### `GET /auth/google-url`

Creates the Google OAuth authorization URL.

Successful response:

```json
{
  "configured": true,
  "url": "https://accounts.google.com/o/oauth2/v2/auth?...&redirect_uri=https%3A%2F%2Fcalendar-sync-backend.vercel.app%2Fapi%2Fauth%2Fgoogle%2Fcallback"
}
```

If credentials are missing:

```json
{
  "configured": false,
  "message": "Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env and restart the backend."
}
```

### `GET /auth/google/callback`

Google redirects the browser here. This is a browser redirect, not a frontend `fetch` call.

Query parameters:

```text
?code=<google-authorization-code>
```

Success:

```text
302 -> https://calendar-sync-frontend.vercel.app/?google=connected
```

Failure:

```text
302 -> https://calendar-sync-frontend.vercel.app/?google=error&message=<encoded-error>
```

### `POST /auth/logout`

Destroys the current Express session.

Request:

```http
POST /api/auth/logout
Content-Type: application/json
```

Response:

```json
{
  "status": "logged_out"
}
```

### `POST /events`

Creates an event in the connected user's primary Google Calendar.

Request payload:

```json
{
  "title": "Interview preparation",
  "start": "2026-09-16T10:00:00+05:30",
  "end": "2026-09-16T11:00:00+05:30",
  "location": "Google Meet",
  "description": "Preparation call"
}
```

Required fields are `title`, `start`, and `end`. `location` and `description` are optional.

Success response:

```json
{
  "event": {
    "id": "google-event-id",
    "summary": "Interview preparation",
    "start": {
      "dateTime": "2026-09-16T04:30:00.000Z"
    },
    "end": {
      "dateTime": "2026-09-16T05:30:00.000Z"
    }
  }
}
```

Unauthenticated response:

```json
{
  "message": "Connect Google Calendar before creating an event."
}
```

### `GET /calendar?date=YYYY-MM-DD`

Returns normalized events and calendar users for one date.

Example:

```text
GET /api/calendar?date=2026-09-16
```

Response:

```json
{
  "date": "2026-09-16",
  "label": "Wednesday, 16 September 2026",
  "users": [
    {
      "id": "google-calendar-primary",
      "name": "satyendrasinghdev2@gmail.com",
      "email": "satyendrasinghdev2@gmail.com",
      "color": "#4285f4"
    }
  ],
  "events": [
    {
      "id": "event-id",
      "userId": "google-calendar-primary",
      "title": "Interview",
      "start": "2026-09-16T06:00:00.000Z",
      "end": "2026-09-16T07:00:00.000Z",
      "location": "No location",
      "meetLink": null,
      "type": "event",
      "busy": true,
      "date": "2026-09-16",
      "calendar": {
        "id": "primary",
        "name": "satyendrasinghdev2@gmail.com"
      }
    }
  ],
  "conflictCount": 0,
  "googleConnected": true
}
```

### `GET /dashboard?date=YYYY-MM-DD`

Main frontend endpoint. It combines users, events, conflicts, availability, account information, and summary data.

Response:

```json
{
  "date": "2026-09-16",
  "label": "Wednesday, 16 September 2026",
  "users": [],
  "events": [],
  "conflicts": [],
  "commonFreeSlots": [
    {
      "start": "2026-09-16T09:00:00.000Z",
      "end": "2026-09-16T10:00:00.000Z"
    }
  ],
  "googleConnected": true,
  "googleAccount": {
    "name": "Satyendra Singh",
    "email": "satyendrasinghdev2@gmail.com"
  },
  "summary": {
    "totalUsers": 1,
    "totalEvents": 2,
    "conflictCount": 0,
    "nextAvailableSlot": {
      "start": "2026-09-16T09:00:00.000Z",
      "end": "2026-09-16T10:00:00.000Z"
    }
  }
}
```

### `GET /conflicts?date=YYYY-MM-DD`

Returns overlapping event pairs.

Conflict rule:

```text
eventA.start < eventB.end
AND
eventB.start < eventA.end
```

Response:

```json
{
  "date": "2026-09-16",
  "label": "Wednesday, 16 September 2026",
  "conflicts": [
    {
      "id": "event-a-event-b",
      "eventA": {},
      "eventB": {},
      "overlapStart": "2026-09-16T10:30:00.000Z",
      "overlapEnd": "2026-09-16T11:00:00.000Z",
      "durationMinutes": 30
    }
  ],
  "total": 1,
  "googleConnected": true
}
```

### `GET /availability?date=YYYY-MM-DD`

Returns common free windows calculated from the day's busy events.

Response:

```json
{
  "date": "2026-09-16",
  "label": "Wednesday, 16 September 2026",
  "commonFreeSlots": [
    {
      "start": "2026-09-16T13:00:00.000Z",
      "end": "2026-09-16T14:00:00.000Z"
    }
  ],
  "googleConnected": true
}
```

## 9. Error and status conventions

| Status | Meaning |
|---:|---|
| `200` | Successful read, logout, or OAuth URL response |
| `201` | Google event created |
| `302` | OAuth callback redirect |
| `400` | Missing/invalid request or OAuth configuration |
| `401` | Google connection required |
| `502` | Google Calendar or backend integration failure |

Typical troubleshooting:

| Symptom | Check |
|---|---|
| `redirect_uri_mismatch` | Exact production callback exists in Google Cloud |
| `Failed to fetch` | `VITE_API_URL`, backend URL, and CORS `FRONTEND_URL` |
| UI says Not connected after OAuth | Production cookie settings and backend deployment |
| Empty calendar | Google consent completed and selected account has events |
| `404` from Render URL | Render is not the active backend; use Vercel backend URL |

## 10. Security notes

- Do not commit `.env`, OAuth client secrets, session secrets, or MongoDB credentials.
- Rotate a Google client secret if it has been exposed.
- Use a different strong `SESSION_SECRET` for production.
- OAuth access is limited to the scopes requested on the consent screen.
- Calendar visibility depends on the Google account's calendar permissions.
