import { ExecutionPlan } from '../core/types/ABI';

import { HealthStatus } from '../abi/v1';

export interface TransportResponse {
  payload: any;
  latencyMs: number;
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT';
  error?: string;
}

export interface RawCapabilityDescriptor {
  id: string;
  name: string;
  description: string;
  inputSchema: any;
  outputSchema?: any;
}

export interface ITransport {
  execute(plan: ExecutionPlan, parameters: any, abortSignal?: AbortSignal): Promise<TransportResponse>;
  healthCheck(endpoint: string): Promise<HealthStatus>;
  getCapabilities(endpoint: string): Promise<RawCapabilityDescriptor[]>;
}
