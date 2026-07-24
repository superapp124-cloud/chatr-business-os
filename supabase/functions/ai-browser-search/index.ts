import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  category?: string;
  thumbnail?: string;
  imageUrl?: string;
  videoUrl?: string;
  duration?: string;
  views?: string;
}

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const TEMPORAL_TIME_ZONE = 'Asia/Kolkata';

function getTemporalContext(now = new Date()): { currentDate: string; currentYear: string } {
  const currentDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: TEMPORAL_TIME_ZONE,
  }).format(now);
  const currentYear = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    timeZone: TEMPORAL_TIME_ZONE,
  }).format(now);

  return { currentDate, currentYear };
}

function getTemporalInstruction(now = new Date()): string {
  const { currentDate, currentYear } = getTemporalContext(now);

  return `You are Chatr AI, a world-class real-time conversational search synthesis engine optimized for the Indian market ("Bharat Mode"). Your goal is to provide instantaneous, highly accurate, and clear answers by synthesizing raw web data while eliminating typical AI hallucinations.

### 1. CRITICAL TEMPORAL CONTEXT
- The absolute current date is ${currentDate}.
- The year ${currentYear} is the PRESENT, not the future.
- You must evaluate all real-time events, current sports tournaments (for example, IPL ${currentYear}), current taxation schedules, financial metrics, and stock updates through this exact date anchor.

### 2. CORE RESPONSE PRINCIPLES
- Fact-driven over conversational: do not start with generic fluff like "Sure, I can help with that" or "Based on my search results." Dive immediately into the synthesized answer.
- Strict grounding: rely entirely on the provided text snippets in the user's data context payload. If the provided context lacks specific details, state exactly what is missing rather than guessing.
- Local nuance: understand Indian vernacular, Hinglish phrasing, and Indian regulatory/geographic context. Prefer Indian sources, INR pricing, and official Indian government or platform guidance when relevant.

### 3. FORMATTING EXPECTATIONS
- Use clear markdown sections with ### headers, bolding for core facts, and neat lists.
- If data involves sports standings, numeric comparisons, prices, taxes, or structured indices, convert it into a markdown table for maximum visual scannability.
- Use explicit inline markdown citations matching the provided source index, for example [1], [2].`;
}

function compactText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sourcePriority(source: string): number {
  const priorities: Record<string, number> = {
    'Brave Search': 0,
    Google: 1,
    'Google Knowledge Graph': 1,
    'Google News': 2,
    Wikipedia: 3,
    GitHub: 4,
    DuckDuckGo: 5,
  };

  return priorities[source] ?? 10;
}

function rankResults(results: SearchResult[]): SearchResult[] {
  return [...results].sort((a, b) => {
    const priorityDelta = sourcePriority(a.source) - sourcePriority(b.source);
    if (priorityDelta !== 0) return priorityDelta;

    const aOfficial = /\.(gov|edu|org|com|in)\//i.test(a.url);
    const bOfficial = /\.(gov|edu|org|com|in)\//i.test(b.url);
    if (aOfficial && !bOfficial) return -1;
    if (!aOfficial && bOfficial) return 1;

    return 0;
  });
}

function buildContextPayload(query: string, results: SearchResult[]): Array<{ type: 'text'; text: string }> {
  const { currentDate } = getTemporalContext();
  const context = rankResults(results)
    .slice(0, 12)
    .map((result, index) => {
      const title = compactText(result.title);
      const snippet = compactText(result.snippet);
      const source = compactText(result.source);

      return `[${index + 1}] URL: ${result.url}
Source: ${source}
Title: ${title}
Snippet: ${snippet || 'No snippet provided.'}`;
    })
    .join('\n\n');

  return [
    {
      type: 'text',
      text: `### RAW FETCHED WEB CONTEXT (CURRENT AS OF ${currentDate.toUpperCase()})\n\n${context}`,
    },
    {
      type: 'text',
      text: `### USER QUERY\n${query}`,
    },
  ];
}

function payloadToText(payload: Array<{ type: 'text'; text: string }>): string {
  return payload.map((part) => part.text).join('\n\n');
}

