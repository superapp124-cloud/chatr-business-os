/**
 * CHATR OS — Capability Workspace View
 *
 * The Universal Runtime's main container. Dynamically renders the correct view
 * (Dashboard, Grid, Kanban, Reports, Settings) from the capability's SDK metadata.
 * No per-capability React code needed.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Cpu, BarChart2, Grid, Columns, TrendingUp, Sliders, Trash2, CheckCircle2, X, FileText } from 'lucide-react';
import { UniversalGrid } from './UniversalGrid';
import { UniversalForm } from './UniversalForm';
import { UniversalImport } from './UniversalImport';
import { BusinessObjectStore } from '../../../sdk/engines/BusinessObjectStore';
import { EventBus } from '../../../sdk/engines/EventBus';
import { ICapabilitySDK, IViewDeclaration } from '../../../sdk/types';

// Try to import optional components (may not exist yet)
let UniversalDashboard: any = null;
let UniversalKanban: any = null;
let UniversalDetail: any = null;
try { UniversalDashboard = require('./UniversalDashboard').UniversalDashboard; } catch { }
try { UniversalKanban = require('./UniversalKanban').UniversalKanban; } catch { }
try { UniversalDetail = require('./UniversalDetail').UniversalDetail; } catch { }

// ─── View Icon Map ────────────────────────────────────────────────────────────
const VIEW_ICONS: Record<string, React.FC<any>> = {
 dashboard: BarChart2,
 grid: Grid,
 kanban: Columns,
 report: TrendingUp,
 form: Sliders,
 priorities: CheckCircle2,
 data: Grid,
 today: Columns,
 knowledge: FileText,
 automation: Cpu,
 history: TrendingUp
};

// ─── Capability Workspace View ────────────────────────────────────────────────

export const CapabilityWorkspaceView = ({
 sdk,
 manifest,
 onUninstall,
}: {
 sdk?: ICapabilitySDK; // full SDK (preferred)
 manifest?: any; // legacy manifest fallback
 onUninstall: (id: string) => void;
}) => {
 // Resolve capability data: prefer full SDK, fallback to manifest
 const cap = sdk || manifest;
 const capId = cap?.id;

 // Phase 8: Universal Rhythm (Decision-First Hierarchy)
 const views: any[] = [
 { id: 'overview', label: 'Overview', icon: '📊', type: 'dashboard', isDefault: true },
 { id: 'priorities', label: 'Your Priorities', icon: '⚡', type: 'priorities' },
 { id: 'data', label: 'Data & Records', icon: '📋', type: 'data' },
 { id: 'today', label: "Today's Work", icon: '📅', type: 'today' },
 { id: 'knowledge', label: 'Knowledge', icon: '📚', type: 'knowledge' },
 { id: 'automation', label: 'Automation', icon: '🤖', type: 'automation' },
 { id: 'history', label: 'History', icon: '🕒', type: 'history' },
 ];

 const defaultView = views.find(v => v.isDefault) || views[0];
 const [activeViewId, setActiveViewId] = useState(defaultView?.id);
 const [showConfig, setShowConfig] = useState(false);
 const [configValues, setConfigValues] = useState<Record<string, any>>({});
 const [saving, setSaving] = useState(false);
 const [saveSuccess, setSaveSuccess] = useState(false);
 const [showForm, setShowForm] = useState(false);
 const [showImport, setShowImport] = useState(false);
 const [editingRecord, setEditingRecord] = useState<any>(null);
 const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
 const [records, setRecords] = useState<Record<string, any[]>>({});

 const activeView = views.find(v => v.id === activeViewId) || views[0];

 // Load records for any view that has an object
 const loadRecords = useCallback((objectName: string) => {
 if (!objectName || !capId) return;
 const data = BusinessObjectStore.list(capId, objectName);
 setRecords(prev => ({ ...prev, [objectName]: data }));
 }, [capId]);

 useEffect(() => {
 if (activeView?.object) loadRecords(activeView.object);
 
 if (capId) {
 const unsubCreated = EventBus.subscribe(capId, 'WorkObjectCreated', () => {
 if (activeView?.object) loadRecords(activeView.object);
 });
 const unsubUpdated = EventBus.subscribe(capId, 'WorkObjectUpdated', () => {
 if (activeView?.object) loadRecords(activeView.object);
 });
 return () => {
 unsubCreated();
 unsubUpdated();
 };
 }
 }, [activeView, loadRecords, capId]);

 // Init config values
 useEffect(() => {
 const schema = sdk?.settings || manifest?.configSchema || [];
 const defaults: Record<string, any> = {};
 schema.forEach((f: any) => { defaults[f.key] = f.defaultValue ?? ''; });
 setConfigValues(defaults);
 }, [cap]);

 // ─── Get object definition ──────────────────────────────────────────────────
 const getObjectDef = (objectName: string) => {
 if (sdk?.objects) return sdk.objects.find(o => o.name === objectName);
 if (manifest?.objectSchemas) return manifest.objectSchemas.find((s: any) => s.name === objectName);
 return null;
 };

 // ─── Save config ────────────────────────────────────────────────────────────
 const handleSaveConfig = async () => {
 setSaving(true);
 try {
 await fetch('http://localhost:8787/api/capabilities/configure', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ tenantId: '11111111-1111-1111-1111-111111111111', capabilityId: capId, config: configValues }),
 }).catch(() => {});
 setSaveSuccess(true);
 setTimeout(() => { setSaveSuccess(false); setShowConfig(false); }, 1400);
 } finally { setSaving(false); }
 };

 // ─── Handle record save ─────────────────────────────────────────────────────
 const handleSaveRecord = (objectName: string, data: Record<string, any>) => {
 if (editingRecord?.id) {
 BusinessObjectStore.update(capId, objectName, editingRecord.id, data);
 } else {
 BusinessObjectStore.create(capId, objectName, data);
 }
 loadRecords(objectName);
 setShowForm(false);
 setEditingRecord(null);
 };

 // ─── Render active view content ─────────────────────────────────────────────
 const renderViewContent = () => {
 if (!activeView) return null;

 // Dashboard view
 if (activeView.type === 'dashboard') {
 const dashboard = sdk?.dashboards?.[0];
 if (dashboard && UniversalDashboard) {
 return <UniversalDashboard capabilityId={capId} dashboard={dashboard} />;
 }
 return (
 <div className="p-10 max-w-6xl mx-auto">
 <DashboardPlaceholder cap={cap} />
 </div>
 );
 }

 // Report view
 if (activeView.type === 'report') {
 const reports = sdk?.reports || [];
 return (
 <div className="p-10 max-w-6xl mx-auto">
 <ReportsPlaceholder reports={reports} capId={capId} />
 </div>
 );
 }

 // Settings view
 if (activeView.type === 'form' && activeView.id === 'settings') {
 const settingsFields = sdk?.settings || manifest?.configSchema || [];
 return (
 <div className="p-10 max-w-3xl mx-auto">
 <SettingsView fields={settingsFields} values={configValues} onChange={setConfigValues} onSave={handleSaveConfig} saving={saving} saveSuccess={saveSuccess} />
 </div>
 );
 }

 // Phase 11: Universal Rhythm Placeholders
 if (['priorities', 'today', 'knowledge', 'automation', 'history'].includes(activeView.type)) {
 return (
 <div className="flex-1 flex flex-col items-center justify-center text-center p-10 h-full">
 <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-6">
 <span className="text-page">{activeView.icon}</span>
 </div>
 <h2 className="text-page font-bold text-white mb-2">{activeView.label}</h2>
 <p className="text-zinc-500 max-w-md mx-auto">
 This module is connected to the {sdk?.name} runtime. Live data aggregation for {activeView.label.toLowerCase()} is being populated by the OS Kernel.
 </p>
 </div>
 );
 }

 // Grid or Kanban view (requires an object)
 if (!activeView.object) return null;
 const objectDef = getObjectDef(activeView.object);
 const objectRecords = records[activeView.object] || [];

 // Detail view — single record
 if (selectedRecordId) {
 if (UniversalDetail && objectDef) {
 return (
 <UniversalDetail
 capabilityId={capId}
 objectDefinition={objectDef}
 recordId={selectedRecordId}
 onBack={() => setSelectedRecordId(null)}
 onEdit={(r) => { setEditingRecord(r); setShowForm(true); }}
 />
 );
 }
 }

 // Kanban view
 if (activeView.type === 'kanban') {
 if (UniversalKanban && objectDef) {
 return (
 <div className="flex-1 overflow-hidden">
 <UniversalKanban
 capabilityId={capId}
 objectDefinition={objectDef}
 onRecordClick={(r: any) => setSelectedRecordId(r.id)}
 />
 </div>
 );
 }
 }

 // Data & Records view
 if (activeView.type === 'data') {
 const dataViews = sdk?.objects || manifest?.objectSchemas || [];
 const dataView = dataViews.find((v: any) => v.name.toLowerCase() === activeViewId.replace('data_', '')) || dataViews[0];
 
 if (!dataView) return <div className="p-10 text-center text-zinc-500">No objects defined for this capability.</div>;

 const objName = dataView.name;
 const objectRecords = records[objName] || [];
 const fields = dataView.fields || [];

 return (
 <div className="flex-1 flex flex-col overflow-hidden">
 <div className="px-8 py-4 border-b border-zinc-800/60 bg-zinc-950/20 flex gap-4">
 {dataViews.map((v: any) => (
 <button 
 key={v.name}
 onClick={() => setActiveViewId(`data_${v.name.toLowerCase()}`)}
 className={`text-secondary font-medium transition-colors ${activeViewId.replace('data_', '') === v.name.toLowerCase() || (!activeViewId.includes('data_') && v.name === dataView.name) ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'}`}
 >
 {v.pluralName || v.name}
 </button>
 ))}
 </div>
 <div className="flex-1 overflow-y-auto p-8" style={{ scrollbarWidth: 'none' }}>
 {showForm ? (
 <div className="max-w-3xl mx-auto">
 <button onClick={() => { setShowForm(false); setEditingRecord(null); }} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 text-secondary">
 ← Back to list
 </button>
 <UniversalForm
 schema={{ name: objName, pluralName: objName + 's', icon: dataView?.icon || '📋', fields, titleField: dataView?.titleField || fields[0]?.name || 'Name', views: [] }}
 initialData={editingRecord}
 onSave={(data) => handleSaveRecord(objName, data)}
 onCancel={() => { setShowForm(false); setEditingRecord(null); }}
 capabilityId={capId}
 />
 </div>
 ) : (
 <>
 <div className="flex items-center justify-between mb-6">
 <div>
 <h2 className="text-section font-bold text-white">{dataView.pluralName || dataView.name}</h2>
 <p className="text-secondary text-zinc-500">{objectRecords.length} record{objectRecords.length !== 1 ? 's' : ''}</p>
 </div>
 <div className="flex items-center gap-2">
 <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-3 py-2 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-secondary font-semibold rounded-xl transition-all border border-zinc-700/80">
 Import
 </button>
 <button onClick={() => document.querySelector<HTMLButtonElement>('[data-universal-grid-export]')?.click()} className="flex items-center gap-2 px-3 py-2 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-secondary font-semibold rounded-xl transition-all border border-zinc-700/80">
 Export
 </button>
 <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-secondary font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20">
 + New {objName}
 </button>
 </div>
 </div>

 <UniversalGrid
 schema={{ name: objName, pluralName: objName + 's', icon: '📋', fields, titleField: fields[0]?.name || 'Name', views: [] }}
 data={objectRecords}
 onRowClick={(r) => setSelectedRecordId(r.id)}
 onEdit={(r) => { setEditingRecord(r); setShowForm(true); }}
 onDelete={(r) => { BusinessObjectStore.delete(capId, objName, r.id); loadRecords(objName); }}
 capabilityId={capId}
 />
 </>
 )}
 </div>
 </div>
 );
 }

 if (activeView.type === 'priorities') {
 return (
 <div className="p-10 max-w-4xl mx-auto w-full">
 <h2 className="text-workspace font-bold text-white mb-6">Your Priorities in {cap?.name}</h2>
 <div className="p-8 border border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-zinc-500">
 <CheckCircle2 size={32} className="mb-3 opacity-20" />
 <p>You're all caught up. No priorities demand immediate attention.</p>
 </div>
 </div>
 );
 }

 if (activeView.type === 'today' || activeView.type === 'knowledge' || activeView.type === 'automation' || activeView.type === 'history') {
 return (
 <div className="p-10 text-center flex flex-col items-center justify-center h-full">
 <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-600 mb-4 border border-zinc-800">
 <Cpu size={24} />
 </div>
 <h2 className="text-workspace font-bold text-white mb-2">{activeView.label}</h2>
 <p className="text-zinc-500 max-w-md">This view is part of the new Universal Rhythm. Content will be populated by the Kernel context engine.</p>
 </div>
 );
 }

 return (
 <div className="p-10 text-center flex flex-col items-center justify-center h-full">
 <h2 className="text-workspace font-bold text-white mb-2">Unknown View Type</h2>
 </div>
 );
 };

 // ─── Render ─────────────────────────────────────────────────────────────────
 return (
 <div className="flex flex-col flex-1 h-full bg-[#09090b] overflow-hidden">
 {/* Header */}
 <div className="flex-shrink-0 border-b border-zinc-800/60 bg-zinc-950/40 backdrop-blur-xl">
 <div className="px-8 pt-6 pb-0">
 <div className="flex items-start justify-between mb-6">
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-page shadow-lg flex-shrink-0">
 {cap?.icon || '📦'}
 </div>
 <div>
 <div className="flex items-center gap-2 mb-1">
 <h1 className="text-workspace font-bold text-white">{cap?.name}</h1>
 <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 uppercase tracking-wider">{cap?.maturity || 'L3'}</span>
 <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-[10px] font-bold border border-zinc-700">v{cap?.version || '1.0.0'}</span>
 </div>
 <p className="text-secondary text-zinc-400 max-w-xl ">{cap?.description}</p>
 </div>
 </div>
 <div className="flex gap-2 flex-shrink-0">
 <button onClick={() => setShowConfig(true)} className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-secondary font-medium rounded-xl transition-colors border border-zinc-800 flex items-center gap-1.5">
 <Settings size={14} /> Configure
 </button>
 <button onClick={() => onUninstall(capId)} className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-secondary font-medium rounded-xl transition-colors border border-red-500/20 flex items-center gap-1.5">
 <Trash2 size={14} /> Uninstall
 </button>
 </div>
 </div>

 {/* View Tabs */}
 <div className="flex items-center gap-1">
 {views.map(view => {
 const Icon = VIEW_ICONS[view.type] || Grid;
 return (
 <button
 key={view.id}
 onClick={() => { setActiveViewId(view.id); setSelectedRecordId(null); setShowForm(false); }}
 className={`flex items-center gap-1.5 px-4 py-2.5 text-secondary font-medium border-b-2 transition-all -mb-px ${
 activeViewId === view.id
 ? 'border-indigo-500 text-indigo-400'
 : 'border-transparent text-zinc-500 hover:text-zinc-300'
 }`}
 >
 <Icon size={13} />
 {view.label}
 </button>
 );
 })}
 </div>
 </div>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-hidden flex flex-col">
 {renderViewContent()}
 </div>

 {/* Config Modal */}
 {showConfig && (
 <ConfigModal
 cap={cap}
 sdk={sdk}
 values={configValues}
 onChange={setConfigValues}
 onSave={handleSaveConfig}
 onClose={() => setShowConfig(false)}
 saving={saving}
 saveSuccess={saveSuccess}
 />
 )}

 {/* Import Modal */}
 {showImport && activeView?.object && (
 <UniversalImport
 objectDef={getObjectDef(activeView.object)}
 onImport={(records) => {
 records.forEach(r => BusinessObjectStore.create(capId, activeView.object!, r));
 loadRecords(activeView.object!);
 }}
 onClose={() => setShowImport(false)}
 />
 )}
 </div>
 );
};

