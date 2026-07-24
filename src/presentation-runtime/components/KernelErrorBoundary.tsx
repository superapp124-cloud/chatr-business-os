import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
 children: ReactNode;
 fallback?: ReactNode;
 onRecover?: () => void;
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
 console.error('KernelErrorBoundary caught an error:', error, errorInfo);
 }

 private handleRecover = () => {
 this.setState({ hasError: false, error: null });
 if (this.props.onRecover) {
 this.props.onRecover();
 }
 };

 public render() {
 if (this.state.hasError) {
 if (this.props.fallback) {
 return this.props.fallback;
 }

 return (
 <div style={{ padding: '20px', border: '1px solid red', borderRadius: '4px', backgroundColor: '#fee' }}>
 <h2 style={{ color: 'red' }}>A component failed to render</h2>
 <p>{this.state.error?.message}</p>
 <button onClick={this.handleRecover} style={{ padding: '8px 16px', cursor: 'pointer' }}>
 Try to recover
 </button>
 </div>
 );
 }

 return this.props.children;
 }
}
