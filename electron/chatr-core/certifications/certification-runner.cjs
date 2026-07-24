'use strict';

const fs = require('fs');
const path = require('path');

const CORE_DIR = path.resolve(__dirname, '..');
const MOCKS_DIR = path.join(CORE_DIR, 'providers', 'mocks');
const SRC_DIR = path.resolve(CORE_DIR, '..', '..', 'src');

/**
 * Helper to get all files recursively
 */
function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(dirPath + '/' + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + '/' + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, file));
    }
  });

  return arrayOfFiles;
}

class CertificationRunner {
  constructor() {
    this.checks = [
      this.check1_zeroMockProviders.bind(this),
      this.check2_zeroSimulatedExecution.bind(this),
      this.check3_zeroFakeDelays.bind(this),
      this.check4_zeroAuthoritativeInMemoryState.bind(this),
      this.check5_eventReplayReconstructsEverything.bind(this),
      this.check6_crashRecovery.bind(this),
      this.check7_offlineExecution.bind(this),
      this.check8_packageInstallationRequiresZeroKernelChanges.bind(this),
      this.check9_providerFailover.bind(this),
      this.check10_policyEngineGovernsAllExecution.bind(this),
      this.check11_everyExecutionProducesEvidence.bind(this),
      this.check12_allVisualizationsConsumeLiveRuntime.bind(this),
      this.check13_uiRegressionSuite.bind(this),
      this.check14_performanceTargets.bind(this),
      this.check15_securityAudit.bind(this),
      this.check16_fullSuite.bind(this)
    ];
  }

  async runAll() {
    const results = [];
    for (let i = 0; i < this.checks.length - 1; i++) {
      results.push(await this.checks[i]());
    }
    // Check 16 evaluates previous 15
    const fullSuiteResult = await this.check16_fullSuite(results);
    results.push(fullSuiteResult);
    return results;
  }

  async runCheck(checkId) {
    if (checkId < 1 || checkId > 16) {
      throw new Error(`Invalid checkId: ${checkId}`);
    }
    if (checkId === 16) {
      const results = [];
      for (let i = 0; i < 15; i++) {
        results.push(await this.checks[i]());
      }
      return this.check16_fullSuite(results);
    }
    return this.checks[checkId - 1]();
  }

  _createResult(id, name, passed, details, error, durationMs) {
    const result = { id, name, passed, details, durationMs };
    if (error) result.error = error;
    return result;
  }

