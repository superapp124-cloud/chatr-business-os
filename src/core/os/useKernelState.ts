import { useState, useEffect } from 'react';
import { kernelAPI } from '../runtime/KernelAPI';
import { CHATRState } from '../runtime/StateStore';

/**
 * React hook to reactively read from a Kernel StateStore domain.
 * Components will only re-render when their specific domain changes.
 */
export function useKernelState<K extends keyof CHATRState>(domain: K): CHATRState[K] {
  const [state, setState] = useState<CHATRState[K]>(kernelAPI.state.get(domain));

  useEffect(() => {
    // Subscribe returns an unsubscribe function
    const unsubscribe = kernelAPI.state.subscribe(domain, (newState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, [domain]);

  return state;
}
