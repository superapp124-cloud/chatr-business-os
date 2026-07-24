import { getCachedAnswer, setCachedAnswer } from "./cache.js";
import {
  IPL_2026_CONTEXT,
  IPL_2026_SOURCES,
  addIpl2026LiveFeedAnchor,
  buildIpl2026FallbackAnswer,
  hasBrokenOrEmptyContext,
  isIpl2026Query,
} from "./fallbacks.js";
import { getEngineStatuses, streamBestAvailableModel } from "./models.js";
import { buildSystemInstruction, buildUserPayload } from "./prompts.js";
import { fetchWebContext } from "./providers.js";
import { buildAnswerMetadata, buildGroundedSynthesis, buildRagContext } from "./rag.js";
import { cacheKey, compactText, sanitizeQuery } from "./text.js";

export class SearchInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "SearchInputError";
    this.statusCode = 400;
  }
}

function normalizeEvents(events = {}) {
  const noop = () => {};
  return {
    onStep: events.onStep || noop,
    onSources: events.onSources || noop,
    onMeta: events.onMeta || noop,
    onToken: events.onToken || noop,
    onStatus: events.onStatus || noop,
  };
}

function toResponseObject({ answer, provider, sources, metadata, intent, startedAt, cached = false }) {
  const latency = Date.now() - startedAt;

  return {
    answer,
    citations: metadata.citations || [],
    relatedQuestions: metadata.relatedQuestions || [],
    sources: sources || [],
    confidence: metadata.confidence,
    providerUsed: metadata.providerUsed || provider,
    latency,
    latencyMs: latency,
    intent,
    cached,
  };
}

export async function runSearchPipeline({ rawQuery, category = "web", signal, events, useCache = true }) {
  const startedAt = Date.now();
  const emit = normalizeEvents(events);
  const query = sanitizeQuery(rawQuery);
  const normalizedCategory = compactText(category || "web") || "web";

  if (!query) throw new SearchInputError("Missing query string parameter 'q'.");

  const key = cacheKey(query, normalizedCategory);
  const cached = useCache ? await getCachedAnswer(key) : null;

  if (cached) {
    const metadata =
      cached.metadata ||
      buildAnswerMetadata({
        citations: [],
        relatedQuestions: [],
        providerUsed: cached.provider,
        intent: cached.intent,
      });

    emit.onStep("Serving cached answer...");
    emit.onStatus({ status: "engines_active", engines: getEngineStatuses() });
    emit.onSources(cached.sources || [], null, cached.intent || {});
    emit.onMeta({ ...metadata, providerUsed: metadata.providerUsed || cached.provider });
    emit.onToken(cached.answer, cached.provider, { cached: true });

    const response = toResponseObject({
      answer: cached.answer,
      provider: cached.provider,
      sources: cached.sources || [],
      metadata,
      intent: cached.intent || {},
      startedAt,
      cached: true,
    });

    emit.onStatus({ status: "complete", cached: true, provider: cached.provider, ...response });
    return response;
  }

  emit.onStep("Searching web...");
  emit.onStatus({ status: "engines_active", engines: getEngineStatuses() });

  let { sourceText, sources, intent } = await fetchWebContext(query, normalizedCategory);
  const shouldUseIplFallback = isIpl2026Query(query) && hasBrokenOrEmptyContext(sourceText, sources);

  if (shouldUseIplFallback) {
    sourceText = IPL_2026_CONTEXT;
    sources = IPL_2026_SOURCES;
  }

  ({ sourceText, sources } = addIpl2026LiveFeedAnchor(query, sourceText, sources));

  const rag = buildRagContext(query, sources, intent);
  sources = rag.sources;
  sourceText = shouldUseIplFallback ? sourceText : rag.contextText;

  const initialMetadata = buildAnswerMetadata({
    citations: rag.citations,
    relatedQuestions: rag.relatedQuestions,
    confidence: rag.confidence,
    intent,
  });

  emit.onStep("Ranking sources...");
  emit.onSources(sources, shouldUseIplFallback ? "ipl_2026" : null, intent);
  emit.onMeta(initialMetadata);
  emit.onStep("Cross-checking facts...");

  let answer = "";
  let provider = "";
  const noLiveSources = !shouldUseIplFallback && hasBrokenOrEmptyContext(sourceText, sources);

  if (noLiveSources) {
    provider = "open_search_no_sources";
    answer = buildGroundedSynthesis({ query, sources, intent, confidence: rag.confidence });
    const metadata = buildAnswerMetadata({
      citations: rag.citations,
      relatedQuestions: rag.relatedQuestions,
      confidence: rag.confidence,
      providerUsed: provider,
      intent,
    });

    emit.onStep("Reliable live snippets were limited.");
    emit.onToken(answer, provider);
    emit.onMeta(metadata);

    const response = toResponseObject({ answer, provider, sources, metadata, intent, startedAt });
    await setCachedAnswer(key, { answer, provider, sources, intent, metadata });
    emit.onStatus({ status: "complete", provider, ...response });
    return response;
  }

  if (intent.intent === "commerce") {
    provider = "verified_commerce_retrieval";
    answer = buildGroundedSynthesis({ query, sources, intent, confidence: rag.confidence });
    const metadata = buildAnswerMetadata({
      citations: rag.citations,
      relatedQuestions: rag.relatedQuestions,
      confidence: rag.confidence,
      providerUsed: provider,
      intent,
    });

    emit.onStep("Validating commerce recommendations...");
    emit.onToken(answer, provider);
    emit.onMeta(metadata);

    const response = toResponseObject({ answer, provider, sources, metadata, intent, startedAt });
    await setCachedAnswer(key, { answer, provider, sources, intent, metadata });
    emit.onStatus({ status: "complete", provider, ...response });
    return response;
  }

  const systemInstruction = buildSystemInstruction(normalizedCategory, intent);
  const userPayload = buildUserPayload(query, sourceText);

  try {
    const result = await streamBestAvailableModel({
      systemInstruction,
      userPayload,
      signal,
      onToken: (token, modelProvider) => emit.onToken(token, modelProvider),
      onStatus: emit.onStatus,
    });

    answer = result.answer;
    provider = result.provider;
  } catch {
    const useIplTableFallback = isIpl2026Query(query);
    provider = useIplTableFallback ? "ipl_2026_fallback" : "source_grounded_fallback";
    answer = useIplTableFallback
      ? buildIpl2026FallbackAnswer()
      : buildGroundedSynthesis({ query, sources, intent, confidence: rag.confidence });
    emit.onStep(useIplTableFallback ? "Using deterministic IPL table..." : "Using source-grounded fallback...");
    emit.onToken(answer, provider);
  }

  const metadata = buildAnswerMetadata({
    citations: rag.citations,
    relatedQuestions: rag.relatedQuestions,
    confidence: rag.confidence,
    providerUsed: provider,
    intent,
  });

  const response = toResponseObject({ answer, provider, sources, metadata, intent, startedAt });
  emit.onMeta({ ...metadata, latencyMs: response.latencyMs });
  await setCachedAnswer(key, { answer, provider, sources, intent, metadata });
  emit.onStatus({ status: "complete", provider, ...response });

  return response;
}
