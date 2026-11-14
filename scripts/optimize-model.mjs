/**
 * Optimise a GLB for mobile WebAR.
 *
 * Usage:
 *   npm run optimize-model -- <input.glb> [output.glb] [--texture=1024] [--simplify=0.5]
 *
 * Default: resource/chevrolet_corvette_c7.glb -> public/assets/models/car.glb
 *
 * What it does (all lossless-ish except simplify + texture resize):
 *   - dedup / prune / weld duplicate data
 *   - simplify meshes (meshoptimizer, error-bounded so silhouettes are kept)
 *   - resize textures to max N px and convert to WebP
 *   - Meshopt-compress geometry (decoded by three.js GLTFLoader + MeshoptDecoder,
 *     no extra WASM files to host)
 *
 * Mesh NAMES are preserved — hotspots and exploded view depend on them.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup, prune, weld, simplify, textureCompress, meshopt, resample, getBounds,
} from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('='))
);
const positional = args.filter((a) => !a.startsWith('--'));
const input = positional[0] || 'resource/chevrolet_corvette_c7.glb';
const output = positional[1] || 'public/assets/models/car.glb';
const textureSize = Number(flags.texture || 1024);
const simplifyRatio = Number(flags.simplify || 0.5);

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });

console.log(`Reading ${input} ...`);
const doc = await io.read(input);

await doc.transform(
  dedup(),
  prune(),
  resample(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: simplifyRatio, error: 0.0005 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [textureSize, textureSize] }),
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);

fs.mkdirSync(path.dirname(output), { recursive: true });
await io.write(output, doc);

const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
const b = getBounds(scene);
const inMB = (fs.statSync(input).size / 1e6).toFixed(1);
const outMB = (fs.statSync(output).size / 1e6).toFixed(1);
console.log(`Done: ${input} (${inMB} MB) -> ${output} (${outMB} MB)`);
console.log('Bounds min', b.min.map((v) => v.toFixed(2)), 'max', b.max.map((v) => v.toFixed(2)));
