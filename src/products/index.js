/**
 * Product registry — add a product by creating src/products/<id>.js and listing it here.
 * Everything else (viewer, AR targets, QR codes, adverts, renders, tests) loops over this list.
 *
 * Order matters for AR: targets.mind contains, for each product in this order,
 * [advert, qr]  →  target index = productIndex * 2 + (qr ? 1 : 0).
 * After adding/reordering products run `npm run build-advert` to rebuild targets.mind.
 */
import car from './car.js';
import watch from './watch.js';
import laptop from './laptop.js';

export const PRODUCTS = [car, watch, laptop];
export const DEFAULT_PRODUCT_ID = PRODUCTS[0].id;

export const getProduct = (id) => PRODUCTS.find((p) => p.id === id) || null;

/** Every image target in targets.mind, in compile order, with its AR placement. */
export const TARGETS = PRODUCTS.flatMap((p) => [
  { product: p.id, kind: 'advert', label: `${p.name} advert`, uprightYaw: 0, ...p.ar.advert },
  { product: p.id, kind: 'qr', label: `${p.name} QR code`, uprightYaw: 0, ...p.ar.qr },
]);

/** Path the product's QR code links to (opens the one-tap AR launch screen). */
export const qrPathFor = (p) => p.qrPath ?? `/?ar=${p.id}`;
