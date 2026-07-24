'use strict';

/**
 * Task Intent Classifier
 * Production rules for identifying task creation and continuity reference intents.
 */

class TaskIntentClassifier {
  constructor() {
    this.patterns = [
      /\bfinish (.*?)( (by|on|this|next|friday|monday|tuesday|wednesday|thursday|saturday|sunday))\b/i,
      /\bcreate a task from that\b/i,
      /\bremind me\b/i,
      /\bset (a |an )?(reminder|alarm|alert)\b/i,
      /\bi (need to|have to|must|got to|gotta|should) \w+/i,
      /\bwe (need to|have to|must|should) \w+/i,
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
      const isContinuity = /that|the meeting/i.test(text);
      return {
        type: 'TASK_CREATE',
        confidence: score >= 2 ? 0.95 : 0.85,
        reference: isContinuity ? 'ACTIVE_CONTEXT' : null,
        raw: match[0]
      };
    }

    return null;
  }
}

module.exports = new TaskIntentClassifier();
