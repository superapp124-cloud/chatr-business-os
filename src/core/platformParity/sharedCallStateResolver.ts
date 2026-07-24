export type SharedCallLifecycleState =
  | 'idle'
  | 'dialing'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'recovering'
  | 'reconnecting-signaling'
  | 'degraded'
  | 'failed'
  | 'ending'
  | 'ended';

export const isMediaSessionAuthoritative = (
  connectionState?: RTCPeerConnectionState,
  iceConnectionState?: RTCIceConnectionState
): boolean => {
  return connectionState === 'connected' || iceConnectionState === 'completed';
};

export const shouldPreserveConnectedSession = (
  lifecycleState: SharedCallLifecycleState,
  connectionState?: RTCPeerConnectionState,
  iceConnectionState?: RTCIceConnectionState
): boolean => {
  if (lifecycleState === 'ending' || lifecycleState === 'ended') return false;
  return isMediaSessionAuthoritative(connectionState, iceConnectionState)
    || lifecycleState === 'connected'
    || lifecycleState === 'recovering'
    || lifecycleState === 'reconnecting-signaling'
    || lifecycleState === 'degraded';
};
