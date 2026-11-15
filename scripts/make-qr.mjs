/**
 * Generate each product's QR code — for placing on newspaper/magazine adverts,
 * posters or flyers. Each QR is ALSO an AR image target: scanning it opens the
 * product's launch screen, and pointing the camera at it shows the product on it.
 *
 *   npm pkg set homepage=https://your-app.vercel.app   (once)
 *   npm run make-qr
 *
 * Output per product (public/assets/qr/, also linked from the landing page):
 *   <id>-qr.svg        plain QR, vector — best for print/InDesign/Illustrator
 *   <id>-qr.png        plain QR, 2000 px (this exact image is the AR target)
 *   <id>-qr-badge.png  branded "Scan to see the … in AR" badge, 1600 px
 *
 * Print tips: for AR the code must fill a good part of the camera view — print it
 * at least 5 × 5 cm (badge: 6 cm wide). Keep the white margin, dark on light.
 * After changing the URL, run `npm run build-advert` (rebuilds adverts + targets.mind).
 */
import QRCode from 'qrcode';
import sharp from 'sharp';
import fs from 'node:fs';
import { getAppUrl, prettyUrl, qrUrl } from './lib/appUrl.mjs';
import { PRODUCTS, qrPathFor } from '../src/products/index.js';
import { paths } from '../src/products/shared.js';

const appUrl = getAppUrl();
if (!appUrl) {
  console.error('No app URL. Run: npm pkg set homepage=https://your-app.vercel.app   (or APP_URL=… npm run make-qr)');
  process.exit(1);
}

export const QR_OPTIONS = { errorCorrectionLevel: 'Q', margin: 4, color: { dark: '#0d0f11', light: '#ffffff' } };
fs.mkdirSync('public/assets/qr', { recursive: true });
const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

for (const p of PRODUCTS) {
  const url = qrUrl(appUrl, qrPathFor(p));
  const svg = await QRCode.toString(url, { ...QR_OPTIONS, type: 'svg' });
  fs.writeFileSync(`public/${paths.qrSvg(p.id)}`, svg);
  await QRCode.toFile(`public/${paths.qrPng(p.id)}`, url, { ...QR_OPTIONS, width: 2000 });

  // Branded badge: dark card, teal frame, QR, call to action naming the product
  const W = 1600, H = 2000, Q = 1180;
  const qrPng = await QRCode.toBuffer(url, { ...QR_OPTIONS, margin: 2, width: Q });
  const badgeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" rx="90" fill="#0d0f11"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="72" fill="none" stroke="#19e6c1" stroke-width="10"/>
  <g transform="translate(560 150) rotate(45 30 30)"><rect width="60" height="60" rx="14" fill="none" stroke="#19e6c1" stroke-width="12"/></g>
  <text x="660" y="207" font-family="Helvetica Neue, Arial, sans-serif" font-size="64" font-weight="700" letter-spacing="10" fill="#f4f6f7">AUTOVISION <tspan fill="#19e6c1">AR</tspan></text>
  <rect x="${(W - Q) / 2 - 30}" y="300" width="${Q + 60}" height="${Q + 60}" rx="48" fill="#ffffff"/>
  <text x="${W / 2}" y="1700" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="92" font-weight="800" fill="#f4f6f7">SCAN TO SEE THE ${esc(p.noun.toUpperCase())}</text>
  <text x="${W / 2}" y="1810" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="96" font-weight="800" fill="#19e6c1">IN AUGMENTED REALITY</text>
  <text x="${W / 2}" y="1900" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="44" letter-spacing="4" fill="#a7b0b7">${esc(prettyUrl(appUrl).toUpperCase())}</text>
</svg>`;
  await sharp(Buffer.from(badgeSvg))
    .composite([{ input: qrPng, left: (W - Q) / 2, top: 330 }])
    .png()
    .toFile(`public/${paths.qrBadge(p.id)}`);
  console.log(`✔ ${p.id}: QR → ${url}`);
}
