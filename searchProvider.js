import * as cheerio from 'cheerio';

/**
 * ⚡ ZERO-COST OPEN CRAWLER
 * Scrapes clean, structured search results natively without needing API keys.
 */
export async function freeWebScrape(query) {
  try {
    const targetUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) throw new Error("Public gateway throttled or unreachable.");
    
    const html = await response.text();
    const $ = cheerio.load(html);
    const nodes = [];

    // Extract search cards from the fallback HTML structure
    $('.results_links_deep').each((index, element) => {
      if (index >= 4) return false; // Restrict to top 4 high-density entries for speed

      const titleNode = $(element).find('.result__title a');
      const title = titleNode.text().trim();
      const url = titleNode.attr('href');
      const snippet = $(element).find('.result__snippet').text().trim();

      if (title && url && snippet) {
        nodes.push({
          index: index + 1,
          title,
          url,
          snippet
        });
      }
    });

    return nodes;
  } catch (error) {
    console.error("Free crawler failed, firing local system storage anchor:", error);
    return [];
  }
}
