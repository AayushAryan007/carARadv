// Dev helper: screenshot each product assembled + exploded in the 3D viewer.
// node scripts/lib/shoot-explode.mjs <outDir>
import { startServer, launch } from './harness.mjs';
import { PRODUCTS } from '../../src/products/index.js';
const out = process.argv[2];
const { server, url } = await startServer(5192);
const browser = await launch();
const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.setViewport({ width: 900, height: 640 });
await page.goto(`${url}/?view=3d&debug`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__app?.hotspots && document.querySelector('#loading').hidden, { timeout: 120000 });
for (const p of PRODUCTS) {
  await page.evaluate((id) => window.__app.showProduct(id), p.id);
  await page.waitForFunction((id) => window.__app.products.product?.id === id && document.querySelector('#loading').hidden, { timeout: 120000 }, p.id);
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `${out}/${p.id}-assembled.png` });
  await page.click('[data-action="explode"]');
  await new Promise((r) => setTimeout(r, 2200));
  await page.screenshot({ path: `${out}/${p.id}-exploded.png` });
  await page.click('[data-action="reset"]');
  await new Promise((r) => setTimeout(r, 1200));
}
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
await browser.close(); await server.close();
