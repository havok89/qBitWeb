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
        }
      }
    }
  }
})
