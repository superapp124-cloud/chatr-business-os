import React, { useState } from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KernelProvider, useCommand, useProjectionService } from '../../presentation-runtime/providers/KernelProvider';
import { KernelErrorBoundary } from '../../presentation-runtime/components/KernelErrorBoundary';
import '@testing-library/jest-dom';

const OfflineUIComponent = () => {
 const executeCommand = useCommand();
 const [result, setResult] = useState<any>(null);

 const handleAction = async () => {
 const res = await executeCommand(
 { aggregateType: 'Candidate', aggregateId: 'cand-999', action: 'Create', payload: {} },
 'sys', 'tenant'
 );
 setResult(res);
 };

 return (
 <div>
 <button data-testid="action-btn" onClick={handleAction}>Action</button>
 {result && <div data-testid="result-status">{result.status}</div>}
 {result && <div data-testid="result-message">{result.message}</div>}
 </div>
 );
};

let testProjectionService: any;
const ServiceExtractor = () => {
 testProjectionService = useProjectionService();
 return null;
};

describe('UI Resilience: Offline and Reconnect', () => {
 it('prevents commands when offline and allows them when reconnected', async () => {
 render(
 <KernelErrorBoundary>
 <KernelProvider>
 <ServiceExtractor />
 <OfflineUIComponent />
 </KernelProvider>
 </KernelErrorBoundary>
 );

 await waitFor(() => expect(testProjectionService).toBeDefined());

 // Simulate crash to enter offline state
 act(() => {
 testProjectionService.stop();
 });

 // Attempt an action while offline
 fireEvent.click(screen.getByTestId('action-btn'));

 // Should fail fast with infrastructure_error
 await waitFor(() => {
 expect(screen.getByTestId('result-status').textContent).toBe('infrastructure_error');
 expect(screen.getByTestId('result-message').textContent).toMatch(/Application is offline/i);
 });

 // Reconnect
 act(() => {
 testProjectionService.start();
 });

 // Allow action
 fireEvent.click(screen.getByTestId('action-btn'));

 await waitFor(() => {
 expect(screen.getByTestId('result-status').textContent).toBe('success');
 });
 });
});
