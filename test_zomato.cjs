const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  console.log("Navigating to Zomato...");
  await page.goto('https://www.zomato.com/bangalore/restaurants', { waitUntil: 'domcontentloaded' });
  
  await page.waitForTimeout(3000);
  
  // Try to find restaurant cards
  const elements = await page.$$eval('.jumbo-tracker', cards => {
    return cards.map(c => {
      const h4 = c.querySelector('h4');
      const name = h4 ? h4.innerText : null;
      // We'll just dump innerText of the whole card to see what's in there
      const text = c.innerText.replace(/\n/g, ' | ');
      return { name, text };
    }).slice(0, 5);
  });
  
  console.log("Found matching elements:", elements.length);
  elements.forEach((el, i) => {
    console.log(`\n--- Card ${i} ---`);
    console.log("Name:", el.name);
    console.log("Text:", el.text);
  });
  
  await browser.close();
})();
