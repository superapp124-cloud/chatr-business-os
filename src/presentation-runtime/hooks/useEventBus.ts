import { useContext } from 'react';
import { KernelContext } from '../providers/KernelProvider';

export const useEventBus = () => {
  const context = useContext(KernelContext);
  if (!context) throw new Error('useEventBus must be used within a KernelProvider');
  return context.eventBus;
};
