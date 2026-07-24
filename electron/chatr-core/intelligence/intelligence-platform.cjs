'use strict';

/**
 * CHATR Kernel — Intelligence Platform Pipeline
 * 
 * Demonstrates the end-to-end Layer 4 pipeline:
 * Raw Input -> Intent Resolution -> Goal Compiler -> Workflow Compiler
 */

const { packageCompiler } = require('../packages/package-compiler.cjs');
const { intentResolutionPipeline } = require('./intent-resolution-pipeline.cjs');
const { goalCompiler } = require('./goal-compiler.cjs');
const { workflowCompiler } = require('./workflow-compiler.cjs');
const { strategyRegistry } = require('../execution/strategies/strategy-registry.cjs');
const BrowserTransportStrategy = require('../execution/strategies/browser-transport.cjs');
const McpTransportStrategy = require('../execution/strategies/mcp-transport.cjs');
const path = require('path');
const log = (() => { try { return require('electron-log'); } catch { return console; } })();

class IntelligencePlatform {
  async bootstrap() {
    log.info('[IntelligencePlatform] Bootstrapping Package Compiler...');
    const travelPackagePath = path.join(__dirname, '../packages/travel');
    await packageCompiler.compile(travelPackagePath);

    log.info('[IntelligencePlatform] Registering Transport Strategies...');
    await strategyRegistry.register('browser', new BrowserTransportStrategy());
    await strategyRegistry.register('mcp', new McpTransportStrategy());
  }

  async processRequest(rawInput) {
    log.info(`[IntelligencePlatform] Processing User Request: "${rawInput}"`);

    // 1. Resolve Intent
    const structuredIntent = await intentResolutionPipeline.resolve(rawInput);
    log.info(`[IntelligencePlatform] Structured Intent:`, structuredIntent);

    // 2. Handle Dynamic vs Static compilation
    if (structuredIntent.package_id === 'dynamic') {
      const crypto = require('crypto');
      const capabilityGraph = {
        id: `cg_${crypto.randomUUID()}`,
        intent_id: structuredIntent.id || `int_${crypto.randomUUID()}`,
        nodes: [
          {
            id: `cn_${crypto.randomUUID()}`,
            capability: structuredIntent.capability,
            parameters: structuredIntent.constraints || {},
            requiresApproval: false
          }
        ],
        status: 'COMPILED'
      };
      log.info(`[IntelligencePlatform] Synthesized Dynamic Capability Graph:`, JSON.stringify(capabilityGraph, null, 2));
      return capabilityGraph;
    }

    // 2. Compile Goal Graph
    const goalGraph = goalCompiler.compile(structuredIntent);
    log.info(`[IntelligencePlatform] Compiled Goal Graph:`, JSON.stringify(goalGraph, null, 2));

    // 3. Compile Capability Graph
    const capabilityGraph = workflowCompiler.compile(goalGraph, structuredIntent.package_id);
    log.info(`[IntelligencePlatform] Compiled Capability Graph:`, JSON.stringify(capabilityGraph, null, 2));

    return capabilityGraph;
  }
}

const intelligencePlatform = new IntelligencePlatform();
module.exports = { IntelligencePlatform, intelligencePlatform };
