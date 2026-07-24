import { registryService } from './RegistryService';
import { ProviderRecord } from './RegistrySchema';

const SEED_DATA: ProviderRecord[] = [
  // ─── TRAVEL (FLIGHTS) ────────────────────────────────────────────────────────
  {
    id: 'amadeus-gds',
    name: 'Amadeus',
    industry: 'Travel',
    subIndustry: 'Flights',
    status: 'ACTIVE',
    transport: 'MCP',
    capabilities: [
      { capabilityId: 'travel.flight.search', priority: 100 },
      { capabilityId: 'travel.flight.book', priority: 100 }
    ],
    authentication: { type: 'OAuth2', vaultKey: 'AMADEUS_PROD' },
    health: { uptime: 99.9, latencyMs: 120, successRate: 99, lastVerified: Date.now() },
    trustScore: 98,
    metadata: {
      description: 'Global Distribution System for flights',
      version: '1.2.0',
      isEnterpriseReady: true
    }
  },
  {
    id: 'skyscanner-api',
    name: 'Skyscanner',
    industry: 'Travel',
    subIndustry: 'Flights',
    status: 'ACTIVE',
    transport: 'REST',
    capabilities: [
      { capabilityId: 'travel.flight.search', priority: 80 }
    ],
    authentication: { type: 'API_KEY', vaultKey: 'SKYSCANNER_API' },
    health: { uptime: 99.5, latencyMs: 250, successRate: 96, lastVerified: Date.now() },
    trustScore: 90,
    metadata: {
      description: 'Flight meta-search engine',
      version: 'v3',
      isEnterpriseReady: false
    }
  },

  // ─── CAB BOOKING ─────────────────────────────────────────────────────────────
  {
    id: 'uber-rides',
    name: 'Uber',
    industry: 'Mobility',
    subIndustry: 'Ride Hailing',
    status: 'ACTIVE',
    transport: 'MCP',
    capabilities: [
      { capabilityId: 'mobility.ride.estimate', priority: 100 },
      { capabilityId: 'mobility.ride.book', priority: 100 }
    ],
    authentication: { type: 'OAuth2', vaultKey: 'UBER_USER_TOKEN' },
    health: { uptime: 99.9, latencyMs: 150, successRate: 98, lastVerified: Date.now() },
    trustScore: 97,
    metadata: {
      description: 'Global ride hailing service',
      version: '1.0.0',
      isEnterpriseReady: true
    }
  },
  {
    id: 'lyft-rides',
    name: 'Lyft',
    industry: 'Mobility',
    subIndustry: 'Ride Hailing',
    status: 'ACTIVE',
    transport: 'REST',
    capabilities: [
      { capabilityId: 'mobility.ride.estimate', priority: 90 },
      { capabilityId: 'mobility.ride.book', priority: 90 }
    ],
    authentication: { type: 'OAuth2', vaultKey: 'LYFT_USER_TOKEN' },
    health: { uptime: 99.8, latencyMs: 180, successRate: 97, lastVerified: Date.now() },
    trustScore: 94,
    metadata: {
      description: 'US ride hailing service',
      version: '2.1.0',
      isEnterpriseReady: true
    }
  },

  // ─── FOOD DELIVERY ───────────────────────────────────────────────────────────
  {
    id: 'zomato-food',
    name: 'Zomato',
    industry: 'Commerce',
    subIndustry: 'Food Delivery',
    status: 'ACTIVE',
    transport: 'MCP',
    capabilities: [
      { capabilityId: 'commerce.food.search', priority: 100 },
      { capabilityId: 'commerce.food.order', priority: 100 }
    ],
    authentication: { type: 'SESSION_TOKEN', vaultKey: 'ZOMATO_SESS' },
    health: { uptime: 99.7, latencyMs: 200, successRate: 95, lastVerified: Date.now() },
    trustScore: 95,
    metadata: {
      description: 'Food delivery and restaurant aggregator',
      version: '1.0.0',
      isEnterpriseReady: false
    }
  },
  {
    id: 'ubereats',
    name: 'Uber Eats',
    industry: 'Commerce',
    subIndustry: 'Food Delivery',
    status: 'ACTIVE',
    transport: 'BrowserAutomation',
    capabilities: [
      { capabilityId: 'commerce.food.search', priority: 80 },
      { capabilityId: 'commerce.food.order', priority: 80 }
    ],
    authentication: { type: 'SESSION_TOKEN', vaultKey: 'UBEREATS_COOKIES' },
    health: { uptime: 95.0, latencyMs: 3000, successRate: 85, lastVerified: Date.now() },
    trustScore: 82,
    metadata: {
      description: 'Playwright-based wrapper for Uber Eats',
      version: '0.9.1',
      isEnterpriseReady: false
    }
  }
];

export function seedProviders() {
  console.log(`[Seed] Seeding ${SEED_DATA.length} verified providers into Registry...`);
  SEED_DATA.forEach(provider => {
    registryService.insert(provider);
  });
  console.log('[Seed] Provider seeding complete.');
}
