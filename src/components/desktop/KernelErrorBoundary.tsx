import React, { Component, ErrorInfo, ReactNode } from 'react';
import { kernelAPI } from '@/core/runtime/KernelAPI';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
 children?: ReactNode;
}

interface State {
 hasError: boolean;
 error: Error | null;
}

export class KernelErrorBoundary extends Component<Props, State> {
 public state: State = {
 hasError: false,
 error: null
 };

 public static getDerivedStateFromError(error: Error): State {
 return { hasError: true, error };
 }

 public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
 console.error('[KernelErrorBoundary] Caught error:', error, errorInfo);
 
 // Pipe the UI crash directly into the Kernel's event stream
 kernelAPI.events.publish('UI_CRASH_DETECTED', {
 message: error.message,
 stack: error.stack,
 componentStack: errorInfo.componentStack
 }, { priority: 'critical' });
 }

 private handleRecover = () => {
 this.setState({ hasError: false, error: null });
 // Attempt to salvage state
 kernelAPI.commands.dispatch({
 id: crypto.randomUUID(),
 type: 'ATTEMPT_UI_RECOVERY',
 payload: {},
 requestedBy: 'KernelErrorBoundary',
 timestamp: Date.now()
 });
 };

 public render() {
 if (this.state.hasError) {
 return (
 <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-200 p-6">
 <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mb-6">
 <AlertCircle className="w-8 h-8 text-rose-500" />
 </div>
 <h1 className="text-page font-bold mb-2">UI Render Exception</h1>
 <p className="text-slate-400 mb-6 max-w-md text-center">
 A critical error occurred in the view layer. The Kernel is still running and has isolated the crash.
 </p>
 <div className="bg-slate-800 p-4 rounded-lg w-full max-w-2xl mb-8 overflow-auto border border-slate-700 font-mono text-label text-rose-300">
 {this.state.error?.message}
 </div>
 <button 
 onClick={this.handleRecover}
 className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-full font-bold shadow-lg shadow-indigo-900/20"
 >
 <RefreshCw className="w-4 h-4" />
 Reload Interface
 </button>
 </div>
 );
 }

 return this.props.children;
 }
}
