/**
 * Meetings Capability Module 1.0
 * 
 * Demonstrates the 4 hooks: Observer, Resolver, Executor, Learner.
 * Consumes the Kernel exclusively via the SDK.
 */
const sdk = require('../../kernel-sdk/index.cjs');
const db = require('../../db/store.cjs');

const capability = sdk.capability('Meetings');

// 1. Meeting Observer
capability.observe((payload, envelope) => {
  const { classifications } = payload;
  console.log('[Meetings] Observed classifications:', classifications.map(c => c.type));
  
  classifications.forEach(understanding => {
    if (understanding.type === 'MEETING_CREATE') {
      
      // Basic entity extraction from raw text
      const text = understanding._rawText.toLowerCase();
      let extractedName = null;
      
      // Simple regex to extract name following "meet"
      const nameMatch = text.match(/meet\s+([a-z]+)/i);
      if (nameMatch && !['you', 'him', 'her', 'them', 'up', 'at', 'tomorrow', 'today', 'on'].includes(nameMatch[1].toLowerCase())) {
        extractedName = nameMatch[1];
      }

      if (extractedName) {
        // We push the raw extracted string. 
        // The Contacts capability will intercept this and resolve it to a real DB record.
        understanding.entities.people.push(extractedName);
      }

      if (text.includes('tomorrow')) {
        understanding.entities.dates.push('Tomorrow');
      }
      
      capability.publishEntities(understanding.id, understanding.entities, envelope.correlationId);

      capability.requestAction(
        understanding.id,
        {
          type: 'SCHEDULE_MEETING',
          entities: understanding.entities
        },
        envelope.correlationId
      );
    }
  });
});

// 2. Meeting Resolver (Continuity)
capability.resolve((payload, envelope) => {
  // Logic to merge Friday into the Active Meeting Context
});

// 3. Meeting Executor
capability.execute((action, envelope) => {
  if (action.type === 'SCHEDULE_MEETING') {
    
    // Check if Contacts capability failed to resolve the person
    const unverifiedPeople = action.entities.people.filter(p => p.resolved === false);
    
    if (unverifiedPeople.length > 0) {
       // Law 2: Never Invent Reality - reject execution
       capability.journal(action, 'FAILED_UNVERIFIED_ENTITIES', envelope.correlationId, envelope.payload.conversationId);
       return;
    }

    const meeting = db.insertMeeting({
      source_conversation_id: envelope.payload.conversationId || 'unknown',
      source_message_id: envelope.payload.messageId || null,
      metadata: {
        title: `Meeting with ${action.entities.people.map(p => p.name || p).join(', ')}`,
        time: action.entities.dates[0] || 'TBD'
      }
    });
    
    capability.journal(action, 'SUCCESS', envelope.correlationId, envelope.payload.conversationId);
  }
});

// 4. Meeting Learner
capability.learn((payload, envelope) => {
  // Trigger asynchronous learning
});

module.exports = { name: 'meetings', version: '1.0' };
