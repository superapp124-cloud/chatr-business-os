import React from 'react';
import { useAdaptiveLayout, Density, WorkspaceType, WorkspacePersona } from '@/hooks/useAdaptiveLayout';
import { useUIScale, UIScaleLevel } from '@/hooks/useUIScale';
import { useTheme, CXSTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { Palette, Sliders, ZoomIn } from 'lucide-react';

interface LayoutEngineProps extends React.HTMLAttributes<HTMLDivElement> {
  workspaceType?: WorkspaceType;
  density?: Density | 'auto';
  persona?: WorkspacePersona;
  autoFit?: boolean;
  minWidgetWidth?: number;
  children: React.ReactNode;
}

export const LayoutEngine: React.FC<LayoutEngineProps> = ({ 
  workspaceType = 'dashboard',
  density: forcedDensity = 'auto',
  persona = 'standard',
  autoFit = false,
  minWidgetWidth = 320,
  className, 
  children, 
  ...props 
}) => {
  const { columns, density } = useAdaptiveLayout({
    workspaceType,
    forcedDensity,
    persona,
    minWidgetWidth
  });

  const gapMap: Record<Density, string> = {
    compact: 'gap-3 p-3',
    standard: 'gap-5 p-4',
    comfortable: 'gap-6 p-6',
    spacious: 'gap-8 p-8'
  };

  return (
    <div 
      className={cn(
        'grid w-full transition-all duration-250 ease-out',
        gapMap[density],
        className
      )}
      style={{
        gridTemplateColumns: autoFit
          ? `repeat(auto-fit, minmax(${minWidgetWidth}px, 1fr))`
          : `repeat(${columns}, minmax(0, 1fr))`
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const LayoutWidget: React.FC<React.HTMLAttributes<HTMLDivElement> & { colSpan?: number }> = ({ 
  colSpan = 1, 
  className, 
  children, 
  ...props 
}) => {
  return (
    <div 
      className={cn('w-full h-full min-w-0 transition-all duration-250', className)}
      style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}
      {...props}
    >
      {children}
    </div>
  );
};

export interface DensityControlProps {
  currentDensity: Density | 'auto';
  onDensityChange: (d: Density | 'auto') => void;
  currentPersona?: WorkspacePersona;
  onPersonaChange?: (p: WorkspacePersona) => void;
}

export const DensityControls: React.FC<DensityControlProps> = ({
  currentDensity,
  onDensityChange,
  currentPersona = 'standard',
  onPersonaChange
}) => {
  const { scale, setScale } = useUIScale();
  const { theme, setTheme } = useTheme();

  const themes: { id: CXSTheme; label: string }[] = [
    { id: 'chatr-dark', label: 'Dark' },
    { id: 'enterprise', label: 'Slate' },
    { id: 'neon', label: 'Neon' },
    { id: 'midnight', label: 'Navy' },
    { id: 'light', label: 'Light' }
  ];

  const densities: { id: Density | 'auto'; label: string }[] = [
    { id: 'auto', label: 'Auto' },
    { id: 'compact', label: 'Compact' },
    { id: 'standard', label: 'Standard' },
    { id: 'comfortable', label: 'Comfortable' },
    { id: 'spacious', label: 'Spacious' }
  ];

  const personas: { id: WorkspacePersona; label: string }[] = [
    { id: 'standard', label: 'Standard' },
    { id: 'executive', label: 'Executive' },
    { id: 'developer', label: 'Developer' },
    { id: 'sales', label: 'Sales' },
    { id: 'hr', label: 'HR' }
  ];

  const scales: { level: UIScaleLevel; label: string }[] = [
    { level: 0.9, label: '90%' },
    { level: 1.0, label: '100%' },
    { level: 1.1, label: '110%' },
    { level: 1.25, label: '125%' },
    { level: 1.5, label: '150%' }
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950/70 border border-zinc-800/80 backdrop-blur-md px-4 py-2.5 rounded-xl text-tiny text-zinc-400 mb-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Sliders size={14} className="text-indigo-400" />
        <span className="font-semibold text-zinc-200 uppercase tracking-wider text-[11px]">CXS Control Bar</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Persona Profile Switcher */}
        {onPersonaChange && (
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
            <span className="text-zinc-500 px-1 text-[10px] uppercase font-bold">Profile:</span>
            {personas.map(p => (
              <button
                key={p.id}
                onClick={() => onPersonaChange(p.id)}
                className={cn(
                  'px-2 py-0.5 rounded-md font-medium text-caption transition-all',
                  currentPersona === p.id 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Layout Density Switcher */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
          <span className="text-zinc-500 px-1 text-[10px] uppercase font-bold">Density:</span>
          {densities.map(d => (
            <button
              key={d.id}
              onClick={() => onDensityChange(d.id)}
              className={cn(
                'px-2 py-0.5 rounded-md font-medium text-caption transition-all',
                currentDensity === d.id 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              )}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Accessibility UI Scale Switcher */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
          <span className="text-zinc-500 px-1 text-[10px] uppercase font-bold flex items-center gap-0.5">
            <ZoomIn size={10} /> Scale:
          </span>
          {scales.map(s => (
            <button
              key={s.level}
              onClick={() => setScale(s.level)}
              className={cn(
                'px-1.5 py-0.5 rounded-md font-medium text-caption transition-all',
                scale === s.level 
                  ? 'bg-purple-600 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* CXS Theme Switcher */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
          <span className="text-zinc-500 px-1 text-[10px] uppercase font-bold flex items-center gap-0.5">
            <Palette size={10} /> Theme:
          </span>
          {themes.map(t => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                'px-2 py-0.5 rounded-md font-medium text-caption transition-all',
                theme === t.id 
                  ? 'bg-amber-600 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
