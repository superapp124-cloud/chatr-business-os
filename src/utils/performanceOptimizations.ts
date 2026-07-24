/**
 * CRITICAL: Performance optimizations for native Android feel
 */

// Preload critical assets
export const preloadCriticalAssets = () => {
  // Preload common icons and images
  const criticalImages = [
    '/chatr-logo.png',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
  ];

  criticalImages.forEach(src => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  });
};

// Enable hardware acceleration for smooth animations
export const enableHardwareAcceleration = () => {
  const style = document.createElement('style');
  style.textContent = `
    * {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    /* Hardware acceleration for common animated elements */
    .animate-in,
    .animate-out,
    [data-state="open"],
    [data-state="closed"],
    .transition-all,
    .transition-transform,
    .transition-opacity {
      will-change: transform, opacity;
      transform: translateZ(0);
      backface-visibility: hidden;
      perspective: 1000px;
    }
    
    /* Smooth scrolling */
    * {
      -webkit-overflow-scrolling: touch;
      scroll-behavior: smooth;
    }
    
    /* Better text rendering */
    body {
      text-rendering: optimizeLegibility;
      -webkit-text-size-adjust: 100%;
    }
  `;
  document.head.appendChild(style);
};

// Optimize images for faster loading
export const optimizeImages = () => {
  // Add loading="lazy" to all images
  const images = document.querySelectorAll('img:not([loading])');
  images.forEach(img => {
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
  });
};

// Initialize all performance optimizations
export const initPerformanceOptimizations = () => {
  console.log('🚀 [Performance] Initializing optimizations...');
  
  // Run immediately
  preloadCriticalAssets();
  enableHardwareAcceleration();
  
  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', optimizeImages);
  } else {
    optimizeImages();
  }
  
  console.log('✅ [Performance] Optimizations complete');
};

/**
 * CRITICAL: Check if a VoIP call is currently active or initializing.
 * Used to defer non-essential background tasks, realtime subscriptions, and bundle parsing
 * to prioritize media and signaling paths.
 */
export const isCallActiveOrInitializing = (): boolean => {
  if (typeof window === 'undefined') return false;

  // 1. Check native TelecomManager / CallKit active call state
  try {
    // Check synchronous active connection directly from TelecomManager
    if ((window as any).ChatrCall?.hasActiveConnection?.()) {
      return true;
    }

    // Check if the legacy __CALL_STATE__ is populated by bridge
    if ((window as any).__CALL_STATE__?.accepted) {
      return true;
    }

    // Check modern native CallStateManager APIs via bridges
    if ((window as any).NativeBridge?.getCallState) {
      const json = (window as any).NativeBridge.getCallState();
      const state = JSON.parse(json);
      if (state && state.state !== 'IDLE' && state.state !== 'ENDED' && state.state !== 'FAILED') {
        return true;
      }
    }
    
    if ((window as any).ChatrNative?.getCallState) {
      const json = (window as any).ChatrNative.getCallState();
      const state = JSON.parse(json);
      if (state && state.state !== 'IDLE' && state.state !== 'ENDED' && state.state !== 'FAILED') {
        return true;
      }
    }
  } catch (e) {
    console.warn('[Performance] Failed to parse native call state:', e);
  }

  // 2. Check web sessionStorage or localStorage flags
  try {
    // Outgoing call pending handoff
    if (sessionStorage.getItem('chatr:pending-outgoing-call')) {
      return true;
    }
    
    // Active/ringing calling flags set by simpleWebRTC or global listeners
    if (sessionStorage.getItem('chatr:active-call-in-progress') === 'true') {
      return true;
    }
  } catch (e) {
    // Ignore storage accessibility issues
  }

  // 3. Fallback to route checking (e.g. if the current URL has the calling screen active)
  if (window.location.hash?.includes('/call') || window.location.pathname?.includes('/call')) {
    return true;
  }

  return false;
};

