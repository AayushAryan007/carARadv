import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

// Content fingerprints for everything in public/assets. Filenames there never change,
// so URLs get ?v=<hash> (see src/products/shared.js → asset()) and phones can never use
// a stale cached copy — e.g. an old targets.mind that doesn't match the printed QR.
function assetHashes(dir = 'public/assets', out = {}) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) assetHashes(full, out);
    else if (!entry.name.startsWith('.')) {
      out[full.replace(/^public\//, '')] = createHash('md5').update(fs.readFileSync(full)).digest('hex').slice(0, 10);
    }
  }
  return out;
}

// `npm run dev:https` serves over self-signed HTTPS on your LAN so a phone on the
// same Wi-Fi can open the camera (accept the certificate warning once).
export default defineConfig(({ mode }) => ({
  base: '/',
  define: {
    __ASSET_HASHES__: JSON.stringify(assetHashes()),
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
