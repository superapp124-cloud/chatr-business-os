import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const AICopilot: React.FC = () => {
 const [isOpen, setIsOpen] = React.useState(false);
 const [query, setQuery] = React.useState('');
 const [messages, setMessages] = React.useState<{role: 'user' | 'ai', content: string}[]>([]);

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!query.trim()) return;

 // Add user message
 setMessages(prev => [...prev, { role: 'user', content: query }]);
 setQuery('');

 // Simulate AI response/action
 setTimeout(() => {
 setMessages(prev => [
 ...prev, 
 { role: 'ai', content: "I've processed your request. Is there anything else you need?" }
 ]);
 }, 1000);
 };

 return (
 <>
 {/* Floating Action Button */}
 <motion.button
 onClick={() => setIsOpen(!isOpen)}
 className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-chatr-accent to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-chatr-accent/20 z-50 hover:shadow-xl hover:scale-105 transition-all"
 whileTap={{ scale: 0.95 }}
 >
 <span className="text-page">✨</span>
 </motion.button>

 {/* Copilot Panel */}
 <AnimatePresence>
 {isOpen && (
 <motion.div
 initial={{ opacity: 0, y: 20, scale: 0.95 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 20, scale: 0.95 }}
 transition={{ duration: 0.2 }}
 className="fixed bottom-24 right-6 w-96 h-[500px] bg-chatr-panel border border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50"
 >
 <div className="p-4 border-b border-gray-800 bg-gradient-to-r from-chatr-panel to-gray-900 flex justify-between items-center">
 <div className="flex items-center gap-2">
 <span className="text-workspace">✨</span>
 <span className="font-semibold text-white">Work Hub Copilot</span>
 </div>
 <button 
 onClick={() => setIsOpen(false)}
 className="text-gray-400 hover:text-white transition-colors"
 >
 ✕
 </button>
 </div>

 <div className="flex-1 overflow-y-auto p-4 space-y-4">
 {messages.length === 0 ? (
 <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 space-y-2">
 <span className="text-display">🤖</span>
 <p className="text-secondary">I can help you fill out this form, approve requests, or find information.</p>
 </div>
 ) : (
 messages.map((msg, idx) => (
 <div 
 key={idx} 
 className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
 >
 <div 
 className={`max-w-[80%] p-3 rounded-2xl text-secondary ${
 msg.role === 'user' 
 ? 'bg-chatr-accent text-white rounded-tr-sm' 
 : 'bg-gray-800 text-gray-200 rounded-tl-sm'
 }`}
 >
 {msg.content}
 </div>
 </div>
 ))
 )}
 </div>

 <div className="p-4 border-t border-gray-800">
 <form onSubmit={handleSubmit} className="relative">
 <input
 type="text"
 value={query}
 onChange={e => setQuery(e.target.value)}
 placeholder="Ask me anything..."
 className="w-full bg-chatr-dark border border-gray-700 rounded-xl py-3 pl-4 pr-12 text-secondary text-white focus:border-chatr-accent focus:outline-none transition-colors"
 />
 <button 
 type="submit"
 disabled={!query.trim()}
 className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-chatr-accent disabled:opacity-50 hover:bg-gray-800 rounded-lg transition-colors"
 >
 ↑
 </button>
 </form>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </>
 );
};
