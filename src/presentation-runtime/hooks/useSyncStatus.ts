import { useContext } from 'react';
import { KernelContext } from '../providers/KernelProvider';

export const useSyncStatus = () => {
  const context = useContext(KernelContext);
  if (!context) throw new Error('useSyncStatus must be used within a KernelProvider');
  return context.syncStatus;
};
