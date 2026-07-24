/**
 * KernelClient — React to CHATR Kernel Boundary
 *
 * This client defines the strict contract between the React UI and the Node Kernel.
 * The UI must remain completely agnostic of underlying AI models, execution paths,
 * or provider specifics. It only communicates "Intents".
 */

export interface IntentRequest {
  intent: string;
  context?: Record<string, any>;
  requestedBy?: string;
}

export interface IntentResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  correlationId?: string;
}

export class KernelClient {
  private static instance: KernelClient;

  private constructor() {}

  static getInstance(): KernelClient {
    if (!KernelClient.instance) {
      KernelClient.instance = new KernelClient();
    }
    return KernelClient.instance;
  }

  /**
   * Dispatch an intent to the OS Kernel for routing and execution.
   */
  async dispatchIntent<T = any>(request: IntentRequest): Promise<IntentResponse<T>> {
    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

    // 1. Desktop IPC Path
    if (isElectron && (window as any).electronAPI.kernel) {
      try {
        const result = await (window as any).electronAPI.kernel.invoke('intent', request);
        return result;
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    // 2. Desktop HTTP Path (Fallback to local server port 8088)
    try {
      const response = await fetch('http://127.0.0.1:8088/api/intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer local-kernel-token`
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
         throw new Error(`Kernel HTTP Error: ${response.statusText}`);
      }
      
      const json = await response.json();
      return json;
    } catch (err) {
      // 3. Graceful UI Fallback (If Kernel is down or we are on web without cloud backend)
      console.warn('[KernelClient] Failed to reach local Kernel:', err);
      
      return {
        success: false,
        error: 'The CHATR Kernel is currently unavailable. Please ensure the desktop app is running.'
      };
    }
  }

  /**
   * IDENTITY SERVICE
   */
  async getConnectedAccounts(): Promise<any[]> {
    const res = await this.dispatchIntent({ intent: 'identity.get_accounts' });
    if (res.success && res.data) return res.data;
    
    // Fallback stub for UI if Kernel isn't fully wired yet
    return [];
  }

  async connectProvider(providerId: string): Promise<boolean> {
    const res = await this.dispatchIntent({ intent: 'identity.connect', context: { providerId } });
    return res.success;
  }

  async disconnectAccount(accountId: string): Promise<boolean> {
    const res = await this.dispatchIntent({ intent: 'identity.disconnect', context: { accountId } });
    return res.success;
  }

  // Future stable contracts
  async executeWorkflow(workflowId: string, params: any) { /* ... */ }
  async queryMemory(query: string) { /* ... */ }
}

export const kernelClient = KernelClient.getInstance();
