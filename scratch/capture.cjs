const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function run() {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();
    
    const outDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir);
    }
    
    const routes = [
        { name: 'desktop_chat', url: 'http://localhost:8086/#/desktop/chat' },
        { name: 'workflow_studio', url: 'http://localhost:8086/#/desktop/studio' },
        { name: 'kernel_dashboard', url: 'http://localhost:8086/#/desktop/kernel' },
        { name: 'business_dashboard', url: 'http://localhost:8086/#/desktop/pro/business/dashboard' }
    ];
    
    for (const route of routes) {
        console.log(`Capturing ${route.name}...`);
        try {
            await page.goto(route.url, { waitUntil: 'networkidle', timeout: 30000 });
            // Wait an extra second for React animations/rendering
            await page.waitForTimeout(2000);
            await page.screenshot({ path: path.join(outDir, `${route.name}.png`) });
            console.log(`Saved ${route.name}.png`);
        } catch (err) {
            console.error(`Failed to capture ${route.name}:`, err.message);
        }
    }
    
    await browser.close();
    console.log('Done!');
}

run();
