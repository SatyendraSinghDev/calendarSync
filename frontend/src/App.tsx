import { useEffect, useMemo, useState } from 'react';

type User = {
  id: string;
  name: string;
  email: string;
  color: string;
};

type EventItem = {
  id: string;
  userId: string;
  title: string;
  start: string;
  end: string;
  location: string;
  meetLink?: string | null;
  type: string;
  busy: boolean;
  user: User;
};

type ConflictItem = {
  id: string;
  eventA: EventItem;
  eventB: EventItem;
  overlapStart: string;
  overlapEnd: string;
  durationMinutes: number;
};

type Dashboard = {
  date: string;
  label: string;
  users: User[];
  events: EventItem[];
  conflicts: ConflictItem[];
  commonFreeSlots: { start: string; end: string }[];
  googleConnected: boolean;
  googleAccount?: { name: string; email: string };
  summary: {
    totalUsers: number;
    totalEvents: number;
    conflictCount: number;
    nextAvailableSlot: { start: string; end: string } | null;
  };
};

type CalendarView = 'day' | 'week' | 'month' | 'year';

const defaultDate = '2026-09-15';

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTime = (dateString: string) =>
  new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(dateString));

const formatRange = (start: string, end: string) => `${formatTime(start)} - ${formatTime(end)}`;
const getAccountInitial = (account?: Dashboard['googleAccount']) => {
  const name = account?.name?.trim();
  const identity = name && name !== 'Google user' ? name : account?.email;
  return (identity || 'G').charAt(0).toUpperCase();
};

