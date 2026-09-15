export const demoUsers = [
  { id: 'satyendra', name: 'Satyendra', email: 'satyendra@example.com', color: '#4f8cff' },
  { id: 'rahul', name: 'Rahul', email: 'rahul@example.com', color: '#34c759' },
  { id: 'amit', name: 'Amit', email: 'amit@example.com', color: '#ff9f43' }
];

export const demoEvents = [
  {
    id: 'event-satyendra-interview',
    userId: 'satyendra',
    title: 'Interview',
    start: '2026-09-15T10:00:00+05:30',
    end: '2026-09-15T11:00:00+05:30',
    location: 'Google Meet',
    meetLink: 'https://meet.google.com/xyz-abc-def',
    type: 'interview',
    busy: true
  },
  {
    id: 'event-satyendra-meeting',
    userId: 'satyendra',
    title: 'Team Sync',
    start: '2026-09-15T12:00:00+05:30',
    end: '2026-09-15T13:00:00+05:30',
    location: 'Zoom',
    meetLink: 'https://zoom.us/j/123456789',
    type: 'meeting',
    busy: true
  },
  {
    id: 'event-rahul-meeting',
    userId: 'rahul',
    title: 'Client Meeting',
    start: '2026-09-15T09:30:00+05:30',
    end: '2026-09-15T10:30:00+05:30',
    location: 'Client room',
    meetLink: null,
    type: 'meeting',
    busy: true
  },
  {
    id: 'event-rahul-interview',
    userId: 'rahul',
    title: 'Interview',
    start: '2026-09-15T11:00:00+05:30',
    end: '2026-09-15T12:00:00+05:30',
    location: 'Google Meet',
    meetLink: 'https://meet.google.com/abc-defg-hij',
    type: 'interview',
    busy: true
  },
  {
    id: 'event-amit-call',
    userId: 'amit',
    title: 'Client Call',
    start: '2026-09-15T10:30:00+05:30',
    end: '2026-09-15T11:30:00+05:30',
    location: 'Phone',
    meetLink: null,
    type: 'call',
    busy: true
  },
  {
    id: 'event-amit-review',
    userId: 'amit',
    title: 'Design Review',
    start: '2026-09-15T15:00:00+05:30',
    end: '2026-09-15T16:00:00+05:30',
    location: 'Conference room',
    meetLink: null,
    type: 'review',
    busy: true
  }
];
