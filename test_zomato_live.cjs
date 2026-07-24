const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    viewport: { width: 375, height: 812 },
    isMobile: true
  });
  const page = await context.newPage();
  
  console.log("Navigating to Zomato menu...");
  await page.goto('https://www.zomato.com/bangalore/meghana-foods-residency-road/order', { waitUntil: 'domcontentloaded' });
  
  await page.waitForTimeout(4000);
  
  const text = await page.evaluate(() => {
    return document.body.innerText.substring(0, 2000);
  });
  
  console.log("Page text:", text);
  
  await browser.close();
})();

