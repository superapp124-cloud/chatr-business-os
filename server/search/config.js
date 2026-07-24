import dotenv from "dotenv";
import { compactText } from "./text.js";

dotenv.config();

function getCurrentDateLabel() {
  if (process.env.CHATR_CURRENT_DATE) return process.env.CHATR_CURRENT_DATE;

  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

const configuredSearxngUrl = compactText(process.env.SEARXNG_URL || process.env.SEARXNG_BASE_URL || "");
const autoDetectSearxng = !/^false$/i.test(process.env.SEARCH_AUTODETECT_SEARXNG || "");
const freeOnly = !/^false$/i.test(process.env.SEARCH_FREE_ONLY || "true");
const allowApiModels = !freeOnly && /^true$/i.test(process.env.SEARCH_ALLOW_API_MODELS || "");
const requestedSearchProvider = compactText(process.env.SEARCH_PROVIDER || "free").toLowerCase();
const searchProvider = freeOnly && requestedSearchProvider === "brave" ? "free" : requestedSearchProvider;

export const config = {
  port: Number(process.env.SEARCH_SERVER_PORT || process.env.PORT || 8787),
  clientOrigin: process.env.CLIENT_ORIGIN || "*",
  cacheTtlMs: Number(process.env.SEARCH_CACHE_TTL_MS || 5 * 60 * 1000),
  currentDate: getCurrentDateLabel(),
  freeOnly,
  allowApiModels,

  ollamaEnabled: !/^false$/i.test(process.env.OLLAMA_ENABLED || "true"),
  ollamaBaseUrl: compactText(process.env.OLLAMA_BASE_URL || "http://localhost:11434"),
  ollamaModel: compactText(process.env.OLLAMA_MODEL || "llama3.1:8b"),

  geminiApiKey: allowApiModels ? process.env.GEMINI_API_KEY || "" : "",
  groqApiKey: allowApiModels ? process.env.GROQ_API_KEY || "" : "",
  togetherApiKey: allowApiModels ? process.env.TOGETHER_API_KEY || "" : "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  groqModel: process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
  togetherModel: process.env.TOGETHER_MODEL || "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
  primaryModelProvider: compactText(process.env.SEARCH_PRIMARY_PROVIDER || (freeOnly ? "ollama" : "gemini")).toLowerCase(),
  streamMode: compactText(process.env.SEARCH_STREAM_MODE || "parallel").toLowerCase(),
  modelTimeoutMs: Math.max(2000, Number(process.env.SEARCH_MODEL_TIMEOUT_MS || 18000)),

  redisRestUrl: process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_URL || "",
  redisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_TOKEN || "",

  searchProvider,
  braveSearchApiKey: freeOnly ? "" : process.env.BRAVE_SEARCH_API_KEY || "",
  braveFallbackEnabled: !freeOnly && (searchProvider === "brave" || /^true$/i.test(process.env.SEARCH_BRAVE_FALLBACK || "")),
  searxngUrl: configuredSearxngUrl || (autoDetectSearxng ? "http://localhost:8888" : ""),
  searxngIsConfigured: Boolean(configuredSearxngUrl),
  freeSearchMaxResults: Math.max(1, Math.min(10, Number(process.env.FREE_SEARCH_MAX_RESULTS || 6))),
  searchCacheTtlMs: Number(process.env.SEARCH_RESULTS_CACHE_TTL_MS || 90 * 1000),
  searchFetchTimeoutMs: Math.max(1000, Number(process.env.SEARCH_FETCH_TIMEOUT_MS || 3500)),
  localSearchFetchTimeoutMs: Math.max(500, Number(process.env.SEARCH_LOCAL_FETCH_TIMEOUT_MS || 1000)),
  searchUserAgent:
    process.env.SEARCH_USER_AGENT ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};
