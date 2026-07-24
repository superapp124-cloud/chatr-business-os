import { useContext } from 'react';
import { KernelContext } from '../providers/KernelProvider';
import { SyncSession } from '../sync/SyncSession';

export const useSyncSession = (): SyncSession => {
  const context = useContext(KernelContext);
  if (!context) throw new Error('useSyncSession must be used within a KernelProvider');
  return context.syncSession;
};
