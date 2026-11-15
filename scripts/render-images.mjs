/**
 * Render marketing/supporting images from each product's real 3D model (headless Chrome):
 *   public/assets/images/<product>/hero.webp                 landing card / launch screen / advert (transparent)
 *   public/assets/images/<product>/components/<id>.webp      one per hotspot (info-panel image)
 *
 * Usage: npm run render-images                  (all products)
 *        npm run render-images -- watch         (one product)
 *        npm run render-images -- watch hero    (one image)
 *
 * Re-run after replacing a model or editing hotspot positions / views.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import { startServer, launch } from './lib/harness.mjs';
import { PRODUCTS } from '../src/products/index.js';
import { paths } from '../src/products/shared.js';

const [onlyProduct, onlyImage] = process.argv.slice(2);
const jobs = PRODUCTS.filter((p) => !onlyProduct || p.id === onlyProduct).flatMap((p) => [
  { product: p.id, id: 'hero', w: 1600, h: 1000, out: `public/${paths.hero(p.id)}`, transparent: true },
  ...p.hotspots.map((h) => ({ product: p.id, id: h.id, w: 960, h: 540, out: `public/${paths.component(p.id, h.id)}` })),
]).filter((j) => !onlyImage || j.id === onlyImage);

if (!jobs.length) {
  console.error('Nothing to render — check the product/image id.');
  process.exit(1);
}

const { server, url } = await startServer();
const browser = await launch();
try {
  for (const job of jobs) {
    fs.mkdirSync(job.out.replace(/\/[^/]+$/, ''), { recursive: true });
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error(`  [${job.product}/${job.id}] page error:`, e.message));
    await page.setViewport({ width: job.w, height: job.h, deviceScaleFactor: 1 });
    await page.goto(`${url}/?capture=${job.id}&product=${job.product}`, { waitUntil: 'load' });
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
