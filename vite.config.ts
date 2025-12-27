
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'recharts',
        'lucide-react',
        'xlsx',
        '@supabase/supabase-js',
        '@google/genai'
      ]
    }
  }
})
