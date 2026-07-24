/**
 * Finance Domain — Core Types
 *
 * Design principles enforced here:
 * 1. MonetaryValue — money is never a plain number
 * 2. All artifacts are immutable and versioned
 * 3. Idempotency keys on every external action
 * 4. Audit metadata on every state transition
 */

import { BaseArtifact } from '../hr/types';

// ─────────────────────────────────────────────────────────────
// Monetary Value Object
// ─────────────────────────────────────────────────────────────
export interface MonetaryValue {
  amount: number;
  currency: 'INR' | 'USD' | 'EUR' | 'GBP';
  precision: 2;
  exchangeRate?: number; // relative to base currency (INR)
}

export function formatMoney(value: MonetaryValue): string {
  const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  return `${symbols[value.currency] || value.currency}${value.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

// ─────────────────────────────────────────────────────────────
// Audit Entry — every financial transition
// ─────────────────────────────────────────────────────────────
export interface AuditEntry {
  timestamp: number;
  actor: string;
  action: string;
  workflowId: string;
  artifactId: string;
  artifactVersion: number;
  policyVersion: string;
  aiMetadata?: { model: string; confidence: number; reasoning: string };
  rationale: string;
}

// ─────────────────────────────────────────────────────────────
// Finance Artifacts (all immutable & versioned)
// ─────────────────────────────────────────────────────────────

export interface ReceiptArtifact extends BaseArtifact {
  type: 'ReceiptArtifact';
  merchantName: string;
  date: string;
  lineItems: Array<{ description: string; amount: MonetaryValue }>;
  totalAmount: MonetaryValue;
  category?: string; // filled by AI classify()
  rawText?: string;
}

export interface ExpenseArtifact extends BaseArtifact {
  type: 'ExpenseArtifact';
  employeeId: string;
  employeeName: string;
  receiptId: string;
  category: 'TRAVEL' | 'MEALS' | 'SOFTWARE' | 'OFFICE' | 'MARKETING' | 'OTHER';
  amount: MonetaryValue;
  policyStatus: 'WITHIN_LIMIT' | 'EXCEEDS_LIMIT' | 'REQUIRES_APPROVAL';
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID';
  idempotencyKey: string; // Prevents duplicate submissions
  auditTrail: AuditEntry[];
}

export interface InvoiceArtifact extends BaseArtifact {
  type: 'InvoiceArtifact';
  invoiceNumber: string;
  triggeredByOpportunityId?: string; // Cross-domain link to CRM
  clientName: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: MonetaryValue }>;
  subtotal: MonetaryValue;
  taxAmount: MonetaryValue;
  totalAmount: MonetaryValue;
  dueDate: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  idempotencyKey: string;
  auditTrail: AuditEntry[];
}

export interface PurchaseOrderArtifact extends BaseArtifact {
  type: 'PurchaseOrderArtifact';
  vendorName: string;
  department: string;
  items: Array<{ description: string; quantity: number; unitPrice: MonetaryValue }>;
  totalAmount: MonetaryValue;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  idempotencyKey: string;
  auditTrail: AuditEntry[];
}

export interface LedgerEntryArtifact extends BaseArtifact {
  type: 'LedgerEntryArtifact';
  entryType: 'DEBIT' | 'CREDIT';
  amount: MonetaryValue;
  accountCode: string;
  description: string;
  referenceId: string; // Invoice or PO ID
  timestamp: number;
  isReconciled: boolean;
}
