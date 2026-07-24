import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KernelProvider, useCapabilities, useCapabilityRegistry } from '../../presentation-runtime/providers/KernelProvider';
import '@testing-library/jest-dom';

const MetadataUI = () => {
 const packs = useCapabilities();
 const activePacks = packs.filter(p => p.status === 'active');
 const candidateObject = activePacks
 .flatMap(p => p.objects)
 .find(obj => obj.type === 'Candidate');

 if (!candidateObject) return <div data-testid="missing">No Candidate EDL</div>;

 const states = candidateObject.lifecycle?.states || [];

 return (
 <div>
 <ul data-testid="lifecycle-states">
 {states.map((state: any) => (
 <li key={state.name} data-testid={`state-${state.name}`}>{state.name}</li>
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

describe('UI Resilience: Metadata Evolution', () => {
 it('dynamically renders metadata changes without code modifications', async () => {
 render(
 <KernelProvider>
 <RegistryExtractor />
 <MetadataUI />
 </KernelProvider>
 );

 // Initial EDL states from the default Recruitment pack
 await waitFor(() => {
 expect(screen.getByTestId('state-applied')).toBeInTheDocument();
 expect(screen.getByTestId('state-interview')).toBeInTheDocument();
 expect(screen.getByTestId('state-offer')).toBeInTheDocument();
 expect(screen.getByTestId('state-hired')).toBeInTheDocument();
 });

 // Simulate an upgrade: Uninstall Recruitment, and install Recruitment v2
 act(() => {
 // Uninstall old Recruitment (hardcoded id is urn:chatr:pack:recruitment in packLoader)
 testRegistry.uninstall('recruitment');

 // Install v2
 testRegistry.install({ id: 'recruitment', name: 'Recruitment v2' }, [
 { 
 type: 'Candidate',
 lifecycle: {
 initialState: 'applied',
 states: [
 { name: 'applied' },
 { name: 'onboarding' }, // NEW state!
 { name: 'interview' },
 { name: 'offer' },
 { name: 'hired' }
 ]
 }
 }
 ]);
 });

 // UI should immediately reflect the new EDL structure
 await waitFor(() => {
 expect(screen.getByTestId('state-onboarding')).toBeInTheDocument();
 });
 });
});
