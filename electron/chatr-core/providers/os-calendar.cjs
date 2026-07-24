'use strict';

const log = (() => { try { return require('electron-log'); } catch { return console; } })();

/**
 * CHATR Native OS Calendar Provider
 * Capability: workflow.read_calendar
 * 
 * Interacts with the host OS to read today's agenda locally,
 * avoiding cloud sync where possible.
 */
class OSCalendarProvider {
  constructor() {
    this.name = 'OSCalendarProvider';
  }

  async execute(capabilityId, parameters, context) {
    if (capabilityId === 'Planning.Schedule') {
      return this._scheduleEvent(parameters);
    }
    throw new Error(`Unsupported capability: ${capabilityId}`);
  }

  async _scheduleEvent(parameters) {
    log.info(`[OSCalendarProvider] Scheduling local event: ${parameters.title || 'Untitled'} at ${parameters.time_range}`);
    return {
      success: true,
      eventId: `cal_evt_${Date.now()}`,
      title: parameters.title,
      timeRange: parameters.time_range
    };
  }

  async readAgenda(context) {
    const { date } = context;
    log.info(`[OSCalendarProvider] Reading local agenda for ${date || 'today'}`);

    // In a real OS integration, this would spawn AppleScript on macOS (e.g. via `osascript`)
    // or query Outlook/Windows Calendar COM APIs on Windows to extract today's events.
    // For V1 MVP, we simulate a successful native query.

    return {
      success: true,
      source: 'local_os',
      date: date || new Date().toISOString().split('T')[0],
      events: [
        {
          title: "Engineering Sync",
          time: "10:00 AM",
          attendees: ["arshid@chatr.com", "jane@chatr.com"]
        },
        {
          title: "Architecture Review",
          time: "2:00 PM",
          attendees: ["arshid@chatr.com"]
        }
      ]
    };
  }

  async execute(context) {
    if (context.action === 'read_calendar') {
      return this.readAgenda(context.parameters || context);
    }
    throw new Error(`[OSCalendarProvider] Unsupported action: ${context.action}`);
  }
}

module.exports = { OSCalendarProvider };
