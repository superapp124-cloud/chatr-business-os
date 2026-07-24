'use strict';

/**
 * CHATR Kernel — Module Loader
 *
 * Dynamically loads and validates modules from the file system.
 * Replaces static module registrations in index.cjs.
 *
 * Genesis v1.0 — Milestone 2
 */

const fs   = require('fs');
const path = require('path');
const { featureRegistry } = require('../registry/feature-registry.cjs');
const { bus }             = require('../events/bus.cjs');
const { CORE }            = require('../events/events.cjs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class ModuleLoader {
  constructor() {
    this._modulesDir = path.join(__dirname, '../modules');
  }

  /**
   * Load and register all modules in the modules directory.
   */
  async loadAll() {
    log.info(`[ModuleLoader] Scanning for modules in ${this._modulesDir}...`);

    let entries;
    try {
      entries = fs.readdirSync(this._modulesDir, { withFileTypes: true });
    } catch (err) {
      log.error(`[ModuleLoader] Failed to read modules directory: ${err.message}`);
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const moduleName = entry.name;
      const manifestPath = path.join(this._modulesDir, moduleName, 'module.json');

      if (!fs.existsSync(manifestPath)) {
        log.warn(`[ModuleLoader] Skipping directory "${moduleName}": Missing module.json`);
        continue;
      }

      try {
        const manifestStr = fs.readFileSync(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestStr);

        this._validateManifest(manifest, moduleName);
        this._registerModule(manifest, moduleName);

      } catch (err) {
        log.error(`[ModuleLoader] Failed to load module "${moduleName}": ${err.message}`);
      }
    }
  }

  /**
   * Validates that the manifest conforms to KERNEL.md contract.
   */
  _validateManifest(manifest, dirName) {
    if (!manifest.name || typeof manifest.name !== 'string') {
      throw new Error('Manifest missing valid "name"');
    }
    if (manifest.name !== dirName) {
      throw new Error(`Manifest name "${manifest.name}" does not match directory name "${dirName}"`);
    }
    if (!manifest.version) {
      throw new Error('Manifest missing "version"');
    }
    if (!manifest.status || !['stable', 'beta', 'reserved', 'disabled'].includes(manifest.status)) {
      throw new Error('Manifest missing or invalid "status" (must be stable, beta, reserved, or disabled)');
    }
  }

  /**
   * Registers the module into the Feature Registry.
   */
  _registerModule(manifest, dirName) {
    if (manifest.status === 'disabled') {
      log.info(`[ModuleLoader] Module "${manifest.name}" is disabled. Skipping.`);
      return;
    }

    // Determine if it has an Express router to mount (if stable/beta)
    let router = null;
    if (['stable', 'beta'].includes(manifest.status)) {
      const routerPath = path.join(this._modulesDir, dirName, 'router.cjs');
      if (fs.existsSync(routerPath)) {
        try {
          const mod = require(routerPath);
          router = mod.router;
        } catch (err) {
           log.error(`[ModuleLoader] Module "${manifest.name}" failed to load router.cjs: ${err.message}`);
           throw err; // Fail registration if router fails to load
        }
      }
    }

    featureRegistry.register(manifest, { router });
    log.info(`[ModuleLoader] Registered module: ${manifest.name} (v${manifest.version}) [${manifest.status}]`);
  }
}

const moduleLoader = new ModuleLoader();

module.exports = { moduleLoader };
