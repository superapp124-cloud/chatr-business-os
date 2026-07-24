/**
 * Video Kill-Switch
 * 
 * Native-controlled video policy:
 * - MODE_0 / MODE_1 / MODE_2: Video capture DISABLED
 * - MODE_3: Video allowed ONLY on user tap
 * - MODE_4: Video allowed normally
 * 
 * Exposes video availability state to WebView for UI messaging.
 */

import { 
  NetworkMode, 
  getNetworkModeInfo, 
  onNetworkModeChange,
  isVideoAllowed as checkVideoAllowed,
  isVideoTapRequired
} from './nativeNetworkBridge';

export interface VideoPolicy {
  allowed: boolean;
  requiresTap: boolean;
  reason: string;
  maxBitrate: number; // kbps, 0 = disabled
  maxResolution: { width: number; height: number };
  maxFrameRate: number;
}

// Video policies per network mode
const VIDEO_POLICIES: Record<NetworkMode, VideoPolicy> = {
  [NetworkMode.MODE_0_OFFLINE]: {
    allowed: false,
    requiresTap: false,
    reason: 'Video unavailable — no network',
    maxBitrate: 0,
    maxResolution: { width: 0, height: 0 },
    maxFrameRate: 0
  },
  [NetworkMode.MODE_1_ULTRA_LOW]: {
    allowed: false,
    requiresTap: false,
    reason: 'Video paused due to low network — voice continuing',
    maxBitrate: 0,
    maxResolution: { width: 0, height: 0 },
    maxFrameRate: 0
  },
  [NetworkMode.MODE_2_LOW]: {
    allowed: true,
    requiresTap: true,
    reason: 'Tap to enable video (weak network)',
    maxBitrate: 150,
    maxResolution: { width: 320, height: 240 },
    maxFrameRate: 10
  },
  [NetworkMode.MODE_3_NORMAL]: {
    allowed: true,
    requiresTap: true,
    reason: 'Tap to enable video',
    maxBitrate: 300,
    maxResolution: { width: 480, height: 360 },
    maxFrameRate: 15
  },
  [NetworkMode.MODE_4_HIGH]: {
    allowed: true,
    requiresTap: false,
    reason: 'Video available',
    maxBitrate: 1500,
    maxResolution: { width: 1280, height: 720 },
    maxFrameRate: 30
  }
};

// Track active video streams for kill-switch
let activeVideoTracks: MediaStreamTrack[] = [];
let videoKillSwitchActive = false;
let videoUserEnabled = false; // User explicitly enabled video
let policyChangeListeners: Array<(policy: VideoPolicy) => void> = [];

/**
 * Get current video policy
 */
export function getVideoPolicy(): VideoPolicy {
  const modeInfo = getNetworkModeInfo();
  return VIDEO_POLICIES[modeInfo.mode];
}

/**
 * Check if video can be enabled
 */
export function canEnableVideo(): boolean {
  const policy = getVideoPolicy();
  return policy.allowed;
}

/**
 * Check if video requires user tap
 */
export function requiresUserTap(): boolean {
  const policy = getVideoPolicy();
  return policy.requiresTap && !videoUserEnabled;
}

/**
 * User explicitly enables video (tap action)
 */
export function userEnableVideo(): boolean {
  const policy = getVideoPolicy();
  
  if (!policy.allowed) {
    console.log('📹 [VideoKillSwitch] Video not allowed on current network');
    return false;
  }
  
  videoUserEnabled = true;
  console.log('📹 [VideoKillSwitch] User enabled video');
  return true;
}

/**
 * Reset user video preference
 */
export function resetVideoPreference(): void {
  videoUserEnabled = false;
}

/**
 * Register a video track for kill-switch management
 */
export function registerVideoTrack(track: MediaStreamTrack): void {
  if (track.kind !== 'video') return;
  
  activeVideoTracks.push(track);
  console.log('📹 [VideoKillSwitch] Registered video track:', track.id);
  
  // Check if we need to disable it immediately
  const policy = getVideoPolicy();
  if (!policy.allowed && track.enabled) {
    disableVideoTrack(track, policy.reason);
  }
  
  // Clean up when track ends
  track.addEventListener('ended', () => {
    activeVideoTracks = activeVideoTracks.filter(t => t.id !== track.id);
    console.log('📹 [VideoKillSwitch] Track ended:', track.id);
  });
}

/**
 * Disable a specific video track
 */
function disableVideoTrack(track: MediaStreamTrack, reason: string): void {
  if (!track.enabled) return;
  
  track.enabled = false;
  console.log(`📹 [VideoKillSwitch] Disabled track ${track.id}: ${reason}`);
}

/**
 * Enable a specific video track
 */
function enableVideoTrack(track: MediaStreamTrack): void {
  if (track.enabled) return;
  
  track.enabled = true;
  console.log('📹 [VideoKillSwitch] Enabled track:', track.id);
}

/**
 * Execute video kill-switch (disable all video)
 */
