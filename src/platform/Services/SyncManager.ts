import { IService } from '../Shared/Types';
import { Logger } from '../Infrastructure/Logger';

class SyncManagerService implements IService {
  name = 'SyncManager';
  dependencies = ['OfflineManager'];

  async initialize(): Promise<void> {
    Logger.info('[SyncManager] Initializing background sync...');
  }
}

export const SyncManager = new SyncManagerService();
