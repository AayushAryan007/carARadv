/**
 * Identify a product's parts: renders every mesh highlighted (red) and writes labelled
 * contact sheets. Usage: node scripts/inspect-parts.mjs <productId> <outDir> '<views JSON>'
 * views: [{"t":[x,y,z],"p":[x,y,z]}] camera target/position in normalised model space.
 */
import sharp from 'sharp';
import { startServer, launch } from './lib/harness.mjs';
const [product, outDir, views] = [process.argv[2], process.argv[3], JSON.parse(process.argv[4])];
const { server, url } = await startServer(5194);
const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.setViewport({ width: 360, height: 270 });
await page.goto(`${url}/?view=3d&product=${product}&debug`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__app?.hotspots && document.querySelector('#loading').hidden, { timeout: 120000 });
await page.addStyleTag({ content: '.hud-top,.dock,.side-controls,.markers,.product-switcher,.toast,.track-chip{display:none!important}' });
const names = await page.evaluate(() => {
  const app = window.__app; const list = [];
  app.stage.car.traverse((o) => { if (o.isMesh && !o.userData.ignoreRaycast) list.push(o.name); });
  window.__hl = (name) => {
    app.stage.car.traverse((o) => {
      if (!o.isMesh || o.userData.ignoreRaycast) return;
      o.userData.om ??= o.material;
      o.material = o.name === name ? (window.__red ??= new o.material.constructor({ color: 0xff2255, emissive: 0xff2255, emissiveIntensity: 0.6 })) : o.userData.om;
      if (o.name !== name) { o.material = o.userData.om; }
    });
  };
  return list;
});
console.log(names.length, 'meshes');
const tiles = [];
for (const [vi, v] of views.entries()) {
  await page.evaluate((v) => window.__app.viewer.setView(v.t, v.p), v);
  for (const n of names) {
    await page.evaluate((n) => window.__hl(n), n);
    await new Promise((r) => setTimeout(r, 60));
    const img = await page.screenshot({ type: 'png' });
    tiles.push({ n: `${n} v${vi}`, img });
  }
}
await page.evaluate(() => window.__hl('__none__'));
const per = 24, cols = 6, W = 360, H = 290;
for (let s = 0; s * per < tiles.length; s++) {
  const chunk = tiles.slice(s * per, s * per + per);
  const comps = [];
  for (const [i, t] of chunk.entries()) {
    const x = (i % cols) * W, y = Math.floor(i / cols) * H;
    comps.push({ input: t.img, left: x, top: y });
    comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="20"><rect width="${W}" height="20" fill="#000"/><text x="6" y="15" font-size="14" font-family="Arial" fill="#ff0">${t.n}</text></svg>`), left: x, top: y + 270 });
  }
  await sharp({ create: { width: W * cols, height: H * Math.ceil(chunk.length / cols), channels: 3, background: '#000' } }).composite(comps).png().toFile(`${outDir}/${product}-parts-${s}.png`);
}
console.log('sheets', Math.ceil(tiles.length / per));
await browser.close(); await server.close();
