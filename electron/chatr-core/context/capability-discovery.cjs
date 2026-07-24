'use strict';

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class ApplicationDiscovery {
  initialize() {
    log.info('[CapabilityDiscovery] Initializing capability discovery (waiting for Kernel Ready)...');
    const { bus } = require('../events/bus.cjs');
    bus.subscribe('CORE.KERNEL_READY', () => {
      log.info('[CapabilityDiscovery] Kernel is ready. Detecting and registering capabilities...');
      this.detectCapabilities();
    });
  }

  detectCapabilities() {
    const installedApps = this.getInstalledApplications();
    const { runtimeManager } = require('../kernel/runtime-manager.cjs');

    // Example 1: Docker Discovery
    if (installedApps.includes('Docker')) {
      log.info('[CapabilityDiscovery] Detected Docker. Dynamically registering docker capabilities.');
      runtimeManager.registerCapability({
        id: 'docker.run',
        name: 'Run Docker Container',
        version: '1.0',
        runtime: 'ExecutionRuntime',
        provider: 'ExecutionRuntime',
        category: 'developer',
        approval: 'always'
      }, runtimeManager.getRuntime('ExecutionRuntime'));
    }

    // Example 2: Chrome / Playwright Discovery
    if (installedApps.includes('Chrome')) {
      log.info('[CapabilityDiscovery] Detected Chrome. Registering Playwright browser capabilities.');
      const playwrightExecutor = require('../executors/PlaywrightExecutor.cjs');
      // Notice we could route this via a provider, or inject it to ExecutionRuntime.
      // We will register a raw provider for browser execution.
      runtimeManager.registerCapability({
        id: 'browser.search',
        name: 'Automate Browser Search',
        version: '1.0',
        runtime: 'ExecutionRuntime',
        provider: 'PlaywrightExecutor',
        category: 'browser',
        approval: 'always'
      }, playwrightExecutor);
      
      runtimeManager.registerCapability({
        id: 'jobs.post',
        name: 'Post Job via Browser',
        version: '1.0',
        runtime: 'ExecutionRuntime',
        provider: 'PlaywrightExecutor',
        category: 'browser',
        approval: 'always'
      }, playwrightExecutor);
    }
  }

  getInstalledApplications() {
    return ['VS Code', 'Chrome', 'Docker', 'Android Studio', 'Node.js'];
  }
}

module.exports = new ApplicationDiscovery();
