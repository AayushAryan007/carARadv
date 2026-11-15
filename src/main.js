import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import './styles/main.css';

import { CONFIG, DEBUG } from './config.js';
import { PRODUCTS, TARGETS, DEFAULT_PRODUCT_ID, getProduct } from './products/index.js';
import { asset, paths } from './products/shared.js';
import { Stage } from './three/stage.js';
import { ProductManager } from './three/productManager.js';
import { ViewerControls, ArGestures } from './three/viewerControls.js';
import { mapCameraError } from './ar/camera.js';
import { DeviceMotion } from './ar/deviceMotion.js';
import { ArPoseManager } from './ar/poseManager.js';
import { sfx } from './audio/soundFx.js';
import { InfoPanel } from './components/infoPanel.js';
import { ComponentNav } from './components/navigation.js';
import { SpecsSheet } from './components/specsSheet.js';
import { toast, escapeHtml } from './components/util.js';

const $ = (sel) => document.querySelector(sel);
const params = new URLSearchParams(location.search);

const ui = {
  launch: $('#launch'),
  landing: $('#landing'),
  experience: $('#experience'),
  stage: $('#stage'),
  markers: $('#markers'),
  scan: $('#scan'),
  scanText: $('#scan-text'),
  chip: $('#track-chip'),
  loading: $('#loading'),
  loadingText: $('#loading-text'),
  progress: $('#progress-bar'),
  error: $('#error'),
  errorTitle: $('#error-title'),
  errorText: $('#error-text'),
  modePill: $('#mode-pill'),
  switchLabel: $('#switch-label'),
  modelStatus: $('#model-status'),
  switcher: $('#product-switcher'),
};

const stage = new Stage(ui.stage);
const viewer = new ViewerControls(stage);
const gestures = new ArGestures(stage, stage.renderer.domElement);
const specs = new SpecsSheet($('#specs-sheet'));
const nav = new ComponentNav($('#nav-sheet'), { onSelect: (id) => selectComponent(id) });
const infoPanel = new InfoPanel($('#info-panel'), { onClose: () => closeComponent() });
const motion = new DeviceMotion();
const pose = new ArPoseManager({ stage, motion, onStateChange: onTrackingState });
const products = new ProductManager({ stage, markersLayer: ui.markers });

let tracker = null;
let mode = 'idle'; // 'idle' | 'ar' | 'viewer'
let lastArError = null;
// The product the user picked (landing card, QR link, ?product=…). AR switches automatically.
let selectedId = getProduct(params.get('product') || params.get('ar'))?.id || DEFAULT_PRODUCT_ID;

const hotspots = () => products.hotspots;
const explode = () => products.explode;

/* ───────────── Product UI: landing cards, viewer switcher, credits ───────────── */
function buildProductUi() {
  $('#product-grid').innerHTML = PRODUCTS.map(
    (p) => `
    <article class="product-card" data-product="${p.id}">
      <div class="product-visual"><img src="${asset(paths.hero(p.id))}" alt="${escapeHtml(p.name)} in 3D" loading="lazy" /></div>
      <div class="product-body">
        <p class="eyebrow">${escapeHtml(p.category)}</p>
        <h3>${escapeHtml(p.name)}</h3>
        <p class="product-tagline">${escapeHtml(p.tagline)}</p>
        <div class="product-actions">
          <button class="btn btn-primary btn-small-solid" data-open="3d" data-product="${p.id}">Explore in 3D</button>
          <button class="btn btn-ghost btn-small-ghost" data-open="ar" data-product="${p.id}">View in AR</button>
        </div>
        <div class="product-links">
          <a href="${asset(paths.advert(p.id))}" target="_blank" rel="noopener">Printable advert</a>
          <a href="${asset(paths.qrBadge(p.id))}" download="${p.id}-qr-badge.png">QR badge</a>
          <a href="${asset(paths.qrSvg(p.id))}" download="${p.id}-qr.svg">QR (SVG)</a>
        </div>
      </div>
    </article>`
  ).join('');

  ui.switcher.innerHTML = PRODUCTS.map(
    (p) => `<button class="switch-chip" data-switch="${p.id}" aria-pressed="false">${escapeHtml(p.category)}</button>`
  ).join('');

  $('#model-credit').innerHTML = PRODUCTS.map((p) => `<li>${escapeHtml(p.model.credit)}</li>`).join('');
}
buildProductUi();