// ─── Dashboard Placeholder ────────────────────────────────────────────────────

function DashboardPlaceholder({ cap }: { cap: any }) {
 const stats = [
 { label: 'Total Records', value: '0', icon: '📊', color: 'indigo' },
 { label: 'This Week', value: '0', icon: '📅', color: 'emerald' },
 { label: 'Active', value: '0', icon: '✅', color: 'violet' },
 { label: 'Pending', value: '0', icon: '⏳', color: 'amber' },
 ];
 return (
 <div>
 <div className="grid grid-cols-4 gap-4 mb-8">
 {stats.map((s, i) => (
 <div key={i} className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 backdrop-blur-xl">
 <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">{s.label}</div>
 <div className="text-display text-white">{s.value}</div>
 <div className="text-label text-zinc-600 mt-1">No data yet</div>
 </div>
 ))}
 </div>
 <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-16 text-center">
 <div className="text-display mb-4">{cap?.icon || '📊'}</div>
 <h2 className="text-workspace font-bold text-white mb-2">{cap?.name} Dashboard</h2>
 <p className="text-zinc-400 text-secondary">Create your first record to see live metrics and charts here.</p>
 </div>
 </div>
 );
}

// ─── Reports Placeholder ──────────────────────────────────────────────────────

function ReportsPlaceholder({ reports, capId }: { reports: any[]; capId: string }) {
 if (!reports.length) {
 return (
 <div className="text-center py-20">
 <TrendingUp size={40} className="text-zinc-600 mx-auto mb-4" />
 <h2 className="text-section font-bold text-white mb-2">No Reports Defined</h2>
 <p className="text-zinc-500 text-secondary">This capability has no report declarations.</p>
 </div>
 );
 }
 return (
 <div>
 <h2 className="text-section font-bold text-white mb-6">Reports</h2>
 <div className="grid grid-cols-2 gap-6">
 {reports.map(report => (
 <div key={report.id} className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-xl">
 <div className="flex items-center gap-3 mb-4">
 <span className="text-page">{report.icon || '📊'}</span>
 <div>
 <h3 className="font-bold text-white text-secondary">{report.label}</h3>
 <p className="text-label text-zinc-500">{report.description}</p>
 </div>
 </div>
 <div className="h-32 flex items-center justify-center bg-zinc-800/40 rounded-xl">
 <p className="text-label text-zinc-600">Add records to see this report</p>
 </div>
 </div>
 ))}
 </div>
 </div>
 );
}

