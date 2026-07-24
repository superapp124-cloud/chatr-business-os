import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  console.log('🚀 Starting headless WebRTC test to capture browser logs...');
  
  const browserArgs = [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream'
  ];

  const browser1 = await chromium.launch({ headless: true, args: browserArgs });
  const context1 = await browser1.newContext({ permissions: ['microphone', 'camera'] });
  const page1 = await context1.newPage();

  const logs = [];
  page1.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page1.on('pageerror', error => {
    logs.push(`[PAGE ERROR] ${error.message}`);
  });

  try {
    console.log('🔗 Navigating to Chatr local server...');
    await page1.goto('http://localhost:8080/ai-browser-home');
    
    console.log('⏳ Waiting for load...');
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('⌨️ Typing search query...');
    await page1.keyboard.type('test query');
    await page1.keyboard.press('Enter');

    console.log('⏳ Waiting 5 seconds to collect search logs...');
    await new Promise(r => setTimeout(r, 5000));

    // Save logs to file
    fs.writeFileSync('browser-logs.txt', logs.join('\n'));
    console.log('✅ Logs saved to browser-logs.txt');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser1.close();
  }
})();