$('#product-grid').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-open]');
  if (!btn) return;
  selectedId = btn.dataset.product;
  if (btn.dataset.open === 'ar') startAR();
  else {
    sfx.unlock();
    sfx.whoosh();
    startViewer();
  }
});

ui.switcher.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-switch]');
  if (!chip || chip.dataset.switch === products.product?.id) return;
  sfx.tick();
  selectedId = chip.dataset.switch;
  showProduct(selectedId);
});

/** Activate a product (download if needed) and refresh every product-dependent UI. */
async function showProduct(id, { quiet = false } = {}) {
  if (products.product?.id === id) return products.product;
  closeComponent(false);
  const cached = products.cache.has(id);
  if (!cached && !quiet) showLoading(`Loading ${getProduct(id).noun}…`, true);
  ui.progress.style.width = '0%';
  const p = await products.activate(id, { onProgress: (f) => (ui.progress.style.width = `${Math.round(f * 100)}%`) });
  if (!p) return null; // superseded by another switch
  hideLoading();
  nav.setItems(products.hotspots.items, p.name);
  specs.set(p.specs);
  viewer.setHome(p.viewer.home);
  if (mode === 'viewer') viewer.reset(true);
  gestures.resetOrientation();
  gestures.resetScale();
  const explodeBtn = $('[data-action="explode"]');
  explodeBtn.classList.remove('is-on');
  explodeBtn.setAttribute('aria-pressed', 'false');
  ui.switcher.querySelectorAll('[data-switch]').forEach((c) => {
    const on = c.dataset.switch === id;
    c.classList.toggle('is-on', on);
    c.setAttribute('aria-pressed', String(on));
  });
  ui.experience.dataset.product = id;
  return p;
}

/* Preload: the selected product right away, the others when the browser is idle. */
products
  .load(selectedId)
  .then(() => {
    ui.modelStatus.textContent = '3D models ready';
    ui.modelStatus.classList.add('is-ready');
  })
  .catch((err) => {
    console.error(err);
    ui.modelStatus.textContent = 'A 3D model could not be loaded.';
  });
const idle = (fn) => (window.requestIdleCallback || ((f) => setTimeout(f, 1200)))(fn, { timeout: 5000 });
idle(() => PRODUCTS.forEach((p) => products.load(p.id).catch(() => {})));

/* ───────────── Screens & overlays ───────────── */
function showScreen(name) {
  if (name !== 'launch') document.documentElement.classList.remove('launching');
  ui.launch.classList.toggle('is-active', name === 'launch');
  ui.landing.classList.toggle('is-active', name === 'landing');
  ui.experience.classList.toggle('is-active', name === 'experience');
  document.body.classList.toggle('in-experience', name === 'experience');
}

function showLoading(text, withProgress = false) {
  ui.loadingText.textContent = text;
  ui.loading.hidden = false;
  ui.loading.classList.toggle('has-progress', withProgress);
}
const hideLoading = () => (ui.loading.hidden = true);

function showError(err, { canRetry = true } = {}) {
  hideLoading();
  ui.scan.hidden = true;
  ui.errorTitle.textContent = err.title || 'Something went wrong';
  ui.errorText.textContent = err.message || String(err);
  $('#btn-retry').hidden = !canRetry;
  ui.error.hidden = false;
}
const hideError = () => (ui.error.hidden = true);

function setChip(text, tone) {
  ui.chip.textContent = text;
  ui.chip.dataset.tone = tone;
  ui.chip.hidden = false;
  clearTimeout(setChip.t);
  if (tone === 'ok') setChip.t = setTimeout(() => (ui.chip.hidden = true), 2500);
}

function setModeUi(m) {
  ui.experience.dataset.mode = m;
  ui.modePill.textContent = m === 'ar' ? 'AR · Live' : '3D Viewer';
  ui.switchLabel.textContent = m === 'ar' ? '3D View' : 'Back to AR';
}

/* ───────────── AR mode ───────────── */
let trackerModule;
const loadTrackerModule = () => (trackerModule ??= import('./ar/imageTracking.js'));
idle(() => loadTrackerModule().catch(() => {}));

