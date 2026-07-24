import { IProvider, ProviderCapabilities, ProviderState, providerRegistry, ProviderRole } from './ProviderRegistry';

export class NotificationProviderImpl implements IProvider {
  id = 'sys.notification.local';
  name = 'System Notification Provider';
  type = 'system';
  role: ProviderRole = 'NotificationProvider';
  
  capabilities(): ProviderCapabilities {
    return { canSearch: false, canBook: true, canCancel: false, canVerify: true };
  }
  
  async health(): Promise<ProviderState> {
    return { isHealthy: true, lastChecked: Date.now() };
  }

  async authenticate() { return true; }

  async create(payload: any): Promise<any> {
    console.log(`[NotificationProvider] Sending notification:`, payload);
    const { title, body } = payload;
    
    // Abstract the browser API
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    
    return {
      success: true,
      transactionId: `NOTIF-${Date.now()}`,
      _provider: this.name
    };
  }

  async verify(id: string): Promise<any> {
    return { verified: true, status: 'DELIVERED' };
  }
}

const notificationProvider = new NotificationProviderImpl();
providerRegistry.register(notificationProvider);
