'use strict';

/**
 * CHATR Intent Observer — Pattern Engine (Wave 2)
 *
 * Uses real deterministic classifiers to identify intents and resolve continuity references.
 */

const genericClassifier = require('./classifiers/GenericIntentClassifier.cjs');

/**
 * Detect intents in a user message.
 *
 * @param {string} messageText - The outgoing user message
 * @returns {Array<{ type, confidence, reference, evidence }>}
 */
function detectIntents(messageText) {
  if (!messageText || typeof messageText !== 'string') return [];
  const text = messageText.trim();
  if (text.length < 8) return [];

  const detections = [];
  const outcome = genericClassifier.classify(text);

  if (outcome) {
    detections.push(outcome);
  }

  return detections;
}

module.exports = { detectIntents };
