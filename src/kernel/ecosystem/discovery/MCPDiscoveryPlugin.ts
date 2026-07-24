import { IDiscoveryPlugin, RawCapabilitySource } from './IDiscoveryPlugin';
import { transportRegistry } from '../../transport/TransportRegistry';

export class MCPDiscoveryPlugin implements IDiscoveryPlugin {
  public id = 'mcp-discovery';
  
  // A list of configured endpoints to probe
  private endpoints: string[] = [];

  constructor(endpoints: string[]) {
    this.endpoints = endpoints;
  }

  async discover(): Promise<RawCapabilitySource[]> {
    const mcpTransport = transportRegistry.get('MCP');
    const sources: RawCapabilitySource[] = [];

    for (const endpoint of this.endpoints) {
      try {
        const capabilities = await mcpTransport.getCapabilities(endpoint);
        sources.push({
          id: `mcp_server_${Buffer.from(endpoint).toString('base64').substring(0, 8)}`,
          transport: 'MCP',
          endpoint,
          capabilities
        });
      } catch (err: any) {
        console.debug(`[MCPDiscovery] Failed to probe ${endpoint} (expected if server offline)`);
      }
    }

    return sources;
  }
}
