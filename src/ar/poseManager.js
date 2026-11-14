import * as THREE from 'three';
import { CONFIG } from '../config.js';

const DEG = Math.PI / 180;
const PAGE_NORMAL = new THREE.Vector3(0, 0, 1);

/**
 * Turns raw image-tracking poses into a stable, natural-looking AR placement.
 *
 * 1. GRAVITY-ALIGNED PLACEMENT
 *    The car's "up" follows real-world gravity (from the phone's motion
 *    sensors), not the page normal. Advert flat on a table → car sits on the
 *    page. Advert on a wall / laptop screen → car stands upright in front of it
 *    instead of sticking out sideways. Without sensors it falls back to the
 *    page normal.
 *
 * 2. MOTION-SENSOR HOLD (extended tracking)
 *    Image tracking drops at steep angles or when the advert leaves the frame.
 *    Instead of the car vanishing, we keep it where it was and counter-rotate it
 *    with the gyroscope (3-DoF: rotation only). As soon as the camera sees the
 *    advert again, it snaps back to precise image tracking.
 *
 * States: 'tracking' (image locked) · 'motion' (held by sensors) · 'lost'
 */
export class ArPoseManager {
  constructor({ stage, motion, onStateChange }) {
    this.stage = stage;
    this.motion = motion;
    this.onStateChange = onStateChange;
    this.state = 'lost';
    this.enabled = false;
    this.targetIndex = 0;

    this.tracked = null; // Matrix4 from the tracker (camera space), or null
    this.lastPose = new THREE.Matrix4();
    this.lastQuat = new THREE.Quaternion();
    this.hasLast = false;
    this.lostAt = 0;

    this.up = PAGE_NORMAL.clone(); // smoothed up vector in page space
    this.placementQ = new THREE.Quaternion();
    this.placementP = new THREE.Vector3();
    this.placementInit = false;

    // scratch
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();

    stage.onFrame(() => this.update());
  }

  /**
   * Called by the image tracker with the latest pose of target `index`
   * (null = that target is not detected; index -1 = tracker paused/stopped).
   */
  setTrackedPose(matrix, index = 0) {
    if (matrix) {
      if (index !== this.targetIndex) {
        this.targetIndex = index;
        this.placementInit = false; // different image → different size/placement, don't blend
      }
      this.tracked = (this.tracked || new THREE.Matrix4()).copy(matrix);
    } else if (index === this.targetIndex || index === -1) {
      this.tracked = null;
    }
  }

  /** Placement settings for the target currently in use (per-target overrides on top of CONFIG.ar). */
  get placement() {
    return { ...CONFIG.ar, ...(CONFIG.target.targets[this.targetIndex] || {}) };
  }

  get targetLabel() {
    return CONFIG.target.targets[this.targetIndex]?.label || 'Target';
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) {
      this.tracked = null;
      this.hasLast = false;
      this.state = 'lost'; // silent: leaving AR is not "losing" the target
      this.stage.arAnchor.visible = false;
    }
  }

  /** Forget the held pose (e.g. user pressed reset). */
  reset() {
    this.hasLast = false;
    this.placementInit = false;
  }

  update() {
    if (!this.enabled) return;
    const anchor = this.stage.arAnchor;
    const motionOk = this.motion.available && CONFIG.ar.motionHold;

    if (this.tracked) {
      anchor.matrix.copy(this.tracked);
      this.lastPose.copy(this.tracked);
      if (this.motion.available) this.lastQuat.copy(this.motion.quaternion);
      this.hasLast = true;
      anchor.visible = true;
      this._setState('tracking');
    } else if (motionOk && this.hasLast && performance.now() - this.lostAt < CONFIG.ar.motionHoldMs) {
      // Camera-space pose after the phone rotated: R(t)⁻¹ · R(t0) · pose(t0)
      this._q.copy(this.motion.quaternion).invert().multiply(this.lastQuat);
      anchor.matrix.makeRotationFromQuaternion(this._q).multiply(this.lastPose);
      anchor.visible = true;
      this._setState('motion');
    } else {
      anchor.visible = false;
      this._setState('lost');
    }
    anchor.matrixWorldNeedsUpdate = true;

    if (anchor.visible) this._updatePlacement(anchor.matrix);
  }

  _setState(s) {
    if (s === this.state) return;
    if (s !== 'tracking' && this.state === 'tracking') this.lostAt = performance.now();
    const prev = this.state;
    this.state = s;
    this.onStateChange?.(s, prev);
  }

  /** Orient the car so its up = real-world up, expressed in page (anchor) space. */
  _updatePlacement(anchorMatrix) {
    const cfg = this.placement;
    const targetUp = this._v.copy(PAGE_NORMAL);

    if (this.motion.available && cfg.gravityAlign) {
      // gravity in camera space → page space
      const gCam = this._p.set(0, -1, 0).applyQuaternion(this._q.copy(this.motion.quaternion).invert());
      anchorMatrix.decompose(this._s, this._q, new THREE.Vector3());
      const gPage = gCam.applyQuaternion(this._q.invert());
      targetUp.copy(gPage).negate().normalize();
      // Page facing the ground (ceiling) or sensor glitch → fall back to page normal
      if (targetUp.dot(PAGE_NORMAL) < -0.1) targetUp.copy(PAGE_NORMAL);
    }

    // Smooth the up vector so hand shake doesn't wobble the car
    if (!this.placementInit) this.up.copy(targetUp);
    else this.up.lerp(targetUp, 0.08).normalize();
    const up = this.up;

    // How vertical is the page? 0 = flat (table), 1 = vertical (wall/screen)
    const vertical = THREE.MathUtils.clamp(1 - Math.abs(up.dot(PAGE_NORMAL)), 0, 1);

    // Nose direction: configured heading in the page plane, made perpendicular to up,
    // plus a ¾ turn toward the viewer when the page is upright.
    const h = cfg.heading * DEG;
    const fwd = new THREE.Vector3(Math.cos(h), Math.sin(h), 0);
    fwd.addScaledVector(up, -fwd.dot(up));
    if (fwd.lengthSq() < 0.04) fwd.set(0, 1, 0).addScaledVector(up, -up.y);
    fwd.normalize().applyAxisAngle(up, cfg.uprightYaw * DEG * vertical);
    const side = new THREE.Vector3().crossVectors(up, fwd).normalize();

    // Basis: car X = side, car Y = up, car Z = nose
    this._m.makeBasis(side, up, fwd);
    const targetQ = this._q.setFromRotationMatrix(this._m);

    // Position: configured page offset; when upright, move the car out of the
    // page (so it doesn't cut through it) and down toward the page's lower part.
    const targetP = this._p.fromArray(cfg.position);
    const upInPage = new THREE.Vector3().copy(up).addScaledVector(PAGE_NORMAL, -up.dot(PAGE_NORMAL));
    targetP.addScaledVector(PAGE_NORMAL, vertical * 0.3 * cfg.scale);
    targetP.addScaledVector(upInPage, -vertical * cfg.uprightDrop);

    if (!this.placementInit) {
      this.placementQ.copy(targetQ);
      this.placementP.copy(targetP);
      this.placementInit = true;
    } else {
      this.placementQ.slerp(targetQ, 0.12);
      this.placementP.lerp(targetP, 0.12);
    }
    const p = this.stage.arPlacement;
    p.quaternion.copy(this.placementQ);
    p.position.copy(this.placementP);
    p.scale.setScalar(cfg.scale);
  }
}
