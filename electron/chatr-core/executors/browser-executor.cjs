'use strict';

/**
 * CHATR Kernel v2.0 — Browser Runtime
 * 
 * Generic browser execution platform that executes declarative workflows,
 * observes browser state, emits structured events, and extracts normalized data.
 * The Browser Runtime MUST NEVER contain provider-specific logic.
 */

const log = (() => {
  try { return require('electron-log'); } catch { return console; }
})();

let playwright = null;
let playwrightAvailable = false;

try {
  playwright = require('playwright');
  playwrightAvailable = true;
  log.info('[BrowserRuntime] Playwright loaded successfully.');
} catch {
  log.warn('[BrowserRuntime] Playwright not available — will use connector simulation.');
}

// ── Event Stream ─────────────────────────────────────────────────────────────
class EventStream {
  constructor(onStep) {
    this.onStep = onStep || (() => {});
  }

  emit(phase, data = {}) {
    this.onStep({ step: 'execution:browser_step', detail: { phase, ...data } });
  }
}

// ── Page Intelligence ────────────────────────────────────────────────────────
class PageIntelligence {
  async analyze(page) {
    // Inject a script to analyze the page state
    const state = await page.evaluate(() => {
      const url = window.location.href;
      const hasPasswords = !!document.querySelector('input[type="password"]');
      const hasCaptcha = !!document.querySelector('iframe[src*="captcha"], img[src*="captcha"]');
      const isError = !!document.querySelector('.error, .alert-danger, [role="alert"]');
      
      let pageType = 'unknown';
      if (hasPasswords) pageType = 'login';
      else if (hasCaptcha) pageType = 'captcha';
      else if (isError) pageType = 'error';
      else if (url.includes('search') || document.querySelector('input[type="text"]')) pageType = 'search';
      
      return { url, pageType, hasCaptcha };
    });
    return state;
  }
}

// ── DOM Observer ─────────────────────────────────────────────────────────────
class DOMObserver {
  constructor(page) {
    this.page = page;
  }
  
  async waitForState(state, timeout = 5000) {
    await this.page.waitForLoadState('domcontentloaded');
  }
}

// ── Extraction Engine ────────────────────────────────────────────────────────
class ExtractionEngine {
  constructor(page, selectors) {
    this.page = page;
    this.selectors = selectors;
  }

  async extract(targetName, asName) {
    const selector = this.selectors[targetName];
    if (!selector) throw new Error(`Selector not found for target: ${targetName}`);
    
    try {
      if (asName === 'options') {
        const elements = await this.page.$$(selector);
        const results = [];
        for (const el of elements) {
          const text = await el.innerText();
          results.push(text);
        }
        return results;
      }
      return await this.page.innerHTML(selector);
    } catch (e) {
      log.warn(`[ExtractionEngine] Failed to extract ${selector}: ${e.message}`);
      return null;
    }
  }
}

// ── Action Engine ────────────────────────────────────────────────────────────
class ActionEngine {
  constructor(page, selectors, eventStream) {
    this.page = page;
    this.selectors = selectors;
    this.eventStream = eventStream;
  }

  resolveValue(val, parameters) {
    if (!val || typeof val !== 'string') return val;
    return val.replace(/\{\{([^}]+)\}\}/g, (_, key) => parameters[key] || '');
  }

  async executeStep(stepObj, parameters) {
    const { step, target, value, timeout } = stepObj;
    const selector = this.selectors[target] || target; 
    const resolvedValue = this.resolveValue(value, parameters);
    
    const startTime = Date.now();
    let success = true;

    try {
      this.eventStream.emit('action_start', { action: step, target, value: resolvedValue });
      
      switch (step) {
        case 'navigate':
          await this.page.goto(resolvedValue || selector, { waitUntil: 'domcontentloaded' });
          break;
        case 'fill':
          await this.page.fill(selector, resolvedValue);
          break;
        case 'type_and_select':
          await this.page.fill(selector, '');
          await this.page.type(selector, resolvedValue, { delay: 100 });
          await this.page.waitForTimeout(1500);
          await this.page.keyboard.press('ArrowDown');
          await this.page.waitForTimeout(200);
          await this.page.keyboard.press('Enter');
          break;
        case 'click':
          await this.page.click(selector, { timeout: timeout || 30000 });
          break;
        case 'wait':
          if (timeout) {
             await this.page.waitForSelector(selector, { state: 'visible', timeout });
          } else {
             await this.page.waitForTimeout(2000);
          }
          break;
        case 'extract':
          break;
        default:
          log.warn(`[ActionEngine] Unknown step type: ${step}`);
      }
    } catch (e) {
      success = false;
      throw e;
    } finally {
      this.eventStream.emit('action_complete', { 
        action: step, 
        target, 
        value: resolvedValue, 
        success, 
        duration: Date.now() - startTime 
      });
    }
  }
}

