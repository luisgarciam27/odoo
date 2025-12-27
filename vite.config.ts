
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Excluimos las dependencias que vienen de importmap para que Vite no intente resolverlas localmente
    exclude: [
      'react',
      'react-dom',
      'recharts',
      'lucide-react',
      'xlsx',
      '@supabase/supabase-js',
      '@google/genai'
    ]
  },
  build: {
    rollupOptions: {
      // Marcamos como externas para que Rollup las mantenga como imports de ESM en el bundle final
      external: [
        'react',
        'react-dom',
        'recharts',
        'lucide-react',
        'xlsx',
        '@supabase/supabase-js',
        '@google/genai'
      ],
      output: {
        // Mapeo de globales para asegurar compatibilidad en diferentes entornos de ejecución
        globals: {
          'react': 'React',
          'react-dom': 'ReactDOM',
          'recharts': 'Recharts',
          'lucide-react': 'LucideReact',
          'xlsx': 'XLSX',
          '@supabase/supabase-js': 'supabase',
          '@google/genai': 'googleGenai'
        }
      }
    }
  },
  define: {
    // Shim para process.env ya que el SDK de Google GenAI espera encontrarlo
    'process.env': {
      API_KEY: '' // El valor real será inyectado por el entorno según las instrucciones
    }
  }
})
