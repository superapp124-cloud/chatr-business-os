'use strict';

/**
 * Document Intent Classifier
 * Production rules for identifying document attachment and search intents.
 */

class DocumentIntentClassifier {
  constructor() {
    this.patterns = [
      /\battach (the|a) (proposal|document|file|deck|presentation|spreadsheet)\b/i,
      /\blink (the|a) (proposal|document|file|deck|presentation)\b/i,
      /\bfind the (.*?)(proposal|document|deck)\b/i,
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
      const isContinuity = /the proposal/i.test(text); // Basic resolution trigger for testing purposes
      return {
        type: 'DOCUMENT_ATTACH',
        confidence: score >= 2 ? 0.95 : 0.85,
        reference: isContinuity ? 'ACTIVE_CONTEXT' : null,
        raw: match[0]
      };
    }

    return null;
  }
}

module.exports = new DocumentIntentClassifier();