function App() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string>('');
  const [view, setView] = useState<CalendarView>('day');
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [calendarScrolled, setCalendarScrolled] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [myCalendarsOpen, setMyCalendarsOpen] = useState(true);
  const [otherCalendarsOpen, setOtherCalendarsOpen] = useState(true);
  const [hiddenCalendarIds, setHiddenCalendarIds] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createStart, setCreateStart] = useState(`${defaultDate}T10:00`);
  const [createEnd, setCreateEnd] = useState(`${defaultDate}T11:00`);
  const [createLocation, setCreateLocation] = useState('');
  const account = dashboard?.googleAccount || dashboard?.users.find((user) => user.email);
  const toggleCalendar = (calendarId: string) => {
    setHiddenCalendarIds((hiddenIds) =>
      hiddenIds.includes(calendarId) ? hiddenIds.filter((id) => id !== calendarId) : [...hiddenIds, calendarId]
    );
  };

  const fetchDashboard = async (date = selectedDate) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard?date=${date}`, { credentials: 'include' });
      if (!response.ok) {
        let message = 'Unable to load shared calendar data.';
        try {
          const errorBody = (await response.json()) as { message?: string };
          if (errorBody.message) {
            message = errorBody.message;
          }
        } catch {
          message = `Unable to load shared calendar data (HTTP ${response.status}).`;
        }
        throw new Error(message);
      }
      const json = (await response.json()) as Dashboard;
      setDashboard(json);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleStatus = params.get('google');
    const message = params.get('message');

    if (googleStatus === 'connected') {
      setAuthMessage('Google Calendar connected successfully.');
      setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 3000);
    }

    if (googleStatus === 'error' && message) {
      setAuthMessage(decodeURIComponent(message));
      setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 4000);
    }

    fetchDashboard(defaultDate);
  }, []);

  const timeline = useMemo(() => Array.from({ length: 23 }, (_, index) => index + 1), []);

  const connectGoogleCalendar = async () => {
    try {
      const response = await fetch('/api/auth/google-url', { credentials: 'include' });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message || 'Google OAuth is not configured yet.');
      }
      if (json.url) {
        window.location.href = json.url;
      }
    } catch (connectError) {
      const message = connectError instanceof Error ? connectError.message : 'Unable to connect Google Calendar.';
      setAuthMessage(message);
      console.error(connectError);
    }
  };

  const logoutGoogleCalendar = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      window.location.reload();
    } catch (logoutError) {
      console.error(logoutError);
    }
  };

  const createEvent = async () => {
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createTitle,
          start: createStart,
          end: createEnd,
          location: createLocation
        })
      });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(body.message || 'Unable to create event.');
      }
      setCreateOpen(false);
      setCreateTitle('');
      setCreateLocation('');
      await fetchDashboard(selectedDate);
    } catch (createError) {
      setAuthMessage(createError instanceof Error ? createError.message : 'Unable to create event.');
    }
  };

  if (loading) {
    return <div className="page-shell"><div className="status-card">Loading calendar dashboard…</div></div>;
  }

  if (error || !dashboard) {
    return (
      <div className="page-shell">
        <div className="status-card error-card">
          <h2>Could not load dashboard</h2>
          <p>{error || 'No dashboard available.'}</p>
          <div className="error-actions">
            <button onClick={() => fetchDashboard()}>Retry</button>
            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                await connectGoogleCalendar();
              }}
            >
              Reconnect Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  const calendarStartHour = 1;
  const pixelsPerMinute = 1;
  const now = new Date();
  const currentDate = toDateInputValue(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimePosition = selectedDate === currentDate && currentMinutes >= calendarStartHour * 60
    ? Math.min((currentMinutes - calendarStartHour * 60) * pixelsPerMinute + 30, 23 * 60 * pixelsPerMinute + 30)
    : null;
  const eventPosition = (event: EventItem) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = Math.max(startMinutes + 30, end.getHours() * 60 + end.getMinutes());
    const top = Math.max(0, (startMinutes - calendarStartHour * 60) * pixelsPerMinute + 30);
    const height = Math.max(46, (endMinutes - startMinutes) * pixelsPerMinute - 4);

    return {
      top: `${top}px`,
      height: `${height}px`
    };
  };

  const changeDate = (offset: number) => {
    const nextDate = new Date(`${selectedDate}T12:00:00`);
    if (view === 'week') nextDate.setDate(nextDate.getDate() + offset * 7);
    else if (view === 'month') nextDate.setMonth(nextDate.getMonth() + offset);
    else if (view === 'year') nextDate.setFullYear(nextDate.getFullYear() + offset);
    else nextDate.setDate(nextDate.getDate() + offset);
    const value = toDateInputValue(nextDate);
    setSelectedDate(value);
    fetchDashboard(value);
  };

  const selectDate = (value: string) => {
    setSelectedDate(value);
    fetchDashboard(value);
  };

  const selected = new Date(`${selectedDate}T12:00:00`);
  const changeMonth = (offset: number) => {
    const nextMonth = new Date(selected.getFullYear(), selected.getMonth() + offset, 1, 12);
    selectDate(toDateInputValue(nextMonth));
  };
  const weekStart = new Date(selected);
  weekStart.setDate(selected.getDate() - selected.getDay());
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
  const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(selected);
  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const monthDays = Array.from(
    { length: new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate() },
    (_, index) => index + 1
  );
  const leadingDays = Array.from({ length: monthStart.getDay() }, (_, index) => `empty-${index}`);
  const displayUsers = dashboard.users.length > 0
    ? dashboard.users
    : [{ id: 'calendar', name: 'My calendar', email: '', color: '#1a73e8' }];

  const openCreateForDate = (date = selectedDate) => {
    setCreateStart(`${date}T10:00`);
    setCreateEnd(`${date}T11:00`);
    setCreateOpen(true);
  };

  return (
    <div className="google-calendar-app">
      <header className="google-topbar">
        <div className="brand">
          <button
            className="menu-button"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? 'Hide calendar sidebar' : 'Show calendar sidebar'}
          >
            ☰
          </button>
          <strong>Calendar</strong>
        </div>
        <button className="today-button" onClick={() => selectDate(toDateInputValue(new Date()))}>Today</button>
        <div className="date-navigation">
          <button onClick={() => changeDate(-1)} aria-label="Previous day">‹</button>
          <button onClick={() => changeDate(1)} aria-label="Next day">›</button>
          <h1>
            {view === 'year'
              ? selected.getFullYear()
              : view === 'month'
                ? new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(selected)
                : view === 'week'
                  ? `${new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric' }).format(weekDays[0])} – ${new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }).format(weekDays[6])}`
                  : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(selected)}
          </h1>
        </div>
        <div className="top-actions">
          <div className="view-menu-wrap header-view-menu">
            <button
              className="view-button header-view-button"
              onClick={() => setViewMenuOpen((open) => !open)}
              aria-expanded={viewMenuOpen}
              aria-haspopup="menu"
            >
              <span className="header-view-content">
                {view === 'day' ? 'Day' : view === 'week' ? 'Week' : view === 'month' ? 'Month' : 'Year'}
                <span className="header-view-arrow" aria-hidden="true" />
              </span>
            </button>
            {viewMenuOpen && (
              <div className="view-menu header-view-dropdown" role="menu">
                {(['day', 'week', 'month', 'year'] as CalendarView[]).map((option) => (
                  <button
                    key={option}
                    className="view-option-check"
                    onClick={() => {
                      setView(option);
                      setViewMenuOpen(false);
                    }}
                    role="menuitem"
                  >
                    <span>{option.charAt(0).toUpperCase() + option.slice(1)}</span>
                    {view === option && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="account-menu-wrap">
            <button
              className="account-avatar"
              onClick={() => setAccountMenuOpen((open) => !open)}
              aria-label="Open account menu"
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
            >
              {getAccountInitial(account)}
            </button>
            {accountMenuOpen && (
              <div className="account-menu" role="menu">
                <div className="account-identity">
                  <strong>{account?.name || 'Google account'}</strong>
                  <span>{account?.email || 'Not connected'}</span>
                </div>
                <span className={`status-pill ${dashboard.googleConnected ? 'connected' : ''}`}>
                  {dashboard.googleConnected ? 'Connected' : 'Not connected'}
                </span>
                <button className="account-menu-action" onClick={connectGoogleCalendar} role="menuitem">
                  {dashboard.googleConnected ? 'Reconnect' : 'Connect Google'}
                </button>
                {dashboard.googleConnected && (
                  <button className="account-menu-action" onClick={logoutGoogleCalendar} role="menuitem">
                    Logout
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {authMessage && <div className="auth-banner">{authMessage}</div>}

      <div className="calendar-workspace">
        <aside className={`calendar-sidebar ${sidebarOpen ? '' : 'sidebar-hidden'}`}>
          <button className="sidebar-create" onClick={() => openCreateForDate()}>
            <span className="create-icon" aria-hidden="true">＋</span>
            <span className="create-label">Create</span>
            <span className="create-arrow" aria-hidden="true" />
          </button>
          <div className="month-heading">
            <strong>{monthLabel}</strong>
            <div className="month-navigation">
              <button onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button>
              <button onClick={() => changeMonth(1)} aria-label="Next month">›</button>
            </div>
          </div>
          <div className="weekdays">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
          <div className="month-grid">
            {[...leadingDays, ...monthDays].map((day) => {
              if (typeof day !== 'number') return <span key={day} />;
              const value = toDateInputValue(new Date(selected.getFullYear(), selected.getMonth(), day));
              return (
                <button
                  key={value}
                  className={value === selectedDate ? 'selected-day' : ''}
                  onClick={() => selectDate(value)}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="calendar-section-heading">
            <h3>My calendars</h3>
            <button onClick={() => setMyCalendarsOpen((open) => !open)} aria-label={`${myCalendarsOpen ? 'Collapse' : 'Expand'} my calendars`}>
              {myCalendarsOpen ? '⌃' : '⌄'}
            </button>
          </div>
          {myCalendarsOpen && displayUsers.map((user) => (
            <button className="calendar-toggle" key={user.id} onClick={() => toggleCalendar(user.id)}>
              <span
                className={`calendar-checkbox ${hiddenCalendarIds.includes(user.id) ? 'calendar-checkbox-hidden' : ''}`}
                style={{ background: hiddenCalendarIds.includes(user.id) ? '#dadce0' : user.color }}
              >
                {hiddenCalendarIds.includes(user.id) ? '' : '✓'}
              </span>
              <span>{user.email || user.name}</span>
            </button>
          ))}
          <div className="calendar-section-heading other-calendars-heading">
            <h3>Other calendars</h3>
            <div>
              <button onClick={() => setOtherCalendarsOpen((open) => !open)} aria-label={`${otherCalendarsOpen ? 'Collapse' : 'Expand'} other calendars`}>
                {otherCalendarsOpen ? '⌃' : '⌄'}
              </button>
            </div>
          </div>
          {otherCalendarsOpen && (
            <button className="calendar-toggle" onClick={() => toggleCalendar('holidays')}>
              <span className={`calendar-checkbox ${hiddenCalendarIds.includes('holidays') ? 'calendar-checkbox-hidden' : ''}`} style={{ background: hiddenCalendarIds.includes('holidays') ? '#dadce0' : '#0f8043' }}>
                {hiddenCalendarIds.includes('holidays') ? '' : '✓'}
              </span>
              <span>Holidays in India</span>
            </button>
          )}
        </aside>

        {view !== 'day' && (
          <main className={`calendar-overview ${view}-overview`}>
            {view === 'week' && (
              <div className="week-overview-grid">
                {weekDays.map((date) => (
                  <button key={toDateInputValue(date)} className="week-overview-day" onClick={() => selectDate(toDateInputValue(date))}>
                    <span>{new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(date).toUpperCase()}</span>
                    <strong>{date.getDate()}</strong>
                    {dashboard.events.filter((event) => event.start.slice(0, 10) === toDateInputValue(date)).map((event) => (
                      <span key={event.id} className="overview-event" style={{ backgroundColor: event.user.color }}>{formatTime(event.start)} {event.title}</span>
                    ))}
                  </button>
                ))}
              </div>
            )}
            {view === 'month' && (
              <div className="month-overview-grid">
                {[...leadingDays, ...monthDays].map((day, index) => {
                  const date = typeof day === 'number'
                    ? new Date(selected.getFullYear(), selected.getMonth(), day)
                    : null;
                  if (!date) return <span key={`empty-${index}`} />;
                  const value = toDateInputValue(date);
                  return (
                    <button key={value} onClick={() => selectDate(value)}>
                      <strong>{date.getDate()}</strong>
                      {dashboard.events.filter((event) => event.start.slice(0, 10) === value).map((event) => (
                        <span key={event.id} className="overview-event" style={{ backgroundColor: event.user.color }}>{event.title}</span>
                      ))}
                    </button>
                  );
                })}
              </div>
            )}
            {view === 'year' && (
              <div className="year-overview-grid">
                {Array.from({ length: 12 }, (_, month) => (
                  <section key={month}>
                    <h2>{new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date(selected.getFullYear(), month, 1))}</h2>
                    <div className="year-month-days">
                      {Array.from({ length: new Date(selected.getFullYear(), month + 1, 0).getDate() }, (_, day) => (
                        <button key={day} onClick={() => selectDate(toDateInputValue(new Date(selected.getFullYear(), month, day + 1)))}>{day + 1}</button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </main>
        )}
        {view === 'day' && <main className="day-calendar day-view">
          <div className={`calendar-header-row ${calendarScrolled ? 'is-scrolled' : ''}`} style={{ gridTemplateColumns: '76px minmax(0, 1fr)' }}>
            <div className="time-header">GMT+05:30</div>
            <div className="calendar-user-header">
              <span className="weekday-label">{new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(selected).toUpperCase()}</span>
              <span className="day-number">{selected.getDate()}</span>
            </div>
          </div>
          <div
            className="calendar-body"
            onScroll={(event) => setCalendarScrolled(event.currentTarget.scrollTop > 0)}
            style={{ gridTemplateColumns: '76px minmax(0, 1fr)' }}
          >
            <div className="time-axis">
              {timeline.map((hour) => <div key={hour} className="hour-label">{hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}</div>)}
            </div>
            <div className="calendar-column">
              {timeline.map((hour) => <div key={hour} className="hour-line" />)}
              {currentTimePosition !== null && (
                <div className="current-time-line" style={{ top: `${currentTimePosition}px` }}>
                  <span />
                </div>
              )}
              {dashboard.events.filter((event) => !hiddenCalendarIds.includes(event.userId)).map((event) => (
                <a
                  key={event.id}
                  className="positioned-event"
                  href={event.meetLink || '#'}
                  onClick={(clickEvent) => {
                    clickEvent.preventDefault();
                    setSelectedEvent(event);
                  }}
                  style={{ ...eventPosition(event), backgroundColor: event.user.color }}
                >
                  <strong>{event.title}</strong>
                  <span>{formatRange(event.start, event.end)}</span>
                  {event.location && <small>{event.location}</small>}
                </a>
              ))}
            </div>
          </div>
        </main>}
      </div>
      {selectedEvent && (
        <div className="modal-backdrop" onClick={() => setSelectedEvent(null)}>
          <section className="event-dialog" onClick={(event) => event.stopPropagation()}>
            <button className="dialog-close" onClick={() => setSelectedEvent(null)}>×</button>
            <div className="event-dialog-color" style={{ background: selectedEvent.user.color }} />
            <h2>{selectedEvent.title}</h2>
            <p>{formatRange(selectedEvent.start, selectedEvent.end)}</p>
            <p>{selectedEvent.location || 'No location'}</p>
            {selectedEvent.meetLink && <a href={selectedEvent.meetLink} target="_blank" rel="noreferrer">Open meeting link</a>}
          </section>
        </div>
      )}
      {createOpen && (
        <div className="modal-backdrop" onClick={() => setCreateOpen(false)}>
          <section className="create-dialog" onClick={(event) => event.stopPropagation()}>
            <button className="dialog-close" onClick={() => setCreateOpen(false)}>×</button>
            <h2>Create event</h2>
            <input placeholder="Add title" value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} autoFocus />
            <label>Start<input type="datetime-local" value={createStart} onChange={(event) => setCreateStart(event.target.value)} /></label>
            <label>End<input type="datetime-local" value={createEnd} onChange={(event) => setCreateEnd(event.target.value)} /></label>
            <input placeholder="Add location" value={createLocation} onChange={(event) => setCreateLocation(event.target.value)} />
            <button className="primary-button" onClick={createEvent}>Save</button>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
