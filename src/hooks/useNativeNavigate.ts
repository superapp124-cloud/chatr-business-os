/**
 * useNativeNavigate
 *
 * Listens for the `nativeNavigate` CustomEvent dispatched by MainActivity.kt
 * and performs a React Router navigation.
 *
 * Supports extra payloads such as:
 *   { path: '/call-history', showInsights: true, phoneNumber: '+91...' }
 */
import { useEffect, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';

interface NativeNavigateDetail {
  path: string;
  showInsights?: boolean;
  showSpamReport?: boolean;
  phoneNumber?: string;
  source?: string;
}

type NativeNavigateCallback = (detail: NativeNavigateDetail) => void;

const listeners: Set<NativeNavigateCallback> = new Set();

// Global dispatcher — allows components to subscribe to showInsights payloads
export function subscribeToNativeNavigate(cb: NativeNavigateCallback) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useNativeNavigate() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<NativeNavigateDetail>).detail;
      if (!detail?.path) return;

      console.log('[NativeNavigate] Navigating to', detail.path, detail);
      
      startTransition(() => {
        navigate(detail.path);
      });

      // Notify any extra subscribers (e.g. CallHistory panel opener)
      listeners.forEach(cb => cb(detail));
    };

    window.addEventListener('nativeNavigate', handler);
    return () => window.removeEventListener('nativeNavigate', handler);
  }, [navigate]);
}
