import { useState, useEffect } from 'react';

export type Density = 'compact' | 'standard' | 'comfortable' | 'spacious';
export type WorkspaceType = 'dashboard' | 'document' | 'split' | 'grid';
export type WorkspacePersona = 'executive' | 'developer' | 'sales' | 'hr' | 'standard';

interface LayoutOptions {
  workspaceType?: WorkspaceType;
  forcedDensity?: Density | 'auto';
  persona?: WorkspacePersona;
  minWidgetWidth?: number;
}

interface LayoutState {
  columns: number;
  density: Density;
  width: number;
  persona: WorkspacePersona;
}

export function useAdaptiveLayout(options: WorkspaceType | LayoutOptions = 'dashboard'): LayoutState {
  const opts: LayoutOptions = typeof options === 'string' ? { workspaceType: options } : options;
  const { workspaceType = 'dashboard', forcedDensity = 'auto', persona = 'standard', minWidgetWidth = 320 } = opts;

  const [layout, setLayout] = useState<LayoutState>({
    columns: 2,
    density: forcedDensity !== 'auto' ? forcedDensity : 'compact',
    width: typeof window !== 'undefined' ? window.innerWidth : 1366,
    persona
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      let columns = 1;
      let autoDensity: Density = 'compact';

      // Adjust column threshold based on Persona Profile
      const personaFactor = persona === 'developer' ? 1.2 : persona === 'executive' ? 0.85 : 1.0;

      if (width >= 2560 * personaFactor) {
        columns = workspaceType === 'dashboard' ? 5 : 4;
        autoDensity = 'spacious';
      } else if (width >= 1920 * personaFactor) {
        columns = workspaceType === 'dashboard' ? 3 : 3;
        autoDensity = 'comfortable';
      } else if (width >= 1366 * personaFactor) {
        columns = workspaceType === 'dashboard' ? 2 : 2;
        autoDensity = 'standard';
      } else {
        columns = Math.max(1, Math.floor(width / minWidgetWidth));
        autoDensity = 'compact';
      }

      setLayout({
        columns,
        density: forcedDensity !== 'auto' ? forcedDensity : autoDensity,
        width,
        persona
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [workspaceType, forcedDensity, persona, minWidgetWidth]);

  return layout;
}
