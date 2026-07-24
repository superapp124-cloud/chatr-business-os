/**
 * CHATR Experience System (CXS) - Z-Index Tokens
 * Prevents z-index wars by standardizing layering.
 */

export const zindex = {
  hide: -1,
  base: 0,
  docked: 10,
  dropdown: 20,
  sticky: 30,
  overlay: 40,
  modal: 50,
  popover: 60,
  toast: 70,
  tooltip: 80,
  max: 9999, // Global call overlays, absolute critical alerts
};
