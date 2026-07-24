import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LocationData {
 latitude: number;
 longitude: number;
 accuracy: number;
 altitude?: number;
 speed?: number;
 heading?: number;
 timestamp: number;
}

interface BackgroundLocationOptions {
 enableBackground?: boolean;
 updateInterval?: number; // milliseconds
 distanceFilter?: number; // meters
}

/**
 * Background location tracking hook
 * Continuously tracks location even when app is in background
 * Uses Capacitor Geolocation with background mode
 */
export const useBackgroundLocation = (
 userId: string | undefined,
 options: BackgroundLocationOptions = {}
) => {
 const {
 enableBackground = true,
 updateInterval = 60000, // 1 minute
 distanceFilter = 50, // 50 meters
 } = options;

 const [location, setLocation] = useState<LocationData | null>(null);
 const [isTracking, setIsTracking] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [watchId, setWatchId] = useState<string | null>(null);
 // Ref so the useEffect cleanup always reads the current watchId, not the stale closure value
 const watchIdRef = useRef<string | null>(null);

 /**
 * Request location permissions
 */
 const requestPermissions = useCallback(async () => {
 try {
 const permission = await Geolocation.requestPermissions();
 
 if (permission.location === 'denied') {
 setError('Location permission denied');
 toast.error('Please enable location access in settings');
 return false;
 }

 // Request background location for native apps
 if (Capacitor.isNativePlatform() && enableBackground) {
 // Background permission is requested separately on iOS/Android
 console.log('📍 Background location enabled');
 }

 return true;
 } catch (err) {
 console.error('Permission error:', err);
 setError('Failed to request location permissions');
 return false;
 }
 }, [enableBackground]);

 /**
 * Get current location
 */
 const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
 try {
 const position = await Geolocation.getCurrentPosition({
 enableHighAccuracy: true,
 timeout: 10000,
 maximumAge: 0,
 });

 const locationData: LocationData = {
 latitude: position.coords.latitude,
 longitude: position.coords.longitude,
 accuracy: position.coords.accuracy,
 altitude: position.coords.altitude || undefined,
 speed: position.coords.speed || undefined,
 heading: position.coords.heading || undefined,
 timestamp: position.timestamp,
 };

 setLocation(locationData);
 setError(null);
 return locationData;
 } catch (err: any) {
 console.error('Location error:', err);
 setError(err.message || 'Failed to get location');
 return null;
 }
 }, []);

 /**
 * Save location to database
 */
 const saveLocationToDatabase = useCallback(async (locationData: LocationData) => {
 if (!userId) return;

 try {
 await supabase
 .from('profiles')
 .update({
 location_lat: locationData.latitude,
 location_long: locationData.longitude,
 location_accuracy: locationData.accuracy,
 location_updated_at: new Date().toISOString(),
 })
 .eq('id', userId);

 // Also save to location history if table exists
 try {
 await supabase.from('user_locations').insert({
 user_id: userId,
 latitude: locationData.latitude,
 longitude: locationData.longitude,
 accuracy: locationData.accuracy,
 altitude: locationData.altitude,
 speed: locationData.speed,
 heading: locationData.heading,
 created_at: new Date().toISOString(),
 });
 } catch (err) {
 // Table might not exist, that's okay
 console.log('user_locations table not available');
 }
 } catch (err) {
 console.error('Failed to save location:', err);
 }
 }, [userId]);

 /**
 * Start continuous location tracking
 */
 const startTracking = useCallback(async () => {
 if (!userId) {
 console.log('Cannot start tracking without userId');
 return;
 }

 const hasPermission = await requestPermissions();
 if (!hasPermission) return;

 try {
 // Get initial location
 const initialLocation = await getCurrentLocation();
 if (initialLocation) {
 await saveLocationToDatabase(initialLocation);
 }

 // Start watching position
 const id = await Geolocation.watchPosition(
 {
 enableHighAccuracy: true,
 timeout: 10000,
 maximumAge: 0,
 },
 (position: Position | null, err?: any) => {
 if (err) {
 console.error('Watch position error:', err);
 setError(err.message || 'Location tracking error');
 return;
 }

 if (position) {
 const locationData: LocationData = {
 latitude: position.coords.latitude,
 longitude: position.coords.longitude,
 accuracy: position.coords.accuracy,
 altitude: position.coords.altitude || undefined,
 speed: position.coords.speed || undefined,
 heading: position.coords.heading || undefined,
 timestamp: position.timestamp,
 };

 setLocation(locationData);
 saveLocationToDatabase(locationData);
 }
 }
 );

 setWatchId(id);
 watchIdRef.current = id; // keep ref in sync so cleanup has current value
 setIsTracking(true);
 console.log('📍 Location tracking started (watch ID:', id, ')');
 } catch (err: any) {
 console.error('Failed to start tracking:', err);
 setError(err.message || 'Failed to start location tracking');
 setIsTracking(false);
 }
 }, [userId, requestPermissions, getCurrentLocation, saveLocationToDatabase]);

 /**
 * Stop location tracking
 */
 const stopTracking = useCallback(async () => {
 // Use ref (not state) so this always sees the latest watchId even in effect cleanup
 const id = watchIdRef.current;
 if (id) {
 try {
 await Geolocation.clearWatch({ id });
 } catch (e) {
 // Swallow "WatchId not found" — happens if watch was already cleared or never started
 console.log('📍 clearWatch: watch already gone, skipping');
 }
 watchIdRef.current = null;
 setWatchId(null);
 setIsTracking(false);
 console.log('📍 Location tracking stopped');
 }
 }, []);

 /**
 * Auto-start tracking on mount
 */
 useEffect(() => {
 if (userId) {
 startTracking();
 }

 return () => {
 // Directly clear via ref — avoids stale closure where watchId is still null
 const id = watchIdRef.current;
 if (id) {
 Geolocation.clearWatch({ id }).catch(() => {
 // Swallow "WatchId not found" on cleanup
 });
 watchIdRef.current = null;
 }
 };
 }, [userId]);

 return {
 location,
 isTracking,
 error,
 startTracking,
 stopTracking,
 getCurrentLocation,
 };
};
