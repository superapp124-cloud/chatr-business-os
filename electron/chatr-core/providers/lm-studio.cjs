'use strict';

const log = (() => { try { return require('electron-log'); } catch { return console; } })();

/**
 * CHATR Kernel — LM Studio Provider
 * 
 * Integrates with the local LM Studio REST API (usually on port 1234).
 */
class LmStudioProvider {
  constructor() {
    this.name = 'LmStudioProvider';
    this.baseUrl = 'http://localhost:1234/v1';
  }

  async summarize(context) {
    const { text, modelId } = context;
    if (!text) throw new Error('[LM Studio] Missing text to summarize');

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId || 'local-model',
          messages: [
            { role: 'system', content: 'You are an expert summarizer. Be concise.' },
            { role: 'user', content: `Summarize this text: \n\n${text}` }
          ],
          temperature: 0.3
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const json = await response.json();
      return { summary: json.choices[0].message.content };
    } catch (err) {
      log.error('[LM Studio] Summarize failed:', err.message);
      throw err;
    }
  }
}

module.exports = { LmStudioProvider };