// Brave Search API (free tier available)
async function searchBrave(query: string): Promise<SearchResult[]> {
  try {
    const BRAVE_SEARCH_API_KEY = Deno.env.get('BRAVE_SEARCH_API_KEY') || Deno.env.get('BRAVE_API_KEY');
    if (!BRAVE_SEARCH_API_KEY) {
      console.log('BRAVE_SEARCH_API_KEY not set, skipping Brave search');
      return [];
    }

    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', '10');
    url.searchParams.set('country', 'in');
    url.searchParams.set('search_lang', 'en');
    url.searchParams.set('safesearch', 'moderate');

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': BRAVE_SEARCH_API_KEY,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error('Brave search error:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.web?.results || []).map((item: any) => ({
      title: item.title,
      url: item.url,
      snippet: item.description || (item.extra_snippets || []).join(' '),
      source: 'Brave Search',
      category: 'web',
      thumbnail: item.thumbnail?.src,
    }));
  } catch (e) {
    console.error('Brave search error:', e);
    return [];
  }
}

// Google Search via Serper
async function searchGoogle(query: string): Promise<SearchResult[]> {
  try {
    const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
    if (!SERPER_API_KEY) {
      console.log('SERPER_API_KEY not set, skipping Google search');
      return [];
    }

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 10 }),
      signal: AbortSignal.timeout(5000)
    });

    const data = await response.json();
    const results: SearchResult[] = [];

    // Organic results
    if (data.organic) {
      for (const item of data.organic) {
        results.push({
          title: item.title,
          url: item.link,
          snippet: item.snippet || '',
          source: 'Google',
          category: 'web',
          thumbnail: item.imageUrl
        });
      }
    }

    // Knowledge graph
    if (data.knowledgeGraph) {
      const kg = data.knowledgeGraph;
      results.unshift({
        title: kg.title || query,
        url: kg.website || kg.descriptionLink || '',
        snippet: kg.description || '',
        source: 'Google Knowledge Graph',
        category: 'web',
        thumbnail: kg.imageUrl
      });
    }

    return results;
  } catch (e) {
    console.error('Google search error:', e);
    return [];
  }
}

// Google Images via SerpAPI
async function searchGoogleImages(query: string): Promise<SearchResult[]> {
  try {
    const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
    if (!SERPER_API_KEY) return [];

    const response = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 20 }),
      signal: AbortSignal.timeout(5000)
    });

    const data = await response.json();
    
    return (data.images || []).map((img: any) => ({
      title: img.title,
      url: img.link,
      snippet: img.source || 'Google Images',
      source: 'Google Images',
      category: 'image',
      imageUrl: img.imageUrl,
      thumbnail: img.thumbnailUrl || img.imageUrl
    }));
  } catch (e) {
    console.error('Google Images error:', e);
    return [];
  }
}

// Google News via SerpAPI
async function searchGoogleNews(query: string): Promise<SearchResult[]> {
  try {
    const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
    if (!SERPER_API_KEY) return [];

    const response = await fetch('https://google.serper.dev/news', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 10 }),
      signal: AbortSignal.timeout(5000)
    });

    const data = await response.json();
    
    return (data.news || []).map((article: any) => ({
      title: article.title,
      url: article.link,
      snippet: article.snippet || '',
      source: article.source || 'Google News',
      category: 'news',
      thumbnail: article.imageUrl
    }));
  } catch (e) {
    console.error('Google News error:', e);
    return [];
  }
}

// DuckDuckGo Instant Answer API
async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  
  try {
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await response.json();
    
    // Abstract
    if (data.Abstract) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        snippet: data.Abstract,
        source: 'DuckDuckGo',
        category: 'web'
      });
    }
    
    // Related Topics
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 8)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 100),
            url: topic.FirstURL,
            snippet: topic.Text,
            source: 'DuckDuckGo',
            category: 'web',
            thumbnail: topic.Icon?.URL
          });
        }
      }
    }
  } catch (e) {
    console.error('DuckDuckGo error:', e);
  }

  return results;
}

