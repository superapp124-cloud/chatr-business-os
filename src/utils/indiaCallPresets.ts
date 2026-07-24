/**
 * India-First Call Presets
 * 
 * Optimized WebRTC configurations for different network conditions:
 * - INDIA_SURVIVAL: For 2G, basements, rural areas (default)
 * - INDIA_STANDARD: For 3G/moderate networks
 * - INDIA_QUALITY: For 4G/good networks with video
 * - INDIA_ULTRA: For 5G/Fiber/Spatial audio
 */

import { NetworkQuality } from './networkClassification';

export interface CallPreset {
  name: string;
  description: string;
  
  // ICE configuration
  iceServers: RTCIceServer[];
  iceTransportPolicy: RTCIceTransportPolicy;
  
  // Connection tuning
  bundlePolicy: RTCBundlePolicy;
  rtcpMuxPolicy: RTCRtcpMuxPolicy;
  iceCandidatePoolSize: number;
  
  // Timeouts
  connectionTimeoutMs: number;
  iceDisconnectToleranceMs: number;
  iceRestartGraceMs: number;
  maxReconnectAttempts: number;
  
  // Media constraints
  audio: MediaTrackConstraints;
  video: MediaTrackConstraints | false;
  
  // Bitrate limits (kbps)
  maxAudioBitrate: number;
  maxVideoBitrate: number;
}

const BASE_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

/**
 * SURVIVAL PRESET - Default for India
 * 
 * Optimized for: 2G, basements, elevators, rural
 * Strategy: TURN-only, low bitrate, long timeouts
 */
export const INDIA_SURVIVAL: CallPreset = {
  name: 'INDIA_SURVIVAL',
  description: 'Optimized for hostile networks (2G, basements, rural)',
  
  iceServers: BASE_ICE_SERVERS,
  iceTransportPolicy: 'all', 
  
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 10,
  
  connectionTimeoutMs: 30000,
  iceDisconnectToleranceMs: 10000,
  iceRestartGraceMs: 25000,
  maxReconnectAttempts: 3,
  
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 24000,
    channelCount: 1,
  },
  video: {
    width: { ideal: 320, max: 426 },
    height: { ideal: 240, max: 320 },
    frameRate: { ideal: 10, max: 15 },
    facingMode: 'user',
  },
  
  maxAudioBitrate: 24,
  maxVideoBitrate: 150,
};

/**
 * STANDARD PRESET - Moderate networks
 * 
 * Optimized for: 3G, mixed conditions
 * Strategy: Allow P2P, moderate quality
 */
export const INDIA_STANDARD: CallPreset = {
  name: 'INDIA_STANDARD',
  description: 'Balanced for moderate networks (3G)',
  
  iceServers: BASE_ICE_SERVERS,
  iceTransportPolicy: 'all',
  
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 20,
  
  connectionTimeoutMs: 25000,
  iceDisconnectToleranceMs: 8000,
  iceRestartGraceMs: 20000,
  maxReconnectAttempts: 3,
  
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 1,
  },
  video: {
    width: { ideal: 854, max: 1280 },
    height: { ideal: 480, max: 720 },
    frameRate: { ideal: 24, max: 30 },
    facingMode: 'user',
  },
  
  maxAudioBitrate: 48,
  maxVideoBitrate: 1200,
};

/**
 * QUALITY PRESET - Good networks
 * 
 * Optimized for: 4G, WiFi, urban
 * Strategy: Full quality, fast connection
 */
export const INDIA_QUALITY: CallPreset = {
  name: 'INDIA_QUALITY',
  description: 'High quality for good networks (4G, WiFi)',
  
  iceServers: BASE_ICE_SERVERS,
  iceTransportPolicy: 'all',
  
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 25,
  
  connectionTimeoutMs: 15000,
  iceDisconnectToleranceMs: 5000,
  iceRestartGraceMs: 10000,
  maxReconnectAttempts: 2,
  
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 1,
  },
  video: {
    width: { ideal: 1280, max: 1920, min: 640 },
    height: { ideal: 720, max: 1080, min: 360 },
    frameRate: { ideal: 30, max: 60, min: 24 },
    facingMode: 'user',
    aspectRatio: { ideal: 16/9 },
  },
  
  maxAudioBitrate: 64,
  maxVideoBitrate: 3500,
};

