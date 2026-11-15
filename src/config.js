/**
 * AutoVision AR — app-wide configuration.
 *
 * Product-specific things (model, hotspots, exploded view, specs, AR placement,
 * advert text) live in src/products/<id>.js. This file holds what is shared.
 */
import { asset } from './products/shared.js';

export const CONFIG = {
  brand: 'AUTOVISION AR',

  target: {
    // All products' AR targets in one file (advert + QR per product, order defined in
    // src/products/index.js → TARGETS). Rebuilt by `npm run build-advert`.
    url: asset('assets/targets/targets.mind'),
  },

  // AR defaults. Per-target scale / position / heading / uprightYaw come from each
  // product's `ar` block. MindAR anchor units: 1 = width of the tracked image.
  ar: {
    scale: 0.85,
    position: [0, -0.05, 0], // x → right, y → up the page, z → out of the page
    heading: -25, // degrees around the page normal; 0 = model front (+Z) points right
    // Tracking smoothing (lower = smoother/laggier).
    filterMinCF: 0.0001,
    filterBeta: 0.001,
    warmupTolerance: 3, // frames needed to confirm detection (lower = faster lock-on)
    missTolerance: 8, // frames without detection before "lost" (motion hold covers the gap)

    // Motion sensors (gyroscope/accelerometer) — see src/ar/poseManager.js
    gravityAlign: true, // product stands upright w.r.t. real gravity (table AND wall/screen adverts)
    motionHold: true, // keep the product in place with the gyroscope when the image is lost
    motionHoldMs: 25000, // give up holding after this long without re-detecting the advert
    uprightYaw: 0, // extra turn toward the viewer when the advert is vertical (degrees)
    uprightDrop: 0.28, // when vertical, lower the product toward the bottom of the image (image widths)
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
