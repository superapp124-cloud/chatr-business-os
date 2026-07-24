'use strict';

const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const log = (() => { try { return require('electron-log'); } catch { return console; } })();
const { discoveryEngine } = require('./discovery-engine.cjs');

class ConnectorManager {
  constructor() {
    this.connectorsDir = app ? path.join(app.getPath('userData'), 'connectors') : path.join(__dirname, '..', '..', '..', 'data', 'connectors');
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.connectorsDir)) {
      fs.mkdirSync(this.connectorsDir, { recursive: true });
    }
  }

  /**
   * Installs a connector from a mock URL or registry.
   * For Phase 4, we simulate downloading a package and creating the structure.
   */
  async installConnector(manifestData, sourceUrl = 'marketplace') {
    this._ensureDir();
    
    const id = manifestData.id || `unknown-${Date.now()}`;
    const targetDir = path.join(this.connectorsDir, id);
    
    if (fs.existsSync(targetDir)) {
      throw new Error(`Connector ${id} is already installed.`);
    }

    fs.mkdirSync(targetDir, { recursive: true });

    // Write real package format as requested
    const manifestPath = path.join(targetDir, 'manifest.json');
    const capabilitiesPath = path.join(targetDir, 'capabilities.json');
    const authPath = path.join(targetDir, 'auth.json');
    const executorPath = path.join(targetDir, 'executor.cjs');

    fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));
    fs.writeFileSync(capabilitiesPath, JSON.stringify(manifestData.capabilities || [], null, 2));
    fs.writeFileSync(authPath, JSON.stringify(manifestData.authentication || [], null, 2));
    
    // Auto-generate a dummy executor that extends the SDK
    const mockExecutor = `
const { BaseConnector } = require('../../../electron/chatr-core/discovery/sdk.cjs');

class DynamicConnector extends BaseConnector {
  async execute(capabilityId, parameters, session, onStep) {
    onStep({ step: 'Initializing dynamic connector execution for ' + capabilityId });
    await new Promise(r => setTimeout(r, 1000));
    onStep({ step: 'Simulating API call...' });
    return { success: true, message: 'Executed dynamically via Connector SDK!', _source: 'DynamicConnector' };
  }
}
module.exports = DynamicConnector;
`;
    fs.writeFileSync(executorPath, mockExecutor);
    
    log.info(`[ConnectorManager] Installed dynamic connector: ${id}`);
    
    // Hot-reload the discovery engine
    discoveryEngine.reload();
    
    return { ok: true, id };
  }

  /**
   * Removes a connector from the user data directory.
   */
  async removeConnector(id) {
    const targetDir = path.join(this.connectorsDir, id);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      log.info(`[ConnectorManager] Removed connector: ${id}`);
      discoveryEngine.reload();
      return { ok: true };
    }
    return { ok: false, error: 'Connector not found' };
  }

  /**
   * Fetches mock marketplace catalog.
   */
  async getMarketplaceCatalog() {
    return [
      {
        id: "realestate.xyz",
        name: "XYZ Real Estate",
        version: "1.0.0",
        description: "Post and search properties on XYZ.",
        downloads: 12450,
        successRate: 94.2,
        verified: true,
        capabilities: ["realestate.post", "realestate.search"],
        authentication: ["cookies"],
        countries: ["US"],
        priority: 10,
        executionStrategies: ["browser"]
      },
      {
        id: "gov.passport",
        name: "Passport Services",
        version: "1.2.0",
        description: "Track passport status and book appointments.",
        downloads: 8520,
        successRate: 88.5,
        verified: false,
        capabilities: ["government.track", "government.apply"],
        authentication: ["oauth"],
        countries: ["UK", "IN"],
        priority: 15,
        executionStrategies: ["api", "browser"]
      },
      {
        id: "finance.cleartax",
        name: "ClearTax Filing",
        version: "2.1.0",
        description: "File and track tax returns automatically.",
        downloads: 45000,
        successRate: 98.1,
        verified: true,
        capabilities: ["finance.pay", "finance.refund", "finance.file"],
        authentication: ["oauth", "api_key"],
        countries: ["IN"],
        priority: 5,
        executionStrategies: ["api"]
      }
    ];
  }
}

const connectorManager = new ConnectorManager();
module.exports = { connectorManager, ConnectorManager };
