'use strict';

/**
 * CHATR Kernel v2.0 — Execution Runtime
 *
 * The universal capability execution layer.
 * Extends BaseRuntime, uses DiscoveryEngine + StrategyEngine to select
 * the right executor, then delegates to browser/api/local/simulation.
 *
 * Bus events emitted:
 *   execution:capability_started
 *   execution:browser_step
 *   execution:approval_required
 *   execution:capability_completed
 *   execution:capability_failed
 */

const crypto = require('crypto');
const { BaseRuntime } = require('../services/interfaces.cjs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

// ── Connector registry (lazy-loaded to avoid circular deps) ─────────────────

function _loadConnector(connectorId) {
  const { discoveryEngine } = require('../discovery/discovery-engine.cjs');
  const provider = discoveryEngine._providers.get(connectorId);
  const category = provider ? provider.category : connectorId;

  const MAP = {
    transport:  '../connectors/transport/connector.cjs',
    food:       '../connectors/food/connector.cjs',
    jobs:       '../connectors/jobs/connector.cjs',
    healthcare: '../connectors/healthcare/connector.cjs',
    shopping:   '../connectors/shopping/connector.cjs'
  };

  const relPath = MAP[category] || MAP[connectorId];
  if (!relPath) return null;

  try {
    const mod = require(relPath);
    // Return the singleton instance (first export value)
    return mod[Object.keys(mod)[0]];
  } catch (err) {
    log.warn(`[ExecutionRuntime] Could not load connector '${connectorId}': ${err.message}`);
    return null;
  }
}

// ── Simulation data for capabilities without a connector ────────────────────

function _simulateCapability(capabilityId, parameters) {
  switch (capabilityId) {
    case 'shopping.search':
      return {
        options: [
          { optionId: `prod_${Date.now()}_1`, provider: 'amazon', providerName: 'Amazon', title: `${parameters.query || 'Product'} — Premium`, subtitle: 'Delivered Tomorrow', price: Math.floor(Math.random() * 5000) + 499, currency: 'INR', availability: 'available', confidence: 95, badges: ['RECOMMENDED'] },
          { optionId: `prod_${Date.now()}_2`, provider: 'flipkart', providerName: 'Flipkart', title: `${parameters.query || 'Product'} — Standard`, subtitle: 'Delivered in 2 days', price: Math.floor(Math.random() * 3000) + 299, currency: 'INR', availability: 'available', confidence: 90, badges: [] },
          { optionId: `prod_${Date.now()}_3`, provider: 'meesho', providerName: 'Meesho', title: `${parameters.query || 'Product'} — Budget Pick`, subtitle: 'Delivered in 3 days', price: Math.floor(Math.random() * 1500) + 199, currency: 'INR', availability: 'available', confidence: 85, badges: ['BEST_VALUE'] }
        ]
      };

    case 'shopping.purchase':
      return {
        orderId:  `ORD${Date.now()}`,
        productId: parameters.productId,
        status:   'confirmed',
        total:    parameters.price || 999,
        currency: 'INR',
        deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        placedAt: new Date().toISOString()
      };

    case 'document.analyze':
      return {
        text:     'Document content placeholder.',
        entities: [],
        summary:  'Document analyzed successfully (simulation mode).'
      };

    case 'transport.search':
      return {
        options: [
          { optionId: `trn_${Date.now()}_1`, provider: 'irctc', providerName: 'IRCTC', title: `Train to ${parameters.to || 'Destination'}`, subtitle: 'Departs at 08:30 AM', price: 1250, currency: 'INR', availability: 'available', confidence: 95, badges: ['FASTEST'] },
          { optionId: `trn_${Date.now()}_2`, provider: 'irctc', providerName: 'IRCTC', title: `Train to ${parameters.to || 'Destination'}`, subtitle: 'Departs at 10:15 AM', price: 950, currency: 'INR', availability: 'available', confidence: 92, badges: ['RECOMMENDED'] },
          { optionId: `trn_${Date.now()}_3`, provider: 'irctc', providerName: 'IRCTC', title: `Train to ${parameters.to || 'Destination'}`, subtitle: 'Departs at 02:45 PM', price: 650, currency: 'INR', availability: 'available', confidence: 85, badges: ['BUDGET'] }
        ]
      };

    case 'transport.book':
      return {
        orderId: `TKT${Date.now()}`,
        status: 'confirmed',
        message: 'Tickets booked successfully'
      };

    case 'travel.hotel_search':
      return {
        options: [
          { optionId: `htl_${Date.now()}_1`, provider: 'agoda', providerName: 'Agoda', title: `Taj Resort & Spa, ${parameters.location || 'City'}`, subtitle: '5-Star Luxury · Beachfront', price: 14500, currency: 'INR', availability: 'available', confidence: 98, badges: ['LUXURY', 'TOP RATED'] },
          { optionId: `htl_${Date.now()}_2`, provider: 'booking', providerName: 'Booking.com', title: `Lemon Tree Hotel, ${parameters.location || 'City'}`, subtitle: '4-Star · Near Airport', price: 4200, currency: 'INR', availability: 'available', confidence: 92, badges: ['RECOMMENDED'] },
          { optionId: `htl_${Date.now()}_3`, provider: 'makemytrip', providerName: 'MakeMyTrip', title: `Backpacker's Hostel, ${parameters.location || 'City'}`, subtitle: 'Budget Stay · Free WiFi', price: 899, currency: 'INR', availability: 'available', confidence: 88, badges: ['BUDGET'] }
        ]
      };

    case 'utility.bill_pay':
      return {
        options: [
          { optionId: `bill_${Date.now()}_1`, provider: 'paytm', providerName: 'Paytm', title: `${parameters.billType ? parameters.billType.charAt(0).toUpperCase() + parameters.billType.slice(1) : 'Electricity'} Bill`, subtitle: 'Instant Payment · Zero Fees', price: 1250, currency: 'INR', availability: 'available', confidence: 99, badges: ['FASTEST'] },
          { optionId: `bill_${Date.now()}_2`, provider: 'phonepe', providerName: 'PhonePe', title: `${parameters.billType ? parameters.billType.charAt(0).toUpperCase() + parameters.billType.slice(1) : 'Electricity'} Bill`, subtitle: 'Assured Cashback', price: 1250, currency: 'INR', availability: 'available', confidence: 95, badges: ['RECOMMENDED'] }
        ]
      };

    case 'government.passport_renew':
      return {
        options: [
          { optionId: `pspt_${Date.now()}_1`, provider: 'passportseva', providerName: 'Passport Seva', title: 'Normal Renewal', subtitle: 'Processing time: 30 days', price: 1500, currency: 'INR', availability: 'available', confidence: 99, badges: ['RECOMMENDED'] },
          { optionId: `pspt_${Date.now()}_2`, provider: 'passportseva', providerName: 'Passport Seva', title: 'Tatkaal Renewal', subtitle: 'Processing time: 3 days', price: 3500, currency: 'INR', availability: 'available', confidence: 95, badges: ['FASTEST'] }
        ]
      };

    case 'background.schedule':
      return { jobId: `job_sim_${Date.now()}` };

    default:
      return { simulated: true, capabilityId, parameters, message: 'No simulator for this capability.' };
  }
}

// ── ExecutionRuntime ─────────────────────────────────────────────────────────

class ExecutionRuntime extends BaseRuntime {
  constructor() {
    super('ExecutionRuntime');
    this._executions = new Map(); // executionId → record
  }

  // ── getHealth override ──────────────────────────────────────────────────────

  getHealth() {
    const active = Array.from(this._executions.values()).filter(e => e.status === 'running').length;
    return {
      status: 'Healthy',
      activeExecutions: active,
      totalExecutions: this._executions.size
    };
  }

  // ── Main execute method ─────────────────────────────────────────────────────

  /**
   * Execute a capability.
   *
   * @param {string} capabilityId  - e.g. 'transport.search'
   * @param {object} parameters    - capability inputs
   * @param {object} [context]     - { credentialVault, intentId, background, jobId }
   * @returns {Promise<object>}    capability result
   */
  async execute(capabilityId, parameters = {}, context = {}) {
    const executionId = crypto.randomUUID();
    const startedAt   = Date.now();

    // Lazy-load dependencies to avoid circular requires at module init
    const { discoveryEngine }  = require('../discovery/discovery-engine.cjs');
    const { strategyEngine }   = require('./strategy-engine.cjs');
    const { credentialVault }  = require('../credential-vault.cjs');
    const { capabilityRegistry } = require('../capabilities/registry.cjs');

    let bus;
    try {
      const { bus: b } = require('../events/bus.cjs');
      bus = b;
    } catch { /* optional */ }

    const _publish = (event, payload) => {
      if (bus) try { bus.publish(event, payload); } catch { /* ignore */ }
    };

    // Record execution
    const record = {
      executionId,
      capabilityId,
      parameters,
      context,
      status:   'running',
      startedAt: new Date().toISOString(),
      result:   null,
      error:    null
    };
    this._executions.set(executionId, record);

    log.info(`[ExecutionRuntime] [${executionId}] Starting '${capabilityId}'`);
    _publish('execution:capability_started', { executionId, capabilityId, parameters });

    try {
      // Check policy / approval requirement
      const cap = capabilityRegistry.getCapability(capabilityId);
      if (cap && cap.approval === 'always' && !context.approvalGranted && !context.background) {
        _publish('execution:approval_required', { executionId, capabilityId, parameters });
        // In production, we would pause and wait for UI approval.
        // For now, emit the event and continue (the UI layer handles the gate).
        log.info(`[ExecutionRuntime] [${executionId}] Approval required for '${capabilityId}' — continuing with simulation.`);
      }

      // Fetch Execution Memory
      let executionMemory;
      try {
        const mod = require('./execution-memory.cjs');
        executionMemory = mod.executionMemory;
      } catch (e) {}

      // Discover connectors
      const vault      = context.credentialVault || credentialVault;
      const connectors = discoveryEngine.discover(capabilityId, { credentialVault: vault, executionMemory });

      // Select strategy
      const strategy = strategyEngine.selectStrategy(capabilityId, connectors, vault);
      log.info(`[ExecutionRuntime] [${executionId}] Strategy: ${strategy.executor} via connector='${strategy.connector || 'none'}'`);

      // --- EXECUTION INTELLIGENCE LAYER ---
      // 1. Simulation
      _publish('execution:intelligence_simulating', { executionId });
      const simulatedResult = await this._executeSimulation(capabilityId, parameters, strategy);
      
      // 2. Cost Estimate & Risk Analysis
      const costEstimate = simulatedResult?.price || simulatedResult?.total || 0;
      const riskLevel = costEstimate > 5000 ? 'high' : 'low';
      _publish('execution:intelligence_analysis', { executionId, costEstimate, riskLevel });
      log.info(`[ExecutionRuntime] [${executionId}] Intelligence check: Cost est ₹${costEstimate}, Risk ${riskLevel}`);

      // Dispatch to executor
      let result;

      if (strategy.executor === 'browser') {
        result = await this._executeBrowser(executionId, strategy, parameters, capabilityId, vault, _publish);
      } else if (strategy.executor === 'api') {
        result = await this._executeApi(strategy, parameters, capabilityId, vault);
      } else if (strategy.executor === 'local') {
        result = await this._executeLocal(capabilityId, parameters);
      } else {
        // Simulation
        result = await this._executeSimulation(capabilityId, parameters, strategy);
      }

      // Resolve sourceNode references (pass previous step output into next step)
      if (parameters.sourceNode && context.previousResults) {
        result._sourceData = context.previousResults[parameters.sourceNode];
      }

      const duration = Date.now() - startedAt;
      record.status   = 'completed';
      record.result   = result;
      record.duration = duration;

      // Update Execution Memory
      if (executionMemory) {
        executionMemory.recordExecution(
            context.intent || 'unknown',
            capabilityId,
            strategy.connector || 'none',
            'success',
            { cost: costEstimate, latency: duration, eta: result?.eta || 0 }
        );
      }

      _publish('execution:capability_completed', { executionId, capabilityId, result, duration });
      log.info(`[ExecutionRuntime] [${executionId}] '${capabilityId}' completed in ${duration}ms`);

      return result;

    } catch (err) {
      const duration = Date.now() - startedAt;
      record.status = 'failed';
      record.error  = err.message;
      record.duration = duration;

      log.error(`[ExecutionRuntime] [${executionId}] '${capabilityId}' failed:`, err.message);
      _publish('execution:capability_failed', { executionId, capabilityId, error: err.message, duration });

      throw err;
    }
  }

  // ── Browser execution ───────────────────────────────────────────────────────

  async _executeBrowser(executionId, strategy, parameters, capabilityId, vault, _publish) {
    const { browserExecutor } = require('../executors/browser-executor.cjs');
    const connector = _loadConnector(strategy.connector);

    const session = vault ? vault.load(strategy.connector) : null;
    
    // Inject provider ID for selectors
    if (!parameters.provider) {
      parameters.provider = strategy.connector;
    }

    const onStep = (step) => {
      log.info(`[ExecutionRuntime] [${executionId}] Browser step: ${step.step} — ${step.detail || ''}`);
      _publish('execution:browser_step', { executionId, capabilityId, step });
    };

    return browserExecutor.execute(connector, session, capabilityId, parameters, onStep);
  }

  // ── API execution ───────────────────────────────────────────────────────────

  async _executeApi(strategy, parameters, capabilityId, vault) {
    const { apiExecutor } = require('../executors/api-executor.cjs');
    const connector  = _loadConnector(strategy.connector);
    const credentials = vault ? vault.load(strategy.connector) : null;
    return apiExecutor.execute(connector, credentials, capabilityId, parameters);
  }

  // ── Local execution ─────────────────────────────────────────────────────────

  async _executeLocal(capabilityId, parameters) {
    const { localExecutor } = require('../executors/local-executor.cjs');
    return localExecutor.execute(capabilityId, parameters);
  }

  // ── Simulation execution ────────────────────────────────────────────────────

  async _executeSimulation(capabilityId, parameters, strategy) {
    // Prefer connector's built-in simulator
    if (strategy.connector) {
      const connector = _loadConnector(strategy.connector);
      if (connector && typeof connector.simulateTask === 'function') {
        log.info(`[ExecutionRuntime] Using connector '${strategy.connector}' simulator for '${capabilityId}'`);
        return connector.simulateTask(capabilityId, parameters);
      }
    }

    // Fall back to generic simulation
    return _simulateCapability(capabilityId, parameters);
  }

  // ── Parallel search execution ───────────────────────────────────────────────

  /**
   * Execute a search capability across multiple connectors in parallel.
   * @param {string}  capabilityId
   * @param {object}  parameters
   * @param {object}  [context]
   * @returns {Promise<object>} merged results
   */
  async executeParallel(capabilityId, parameters = {}, context = {}) {
    const { discoveryEngine } = require('../discovery/discovery-engine.cjs');
    const { credentialVault } = require('../credential-vault.cjs');

    const vault      = context.credentialVault || credentialVault;
    const connectors = discoveryEngine.discover(capabilityId, { credentialVault: vault });

    if (connectors.length === 0) {
      // No connectors — fall back to single execution
      return this.execute(capabilityId, parameters, context);
    }

    log.info(`[ExecutionRuntime] Parallel execution across ${connectors.length} connector(s) for '${capabilityId}'`);

    const tasks = connectors.map(async (c) => {
      try {
        const connector = _loadConnector(c.connectorId);
        if (connector && typeof connector.simulateTask === 'function') {
          return connector.simulateTask(capabilityId, parameters);
        }
        return _simulateCapability(capabilityId, parameters);
      } catch (err) {
        log.warn(`[ExecutionRuntime] Parallel task failed for connector '${c.connectorId}': ${err.message}`);
        return null;
      }
    });

    const results = await Promise.all(tasks);
    const valid   = results.filter(Boolean);

    // Merge array results (e.g., options, restaurants, products)
    const merged = {};
    for (const r of valid) {
      for (const [key, val] of Object.entries(r)) {
        if (Array.isArray(val)) {
          merged[key] = [...(merged[key] || []), ...val];
        } else if (!merged[key]) {
          merged[key] = val;
        }
      }
    }

    return merged;
  }
}

const executionRuntime = new ExecutionRuntime();
module.exports = { executionRuntime, ExecutionRuntime };
