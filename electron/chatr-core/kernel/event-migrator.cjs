'use strict';

/**
 * CHATR Kernel — Event Migrator
 *
 * Provides a pipeline to upgrade older event versions to the current ABI
 * before they reach the projections. This decouples the immutable ledger
 * from the evolving domain logic.
 */

class EventMigrator {
  constructor() {
    // Registry of migrations: { event_type: { '1.0': [fn1], '1.1': [fn2] } }
    this._migrations = new Map();
  }

  /**
   * Register a migration for a specific event type and version leap.
   * @param {string} eventType 
   * @param {string} fromVersion 
   * @param {string} toVersion 
   * @param {Function} migrationFn - function(payload, metadata) => { newPayload, newMetadata }
   */
  register(eventType, fromVersion, toVersion, migrationFn) {
    if (!this._migrations.has(eventType)) {
      this._migrations.set(eventType, new Map());
    }
    const versionMap = this._migrations.get(eventType);
    
    // For simplicity, we register sequential steps.
    // e.g. 1.0 -> 1.1, 1.1 -> 1.2
    versionMap.set(fromVersion, { toVersion, fn: migrationFn });
  }

  /**
   * Migrate an event envelope to the target ABI version.
   * @param {object} envelope 
   * @param {string} targetVersion 
   * @returns {object} Migrated envelope
   */
  migrate(envelope, targetVersion = '1.0') {
    if (envelope.version === targetVersion) return envelope;

    const versionMap = this._migrations.get(envelope.event_type);
    if (!versionMap) {
      // If no migrations exist, we assume it's compatible or hasn't changed.
      // But we bump the version in the envelope to match target.
      return { ...envelope, version: targetVersion };
    }

    let currentVersion = envelope.version;
    let currentPayload = { ...envelope.payload };
    let currentMetadata = { ...envelope.metadata };

    while (currentVersion !== targetVersion) {
      const step = versionMap.get(currentVersion);
      if (!step) {
        // Missing a step in the chain. Just bump version and hope for the best,
        // or throw an error in strict environments.
        console.warn(`[EventMigrator] Missing migration step from ${currentVersion} to ${targetVersion} for ${envelope.event_type}`);
        break;
      }

      const result = step.fn(currentPayload, currentMetadata);
      currentPayload = result.newPayload;
      currentMetadata = result.newMetadata;
      currentVersion = step.toVersion;
    }

    return {
      ...envelope,
      version: targetVersion,
      payload: currentPayload,
      metadata: currentMetadata
    };
  }
}

const eventMigrator = new EventMigrator();
module.exports = { EventMigrator, eventMigrator };
