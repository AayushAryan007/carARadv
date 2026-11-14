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
    // MindAR compiled target. Regenerate with `npm run compile-target -- <image>`.
    url: `${base}assets/targets/targets.mind`,
    // The printable advert that matches targets.mind (offered on the landing page).
    printableImage: `${base}assets/targets/advert.jpg`,
    index: 0,
  },

  // How the car sits on the printed advert. MindAR anchor units: 1 = advert width.
  ar: {
    scale: 0.85, // car length relative to advert width
    // Offset on the page: x → right, y → up the page, z → out of the page (toward the viewer).
    position: [0, -0.05, 0],
    // Rotation of the car around the page normal (degrees). 0 = nose points right.
    heading: -25,
    // Tracking smoothing (borrowed from the reference repo's tuning; lower = smoother/laggier).
    filterMinCF: 0.0001,
    filterBeta: 0.001,
    warmupTolerance: 5,
    missTolerance: 10,
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