// Bing Search (free tier available)
async function searchBing(query: string): Promise<SearchResult[]> {
  try {
    // Using Bing's public search (requires API key for production)
    // For now, return empty - users can add BING_SEARCH_KEY to secrets
    const BING_KEY = Deno.env.get('BING_SEARCH_KEY');
    if (!BING_KEY) return [];

    const response = await fetch(
      `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=10`,
      {
        headers: { 'Ocp-Apim-Subscription-Key': BING_KEY },
        signal: AbortSignal.timeout(5000)
      }
    );
    const data = await response.json();
    
    return (data.webPages?.value || []).map((item: any) => ({
      title: item.name,
      url: item.url,
      snippet: item.snippet,
      source: 'Bing',
      category: 'web'
    }));
  } catch (e) {
    console.error('Bing search error:', e);
    return [];
  }
}

// News API for trending news
async function searchNews(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=relevancy&pageSize=8&language=en&apiKey=demo`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await response.json();
    
    return (data.articles || []).slice(0, 8).map((article: any) => ({
      title: article.title,
      url: article.url,
      snippet: article.description || article.content?.substring(0, 200),
      source: article.source.name,
      category: 'news',
      thumbnail: article.urlToImage
    }));
  } catch (e) {
    console.error('News search error:', e);
    return [];
  }
}

// Wikipedia API
async function searchWikipedia(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=8`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await response.json();
    
    if (data.query?.search) {
      return data.query.search.map((item: any) => ({
        title: item.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
        snippet: item.snippet.replace(/<[^>]*>/g, ''),
        source: 'Wikipedia',
        category: 'web'
      }));
    }
  } catch (e) {
    console.error('Wikipedia error:', e);
  }
  
  return [];
}

// GitHub Search API
async function searchGitHub(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=8`,
      { 
        headers: { 'User-Agent': 'Chatr-Browser' },
        signal: AbortSignal.timeout(5000)
      }
    );
    const data = await response.json();
    
    return (data.items || []).map((repo: any) => ({
      title: repo.full_name,
      url: repo.html_url,
      snippet: repo.description || 'No description available',
      source: 'GitHub',
      category: 'tech',
      thumbnail: repo.owner.avatar_url
    }));
  } catch (error) {
    console.error('GitHub search error:', error);
    return [];
  }
}

// Stack Overflow Search
async function searchStackOverflow(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `https://api.stackexchange.com/2.3/search/advanced?q=${encodeURIComponent(query)}&order=desc&sort=relevance&site=stackoverflow&pagesize=8`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await response.json();
    
    return (data.items || []).map((item: any) => ({
      title: item.title,
      url: item.link,
      snippet: (item.body_markdown?.substring(0, 200) || 'Stack Overflow discussion') + '...',
      source: 'Stack Overflow',
      category: 'tech'
    }));
  } catch (error) {
    console.error('Stack Overflow search error:', error);
    return [];
  }
}

// Reddit Search
async function searchReddit(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=8&sort=relevance`,
      { 
        headers: { 'User-Agent': 'Chatr-Browser' },
        signal: AbortSignal.timeout(5000)
      }
    );
    const data = await response.json();
    
    return (data.data?.children || []).map((post: any) => ({
      title: post.data.title,
      url: `https://reddit.com${post.data.permalink}`,
      snippet: (post.data.selftext?.substring(0, 200) || post.data.title) + '...',
      source: 'Reddit',
      category: 'social',
      thumbnail: post.data.thumbnail !== 'self' && post.data.thumbnail?.startsWith('http') ? post.data.thumbnail : undefined
    }));
  } catch (error) {
    console.error('Reddit search error:', error);
    return [];
  }
}

// arXiv Research Papers
async function searchArxiv(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=8`,
      { signal: AbortSignal.timeout(6000) }
    );
    const text = await response.text();
    
    const results: SearchResult[] = [];
    const entries = text.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    
    for (const entry of entries) {
      const titleMatch = entry.match(/<title>(.*?)<\/title>/);
      const summaryMatch = entry.match(/<summary>(.*?)<\/summary>/);
      const linkMatch = entry.match(/<id>(.*?)<\/id>/);
      
      if (titleMatch && linkMatch) {
        results.push({
          title: titleMatch[1].trim().replace(/\n/g, ' '),
          url: linkMatch[1].trim(),
          snippet: summaryMatch ? summaryMatch[1].trim().substring(0, 200) + '...' : '',
          source: 'arXiv',
          category: 'research'
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('arXiv search error:', error);
    return [];
  }
}

async function searchUnsplash(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=20&client_id=demo`,
      { headers: { 'Accept-Version': 'v1' } }
    );
    const data = await response.json();
    
    return (data.results || []).map((photo: any) => ({
      title: photo.alt_description || photo.description || query,
      url: photo.links.html,
      snippet: `By ${photo.user.name} on Unsplash`,
      source: 'Unsplash',
      category: 'image',
      thumbnail: photo.urls.small,
      imageUrl: photo.urls.regular
    }));
  } catch (error) {
    console.error('Unsplash search error:', error);
    return [];
  }
}

