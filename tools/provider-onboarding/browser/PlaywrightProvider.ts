import { Browser, BrowserContext, Page, chromium } from 'playwright';
import { BrowserAutomationProvider, FormField } from './BrowserAutomationProvider.js';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import fs from 'fs/promises';

export class PlaywrightProvider implements BrowserAutomationProvider {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private aiClient: GoogleGenAI | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.aiClient = new GoogleGenAI({ apiKey });
    }
  }

  async open(url: string): Promise<void> {
    this.browser = await chromium.launch({ headless: false });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    await this.page.goto(url);
  }

  async navigate(url: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized.');
    await this.page.goto(url);
  }

  async detectForm(): Promise<FormField[]> {
    if (!this.page) throw new Error('Browser not initialized.');
    
    // KYC / Manual Review Detection
    const pageText = await this.page.evaluate(() => document.body.innerText.toLowerCase());
    const manualReviewKeywords = ['video kyc', 'sign agreement', 'upload pan', 'pending approval', 'contact sales'];
    for (const keyword of manualReviewKeywords) {
      if (pageText.includes(keyword)) {
        throw new Error(`[MANUAL_REVIEW] Detected manual verification requirement: ${keyword}`);
      }
    }

    const fields = await this.page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
      return inputs.map((el) => {
        const input = el as HTMLInputElement;
        let labelText = '';
        if (input.id) {
          const labelEl = document.querySelector(`label[for="${input.id}"]`);
          if (labelEl) labelText = labelEl.textContent?.trim() || '';
        }
        if (!labelText) {
          const parentLabel = input.closest('label');
          if (parentLabel) labelText = parentLabel.textContent?.trim() || '';
        }
        return {
          id: input.id || '',
          name: input.name || '',
          type: input.type || input.tagName.toLowerCase(),
          label: labelText,
          placeholder: input.placeholder || '',
          value: input.value || '',
        };
      });
    });
    return fields;
  }

  async fill(data: Record<string, any>): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized.');
    
    for (const [key, value] of Object.entries(data)) {
      const selector = `input[name="${key}"], select[name="${key}"], textarea[name="${key}"], input[id="${key}"], select[id="${key}"], textarea[id="${key}"]`;
      try {
        const locator = this.page.locator(selector).first();
        if (await locator.isVisible({ timeout: 2000 })) {
          await locator.fill(String(value));
        } else {
          throw new Error('Element not visible');
        }
      } catch (e) {
        console.warn(`[Self-Healing] Could not fill field: ${key}. Attempting AI DOM analysis...`);
        await this.selfHealFill(key, String(value));
      }
    }
  }

  /**
   * Self-Healing Mechanism:
   * DOM Changed -> Screenshot -> Extract HTML -> AI Analysis -> Update Mapping -> Continue
   */
  private async selfHealFill(fieldKey: string, value: string): Promise<void> {
    if (!this.page || !this.aiClient) return;
    try {
      const screenshotPath = path.join(process.cwd(), `tools/provider-onboarding/browser/debug_${fieldKey}.png`);
      await this.page.screenshot({ path: screenshotPath });
      
      const domSlice = await this.page.evaluate(() => document.body.innerHTML.substring(0, 15000));
      
      const prompt = `
        The form field intended for "${fieldKey}" could not be found via standard selectors.
        Here is a slice of the HTML DOM:
        \`\`\`html
        ${domSlice}
        \`\`\`
        Identify the correct CSS selector (e.g. #new-id or [name="new-name"]) that corresponds to "${fieldKey}".
        Respond ONLY with the exact CSS selector string, or "UNKNOWN".
      `;
      
      const response = await this.aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      
      const newSelector = response.text?.trim();
      if (newSelector && newSelector !== 'UNKNOWN') {
        console.log(`[Self-Healing] AI mapped "${fieldKey}" to new selector: ${newSelector}`);
        await this.page.locator(newSelector).first().fill(value);
      }
    } catch (e) {
      console.warn(`[Self-Healing] Failed to self-heal field ${fieldKey}:`, e);
    }
  }

  async upload(filePaths: string[]): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized.');
    const locator = this.page.locator('input[type="file"]').first();
    await locator.setInputFiles(filePaths);
  }

  async screenshot(path: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized.');
    await this.page.screenshot({ path, fullPage: true });
  }

  async extract(selector?: string): Promise<any> {
    if (!this.page) throw new Error('Browser not initialized.');
    if (selector) {
      const locator = this.page.locator(selector);
      return await locator.allTextContents();
    }
    return await this.page.content();
  }

  async wait(condition: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized.');
    await this.page.waitForSelector(condition);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
