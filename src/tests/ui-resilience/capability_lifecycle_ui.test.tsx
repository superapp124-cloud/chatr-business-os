import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KernelProvider, useCapabilities, useCapabilityRegistry } from '../../presentation-runtime/providers/KernelProvider';
import '@testing-library/jest-dom';

const CapabilitiesList = () => {
 const packs = useCapabilities();
 return (
 <div>
 <ul data-testid="pack-list">
 {packs.filter(p => p.status === 'active').map(p => (
 <li key={p.manifest.id} data-testid={`pack-${p.manifest.id}`}>{p.manifest.name}</li>
 ))}
 </ul>
 </div>
 );
};

let testRegistry: any;
const RegistryExtractor = () => {
 testRegistry = useCapabilityRegistry();
 return null;
};

describe('UI Resilience: Capability Lifecycle', () => {
 it('dynamically updates UI when Capability Packs are installed and uninstalled', async () => {
 render(
 <KernelProvider>
 <RegistryExtractor />
 <CapabilitiesList />
 </KernelProvider>
 );

 // Initial packs might be "Recruitment" and "Executive Decisions"
 await waitFor(() => {
 expect(screen.getByTestId('pack-list')).toBeInTheDocument();
 });

 // Install a new pack dynamically
 act(() => {
 testRegistry.install({ id: 'test-pack', name: 'Test Pack v1' }, [
 { type: 'TestAggregate', properties: {} }
 ]);
 });

 await waitFor(() => {
 expect(screen.getByTestId('pack-test-pack')).toBeInTheDocument();
 expect(screen.getByTestId('pack-test-pack').textContent).toBe('Test Pack v1');
 });

 // Uninstall it dynamically
 act(() => {
 testRegistry.uninstall('test-pack');
 });

 await waitFor(() => {
 expect(screen.queryByTestId('pack-test-pack')).not.toBeInTheDocument();
 });
 });
});
