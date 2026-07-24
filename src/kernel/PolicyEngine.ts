import { CapabilityType } from './CapabilityRegistry';
import { supabase } from '@/integrations/supabase/client'; // Assuming standard supabase client location

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  providerToUse?: string;
}

export class PolicyEngine {
  /**
   * Checks the organization's policies to determine if a specific capability/provider is allowed.
   */
  static async evaluateCapabilityPolicy(
    organizationId: string, 
    capabilityType: CapabilityType, 
    requestedProvider: string
  ): Promise<PolicyDecision> {
    
    try {
      const { data, error } = await supabase
        .from('sys_ai_policies')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('capability_type', capabilityType)
        .single();

      if (error || !data) {
        // Default secure posture: allow if no policy explicitly denies, or deny?
        // For OS, usually default to deny if enterprise, but we'll allow requested for MVP.
        return { allowed: true, providerToUse: requestedProvider };
      }

      if (data.preferred_provider === requestedProvider) {
        return { allowed: true, providerToUse: requestedProvider };
      }

      if (data.fallback_allowed && data.fallback_provider === requestedProvider) {
         return { allowed: true, providerToUse: requestedProvider };
      }

      if (!data.fallback_allowed) {
        return { 
          allowed: false, 
          reason: `Policy restricts ${capabilityType} to provider ${data.preferred_provider}. Fallbacks disabled.` 
        };
      }

      // If requested isn't preferred or fallback, force preferred
      return { allowed: true, providerToUse: data.preferred_provider, reason: 'Enforced preferred provider.' };

    } catch (err) {
      console.error('Policy evaluation failed', err);
      return { allowed: false, reason: 'Internal policy evaluation error.' };
    }
  }
}
