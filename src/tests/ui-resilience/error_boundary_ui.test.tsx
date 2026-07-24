import React, { useState } from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { KernelErrorBoundary } from '../../presentation-runtime/components/KernelErrorBoundary';
import '@testing-library/jest-dom';

const BuggyComponent = ({ shouldCrash }: { shouldCrash: boolean }) => {
 if (shouldCrash) {
 throw new Error('I crashed during render');
 }
 return <div>Component is fine</div>;
};

const SafeComponent = () => {
 return <div data-testid="safe">I am safe</div>;
};

describe('UI Resilience: Error Boundary', () => {
 it('catches render errors and displays fallback without crashing the app', () => {
 // Suppress console.error since React will log the error boundaries
 const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

 const TestApp = () => {
 const [crash, setCrash] = useState(false);
 return (
 <div>
 <button data-testid="crash-btn" onClick={() => setCrash(true)}>Make it crash</button>
 <SafeComponent />
 <KernelErrorBoundary>
 <BuggyComponent shouldCrash={crash} />
 </KernelErrorBoundary>
 </div>
 );
 };

 render(<TestApp />);

 // Initially fine
 expect(screen.getByText('Component is fine')).toBeInTheDocument();
 expect(screen.getByTestId('safe')).toBeInTheDocument();

 // Trigger crash
 act(() => {
 fireEvent.click(screen.getByTestId('crash-btn'));
 });

 // Error boundary should catch it
 expect(screen.getByText(/A component failed to render/i)).toBeInTheDocument();
 
 // The rest of the app should still be alive
 expect(screen.getByTestId('safe')).toBeInTheDocument();

 spy.mockRestore();
 });
});
