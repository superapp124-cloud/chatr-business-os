import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

// Plugin: serve index.desktop.html instead of index.html in dev server
function desktopEntryPlugin() {
  return {
    name: 'desktop-entry',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const pathname = (req.url || '/').split('?')[0];
        const acceptsHtml = String(req.headers?.accept || '').includes('text/html');
        const hasExtension = Boolean(path.extname(pathname));
        const isInternalAsset =
          pathname.startsWith('/@') ||
          pathname.startsWith('/src/') ||
          pathname.startsWith('/node_modules/') ||
          pathname.startsWith('/assets/') ||
          pathname.startsWith('/wasm/') ||
          pathname.startsWith('/store-assets/');

        if (pathname === '/' || pathname === '/index.html' || (acceptsHtml && !hasExtension && !isInternalAsset)) {
          try {
            let html = fs.readFileSync(
              path.resolve(__dirname, 'index.desktop.html'),
              'utf-8'
            );
            html = await server.transformIndexHtml(req.url, html);
            res.setHeader('Content-Type', 'text/html');
            res.end(html);
            return;
          } catch (e) {
            return next(e);
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: './',
  server: {
    host: "::",
    port: 8086,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), desktopEntryPlugin()],
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
    drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
  },
  build: {
    target: 'chrome87',
    minify: 'esbuild',
    cssMinify: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    outDir: 'dist-desktop',
    rollupOptions: {
      input: 'index.desktop.html',
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
});
