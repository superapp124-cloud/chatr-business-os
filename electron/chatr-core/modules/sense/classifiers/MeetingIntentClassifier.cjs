'use strict';

/**
 * Meeting Intent Classifier
 * Production rules for identifying meeting creation intents.
 */

class MeetingIntentClassifier {
  constructor() {
    this.patterns = [
      /\blet('?s| us) meet\b/i,
      /\bmeet (you|him|her|them|up)? ?(at|tomorrow|today|on|next|this)\b/i,
      /\bmeet\s+[a-z]+\s+(tomorrow|today|on|next|this)\b/i,
      /\b(schedule|arrange|set up|book) (a |the )?(meeting|call|zoom|catch[- ]?up|session)\b/i,
      /\b(coffee|lunch|dinner) (tomorrow|today|next|this (morning|afternoon|evening|week)|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
      /\b(zoom|video|teams|google meet) call\b/i,
      /\bmeet(ing)? at \d{1,2}(:\d{2})?\s*(am|pm)?\b/i,
    ];
  }

  classify(text) {
    let score = 0;
    let match = null;

    for (const pattern of this.patterns) {
      const m = text.match(pattern);
      if (m) {
        score++;
        match = m;
      }
    }

    if (score > 0) {
      return {
        type: 'MEETING_CREATE',
        confidence: score >= 2 ? 0.95 : 0.85,
        reference: null,
        raw: match[0]
      };
    }

    return null;
  }
}

module.exports = new MeetingIntentClassifier();
