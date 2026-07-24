'use strict';

const log = (() => { try { return require('electron-log'); } catch { return console; } })();

/**
 * CHATR Kernel — llama.cpp Provider
 * 
 * Integrates with the local llama.cpp server API (usually port 8080).
 */
class LlamaCppProvider {
  constructor() {
    this.name = 'LlamaCppProvider';
    this.baseUrl = 'http://localhost:8080';
  }

  async summarize(context) {
    const { text, modelId } = context;
    if (!text) throw new Error('[llama.cpp] Missing text to summarize');

    try {
      const response = await fetch(`${this.baseUrl}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `[INST] You are an expert summarizer. Be concise.\n\nSummarize this text: \n\n${text} [/INST]`,
          temperature: 0.3,
          n_predict: 500
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const json = await response.json();
      return { summary: json.content.trim() };
    } catch (err) {
      log.error('[llama.cpp] Summarize failed:', err.message);
      throw err;
    }
  }
}

module.exports = { LlamaCppProvider };
