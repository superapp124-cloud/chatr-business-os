import { ITransport, TransportResponse, RawCapabilityDescriptor } from './ITransport';
import { ExecutionPlan } from '../core/types/ABI';
import { HealthStatus } from '../abi/v1';

export class MCPTransport implements ITransport {
  async execute(plan: ExecutionPlan, parameters: any, abortSignal?: AbortSignal): Promise<TransportResponse> {
    const start = Date.now();
    try {
      const endpoint = plan.transportConfig.endpoint;
      
      const payload = {
        jsonrpc: '2.0',
        id: `call_${Date.now()}`,
        method: 'tools/call',
        params: {
          name: plan.providerId, // assuming the providerId maps to the tool name internally or via executionPlan
          arguments: parameters
        }
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), plan.timeoutMs || 10000);

      if (abortSignal) {
        abortSignal.addEventListener('abort', () => controller.abort());
      }

      // We use fetch here to mock HTTP/SSE MCP for MVP purposes.
      // In a real implementation, this might use @modelcontextprotocol/sdk.
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`MCP Error: HTTP ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`MCP RPC Error: ${data.error.message}`);
      }

      return {
        payload: data.result,
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

  async healthCheck(endpoint: string): Promise<HealthStatus> {
    try {
      // Send an empty JSON-RPC ping or list tools request.
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `ping_${Date.now()}`,
          method: 'tools/list'
        })
      });
      if (response.ok) return 'ONLINE';
      if (response.status === 429) return 'RATE_LIMITED';
      return 'DEGRADED';
    } catch {
      return 'OFFLINE';
    }
  }

  async getCapabilities(endpoint: string): Promise<RawCapabilityDescriptor[]> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `list_${Date.now()}`,
        method: 'tools/list'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to list MCP tools: HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const tools = data.result?.tools || [];
    return tools.map((tool: any) => ({
      id: tool.name,
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema || { type: 'object' },
      outputSchema: { type: 'object' } // MCP doesn't strictly specify output schemas yet
    }));
  }
}
