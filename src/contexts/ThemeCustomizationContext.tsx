import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

export type ChatBubbleStyle = 'rounded' | 'square' | 'telegram' | 'imessage' | 'gaming' | 'glass';

interface ThemeCustomizationState {
 primaryColor: string; // Hex color
 chatBubbleStyle: ChatBubbleStyle;
 activeThemeName: string;
}

interface ThemeCustomizationContextType extends ThemeCustomizationState {
 setPrimaryColor: (color: string) => void;
 setChatBubbleStyle: (style: ChatBubbleStyle) => void;
 setActiveThemeName: (name: string) => void;
 applyPresetTheme: (preset: ThemePreset) => void;
}

export interface ThemePreset {
 name: string;
 primaryColor: string;
 bubbleStyle: ChatBubbleStyle;
 isDark: boolean;
}

export const THEME_PRESETS: ThemePreset[] = [
 { name: 'Default', primaryColor: '#6200ee', bubbleStyle: 'rounded', isDark: false },
 { name: 'Midnight AMOLED', primaryColor: '#bb86fc', bubbleStyle: 'rounded', isDark: true },
 { name: 'Cyberpunk', primaryColor: '#ff003c', bubbleStyle: 'gaming', isDark: true },
 { name: 'Sakura Pink', primaryColor: '#ffb7b2', bubbleStyle: 'imessage', isDark: false },
 { name: 'Matrix Green', primaryColor: '#00ff41', bubbleStyle: 'square', isDark: true },
 { name: 'Telegram Classic', primaryColor: '#2AABEE', bubbleStyle: 'telegram', isDark: false },
 { name: 'Glassmorphism', primaryColor: '#ffffff', bubbleStyle: 'glass', isDark: true }
];

const ThemeCustomizationContext = createContext<ThemeCustomizationContextType | undefined>(undefined);

// Helper to convert HEX to HSL format required by tailwind (h s% l%)
function hexToHslString(hex: string): string {
 // Remove hash
 hex = hex.replace(/^#/, '');
 
 // Parse RGB
 let r = parseInt(hex.substring(0, 2), 16) / 255;
 let g = parseInt(hex.substring(2, 4), 16) / 255;
 let b = parseInt(hex.substring(4, 6), 16) / 255;

 let max = Math.max(r, g, b), min = Math.min(r, g, b);
 let h = 0, s = 0, l = (max + min) / 2;

 if (max !== min) {
 let d = max - min;
 s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
 switch (max) {
 case r: h = (g - b) / d + (g < b ? 6 : 0); break;
 case g: h = (b - r) / d + 2; break;
 case b: h = (r - g) / d + 4; break;
 }
 h /= 6;
 }

 return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function ThemeCustomizationProvider({ children }: { children: React.ReactNode }) {
 const { setTheme } = useTheme();

 const [primaryColor, setPrimaryColorState] = useState(() => {
 return localStorage.getItem('chatr_primary_color') || '#6200ee';
 });

 const [chatBubbleStyle, setChatBubbleStyleState] = useState<ChatBubbleStyle>(() => {
 return (localStorage.getItem('chatr_bubble_style') as ChatBubbleStyle) || 'rounded';
 });

 const [activeThemeName, setActiveThemeNameState] = useState(() => {
 return localStorage.getItem('chatr_active_theme') || 'Default';
 });

 const setPrimaryColor = (color: string) => {
 setPrimaryColorState(color);
 localStorage.setItem('chatr_primary_color', color);
 };

 const setChatBubbleStyle = (style: ChatBubbleStyle) => {
 setChatBubbleStyleState(style);
 localStorage.setItem('chatr_bubble_style', style);
 
 // Set data attribute on document body so CSS can react to it
 document.documentElement.setAttribute('data-bubble-style', style);
 };

 const setActiveThemeName = (name: string) => {
 setActiveThemeNameState(name);
 localStorage.setItem('chatr_active_theme', name);
 };

 const applyPresetTheme = (preset: ThemePreset) => {
 setPrimaryColor(preset.primaryColor);
 setChatBubbleStyle(preset.bubbleStyle);
 setActiveThemeName(preset.name);
 setTheme(preset.isDark ? 'dark' : 'light');
 };

 // Effect to apply primary color dynamically
 useEffect(() => {
 const root = document.documentElement;
 const hslString = hexToHslString(primaryColor);
 
 // Inject the primary color into native CSS variables
 root.style.setProperty('--primary', hslString);
 root.style.setProperty('--ring', hslString);
 root.style.setProperty('--sidebar-primary', hslString);
 root.style.setProperty('--sidebar-ring', hslString);
 
 // Calculate lighter/darker variants
 root.style.setProperty('--primary-glow', hslString);
 }, [primaryColor]);

 // Effect to apply chat bubble style globally on mount
 useEffect(() => {
 document.documentElement.setAttribute('data-bubble-style', chatBubbleStyle);
 }, [chatBubbleStyle]);

 const value = {
 primaryColor,
 chatBubbleStyle,
 activeThemeName,
 setPrimaryColor,
 setChatBubbleStyle,
 setActiveThemeName,
 applyPresetTheme
 };

 return (
 <ThemeCustomizationContext.Provider value={value}>
 {children}
 </ThemeCustomizationContext.Provider>
 );
}

export function useThemeCustomization() {
 const context = useContext(ThemeCustomizationContext);
 if (context === undefined) {
 throw new Error('useThemeCustomization must be used within a ThemeCustomizationProvider');
 }
 return context;
}
