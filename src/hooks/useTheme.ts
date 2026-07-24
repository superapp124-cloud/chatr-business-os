import { useState, useEffect } from 'react';

export type CXSTheme = 'chatr-dark' | 'enterprise' | 'neon' | 'midnight' | 'light';

const STORAGE_KEY = 'cxs_theme_preference';

export function useTheme() {
  const [theme, setThemeState] = useState<CXSTheme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY) as CXSTheme;
      if (['chatr-dark', 'enterprise', 'neon', 'midnight', 'light'].includes(saved)) {
        return saved;
      }
    }
    return 'chatr-dark';
  });

  const setTheme = (newTheme: CXSTheme) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return { theme, setTheme };
}
