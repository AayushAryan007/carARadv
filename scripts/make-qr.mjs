/**
 * Generate QR codes that open the app — for placing on any newspaper/magazine
 * advert, poster or flyer.
 *
 *   npm pkg set homepage=https://your-app.vercel.app   (once)
 *   npm run make-qr
 *
 * Output (public/assets/qr/, also downloadable from the landing page):
 *   autovision-ar-qr.svg        plain QR, vector — best for print/InDesign/Illustrator
 *   autovision-ar-qr.png        plain QR, 2000 px
 *   autovision-ar-qr-badge.png  branded "Scan to experience in AR" badge, 1600 px
 *
 * Print tips: at least 2 × 2 cm, keep the white margin (quiet zone), dark on light.
 */
import QRCode from 'qrcode';
import sharp from 'sharp';
import fs from 'node:fs';
import { getAppUrl, prettyUrl } from './lib/appUrl.mjs';

const url = getAppUrl();
if (!url) {
  console.error('No app URL. Run: npm pkg set homepage=https://your-app.vercel.app   (or APP_URL=… npm run make-qr)');
  process.exit(1);
}

const OUT = 'public/assets/qr';
fs.mkdirSync(OUT, { recursive: true });
const opts = { errorCorrectionLevel: 'Q', margin: 4, color: { dark: '#0d0f11', light: '#ffffff' } };

const svg = await QRCode.toString(url, { ...opts, type: 'svg' });
fs.writeFileSync(`${OUT}/autovision-ar-qr.svg`, svg);
await QRCode.toFile(`${OUT}/autovision-ar-qr.png`, url, { ...opts, width: 2000 });

// Branded badge: dark card, teal frame, QR, call to action
const W = 1600, H = 2000, Q = 1180;
const qrPng = await QRCode.toBuffer(url, { ...opts, margin: 2, width: Q });
const badgeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" rx="90" fill="#0d0f11"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="72" fill="none" stroke="#19e6c1" stroke-width="10"/>
  <g transform="translate(560 150) rotate(45 30 30)"><rect width="60" height="60" rx="14" fill="none" stroke="#19e6c1" stroke-width="12"/></g>
  <text x="660" y="207" font-family="Helvetica Neue, Arial, sans-serif" font-size="64" font-weight="700" letter-spacing="10" fill="#f4f6f7">AUTOVISION <tspan fill="#19e6c1">AR</tspan></text>
  <rect x="${(W - Q) / 2 - 30}" y="300" width="${Q + 60}" height="${Q + 60}" rx="48" fill="#ffffff"/>
  <text x="${W / 2}" y="1700" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="96" font-weight="800" fill="#f4f6f7">SCAN TO EXPERIENCE</text>
  <text x="${W / 2}" y="1810" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="96" font-weight="800" fill="#19e6c1">IN AUGMENTED REALITY</text>
  <text x="${W / 2}" y="1900" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="44" letter-spacing="4" fill="#a7b0b7">${prettyUrl(url).toUpperCase()}</text>
</svg>`;
await sharp(Buffer.from(badgeSvg))
  .composite([{ input: qrPng, left: (W - Q) / 2, top: 330 }])
  .png()
  .toFile(`${OUT}/autovision-ar-qr-badge.png`);

console.log(`✔ QR codes for ${url} → ${OUT}/ (svg, png, badge)`);
