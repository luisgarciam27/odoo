
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Externalizamos todas las dependencias que se cargan vía importmap en el HTML
      external: [
        'react',
        'react-dom',
        'recharts',
        'lucide-react',
        'xlsx',
        '@supabase/supabase-js',
        '@google/genai'
      ]
    }
  }
})
