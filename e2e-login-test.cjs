const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    await page.goto('http://localhost:8080');
    console.log('Navigated to localhost:8080');
    
    // Wait for the phone number input
    await page.waitForSelector('input[type="tel"]', { timeout: 5000 });
    console.log('Found phone number input');
    
    await page.fill('input[type="tel"]', '9999999999');
    
    // Assuming there's a next/login button
    await page.click('button[type="submit"]');
    console.log('Clicked submit on phone number');
    
    // Wait for password or OTP input
    await page.waitForTimeout(2000);
    
    // Try to fill password if it exists
    const hasPassword = await page.$('input[type="password"]');
    if (hasPassword) {
      console.log('Found password input, trying 123456...');
      await page.fill('input[type="password"]', '123456');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      
      const isError = await page.$('text="Invalid login credentials"');
      if (isError) {
        console.log('Error: Invalid login credentials with 123456');
      } else {
        console.log('Successfully submitted password!');
      }
    } else {
      console.log('No password input found. Maybe OTP?');
      // Dump page text to see what's on screen
      const text = await page.evaluate(() => document.body.innerText);
      console.log('Page text:', text.substring(0, 200));
    }
    
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  await browser.close();
})();
