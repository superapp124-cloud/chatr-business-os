import { supabase } from "@/integrations/supabase/client";
import { Contacts } from "@capacitor-community/contacts";
import { Device } from "@capacitor/device";
import { hashPhoneNumber, normalizePhoneNumber } from "@/utils/phoneHashUtil";

export interface IdentityResult {
  name: string;
  trustScore: number;
  sources: string[];
  location?: string;
  avatar?: string;
  tags: string[];
  isVerified: boolean;
  type?: 'personal' | 'business';
  status: 'searching' | 'partial' | 'complete' | 'not_found';
  spamReports?: number;
}

export type ResearchCallback = (result: Partial<IdentityResult>) => void;

export const intelligenceService = {
  async resolveIdentity(number: string, onUpdate?: ResearchCallback): Promise<IdentityResult> {
    const digits = number.replace(/\D/g, '');
    const normalized = normalizePhoneNumber(number) || digits;
    
    if (digits.length < 5) {
      return {
        name: "Invalid Number",
        trustScore: 0,
        sources: [],
        tags: [],
        isVerified: false,
        status: 'not_found'
      };
    }

    let result: IdentityResult = {
      name: "Searching...",
      trustScore: 50,
      sources: [],
      tags: [],
      isVerified: false,
      status: 'searching'
    };

    // Stage 1: Local Phonebook Check (Instant)
    try {
      const info = await Device.getInfo();
      if (info.platform !== 'web') {
        const { contacts } = await Contacts.getContacts({
          projection: { name: true, phones: true }
        });
        
        const localMatch = contacts.find(c => 
          c.phones?.some(p => p.number?.replace(/\D/g, '').includes(digits) || digits.includes(p.number?.replace(/\D/g, '') || ''))
        );

        if (localMatch) {
          result = {
            ...result,
            name: localMatch.name?.display || "Contact",
            status: 'partial',
            sources: [...result.sources, 'Local Phonebook'],
            trustScore: 99,
            isVerified: true
          };
          onUpdate?.(result);
        }
      }
    } catch (e) {
      console.warn("[Intelligence] Local contacts check failed", e);
    }

    // Stage 2: Supabase Global Lookup (Hashed)
    onUpdate?.({ name: 'Querying Global Registry...' });
    try {
      const hashed = await hashPhoneNumber(normalized);
      const { data: lookup, error } = await supabase.rpc('lookup_caller_id', {
        p_hashed_number: hashed,
        p_raw_number: normalized
      });

      if (!error && lookup) {
        result = {
          ...result,
          name: lookup.name !== 'Unknown Caller' ? lookup.name : result.name,
          trustScore: lookup.trust_score,
          spamReports: lookup.spam_reports,
          status: 'partial',
          sources: [...result.sources, 'Chatr Global Network'],
          isVerified: lookup.trust_score > 80
        };
        
        if (lookup.spam_reports > 0) {
          result.tags = [...result.tags, `Spam (${lookup.spam_reports} reports)`];
        }
        
        onUpdate?.(result);
      }
    } catch (e) {
      console.warn("[Intelligence] Global registry lookup failed", e);
    }

    // Stage 3: Deep AI Research (Real Multi-Source Web Search)
    // Only perform deep research if identity is still uncertain or if explicitly requested
    if (result.trustScore < 90) {
      onUpdate?.({ name: 'Performing Deep AI Research...' });
      try {
        const { data, error } = await supabase.functions.invoke('ai-browser-search', {
          body: { 
            query: `Identify owner of phone number ${normalized} or ${digits}. Search for business, professional profiles, or social footprint.`,
            category: 'tech' 
          }
        });

        if (!error && data?.summary) {
          // Parse summary for name/type info
          const summary = data.summary as string;
          const isBusiness = summary.toLowerCase().includes('business') || summary.toLowerCase().includes('services');
          
          result = {
            ...result,
            name: result.name === 'Searching...' || result.name === 'Unknown Caller' ? (summary.split('.')[0].substring(0, 40)) : result.name,
            status: 'complete',
            sources: [...result.sources, 'AI Web Research'],
            tags: [...result.tags, isBusiness ? 'Business' : 'Personal'],
            type: isBusiness ? 'business' : 'personal',
            trustScore: Math.min(result.trustScore + 20, 95)
          };
          onUpdate?.(result);
        }
      } catch (e) {
        console.warn("[Intelligence] Deep AI research failed", e);
      }
    }

    result.status = 'complete';
    onUpdate?.(result);
    return result;
  }
};
