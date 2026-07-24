/**
 * CHATR OS — Kernel Policy Engine
 * Intercepts actions to evaluate business rules and conditions.
 */

import { IPolicy } from '../types';

export const PolicyEngine = {
  /**
   * Evaluates if an action on a record violates any policies.
   * Returns a policy effect if triggered, or null if allowed.
   */
  evaluate(
    policies: IPolicy[],
    objectId: string,
    actionContext: 'update' | 'delete' | 'transition',
    record: Record<string, any>
  ): IPolicy | null {
    if (!policies || policies.length === 0) return null;

    // Filter policies for this object
    const objectPolicies = policies.filter(p => p.object === objectId);

    for (const policy of objectPolicies) {
      // Very basic AST/Condition evaluator for the ABI demo
      // e.g., condition: "Amount > 500000" or "Salary > 5000000"
      if (this.evaluateCondition(policy.condition, record)) {
        return policy;
      }
    }

    return null;
  },

  /**
   * Extremely simple condition evaluator for V1 ABI.
   * Expects format: "FieldName Operator Value" e.g., "Amount > 5000"
   */
  evaluateCondition(condition: string, record: Record<string, any>): boolean {
    try {
      const match = condition.match(/^(\w+)\s*(>|<|==|>=|<=|!=)\s*(.+)$/);
      if (!match) return false;

      const [, field, operator, valueStr] = match;
      const recordValue = record[field];
      if (recordValue === undefined) return false;

      const numRecordVal = Number(recordValue);
      const numTargetVal = Number(valueStr);
      
      const isNum = !isNaN(numRecordVal) && !isNaN(numTargetVal);
      
      const v1 = isNum ? numRecordVal : String(recordValue).toLowerCase();
      const v2 = isNum ? numTargetVal : String(valueStr).toLowerCase();

      switch (operator) {
        case '>': return v1 > v2;
        case '<': return v1 < v2;
        case '>=': return v1 >= v2;
        case '<=': return v1 <= v2;
        case '==': return v1 === v2;
        case '!=': return v1 !== v2;
        default: return false;
      }
    } catch (e) {
      console.warn('Failed to evaluate policy condition:', condition);
      return false;
    }
  },

  getPolicies(capabilityId: string): IPolicy[] {
    const sdk = (window as any).__CHATR_SDK_REGISTRY__?.[capabilityId];
    return sdk?.policies || [];
  }
};
