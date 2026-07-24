import React, { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useNativeAppInitialization } from '@/hooks/useNativeAppInitialization';
import { useNativeHaptics } from '@/hooks/useNativeHaptics';
import { useNativeAuthSync } from '@/hooks/useNativeAuthSync';
import { useNativeCallBridge } from '@/hooks/useNativeCallBridge';
import { useAppleNativeFeatures } from '@/hooks/useAppleNativeFeatures';
import { useNativeNavigate } from '@/hooks/useNativeNavigate';
import { supabase } from '@/integrations/supabase/client';
import { isCallActiveOrInitializing } from '@/utils/performanceOptimizations';
import { AnalyticsProvider } from './AnalyticsProvider';
import { ChatrOSProvider } from './ChatrOSProvider';

const DeferredNativeBackgroundServices = React.lazy(() =>
 import('./NativeBackgroundServices').then((module) => ({
 default: module.NativeBackgroundServices,
 })),
);

interface NativeAppContextType {
 isNative: boolean;
 isOnline: boolean;
 userId?: string;
 haptics: ReturnType<typeof useNativeHaptics>;
}

export const NativeAppContext = createContext<NativeAppContextType>({
 isNative: false,
 isOnline: true,
 haptics: {} as any,
});

interface NativeAppProviderProps {
 children: React.ReactNode;
}

export const NativeAppProvider: React.FC<NativeAppProviderProps> = ({ children }) => {
 const isNative = Capacitor.isNativePlatform();
 const [userId, setUserId] = useState<string>();
 const [isOnline, setIsOnline] = useState(navigator.onLine);
 const [deferServices, setDeferServices] = useState(() => isCallActiveOrInitializing());
 const [backgroundServicesReady, setBackgroundServicesReady] = useState(!isNative);

 useEffect(() => {
 if (!isNative) {
 setBackgroundServicesReady(true);
 return;
 }

 const delay = deferServices ? 8000 : 2500;
 const timer = window.setTimeout(() => {
 setDeferServices(false);
 setBackgroundServicesReady(true);
 }, delay);

 return () => window.clearTimeout(timer);
 }, [deferServices, isNative]);

 useEffect(() => {
 let mounted = true;

 const getUser = async () => {
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (mounted && user?.id) {
 setUserId(user.id);
 }
 };

 getUser();

 const {
 data: { subscription },
 } = supabase.auth.onAuthStateChange((_, session) => {
 if (mounted) {
 setUserId(session?.user?.id);
 }
 });

 return () => {
 mounted = false;
 subscription.unsubscribe();
 };
 }, []);

 useNativeAppInitialization(userId);
 useAppleNativeFeatures();
 const haptics = useNativeHaptics();
 useNativeAuthSync();
 useNativeCallBridge();
 useNativeNavigate();

 useEffect(() => {
 const handleOnline = () => setIsOnline(true);
 const handleOffline = () => setIsOnline(false);

 window.addEventListener('online', handleOnline);
 window.addEventListener('offline', handleOffline);

 return () => {
 window.removeEventListener('online', handleOnline);
 window.removeEventListener('offline', handleOffline);
 };
 }, []);

 const value: NativeAppContextType = React.useMemo(
 () => ({
 isNative,
 isOnline,
 userId,
 haptics,
 }),
 [isNative, isOnline, userId, haptics],
 );

 return (
 <ChatrOSProvider>
 <NativeAppContext.Provider value={value}>
 <AnalyticsProvider userId={userId}>
 {backgroundServicesReady && !deferServices ? (
 <React.Suspense fallback={null}>
 <DeferredNativeBackgroundServices userId={userId} />
 </React.Suspense>
 ) : null}
 {children}
 </AnalyticsProvider>
 </NativeAppContext.Provider>
 </ChatrOSProvider>
 );
};
