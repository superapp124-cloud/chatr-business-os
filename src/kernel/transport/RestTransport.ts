import { ITransport, TransportResponse } from './ITransport';
import { ExecutionPlan } from '../core/types/ABI';

export class RestTransport implements ITransport {
  async execute(plan: ExecutionPlan, parameters: any, abortSignal?: AbortSignal): Promise<TransportResponse> {
    const start = Date.now();
    try {
      let url = plan.transportConfig.endpoint;
      
      if (plan.providerId === 'provider.openmeteo') {
        url += '?latitude=51.5085&longitude=-0.1257&current_weather=true';
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), plan.timeoutMs);

      if (abortSignal) {
        abortSignal.addEventListener('abort', () => controller.abort());
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const payload = await response.json();
      
      return {
        payload,
        latencyMs: Date.now() - start,
        status: 'SUCCESS'
      };

    } catch (err: any) {
      return {
        payload: null,
        latencyMs: Date.now() - start,
        status: err.name === 'AbortError' ? 'TIMEOUT' : 'ERROR',
        error: err.message
      };
    }
  }

  async healthCheck(endpoint: string): Promise<import('../abi/v1').HealthStatus> {
    try {
      // In a real system, we might ping the endpoint or a dedicated health check URL.
      // For now, assume ONLINE if it's not throwing instantly.
      return 'ONLINE';
    } catch {
      return 'OFFLINE';
    }
  }

  async getCapabilities(endpoint: string): Promise<import('./ITransport').RawCapabilityDescriptor[]> {
    // REST doesn't have a standard discovery mechanism like MCP tools/list or GraphQL introspection.
    // OpenAPI / Swagger could be parsed here.
    return [];
  }
}
