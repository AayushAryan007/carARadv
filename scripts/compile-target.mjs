/**
 * Compile an image into a MindAR target file (.mind) — offline, in Node.
 *
 * Usage:
 *   npm run compile-target -- <image.jpg|png> [output.mind]
 *   default output: public/assets/targets/targets.mind
 *
 * Several images → several targets (targetIndex 0, 1, 2 … in the given order):
 *   npm run compile-target -- advert1.jpg advert2.jpg
 *
 * Alternative (no Node): MindAR's web compiler
 *   https://hiukim.github.io/mind-ar-js-doc/tools/compile
 *
 * Tips for a good target: lots of sharp, high-contrast detail spread across the
 * whole image, no large flat areas, no repetitive patterns. ~1000 px wide is plenty.
 */
import { OfflineCompiler } from 'mind-ar/src/image-target/offline-compiler.js';
import { loadImage } from 'canvas';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const images = args.filter((a) => /\.(png|jpe?g|webp)$/i.test(a));
const output = args.find((a) => a.endsWith('.mind')) || 'public/assets/targets/targets.mind';

if (!images.length) {
  console.error('Usage: npm run compile-target -- <image.jpg> [more images…] [output.mind]');
  process.exit(1);
}

const loaded = await Promise.all(images.map((p) => loadImage(p)));
loaded.forEach((img, i) => console.log(`target ${i}: ${images[i]} (${img.width}×${img.height})`));

const compiler = new OfflineCompiler();
let last = -10;
await compiler.compileImageTargets(loaded, (p) => {
  if (p - last >= 10) {
    last = p;
    process.stdout.write(`  compiling… ${Math.round(p)}%\n`);
  }
});
const buffer = compiler.exportData();
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, buffer);
console.log(`✔ wrote ${output} (${(buffer.byteLength / 1024).toFixed(0)} KB)`);
