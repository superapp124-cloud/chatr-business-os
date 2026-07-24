import { WorkflowSDK } from '@/core/sdk/WorkflowSDK';
import { eventBus } from '@/core/runtime/EventBus';
import { providerRegistry } from '@/core/providers/ProviderRegistry';
import { IAIProvider } from '@/core/ai/providers/IAIProvider';
import { ModelRouter } from '@/core/ai/runtime/ModelRouter';
import { complianceEngine } from '@/core/services/ComplianceEngine';
import {
  ReceiptArtifact, ExpenseArtifact, InvoiceArtifact,
  PurchaseOrderArtifact, LedgerEntryArtifact,
  MonetaryValue, AuditEntry, formatMoney
} from './types';

// ─────────────────────────────────────────────────────────────
// Stage 1: Receipt Parse
// Uses: AI extractStructuredData primitive
// ─────────────────────────────────────────────────────────────
const receiptParseStage = WorkflowSDK.createStage(
  'receipt_parse',
  'Receipt Parse',
  [],
  async (ctx) => {
    const aiProviders = providerRegistry.getProvidersByTypeAndRole('ai', 'AIProvider') as unknown as IAIProvider[];
    const { provider } = await ModelRouter.route('extractStructuredData', aiProviders);

    const rawText = ctx.state.receiptText || 'Swiggy Instamart receipt: ₹850.00 (Groceries, 2026-07-10)';
    const response = await provider.extractStructuredData<any>(rawText, 'Receipt');
    
    // AI classify primitive for category
    const categoryResponse = await provider.classify(rawText, ['TRAVEL', 'MEALS', 'SOFTWARE', 'OFFICE', 'MARKETING', 'OTHER']);

    ctx.artifacts.receipt = WorkflowSDK.createArtifact<ReceiptArtifact>('ReceiptArtifact', {
      merchantName: response.result?.merchantName || 'Swiggy Instamart',
      date: response.result?.date || new Date().toISOString().split('T')[0],
      lineItems: response.result?.lineItems || [{ description: 'Groceries', amount: { amount: 850, currency: 'INR', precision: 2 } }],
      totalAmount: { amount: response.result?.totalAmount || 850, currency: 'INR', precision: 2 },
      category: categoryResponse.result.category,
      rawText
    }, provider.id);
  }
);

// ─────────────────────────────────────────────────────────────
// Stage 2: Expense Submission (with Compliance + Policy checks)
// ─────────────────────────────────────────────────────────────
const expenseSubmissionStage = WorkflowSDK.createStage(
  'expense_submission',
  'Expense Submission',
  ['receipt_parse'],
  async (ctx) => {
    const receipt = ctx.artifacts.receipt as ReceiptArtifact;
    const idempotencyKey = `exp-${ctx.state.employeeId || 'E123'}-${receipt.id}`;

    // Compliance check first
    const compliance = complianceEngine.evaluate('finance', 'expense_submission', {
      idempotencyKey,
      amount: receipt.totalAmount
    });

    if (!compliance.compliant) {
      throw new Error(`Compliance failed: ${compliance.rules.filter(r => !r.passed).map(r => r.rule).join(', ')}`);
    }

    // Policy check for approval tier
    const policy = await WorkflowSDK.evaluatePolicy('finance', 'expense_approval', {
      amount: receipt.totalAmount.amount,
      category: receipt.category
    });

    const initialAuditEntry: AuditEntry = {
      timestamp: Date.now(),
      actor: ctx.state.employeeName || 'Arshid Wani',
      action: 'EXPENSE_SUBMITTED',
      workflowId: ctx.id,
      artifactId: receipt.id,
      artifactVersion: 1,
      policyVersion: 'v1.0',
      rationale: policy.reason
    };

    ctx.artifacts.expense = WorkflowSDK.createArtifact<ExpenseArtifact>('ExpenseArtifact', {
      employeeId: ctx.state.employeeId || 'E123',
      employeeName: ctx.state.employeeName || 'Arshid Wani',
      receiptId: receipt.id,
      category: receipt.category as any || 'OTHER',
      amount: receipt.totalAmount,
      policyStatus: policy.decision === 'AutoApproved' ? 'WITHIN_LIMIT' : 'REQUIRES_APPROVAL',
      status: policy.decision === 'AutoApproved' ? 'APPROVED' : 'SUBMITTED',
      idempotencyKey,
      auditTrail: [initialAuditEntry]
    }, 'PolicyEngine', [receipt.id]);

    ctx.state.policyDecision = policy;
  }
);