// ─── Settings View ────────────────────────────────────────────────────────────

function SettingsView({ fields, values, onChange, onSave, saving, saveSuccess }: any) {
 return (
 <div>
 <h2 className="text-section font-bold text-white mb-6">Settings</h2>
 <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 space-y-6">
 {fields.map((field: any) => (
 <div key={field.key}>
 <label className="text-secondary font-semibold text-zinc-300 block mb-1">{field.label}</label>
 {field.description && <p className="text-label text-zinc-500 mb-2">{field.description}</p>}
 {field.type === 'boolean' ? (
 <button
 onClick={() => onChange((v: any) => ({ ...v, [field.key]: !v[field.key] }))}
 className={`w-10 h-5 rounded-full relative transition-all ${values[field.key] ? 'bg-indigo-500' : 'bg-zinc-700'}`}
 >
 <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all ${values[field.key] ? 'right-0.5' : 'left-0.5'}`} />
 </button>
 ) : field.type === 'select' ? (
 <select value={values[field.key] || ''} onChange={e => onChange((v: any) => ({ ...v, [field.key]: e.target.value }))}
 className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-secondary text-zinc-200 outline-none focus:border-indigo-500">
 {(field.options || []).map((o: string) => <option key={o}>{o}</option>)}
 </select>
 ) : (
 <input type={field.type === 'number' ? 'number' : 'text'} value={values[field.key] || ''} onChange={e => onChange((v: any) => ({ ...v, [field.key]: e.target.value }))}
 className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-secondary text-zinc-200 outline-none focus:border-indigo-500" />
 )}
 </div>
 ))}
 <button onClick={onSave} disabled={saving || saveSuccess}
 className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-button font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
 {saving ? 'Saving...' : saveSuccess ? <><CheckCircle2 size={16} /> Saved!</> : 'Save Settings'}
 </button>
 </div>
 </div>
 );
}

// ─── Config Modal ─────────────────────────────────────────────────────────────

function ConfigModal({ cap, sdk, values, onChange, onSave, onClose, saving, saveSuccess }: any) {
 const fields = sdk?.settings || cap?.configSchema || [];
 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
 <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
 <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
 <h2 className="text-body font-bold text-white flex items-center gap-2"><Settings size={16} className="text-indigo-400" /> Configure {cap?.name}</h2>
 <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
 </div>
 <div className="p-6 max-h-[60vh] overflow-y-auto space-y-5">
 {fields.length === 0 ? (
 <p className="text-center py-8 text-zinc-500 text-secondary">No configuration options for this capability.</p>
 ) : fields.map((field: any) => (
 <div key={field.key}>
 <label className="text-secondary font-semibold text-zinc-300 block mb-1">{field.label}</label>
 {field.description && <p className="text-label text-zinc-500 mb-2">{field.description}</p>}
 {field.type === 'boolean' ? (
 <button onClick={() => onChange({ ...values, [field.key]: !values[field.key] })}
 className={`w-10 h-5 rounded-full relative transition-all ${values[field.key] ? 'bg-indigo-500' : 'bg-zinc-700'}`}>
 <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all ${values[field.key] ? 'right-0.5' : 'left-0.5'}`} />
 </button>
 ) : field.type === 'select' ? (
 <select value={values[field.key] || ''} onChange={e => onChange({ ...values, [field.key]: e.target.value })}
 className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-secondary text-zinc-200 outline-none focus:border-indigo-500">
 {(field.options || []).map((o: string) => <option key={o}>{o}</option>)}
 </select>
 ) : (
 <input type={field.type === 'number' ? 'number' : 'text'} value={values[field.key] || ''} onChange={e => onChange({ ...values, [field.key]: e.target.value })}
 className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-secondary text-zinc-200 outline-none focus:border-indigo-500" />
 )}
 </div>
 ))}
 </div>
 <div className="px-6 py-4 border-t border-zinc-800 flex justify-end gap-3">
 <button onClick={onClose} className="px-4 py-2 text-button text-zinc-400 hover:text-white">Cancel</button>
 <button onClick={onSave} disabled={saving || saveSuccess}
 className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-button font-semibold rounded-xl flex items-center gap-2">
 {saving ? 'Saving...' : saveSuccess ? <><CheckCircle2 size={16} /> Saved!</> : 'Save Configuration'}
 </button>
 </div>
 </div>
 </div>
 );
}
