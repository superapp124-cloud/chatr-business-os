import { FormField } from '../browser/BrowserAutomationProvider.js';
import { CompanyProfile } from '../vault/ProviderVault.js';
// Note: Assuming a generic AI provider exists or we use an LLM API directly
import { GoogleGenAI } from '@google/genai';

export class FormIntelligence {
  private aiClient: GoogleGenAI | null = null;
  
  // Level 1: Known Mappings
  private exactMappings: Record<string, keyof CompanyProfile> = {
    'company': 'companyName',
    'companyname': 'companyName',
    'organization': 'companyName',
    'legal entity': 'legalName',
    'legalname': 'legalName',
    'registered company': 'legalName',
    'mobile': 'supportPhone',
    'phone': 'supportPhone',
    'contact number': 'supportPhone',
    'primary number': 'supportPhone',
    'email': 'developerEmail',
    'developer email': 'developerEmail',
    'gstin': 'gst',
    'gst': 'gst',
    'pan': 'pan',
    'address': 'address',
    'website': 'website',
  };

  constructor(apiKey?: string) {
    if (apiKey) {
      this.aiClient = new GoogleGenAI({ apiKey });
    }
  }

  private normalizeString(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // Level 2: Semantic/Fuzzy Matching
  private semanticMatch(fieldLabel: string): keyof CompanyProfile | null {
    const normalized = this.normalizeString(fieldLabel);
    
    for (const [key, profileKey] of Object.entries(this.exactMappings)) {
      const normalizedKey = this.normalizeString(key);
      if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
        return profileKey as keyof CompanyProfile;
      }
    }
    return null;
  }

  // Level 3: AI Classification
  private async aiClassify(fieldLabel: string, fieldType: string): Promise<keyof CompanyProfile | null> {
    if (!this.aiClient) return null;
    try {
      const prompt = `Map the form field label "${fieldLabel}" (type: ${fieldType}) to one of the following keys from a Company Profile:
      [companyName, legalName, gst, pan, cin, address, supportEmail, developerEmail, website, privacyPolicy, terms, supportPhone]
      Respond ONLY with the exact key name, or "UNKNOWN" if none match.`;
      
      const response = await this.aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      
      const result = response.text?.trim() || 'UNKNOWN';
      if (result !== 'UNKNOWN') {
        return result as keyof CompanyProfile;
      }
    } catch (e) {
      console.warn('AI Classification failed for field:', fieldLabel, e);
    }
    return null;
  }

  /**
   * Matches an array of detected fields to the Company Profile.
   * Returns a map of field IDs to their intended values.
   */
  async matchFields(fields: FormField[], profile: CompanyProfile): Promise<Record<string, string>> {
    const formData: Record<string, string> = {};

    for (const field of fields) {
      const identifier = field.label || field.placeholder || field.name || field.id;
      if (!identifier) continue;

      let matchedKey: keyof CompanyProfile | null = null;

      // Level 1: Known Mapping
      matchedKey = this.exactMappings[identifier.toLowerCase()] || null;

      // Level 2: Semantic Matching
      if (!matchedKey) {
        matchedKey = this.semanticMatch(identifier);
      }

      // Level 3: AI Classification
      if (!matchedKey && this.aiClient) {
        matchedKey = await this.aiClassify(identifier, field.type);
      }

      if (matchedKey && profile[matchedKey]) {
        formData[field.id || field.name] = profile[matchedKey] as string;
      }
    }

    return formData;
  }
}
