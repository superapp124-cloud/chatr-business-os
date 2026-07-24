'use strict';

/**
 * CHATR Kernel — Health, Metrics & Version Endpoints
 *
 * Genesis v1.0
 */

const express          = require('express');
const runtimeConfig    = require('../config/runtime.config.cjs');
const { providerRegistry } = require('../registry/provider-registry.cjs');
const { featureRegistry  } = require('../registry/feature-registry.cjs');
const { bus }          = require('../events/bus.cjs');
const { getMetrics }   = require('../middleware/logger.cjs');
const { inspector }    = require('../kernel/inspector.cjs');
const { recoveryManager } = require('../kernel/recovery.cjs');
const os               = require('os');

const router = express.Router();

// GET /conversation/health
router.get('/health', async (req, res) => {
  const providerHealth = await providerRegistry.resolve().health().catch(err => ({
    ok: false, error: err.message, provider: providerRegistry.getActiveName(), readyModels: [], latencyMs: 0,
  }));

  res.json({
    core:         'ok',
    conversation: 'ok',
    provider:     providerHealth.provider,
    model:        providerHealth.readyModels?.[0] || 'none',
    readyModels:  providerHealth.readyModels,
    memory:       'pending_v0.2',
    version:      runtimeConfig.version,
    codename:     runtimeConfig.codename,
    latencyMs:    providerHealth.latencyMs,
    modules:      featureRegistry.list().map(({ name, version, status, registeredAt }) => ({ name, version, status, registeredAt })),
    providerOk:   providerHealth.ok,
    providerError: providerHealth.error || null,
  });
});

// GET /conversation/version
router.get('/version', (req, res) => {
  res.json({
    core_version:   runtimeConfig.version,
    codename:       runtimeConfig.codename,
    provider:       providerRegistry.getActiveName(),
    api_version:    'v1',
    schema_version: '1',
  });
});

// GET /conversation/models
router.get('/models', async (req, res) => {
  try {
    const models = await providerRegistry.resolve().listModels();
    res.json({ ok: true, provider: providerRegistry.getActiveName(), models });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message, models: [] });
  }
});

// GET /conversation/metrics
router.get('/metrics', (req, res) => {
  const reqMetrics   = getMetrics();
  const busMetrics   = bus.getMetrics();
  const inspectStats = inspector.getStats();

  res.json({
    system: {
      uptimeSeconds: process.uptime(),
      memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      cpuUsage: process.cpuUsage(),
      loadAvg: os.loadavg(),
    },
    requests:      reqMetrics.totalRequests,
    streams:       reqMetrics.totalStreams,
    errors:        reqMetrics.totalErrors,
    avgLatencyMs:  reqMetrics.avgLatencyMs,
    eventsPublished: busMetrics.published,
    eventsByType:  busMetrics.byEvent,
    provider:      providerRegistry.getActiveName(),
    modules:       featureRegistry.list().map(({ name, version, status, registeredAt }) => ({ name, version, status, registeredAt })),
    inspector:     inspectStats,
    recovery:      recoveryManager.status(),
  });
});

module.exports = { router };
