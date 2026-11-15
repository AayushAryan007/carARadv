/**
 * Helpers shared by product definitions. Works both in the browser (Vite) and
 * in Node build scripts (import.meta.env / __ASSET_HASHES__ are absent there).
 */
const base = import.meta.env?.BASE_URL ?? '/';
// eslint-disable-next-line no-undef
const HASHES = typeof __ASSET_HASHES__ !== 'undefined' ? __ASSET_HASHES__ : {};

/** Public path with a content fingerprint (?v=…) so phones never use a stale cached copy. */
export function asset(rel) {
  const v = HASHES[rel];
  return `${base}${rel}${v ? `?v=${v}` : ''}`;
}

/** Conventional per-product asset locations (relative to /public). */
export const paths = {
  model: (id) => `assets/models/${id}.glb`,
  hero: (id) => `assets/images/${id}/hero.webp`,
  component: (id, hotspotId) => `assets/images/${id}/components/${hotspotId}.webp`,
  advert: (id) => `assets/targets/advert-${id}.jpg`,
  qrSvg: (id) => `assets/qr/${id}-qr.svg`,
  qrPng: (id) => `assets/qr/${id}-qr.png`,
  qrBadge: (id) => `assets/qr/${id}-qr-badge.png`,
};

/** A spec row whose value is not verified yet (shows a "placeholder" badge). */
export const TBD = (label) => ({ label, value: 'To be verified', placeholder: true });