async function startAR() {
  // Must run synchronously inside the tap: audio unlock + iOS motion-sensor permission.
  sfx.unlock();
  const motionPermission = motion.requestPermission();
  showScreen('experience');
  hideError();
  closeComponent(false);
  setModeUi('ar');
  mode = 'ar';
  viewer.setEnabled(false);
  gestures.enabled = true;
  gestures.resetScale();
  ui.chip.hidden = true;

  try {
    await showProduct(selectedId);
    if (mode !== 'ar') return;
    stage.setMode('ar');
    pose.setEnabled(true);
    sfx.ambient(true);

    if (tracker?.video) {
      // Returning from the 3D viewer: camera still open, just resume tracking.
      ui.stage.classList.remove('video-hidden');
      tracker.resume();
    } else {
      tracker?.stop();
      showLoading('Loading AR engine…');
      // MindAR + TensorFlow.js (~1.5 MB) only download when AR is used.
      const { ImageTracker } = await loadTrackerModule();
      tracker = new ImageTracker({
        container: ui.stage,
        targetUrl: CONFIG.target.url,
        camera: stage.arCamera,
        options: CONFIG.ar,
        onPose: onTrackerPose,
      });
      await tracker.start((s) =>
        showLoading({ camera: 'Requesting camera…', target: 'Loading image targets…', warmup: 'Preparing tracker…' }[s] || 'Loading…')
      );
    }
    if (mode !== 'ar') return; // user left while loading
    hideLoading();
    // Show what the tracker is looking for — makes a stale/mismatched target file obvious.
    const names = [...new Set(TARGETS.slice(0, tracker.targetCount).map((t) => getProduct(t.product).category))];
    $('#scan-targets').textContent = `Looking for: ${names.join(' · ')} — advert or QR`;
    if (tracker.targetCount < TARGETS.length) {
      console.warn(`targets.mind has ${tracker.targetCount} target(s); products expect ${TARGETS.length}. Run npm run build-advert.`);
    }
    if (pose.state !== 'tracking') showScanning(false);
    if (!(await motionPermission) && DEBUG) console.info('[motion] sensors unavailable — using page-normal placement');
  } catch (err) {
    console.error(err);
    tracker?.stop();
    tracker = null;
    lastArError = mapCameraError(err);
    if (mode === 'ar') showError(lastArError, { canRetry: lastArError.code !== 'insecure' && lastArError.code !== 'unsupported' });
  }
}

/** Each tracked image belongs to a product: seeing a watch QR shows the watch, etc. */
let arSwitching = null;
function onTrackerPose(matrix, index) {
  const target = TARGETS[index];
  if (matrix && target && target.product !== products.product?.id && arSwitching !== target.product) {
    arSwitching = target.product;
    stage.carPivot.visible = false; // don't show the previous product on the new target
    setChip(`Loading ${getProduct(target.product).noun}…`, 'info');
    showProduct(target.product, { quiet: true })
      .then(() => {
        selectedId = target.product;
        setChip(`${target.label} locked`, 'ok');
        sfx.lockOn();
      })
      .finally(() => {
        stage.carPivot.visible = true;
        arSwitching = null;
      });
  }
  pose.setTrackedPose(matrix, index);
}

function showScanning(lost) {
  ui.scan.hidden = false;
  ui.scan.classList.toggle('is-lost', lost);
  ui.scanText.textContent = lost ? 'Lost — point back at the advert or QR code' : 'Point at an advert or its QR code';
  sfx.scanning(true);
}

/** 'tracking' = image locked · 'motion' = held by gyroscope · 'lost' */
function onTrackingState(state, prev) {
  if (mode !== 'ar') return;
  if (state === 'tracking') {
    ui.scan.hidden = true;
    sfx.scanning(false);
    if (arSwitching) return; // the product switch announces itself
    if (prev === 'lost') {
      setChip(`${pose.targetLabel} locked`, 'ok');
      sfx.lockOn();
    } else {
      setChip(`Re-locked on ${pose.targetLabel.toLowerCase()}`, 'ok');
    }
  } else if (state === 'motion') {
    setChip('Holding with motion sensors · re-aim to re-lock', 'info');
  } else if (state === 'lost' && prev) {
    showScanning(true);
    setChip('Tracking lost', 'warn');
    sfx.lost();
  }
}

