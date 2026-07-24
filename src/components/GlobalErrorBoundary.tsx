import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import chatrIconLogo from '@/assets/chatr-icon-logo.png';

interface Props {
 children: ReactNode;
}

interface State {
 hasError: boolean;
 error: Error | null;
 errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary that wraps the entire app
 * Provides a user-friendly error screen with recovery options
 */
export class GlobalErrorBoundary extends Component<Props, State> {
 public state: State = {
 hasError: false,
 error: null,
 errorInfo: null,
 };

 public static getDerivedStateFromError(error: Error): Partial<State> {
 return { hasError: true, error };
 }

 public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
 console.error('🚨 Global Error Boundary caught an error:', error);
 console.error('Component stack:', errorInfo.componentStack);
 
 this.setState({ errorInfo });

 // Log to analytics/crashlytics in production
 if (typeof window !== 'undefined' && (window as any).FirebaseCrashlytics) {
 try {
 (window as any).FirebaseCrashlytics.recordException({
 message: error.message,
 stacktrace: error.stack || '',
 });
 } catch (e) {
 // Silently fail if crashlytics not available
 }
 }
 }

 private handleReload = () => {
 window.location.reload();
 };

 private handleGoHome = () => {
 window.location.href = '/';
 };

 private handleReset = () => {
 this.setState({ hasError: false, error: null, errorInfo: null });
 };

 public render() {
 if (this.state.hasError) {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center p-4">
 <div className="max-w-md w-full text-center space-y-6">
 {/* Logo */}
 <div className="flex justify-center">
 <img 
 src={chatrIconLogo} 
 alt="Chatr" 
 className="h-16 w-16 opacity-50"
 width={64}
 height={64}
 />
 </div>

 {/* Error Icon */}
 <div className="flex justify-center">
 <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
 <AlertTriangle className="h-8 w-8 text-destructive" />
 </div>
 </div>

 {/* Error Message */}
 <div className="space-y-2">
 <h1 className="text-workspace text-foreground">
 Something went wrong
 </h1>
 <p className="text-secondary text-muted-foreground">
 We're sorry, but something unexpected happened. Please try one of the options below.
 </p>
 </div>

 {/* Error Details (Always visible for debugging) */}
 {this.state.error && (
 <div className="text-left bg-red-950/20 border border-red-900/50 rounded-lg p-4 text-label overflow-auto max-h-[400px]">
 <p className="text-red-400 font-bold mb-2">Error Message:</p>
 <p className="text-red-300 font-mono mb-4 whitespace-pre-wrap">{this.state.error.message}</p>
 
 <p className="text-red-400 font-bold mb-2">Stack Trace:</p>
 <pre className="text-red-300 font-mono whitespace-pre-wrap">
 {this.state.error.stack}
 </pre>
 
 {this.state.errorInfo && (
 <>
 <p className="text-red-400 font-bold mt-4 mb-2">Component Stack:</p>
 <pre className="text-red-300 font-mono whitespace-pre-wrap">
 {this.state.errorInfo.componentStack}
 </pre>
 </>
 )}
 </div>
 )}

 {/* Recovery Actions */}
 <div className="flex flex-col gap-3">
 <Button onClick={this.handleReset} className="w-full gap-2">
 <RefreshCw className="h-4 w-4" />
 Try Again
 </Button>
 
 <Button onClick={this.handleReload} variant="outline" className="w-full gap-2">
 <RefreshCw className="h-4 w-4" />
 Reload Page
 </Button>
 
 <Button onClick={this.handleGoHome} variant="ghost" className="w-full gap-2">
 <Home className="h-4 w-4" />
 Go to Home
 </Button>
 </div>

 {/* Support Link */}
 <p className="text-label text-muted-foreground">
 If this keeps happening, please{' '}
 <a href="/contact" className="text-primary hover:underline">
 contact support
 </a>
 </p>
 </div>
 </div>
 );
 }

 return this.props.children;
 }
}
