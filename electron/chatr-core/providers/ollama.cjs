'use strict';

/**
 * CHATR Kernel — OllamaProvider
 *
 * Implements the AIProvider interface against the local Ollama HTTP API.
 * Discovers the active Ollama port automatically (3717 → 11434 fallback).
 *
 * Genesis v1.0
 */

const providerConfig = require('../config/provider.config.cjs');

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

class OllamaProvider {
  constructor() {
    this._baseUrl = null;    // Resolved lazily on first use
    this._cancelController = null;
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  async _resolveBaseUrl() {
    if (this._baseUrl) return this._baseUrl;

    for (const port of providerConfig.ollama.ports) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/tags`, {
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          this._baseUrl = `http://127.0.0.1:${port}`;
          log.info(`[OllamaProvider] Resolved on port ${port}`);
          return this._baseUrl;
        }
      } catch { /* try next port */ }
    }
    throw new Error('[OllamaProvider] Ollama is not reachable on any configured port.');
  }

  // AI Runtime Model Selection is now handled externally.
  // The Provider is purely an execution driver.
  async _bestModel() {
    return providerConfig.ollama.defaultModel;
  }

  _buildMessages(messages) {
    // messages = [{ role: 'system'|'user'|'assistant', content: string }]
    return messages;
  }

  // ── AIProvider Interface ────────────────────────────────────────────────────

  async generate(messages, opts = {}) {
    const base  = await this._resolveBaseUrl();
    const model = opts.model || await this._bestModel();
    const startMs = Date.now();

    const controller = new AbortController();
    this._cancelController = controller;
    const timeout = setTimeout(() => controller.abort(), providerConfig.ollama.generateTimeoutMs);

    try {
      const res = await fetch(`${base}/api/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: opts.model || await this._bestModel(),
          prompt: this._buildMessages(messages).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n'),
          stream: opts.stream || false,
          options: {
            temperature:  opts.temperature  ?? providerConfig.ollama.temperature,
            num_predict:  opts.numPredict   ?? providerConfig.ollama.numPredict,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 404) {
          fetch(`${base}/api/pull`, { method: 'POST', body: JSON.stringify({ name: model }) }).catch(() => {});
          throw new Error(`Model '${model}' not found locally. Downloading in background...`);
        }
        throw new Error(`Ollama /api/generate error: ${res.status}`);
      }
      const data = await res.json();
      const text = data.response ?? data.message?.content ?? '';
      log.info(`[OllamaProvider] generate() completed in ${Date.now() - startMs}ms`);
      return text;
    } finally {
      clearTimeout(timeout);
      this._cancelController = null;
    }
  }

  async stream(messages, opts = {}, onToken) {
    const base  = await this._resolveBaseUrl();
    const model = opts.model || await this._bestModel();

    const controller = new AbortController();
    this._cancelController = controller;
    const timeout = setTimeout(() => controller.abort(), providerConfig.ollama.streamTimeoutMs);

    try {
      const res = await fetch(`${base}/api/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: this._buildMessages(messages).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n'),
          stream: true,
          options: {
            temperature: opts.temperature ?? providerConfig.ollama.temperature,
            num_predict: opts.numPredict  ?? providerConfig.ollama.numPredict,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 404) {
          fetch(`${base}/api/pull`, { method: 'POST', body: JSON.stringify({ name: model }) }).catch(() => {});
          throw new Error(`Model '${model}' not found locally. Downloading in background...`);
        }
        throw new Error(`Ollama /api/generate stream error: ${res.status}`);
      }
      if (!res.body) throw new Error('Ollama response has no body');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const chunk = JSON.parse(trimmed);
            if (chunk.response) {
              onToken(chunk.response);
            } else if (chunk.message?.content) {
              onToken(chunk.message.content);
            }
            if (chunk.done) return;
          } catch { /* malformed chunk — skip */ }
        }
      }
    } finally {
      clearTimeout(timeout);
      this._cancelController = null;
    }
  }

  cancel() {
    if (this._cancelController) {
      this._cancelController.abort();
      this._cancelController = null;
      log.info('[OllamaProvider] Request cancelled.');
    }
  }

  async health() {
    const startMs = Date.now();
    try {
      const base = await this._resolveBaseUrl();
      const res  = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data   = await res.json();
      const models = (data.models || []).map(m => m.name);
      return {
        ok: true,
        provider: 'ollama',
        readyModels: models,
        latencyMs: Date.now() - startMs,
        error: null,
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'ollama',
        readyModels: [],
        latencyMs: Date.now() - startMs,
        error: err.message,
      };
    }
  }

  async listModels() {
    try {
      const base = await this._resolveBaseUrl();
      const res  = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map(m => ({ name: m.name, size: m.size }));
    } catch {
      return [];
    }
  }

  async pullModel(modelName) {
    const base = await this._resolveBaseUrl();
    const res  = await fetch(`${base}/api/pull`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: false }),
      signal: AbortSignal.timeout(30 * 60 * 1000),
    });
    if (!res.ok) throw new Error(`Failed to pull model "${modelName}": ${res.status}`);
  }
}

module.exports = { OllamaProvider };
