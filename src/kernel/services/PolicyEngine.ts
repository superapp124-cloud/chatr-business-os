import { randomUUID } from '../utils/id';
import type { Policy, PolicyId, PolicyDraft, PolicyAction } from '../abi/v1';

export class PolicyEngine {
  private policies = new Map<PolicyId, Policy>();

  public register(draft: PolicyDraft): PolicyId {
    const id = `pol_${randomUUID()}` as PolicyId;
    const policy: Policy = { ...draft, id };
    this.policies.set(id, policy);
    return id;
  }

  public evaluate(action: PolicyAction): 'allow' | 'deny' | 'escalate' {
    const applicable = Array.from(this.policies.values())
      .filter(p => !p.expiresAt || p.expiresAt > Date.now())
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    for (const policy of applicable) {
      const matches = this.policyMatches(policy, action);
      if (matches) {
        if (policy.effect !== 'allow') {
          return policy.effect;
        }
      }
    }

    return 'allow';
  }

  public getMatchedPolicy(action: PolicyAction): Policy | undefined {
      const applicable = Array.from(this.policies.values())
      .filter(p => !p.expiresAt || p.expiresAt > Date.now())
      .sort((a, b) => b.priority - a.priority);

    for (const policy of applicable) {
      if (this.policyMatches(policy, action)) {
        return policy;
      }
    }
    return undefined;
  }

  private policyMatches(policy: Policy, action: PolicyAction): boolean {
    return policy.conditions.every(condition => {
      const value = this.extractField(condition.field, action);
      if (value === undefined) return false;

      switch (condition.operator) {
        case 'eq':  return value === condition.value;
        case 'neq': return value !== condition.value;
        case 'gt':  return typeof value === 'number' && value > (condition.value as number);
        case 'lt':  return typeof value === 'number' && value < (condition.value as number);
        case 'gte': return typeof value === 'number' && value >= (condition.value as number);
        case 'lte': return typeof value === 'number' && value <= (condition.value as number);
        case 'in':  return Array.isArray(condition.value) && (condition.value as unknown[]).includes(value);
        case 'contains': return typeof value === 'string' && value.includes(condition.value as string);
        default:    return false;
      }
    });
  }

  private extractField(field: string, action: PolicyAction): unknown {
    const parts = field.split('.');
    let obj: unknown = action;
    for (const part of parts) {
      if (obj == null || typeof obj !== 'object') return undefined;
      obj = (obj as Record<string, unknown>)[part];
    }
    return obj;
  }
}
