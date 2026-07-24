'use strict';

/**
 * CHATR Kernel - Recommendation Engine
 * Scores viable models based on capability alignment.
 */

const { modelRegistry } = require('../registry/model-registry.cjs');
const { capabilityRegistry } = require('../registry/capability-registry.cjs');
const { policyEngine } = require('./policy-engine.cjs');
const { runtimeHealth } = require('./runtime-health.cjs');

class RecommendationEngine {
  constructor() {
    this.name = 'RecommendationEngine';
  }

  scoreModels(capabilityId, requestPolicy = {}) {
    const requirements = capabilityRegistry.getRequirements(capabilityId);
    const effectivePolicy = policyEngine.computeEffectivePolicy(requestPolicy);
    const resources = runtimeHealth.getSystemResources();

    const candidates = [];
    const models = modelRegistry.getAll();

    for (const model of models) {
      // 1. Policy Filter
      const policyCheck = policyEngine.evaluateModel(model, effectivePolicy);
      if (!policyCheck.allowed) continue;

      // 2. Health Filter
      const healthCheck = runtimeHealth.canRunModel(model, resources);
      if (!healthCheck.capable) continue;

      // 3. Score against Capability
      let score = 0;
      
      // Match specific capability skills
      if (capabilityId === 'coding') score += (model.coding || 0) * 40;
      if (capabilityId === 'summarization') score += (model.summarization || 0) * 40;
      if (capabilityId === 'routing') score += (model.reasoning || 0) * 20 + (model.estimatedTokensPerSecond > 40 ? 20 : 0);
      
      // Feature requirements
      if (requirements.json && model.json) score += 10;
      if (requirements.toolCalling && model.toolCalling) score += 15;
      
      // Base priority from registry
      score += (model.priority || 0) * 5;

      candidates.push({
        model,
        score,
        reason: `${model.family} matched policy and scored ${score.toFixed(1)} on capability alignment.`
      });
    }

    // Sort descending by score
    candidates.sort((a, b) => b.score - a.score);
    
    // Return Top 5
    return candidates.slice(0, 5);
  }
}

const recommendationEngine = new RecommendationEngine();
module.exports = { recommendationEngine, RecommendationEngine };