/* ───────────── 3D viewer mode ───────────── */
async function startViewer() {
  sfx.unlock();
  if (mode === 'ar') sfx.whoosh();
  sfx.scanning(false);
  pose.setEnabled(false);
  showScreen('experience');
  hideError();
  setModeUi('viewer');
  mode = 'viewer';
  ui.scan.hidden = true;
  ui.chip.hidden = true;
  tracker?.pause();
  ui.stage.classList.add('video-hidden');
  gestures.enabled = false;
  gestures.resetScale();
  try {
    const switched = products.product?.id !== selectedId;
    await showProduct(selectedId);
    if (mode !== 'viewer') return;
    stage.setMode('viewer');
    viewer.setEnabled(true);
    if (switched || !stage.viewerInit) viewer.reset(true);
    stage.viewerInit = true;
    sfx.ambient(true);
    hideLoading();
    if (hotspots()?.selectedId) focusSelected();
  } catch (err) {
    console.error(err);
    showError({ title: 'Model failed to load', message: `Could not load the ${getProduct(selectedId).noun} model. ${err?.message || ''}` }, { canRetry: false });
  }
}

function exitToLanding() {
  mode = 'idle';
  pose.setEnabled(false);
  sfx.stopAll();
  tracker?.stop();
  tracker = null;
  closeComponent(false);
  nav.hide();
  specs.hide();
  viewer.setEnabled(false);
  gestures.enabled = false;
  stage.setMode('idle');
  ui.stage.classList.remove('video-hidden');
  hideError();
  hideLoading();
  ui.scan.hidden = true;
  showScreen('landing');
}

/* ───────────── Components ───────────── */
function selectComponent(id) {
  const hs = hotspots();
  if (!hs) return;
  const h = hs.select(id);
  if (!h) return;
  infoPanel.show(h, hs.items.indexOf(h));
  sfx.select();
  nav.setActive(id);
  ui.experience.classList.add('panel-open');
  if (mode === 'viewer') focusSelected();
  if (mode === 'ar' && !stage.carVisible) toast(`Point at the advert to see this part on the ${products.product.noun}`);
}

function focusSelected() {
  const hs = hotspots();
  const h = hs.get(hs.selectedId);
  const p = hs.worldPosition(hs.selectedId);
  if (p) viewer.focus(p, { distance: h.distance ?? 0.75, view: h.view });
}

function closeComponent(resetView = true) {
  if (infoPanel.isOpen && resetView) sfx.close();
  hotspots()?.clear();
  nav.setActive(null);
  infoPanel.hide();
  ui.experience.classList.remove('panel-open');
  if (resetView && mode === 'viewer') viewer.reset();
}

/* Tap vs drag: only short, still presses count as taps. */
(() => {
  const canvas = stage.renderer.domElement;
  const downs = new Map();
  let multi = false;
  canvas.addEventListener('pointerdown', (e) => {
    downs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
    if (downs.size > 1) multi = true;
  });
  const end = (e) => {
    const d = downs.get(e.pointerId);
    downs.delete(e.pointerId);
    const wasMulti = multi;
    if (downs.size === 0) multi = false;
    if (!d || wasMulti || e.type === 'pointercancel') return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved > CONFIG.tap.maxMovePx || performance.now() - d.t > CONFIG.tap.maxDurationMs) return;
    onTap(e);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
})();

function onTap(e) {
  const hs = hotspots();
  if (!hs) return;
  const rect = stage.renderer.domElement.getBoundingClientRect();
  const res = hs.pick(e.clientX - rect.left, e.clientY - rect.top);
  if (res?.hotspot) {
    if (res.hotspot.id === hs.selectedId) return;
    selectComponent(res.hotspot.id);
  } else if (res?.mesh) {
    if (infoPanel.isOpen) closeComponent();
    else toast(DEBUG ? `Mesh: ${res.mesh.name}` : 'No details for this part yet — try a numbered marker');
  } else if (infoPanel.isOpen) {
    closeComponent();
  }
}

/* ───────────── Controls ───────────── */
const actions = {
  'zoom-in': () => (mode === 'viewer' ? viewer.zoom(0.75) : gestures.zoomBy(1.2)),
  'zoom-out': () => (mode === 'viewer' ? viewer.zoom(1.33) : gestures.zoomBy(1 / 1.2)),
  'rotate-left': () => gestures.rotateBy(-Math.PI / 6),
  'rotate-right': () => gestures.rotateBy(Math.PI / 6),
  'reset-orientation': () => gestures.resetOrientation(),
  components: () => nav.toggle(),
  hotspots: (btn) => {
    const on = !hotspots()?.visible;
    hotspots()?.setVisible(on);
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on);
    toast(on ? 'Hotspots shown' : 'Hotspots hidden');
  },
  explode: (btn) => {
    if (!explode()?.available) return toast('This model has no separable parts');
    const on = explode().toggle();
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on);
    if (on && mode === 'viewer') viewer.zoom(1.25);
    on ? sfx.explode() : sfx.assemble();
    toast(on ? 'Exploded view — real model parts separated' : 'Assembled view');
  },
  reset: () => {
    closeComponent(false);
    gestures.resetOrientation();
    gestures.resetScale();
    if (mode === 'viewer') viewer.reset();
    if (explode()?.active) {
      explode().toggle(false);
      $('[data-action="explode"]').classList.remove('is-on');
    }
  },
  'switch-mode': () => {
    if (mode === 'viewer') sfx.whoosh();
    mode === 'ar' ? startViewer() : startAR();
  },
  sound: () => setMuted(!sfx.muted),
};

