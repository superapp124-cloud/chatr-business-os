'use strict';

/**
 * CHATR Kernel - AI Runtime
 * The Immutable Execution Pipeline for all AI operations.
 * 
 * Pipeline: Capability -> Policy -> Recommendation -> Selection -> Provider -> Model
 */

const { bus } = require('../events/bus.cjs');
const { recommendationEngine } = require('../kernel/recommendation-engine.cjs');
const { selectionEngine } = require('../kernel/selection-engine.cjs');
// We require providerRegistry lazily or assume it's globally available
const { providerRegistry } = require('../registry/provider-registry.cjs');

class AIRuntime {
  constructor() {
    this.name = 'AIRuntime';
  }

  /**
   * Execute an AI Request.
   * @param {object} request AIRequest { capability, prompt, context, privacy, ... }
   */
  async execute(request) {
    const ts = new Date().toISOString();
    bus.publish('AI_REQUEST_CREATED', { request, timestamp: ts });

    // 1. Recommendation (Scoring + Policy + Health filtering happens inside here)
    const candidates = recommendationEngine.scoreModels(request.capability, request.policyOverrides || {});

    // 2. Selection (Picks winner, handles fallback & auto-download)
    const selection = selectionEngine.selectWinner(candidates);

    if (!selection.winner) {
      bus.publish('AI_POLICY_BLOCKED', { request, error: selection.error });
      throw new Error(`AI Request blocked or failed: ${selection.error}`);
    }

    const winner = selection.winner;

    // 3. Create Immutable Execution Plan
    const executionPlan = Object.freeze({
      capability: request.capability,
      provider: winner.provider,
      model: winner.id,
      reason: candidates.find(c => c.model.id === winner.id)?.reason || 'Selected by fallback rules',
      estimatedMemory: winner.memoryRequirement,
      estimatedCost: (winner.costPer1MInput || 0) + (winner.costPer1MOutput || 0),
      fallbackTriggered: selection.fallbackTriggered,
      confidence: selection.confidence,
      temperature: request.temperature || 0.7,
      stream: request.stream || false
    });

    bus.publish('AI_EXECUTION_PLAN_CREATED', { executionPlan });

    // 4. Resolve Provider
    const provider = providerRegistry.get(executionPlan.provider);
    if (!provider) {
      bus.publish('EXECUTION_FAILED', { executionPlan, error: `Provider ${executionPlan.provider} not found` });
      throw new Error(`Provider ${executionPlan.provider} not found in registry`);
    }

    bus.publish('PROVIDER_EXECUTION_STARTED', { executionPlan });

    // 5. Execution
    const startMs = Date.now();
    try {
      // The provider acts strictly as a dumb driver, executing the exact model specified.
      const result = await provider.generate(request.prompt, executionPlan);
      
      const durationMs = Date.now() - startMs;
      
      // 6. Telemetry (Phase 1: Read-only Learning Engine)
      const telemetry = {
        executionPlan,
        durationMs,
        success: true,
        tokensIn: result.tokensIn || 0,
        tokensOut: result.tokensOut || 0
      };
      bus.publish('TELEMETRY_RECORDED', telemetry);
      bus.publish('EXECUTION_COMPLETED', { executionPlan, result });

      return result;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      bus.publish('EXECUTION_FAILED', { executionPlan, error: err.message, durationMs });
      throw err;
    }
  }
}

const aiRuntime = new AIRuntime();
module.exports = { aiRuntime, AIRuntime };
