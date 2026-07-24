# CHATR AI Search Backend Architecture

CHATR AI Search is implemented as a grounded, streaming RAG orchestration service. The browser client talks to `GET /api/search/agent?q=...` over Server-Sent Events. Non-streaming consumers can use `GET /api/search/answer?q=...` for the same pipeline returned as JSON.

## Runtime Flow

1. **Query sanitization**
   - Collapses repeated phrase loops.
   - Rejects empty queries before invoking providers.

2. **Intent classification**
   - Maps requests into web, news, code, research, commerce, sports, or Bharat-native flows.
   - Expands search terms with official/source hints where useful.

3. **Search retrieval**
   - Defaults to a free-only path: self-hosted SearXNG first, DuckDuckGo HTML fallback.
   - Brave is opt-in only and is disabled whenever `SEARCH_FREE_ONLY=true`.
   - Extracts title, URL, domain, snippet, provider, fetched timestamp, and trust score.

4. **RAG processing**
   - Deduplicates sources by canonical URL.
   - Scores sources by trust, query overlap, and intent-specific boosts.
   - Chunks and compresses snippets into a context payload.
   - Emits citations, confidence, and related questions before model streaming starts.

5. **Free/local synthesis**
   - Defaults to Ollama on `localhost:11434`.
   - Falls back to deterministic source-grounded extractive synthesis when Ollama is not running.
   - Hosted API models are disabled unless `SEARCH_FREE_ONLY=false` and `SEARCH_ALLOW_API_MODELS=true`.
   - Applies model timeouts and graceful fallback.
   - Never exposes quota/API-key/provider internals to users.

6. **Streaming delivery**
   - Emits `step`, `sources`, `meta`, `token`, `status`, and `error` events.
   - Final status includes the same answer metadata as the JSON route.

## Module Map

- `server.js`: Express bootstrap and health route.
- `server/search/routes.js`: HTTP/SSE route adapters.
- `server/search/orchestrator.js`: Main query-to-answer pipeline.
- `server/search/providers.js`: Search provider router and source extraction.
- `server/search/rag.js`: Deduplication, ranking, chunking, citations, confidence, follow-ups.
- `server/search/models.js`: Ollama/free-local provider router with optional hosted providers behind an explicit flag.
- `server/search/prompts.js`: Grounded prompt construction.
- `server/search/cache.js`: Memory + Redis-compatible answer cache.
- `server/search/trust.js`: Source trust scoring.
- `server/search/intent.js`: Query intent detection and mode routing.
- `server/search/types.d.ts`: API contract and event types.

## Security

- Keep all provider keys server-side only.
- Use `CLIENT_ORIGIN` in production instead of wildcard CORS.
- Do not stream raw provider errors to clients.
- Treat snippets as untrusted content on the frontend; render markdown without allowing raw HTML.
- Add request-level rate limits before public launch.

## Scaling

- Use Redis/Upstash for answer cache in production.
- Keep search-result TTL short because freshness matters.
- Run SearXNG close to the backend for low-latency free retrieval.
- Add provider health metrics from `provider_complete`, `provider_error`, and `provider_fallback` events.
- For high volume, split retrieval and synthesis into separate services behind a queue.

## Free-Only Policy

The default configuration is intentionally not credit-metered:

```bash
SEARCH_FREE_ONLY=true
SEARCH_PROVIDER=free
SEARXNG_URL=http://localhost:8888
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

This means CHATR will not call Brave, Gemini, Groq, Together, OpenAI, Claude, Perplexity, or any other hosted paid/limited API by default. For unlimited usage in practice, run SearXNG and Ollama on infrastructure you control. Public search pages can throttle any scraper, so self-hosted SearXNG plus local models is the durable path.
