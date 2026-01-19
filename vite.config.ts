import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Analyser le bundle (npm run build && open stats.html)
    visualizer({
      filename: 'stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  
  build: {
    // Génère des sourcemaps pour le debugging
    sourcemap: true,
    
    // Taille minimale pour le code splitting
    chunkSizeWarningLimit: 500,
    
    rollupOptions: {
      output: {
        // Code splitting intelligent
        manualChunks: {
          // Vendor chunks (séparés pour meilleur cache)
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['lucide-react', 'mermaid'],
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
          'vendor-state': ['zustand'],
        },
      },
    },
    
    // Minification aggressive
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
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
    ],
  },
  
  // Définition des variables d'environnement
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '7.0.0'),
  },
});
