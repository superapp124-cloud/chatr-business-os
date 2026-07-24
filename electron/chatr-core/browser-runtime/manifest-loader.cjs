'use strict';

const path = require('path');
const fs   = require('fs');
const { ManifestValidator } = require('./manifest-validator.cjs');

/**
 * CHATR Browser Runtime — Manifest Loader
 * Sprint 1.1
 *
 * Loads provider manifests from disk, validates them, and returns
 * a ready-to-execute manifest object with variables interpolated.
 *
 * Provider-agnostic. Knows nothing about Zomato, IRCTC, etc.
 */
class ManifestLoader {
  constructor(options = {}) {
    this._manifestDir = options.manifestDir
      || path.join(__dirname, '..', 'manifests');
    this._validator = new ManifestValidator();
    this._cache = new Map(); // provider -> manifest
  }

  /**
   * Load and validate a manifest for the given provider.
   * @param {string} provider  e.g. 'zomato', 'irctc'
   * @param {object} options
   * @returns {{ manifest: object, warnings: string[] }}
   */
  load(provider, options = {}) {
    if (this._cache.has(provider)) {
      return { manifest: this._cache.get(provider), warnings: [] };
    }

    const manifestPath = path.join(this._manifestDir, `${provider}.manifest.json`);
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest not found for provider "${provider}" at ${manifestPath}`);
    }

    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
      throw new Error(`Failed to parse manifest for "${provider}": ${e.message}`);
    }

    const validation = this._validator.validate(raw, options);
    if (!validation.valid) {
      throw new Error(
        `Manifest validation failed for "${provider}":\n` +
        validation.errors.map(e => `  • ${e}`).join('\n')
      );
    }

    this._cache.set(provider, raw);
    return { manifest: raw, warnings: validation.warnings };
  }

  /**
   * Interpolate variables into a step URL or selector.
   * Variables are expressed as {{varName}}.
   *
   * @param {string} template
   * @param {object} vars
   * @returns {string}
   */
  static interpolate(template, vars = {}) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (!(key in vars)) {
        throw new Error(`Manifest variable "{{${key}}}" has no value provided`);
      }
      return encodeURIComponent(String(vars[key]));
    });
  }

  /**
   * Clear the manifest cache (useful for hot-reload in development).
   */
  clearCache() {
    this._cache.clear();
  }
}

module.exports = { ManifestLoader };
