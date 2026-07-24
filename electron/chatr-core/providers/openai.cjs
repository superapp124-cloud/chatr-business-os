'use strict';

const log = (() => { try { return require('electron-log'); } catch { return console; } })();

/**
 * CHATR Kernel — OpenAI Provider
 * 
 * Cloud provider for Intelligence tasks.
 * ONLY executes if the PolicyEngine explicitly grants permission for Cloud egress.
 */
class OpenAIProvider {
  constructor() {
    this.name = 'OpenAIProvider';
    // In production, this token would be fetched from the IdentityRuntime securely.
    this.apiKey = process.env.OPENAI_API_KEY || '';
  }

  async summarize(context) {
    const { text, modelId } = context;
    if (!text) throw new Error('[OpenAI] Missing text to summarize');
    if (!this.apiKey) throw new Error('[OpenAI] Missing API Key. Check IdentityRuntime.');

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: modelId || 'gpt-4o-mini',
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
      log.error('[OpenAI] Summarize failed:', err.message);
      throw err;
    }
  }
}

module.exports = { OpenAIProvider };
