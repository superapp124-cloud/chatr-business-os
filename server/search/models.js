import { GoogleGenAI } from "@google/genai";
import { config } from "./config.js";

const aiStudioClient = config.allowApiModels && config.geminiApiKey ? new GoogleGenAI({ apiKey: config.geminiApiKey }) : null;

function sanitizeProviderError(error) {
  const message = String(error?.message || error || "");
  if (/quota|rate|429|resource_exhausted|too many requests/i.test(message)) return "rate_limited";
  if (/api key|not configured|unauthorized|401|403/i.test(message)) return "unavailable";
  if (/timed out|timeout/i.test(message)) return "timeout";
  if (/econnrefused|fetch failed|connection/i.test(message)) return "local_unavailable";
  if (/abort/i.test(message)) return "cancelled";
  return "provider_error";
}

export function getEngineStatuses() {
  const localEngines = [
    {
      provider: "ollama",
      label: "Ollama Local",
      model: config.ollamaModel,
      status: config.ollamaEnabled ? "ready" : "optional",
    },
    {
      provider: "extractive",
      label: "Grounded Extractive",
      model: "source-only fallback",
      status: "ready",
    },
  ];

  if (!config.allowApiModels) return localEngines;

  return [
    ...localEngines,
    {
      provider: "gemini",
      label: "Gemini Flash",
      model: config.geminiModel,
      status: aiStudioClient ? "ready" : "missing_key",
    },
    {
      provider: "groq",
      label: "Groq Llama",
      model: config.groqModel,
      status: config.groqApiKey ? "ready" : "missing_key",
    },
    {
      provider: "together",
      label: "Together Llama",
      model: config.togetherModel,
      status: config.togetherApiKey ? "ready" : "optional",
    },
  ];
}

function createAbortPromise(signal) {
  if (!signal) return null;
  if (signal.aborted) return Promise.reject(new Error("request aborted"));

  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new Error("request aborted")), { once: true });
  });
}

async function streamGemini({ systemInstruction, userPayload, onToken, signal }) {
  if (!aiStudioClient) throw new Error("GEMINI_API_KEY is not configured.");

  const stream = await aiStudioClient.models.generateContentStream({
    model: config.geminiModel,
    contents: userPayload,
    config: {
      systemInstruction,
      temperature: 0.15,
      maxOutputTokens: 900,
    },
  });

  let answer = "";
  for await (const chunk of stream) {
    if (signal?.aborted) break;
    const token = chunk.text || "";
    if (!token) continue;
    answer += token;
    onToken(token, "gemini");
  }
  return answer;
}

async function streamOllama({ systemInstruction, userPayload, onToken, signal }) {
  if (!config.ollamaEnabled) throw new Error("Ollama is disabled.");

  const response = await fetch(`${config.ollamaBaseUrl.replace(/\/+$/, "")}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.ollamaModel,
      stream: true,
      prompt: `${systemInstruction}\n\n${userPayload}`,
      options: {
        temperature: 0.15,
        num_predict: 900,
      },
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Ollama stream error status: ${response.status}`);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

  for await (const chunk of response.body) {
    if (signal?.aborted) break;
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      try {
        const parsed = JSON.parse(line);
        const token = parsed.message?.content || parsed.response || "";
        if (!token) continue;
        answer += token;
        onToken(token, "ollama");
      } catch {
        // Ignore partial provider events.
      }
    }
  }

  return answer;
}

async function streamOpenAICompatible({ endpoint, apiKey, model, systemInstruction, userPayload, provider, onToken, signal }) {
  if (!apiKey) throw new Error(`${provider} API key is not configured.`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.15,
      max_tokens: 900,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPayload },
      ],
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`${provider} stream error status: ${response.status}`);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

  for await (const chunk of response.body) {
    if (signal?.aborted) break;
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const parsed = JSON.parse(payload);
        const token = parsed.choices?.[0]?.delta?.content || "";
        if (!token) continue;
        answer += token;
        onToken(token, provider);
      } catch {
        // Ignore partial or non-token provider events.
      }
    }
  }

  return answer;
}

