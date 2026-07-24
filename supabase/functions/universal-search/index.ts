import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createEdgeFunction, jsonResponse } from "../_core/functionWrapper.ts";
import { z, validateJson } from "../_core/validate.ts";

const searchSchema = z.object({
  query: z.string().min(1).max(300),
  sessionId: z.string().min(1).max(160),
  userId: z.string().uuid().nullable().optional(),
  gpsLat: z.number().min(-90).max(90).nullable().optional(),
  gpsLon: z.number().min(-180).max(180).nullable().optional(),
});

type SearchResult = {
  title: string;
  snippet: string;
  url: string;
  displayUrl: string;
  faviconUrl: string;
  image: string | null;
  source: string;
  detectedType: string;
  score: number;
  rank: number;
};

type RelatedTopic = {
  FirstURL?: string;
  Text?: string;
  Icon?: { URL?: string };
};

type DuckDuckGoApiResponse = {
  AbstractText?: string;
  AbstractURL?: string;
  Heading?: string;
  Image?: string;
  RelatedTopics?: RelatedTopic[];
};

serve(createEdgeFunction({
  name: "universal-search",
  classification: ["PUBLIC_SAFE", "HIGH_VALUE"],
  methods: ["POST"],
  auth: "optional",
  rateLimit: {
    limit: 60,
    windowMs: 60_000,
    key: (req, auth) => `universal-search:${auth.user?.id ?? req.headers.get("x-forwarded-for") ?? "anonymous"}`,
  },
  audit: { eventType: "universal_search_requested" },
}, async ({ req, auth, correlationId }) => {
  const startTime = Date.now();
  const { query, sessionId, gpsLat, gpsLon } = await validateJson(req, searchSchema);

  const effectiveLat = gpsLat || null;
  const effectiveLon = gpsLon || null;
  const effectiveCity = "India";

  let searchQuery = query;
  const localKeywords = ["near me", "nearby", "local"];
  const isLocalQuery = localKeywords.some((keyword) => query.toLowerCase().includes(keyword));

  if (isLocalQuery && effectiveLat && effectiveLon) {
    searchQuery = `${query} India`;
  }

  const results = await fastDuckDuckGo(searchQuery, query, effectiveLat, effectiveLon);
  const searchTime = Date.now() - startTime;

  const quickImages = results
    .filter((result) => result.image && !result.image.includes("favicon") && !result.image.includes("icon"))
    .slice(0, 4)
    .map((result) => ({
      url: result.image,
      thumbnail: result.image,
      source: result.displayUrl,
      title: result.title,
    }));

  const loggedUserId = auth.user?.id ?? null;
  logSearchInBackground(auth.serviceClient, loggedUserId, sessionId, query, gpsLat ?? undefined, gpsLon ?? undefined)
    .catch((error) => console.error("[universal-search] Background log failed:", error));

  return jsonResponse(req, {
    searchId: null,
    query,
    aiAnswer: { text: null, sources: [], images: quickImages },
    aiAnswerError: null,
    aiAnswerStatus: null,
    fetchAiSeparately: true,
    searchEngine: "duckduckgo",
    location: {
      gpsLat,
      gpsLon,
      ipLat: null,
      ipLon: null,
      ipCity: null,
      ipCountry: "IN",
      lastLat: null,
      lastLon: null,
      effectiveLat,
      effectiveLon,
      effectiveCity,
    },
    results,
    timing: { searchMs: searchTime },
    correlationId,
  }, 200, correlationId);
}));

