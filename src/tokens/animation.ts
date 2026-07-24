/**
 * CHATR Experience System (CXS) - Animation Tokens
 * Strict standard timing for all interactions.
 */

export const animation = {
  durations: {
    hover: '120ms',
    button: '150ms',
    panel: '180ms',
    dialog: '220ms',
    workspace: '250ms',
  },
  easing: {
    // Single unified easing curve for the entire system
    DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  }
};
