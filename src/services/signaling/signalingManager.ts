import {
  resolveSignalingEndpoint,
  type SignalingEndpointResolution,
} from './signalingResolver';
import {
  SignalingHealthMonitor,
  type PlatformSignalingState,
  type SignalingHealthSnapshot,
} from './signalingHealth';
import {
  createSignalingCorrelationId,
  emitSignalingTelemetry,
} from './signalingTelemetry';

export class SignalingTransportManager {
  private endpoint: SignalingEndpointResolution = resolveSignalingEndpoint();
  private health = new SignalingHealthMonitor();
  private correlationId = createSignalingCorrelationId();
  private primaryFailures = 0;

  resolve(): SignalingEndpointResolution {
    this.endpoint = resolveSignalingEndpoint();
    emitSignalingTelemetry({
      event: 'endpoint_resolved',
      level: this.endpoint.socketEnabled ? 'info' : 'warn',
      correlationId: this.correlationId,
      endpoint: this.endpoint.socketIoUrl ?? undefined,
      reason: this.endpoint.reason,
      metadata: {
        environment: this.endpoint.environment,
        fallbackTransport: this.endpoint.fallbackTransport,
      },
    });

    return this.endpoint;
  }

  getEndpoint(): SignalingEndpointResolution {
    return this.endpoint;
  }

  setState(state: PlatformSignalingState, reason?: string): SignalingHealthSnapshot {
    const snapshot = this.health.setState(state);
    emitSignalingTelemetry({
      event: 'state_transition',
      level: state === 'failed' ? 'error' : state === 'fallback-active' ? 'warn' : 'debug',
      correlationId: this.correlationId,
      state,
      reason,
      metadata: { score: snapshot.score },
    });

    return snapshot;
  }

  recordPrimarySuccess(latencyMs?: number): SignalingHealthSnapshot {
    this.primaryFailures = 0;
    const snapshot = this.health.recordSuccess(latencyMs);
    emitSignalingTelemetry({
      event: 'primary_transport_healthy',
      level: 'debug',
      correlationId: this.correlationId,
      transport: 'socket.io',
      latencyMs,
      metadata: { score: snapshot.score },
    });

    return snapshot;
  }

  recordPrimaryFailure(reason: string): SignalingHealthSnapshot {
    this.primaryFailures += 1;
    const snapshot = this.health.recordFailure(reason);
    emitSignalingTelemetry({
      event: 'primary_transport_failure',
      level: this.shouldUseFallback() ? 'warn' : 'debug',
      correlationId: this.correlationId,
      transport: 'socket.io',
      reason,
      metadata: {
        failures: this.primaryFailures,
        reconnectBudget: this.endpoint.reconnectBudget,
        score: snapshot.score,
      },
    });

    if (this.shouldUseFallback()) {
      this.setState('fallback-active', 'primary-transport-budget-exhausted');
    }

    return snapshot;
  }

  shouldUseFallback(): boolean {
    return !this.endpoint.socketEnabled || this.primaryFailures >= this.endpoint.reconnectBudget;
  }

  getHealth(): SignalingHealthSnapshot {
    return this.health.getSnapshot();
  }
}
