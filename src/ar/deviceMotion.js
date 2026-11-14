import * as THREE from 'three';

/**
 * Phone orientation from the gyroscope/accelerometer (DeviceOrientationEvent).
 *
 * `quaternion` = camera→world rotation in a Y-up world (same convention as
 * three.js' former DeviceOrientationControls), so:
 *   - gravity in camera space = (0,-1,0) rotated by quaternion⁻¹
 *   - relative phone rotation since time t0 = q(t)⁻¹ · q(t0)
 *
 * iOS 13+ requires `requestPermission()` to be called inside a tap handler.
 */
const zee = new THREE.Vector3(0, 0, 1);
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90° around X
const euler = new THREE.Euler();
const q0 = new THREE.Quaternion();

export class DeviceMotion {
  constructor() {
    this.quaternion = new THREE.Quaternion();
    this.available = false;
    this.listening = false;
    this._onOrientation = (e) => this._update(e);
  }

  /** Call synchronously from a user gesture. Resolves to true if sensors can be used. */
  async requestPermission() {
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) return false;
    try {
      if (typeof DOE.requestPermission === 'function') {
        const res = await DOE.requestPermission();
        if (res !== 'granted') return false;
      }
    } catch {
      return false;
    }
    this.start();
    return true;
  }

  start() {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener('deviceorientation', this._onOrientation);
  }

  stop() {
    this.listening = false;
    this.available = false;
    window.removeEventListener('deviceorientation', this._onOrientation);
  }

  _update(e) {
    if (e.beta == null || e.gamma == null) return;
    const alpha = THREE.MathUtils.degToRad(e.alpha || 0);
    const beta = THREE.MathUtils.degToRad(e.beta);
    const gamma = THREE.MathUtils.degToRad(e.gamma);
    const orient = THREE.MathUtils.degToRad(screen.orientation?.angle ?? window.orientation ?? 0);
    euler.set(beta, alpha, -gamma, 'YXZ');
    this.quaternion.setFromEuler(euler).multiply(q1).multiply(q0.setFromAxisAngle(zee, -orient));
    this.available = true;
  }
}
