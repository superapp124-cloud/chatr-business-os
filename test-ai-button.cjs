const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  
  await page.goto('http://localhost:8080');
  await page.waitForTimeout(2000);
  
  console.log('Finding user Sanobar...');
  try {
    // Need to login first or start a call?
    // Wait, if I'm not logged in, I can't see the call screen!
    console.log('Current URL:', page.url());
  } catch (e) {
    console.log(e);
  }
  
  await browser.close();
})();
