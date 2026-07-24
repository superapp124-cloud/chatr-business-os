import { Outcome, ExecutionResult } from '../types';

export async function execute(outcome: Outcome): Promise<ExecutionResult> {
  console.log(`[${outcome.capability}] Executing outcome ${outcome.id}`);
  return { success: true, outcomeId: outcome.id };
}

export async function undo(outcomeId: string): Promise<void> {
  console.log(`[Undo] ${outcomeId}`);
}

export async function complete(outcomeId: string): Promise<void> {
  console.log(`[Complete] ${outcomeId}`);
}

export async function archive(outcomeId: string): Promise<void> {
  console.log(`[Archive] ${outcomeId}`);
}
