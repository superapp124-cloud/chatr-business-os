export type SearchMode = "web" | "news" | "code" | "research" | "bharat";

export interface SearchIntent {
  intent: string;
  vertical: string;
  searchQuery: string;
  preferredSources: string[];
  searchProvider?: string;
  searchCache?: "memory";
}

export interface GroundedSource {
  index: number;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  source: string;
  fetchedAt: string;
  freshness?: string;
  trustTier: string;
  trustLabel: string;
  trustScore: number;
  rankScore?: number;
}

export interface Citation {
  index: number;
  title: string;
  url: string;
  domain: string;
  trust: string;
  trustScore: number;
  snippet: string;
}

export interface AnswerConfidence {
  level: "low" | "medium" | "high";
  score: number;
  label: string;
}

export interface SearchAnswer {
  answer: string;
  citations: Citation[];
  relatedQuestions: string[];
  sources: GroundedSource[];
  confidence: AnswerConfidence;
  providerUsed: string;
  latency: number;
  latencyMs: number;
  intent: SearchIntent;
  cached: boolean;
}

export type SearchSseEvent =
  | { type: "step"; message: string }
  | { type: "sources"; cards: GroundedSource[]; fallback?: string | null; intent: SearchIntent }
  | { type: "meta"; citations: Citation[]; relatedQuestions: string[]; confidence: AnswerConfidence; providerUsed?: string }
  | { type: "token"; text: string; provider: string; cached?: boolean }
  | { type: "status"; status: string; provider?: string; latencyMs?: number }
  | { type: "error"; message: string };
