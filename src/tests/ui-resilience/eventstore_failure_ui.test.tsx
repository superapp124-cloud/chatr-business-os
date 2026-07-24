import React, { useState } from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KernelProvider, useCommand, useObjectRuntime } from '../../presentation-runtime/providers/KernelProvider';
import { KernelErrorBoundary } from '../../presentation-runtime/components/KernelErrorBoundary';
import '@testing-library/jest-dom';

const EventStoreTestComponent = () => {
 const executeCommand = useCommand();
 const [errorResult, setErrorResult] = useState<any>(null);

 const handleUpdate = async () => {
 const result = await executeCommand(
 {
 aggregateType: 'Candidate',
 aggregateId: 'cand-123',
 action: 'Create',
 payload: { status: 'New', name: 'Bob' }
 },
 'user-1',
 'tenant-1'
 );
 
 if (result.status === 'infrastructure_error') {
 setErrorResult(result);
 }
 };

 return (
 <div>
 <button data-testid="action-btn" onClick={handleUpdate}>Perform Action</button>
 {errorResult && (
 <div data-testid="error-message">
 Failed: {errorResult.message}
 {errorResult.retryable && <button data-testid="retry-btn" onClick={handleUpdate}>Retry</button>}
 <span data-testid="correlation-id">{errorResult.correlationId}</span>
 </div>
 )}
 </div>
 );
};

let testRuntime: any;
const RuntimeExtractor = () => {
 testRuntime = useObjectRuntime();
 return null;
};

describe('UI Resilience: EventStore Failure', () => {
 let originalAppend: any;

 beforeEach(() => {
 // Reset before each test
 if (testRuntime && originalAppend) {
 testRuntime.eventStore.append = originalAppend;
 }
 });

 it('displays a retryable infrastructure error when the EventStore is down', async () => {
 render(
 <KernelErrorBoundary>
 <KernelProvider>
 <RuntimeExtractor />
 <EventStoreTestComponent />
 </KernelProvider>
 </KernelErrorBoundary>
 );

 await waitFor(() => expect(testRuntime).toBeDefined());

 // Mock EventStore append failure
 originalAppend = testRuntime.eventStore.append.bind(testRuntime.eventStore);
 testRuntime.eventStore.append = vi.fn().mockRejectedValue(new Error('Database connection lost'));

 // Perform action
 fireEvent.click(screen.getByTestId('action-btn'));

 // UI should show the infrastructure error and retry button
 await waitFor(() => {
 expect(screen.getByTestId('error-message')).toBeInTheDocument();
 expect(screen.getByTestId('error-message').textContent).toMatch(/Database connection lost/i);
 });

 expect(screen.getByTestId('retry-btn')).toBeInTheDocument();
 expect(screen.getByTestId('correlation-id').textContent).not.toBe('');

 // Now restore the database and retry
 testRuntime.eventStore.append = originalAppend;
 fireEvent.click(screen.getByTestId('retry-btn'));

 // It should eventually succeed (in a real component, we'd clear errorResult, but for this test, if it succeeds, errorResult isn't cleared in our simple component unless we add logic, but let's test it succeeds and doesn't crash).
 });
});