export async function streamBestAvailableModel({ systemInstruction, userPayload, onToken, onStatus, signal }) {
  const localProviders = [
    {
      name: "ollama",
      isConfigured: Boolean(config.ollamaEnabled),
      run: (tokenHandler = onToken) => streamOllama({ systemInstruction, userPayload, onToken: tokenHandler, signal }),
    },
  ];

  const apiProviders = config.allowApiModels
    ? [
    {
      name: "gemini",
      isConfigured: Boolean(aiStudioClient),
      run: (tokenHandler = onToken) => streamGemini({ systemInstruction, userPayload, onToken: tokenHandler, signal }),
    },
    {
      name: "groq",
      isConfigured: Boolean(config.groqApiKey),
      run: (tokenHandler = onToken) =>
        streamOpenAICompatible({
          endpoint: "https://api.groq.com/openai/v1/chat/completions",
          apiKey: config.groqApiKey,
          model: config.groqModel,
          systemInstruction,
          userPayload,
          provider: "groq",
          onToken: tokenHandler,
          signal,
        }),
    },
    {
      name: "together",
      isConfigured: Boolean(config.togetherApiKey),
      run: (tokenHandler = onToken) =>
        streamOpenAICompatible({
          endpoint: "https://api.together.xyz/v1/chat/completions",
          apiKey: config.togetherApiKey,
          model: config.togetherModel,
          systemInstruction,
          userPayload,
          provider: "together",
          onToken: tokenHandler,
          signal,
        }),
    },
      ]
    : [];

  const providers = [...localProviders, ...apiProviders];

  providers.sort((a, b) => (a.name === config.primaryModelProvider ? -1 : b.name === config.primaryModelProvider ? 1 : 0));
  const configuredProviders = providers.filter((provider) => provider.isConfigured);

  const runTimed = async (provider, tokenHandler = onToken) => {
    const startedAt = Date.now();
    let active = true;
    let timeoutId;

    const guardedTokenHandler = (token, modelProvider) => {
      if (!active || signal?.aborted) return;
      tokenHandler(token, modelProvider || provider.name);
    };

    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${provider.name} timed out`)), config.modelTimeoutMs);
      });
      const abortPromise = createAbortPromise(signal);
      const racers = [provider.run(guardedTokenHandler), timeoutPromise];
      if (abortPromise) racers.push(abortPromise);

      const answer = await Promise.race(racers);
      onStatus({ status: "provider_complete", provider: provider.name, latencyMs: Date.now() - startedAt });
      return answer;
    } catch (error) {
      console.warn(`${provider.name} model provider failed:`, error.message);
      onStatus({
        status: "provider_error",
        provider: provider.name,
        latencyMs: Date.now() - startedAt,
        reason: sanitizeProviderError(error),
      });
      throw error;
    } finally {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  if (config.streamMode === "parallel" && configuredProviders.length > 1) {
    const [primary, ...secondaryProviders] = configuredProviders;
    onStatus({
      status: "model_stream_start",
      provider: primary.name,
      parallelProviders: configuredProviders.map((provider) => provider.name),
    });

    const secondaryStreams = secondaryProviders.map((provider) =>
      runTimed(provider, (token) => onStatus({ modelToken: token, provider: provider.name }))
        .then((answer) => ({ answer, provider: provider.name }))
        .catch((error) => ({ error, provider: provider.name })),
    );

    try {
      const answer = await runTimed(primary, onToken);
      const secondaryResults = await Promise.allSettled(secondaryStreams);
      onStatus({
        status: "consensus_complete",
        primaryProvider: primary.name,
        secondaryProviders: secondaryResults
          .map((result) => (result.status === "fulfilled" && !result.value.error ? result.value.provider : null))
          .filter(Boolean),
      });
      if (answer.trim()) return { answer, provider: primary.name };
    } catch (error) {
      onStatus({ status: "provider_fallback", provider: primary.name, reason: sanitizeProviderError(error) });
      const secondaryResults = await Promise.allSettled(secondaryStreams);
      const recovered = secondaryResults
        .map((result) => (result.status === "fulfilled" && !result.value.error ? result.value : null))
        .find((result) => result?.answer?.trim());

      if (recovered) {
        onToken(recovered.answer, recovered.provider);
        return { answer: recovered.answer, provider: recovered.provider };
      }
    }
  }

  const errors = [];
  for (const provider of providers) {
    try {
      onStatus({ status: "model_stream_start", provider: provider.name });
      const answer = await runTimed(provider);
      if (answer.trim()) return { answer, provider: provider.name };
    } catch (error) {
      errors.push(`${provider.name}:${sanitizeProviderError(error)}`);
      onStatus({ status: "provider_fallback", provider: provider.name, reason: sanitizeProviderError(error) });
    }
  }

  throw new Error(`model_providers_unavailable:${errors.join("|")}`);
}
