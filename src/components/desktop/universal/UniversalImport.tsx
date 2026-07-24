import React, { useState, useRef } from 'react';
import { Upload, X, Check, AlertCircle, FileText, ArrowRight, Loader2, Database } from 'lucide-react';
import { IObjectDefinition } from '../../../sdk/types';

interface UniversalImportProps {
 objectDef: IObjectDefinition;
 onImport: (records: Record<string, any>[]) => void;
 onClose: () => void;
}

export const UniversalImport: React.FC<UniversalImportProps> = ({ objectDef, onImport, onClose }) => {
 const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload');
 const [file, setFile] = useState<File | null>(null);
 const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
 const [csvData, setCsvData] = useState<string[][]>([]);
 
 // map: schema.fieldName -> csvHeaderName
 const [mapping, setMapping] = useState<Record<string, string>>({});
 const [error, setError] = useState<string | null>(null);
 
 const fileInputRef = useRef<HTMLInputElement>(null);

 // 1. Handle File Upload
 const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
 const uploadedFile = e.target.files?.[0];
 if (!uploadedFile) return;
 setFile(uploadedFile);
 
 const reader = new FileReader();
 reader.onload = (event) => {
 const text = event.target?.result as string;
 if (!text) return;
 
 const lines = text.split(/\r?\n/).filter(line => line.trim());
 if (lines.length < 2) {
 setError('CSV must contain a header row and at least one data row.');
 return;
 }
 
 const parseCsvRow = (line: string) => {
 const values: string[] = [];
 let value = '';
 let quoted = false;
 for (let index = 0; index < line.length; index += 1) {
 const character = line[index];
 if (character === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
 else if (character === '"') quoted = !quoted;
 else if (character === ',' && !quoted) { values.push(value.trim()); value = ''; }
 else value += character;
 }
 values.push(value.trim());
 return values;
 };
 const headers = parseCsvRow(lines[0]);
 const data = lines.slice(1).map(parseCsvRow);
 
 setCsvHeaders(headers);
 setCsvData(data);
 
 // Auto-map where names match exactly or closely
 const initialMapping: Record<string, string> = {};
 objectDef.fields.forEach(f => {
 const match = headers.find(h => 
 h.toLowerCase() === f.name.toLowerCase() || 
 h.toLowerCase() === f.label.toLowerCase()
 );
 if (match) initialMapping[f.name] = match;
 });
 setMapping(initialMapping);
 setStep('mapping');
 setError(null);
 };
 reader.readAsText(uploadedFile);
 };

 // 2. Build records from mapping
 const getMappedRecords = () => {
 return csvData.map(row => {
 const record: Record<string, any> = {};
 objectDef.fields.forEach(f => {
 const mappedHeader = mapping[f.name];
 if (mappedHeader) {
 const colIndex = csvHeaders.indexOf(mappedHeader);
 let val: any = row[colIndex];
 
 // Basic type coercion
 if (f.type === 'number') val = Number(val);
 if (f.type === 'boolean') val = val.toLowerCase() === 'true' || val === '1' || val.toLowerCase() === 'yes';
 
 record[f.name] = val;
 }
 });
 return record;
 });
 };

 // 3. Execute Import
 const handleImport = () => {
 setStep('importing');
 const records = getMappedRecords();
 
 onImport(records);
 onClose();
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
 <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
 
 {/* Header */}
 <div className="flex-shrink-0 px-6 py-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
 <Database className="text-indigo-400" size={20} />
 </div>
 <div>
 <h2 className="text-section font-bold text-white">Import {objectDef.pluralName}</h2>
 <p className="text-label text-zinc-400">Map your CSV columns to the Universal Schema</p>
 </div>
 </div>
 <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors">
 <X size={20} />
 </button>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-8" style={{ scrollbarWidth: 'none' }}>
 
 {error && (
 <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
 <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
 <p className="text-secondary text-red-300">{error}</p>
 </div>
 )}

 {/* STEP 1: UPLOAD */}
 {step === 'upload' && (
 <div 
 onClick={() => fileInputRef.current?.click()}
 className="border-2 border-dashed border-zinc-700 hover:border-indigo-500 bg-zinc-900/30 hover:bg-zinc-900/80 rounded-2xl p-12 text-center cursor-pointer transition-all flex flex-col items-center group"
 >
 <div className="w-16 h-16 rounded-full bg-zinc-800 group-hover:bg-indigo-500/20 flex items-center justify-center mb-4 transition-colors">
 <Upload className="text-zinc-400 group-hover:text-indigo-400" size={28} />
 </div>
 <h3 className="text-section font-bold text-white mb-2">Upload CSV File</h3>
 <p className="text-secondary text-zinc-500 max-w-sm">Select a CSV file from your computer to import into {objectDef.pluralName}.</p>
 <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleFileUpload} />
 </div>
 )}

 {/* STEP 2: MAPPING */}
 {step === 'mapping' && (
 <div className="space-y-6">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-secondary font-bold text-white">Map Columns</h3>
 <span className="text-label text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
 {Object.keys(mapping).length} of {objectDef.fields.length} fields mapped
 </span>
 </div>
 
 <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
 <div className="grid grid-cols-2 bg-zinc-800/50 p-3 text-label font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
 <div>{objectDef.name} Field (Target)</div>
 <div>CSV Column (Source)</div>
 </div>
 
 <div className="divide-y divide-zinc-800 max-h-[400px] overflow-y-auto">
 {objectDef.fields.map(field => (
 <div key={field.name} className="grid grid-cols-2 p-4 items-center gap-6">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <span className="text-secondary font-bold text-white">{field.label}</span>
 {field.required && <span className="text-[10px] font-bold text-rose-400 uppercase bg-rose-500/10 px-1.5 rounded">Required</span>}
 </div>
 <p className="text-label text-zinc-500 font-mono">{field.type}</p>
 </div>
 
 <div className="flex items-center gap-3">
 <ArrowRight className="text-zinc-600 flex-shrink-0" size={16} />
 <select
 value={mapping[field.name] || ''}
 onChange={(e) => setMapping(prev => ({ ...prev, [field.name]: e.target.value }))}
 className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-secondary text-zinc-200 outline-none focus:border-indigo-500"
 >
 <option value="">-- Ignore this field --</option>
 {csvHeaders.map(h => (
 <option key={h} value={h}>{h}</option>
 ))}
 </select>
 {mapping[field.name] && <Check className="text-emerald-500 flex-shrink-0" size={16} />}
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* STEP 3: PREVIEW */}
 {step === 'preview' && (
 <div className="space-y-4">
 <div className="flex items-center justify-between mb-2">
 <h3 className="text-secondary font-bold text-white">Preview Data</h3>
 <span className="text-label text-zinc-500">Showing first 3 of {csvData.length} records</span>
 </div>
 
 <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-left text-secondary whitespace-nowrap">
 <thead className="bg-zinc-800/50">
 <tr>
 {objectDef.fields.map(f => (
 <th key={f.name} className="px-4 py-3 font-bold text-zinc-400 text-table uppercase">{f.label}</th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-zinc-800">
 {getMappedRecords().slice(0, 3).map((record, i) => (
 <tr key={i} className="hover:bg-zinc-800/20">
 {objectDef.fields.map(f => (
 <td key={f.name} className="px-4 py-3 text-zinc-300">
 {record[f.name] !== undefined ? String(record[f.name]) : <span className="text-zinc-600">-</span>}
 </td>
 ))}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 )}

 {/* STEP 4: IMPORTING */}
 {step === 'importing' && (
 <div className="flex flex-col items-center justify-center py-20 text-center">
 <Loader2 className="animate-spin text-indigo-500 mb-6" size={48} />
 <h3 className="text-workspace font-bold text-white mb-2">Importing {csvData.length} Records...</h3>
 <p className="text-zinc-400 text-secondary max-w-md mx-auto">
 Validating schemas, assigning references, and running configured automations. This will just take a moment.
 </p>
 </div>
 )}

 </div>

 {/* Footer */}
 {step !== 'importing' && step !== 'upload' && (
 <div className="flex-shrink-0 px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
 <button
 onClick={() => step === 'preview' ? setStep('mapping') : setStep('upload')}
 className="px-4 py-2.5 text-secondary font-semibold text-zinc-400 hover:text-white transition-colors"
 >
 Back
 </button>
 
 {step === 'mapping' ? (
 <button
 onClick={() => setStep('preview')}
 className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-secondary font-bold rounded-xl transition-colors shadow-lg flex items-center gap-2"
 >
 Preview Import <ArrowRight size={16} />
 </button>
 ) : (
 <button
 onClick={handleImport}
 className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-button font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center gap-2"
 >
 <Check size={16} /> Confirm & Import {csvData.length} Records
 </button>
 )}
 </div>
 )}
 </div>
 </div>
 );
};
