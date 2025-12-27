
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    // Se usa JSON.stringify para asegurar que el valor sea válido para el compilador
    'process.env': JSON.stringify({})
  },
  build: {
    target: 'esnext'
  }
})
