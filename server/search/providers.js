import * as cheerio from "cheerio";
import { config } from "./config.js";
import {
  extractPhoneModels,
  extractPriceSignals,
  extractSpecSignals,
  extractStructuredFields,
  extractStructuredProducts,
  formatInr,
} from "./commerce.js";
import { detectSearchIntent } from "./intent.js";
import { compactText } from "./text.js";
import { getDomain, getSourceTrust } from "./trust.js";

const searchResultCache = new Map();

function getCachedSearchResult(key) {
  const cached = searchResultCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > config.searchCacheTtlMs) {
    searchResultCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedSearchResult(key, value) {
  searchResultCache.set(key, { createdAt: Date.now(), value });
}

function normalizeDuckDuckGoUrl(href) {
  if (!href) return "";

  try {
    const parsed = new URL(href, "https://duckduckgo.com");
    return parsed.searchParams.get("uddg") || parsed.href;
  } catch {
    return href;
  }
}

function isSearchOrLowValueUrl(url, domain) {
  if (/duckduckgo\.com\/y\.js|[?&](ad_domain|ad_provider|ad_type)=|bing\.com\/aclick/i.test(url)) return true;
  if (/(^|\.)youtube\.com$/i.test(domain) && /\/results/i.test(url)) return true;
  if (/(^|\.)google\.com$|(^|\.)bing\.com$|(^|\.)duckduckgo\.com$/i.test(domain) && /\/search|\/html|\/results/i.test(url)) return true;
  if (
    /\/search[/?#]|[?&](q|query|search_query)=/i.test(url) &&
    !/(smartprix|91mobiles|gadgets360|gsmarena|flipkart|amazon\.in|croma|reliancedigital|vijaysales)/i.test(domain)
  ) {
    return true;
  }
  return false;
}

function commerceRelevanceScore({ title, snippet, domain, url }, intent = {}) {
  if (intent.intent !== "commerce") return 1;

  const haystack = `${title} ${snippet} ${domain}`.toLowerCase();
  const trustedDomain = /(gsmarena|91mobiles|smartprix|gadgets360|techradar|androidauthority|tomsguide|digit\.in|mysmartprice|pricebaba|flipkart|amazon\.in|croma|reliancedigital)/i.test(
    domain,
  );
  const commerceWords = [
    "phone",
    "phones",
    "mobile",
    "smartphone",
    "smartphones",
    "5g",
    "under",
    "20000",
    "20,000",
    "₹",
    "rs",
    "price",
    "camera",
    "battery",
    "processor",
    "gaming",
    "india",
  ];
  const matches = commerceWords.filter((word) => haystack.includes(word)).length;
  let score = matches + (trustedDomain ? 8 : 0);

  if (/wikipedia\.org/i.test(domain)) score -= 8;
  if (/youtube\.com|youtu\.be/i.test(domain) && !/\/watch|youtu\.be\//i.test(url)) score -= 12;
  if (/youtube\.com|youtu\.be/i.test(domain) && !/(review|best|phone|smartphone|mobile|5g)/i.test(haystack)) score -= 8;
  if (snippet.length < 45) score -= 4;
  if (!/(phone|mobile|smartphone|5g)/i.test(haystack) && !trustedDomain) score -= 8;

  return score;
}

function normalizeSources(items, provider, intent = {}) {
  const seen = new Set();
  const fetchedAt = new Date().toISOString();

  return items
    .map((item) => {
      const title = compactText(item.title);
      const url = compactText(item.url);
      const snippet = compactText(item.snippet || item.description || item.content || title);
      const domain = getDomain(url);

      if (!title || !url || !domain || seen.has(url)) return null;
      if (isSearchOrLowValueUrl(url, domain)) return null;
      const relevanceScore = commerceRelevanceScore({ title, snippet, domain, url }, intent);
      if (intent.intent === "commerce" && relevanceScore < 4) return null;
      seen.add(url);

      return {
        title,
        url,
        domain,
        snippet,
        source: provider,
        fetchedAt,
        relevanceScore,
        searchQuery: item.searchQuery,
        extracted: item.extracted,
        ...getSourceTrust(url, title),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.trustScore + (b.relevanceScore || 0) * 5 - (a.trustScore + (a.relevanceScore || 0) * 5))
    .slice(0, config.freeSearchMaxResults)
    .map((source, index) => ({ ...source, index: index + 1 }));
}

export function sourcesToContextText(sources) {
  return sources
    .map(
      (source) =>
        `[${source.index}] URL: ${source.url}\nTitle: ${source.title}\nDomain: ${source.domain}\nProvider: ${source.source}\nTrust: ${source.trustTier}\nSnippet: ${source.snippet}`,
    )
    .join("\n\n");
}

function getProviderOrder() {
  if (config.searchProvider === "brave") return ["brave", "searxng", "duckduckgo"];
  if (config.searchProvider === "searxng") {
    return config.braveFallbackEnabled ? ["searxng", "duckduckgo", "brave"] : ["searxng", "duckduckgo"];
  }
  if (config.searchProvider === "auto") {
    return config.braveFallbackEnabled ? ["searxng", "duckduckgo", "brave"] : ["searxng", "duckduckgo"];
  }
  return config.braveFallbackEnabled ? ["searxng", "duckduckgo", "brave"] : ["searxng", "duckduckgo"];
}

async function fetchWithTimeout(url, options = {}, timeoutMs = config.searchFetchTimeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDuckDuckGoHtmlResults(query) {
  try {
    const targetUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetchWithTimeout(targetUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": config.searchUserAgent,
      },
    });

    if (!response.ok) throw new Error(`DuckDuckGo HTML status: ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);
    const items = [];

    $(".result, .results_links_deep").each((_, element) => {
      if (items.length >= config.freeSearchMaxResults) return false;

      const result = $(element);
      if (result.is(".result--ad, .result-sponsored") || result.find(".result__badge, .badge--ad").text().toLowerCase().includes("ad")) {
        return;
      }

      const titleNode = result.find(".result__title a, a.result__a").first();
      const title = titleNode.text();
      const url = normalizeDuckDuckGoUrl(titleNode.attr("href"));
      const snippet = result.find(".result__snippet").text() || result.find(".result__body").text();

      if (title && url) items.push({ title, url, snippet });
    });

    return items;
  } catch (error) {
    console.warn("DuckDuckGo provider failed:", error.message);
    return [];
  }
}

async function fetchSearxngResults(query) {
  if (!config.searxngUrl) return [];

  try {
    const base = config.searxngUrl.replace(/\/+$/, "");
    const url = new URL(base.endsWith("/search") ? base : `${base}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("language", "en-IN");
    url.searchParams.set("safesearch", "1");

    const timeoutMs = config.searxngIsConfigured ? config.searchFetchTimeoutMs : config.localSearchFetchTimeoutMs;
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": config.searchUserAgent,
        },
      },
      timeoutMs,
    );

    if (!response.ok) throw new Error(`SearXNG status: ${response.status}`);

    const data = await response.json();
    const items = (data.results || []).map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.content || item.snippet || item.description,
    }));

    return items;
  } catch (error) {
    console.warn("SearXNG provider failed:", error.message);
    return [];
  }
}

