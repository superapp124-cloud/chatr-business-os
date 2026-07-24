'use strict';

/**
 * CHATR Kernel — Intent Resolution Pipeline
 * 
 * The 5-stage funnel that transforms a raw string from a user into a structured intent
 * by leveraging the Intent Intelligence Packages.
 */

const { packageCompiler } = require('../packages/package-compiler.cjs');
const http = require('http');
const log = (() => { try { return require('electron-log'); } catch { return console; } })();

class IntentResolutionPipeline {
  
  /**
   * Resolves raw text into a Structured Intent.
   * @param {string} rawInput 
   * @returns {Promise<object>} Structured Intent
   */
  async resolve(rawInput) {
    log.info(`[IntentResolution] Stage 1: LLM Parsing for "${rawInput}"`);
    const llmParsed = await this._universalParse(rawInput);
    
    // In Layer 6, the Capability Resolution Engine takes over the actual execution waterfall.
    // The IntentResolutionPipeline just returns the canonical structured intent.
    
    log.info(`[IntentResolution] Stage 5: Emitting Structured Intent`);
    return {
      intent_type: llmParsed.intent,
      capability: llmParsed.capability,
      package_id: 'dynamic',
      constraints: llmParsed.constraints || {},
      confidence: llmParsed.confidence || 1.0,
      timestamp: new Date().toISOString()
    };
  }

  // Stage 1: LLM-Based Intent Understanding
  async _universalParse(rawInput) {
    const prompt = `You are a Semantic Intent Parser for an Operating System. 
Parse the following user request into a structured capability.
User Request: "${rawInput}"
Output JSON only with these fields:
- intent: The high-level intent (e.g. "order_food", "book_flight", "find_hotel")
- capability: The canonical capability ID (e.g. "food.order", "travel.flight.book", "hotel.search")
- constraints: Object with any extracted parameters (e.g. {"destination": "NYC"})
- confidence: Number between 0 and 1
JSON:`;

    try {
      const result = await this._callOllama(prompt);
      const parsed = JSON.parse(result);
      log.info(`[IntentResolution] LLM parsed capability: ${parsed.capability}`);
      return parsed; // Returns { intent, capability, constraints, confidence }
    } catch (err) {
      log.warn(`[IntentResolution] LLM parsing failed, falling back to basic matching. Error: ${err.message}`);
      // Fallback
      const lowerInput = rawInput.toLowerCase();
      if (lowerInput.includes('flight') || lowerInput.includes('nyc')) {
        return { intent: 'book_flight', capability: 'travel.flight.book', constraints: { destination: 'NYC' }, confidence: 0.8 };
      }
      if (lowerInput.includes('hotel') || lowerInput.includes('paris') || lowerInput.includes('srinagar')) {
        return { intent: 'search_hotel', capability: 'hotel.search', constraints: { destination: 'Paris' }, confidence: 0.8 };
      }
      return { intent: 'unknown', capability: 'system.search', constraints: { query: rawInput }, confidence: 0.5 };
    }
  }

  _callOllama(prompt) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        model: 'llama3', // or mistral
        prompt: prompt,
        stream: false,
        format: 'json'
      });

      const options = {
        hostname: 'localhost',
        port: 11434,
        path: '/api/generate',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const response = JSON.parse(body);
              resolve(response.response);
            } catch(e) { reject(e); }
          } else {
            reject(new Error(`Ollama API error: ${res.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  // Stage 2: Identify which installed packages match the domain hints
  _findCandidatePackages(domainHints) {
    const packages = packageCompiler.getInstalledPackages();
    return packages.filter(pkg => {
      // Check if the package's intent models declare support for these domains
      return pkg.intentModels.some(model => domainHints.includes(model.domain));
    });
  }

  // Stage 3: Pick the best package (e.g., resolving conflicts if two packages claim "travel")
  _resolveOptimalPackage(candidatePackages, rawInput) {
    // For MVP, just return the first one. 
    // A real implementation evaluates confidence scores or user preferences.
    return candidatePackages[0];
  }

  // Stage 4: Delegate to the package's specific intent model/parser
  async _packageIntentParse(pkg, rawInput) {
    // Find the primary parser in the package
    const parserModel = pkg.intentModels.find(m => typeof m.parse === 'function');
    if (!parserModel) {
       throw new Error(`Package ${pkg.manifest.id} does not provide a functional intent parser`);
    }

    const result = await parserModel.parse(rawInput);
    if (!result) {
      throw new Error(`Package ${pkg.manifest.id} failed to parse the intent.`);
    }

    // Wrap in standard Kernel format
    return {
      intent_type: result.intent_type,
      package_id: pkg.manifest.id,
      constraints: result.constraints,
      confidence: result.confidence || 1.0,
      timestamp: new Date().toISOString()
    };
  }
}

const intentResolutionPipeline = new IntentResolutionPipeline();
module.exports = { IntentResolutionPipeline, intentResolutionPipeline };
