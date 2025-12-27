
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Marcamos como externas las librerías que se cargan vía CDN (importmap)
      // para evitar que Rollup intente buscarlas en node_modules durante el build.
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