export function executeKillSwitch(reason: string): void {
  if (videoKillSwitchActive) return;
  
  videoKillSwitchActive = true;
  console.log('📹 [VideoKillSwitch] EXECUTING KILL-SWITCH:', reason);
  
  for (const track of activeVideoTracks) {
    disableVideoTrack(track, reason);
  }
}

/**
 * Release video kill-switch (re-enable video if allowed)
 */
export function releaseKillSwitch(): void {
  if (!videoKillSwitchActive) return;
  
  const policy = getVideoPolicy();
  
  if (!policy.allowed) {
    console.log('📹 [VideoKillSwitch] Cannot release - policy still restricts video');
    return;
  }
  
  if (policy.requiresTap && !videoUserEnabled) {
    console.log('📹 [VideoKillSwitch] Awaiting user tap to enable video');
    videoKillSwitchActive = false;
    return;
  }
  
  videoKillSwitchActive = false;
  console.log('📹 [VideoKillSwitch] Released - re-enabling video');
  
  for (const track of activeVideoTracks) {
    enableVideoTrack(track);
  }
}

/**
 * Apply video bitrate limits to peer connection
 */
export async function applyVideoBitrateLimits(
  peerConnection: RTCPeerConnection
): Promise<void> {
  const policy = getVideoPolicy();
  
  if (!policy.allowed || policy.maxBitrate === 0) {
    console.log('📹 [VideoKillSwitch] Video disabled - no bitrate to apply');
    return;
  }
  
  const senders = peerConnection.getSenders();
  
  for (const sender of senders) {
    if (!sender.track || sender.track.kind !== 'video') continue;
    
    try {
      const params = sender.getParameters();
      
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      
      params.encodings[0].maxBitrate = policy.maxBitrate * 1000;
      params.encodings[0].maxFramerate = policy.maxFrameRate;
      
      await sender.setParameters(params);
      
      console.log('📹 [VideoKillSwitch] Applied video limits:', {
        bitrate: policy.maxBitrate,
        frameRate: policy.maxFrameRate
      });
    } catch (e) {
      console.warn('⚠️ [VideoKillSwitch] Failed to set video parameters:', e);
    }
  }
}

/**
 * Get optimized video constraints for current network
 */
export function getOptimizedVideoConstraints(): MediaTrackConstraints | false {
  const policy = getVideoPolicy();
  
  if (!policy.allowed) {
    return false;
  }
  
  // If requires tap and user hasn't tapped, don't request video
  if (policy.requiresTap && !videoUserEnabled) {
    return false;
  }
  
  return {
    width: { ideal: policy.maxResolution.width, max: policy.maxResolution.width },
    height: { ideal: policy.maxResolution.height, max: policy.maxResolution.height },
    frameRate: { ideal: policy.maxFrameRate, max: policy.maxFrameRate },
    facingMode: 'user'
  };
}

/**
 * Get user-friendly video status message
 */
export function getVideoStatusMessage(): string {
  const policy = getVideoPolicy();
  return policy.reason;
}

/**
 * Subscribe to video policy changes
 */
export function onVideoPolicyChange(callback: (policy: VideoPolicy) => void): () => void {
  policyChangeListeners.push(callback);
  return () => {
    policyChangeListeners = policyChangeListeners.filter(l => l !== callback);
  };
}

/**
 * Initialize video kill-switch monitoring
 */
export function initializeVideoKillSwitch(): () => void {
  console.log('📹 [VideoKillSwitch] Initializing...');
  
  // Monitor network mode changes
  const unsubscribe = onNetworkModeChange((modeInfo) => {
    const policy = VIDEO_POLICIES[modeInfo.mode];
    
    console.log('📹 [VideoKillSwitch] Network mode changed:', {
      mode: NetworkMode[modeInfo.mode],
      videoAllowed: policy.allowed
    });
    
    // Notify policy listeners
    policyChangeListeners.forEach(listener => {
      try {
        listener(policy);
      } catch (e) {
        console.error('[VideoKillSwitch] Listener error:', e);
      }
    });
    
    // Execute or release kill-switch based on policy
    if (!policy.allowed) {
      executeKillSwitch(policy.reason);
    } else if (policy.requiresTap && !videoUserEnabled) {
      // Keep video off but ready for user tap
      console.log('📹 [VideoKillSwitch] Video available on tap');
    } else {
      releaseKillSwitch();
    }
  });
  
  // Initial check
  const policy = getVideoPolicy();
  if (!policy.allowed) {
    executeKillSwitch(policy.reason);
  }
  
  console.log('📹 [VideoKillSwitch] Initialized. Current policy:', policy.reason);
  
  return unsubscribe;
}

/**
 * Intercept getUserMedia video request
 * Returns false if video should be blocked
 */
export function shouldAllowVideoCapture(): boolean {
  const policy = getVideoPolicy();
  
  if (!policy.allowed) {
    console.log('📹 [VideoKillSwitch] Blocking video capture:', policy.reason);
    return false;
  }
  
  if (policy.requiresTap && !videoUserEnabled) {
    console.log('📹 [VideoKillSwitch] Video requires user tap first');
    return false;
  }
  
  return true;
}
