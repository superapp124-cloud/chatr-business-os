import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BrainCircuit, CheckCircle2, Server, Database, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export const WorkspaceSetup: React.FC = () => {
 const navigate = useNavigate();
 const [currentStep, setCurrentStep] = useState(0);
 const [error, setError] = useState<string | null>(null);

 const steps = [
 { id: 'workspace', label: 'Creating your workspace', icon: Server },
 { id: 'ai', label: 'Waking up CHATR AI', icon: BrainCircuit },
 { id: 'storage', label: 'Preparing secure storage', icon: Database },
 { id: 'search', label: 'Indexing knowledge base', icon: Sparkles }
 ];

 useEffect(() => {
 let mounted = true;

 const runBootstrap = async () => {
 try {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session) {
 navigate('/login');
 return;
 }

 // 1. Call Platform Initialization Service
 setCurrentStep(0);
 const { error: initError } = await supabase.functions.invoke('platform-init', {
 body: { action: 'initialize' }
 });
 
 // If it throws an error, it might already be initialized. Let's do a health check.
 if (initError && !initError.message?.includes('already exists')) {
 console.warn('Initialization issue, attempting health check...', initError);
 const { error: healthError } = await supabase.functions.invoke('platform-init', {
 body: { action: 'health_check' }
 });
 if (healthError) throw healthError;
 }

 if (!mounted) return;
 setCurrentStep(1); // Workspace created

 // Simulate a slight delay for AI and Storage provisioning (in reality, listening to Event Bus)
 await new Promise(resolve => setTimeout(resolve, 1000));
 if (!mounted) return;
 setCurrentStep(2);

 await new Promise(resolve => setTimeout(resolve, 800));
 if (!mounted) return;
 setCurrentStep(3);

 await new Promise(resolve => setTimeout(resolve, 1200));
 if (!mounted) return;
 setCurrentStep(4); // All done

 // Final transition
 setTimeout(() => {
 if (mounted) {
 toast.success('Workspace ready!');
 navigate('/desktop/chat');
 }
 }, 500);

 } catch (err: any) {
 console.error('Bootstrap failed:', err);
 setError(err.message || 'Failed to initialize workspace');
 }
 };

 runBootstrap();

 return () => { mounted = false; };
 }, [navigate]);

 if (error) {
 return (
 <div className="min-h-full bg-[#0b0b14] flex items-center justify-center text-white p-4">
 <div className="max-w-md w-full bg-white/5 border border-red-500/20 rounded-2xl p-6 text-center">
 <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
 <span className="text-workspace">!</span>
 </div>
 <h2 className="text-workspace font-bold mb-2">Setup Failed</h2>
 <p className="text-white/60 text-secondary mb-6">{error}</p>
 <button 
 onClick={() => window.location.reload()}
 className="w-full h-10 rounded-lg bg-white/10 hover:bg-white/20 transition-colors font-medium text-secondary"
 >
 Try Again
 </button>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-full bg-[#0b0b14] flex flex-col items-center justify-center text-white relative overflow-hidden">
 {/* Background Glow */}
 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[100px] opacity-50" />
 
 <div className="relative z-10 max-w-sm w-full">
 <div className="text-center mb-10">
 <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 p-0.5 mx-auto mb-6 shadow-2xl shadow-violet-500/20">
 <div className="w-full h-full bg-[#0b0b14] rounded-[14px] flex items-center justify-center">
 <BrainCircuit className="w-8 h-8 text-violet-400" />
 </div>
 </div>
 <h1 className="text-page font-bold tracking-tight mb-2">Welcome to CHATR</h1>
 <p className="text-white/50 text-secondary">Preparing your intelligent workspace...</p>
 </div>

 <div className="space-y-4">
 {steps.map((step, index) => {
 const isCompleted = currentStep > index;
 const isCurrent = currentStep === index;
 const StepIcon = step.icon;

 return (
 <div 
 key={step.id} 
 className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-500 ${
 isCurrent ? 'bg-white/5 border border-white/10 scale-105' : 
 isCompleted ? 'opacity-50' : 'opacity-20'
 }`}
 >
 <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 ${
 isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 
 isCurrent ? 'bg-violet-500/20 text-violet-400' : 'bg-white/5 text-white/30'
 }`}>
 {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : 
 isCurrent ? <Loader2 className="w-4 h-4 animate-spin" /> : 
 <StepIcon className="w-4 h-4" />}
 </div>
 <div className="flex-1">
 <p className={`text-secondary font-medium ${isCurrent ? 'text-white' : 'text-white/70'}`}>
 {step.label}
 </p>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 );
};
