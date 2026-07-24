import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProviderOption {
 id: string;
 name: string;
 color: string;
}

interface HubConnectionPromptProps {
 hubName: string;
 providers: ProviderOption[];
}

export function HubConnectionPrompt({ hubName, providers }: HubConnectionPromptProps) {
 const navigate = useNavigate();

 return (
 <div className="flex flex-col items-center justify-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
 <div className="text-center space-y-6 max-w-md w-full">
 <div>
 <h2 className="text-display text-white mb-2">{hubName} Hub</h2>
 <p className="text-slate-400">No {hubName.toLowerCase()} accounts connected.</p>
 </div>
 
 <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 shadow-xl backdrop-blur-xl">
 <p className="text-secondary font-semibold text-slate-300 uppercase tracking-widest mb-4">Connect an account</p>
 <div className="space-y-3">
 {providers.map(provider => (
 <Button 
 key={provider.id} 
 variant="outline" 
 className="w-full justify-start h-14 bg-white/5 border-white/10 hover:bg-white/10 text-white font-medium text-section rounded-2xl"
 onClick={() => navigate('/desktop/connected-accounts')}
 >
 <div className={`w-8 h-8 rounded-full ${provider.color} flex items-center justify-center mr-3 text-secondary font-bold shadow-inner`}>
 {provider.name.charAt(0)}
 </div>
 Connect {provider.name}
 </Button>
 ))}
 </div>
 </div>
 </div>
 </div>
 );
}
