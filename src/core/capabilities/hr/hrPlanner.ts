import { WorkflowSDK } from '@/core/sdk/WorkflowSDK';
import { LeaveRequestArtifact } from './types';

// Stage 1: Intake (Extracts dates and reason from user prompt)
const leaveIntakeStage = WorkflowSDK.createStage(
  'leave_intake',
  'Leave Intake',
  [],
  async (ctx) => {
    // If not provided in state, ask user
    if (!ctx.state.leavePrompt) {
      ctx.state.pendingQuestion = "What dates do you want to take leave for, and what is the reason?";
      throw new Error("PAUSED_FOR_INPUT");
    }

    // In a real implementation, we route through AI Runtime to extract dates
    // For now, we mock the extraction
    const artifactId = crypto.randomUUID();
    ctx.artifacts.leaveRequest = WorkflowSDK.createArtifact<LeaveRequestArtifact>('LeaveRequestArtifact', {
      employeeId: ctx.state.employeeId || 'E123',
      employeeName: ctx.state.employeeName || 'Arshid Wani',
      leaveType: 'CASUAL',
      startDate: '2026-08-01',
      endDate: '2026-08-05',
      reason: ctx.state.leavePrompt,
      status: 'PENDING',
      managerId: 'M001'
    }, 'AIRuntime');
  }
);

// Stage 2: Policy Validation (Uses PolicyEngine)
const policyValidationStage = WorkflowSDK.createStage(
  'policy_validation',
  'Policy Validation',
  ['leave_intake'],
  async (ctx) => {
    const leaveReq = ctx.artifacts.leaveRequest as LeaveRequestArtifact;
    
    // Using WorkflowSDK to call policy engine
    const decision = await WorkflowSDK.evaluatePolicy('hr', 'leave_application', {
      leaveType: leaveReq.leaveType,
      durationDays: 5
    });

    ctx.state.policyDecision = decision;
    if (decision.decision === 'Reject') {
      leaveReq.status = 'REJECTED';
      throw new Error(`Policy Rejected: ${decision.reason}`);
    }
  }
);

// Stage 3: Manager Approval
const managerApprovalStage = WorkflowSDK.createStage(
  'manager_approval',
  'Manager Approval',
  ['policy_validation'],
  async (ctx) => {
    const leaveReq = ctx.artifacts.leaveRequest as LeaveRequestArtifact;
    
    // Simulate pausing for manager interaction
    if (!ctx.state.managerApproved) {
      ctx.state.pendingQuestion = "Waiting for manager approval...";
      throw new Error("PAUSED_FOR_APPROVAL");
    }

    leaveReq.status = 'APPROVED';
  }
);

// Stage 4: HRMS Sync
const hrmsSyncStage = WorkflowSDK.createStage(
  'hrms_sync',
  'HRMS Synchronization',
  ['manager_approval'],
  async (ctx) => {
    // Look up MockHRProvider
    // Simulate syncing
    console.log("[HRMS] Leave successfully synced.");
  }
);

export const hrCapability = WorkflowSDK.createCapability(
  'hr', 
  [leaveIntakeStage, policyValidationStage, managerApprovalStage, hrmsSyncStage],
  (intent) => ({
    id: crypto.randomUUID(),
    type: 'hr',
    state: intent.parameters || {},
    artifacts: {},
    policies: {}
  })
);
