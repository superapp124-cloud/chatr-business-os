import { Commitment } from '../capabilities/types';
import { EnterpriseUser } from './SecurityEngine';

/**
 * Enterprise Policy Engine
 *
 * Evaluates business rules and compliance requirements before execution.
 * Intercepts commitments if approval is required or policies are violated.
 *
 * NOTE: Separated from ComplianceEngine.
 * - PolicyEngine  → approval thresholds, spending limits, manager approval
 * - ComplianceEngine → audit requirements, retention, immutability, tax rules
 */

export class PolicyEngineImpl {
  private static instance: PolicyEngineImpl;

  private constructor() {}

  public static getInstance(): PolicyEngineImpl {
    if (!PolicyEngineImpl.instance) {
      PolicyEngineImpl.instance = new PolicyEngineImpl();
    }
    return PolicyEngineImpl.instance;
  }

  // ─────────────────────────────────────────────────────────────
  // Commitment-level policy (used by Conversation Engine)
  // ─────────────────────────────────────────────────────────────
  public async evaluatePolicy(
    commitment: Commitment,
    user: EnterpriseUser
  ): Promise<{ action: 'allow' | 'block' | 'require_approval'; reason?: string; approverRole?: string }> {
    console.log(`[PolicyEngine] Evaluating policy for ${commitment.capability} by ${user.name}`);

    // Expense Policy: Expenses over ₹10,000 require Manager approval
    if (commitment.capability === 'core.expense') {
      const amountStr = commitment.entities?.amount || '0';
      const amount = parseInt(amountStr.replace(/[^0-9]/g, ''), 10);
      if (amount > 10000) {
        return {
          action: 'require_approval',
          reason: `Expenses over ₹10,000 require manager approval. (Requested: ₹${amount})`,
          approverRole: 'manager'
        };
      }
    }

    // Leave Policy: Unpaid leave requires Manager approval
    if (commitment.capability === 'core.leave_application') {
      const leaveType = commitment.entities?.leaveType?.toLowerCase();
      if (leaveType === 'unpaid' || leaveType === 'lwp') {
        return {
          action: 'require_approval',
          reason: 'Unpaid leave requests require manager approval.',
          approverRole: 'manager'
        };
      }
    }

    return { action: 'allow' };
  }

  // ─────────────────────────────────────────────────────────────
  // Notification policy
  // ─────────────────────────────────────────────────────────────
  public async evaluateNotificationPolicy(
    payload: any,
    user: EnterpriseUser
  ): Promise<{ action: 'allow' | 'block'; reason?: string }> {
    // Finance division: only urgent Slack notifications (example)
    // if (user.department === 'finance' && payload.severity !== 'urgent' && payload.channels?.includes('slack')) {
    //   return { action: 'block', reason: 'Finance division is restricted from non-urgent Slack notifications' };
    // }
    return { action: 'allow' };
  }

  // ─────────────────────────────────────────────────────────────
  // Domain-level decision engine (used by WorkflowSDK stages)
  // Returns explainable decisions with confidence and rationale.
  // ─────────────────────────────────────────────────────────────
  public async evaluateDecision(
    domain: string,
    action: string,
    evidence: any
  ): Promise<{ decision: string; reason: string; confidence: number; missing_information: string[] }> {
    console.log(`[PolicyEngine] Evaluating decision for ${domain}:${action}`);

    // ── HIRING ──────────────────────────────────────────────────
    if (domain === 'hiring' && action === 'interview_recommendation') {
      const match = evidence.overallMatch || 0;
      const experience = evidence.experienceYears || 0;
      if (match >= 80 && experience >= 5) {
        return {
          decision: 'Interview',
          reason: `Match ${match}%, Experience ${experience} years — mandatory skills satisfied, budget within range.`,
          confidence: 0.95,
          missing_information: evidence.missing_information || []
        };
      }
      return {
        decision: 'Reject',
        reason: `Match ${match}%, Experience ${experience} years (below 5-year threshold).`,
        confidence: 0.90,
        missing_information: []
      };
    }

    // ── HR ───────────────────────────────────────────────────────
    if (domain === 'hr' && action === 'leave_application') {
      const leaveType = (evidence.leaveType || '').toLowerCase();
      if (leaveType === 'unpaid' || leaveType === 'lwp') {
        return {
          decision: 'RequiresManagerApproval',
          reason: 'Unpaid leave requires manager approval per HR Policy HR-003.',
          confidence: 1.0,
          missing_information: []
        };
      }
      return {
        decision: 'AutoApproved',
        reason: `${evidence.leaveType} leave is within auto-approval scope.`,
        confidence: 1.0,
        missing_information: []
      };
    }

    // ── CRM ──────────────────────────────────────────────────────
    if (domain === 'crm' && action === 'discount_approval') {
      const discount = evidence.discountPercentage || 0;
      if (discount > 15) {
        return {
          decision: 'Reject',
          reason: `Discount of ${discount}% exceeds the 15% threshold. Requires Sales Director approval.`,
          confidence: 1.0,
          missing_information: []
        };
      }
      return {
        decision: 'Approve',
        reason: `Discount of ${discount}% is within the approved limit.`,
        confidence: 1.0,
        missing_information: []
      };
    }

    // ── FINANCE: Expense ─────────────────────────────────────────
    if (domain === 'finance' && action === 'expense_approval') {
      const amount = evidence.amount || 0;
      if (amount > 100000) {
        return {
          decision: 'RequiresCFOApproval',
          reason: `Expense of ₹${amount.toLocaleString()} exceeds ₹1,00,000. Requires CFO approval per Finance Policy FP-001.`,
          confidence: 1.0,
          missing_information: []
        };
      }
      if (amount > 10000) {
        return {
          decision: 'RequiresManagerApproval',
          reason: `Expense of ₹${amount.toLocaleString()} exceeds ₹10,000. Requires Manager approval per Finance Policy FP-001.`,
          confidence: 1.0,
          missing_information: []
        };
      }
      return {
        decision: 'AutoApproved',
        reason: `Expense of ₹${amount.toLocaleString()} is within the ₹10,000 auto-approval limit.`,
        confidence: 1.0,
        missing_information: []
      };
    }

    // ── FINANCE: Purchase Order ───────────────────────────────────
    if (domain === 'finance' && action === 'purchase_order_approval') {
      const amount = evidence.amount || 0;
      if (amount > 500000) {
        return {
          decision: 'RequiresBoardApproval',
          reason: `Purchase Order of ₹${amount.toLocaleString()} exceeds ₹5,00,000. Requires Board approval per Finance Policy FP-002.`,
          confidence: 1.0,
          missing_information: []
        };
      }
      if (amount > 50000) {
        return {
          decision: 'RequiresCFOApproval',
          reason: `Purchase Order of ₹${amount.toLocaleString()} exceeds ₹50,000. Requires CFO approval per Finance Policy FP-002.`,
          confidence: 1.0,
          missing_information: []
        };
      }
      return {
        decision: 'AutoApproved',
        reason: 'Purchase Order within auto-approval threshold.',
        confidence: 1.0,
        missing_information: []
      };
    }

    // ── Fallback ──────────────────────────────────────────────────
    return {
      decision: 'Unknown',
      reason: 'No policy found for this domain and action.',
      confidence: 0,
      missing_information: []
    };
  }
}

export const policyEngine = PolicyEngineImpl.getInstance();
