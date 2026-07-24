'use strict';

/**
 * CHATR Kernel — Boot Sequencer
 *
 * The single entry point that boots the entire CHATR Core.
 * Called from electron/main.cjs with one line.
 *
 * Boot Sequence:
 *   1. Register providers
 *   2. Register modules
 *   3. Start HTTP server
 *   4. Publish KERNEL_READY event
 *
 * Genesis v1.0
 */

const { bus }              = require('./events/bus.cjs');
const { CORE }             = require('./events/events.cjs');
const { featureRegistry }  = require('./registry/feature-registry.cjs');
const { providerRegistry } = require('./registry/provider-registry.cjs');
const { validateProvider } = require('./providers/interface.cjs');
const { OllamaProvider }   = require('./providers/ollama.cjs');
const { moduleLoader }     = require('./kernel/module-loader.cjs');
const recommendationEngine = require('./kernel/recommendation-engine.cjs');
const { recoveryManager }  = require('./kernel/recovery.cjs');
const { createServer }     = require('./server/server.cjs');
const runtimeConfig        = require('./config/runtime.config.cjs');
const featureConfig        = require('./config/feature.config.cjs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

let _httpServer = null;
let _isRunning  = false;

async function boot() {
  if (_isRunning) {
    log.warn('[CHATR Kernel] Already running. Skipping boot.');
    return;
  }

  log.info(`[CHATR Kernel] Booting — ${runtimeConfig.codename} v${runtimeConfig.version}`);

  const { runtimeManager } = require('./kernel/runtime-manager.cjs');
  const { MemoryRuntime, CommunicationRuntime, IntelligenceRuntime, WorkflowRuntime, ResourceRuntime, DashboardRuntime, IdentityRuntime } = require('./services/interfaces.cjs');
  const { LocalSearchProvider } = require('./providers/local-search.cjs');
  const { LocalEmailProvider } = require('./providers/local-email.cjs');
  const { AdaptiveIntelligenceProvider } = require('./providers/adaptive-intelligence.cjs');
  const { OSReminderProvider } = require('./providers/os-reminder.cjs');
  const { OSCalendarProvider } = require('./providers/os-calendar.cjs');
  const { LocalResourceProvider } = require('./providers/local-resource.cjs');
  const { LocalTelemetryProvider } = require('./providers/local-telemetry.cjs');
  const { LocalDashboardProvider } = require('./providers/local-dashboard.cjs');
  const { LocalIdentityProvider } = require('./providers/local-identity.cjs');

  // 1a. Register Runtimes
  runtimeManager.registerRuntime('MemoryRuntime', new MemoryRuntime());
  runtimeManager.registerRuntime('CommunicationRuntime', new CommunicationRuntime());
  
  // IntelligenceRuntime is already in interfaces.cjs from our previous edit!
  runtimeManager.registerRuntime('IntelligenceRuntime', new IntelligenceRuntime());
  runtimeManager.registerRuntime('WorkflowRuntime', new WorkflowRuntime());
  runtimeManager.registerRuntime('ResourceRuntime', new ResourceRuntime());
  runtimeManager.registerRuntime('DashboardRuntime', new DashboardRuntime());
  runtimeManager.registerRuntime('IdentityRuntime', new IdentityRuntime());

  // 1b. Register Capabilities & Providers
  runtimeManager.registerCapability({ id: 'memory.search', name: 'Local Search', version: '1.0', runtime: 'MemoryRuntime', provider: 'LocalSearchProvider' }, new LocalSearchProvider());
  runtimeManager.registerCapability({ id: 'communication.email', name: 'Draft Email', version: '1.0', runtime: 'CommunicationRuntime', provider: 'LocalEmailProvider', approval: 'always' }, new LocalEmailProvider());
  
  // Replace LocalIntelligenceProvider with AdaptiveIntelligenceProvider
  runtimeManager.registerCapability({ id: 'intelligence.summarize', name: 'Summarize', version: '2.0', runtime: 'IntelligenceRuntime', provider: 'AdaptiveIntelligenceProvider' }, new AdaptiveIntelligenceProvider());
  
  runtimeManager.registerCapability({ id: 'workflow.start', name: 'OS Reminder', version: '1.0', runtime: 'WorkflowRuntime', provider: 'OSReminderProvider' }, new OSReminderProvider());
  runtimeManager.registerCapability({ id: 'workflow.read_calendar', name: 'OS Calendar', version: '1.0', runtime: 'WorkflowRuntime', provider: 'OSCalendarProvider' }, new OSCalendarProvider());

  // Telemetry isn't an executed capability in the same way, but we instantiate it so it hooks into the bus
  const telemetry = new LocalTelemetryProvider();
  
  const resourceProvider = new LocalResourceProvider();
  runtimeManager.registerCapability({ id: 'system.resource', name: 'Local Resources', version: '1.0', runtime: 'ResourceRuntime', provider: 'LocalResourceProvider' }, resourceProvider);
  resourceProvider.startMonitoring();

  // Dashboard provider
  const dashboardProvider = new LocalDashboardProvider();
  runtimeManager.registerCapability({ id: 'dashboard.get_status', name: 'Dashboard Status', version: '1.0', runtime: 'DashboardRuntime', provider: 'LocalDashboardProvider' }, dashboardProvider);
  runtimeManager.registerCapability({ id: 'dashboard.get_timeline', name: 'Dashboard Timeline', version: '1.0', runtime: 'DashboardRuntime', provider: 'LocalDashboardProvider' }, dashboardProvider);
  runtimeManager.registerCapability({ id: 'dashboard.get_intelligence_brief', name: 'Intelligence Brief', version: '1.0', runtime: 'DashboardRuntime', provider: 'LocalDashboardProvider' }, dashboardProvider);
  runtimeManager.registerCapability({ id: 'dashboard.search', name: 'Dashboard Search', version: '1.0', runtime: 'DashboardRuntime', provider: 'LocalDashboardProvider' }, dashboardProvider);

  // Identity provider
  const identityProvider = new LocalIdentityProvider();
  runtimeManager.registerCapability({ id: 'identity.connect', name: 'Connect Account', version: '1.0', runtime: 'IdentityRuntime', provider: 'LocalIdentityProvider' }, identityProvider);
  runtimeManager.registerCapability({ id: 'identity.get_accounts', name: 'Get Connected Accounts', version: '1.0', runtime: 'IdentityRuntime', provider: 'LocalIdentityProvider' }, identityProvider);
  runtimeManager.registerCapability({ id: 'identity.revoke', name: 'Revoke Account', version: '1.0', runtime: 'IdentityRuntime', provider: 'LocalIdentityProvider' }, identityProvider);

  log.info('[CHATR Kernel] Execution Loop Runtimes & Providers registered.');

  // ── Step 2: Register Modules ───────────────────────────────────────────────
  await moduleLoader.loadAll();
  
  // Reserve future module slots from config if they don't have folders yet
  for (const [name, cfg] of Object.entries(featureConfig.modules)) {
    if (!featureRegistry.get(name)) {
      featureRegistry.register({
        name,
        version: cfg.version,
        status: 'reserved',
        description: `${name} module — reserved for future activation`,
        dependencies: [],
      });
    }
  }

  // ── Step 3: Start HTTP Server ──────────────────────────────────────────────
  const app = createServer();

  await new Promise((resolve, reject) => {
    _httpServer = app.listen(runtimeConfig.port, runtimeConfig.host, () => {
      log.info(`[CHATR Kernel] HTTP server listening on ${runtimeConfig.host}:${runtimeConfig.port}`);
      resolve();
    });
    _httpServer.on('error', (err) => {
      log.error('[CHATR Kernel] Server failed to start:', err.message);
      reject(err);
    });
  });

  // ── Step 4: Recover Interrupted Requests ─────────────────────────────────
  await recoveryManager.recover();

  const { getGoalRuntime } = require('./kernel/goal-runtime.cjs');
  const recoveredGoals = getGoalRuntime().recoverActiveGoals();
  log.info(`[CHATR Kernel] Goal Runtime recovered ${recoveredGoals.length} active goals.`);

  // ── Step 4.5: Start Health Watchdog and Connectivity Manager ───────────────
  const { watchdog } = require('./health/watchdog.cjs');
  watchdog.start(30000);

  const { connectivityManager } = require('./kernel/connectivity-manager.cjs');
  connectivityManager.start(30000);
  log.info('[CHATR Kernel] Kernel subsystems initialized (Health, Connectivity).');


  // ── Step 4.6: Boot Universal Execution Layer v2.0 ─────────────────────────
  const { ExecutionRuntime } = require('./execution/execution-runtime.cjs');
  const executionRuntime = new ExecutionRuntime();
  runtimeManager.registerRuntime('ExecutionRuntime', executionRuntime);

  // Register all universal capability IDs so the validator doesn't warn
  const { CapabilityRegistry } = require('./capabilities/registry.cjs');
  for (const cap of CapabilityRegistry.getAllCapabilities()) {
    try {
      const capId = cap.identity?.id || cap.id;
      if (!capId) continue;
      runtimeManager.registerCapability(
        {
          id:       capId,
          name:     cap.identity?.name || cap.name || cap.description || cap.purpose || capId,
          version:  cap.identity?.version || cap.version || '2.0',
          runtime:  'ExecutionRuntime',
          provider: 'ExecutionRuntime',
          category: cap.domain || cap.category || 'General',
          approval: cap.approval
        },
        executionRuntime
      );
    } catch (e) {
      log.warn(`[CHATR Kernel] Could not register capability ${cap.id}: ${e.message}`);
    }
  }

  // Start background jobs manager (restores persisted jobs from disk)
  const { backgroundJobs } = require('./background-jobs.cjs');
  backgroundJobs.restore();

  log.info('[CHATR Kernel] Universal Execution Layer v2.0 ready.');

  // ── Step 5: Publish KERNEL_READY ──────────────────────────────────────────
  _isRunning = true;
  bus.publish(CORE.KERNEL_READY, {
    version:  runtimeConfig.version,
    codename: runtimeConfig.codename,
    port:     runtimeConfig.port,
    modules:  featureRegistry.list().map(m => m.name),
  });

  log.info('[CHATR Kernel] ✓ Ready.');
}

async function shutdown() {
  if (!_isRunning || !_httpServer) return;
  return new Promise((resolve) => {
    _httpServer.close(() => {
      _isRunning = false;
      log.info('[CHATR Kernel] Shutdown complete.');
      resolve();
    });
  });
}

function isRunning() { return _isRunning; }

module.exports = { boot, shutdown, isRunning };
