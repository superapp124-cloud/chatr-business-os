'use strict';

/**
 * CHATR Kernel — Express Server
 *
 * Pure infrastructure. Zero business logic.
 * Wires together middleware + module routers.
 *
 * Genesis v1.0
 */

const express         = require('express');
const cors            = require('cors');
const { requestId }   = require('../middleware/request-id.cjs');
const { logger }      = require('../middleware/logger.cjs');

const { router: healthRouter }       = require('../health/health.cjs');
const transportConfig = require('../config/transport.config.cjs');

function createServer() {
  const app = express();

  // ── Global Middleware ──────────────────────────────────────────────────────
  app.use(cors({ origin: transportConfig.cors.origins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);
  app.use(logger);

  // ── Module Routes ──────────────────────────────────────────────────────────
  const { featureRegistry } = require('../registry/feature-registry.cjs');
  const modules = featureRegistry.list();
  
  for (const mod of modules) {
    if (['stable', 'beta'].includes(mod.status) && mod.handler?.router) {
      app.use(`/${mod.name}`, mod.handler.router);
    }
  }

  // Ensure health router is still mounted (we can mount it under /kernel or just root, or keep it under /conversation for now to avoid breaking the frontend)
  const { router: healthRouter } = require('../health/health.cjs');
  app.use('/conversation', healthRouter);   // health/version/models/metrics

  // ── Kernel Event Router ───────────────────────────────────────────────────
  const { router: eventRouter } = require('../transport/router.cjs');
  app.use('/kernel', eventRouter);

  // ── Kernel Intent Router (React UI Bridge) ───────────────────────────────
  app.post('/api/intent', async (req, res) => {
    try {
      const { intent, context = {}, payload = {} } = req.body;
      const { runtimeManager } = require('../kernel/runtime-manager.cjs');
      
      const provider = runtimeManager.getProviderForCapability(intent);
      let data = null;
      
      const actionStr = intent.includes('.') ? intent.split('.')[1] : intent;
      const mergedContext = { action: actionStr, ...context, ...payload };

      if (intent === 'memory.search' && typeof provider.search === 'function') {
        data = await provider.search(mergedContext);
      } else if (typeof provider.execute === 'function') {
        data = await provider.execute(mergedContext);
      } else {
        throw new Error(`Provider for ${intent} lacks an execution method.`);
      }

      res.json({ success: true, data });
    } catch (err) {
      const log = (() => { try { return require('electron-log'); } catch { return console; } })();
      log.error(`[CHATR Core] Intent execution failed for ${req.body?.intent}:`, err.message);
      res.json({ success: false, error: err.message });
    }
  });

  // ── Capability Modules ─────────────────────────────────────────────────────────────
  require('../modules/meetings/index.cjs');
  require('../modules/tasks/index.cjs');
  require('../modules/documents/index.cjs');
  require('../modules/contacts/index.cjs');

  // ── Root ──────────────────────────────────────────────────────────────────
  app.get('/', (req, res) => {
    res.json({ kernel: 'CHATR Core', version: require('../config/runtime.config.cjs').version, status: 'running' });
  });

  // ── 404 ───────────────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', path: req.path });
  });

  // 🐛 Error Handler 🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    const log = (() => { try { return require('electron-log'); } catch { return console; } })();
    
    // Security: Malformed JSON handling
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      log.warn('[CHATR Core] Security: Malformed JSON payload blocked');
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Malformed JSON payload' });
    }

    if (err.type === 'entity.too.large') {
      log.warn('[CHATR Core] Security: Oversized payload blocked');
      return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', message: 'Payload exceeded 1MB limit' });
    }

    log.error('[CHATR Core] Unhandled error:', err.message);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  });

  return app;
}

module.exports = { createServer };
