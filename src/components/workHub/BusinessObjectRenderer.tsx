import React from 'react';
import { BusinessObjectDefinition, BusinessObject } from '../../types/workEngine';
import { ChevronDown, Calendar, Type, Hash } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
 definition: BusinessObjectDefinition;
 objectData?: BusinessObject;
 onSubmit: (data: any) => void;
 readOnly?: boolean;
}

export const BusinessObjectRenderer: React.FC<Props> = ({ 
 definition, 
 objectData, 
 onSubmit,
 readOnly = false
}) => {
 const [formData, setFormData] = React.useState<any>(objectData?.metadata || {});

 const handleChange = (field: string, value: any) => {
 if (readOnly) return;
 setFormData(prev => ({ ...prev, [field]: value }));
 };

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 onSubmit(formData);
 };

 return (
 <div className="bg-black/40 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
 <div className="flex items-center gap-4 mb-8">
 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center">
 <Type className="w-6 h-6 text-violet-400" />
 </div>
 <div>
 <h2 className="text-page font-bold text-white tracking-tight">{definition.name}</h2>
 <p className="text-secondary text-slate-400 mt-1">Complete the required fields below.</p>
 </div>
 </div>
 
 <form onSubmit={handleSubmit} className="space-y-6">
 {Object.entries(definition.fields.properties).map(([fieldName, fieldSchema], idx) => {
 const value = formData[fieldName] || '';
 const isRequired = definition.fields.required?.includes(fieldName);
 
 return (
 <motion.div 
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: idx * 0.05 }}
 key={fieldName} 
 className="flex flex-col"
 >
 <label className="text-secondary font-semibold text-slate-300 mb-2 capitalize tracking-wide flex items-center justify-between">
 <span>
 {fieldName.replace(/_/g, ' ')}
 {isRequired && <span className="text-rose-500 ml-1.5">*</span>}
 </span>
 </label>
 
 <div className="relative group">
 {fieldSchema.type === 'string' && !fieldSchema.enum && fieldSchema.format !== 'date' && (
 <>
 <Type className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
 <input
 type="text"
 value={value}
 onChange={(e) => handleChange(fieldName, e.target.value)}
 disabled={readOnly}
 className="w-full bg-black/50 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all placeholder-slate-600 hover:border-white/20"
 placeholder={`Enter ${fieldName.replace(/_/g, ' ')}...`}
 />
 </>
 )}

 {fieldSchema.type === 'string' && fieldSchema.format === 'date' && (
 <>
 <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-violet-400 transition-colors pointer-events-none" />
 <input
 type="date"
 value={value}
 onChange={(e) => handleChange(fieldName, e.target.value)}
 disabled={readOnly}
 className="w-full bg-black/50 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all placeholder-slate-600 hover:border-white/20 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
 />
 </>
 )}

 {fieldSchema.type === 'string' && fieldSchema.enum && (
 <>
 <select
 value={value}
 onChange={(e) => handleChange(fieldName, e.target.value)}
 disabled={readOnly}
 className="w-full bg-black/50 border border-white/10 rounded-2xl py-3.5 px-4 text-white focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all appearance-none cursor-pointer hover:border-white/20"
 >
 <option value="" disabled className="bg-slate-900 text-slate-500">Select an option...</option>
 {fieldSchema.enum.map((opt: string) => (
 <option key={opt} value={opt} className="bg-slate-900 text-white py-2">{opt}</option>
 ))}
 </select>
 <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
 <ChevronDown className="w-5 h-5 text-slate-400 group-focus-within:text-violet-400 transition-colors" />
 </div>
 </>
 )}

 {fieldSchema.type === 'number' && (
 <>
 <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
 <input
 type="number"
 value={value}
 onChange={(e) => handleChange(fieldName, parseFloat(e.target.value))}
 disabled={readOnly}
 className="w-full bg-black/50 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-all placeholder-slate-600 hover:border-white/20"
 placeholder="0.00"
 />
 </>
 )}
 </div>
 </motion.div>
 );
 })}

 {!readOnly && (
 <motion.div 
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.2 }}
 className="pt-6 flex justify-end"
 >
 <button
 type="submit"
 className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-section hover:shadow-[0_0_30px_rgba(124,58,237,0.4)] hover:scale-[1.02] transition-all w-full flex items-center justify-center gap-2"
 >
 Submit {definition.name}
 </button>
 </motion.div>
 )}
 </form>
 </div>
 );
};
