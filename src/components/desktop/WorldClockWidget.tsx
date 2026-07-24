import React, { useState, useEffect } from 'react';
import { Clock, X, Globe } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const COMMON_TIMEZONES = [
 { value: 'America/New_York', label: 'New York (EST)' },
 { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
 { value: 'Europe/London', label: 'London (GMT)' },
 { value: 'Europe/Paris', label: 'Paris (CET)' },
 { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
 { value: 'Asia/Dubai', label: 'Dubai (GST)' },
 { value: 'Asia/Kolkata', label: 'India (IST)' },
 { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

export const WorldClockWidget = () => {
 const [timezones, setTimezones] = useState<string[]>(['local']);
 const [times, setTimes] = useState<Record<string, string>>({});

 useEffect(() => {
 const saved = localStorage.getItem('chatr_world_clocks');
 if (saved) {
 try { 
 const parsed = JSON.parse(saved);
 if (Array.isArray(parsed) && parsed.length > 0) {
 setTimezones(parsed);
 }
 } catch (e) {
 console.error('Error loading timezones', e);
 }
 }
 }, []);

 useEffect(() => {
 localStorage.setItem('chatr_world_clocks', JSON.stringify(timezones));
 const updateTimes = () => {
 const now = new Date();
 const newTimes: Record<string, string> = {};
 timezones.forEach(tz => {
 if (tz === 'local') {
 newTimes[tz] = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
 } else {
 try {
 newTimes[tz] = now.toLocaleTimeString([], { timeZone: tz, hour: '2-digit', minute: '2-digit' });
 } catch (e) {
 newTimes[tz] = 'Invalid TZ';
 }
 }
 });
 setTimes(newTimes);
 };
 updateTimes();
 const interval = setInterval(updateTimes, 60000);
 return () => clearInterval(interval);
 }, [timezones]);

 const addTimezone = (tz: string) => {
 if (timezones.length < 4 && !timezones.includes(tz)) {
 setTimezones([...timezones, tz]);
 }
 };

 const removeTimezone = (tz: string) => {
 if (tz === 'local') return;
 setTimezones(timezones.filter(t => t !== tz));
 };

 const getLabel = (tz: string) => {
 if (tz === 'local') return 'Local';
 const match = COMMON_TIMEZONES.find(c => c.value === tz);
 return match ? match.label.split(' ')[0] : tz.split('/').pop()?.replace('_', ' ');
 };

 return (
 <Popover>
 <PopoverTrigger asChild>
 <button className="flex items-center gap-3.5 bg-white/10 hover:bg-white/15 transition-all px-4 py-2 rounded-xl ml-3 border border-white/20 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.2)] group cursor-pointer hover:border-purple-400/30">
 <div className="bg-purple-500/20 p-1.5 rounded-lg">
 <Clock className="w-5 h-5 text-purple-300 group-hover:scale-110 transition-transform" /> 
 </div>
 <div className="flex items-center gap-3.5">
 {timezones.map(tz => (
 <div key={tz} className="flex flex-col items-start leading-none border-l border-white/10 pl-3.5 first:border-0 first:pl-0">
 <span className="text-[10px] text-purple-200/80 font-black tracking-widest uppercase mb-1">{getLabel(tz)}</span>
 <span className="text-[17px] font-black tracking-wide text-white">{times[tz] || '--:--'}</span>
 </div>
 ))}
 </div>
 </button>
 </PopoverTrigger>
 <PopoverContent className="w-80 bg-[#11111a] border-white/10 text-white p-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl" align="start">
 <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
 <div className="flex items-center gap-2">
 <div className="p-1.5 bg-purple-500/20 rounded-lg">
 <Globe className="w-4 h-4 text-purple-400" />
 </div>
 <h4 className="font-bold text-secondary">World Clock</h4>
 </div>
 <span className="text-label text-white/50 bg-white/5 px-2 py-1 rounded-md">{timezones.length}/4 zones</span>
 </div>
 
 <div className="space-y-2 mb-4">
 {timezones.map(tz => (
 <div key={tz} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 group hover:bg-white/10 transition-colors">
 <div>
 <div className="text-secondary font-bold text-white/90">{getLabel(tz)}</div>
 <div className="text-[11px] text-white/50 mt-0.5">{tz === 'local' ? 'Current Timezone' : tz.replace('_', ' ')}</div>
 </div>
 <div className="flex items-center gap-3">
 <div className="text-secondary font-medium text-purple-200">{times[tz]}</div>
 {tz !== 'local' && (
 <button onClick={() => removeTimezone(tz)} className="p-1.5 opacity-0 group-hover:opacity-100 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 transition-all">
 <X className="w-3.5 h-3.5" />
 </button>
 )}
 </div>
 </div>
 ))}
 </div>

 {timezones.length < 4 && (
 <div className="mt-2 pt-3 border-t border-white/5">
 <Select onValueChange={addTimezone}>
 <SelectTrigger className="w-full bg-white/5 hover:bg-white/10 border-white/10 text-secondary h-11 rounded-xl transition-colors">
 <SelectValue placeholder="Add time zone..." />
 </SelectTrigger>
 <SelectContent className="bg-[#1a1a24] border-white/10 text-white rounded-xl shadow-xl">
 {COMMON_TIMEZONES.map(tz => (
 <SelectItem key={tz.value} value={tz.value} disabled={timezones.includes(tz.value)} className="hover:bg-white/10 focus:bg-white/10 cursor-pointer rounded-lg m-1">
 {tz.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}
 </PopoverContent>
 </Popover>
 );
};
