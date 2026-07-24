import React, { useEffect, useState, useMemo } from 'react';
import { ElectronKernelSession } from '../../core/kernel/ElectronKernelSession';
import { KernelSessionEvent, IntentState, IntentContext } from '../../core/kernel/KernelSession';
import { ExecutionPipelineViewer } from './ExecutionPipelineViewer';
import { DecisionResultsPanel } from './DecisionResultsPanel';
import { CheckoutFlowPanel } from './CheckoutFlowPanel';
import { PerformanceDashboard } from './PerformanceDashboard';

interface IntentFlowCardProps {
 intent: string;
}

export const IntentFlowCard: React.FC<IntentFlowCardProps> = ({ intent }) => {
 const kernel = useMemo(() => new ElectronKernelSession(), []);
 
 const [state, setState] = useState<IntentState>('idle');
 const [context, setContext] = useState<IntentContext>({ intent });

 useEffect(() => {
 const unsubscribe = kernel.subscribe((event: KernelSessionEvent) => {
 if (event.type === 'STATE_CHANGED' || event.type === 'METRIC_RECORDED') {
 if ('state' in event) setState(event.state);
 setContext(event.context);
 } else if (event.type === 'ERROR') {
 console.error('Kernel Error:', event.message);
 }
 });

 // Start execution
 kernel.submitIntent(intent);

 return () => {
 unsubscribe();
 kernel.destroy();
 };
 }, [intent, kernel]);

 const handleSelect = (id: string) => {
 kernel.selectOption(id);
 };

 const handleAuth = () => {
 kernel.completeAuth();
 };

 const handlePay = () => {
 kernel.confirmAndPay();
 };

 const showResults = state !== 'idle' && state !== 'resolving';

 return (
 <div className="w-full max-w-2xl mx-auto my-4 animate-in fade-in zoom-in-95 duration-300">
 <ExecutionPipelineViewer state={state} context={context} />
 
 {showResults && !context.selectedResult && (
 <DecisionResultsPanel context={context} onSelect={handleSelect} />
 )}

 {context.selectedResult && (
 <CheckoutFlowPanel 
 state={state} 
 context={context} 
 onCompleteAuth={handleAuth} 
 onConfirmAndPay={handlePay} 
 />
 )}

 {/* Live telemetry — always visible after first stage resolves */}
 {context.metrics && Object.keys(context.metrics).length > 0 && (
 <PerformanceDashboard
 context={context}
 totalMs={context.metrics?.Total_Intent_To_Results?.latencyMs}
 />
 )}
 </div>
 );
};
