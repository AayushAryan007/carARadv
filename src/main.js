import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import './styles/main.css';

import { CONFIG, DEBUG } from './config.js';
import { HOTSPOTS } from './data/hotspots.js';
import { VEHICLE } from './data/vehicleData.js';
import { EXPLODED_GROUPS } from './data/explodedView.js';
import { Stage } from './three/stage.js';
import { loadCarModel } from './three/modelLoader.js';
import { HotspotManager } from './three/hotspotManager.js';
import { ExplodedView } from './three/explodedView.js';
import { ViewerControls, ArGestures } from './three/viewerControls.js';
import { mapCameraError } from './ar/camera.js';
import { DeviceMotion } from './ar/deviceMotion.js';
import { ArPoseManager } from './ar/poseManager.js';
import { sfx } from './audio/soundFx.js';
import { InfoPanel } from './components/infoPanel.js';
import { ComponentNav } from './components/navigation.js';
import { SpecsSheet } from './components/specsSheet.js';
import { toast } from './components/util.js';

const $ = (sel) => document.querySelector(sel);
const params = new URLSearchParams(location.search);

const ui = {
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
};

const stage = new Stage(ui.stage);
const viewer = new ViewerControls(stage);
const gestures = new ArGestures(stage, stage.renderer.domElement);
const specs = new SpecsSheet($('#specs-sheet'), VEHICLE);
const infoPanel = new InfoPanel($('#info-panel'), { onClose: () => closeComponent() });
const motion = new DeviceMotion();
const pose = new ArPoseManager({ stage, motion, onStateChange: onTrackingState });

let hotspots = null;
let explode = null;
let nav = null;
let tracker = null;
let mode = 'idle'; // 'idle' | 'ar' | 'viewer'
let lastArError = null;

$('#model-credit').textContent = CONFIG.model.credit;

// Show "Download QR code" only once `npm run make-qr` has generated it.
fetch($('#qr-download').getAttribute('href'), { method: 'HEAD' })
  .then((r) => {
    if (r.ok && (r.headers.get('content-type') || '').startsWith('image/')) $('#qr-download').hidden = false;
  })
  .catch(() => {});

/* ───────────── Model loading (starts immediately, in the background) ───────────── */
let modelProgress = 0;
const modelPromise = loadCarModel(CONFIG.model.url, {
  rotationY: CONFIG.model.rotationY,
  onProgress: (p) => {
    modelProgress = p;
    ui.progress.style.width = `${Math.round(p * 100)}%`;
  },
})
  .then(({ root, info }) => {
    if (DEBUG) console.info('[model]', info);
    stage.setCar(root);
    explode = new ExplodedView({ stage, carRoot: root, groups: EXPLODED_GROUPS });
    hotspots = new HotspotManager({ stage, carRoot: root, hotspots: HOTSPOTS, layer: ui.markers, explode });
    nav = new ComponentNav($('#nav-sheet'), hotspots.items, { onSelect: (id) => selectComponent(id) });
    ui.modelStatus.textContent = '3D model ready';
    ui.modelStatus.classList.add('is-ready');
    return root;
  })
  .catch((err) => {
    console.error(err);
    ui.modelStatus.textContent = 'The 3D model could not be loaded.';
    throw err;
  });
modelPromise.catch(() => {});

async function ensureModel() {
  if (!hotspots) {
    showLoading('Loading 3D car…', true);
    ui.progress.style.width = `${Math.round(modelProgress * 100)}%`;
  }
  await modelPromise;
}

/* ───────────── Screens & overlays ───────────── */
function showScreen(name) {
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
// Warm the AR engine download once the landing page is idle.
(window.requestIdleCallback || setTimeout)(() => modelPromise.then(() => loadTrackerModule()).catch(() => {}), { timeout: 4000 });

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
    await ensureModel();
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
        targetIndex: CONFIG.target.index,
        camera: stage.arCamera,
        options: CONFIG.ar,
        onPose: (m) => pose.setTrackedPose(m),
      });
      await tracker.start((s) =>
        showLoading(
          { camera: 'Requesting camera…', target: 'Loading image target…', warmup: 'Preparing tracker…' }[s] || 'Loading…'
        )
      );
    }
    if (mode !== 'ar') return; // user left while loading
    hideLoading();
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

