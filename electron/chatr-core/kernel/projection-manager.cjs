'use strict';

const { ledger } = require('../events/ledger.cjs');
const { eventMigrator } = require('./event-migrator.cjs');

/**
 * CHATR Kernel — Projection Base Class
 */
class Projection {
  constructor(name, streamId = '*') {
    this.name = name;
    this.streamId = streamId;
  }

  /**
   * Called to apply a new event to the projection's state.
   */
  applyEvent(envelope) {
    throw new Error('applyEvent() must be implemented by subclasses.');
  }

  /**
   * Return the current serialized state for snapshotting.
   */
  getState() {
    throw new Error('getState() must be implemented by subclasses.');
  }

  /**
   * Load the serialized state from a snapshot.
   */
  loadState(state) {
    throw new Error('loadState() must be implemented by subclasses.');
  }

  /**
   * Clear in-memory state.
   */
  clear() {
    throw new Error('clear() must be implemented by subclasses.');
  }
}

/**
 * CHATR Kernel — Projection Manager
 *
 * Centralizes the snapshotting and rebuild logic for all projections.
 */
class ProjectionManager {
  constructor() {
    this._projections = new Map(); // name -> instance
    this._snapshotThreshold = 500; // Trigger snapshot every N events
  }

  setSnapshotThreshold(threshold) {
    this._snapshotThreshold = threshold;
  }

  /**
   * Rebuilds a projection from the ledger, utilizing snapshots if available.
   * @param {Projection} projection 
   */
  rebuild(projection) {
    projection.clear();

    const snapshot = ledger.getLatestSnapshot(projection.name, projection.streamId);
    let startSequence = 0;
    
    if (snapshot) {
      projection.loadState(snapshot.state);
      startSequence = snapshot.lastGlobalSequence;
    }

    let events;
    if (projection.streamId === '*') {
      events = ledger.readAllSince(startSequence);
    } else {
      events = ledger.readStreamSince(projection.streamId, startSequence);
    }

    let appliedCount = 0;
    let lastGlobalSequence = startSequence;

    for (let envelope of events) {
      // 1. Run through migration pipeline
      envelope = eventMigrator.migrate(envelope, '1.0');
      
      // 2. Apply to projection
      projection.applyEvent(envelope);
      
      lastGlobalSequence = envelope.global_sequence || lastGlobalSequence;
      appliedCount++;
    }

    // Automatically snapshot if we processed many events during this rebuild
    if (appliedCount >= this._snapshotThreshold) {
      this.snapshot(projection, lastGlobalSequence);
    }

    this._projections.set(projection.name, projection);
    return projection;
  }

  /**
   * Immediately saves a snapshot for a projection.
   * @param {Projection} projection 
   * @param {number} lastGlobalSequence 
   */
  snapshot(projection, lastGlobalSequence) {
    const state = projection.getState();
    ledger.saveSnapshot(projection.name, projection.streamId, state, lastGlobalSequence);
  }

  get(name) {
    return this._projections.get(name);
  }
}

const projectionManager = new ProjectionManager();
module.exports = { Projection, ProjectionManager, projectionManager };
