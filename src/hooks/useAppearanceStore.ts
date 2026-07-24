import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentColor = 'purple' | 'blue' | 'emerald' | 'rose' | 'amber';
export type FontScale = 'compact' | 'standard' | 'large';
export type FontFamily = 'inter' | 'sans' | 'serif' | 'mono';

interface AppearanceState {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  fontScale: FontScale;
  fontFamily: FontFamily;
  
  setThemeMode: (mode: ThemeMode) => void;
  setAccentColor: (color: AccentColor) => void;
  setFontScale: (scale: FontScale) => void;
  setFontFamily: (family: FontFamily) => void;
  applyToDOM: () => void;
}

const ACCENT_MAP: Record<AccentColor, { hex: string; rgb: string }> = {
  purple: { hex: '#8b5cf6', rgb: '139, 92, 246' },
  blue: { hex: '#3b82f6', rgb: '59, 130, 246' },
  emerald: { hex: '#10b981', rgb: '16, 185, 129' },
  rose: { hex: '#f43f5e', rgb: '244, 63, 94' },
  amber: { hex: '#f59e0b', rgb: '245, 158, 11' },
};

const FONT_MAP: Record<FontFamily, string> = {
  inter: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  sans: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
  serif: "'Georgia', 'Playfair Display', Cambria, serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace",
};

const SCALE_MAP: Record<FontScale, string> = {
  compact: '0.925',
  standard: '1.0',
  large: '1.08',
};

export const applyAppearanceToDOM = (state: { themeMode: ThemeMode; accentColor: AccentColor; fontScale: FontScale; fontFamily: FontFamily }) => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // 1. Apply Theme
  let isDark = state.themeMode === 'dark';
  if (state.themeMode === 'system') {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
  }

  // 2. Apply Accent Color
  const accent = ACCENT_MAP[state.accentColor] || ACCENT_MAP.purple;
  root.style.setProperty('--accent-color', accent.hex);
  root.style.setProperty('--accent-rgb', accent.rgb);
  root.style.setProperty('--primary', accent.hex);
  root.setAttribute('data-accent', state.accentColor);

  // 3. Apply Layout Density / Font Scale
  const scale = SCALE_MAP[state.fontScale] || '1.0';
  root.style.setProperty('--font-scale', scale);
  root.setAttribute('data-density', state.fontScale);

  // 4. Apply Typography
  const font = FONT_MAP[state.fontFamily] || FONT_MAP.inter;
  root.style.setProperty('--font-family-main', font);
  root.style.fontFamily = font;
  root.setAttribute('data-font', state.fontFamily);
};

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set, get) => ({
      themeMode: 'dark',
      accentColor: 'purple',
      fontScale: 'compact',
      fontFamily: 'inter',
      
      setThemeMode: (mode) => {
        set({ themeMode: mode });
        applyAppearanceToDOM(get());
      },
      setAccentColor: (color) => {
        set({ accentColor: color });
        applyAppearanceToDOM(get());
      },
      setFontScale: (scale) => {
        set({ fontScale: scale });
        applyAppearanceToDOM(get());
      },
      setFontFamily: (family) => {
        set({ fontFamily: family });
        applyAppearanceToDOM(get());
      },
      applyToDOM: () => {
        applyAppearanceToDOM(get());
      }
    }),
    {
      name: 'chatr-appearance-settings',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyAppearanceToDOM(state);
        }
      }
    }
  )
);
