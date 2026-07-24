import { GoogleGenAI } from '@google/genai';

export interface DiscoveryResult {
  developerPortal: string | null;
  signup: string | null;
  documentation: string | null;
  openApiUrl?: string;
  sdkLanguages?: string[];
  oauthDocsUrl?: string;
}

export class ProviderDiscovery {
  private aiClient: GoogleGenAI | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.aiClient = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Simulates Web Search & Crawling using the LLM to discover portal URLs 
   * since hardcoding URLs is forbidden in the V2 catalog.
   */
  async discover(providerName: string): Promise<DiscoveryResult> {
    console.log(`[ProviderDiscovery] Simulating web search for ${providerName} developer portals...`);
    
    if (!this.aiClient) {
      console.warn('[ProviderDiscovery] No AI client available. Returning empty discovery.');
      return { developerPortal: null, signup: null, documentation: null };
    }

    const prompt = `
      You are an API discovery engine.
      Find the most likely primary Developer Portal URL, Signup URL, and Documentation URL for the Indian company/service: "${providerName}".
      Also guess if they provide OpenAPI specs or SDKs.
      
      Respond in strict JSON format:
      {
        "developerPortal": "url",
        "signup": "url",
        "documentation": "url",
        "openApiUrl": "url or null",
        "sdkLanguages": ["node", "python", ...],
        "oauthDocsUrl": "url or null"
      }
    `;

    try {
      const response = await this.aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      const text = response.text?.trim() || '{}';
      // Strip markdown code blocks if any
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(jsonStr) as DiscoveryResult;
      return result;
    } catch (e) {
      console.error(`[ProviderDiscovery] Failed to discover ${providerName}:`, e);
      return { developerPortal: null, signup: null, documentation: null };
    }
  }
}
