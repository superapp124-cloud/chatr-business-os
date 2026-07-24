import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export interface GlobalLocation {
 latitude: number;
 longitude: number;
 accuracy?: number;
 city?: string;
 region?: string;
 country?: string;
 method: 'gps' | 'network' | 'ip' | 'manual';
 timestamp: number;
}

interface LocationContextType {
 location: GlobalLocation | null;
 isLoading: boolean;
 error: string | null;
 permissionDenied: boolean;
 httpsRequired: boolean;
 refreshLocation: () => Promise<void>;
 setManualLocation: (lat: number, lng: number, city?: string) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
 const [location, setLocation] = useState<GlobalLocation | null>(null);
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [permissionDenied, setPermissionDenied] = useState(false);
 const [httpsRequired, setHttpsRequired] = useState(false);

 // Check if HTTPS is required
 const checkHTTPS = useCallback(() => {
 const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
 if (!isSecure) {
 setHttpsRequired(true);
 setError('Location requires HTTPS connection');
 return false;
 }
 return true;
 }, []);

 // High-accuracy GPS location (Layer 1)
 const getGPSLocation = useCallback(async (): Promise<GlobalLocation | null> => {
 try {
 console.log('🎯 Attempting GPS location...');
 
 if (!navigator.geolocation) {
 console.error('❌ Geolocation not supported');
 return null;
 }

 const position = await new Promise<GeolocationPosition>((resolve, reject) => {
 navigator.geolocation.getCurrentPosition(
 resolve,
 reject,
 {
 enableHighAccuracy: true,
 timeout: 10000,
 maximumAge: 0
 }
 );
 });

 const result: GlobalLocation = {
 latitude: position.coords.latitude,
 longitude: position.coords.longitude,
 accuracy: position.coords.accuracy,
 method: 'gps',
 timestamp: Date.now()
 };

 console.log('✅ GPS location obtained:', result);
 
 // Reverse geocode to get city
 try {
 const geoResponse = await fetch(
 `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${result.latitude}&longitude=${result.longitude}&localityLanguage=en`
 );
 if (geoResponse.ok) {
 const geoData = await geoResponse.json();
 result.city = geoData.city || geoData.locality || '';
 result.region = geoData.principalSubdivision || '';
 result.country = geoData.countryName || '';
 }
 } catch (err) {
 // Silently fail reverse geocoding if offline or blocked by CSP
 }

 return result;
 } catch (err: any) {
 console.error('❌ GPS location failed:', err);
 
 if (err.code === 1) {
 setPermissionDenied(true);
 setError('Location permission denied. Please enable location access.');
 }
 
 return null;
 }
 }, []);

 // Network-based location (Layer 2)
 const getNetworkLocation = useCallback(async (): Promise<GlobalLocation | null> => {
 try {
 console.log('📡 Attempting network location...');
 
 const position = await new Promise<GeolocationPosition>((resolve, reject) => {
 navigator.geolocation.getCurrentPosition(
 resolve,
 reject,
 {
 enableHighAccuracy: false,
 timeout: 8000,
 maximumAge: 60000
 }
 );
 });

 const result: GlobalLocation = {
 latitude: position.coords.latitude,
 longitude: position.coords.longitude,
 accuracy: position.coords.accuracy,
 method: 'network',
 timestamp: Date.now()
 };

 console.log('✅ Network location obtained:', result);
 return result;
 } catch (err) {
 console.error('❌ Network location failed:', err);
 return null;
 }
 }, []);

 // IP-based location (Layer 3)
 const getIPLocation = useCallback(async (): Promise<GlobalLocation | null> => {
 try {
 console.log('🌐 Attempting IP location...');
 
 const response = await fetch('https://ipapi.co/json/');
 if (!response.ok) throw new Error('IP API failed');

 const data = await response.json();
 
 const result: GlobalLocation = {
 latitude: data.latitude,
 longitude: data.longitude,
 city: data.city,
 region: data.region,
 country: data.country_name,
 method: 'ip',
 timestamp: Date.now()
 };

 console.log('✅ IP location obtained:', result);
 return result;
 } catch (err) {
 console.error('❌ IP location failed:', err);
 return null;
 }
 }, []);

