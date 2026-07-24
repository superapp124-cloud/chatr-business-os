import React from 'react';
import { IntentState, IntentContext } from '../../core/kernel/KernelSession';
import { ShieldCheck, Lock, CreditCard, Package, MapPin, CheckCircle2, Loader2, Navigation } from 'lucide-react';

interface CheckoutFlowPanelProps {
 state: IntentState;
 context: IntentContext;
 onCompleteAuth: () => void;
 onConfirmAndPay: () => void;
}

export const CheckoutFlowPanel: React.FC<CheckoutFlowPanelProps> = ({ state, context, onCompleteAuth, onConfirmAndPay }) => {
 const isPast = (targetState: IntentState[]) => {
 const currentStateIdx = getStateIndex(state);
 const targetIdx = Math.max(...targetState.map(getStateIndex));
 return currentStateIdx > targetIdx;
 };

 const isCurrent = (targetState: IntentState[]) => targetState.includes(state);

 const getStateIndex = (s: IntentState) => {
 const order: IntentState[] = ['connecting', 'auth_required', 'auth_complete', 'review', 'paying', 'tracking', 'completed'];
 return order.indexOf(s);
 };

 if (getStateIndex(state) < 0) return null; // Not in checkout flow yet

 const result = context.selectedResult;
 if (!result) return null;

 return (
 <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
 {/* Header */}
 <div className="bg-gray-800 p-4 border-b border-gray-700">
 <h3 className="font-semibold text-white flex items-center justify-between">
 <span>Order from {result.name}</span>
 <span className="text-purple-400">{result.price}</span>
 </h3>
 </div>

 <div className="p-5 space-y-6">
 
 {/* Connection / Auth Stage */}
 <div className="flex flex-col gap-3">
 <div className="flex items-center gap-3">
 <div className={`p-2 rounded-full ${isCurrent(['connecting']) ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-green-400'}`}>
 {isCurrent(['connecting']) ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
 </div>
 <div>
 <span className={`font-medium ${isCurrent(['connecting']) ? 'text-white' : 'text-gray-300'}`}>
 {isCurrent(['connecting']) ? 'Connecting securely...' : 'Secure connection established'}
 </span>
 <span className="block text-label text-gray-500 mt-0.5">Powered by Zomato</span>
 </div>
 </div>

 {state === 'auth_required' && (
 <div className="ml-11 bg-gray-800/50 rounded-xl p-4 border border-gray-700">
 <div className="flex items-start gap-3 mb-3">
 <Lock className="w-5 h-5 text-gray-400 mt-0.5" />
 <div>
 <span className="text-secondary font-medium text-white block">Provider Login Required</span>
 <span className="text-label text-gray-400">Please sign in to Zomato to continue.</span>
 </div>
 </div>
 <button 
 onClick={onCompleteAuth}
 className="w-full bg-blue-600 hover:bg-blue-500 text-white text-button py-2 rounded-lg transition-colors"
 >
 Sign In Securely
 </button>
 </div>
 )}

 {(isPast(['auth_required', 'connecting']) || isCurrent(['auth_complete'])) && (
 <div className="ml-11 flex items-center gap-2 text-secondary text-green-400">
 <CheckCircle2 className="w-4 h-4" />
 <span>Checking provider session... ✓ Already signed in</span>
 </div>
 )}
 </div>

 {/* Review & Pay Stage */}
 {(getStateIndex(state) >= getStateIndex('review')) && (
 <div className="flex flex-col gap-3 pt-2 border-t border-gray-800">
 <div className="flex items-center gap-3">
 <div className={`p-2 rounded-full ${isCurrent(['review', 'paying']) ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800 text-green-400'}`}>
 {isCurrent(['paying']) ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
 </div>
 <span className={`font-medium ${isCurrent(['review', 'paying']) ? 'text-white' : 'text-gray-300'}`}>
 {isCurrent(['paying']) ? 'Processing payment...' : (isPast(['paying']) ? 'Payment successful' : 'Review & Pay')}
 </span>
 </div>

 {state === 'review' && (
 <div className="ml-11">
 <div className="bg-gray-800/50 rounded-xl p-4 mb-3 border border-gray-700">
 <div className="flex justify-between text-secondary text-gray-300 mb-2">
 <span>1x Chicken Biryani</span>
 <span>{result.price}</span>
 </div>
 <div className="flex justify-between text-secondary text-gray-300 mb-2">
 <span>Delivery Fee</span>
 <span className="text-green-400">Free</span>
 </div>
 <div className="border-t border-gray-700 mt-2 pt-2 flex justify-between font-bold text-white">
 <span>Total</span>
 <span>{result.price}</span>
 </div>
 </div>
 <button 
 onClick={onConfirmAndPay}
 className="w-full bg-green-600 hover:bg-green-500 text-white font-medium py-3 rounded-xl transition-colors flex justify-center items-center gap-2 shadow-lg shadow-green-900/20"
 >
 <CreditCard className="w-5 h-5" />
 Pay {result.price}
 </button>
 </div>
 )}
 </div>
 )}

 {/* Tracking Stage */}
 {(getStateIndex(state) >= getStateIndex('tracking')) && (
 <div className="flex flex-col gap-3 pt-2 border-t border-gray-800">
 <div className="flex items-center gap-3">
 <div className={`p-2 rounded-full ${isCurrent(['tracking']) ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-800 text-green-400'}`}>
 {isCurrent(['tracking']) ? <Navigation className="w-5 h-5 animate-pulse" /> : <CheckCircle2 className="w-5 h-5" />}
 </div>
 <span className={`font-medium ${isCurrent(['tracking']) ? 'text-white' : 'text-gray-300'}`}>
 {isCurrent(['tracking']) ? 'Live tracking: Order on the way' : 'Delivered'}
 </span>
 </div>

 {state === 'tracking' && (
 <div className="ml-11 bg-gray-800/30 rounded-xl h-32 border border-gray-700 flex items-center justify-center relative overflow-hidden">
 {/* Mock Map Background */}
 <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900 via-gray-900 to-gray-900"></div>
 
 {/* Mock Path & Icon */}
 <div className="z-10 flex flex-col items-center gap-2">
 <Package className="w-8 h-8 text-yellow-500" />
 <span className="text-secondary font-medium text-gray-300">Arriving in ~{result.deliveryTime}</span>
 </div>
 </div>
 )}

 {state === 'completed' && (
 <div className="ml-11 bg-green-900/20 rounded-xl p-4 border border-green-900/50 text-center">
 <span className="text-green-400 font-medium">Order Delivered Successfully</span>
 <span className="block text-secondary text-gray-400 mt-1">Enjoy your meal!</span>
 </div>
 )}
 </div>
 )}

 </div>
 </div>
 );
};
