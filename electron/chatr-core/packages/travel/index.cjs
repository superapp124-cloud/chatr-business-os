'use strict';

const { IntentIntelligencePackage } = require('../../kernel-sdk/package-api.cjs');
const path = require('path');
const fs = require('fs');

class Package extends IntentIntelligencePackage {
  async initialize() {
    // 1. Load Ontology
    this.registerOntology(this._loadJson('ontology/flight.json'));
    
    // 2. Load Intents
    this.registerIntentModel(require('./intents/travel.intent.cjs'));
    
    // 3. Load Goals
    this.registerGoalTemplate(this._loadJson('goals/book-flight.json'));
    
    // 4. Load Workflows
    this.registerWorkflowTemplate(this._loadJson('workflows/book-flight-workflow.json'));
    
    // 5. Load Policies
    this.registerPolicy(this._loadJson('policies/cancellation.json'));
    
    // 6. Load Knowledge
    this.registerKnowledge(this._loadJson('knowledge/airports.json'));
  }

  _loadJson(relativePath) {
    try {
      const fullPath = path.join(__dirname, relativePath);
      return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (e) {
      console.warn(`[Package:travel] Could not load ${relativePath}: ${e.message}`);
      return {};
    }
  }
}

module.exports = { Package };
