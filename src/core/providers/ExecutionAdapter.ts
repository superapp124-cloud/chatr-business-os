import { ProviderRecord } from './RegistrySchema';
import { PlaywrightZomatoProvider } from './live/PlaywrightZomatoProvider';
import { PlaywrightMakeMyTripProvider } from './live/PlaywrightMakeMyTripProvider';

export interface ExecutionRequest {
  capabilityId: string;
  parameters: Record<string, unknown>;
}

export interface ExecutionResponse {
  status: 'SUCCESS' | 'FAILED';
  data?: any;
  error?: string;
  latencyMs: number;
}

export class ExecutionAdapter {
  public async execute(provider: ProviderRecord, request: ExecutionRequest): Promise<ExecutionResponse> {
    const startTime = Date.now();

    if (request.parameters?.dryRun) {
        return { status: 'SUCCESS', data: { success: true }, latencyMs: 150 };
    }

    try {
      let result: any = null;

      // Simulate network
      const delay = provider.transport === 'BrowserAutomation' ? 2500 : 800;
      await new Promise(r => setTimeout(r, delay));

      // Mock Data payload based on capability for UI wiring
      if (request.capabilityId === 'travel.flight.search' || request.capabilityId === 'travel.flight.book') {
          // Route to Live Playwright Agent
          const agent = new PlaywrightMakeMyTripProvider();
          const agentResult = await agent.execute({ capabilityId: request.capabilityId, parameters: request.parameters }, null);
          
          return { status: 'SUCCESS', data: agentResult, latencyMs: Date.now() - startTime };
      } else if (request.capabilityId === 'mobility.ride.estimate') {
          result = [
              { id: 'ride_1', type: 'Economy', name: provider.name + ' X', price: 450, eta: '4 mins', capacity: 4, reasons: ['Nearest driver'], confidence: 0.95 },
              { id: 'ride_2', type: 'Premium', name: provider.name + ' Black', price: 850, eta: '7 mins', capacity: 4, reasons: ['Top rated driver'], confidence: 0.88 },
              { id: 'ride_3', type: 'XL', name: provider.name + ' XL', price: 650, eta: '10 mins', capacity: 6, reasons: ['Best for groups'], confidence: 0.82 }
          ];
      } else if (request.capabilityId === 'commerce.food.search' || request.capabilityId === 'commerce.food.order') {
          // Route to Live Playwright Agent
          const agent = new PlaywrightZomatoProvider();
          const agentResult = await agent.execute({ capabilityId: request.capabilityId, parameters: request.parameters }, null);
          
          return {
              status: 'SUCCESS',
              data: agentResult,
              latencyMs: Date.now() - startTime
          };
      } else {
          result = { mockResponse: true, capability: request.capabilityId, via: provider.transport };
      }

      return {
        status: 'SUCCESS',
        data: result,
        latencyMs: Date.now() - startTime
      };
    } catch (e: any) {
      return {
        status: 'FAILED',
        error: e.message,
        latencyMs: Date.now() - startTime
      };
    }
  }
}

export const executionAdapter = new ExecutionAdapter();
