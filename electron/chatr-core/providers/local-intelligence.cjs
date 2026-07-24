'use strict';

/**
 * CHATR Local Intelligence Provider
 * Capability: intelligence.summarize
 */

class LocalIntelligenceProvider {
  constructor() {
    this.name = 'LocalIntelligenceProvider';
  }

  async summarize(parameters) {
    // In a real local-first world, this uses Ollama or a fast small LLM (Phi-3).
    // For the WOW demo, if the execution graph passed the raw text, we simulate 
    // a 2-second LLM generation delay to show streaming UI progress.
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      summary: "Invoice #1042 for ABC Industries is for the amount of $4,500. Payment terms are Net 30, due by Friday.",
      model: "phi-3-mini-4k-instruct-q4"
    };
  }
}

module.exports = { LocalIntelligenceProvider };
