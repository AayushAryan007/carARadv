import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CONFIG } from '../config.js';

const DEG = Math.PI / 180;

/**
 * One renderer + one scene shared by the AR view and the full 3D viewer.
 * The car lives in `carPivot` (user rotation/zoom), which is re-parented:
 *   AR:     scene › arAnchor (MindAR pose) › arPlacement (config) › carPivot
 *   Viewer: scene › carPivot
 */
export class Stage {
  constructor(container) {
    this.container = container;
    this.mode = 'idle';
    this.frameCallbacks = new Set();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.domElement.className = 'stage-canvas';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene = scene;

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 4, 3);
    scene.add(key, new THREE.HemisphereLight(0xdfefff, 0x202326, 0.6));

    this.viewerCamera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
    this.arCamera = new THREE.PerspectiveCamera();
    this.camera = this.viewerCamera;

    // AR hierarchy
    this.arAnchor = new THREE.Group();
    this.arAnchor.name = 'ar-anchor';
    this.arAnchor.matrixAutoUpdate = false; // pose is written by ArPoseManager
    this.arAnchor.visible = false;
    this.arPlacement = new THREE.Group();
    this.arPlacement.name = 'ar-placement';
    this.arAnchor.add(this.arPlacement);
    scene.add(this.arAnchor);
    this.applyArPlacement();

    // Car pivot — user rotation & scale live here
    this.carPivot = new THREE.Group();
    this.carPivot.name = 'car-pivot';
    this.carPivot.add(makeContactShadow());

    this.clock = new THREE.Clock();
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  applyArPlacement() {
    const { scale, position, heading } = CONFIG.ar;
    const p = this.arPlacement;
    p.position.fromArray(position);
    // Car Y-up → page normal (+Z); then spin around the page normal.
    p.rotation.set(0, 0, 0);
    p.rotateZ(heading * DEG);
    p.rotateX(Math.PI / 2);
    p.rotateY(Math.PI / 2); // nose (+Z model) → +X page when heading = 0
    p.scale.setScalar(scale);
  }

  setCar(root) {
    this.car = root;
    this.carPivot.add(root);
  }

  setMode(mode) {
    this.mode = mode;
    this.carPivot.removeFromParent();
    if (mode === 'ar') {
      this.arPlacement.add(this.carPivot);
      this.camera = this.arCamera;
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, CONFIG.ar.maxPixelRatio));
    } else if (mode === 'viewer') {
      this.scene.add(this.carPivot);
      this.camera = this.viewerCamera;
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, CONFIG.viewer.maxPixelRatio));
    }
    this.resize();
    if (mode === 'idle') this.renderer.setAnimationLoop(null);
    else this.renderer.setAnimationLoop(() => this._frame());
  }

  /** Is the car currently on screen? (AR: only while the target is tracked) */
  get carVisible() {
    return this.mode === 'viewer' || (this.mode === 'ar' && this.arAnchor.visible);
  }

  onFrame(fn) {
    this.frameCallbacks.add(fn);
    return () => this.frameCallbacks.delete(fn);
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    for (const fn of this.frameCallbacks) fn(dt);
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.viewerCamera.aspect = w / h;
    // Narrow (portrait) screens need a wider FOV to fit the car's length.
    this.viewerCamera.fov = w / h < 0.8 ? 50 : 35;
    this.viewerCamera.updateProjectionMatrix();
  }

  get size() {
    return { width: this.renderer.domElement.clientWidth, height: this.renderer.domElement.clientHeight };
  }
}

/** Soft radial "contact shadow" under the car so it feels grounded on paper. */
function makeContactShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 1.2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.002;
  mesh.renderOrder = -1;
  mesh.name = 'contact-shadow';
  mesh.userData.ignoreRaycast = true;
  return mesh;
}
