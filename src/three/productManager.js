import { loadModel } from './modelLoader.js';
import { HotspotManager } from './hotspotManager.js';
import { ExplodedView } from './explodedView.js';
import { getProduct } from '../products/index.js';
import { asset } from '../products/shared.js';
import { DEBUG } from '../config.js';

/**
 * Loads products on demand (each model is downloaded once and cached) and makes
 * one of them "active": shown on the stage with its own hotspots and exploded view.
 */
export class ProductManager {
  constructor({ stage, markersLayer }) {
    this.stage = stage;
    this.layer = markersLayer;
    this.cache = new Map(); // id -> Promise<{ root, info }>
    this.product = null;
    this.hotspots = null;
    this.explode = null;
    this.hotspotsVisible = true;
    this._token = 0;
  }

  /** Start (or reuse) the download of a product's model. */
  load(id, onProgress) {
    if (!this.cache.has(id)) {
      const p = getProduct(id);
      const promise = loadModel(asset(p.model.file), { rotationY: p.model.rotationY, hide: p.model.hide, onProgress }).then((res) => {
        if (DEBUG) console.info(`[model:${id}]`, res.info);
        return res;
      });
      promise.catch(() => this.cache.delete(id)); // allow retry after a failure
      this.cache.set(id, promise);
    }
    return this.cache.get(id);
  }

  /** Show product `id`. Resolves to the product, or null if another activate() superseded it. */
  async activate(id, { onProgress } = {}) {
    if (this.product?.id === id) return this.product;
    const token = ++this._token;
    const p = getProduct(id);
    if (!p) throw new Error(`Unknown product "${id}"`);
    const { root } = await this.load(id, onProgress);
    if (token !== this._token) return null;

    if (this.hotspots) this.hotspotsVisible = this.hotspots.visible;
    this.hotspots?.dispose();
    this.explode?.dispose();

    root.position.set(0, 0, 0);
    this.stage.setProduct(root);
    this.explode = new ExplodedView({ stage: this.stage, carRoot: root, groups: p.exploded || [] });
    this.hotspots = new HotspotManager({ stage: this.stage, carRoot: root, hotspots: p.hotspots || [], layer: this.layer, explode: this.explode });
    this.hotspots.setVisible(this.hotspotsVisible);
    this.product = p;
    return p;
  }
}
