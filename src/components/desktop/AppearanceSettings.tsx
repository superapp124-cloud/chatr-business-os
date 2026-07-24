import React, { useEffect } from 'react';
import { Settings2, CheckCircle2, ChevronRight, Monitor, Moon, Sun, MonitorSmartphone } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

export const AppearanceSettings: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { 
    themeMode, setThemeMode, 
    accentColor, setAccentColor,
    fontScale, setFontScale,
    fontFamily, setFontFamily,
    applyToDOM
  } = useAppearanceStore();

  useEffect(() => {
    applyToDOM();
  }, [applyToDOM]);

  const colors = [
    { id: 'purple', class: 'bg-purple-500', name: 'Purple' },
    { id: 'blue', class: 'bg-blue-500', name: 'Blue' },
    { id: 'emerald', class: 'bg-emerald-500', name: 'Emerald' },
    { id: 'rose', class: 'bg-rose-500', name: 'Rose' },
    { id: 'amber', class: 'bg-amber-500', name: 'Amber' },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children || (
          <button className={cn("relative transition-colors p-1.5 rounded-xl hover:bg-white/10 cursor-pointer", themeMode === 'dark' ? "text-white/70 hover:text-white" : "text-zinc-600 hover:text-zinc-900")}>
            <Settings2 className="w-4 h-4" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0 rounded-[24px] bg-[#1C1C1E]/95 backdrop-blur-2xl border border-white/15 shadow-2xl overflow-hidden -mt-1 mr-2 z-50">
        <ScrollArea className="h-[480px]">
          <div className="p-6 space-y-7">
            {/* Header */}
            <div>
              <h2 className="text-lg font-black text-white tracking-tight mb-0.5">Appearance</h2>
              <p className="text-xs text-white/50">Customize your workspace</p>
            </div>

            {/* Themes */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Theme</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'light', label: 'Light', icon: Sun, preview: 'bg-white border-zinc-200 text-zinc-900' },
                  { id: 'dark', label: 'Dark', icon: Moon, preview: 'bg-[#000000] border-[#333333] text-white' },
                  { id: 'system', label: 'System', icon: MonitorSmartphone, preview: 'bg-gradient-to-br from-zinc-200 to-zinc-900 border-zinc-500 text-white' },
                ].map(theme => (
                  <button
                    key={theme.id}
                    onClick={() => {
                      setThemeMode(theme.id as any);
                      toast.success(`Theme set to ${theme.label}`);
                    }}
                    className="flex flex-col gap-2 group outline-none cursor-pointer"
                  >
                    <div className={cn(
                      "w-full aspect-[4/3] rounded-xl border-2 flex items-center justify-center transition-all duration-200",
                      theme.preview,
                      themeMode === theme.id ? "border-purple-500 shadow-md scale-105" : "border-white/10 group-hover:border-white/20"
                    )}>
                      <theme.icon className={cn("w-6 h-6", theme.id === 'light' ? 'text-zinc-600' : 'text-zinc-300')} />
                    </div>
                    <span className={cn(
                      "text-xs font-bold text-center transition-colors",
                      themeMode === theme.id ? "text-white" : "text-white/50 group-hover:text-white/70"
                    )}>{theme.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Accent Color</h3>
              <div className="flex gap-3">
                {colors.map(color => (
                  <button
                    key={color.id}
                    onClick={() => {
                      setAccentColor(color.id as any);
                      toast.success(`Accent color updated to ${color.name}`);
                    }}
                    className={cn(
                      "w-9 h-9 rounded-full transition-all duration-200 flex items-center justify-center border-2 shadow-sm outline-none cursor-pointer",
                      color.class,
                      accentColor === color.id ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105 opacity-80 hover:opacity-100"
                    )}
                    title={color.name}
                  >
                    {accentColor === color.id && <CheckCircle2 className="w-5 h-5 text-white shadow-sm" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Layout Scale */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Layout Density</h3>
              <div className="bg-white/5 p-1 rounded-xl flex gap-1">
                {[
                  { id: 'compact', label: 'Compact' },
                  { id: 'standard', label: 'Standard' },
                  { id: 'large', label: 'Spacious' },
                ].map(scale => (
                  <button
                    key={scale.id}
                    onClick={() => {
                      setFontScale(scale.id as any);
                      toast.success(`Layout density set to ${scale.label}`);
                    }}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 outline-none cursor-pointer",
                      fontScale === scale.id ? "bg-purple-600 text-white shadow-sm" : "text-white/50 hover:text-white/70 hover:bg-white/5"
                    )}
                  >
                    {scale.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Typography</h3>
              <div className="space-y-2">
                {[
                  { id: 'inter', label: 'System Sans', desc: 'San Francisco, Inter' },
                  { id: 'sans', label: 'Rounded', desc: 'Friendly & modern' },
                  { id: 'serif', label: 'Serif', desc: 'Elegant & traditional' },
                  { id: 'mono', label: 'Monospace', desc: 'Crisp & technical' },
                ].map(font => (
                  <button
                    key={font.id}
                    onClick={() => {
                      setFontFamily(font.id as any);
                      toast.success(`Typography set to ${font.label}`);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-200 text-left outline-none cursor-pointer",
                      fontFamily === font.id ? "bg-white/10 border-white/20" : "bg-transparent border-white/5 hover:bg-white/5 hover:border-white/10"
                    )}
                  >
                    <div>
                      <h4 className={cn("text-xs font-bold", fontFamily === font.id ? "text-white" : "text-white/80")}>{font.label}</h4>
                      <p className="text-[11px] text-white/50 mt-0.5">{font.desc}</p>
                    </div>
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                      fontFamily === font.id ? "border-purple-500" : "border-white/20"
                    )}>
                      {fontFamily === font.id && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
