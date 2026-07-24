import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        md: "2rem",
        lg: "2.5rem",
      },
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
      fontSize: {
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
      },
      spacing: {
        'xs': 'var(--space-xs)',
        'sm': 'var(--space-sm)',
        'md': 'var(--space-md)',
        'lg': 'var(--space-lg)',
        'xl': 'var(--space-xl)',
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chat: {
          background: "hsl(var(--chat-background))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      backgroundImage: {
        'gradient-hero': 'var(--gradient-hero)',
        'gradient-card': 'var(--gradient-card)',
        'gradient-glass': 'var(--gradient-glass)',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'card': 'var(--shadow-card)',
        'elevated': 'var(--shadow-elevated)',
        'glass': 'var(--shadow-glass)',
        'glow': 'var(--shadow-glow)',
      },
      backdropBlur: {
        'xs': '2px',
        'glass': '12px',
      },
      borderRadius: {
        'none': '0',
        'sm': '0.75rem',
        DEFAULT: '1rem',
        'md': '1.25rem',
        'lg': 'var(--radius)',
        'xl': '1.75rem',
        '2xl': '2rem',
        '3xl': '2.5rem',
        'full': '9999px',
      },
      transitionDuration: {
        '250': '250ms',
        '400': '400ms',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0", opacity: "0" },
          to: { height: "var(--radix-accordion-content-height)", opacity: "1" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)", opacity: "1" },
          to: { height: "0", opacity: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "slide-in-bottom": {
          "0%": { 
            transform: "translateY(100%)",
            opacity: "0"
          },
          "100%": { 
            transform: "translateY(0)",
            opacity: "1"
          }
        },
        // Premium message animations
        "message-in": {
          "0%": { 
            opacity: "0", 
            transform: "translateY(8px) scale(0.96)"
          },
          "100%": { 
            opacity: "1", 
            transform: "translateY(0) scale(1)"
          }
        },
        "message-out": {
          "0%": { 
            opacity: "0", 
            transform: "translateY(8px) scale(0.96)"
          },
          "100%": { 
            opacity: "1", 
            transform: "translateY(0) scale(1)"
          }
        },
        // Premium typing dots
        "typing-dot": {
          "0%, 60%, 100%": { 
            transform: "translateY(0)",
            opacity: "0.4"
          },
          "30%": { 
            transform: "translateY(-6px)",
            opacity: "1"
          }
        },
        // Premium pulse glow
        "pulse-glow": {
          "0%, 100%": { 
            boxShadow: "0 0 0 0 hsl(var(--primary) / 0.4)"
          },
          "50%": { 
            boxShadow: "0 0 0 8px hsl(var(--primary) / 0)"
          }
        },
        // Premium skeleton wave
        "skeleton-wave": {
          "0%": { 
            backgroundPosition: "-200% 0"
          },
          "100%": { 
            backgroundPosition: "200% 0"
          }
        },
        // Checkmark animation
        "checkmark-draw": {
          "0%": { 
            strokeDashoffset: "20"
          },
          "100%": { 
            strokeDashoffset: "0"
          }
        },
        // Floating date header
        "float-in": {
          "0%": { 
            opacity: "0",
            transform: "translateY(-8px) scale(0.9)"
          },
          "100%": { 
            opacity: "1",
            transform: "translateY(0) scale(1)"
          }
        },
        // Button press
        "button-press": {
          "0%, 100%": { 
            transform: "scale(1)"
          },
          "50%": { 
            transform: "scale(0.95)"
          }
        },
        // Ripple effect
        "ripple": {
          "0%": { 
            transform: "scale(0)",
            opacity: "0.5"
          },
          "100%": { 
            transform: "scale(4)",
            opacity: "0"
          }
        },
        // CHATR Signature Animations (Experience Alpha)
        "fade-rise": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "glow-pulse": {
          "0%": { backgroundColor: "transparent", color: "inherit" },
          "20%": { backgroundColor: "#7BCBFF", color: "#000" },
          "100%": { backgroundColor: "transparent", color: "inherit" }
        },
        "expand-panel": {
          "0%": { opacity: "0", transform: "scale(0.95) translateY(10px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" }
        }
      },
      animation: {
        "accordion-down": "accordion-down 150ms ease-out",
        "accordion-up": "accordion-up 150ms ease-out",
        "fade-in": "fade-in 150ms ease-out",
        "slide-in": "slide-in 150ms ease-out",
        "slide-in-bottom": "slide-in-bottom 150ms cubic-bezier(0.32, 0.72, 0, 1)",
        "shimmer": "shimmer 2s infinite",
        // Premium animations
        "message-in": "message-in 150ms cubic-bezier(0.32, 0.72, 0, 1)",
        "message-out": "message-out 150ms cubic-bezier(0.32, 0.72, 0, 1)",
        "typing-dot": "typing-dot 1.4s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "skeleton-wave": "skeleton-wave 1.5s ease-in-out infinite",
        "checkmark": "checkmark-draw 150ms ease-out forwards",
        "float-in": "float-in 150ms ease-out",
        "button-press": "button-press 100ms ease-out",
        "ripple": "ripple 0.4s ease-out",
        
        // CHATR Signature Animations (Experience Alpha)
        "fade-rise": "fade-rise 120ms cubic-bezier(0, 0, 0.2, 1) forwards",
        "fade": "fade-in 80ms cubic-bezier(0, 0, 0.2, 1) forwards",
        "scale": "button-press 100ms cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
        "expand": "expand-panel 180ms cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards",
        "collapse": "accordion-up 140ms cubic-bezier(0.4, 0, 1, 1) forwards",
        "glow": "glow-pulse 220ms ease-in-out forwards",
        "slide": "slide-in 160ms cubic-bezier(0, 0, 0.2, 1) forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
