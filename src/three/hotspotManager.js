import * as THREE from 'three';
import { findMeshes } from './modelLoader.js';
import { CONFIG, DEBUG } from '../config.js';

const HIGHLIGHT = new THREE.Color(0x19e6c1);

/**
 * Hotspots = DOM markers (crisp, styleable) positioned every frame by projecting
 * a 3D anchor point. Markers have pointer-events: none — taps are hit-tested
 * in `pick()` so a drag that starts on a marker still rotates the car.
 *
 * Selection paths:
 *  - marker tap          → hotspot (works for both kinds)
 *  - raycast on geometry → hotspot ONLY if the hit mesh is linked to one
 *                          (real mesh selection; visual-only hotspots can't be hit this way)
 */
export class HotspotManager {
  constructor({ stage, carRoot, hotspots, layer, explode }) {
    this.stage = stage;
    this.carRoot = carRoot;
    this.layer = layer;
    this.explode = explode;
    this.visible = true;
    this.selectedId = null;
    this.raycaster = new THREE.Raycaster();
    this.meshToHotspot = new Map();
    this.highlightMats = new Map();
    this.time = 0;

    // Product centre (root space) — used to decide whether a marker faces the camera.
    carRoot.updateMatrixWorld(true);
    const rootInv = carRoot.matrixWorld.clone().invert();
    const rootBox = new THREE.Box3();
    carRoot.traverse((o) => o.isMesh && !o.userData.ignoreRaycast && rootBox.expandByObject(o));
    this.center = rootBox.applyMatrix4(rootInv).getCenter(new THREE.Vector3());

    this.items = hotspots.map((h, i) => {
      const meshes = findMeshes(carRoot, h.meshes);
      // position omitted → centre of the linked meshes (+ optional nudge), all in root space
      let position = h.position;
      if (!position && meshes.length) {
        const b = new THREE.Box3();
        meshes.forEach((m) => b.expandByObject(m));
        position = b.applyMatrix4(rootInv).getCenter(new THREE.Vector3()).toArray();
      }
      position = (position || this.center.toArray()).map((v, k) => v + (h.nudge?.[k] || 0));
      if (h.meshes.length && !meshes.length) {
        console.warn(`[hotspots] "${h.id}": no meshes matched`, h.meshes, '— falling back to visual-only.');
      }
      const linked = meshes.length > 0;
      meshes.forEach((m) => this.meshToHotspot.set(m, h.id));

      const anchor = new THREE.Object3D();
      anchor.position.fromArray(position);
      carRoot.add(anchor);

      let zone = null;
      if (!linked) {
        zone = new THREE.Mesh(
          new THREE.SphereGeometry(h.radius ?? 0.06, 24, 16),
          new THREE.MeshBasicMaterial({ color: HIGHLIGHT, transparent: true, opacity: 0.22, depthTest: false, depthWrite: false, toneMapped: false })
        );
        zone.renderOrder = 10;
        zone.visible = false;
        zone.userData.ignoreRaycast = true;
        anchor.add(zone);
      }

      const el = document.createElement('div');
      el.className = `hotspot ${linked ? 'is-linked' : 'is-visual'}`;
      el.innerHTML = `<span class="hotspot-dot">${i + 1}</span><span class="hotspot-label">${h.name}</span>`;
      el.setAttribute('aria-hidden', 'true');
      layer.appendChild(el);

      return { ...h, linked, meshes, anchor, zone, el, position, base: new THREE.Vector3().fromArray(position), screen: { x: 0, y: 0, on: false } };
    });

    this._v = new THREE.Vector3();
    this._n = new THREE.Vector3();
    this._toCam = new THREE.Vector3();
    this._off = stage.onFrame((dt) => this.update(dt));
  }

  /** Remove markers, helpers and highlights (called when switching product). */
  dispose() {
    this._off?.();
    this.clear();
    for (const h of this.items) {
      h.el.remove();
      h.anchor.removeFromParent();
      h.zone?.geometry.dispose();
      h.zone?.material.dispose();
    }
    for (const m of this.highlightMats.values()) m.dispose();
    this.items = [];
  }

  get(id) {
    return this.items.find((h) => h.id === id);
  }

  setVisible(v) {
    this.visible = v;
    this.layer.classList.toggle('is-hidden', !v);
  }

