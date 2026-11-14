/**
 * Build a .y4m video (Chrome's fake-camera format) showing an image on a
 * desk-coloured background, so the AR pipeline can be tested without a phone.
 */
import sharp from 'sharp';
import fs from 'node:fs';

export async function makeFakeCameraVideo(imagePath, outPath, { width = 720, height = 960, frames = 30, fill = 0.8 } = {}) {
  const meta = await sharp(imagePath).metadata();
  const scale = Math.min((width * fill) / meta.width, (height * fill) / meta.height);
  const w = Math.round(meta.width * scale);
  const h = Math.round(meta.height * scale);
  const advert = await sharp(imagePath).resize(w, h).toBuffer();

  const rgb = await sharp({ create: { width, height, channels: 3, background: '#8a8178' } })
    .composite([{ input: advert, left: Math.round((width - w) / 2), top: Math.round((height - h) / 2) }])
    .removeAlpha()
    .raw()
    .toBuffer();

  // RGB → YUV 4:2:0 (BT.601)
  const Y = Buffer.alloc(width * height);
  const U = Buffer.alloc((width / 2) * (height / 2));
  const V = Buffer.alloc((width / 2) * (height / 2));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
      Y[y * width + x] = Math.max(0, Math.min(255, 0.257 * r + 0.504 * g + 0.098 * b + 16));
      if (y % 2 === 0 && x % 2 === 0) {
        const j = (y / 2) * (width / 2) + x / 2;
        U[j] = Math.max(0, Math.min(255, -0.148 * r - 0.291 * g + 0.439 * b + 128));
        V[j] = Math.max(0, Math.min(255, 0.439 * r - 0.368 * g - 0.071 * b + 128));
      }
    }
  }
  const frame = Buffer.concat([Buffer.from('FRAME\n'), Y, U, V]);
  const header = Buffer.from(`YUV4MPEG2 W${width} H${height} F30:1 Ip A1:1 C420jpeg\n`);
  fs.writeFileSync(outPath, Buffer.concat([header, ...Array(frames).fill(frame)]));
  return outPath;
}
