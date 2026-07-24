'use strict';

/**
 * CHATR Kernel — Provider Configuration
 * Defines Ollama connection details. Provider Registry reads this.
 */
module.exports = {
  default: 'ollama',
  ollama: {
    ports: [3717, 11434],          // Try preferred port first, then fallback
    baseUrl: null,                  // Resolved at runtime by ProviderRegistry
    models: ['phi3:mini', 'llama3.2:3b'],
    defaultModel: 'phi3:mini',
    generateTimeoutMs: 120_000,
    streamTimeoutMs: 600_000,
    temperature: 0.7,
    numPredict: 1024,
  },
};
