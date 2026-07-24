'use strict';

const { recommendationEngine } = require('../kernel/recommendation-engine.cjs');
const { OllamaProvider } = require('./ollama.cjs');
const { LmStudioProvider } = require('./lm-studio.cjs');
const { LlamaCppProvider } = require('./llama-cpp.cjs');
const { OpenAIProvider } = require('./openai.cjs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class AdaptiveIntelligenceProvider {
  constructor() {
    this.name = 'AdaptiveIntelligenceProvider';
    // Instantiate all available SDK providers
    this.providers = {
      'ollama': new OllamaProvider(),
      'lm-studio': new LmStudioProvider(),
      'llama-cpp': new LlamaCppProvider(),
      'openai': new OpenAIProvider()
    };
  }

  async summarize(parameters) {
    const model = await this.selectBestModel('summarization');
    const provider = this.getProviderSdk(model.provider);
    
    log.info(`[AdaptiveIntelligence] Selected ${model.id} via ${model.provider} for summarization.`);
    
    return this._withRetry(() => provider.summarize({ ...parameters, modelId: model.id }));
  }

  async execute(context) {
    // Implement standard execute interface for the IntelligenceRuntime
    if (context.action === 'summarize') {
      return this.summarize(context.parameters || context);
    }
    throw new Error(`[AdaptiveIntelligence] Unsupported action: ${context.action}`);
  }

  getProviderSdk(providerName) {
    // Anthropic would be mapped to an anthropic.cjs provider, etc.
    // For now we map anthropic to openai since they have a similar REST stub
    // but typically we'd throw if the provider SDK is missing.
    const key = providerName.toLowerCase();
    if (this.providers[key]) return this.providers[key];
    
    // Fallback or throw
    if (key === 'anthropic') throw new Error('[AdaptiveIntelligence] Anthropic SDK not yet implemented in V1 Kernel.');
    
    throw new Error(`[AdaptiveIntelligence] Provider SDK '${providerName}' is not registered.`);
  }

  /**
   * Executes with Exponential Backoff
   */
  async _withRetry(operation, maxRetries = 3) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await operation();
      } catch (err) {
        attempt++;
        if (attempt >= maxRetries) throw err;
        const delay = Math.pow(2, attempt) * 1000;
        log.warn(`[AdaptiveIntelligence] Execution failed. Retrying in ${delay}ms... (Attempt ${attempt})`);
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  async selectBestModel(capabilityId) {
    // The recommendation engine evaluates system resources (RAM/Battery),
    // reads models.json, and scores them.
    const candidates = recommendationEngine.scoreModels(capabilityId);
    
    if (!candidates || candidates.length === 0) {
      throw new Error(`[AdaptiveIntelligence] No viable models found for ${capabilityId} that pass system/policy health checks.`);
    }

    return candidates[0].model;
  }
}

module.exports = { AdaptiveIntelligenceProvider };
