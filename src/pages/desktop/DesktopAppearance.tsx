import React, { useState, useEffect } from 'react';
import { Palette, Moon, Sun, Monitor, Type, LayoutGrid, Sliders } from 'lucide-react';
import { toast } from 'sonner';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { cn } from '@/lib/utils';

const THEMES = [
 { id: 'dark', label: 'Dark', icon: Moon, desc: 'Deep dark background' },
 { id: 'light', label: 'Light', icon: Sun, desc: 'Clean white background' },
 { id: 'system', label: 'System', icon: Monitor, desc: 'Follows your OS preference' },
];

const ACCENT_COLORS = [
 { id: 'indigo', label: 'Indigo', color: '#6366f1' },
 { id: 'violet', label: 'Violet', color: '#a855f7' },
 { id: 'emerald', label: 'Emerald', color: '#10b981' },
 { id: 'rose', label: 'Rose', color: '#f43f5e' },
 { id: 'amber', label: 'Amber', color: '#f59e0b' },
 { id: 'cyan', label: 'Cyan', color: '#06b6d4' },
];

const FONT_SIZES = [
 { id: 'small', label: 'Small', size: '13px' },
 { id: 'medium', label: 'Medium', size: '14px' },
 { id: 'large', label: 'Large', size: '16px' },
];

export const DesktopAppearance: React.FC = () => {
 const { themeMode, setThemeMode } = useAppearanceStore();
 const isDark = themeMode === 'dark';
 const [accentColor, setAccentColor] = useState(() => localStorage.getItem('chatr_accent') || 'indigo');
 const [fontSize, setFontSize] = useState(() => localStorage.getItem('chatr_fontsize') || 'medium');
 const [compactMode, setCompactMode] = useState(() => localStorage.getItem('chatr_compact') === 'true');
 const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('chatr_sidebar_collapsed') === 'true');

 const bg = isDark ? 'bg-[#0d0f1a]' : 'bg-slate-50';
 const cardBg = isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-white border-slate-200';
 const labelColor = isDark ? 'text-white/60' : 'text-slate-500';
 const headingColor = isDark ? 'text-white' : 'text-slate-900';
 const textColor = isDark ? 'text-white/80' : 'text-slate-700';

 const saveAccent = (id: string) => {
 setAccentColor(id);
 localStorage.setItem('chatr_accent', id);
 toast.success('Accent color updated');
 };

 const saveFontSize = (id: string) => {
 setFontSize(id);
 localStorage.setItem('chatr_fontsize', id);
 document.documentElement.style.fontSize = FONT_SIZES.find(f => f.id === id)?.size || '14px';
 toast.success('Font size updated');
 };

 const saveTheme = (id: string) => {
 setThemeMode(id as any);
 toast.success(`Theme set to ${id}`);
 };

 const Toggle = ({ label, desc, value, onChange }: any) => (
 <div className="flex items-center justify-between py-3">
 <div>
 <p className={cn('text-secondary font-medium', textColor)}>{label}</p>
 {desc && <p className={cn('text-label', labelColor)}>{desc}</p>}
 </div>
 <button onClick={() => { onChange(!value); }} className={cn('relative w-11 h-6 rounded-full transition-colors', value ? 'bg-indigo-500' : isDark ? 'bg-white/10' : 'bg-slate-200')}>
 <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', value ? 'left-5' : 'left-0.5')} />
 </button>
 </div>
 );

 return (
 <div className={cn('flex-1 overflow-y-auto p-8', bg)}>
 <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div className="mb-8">
 <h1 className={cn('text-display font-black tracking-tight', headingColor)}>Appearance</h1>
 <p className={labelColor}>Customize how CHATR looks and feels</p>
 </div>

 {/* Theme */}
 <div className={cn('rounded-2xl border p-6', cardBg)}>
 <div className="flex items-center gap-2 mb-4">
 <Palette className="w-5 h-5 text-indigo-400" />
 <h2 className={cn('font-bold', headingColor)}>Theme</h2>
 </div>
 <div className="grid grid-cols-3 gap-3">
 {THEMES.map(t => (
 <button key={t.id} onClick={() => saveTheme(t.id)}
 className={cn('p-4 rounded-xl border flex flex-col items-center gap-2 transition-all', themeMode === t.id
 ? 'border-indigo-500 bg-indigo-500/10'
 : isDark ? 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]' : 'border-slate-200 hover:bg-slate-50')}>
 <t.icon className={cn('w-5 h-5', themeMode === t.id ? 'text-indigo-400' : labelColor)} />
 <span className={cn('text-label font-semibold', themeMode === t.id ? 'text-indigo-400' : textColor)}>{t.label}</span>
 <span className={cn('text-[10px]', labelColor)}>{t.desc}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Accent Color */}
 <div className={cn('rounded-2xl border p-6', cardBg)}>
 <div className="flex items-center gap-2 mb-4">
 <Sliders className="w-5 h-5 text-indigo-400" />
 <h2 className={cn('font-bold', headingColor)}>Accent Color</h2>
 </div>
 <div className="flex gap-3 flex-wrap">
 {ACCENT_COLORS.map(c => (
 <button key={c.id} onClick={() => saveAccent(c.id)} title={c.label}
 className={cn('w-10 h-10 rounded-full transition-all', accentColor === c.id ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105')}
 style={{ background: c.color, ringColor: c.color, outlineOffset: '3px' }} />
 ))}
 </div>
 </div>

 {/* Font Size */}
 <div className={cn('rounded-2xl border p-6', cardBg)}>
 <div className="flex items-center gap-2 mb-4">
 <Type className="w-5 h-5 text-indigo-400" />
 <h2 className={cn('font-bold', headingColor)}>Font Size</h2>
 </div>
 <div className="grid grid-cols-3 gap-3">
 {FONT_SIZES.map(f => (
 <button key={f.id} onClick={() => saveFontSize(f.id)}
 className={cn('py-3 px-4 rounded-xl border text-center transition-all', fontSize === f.id
 ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
 : isDark ? 'border-white/[0.08] text-white/60 hover:bg-white/[0.05]' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>
 <div className="font-bold" style={{ fontSize: f.size }}>Aa</div>
 <div className="text-label mt-1">{f.label}</div>
 </button>
 ))}
 </div>
 </div>

 {/* Layout */}
 <div className={cn('rounded-2xl border divide-y p-6', cardBg, isDark ? 'divide-white/[0.06]' : 'divide-slate-100')}>
 <div className="flex items-center gap-2 mb-3">
 <LayoutGrid className="w-5 h-5 text-indigo-400" />
 <h2 className={cn('font-bold', headingColor)}>Layout</h2>
 </div>
 <Toggle label="Compact Mode" desc="Reduce padding and spacing throughout the UI"
 value={compactMode}
 onChange={(v: boolean) => { setCompactMode(v); localStorage.setItem('chatr_compact', String(v)); toast.success(v ? 'Compact mode on' : 'Compact mode off'); }} />
 <Toggle label="Collapsed Sidebar by Default" desc="Start with the left sidebar collapsed"
 value={sidebarCollapsed}
 onChange={(v: boolean) => { setSidebarCollapsed(v); localStorage.setItem('chatr_sidebar_collapsed', String(v)); toast.success('Sidebar preference saved'); }} />
 </div>
 </div>
 </div>
 );
};

export default DesktopAppearance;