function showScanning(lost) {
  ui.scan.hidden = false;
  ui.scan.classList.toggle('is-lost', lost);
  ui.scanText.textContent = lost ? 'Target lost — point back at the advert' : 'Point at the printed advert';
  sfx.scanning(true);
}

/** 'tracking' = advert locked · 'motion' = held by gyroscope · 'lost' */
function onTrackingState(state, prev) {
  if (mode !== 'ar') return;
  if (state === 'tracking') {
    ui.scan.hidden = true;
    sfx.scanning(false);
    if (prev === 'lost') {
      setChip('Advert locked', 'ok');
      sfx.lockOn();
    } else {
      setChip('Re-locked on advert', 'ok');
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
    await ensureModel();
    if (mode !== 'viewer') return;
    stage.setMode('viewer');
    viewer.setEnabled(true);
    sfx.ambient(true);
    hideLoading();
    if (hotspots?.selectedId) focusSelected();
  } catch (err) {
    showError({ title: 'Model failed to load', message: `Could not load ${CONFIG.model.url}. ${err?.message || ''}` }, { canRetry: false });
  }
}

function exitToLanding() {
  mode = 'idle';
  pose.setEnabled(false);
  sfx.stopAll();
  tracker?.stop();
  tracker = null;
  closeComponent(false);
  nav?.hide();
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
  if (!hotspots) return;
  const h = hotspots.select(id);
  if (!h) return;
  infoPanel.show(h, hotspots.items.indexOf(h));
  sfx.select();
  nav?.setActive(id);
  ui.experience.classList.add('panel-open');
  if (mode === 'viewer') focusSelected();
  if (mode === 'ar' && !stage.carVisible) toast('Point at the advert to see this part on the car');
}

function focusSelected() {
  const h = hotspots.get(hotspots.selectedId);
  const p = hotspots.worldPosition(hotspots.selectedId);
  if (p) viewer.focus(p, { distance: h.distance ?? 0.75, view: h.view });
}

function closeComponent(resetView = true) {
  if (infoPanel.isOpen && resetView) sfx.close();
  hotspots?.clear();
  nav?.setActive(null);
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
  if (!hotspots) return;
  const rect = stage.renderer.domElement.getBoundingClientRect();
  const res = hotspots.pick(e.clientX - rect.left, e.clientY - rect.top);
  if (res?.hotspot) {
    if (res.hotspot.id === hotspots.selectedId) return;
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
  components: () => nav?.toggle(),
  hotspots: (btn) => {
    const on = !hotspots?.visible;
    hotspots?.setVisible(on);
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on);
    toast(on ? 'Hotspots shown' : 'Hotspots hidden');
  },
  explode: (btn) => {
    if (!explode?.available) return toast('This model has no separable parts');
    const on = explode.toggle();
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
    if (explode?.active) {
      explode.toggle(false);
      document.querySelector('[data-action="explode"]').classList.remove('is-on');
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
    nav?.hide();
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
 *  ?view=3d             open straight into the 3D viewer
 *  ?capture=<id|hero>   chrome-less render used by scripts/render-images.mjs
 */
const capture = params.get('capture');
if (capture) {
  document.body.classList.add('capture-mode');
  if (capture === 'hero') document.documentElement.classList.add('capture-hero');
  startViewer().then(async () => {
    if (capture !== 'hero') {
      hotspots.setVisible(false);
      selectComponent(capture);
      infoPanel.hide();
    } else {
      hotspots.setVisible(false);
      viewer.setView([0, 0.09, 0.02], [1.0, 0.26, 0.72]); // low front-¾ "showroom" angle
    }
    await new Promise((r) => setTimeout(r, 1400));
    window.__captureReady = true;
  });
} else if (params.get('view') === '3d') {
  startViewer();
}

if (DEBUG) window.__app = { stage, viewer, gestures, get hotspots() { return hotspots; }, get explode() { return explode; }, get tracker() { return tracker; }, pose, motion, sfx };
