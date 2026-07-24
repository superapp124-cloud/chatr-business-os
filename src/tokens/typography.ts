/**
 * CHATR Experience System (CXS) - Typography Tokens
 * This file defines the core semantic typography scale using responsive clamps.
 */

export const typography = {
  fonts: {
    heading: ['Geist', 'system-ui', 'sans-serif'],
    body: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['Geist Mono', 'monospace'],
  },
  sizes: {
    // Display & Headers
    display:   ['clamp(26px, 2vw, 30px)', { lineHeight: '38px', fontWeight: '700' }],
    page:      ['clamp(22px, 1.8vw, 24px)', { lineHeight: '32px', fontWeight: '600' }],
    workspace: ['clamp(18px, 1.5vw, 20px)', { lineHeight: '28px', fontWeight: '600' }],
    section:   ['clamp(16px, 1.3vw, 18px)', { lineHeight: '26px', fontWeight: '600' }],
    card:      ['clamp(15px, 1.2vw, 16px)', { lineHeight: '24px', fontWeight: '600' }],
    
    // Semantic UI Elements
    button:    ['clamp(13px, 1vw, 14px)', { lineHeight: '20px', fontWeight: '500' }],
    input:     ['clamp(13px, 1vw, 14px)', { lineHeight: '20px', fontWeight: '400' }],
    table:     ['clamp(12px, 0.9vw, 13px)', { lineHeight: '20px', fontWeight: '400' }],
    nav:       ['clamp(12px, 0.9vw, 13px)', { lineHeight: '20px', fontWeight: '500' }],
    metric:    ['clamp(28px, 2.2vw, 32px)', { lineHeight: '36px', fontWeight: '700' }],
  
    // Body & Supporting Text
    body:      ['clamp(13px, 1vw, 14px)', { lineHeight: '22px', fontWeight: '400' }],
    secondary: ['13px', { lineHeight: '20px', fontWeight: '400' }],
    label:     ['12px', { lineHeight: '18px', fontWeight: '500' }],
    caption:   ['11px', { lineHeight: '16px', fontWeight: '400' }],
    tiny:      ['10px', { lineHeight: '14px', fontWeight: '500' }],
  }
};
