import { IService } from '../Shared/Types';
import { Logger } from '../Infrastructure/Logger';

class CollaborationBusService implements IService {
  name = 'CollaborationBus';
  dependencies = ['EventBus'];

  async initialize(): Promise<void> {
    Logger.info('[CollaborationBus] Connecting realtime presence and locks...');
  }
}

export const CollaborationBus = new CollaborationBusService();
