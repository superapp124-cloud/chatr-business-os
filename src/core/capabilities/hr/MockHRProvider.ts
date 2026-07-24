import { WorkflowSDK } from '@/core/sdk/WorkflowSDK';

export const MockHRProvider = WorkflowSDK.createProvider(
  'mock-hr',
  'Mock HRMS Provider',
  'hr',
  'ExecutionProvider',
  {
    search: async (query: any) => {
      console.log(`[HRMS] Searching for ${query}`);
      return [];
    },
    create: async (payload: any) => {
      console.log(`[HRMS] Creating record:`, payload);
      return { id: 'HR-1234', status: 'created' };
    }
  }
);
