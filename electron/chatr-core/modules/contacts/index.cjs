'use strict';

/**
 * Contacts Capability Module 1.0
 * Uses the Kernel SDK to interact with the system.
 */
const sdk = require('../../kernel-sdk/index.cjs');
const db = require('../../db/store.cjs');

const capability = sdk.capability('Contacts');

capability.observe((payload, envelope) => {
  const { classifications } = payload;
  
  classifications.forEach(understanding => {
    // We observe ALL intents that might contain people
    if (understanding.entities && understanding.entities.people) {
      
      let modified = false;
      const resolvedPeople = understanding.entities.people.map(person => {
        // If it's just a string name extracted by regex, resolve it
        const nameToSearch = typeof person === 'string' ? person : person.name;
        // Query LocalDB
        if (nameToSearch && (!person.id || person.id.startsWith('temp_'))) {
          const realContact = db.findContactByName(nameToSearch);
          if (realContact) {
            modified = true;
            return realContact; // rich entity
          } else {
            // Law 2: Never Invent Reality
            modified = true;
            return { name: nameToSearch, resolved: false, reason: 'NOT_FOUND' };
          }
        }
        return person;
      });

      if (modified) {
        understanding.entities.people = resolvedPeople;
        capability.publishEntities(understanding.id, understanding.entities, envelope.correlationId);
      }
    }
  });
});

module.exports = { name: 'contacts', version: '1.0' };