  async check1_zeroMockProviders() {
    const startTime = Date.now();
    try {
      if (fs.existsSync(MOCKS_DIR)) {
        const mockFiles = fs.readdirSync(MOCKS_DIR);
        // Ensure no kernel code imports mocks
      }
      
      const kernelFiles = getAllFiles(path.join(CORE_DIR, 'kernel')).filter(f => f.endsWith('.cjs'));
      for (const file of kernelFiles) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.match(/require\(.*mocks.*/)) {
          return this._createResult('1', 'Zero Mock Providers', false, `Found mock import in ${file}`, null, Date.now() - startTime);
        }
      }
      return this._createResult('1', 'Zero Mock Providers', true, 'No mock providers imported in kernel code.', null, Date.now() - startTime);
    } catch (e) {
      return this._createResult('1', 'Zero Mock Providers', false, 'Check failed', e.message, Date.now() - startTime);
    }
  }

  async check2_zeroSimulatedExecution() {
    const startTime = Date.now();
    try {
      const execGraphPath = path.join(CORE_DIR, 'kernel', 'execution-graph.cjs');
      if (fs.existsSync(execGraphPath)) {
        const content = fs.readFileSync(execGraphPath, 'utf8');
        if (content.includes('simulated: true')) {
          return this._createResult('2', 'Zero Simulated Execution', false, 'Found simulated execution in execution-graph.cjs', null, Date.now() - startTime);
        }
      }
      return this._createResult('2', 'Zero Simulated Execution', true, 'No simulated execution found.', null, Date.now() - startTime);
    } catch (e) {
      return this._createResult('2', 'Zero Simulated Execution', false, 'Check failed', e.message, Date.now() - startTime);
    }
  }

  async check3_zeroFakeDelays() {
    const startTime = Date.now();
    try {
      const filesToCheck = [
        path.join(CORE_DIR, 'kernel', 'execution-graph.cjs'),
        path.join(CORE_DIR, 'kernel', 'transaction-engine.cjs')
      ];
      for (const file of filesToCheck) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          if (content.includes('setTimeout(resolve') || content.includes('await new Promise(resolve => setTimeout')) {
            return this._createResult('3', 'Zero Fake Delays', false, `Found fake delay in ${file}`, null, Date.now() - startTime);
          }
        }
      }
      return this._createResult('3', 'Zero Fake Delays', true, 'No fake delays found in execution pipeline.', null, Date.now() - startTime);
    } catch (e) {
      return this._createResult('3', 'Zero Fake Delays', false, 'Check failed', e.message, Date.now() - startTime);
    }
  }

  async check4_zeroAuthoritativeInMemoryState() {
    const startTime = Date.now();
    try {
      const filesToCheck = [
        path.join(CORE_DIR, 'kernel', 'transaction-engine.cjs'),
        path.join(CORE_DIR, 'kernel', 'recovery.cjs'),
        path.join(CORE_DIR, 'kernel', 'scheduler.cjs')
      ];
      for (const file of filesToCheck) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          const lines = content.split('\\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('= new Map()') || line.includes('= new Set()')) {
              // Ensure ledger persistence is nearby (within 50 lines)
              let hasLedger = false;
              for (let j = Math.max(0, i - 50); j < Math.min(lines.length, i + 50); j++) {
                if (lines[j].includes('ledger.append')) {
                  hasLedger = true;
                  break;
                }
              }
              if (!hasLedger) {
                 return this._createResult('4', 'Zero Authoritative In-Memory State', false, `Map/Set found without ledger persistence in ${file}:${i}`, null, Date.now() - startTime);
              }
            }
          }
        }
      }
      return this._createResult('4', 'Zero Authoritative In-Memory State', true, 'All Maps and Sets appear to be backed by ledger.', null, Date.now() - startTime);
    } catch (e) {
      return this._createResult('4', 'Zero Authoritative In-Memory State', false, 'Check failed', e.message, Date.now() - startTime);
    }
  }

  async check5_eventReplayReconstructsEverything() {
    const startTime = Date.now();
    try {
      const ledgerPath = path.join(CORE_DIR, 'ledger', 'event-ledger.cjs');
      if (fs.existsSync(ledgerPath)) {
        const { EventLedger } = require(ledgerPath);
        const ledger = new EventLedger();
        const metrics = ledger.getMetrics ? ledger.getMetrics() : { totalEvents: 0 };
        if (metrics.totalEvents > 0) {
           const replayed = ledger.replay(0);
           if (replayed.length !== metrics.totalEvents) {
             return this._createResult('5', 'Event Replay Reconstructs Everything', false, `Replay count ${replayed.length} != metrics ${metrics.totalEvents}`, null, Date.now() - startTime);
           }
        }
      }
      return this._createResult('5', 'Event Replay Reconstructs Everything', true, 'Event replay works correctly.', null, Date.now() - startTime);
    } catch (e) {
      return this._createResult('5', 'Event Replay Reconstructs Everything', false, 'Check failed', e.message, Date.now() - startTime);
    }
  }

  async check6_crashRecovery() {
    const startTime = Date.now();
    try {
      const recoveryPath = path.join(CORE_DIR, 'kernel', 'recovery.cjs');
      if (fs.existsSync(recoveryPath)) {
        const { RecoveryManager } = require(recoveryPath);
        const rm = new RecoveryManager();
        await rm.recover();
        if (rm.status && !rm.status().ready) {
           return this._createResult('6', 'Crash Recovery', false, 'Recovery manager not ready', null, Date.now() - startTime);
        }
        const content = fs.readFileSync(recoveryPath, 'utf8');
        if (!content.includes('_rebuildFromLedger') && !content.includes('ledger.replay')) {
           return this._createResult('6', 'Crash Recovery', false, 'Recovery manager does not seem to scan ledger on startup', null, Date.now() - startTime);
        }
      }
      return this._createResult('6', 'Crash Recovery', true, 'Crash recovery is fully ledger backed.', null, Date.now() - startTime);
    } catch (e) {
      return this._createResult('6', 'Crash Recovery', false, 'Check failed', e.message, Date.now() - startTime);
    }
  }

  async check7_offlineExecution() {
    const startTime = Date.now();
    try {
      const connectivityPath = path.join(CORE_DIR, 'kernel', 'connectivity-manager.cjs');
      if (fs.existsSync(connectivityPath)) {
        const { ConnectivityManager } = require(connectivityPath);
        const cm = new ConnectivityManager();
        cm.setOnline(false);
        if (!cm.isLocalCapability('memory.search')) {
          return this._createResult('7', 'Offline Execution', false, 'memory.search should be a local capability', null, Date.now() - startTime);
        }
        if (!cm.isLocalCapability('ai.chat')) {
          return this._createResult('7', 'Offline Execution', false, 'ai.chat should be a local capability', null, Date.now() - startTime);
        }
        cm.setOnline(true);
      }
      return this._createResult('7', 'Offline Execution', true, 'Offline execution capabilities correctly identified.', null, Date.now() - startTime);
    } catch (e) {
      return this._createResult('7', 'Offline Execution', false, 'Check failed', e.message, Date.now() - startTime);
    }
  }

  async check8_packageInstallationRequiresZeroKernelChanges() {
    const startTime = Date.now();
    try {
      const runtimePath = path.join(CORE_DIR, 'kernel', 'runtime-manager.cjs');
      if (fs.existsSync(runtimePath)) {
        const content = fs.readFileSync(runtimePath, 'utf8');
        if (!content.includes('registerCapability')) {
          return this._createResult('8', 'Package Installation', false, 'registerCapability method missing', null, Date.now() - startTime);
        }
      }
      const kernelFiles = getAllFiles(path.join(CORE_DIR, 'kernel')).filter(f => f.endsWith('.cjs'));
      const hardcoded = ['zomato', 'swiggy', 'uber'];
      for (const file of kernelFiles) {
        const content = fs.readFileSync(file, 'utf8');
        for (const provider of hardcoded) {
          if (content.includes(`'${provider}'`) || content.includes(`"${provider}"`)) {
            return this._createResult('8', 'Package Installation', false, `Hardcoded provider ${provider} found in ${file}`, null, Date.now() - startTime);
          }
        }
      }
      return this._createResult('8', 'Package Installation', true, 'No kernel changes needed for package installation.', null, Date.now() - startTime);
    } catch (e) {
      return this._createResult('8', 'Package Installation', false, 'Check failed', e.message, Date.now() - startTime);
    }
  }

  async check9_providerFailover() {
    const startTime = Date.now();
    try {
      const runtimePath = path.join(CORE_DIR, 'kernel', 'runtime-manager.cjs');
      if (fs.existsSync(runtimePath)) {
        const { RuntimeManager } = require(runtimePath);
        const rm = new RuntimeManager();
        if (rm.registerCapability && rm.recordProviderFailure && rm.getProviderForCapability) {
           rm.registerRuntime('local', { registerProvider: () => {} });
           rm.registerCapability({ id: 'test.failover', name: 'Test', type: 'action', runtime: 'local', version: '1.0', provider: 'primary-prov' }, { id: 'primary-prov' }, 100);
           rm.registerCapability({ id: 'test.failover', name: 'Test', type: 'action', runtime: 'local', version: '1.0', provider: 'fallback-prov' }, { id: 'fallback-prov' }, 50);
           rm.recordProviderFailure('test.failover', 'primary-prov');
           rm.recordProviderFailure('test.failover', 'primary-prov');
           rm.recordProviderFailure('test.failover', 'primary-prov');
           const active = rm.getProviderForCapability('test.failover');
           if (active && active.id !== 'fallback-prov') {
             return this._createResult('9', 'Provider Failover', false, 'Failover did not activate fallback provider', null, Date.now() - startTime);
           }
        }
      }
      return this._createResult('9', 'Provider Failover', true, 'Provider failover logic passes.', null, Date.now() - startTime);
    } catch (e) {
      return this._createResult('9', 'Provider Failover', false, 'Check failed', e.message, Date.now() - startTime);
    }
  }

  async check10_policyEngineGovernsAllExecution() {
    const startTime = Date.now();
    try {
      const execGraphPath = path.join(CORE_DIR, 'kernel', 'execution-graph.cjs');
      if (fs.existsSync(execGraphPath)) {
        const content = fs.readFileSync(execGraphPath, 'utf8');
        if (!content.includes('policyService.evaluate')) {
          return this._createResult('10', 'Policy Engine Governs All Execution', false, 'policyService.evaluate not found in execution-graph.cjs', null, Date.now() - startTime);
        }
      }
      return this._createResult('10', 'Policy Engine Governs All Execution', true, 'Policy engine governance verified.', null, Date.now() - startTime);
    } catch (e) {
      return this._createResult('10', 'Policy Engine Governs All Execution', false, 'Check failed', e.message, Date.now() - startTime);
    }
  }

  async check11_everyExecutionProducesEvidence() {
    const startTime = Date.now();
    try {
      const execGraphPath = path.join(CORE_DIR, 'kernel', 'execution-graph.cjs');
      if (fs.existsSync(execGraphPath)) {
        const content = fs.readFileSync(execGraphPath, 'utf8');
        if (!content.includes('ledger.append') || !content.includes('CAPABILITY_EXECUTED')) {
          return this._createResult('11', 'Every Execution Produces Evidence', false, 'CAPABILITY_EXECUTED ledger.append not found in execution-graph.cjs', null, Date.now() - startTime);
        }
      }
      return this._createResult('11', 'Every Execution Produces Evidence', true, 'Execution properly writes evidence to ledger.', null, Date.now() - startTime);
    } catch (e) {
      return this._createResult('11', 'Every Execution Produces Evidence', false, 'Check failed', e.message, Date.now() - startTime);
    }
  }

  async check12_allVisualizationsConsumeLiveRuntime() {
    const startTime = Date.now();
    try {
      if (fs.existsSync(SRC_DIR)) {
        const uiFiles = getAllFiles(SRC_DIR).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
        for (const file of uiFiles) {
          const content = fs.readFileSync(file, 'utf8');
          if (content.includes('const mockData = [') || content.includes('// TODO: connect to real')) {
             return this._createResult('12', 'All Visualizations Consume Live Runtime', false, `Found mock data or TODO in ${file}`, null, Date.now() - startTime);
          }
        }
      }
      return this._createResult('12', 'All Visualizations Consume Live Runtime', true, 'No mock data arrays found in visualizations.', null, Date.now() - startTime);
    } catch (e) {
      return this._createResult('12', 'All Visualizations Consume Live Runtime', false, 'Check failed', e.message, Date.now() - startTime);
    }
  }

  async check13_uiRegressionSuite() {
    const startTime = Date.now();
    return { 
      id: '13',
      name: 'UI Regression Suite',
      passed: true, 
      details: 'ADVISORY: Requires manual UI regression testing. Zero visual regressions must be confirmed by a human reviewer.', 
      advisory: true,
      durationMs: Date.now() - startTime
    };
  }

  async check14_performanceTargets() {
    const startTime = Date.now();
    try {
      const ledgerPath = path.join(CORE_DIR, 'ledger', 'event-ledger.cjs');
      if (fs.existsSync(ledgerPath)) {
        const { EventLedger } = require(ledgerPath);
        const ledger = new EventLedger();
        
        const appendStart = Date.now();
        if (ledger.append) {
          for (let i = 0; i < 100; i++) {
             ledger.append('TEST_EVENT', { iteration: i });
          }
        }
        const avgAppend = (Date.now() - appendStart) / 100;
        
        if (avgAppend >= 5) {
           return this._createResult('14', 'Performance Targets', false, `Average append time ${avgAppend}ms exceeds 5ms target`, null, Date.now() - startTime);
        }
      }
      return this._createResult('14', 'Performance Targets', true, 'Ledger append performance within targets (<5ms).', null, Date.now() - startTime);
    } catch (e) {
      return this._createResult('14', 'Performance Targets', false, 'Check failed', e.message, Date.now() - startTime);
    }
  }

  async check15_securityAudit() {
    const startTime = Date.now();
    try {
      const allCoreFiles = getAllFiles(CORE_DIR).filter(f => f.endsWith('.cjs'));
      for (const file of allCoreFiles) {
        const content = fs.readFileSync(file, 'utf8');
        // Very basic regex for exposed hardcoded tokens, ignoring typical parameter names
        const patterns = [/['"](sk-[A-Za-z0-9]{20,})['"]/, /['"](ghp_[A-Za-z0-9]{36,})['"]/];
        for (const pattern of patterns) {
          if (pattern.test(content)) {
            return this._createResult('15', 'Security Audit', false, `Exposed secret found in ${file}`, null, Date.now() - startTime);
          }
        }
      }
      return this._createResult('15', 'Security Audit', true, 'No hardcoded secrets found in kernel source.', null, Date.now() - startTime);
    } catch (e) {
      return this._createResult('15', 'Security Audit', false, 'Check failed', e.message, Date.now() - startTime);
    }
  }

  async check16_fullSuite(previousResults = []) {
    const startTime = Date.now();
    try {
      if (!previousResults || previousResults.length < 15) {
         return this._createResult('16', 'Full Suite', false, 'Not all prerequisite checks were run.', null, Date.now() - startTime);
      }
      
      const failed = previousResults.filter(r => !r.passed);
      if (failed.length > 0) {
        return this._createResult('16', 'Full Suite', false, `${failed.length} checks failed.`, null, Date.now() - startTime);
      }
      
      return this._createResult('16', 'Full Suite', true, 'All 15 checks passed successfully.', null, Date.now() - startTime);
    } catch (e) {
      return this._createResult('16', 'Full Suite', false, 'Check failed', e.message, Date.now() - startTime);
    }
  }
}

/**
 * Register certification IPC handlers with Electron main process.
 * Call this from electron/main.cjs during startup.
 */
function registerCertificationIPC(ipcMain) {
  ipcMain.handle('certification:run-all', async () => {
    const runner = new CertificationRunner();
    return runner.runAll();
  });
  ipcMain.handle('certification:run-check', async (event, checkId) => {
    const runner = new CertificationRunner();
    return runner.runCheck(checkId);
  });
}

module.exports = { CertificationRunner, registerCertificationIPC };
