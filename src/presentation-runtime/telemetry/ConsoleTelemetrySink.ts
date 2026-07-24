import { TelemetrySink, TelemetryEvent } from './TelemetrySink';

export class ConsoleTelemetrySink implements TelemetrySink {
  private metrics: Record<string, number[]> = {};

  emit(event: TelemetryEvent): void {
    if (event.type === 'Metric' && typeof event.value === 'number') {
      if (!this.metrics[event.name]) {
        this.metrics[event.name] = [];
      }
      this.metrics[event.name].push(event.value);
    }
  }

  printSummary(): void {
    console.log('\n--- Telemetry Metrics Summary ---');
    for (const [name, values] of Object.entries(this.metrics)) {
      if (values.length === 0) continue;
      
      const sorted = [...values].sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || max;

      console.log(`${name}:`);
      console.log(`  Count: ${values.length}`);
      console.log(`  Min:   ${min.toFixed(2)}`);
      console.log(`  Max:   ${max.toFixed(2)}`);
      console.log(`  Avg:   ${avg.toFixed(2)}`);
      console.log(`  P95:   ${p95.toFixed(2)}`);
    }
    console.log('---------------------------------\n');
  }

  exportMetrics(): object {
    const exports: Record<string, any> = {};
    for (const [name, values] of Object.entries(this.metrics)) {
      if (values.length === 0) continue;
      const sorted = [...values].sort((a, b) => a - b);
      exports[name] = {
        metric: name,
        unit: 'ms', // Simplified for prototype
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
        p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
        count: values.length
      };
    }
    return exports;
  }

  clear(): void {
    this.metrics = {};
  }
}
