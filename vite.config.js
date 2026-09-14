import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'unwired-pledge-cabdriver.ngrok-free.dev'
    ]
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setupTests.js',
    globals: true,
    css: false,
    exclude: ['**/node_modules/**', 'e2e/**']
  }
})
