import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = env.PORT || 3000;
  const backendTarget = `http://localhost:${backendPort}`;

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/auth': {
          target: backendTarget,
          changeOrigin: true
        },
        '/api/cleaner': {
          target: backendTarget,
          changeOrigin: true
        },
        '/api': {
          target: backendTarget,
          changeOrigin: true
        },
        '/sonarr/api': {
          target: backendTarget,
          changeOrigin: true
        },
        '/radarr/api': {
          target: backendTarget,
          changeOrigin: true
        },
        '/sonarr-media': {
          target: backendTarget,
          changeOrigin: true
        },
        '/radarr-media': {
          target: backendTarget,
          changeOrigin: true
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react')) {
                return 'icons';
              }
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor';
              }
              return 'deps';
            }
          }
        }
      }
    }
  }
})