async function fastDuckDuckGo(searchQuery: string, originalQuery: string, lat?: number | null, lon?: number | null): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  void lat;
  void lon;

  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

    const response = await fetch(ddgUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) throw new Error("DDG failed");

    const html = await response.text();
    const linkPattern = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetPattern = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

    const links = [...html.matchAll(linkPattern)];
    const snippets = [...html.matchAll(snippetPattern)];

    for (let i = 0; i < Math.min(links.length, 10); i++) {
      const linkMatch = links[i];
      const snippetMatch = snippets[i];
      if (!linkMatch) continue;

      let url = linkMatch[1];
      const title = decode(linkMatch[2].replace(/<[^>]*>/g, ""));
      const snippet = snippetMatch ? decode(snippetMatch[1].replace(/<[^>]*>/g, "")) : "";

      if (url.includes("uddg=")) {
        const urlMatch = url.match(/uddg=([^&]*)/);
        if (urlMatch) url = decodeURIComponent(urlMatch[1]);
      }

      if (!url.startsWith("http")) continue;

      try {
        const domain = new URL(url).hostname;
        const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        results.push({
          title,
          snippet,
          url,
          displayUrl: domain,
          faviconUrl: favicon,
          image: favicon,
          source: "duckduckgo",
          detectedType: classify(originalQuery, title, snippet, url),
          score: 100 - i * 5,
          rank: i + 1,
        });
      } catch {
        // Ignore malformed result URLs.
      }
    }

    if (results.length === 0) {
      const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_redirect=1`;
      const apiResp = await fetch(apiUrl, { signal: AbortSignal.timeout(2000) });

      if (apiResp.ok) {
        const data = await apiResp.json() as DuckDuckGoApiResponse;
        if (data.AbstractText && data.AbstractURL) {
          const domain = new URL(data.AbstractURL).hostname;
          results.push({
            title: data.Heading || searchQuery,
            snippet: data.AbstractText,
            url: data.AbstractURL,
            displayUrl: domain,
            faviconUrl: data.Image || `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
            image: data.Image || null,
            source: "duckduckgo",
            detectedType: "generic_web",
            score: 95,
            rank: 1,
          });
        }

        for (let i = 0; i < Math.min(data.RelatedTopics?.length || 0, 8); i++) {
          const topic = data.RelatedTopics?.[i];
          if (!topic?.FirstURL || !topic.Text) continue;
          try {
            const domain = new URL(topic.FirstURL).hostname;
            results.push({
              title: topic.Text.split(" - ")[0].substring(0, 60),
              snippet: topic.Text,
              url: topic.FirstURL,
              displayUrl: domain,
              faviconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
              image: topic.Icon?.URL || null,
              source: "duckduckgo",
              detectedType: "generic_web",
              score: 90 - i * 5,
              rank: results.length + 1,
            });
          } catch {
            // Ignore malformed fallback URLs.
          }
        }
      }
    }

    return results;
  } catch (error) {
    console.error("[universal-search] DDG error:", error);
    return results;
  }
}

function decode(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function classify(query: string, title: string, snippet: string, url: string): string {
  const combined = `${query} ${title} ${snippet} ${url}`.toLowerCase();
  if (combined.includes("shop") || combined.includes("buy") || combined.includes("amazon") || combined.includes("flipkart")) return "ecommerce";
  if (combined.includes("restaurant") || combined.includes("food") || combined.includes("zomato")) return "restaurant";
  if (combined.includes("hotel") || combined.includes("travel") || combined.includes("booking")) return "travel";
  if (combined.includes("doctor") || combined.includes("hospital") || combined.includes("clinic")) return "healthcare";
  if (combined.includes("job") || combined.includes("career") || combined.includes("hiring")) return "job";
  if (combined.includes("learn") || combined.includes("course") || combined.includes("education")) return "education";
  return "generic_web";
}

async function logSearchInBackground(
  supabase: { from: (table: string) => { insert: (payload: Record<string, unknown>) => Promise<unknown> } },
  userId: string | null,
  sessionId: string,
  query: string,
  gpsLat?: number,
  gpsLon?: number,
) {
  await supabase.from("search_logs").insert({
    user_id: userId,
    session_id: sessionId,
    query,
    source: "web",
    engine: "duckduckgo",
    gps_lat: gpsLat || null,
    gps_lon: gpsLon || null,
  });
}
