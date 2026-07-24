'use strict';

/**
 * CHATR Kernel - Model Registry
 * Declarative source of truth for all models.
 */

const fs = require('fs');
const path = require('path');

class ModelRegistry {
  constructor() {
    this.models = new Map();
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'models.json'), 'utf8'));
      for (const m of data.models) {
        this.models.set(m.id, m);
      }
    } catch (err) {
      console.warn('[ModelRegistry] Failed to load models.json:', err.message);
    }
  }

  getAll() {
    return Array.from(this.models.values());
  }

  getById(id) {
    return this.models.get(id);
  }
}

const modelRegistry = new ModelRegistry();
module.exports = { modelRegistry, ModelRegistry };
