import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { BusinessObjectStore } from '../../../sdk/engines/BusinessObjectStore';

export const UniversalForm = ({
 capabilityId,
 schema,
 initialData,
 onSave,
 onCancel
}: {
 capabilityId?: string;
 schema: any;
 initialData?: any;
 onSave: (data: any) => Promise<void>;
 onCancel: () => void;
}) => {
 const [formData, setFormData] = useState<Record<string, any>>({});
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [referenceOptions, setReferenceOptions] = useState<Record<string, {id: string, label: string}[]>>({});

 useEffect(() => {
 if (initialData) {
 setFormData(initialData);
 } else {
 // Setup default values
 const defaults: Record<string, any> = {};
 schema.fields.forEach((f: any) => {
 if (f.defaultValue !== undefined) {
 defaults[f.name] = f.defaultValue;
 }
 });
 setFormData(defaults);
 }
 }, [initialData, schema]);

 useEffect(() => {
 if (!capabilityId) return;
 const options: Record<string, {id: string, label: string}[]> = {};
 schema.fields.forEach((f: any) => {
 if (f.type === 'reference' && f.referenceTo) {
 const records = BusinessObjectStore.list(capabilityId, f.referenceTo);
 options[f.name] = records.map(r => ({
 id: r.id,
 label: r.Title || r.Name || r.Summary || r.Label || r.id
 }));
 }
 });
 setReferenceOptions(options);
 }, [schema, capabilityId]);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setLoading(true);
 setError('');
 
 // Basic validation
 for (const field of schema.fields) {
 if (field.required && !formData[field.name]) {
 setError(`${field.label} is required.`);
 setLoading(false);
 return;
 }
 }

 try {
 await onSave(formData);
 } catch (err: any) {
 setError(err.message || 'Failed to save record.');
 } finally {
 setLoading(false);
 }
 };

 const renderField = (field: any) => {
 const value = formData[field.name] || '';

 switch (field.type) {
 case 'string':
 case 'user': // simple text for now
 return (
 <input
 type="text"
 value={value}
 onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
 placeholder={field.placeholder || `Enter ${field.label}...`}
 readOnly={field.readonly}
 className="w-full bg-zinc-900 border border-zinc-800/80 rounded-xl py-2.5 px-4 text-secondary text-zinc-200 focus:outline-none focus:border-indigo-500/50 transition-all"
 />
 );
 case 'number':
 return (
 <input
 type="number"
 value={value}
 onChange={(e) => setFormData({ ...formData, [field.name]: parseFloat(e.target.value) })}
 readOnly={field.readonly}
 className="w-full bg-zinc-900 border border-zinc-800/80 rounded-xl py-2.5 px-4 text-secondary text-zinc-200 focus:outline-none focus:border-indigo-500/50 transition-all"
 />
 );
 case 'date':
 return (
 <input
 type="date"
 value={value}
 onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
 readOnly={field.readonly}
 className="w-full bg-zinc-900 border border-zinc-800/80 rounded-xl py-2.5 px-4 text-secondary text-zinc-200 focus:outline-none focus:border-indigo-500/50 transition-all"
 />
 );
 case 'enum':
 return (
 <select
 value={value}
 onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
 disabled={field.readonly}
 className="w-full bg-zinc-900 border border-zinc-800/80 rounded-xl py-2.5 px-4 text-secondary text-zinc-200 focus:outline-none focus:border-indigo-500/50 transition-all appearance-none"
 >
 <option value="">Select {field.label}...</option>
 {field.options?.map((opt: string) => (
 <option key={opt} value={opt}>{opt}</option>
 ))}
 </select>
 );
 case 'reference':
 return (
 <select
 value={value}
 onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
 className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-secondary text-zinc-200 outline-none focus:border-indigo-500 transition-colors"
 >
 <option value="">Select related {field.referenceTo}</option>
 {(referenceOptions[field.name] || []).map((opt) => (
 <option key={opt.id} value={opt.id}>{opt.label}</option>
 ))}
 </select>
 );
 case 'boolean':
 return (
 <label className="flex items-center gap-3 cursor-pointer mt-2">
 <div className="relative">
 <input
 type="checkbox"
 checked={!!value}
 onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })}
 disabled={field.readonly}
 className="sr-only"
 />
 <div className={`w-10 h-5 rounded-full transition-colors ${value ? 'bg-indigo-500' : 'bg-zinc-800 border border-zinc-700'}`} />
 <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
 </div>
 </label>
 );
 default:
 return null;
 }
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
 <div className="w-full max-w-2xl bg-[#09090b] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
 
 {/* Header */}
 <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center text-workspace">
 {schema.icon}
 </div>
 <div>
 <h2 className="text-section font-bold text-white">{initialData ? 'Edit' : 'Create'} {schema.name}</h2>
 <p className="text-label text-zinc-400">Universal Form Engine</p>
 </div>
 </div>
 <button onClick={onCancel} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Form Body */}
 <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'none' }}>
 {error && (
 <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-secondary">
 <AlertCircle className="w-5 h-5 shrink-0" />
 {error}
 </div>
 )}

 <form id="universal-form" onSubmit={handleSubmit} className="space-y-6">
 <div className="grid grid-cols-2 gap-6">
 {schema.fields.map((field: any) => {
 const widthClass = field.width === 'full' ? 'col-span-2' : 
 field.width === 'third' ? 'col-span-2 md:col-span-1' : // We don't have a grid-cols-3 easily nested here without redesign, just use 1
 'col-span-1';

 return (
 <div key={field.name} className={widthClass}>
 <label className="block text-label font-bold text-zinc-400 uppercase tracking-wider mb-2">
 {field.label} {field.required && <span className="text-red-400">*</span>}
 </label>
 {renderField(field)}
 {field.helpText && (
 <p className="mt-1.5 text-label text-zinc-500">{field.helpText}</p>
 )}
 </div>
 );
 })}
 </div>
 </form>
 </div>

 {/* Footer */}
 <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-end gap-3">
 <button
 onClick={onCancel}
 className="px-5 py-2.5 text-button font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
 >
 Cancel
 </button>
 <button
 form="universal-form"
 type="submit"
 disabled={loading}
 className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-button font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
 >
 {loading ? (
 <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
 ) : (
 <Save className="w-4 h-4" />
 )}
 Save {schema.name}
 </button>
 </div>

 </div>
 </div>
 );
};
