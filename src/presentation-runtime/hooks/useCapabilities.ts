import { useState, useEffect } from 'react';
import { useCapabilityRegistry } from '../providers/KernelProvider';

export const useCapabilities = () => {
  const registry = useCapabilityRegistry();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    return registry.subscribe(() => setVersion(v => v + 1));
  }, [registry]);

  return registry.getPacks();
};
