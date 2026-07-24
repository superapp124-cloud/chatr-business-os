import { WorkflowSDK } from '@/core/sdk/WorkflowSDK';
import { IWorkflowContext } from '@/core/runtime/PipelineEngine';

/**
 * Gate 6: Platform Extensibility Proof
 * 
 * Procurement / Vendor Management Capability
 * Built entirely using the SDK and public contracts without modifying the kernel.
 * 
 * Flow:
 * 1. extract_vendor_details -> Extract info from quote document.
 * 2. validate_vendor -> Check vendor against compliance policies.
 * 3. request_budget_approval -> Request approval from finance.
 * 4. generate_purchase_order -> Generate PO artifact.
 */
export function createProcurementWorkflow() {
  const stage1 = WorkflowSDK.createStage(
    'extract_vendor_details',
    'Extract Vendor and Quote Details',
    [],
    async (ctx: IWorkflowContext) => {
      ctx.state.vendorName = 'Acme Corp';
      ctx.state.quoteAmount = 15000;
      WorkflowSDK.log(ctx, 'Extracted quote details from vendor document');
    }
  );

  const stage2 = WorkflowSDK.createStage(
    'validate_vendor',
    'Check Vendor Compliance',
    ['extract_vendor_details'],
    async (ctx: IWorkflowContext) => {
      // Simulate calling a mock compliance API provider
      if (ctx.state.vendorName === 'Acme Corp') {
        ctx.state.vendorApproved = true;
        WorkflowSDK.log(ctx, 'Vendor compliance check passed');
      } else {
        throw new Error('Vendor compliance check failed');
      }
    }
  );

  const stage3 = WorkflowSDK.createStage(
    'request_budget_approval',
    'Request Finance Approval',
    ['validate_vendor'],
    async (ctx: IWorkflowContext) => {
      // Simulate waiting for a human/finance approval
      WorkflowSDK.log(ctx, `Requesting approval for ${ctx.state.quoteAmount}`);
      ctx.state.budgetApproved = true; 
    }
  );

  const stage4 = WorkflowSDK.createStage(
    'generate_purchase_order',
    'Generate Purchase Order Artifact',
    ['request_budget_approval'],
    async (ctx: IWorkflowContext) => {
      ctx.artifacts['PO-12345'] = {
        id: 'PO-12345',
        type: 'purchase_order',
        content: `PO for ${ctx.state.vendorName} - Amount: $${ctx.state.quoteAmount}`,
        version: 1
      };
      WorkflowSDK.log(ctx, 'Purchase Order generated');
    }
  );

  return WorkflowSDK.createCapability(
    'Procurement / Vendor Management',
    [stage1, stage2, stage3, stage4],
    () => ({
      id: crypto.randomUUID(),
      type: 'procurement',
      state: {},
      artifacts: {},
      policies: {}
    })
  );
}
