// Native bridge utilities for Android TelecomManager / iOS CallKit integration

/**
 * Native CallState enum values from CallStateManager (Sprint 1-2)
 * Maps to: com.chatr.app.calling.state.CallState
 */
export type NativeCallStateEnum =
  | 'IDLE'
  | 'INCOMING_RINGING'
  | 'OUTGOING_DIALING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'ON_HOLD'
  | 'RECONNECTING'
  | 'ENDING'
  | 'ENDED'
  | 'FAILED'
  | 'PROXY_ACTIVE';

/**
 * Native call state from CallStateManager
 */
export interface NativeCallStateInfo {
  state: NativeCallStateEnum;
  callId: string | null;
  isProxyMode: boolean;
  timestamp: number;
}

/**
 * State transition history entry
 */
export interface CallStateHistoryEntry {
  fromState: NativeCallStateEnum;
  toState: NativeCallStateEnum;
  timestamp: number;
  callId: string | null;
}

/**
 * Legacy native call state set by Android TelecomManager / iOS CallKit
 * Web UI checks this to auto-join calls accepted by native
 */
export interface NativeCallState {
  callId: string;
  accepted: boolean;
  acceptedAt?: number;
}

declare global {
  interface Window {
    Android?: {
      isAppInstalled: (packageName: string) => boolean;
      launchApp: (packageName: string, fallbackUrl: string) => void;
    };
    NativeBridge?: {
      sendEvent: (eventType: string, data: string) => void;
      // Sprint 1-2: CallStateManager read-only APIs
      getCallState?: () => string;
      getCallStateHistory?: () => string;
    };
    ChatrNative?: {
      postMessage: (message: string) => void;
      // Sprint 1-2: CallStateManager read-only APIs
      getCallState?: () => string;
      getCallStateHistory?: () => string;
    };
    ChatrNativeRuntime?: {
      markWebAppReady?: () => void;
      getCallerProtectionState?: () => string;
      getGsmDefenseState?: () => string;
      setGsmDefenseFeature?: (key: 'aiScreen' | 'scamEngine' | 'darkWeb' | 'antiTracker', enabled: boolean) => string;
      requestCallerProtectionSetup?: () => void;
      requestDefaultDialerSetup?: () => void;
      requestOutgoingGsmSetup?: () => void;
      requestContactsPermission?: () => string;
      syncNativeCallLogNow?: () => void;
      getRecentNativeCalls?: (limit: number) => string;
      getDeviceContacts?: (limit: number) => string;
      getDeviceGPTStatus?: () => string;
      geminiNanoGenerate?: (payload: string) => string;
      deviceGPT?: (payload: string) => string;
      setAudioRoute?: (route: 'speaker' | 'earpiece' | 'bluetooth') => boolean;
      getAvailableAudioRoutes?: () => string; // JSON: {available: string[], current: string}
      setRingtone?: (name: string) => void;
    };
    NativeAuth?: {
      setAuthToken: (token: string) => void;
      setUserId: (userId: string) => void;
      setRefreshToken: (token: string) => void;
      clearAuth: () => void;
      getAuthToken: () => string | null;
      getUserId: () => string | null;
    };
    ChatrCall?: {
      onCallStateChanged: (callId: string, state: string) => void;
      onCallConnected: (callId: string) => void;
      onCallEnded: (callId: string) => void;
      hasActiveConnection?: () => boolean;
      showIncomingCall?: (
        callId: string | null,
        callerId: string | null,
        callerName: string | null,
        callerAvatar: string | null,
        callerPhone: string | null,
        callType: string | null,
        conversationId: string | null,
      ) => void;
      dismissIncomingCall?: (callId: string | null) => void;
      showMessageNotification?: (
        senderId: string | null,
        senderName: string | null,
        messageText: string | null,
        conversationId: string | null,
      ) => void;
      showMessageNotificationWithAvatar?: (
        senderId: string | null,
        senderName: string | null,
        messageText: string | null,
        conversationId: string | null,
        senderAvatar: string | null,
      ) => void;
      syncSystemCallIdentity?: (
        callId: string | null,
        phoneNumber: string | null,
        displayName: string | null,
        avatarUrl: string | null,
        remoteId: string | null,
      ) => void;
      playCallProgressTone?: (
        tone: 'RINGBACK' | 'BUSY' | 'FAILED' | 'ENDED' | 'RECONNECTING',
        callId: string | null,
        variant: string | null,
      ) => void;
      stopCallProgressTone?: () => void;
      pauseCallProgressTone?: () => void;
      resumeCallProgressTone?: () => void;
      setCallProgressToneMuted?: (muted: boolean) => void;
    };
    /** Set by native shell when user accepts via TelecomManager/CallKit */
    __CALL_STATE__?: NativeCallState;
  }
}

