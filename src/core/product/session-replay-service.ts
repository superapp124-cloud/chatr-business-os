// ─── Session Replay Service ──────────────────────────────────────────────────
// Records every user journey event. Lives entirely in the product layer.
// The kernel knows nothing about this service.

export type SessionEvent =
  | { type: 'session_start'; timestamp: number }
  | { type: 'intent_entered'; timestamp: number; text: string }
  | { type: 'results_shown'; timestamp: number; topResult: string; resultCount: number }
  | { type: 'result_clicked'; timestamp: number; resultId: string; resultName: string }
  | { type: 'checkout_started'; timestamp: number; resultName: string }
  | { type: 'payment_clicked'; timestamp: number; totalAmount: number }
  | { type: 'order_completed'; timestamp: number; orderId: string }
  | { type: 'abandoned'; timestamp: number; step: string; durationMs: number }
  | { type: 'recovery_triggered'; timestamp: number; reason: string }
  | { type: 'recovery_resolved'; timestamp: number; newProvider: string }
  | { type: 'feedback_submitted'; timestamp: number; rating: 'yes' | 'same' | 'no'; comment?: string }
  | { type: 'nps_submitted'; timestamp: number; score: 'definitely' | 'probably' | 'maybe' | 'no' }
  | { type: 'hesitation'; timestamp: number; step: string; durationMs: number }
  | { type: 'scroll'; timestamp: number; direction: 'up' | 'down'; step: string }
  | { type: 'ab_variant_shown'; timestamp: number; variant: 'A' | 'B' }
  | { type: 'error'; timestamp: number; message: string; step: string };

export interface SessionReplay {
  sessionId: string;
  userId?: string;
  userSegment?: string; // 'tech-savvy' | 'non-technical' | 'frequent-food' | 'occasional' | 'new'
  startTime: number;
  endTime?: number;
  events: SessionEvent[];
  abVariant?: 'A' | 'B';
  finalOutcome?: 'completed' | 'abandoned' | 'error';
  feedbackRating?: 'yes' | 'same' | 'no';
  npsScore?: 'definitely' | 'probably' | 'maybe' | 'no';
}

const SESSION_STORE_KEY = 'chatr_session_replays';
const MAX_SESSIONS = 500;

class SessionReplayServiceClass {
  private currentSession: SessionReplay | null = null;
  private hesitationTimer: ReturnType<typeof setTimeout> | null = null;
  private stepStartTime: number = Date.now();
  private currentStep: string = 'idle';

  // ── Session Lifecycle ────────────────────────────────────────────────────────

  startSession(abVariant?: 'A' | 'B'): string {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.currentSession = {
      sessionId,
      startTime: Date.now(),
      events: [],
      abVariant,
    };
    this.record({ type: 'session_start', timestamp: Date.now() });
    this.startHesitationDetection('idle');
    return sessionId;
  }

  endSession(outcome: SessionReplay['finalOutcome']) {
    if (!this.currentSession) return;
    this.clearHesitationTimer();
    this.currentSession.endTime = Date.now();
    this.currentSession.finalOutcome = outcome;
    this.persist(this.currentSession);
    this.currentSession = null;
  }

  // ── Event Recording ──────────────────────────────────────────────────────────

  record(event: SessionEvent) {
    if (!this.currentSession) return;
    this.currentSession.events.push(event);
    console.debug('[SessionReplay]', event.type, event);
  }

  enterStep(step: string) {
    this.currentStep = step;
    this.stepStartTime = Date.now();
    this.startHesitationDetection(step);
  }

  markFeedback(rating: 'yes' | 'same' | 'no', comment?: string) {
    if (this.currentSession) this.currentSession.feedbackRating = rating;
    this.record({ type: 'feedback_submitted', timestamp: Date.now(), rating, comment });
  }

  markNPS(score: 'definitely' | 'probably' | 'maybe' | 'no') {
    if (this.currentSession) this.currentSession.npsScore = score;
    this.record({ type: 'nps_submitted', timestamp: Date.now(), score });
  }

  recordAbandonment(step: string) {
    const durationMs = Date.now() - this.stepStartTime;
    this.record({ type: 'abandoned', timestamp: Date.now(), step, durationMs });
    this.endSession('abandoned');
  }

  // ── Persistence ──────────────────────────────────────────────────────────────

  private persist(session: SessionReplay) {
    try {
      const stored: SessionReplay[] = JSON.parse(localStorage.getItem(SESSION_STORE_KEY) || '[]');
      stored.unshift(session); // newest first
      localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(stored.slice(0, MAX_SESSIONS)));
    } catch (e) {
      console.error('[SessionReplay] Failed to persist:', e);
    }
  }

  getAllSessions(): SessionReplay[] {
    try {
      return JSON.parse(localStorage.getItem(SESSION_STORE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  getSession(sessionId: string): SessionReplay | null {
    return this.getAllSessions().find(s => s.sessionId === sessionId) ?? null;
  }

  clear() {
    localStorage.removeItem(SESSION_STORE_KEY);
  }

  // ── Hesitation Detection ─────────────────────────────────────────────────────

  private startHesitationDetection(step: string) {
    this.clearHesitationTimer();
    // If user stays on the same step >4s without action, record hesitation
    this.hesitationTimer = setTimeout(() => {
      this.record({ type: 'hesitation', timestamp: Date.now(), step, durationMs: 4000 });
    }, 4000);
  }

  private clearHesitationTimer() {
    if (this.hesitationTimer) {
      clearTimeout(this.hesitationTimer);
      this.hesitationTimer = null;
    }
  }
}

export const SessionReplayService = new SessionReplayServiceClass();
