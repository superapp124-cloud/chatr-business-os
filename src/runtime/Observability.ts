import { ExecutionContext } from '@/kernel/ExecutionContext';

interface Metric {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: string;
}

export class ObservabilityService {
  private metrics: Metric[] = [];

  // Metrics (e.g. AI latency, intent execution time)
  recordMetric(name: string, value: number, context?: ExecutionContext, tags?: Record<string, string>) {
    this.metrics.push({
      name,
      value,
      tags: { ...tags, org: context?.tenant.organizationId || 'unknown' },
      timestamp: new Date().toISOString()
    });

    // In production, batch and send to Datadog / OpenTelemetry
    if (this.metrics.length > 50) {
      this.flushMetrics();
    }
  }

  // Tracing
  startTrace(operationName: string, context: ExecutionContext) {
    const startTime = performance.now();
    return {
      end: () => {
        const duration = performance.now() - startTime;
        this.recordMetric(`trace.${operationName}.duration`, duration, context);
      }
    };
  }

  // Errors
  recordError(message: string, context?: ExecutionContext) {
    // Send to Sentry or similar
  }

  // Audit
  recordAudit(action: string, context: ExecutionContext, meta?: any) {
    // Audit logs are usually pushed directly to the EventStore
    // This provides a bridge between runtime logging and kernel persistence
  }

  private flushMetrics() {
    // Send metrics array to backend telemetry service
    this.metrics = [];
  }
}

export const Observability = new ObservabilityService();
