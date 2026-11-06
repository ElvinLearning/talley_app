import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Live preview runs behind a proxy whose sandbox id changes, so the host
// allowlist is extended from the environment instead of hardcoded.
const allowedHosts = []
if (process.env.BASE44_PREVIEW_MODE === '1' && process.env.BASE44_SANDBOX_HOST_DOMAIN) {
  allowedHosts.push(`.${process.env.BASE44_SANDBOX_HOST_DOMAIN}`)
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    ...(allowedHosts.length ? { allowedHosts } : {}),
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: process.env.BASE44_PREVIEW_MODE === '1',
    },
  },
})