async function fetchBraveResults(query) {
  if (!config.braveSearchApiKey) return [];

  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.append("q", query);
    url.searchParams.append("count", String(config.freeSearchMaxResults));
    url.searchParams.append("country", "in");
    url.searchParams.append("search_lang", "en");
    url.searchParams.append("safesearch", "moderate");

    const response = await fetchWithTimeout(url, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": config.braveSearchApiKey,
      },
    });

    if (!response.ok) throw new Error(`Brave Search status: ${response.status}`);

    const results = await response.json();
    const items = (results.web?.results || []).map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.description,
    }));

    return items;
  } catch (error) {
    console.warn("Brave provider failed:", error.message);
    return [];
  }
}

async function fetchProviderSources(provider, query) {
  if (provider === "searxng") return fetchSearxngResults(query);
  if (provider === "brave") return fetchBraveResults(query);
  return fetchDuckDuckGoHtmlResults(query);
}

function getIntentSearchQueries(intent) {
  return [...new Set([intent.searchQuery, ...(intent.searchQueries || [])].filter(Boolean))].slice(
    0,
    intent.intent === "commerce" ? 6 : 2,
  );
}

async function enrichCommerceSource(source, intent = {}) {
  if (!source?.url || !/(commerce_review|marketplace|major_media|web)/i.test(source.trustTier || "")) return source;

  try {
    const response = await fetchWithTimeout(
      source.url,
      {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": config.searchUserAgent,
        },
      },
      Math.min(config.searchFetchTimeoutMs, 2800),
    );
    if (!response.ok) return source;

    const html = await response.text();
    const $ = cheerio.load(html);
    $("script, style, noscript, svg").remove();
    const text = compactText(
      [
        $("meta[name='description']").attr("content") || "",
        $("h1").first().text(),
        $("h2, h3, li, td, th")
          .slice(0, 160)
          .map((_, el) => $(el).text())
          .get()
          .join(" "),
      ].join(" "),
    ).slice(0, 3600);

    const surfaceText = compactText(`${source.title} ${source.snippet}`);
    const surfaceModels = extractPhoneModels(surfaceText);
    let products = extractStructuredProducts(text, {
      budget: intent.budget,
      sourceIndex: source.index,
      sourceDomain: source.domain,
    }).slice(0, 8);

    products = surfaceModels.length
      ? products.filter((product) =>
          surfaceModels.some(
            (surfaceModel) =>
              product.model.toLowerCase().includes(surfaceModel.toLowerCase()) ||
              surfaceModel.toLowerCase().includes(product.model.toLowerCase()),
          ),
        )
      : [];

    const phoneModels = [...new Set([...products.map((product) => product.model), ...surfaceModels])].slice(0, 8);
    const prices = [
      ...new Set([
        ...products.map((product) => product.price).filter(Boolean),
        ...extractPriceSignals(text, intent.budget),
      ]),
    ].slice(0, 8);
    const specs = extractSpecSignals(text).slice(0, 12);

    if (!phoneModels.length && !prices.length && !specs.length && !products.length) return source;

    return {
      ...source,
      snippet: compactText(
        `${source.snippet} Extracted signals: ${phoneModels.length ? `Models: ${phoneModels.join(", ")}.` : ""} ${
          prices.length ? `Prices: ${prices.join(", ")}.` : ""
        } ${specs.length ? `Specs: ${specs.join(", ")}.` : ""}`,
      ).slice(0, 900),
      extracted: { phoneModels, prices, specs, products },
    };
  } catch {
    return source;
  }
}

