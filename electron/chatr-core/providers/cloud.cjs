'use strict';

/**
 * CHATR Kernel - Cloud Provider Stub
 * Implements the Provider interface for cloud-based execution.
 * Disabled by default.
 */

class CloudProvider {
  constructor() {
    this.name = 'CloudProvider';
    this.enabled = false;
  }

  async generate(prompt, executionPlan) {
    if (!this.enabled) {
      throw new Error('[CloudProvider] Execution blocked. Cloud AI is disabled by policy.');
    }

    // Example stub for Cloud Execution (e.g. Anthropic, OpenAI)
    console.log(`[CloudProvider] Executing ${executionPlan.model} on cloud...`);
    
    return {
      text: "Simulated Cloud Response for " + executionPlan.model,
      tokensIn: 50,
      tokensOut: 100
    };
  }

  supports(modelProfile) {
    return modelProfile.cloud === true;
  }

  health() {
    return { status: 'healthy', reachable: true };
  }

  authenticate(apiKey) {
    this.enabled = true;
    this.apiKey = apiKey;
  }
}

module.exports = { CloudProvider };
