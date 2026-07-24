/**
 * India-First Network Classification
 * 
 * Classifies network quality using 3-signal scoring:
 * - effectiveType (2G, 3G, 4G, etc.)
 * - RTT (round-trip time)
 * - downlink bandwidth
 * 
 * Assumes HOSTILE by default (India-first approach)
 */

export type NetworkQuality = 'GOOD' | 'MODERATE' | 'HOSTILE';

interface NetworkInfo {
  effectiveType: string;
  rtt: number;
  downlink: number;
}

interface NetworkConnection extends EventTarget {
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
}

declare global {
  interface Navigator {
    connection?: NetworkConnection;
    mozConnection?: NetworkConnection;
    webkitConnection?: NetworkConnection;
  }
}

/**
 * Get current network information from Navigator API
 */
export function getNetworkInfo(): NetworkInfo {
  const connection = navigator.connection || 
                     navigator.mozConnection || 
                     navigator.webkitConnection;

  const hasReliableMetrics = Boolean(
    connection &&
    typeof connection.rtt === 'number' &&
    connection.rtt > 0 &&
    typeof connection.downlink === 'number' &&
    connection.downlink > 0
  );
  const isAndroidRuntime = /Android/i.test(navigator.userAgent || '');

  // Android WebView often exposes only effectiveType on mobile data.
  // Treat that as incomplete so we do not jump straight to the highest preset.
  if (isAndroidRuntime && !hasReliableMetrics) {
    const effectiveType =
      typeof connection?.effectiveType === 'string' ? connection.effectiveType : '3g';

    if (effectiveType === '2g' || effectiveType === 'slow-2g') {
      return {
        effectiveType,
        rtt: 700,
        downlink: 0.4
      };
    }

    return {
      effectiveType: effectiveType === '4g' ? '3g' : effectiveType,
      rtt: effectiveType === '4g' ? 220 : 280,
      downlink: effectiveType === '4g' ? 1.4 : 1.0
    };
  }

  // Otherwise use optimistic-but-reasonable defaults when the API is missing.
  return {
    effectiveType: connection?.effectiveType || '4g', // Assume 4G if unknown (optimistic)
    rtt: connection?.rtt ?? 150, // Assume 150ms if unknown (reasonable default)
    downlink: connection?.downlink ?? 5 // Assume 5 Mbps if unknown (enables video)
  };
}

/**
 * Classify network quality based on India-first assumptions
 * 
 * Scoring:
 * - 2G detected: HOSTILE
 * - RTT > 600ms: HOSTILE  
 * - Downlink < 700 kbps: HOSTILE
 * - RTT > 300ms or Downlink < 1.5 Mbps: MODERATE
 * - Otherwise: GOOD
 */
export function classifyNetwork(): NetworkQuality {
  // Always return GOOD for local development to prevent artificial video degradation
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'GOOD';
  }

  const info = getNetworkInfo();
  
  console.log('📶 [Network] Classification input:', info);
  
  // HOSTILE conditions (India 2G/edge cases)
  if (info.effectiveType === '2g' || info.effectiveType === 'slow-2g') {
    console.log('📶 [Network] Classified: HOSTILE (2G detected)');
    return 'HOSTILE';
  }
  
  if (info.rtt > 600) {
    console.log('📶 [Network] Classified: HOSTILE (RTT > 600ms)');
    return 'HOSTILE';
  }
  
  if (info.downlink < 0.7) { // < 700 kbps
    console.log('📶 [Network] Classified: HOSTILE (downlink < 700kbps)');
    return 'HOSTILE';
  }
  
  // MODERATE conditions
  if (info.effectiveType === '3g' || info.rtt > 300 || info.downlink < 1.5) {
    console.log('📶 [Network] Classified: MODERATE');
    return 'MODERATE';
  }
  
  // GOOD network
  console.log('📶 [Network] Classified: GOOD');
  return 'GOOD';
}

/**
 * Check if network is good enough for video
 */
export function canSupportVideo(): boolean {
  const quality = classifyNetwork();
  return quality === 'GOOD' || quality === 'MODERATE';
}

/**
 * Get human-readable network status
 */
export function getNetworkStatusText(quality: NetworkQuality): string {
  switch (quality) {
    case 'GOOD':
      return 'Network good';
    case 'MODERATE':
      return 'Weak network';
    case 'HOSTILE':
      return 'Very weak network';
  }
}

/**
 * Monitor network changes
 */
export function onNetworkChange(callback: (quality: NetworkQuality) => void): () => void {
  const connection = navigator.connection || 
                     navigator.mozConnection || 
                     navigator.webkitConnection;

  if (!connection) {
    return () => {}; // No-op cleanup
  }

  const handler = () => {
    callback(classifyNetwork());
  };

  connection.addEventListener?.('change', handler);
  
  return () => {
    connection.removeEventListener?.('change', handler);
  };
}
