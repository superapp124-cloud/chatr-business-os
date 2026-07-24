import { ExecutionKernel } from '../ExecutionKernel';
import { CapabilityRegistry } from '../CapabilityRegistry';
import { StateManager } from '../StateManager';
import { createExecutionContext } from '../ExecutionContext';
import { describe, it, expect, vi } from 'vitest';

describe('Business OS Kernel', () => {
  it('should route text generation intent to the registered AI provider', async () => {
    const mockProvider = {
      providerId: 'mock-ai',
      capabilityType: 'TextGeneration' as const,
      execute: vi.fn().mockResolvedValue({ text: 'Hello OS' })
    };
    
    CapabilityRegistry.register(mockProvider);
    
    const context = createExecutionContext('user-1', 'admin', 'org-1', {
      permissions: { 'TextGeneration:default': true } // Grant explicit intent permission for test
    });

    const result = await ExecutionKernel.execute(
      { capabilityType: 'TextGeneration', payload: { prompt: 'Hi' }, preferredProvider: 'mock-ai' },
      context
    );
    
    expect(result.text).toBe('Hello OS');
    expect(mockProvider.execute).toHaveBeenCalled();
  });

  it('should prevent invalid state transitions deterministically', async () => {
    // Mock the db call in a real test environment to return defined state transitions
    const transitionSpy = vi.spyOn(StateManager, 'getTransitions').mockResolvedValue([
      { fromState: 'Draft', toState: 'Pending', allowedRoles: ['admin', 'user'] },
      { fromState: 'Pending', toState: 'Approved', allowedRoles: ['admin'] }
    ]);

    // This should fail because user role cannot move Pending -> Approved
    await expect(
      StateManager.transitionState('entity-1', 'record-1', 'Pending', 'Approved', { role: 'user' })
    ).rejects.toThrow('is not authorized');

    // This should fail because Draft cannot jump to Approved
    await expect(
      StateManager.transitionState('entity-1', 'record-1', 'Draft', 'Approved', { role: 'admin' })
    ).rejects.toThrow('Invalid state transition');

    transitionSpy.mockRestore();
  });
});
