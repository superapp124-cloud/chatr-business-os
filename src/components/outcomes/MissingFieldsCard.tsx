import React from 'react';
import { MissingField } from '../../core/capabilities/types';

interface MissingFieldsCardProps {
 missingFields: MissingField[];
 onSelect: (key: string, value: string) => void;
}

export const MissingFieldsCard: React.FC<MissingFieldsCardProps> = ({ missingFields, onSelect }) => {
 // Only render the first missing field to keep the UI clean
 const field = missingFields[0];
 if (!field) return null;

 return (
 <div className="bg-zinc-800/50 p-3 rounded-lg mt-2 border border-zinc-700/50">
 <p className="text-secondary text-white/90 font-medium mb-3">{field.label}</p>
 
 {field.type === 'choice' && field.options && (
 <div className="flex flex-wrap gap-2">
 {field.options.map(option => (
 <button
 key={option}
 onClick={() => onSelect(field.key, option)}
 className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-label rounded-full transition-colors border border-zinc-600"
 >
 {option}
 </button>
 ))}
 </div>
 )}
 
 {field.type === 'text' && (
 <div className="flex gap-2">
 <input 
 type="text" 
 placeholder="Type answer..." 
 className="flex-1 bg-zinc-900 border border-zinc-700 text-white text-input rounded-lg px-3 py-1.5 outline-none focus:border-emerald-500"
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 onSelect(field.key, e.currentTarget.value);
 }
 }}
 />
 </div>
 )}
 </div>
 );
};
