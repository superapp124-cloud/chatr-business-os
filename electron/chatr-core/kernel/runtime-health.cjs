'use strict';

/**
 * CHATR Kernel - Runtime Health Service
 * Provides pre-flight resource checks to ensure models can run.
 */

const os = require('os');

class RuntimeHealth {
  constructor() {
    this.name = 'RuntimeHealth';
  }

  getSystemResources() {
    const totalRamGB = os.totalmem() / (1024 ** 3);
    const freeRamGB = os.freemem() / (1024 ** 3);
    
    // Mocking GPU and Battery for now, in a real app these would use system APIs
    return {
      totalRamGB,
      freeRamGB,
      hasGPU: false, // Defaulting to false for consumer assumption unless detected
      batteryLevel: 1.0,
      isPluggedIn: true
    };
  }

  canRunModel(modelProfile, resources) {
    if (modelProfile.cloud) {
      return { capable: true, reason: 'Cloud models consume no local resources' };
    }

    if (modelProfile.memoryRequirement > resources.totalRamGB) {
      return { capable: false, reason: `Requires ${modelProfile.memoryRequirement}GB RAM, system has ${resources.totalRamGB.toFixed(1)}GB` };
    }

    // In a stricter check, we might look at freeRamGB, but total is safer for static capability
    return { capable: true, reason: 'Hardware capable' };
  }
}

const runtimeHealth = new RuntimeHealth();
module.exports = { runtimeHealth, RuntimeHealth };