export const openMiniApp = (packageName: string, fallbackUrl: string) => {
  if (typeof window !== "undefined" && window.Android) {
    try {
      console.log(`[Bridge] Launching Native: ${packageName}`);
      window.Android.launchApp(packageName, fallbackUrl);
    } catch (e) {
      console.error("[Bridge] Failed to call Android:", e);
      window.location.href = fallbackUrl;
    }
  } else {
    console.log("[Bridge] Opening Web Fallback");
    window.open(fallbackUrl, "_blank");
  }
};

export const isAppInstalled = (packageName: string): boolean => {
  if (typeof window !== "undefined" && window.Android) {
    try {
      return window.Android.isAppInstalled(packageName);
    } catch (e) {
      console.error("[Bridge] Failed to check app:", e);
      return false;
    }
  }
  return false;
};

/**
 * Sync auth credentials to native Android app via NativeAuth bridge
 */
export const syncAuthToNative = (
  state: 'SIGNED_IN' | 'SIGNED_OUT',
  userId: string | null,
  accessToken: string | null,
  refreshToken: string | null = null
): boolean => {
  console.log(`[NativeAuth] Syncing auth state: ${state}, userId: ${userId?.substring(0, 8)}...`);

  if (typeof window !== "undefined" && window.NativeAuth) {
    try {
      if (state === 'SIGNED_IN' && accessToken && userId) {
        window.NativeAuth.setAuthToken(accessToken);
        window.NativeAuth.setUserId(userId);
        if (refreshToken) {
          window.NativeAuth.setRefreshToken(refreshToken);
        }
        console.log('[NativeAuth] Auth credentials synced to native SharedPreferences');
        return true;
      } else if (state === 'SIGNED_OUT') {
        window.NativeAuth.clearAuth();
        console.log('[NativeAuth] Auth cleared from native SharedPreferences');
        return true;
      }
    } catch (e) {
      console.error('[NativeAuth] Failed to call NativeAuth bridge:', e);
    }
  }

  if (typeof window !== "undefined" && window.NativeBridge?.sendEvent) {
    try {
      const data = JSON.stringify({ state, userId, accessToken, refreshToken });
      window.NativeBridge.sendEvent('auth_state_changed', data);
      console.log('[NativeAuth] Auth state synced via NativeBridge.sendEvent');
      return true;
    } catch (e) {
      console.error('[NativeAuth] Failed to call NativeBridge.sendEvent:', e);
    }
  }

  if (typeof window !== "undefined" && window.ChatrNative?.postMessage) {
    try {
      const message = JSON.stringify({
        type: 'auth_state_changed',
        data: { state, userId, accessToken, refreshToken }
      });
      window.ChatrNative.postMessage(message);
      console.log('[NativeAuth] Auth state synced via ChatrNative.postMessage');
      return true;
    } catch (e) {
      console.error('[NativeAuth] Failed to call ChatrNative.postMessage:', e);
    }
  }

  console.log('[NativeAuth] No native bridge available (running in browser)');
  return false;
};

export const isNativeApp = (): boolean => {
  return typeof window !== "undefined" && (
    !!window.Android || 
    !!window.NativeBridge || 
    !!window.ChatrNative ||
    !!window.NativeAuth
  );
};

export const hasNativeAuthBridge = (): boolean => {
  return typeof window !== "undefined" && !!window.NativeAuth;
};

export const setNativeAudioRoute = (route: 'speaker' | 'earpiece' | 'bluetooth'): boolean => {
  if (typeof window === "undefined" || !window.ChatrNativeRuntime?.setAudioRoute) {
    return false;
  }

  try {
    return window.ChatrNativeRuntime.setAudioRoute(route);
  } catch (e) {
    console.error('[NativeCall] Failed to set native audio route:', e);
    return false;
  }
};

/** Phase 2 — Audio Routing: return available routes + current route from native. */
export const getAvailableNativeAudioRoutes = (): {
  available: Array<'earpiece' | 'speaker' | 'bluetooth' | 'wired'>;
  current: 'earpiece' | 'speaker' | 'bluetooth' | 'wired';
} => {
  const fallback = { available: ['earpiece' as const, 'speaker' as const], current: 'earpiece' as const };
  try {
    const json = window.ChatrNativeRuntime?.getAvailableAudioRoutes?.();
    if (json) {
      const parsed = JSON.parse(json);
      return { available: parsed.available ?? fallback.available, current: parsed.current ?? 'earpiece' };
    }
  } catch (e) {
    console.debug('[NativeCall] getAvailableAudioRoutes failed:', e);
  }
  return fallback;
};

