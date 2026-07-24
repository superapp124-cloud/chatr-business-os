import React, { createContext, useContext, useEffect, useState } from 'react';
import { ServiceRegistry } from './ServiceRegistry';

interface PlatformContextState {
 isReady: boolean;
 services: typeof ServiceRegistry;
}

const PlatformContext = createContext<PlatformContextState>({
 isReady: false,
 services: ServiceRegistry
});

export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
 const [isReady, setIsReady] = useState(false);

 useEffect(() => {
 // Listen for a global event or just poll until runtime flips a flag
 // For now, we assume if PlatformProvider is rendered, Bootstrap has at least started.
 // We can rely on a global window.__PLATFORM_READY flag set by Bootstrap, or an event.
 
 const checkReady = () => {
 if ((window as any).__PLATFORM_READY) {
 setIsReady(true);
 } else {
 setTimeout(checkReady, 50);
 }
 };
 
 checkReady();
 }, []);

 return (
 <PlatformContext.Provider value={{ isReady, services: ServiceRegistry }}>
 {children}
 </PlatformContext.Provider>
 );
};

export const useService = <T = any>(serviceName: string): T => {
 const context = useContext(PlatformContext);
 if (!context) {
 throw new Error('useService must be used within a PlatformProvider');
 }
 return context.services.get<T>(serviceName);
};

export const useOptionalService = <T = any>(serviceName: string): T | undefined => {
 const context = useContext(PlatformContext);
 if (!context) {
 return undefined;
 }
 return context.services.getOptional<T>(serviceName);
};

export const usePlatformReady = () => {
 return useContext(PlatformContext).isReady;
};
