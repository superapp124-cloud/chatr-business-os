'use strict';

/**
 * CHATR Kernel v2.0 — System Context Engine
 * 
 * Runs before the Planner. Resolves universal context (Location, Time, Battery, 
 * Network, Active Window, etc.) and attaches it to the Intent so that NO downstream 
 * capability needs to manually ask for this context.
 */

const os = require('os');
const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class SystemContextEngine {
  constructor() {
    this._cachedLocation = null;
    this._lastLocationUpdate = 0;
  }

  /**
   * Builds the comprehensive System Context snapshot for the current moment.
   * @param {string} intentId 
   * @returns {Promise<object>} systemContext
   */
  async buildContext(intentId) {
    log.info(`[SystemContextEngine] [${intentId}] Resolving system context...`);

    const context = {
      time: this._resolveTime(),
      device: this._resolveDevice(),
      network: this._resolveNetwork(),
      location: await this._resolveLocation(),
      battery: await this._resolveBattery(),
      preferences: this._resolveUserPreferences(),
      // In the future:
      // activeWindow: await this._resolveActiveWindow(),
      // calendarEvents: await this._resolveUpcomingCalendar()
    };

    return context;
  }

  _resolveTime() {
    const now = new Date();
    return {
      iso: now.toISOString(),
      timestamp: now.getTime(),
      timezoneOffset: now.getTimezoneOffset(),
      timezoneName: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      hourOfDay: now.getHours()
    };
  }

  _resolveDevice() {
    return {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      totalMemoryGB: (os.totalmem() / (1024 ** 3)).toFixed(2),
      freeMemoryGB: (os.freemem() / (1024 ** 3)).toFixed(2),
      cpuCores: os.cpus().length,
      hostname: os.hostname()
    };
  }

  _resolveNetwork() {
    const interfaces = os.networkInterfaces();
    let isOnline = false;
    let type = 'unknown';

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
          isOnline = true;
          if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wlan')) type = 'wifi';
          else if (name.toLowerCase().includes('eth') || name.toLowerCase().includes('en')) type = 'ethernet';
        }
      }
    }

    return { isOnline, type };
  }

  async _resolveBattery() {
    // Requires system APIs (e.g. navigator.getBattery or native bindings)
    // Stubbed for standard OS support
    return {
      level: 1.0,
      charging: true,
      powerSource: 'AC'
    };
  }

  async _resolveLocation() {
    // 1. Try OS Location / Device Location (stubbed for future native bridge)
    // 2. Try Cache (Recent)
    // 3. Fallback to IP
    
    // For now, if we have a cache younger than 30 mins, use it
    if (this._cachedLocation && (Date.now() - this._lastLocationUpdate < 30 * 60 * 1000)) {
      return this._cachedLocation;
    }

    try {
      // Basic IP-based fallback as last resort
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        this._cachedLocation = {
          latitude: data.latitude,
          longitude: data.longitude,
          city: data.city,
          region: data.region,
          country: data.country_name,
          accuracyMeters: 5000,
          confidence: 'low',
          source: 'ip'
        };
        this._lastLocationUpdate = Date.now();
        return this._cachedLocation;
      }
    } catch (e) {
      log.warn('[SystemContextEngine] Failed IP location fallback');
    }

    return {
      latitude: null,
      longitude: null,
      city: 'Unknown',
      accuracyMeters: null,
      confidence: 'none',
      source: 'unknown'
    };
  }

  _resolveUserPreferences() {
    return {
      language: 'en-US',
      currency: 'USD',
      theme: 'dark'
    };
  }
}

const systemContextEngine = new SystemContextEngine();
module.exports = { systemContextEngine, SystemContextEngine };
