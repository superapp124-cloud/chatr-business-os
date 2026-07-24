import { EventBus } from './EventBusService.js';
import { ISystemEvent } from '../types.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

class SystemApprovalEngine {
  constructor() {
    // Listen for workflows that pause and request approval
    EventBus.subscribe('ApprovalRequested', this.handleApprovalRequested.bind(this));
  }

  private async handleApprovalRequested(event: ISystemEvent) {
    console.log(`[ApprovalEngine] Received approval request for Intent: ${event.payload.intentId}`);
    
    // In a real system, we would:
    // 1. Evaluate who the approver is based on ObjectRegistry permissions or organizational hierarchy.
    // 2. Create a 'task' or 'approval_request' UWO assigned to that approver.
    // 3. Emit a notification event so they get pinged.

    // For now, we simulate an auto-approval to prevent the system from getting permanently stuck during testing.
    setTimeout(async () => {
      console.log(`[ApprovalEngine] Auto-approving request for Intent: ${event.payload.intentId}`);
      
      await EventBus.publish({
        eventType: 'ApprovalGranted',
        payload: { 
          intentId: event.payload.intentId,
          action: event.payload.action,
          originalPayload: event.payload.payload
        },
        source: 'ApprovalEngine',
        actorId: 'system', // the approver
        tenantId: event.tenantId
      });
    }, 5000); // 5 second mock delay
  }
}

export const ApprovalEngine = new SystemApprovalEngine();
