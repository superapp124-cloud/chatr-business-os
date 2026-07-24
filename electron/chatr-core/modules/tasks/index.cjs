'use strict';

/**
 * Tasks Capability Module 1.0
 * Uses the Kernel SDK to interact with the system.
 */
const sdk = require('../../kernel-sdk/index.cjs');
const db = require('../../db/store.cjs');

const capability = sdk.capability('Tasks');

// 1. Observer
capability.observe((payload, envelope) => {
  const { classifications } = payload;
  
  classifications.forEach(understanding => {
    if (understanding.type === 'TASK_CREATE') {
      
      const action = {
        type: 'CREATE_TASK',
        summary: understanding._rawText,
        contextRef: understanding.contextRef || null,
        entities: understanding.entities
      };

      // If we inherited context from a meeting, link the task to it
      if (understanding.contextRef) {
        action.linkedContext = understanding.contextRef;
      }

      capability.publishEntities(understanding.id, understanding.entities, envelope.correlationId);
      capability.requestAction(understanding.id, action, envelope.correlationId);
    }
  });
});

// 2. Resolver
capability.resolve((payload, envelope) => {
  // Resolve active task contexts
});

// 3. Executor
capability.execute((action, envelope) => {
  if (action.type === 'CREATE_TASK') {
    const task = db.insertTask({
      source_conversation_id: envelope.payload.conversationId || 'unknown',
      source_message_id: envelope.payload.messageId || null,
      metadata: {
        summary: action.summary,
        linkedContext: action.linkedContext
      }
    });
    
    capability.journal(action, 'SUCCESS', envelope.correlationId, envelope.payload.conversationId);
  }
});

// 4. Learner
capability.learn((payload, envelope) => {
  // No-op for now
});

module.exports = { name: 'tasks', version: '1.0' };
