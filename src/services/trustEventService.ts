/**
 * Trust Event Service
 *
 * Lightweight event bus that fires after every trust-generating action
 * and triggers a user trust score recalculation.
 *
 * Pipeline:
 *   Call / Message / Report / Verification / KYC / Recruiter Interaction
 *     ↓
 *   trustEventService.emit(event)
 *     ↓
 *   Supabase: upsert trust_factors row
 *     ↓
 *   Realtime: user_trust_scores updated → TrustScoreBreakdown receives live update
 *
 * Design notes:
 * - All emits are fire-and-forget (non-blocking, errors are swallowed with a warning).
 * - No await required at call sites — this must never slow down a user action.
 * - If Supabase is unavailable, events are silently dropped. Score will self-correct
 *   on next successful emit for the same event type.
 */

import { supabase } from '@/integrations/supabase/client';

// ─────────────────────────────────────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────────────────────────────────────

export type TrustEventType =
  | 'CALL_COMPLETED'        // A call ended with status 'completed' or 'ended' + duration > 0
  | 'SPAM_REPORTED'         // User reported a number as spam
  | 'SPAM_RECEIVED'         // User's number was reported as spam by another user
  | 'KYC_SUBMITTED'         // User submitted a KYC document
  | 'KYC_APPROVED'          // Admin approved a KYC document
  | 'MESSAGE_SENT'          // First message sent (one-time signal)
  | 'CONTACT_SYNCED'        // User synced 5+ contacts
  | 'VERIFIED_BADGE_EARNED' // User purchased/earned the verified badge
  | 'RECRUITER_INTERACTION' // A recruiter call was screened or completed
  | 'IDENTITY_SHARED'       // User shared identity via QR or link

export interface TrustEvent {
  type: TrustEventType;
  /** The user whose trust score should be recalculated */
  userId: string;
  /** Optional: the phone number or call ID that triggered the event */
  context?: string;
  /** Optional: metadata for the event (e.g. call duration, report type) */
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Point values for each event type
// These feed into the trust score calculation.
// Negative values deduct points (e.g. being reported as spam).
// ─────────────────────────────────────────────────────────────────────────────

const TRUST_POINT_MAP: Record<TrustEventType, number> = {
  CALL_COMPLETED:        +5,
  SPAM_REPORTED:          0,   // Emitting a report doesn't affect reporter's score
  SPAM_RECEIVED:        -10,   // Being reported as spam deducts from your score
  KYC_SUBMITTED:         +5,
  KYC_APPROVED:         +20,
  MESSAGE_SENT:          +5,
  CONTACT_SYNCED:        +10,
  VERIFIED_BADGE_EARNED: +20,
  RECRUITER_INTERACTION: +3,
  IDENTITY_SHARED:       +2,
};

// ─────────────────────────────────────────────────────────────────────────────
// Emit — fire-and-forget, never awaited by caller
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emit a trust event. Call this after any action that should affect a user's trust score.
 *
 * @example
 * // After a spam report:
 * trustEventService.emit({ type: 'SPAM_REPORTED', userId: currentUserId, context: reportedNumber });
 *
 * @example
 * // After a call completes:
 * trustEventService.emit({ type: 'CALL_COMPLETED', userId: callerId, metadata: { duration: 120 } });
 */
export const trustEventService = {
  emit(event: TrustEvent): void {
    // Fire-and-forget — never block the caller
    _persistEvent(event).catch(err =>
      console.warn('[TrustEvent] Failed to persist event:', event.type, err)
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal — write trust_factors row, which triggers score recalculation
// ─────────────────────────────────────────────────────────────────────────────

async function _persistEvent(event: TrustEvent): Promise<void> {
  const pointDelta = TRUST_POINT_MAP[event.type] ?? 0;

  // Write to trust_factors — this table is subscribed to in TrustScoreBreakdown.tsx
  // via Supabase Realtime, so the UI updates automatically on insert.
  const { error: factorError } = await (supabase as any)
    .from('trust_factors')
    .insert({
      user_id: event.userId,
      factor_type: event.type,
      point_delta: pointDelta,
      context: event.context ?? null,
      metadata: event.metadata ?? null,
    });

  if (factorError) {
    // Non-fatal: log and return. Score will self-correct on next event.
    console.warn('[TrustEvent] trust_factors insert failed:', factorError.message);
    return;
  }

  // If DB supports an RPC for atomic score recalculation, call it.
  // Falls back to no-op if the RPC doesn't exist yet (TrustScoreBreakdown handles client-side calc).
  try {
    await (supabase as any).rpc('recalculate_trust_score', { p_user_id: event.userId });
  } catch {
    // RPC not yet deployed — client-side recalculation in TrustScoreBreakdown is the fallback.
    // No action needed here.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience helpers — pre-wired for common call sites
// ─────────────────────────────────────────────────────────────────────────────

export function emitCallCompleted(userId: string, durationSeconds: number): void {
  if (durationSeconds < 3) return; // Ignore sub-3-second calls (robocalls, accidental dials)
  trustEventService.emit({ type: 'CALL_COMPLETED', userId, metadata: { durationSeconds } });
}

export function emitSpamReported(reporterId: string, reportedNumber: string): void {
  trustEventService.emit({ type: 'SPAM_REPORTED', userId: reporterId, context: reportedNumber });
}

export function emitSpamReceived(reportedUserId: string, reportedByNumber: string): void {
  trustEventService.emit({ type: 'SPAM_RECEIVED', userId: reportedUserId, context: reportedByNumber });
}

export function emitKycSubmitted(userId: string, documentType: string): void {
  trustEventService.emit({ type: 'KYC_SUBMITTED', userId, metadata: { documentType } });
}

export function emitKycApproved(userId: string, documentType: string): void {
  trustEventService.emit({ type: 'KYC_APPROVED', userId, metadata: { documentType } });
}

export function emitVerifiedBadge(userId: string): void {
  trustEventService.emit({ type: 'VERIFIED_BADGE_EARNED', userId });
}