async function searchPixabay(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `https://pixabay.com/api/?key=demo&q=${encodeURIComponent(query)}&image_type=photo&per_page=20`
    );
    const data = await response.json();
    
    return (data.hits || []).slice(0, 20).map((hit: any) => ({
      title: hit.tags,
      url: hit.pageURL,
      snippet: `${hit.likes} likes · ${hit.views} views`,
      source: 'Pixabay',
      category: 'image',
      thumbnail: hit.previewURL,
      imageUrl: hit.webformatURL
    }));
  } catch (error) {
    console.error('Pixabay search error:', error);
    return [];
  }
}

// YouTube via SerpAPI
async function searchYouTube(query: string): Promise<SearchResult[]> {
  try {
    const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
    if (!SERPER_API_KEY) {
      // Fallback to search page
      return [{
        title: `"${query}" on YouTube`,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        snippet: 'Search YouTube for videos, tutorials, and live streams',
        source: 'YouTube',
        category: 'video',
        thumbnail: 'https://www.youtube.com/img/desktop/yt_1200.png'
      }];
    }

    const response = await fetch('https://google.serper.dev/videos', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 10 }),
      signal: AbortSignal.timeout(5000)
    });

    const data = await response.json();
    
    return (data.videos || []).map((video: any) => ({
      title: video.title,
      url: video.link,
      snippet: video.snippet || '',
      source: 'YouTube',
      category: 'video',
      thumbnail: video.imageUrl,
      videoUrl: video.link,
      duration: video.duration,
      views: video.views
    }));
  } catch (error) {
    console.error('YouTube search error:', error);
    return [];
  }
}

async function searchVimeo(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `https://vimeo.com/api/v2/videos/search.json?query=${encodeURIComponent(query)}&per_page=10`
    );
    const data = await response.json();
    
    return (data || []).map((video: any) => ({
      title: video.title,
      url: video.url,
      snippet: video.description?.substring(0, 200) || 'Vimeo video',
      source: 'Vimeo',
      category: 'video',
      thumbnail: video.thumbnail_medium,
      videoUrl: video.url,
      duration: `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}`,
      views: video.stats_number_of_plays?.toString()
    }));
  } catch (error) {
    console.error('Vimeo search error:', error);
    return [];
  }
}

async function callGroq(messages: LLMMessage[]): Promise<string | null> {
  const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
  if (!GROQ_API_KEY) return null;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('GROQ_MODEL') || 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages,
        max_tokens: 900,
        temperature: 0.15,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      console.error('Groq API error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('Groq summary error:', error);
    return null;
  }
}

async function callGemini(systemPrompt: string, userPayloadText: string): Promise<string | null> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY');
  if (!GEMINI_API_KEY) return null;

  try {
    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userPayloadText }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 900,
            temperature: 0.15,
          },
        }),
        signal: AbortSignal.timeout(12000),
      },
    );

    if (!response.ok) {
      console.error('Gemini API error:', response.status);
      return null;
    }

    const data = await response.json();
    return (data.candidates?.[0]?.content?.parts || [])
      .map((part: any) => part.text || '')
      .join('')
      .trim() || null;
  } catch (error) {
    console.error('Gemini summary error:', error);
    return null;
  }
}

async function callLovableGateway(messages: LLMMessage[]): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return null;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('LOVABLE_AI_MODEL') || 'google/gemini-2.5-flash',
        messages,
        max_tokens: 900,
        temperature: 0.15,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      console.error('Lovable AI API error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('Lovable AI summary error:', error);
    return null;
  }
}

