import { WorkflowSDK } from '@/core/sdk/WorkflowSDK';

export const MockFinanceProvider = WorkflowSDK.createProvider(
  'mock-finance',
  'Mock Finance Provider (SAP/Oracle/Tally abstraction)',
  'finance',
  'ExecutionProvider',
  {
    search: async (query: any) => {
      console.log(`[Finance] Searching ledger for: ${JSON.stringify(query)}`);
      return [];
    },
    create: async (payload: any) => {
      console.log(`[Finance] Creating financial record:`, payload);
      return { id: `FIN-${Date.now()}`, status: 'posted_to_erp' };
    },
    verify: async (id: string) => {
      return { id, status: 'verified', reconciled: false };
    }
  }
);
