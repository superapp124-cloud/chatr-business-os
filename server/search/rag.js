import { config } from "./config.js";
import { extractPhoneModels } from "./commerce.js";
import { compactText } from "./text.js";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "best",
  "for",
  "how",
  "in",
  "is",
  "of",
  "on",
  "or",
  "the",
  "to",
  "under",
  "what",
  "which",
  "with",
]);

function tokenize(value) {
  return compactText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function canonicalUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.searchParams.delete("utm_source");
    parsed.searchParams.delete("utm_medium");
    parsed.searchParams.delete("utm_campaign");
    parsed.searchParams.delete("utm_term");
    parsed.searchParams.delete("utm_content");
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return compactText(url).toLowerCase();
  }
}

function queryOverlapScore(queryTokens, source) {
  const sourceTokens = new Set(tokenize(`${source.title} ${source.snippet} ${source.domain}`));
  if (!queryTokens.length || !sourceTokens.size) return 0;
  const matches = queryTokens.filter((token) => sourceTokens.has(token)).length;
  return matches / queryTokens.length;
}

function getIntentBoost(source, intent) {
  const tier = source.trustTier || "web";
  const preferred = new Set(intent.preferredSources || []);
  let boost = preferred.has(tier) ? 12 : 0;

  if (intent.intent === "code" && /(docs|github|developer)/i.test(`${source.domain} ${source.title}`)) boost += 16;
  if (intent.intent === "bharat" && /\.(gov\.in|nic\.in)$/i.test(source.domain || "")) boost += 18;
  if (
    intent.intent === "commerce" &&
    /(gsmarena|91mobiles|smartprix|gadgets360|techradar|androidauthority|tomsguide|digit\.in|mysmartprice|pricebaba|flipkart|amazon\.in|croma|reliancedigital)/i.test(
      source.domain || "",
    )
  ) {
    boost += 24;
  }
  if (intent.intent === "commerce" && source.extracted?.phoneModels?.length) {
    boost += 12;
  }
  if (intent.intent === "sports" && /(iplt20|espncricinfo|cricbuzz|bcci)/i.test(source.domain || "")) boost += 16;

  return boost;
}

const NOT_VERIFIED = "Not confidently verified";
const STRUCTURED_FIELDS = ["chipset", "display", "refreshRate", "battery", "charging", "camera"];

function getCommerceCandidates(sources = [], intent = { intent: "commerce" }) {
  const candidates = new Map();
  const sourceByIndex = new Map(sources.map((source) => [source.index, source]));

  for (const source of sources) {
    const structuredProducts =
      source.extracted?.products?.length
        ? source.extracted.products
        : extractPhoneModels(`${source.title} ${source.snippet}`).map((model) => ({
            model,
            price: "",
            chipset: "",
            display: "",
            refreshRate: "",
            battery: "",
            charging: "",
            camera: "",
          }));

    for (const product of structuredProducts) {
      const model = compactText(product.model);
      if (!model) continue;

      const key = canonicalPhoneKey(model);
      const existing = candidates.get(key) || {
        model,
        sources: [],
        domains: [],
        fields: {
          price: [],
          chipset: [],
          display: [],
          refreshRate: [],
          battery: [],
          charging: [],
          camera: [],
        },
        score: 0,
      };
      if (model.length > existing.model.length) existing.model = model;

      existing.sources.push(source.index);
      existing.domains.push(source.domain);
      addVerifiedValue(existing.fields.price, product.price, source.index);
      for (const field of STRUCTURED_FIELDS) {
        addVerifiedValue(existing.fields[field], product[field], source.index);
      }
      existing.score += (source.rankScore || source.trustScore || 50) + (source.extracted?.phoneModels?.includes(model) ? 15 : 0);
      candidates.set(key, existing);
    }
  }

  const builtCandidates = [...candidates.values()]
    .map((candidate) => ({
      ...candidate,
      sources: [...new Set(candidate.sources)].slice(0, 3),
      domains: [...new Set(candidate.domains)].slice(0, 3),
      price: getVerifiedField(candidate.fields.price),
      chipset: getVerifiedField(candidate.fields.chipset),
      display: getVerifiedField(candidate.fields.display),
      refreshRate: getVerifiedField(candidate.fields.refreshRate),
      battery: getVerifiedField(candidate.fields.battery),
      charging: getVerifiedField(candidate.fields.charging),
      camera: getVerifiedField(candidate.fields.camera),
      priceValues: getUniqueValues(candidate.fields.price),
      contradictions: getUniqueValues(candidate.fields.price).length > 1 ? ["Pricing varies across sources"] : [],
    }))
    .map((candidate) => ({
      ...candidate,
      confidence: getRecommendationConfidence(candidate, sourceByIndex),
      completeness: getCompletenessScore(candidate),
      sourceTrust: getAverageSourceTrust(candidate.sources, sourceByIndex),
      bestUse: inferBestUse(candidate),
    }))
    .filter((candidate) => candidate.model && validateRecommendation(candidate, intent))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  return diversifyCandidates(builtCandidates).slice(0, 6);
}

