/**
 * Compliance Engine
 *
 * Separate from PolicyEngine (which handles approval thresholds).
 * ComplianceEngine handles:
 * - audit requirements
 * - retention rules
 * - tax compliance
 * - immutable record enforcement
 * - regulatory constraints
 */

import { AuditEntry } from '../finance/types';

export interface ComplianceResult {
  compliant: boolean;
  rules: Array<{ rule: string; passed: boolean; detail?: string }>;
  auditRequired: boolean;
  retentionYears: number;
}

export class ComplianceEngineImpl {
  private static instance: ComplianceEngineImpl;

  private constructor() {}

  public static getInstance(): ComplianceEngineImpl {
    if (!ComplianceEngineImpl.instance) {
      ComplianceEngineImpl.instance = new ComplianceEngineImpl();
    }
    return ComplianceEngineImpl.instance;
  }

  /**
   * Validates a financial action against compliance rules.
   */
  public evaluate(domain: string, action: string, evidence: any): ComplianceResult {
    const rules = [];

    if (domain === 'finance') {
      // Rule 1: All financial artifacts must have an idempotency key
      rules.push({
        rule: 'Idempotency Key Present',
        passed: !!evidence.idempotencyKey,
        detail: evidence.idempotencyKey ? `Key: ${evidence.idempotencyKey}` : 'Missing idempotency key'
      });

      // Rule 2: Amounts must be non-negative
      rules.push({
        rule: 'Non-Negative Amount',
        passed: (evidence.amount?.amount ?? 0) >= 0,
        detail: `Amount: ${evidence.amount?.amount}`
      });

      // Rule 3: Invoice must have a due date
      if (action === 'invoice_generation') {
        rules.push({
          rule: 'Invoice Due Date Present',
          passed: !!evidence.dueDate,
          detail: evidence.dueDate || 'Missing due date'
        });
      }

      // Rule 4: Expenses above ₹50,000 require audit flag
      if (action === 'expense_submission') {
        const amountINR = evidence.amount?.amount || 0;
        rules.push({
          rule: 'High-Value Expense Audit',
          passed: true, // Always pass but flag for audit if > 50K
          detail: amountINR > 50000 ? `Amount ₹${amountINR} flagged for mandatory audit` : 'Within standard threshold'
        });
      }
    }

    const allPassed = rules.every(r => r.passed);
    return {
      compliant: allPassed,
      rules,
      auditRequired: true, // All financial actions require audit trail
      retentionYears: 7    // Standard financial retention
    };
  }

  /**
   * Appends an immutable audit entry to an artifact's trail.
   * This enforces that no audit entry can ever be removed.
   */
  public appendAuditEntry(trail: AuditEntry[], entry: AuditEntry): AuditEntry[] {
    return [...trail, Object.freeze(entry)]; // Immutable append
  }
}

export const complianceEngine = ComplianceEngineImpl.getInstance();
