import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, QrCode, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const DesktopConnectScanner = () => {
 const navigate = useNavigate();
 const [isScanning, setIsScanning] = React.useState(false);

 const simulateScan = async () => {
 const pairingId = prompt("Enter the pairing_id displayed on your CHATR Desktop (look at the React/Vite console or the QR payload):");
 if (!pairingId) return;

 try {
 setIsScanning(true);
 
 if (pairingId.startsWith('mock-')) {
 // Fallback simulation since Edge Functions aren't deployed
 console.log("Simulating backend confirmation for mock ID...");
 await new Promise(resolve => setTimeout(resolve, 1000)); // simulate network delay
 
 // Manually broadcast the paired event since the backend isn't there to do it
 await supabase.channel(`desktop_pairing_${pairingId}`).send({
 type: 'broadcast',
 event: 'paired',
 payload: { token: 'mock-jwt-token-12345' }
 });
 } else {
 const { data, error } = await supabase.functions.invoke('desktop-pair-confirm', {
 body: { pairing_id: pairingId }
 });
 if (error) throw error;
 }
 
 toast.success("Desktop successfully paired!");
 navigate('/home');
 } catch (err: any) {
 console.error(err);
 toast.error("Pairing failed: " + (err.message || "Invalid QR or session expired"));
 } finally {
 setIsScanning(false);
 }
 };

 return (
 <div className="min-h-screen bg-slate-950 flex flex-col items-center p-4">
 <div className="w-full flex items-center justify-between mb-12 mt-4">
 <button 
 onClick={() => navigate(-1)}
 className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-90 transition-transform"
 >
 <ChevronLeft className="h-6 w-6" />
 </button>
 <h1 className="text-section font-bold text-white">Scan to Connect</h1>
 <div className="w-10" />
 </div>

 <Card className="w-full max-w-sm p-8 flex flex-col items-center space-y-8 bg-slate-900 border-slate-800 text-white rounded-3xl">
 <div className="h-64 w-64 border-2 border-dashed border-[#5c22ff] rounded-2xl flex flex-col items-center justify-center relative overflow-hidden bg-black/20">
 {/* Scanner animation simulation */}
 <div className="absolute top-0 left-0 w-full h-1 bg-[#5c22ff] animate-ping opacity-75" />
 <QrCode className="h-12 w-12 text-[#5c22ff]/50 mb-4" />
 <p className="text-secondary font-medium text-slate-400 text-center px-4">
 Point your camera at the QR code on your computer screen
 </p>
 </div>
 
 <div className="text-center space-y-2">
 <h2 className="text-workspace font-bold text-white">CHATR Desktop</h2>
 <p className="text-slate-400 text-secondary">
 Go to web.chatr.chat or open the CHATR Desktop app on your computer.
 </p>
 </div>

 {/* Temporary mock button for web testing */}
 <button 
 className="w-full py-3.5 rounded-xl bg-[#5c22ff] text-white font-bold active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
 onClick={simulateScan}
 disabled={isScanning}
 >
 {isScanning ? <Loader2 className="h-5 w-5 animate-spin" /> : "Simulate Scan (Dev Only)"}
 </button>
 </Card>
 </div>
 );
};
