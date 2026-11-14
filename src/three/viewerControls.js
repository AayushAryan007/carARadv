import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from '../config.js';

const HOME_TARGET = new THREE.Vector3(0, 0.1, 0);
const HOME_DIR = new THREE.Vector3(1.05, 0.55, 1.25).normalize();
const HOME_DIST = 1.55;

/**
 * Full-screen 3D viewer: OrbitControls (one finger rotate, pinch zoom,
 * two-finger pan) + programmatic zoom / reset / focus with smooth tweens.
 */
export class ViewerControls {
  constructor(stage) {
    this.stage = stage;
    const cam = stage.viewerCamera;
    const c = new OrbitControls(cam, stage.renderer.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minDistance = 0.45;
    c.maxDistance = 3.2;
    c.maxPolarAngle = Math.PI * 0.495;
    c.rotateSpeed = 0.8;
    c.autoRotate = CONFIG.viewer.autoRotate;
    c.autoRotateSpeed = 0.8;
    c.enabled = false;
    this.controls = c;
    this.tween = null;
    this.reset(true);

    stage.onFrame((dt) => {
      if (stage.mode !== 'viewer') return;
      if (this.tween) this._stepTween(dt);
      c.update();
    });
    c.addEventListener('start', () => (this.tween = null));
  }

  setEnabled(v) {
    this.controls.enabled = v;
  }

  zoom(factor) {
    const c = this.controls;
    const cam = this.stage.viewerCamera;
    const offset = cam.position.clone().sub(c.target);
    const d = THREE.MathUtils.clamp(offset.length() * factor, c.minDistance, c.maxDistance);
    this._animateTo(c.target.clone(), c.target.clone().add(offset.setLength(d)));
  }

  reset(instant = false) {
    const pos = HOME_TARGET.clone().addScaledVector(HOME_DIR, HOME_DIST);
    if (instant) {
      this.stage.viewerCamera.position.copy(pos);
      this.controls.target.copy(HOME_TARGET);
      this.controls.update();
    } else {
      this._animateTo(HOME_TARGET.clone(), pos);
    }
  }

  /** Swing the camera to look at a world point from its current direction. */
  focus(point, { distance = 0.75, view = null } = {}) {
    let dir;
    if (view) {
      dir = new THREE.Vector3().fromArray(view);
    } else {
      // Look from outside the car toward the part, slightly above.
      dir = new THREE.Vector3(point.x, 0, point.z);
      if (Math.abs(point.x) < 0.1) dir.x = 0.6; // centre-line parts: view from a front/rear ¾ angle
      dir.normalize().add(new THREE.Vector3(0, 0.55, 0));
    }
    dir.normalize();
    this._animateTo(point.clone(), point.clone().addScaledVector(dir, distance));
  }

  /** Jump instantly to a target/position (arrays or Vector3). */
  setView(target, position) {
    this.tween = null;
    this.controls.target.fromArray(target);
    this.stage.viewerCamera.position.fromArray(position);
    this.controls.update();
  }

  setAutoRotate(v) {
    this.controls.autoRotate = v;
  }

  _animateTo(target, position) {
    const cam = this.stage.viewerCamera;
    this.tween = {
      t: 0,
      fromT: this.controls.target.clone(),
      fromP: cam.position.clone(),
      toT: target,
      toP: position,
    };
  }

  _stepTween(dt) {
    const tw = this.tween;
    tw.t = Math.min(1, tw.t + dt / 0.7);
    const e = 1 - (1 - tw.t) ** 3;
    this.controls.target.lerpVectors(tw.fromT, tw.toT, e);
    this.stage.viewerCamera.position.lerpVectors(tw.fromP, tw.toP, e);
    if (tw.t >= 1) this.tween = null;
  }
}

/**
 * AR gestures. Rotation/zoom are applied to the car pivot INSIDE the tracked
 * anchor, so the car stays locked to the advert — tracking is never affected.
 *  - one-finger horizontal drag → spin car
 *  - pinch → scale car
 */
export class ArGestures {
  constructor(stage, element) {
    this.stage = stage;
    this.pivot = stage.carPivot;
    this.enabled = false;
    this.pointers = new Map();
    this.minScale = 0.4;
    this.maxScale = 2.5;
    this.targetRotation = 0;
    this.targetScale = 1;

    element.addEventListener('pointerdown', (e) => this._down(e));
    element.addEventListener('pointermove', (e) => this._move(e));
    element.addEventListener('pointerup', (e) => this._up(e));
    element.addEventListener('pointercancel', (e) => this._up(e));

    stage.onFrame(() => {
      const p = this.pivot;
      p.rotation.y += (this.targetRotation - p.rotation.y) * 0.2;
      const s = p.scale.x + (this.targetScale - p.scale.x) * 0.2;
      p.scale.setScalar(s);
    });
  }

  rotateBy(rad) {
    this.targetRotation += rad;
  }

  zoomBy(factor) {
    this.targetScale = THREE.MathUtils.clamp(this.targetScale * factor, this.minScale, this.maxScale);
  }

  resetOrientation() {
    // Take the shortest way back to 0.
    const p = this.pivot;
    p.rotation.y = Math.atan2(Math.sin(p.rotation.y), Math.cos(p.rotation.y));
    this.targetRotation = 0;
  }

  resetScale() {
    this.targetScale = 1;
  }

  _down(e) {
    if (!this.enabled) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  _move(e) {
    if (!this.enabled || !this.pointers.has(e.pointerId)) return;
    const prev = this.pointers.get(e.pointerId);
    const cur = { x: e.clientX, y: e.clientY };
    if (this.pointers.size === 1) {
      this.targetRotation += (cur.x - prev.x) * 0.012;
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.entries()].map(([id, p]) => (id === e.pointerId ? cur : p));
      const [pa, pb] = [...this.pointers.values()];
      const before = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      const after = Math.hypot(a.x - b.x, a.y - b.y);
      if (before > 10) this.zoomBy(after / before);
    }
    this.pointers.set(e.pointerId, cur);
  }

  _up(e) {
    this.pointers.delete(e.pointerId);
  }
}
