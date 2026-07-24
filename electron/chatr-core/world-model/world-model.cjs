'use strict';

const { Projection, projectionManager } = require('../kernel/projection-manager.cjs');
const { bus } = require('../events/bus.cjs');

/**
 * CHATR Intelligence Platform — Unified World Model (UWM)
 * Phase 1
 *
 * The UWM is a comprehensive, multi-dimensional graph database projected 
 * entirely from the Event Ledger. It replaces the simple WorldModel cache.
 * 
 * It maintains distinct semantic projections:
 * - Personal Twin (identity, habits, preferences, energy, attention)
 * - Business Twin (organizations, projects, finance constraints)
 * - Social Graph (relationships, teams, family)
 * - Goal Graph (long-term goals, milestones, dependencies)
 * - Spatial/Temporal Graph (places, execution history)
 */

class UnifiedWorldModel extends Projection {
  constructor() {
    super('UnifiedWorldModel', '*'); // Listens to the global stream

    // Initialize the multiple semantic graphs
    this._graphs = {
      personal: new Map(),   // id -> person (identity, energy, attention)
      business: new Map(),   // id -> company, project, constraint
      social: new Map(),     // id -> relationship edge
      spatial: new Map(),    // id -> place
      preferences: new Map(),// id -> preference
      executions: []         // temporal history of intents/actions
    };

    // Subscriptions
    bus.subscribe('kernel.observation.created', (e) => this.applyEvent(e));
    bus.subscribe('kernel.preference.updated', (e) => this.applyEvent(e));
    bus.subscribe('kernel.execution.completed', (e) => this.applyEvent(e));
  }

  // --- Projection Interface ---

  applyEvent(envelope) {
    const payload = envelope.payload || {};

    if (envelope.event_type === 'kernel.observation.created') {
      const type = payload.entity_type;
      const id = payload.entity_id;
      const data = payload.data || {};

      if (type === 'person') {
        const existing = this._graphs.personal.get(id) || {};
        this._graphs.personal.set(id, { ...existing, ...data, last_observed: envelope.timestamp });
      } 
      else if (type === 'company' || type === 'constraint') {
        const existing = this._graphs.business.get(id) || { entity_type: type };
        this._graphs.business.set(id, { ...existing, ...data, entity_type: type, last_observed: envelope.timestamp });
      }
      else if (type === 'relationship') {
        const existing = this._graphs.social.get(id) || {};
        this._graphs.social.set(id, { ...existing, ...data, last_observed: envelope.timestamp });
      }
      else if (type === 'place') {
        const place = this._graphs.spatial.get(id) || { visit_count: 0 };
        this._graphs.spatial.set(id, {
          ...place,
          ...data,
          visit_count: place.visit_count + 1,
          last_visited: envelope.timestamp
        });
      }
    } 
    else if (envelope.event_type === 'kernel.preference.updated') {
      const { intent, field, value, delta } = payload;
      const key = `${intent}_${field}`;
      const pref = this._graphs.preferences.get(key) || { score: 50 };
      this._graphs.preferences.set(key, {
        intent,
        field,
        value,
        score: Math.min(100, pref.score + (delta || 5)),
        last_updated: envelope.timestamp
      });
    }
    else if (envelope.event_type === 'kernel.execution.completed') {
      this._graphs.executions.push({
        intent: payload.intent,
        connector_id: payload.connectorId,
        constraints: payload.constraints,
        result_summary: payload.resultSummary,
        executed_at: envelope.timestamp
      });
    }
  }

  // --- Core Graph Query Interface ---

  getPerson(id = 'user_1') {
    return this._graphs.personal.get(id) || null;
  }

  getRelationships(personId = 'user_1') {
    const relationships = [];
    for (const rel of this._graphs.social.values()) {
      if (rel.from === personId || rel.to === personId) {
        relationships.push(rel);
      }
    }
    return relationships;
  }

  getBusinessContext() {
    return Array.from(this._graphs.business.values());
  }

  getConstraints(category) {
    const constraints = [];
    for (const item of this._graphs.business.values()) {
      if (item.entity_type === 'constraint' && (!category || item.category === category)) {
        constraints.push(item);
      }
    }
    return constraints;
  }

  getPreferences(intent) {
    const prefs = {};
    for (const pref of this._graphs.preferences.values()) {
      if (pref.intent === intent) {
        prefs[pref.field] = { value: pref.value, score: pref.score };
      }
    }
    return Object.keys(prefs).length > 0 ? prefs : null;
  }

  getFrequentRoutes(intent = 'transport.book') {
    return this._graphs.executions
      .filter(e => e.intent === intent)
      .slice(-10)
      .reverse()
      .map(e => e.constraints)
      .filter(Boolean);
  }

  // --- Snapshot / Rebuild ---

  getState() {
    return {
      personal: Array.from(this._graphs.personal.entries()),
      business: Array.from(this._graphs.business.entries()),
      social: Array.from(this._graphs.social.entries()),
      spatial: Array.from(this._graphs.spatial.entries()),
      preferences: Array.from(this._graphs.preferences.entries()),
      executions: this._graphs.executions
    };
  }

  loadState(state) {
    if (state) {
      this._graphs.personal = new Map(state.personal || []);
      this._graphs.business = new Map(state.business || []);
      this._graphs.social = new Map(state.social || []);
      this._graphs.spatial = new Map(state.spatial || []);
      this._graphs.preferences = new Map(state.preferences || []);
      this._graphs.executions = state.executions || [];
    }
  }

  clear() {
    this._graphs.personal.clear();
    this._graphs.business.clear();
    this._graphs.social.clear();
    this._graphs.spatial.clear();
    this._graphs.preferences.clear();
    this._graphs.executions = [];
  }
}

// Singleton instantiation
const worldModel = new UnifiedWorldModel();
// Register and rebuild on boot
projectionManager.rebuild(worldModel);

module.exports = { worldModel, UnifiedWorldModel };
