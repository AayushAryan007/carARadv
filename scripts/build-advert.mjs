/**
 * Render scripts/advert/advert.html → public/assets/targets/advert.jpg (A4 @150 dpi)
 * and compile it into public/assets/targets/targets.mind.
 *
 * Usage: npm run build-advert
 * Run `npm run render-images -- hero` first if the car render changed.
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

// APP_URL=https://your-app.vercel.app npm run build-advert  → adds a QR code linking to the app
const APP_URL = process.env.APP_URL;
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
    const qr = await QRCode.toDataURL(APP_URL, { margin: 0, width: 380, errorCorrectionLevel: 'M', color: { dark: '#0d0f11', light: '#f4f6f7' } });
    await page.evaluate((src, url) => {
      const img = document.getElementById('qr');
      img.src = src;
      img.style.display = 'block';
      document.getElementById('phone').style.display = 'none';
      document.querySelector('.scan p').innerHTML = 'Scan the QR code to open AutoVision AR, tap <b>Start AR</b>, then hold the camera over the whole advert.';
      document.querySelector('.scan .url').textContent = url.replace(/^https?:\/\//, '').replace(/\/$/, '').toUpperCase();
      return img.decode();
    }, qr, APP_URL);
    console.log(`QR code → ${APP_URL}`);
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
