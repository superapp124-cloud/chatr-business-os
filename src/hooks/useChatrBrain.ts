/**
 * ChatrAI - React Hook
 * Main interface for using the AI runtime in components
 */

import { useState, useCallback, useEffect } from 'react';
import { chatrBrain } from '@/services/chatrBrain';
import { 
  AgentType, 
  BrainResponse, 
  BrainRuntimeStatus,
  DetectedIntent,
  SharedContext 
} from '@/services/chatrBrain/types';
import { supabase } from '@/integrations/supabase/client';

const DEVICE_USER_ID = 'device-offline-user';

export interface UseChatrBrainReturn {
  query: (text: string, forceAgent?: AgentType) => Promise<BrainResponse>;
  quickDetect: (text: string) => DetectedIntent;
  isReady: boolean;
  isProcessing: boolean;
  lastResponse: BrainResponse | null;
  agents: AgentType[];
  getAgentInfo: (type: AgentType) => ReturnType<typeof chatrBrain.getAgentInfo>;
  updateLocation: (location: SharedContext['location']) => void;
  error: string | null;
  location: SharedContext['location'] | null;
  runtimeStatus: BrainRuntimeStatus | null;
}

/**
 * Main hook for interacting with ChatrAI
 */
export function useChatrBrain(): UseChatrBrainReturn {
  const [userId, setUserId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState<BrainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<SharedContext['location'] | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<BrainRuntimeStatus | null>(null);

  // Get user and initialize brain on mount
  useEffect(() => {
    const initialize = async () => {
      let resolvedUserId = DEVICE_USER_ID;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          resolvedUserId = user.id;
        }
      } catch (err) {
        console.debug('[ChatrAI] Supabase session unavailable. Starting local mode.', err);
      }
      
      setUserId(resolvedUserId);
      
      try {
        await chatrBrain.initialize(resolvedUserId);
        setRuntimeStatus(chatrBrain.getRuntimeStatus() || null);
        setIsReady(true);
        console.log('[ChatrAI] Ready');
        
        // Auto-detect location
        detectLocation();
      } catch (err) {
        console.error('Brain initialization failed:', err);
        setError('ChatrAI failed to initialize');
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    const refreshRuntime = () => {
      setRuntimeStatus(chatrBrain.getRuntimeStatus() || null);
    };

    refreshRuntime();
    window.addEventListener('online', refreshRuntime);
    window.addEventListener('offline', refreshRuntime);

    return () => {
      window.removeEventListener('online', refreshRuntime);
      window.removeEventListener('offline', refreshRuntime);
    };
  }, []);

  // Detect user location
  const detectLocation = useCallback(async () => {
    try {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

      // Try browser geolocation first
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;

            if (offline) {
              const loc: SharedContext['location'] = { lat: latitude, lon: longitude };
              setLocation(loc);
              chatrBrain.updateLocation(loc);
              return;
            }

            try {
              const geoResponse = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
              );
              const geoData = await geoResponse.json();
              const loc: SharedContext['location'] = {
                lat: latitude,
                lon: longitude,
                city: geoData.city || geoData.locality,
                state: geoData.principalSubdivision,
                country: geoData.countryName,
              };
              setLocation(loc);
              chatrBrain.updateLocation(loc);
              console.log('[Location] Detected:', loc.city);
            } catch {
              setLocation({ lat: latitude, lon: longitude });
              chatrBrain.updateLocation({ lat: latitude, lon: longitude });
            }
          },
          () => {
            if (!offline) fetchIPLocation();
          },
          { timeout: 5000, enableHighAccuracy: false }
        );
      } else if (!offline) {
        fetchIPLocation();
      }
    } catch {
      console.log('[Location] Detection failed');
    }
  }, []);

  const fetchIPLocation = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
      }

      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      const loc: SharedContext['location'] = {
        city: data.city,
        state: data.region,
        country: data.country_name,
        lat: data.latitude,
        lon: data.longitude,
      };
      setLocation(loc);
      chatrBrain.updateLocation(loc);
      console.log('[Location] IP-based:', loc.city);
    } catch {
      console.log('[Location] IP detection failed');
    }
  };

  const query = useCallback(async (
    text: string,
    forceAgent?: AgentType
  ): Promise<BrainResponse> => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await chatrBrain.process({
        query: text,
        userId: userId || DEVICE_USER_ID,
        forceAgent,
        context: location ? { location } : undefined,
      });

      setLastResponse(response);
      setRuntimeStatus(response.runtime || chatrBrain.getRuntimeStatus() || null);
      return response;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [userId, location]);

  const quickDetect = useCallback((text: string): DetectedIntent => {
    return chatrBrain.quickDetect(text);
  }, []);

  const updateLocation = useCallback((loc: SharedContext['location']) => {
    setLocation(loc);
    chatrBrain.updateLocation(loc);
  }, []);

  return {
    query,
    quickDetect,
    isReady,
    isProcessing,
    lastResponse,
    agents: chatrBrain.getAgents(),
    getAgentInfo: chatrBrain.getAgentInfo.bind(chatrBrain),
    updateLocation,
    error,
    location,
    runtimeStatus,
  };
}