  update(dt) {
    this.time += dt;
    const { stage } = this;
    const show = stage.carVisible && this.visible;
    this.layer.style.display = stage.carVisible ? '' : 'none';
    if (!stage.carVisible) return;

    const { width, height } = stage.size;
    const cam = stage.camera;
    this.carRoot.updateMatrixWorld();
    const camPos = cam.getWorldPosition(this._toCam.clone());

    for (const h of this.items) {
      // Follow exploded-view movement of the component's first mesh.
      h.anchor.position.copy(h.base);
      if (h.linked && this.explode) h.anchor.position.add(this.explode.currentOffset(h.meshes[0]));

      h.anchor.getWorldPosition(this._v);
      // Facing test: the part's outward direction (hotspot `normal`, else away from the product centre), in world space.
      if (h.normal) this._n.fromArray(h.normal);
      else this._n.copy(h.anchor.position).sub(this.center);
      this._n.normalize().transformDirection(this.carRoot.matrixWorld);
      const facing = this._n.dot(this._toCam.copy(camPos).sub(this._v).normalize());

      this._v.project(cam);
      const on = this._v.z < 1 && Math.abs(this._v.x) < 1.2 && Math.abs(this._v.y) < 1.2;
      h.screen.x = (this._v.x * 0.5 + 0.5) * width;
      h.screen.y = (-this._v.y * 0.5 + 0.5) * height;
      h.screen.on = on && show;
      h.screen.behind = facing < -0.15 && h.id !== this.selectedId;
      h.el.style.transform = `translate3d(${h.screen.x}px, ${h.screen.y}px, 0)`;
      h.el.classList.toggle('is-off', !on);
      h.el.classList.toggle('is-behind', h.screen.behind);
      h.el.classList.toggle('is-active', h.id === this.selectedId);
    }

    // Pulse highlight
    const pulse = 0.55 + 0.45 * Math.sin(this.time * 4);
    for (const m of this.highlightMats.values()) m.emissiveIntensity = 0.35 + 0.5 * pulse;
    const sel = this.get(this.selectedId);
    if (sel?.zone) sel.zone.material.opacity = 0.12 + 0.18 * pulse;
  }

  /**
   * Resolve a tap at canvas coords. Returns { hotspot, via: 'marker'|'mesh' } or
   * { hotspot: null, mesh } when geometry without a hotspot was hit.
   */
  pick(x, y) {
    if (!this.stage.carVisible) return null;

    if (this.visible) {
      let best = null;
      let bestD = CONFIG.tap.markerHitRadiusPx;
      for (const h of this.items) {
        if (!h.screen.on || h.screen.behind) continue; // dimmed markers behind the car aren't tappable
        const d = Math.hypot(h.screen.x - x, h.screen.y - y);
        if (d < bestD) {
          bestD = d;
          best = h;
        }
      }
      if (best) return { hotspot: best, via: 'marker' };
    }

    const { width, height } = this.stage.size;
    const ndc = new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.stage.camera);
    const hits = this.raycaster.intersectObject(this.carRoot, true);
    for (const hit of hits) {
      const o = hit.object;
      if (!o.isMesh || o.userData.ignoreRaycast || !o.visible) continue;
      const id = this.meshToHotspot.get(o);
      // See-through glass that isn't a component should not block what's behind it.
      if (!id && o.material?.transparent && o.material.opacity < 0.5) continue;
      if (DEBUG) {
        const p = this.carRoot.worldToLocal(hit.point.clone());
        console.info(`[debug] mesh "${o.name}" at model-space [${p.toArray().map((v) => v.toFixed(3)).join(', ')}]`);
      }
      return id ? { hotspot: this.get(id), via: 'mesh' } : { hotspot: null, mesh: o };
    }
    return null;
  }

  select(id) {
    this.clearHighlight();
    this.selectedId = id;
    const h = this.get(id);
    if (!h) return null;
    if (h.linked) {
      for (const mesh of h.meshes) {
        mesh.userData.originalMaterial = mesh.material;
        mesh.material = this._highlightFor(mesh.material);
      }
    } else if (h.zone) {
      h.zone.visible = true;
    }
    return h;
  }

  clear() {
    this.clearHighlight();
    this.selectedId = null;
  }

  clearHighlight() {
    const h = this.get(this.selectedId);
    if (!h) return;
    for (const mesh of h.meshes) {
      if (mesh.userData.originalMaterial) mesh.material = mesh.userData.originalMaterial;
      delete mesh.userData.originalMaterial;
    }
    if (h.zone) h.zone.visible = false;
  }

  _highlightFor(material) {
    if (Array.isArray(material)) return material.map((m) => this._highlightFor(m));
    let hm = this.highlightMats.get(material);
    if (!hm) {
      hm = material.clone();
      if ('emissive' in hm) {
        hm.emissive = HIGHLIGHT.clone();
        hm.emissiveMap = null;
      }
      if (hm.transparent) hm.opacity = Math.max(hm.opacity, 0.6);
      this.highlightMats.set(material, hm);
    }
    return hm;
  }

  /** World-space position of a hotspot (for camera focusing). */
  worldPosition(id, target = new THREE.Vector3()) {
    return this.get(id)?.anchor.getWorldPosition(target);
  }
}