async function generateAIFusionSummary(query: string, results: SearchResult[], category: string): Promise<string> {
  try {
    const rankedResults = rankResults(results);
    const hasUsableContext = rankedResults.some((result) => compactText(result.snippet).length > 20);
    if (!hasUsableContext) {
      return 'No sufficient grounded context found. Try refining your search.';
    }

    const systemPrompt = `${getTemporalInstruction()}

### 4. MODE-SPECIFIC ROUTING
- Current search mode: ${category}.
- For news/current-events queries, privilege the newest snippets and clearly say when the provided context does not include publication dates.
- For Indian tax questions, prefer official Income Tax Department guidance and the current financial/assessment year implied by the temporal context.
- For company, product, or person searches, focus on the specific entity first and ignore generic definitions when specific sources exist.`;

    const contextPayload = buildContextPayload(query, rankedResults);
    const userPayloadText = payloadToText(contextPayload);
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPayloadText },
    ];

    const preferredProvider = (Deno.env.get('AI_SEARCH_PRIMARY_PROVIDER') || 'groq').toLowerCase();
    const providers =
      preferredProvider === 'gemini'
        ? [
            () => callGemini(systemPrompt, userPayloadText),
            () => callGroq(messages),
            () => callLovableGateway(messages),
          ]
        : [
            () => callGroq(messages),
            () => callGemini(systemPrompt, userPayloadText),
            () => callLovableGateway(messages),
          ];

    for (const provider of providers) {
      const summary = await provider();
      if (summary) return summary;
    }

    return 'AI synthesis unavailable because no free-tier LLM key is configured or all providers are rate-limited. Add GROQ_API_KEY or GEMINI_API_KEY/GOOGLE_AI_API_KEY, then retry. Showing search results below.';
  } catch (error) {
    console.error('AI summary error:', error);
    return 'AI summary unavailable. See search results below.';
  }
}

