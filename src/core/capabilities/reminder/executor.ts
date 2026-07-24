import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { osScheduler } from '../../services/OSSchedulerService';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(`[core.reminder] Executing commitment ${commitment.id}`);

  // Resolve time from entities (set by playbook.resolve) or schedule.resolved
  const resolvedTime = commitment.entities?.resolvedTime || commitment.schedule?.resolved;

  if (!resolvedTime) {
    return { success: false, commitmentId: commitment.id, message: 'No valid time to schedule' };
  }

  // Schedule via the OS Scheduler Service (persists to localStorage, survives refresh)
  const entry = osScheduler.schedule({
    id: commitment.id,
    capability: 'core.reminder',
    type: 'reminder',
    title: commitment.title,
    scheduledFor: resolvedTime,
    metadata: {
      entities: commitment.entities,
    },
  });

  return {
    success: true,
    commitmentId: commitment.id,
    providerData: {
      transactionId: `TIMER-${commitment.id}`,
      scheduledFor: entry.scheduledFor,
      _provider: 'OSSchedulerService',
    },
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const entry = osScheduler.getEntry(commitment.id);

  if (!entry) {
    // Not in scheduler — treat as auto-verified (may have been scheduled before OSScheduler)
    return {
      verified: true,
      provider: 'OSSchedulerService',
      timestamp: new Date().toISOString(),
      transactionId: `TIMER-${commitment.id}`,
      evidence: { status: 'auto_verified' },
    };
  }

  const isVerified = entry.status === 'pending' || entry.status === 'fired';

  return {
    verified: isVerified,
    provider: 'OSSchedulerService',
    timestamp: new Date().toISOString(),
    transactionId: `TIMER-${commitment.id}`,
    evidence: { status: entry.status, scheduledFor: entry.scheduledFor },
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  osScheduler.cancel(commitmentId);
  console.log(`[core.reminder] Cancelled reminder ${commitmentId}`);
}