// ─────────────────────────────────────────────────────────────
// Stage 3: Finance Approval (handles manager/CFO approval tier)
// ─────────────────────────────────────────────────────────────
const financeApprovalStage = WorkflowSDK.createStage(
  'finance_approval',
  'Finance Approval',
  ['expense_submission'],
  async (ctx) => {
    const expense = ctx.artifacts.expense as ExpenseArtifact;
    
    // Skip if auto-approved
    if (expense.policyStatus === 'WITHIN_LIMIT') return;

    if (!ctx.state.approvalGranted) {
      ctx.state.pendingQuestion = `Expense of ${formatMoney(expense.amount)} requires ${ctx.state.policyDecision?.decision}. Waiting for approval...`;
      throw new Error('PAUSED_FOR_APPROVAL');
    }

    const approvalEntry: AuditEntry = {
      timestamp: Date.now(),
      actor: ctx.state.approver || 'Finance Manager',
      action: 'EXPENSE_APPROVED',
      workflowId: ctx.id,
      artifactId: expense.id,
      artifactVersion: expense.version,
      policyVersion: 'v1.0',
      rationale: `Approved by ${ctx.state.approver || 'Finance Manager'}`
    };

    expense.status = 'APPROVED';
    expense.auditTrail = complianceEngine.appendAuditEntry(expense.auditTrail, approvalEntry);
  }
);

// ─────────────────────────────────────────────────────────────
// Stage 4: Invoice Generation (also triggered via EventBus from CRM)
// ─────────────────────────────────────────────────────────────
const invoiceGenerationStage = WorkflowSDK.createStage(
  'invoice_generation',
  'Invoice Generation',
  ['finance_approval'],
  async (ctx) => {
    // Idempotency: if triggered by CRM, use the opportunity ID as idempotency key
    const idempotencyKey = ctx.state.triggeredByOpportunityId
      ? `inv-opp-${ctx.state.triggeredByOpportunityId}`
      : `inv-exp-${ctx.artifacts.expense?.id || crypto.randomUUID()}`;

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const amount: MonetaryValue = ctx.state.invoiceAmount || 
      ctx.artifacts.expense?.amount || 
      { amount: 10000, currency: 'INR', precision: 2 };

    const tax: MonetaryValue = { amount: Math.round(amount.amount * 0.18), currency: 'INR', precision: 2 };
    const total: MonetaryValue = { amount: amount.amount + tax.amount, currency: 'INR', precision: 2 };

    const compliance = complianceEngine.evaluate('finance', 'invoice_generation', {
      idempotencyKey,
      amount,
      dueDate: ctx.state.invoiceDueDate || '2026-08-10'
    });

    if (!compliance.compliant) throw new Error('Invoice compliance check failed.');

    const auditEntry: AuditEntry = {
      timestamp: Date.now(),
      actor: 'FinanceEngine',
      action: 'INVOICE_GENERATED',
      workflowId: ctx.id,
      artifactId: invoiceNumber,
      artifactVersion: 1,
      policyVersion: 'v1.0',
      rationale: ctx.state.triggeredByOpportunityId
        ? `Auto-generated from CRM deal close (Opportunity: ${ctx.state.triggeredByOpportunityId})`
        : 'Expense-triggered invoice generation'
    };

    ctx.artifacts.invoice = WorkflowSDK.createArtifact<InvoiceArtifact>('InvoiceArtifact', {
      invoiceNumber,
      triggeredByOpportunityId: ctx.state.triggeredByOpportunityId,
      clientName: ctx.state.clientName || 'Acme Corp',
      lineItems: [{ description: 'Professional Services', quantity: 1, unitPrice: amount }],
      subtotal: amount,
      taxAmount: tax,
      totalAmount: total,
      dueDate: ctx.state.invoiceDueDate || '2026-08-10',
      status: 'DRAFT',
      idempotencyKey,
      auditTrail: [auditEntry]
    }, 'FinanceEngine', ctx.artifacts.expense ? [ctx.artifacts.expense.id] : []);
  }
);

