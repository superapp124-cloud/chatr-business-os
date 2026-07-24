/**
 * Chatr+ Micro-Haptics Engine (Phase 10)
 *
 * Wraps navigator.vibrate() with named semantic patterns so every
 * interaction has a distinct, premium tactile identity.
 *
 * Falls back silently on platforms that don't support vibration.
 */

export type HapticPattern =
  | 'connect'          // double-tap: call connected
  | 'disconnect'       // long rumble: call ended
  | 'mute'             // light single tap
  | 'unmute'           // double light tap
  | 'incoming'         // looped ring pattern
  | 'weak_signal'      // slow triple pulse
  | 'error';           // urgent triple buzz

const PATTERNS: Record<HapticPattern, number | number[]> = {
  connect:      [30, 60, 30],          // short-gap-short (premium double tap)
  disconnect:   [100, 80, 200],        // long rumble sequence
  mute:         [20],                  // feather tap
  unmute:       [20, 40, 20],          // double light tap
  incoming:     [200, 100, 200, 100],  // ring cadence
  weak_signal:  [60, 120, 60, 120, 60], // slow triple pulse
  error:        [80, 40, 80, 40, 80],  // urgent triple
};

let _enabled = true;

export const haptics = {
  /** Enable/disable haptics globally */
  setEnabled(val: boolean) { _enabled = val; },
  isEnabled() { return _enabled; },

  /** Trigger a named haptic pattern */
  trigger(pattern: HapticPattern) {
    if (!_enabled) return;
    if (!('vibrate' in navigator)) return;
    try {
      navigator.vibrate(PATTERNS[pattern]);
    } catch (e) {
      // Silently ignore — vibration API may be blocked in some contexts
    }
  },

  /** Cancel any active vibration */
  cancel() {
    if (!('vibrate' in navigator)) return;
    try { navigator.vibrate(0); } catch (e) {}
  },
};

export default haptics;
