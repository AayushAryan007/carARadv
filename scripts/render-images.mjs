/**
 * Render marketing/supporting images from the real 3D model using headless Chrome:
 *   public/assets/images/hero.webp                 landing-page hero (transparent)
 *   public/assets/images/components/<id>.webp      one per hotspot (info-panel image)
 *
 * Usage: npm run render-images            (all)
 *        npm run render-images -- hero    (just the hero)
 *
 * Re-run after replacing the model or editing hotspot positions.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import { startServer, launch } from './lib/harness.mjs';
import { HOTSPOTS } from '../src/data/hotspots.js';

const only = process.argv[2];
const jobs = [
  { id: 'hero', w: 1600, h: 1000, out: 'public/assets/images/hero.webp', transparent: true },
  ...HOTSPOTS.map((h) => ({ id: h.id, w: 960, h: 540, out: `public/assets/images/components/${h.id}.webp` })),
].filter((j) => !only || j.id === only);

fs.mkdirSync('public/assets/images/components', { recursive: true });
const { server, url } = await startServer();
const browser = await launch();
try {
  for (const job of jobs) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error(`  [${job.id}] page error:`, e.message));
    await page.setViewport({ width: job.w, height: job.h, deviceScaleFactor: 1 });
    await page.goto(`${url}/?capture=${job.id}`, { waitUntil: 'load' });
    await page.waitForFunction('window.__captureReady === true', { timeout: 180000 });
    const png = await page.screenshot({ omitBackground: !!job.transparent, type: 'png' });
    await sharp(png).webp({ quality: 86, alphaQuality: 90 }).toFile(job.out);
    console.log(`✔ ${job.out}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
