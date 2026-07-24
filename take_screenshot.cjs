const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  try {
    console.log('Launching Electron...');
    const electronApp = await electron.launch({
      executablePath: path.join(__dirname, 'node_modules', '.bin', 'electron.cmd'),
      args: ['.', '--remote-debugging-port=9222']
    });

    console.log('Getting main window...');
    // Get the first window that the app creates, which is the main window.
    const window = await electronApp.firstWindow();

    console.log('Waiting for app to load...');
    await window.waitForLoadState('networkidle');
    await window.waitForTimeout(3000);

    console.log('Typing intent...');
    const inputSelector = 'input[placeholder="What do you want to do?"]';
    await window.waitForSelector(inputSelector);
    await window.fill(inputSelector, 'find hotel in goa , book a ytaing');
    await window.press(inputSelector, 'Enter');

    console.log('Waiting for execution to complete...');
    await window.waitForTimeout(6000);

    console.log('Taking screenshot...');
    const artifactsDir = path.join(process.env.APPDATA, '..', 'Local', 'Temp', 'antigravity', 'artifacts');
    // I will save the screenshot directly to the chat's artifact directory so it can be embedded.
    // The current artifact directory is:
    // C:\Users\Arshid.Wani\.gemini\antigravity\brain\5551a0ba-3447-4727-a06e-32bedd1a0e06
    const destPath = 'C:\\Users\\Arshid.Wani\\.gemini\\antigravity\\brain\\5551a0ba-3447-4727-a06e-32bedd1a0e06\\screenshot.png';
    await window.screenshot({ path: destPath });

    console.log('Screenshot saved to', destPath);

    await electronApp.close();
    console.log('Done.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
