export interface NotificationEvent {
  id: string;
  sourceObjectId: string;
  eventType: string; // e.g., 'STATUS_CHANGED', 'COMMENT_ADDED', 'SLA_BREACHED'
  actorId: string;
  payload: Record<string, any>;
  timestamp: Date;
}

export interface NotificationChannel {
  id: string;
  type: 'email' | 'sms' | 'whatsapp' | 'slack' | 'teams' | 'push' | 'in_app';
  deliver(event: NotificationEvent, recipientId: string): Promise<boolean>;
}

export class NotificationRuntime {
  private channels: Map<string, NotificationChannel> = new Map();

  constructor() {
    console.log("NotificationRuntime initialized.");
  }

  public registerChannel(channel: NotificationChannel): void {
    this.channels.set(channel.id, channel);
  }

  public async emitEvent(event: NotificationEvent): Promise<void> {
    // 1. Determine recipients based on sourceObjectId subscriptions / relationships
    // 2. Fetch recipient preferences to determine preferred channels
    // 3. Route to corresponding channels
    
    // Mock routing logic
    console.log(`[NotificationRuntime] Emitting event ${event.eventType} for object ${event.sourceObjectId}`);
    
    // In-app is always enabled for testing
    const inAppChannel = this.channels.get('in_app_default');
    if (inAppChannel) {
      await inAppChannel.deliver(event, 'all_subscribers');
    }
  }
}

export const notificationRuntime = new NotificationRuntime();
