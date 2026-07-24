import { useState, useCallback } from 'react';
import { kernelAPI } from '../runtime/KernelAPI';

interface CommandOptions {
  requiresPermission?: string;
}

export function useKernelCommand<TPayload = unknown, TResult = unknown>(commandType: string, options?: CommandOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (payload: TPayload): Promise<TResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      if (options?.requiresPermission) {
        const hasPerm = kernelAPI.permissions.check('ReactUI', options.requiresPermission);
        if (!hasPerm) {
          throw new Error(`Permission denied: Missing ${options.requiresPermission}`);
        }
      }

      const result = await kernelAPI.execute<TPayload, TResult>(commandType, payload);
      return result;
    } catch (err: any) {
      console.error(`[useKernelCommand] Failed to execute ${commandType}:`, err);
      setError(err.message || 'Unknown command execution error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [commandType, options?.requiresPermission]);

  return {
    execute,
    isLoading,
    error
  };
}
