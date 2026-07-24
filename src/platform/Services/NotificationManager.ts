import { IService } from '../Shared/Types';
import { Logger } from '../Infrastructure/Logger';
import { EventBus } from '../Infrastructure/EventBus';

class NotificationManagerService implements IService {
  name = 'NotificationManager';
  dependencies = ['EventBus'];

  async initialize(): Promise<void> {
    Logger.info('[NotificationManager] Subscribing to global events...');
    EventBus.subscribe('MessageSent', async (event) => {
      // In real implementation, show desktop notification or update badges
      Logger.debug('[NotificationManager] Received MessageSent event', event.payload);
    });
  }
}

export const NotificationManager = new NotificationManagerService();
