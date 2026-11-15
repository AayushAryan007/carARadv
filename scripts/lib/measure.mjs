// Dev helper: print a product's normalised bounds and each hotspot's mesh-centre.
// node scripts/lib/measure.mjs <productId>
import { startServer, launch } from './harness.mjs';
const id = process.argv[2];
const { server, url } = await startServer(5193);
const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`${url}/?view=3d&product=${id}&debug`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__app?.hotspots && document.querySelector('#loading').hidden, { timeout: 120000 });
console.log(await page.evaluate(async () => {
  const THREE = await import('/node_modules/three/build/three.module.js');
  const app = window.__app; const root = app.stage.car; root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(); const f = (v) => v.toArray().map((x) => x.toFixed(3)).join(', ');
  const all = new THREE.Box3(); root.traverse((o) => o.isMesh && !o.userData.ignoreRaycast && all.expandByObject(o)); all.applyMatrix4(inv);
  const out = [`bounds min [${f(all.min)}] max [${f(all.max)}]`];
  for (const h of app.hotspots.items) {
    const b = new THREE.Box3(); h.meshes.forEach((m) => b.expandByObject(m)); b.applyMatrix4(inv);
    out.push(`${h.id.padEnd(12)} meshes ${String(h.meshes.length).padStart(2)} centre [${f(b.getCenter(new THREE.Vector3()))}] size [${f(b.getSize(new THREE.Vector3()))}] marker [${h.position.map((x) => x.toFixed(3)).join(', ')}]`);
  }
  return out.join('\n');
}));
await browser.close(); await server.close();