function setMuted(m) {
  sfx.setMuted(m);
  const btn = $('[data-action="sound"]');
  btn.classList.toggle('is-muted', m);
  btn.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
  btn.setAttribute('aria-pressed', String(!m));
}
setMuted(sfx.muted);

document.querySelectorAll('[data-action]').forEach((btn) =>
  btn.addEventListener('click', () => {
    if (!['sound', 'switch-mode', 'explode'].includes(btn.dataset.action)) sfx.tick();
    actions[btn.dataset.action]?.(btn);
  })
);

$('#btn-start-ar').addEventListener('click', startAR);
$('#btn-start-3d').addEventListener('click', () => {
  sfx.unlock();
  sfx.whoosh();
  startViewer();
});
$('#btn-exit').addEventListener('click', exitToLanding);
$('#btn-specs').addEventListener('click', () => specs.show());
$('#btn-retry').addEventListener('click', () => {
  tracker?.stop();
  tracker = null;
  startAR();
});
$('#btn-error-3d').addEventListener('click', startViewer);
$('#btn-error-back').addEventListener('click', exitToLanding);

const about = $('#about-sheet');
$('#btn-about').addEventListener('click', () => {
  about.classList.add('is-open');
  about.setAttribute('aria-hidden', 'false');
});
about.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) {
    about.classList.remove('is-open');
    about.setAttribute('aria-hidden', 'true');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (infoPanel.isOpen) closeComponent();
    nav.hide();
    specs.hide();
  }
});

// Save battery: stop analysing frames while the tab is hidden; free the camera on page exit.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) sfx.stopAll();
  else if (mode !== 'idle') sfx.ambient(true);
  if (!tracker || mode !== 'ar') return;
  document.hidden ? tracker.pause() : tracker.resume();
});
window.addEventListener('pagehide', () => tracker?.stop());

/* ───────────── Deep links & capture tooling ─────────────
 *  ?product=<id>                     preselect a product
 *  ?view=3d[&product=<id>]           open straight into the 3D viewer
 *  ?ar | ?ar=<id>                    QR-code link → one-tap AR launch screen for that product
 *  ?capture=<hotspotId|hero>&product=<id>   chrome-less render used by scripts/render-images.mjs
 */
const capture = params.get('capture');
if (capture) {
  document.body.classList.add('capture-mode');
  if (capture === 'hero') document.documentElement.classList.add('capture-hero');
  startViewer().then(async () => {
    hotspots().setVisible(false);
    if (capture === 'hero') {
      const { target, position } = products.product.viewer.hero;
      viewer.setView(target, position);
    } else {
      selectComponent(capture);
      infoPanel.hide();
    }
    await new Promise((r) => setTimeout(r, 1400));
    window.__captureReady = true;
  });
} else if (params.get('view') === '3d') {
  startViewer();
} else if (params.has('ar')) {
  // Opened by scanning a QR code → one-tap launch (camera, audio and iOS motion
  // permissions all require a user tap, so AR can't start fully automatically).
  const p = getProduct(selectedId);
  $('#launch-title').innerHTML = `Your ${escapeHtml(p.noun)} is <span class="accent">ready.</span>`;
  $('#launch-noun').textContent = p.noun;
  $('#launch-img').src = asset(paths.hero(p.id));
  showScreen('launch');
  $('#btn-launch-ar').addEventListener('click', startAR);
  $('#btn-launch-3d').addEventListener('click', () => {
    sfx.unlock();
    sfx.whoosh();
    startViewer();
  });
}

if (DEBUG) {
  window.__app = {
    stage, viewer, gestures, pose, motion, sfx, products,
    get hotspots() { return products.hotspots; },
    get explode() { return products.explode; },
    get tracker() { return tracker; },
    showProduct,
  };
}
