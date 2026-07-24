const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Catch console logs and errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('BROWSER ERROR:', msg.text());
    } else {
      console.log('BROWSER LOG:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.error('BROWSER PAGE ERROR:', err.toString());
  });

  try {
    await page.goto('http://localhost:5173/desktop/chat', { waitUntil: 'networkidle0', timeout: 10000 });
  } catch (e) {
    console.error('Navigation error:', e.message);
  }
  
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
