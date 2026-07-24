import { useBusinessWorkflows } from '@/hooks/useBusinessWorkflows';

export const useLiveWorkflows = () => {
  // useBusinessWorkflows already returns workflows, but we might want to standardize
  // the return shape to match the { data, isLoading, error, refresh } pattern
  // However, useBusinessWorkflows doesn't expose refresh directly, but it fetches on mount.
  
  const { workflows, isLoading, createWorkflow } = useBusinessWorkflows() as any;
  
  return {
    workflows: workflows || [],
    isLoading,
    error: null,
    refresh: () => { /* Add refresh if possible or let it be */ },
    isEmpty: !isLoading && (!workflows || workflows.length === 0)
  };
};
