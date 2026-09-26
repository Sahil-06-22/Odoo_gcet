import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin API calls: keeps the httpOnly refresh cookie working and avoids CORS in dev.
    proxy: { '/api': 'http://localhost:4000' },
  },
})
