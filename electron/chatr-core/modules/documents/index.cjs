'use strict';

/**
 * Documents Capability Module 1.0
 * Uses the Kernel SDK to interact with the system.
 */
const sdk = require('../../kernel-sdk/index.cjs');
const db = require('../../db/store.cjs');

const capability = sdk.capability('Documents');

capability.observe((payload, envelope) => {
  const { classifications } = payload;
  
  classifications.forEach(understanding => {
    if (understanding.type === 'DOCUMENT_ATTACH') {
      
      // Extract the document name from the raw text (basic implementation)
      const match = understanding._rawText.match(/the (.*?)(proposal|document|deck)/i);
      const docName = match ? (match[1] + match[2]).trim() : '';

      // Validate against real local DB
      const realDoc = db.findDocumentByTitle(docName);

      if (!realDoc) {
        // Law 2: Never Invent Reality
        capability.publishEntities(understanding.id, { resolved: false, reason: 'NOT_FOUND', search: docName }, envelope.correlationId);
        
        capability.requestAction(understanding.id, {
          type: 'DOCUMENT_SELECT',
          prompt: `I couldn't find a document matching "${docName}". Choose one.`,
          options: [] // Provide list of recent docs
        }, envelope.correlationId);
      } else {
        // We found the real document
        understanding.entities.documents = [realDoc];
        capability.publishEntities(understanding.id, understanding.entities, envelope.correlationId);

        capability.requestAction(understanding.id, {
          type: 'DOCUMENT_ATTACH',
          document: realDoc,
          contextRef: understanding.contextRef || null
        }, envelope.correlationId);
      }
    }
  });
});

capability.execute((action, envelope) => {
  if (action.type === 'DOCUMENT_ATTACH') {
    // In production, write relationship to db mapping action.contextRef to action.document.id
    capability.journal(action, 'SUCCESS', envelope.correlationId, envelope.payload.conversationId);
  }
});

module.exports = { name: 'documents', version: '1.0' };
