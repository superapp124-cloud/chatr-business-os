const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  try {
    await page.goto('http://localhost:8082/test-gemini-live.html');
    console.log('Navigated to test page');
    
    await page.click('#startBtn');
    
    await page.waitForTimeout(10000); // Wait 10 seconds to collect process chunks
    
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  await browser.close();
})();
