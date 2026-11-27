import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  envDir: '.',

  plugins: [vue()],

  server: {
    host: '0.0.0.0',
    allowedHosts: [
      'granola-thespian-yapping.ngrok-free.dev',
      'moscow-cad-telecommunications-murphy.trycloudflare.com',
      '0.0.0.0',
      'Rawim',
      'laptop-1pfiq0ki.local',
      'rsunand.duckdns.org',
    ],
    proxy: {
      '/api': {
        target: 'http://100.69.73.102:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})