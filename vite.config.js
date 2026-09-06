import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/exceljs'))           return 'vendor-excel';
          if (id.includes('node_modules/@supabase'))         return 'vendor-supabase';
          if (id.includes('node_modules/react-router-dom')) return 'vendor-router';
        },
      },
    },
  },
})


