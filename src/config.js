/**
 * AutoVision AR — central app configuration.
 *
 * Everything you are likely to swap (model, target, placement, tracking feel)
 * lives here. Paths are relative to /public, so "assets/models/car.glb" is
 * served from public/assets/models/car.glb.
 */
const base = import.meta.env.BASE_URL;

export const CONFIG = {
  brand: 'AUTOVISION AR',
  model: {
    // Replace public/assets/models/car.glb (or change this path) to use another car.
    // Run `npm run optimize-model -- <your.glb>` first for big files.
    url: `${base}assets/models/car.glb`,
    // The loader normalises any model so its LONGEST horizontal side = 1 unit,
    // centred on X/Z and resting on y = 0. Hotspot coordinates use this space.
    // If your model's nose does not point to +Z after loading, set a Y rotation (radians).
    rotationY: 0,
    // Human-readable credit shown in the About sheet. Update with the real author/licence.
    credit: 'Chevrolet Corvette C7 3D model — supplied asset (Sketchfab export). Verify licence & add author credit.',
  },

  target: {
    // MindAR compiled targets (one file, several images). Rebuilt by `npm run build-advert`.
    url: `${base}assets/targets/targets.mind`,
    // The printable advert (offered on the landing page).
    printableImage: `${base}assets/targets/advert.jpg`,
    // One entry per image compiled into targets.mind, IN THE SAME ORDER.
    // Per-target placement overrides `ar.scale` / `ar.position` (units: 1 = that image's width).
    targets: [
      { name: 'advert', label: 'Advert', scale: 0.85, position: [0, -0.05, 0] },
      // The QR code (public/assets/qr/autovision-ar-qr.png). The branded badge and the QR printed
      // on the advert contain the same code, so they trigger this target too. scale 1 = car as
      // long as the code is wide (the code fills the camera view, so bigger would overflow).
      { name: 'qr', label: 'QR code', scale: 1.0, position: [0, 0, 0] },
    ],
  },

  // How the car sits on the tracked image. MindAR anchor units: 1 = image width.
  ar: {
    scale: 0.85, // default car length relative to image width (per-target values above win)
    // Offset on the page: x → right, y → up the page, z → out of the page (toward the viewer).
    position: [0, -0.05, 0],
    // Rotation of the car around the page normal (degrees). 0 = nose points right.
    heading: -25,
    // Tracking smoothing (lower = smoother/laggier).
    filterMinCF: 0.0001,
    filterBeta: 0.001,
    warmupTolerance: 3, // frames needed to confirm detection (lower = faster lock-on)
    missTolerance: 8, // frames without detection before "lost" (motion hold covers the gap)

    // Motion sensors (gyroscope/accelerometer) — see src/ar/poseManager.js
    gravityAlign: true, // car stands upright w.r.t. real gravity (works for table AND wall/screen adverts)
    motionHold: true, // keep the car in place with the gyroscope when the image is lost
    motionHoldMs: 25000, // give up holding after this long without re-detecting the advert
    uprightYaw: -35, // extra ¾ turn toward the viewer when the advert is vertical (degrees)
    uprightDrop: 0.28, // when vertical, lower the car toward the bottom of the advert (advert widths)
    maxPixelRatio: 1.5,
  },

  viewer: {
    maxPixelRatio: 2,
    background: 0x101214,
    autoRotate: false,
  },

  // Interaction tuning
  tap: {
    maxMovePx: 8, // more than this = drag, not a tap
    maxDurationMs: 450,
    markerHitRadiusPx: 26,
  },
};

export const DEBUG = new URLSearchParams(location.search).has('debug');
