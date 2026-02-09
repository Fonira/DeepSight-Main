import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  
  build: {
    // Génère des sourcemaps pour le debugging
    sourcemap: false, // Désactivé en prod pour réduire la taille
    
    // Taille minimale pour le code splitting
    chunkSizeWarningLimit: 500,
    
    rollupOptions: {
      output: {
        // Code splitting intelligent
        manualChunks: {
          // Vendor chunks (séparés pour meilleur cache)
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['lucide-react'],
          'vendor-motion': ['framer-motion'],
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
          'vendor-state': ['zustand'],
        },
      },
    },
    
    // Utiliser esbuild (par défaut) au lieu de terser
    // esbuild est beaucoup plus rapide et inclus dans Vite
    minify: 'esbuild',
    target: 'es2020',
  },
  
  // Optimisations pour le dev
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'lucide-react',
      'zustand',
      'framer-motion',
    ],
  },
});
