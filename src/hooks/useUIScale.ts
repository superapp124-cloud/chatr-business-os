import { useState, useEffect } from 'react';

export type UIScaleLevel = 0.9 | 1.0 | 1.1 | 1.25 | 1.5;

const STORAGE_KEY = 'cxs_ui_scale_preference';

export function useUIScale() {
  const [scale, setScaleState] = useState<UIScaleLevel>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseFloat(saved) as UIScaleLevel;
        if ([0.9, 1.0, 1.1, 1.25, 1.5].includes(parsed)) {
          return parsed;
        }
      }
    }
    return 1.0;
  });

  const setScale = (newScale: UIScaleLevel) => {
    setScaleState(newScale);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newScale.toString());
      document.documentElement.style.setProperty('--cxs-ui-scale', newScale.toString());
      document.documentElement.style.fontSize = `${14 * newScale}px`;
    }
  };

  useEffect(() => {
    document.documentElement.style.setProperty('--cxs-ui-scale', scale.toString());
    document.documentElement.style.fontSize = `${14 * scale}px`;
  }, [scale]);

  return { scale, setScale };
}
