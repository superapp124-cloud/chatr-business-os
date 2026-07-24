const playwright = require('playwright');

class BrowserTransportStrategy {
  async initialize() {}
  async shutdown() {}
  
  validate(manifest, parameters) {
    return true; // Simplified for MVP
  }
  
  collectEvidence(rawResult) {
    return [rawResult.evidence]; // Must return an array for UI bridge
  }

  async compensate() {}

  /**
   * Execute a browser automation capability.
   * @param {object} providerInstance - The provider instance metadata.
   * @param {string} capabilityId - The capability ID (e.g., travel.flight.search).
   * @param {object} parameters - The parameters for the capability.
   * @param {object} context - Execution context (e.g., headless flag).
   */
  async execute(providerInstance, capabilityId, parameters = {}, context = {}) {
    let browser;
    let contextTimeout;
    
    // Safety timeout
    const timeoutMs = context.timeout || 60000;
    const timeoutPromise = new Promise((_, reject) => {
      contextTimeout = setTimeout(() => {
        reject(new Error('Browser execution timed out.'));
      }, timeoutMs);
    });

    const executionPromise = (async () => {
      try {
        browser = await playwright.chromium.launch({
          headless: context.headless ?? false
        });
        const page = await browser.newPage();
        
        let resultData = null;
        let evidence = '';
        
        if (capabilityId === 'travel.flight.search' || capabilityId === 'travel.flight.book') {
          const destination = parameters.destination || 'New York';
          const query = encodeURIComponent(`flights to ${destination}`);
          await page.goto(`https://www.google.com/search?q=${query}`);
          
          // Wait for some results to load
          await page.waitForSelector('body', { timeout: 10000 });
          
          // Extract some text from the DOM to prove it worked
          const pageTitle = await page.title();
          const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 200));
          
          resultData = {
            destination,
            pageTitle
          };
          evidence = `Navigated to Google Search for flights to ${destination}. Found title: "${pageTitle}". Extracted snippet: "${bodyText.replace(/\\n/g, ' ')}"`;
        } else {
          // Generic fallback
          await page.goto(parameters.url || 'https://example.com');
          const title = await page.title();
          resultData = { title };
          evidence = `Executed capability ${capabilityId}. Navigated to page, got title: "${title}".`;
        }
        
        return {
          status: 'success',
          result: resultData,
          evidence
        };
      } finally {
        if (browser) {
          await browser.close();
        }
      }
    })();

    try {
      return await Promise.race([executionPromise, timeoutPromise]);
    } finally {
      clearTimeout(contextTimeout);
    }
  }
}

module.exports = BrowserTransportStrategy;
