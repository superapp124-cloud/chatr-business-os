import { supabase } from '@/integrations/supabase/client';

export type SecurityEventSeverity = 'info' | 'warning' | 'critical';

export interface SecurityEvent {
  eventType: string;
  severity?: SecurityEventSeverity;
  metadata?: Record<string, any>;
  userId?: string;
}

/**
 * Security Service
 * Centralized governance and audit logging for the frontend.
 *
 * logEvent() is fully non-blocking — it never throws and never awaits in the
 * call path. If the `security_audit_events` table doesn't exist or RLS blocks
 * the insert, the error is silently swallowed so call quality is unaffected.
 */
export const securityService = {
  /**
   * Log a security event to the audit log.
   * Fire-and-forget — safe to call from hot paths (WebRTC init, call setup).
   */
  logEvent(event: SecurityEvent): void {
    // Intentionally NOT awaited — runs in background without blocking caller
    this._persistEvent(event).catch(() => {
      // Silently swallow — table may not exist in all environments
    });
  },

  async _persistEvent(event: SecurityEvent): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = event.userId || user?.id;

      const { error } = await supabase.from('security_audit_events').insert({
        user_id:    userId || null,
        event_type: event.eventType,
        severity:   event.severity || 'info',
        metadata: {
          ...event.metadata,
          userAgent: navigator.userAgent,
          url:       window.location.href,
          timestamp: new Date().toISOString(),
        },
      });

      if (error) {
        // Only log in dev — don't spam production logs
        if (import.meta.env.DEV) {
          console.debug('[Security] Audit event skipped:', error.message);
        }
      }
    } catch {
      // Fully swallow — never let audit logging break app functionality
    }
  },

  /**
   * Validate session integrity
   */
  async validateSession(): Promise<boolean> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      this.logEvent({
        eventType: 'session_invalid',
        severity:  'warning',
        metadata:  { error: error?.message || 'No session' },
      });
      return false;
    }
    return true;
  },
};
