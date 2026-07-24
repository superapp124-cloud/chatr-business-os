import { ExecutionContext } from '../../types.js';
import { EventBus } from '../../services/EventBusService.js';
import { getTenantSupabaseClient } from '../../utils/supabaseClient.js';
import { TenantContextManager } from '../tenant/TenantContextManager.js';

export class SystemOutcomeTracker {
  private isMock = false;

  setMockMode(mock: boolean) {
    this.isMock = mock;
  }
  
  /**
   * Closes the loop on the ExecutionContext.
   */
  async track(context: ExecutionContext): Promise<ExecutionContext> {
    console.log(`[OutcomeTracker] Finalizing Outcome for Context ${context.id}`);
    
    // In a mature system, this writes to an 'os_outcomes' table used by the Learning Engine.
    // For this slice, we update the original 'os_intents' record with the final state.
    
    const isSuccess = context.state === 'Completed';

    if (this.isMock || process.env.VITE_SUPABASE_ANON_KEY === 'dummy') {
      console.log(`[OutcomeTracker] Mock Finalizing Outcome for Context ${context.id}`);
    } else {
      try {
       if (!this.isMock) {
        const tenantContext = TenantContextManager.getContextOrThrow();
        const supabase = getTenantSupabaseClient(tenantContext.tenant);
        
        const { error } = await supabase
          .from('os_intents')
          .update({ 
            status: isSuccess ? 'completed' : 'failed',
            execution_log: {
              observations: context.observations,
              resolvedIntent: context.resolvedIntent,
              executionPlan: context.executionPlan
            }
          })
          .eq('id', context.id);
        
        if (error) console.error('[OutcomeTracker] Failed to persist event to DB:', error);
       }
      } catch (err: any) {
        if (err.message?.includes('fetch failed')) {
           console.warn(`[OutcomeTracker] Supabase offline. Mock Outcome Finalized for Context ${context.id}`);
        } else {
           console.error('[OutcomeTracker] Failed to persist event to DB:', err);
        }
      }
    }

    try {
      await EventBus.publish({
        eventType: 'OutcomeRecorded',
        payload: {
          contextId: context.id,
          success: isSuccess,
          capability: context.resolvedIntent?.capability
        },
        source: 'OutcomeTracker',
        actorId: 'system',
        tenantId: context.tenant.tenantId
      });

      if (isSuccess) {
        context.state = 'Learned';
      }
    } catch (err) {
      console.error(`[OutcomeTracker] Failed to record outcome:`, err);
    }

    return context;
  }
}

export const OutcomeTracker = new SystemOutcomeTracker();
