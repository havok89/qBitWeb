import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/auth': {
          target: 'http://localhost:3000',
          changeOrigin: true
        },
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        },
        '/sonarr/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        },
        '/radarr/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        },
        '/sonarr-media': {
          target: 'http://localhost:3000',
          changeOrigin: true
        },
        '/radarr-media': {
          target: 'http://localhost:3000',
          changeOrigin: true
        }
      }
    }
  }
})
