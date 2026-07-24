import { IProvider, ProviderRole, ExecutionContext, ExecutionReceipt, ProviderCapabilities, ProviderHealth, ProviderMetrics, ExecutionStrategy, ProviderRequirements } from './types';
import { providerRegistry } from './ProviderRegistry';

export class MockRideProvider implements IProvider {
  id: string;
  name: string;
  type = 'cab';
  role: ProviderRole = 'ExecutionProvider';
  basePrice: number;
  
  constructor(id: string, name: string, basePrice: number) {
    this.id = id;
    this.name = name;
    this.basePrice = basePrice;
  }

  supportedStrategies(): ExecutionStrategy[] {
    return ['API', 'DEEP_LINK'];
  }
  
  capabilities(): ProviderCapabilities {
    return { canSearch: true, canBook: true, canCancel: true, canVerify: true };
  }
  
  requirements(): ProviderRequirements {
    return { needsInternet: true, needsLocation: true, needsLogin: true };
  }
  
  async health(): Promise<ProviderHealth> {
    return { isHealthy: true, lastChecked: Date.now() };
  }
  
  async metrics(): Promise<ProviderMetrics> {
    return { confidence: 95, latencyMs: 300 + Math.random() * 400 };
  }
  
  async authenticate() { return true; }

  async discover(context: ExecutionContext): Promise<any[]> {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 400));
    
    // Generate some mock options based on this provider's baseline
    return [
      {
        id: `${this.id}-standard`,
        values: {
          provider: this.name,
          price: this.basePrice + Math.floor(Math.random() * 100),
          eta: `${Math.floor(Math.random() * 10 + 2)} min`,
          distance: '23 km' // Ideally derived from context origin/dest
        },
        badge: this.id === 'uber' ? 'Best match' : undefined,
        badgeVariant: this.id === 'uber' ? 'primary' : undefined,
        icon: this.getIconUrl()
      }
    ];
  }
  
  async execute(context: ExecutionContext): Promise<ExecutionReceipt> {
    return {
      status: 'Started',
      providerId: this.id,
      strategyUsed: 'API',
      data: { rideId: `ride-${Math.random().toString(36).substring(7)}` }
    };
  }
  
  private getIconUrl() {
    if (this.id === 'uber') return 'https://upload.wikimedia.org/wikipedia/commons/c/cc/Uber_logo_2018.png';
    if (this.id === 'ola') return 'https://upload.wikimedia.org/wikipedia/commons/9/91/Ola_Cabs_logo.png';
    if (this.id === 'rapido') return 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5f/Rapido_Bike_Taxi_Logo.png/120px-Rapido_Bike_Taxi_Logo.png';
    return undefined;
  }
}

// Instantiate and register
export const uberProvider = new MockRideProvider('uber', 'Uber Premier', 1200);
export const olaProvider = new MockRideProvider('ola', 'Ola Prime', 1150);
export const rapidoProvider = new MockRideProvider('rapido', 'Rapido Bike', 350);

// Normally this happens at boot/plugin load time
providerRegistry.register(uberProvider);
providerRegistry.register(olaProvider);
providerRegistry.register(rapidoProvider);
