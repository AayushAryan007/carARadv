import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:https` serves over self-signed HTTPS on your LAN so a phone on the
// same Wi-Fi can open the camera (accept the certificate warning once).
export default defineConfig(({ mode }) => ({
  base: '/',
  plugins: mode === 'https' ? [basicSsl()] : [],
  server: {
    host: mode === 'https' ? true : 'localhost',
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2500, // MindAR bundles TensorFlow.js (~1.5 MB); it is lazy-loaded
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
}));
