'use strict';

/**
 * CHATR Kernel — ChatrModule Interface
 *
 * Genesis Milestone 4 establishes the standard module contract.
 * Every new intelligence module MUST implement these methods.
 * Note: Stable legacy modules (like Conversation) are exempt until their deliberate rewrite.
 */

class ChatrModule {
  /**
   * Observe a raw event/input.
   */
  async observe(event) {
    throw new Error('observe() must be implemented');
  }

  /**
   * Classify an observation.
   */
  async classify(observation) {
    throw new Error('classify() must be implemented');
  }

  /**
   * Extract semantic meaning from a classification.
   */
  async understand(classification) {
    throw new Error('understand() must be implemented');
  }

  /**
   * Convert understanding into an actionable UI suggestion.
   */
  async suggest(understanding) {
    throw new Error('suggest() must be implemented');
  }

  /**
   * Execute an accepted suggestion.
   */
  async execute(action) {
    throw new Error('execute() must be implemented');
  }

  /**
   * Verify the result of an execution.
   */
  async verify(result) {
    throw new Error('verify() must be implemented');
  }

  /**
   * Learn from verification or user feedback.
   */
  async learn(feedback) {
    throw new Error('learn() must be implemented');
  }
}

module.exports = { ChatrModule };
