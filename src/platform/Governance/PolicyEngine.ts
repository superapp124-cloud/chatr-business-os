import { supabase } from '@/integrations/supabase/client';

export type PolicyEnforcement = 'allow' | 'warn' | 'require_approval' | 'delay' | 'rate_limit' | 'quarantine' | 'block' | 'audit';
export type PolicyScope = 'global' | 'organization' | 'workspace' | 'workflow' | 'capability' | 'plugin' | 'user';

// Hierarchy order — lower index = evaluated first
const SCOPE_PRIORITY: PolicyScope[] = ['global', 'organization', 'workspace', 'workflow', 'capability', 'plugin', 'user'];

export interface PolicyViolation {
  policy_id: string;
  policy_name: string;
  scope: PolicyScope;
  enforcement: PolicyEnforcement;
  message: string;
}

export interface PolicyEvaluationContext {
  tenant_id?: string;
  workflow_id?: string;
  capability?: string;
  plugin_id?: string;
  user_id?: string;
  payload?: Record<string, any>;
}

export interface PolicyGateResult {
  allowed: boolean;
  violations: PolicyViolation[];
  require_approval: boolean;
  delay_seconds?: number;
}

class PolicyEngineImpl {
  /**
   * Evaluates all applicable policies in strict hierarchy order:
   * Global → Organization → Workspace → Workflow → Capability → Plugin → User
   *
   * A 'block' or 'quarantine' enforcement immediately returns { allowed: false }.
   * Never throws — any DB error is caught and treated as a passing gate.
   */
  async evaluate(context: PolicyEvaluationContext): Promise<PolicyGateResult> {
    const result: PolicyGateResult = { allowed: true, violations: [], require_approval: false };

    try {
      const { data: policies, error } = await supabase
        .from('org_policies')
        .select('*')
        .eq('enabled', true)
        .order('priority', { ascending: true }); // Lower priority number = first

      if (error || !policies || policies.length === 0) return result;

      // Filter policies relevant to this evaluation context
      const relevant = policies.filter((p: any) => {
        if (p.tenant_id && p.tenant_id !== context.tenant_id) return false;
        if (p.workflow_id && p.workflow_id !== context.workflow_id) return false;
        if (p.capability && p.capability !== context.capability) return false;
        return true;
      });

      // Sort by scope hierarchy
      relevant.sort((a: any, b: any) => {
        const aIdx = SCOPE_PRIORITY.indexOf(a.scope as PolicyScope);
        const bIdx = SCOPE_PRIORITY.indexOf(b.scope as PolicyScope);
        return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
      });

      for (const policy of relevant) {
        const enforcement = policy.enforcement as PolicyEnforcement;
        const matched = this.evaluateRule(policy.rule, context);
        if (!matched) continue;

        const violation: PolicyViolation = {
          policy_id: policy.id,
          policy_name: policy.name,
          scope: policy.scope as PolicyScope,
          enforcement,
          message: `Policy '${policy.name}' (${policy.scope}) — enforcement: ${enforcement}`,
        };

        switch (enforcement) {
          case 'block':
          case 'quarantine':
            result.violations.push(violation);
            result.allowed = false;
            return result; // Hard stop — no further evaluation

          case 'require_approval':
            result.require_approval = true;
            result.violations.push(violation);
            break;

          case 'delay':
            result.delay_seconds = Math.max(result.delay_seconds ?? 0, policy.delay_seconds ?? 0);
            result.violations.push(violation);
            break;

          case 'warn':
          case 'audit':
          case 'rate_limit':
            result.violations.push(violation);
            break;

          case 'allow':
          default:
            break; // Explicit allow — no violation recorded
        }
      }
    } catch (err: any) {
      // Safety-first: if policy evaluation fails, DO NOT block execution
      // but log for audit
      console.error('[PolicyEngine] evaluate error — defaulting to allow:', err.message);
    }

    return result;
  }

  /**
   * Evaluates a jsonb policy rule against the current execution context.
   * Returns true if the rule is TRIGGERED (i.e., the violation condition is met).
   */
  private evaluateRule(rule: Record<string, any>, context: PolicyEvaluationContext): boolean {
    if (!rule || typeof rule !== 'object') return false;

    const type = rule.type as string;

    switch (type) {
      case 'capability_limit':
        // Rule: { type: 'capability_limit', capabilities: ['sms', 'email'], max: 5 }
        // Triggers if the context capability is in the blocked list
        return Array.isArray(rule.blocked) && context.capability
          ? rule.blocked.includes(context.capability)
          : false;

      case 'network_destination':
        // Rule: { type: 'network_destination', blocked: ['api.openai.com'] }
        // Triggers if a blocked destination appears in the payload
        if (!Array.isArray(rule.blocked) || !context.payload) return false;
        const payloadStr = JSON.stringify(context.payload).toLowerCase();
        return rule.blocked.some((d: string) => payloadStr.includes(d.toLowerCase()));

      case 'plugin_restriction':
        return rule.blocked_plugins && context.plugin_id
          ? rule.blocked_plugins.includes(context.plugin_id)
          : false;

      case 'always':
        return true; // Policy always fires (useful for audit-only policies)

      default:
        return false; // Unknown rule types do not trigger violations
    }
  }
}

export const PolicyEngine = new PolicyEngineImpl();
