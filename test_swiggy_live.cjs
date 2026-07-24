const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  console.log("Navigating to Swiggy search...");
  await page.goto('https://www.swiggy.com/city/bangalore/search?query=biryani', { waitUntil: 'domcontentloaded' });
  
  await page.waitForTimeout(4000);
  
  const text = await page.evaluate(() => document.body.innerText.substring(0, 1500));
  console.log("Page text:", text);
  
  await browser.close();
})();
