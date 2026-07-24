import { RawCapabilityDescriptor } from '../../transport/ITransport';

export interface RawCapabilitySource {
  id: string; // The provider ID or endpoint ID
  transport: string; // 'MCP', 'REST', etc.
  endpoint: string; // The URL or connection string
  capabilities: RawCapabilityDescriptor[];
}

export interface IDiscoveryPlugin {
  id: string; // e.g. 'mcp-discovery'
  discover(): Promise<RawCapabilitySource[]>;
}
