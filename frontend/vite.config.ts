import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { visualizer } from "rollup-plugin-visualizer";
import { version } from "./package.json";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Upload source maps to Sentry on production builds
    // Requires SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT env vars
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        filesToDeleteAfterUpload: ["./dist/**/*.map"],
      },
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
    ...(process.env.ANALYZE === "true"
      ? [
          visualizer({
            filename: "dist/bundle-stats.html",
            open: true,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],

  // Inject build timestamp for cache-busting detection
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(Date.now().toString()),
    __APP_VERSION__: JSON.stringify(version),
  },

  build: {
    // Source maps for Sentry — uploaded then deleted by the plugin
    sourcemap: "hidden",

    // Taille minimale pour le code splitting
    chunkSizeWarningLimit: 500,

    rollupOptions: {
      output: {
        // Code splitting intelligent
        manualChunks: {
          // Vendor chunks (séparés pour meilleur cache)
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-ui": ["lucide-react"],
          "vendor-motion": ["framer-motion"],
          "vendor-markdown": ["react-markdown", "remark-gfm"],
          "vendor-state": ["zustand"],
        },
      },
    },

    // Utiliser esbuild (par défaut) au lieu de terser
    // esbuild est beaucoup plus rapide et inclus dans Vite
    minify: "esbuild",
    target: "es2018",
  },

  // Optimisations pour le dev
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "lucide-react",
      "zustand",
      "framer-motion",
    ],
  },
});
