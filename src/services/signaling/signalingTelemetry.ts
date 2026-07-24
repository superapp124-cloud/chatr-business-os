export type SignalingTelemetryLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SignalingTelemetryEvent {
  event: string;
  level?: SignalingTelemetryLevel;
  correlationId?: string;
  transport?: 'socket.io' | 'supabase' | 'webtransport' | 'recovery';
  state?: string;
  endpoint?: string;
  latencyMs?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

const TELEMETRY_PREFIX = '[Signaling]';

export function createSignalingCorrelationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `sig_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function emitSignalingTelemetry(event: SignalingTelemetryEvent): void {
  const level = event.level ?? 'info';
  const payload = {
    ...event,
    level,
    timestamp: new Date().toISOString(),
  };

  if (level === 'error') {
    console.error(TELEMETRY_PREFIX, payload);
  } else if (level === 'warn') {
    console.warn(TELEMETRY_PREFIX, payload);
  } else if (level === 'debug') {
    console.debug(TELEMETRY_PREFIX, payload);
  } else {
    console.info(TELEMETRY_PREFIX, payload);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chatr:signaling-telemetry', { detail: payload }));
  }
}
