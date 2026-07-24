import { IService } from '../Shared/Types';
import { Logger } from '../Infrastructure/Logger';

export type HealthStatus = 'healthy' | 'degraded' | 'offline';

class HealthMonitorService implements IService {
  name = 'HealthMonitor';
  dependencies = [];

  private status: HealthStatus = 'offline';

  async initialize(): Promise<void> {
    Logger.info('[HealthMonitor] Starting health checks...');
    this.status = 'healthy';
  }

  getStatus(): HealthStatus {
    return this.status;
  }
}

export const HealthMonitor = new HealthMonitorService();
