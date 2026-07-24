'use strict';

/**
 * CHATR Kernel - Local Resource Provider
 * Capability: system.resource
 * Provides live OS metrics to the Recommendation & Health engines.
 */

const os = require('os');

class LocalResourceProvider {
  constructor() {
    this.name = 'LocalResourceProvider';
  }

  async getCpuUsage() {
    return os.loadavg();
  }

  async getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    return {
      totalBytes: total,
      freeBytes: free,
      usedBytes: total - free,
      totalGB: total / (1024 ** 3),
      freeGB: free / (1024 ** 3)
    };
  }

  async getGpuUsage() {
    // In a real app, query nvml, rocm, or system_profiler
    return { available: false, memoryGB: 0 };
  }

  async getDiskSpace() {
    // Mock
    return { freeGB: 100 };
  }

  async getBatteryState() {
    // Mock
    return { level: 1.0, isCharging: true };
  }

  async getNetworkStatus() {
    return { online: true };
  }

  async getThermalState() {
    return { throttled: false, temperatureC: 45 };
  }

  async canExecuteIntensively() {
    const mem = await this.getMemoryUsage();
    return mem.freeGB > 2.0; // Needs at least 2GB free
  }

  startMonitoring() {
    if (this.monitorInterval) return;
    const { scheduler } = require('../services/scheduler.cjs');

    this.monitorInterval = setInterval(async () => {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      const osMem = await this.getMemoryUsage();
      
      // Throttle if V8 heap > 1.5GB or OS free RAM < 500MB
      const isCritical = heapUsedMB > 1500 || osMem.freeBytes < (500 * 1024 * 1024);
      
      if (isCritical && !scheduler.paused) {
        scheduler.setPaused(true);
      } else if (!isCritical && scheduler.paused) {
        scheduler.setPaused(false);
      }
    }, 10000);
  }
}

module.exports = { LocalResourceProvider };
