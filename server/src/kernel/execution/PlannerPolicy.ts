import { ExecutionContext, ExecutionPlan } from '../../types.js';

export class PlannerPolicy {
  /**
   * Enforces rules before Workflow Runtime.
   * e.g., "Starter plans cannot execute this capability"
   */
  static evaluate(context: ExecutionContext, plan: ExecutionPlan, capabilityId: string): boolean {
    const tenant = context.tenant;
    
    // Policy 1: Is capability enabled?
    const capConfig = tenant.enabledCapabilities.find(c => c.id === capabilityId);
    if (tenant.tenantId !== 'system' && !capConfig?.enabled) {
      console.warn(`[PlannerPolicy] Policy Denied: Capability ${capabilityId} disabled for tenant.`);
      return false;
    }

    // Policy 2: Quota check (simplified)
    if (tenant.tenantId !== 'system' && tenant.plan === 'Starter' && capabilityId.startsWith('Finance.')) {
      console.warn(`[PlannerPolicy] Policy Denied: Finance capabilities require Enterprise plan.`);
      return false;
    }

    // Policy 3: Workflow constraints
    if (capabilityId === 'Finance.Expense' && context.resolvedIntent?.action === 'ApproveExpense') {
      if (!tenant.roles.includes('Manager') && !tenant.roles.includes('Admin')) {
        console.warn(`[PlannerPolicy] Policy Denied: ApproveExpense requires Manager role.`);
        return false;
      }
    }

    return true; // Passed all policies
  }
}
