import React, { useCallback, useEffect, useState } from 'react';
import { BarChart2, CheckCircle, PieChart } from 'lucide-react';
import { IDashboardDeclaration, IDashboardWidget } from '../../../sdk/types';
import { BusinessObjectStore } from '../../../sdk/engines/BusinessObjectStore';
import { EventBus } from '../../../sdk/engines/EventBus';

interface Props {
 capabilityId: string;
 dashboard: IDashboardDeclaration;
}

export const UniversalDashboard: React.FC<Props> = ({ capabilityId, dashboard }) => {
 const [data, setData] = useState<Record<string, Record<string, any>[]>>({});
 const [loading, setLoading] = useState(true);

 const loadData = useCallback(() => {
 const recordsByObject = dashboard.widgets.reduce<Record<string, Record<string, any>[]>>((result, widget) => {
 result[widget.object] = BusinessObjectStore.list(capabilityId, widget.object);
 return result;
 }, {});
 setData(recordsByObject);
 setLoading(false);
 }, [capabilityId, dashboard.widgets]);

 useEffect(() => {
 setLoading(true);
 loadData();
 const refresh = () => loadData();
 const subscriptions = ['WorkObjectCreated', 'WorkObjectUpdated', 'WorkObjectDeleted']
 .map(eventName => EventBus.subscribe(capabilityId, eventName, refresh));
 return () => subscriptions.forEach(unsubscribe => unsubscribe());
 }, [capabilityId, loadData]);

 if (loading) {
 return (
 <div className="grid grid-cols-4 gap-6 p-6 animate-pulse">
 {[1, 2, 3, 4].map(i => (
 <div key={i} className="col-span-1 h-48 bg-zinc-900/60 rounded-2xl border border-zinc-800/80"></div>
 ))}
 </div>
 );
 }

 if (!dashboard.widgets || dashboard.widgets.length === 0) {
 return (
 <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-zinc-500">
 <PieChart size={48} className="mb-4 opacity-20" />
 <p>No widgets defined for this dashboard.</p>
 </div>
 );
 }

 const renderWidget = (widget: IDashboardWidget, index: number) => {
 const colSpan = {
 'small': 'col-span-1',
 'medium': 'col-span-2',
 'large': 'col-span-3',
 'full': 'col-span-4'
 }[widget.size || 'small'];

 const records = (data[widget.object] || []).filter(record => (widget.filters || []).every(filter => {
 const value = record[filter.field];
 if (filter.operator === 'eq') return value === filter.value;
 if (filter.operator === 'neq') return value !== filter.value;
 if (filter.operator === 'contains') return String(value ?? '').toLowerCase().includes(String(filter.value).toLowerCase());
 if (filter.operator === 'in') return Array.isArray(filter.value) && filter.value.includes(value);
 if (filter.operator === 'notIn') return Array.isArray(filter.value) && !filter.value.includes(value);
 if (filter.operator === 'gt') return Number(value) > Number(filter.value);
 if (filter.operator === 'lt') return Number(value) < Number(filter.value);
 return true;
 }));
 const numericValues = widget.field ? records.map(record => Number(record[widget.field!] ?? 0)).filter(Number.isFinite) : [];
 const metric = widget.metric === 'sum' ? numericValues.reduce((total, value) => total + value, 0)
 : widget.metric === 'avg' ? (numericValues.length ? numericValues.reduce((total, value) => total + value, 0) / numericValues.length : 0)
 : widget.metric === 'min' ? (numericValues.length ? Math.min(...numericValues) : 0)
 : widget.metric === 'max' ? (numericValues.length ? Math.max(...numericValues) : 0)
 : records.length;
 const groups = records.reduce<Record<string, number>>((result, record) => {
 const key = String(record[widget.groupBy || 'status'] ?? 'Unassigned');
 result[key] = (result[key] || 0) + 1;
 return result;
 }, {});
 const chartValues = Object.entries(groups).slice(0, 6);
 const chartMax = Math.max(1, ...chartValues.map(([, value]) => value));
 const completed = records.filter(record => /complete|closed|done|won/i.test(String(record.status ?? record.Status ?? record.state ?? ''))).length;
 const completedPercent = records.length ? Math.round((completed / records.length) * 100) : 0;
 const formatMetric = widget.format === 'currency'
 ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(metric)
 : widget.format === 'percentage' ? `${Math.round(metric)}%`
 : new Intl.NumberFormat().format(metric);

 return (
 <div key={index} className={`bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-xl transition-all hover:border-zinc-700/80 hover:bg-zinc-900/80 ${colSpan}`}>
 <h3 className="text-zinc-400 font-semibold text-label mb-4 uppercase tracking-wider">{widget.label}</h3>
 
 {widget.type === 'metric' && (
 <div className="flex items-center gap-4 mt-2">
 <div className="p-4 rounded-xl bg-indigo-500/10 text-indigo-400">
 <BarChart2 size={32} />
 </div>
 <div>
 <div className="text-display font-semibold text-white">{formatMetric}</div>
 <div className="text-zinc-500 text-secondary mt-1">{widget.metric || 'count'}</div>
 </div>
 </div>
 )}

 {widget.type === 'list' && (
 <div className="flex flex-col gap-3">
 {records.slice(0, widget.limit || 3).map(record => (
 <div key={record.id} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 -mx-2 px-2 rounded-lg transition-colors">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
 <CheckCircle size={14} />
 </div>
 <div>
 <div className="text-zinc-200 text-secondary font-medium">{record.Title || record.Name || record.name || record.id}</div>
 <div className="text-zinc-500 text-label">{record.status || record.Status || 'Active'}</div>
 </div>
 </div>
 <div className="text-label bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full border border-emerald-500/20">{record.status || record.Status || 'Active'}</div>
 </div>
 ))}
 </div>
 )}

 {widget.type === 'bar-chart' && (
 <div className="h-40 mt-4 flex items-end gap-2">
 {chartValues.map(([label, value]) => (
 <div key={label} className="flex-1 bg-indigo-500/20 rounded-t hover:bg-indigo-500 transition-colors relative group" style={{ height: `${Math.max(4, (value / chartMax) * 100)}%` }}>
 <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-label px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">{value}</div>
 <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-zinc-500 text-[10px] uppercase truncate max-w-full">{label}</div>
 </div>
 ))}
 </div>
 )}

 {widget.type === 'pie-chart' && (
 <div className="h-40 mt-2 flex items-center justify-center relative">
 <svg viewBox="0 0 36 36" className="w-32 h-32 transform -rotate-90">
 <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#27272a" strokeWidth="4" />
 <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#6366f1" strokeWidth="4" strokeDasharray={`${completedPercent} ${100 - completedPercent}`} />
 </svg>
 <div className="absolute inset-0 flex items-center justify-center flex-col">
 <span className="text-white font-bold text-workspace">{completedPercent}%</span>
 <span className="text-zinc-500 text-[10px] uppercase">Completed</span>
 </div>
 </div>
 )}
 </div>
 );
 };

 return (
 <div className="grid grid-cols-4 gap-6 p-6 h-full overflow-y-auto bg-[#09090b]">
 {dashboard.widgets.map((w, i) => renderWidget(w, i))}
 </div>
 );
};
