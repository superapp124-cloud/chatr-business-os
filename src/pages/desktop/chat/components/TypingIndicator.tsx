import React from 'react';

export const TypingIndicator = React.memo(() => (
 <div className="flex items-center gap-0.5">
 {[0, 1, 2].map(i => (
 <span 
 key={i} 
 className="w-1 h-1 rounded-full bg-emerald-400" 
 style={{ animation: `bounce 1s infinite ${i * 0.15}s` }} 
 />
 ))}
 </div>
));
