/**
 * Shared test/render harness: start Vite + launch local Chrome via puppeteer-core.
 * Set CHROME_PATH if Chrome is not in the default macOS/Linux/Windows location.
 */
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean);

export function findChrome() {
  const p = CANDIDATES.find((c) => fs.existsSync(c));
  if (!p) throw new Error('Chrome not found. Set CHROME_PATH=/path/to/chrome');
  return p;
}

export async function startServer(port = 5199) {
  const server = await createServer({ server: { port, strictPort: true, host: 'localhost' }, logLevel: 'error' });
  await server.listen();
  return { server, url: `http://localhost:${port}` };
}

export async function launch({ fakeVideo, headless = true } = {}) {
  const args = ['--no-first-run', '--no-default-browser-check', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'];
  if (fakeVideo) {
    args.push('--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${fakeVideo}`);
  }
  return puppeteer.launch({ executablePath: findChrome(), headless, args, protocolTimeout: 240000 });
}
