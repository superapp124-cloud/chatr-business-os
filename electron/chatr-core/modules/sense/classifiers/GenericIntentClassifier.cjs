'use strict';
const crypto = require('crypto');

/**
 * Generic Intent Classifier
 * Extracts a standardized Outcome payload from raw conversation text.
 */
class GenericIntentClassifier {
  constructor() {
    // Very simple regex patterns for the vertical slice
    this.patterns = [
      {
        regex: /\bremind me to (.*?) (tomorrow|today|next week|on \w+) at (.*)/i,
        handler: (match) => {
          // Remind me to call John tomorrow at 2 PM
          const [_, title, relDate, timeStr] = match;
          
          let dateStr = 'unknown';
          if (relDate.toLowerCase() === 'tomorrow') {
            const tmrw = new Date();
            tmrw.setDate(tmrw.getDate() + 1);
            dateStr = tmrw.toISOString().split('T')[0];
          } else if (relDate.toLowerCase() === 'today') {
            dateStr = new Date().toISOString().split('T')[0];
          }

          let parsedTime = '12:00:00';
          if (timeStr.toLowerCase().includes('pm')) {
             let h = parseInt(timeStr, 10);
             if (!isNaN(h) && h < 12) h += 12;
             parsedTime = `${h.toString().padStart(2, '0')}:00:00`;
          } else if (timeStr.toLowerCase().includes('am')) {
             let h = parseInt(timeStr, 10);
             if (h === 12) h = 0;
             parsedTime = `${h.toString().padStart(2, '0')}:00:00`;
          } else {
             let h = parseInt(timeStr, 10);
             if (!isNaN(h)) parsedTime = `${h.toString().padStart(2, '0')}:00:00`;
          }

          return {
            id: crypto.randomUUID(),
            intent: 'CREATE_REMINDER',
            type: 'reminder',
            capability: 'core.reminder',
            title: title,
            participants: [], // basic extraction, could pull from 'call John'
            schedule: {
              relative: relDate + ' ' + timeStr,
              resolved: `${dateStr}T${parsedTime}`
            },
            confidence: 0.99,
            status: 'detected',
            source: 'conversation'
          };
        }
      },
      {
        regex: /\bmeet with (.*?) (tomorrow|today) at (.*?)\b/i,
        handler: (match) => {
          const [_, person, relDate, timeStr] = match;
          return {
            id: crypto.randomUUID(),
            intent: 'CREATE_MEETING',
            type: 'meeting',
            capability: 'core.meeting',
            title: `Meet with ${person}`,
            participants: [{ name: person }],
            schedule: {
              relative: relDate + ' ' + timeStr,
              resolved: new Date().toISOString()
            },
            confidence: 0.90,
            status: 'detected',
            source: 'conversation'
          };
        }
      }
    ];
  }

  classify(text) {
    for (const p of this.patterns) {
      const match = text.match(p.regex);
      if (match) {
        return p.handler(match);
      }
    }
    return null; // Fallback to unknown or null
  }
}

module.exports = new GenericIntentClassifier();
