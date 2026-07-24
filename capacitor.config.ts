import { CapacitorConfig } from '@capacitor/core';
import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';

const liveReloadUrl = process.env.CAP_SERVER_URL?.trim();
const serverConfig = liveReloadUrl ? {
  url: liveReloadUrl,
  cleartext: liveReloadUrl.startsWith('http://'),
} : {
  androidScheme: 'https',
};

const config: CapacitorConfig = {
  appId: 'com.chatr.app',
  appName: 'Chatr+',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#030308',
  // ⚡ LIVE RELOAD CONFIGURATION
  // Set to undefined for Offline/Production mode (bundled assets)
  server: serverConfig,

  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
      iconColor: '#6200ee',
      sound: 'notification.mp3'
    },

    SplashScreen: {
      // ⚡ Kill artificial splash delays to show HTML skeleton instantly
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#030308',
      androidScaleType: 'CENTER',
      showSpinner: false,
      launchFadeOutDuration: 0,
      splashFullScreen: true,
      splashImmersive: true
    },

    StatusBar: {
      style: 'light'
    },

    Keyboard: {
      resize: KeyboardResize.Native,
      style: KeyboardStyle.Dark,
      resizeOnFullScreen: true
    },

    Haptics: {
      selectionStart: true
    },

    BarcodeScanner: {
      targetedFormats: [
        'QR_CODE',
        'EAN_13',
        'EAN_8',
        'UPC_A',
        'UPC_E',
        'CODE_39',
        'CODE_128'
      ]
    },

    NativeBiometric: {
      useFallback: true,
      fallbackTitle: 'Use Passcode',
      fallbackButtonLabel: 'Cancel',
      biometryTitle: 'Chatr+ Login',
      biometrySubTitle: 'Authenticate to access your account'
    },

    SpeechRecognition: {
      language: 'en-US',
      maxResults: 5,
      popup: false,
      partialResults: true
    },

    FirebaseAnalytics: {
      enabled: true,
      automaticDataCollectionEnabled: true
    },

    FirebaseCrashlytics: {
      enabled: true,
      automaticDataCollectionEnabled: true
    },

    BackgroundTask: {
      enableLogs: true
    }
  },

  ios: {
    contentInset: 'always',
    backgroundColor: '#ffffff',
    preferredContentMode: 'mobile'
  },

  // Android specific configuration for edge-to-edge
  android: {
    backgroundColor: '#030308',
    allowMixedContent: true,
    captureInput: true,
    // Keep WebView inspection opt-in so production builds are not debuggable by default.
    webContentsDebuggingEnabled: process.env.CAP_ANDROID_WEB_DEBUGGING === 'true',
    buildOptions: {
      keystorePassword: '',
      keystoreAlias: '',
      keystoreAliasPassword: '',
    }
  }
};

export default config;
