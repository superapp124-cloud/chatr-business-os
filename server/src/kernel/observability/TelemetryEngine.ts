import { Logger } from './SystemLogger.js';
import { TraceContext } from '../../types.js';

interface MetricTags {
  tenantId?: string;
  source?: string;
  action?: string;
  [key: string]: any;
}

export class SystemTelemetryEngine {
  
  /**
   * Records a duration metric (ms)
   */
  recordDuration(metricName: string, durationMs: number, trace: TraceContext, tags?: MetricTags) {
    Logger.info(`[Metric] ${metricName}: ${durationMs}ms`, {
      source: 'TelemetryEngine',
      trace,
      metric_type: 'duration',
      metric_name: metricName,
      metric_value: durationMs,
      ...tags
    });
    // In production, this would flush to Datadog/Prometheus
  }

  /**
   * Increments a counter metric
   */
  increment(metricName: string, value: number = 1, trace?: TraceContext, tags?: MetricTags) {
    Logger.info(`[Metric] ${metricName}: +${value}`, {
      source: 'TelemetryEngine',
      trace,
      metric_type: 'counter',
      metric_name: metricName,
      metric_value: value,
      ...tags
    });
  }

  /**
   * Executes a block of code within a new trace span
   */
  async withSpan<T>(spanName: string, parentTrace: TraceContext, tags: MetricTags, block: (childTrace: TraceContext) => Promise<T>): Promise<T> {
    const startTime = Date.now();
    const childTrace: TraceContext = {
      traceId: parentTrace.traceId,
      spanId: Math.random().toString(36).substring(2, 10), // mock short span ID
      parentSpanId: parentTrace.spanId,
      correlationId: parentTrace.correlationId
    };

    try {
      const result = await block(childTrace);
      this.recordDuration(`${spanName}.duration`, Date.now() - startTime, childTrace, tags);
      return result;
    } catch (err) {
      this.recordDuration(`${spanName}.duration`, Date.now() - startTime, childTrace, { ...tags, error: true });
      this.increment(`${spanName}.failed`, 1, childTrace, tags);
      throw err;
    }
  }
}

export const TelemetryEngine = new SystemTelemetryEngine();
