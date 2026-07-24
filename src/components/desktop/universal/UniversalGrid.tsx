import React, { useState } from 'react';
import { Search, Filter, MoreHorizontal, Plus, FileDown, Activity, ChevronDown } from 'lucide-react';
import { BusinessObjectStore } from '../../../sdk/engines/BusinessObjectStore';

export const UniversalGrid = ({ 
 capabilityId,
 schema, 
 data, 
 onAdd, 
 onRowClick 
}: { 
 capabilityId?: string;
 schema: any, 
 data: any[], 
 onAdd?: () => void,
 onRowClick?: (record: any) => void
}) => {
 const [searchTerm, setSearchTerm] = useState('');

 // Extract fields to display in the grid (filter out some if we want, but for now show all or up to 6)
 const columns = schema.fields.slice(0, 6);

 const filteredData = data.filter(row => {
 if (!searchTerm) return true;
 const titleVal = row[schema.titleField]?.toString().toLowerCase() || '';
 return titleVal.includes(searchTerm.toLowerCase());
 });

 const handleExport = () => {
 if (filteredData.length === 0) return;
 const headers = columns.map((col: any) => col.label || col.name).join(',');
 const rows = filteredData.map(row => {
 return columns.map((col: any) => {
 let val = row[col.name] || '';
 if (col.type === 'reference' && val && capabilityId && col.referenceTo) {
 const refRec = BusinessObjectStore.get(capabilityId, col.referenceTo, val);
 val = refRec ? (refRec.Title || refRec.Name || refRec.Summary || refRec.Label || val) : val;
 }
 return `"${String(val).replace(/"/g, '""')}"`;
 }).join(',');
 });
 
 const csvContent = [headers, ...rows].join('\n');
 const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `${schema.pluralName.replace(/\s+/g, '_')}_Export.csv`;
 a.click();
 URL.revokeObjectURL(url);
 };

 return (
 <div className="flex flex-col h-full bg-zinc-900/40 rounded-2xl border border-zinc-800/80 overflow-hidden shadow-2xl backdrop-blur-md">
 {/* Grid Toolbar */}
 <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60">
 <div className="flex items-center gap-4">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
 <input 
 type="text" 
 placeholder={`Search ${schema.pluralName}...`}
 value={searchTerm}
 onChange={e => setSearchTerm(e.target.value)}
 className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl py-2 pl-9 pr-4 text-secondary text-zinc-200 focus:outline-none focus:border-indigo-500/50 w-64 transition-all"
 />
 </div>
 <button className="flex items-center gap-2 px-3 py-2 text-button text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-lg transition-colors border border-transparent hover:border-zinc-700/50">
 <Filter className="w-4 h-4" /> Filter
 </button>
 </div>
 <div className="flex items-center gap-3">
 <button data-universal-grid-export onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-button text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-lg transition-colors border border-transparent hover:border-zinc-700/50">
 <FileDown className="w-4 h-4" /> Export
 </button>
 {onAdd && (
 <button 
 onClick={onAdd}
 className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-button font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
 >
 <Plus className="w-4 h-4" /> New {schema.name}
 </button>
 )}
 </div>
 </div>

 {/* Grid Header */}
 <div className="grid grid-flow-col auto-cols-fr gap-4 px-6 py-3 bg-zinc-950/80 border-b border-zinc-800/80 text-label font-semibold text-zinc-500 uppercase tracking-wider">
 {columns.map((col: any) => (
 <div key={col.name} className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-300 transition-colors">
 {col.label}
 {col.sortable && <ChevronDown className="w-3 h-3 opacity-50" />}
 </div>
 ))}
 <div className="w-10"></div>
 </div>

 {/* Grid Body */}
 <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
 {filteredData.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-64 text-center">
 <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center mb-4">
 <span className="text-page">{schema.icon}</span>
 </div>
 <h3 className="text-zinc-300 font-medium mb-1">No {schema.pluralName.toLowerCase()} found</h3>
 <p className="text-zinc-500 text-secondary max-w-sm">
 {searchTerm ? `No results match "${searchTerm}"` : `Get started by creating your first ${schema.name.toLowerCase()}.`}
 </p>
 </div>
 ) : (
 <div className="divide-y divide-zinc-800/50">
 {filteredData.map((row: any, i: number) => (
 <div 
 key={row.id || i} 
 onClick={() => onRowClick && onRowClick(row)}
 className="grid grid-flow-col auto-cols-fr gap-4 px-6 py-4 hover:bg-zinc-800/30 cursor-pointer transition-colors group items-center"
 >
 {columns.map((col: any) => {
 const val = row[col.name];
 
 // Render based on type
 let content = <span className="text-secondary text-zinc-300 truncate">{val || '-'}</span>;
 
 if (col.type === 'enum' && val) {
 content = (
 <span className="inline-flex items-center px-2 py-0.5 rounded text-label bg-zinc-800 text-zinc-300 border border-zinc-700">
 {val}
 </span>
 );
 } else if (col.type === 'number' && col.displayFormat === 'percentage') {
 content = (
 <div className="flex items-center gap-2">
 <span className="text-secondary font-mono text-zinc-400">{val || 0}%</span>
 <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
 <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${val || 0}%` }} />
 </div>
 </div>
 );
 } else if (col.type === 'user' && val) {
 content = (
 <div className="flex items-center gap-2">
 <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white shadow-inner">
 {typeof val === 'string' ? val.substring(0, 2).toUpperCase() : 'U'}
 </div>
 <span className="text-secondary text-zinc-300 truncate">{typeof val === 'string' ? val : 'User'}</span>
 </div>
 );
 } else if (col.type === 'reference' && val && capabilityId && col.referenceTo) {
 const refRec = BusinessObjectStore.get(capabilityId, col.referenceTo, val);
 const displayLabel = refRec ? (refRec.Title || refRec.Name || refRec.Summary || refRec.Label || val) : val;
 content = <span className="text-secondary text-indigo-400 hover:underline cursor-pointer truncate">{displayLabel}</span>;
 }

 if (col.name === schema.titleField) {
 content = <span className="text-secondary font-semibold text-zinc-100 group-hover:text-indigo-400 transition-colors truncate">{val || '-'}</span>;
 }

 return <div key={col.name} className="flex items-center min-w-0">{content}</div>;
 })}
 <div className="w-10 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
 <button className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/50 rounded-lg transition-colors">
 <MoreHorizontal className="w-4 h-4" />
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 
 {/* Grid Footer */}
 <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-950/50 flex items-center justify-between text-label text-zinc-500">
 <div>{filteredData.length} {filteredData.length === 1 ? schema.name : schema.pluralName}</div>
 <div className="flex items-center gap-1">
 <Activity className="w-3 h-3" /> Real-time sync active
 </div>
 </div>
 </div>
 );
};