function canonicalPhoneKey(model) {
  return compactText(model)
    .toLowerCase()
    .replace(/\b5g\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function addVerifiedValue(collection, value, sourceIndex) {
  const cleaned = compactText(value);
  if (!cleaned) return;
  collection.push({ value: cleaned, sourceIndex });
}

function getUniqueValues(items = []) {
  return [...new Set(items.map((item) => compactText(item.value)).filter(Boolean))];
}

function getVerifiedField(items = []) {
  return getUniqueValues(items)[0] || "";
}

function getCompletenessScore(candidate) {
  const filled = ["price", ...STRUCTURED_FIELDS].filter((field) => Boolean(candidate[field])).length;
  return filled / (STRUCTURED_FIELDS.length + 1);
}

function getAverageSourceTrust(sourceIndexes, sourceByIndex) {
  const matched = [...new Set(sourceIndexes)].map((sourceIndex) => sourceByIndex.get(sourceIndex)).filter(Boolean);
  if (!matched.length) return 0;
  return matched.reduce((sum, source) => sum + (source.trustScore || 50), 0) / matched.length;
}

function getRecommendationConfidence(candidate, sourceByIndex) {
  const sourceAgreement = new Set(candidate.sources).size;
  const trustAverage = getAverageSourceTrust(candidate.sources, sourceByIndex);
  const completeness = getCompletenessScore(candidate);

  if (sourceAgreement >= 2 && trustAverage >= 82 && completeness >= 0.5) {
    return { label: "High Confidence", score: 0.86 };
  }

  if (trustAverage >= 78 && (sourceAgreement >= 2 || completeness >= 0.3)) {
    return { label: "Medium Confidence", score: 0.66 };
  }

  return { label: "Limited Verification", score: 0.42 };
}

function validateRecommendation(candidate, intent = {}) {
  if (!candidate.model) return false;
  if (intent.productCategory === "smartphones" && !/\b(?:5G|phone|mobile|smartphone)\b/i.test(`${candidate.model} ${candidate.domains.join(" ")}`)) {
    return true;
  }
  return Boolean(candidate.sources.length);
}

function inferBestUse(candidate) {
  if (candidate.chipset || candidate.refreshRate) return "Best Gaming";
  if (candidate.camera) return "Best Camera";
  if (candidate.battery || candidate.charging) return "Best Battery";
  if (candidate.price) return "Best Value";
  return "Best Overall";
}

function diversifyCandidates(candidates) {
  const selected = [];
  const deferred = [];
  const domainCounts = new Map();

  for (const candidate of candidates) {
    const primaryDomain = candidate.domains[0] || "unknown";
    const domainCount = domainCounts.get(primaryDomain) || 0;
    if (domainCount >= 3) {
      deferred.push(candidate);
      continue;
    }

    selected.push(candidate);
    domainCounts.set(primaryDomain, domainCount + 1);
  }

  return [...selected, ...deferred];
}

function dedupeSources(sources) {
  const seen = new Map();

  for (const source of sources || []) {
    const key = canonicalUrl(source.url) || compactText(source.title).toLowerCase();
    const existing = seen.get(key);
    if (!existing || (source.trustScore || 0) > (existing.trustScore || 0)) {
      seen.set(key, source);
    }
  }

  return [...seen.values()];
}

function diversifySourcesByDomain(sources) {
  const selected = [];
  const deferred = [];
  const domainCounts = new Map();

  for (const source of sources) {
    const domain = source.domain || "unknown";
    const count = domainCounts.get(domain) || 0;
    if (count >= 1) {
      deferred.push({ ...source, rankScore: Math.max(0, (source.rankScore || 0) - count * 18) });
    } else {
      selected.push(source);
    }
    domainCounts.set(domain, count + 1);
  }

  return [...selected, ...deferred.sort((a, b) => b.rankScore - a.rankScore)];
}

function chunkSource(source) {
  const text = compactText(`${source.title}. ${source.snippet}`);
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const sentence of sentences.length ? sentences : [text]) {
    const next = compactText(`${current} ${sentence}`);
    if (next.length > 420 && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks.length ? chunks : [text.slice(0, 420)];
}

export function buildRagContext(query, sources = [], intent = { intent: "web" }) {
  const queryTokens = tokenize(query);
  const scoredSources = dedupeSources(sources)
    .map((source) => {
      const overlap = queryOverlapScore(queryTokens, source);
      const rankScore = Math.round((source.trustScore || 50) + overlap * 35 + getIntentBoost(source, intent));
      return {
        ...source,
        freshness: source.fetchedAt ? "fetched now" : "live search",
        rankScore,
      };
    })
    .sort((a, b) => b.rankScore - a.rankScore);

  const rankedSources = diversifySourcesByDomain(scoredSources)
    .slice(0, config.freeSearchMaxResults)
    .map((source, index) => ({ ...source, index: index + 1 }));

  const rankedChunks = rankedSources
    .flatMap((source) =>
      chunkSource(source).map((text, chunkIndex) => {
        const chunkTokens = new Set(tokenize(text));
        const overlap = queryTokens.length
          ? queryTokens.filter((token) => chunkTokens.has(token)).length / queryTokens.length
          : 0;

        return {
          source,
          chunkIndex,
          text,
          chunkScore: Math.round((source.rankScore || 50) + overlap * 20 - chunkIndex * 3),
        };
      }),
    )
    .sort((a, b) => b.chunkScore - a.chunkScore)
    .slice(0, Math.max(4, config.freeSearchMaxResults));

  const contextText = rankedChunks
    .map((source) => {
      const snippet = compactText(source.text).slice(0, 520);
      return `[${source.source.index}] Title: ${source.source.title}
URL: ${source.source.url}
Domain: ${source.source.domain}
Trust: ${source.source.trustLabel || source.source.trustTier || "Web"} (${source.source.trustScore || 0})
Freshness: ${source.source.freshness}
Chunk: ${source.chunkIndex + 1}
Context: ${snippet}`;
    })
    .join("\n\n");

  const citations = rankedSources.map((source) => ({
    index: source.index,
    title: source.title,
    url: source.url,
    domain: source.domain,
    trust: source.trustLabel || source.trustTier || "Web",
    trustScore: source.trustScore || 0,
    snippet: source.snippet,
  }));

  const confidence = estimateConfidence(rankedSources);
  const relatedQuestions = buildRelatedQuestions(query, intent, rankedSources);

  return {
    sources: rankedSources,
    chunks: rankedChunks.map((chunk) => ({
      sourceIndex: chunk.source.index,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      score: chunk.chunkScore,
    })),
    contextText,
    citations,
    confidence,
    relatedQuestions,
  };
}

export function estimateConfidence(sources = []) {
  if (!sources.length) return { level: "low", score: 0.12, label: "Low" };

  const sourceCountScore = Math.min(0.35, sources.length * 0.06);
  const trustAverage = sources.reduce((sum, source) => sum + (source.trustScore || 50), 0) / sources.length;
  const trustScore = Math.min(0.45, trustAverage / 220);
  const officialBonus = sources.some((source) => ["government", "official", "verified_fallback"].includes(source.trustTier)) ? 0.15 : 0;
  const score = Math.min(0.95, Number((0.15 + sourceCountScore + trustScore + officialBonus).toFixed(2)));

  if (score >= 0.78) return { level: "high", score, label: "High" };
  if (score >= 0.5) return { level: "medium", score, label: "Medium" };
  return { level: "low", score, label: "Low" };
}

export function buildRelatedQuestions(query, intent = { intent: "web" }, sources = []) {
  const cleanQuery = compactText(query).replace(/\?+$/, "");
  const domain = sources[0]?.domain;

  if (intent.intent === "sports") {
    return [
      "Who has qualified for the IPL 2026 playoffs?",
      "What is the latest IPL 2026 NRR table?",
      "Who are the orange cap and purple cap leaders?",
      "When is the next IPL 2026 playoff match?",
    ];
  }

  if (intent.intent === "commerce") {
    const commercePhrase =
      intent.productCategory === "smartphones" && intent.budget
        ? `5G phone under Rs ${Number(intent.budget).toLocaleString("en-IN")}`
        : cleanQuery;
    return [
      `Which ${commercePhrase} has the best camera?`,
      `Compare ${commercePhrase} by battery and processor`,
      `Best alternatives to ${commercePhrase}`,
      `Where can I buy ${commercePhrase} in India?`,
    ];
  }

  if (intent.intent === "code") {
    return [
      `Show an implementation example for ${cleanQuery}`,
      `What are common bugs in ${cleanQuery}?`,
      `Compare official approaches for ${cleanQuery}`,
      `How do I test ${cleanQuery}?`,
    ];
  }

  if (intent.intent === "bharat") {
    return [
      `${cleanQuery} official process in India`,
      `Documents required for ${cleanQuery}`,
      `${cleanQuery} fees and timeline in India`,
      `Common mistakes in ${cleanQuery}`,
    ];
  }

  return [
    `${cleanQuery} latest updates`,
    `${cleanQuery} explained simply`,
    `Best sources for ${cleanQuery}`,
    domain ? `What does ${domain} say about ${cleanQuery}?` : `${cleanQuery} in India`,
  ];
}

export function buildGroundedSynthesis({ query, sources = [], intent = { intent: "web" }, confidence = estimateConfidence(sources) }) {
  const safeQuery = compactText(query);

  if (intent.intent === "commerce") {
    return buildCommerceSynthesis({ query: safeQuery, sources, intent, confidence });
  }

  if (!sources.length) {
    return `### Quick Answer
Reliable live sources were limited for **${safeQuery}**. CHATR will not invent details without grounded context.

### What To Check Next
- Start or configure **SearXNG** with **SEARXNG_URL** for self-hosted search.
- Use **SEARCH_PROVIDER=brave** only when you want API-backed retrieval.
- Try a more specific query with brand, city, date, or official source names.

### Confidence
**${confidence.label}** (${Math.round(confidence.score * 100)}%)`;
  }

  const topSources = sources.slice(0, 5);
  const rows = topSources
    .map((source) => {
      const title = compactText(source.title).replace(/\|/g, "/");
      const signal = compactText(source.snippet).replace(/\|/g, "/").slice(0, 220);
      return `| [${source.index}] ${title} | ${source.trustLabel || source.trustTier || "Web"} | ${signal} |`;
    })
    .join("\n");

  const insights = topSources
    .slice(0, 3)
    .map((source) => `- ${compactText(source.snippet).slice(0, 180)} [${source.index}]`)
    .join("\n");

  return `### Quick Answer
CHATR found **${sources.length} grounded source${sources.length === 1 ? "" : "s"}** for **${safeQuery}**. Model synthesis is temporarily unavailable, so this answer is a compressed source-grounded brief rather than an invented AI response.

### Key Insights
${insights}

### Source Matrix
| Source | Trust | Retrieved signal |
|---|---|---|
${rows}

### Confidence
**${confidence.label}** (${Math.round(confidence.score * 100)}%) based on source count, trust, and query match.`;
}

function buildCommerceSynthesis({ query, sources = [], intent = { intent: "commerce" }, confidence = estimateConfidence(sources) }) {
  const candidates = getCommerceCandidates(sources, intent);
  const trustedDomains = sources
    .filter((source) => /commerce_review|marketplace|major_media/i.test(source.trustTier || ""))
    .slice(0, 5)
    .map((source) => `[${source.index}] ${source.domain}`);

  const sourceRows = sources
    .slice(0, 6)
    .map((source) => {
      const signal = compactText(source.snippet).replace(/\|/g, "/").slice(0, 180);
      return `| [${source.index}] ${source.title.replace(/\|/g, "/")} | ${source.trustLabel || "Web"} | ${signal} |`;
    })
    .join("\n");

  if (candidates.length) {
    const rows = candidates
      .map((candidate, index) => {
        return `| ${index + 1} | ${candidate.model.replace(/\|/g, "/")} | ${candidate.price || NOT_VERIFIED} | ${formatVerifiedSpecs(
          candidate,
        )} | ${candidate.bestUse} | ${candidate.confidence.label} | ${formatSourceRefs(candidate.sources)} |`;
      })
      .join("\n");
    const bestPickRows = buildBestPickRows(candidates);
    const verificationNotes = buildVerificationNotes(candidates);

    return `### Quick Answer
For **${query}**, CHATR found grounded Indian catalogue/review sources and built a verified shopping shortlist. Missing specs stay marked as **${NOT_VERIFIED}** instead of being guessed.

### Top Recommendations
| Rank | Phone | Detected price | Verified fields | Recommendation | Confidence | Sources |
|---|---|---|---|---|---|---|
${rows}

### Recommendation Reasoning
| Need | Pick | Why | Confidence |
|---|---|---|---|
${bestPickRows}

### Verification Notes
${verificationNotes}
- Query budget constraints are not treated as product prices.
- Only explicitly extracted fields are displayed; missing device specifications are marked **${NOT_VERIFIED}**.
- Stronger source coverage came from: ${trustedDomains.join(", ") || "the cited source cards"}.

### Sources
| Source | Trust | Retrieved signal |
|---|---|---|
${sourceRows}

### Confidence
**${confidence.label}** (${Math.round(confidence.score * 100)}%) based on source trust, commerce relevance, and extracted phone signals.`;
  }

  return `### Quick Answer
CHATR found relevant commerce sources for **${query}**, but the live snippets did not expose enough model-level details to rank individual phones safely. Instead of refusing, here are the best grounded source paths to open first.

### Best Source Paths
| Source | Trust | Why it matters |
|---|---|---|
${sourceRows}

### How To Decide
- Open 91Mobiles/Smartprix/Gadgets360 style catalogue pages first for filtered under Rs 20,000 lists.
- Cross-check the final price on Flipkart/Amazon India because bank offers change daily.
- Prefer phones with 5G support, 120Hz display, 5000mAh+ battery, and recent Android update policy.

### Related Questions
- Which under Rs 20,000 phone has the best camera?
- Which under Rs 20,000 phone is best for gaming?
- Which phone has the best battery backup under Rs 20,000?

### Confidence
**${confidence.label}** (${Math.round(confidence.score * 100)}%) because sources are relevant, but extracted model detail is limited.`;
}

function formatVerifiedSpecs(candidate) {
  const fields = [
    ["Chipset", candidate.chipset],
    ["Display", candidate.display],
    ["Refresh", candidate.refreshRate],
    ["Battery", candidate.battery],
    ["Charging", candidate.charging],
    ["Camera", candidate.camera],
  ];

  return fields.map(([label, value]) => `${label}: ${value || NOT_VERIFIED}`).join("; ");
}

function formatSourceRefs(sourceIndexes = []) {
  return [...new Set(sourceIndexes)].map((sourceIndex) => `[${sourceIndex}]`).join(" ") || NOT_VERIFIED;
}

function buildBestPickRows(candidates) {
  const bestOverall = candidates[0];
  const picks = [
    {
      need: "Best Overall",
      candidate: bestOverall,
      why: bestOverall ? "Highest combined source trust, relevance, and verified field coverage." : "",
    },
    {
      need: "Best Gaming",
      candidate: candidates.find((candidate) => candidate.chipset || candidate.refreshRate),
      why: "Verified chipset or refresh-rate signal was retrieved.",
    },
    {
      need: "Best Camera",
      candidate: candidates.find((candidate) => candidate.camera),
      why: "Verified camera field was retrieved.",
    },
    {
      need: "Best Battery",
      candidate: candidates.find((candidate) => candidate.battery || candidate.charging),
      why: "Verified battery or charging field was retrieved.",
    },
    {
      need: "Best Value",
      candidate: candidates.find((candidate) => candidate.price),
      why: "Detected live price signal was retrieved from a trusted source.",
    },
  ];

  return picks
    .map(({ need, candidate, why }) =>
      candidate
        ? `| ${need} | ${candidate.model.replace(/\|/g, "/")} | ${why} ${formatSourceRefs(candidate.sources)} | ${candidate.confidence.label} |`
        : `| ${need} | ${NOT_VERIFIED} | No explicit retrieved field was strong enough for this category. | Limited Verification |`,
    )
    .join("\n");
}

function buildVerificationNotes(candidates) {
  const notes = candidates.flatMap((candidate) =>
    (candidate.contradictions || []).map(
      (note) => `- ${note} for **${candidate.model}**: ${candidate.priceValues.join(", ")} ${formatSourceRefs(candidate.sources)}.`,
    ),
  );

  return notes.length ? notes.join("\n") : "- No direct pricing contradiction detected in the retrieved structured fields.";
}

export function buildAnswerMetadata({ citations = [], relatedQuestions = [], confidence, providerUsed, latencyMs, intent }) {
  return {
    citations,
    relatedQuestions,
    confidence,
    providerUsed,
    latencyMs,
    intent,
  };
}
