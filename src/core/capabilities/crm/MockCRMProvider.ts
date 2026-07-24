import { WorkflowSDK } from '@/core/sdk/WorkflowSDK';

export const MockCRMProvider = WorkflowSDK.createProvider(
  'mock-crm',
  'Mock CRM Provider (Salesforce/HubSpot abstraction)',
  'crm',
  'ExecutionProvider',
  {
    search: async (query: any) => {
      // Simulate searching for accounts/leads
      console.log(`[CRM] Searching for: ${JSON.stringify(query)}`);
      return [
        { id: 'ACC-001', companyName: 'Acme Corp', industry: 'Technology' }
      ];
    },
    create: async (payload: any) => {
      console.log(`[CRM] Creating record:`, payload);
      return { id: `CRM-${Date.now()}`, status: 'created' };
    },
    verify: async (id: string) => {
      return { id, status: 'verified' };
    }
  }
);
