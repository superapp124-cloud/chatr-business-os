import { chromium } from 'playwright';

(async () => {
  console.log('🚀 Starting Automated AI Voice Test Pipeline...');
  
  // Launch two browsers with fake media streams enabled for WebRTC testing
  const browserArgs = [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--allow-file-access-from-files'
  ];

  console.log('🌐 Launching User 1 Browser...');
  const browser1 = await chromium.launch({ headless: false, args: browserArgs });
  const context1 = await browser1.newContext({ permissions: ['microphone', 'camera'] });
  const page1 = await context1.newPage();

  console.log('🌐 Launching User 2 (9999999999) Browser...');
  const browser2 = await chromium.launch({ headless: false, args: browserArgs });
  const context2 = await browser2.newContext({ permissions: ['microphone', 'camera'] });
  const page2 = await context2.newPage();

  try {
    // 1. Navigate both to the local app
    console.log('🔗 Navigating to Chatr local server...');
    await page1.goto('http://localhost:8080');
    await page2.goto('http://localhost:8080');

    // 2. We assume the user has a way to log in or we bypass it by setting localStorage if we knew the tokens.
    // For this test to run fully headless without auth pain, we would need to know the login flow.
    console.log('🛑 PAUSED: Please ensure both browsers are logged in, and User 1 calls User 2.');
    console.log('Waiting 15 seconds for manual login/call setup...');
    await new Promise(r => setTimeout(r, 15000));

    // 3. Click the AI button on Caller 1's screen
    console.log('🤖 Looking for AI Live button...');
    const aiButton = page1.locator('button').filter({ hasText: /^AILive$/ });
    if (await aiButton.isVisible().catch(() => false)) {
      console.log('✅ Found AI Button! Clicking it...');
      await aiButton.click();
      
      // 4. Wait for the status badge
      console.log('⏳ Waiting for Gemini Connection Badge...');
      const badge = page1.locator('text=Listening & Translating');
      await badge.waitFor({ state: 'visible', timeout: 10000 });
      console.log('🎉 SUCCESS: Gemini AI is fully connected and processing audio!');
    } else {
      console.log('❌ Could not find AI button. Are we in a call?');
    }

    console.log('✅ Test script finished. The browsers will remain OPEN for you to continue testing manually!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('✅ The browsers will remain OPEN for you to test manually!');
  }
})();
