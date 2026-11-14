/**
 * Render scripts/advert/advert.html → public/assets/targets/advert.jpg (A4 @150 dpi)
 * and compile it into public/assets/targets/targets.mind.
 *
 * Usage: npm run build-advert
 * The QR code points to package.json "homepage" (or APP_URL env). Without a URL
 * a dashed "QR" placeholder is printed instead.
 * Run `npm run render-images -- hero` first if the car render changed.
 *
 * NOTE: the QR is part of the tracked image, so changing the URL changes the
 * target — always commit advert.jpg and targets.mind together.
 *
 * Using your own newspaper/magazine advert instead? Skip this script and run:
 *   npm run compile-target -- path/to/your-advert.jpg
 * then copy the image to public/assets/targets/advert.jpg (shown on the landing page).
 */
import sharp from 'sharp';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import QRCode from 'qrcode';
import { startServer, launch } from './lib/harness.mjs';
import { getAppUrl, prettyUrl } from './lib/appUrl.mjs';

const APP_URL = getAppUrl();
const OUT_JPG = 'public/assets/targets/advert.jpg';
fs.mkdirSync('public/assets/targets', { recursive: true });

const { server, url } = await startServer(5198);
const browser = await launch();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });
  await page.goto(`${url}/scripts/advert/advert.html`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  if (APP_URL) {
    const qr = await QRCode.toDataURL(APP_URL, { margin: 0, width: 400, errorCorrectionLevel: 'Q', color: { dark: '#0d0f11', light: '#f4f6f7' } });
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
    console.log(`QR code → ${APP_URL}`);
  } else {
    console.warn('⚠ No app URL set — printing a QR placeholder. Run: npm pkg set homepage=https://your-app.vercel.app');
  }
  const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1240, height: 1754 } });
  await sharp(png).jpeg({ quality: 92, mozjpeg: true }).withMetadata({ density: 150 }).toFile(OUT_JPG);
  console.log(`✔ ${OUT_JPG}`);
} finally {
  await browser.close();
  await server.close();
}

// MindAR works on ~1000px-wide images; a smaller copy compiles faster with the same quality.
const compileSrc = 'public/assets/targets/.advert-compile.png';
await sharp(OUT_JPG).resize(1000).png().toFile(compileSrc);
execFileSync('node', ['scripts/compile-target.mjs', compileSrc], { stdio: 'inherit' });
fs.unlinkSync(compileSrc);
