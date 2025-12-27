
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Solo externalizamos @google/genai ya que se resuelve vía importmap en el navegador
      // y no está presente en el node_modules del entorno de build.
      external: [
        '@google/genai'
      ]
    }
  }
})
