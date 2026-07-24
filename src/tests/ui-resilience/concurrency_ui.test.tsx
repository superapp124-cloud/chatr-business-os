import React, { useEffect, useState } from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { KernelProvider, useCommand, useQueryEngine, useSyncStatus, useObjectRuntime } from '../../presentation-runtime/providers/KernelProvider';
import { KernelErrorBoundary } from '../../presentation-runtime/components/KernelErrorBoundary';
import '@testing-library/jest-dom';

const ConcurrencyTestComponent = ({ aggregateId }: { aggregateId: string }) => {
 const queryEngine = useQueryEngine();
 const executeCommand = useCommand();
 const syncStatus = useSyncStatus();
 
 const [data, setData] = useState<any>(null);
 const [error, setError] = useState<string | null>(null);

 const refresh = () => {
 queryEngine.get({ aggregateType: 'Candidate', aggregateId, actorId: 'user-1' }).then(setData).catch(() => {});
 };

 useEffect(() => {
 refresh();
 }, [queryEngine, aggregateId]);

 const handleUpdate = async () => {
 // Optimistic update
 const optimisticData = { ...data, status: 'Offer' };
 setData(optimisticData);
 setError(null);

 console.log('--- handleUpdate called, expectedVersion:', data._version);
 const result = await executeCommand(
 {
 aggregateType: 'Candidate',
 aggregateId,
 action: 'Update',
 payload: { status: 'Offer' },
 expectedVersion: data._version
 },
 'user-1',
 'tenant-1'
 );
 console.log('--- executeCommand result:', result);

 if (result.status === 'concurrency_error') {
 console.log('--- setting error and latestState', result.message, result.latestState);
 setError(result.message);
 // Hard re-sync! Discard optimistic state
 setData(result.latestState);
 }
 };

 console.log('--- Rendering component, data:', data);

 if (!data) {
 return (
 <div>
 <div data-testid="loading">Loading...</div>
 <button data-testid="refresh-btn" onClick={refresh}>Refresh</button>
 </div>
 );
 }

 return (
 <div>
 <div data-testid="sync-state">{syncStatus.state}</div>
 <div data-testid="status">{data.status}</div>
 {error && <div data-testid="error-message">{error}</div>}
 <button data-testid="update-btn" onClick={handleUpdate}>
 Update to Offer
 </button>
 <button data-testid="refresh-btn" onClick={refresh}>
 Refresh
 </button>
 </div>
 );
};

// Component to expose runtime to the test
let testRuntime: any;
const RuntimeExtractor = () => {
 const runtime = useObjectRuntime();
 testRuntime = runtime;
 return null;
};

describe('UI Resilience: Concurrency', () => {
 it('handles concurrency conflicts by hard re-syncing to latest state', async () => {
 const aggregateId = 'cand-100';

 render(
 <KernelErrorBoundary>
 <KernelProvider>
 <RuntimeExtractor />
 <ConcurrencyTestComponent aggregateId={aggregateId} />
 </KernelProvider>
 </KernelErrorBoundary>
 );

 // Wait for runtime to be extracted
 await waitFor(() => expect(testRuntime).toBeDefined());

 // Create the Candidate via backend directly
 await act(async () => {
 await testRuntime.executeCommand(
 { aggregateType: 'Candidate', aggregateId, action: 'Create', payload: { name: 'Alice', status: 'New' } },
 'sys', 'tenant-1'
 );
 });

 // Refresh UI - the projection is eventually consistent, so we retry refreshing and checking
 await waitFor(() => {
 fireEvent.click(screen.getByTestId('refresh-btn'));
 expect(screen.getByTestId('status').textContent).toBe('New');
 }, { timeout: 3000 });

 // Now, simulate a concurrent worker updating the Candidate to "Interview"
 await act(async () => {
 await testRuntime.executeCommand(
 { aggregateType: 'Candidate', aggregateId, action: 'Update', payload: { status: 'Interview' } },
 'sys2', 'tenant-1'
 );
 });

 // Wait for the projection to asynchronously process the event
 await new Promise(r => setTimeout(r, 50));

 // Note: The UI hasn't been refreshed, so it still thinks the status is 'New'.
 // The user clicks "Update to Offer"
 await act(async () => {
 fireEvent.click(screen.getByTestId('update-btn'));
 });

 // The UI should display the concurrency error and HARD RE-SYNC to 'Interview' (the backend state)
 // NOT 'Offer' (the optimistic state)
 await waitFor(() => {
 expect(screen.getByTestId('error-message')).toBeInTheDocument();
 expect(screen.getByTestId('error-message').textContent).toMatch(/ConcurrencyError/i);
 expect(screen.getByTestId('status').textContent).toBe('Interview'); // Re-synced successfully!
 });
 });
});
