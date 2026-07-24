const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  let electronApp;
  try {
    console.log('Launching Electron...');
    electronApp = await electron.launch({ args: ['.'], executablePath: require('electron') });
    
    console.log('Getting main window...');
    const window = await electronApp.firstWindow();
    const artifactsDir = 'C:\\Users\\Arshid.Wani\\.gemini\\antigravity\\brain\\5551a0ba-3447-4727-a06e-32bedd1a0e06';
    
    console.log('Navigating to /hero...');
    await window.goto('http://localhost:8086/hero');
    await window.waitForLoadState('networkidle');
    await window.waitForTimeout(3000); 

    // 1. Initial State
    await window.screenshot({ path: path.join(artifactsDir, 'screenshot_1_initial.png') });
    console.log('Took screenshot 1');

    // 2. Type Train intent
    const inputSelector = 'input[placeholder="What would you like to do?"]';
    await window.waitForSelector(inputSelector);
    await window.fill(inputSelector, 'book a train to mumbai');
    await window.screenshot({ path: path.join(artifactsDir, 'screenshot_2_typing_train.png') });
    console.log('Took screenshot 2');
    await window.press(inputSelector, 'Enter');

    // 3. Wait for Train Results
    await window.waitForTimeout(6000);
    await window.screenshot({ path: path.join(artifactsDir, 'screenshot_3_train_results.png') });
    console.log('Took screenshot 3');

    // 4. Click "Choose This" on the first option
    const chooseThisBtn = 'button:has-text("Choose This")';
    await window.waitForSelector(chooseThisBtn);
    await window.click(chooseThisBtn);
    await window.waitForTimeout(1000);
    await window.screenshot({ path: path.join(artifactsDir, 'screenshot_4_checkout_panel.png') });
    console.log('Took screenshot 4');

    // 5. Click "Pay X - Place Order"
    const payBtn = 'button:has-text("Place Order")';
    await window.waitForSelector(payBtn);
    await window.click(payBtn);
    await window.waitForTimeout(1000); // Wait for transition
    
    // 6. Wait a bit in Tracking panel to see the dynamic steps
    await window.waitForTimeout(4000); 
    await window.screenshot({ path: path.join(artifactsDir, 'screenshot_5_tracking_panel.png') });
    console.log('Took screenshot 5');

    await electronApp.close();
    console.log('All tests finished successfully.');
  } catch (err) {
    console.error('Error:', err);
    if (electronApp) await electronApp.close();
    process.exit(1);
  }
})();
