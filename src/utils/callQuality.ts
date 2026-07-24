/**
 * Chatr+ MOS Score Calculator (Phase 6 / QoE Observability)
 *
 * Implements the ITU-T G.107 E-model approximation for real-time VoIP
 * Mean Opinion Score (MOS) calculation (1.0 – 4.5 scale).
 *
 * Also provides a call event log function for database event sourcing.
 */
import { supabase } from '@/integrations/supabase/client';

/** ITU-T G.107 E-model R-value → MOS conversion */
export function calculateMOS(rttMs: number, lossPercent: number, jitterMs: number): number {
  // Effective delay includes RTT + jitter buffering
  const delay = rttMs + jitterMs * 2;

  let r = 94.2;

  // Delay impairment
  if (delay > 177.3) {
    r -= 0.024 * delay + 0.11 * (delay - 177.3);
  } else {
    r -= 0.024 * delay;
  }

  // Packet loss impairment (Bursty Packet Loss model)
  r -= 2.5 * lossPercent;

  r = Math.max(0, Math.min(100, r));

  // R → MOS conversion (Rec. ITU-T G.107 formula)
  if (r < 0) return 1.0;
  if (r > 100) return 4.5;
  const mos = 1 + 0.035 * r + 0.000007 * r * (r - 60) * (100 - r);
  return parseFloat(Math.max(1.0, Math.min(4.5, mos)).toFixed(2));
}

/** Qualitative label for a MOS score */
export function mosLabel(mos: number): string {
  if (mos >= 4.3) return 'Excellent';
  if (mos >= 4.0) return 'Good';
  if (mos >= 3.6) return 'Fair';
  if (mos >= 3.1) return 'Poor';
  return 'Bad';
}

/** Color for UI badges */
export function mosColor(mos: number): string {
  if (mos >= 4.0) return '#10b981'; // green
  if (mos >= 3.6) return '#f59e0b'; // amber
  return '#ef4444';                 // red
}

// ---------------------------------------------------------------------------
// Database Event Sourcing (Phase 4 / Distributed Reliability)
// ---------------------------------------------------------------------------

export type CallEventType =
  | 'CALL_INITIATED'
  | 'OFFER_SENT'
  | 'ANSWER_RECEIVED'
  | 'ICE_CONNECTED'
  | 'RECONNECTING'
  | 'RECONNECTED'
  | 'AUDIO_SURVIVAL_TRIGGERED'
  | 'AUDIO_SURVIVAL_RECOVERED'
  | 'TIER_CHANGE'
  | 'SIGNAL_ACK_TIMEOUT'
  | 'CALL_ENDED';

/**
 * Logs an immutable call event to `call_event_store`.
 * Silently swallows errors so analytics never break calls.
 */
export async function logCallEvent(
  callId: string,
  userId: string,
  eventType: CallEventType,
  payload: Record<string, unknown> = {}
): Promise<void> {
  try {
    await (supabase.from('call_event_store') as any).insert({
      call_id: callId,
      user_id: userId,
      event_type: eventType,
      payload,
    });
  } catch {
    // Non-fatal
  }
}
