/**
 * End-to-end smoke test in real (headless) Chrome against the PRODUCTION build.
 *
 *   npm run build && npm test
 *
 * The AR test feeds public/assets/targets/advert.jpg to Chrome as a fake
 * camera, so MindAR image tracking runs for real (no phone needed).
 * Screenshots → test-results/
 */
import { preview } from 'vite';
import fs from 'node:fs';
import { launch } from './lib/harness.mjs';
import { makeFakeCameraVideo } from './lib/fakeCamera.mjs';

const OUT = 'test-results';
fs.mkdirSync(OUT, { recursive: true });
if (!fs.existsSync('dist/index.html')) {
  console.error('Run `npm run build` first.');
  process.exit(1);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await preview({ preview: { port: 5197, strictPort: true }, logLevel: 'error' });
const BASE = 'http://localhost:5197';
const video = await makeFakeCameraVideo('public/assets/targets/advert.jpg', `${OUT}/fake-camera.y4m`);
const browser = await launch({ fakeVideo: video });

try {
  /* ── Desktop: landing + 3D viewer ── */
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.setViewport({ width: 1366, height: 860 });
  await page.goto(`${BASE}/?debug`, { waitUntil: 'load' });

  const heroOk = await page.$eval('.hero-visual img', (i) => i.complete && i.naturalWidth > 0);
  check('Landing page renders with hero image', heroOk);

  await page.waitForFunction(() => document.querySelector('#model-status')?.classList.contains('is-ready'), { timeout: 120000 });
  check('GLB model loads (Meshopt-compressed)', true);

  const model = await page.evaluate(() => {
    const THREEBox = window.__app.stage.car;
    const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    THREEBox.updateMatrixWorld(true);
    THREEBox.traverse((o) => {
      if (!o.isMesh || !o.geometry || o.userData.ignoreRaycast) return; // skip helper spheres
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      ['x', 'y', 'z'].forEach((k, i) => {
        box.min[i] = Math.min(box.min[i], b.min[k]);
        box.max[i] = Math.max(box.max[i], b.max[k]);
      });
    });
    return box;
  });
  const len = model.max[2] - model.min[2];
  check('Model normalised (length≈1, on ground, centred)', Math.abs(len - 1) < 0.02 && Math.abs(model.min[1]) < 0.02 && Math.abs(model.min[0] + model.max[0]) < 0.02,
    `length ${len.toFixed(3)}, minY ${model.min[1].toFixed(3)}`);

  await page.click('#btn-start-3d');
  await page.waitForFunction(() => document.querySelector('#experience').dataset.mode === 'viewer' && document.querySelector('#loading').hidden);
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/desktop-viewer.png` });
  check('3D viewer opens', true);

  const linked = await page.evaluate(() => window.__app.hotspots.items.map((h) => `${h.id}:${h.linked ? 'mesh' : 'visual'}`));
  check('Hotspots resolve to meshes', linked.filter((s) => s.endsWith('mesh')).length === 11, linked.join(' '));

  // Tap a hotspot marker
  const tapTarget = await page.evaluate(() => {
    const h = window.__app.hotspots.items.find((x) => x.screen.on && !x.screen.behind);
    return { id: h.id, name: h.name, x: h.screen.x, y: h.screen.y };
  });
  await page.mouse.click(tapTarget.x, tapTarget.y);
  await sleep(900);
  const title = await page.$eval('#panel-title', (e) => e.textContent).catch(() => null);
  check('Tapping a marker opens its info panel', title === tapTarget.name, `tapped ${tapTarget.id} → "${title}"`);
  await page.screenshot({ path: `${OUT}/desktop-panel.png` });

  await page.click('#info-panel [data-close].icon-btn');
  await sleep(500);
  check('Close button closes the panel', !(await page.$eval('#info-panel', (e) => e.classList.contains('is-open'))));

  // Raycast on real geometry: project a wheel mesh centre to the screen and tap it
  await sleep(900);
  const wheel = await page.evaluate(() => {
    const app = window.__app;
    const item = app.hotspots.get('wheels');
    // pick the tyre closest to the camera
    const cam = app.stage.camera;
    const ranked = item.meshes
      .filter((m) => /tire/i.test(m.name))
      .map((m) => {
        m.geometry.computeBoundingSphere();
        const c = m.geometry.boundingSphere.center.clone().applyMatrix4(m.matrixWorld);
        return { c, d: c.distanceTo(cam.position) };
      })
      .sort((a, b) => a.d - b.d);
    const p = ranked[0].c.clone().project(cam);
    const { width, height } = app.stage.size;
    return { x: (p.x * 0.5 + 0.5) * width, y: (-p.y * 0.5 + 0.5) * height };
  });
  await page.mouse.click(wheel.x, wheel.y);
  await sleep(900);
  const wheelTitle = await page.$eval('#panel-title', (e) => e.textContent).catch(() => null);
  const badge = await page.$eval('#info-panel .badge', (e) => e.textContent).catch(() => null);
  check('Tapping real wheel geometry selects "Wheels & Tyres" (raycast)', wheelTitle === 'Wheels & Tyres', `got "${wheelTitle}", badge "${badge}"`);
  const highlighted = await page.evaluate(() => window.__app.hotspots.get('wheels').meshes.every((m) => !!m.userData.originalMaterial));
  check('Selected component meshes are highlighted', highlighted);
  await page.click('#info-panel [data-close].icon-btn');
  await sleep(900);

  // Drag must rotate, not select
  const before = await page.evaluate(() => window.__app.stage.viewerCamera.position.toArray());
  const m = await page.evaluate(() => {
    const h = window.__app.hotspots.items.find((x) => x.screen.on && !x.screen.behind);
    return { x: h.screen.x, y: h.screen.y };
  });
  await page.mouse.move(m.x, m.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(m.x + i * 12, m.y + i * 2);
  await page.mouse.up();
  await sleep(600);
  const after = await page.evaluate(() => window.__app.stage.viewerCamera.position.toArray());
  const panelOpen = await page.$eval('#info-panel', (e) => e.classList.contains('is-open'));
  const moved = Math.hypot(...before.map((v, i) => v - after[i])) > 0.05;
  check('Dragging over a marker rotates the view and does NOT select', moved && !panelOpen);

  // Component list
  await page.click('[data-action="components"]');
  await sleep(500);
  await page.click('.component-item[data-id="glass"]');
  await sleep(900);
  const visTitle = await page.$eval('#panel-title', (e) => e.textContent);
  const visBadge = await page.$eval('#info-panel .badge', (e) => e.className);
  check('Component list selects a component (focus + linked badge)', visTitle === 'Windscreen & Glass' && visBadge.includes('badge-linked'));
  await page.screenshot({ path: `${OUT}/desktop-visual-hotspot.png` });
  await page.keyboard.press('Escape');
  await sleep(500);

  // Exploded view
  await page.click('[data-action="explode"]');
  await sleep(1600);
  const exploded = await page.evaluate(() => window.__app.explode.t === 1 && window.__app.explode.entries.size);
  check('Exploded view separates real meshes', exploded > 0, `${exploded} meshes moved`);
  await page.screenshot({ path: `${OUT}/desktop-exploded.png` });
  await page.click('[data-action="reset"]');
  await sleep(1400);

  // Zoom buttons
  const d0 = await page.evaluate(() => window.__app.stage.viewerCamera.position.distanceTo(window.__app.viewer.controls.target));
  await page.click('[data-action="zoom-in"]');
  await sleep(900);
  const d1 = await page.evaluate(() => window.__app.stage.viewerCamera.position.distanceTo(window.__app.viewer.controls.target));
  check('Zoom-in button moves the camera closer', d1 < d0 - 0.05, `${d0.toFixed(2)} → ${d1.toFixed(2)}`);

  check('No JavaScript errors (desktop)', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();

  /* ── Mobile: layout + real AR tracking with the fake camera ── */
  const mobile = await browser.newPage();
  const mErrors = [];
  mobile.on('pageerror', (e) => mErrors.push(e.message));
  mobile.on('console', (msg) => msg.type() === 'error' && mErrors.push(msg.text()));
  await mobile.emulate({
    viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  });
  await mobile.goto(`${BASE}/?debug`, { waitUntil: 'load' });
  await sleep(1200);
  await mobile.screenshot({ path: `${OUT}/mobile-landing.png` });
  await mobile.screenshot({ path: `${OUT}/mobile-landing-full.png`, fullPage: true });
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('Mobile landing has no horizontal overflow', overflow <= 0, `overflow ${overflow}px`);

  await mobile.tap('#btn-start-ar');
  const t0 = Date.now();
  await mobile.waitForFunction(() => !document.querySelector('#scan').hidden || !document.querySelector('#error').hidden, { timeout: 120000 });
  const arError = await mobile.$eval('#error', (e) => (e.hidden ? null : e.innerText));
  check('Camera permission granted & AR engine starts', !arError, arError || `${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await mobile.screenshot({ path: `${OUT}/mobile-scanning.png` });

  let found = false;
  try {
    await mobile.waitForFunction(() => window.__app.stage.arAnchor.visible, { timeout: 60000 });
    found = true;
  } catch {}
  check('Image target detected from camera feed (MindAR)', found);
  if (found) {
    await sleep(2500);
    await mobile.screenshot({ path: `${OUT}/mobile-ar-tracking.png` });
    const markersOn = await mobile.evaluate(() => window.__app.hotspots.items.filter((h) => h.screen.on).length);
    check('Car + hotspot markers shown on the tracked advert', markersOn > 0, `${markersOn} markers on screen`);
    const target = await mobile.evaluate(() => {
      // a visible marker that isn't covered by UI controls
      const h = window.__app.hotspots.items.find(
        (x) => x.screen.on && !x.screen.behind && document.elementFromPoint(x.screen.x, x.screen.y)?.classList.contains('stage-canvas')
      );
      return h && { x: h.screen.x, y: h.screen.y, name: h.name };
    });
    if (target) {
      await mobile.touchscreen.tap(target.x, target.y);
      await sleep(900);
      const t = await mobile.$eval('#panel-title', (e) => e.textContent).catch(() => null);
      check('Tapping a hotspot in AR opens the info panel', t === target.name, `"${t}"`);
      await mobile.screenshot({ path: `${OUT}/mobile-ar-panel.png` });
      await mobile.tap('#info-panel [data-close].icon-btn');
      await sleep(500);
    }
  }

  /* ── Motion sensors: gravity-aligned placement + motion hold ──
     Synthetic deviceorientation events stand in for the gyroscope. */
  if (found) {
    const orient = (alpha, beta, gamma) =>
      mobile.evaluate((a, b, g) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: a, beta: b, gamma: g })), alpha, beta, gamma);
    // car "up" in camera space
    const carUp = () =>
      mobile.evaluate(() => {
        const m = window.__app.stage.car.matrixWorld.elements;
        const v = [m[4], m[5], m[6]];
        const l = Math.hypot(...v);
        return v.map((x) => x / l);
      });

    // Phone held upright (beta 90) looking at the advert → advert is vertical (screen/wall):
    // the car must stand upright, i.e. up ≈ camera +Y, not sticking out toward the camera.
    for (let i = 0; i < 40; i++) {
      await orient(0, 90, 0);
      await sleep(30);
    }
    const upV = await carUp();
    check('Vertical advert → car stands upright (gravity-aligned)', upV[1] > 0.85, `up=[${upV.map((x) => x.toFixed(2))}]`);
    await mobile.screenshot({ path: `${OUT}/mobile-ar-vertical.png` });

    // Phone flat (beta 0) looking down at a table → car sits on the page (up ≈ toward camera, +Z)
    for (let i = 0; i < 40; i++) {
      await orient(0, 0, 0);
      await sleep(30);
    }
    const upH = await carUp();
    check('Flat advert → car sits on the page', upH[2] > 0.85, `up=[${upH.map((x) => x.toFixed(2))}]`);

    // Tracking drops (camera moved off the advert) → car is held by the gyroscope and follows phone rotation
    await mobile.evaluate(() => window.__app.tracker.pause());
    await sleep(300);
    const held = await mobile.evaluate(() => ({ state: window.__app.pose.state, visible: window.__app.stage.carVisible, m: window.__app.stage.arAnchor.matrix.elements.slice() }));
    await orient(25, 0, 0); // phone turns 25° to the left
    await sleep(300);
    const m2 = await mobile.evaluate(() => window.__app.stage.arAnchor.matrix.elements.slice());
    const movedWithPhone = Math.hypot(...held.m.map((v, i) => v - m2[i])) > 0.05;
    check('Tracking lost → car held in place by motion sensors', held.state === 'motion' && held.visible && movedWithPhone, `state=${held.state}`);
    await orient(0, 0, 0);
    await mobile.evaluate(() => window.__app.tracker.resume());
    let relocked = false;
    try {
      await mobile.waitForFunction(() => window.__app.pose.state === 'tracking', { timeout: 30000 });
      relocked = true;
    } catch {}
    check('Advert seen again → snaps back to image tracking', relocked);

    const audio = await mobile.evaluate(() => window.__app.sfx.ctx?.state);
    check('Futuristic audio engine running (Web Audio)', audio === 'running', `AudioContext ${audio}`);
  }

  // Explore in 3D from AR and back
  await mobile.tap('#btn-switch');
  await mobile.waitForFunction(() => document.querySelector('#experience').dataset.mode === 'viewer');
  await sleep(1200);
  await mobile.screenshot({ path: `${OUT}/mobile-viewer.png` });
  check('AR → "3D View" switch works', true);
  await mobile.tap('#btn-switch');
  await mobile.waitForFunction(() => document.querySelector('#experience').dataset.mode === 'ar');
  let refound = false;
  try {
    await mobile.waitForFunction(() => window.__app.stage.arAnchor.visible, { timeout: 30000 });
    refound = true;
  } catch {}
  check('"Back to AR" resumes tracking without restarting camera', refound);

  await mobile.tap('#btn-exit');
  await sleep(500);
  const released = await mobile.evaluate(() => !document.querySelector('.ar-video') && !window.__app.tracker);
  check('Exit releases camera + tracker', released);
  check('No JavaScript errors (mobile/AR)', mErrors.length === 0, mErrors.slice(0, 3).join(' | '));
  await mobile.close();

  /* ── Camera permission denied ──
     (the fake-media flags auto-accept prompts, so emulate the browser's real rejection) */
  const ctx = await browser.createBrowserContext();
  const denied = await ctx.newPage();
  await denied.evaluateOnNewDocument(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  });
  await denied.goto(`${BASE}/`, { waitUntil: 'load' });
  await denied.click('#btn-start-ar');
  await denied.waitForFunction(() => !document.querySelector('#error').hidden, { timeout: 60000 }).catch(() => {});
  const deniedText = await denied.$eval('#error', (e) => (e.hidden ? null : e.querySelector('h2').textContent));
  const retryVisible = await denied.$eval('#btn-retry', (e) => !e.hidden);
  await denied.screenshot({ path: `${OUT}/camera-denied.png` });
  check('Denied camera shows permission error + Retry', deniedText === 'Camera permission blocked' && retryVisible, `"${deniedText}"`);
  await ctx.close();
} catch (e) {
  console.error(e);
  check('Test run completed without exceptions', false, e.message);
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed. Screenshots in ${OUT}/`);
process.exit(failed ? 1 : 0);
