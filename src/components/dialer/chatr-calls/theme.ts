export type ThemeOption = 
  | 'midnight' 
  | 'daylight' 
  | 'royal' 
  | 'noir_gold' 
  | 'nordic' 
  | 'blush' 
  | 'cyber';

export interface DialerTheme {
  colors: {
    primary: string;
    background: string;
    surface: string;
    surfaceLight: string;
    text: string;
    textSecondary: string;
    success: string;
    warning: string;
    error: string;
    glass: string;
    border: string;
  };
}

export const THEMES: Record<ThemeOption, DialerTheme> = {
  midnight: {
    colors: {
      primary: "#8B5CF6",   // Chatr unified purple
      background: "#000000",
      surface: "#0f121a",
      surfaceLight: "#1a1f2d",
      text: "#FFFFFF",
      textSecondary: "#8E8E93",
      success: "#34C759",
      warning: "#FF9500",
      error: "#FF3B30",
      glass: "rgba(15, 18, 26, 0.85)",
      border: "rgba(139, 92, 246, 0.12)",
    }
  },
  daylight: {
    colors: {
      primary: "#007AFF",
      background: "#F2F2F7",
      surface: "#FFFFFF",
      surfaceLight: "#E5E5EA",
      text: "#000000",
      textSecondary: "#8E8E93",
      success: "#34C759",
      warning: "#FF9500",
      error: "#FF3B30",
      glass: "rgba(255, 255, 255, 0.7)",
      border: "rgba(0, 0, 0, 0.1)",
    }
  },
  royal: {
    colors: {
      primary: "#A78BFA",
      background: "#0F0C29",
      surface: "#1E1B4B",
      surfaceLight: "#312E81",
      text: "#FFFFFF",
      textSecondary: "#C7D2FE",
      success: "#10B981",
      warning: "#F59E0B",
      error: "#EF4444",
      glass: "rgba(30, 27, 75, 0.7)",
      border: "rgba(167, 139, 250, 0.2)",
    }
  },
  noir_gold: {
    colors: {
      primary: "#D4AF37", // Gold
      background: "#0A0A0A",
      surface: "#121212",
      surfaceLight: "#1C1C1C",
      text: "#F5F5F5",
      textSecondary: "#A0A0A0",
      success: "#D4AF37",
      warning: "#F59E0B",
      error: "#FF4444",
      glass: "rgba(18, 18, 18, 0.85)",
      border: "rgba(212, 175, 55, 0.15)",
    }
  },
  nordic: {
    colors: {
      primary: "#88C0D0", // Cyan
      background: "#2E3440",
      surface: "#3B4252",
      surfaceLight: "#434C5E",
      text: "#ECEFF4",
      textSecondary: "#D8DEE9",
      success: "#A3BE8C",
      warning: "#EBCB8B",
      error: "#BF616A",
      glass: "rgba(59, 66, 82, 0.75)",
      border: "rgba(136, 192, 208, 0.1)",
    }
  },
  blush: {
    colors: {
      primary: "#FB7185", // Rose
      background: "#FFF1F2",
      surface: "#FFFFFF",
      surfaceLight: "#FFE4E6",
      text: "#4C0519",
      textSecondary: "#9F1239",
      success: "#10B981",
      warning: "#F59E0B",
      error: "#EF4444",
      glass: "rgba(255, 255, 255, 0.8)",
      border: "rgba(251, 113, 133, 0.15)",
    }
  },
  cyber: {
    colors: {
      primary: "#00FFC2", // Neon Green
      background: "#050505",
      surface: "#0D0D0D",
      surfaceLight: "#151515",
      text: "#00FFC2",
      textSecondary: "#008F6D",
      success: "#00FFC2",
      warning: "#FFEA00",
      error: "#FF0055",
      glass: "rgba(13, 13, 13, 0.9)",
      border: "rgba(0, 255, 194, 0.2)",
    }
  }
};

export const DIALER_THEME = THEMES.midnight; // Default
