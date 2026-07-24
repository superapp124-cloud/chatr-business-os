'use strict';

/**
 * CHATR Kernel SDK
 * 
 * Provides a clean capability boundary so vertical modules (Tasks, Meetings)
 * never need to import internal kernel routing logic (`bus.cjs`, etc).
 */

const { bus } = require('../events/bus.cjs');
const crypto = require('crypto');

function capability(name) {
  const capabilityName = name;

  return {
    /**
     * Listen to OBSERVATION events to extract domain entities.
     */
    observe(handler) {
      bus.subscribe('KERNEL.UNDERSTANDING.CREATED', (envelope) => {
        handler(envelope.payload, envelope);
      });
    },

    /**
     * Listen to CONTEXT events to merge continuity context.
     */
    resolve(handler) {
      bus.subscribe('KERNEL.CONTEXT.RESOLVED', (envelope) => {
        handler(envelope.payload, envelope);
      });
    },

    /**
     * Publish extracted entities to the Kernel Entity Graph.
     */
    publishEntities(understandingId, entities, correlationId) {
      bus.publish('KERNEL.ENTITY.RESOLVED', {
        understandingId,
        entities,
        capability: capabilityName,
        correlationId
      });
    },

    /**
     * Request the Kernel to surface an Action to the user for confirmation.
     */
    requestAction(understandingId, actionDef, correlationId) {
      bus.publish('KERNEL.ACTION.REVEALED', {
        understandingId,
        action: actionDef,
        capability: capabilityName,
        correlationId
      });
    },

    /**
     * Handle explicit user confirmation of an Action.
     */
    execute(handler) {
      bus.subscribe('KERNEL.ACTION.CONFIRMED', (envelope) => {
        handler(envelope.payload.action, envelope);
      });
    },

    /**
     * Record execution success to the Intent Journal.
     */
    journal(action, status, correlationId, conversationId) {
      bus.publish('KERNEL.ACTION.EXECUTED', {
        action,
        status,
        capability: capabilityName,
        correlationId,
        conversationId
      });
    },

    /**
     * Listen for Journal events to perform asynchronous learning.
     */
    learn(handler) {
      bus.subscribe('KERNEL.JOURNAL.APPENDED', (envelope) => {
        // Only trigger learning if the journal event belongs to this capability
        if (envelope.capability === capabilityName) {
          handler(envelope.payload, envelope);
          
          // Signal learning completion
          bus.publish('KERNEL.LEARNING.COMPLETE', { 
            capability: capabilityName,
            correlationId: envelope.correlationId 
          });
        }
      });
    }
  };
}

module.exports = { capability };
