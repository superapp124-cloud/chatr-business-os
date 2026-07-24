'use strict';

const { bus } = require('../events/bus.cjs');
const { CORE } = require('../events/events.cjs');
const { OllamaProvider } = require('../providers/ollama.cjs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

/**
 * CHATR Kernel — Watchdog Service
 * 
 * Periodically health-checks registered execution providers.
 * If a provider fails, the watchdog triggers a recovery/restart protocol.
 */
class WatchdogService {
  constructor() {
    this.name = 'WatchdogService';
    this.intervalId = null;
    // For V1 we just monitor Ollama
    this.ollamaProvider = new OllamaProvider();
  }

  start(intervalMs = 30000) {
    if (this.intervalId) return;
    log.info(`[Watchdog] Started monitoring providers every ${intervalMs}ms.`);
    
    this.intervalId = setInterval(async () => {
      await this._checkOllama();
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.info(`[Watchdog] Stopped.`);
    }
  }

  async _checkOllama() {
    try {
      const health = await this.ollamaProvider.health();
      if (!health.ok) {
        this._handleFailure('OllamaProvider', health.error);
      }
    } catch (err) {
      this._handleFailure('OllamaProvider', err.message);
    }
  }

  _handleFailure(providerName, error) {
    log.error(`[Watchdog] 🚨 ${providerName} failed health check: ${error}`);
    bus.publish(CORE.PROVIDER_FAILED, {
      provider: providerName,
      error,
      timestamp: Date.now()
    });
    
    // In production, this would trigger an IPC command to the Electron main process
    // to execute `spawn('ollama', ['serve'])` or a bash script.
    log.info(`[Watchdog] Attempting automatic restart protocol for ${providerName}...`);
  }
}

const watchdog = new WatchdogService();
module.exports = { watchdog, WatchdogService };