async function generateLegacyAIFusionSummary(query: string, results: SearchResult[], category: string): Promise<string> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return 'AI summary unavailable. See search results below.';
    }

    // Prioritize official domains and most relevant results
    const prioritizedResults = [...results].sort((a, b) => {
      // Boost official domains (.com, .dev, .org from main sites)
      const aIsOfficial = a.url.includes('.com/') || a.url.includes('.dev') || a.url.includes('.org');
      const bIsOfficial = b.url.includes('.com/') || b.url.includes('.dev') || b.url.includes('.org');
      if (aIsOfficial && !bIsOfficial) return -1;
      if (!aIsOfficial && bIsOfficial) return 1;
      
      // Boost results from authoritative sources
      const authoritativeSources = ['Wikipedia', 'Google Knowledge Graph', 'GitHub'];
      const aIsAuth = authoritativeSources.includes(a.source);
      const bIsAuth = authoritativeSources.includes(b.source);
      if (aIsAuth && !bIsAuth) return -1;
      if (!aIsAuth && bIsAuth) return 1;
      
      return 0;
    });

    // Take top 12 most relevant results
    const topResults = prioritizedResults.slice(0, 12);
    const context = topResults
      .filter(r => r.snippet && r.snippet.length > 20)
      .map((r, i) => `[${i + 1}] ${r.source} - ${r.url}\n${r.title}\n${r.snippet}`)
      .join('\n\n');

    if (!context) {
      return 'No sufficient data found. Try refining your search.';
    }

    const systemPrompt = `${getTemporalInstruction()}

You provide accurate, well-structured summaries based on search results.

CRITICAL RULES:
1. ALWAYS prioritize official websites and authoritative sources
2. For company/product searches, focus on the ACTUAL company/product, not general definitions
3. If searching for a specific entity (company, product, person), mention it first with official URL
4. Use sources marked with URLs like .dev, .com, official GitHub repos
5. Ignore generic dictionary definitions when specific entities exist
6. For live/current queries, interpret "latest", "today", "current", and the current year relative to the temporal context above
7. For Indian tax questions, prefer official Income Tax Department guidance and the current financial/assessment year implied by today's date

FORMAT:
First paragraph: Direct, specific answer about what the user is looking for (prioritize official sources)

**Key Information**
• Specific facts from official sources
• Important details with source citations [1], [2]
• Relevant data or statistics

**Additional Context** (if needed)
• Secondary information
• Related topics

Be specific, factual, and prioritize the most relevant official information.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Query: "${query}"\n\nPrioritize specific companies, products, or entities over general definitions.\n\nSearch Results (ranked by relevance):\n${context}\n\nProvide a focused, accurate summary.`
          }
        ],
        max_tokens: 500,
        temperature: 0.2
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', response.status);
      if (response.status === 429) return 'Rate limit reached. Showing search results below.';
      if (response.status === 402) return 'AI service unavailable. Showing search results below.';
      return 'AI summary temporarily unavailable. See search results below.';
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || 'Summary generation failed.';
    
    return summary;
  } catch (error) {
    console.error('AI summary error:', error);
    return 'AI summary unavailable. See search results below.';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, category = 'web' } = await req.json();
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Valid search query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanQuery = query.trim();
    console.log(`🔍 Search: "${cleanQuery}" [${category}]`);

    // Ultra-fast parallel search with free-tier providers first
    const searchPromises: Promise<SearchResult[]>[] = [
      searchBrave(cleanQuery),         // Primary: Brave Search free tier
      searchGoogle(cleanQuery),        // Serper Google results free tier
      searchDuckDuckGo(cleanQuery),    // Fallback
      searchWikipedia(cleanQuery),     // Knowledge base
    ];
    
    // Add category-specific searches in parallel
    if (category === 'image') {
      searchPromises.push(
        searchGoogleImages(cleanQuery),
        searchUnsplash(cleanQuery),
        searchPixabay(cleanQuery)
      );
    } else if (category === 'video') {
      searchPromises.push(
        searchYouTube(cleanQuery),
        searchVimeo(cleanQuery)
      );
    } else if (category === 'news') {
      searchPromises.push(
        searchGoogleNews(cleanQuery),
        searchNews(cleanQuery),
        searchReddit(cleanQuery)
      );
    } else if (category === 'tech') {
      searchPromises.push(
        searchGitHub(cleanQuery),
        searchStackOverflow(cleanQuery)
      );
    } else if (category === 'social') {
      searchPromises.push(
        searchReddit(cleanQuery),
        searchStackOverflow(cleanQuery)
      );
    } else if (category === 'research') {
      searchPromises.push(searchArxiv(cleanQuery));
    } else if (category === 'web' || category === 'all') {
      // For general web search, include everything
      searchPromises.push(
        searchGoogleNews(cleanQuery),
        searchGoogleImages(cleanQuery),
        searchYouTube(cleanQuery),
        searchGitHub(cleanQuery),
        searchStackOverflow(cleanQuery),
        searchReddit(cleanQuery),
        searchNews(cleanQuery)
      );
    }

    const startTime = Date.now();
    
    // Use Promise.allSettled for resilience - don't fail if one source fails
    const resultsArrays = await Promise.allSettled(searchPromises);
    
    // Collect successful results
    const allResults = resultsArrays
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => (r as PromiseFulfilledResult<SearchResult[]>).value)
      .filter(r => r && r.title && r.url); // Filter out invalid results
    
    const searchTime = Date.now() - startTime;

    console.log(`✅ Found ${allResults.length} results in ${searchTime}ms`);

    if (allResults.length === 0) {
      return new Response(
        JSON.stringify({
          summary: 'No results found. Try different keywords or check your spelling.',
          results: [],
          allResults: { web: [], tech: [], social: [], research: [], image: [], video: [], all: [] },
          query: cleanQuery,
          category,
          searchTime,
          resultCount: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Categorize results
    const categorized = {
      web: allResults.filter(r => r.category === 'web'),
      tech: allResults.filter(r => r.category === 'tech'),
      social: allResults.filter(r => r.category === 'social'),
      research: allResults.filter(r => r.category === 'research'),
      image: allResults.filter(r => r.category === 'image'),
      video: allResults.filter(r => r.category === 'video'),
      news: allResults.filter(r => r.category === 'news'),
      all: allResults
    };

    // Generate AI summary
    console.log('🤖 Generating AI summary...');
    const summary = await generateAIFusionSummary(cleanQuery, allResults, category);

    const response = {
      summary,
      results: categorized[category as keyof typeof categorized] || allResults,
      allResults: categorized,
      query: cleanQuery,
      category,
      searchTime,
      resultCount: allResults.length
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Search failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