/**
 * ULTRA PRESET - Premium fiber/5G
 * 
 * Optimized for: Fiber, 5G, Studio quality
 * Strategy: Maximum fidelity, minimum compression
 */
export const INDIA_ULTRA: CallPreset = {
  name: 'INDIA_ULTRA',
  description: 'Ultra high-fidelity for high-end networks (Fiber, 5G)',
  
  iceServers: BASE_ICE_SERVERS,
  iceTransportPolicy: 'all',
  
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 30,
  
  connectionTimeoutMs: 10000, 
  iceDisconnectToleranceMs: 3000,
  iceRestartGraceMs: 5000,
  maxReconnectAttempts: 2,
  
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 2, // Stereo for Ultra mode
  },
  video: {
    width: { ideal: 1920, max: 3840, min: 1280 }, // 4K ready
    height: { ideal: 1080, max: 2160, min: 720 },
    frameRate: { ideal: 60, max: 60, min: 30 },
    facingMode: 'user',
    aspectRatio: { ideal: 16/9 },
  },
  
  maxAudioBitrate: 128, // Studio quality opus
  maxVideoBitrate: 6000, // 6Mbps for 4K/60fps
};

/**
 * Get appropriate preset based on network quality
 */
export function getCallPreset(networkQuality: NetworkQuality, isVideo: boolean): CallPreset {
  switch (networkQuality) {
    case 'HOSTILE':
      console.log('📱 [Preset] Using INDIA_SURVIVAL (hostile network)');
      return INDIA_SURVIVAL;
      
    case 'MODERATE':
      if (isVideo) {
        console.log('📱 [Preset] Using INDIA_STANDARD (moderate + video)');
        return INDIA_STANDARD;
      }
      console.log('📱 [Preset] Using INDIA_SURVIVAL (moderate + audio)');
      return { ...INDIA_SURVIVAL, name: 'INDIA_SURVIVAL_MODERATE' };
      
    case 'GOOD':
      if (isVideo) {
        console.log('📱 [Preset] Using INDIA_ULTRA (good network + video)');
        return INDIA_ULTRA;
      }
      console.log('📱 [Preset] Using INDIA_QUALITY (good network)');
      return INDIA_QUALITY;
      
    default:
      console.log('📱 [Preset] Using INDIA_SURVIVAL (default)');
      return INDIA_SURVIVAL;
  }
}

/**
 * Get RTCConfiguration from preset
 */
export function getWebRTCConfig(preset: CallPreset): RTCConfiguration {
  return {
    iceServers: preset.iceServers,
    iceTransportPolicy: preset.iceTransportPolicy,
    bundlePolicy: preset.bundlePolicy,
    rtcpMuxPolicy: preset.rtcpMuxPolicy,
    iceCandidatePoolSize: preset.iceCandidatePoolSize,
  };
}

/**
 * Get media constraints from preset
 */
export function getMediaConstraints(preset: CallPreset, wantVideo: boolean): MediaStreamConstraints {
  return {
    audio: preset.audio,
    video: wantVideo && preset.video ? preset.video : false,
  };
}

/**
 * Apply bitrate limits to peer connection
 */
export async function applyBitrateLimits(
  pc: RTCPeerConnection, 
  preset: CallPreset
): Promise<void> {
  const senders = pc.getSenders();
  const isAndroidRuntime = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  
  for (const sender of senders) {
    if (!sender.track) continue;
    
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    
    if (sender.track.kind === 'audio') {
      params.encodings = params.encodings.map(encoding => ({
        ...encoding,
        maxBitrate: preset.maxAudioBitrate * 1000,
      }));
    } else if (sender.track.kind === 'video') {
      params.encodings = params.encodings.map(encoding => ({
        ...encoding,
        maxBitrate: preset.maxVideoBitrate * 1000,
        ...(isAndroidRuntime ? { maxFramerate: 30 } : {}),
      }));
    }
    
    try {
      await sender.setParameters(params);
    } catch (e) {
      console.warn('⚠️ [Preset] Failed to set bitrate:', e);
    }
  }
}
