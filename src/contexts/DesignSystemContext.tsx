import React, { createContext, useContext, useEffect, useState } from 'react';

export type AppTheme = 'default' | 'neon' | 'enterprise' | 'midnight' | 'light';
export type AppDensity = 'compact' | 'comfortable' | 'spacious';
export type UIScale = '100' | '110' | '125' | '150';

interface DesignSystemState {
 theme: AppTheme;
 density: AppDensity;
 uiScale: UIScale;
}

interface DesignSystemContextType extends DesignSystemState {
 setTheme: (theme: AppTheme) => void;
 setDensity: (density: AppDensity) => void;
 setUiScale: (scale: UIScale) => void;
}

const DesignSystemContext = createContext<DesignSystemContextType | undefined>(undefined);

export function DesignSystemProvider({ children }: { children: React.ReactNode }) {
 const [theme, setThemeState] = useState<AppTheme>(() => {
 return (localStorage.getItem('chatr_os_theme') as AppTheme) || 'default';
 });

 const [density, setDensityState] = useState<AppDensity>(() => {
 return (localStorage.getItem('chatr_os_density') as AppDensity) || 'comfortable';
 });

 const [uiScale, setUiScaleState] = useState<UIScale>(() => {
 return (localStorage.getItem('chatr_os_ui_scale') as UIScale) || '100';
 });

 const setTheme = (newTheme: AppTheme) => {
 setThemeState(newTheme);
 localStorage.setItem('chatr_os_theme', newTheme);
 };

 const setDensity = (newDensity: AppDensity) => {
 setDensityState(newDensity);
 localStorage.setItem('chatr_os_density', newDensity);
 };

 const setUiScale = (newScale: UIScale) => {
 setUiScaleState(newScale);
 localStorage.setItem('chatr_os_ui_scale', newScale);
 };

 useEffect(() => {
 const root = document.documentElement;
 
 // Apply Theme
 if (theme === 'default') {
 root.removeAttribute('data-theme');
 } else {
 root.setAttribute('data-theme', theme);
 }

 // Apply Density (this can be used in CSS via [data-density="compact"])
 root.setAttribute('data-density', density);
 
 // Apply UI Scale (Using a CSS variable to multiply base REM or using zoom)
 if (uiScale === '100') {
 root.style.fontSize = '16px';
 } else if (uiScale === '110') {
 root.style.fontSize = '17.6px';
 } else if (uiScale === '125') {
 root.style.fontSize = '20px';
 } else if (uiScale === '150') {
 root.style.fontSize = '24px';
 }
 }, [theme, density, uiScale]);

 return (
 <DesignSystemContext.Provider value={{ theme, density, uiScale, setTheme, setDensity, setUiScale }}>
 {children}
 </DesignSystemContext.Provider>
 );
}

export function useDesignSystem() {
 const context = useContext(DesignSystemContext);
 if (context === undefined) {
 throw new Error('useDesignSystem must be used within a DesignSystemProvider');
 }
 return context;
}
