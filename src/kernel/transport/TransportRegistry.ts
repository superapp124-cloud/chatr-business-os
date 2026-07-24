import { ITransport } from './ITransport';
import { RestTransport } from './RestTransport';
import { MCPTransport } from './MCPTransport';
import { ExecutionPlan } from '../core/types/ABI';

export class TransportRegistry {
  private transports: Map<string, ITransport> = new Map();

  constructor() {
    this.transports.set('REST', new RestTransport());
    this.transports.set('MCP', new MCPTransport());
    // Browser, SDK, etc. will be registered here
  }

  get(type: ExecutionPlan['transport']): ITransport {
    const transport = this.transports.get(type);
    if (!transport) throw new Error(`Transport not found for type: ${type}`);
    return transport;
  }
}

export const transportRegistry = new TransportRegistry();
