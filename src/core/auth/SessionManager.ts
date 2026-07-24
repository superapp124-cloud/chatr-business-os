import { AuthSession } from './types';
import { eventBus } from '../runtime/EventBus';

export class SessionManagerImpl {
  private currentSession: AuthSession | null = null;

  public async initialize(): Promise<void> {
    // Attempt to load session from secure local storage
    console.log('[SessionManager] Initializing session...');
    const stored = localStorage.getItem('chatr_session');
    if (stored) {
      try {
        this.currentSession = JSON.parse(stored);
        console.log('[SessionManager] Restored session for user:', this.currentSession?.userId);
      } catch (e) {
        console.error('[SessionManager] Failed to parse stored session', e);
      }
    }
  }

  public getSession(): AuthSession | null {
    return this.currentSession;
  }

  public async setSession(session: AuthSession): Promise<void> {
    this.currentSession = session;
    localStorage.setItem('chatr_session', JSON.stringify(session));
    eventBus.publish('chatr:session-updated', { session }, 'SessionManager');
  }

  public async clearSession(): Promise<void> {
    this.currentSession = null;
    localStorage.removeItem('chatr_session');
    eventBus.publish('chatr:session-cleared', {}, 'SessionManager');
  }
}

export const sessionManager = new SessionManagerImpl();
