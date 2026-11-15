/**
 * Build every product's printable advert and QR codes, then compile ALL AR image
 * targets into public/assets/targets/targets.mind.
 *
 *   npm run build-advert
 *
 * Per product (see src/products/<id>.js → advert):
 *   scripts/advert/advert.html filled with the product's text + hero render + QR
 *   → public/assets/targets/advert-<id>.jpg  (A4 @ 150 dpi)
 *
 * targets.mind order = src/products/index.js → TARGETS:
 *   for each product: [advert, QR]   (the badge & the advert's QR contain the same
 *   code as the plain QR, so they trigger the QR target too)
 *
 * The QR points to package.json "homepage" (or APP_URL env). Without a URL a dashed
 * "QR" placeholder is printed. The QR is part of the tracked images, so changing the
 * URL changes the targets — always commit public/assets/{targets,qr} together.
 *
 * Using your own newspaper advert for a product? Replace advert-<id>.jpg with it and
 * run `npm run build-advert -- --no-render` to only recompile targets.mind.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import QRCode from 'qrcode';
import { startServer, launch } from './lib/harness.mjs';
import { getAppUrl, prettyUrl, qrUrl } from './lib/appUrl.mjs';
import { PRODUCTS, TARGETS, qrPathFor, getProduct } from '../src/products/index.js';
import { paths } from '../src/products/shared.js';

const APP_URL = getAppUrl();
const renderAdverts = !process.argv.includes('--no-render');
fs.mkdirSync('public/assets/targets', { recursive: true });

// 1) QR codes (needed both on the adverts and as targets)
if (APP_URL) execFileSync('node', ['scripts/make-qr.mjs'], { stdio: 'inherit' });
else console.warn('⚠ No app URL set — adverts get a QR placeholder and QR targets are skipped. Run: npm pkg set homepage=https://your-app.vercel.app');

// Unique tick patterns per product keep the adverts visually distinct (better target separation)
const ticksFor = (i) => Array.from({ length: 22 }, (_, k) => 12 + ((k * 37 + i * 53 + k * k * 11) % 50));

// 2) Adverts
if (renderAdverts) {
  const { server, url } = await startServer(5198);
  const browser = await launch();
  try {
    for (const [i, p] of PRODUCTS.entries()) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });
      await page.goto(`${url}/scripts/advert/advert.html`, { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate((d) => window.renderAdvert(d), {
        ...p.advert,
        hero: `/${paths.hero(p.id)}`,
        stamp: `AV-0${i + 1} / 3D`,
        ticks: i === 0 ? null : ticksFor(i),
      });
      if (APP_URL) {
        // Same data + error correction as make-qr → identical code, so the advert's QR also triggers the QR target.
        const qr = await QRCode.toDataURL(qrUrl(APP_URL, qrPathFor(p)), {
          margin: 0,
          width: 400,
          errorCorrectionLevel: 'Q',
          color: { dark: '#0d0f11', light: '#f4f6f7' },
        });
        await page.evaluate(
          (src, pretty) => {
            const tile = document.getElementById('qr-tile');
            tile.classList.remove('placeholder');
            tile.innerHTML = `<img src="${src}" alt="">`;
            document.getElementById('qr-url').textContent = pretty.toUpperCase();
            return tile.querySelector('img').decode();
          },
          qr,
          prettyUrl(APP_URL)
        );
      }
      const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1240, height: 1754 } });
      const out = `public/${paths.advert(p.id)}`;
      await sharp(png).jpeg({ quality: 92, mozjpeg: true }).withMetadata({ density: 150 }).toFile(out);
      console.log(`✔ ${out}`);
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

// 3) Compile every target, in TARGETS order (MindAR works on ~1000 px images)
const tmp = [];
for (const [i, t] of TARGETS.entries()) {
  const src = t.kind === 'advert' ? `public/${paths.advert(t.product)}` : `public/${paths.qrPng(t.product)}`;
  if (!fs.existsSync(src)) {
    console.error(`✘ Missing ${src} for target ${i} (${getProduct(t.product).name} ${t.kind}). Set the app URL / render adverts first.`);
    process.exit(1);
  }
  const out = `public/assets/targets/.compile-${i}.png`;
  await sharp(src).resize(t.kind === 'advert' ? 1000 : 800).flatten({ background: '#ffffff' }).png().toFile(out);
  tmp.push(out);
}
execFileSync('node', ['scripts/compile-target.mjs', ...tmp], { stdio: 'inherit' });
tmp.forEach((f) => fs.unlinkSync(f));
