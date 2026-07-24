import React, { useState, useEffect } from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KernelProvider, useCommand, useProjectionService, useSyncStatus, useQueryEngine } from '../../presentation-runtime/providers/KernelProvider';
import { KernelErrorBoundary } from '../../presentation-runtime/components/KernelErrorBoundary';
import '@testing-library/jest-dom';

const E2EResilienceComponent = () => {
 const executeCommand = useCommand();
 const queryEngine = useQueryEngine();
 const syncStatus = useSyncStatus();
 
 const [data, setData] = useState<any>(null);
 const [error, setError] = useState<any>(null);

 const refresh = async () => {
 const result = await queryEngine.get({ aggregateType: 'Candidate', aggregateId: 'cand-e2e', actorId: 'sys' });
 if (result) {
 setData(result);
 }
 };

 // Auto-sync on recovery
 useEffect(() => {
 if (syncStatus.state === '') {
 refresh();
 }
 }, [syncStatus, queryEngine]);

 const handleUpdate = async () => {
 if (!data) return;
 const res = await executeCommand(
 { aggregateType: 'Candidate', aggregateId: 'cand-e2e', action: 'Update', payload: { status: 'Interview' }, expectedVersion: data._version },
 'user-1', 'tenant-1'
 );
 
 if (res.status === 'infrastructure_error') {
 setError('Offline error');
 } else if (res.status === 'success') {
 // Optimistic update
 setData({ ...data, status: 'Interview', _version: data._version + 1 });
 setError(null);
 }
 };

 return (
 <div>
 <div data-testid="sync-state">{syncStatus.state}</div>
 <div data-testid="status">{data ? data.status : 'Loading'}</div>
 {error && <div data-testid="error-message">{error}</div>}
 <button data-testid="update-btn" onClick={handleUpdate}>Update</button>
 <button data-testid="refresh-btn" onClick={refresh}>Refresh</button>
 </div>
 );
};

let testProjectionService: any;
let testRuntime: any;
import { useObjectRuntime, useTelemetrySink } from '../../presentation-runtime/providers/KernelProvider';
let testTelemetry: any;

const ServicesExtractor = () => {
 testProjectionService = useProjectionService();
 testTelemetry = useTelemetrySink();
 return null;
};
const RuntimeExtractor = () => {
 testRuntime = useObjectRuntime();
 return null;
};

describe('UI Resilience: End-to-End Workflow', () => {
 it('handles the full lifecycle: normal operation -> crash -> offline UI -> recovery -> auto-sync -> resume', async () => {
 render(
 <KernelErrorBoundary>
 <KernelProvider>
 <ServicesExtractor />
 <RuntimeExtractor />
 <E2EResilienceComponent />
 </KernelProvider>
 </KernelErrorBoundary>
 );

 // Initial setup: create the aggregate
 await waitFor(() => expect(testRuntime).toBeDefined());
 await act(async () => {
 await testRuntime.executeCommand(
 { aggregateType: 'Candidate', aggregateId: 'cand-e2e', action: 'Create', payload: { status: 'New', name: 'E2E' } },
 'sys', 'tenant-1'
 );
 });

 // Wait for the projection to asynchronously process the event
 await new Promise(r => setTimeout(r, 50));
 fireEvent.click(screen.getByTestId('refresh-btn'));

 // Wait for UI to update to 'New'
 await waitFor(() => {
 expect(screen.getByTestId('status').textContent).toBe('New');
 });

 // 1. Simulate Crash
 act(() => {
 testProjectionService.stop();
 });

 await waitFor(() => {
 expect(screen.getByTestId('sync-state').textContent).toBe('offline');
 });

 // 2. UI Action fails gracefully
 fireEvent.click(screen.getByTestId('update-btn'));
 await waitFor(() => {
 expect(screen.getByTestId('error-message').textContent).toBe('Offline error');
 });

 // 3. Simulate Recovery
 act(() => {
 testProjectionService.start();
 });

 await waitFor(() => {
 expect(screen.getByTestId('sync-state').textContent).toBe('idle');
 });

 // Error should still be there because user hasn't dismissed it, but we can re-try
 fireEvent.click(screen.getByTestId('update-btn'));

 // 4. Action succeeds and UI updates optimistically
 await waitFor(() => {
 expect(screen.getByTestId('status').textContent).toBe('Interview');
 });

 // Verify Telemetry
 const events = testTelemetry.getEvents();
 expect(events.length).toBeGreaterThan(0);
 const offlineErrorEvent = events.find((e: any) => e.type === 'CommandFailed' && e.code === 'NETWORK');
 expect(offlineErrorEvent).toBeDefined();
 
 const successEvent = events.find((e: any) => e.type === 'CommandCompleted' && e.aggregateId === 'cand-e2e');
 expect(successEvent).toBeDefined();
 });
});
