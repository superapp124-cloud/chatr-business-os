import { OSEvent } from '../contracts/os/EventLog.abi';
import { supabase } from '@/integrations/supabase/client';

export type VerificationState = 'verified' | 'rejected' | 'inconclusive';

export interface ExpectedOutcome {
  targetEntityId: string;
  expectedState: Record<string, any>;
  tolerances?: Record<string, any>;
}

export class OutcomeVerifier {
  /**
   * The Execution Engine calls this. It NEVER says "I succeeded".
   * It only says "I observed X". 
   * This verifier determines if Reality actually matches the expectation.
   */
  async verifyObservation(
    expected: ExpectedOutcome, 
    observedData: Record<string, any>, 
    sourceEventId: string
  ): Promise<{ status: VerificationState; unknowns: string[] }> {
    
    // 1. Is the observation sufficient to make a judgment?
    const unknowns: string[] = [];
    for (const key of Object.keys(expected.expectedState)) {
      if (observedData[key] === undefined) {
        unknowns.push(key);
      }
    }

    if (unknowns.length > 0) {
      // We don't have enough data to prove success OR failure.
      return { status: 'inconclusive', unknowns };
    }

    // 2. Does the observation match the expectation?
    let isMatch = true;
    for (const [key, value] of Object.entries(expected.expectedState)) {
      if (observedData[key] !== value) {
        isMatch = false;
        break;
      }
    }

    const status: VerificationState = isMatch ? 'verified' : 'rejected';
    
    // 3. Write the verification record (Projection of Outcome)
    await this.recordVerification(expected, observedData, status, unknowns, sourceEventId);

    return { status, unknowns };
  }

  private async recordVerification(
    expected: any, 
    observed: any, 
    status: VerificationState, 
    unknowns: string[], 
    sourceEventId: string
  ) {
    await supabase.from('outcome_verifications').insert({
      expected_outcome: expected,
      observed_outcome: observed,
      status: status,
      verification_method: 'deterministic_property_match',
      verifier_subsystem: 'OutcomeVerifier_v1',
      confidence: 1.0, // Mathematical certainty based on the inputs provided
      remaining_unknowns: unknowns,
      source_event_id: sourceEventId
    });
  }

  /**
   * Evaluates verified outcomes to autonomously advance a Goal.
   */
  async evaluateGoalAdvancement(goalId: string, verificationId: string): Promise<void> {
    const { data: verification } = await supabase
      .from('outcome_verifications')
      .select('status')
      .eq('id', verificationId)
      .single();

    if (!verification || verification.status !== 'verified') {
      // Goals NEVER advance unless the evidence is strictly 'verified'.
      return; 
    }

    // In a full implementation, this logic queries the Reality Graph for the Goal entity,
    // calculates the new progress %, and inserts into goal_progress.
    await supabase.from('goal_progress').insert({
      goal_id: goalId,
      verification_id: verificationId,
      progress_percentage: 100, // Hardcoded for M4 demonstration
      narrative_explanation: 'Verified outcome strictly satisfies goal constraints.'
    });
  }
}
