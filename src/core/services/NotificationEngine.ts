import { NotificationPayload, NotificationChannel } from '../capabilities/types';
import { policyEngine } from './PolicyEngine';
import { SecurityEngineImpl } from './SecurityEngine';

/**
 * CHATR Universal Notification Engine
 * 
 * Centralized router for all outbound alerts. Integrates with the Provider Registry,
 * Policy Engine, and Identity Engine. Supports actionable notifications and queues.
 */

interface NotificationPreference {
  id: string;
  channel: NotificationChannel;
  enabled: boolean;
  quietHoursStart?: string; // "22:00"
  quietHoursEnd?: string;   // "08:00"
  urgentOverride: boolean;
}

export class NotificationEngineImpl {
  private static instance: NotificationEngineImpl;
  private queue: NotificationPayload[] = [];
  
  // Mock preferences for Genesis
  private preferences: Record<string, NotificationPreference[]> = {
    'default': [
      { id: '1', channel: 'desktop', enabled: true, urgentOverride: true },
      { id: '2', channel: 'slack', enabled: true, quietHoursStart: '18:00', quietHoursEnd: '09:00', urgentOverride: true },
      { id: '3', channel: 'push', enabled: true, urgentOverride: true },
    ]
  };

  private constructor() {
    this.startQueueProcessor();
  }

  public static getInstance(): NotificationEngineImpl {
    if (!NotificationEngineImpl.instance) {
      NotificationEngineImpl.instance = new NotificationEngineImpl();
    }
    return NotificationEngineImpl.instance;
  }

  /**
   * Main entrypoint to dispatch a notification.
   */
  public async deliver(payload: NotificationPayload, userId: string = 'default'): Promise<void> {
    console.log(`[NotificationEngine] Received payload for delivery: ${payload.title}`);
    
    const user = SecurityEngineImpl.getInstance().getCurrentUser();
    
    // Evaluate Enterprise Policies (DND, Blackouts)
    const policyResult = await policyEngine.evaluateNotificationPolicy(payload, user || { id: userId } as any);
    
    if (policyResult.action === 'block') {
      console.warn(`[NotificationEngine] Blocked by policy: ${policyResult.reason}`);
      return; // Drop notification
    }

    // Determine target channels based on user preferences and payload defaults
    const targetChannels = this.resolveChannels(payload, userId);

    if (targetChannels.length === 0) {
      console.log(`[NotificationEngine] No active channels for delivery.`);
      return;
    }

    // Assign final channels and queue for delivery
    const finalPayload = { ...payload, channels: targetChannels };
    this.queue.push(finalPayload);
  }

  private resolveChannels(payload: NotificationPayload, userId: string): NotificationChannel[] {
    const prefs = this.preferences[userId] || this.preferences['default'];
    const requestedChannels = payload.channels || ['desktop'];
    const resolved: NotificationChannel[] = [];
    const isUrgent = payload.severity === 'urgent';

    for (const channel of requestedChannels) {
      const pref = prefs.find(p => p.channel === channel);
      if (!pref || !pref.enabled) continue;

      // Check quiet hours
      if (!isUrgent && pref.quietHoursStart && pref.quietHoursEnd) {
        if (this.isWithinQuietHours(pref.quietHoursStart, pref.quietHoursEnd)) {
          console.log(`[NotificationEngine] Channel ${channel} is in quiet hours.`);
          continue; 
        }
      }

      resolved.push(channel);
    }

    return resolved;
  }

  private isWithinQuietHours(start: string, end: string): boolean {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [startH, startM] = start.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    
    const [endH, endM] = end.split(':').map(Number);
    const endMinutes = endH * 60 + endM;

    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Wraps around midnight
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }

  private startQueueProcessor() {
    setInterval(() => {
      while (this.queue.length > 0) {
        const payload = this.queue.shift();
        if (payload) {
          this.processDelivery(payload);
        }
      }
    }, 1000);
  }

  private async processDelivery(payload: NotificationPayload) {
    const channels = payload.channels || [];

    if (channels.includes('desktop')) {
      this.deliverDesktop(payload);
    }
    if (channels.includes('slack')) {
      this.deliverSlack(payload);
    }
    if (channels.includes('push')) {
      this.deliverPush(payload);
    }
    if (channels.includes('email')) {
      this.deliverEmail(payload);
    }
  }

  private deliverDesktop(payload: NotificationPayload): void {
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        new Notification(payload.title, {
          body: payload.body,
          icon: '/favicon.ico',
          tag: payload.id,
        });
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') {
            new Notification(payload.title, { body: payload.body, tag: payload.id });
          }
        });
      }
    }

    // Always dispatch in-app event for UI toasts/handling
    window.dispatchEvent(new CustomEvent('chatr:notification-delivered', {
      detail: { entry: payload, message: payload.title }
    }));
  }

  private deliverSlack(payload: NotificationPayload): void {
    console.log(`[NotificationEngine] Routing to Slack Provider: ${payload.title}`);
    if (payload.actions && payload.actions.length > 0) {
      console.log(`[NotificationEngine] Slack payload contains interactive actions:`, payload.actions.map(a => a.label));
    }
  }

  private deliverPush(payload: NotificationPayload): void {
    console.log(`[NotificationEngine] Routing to Push Provider: ${payload.title}`);
  }

  private deliverEmail(payload: NotificationPayload): void {
    console.log(`[NotificationEngine] Routing to Email Provider: ${payload.title}`);
  }
}

export const notificationEngine = NotificationEngineImpl.getInstance();
