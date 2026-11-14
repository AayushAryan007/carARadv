import fs from 'node:fs';

/**
 * The public HTTPS URL the QR code points to.
 * Priority: APP_URL env var → "homepage" in package.json.
 * Set it once:  npm pkg set homepage=https://your-app.vercel.app
 */
export function getAppUrl() {
  const fromEnv = process.env.APP_URL;
  const fromPkg = JSON.parse(fs.readFileSync('package.json', 'utf8')).homepage;
  const url = (fromEnv || fromPkg || '').trim();
  if (!url) return null;
  if (!/^https:\/\//.test(url)) {
    console.warn(`⚠ App URL "${url}" is not https:// — phone cameras only work on HTTPS pages.`);
  }
  return url;
}

export const prettyUrl = (url) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
