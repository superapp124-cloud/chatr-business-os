import { RawCapabilityDescriptor } from '../transport/ITransport';
import { CapabilityId } from '../abi/v1';

export class NormalizationEngine {
  // Mock normalization mapping rules
  private mappings: Record<string, string> = {
    'weather.get': 'weather.current',
    'fetch_weather': 'weather.current',
    'openmeteo.forecast': 'weather.forecast',
    'github.issues.list': 'vcs.issues.read'
  };

  public normalize(raw: RawCapabilityDescriptor): { capabilityId: CapabilityId, description: string, inputSchema: any } {
    const rawId = raw.name.toLowerCase();
    
    // Check if we have an explicit mapping rule
    let canonicalId = this.mappings[rawId] || rawId;

    return {
      capabilityId: canonicalId as CapabilityId,
      description: raw.description,
      inputSchema: raw.inputSchema
    };
  }
}

export const normalizationEngine = new NormalizationEngine();
