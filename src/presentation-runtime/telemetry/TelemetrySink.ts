export interface TelemetryEvent {
  type: string;
  name: string;
  durationMs?: number;
  correlationId?: string;
  properties?: Record<string, any>;
  timestamp: Date;
}

export interface TelemetrySink {
  emit(event: TelemetryEvent): void;
}

export class InMemoryTelemetrySink implements TelemetrySink {
  private events: TelemetryEvent[] = [];

  emit(event: TelemetryEvent): void {
    this.events.push(event);
    // console.log(`[Telemetry] ${event.type}: ${event.name} (${event.durationMs}ms) [${event.correlationId}]`, event.properties || '');
  }

  getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }
}
