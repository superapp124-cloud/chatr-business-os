import { IDiscoveryPlugin, RawCapabilitySource } from './discovery/IDiscoveryPlugin';
import { kernelBus } from '../core/EventBus';

export class DiscoveryEngine {
  private plugins: IDiscoveryPlugin[] = [];
  private scanInterval: NodeJS.Timeout | null = null;

  public registerPlugin(plugin: IDiscoveryPlugin) {
    this.plugins.push(plugin);
  }

  public async start(intervalMs: number = 60000) {
    console.log('[DiscoveryEngine] Starting automated discovery pipeline...');
    await this.scan();
    this.scanInterval = setInterval(() => this.scan(), intervalMs);
  }

  public stop() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  private async scan() {
    for (const plugin of this.plugins) {
      try {
        const sources = await plugin.discover();
        for (const source of sources) {
          // Emit ecosystem.source_candidate for each found source
          // This goes to the EcosystemRegistrationService (Pipeline)
          await kernelBus.publish({
            eventId: `evt_${Date.now()}_${Math.random()}`,
            type: 'ecosystem.source_candidate',
            timestamp: Date.now(),
            sourceService: 'DiscoveryEngine',
            authority: 'system',
            payload: source,
            version: '1.0'
          });
        }
      } catch (err: any) {
        console.error(`[DiscoveryEngine] Plugin ${plugin.id} failed during scan: ${err.message}`);
      }
    }
  }
}

export const discoveryEngine = new DiscoveryEngine();