function getDirectCommerceTargets(intent = {}) {
  if (intent.intent !== "commerce" || intent.productCategory !== "smartphones") return [];

  return [
    {
      title: "Amazon India 5G phones under budget",
      url: "https://www.amazon.in/s?k=5g+phone+under+20000",
    },
    {
      title: "Flipkart 5G phones under budget",
      url: "https://www.flipkart.com/search?q=5g%20phone%20under%2020000",
    },
    {
      title: "Gadgets360 best 5G mobile phones under budget",
      url: "https://www.gadgets360.com/mobiles/best-5g-mobile-phones-under-20000",
    },
    {
      title: "Digit best 5G mobile phones under budget",
      url: "https://www.digit.in/top-products/best-5g-mobile-phones-under-20000-3847.html",
    },
    {
      title: "Croma 5G phones under budget",
      url: "https://www.croma.com/searchB?q=5g%20phone%20under%2020000%3Arelevance&text=5g%20phone%20under%2020000",
    },
  ];
}

function cleanMarketplaceTitle(value) {
  return compactText(value)
    .replace(/^Add\s+to\s+Compare/i, "")
    .replace(/^Sponsored\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getMarketplaceCardSelectors(domain) {
  if (/amazon\.in$/i.test(domain)) {
    return {
      card: '[data-component-type="s-search-result"]',
      title: "h2 span",
      price: ".a-price .a-price-whole",
    };
  }

  if (/flipkart\.com$/i.test(domain)) {
    return {
      card: "div[data-id], ._75nlfW > div",
      title: ".KzDlHZ, .s1Q9rs, .wjcEIp",
      price: "._4b5DiR, .Nx9bqj",
    };
  }

  if (/croma\.com$/i.test(domain)) {
    return {
      card: ".product-item, .cp-product, li.product-item",
      title: "h3, .product-title, .product-name",
      price: ".amount, .new-price, .price",
    };
  }

  return null;
}

function formatRawPrice(value) {
  const numeric = Number(compactText(value).replace(/[^\d]/g, ""));
  return numeric ? formatInr(numeric) : "";
}

function modelFromMarketplaceTitle(title, fallbackText = "") {
  const cleanTitle = cleanMarketplaceTitle(title);
  const lead = compactText(cleanTitle.split(/\s+\(|\s+\||,/)[0]);
  const models = extractPhoneModels(lead || cleanTitle || fallbackText);
  return models[0] || "";
}

function extractMarketplaceProducts($, domain, { budget = "", sourceIndex = null } = {}) {
  const selectors = getMarketplaceCardSelectors(domain);
  if (!selectors) return [];

  const products = [];
  $(selectors.card).each((_, element) => {
    if (products.length >= 10) return false;

    const card = $(element);
    const title = cleanMarketplaceTitle(card.find(selectors.title).first().text());
    const cardText = compactText(card.text()).slice(0, 1400);
    const model = modelFromMarketplaceTitle(title, cardText);
    if (!model) return;

    const fields = extractStructuredFields(cardText, budget);
    const explicitPrice = formatRawPrice(card.find(selectors.price).first().text()) || fields.price;

    products.push({
      model,
      chipset: fields.chipset,
      display: fields.display,
      refreshRate: fields.refreshRate,
      battery: fields.battery,
      charging: fields.charging,
      camera: fields.camera,
      price: explicitPrice,
      source: sourceIndex,
      domain,
    });
  });

  const seen = new Set();
  return products.filter((product) => {
    const key = product.model.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildDirectCommerceText($) {
  $("script, style, noscript, svg").remove();
  return compactText(
    [
      $("title").text(),
      $("meta[name='description']").attr("content") || "",
      $("h1").first().text(),
      $("h2, h3, li, td, th, .product-title, .product-name, .a-size-medium")
        .slice(0, 220)
        .map((_, el) => $(el).text())
        .get()
        .join(" "),
    ].join(" "),
  ).slice(0, 9000);
}

async function fetchDirectCommerceSources(intent = {}) {
  const targets = getDirectCommerceTargets(intent);
  if (!targets.length) return [];

  const results = await Promise.all(
    targets.map(async (target, sourceIndex) => {
      try {
        const response = await fetchWithTimeout(
          target.url,
          {
            headers: {
              Accept: "text/html,application/xhtml+xml",
              "User-Agent": config.searchUserAgent,
            },
          },
          Math.min(config.searchFetchTimeoutMs, 5000),
        );
        if (!response.ok) throw new Error(`Direct commerce status: ${response.status}`);

        const html = await response.text();
        const $ = cheerio.load(html);
        const domain = getDomain(target.url);
        const text = buildDirectCommerceText($);
        const marketplaceProducts = extractMarketplaceProducts($, domain, {
          budget: intent.budget,
          sourceIndex: sourceIndex + 1,
        });
        const genericProducts = extractStructuredProducts(text, {
          budget: intent.budget,
          sourceIndex: sourceIndex + 1,
          sourceDomain: domain,
        }).filter(
          (product) =>
            product.model &&
            (product.price || product.chipset || product.display || product.refreshRate || product.battery || product.charging || product.camera),
        );
        const products = [...marketplaceProducts, ...genericProducts].slice(0, 10);
        const phoneModels = [...new Set(products.map((product) => product.model).filter(Boolean))].slice(0, 10);
        const prices = [...new Set(products.map((product) => product.price).filter(Boolean))].slice(0, 10);
        const specs = extractSpecSignals(text).slice(0, 12);

        if (!phoneModels.length && !prices.length && !specs.length) return null;

        const pageTitle = compactText($("title").text()) || target.title;
        return {
          title: pageTitle,
          url: target.url,
          snippet: compactText(
            `${target.title}. ${phoneModels.length ? `Products: ${phoneModels.join(", ")}.` : ""} ${
              prices.length ? `Detected prices: ${prices.join(", ")}.` : ""
            } ${specs.length ? `Retrieved specs: ${specs.join(", ")}.` : ""}`,
          ).slice(0, 900),
          extracted: { phoneModels, prices, specs, products },
          searchQuery: intent.searchQuery,
        };
      } catch (error) {
        console.warn("Direct commerce probe failed:", target.url, error.message);
        return null;
      }
    }),
  );

  return results.filter(Boolean);
}

export async function fetchWebContext(query, category = "web") {
  const intent = detectSearchIntent(query, category);
  const attemptedProviders = [];
  const cacheKey = `${category}:${getIntentSearchQueries(intent).join("|")}`.toLowerCase();
  const cached = getCachedSearchResult(cacheKey);

  if (cached) {
    return {
      ...cached,
      intent: { ...cached.intent, searchCache: "memory" },
    };
  }

  for (const provider of getProviderOrder()) {
    if (provider === "searxng" && !config.searxngUrl) continue;
    if (provider === "brave" && !config.braveSearchApiKey) continue;

    attemptedProviders.push(provider);
    const rawResults = (
      await Promise.all(
        getIntentSearchQueries(intent).map((searchQuery) =>
          fetchProviderSources(provider, searchQuery).then((items) =>
            items.map((item) => ({ ...item, searchQuery })),
          ),
        ),
      )
    ).flat();

    let sources = normalizeSources(rawResults, provider === "duckduckgo" ? "DuckDuckGo HTML" : provider === "searxng" ? "SearXNG" : "Brave Search", intent);
    if (intent.intent === "commerce") {
      sources = await Promise.all(sources.map((source) => enrichCommerceSource(source, intent)));
      sources = normalizeSources(sources, sources[0]?.source || provider, intent);
      const directCommerceResults = await fetchDirectCommerceSources(intent);
      if (directCommerceResults.length) {
        sources = normalizeSources([...sources, ...directCommerceResults], sources[0]?.source || provider, intent);
      }
    }

    if (sources.length) {
      const result = {
        sourceText: sourcesToContextText(sources),
        sources,
        intent: { ...intent, searchProvider: provider },
      };
      setCachedSearchResult(cacheKey, result);
      return result;
    }
  }

  if (intent.intent === "commerce") {
    const directCommerceResults = await fetchDirectCommerceSources(intent);
    const sources = normalizeSources(directCommerceResults, "Direct Commerce Crawl", intent);
    if (sources.length) {
      const result = {
        sourceText: sourcesToContextText(sources),
        sources,
        intent: { ...intent, searchProvider: "direct_commerce" },
      };
      setCachedSearchResult(cacheKey, result);
      return result;
    }
  }

  return {
    sourceText: `No live web context fetched. Attempted providers: ${attemptedProviders.join(", ") || "duckduckgo"}.`,
    sources: [],
    intent: { ...intent, searchProvider: attemptedProviders[0] || "duckduckgo" },
  };
}
