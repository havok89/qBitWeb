import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: env.QBITTORRENT_URL || env.VITE_QBIT_URL || 'http://localhost:8080',
          changeOrigin: true,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              proxyReq.setHeader('Referer', options.target);
              proxyReq.setHeader('Origin', options.target);
            });
          }
        },
        '/sonarr/api': {
          target: env.SONARR_URL || env.VITE_SONARR_URL || 'http://localhost:8989',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/sonarr\/api/, '/api'),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              const apiKey = env.SONARR_API_KEY || env.VITE_SONARR_API_KEY;
              if (apiKey) {
                proxyReq.setHeader('X-Api-Key', apiKey);
              }
            });
          }
        },
        '/radarr/api': {
          target: env.RADARR_URL || env.VITE_RADARR_URL || 'http://localhost:7878',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/radarr\/api/, '/api'),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              const apiKey = env.RADARR_API_KEY || env.VITE_RADARR_API_KEY;
              if (apiKey) {
                proxyReq.setHeader('X-Api-Key', apiKey);
              }
            });
          }
        },
        '/sonarr-media': {
          target: env.SONARR_URL || env.VITE_SONARR_URL || 'http://localhost:8989',
          changeOrigin: true,
          rewrite: (path) => {
            let newPath = path.replace(/^\/sonarr-media/, '/MediaCover');
            const apiKey = env.SONARR_API_KEY || env.VITE_SONARR_API_KEY;
            if (apiKey) {
              newPath += (newPath.includes('?') ? '&' : '?') + 'apikey=' + apiKey;
            }
            return newPath;
          },
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              const apiKey = env.SONARR_API_KEY || env.VITE_SONARR_API_KEY;
              if (apiKey) {
                proxyReq.setHeader('X-Api-Key', apiKey);
              }
            });
          }
        },
        '/radarr-media': {
          target: env.RADARR_URL || env.VITE_RADARR_URL || 'http://localhost:7878',
          changeOrigin: true,
          rewrite: (path) => {
            let newPath = path.replace(/^\/radarr-media/, '/MediaCover');
            const apiKey = env.RADARR_API_KEY || env.VITE_RADARR_API_KEY;
            if (apiKey) {
              newPath += (newPath.includes('?') ? '&' : '?') + 'apikey=' + apiKey;
            }
            return newPath;
          },
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              const apiKey = env.RADARR_API_KEY || env.VITE_RADARR_API_KEY;
              if (apiKey) {
                proxyReq.setHeader('X-Api-Key', apiKey);
              }
            });
          }
        }
      }
    }
  }
})