/** Phase 1 — Ringtone: persist user selection to native SharedPreferences so IncomingCallActivity reads it. */
export const setNativeRingtone = (name: string): void => {
  try {
    window.ChatrNativeRuntime?.setRingtone?.(name);
  } catch (e) {
    console.debug('[NativeCall] setRingtone bridge failed:', e);
  }
};

/**
 * Notify native shell when WebRTC call state changes
 */
export const syncCallStateToNative = (
  callId: string,
  state: 'connecting' | 'connected' | 'ended' | 'failed'
): boolean => {
  console.log(`[NativeCall] Syncing call state: ${callId.slice(0, 8)} -> ${state}`);

  if (typeof window !== "undefined" && window.ChatrCall) {
    try {
      if (state === 'connected') {
        window.ChatrCall.onCallConnected(callId);
      } else if (state === 'ended') {
        window.ChatrCall.onCallEnded(callId);
      } else {
        window.ChatrCall.onCallStateChanged(callId, state);
      }
      console.log('[NativeCall] Call state synced via ChatrCall bridge');
      return true;
    } catch (e) {
      console.error('[NativeCall] ChatrCall bridge error:', e);
    }
  }

  if (typeof window !== "undefined" && window.NativeBridge?.sendEvent) {
    try {
      window.NativeBridge.sendEvent('call_state_changed', JSON.stringify({ callId, state }));
      console.log('[NativeCall] Call state synced via NativeBridge.sendEvent');
      return true;
    } catch (e) {
      console.error('[NativeCall] NativeBridge.sendEvent error:', e);
    }
  }

  if (typeof window !== "undefined" && window.ChatrNative?.postMessage) {
    try {
      window.ChatrNative.postMessage(JSON.stringify({
        type: 'call_state_changed',
        data: { callId, state }
      }));
      console.log('[NativeCall] Call state synced via ChatrNative.postMessage');
      return true;
    } catch (e) {
      console.error('[NativeCall] ChatrNative.postMessage error:', e);
    }
  }

  console.log('[NativeCall] No native call bridge available');
  return false;
};

export const syncSystemCallIdentityToNative = (params: {
  callId?: string | null;
  phoneNumber?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  remoteId?: string | null;
}): boolean => {
  if (!params.phoneNumber) {
    return false;
  }

  if (typeof window !== "undefined" && window.ChatrCall?.syncSystemCallIdentity) {
    try {
      window.ChatrCall.syncSystemCallIdentity(
        params.callId ?? null,
        params.phoneNumber ?? null,
        params.displayName ?? null,
        params.avatarUrl ?? null,
        params.remoteId ?? null,
      );
      console.log('[NativeCall] System dialer identity synced via ChatrCall bridge');
      return true;
    } catch (e) {
      console.error('[NativeCall] Failed to sync system dialer identity:', e);
    }
  }

  return false;
};

export const showIncomingCallNotification = (params: {
  callId?: string | null;
  callerId?: string | null;
  callerName?: string | null;
  callerAvatar?: string | null;
  callerPhone?: string | null;
  callType?: string | null;
  conversationId?: string | null;
}): boolean => {
  if (!params.callId) {
    return false;
  }

  if (typeof window !== "undefined" && window.ChatrCall?.showIncomingCall) {
    try {
      window.ChatrCall.showIncomingCall(
        params.callId ?? null,
        params.callerId ?? null,
        params.callerName ?? null,
        params.callerAvatar ?? null,
        params.callerPhone ?? null,
        params.callType ?? null,
        params.conversationId ?? null,
      );
      console.log('[NativeCall] Requested native incoming call UI via ChatrCall bridge');
      return true;
    } catch (e) {
      console.error('[NativeCall] Failed to request native incoming call UI:', e);
    }
  }

  return false;
};

export const dismissIncomingCallNotification = (callId?: string | null): boolean => {
  if (!callId) {
    return false;
  }

  if (typeof window !== "undefined" && window.ChatrCall?.dismissIncomingCall) {
    try {
      window.ChatrCall.dismissIncomingCall(callId);
      console.log('[NativeCall] Requested native incoming call dismissal via ChatrCall bridge');
      return true;
    } catch (e) {
      console.error('[NativeCall] Failed to dismiss native incoming call:', e);
    }
  }

  return false;
};

