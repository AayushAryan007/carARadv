import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/**
 * Normalise a mesh name / pattern so config is forgiving:
 * "CarBody 2_Interior_0" (glTF) and "CarBody_2_Interior_0" (three.js-sanitised)
 * both become "carbody2interior0". "*" is kept as a wildcard.
 */
export function normalizeName(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9*]/g, '');
}

function patternToRegex(pattern) {
  const n = normalizeName(pattern).replace(/\*/g, '.*');
  return new RegExp(`^${n}$`);
}

/** Return every Mesh under `root` whose name matches any pattern. */
export function findMeshes(root, patterns = []) {
  if (!patterns.length) return [];
  const regs = patterns.map(patternToRegex);
  const out = [];
  root.traverse((o) => {
    if (o.isMesh && regs.some((r) => r.test(normalizeName(o.name)))) out.push(o);
  });
  return out;
}

/**
 * Load a GLB/GLTF, normalise it to: longest horizontal side = 1, centred on X/Z,
 * resting on y = 0. Returns { root, meshes, info }.
 *
 * `root` is a Group whose children are the original glTF scene — never
 * transform the inner scene, transform `root` (or a parent of it).
 */
export async function loadModel(url, { rotationY = 0, hide = [], onProgress } = {}) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  const gltf = await loader.loadAsync(url, (e) => {
    if (onProgress && e.total) onProgress(e.loaded / e.total);
  });

  const scene = gltf.scene;
  scene.rotation.y = rotationY;
  // Remove parts the product config hides (e.g. a display stand), BEFORE measuring.
  for (const m of findMeshes(scene, hide)) m.removeFromParent();
  scene.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const length = Math.max(size.x, size.z) || 1;
  const s = 1 / length;

  // Wrap so normalisation is a single, inspectable transform.
  const normalizer = new THREE.Group();
  normalizer.name = 'normalizer';
  normalizer.scale.setScalar(s);
  normalizer.position.set(
    -((box.min.x + box.max.x) / 2) * s,
    -box.min.y * s,
    -((box.min.z + box.max.z) / 2) * s
  );
  normalizer.add(scene);

  const root = new THREE.Group();
  root.name = 'car-root';
  root.add(normalizer);
  root.updateMatrixWorld(true);

  const meshes = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    o.frustumCulled = true;
    fixMaterial(o);
  });

  const info = {
    originalSize: size.toArray().map((v) => +v.toFixed(3)),
    meshCount: meshes.length,
    meshNames: meshes.map((m) => m.name),
    animations: gltf.animations.length,
  };
  return { root, meshes, info, animations: gltf.animations };
}

/**
 * Material fix-ups for mobile + AR:
 * - KHR_materials_transmission renders an extra full-scene pass and cannot
 *   "see" the camera video behind a transparent canvas (glass turns black in AR).
 *   Convert it to cheap alpha transparency.
 */
function fixMaterial(mesh) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of mats) {
    if (!m) continue;
    if (m.transmission > 0) {
      m.transmission = 0;
      m.transparent = true;
      m.opacity = Math.min(m.opacity, 0.35);
      m.depthWrite = false;
      m.roughness = Math.min(m.roughness ?? 0.1, 0.1);
    }
    if (m.map) m.map.anisotropy = 4;
  }
}