 const updateBackendLocation = useCallback(async (loc: GlobalLocation) => {
 try {
 // 1. Send to Supabase (Cloud)
 const { data: { user } } = await supabase.auth.getUser();
 if (user) {
 await supabase.functions.invoke('update-location', {
 body: {
 lat: loc.latitude,
 lon: loc.longitude,
 city: loc.city,
 method: loc.method,
 accuracy: loc.accuracy
 }
 });
 }

 // 2. Send to Local Kernel (Electron)
 const isElectron = !!(window as Window & { electronAPI?: unknown }).electronAPI;
 const api = (window as Window & { electronAPI?: { invoke: (ch: string, data: unknown) => Promise<unknown> } }).electronAPI;
 if (isElectron && api && loc.city) {
 // Pass both city and exact coordinates to the kernel provider
 await api.invoke('kernel:location:provide', { city: loc.city, lat: loc.latitude, lng: loc.longitude });
 console.log('✅ Local Kernel location cache updated with exact GPS');
 }

 console.log('✅ Backend location updated');
 } catch (err) {
 console.error('❌ Backend update failed:', err);
 }
 }, []);

 // Main location refresh with fallback chain
 const refreshLocation = useCallback(async () => {
 if (!checkHTTPS()) return;
 
 setIsLoading(true);
 setError(null);
 setPermissionDenied(false);

 try {
 // Layer 1: High-accuracy GPS
 let result = await getGPSLocation();
 
 // Layer 2: Network location
 if (!result) {
 result = await getNetworkLocation();
 }

 // Layer 3: IP location
 if (!result) {
 result = await getIPLocation();
 }

 if (result) {
 setLocation(result);
 
 // Save to localStorage
 localStorage.setItem('chatr_location', JSON.stringify(result));
 
 // Update backend
 await updateBackendLocation(result);
 } else {
 setError('Unable to detect location. Please set manually.');
 }
 } catch (err: any) {
 console.error('Location detection failed:', err);
 setError(err.message || 'Location detection failed');
 } finally {
 setIsLoading(false);
 }
 }, [checkHTTPS, getGPSLocation, getNetworkLocation, getIPLocation, updateBackendLocation]);

 // Manual location (Layer 4)
 const setManualLocation = useCallback((lat: number, lng: number, city?: string) => {
 const manual: GlobalLocation = {
 latitude: lat,
 longitude: lng,
 city,
 method: 'manual',
 timestamp: Date.now()
 };
 
 setLocation(manual);
 setError(null);
 localStorage.setItem('chatr_location', JSON.stringify(manual));
 updateBackendLocation(manual);
 }, [updateBackendLocation]);

 // Initialize on mount - NON-BLOCKING with cache-first strategy
 useEffect(() => {
 // PERFORMANCE: Try cache first and show immediately (non-blocking)
 const cached = localStorage.getItem('chatr_location');
 if (cached) {
 try {
 const cachedLoc = JSON.parse(cached);
 console.log('📍 Using cached location (instant)');
 setLocation(cachedLoc);
 
 // If cache is fresh (< 5 min), skip refresh
 if (Date.now() - cachedLoc.timestamp < 300000) {
 return;
 }
 } catch (e) {
 console.error('Cache parse error:', e);
 }
 }

 // PERFORMANCE: Defer location fetch to idle time
 // This prevents blocking initial render
 const scheduleRefresh = () => {
 if (Capacitor.isNativePlatform()) {
 setTimeout(refreshLocation, 25000);
 return;
 }

 if ('requestIdleCallback' in window) {
 (window as any).requestIdleCallback(() => refreshLocation(), { timeout: 5000 });
 } else {
 // Fallback: delay by 2 seconds
 setTimeout(refreshLocation, 2000);
 }
 };

 scheduleRefresh();
 }, [refreshLocation]);

 return (
 <LocationContext.Provider value={{
 location,
 isLoading,
 error,
 permissionDenied,
 httpsRequired,
 refreshLocation,
 setManualLocation
 }}>
 {children}
 </LocationContext.Provider>
 );
}

export function useLocation() {
 const context = useContext(LocationContext);
 if (!context) {
 throw new Error('useLocation must be used within LocationProvider');
 }
 return context;
}