export const showNativeMessageNotification = (params: {
  senderId?: string | null;
  senderName?: string | null;
  messageText?: string | null;
  conversationId?: string | null;
  senderAvatar?: string | null;
}): boolean => {
  if (!params.messageText) {
    return false;
  }

  if (typeof window !== "undefined" && window.ChatrCall?.showMessageNotification) {
    try {
      if (window.ChatrCall.showMessageNotificationWithAvatar) {
        window.ChatrCall.showMessageNotificationWithAvatar(
          params.senderId ?? null,
          params.senderName ?? null,
          params.messageText ?? null,
          params.conversationId ?? null,
          params.senderAvatar ?? null,
        );
      } else {
        window.ChatrCall.showMessageNotification(
          params.senderId ?? null,
          params.senderName ?? null,
          params.messageText ?? null,
          params.conversationId ?? null,
        );
      }
      console.log('[NativeCall] Requested native message notification via ChatrCall bridge');
      return true;
    } catch (e) {
      console.error('[NativeCall] Failed to request native message notification:', e);
    }
  }

  return false;
};

/**
 * Check if native shell has already accepted a call
 * Used by web UI to skip the accept button and auto-join WebRTC
 */
export function isCallAcceptedByNative(callId?: string): boolean {
  const state = window.__CALL_STATE__;
  if (!state?.accepted) return false;
  
  if (callId && state.callId !== callId) return false;
  
  console.log(`[NativeCall] Call ${callId?.slice(0, 8) || 'any'} already accepted by native`);
  return true;
}

/**
 * Set native call state (called by native bridge when user accepts via TelecomManager/CallKit)
 */
export function setNativeCallAccepted(callId: string): void {
  window.__CALL_STATE__ = {
    callId,
    accepted: true,
    acceptedAt: Date.now()
  };
  console.log(`[NativeCall] Native accepted call: ${callId.slice(0, 8)}`);
}

/**
 * Clear native call state (called when call ends)
 */
export function clearNativeCallState(): void {
  window.__CALL_STATE__ = undefined;
  console.log('[NativeCall] Native call state cleared');
}

// ==========================================
// Sprint 1-2: CallStateManager Read-Only APIs
// ==========================================

/**
 * Get current call state from native CallStateManager
 * Returns null if no native bridge available
 */
export function getNativeCallState(): NativeCallStateInfo | null {
  try {
    // Try NativeBridge first (primary)
    if (window.NativeBridge?.getCallState) {
      const json = window.NativeBridge.getCallState();
      const state = JSON.parse(json) as NativeCallStateInfo;
      console.log(`[NativeCall] Got state from NativeBridge: ${state.state}`);
      return state;
    }
    
    // Fallback to ChatrNative
    if (window.ChatrNative?.getCallState) {
      const json = window.ChatrNative.getCallState();
      const state = JSON.parse(json) as NativeCallStateInfo;
      console.log(`[NativeCall] Got state from ChatrNative: ${state.state}`);
      return state;
    }
  } catch (e) {
    console.error('[NativeCall] Failed to get native call state:', e);
  }
  
  return null;
}

/**
 * Get call state transition history from native CallStateManager
 * Returns empty array if no native bridge available
 */
export function getNativeCallStateHistory(): CallStateHistoryEntry[] {
  try {
    // Try NativeBridge first (primary)
    if (window.NativeBridge?.getCallStateHistory) {
      const json = window.NativeBridge.getCallStateHistory();
      const history = JSON.parse(json) as CallStateHistoryEntry[];
      console.log(`[NativeCall] Got ${history.length} history entries from NativeBridge`);
      return history;
    }
    
    // Fallback to ChatrNative
    if (window.ChatrNative?.getCallStateHistory) {
      const json = window.ChatrNative.getCallStateHistory();
      const history = JSON.parse(json) as CallStateHistoryEntry[];
      console.log(`[NativeCall] Got ${history.length} history entries from ChatrNative`);
      return history;
    }
  } catch (e) {
    console.error('[NativeCall] Failed to get call state history:', e);
  }
  
  return [];
}

/**
 * Check if native call is in a specific state
 */
export function isNativeCallInState(targetState: NativeCallStateEnum): boolean {
  const state = getNativeCallState();
  return state?.state === targetState;
}

/**
 * Check if native has an active call (any non-idle/ended state)
 */
export function hasActiveNativeCall(): boolean {
  const state = getNativeCallState();
  if (!state) return false;
  
  const inactiveStates: NativeCallStateEnum[] = ['IDLE', 'ENDED', 'FAILED'];
  return !inactiveStates.includes(state.state);
}

/**
 * Check if native call is connected and ready for media
 */
export function isNativeCallConnected(): boolean {
  return isNativeCallInState('CONNECTED');
}

/**
 * Check if native call is in proxy mode (PSTN bridging)
 */
export function isNativeCallProxyMode(): boolean {
  const state = getNativeCallState();
  return state?.isProxyMode === true || state?.state === 'PROXY_ACTIVE';
}
