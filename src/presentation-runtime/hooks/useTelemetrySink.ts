import { useContext } from 'react';
import { KernelContext } from '../providers/KernelProvider';

export const useTelemetrySink = () => {
  const context = useContext(KernelContext);
  if (!context) throw new Error('useTelemetrySink must be used within a KernelProvider');
  return context.telemetrySink;
};
