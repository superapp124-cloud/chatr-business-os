import { IService } from '../Shared/Types';
import { Logger } from '../Infrastructure/Logger';

class MetricsService implements IService {
  name = 'Metrics';
  dependencies = [];

  async initialize(): Promise<void> {
    Logger.info('[Metrics] Tracking telemetry and latencies...');
  }

  recordLatency(operation: string, ms: number) {
    // Collect stats, e.g. for AI inference
  }
}

export const Metrics = new MetricsService();
