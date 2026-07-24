import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  // Native Android/iOS shell runs from https://localhost, so deep routes
  // need root-based assets instead of relative ones.
  base: '/',
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ['capacitor-native-biometric'],
  },
  esbuild: {
    // Strip debugger statements in production builds
    drop: mode === 'production' ? ['debugger'] : [],
  },
  build: {
    target: 'chrome87',
    minify: 'esbuild',
    cssMinify: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'lucide-icons': ['lucide-react'],
          'firebase-core': ['firebase/app', 'firebase/auth', 'firebase/messaging'],
          'framer-motion': ['framer-motion'],
          'ui-radix': ['@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
  },
}));
