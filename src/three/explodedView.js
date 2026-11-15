import * as THREE from 'three';
import { findMeshes } from './modelLoader.js';

const ZERO = new THREE.Vector3();

/**
 * Exploded view: animates real, separately named meshes apart.
 * Offsets are authored in normalised model space (car-root space) and
 * converted into each mesh's parent space, so nested/scaled glTF nodes work.
 */
export class ExplodedView {
  constructor({ stage, carRoot, groups }) {
    this.carRoot = carRoot;
    this.t = 0; // 0 = assembled, 1 = exploded
    this.target = 0;
    this.entries = new Map(); // mesh -> { basePos, localOffset, rootOffset }
    this.unmatched = [];

    carRoot.updateMatrixWorld(true);
    const rootInv = new THREE.Matrix4().copy(carRoot.matrixWorld).invert();
    const center = new THREE.Vector3();

    for (const g of groups) {
      const meshes = findMeshes(carRoot, g.meshes);
      if (!meshes.length) this.unmatched.push(g.label);
      for (const mesh of meshes) {
        if (this.entries.has(mesh)) continue;
        const rootOffset = new THREE.Vector3().fromArray(g.offset);
        if (g.mirrorX) {
          new THREE.Box3().setFromObject(mesh).getCenter(center).applyMatrix4(rootInv);
          rootOffset.x *= Math.sign(center.x) || 1;
        }
        // parent-relative-to-root matrix → convert a root-space displacement to parent space
        const parentRel = new THREE.Matrix4().multiplyMatrices(rootInv, mesh.parent.matrixWorld);
        const inv3 = new THREE.Matrix3().setFromMatrix4(parentRel.clone().invert());
        const localOffset = rootOffset.clone().applyMatrix3(inv3);
        this.entries.set(mesh, { basePos: mesh.position.clone(), localOffset, rootOffset });
      }
    }
    if (this.unmatched.length) console.warn('[exploded view] no meshes for:', this.unmatched.join(', '));

    this._off = stage.onFrame((dt) => this.update(dt));
  }

  /** Put every part back and stop animating (called when switching product). */
  dispose() {
    this._off?.();
    for (const [mesh, { basePos }] of this.entries) mesh.position.copy(basePos);
    this.t = this.target = 0;
  }

  get available() {
    return this.entries.size > 0;
  }

  get active() {
    return this.target === 1;
  }

  toggle(force) {
    this.target = (force ?? !this.active) ? 1 : 0;
    return this.active;
  }

  update(dt) {
    if (this.t === this.target) return;
    const speed = 1.6;
    this.t = this.target > this.t ? Math.min(1, this.t + dt * speed) : Math.max(0, this.t - dt * speed);
    const e = easeInOut(this.t);
    for (const [mesh, { basePos, localOffset }] of this.entries) {
      mesh.position.copy(basePos).addScaledVector(localOffset, e);
    }
  }

  /** Current root-space displacement of a mesh (used by hotspot markers). */
  currentOffset(mesh) {
    const entry = this.entries.get(mesh);
    if (!entry || this.t === 0) return ZERO;
    return entry.rootOffset.clone().multiplyScalar(easeInOut(this.t));
  }
}

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
