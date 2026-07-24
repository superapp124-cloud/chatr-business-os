import React, { useEffect, useState } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KernelProvider, useSyncStatus, useProjectionService } from '../../presentation-runtime/providers/KernelProvider';
import { KernelErrorBoundary } from '../../presentation-runtime/components/KernelErrorBoundary';
import '@testing-library/jest-dom';

const SyncStateDisplay = () => {
 const syncStatus = useSyncStatus();
 return <div data-testid="sync-state">{syncStatus.state}</div>;
};

let testProjectionService: any;
const ServiceExtractor = () => {
 testProjectionService = useProjectionService();
 return null;
};

describe('UI Resilience: Projection Recovery', () => {
 it('displays graceful sync states during projection crash and recovery', async () => {
 render(
 <KernelErrorBoundary>
 <KernelProvider>
 <ServiceExtractor />
 <SyncStateDisplay />
 </KernelProvider>
 </KernelErrorBoundary>
 );

 // Initial state should be idle
 await waitFor(() => {
 expect(screen.getByTestId('sync-state').textContent).toBe('idle');
 });

 // Simulate crash
 act(() => {
 testProjectionService.stop();
 });

 await waitFor(() => {
 expect(screen.getByTestId('sync-state').textContent).toBe('offline');
 });

 // Simulate recovery/restart
 act(() => {
 testProjectionService.start();
 });

 // The state transitions to recovering, then idle rapidly.
 // We can at least assert it returns to idle.
 await waitFor(() => {
 expect(screen.getByTestId('sync-state').textContent).toBe('idle');
 });
 });
});
