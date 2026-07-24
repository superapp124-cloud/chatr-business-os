import { IProvider, ProviderCapabilities, ProviderState, providerRegistry, ProviderRole } from './ProviderRegistry';

export class CommunicationProviderImpl implements IProvider {
  id = 'sys.communication.local';
  name = 'System Communication Provider';
  type = 'communication';
  role: ProviderRole = 'ExecutionProvider';
  
  capabilities(): ProviderCapabilities {
    return { canSearch: false, canBook: true, canCancel: false, canVerify: true };
  }
  
  async health(): Promise<ProviderState> {
    return { isHealthy: true, lastChecked: Date.now() };
  }

  async authenticate() { return true; }

  async create(payload: any): Promise<any> {
    console.log(`[CommunicationProvider] Dispatching communication:`, payload);
    const { type, recipient, message } = payload;
    
    // In a real implementation this would trigger native telephony or email SMTP
    return {
      success: true,
      transactionId: `COMM-${type.toUpperCase()}-${Date.now()}`,
      dispatchedAt: new Date().toISOString(),
      _provider: this.name
    };
  }

  async verify(id: string): Promise<any> {
    // Communication (like an email or call) is considered executed once dispatched
    return { verified: true, status: 'DISPATCHED' };
  }
}

const communicationProvider = new CommunicationProviderImpl();
providerRegistry.register(communicationProvider);