// ── Browser Runtime ──────────────────────────────────────────────────────────
class BrowserExecutor {
  constructor() {
    this.name = 'BrowserRuntime';
  }

  async executeWorkflow(manifest, workflowSteps, selectors, parameters, onStep = () => {}) {
    if (!playwrightAvailable) {
      log.warn(`[BrowserRuntime] Playwright unavailable, returning simulation fallback.`);
      return { status: 'failed', reason: 'Playwright not installed', fallback: true };
    }

    const eventStream = new EventStream(onStep);
    let browser = null;
    let context = null;

    try {
      eventStream.emit('browser_launch', { browser: 'chromium', headless: false });
      
      browser = await playwright.chromium.launch({ headless: false });
      context = await browser.newContext({ userAgent: 'Mozilla/5.0 (CHATR-Bot/2.0 BrowserRuntime)' });
      const page = await context.newPage();

      const intelligence = new PageIntelligence();
      const observer = new DOMObserver(page);
      const actionEngine = new ActionEngine(page, selectors, eventStream);
      const extractionEngine = new ExtractionEngine(page, selectors);

      const extractedData = {};

      for (let i = 0; i < workflowSteps.length; i++) {
        const stepDef = workflowSteps[i];
        
        const pageState = await intelligence.analyze(page);
        
        if (pageState.pageType === 'login') {
          eventStream.emit('pause_for_login', { url: pageState.url });
          log.info('[BrowserRuntime] Login detected. Pausing for 5 seconds...');
          await page.waitForTimeout(5000);
        }

        if (stepDef.step === 'extract') {
           const data = await extractionEngine.extract(stepDef.target, stepDef.as);
           if (data) extractedData[stepDef.as] = data;
        } else {
           await actionEngine.executeStep(stepDef, parameters);
        }
      }

      eventStream.emit('workflow_complete', { status: 'success' });
      return { status: 'success', data: extractedData, fallback: false };

    } catch (err) {
      log.error(`[BrowserRuntime] Workflow execution failed:`, err);
      eventStream.emit('workflow_error', { error: err.message });
      return { status: 'error', error: err.message, fallback: true };
    } finally {
      if (context) { try { await context.close(); } catch { /* ignore */ } }
      if (browser) { try { await browser.close(); } catch { /* ignore */ } }
    }
  }

  async execute(connector, session, task, parameters, onStep = () => {}) {
    const manifest = connector && typeof connector.getManifest === 'function' ? connector.getManifest() : null;
    
    if (connector && typeof connector.getWorkflow === 'function' && typeof connector.getSelectors === 'function') {
      const workflow = connector.getWorkflow(task);
      const selectors = connector.getSelectors();
      if (workflow && selectors) {
        const providerId = parameters.provider || (manifest && manifest.providers ? manifest.providers[0].id : null);
        const providerSelectors = selectors[providerId] || {};
        
        if (providerSelectors.searchUrl) {
           providerSelectors.searchUrl = providerSelectors.searchUrl; 
        }

        const result = await this.executeWorkflow(manifest, workflow, providerSelectors, parameters, onStep);
        if (!result.fallback) {
          if (result.status === 'success') {
             if (connector && typeof connector.simulateTask === 'function') {
                return await connector.simulateTask(task, parameters);
             }
          }
          return result;
        }
      }
    }

    return this._simulateFallback(connector, task, parameters, onStep);
  }

  async _simulateFallback(connector, task, parameters, onStep) {
    onStep({ step: 'execution:browser_step', detail: { phase: 'simulation_fallback', message: 'Delegating to simulation' } });
    if (connector && typeof connector.simulateTask === 'function') {
      return connector.simulateTask(task, parameters);
    }
    return { simulated: true, task, result: {} };
  }
}

const browserExecutor = new BrowserExecutor();
module.exports = { browserExecutor, BrowserExecutor };
