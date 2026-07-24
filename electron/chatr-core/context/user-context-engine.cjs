'use strict';

/**
 * CHATR Kernel — User Context Engine
 * 
 * Aggregates intelligence from the user's live workspace: Location, Active Project,
 * Browser Tabs, Connected Accounts, Open Documents, Clipboard, and Installed Apps.
 */

const locationIntelligence = require('./location-intelligence.cjs');
const userIntelligence = require('./user-intelligence.cjs');
const browserIntelligence = require('./browser-intelligence.cjs');
const documentIntelligence = require('./document-intelligence.cjs');
const clipboardIntelligence = require('./clipboard-intelligence.cjs');
const capabilityDiscovery = require('./capability-discovery.cjs');
const connectedAccounts = require('./connected-accounts.cjs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class UserContextEngine {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    log.info('[UserContextEngine] Initializing context modules...');
    
    // Start background watchers
    documentIntelligence.initialize();
    clipboardIntelligence.initialize();
    capabilityDiscovery.initialize();
    
    this.initialized = true;
  }

  /**
   * Builds the comprehensive User Context snapshot for the current moment.
   * @param {string} intentId 
   * @returns {Promise<object>} userContext
   */
  async buildContext(intentId) {
    if (!this.initialized) await this.initialize();

    log.info(`[UserContextEngine] [${intentId}] Resolving live user context...`);

    const context = {
      location: await locationIntelligence.resolveLocation(),
      activeWorkspace: await userIntelligence.resolveActiveProject(),
      browser: await browserIntelligence.resolveActiveSessions(),
      documents: documentIntelligence.getRecentDocuments(),
      clipboard: clipboardIntelligence.getCurrentClipboard(),
      applications: capabilityDiscovery.getInstalledApplications(),
      accounts: connectedAccounts.getConnectedAccounts()
    };

    return context;
  }
}

const userContextEngine = new UserContextEngine();
module.exports = { userContextEngine, UserContextEngine };
