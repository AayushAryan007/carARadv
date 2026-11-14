import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

// Content fingerprints for files in /public whose names never change. They are
// appended as ?v=… so phones can never use a stale cached copy (e.g. an old
// targets.mind that doesn't match the printed QR/advert).
const fingerprint = (file) => {
  try {
    return createHash('md5').update(fs.readFileSync(file)).digest('hex').slice(0, 10);
  } catch {
    return 'dev';
  }
};

// `npm run dev:https` serves over self-signed HTTPS on your LAN so a phone on the
// same Wi-Fi can open the camera (accept the certificate warning once).
export default defineConfig(({ mode }) => ({
  base: '/',
  define: {
    __TARGETS_VERSION__: JSON.stringify(fingerprint('public/assets/targets/targets.mind')),
    __MODEL_VERSION__: JSON.stringify(fingerprint('public/assets/models/car.glb')),
  },
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
