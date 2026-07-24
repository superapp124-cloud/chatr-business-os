'use strict';

/**
 * CHATR Kernel — Connector Store (Phase 5.2)
 *
 * Implements the "App Store" model for CHATR connectors.
 * Connectors are just declarative JSON configuration (no code).
 * This manages fetching from a remote registry, verifying signatures,
 * installing locally, and auto-updating.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { app } = require('electron');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class ConnectorStore {
  constructor() {
    this.registryUrl = 'https://registry.chatros.dev/v1/catalog.json';
    
    // Store connectors in user data directory
    try {
      this.localConnectorsPath = path.join(app.getPath('userData'), 'connectors');
    } catch {
      this.localConnectorsPath = path.join(process.cwd(), 'data', 'connectors');
    }

    if (!fs.existsSync(this.localConnectorsPath)) {
      fs.mkdirSync(this.localConnectorsPath, { recursive: true });
    }
  }

  /**
   * Fetches the entire connector catalog from the remote registry.
   * Categories: Travel, Food, Healthcare, Government, Finance, Recruitment.
   */
  async getCatalog() {
    log.info('[ConnectorStore] Fetching catalog...');
    // Mocking the network call for Phase 5.2 demonstration
    return [
      { id: 'irctc', name: 'IRCTC', category: 'Travel', certification: 'VERIFIED', version: '1.2.0', downloads: 145000 },
      { id: 'zomato', name: 'Zomato', category: 'Food', certification: 'VERIFIED', version: '2.0.1', downloads: 890000 },
      { id: 'practo', name: 'Practo', category: 'Healthcare', certification: 'COMMUNITY', version: '1.0.5', downloads: 34000 },
      { id: 'uidai', name: 'UIDAI', category: 'Government', certification: 'ENTERPRISE', version: '3.1.0', downloads: 5000000 },
      { id: 'zerodha', name: 'Zerodha', category: 'Finance', certification: 'VERIFIED', version: '2.2.0', downloads: 410000 },
    ];
  }

  /**
   * Installs a connector by downloading its declarative manifest.
   * @param {string} connectorId 
   */
  async install(connectorId) {
    log.info(`[ConnectorStore] Installing connector: ${connectorId}`);
    
    // In reality, this downloads a zip or JSON blob and verifies the cryptographic signature
    const connectorDir = path.join(this.localConnectorsPath, connectorId);
    if (!fs.existsSync(connectorDir)) {
      fs.mkdirSync(connectorDir, { recursive: true });
    }

    // Mock writing the manifest
    const manifest = {
      id: connectorId,
      version: '1.0.0',
      schemaVersion: '2.0',
      capabilities: [],
      installedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(
      path.join(connectorDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    log.info(`[ConnectorStore] Installed ${connectorId} successfully.`);
    return true;
  }

  /**
   * Removes an installed connector.
   * @param {string} connectorId 
   */
  async remove(connectorId) {
    const connectorDir = path.join(this.localConnectorsPath, connectorId);
    if (fs.existsSync(connectorDir)) {
      fs.rmSync(connectorDir, { recursive: true, force: true });
      log.info(`[ConnectorStore] Removed connector: ${connectorId}`);
      return true;
    }
    return false;
  }

  /**
   * Gets a list of all locally installed connectors from the user directory.
   */
  getInstalled() {
    if (!fs.existsSync(this.localConnectorsPath)) return [];
    
    const installed = [];
    const dirs = fs.readdirSync(this.localConnectorsPath);
    
    for (const dir of dirs) {
      const manifestPath = path.join(this.localConnectorsPath, dir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          installed.push(manifest);
        } catch (err) {
          log.warn(`[ConnectorStore] Failed to read manifest for ${dir}:`, err.message);
        }
      }
    }
    return installed;
  }
}

const connectorStore = new ConnectorStore();
module.exports = { connectorStore, ConnectorStore };
