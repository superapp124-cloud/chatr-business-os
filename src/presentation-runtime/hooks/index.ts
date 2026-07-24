export * from './useCommand';
export * from './useCapabilities';
export * from './useSyncStatus';
export * from './useEventBus';
export * from './useTelemetrySink';
export * from './useSyncSession';

import { useContext } from 'react';
import { KernelContext } from '../providers/KernelProvider';

export const useObjectRuntime = () => {
  const context = useContext(KernelContext);
  if (!context) throw new Error('useObjectRuntime must be used within a KernelProvider');
  return context.objectRuntime;
};

export const useQueryEngine = () => {
  const context = useContext(KernelContext);
  if (!context) throw new Error('useQueryEngine must be used within a KernelProvider');
  return context.queryEngine;
};

export const useProjectionService = () => {
  const context = useContext(KernelContext);
  if (!context) throw new Error('useProjectionService must be used within a KernelProvider');
  return context.projectionService;
};

export const useCapabilityRegistry = () => {
  const context = useContext(KernelContext);
  if (!context) throw new Error('useCapabilityRegistry must be used within a KernelProvider');
  return context.registry;
};
