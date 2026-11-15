import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
await MeshoptDecoder.ready;
const f = process.argv[2];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'draco3d.decoder': await draco3d.createDecoderModule() });
const doc = await io.read(f);
const root = doc.getRoot();
console.log('extensions:', root.listExtensionsUsed().map(e => e.extensionName).join(', '));
console.log('animations:', root.listAnimations().length, 'materials:', root.listMaterials().length, 'textures:', root.listTextures().length,
  'tex sizes:', [...new Set(root.listTextures().map(t => (t.getSize()||[]).join('x')))].join(' '));
const scene = root.listScenes()[0];
const s = getBounds(scene);
const sz = s.max.map((v, i) => v - s.min[i]);
console.log('bounds min', s.min.map(v => +v.toFixed(3)), 'max', s.max.map(v => +v.toFixed(3)), 'size', sz.map(v => +v.toFixed(3)));
const L = Math.max(sz[0], sz[2]); const cx = (s.min[0] + s.max[0]) / 2, cz = (s.min[2] + s.max[2]) / 2, y0 = s.min[1];
let tris = 0;
for (const n of root.listNodes()) if (n.getMesh()) {
  const b = getBounds(n);
  let t = 0; for (const p of n.getMesh().listPrimitives()) t += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  tris += t;
  const mats = n.getMesh().listPrimitives().map(p => p.getMaterial()?.getName()).join('+');
  console.log(n.getName().slice(0, 44).padEnd(44), 'c', [(b.min[0] + b.max[0]) / 2 - cx, (b.min[1] + b.max[1]) / 2 - y0, (b.min[2] + b.max[2]) / 2 - cz].map(v => (v / L).toFixed(3)).join(','),
    ' size', [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]].map(v => (v / L).toFixed(3)).join(','), ' tris', Math.round(t), ' mat', mats.slice(0, 30));
}
console.log('total tris', Math.round(tris), 'mesh nodes', root.listNodes().filter(n => n.getMesh()).length);
