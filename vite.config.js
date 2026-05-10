import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor libs change rarely — separate chunk so browsers cache
          // them across deploys.
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
    // Bumped because the app chunk is feature-rich; vendors are split.
    chunkSizeWarningLimit: 700,
  },
});