// ─────────────────────────────────────────────────────────────
// Stage 5: Ledger Entry + Cross-Domain Notification
// ─────────────────────────────────────────────────────────────
const ledgerEntryStage = WorkflowSDK.createStage(
  'ledger_entry',
  'Ledger Entry',
  ['invoice_generation'],
  async (ctx) => {
    const invoice = ctx.artifacts.invoice as InvoiceArtifact;

    ctx.artifacts.ledgerEntry = WorkflowSDK.createArtifact<LedgerEntryArtifact>('LedgerEntryArtifact', {
      entryType: 'DEBIT',
      amount: invoice.totalAmount,
      accountCode: 'AR-1001',
      description: `Invoice ${invoice.invoiceNumber} — ${invoice.clientName}`,
      referenceId: invoice.id,
      timestamp: Date.now(),
      isReconciled: false
    }, 'FinanceEngine', [invoice.id]);

    // Update invoice to SENT
    invoice.status = 'SENT';

    // Cross-domain: if triggered by CRM, notify CRM that invoice is sent
    if (ctx.state.triggeredByOpportunityId) {
      eventBus.publish('FINANCE_INVOICE_SENT', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        opportunityId: ctx.state.triggeredByOpportunityId,
        totalAmount: invoice.totalAmount,
        // Support workflow can subscribe to this to activate customer onboarding
        trigger: 'ACTIVATE_CUSTOMER_SUPPORT'
      });
    }

    // Emit audit event to Timeline
    eventBus.publish('ACTIVITY_LOGGED', {
      domain: 'finance',
      event: 'INVOICE_SENT',
      entityId: invoice.id,
      summary: `Invoice ${invoice.invoiceNumber} sent — ${formatMoney(invoice.totalAmount)}`,
      timestamp: Date.now()
    });
  }
);

// ─────────────────────────────────────────────────────────────
// Finance Capability: Assembled via WorkflowSDK
// Listen for CRM events to auto-spawn workflows
// ─────────────────────────────────────────────────────────────

// Subscribe to CRM cross-domain events
eventBus.subscribe('CRM_DEAL_CLOSED_WON', (event: any) => {
  const payload = event.payload || event;
  if (payload.trigger === 'CREATE_INVOICE') {
    console.log(`[FinanceCapability] CRM_DEAL_CLOSED_WON received. Auto-spawning Invoice workflow for Opportunity ${payload.opportunityId}`);
    
    // In a full implementation, this would use the ConversationEngine
    // to spawn a new workflow context in the user's session.
    // For now, we publish a notification that the UI can act on.
    eventBus.publish('FINANCE_WORKFLOW_TRIGGERED', {
      reason: 'CRM deal closed',
      opportunityId: payload.opportunityId,
      clientName: payload.clientName || 'Client',
      invoiceAmount: { amount: payload.totalValue, currency: payload.currency || 'INR', precision: 2 }
    });
  }
});

export const financeCapability = WorkflowSDK.createCapability(
  'finance',
  [
    receiptParseStage,
    expenseSubmissionStage,
    financeApprovalStage,
    invoiceGenerationStage,
    ledgerEntryStage
  ],
  (intent) => ({
    id: crypto.randomUUID(),
    type: 'finance',
    state: intent.parameters || {},
    artifacts: {},
    policies: {}
  })
);
