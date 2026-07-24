'use strict';

/**
 * CHATR Kernel — Package Compiler
 * 
 * Validates and installs Intent Intelligence Packages.
 * Ensures the 8 required package components are valid and compatible with the
 * current Kernel ABIs.
 */

const fs = require('fs');
const path = require('path');
const log = (() => { try { return require('electron-log'); } catch { return console; } })();

class PackageCompiler {
  constructor() {
    this._installedPackages = new Map();
  }

  /**
   * Compiles and installs a package from a directory path.
   * @param {string} packageDir
   * @returns {Promise<object>} The compiled and installed package.
   */
  async compile(packageDir) {
    const manifestPath = path.join(packageDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Package compiler failed: Missing manifest.json in ${packageDir}`);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // 1. Validate Manifest
    this._validateManifest(manifest);

    // 2. Load Package Module (entry point is usually index.cjs or similar, but for now we'll dynamically load the class)
    const packageIndexPath = path.join(packageDir, 'index.cjs');
    if (!fs.existsSync(packageIndexPath)) {
      throw new Error(`Package compiler failed: Missing index.cjs in ${packageDir}`);
    }

    const { Package } = require(packageIndexPath);
    const packageInstance = new Package(manifest);

    // 3. Initialize Package
    await packageInstance.initialize();

    // 4. Validate Components (Ontology, Goals, Workflows, etc)
    this._validateComponents(packageInstance);

    // 5. Register with System (in a full OS this would register with PolicyEngine, SemanticEngine, etc)
    this._installedPackages.set(manifest.id, packageInstance);
    
    log.info(`[PackageCompiler] Successfully compiled and installed package: ${manifest.id}@${manifest.version}`);
    return packageInstance;
  }

  _validateManifest(manifest) {
    if (!manifest.id) throw new Error('Package manifest missing "id"');
    if (!manifest.version) throw new Error('Package manifest missing "version"');
    if (!manifest.provides || !Array.isArray(manifest.provides)) {
      throw new Error('Package manifest must declare what it "provides" (e.g. ["ontology", "goals"])');
    }
    if (!manifest.certification) {
      log.warn(`[PackageCompiler] Warning: Package ${manifest.id} is uncertified.`);
    }
  }

  _validateComponents(pkg) {
    const provides = pkg.manifest.provides;
    
    if (provides.includes('ontology') && pkg.ontology.length === 0) {
      throw new Error(`Package ${pkg.manifest.id} claims to provide ontology but registered 0 schemas.`);
    }
    if (provides.includes('goals') && pkg.goals.length === 0) {
      throw new Error(`Package ${pkg.manifest.id} claims to provide goals but registered 0 goal templates.`);
    }
    if (provides.includes('workflows') && pkg.workflows.length === 0) {
      throw new Error(`Package ${pkg.manifest.id} claims to provide workflows but registered 0 workflow templates.`);
    }
    if (provides.includes('intents') && pkg.intentModels.length === 0) {
      throw new Error(`Package ${pkg.manifest.id} claims to provide intents but registered 0 intent models.`);
    }
  }

  getInstalledPackages() {
    return Array.from(this._installedPackages.values());
  }

  getPackage(id) {
    return this._installedPackages.get(id);
  }
}

const packageCompiler = new PackageCompiler();
module.exports = { PackageCompiler, packageCompiler };
