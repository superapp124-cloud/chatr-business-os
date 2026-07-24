'use strict';

/**
 * CHATR OS - Calendar Connector (Simulated)
 * Simulates connecting to Google Calendar / Outlook.
 */

class CalendarConnector {
  constructor() {
    this.name = 'Google Calendar';
    this.id = 'provider.google.calendar';
  }

  async sync() {
    await new Promise(r => setTimeout(r, 400));

    // Current time
    const now = Date.now();

    return [
      {
        id: 'evt_001',
        title: 'Team Sync',
        start: now + 3600000, // in 1 hour
        end: now + 7200000,
        attendees: ['sarah@chatr.app', 'arshid@chatr.app'],
        status: 'confirmed'
      },
      {
        id: 'evt_002',
        title: 'Design Review (CONFLICT)',
        start: now + 3600000, // same time! Conflict!
        end: now + 5400000,
        attendees: ['design@chatr.app', 'arshid@chatr.app'],
        status: 'needs_action' // Needs to be rescheduled
      },
      {
        id: 'evt_003',
        title: 'Daughter\'s School Play',
        start: now + 86400000, // tomorrow
        end: now + 90000000,
        attendees: ['family'],
        status: 'confirmed'
      }
    ];
  }
}

module.exports = { CalendarConnector, calendarConnector: new CalendarConnector() };
