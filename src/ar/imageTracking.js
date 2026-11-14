/**
 * MindAR image tracking for a plain three.js scene.
 *
 * Why not MindAR's own `MindARThree`? Its prebuilt bundle imports
 * `sRGBEncoding`, which was removed in three.js r162, so it does not build with
 * current three.js. We use MindAR's tracking `Controller` directly (the actual
 * tracking engine — unchanged) and drive our own renderer/camera.
 *
 * The anchor/projection/resize maths below is adapted from MindAR
 * (src/image-target/three.js, MIT License, Copyright (c) 2020 hiukim).
 */
import * as THREE from 'three';
import { Controller } from 'mind-ar/dist/mindar-image.prod.js';
import { openRearCamera, stopStream, CameraError } from './camera.js';

export class ImageTracker {
  /**
   * @param {object} o
   * @param {HTMLElement} o.container  element the video fills (behind the WebGL canvas)
   * @param {string} o.targetUrl       .mind file
   * @param {THREE.PerspectiveCamera} o.camera  camera whose projection we drive
   * @param {THREE.Group} o.anchor     group that receives the target pose
   */
  constructor({ container, targetUrl, targetIndex = 0, camera, anchor, options = {}, onFound, onLost }) {
    this.container = container;
    this.targetUrl = targetUrl;
    this.targetIndex = targetIndex;
    this.camera = camera;
    this.anchor = anchor;
    this.options = options;
    this.onFound = onFound;
    this.onLost = onLost;
    this.visible = false;
    this.running = false;

    anchor.matrixAutoUpdate = false;
    anchor.visible = false;
    this._onResize = () => this.resize();
  }

  /** Opens the camera, loads the target, warms up the tracker. */
  async start(onStage = () => {}) {
    onStage('camera');
    this.stream = await openRearCamera();

    const video = document.createElement('video');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.muted = true;
    video.className = 'ar-video';
    video.srcObject = this.stream;
    this.container.appendChild(video);
    this.video = video;

    await new Promise((resolve, reject) => {
      if (video.readyState >= 1) return resolve();
      video.addEventListener('loadedmetadata', resolve, { once: true });
      video.addEventListener('error', () => reject(new CameraError('video', 'Camera error', 'The camera stream could not be played.')), { once: true });
    });
    await video.play().catch(() => {});
    this._syncVideoAttributes();

    onStage('target');
    const buffer = await this._fetchTarget();

    this.controller = new Controller({
      inputWidth: video.videoWidth,
      inputHeight: video.videoHeight,
      maxTrack: 1,
      filterMinCF: this.options.filterMinCF ?? null,
      filterBeta: this.options.filterBeta ?? null,
      warmupTolerance: this.options.warmupTolerance ?? null,
      missTolerance: this.options.missTolerance ?? null,
      onUpdate: (data) => this._onUpdate(data),
    });

    const { dimensions } = this.controller.addImageTargetsFromBuffer(buffer);
    if (!dimensions?.[this.targetIndex]) {
      throw new CameraError('target', 'Target not found', `targets.mind has no target #${this.targetIndex}.`);
    }

    // Anchor convention: origin = centre of the image, 1 unit = image width,
    // +X right, +Y up the page, +Z out of the page.
    const [w, h] = dimensions[this.targetIndex];
    this.postMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(w / 2, w / 2 + (h - w) / 2, 0),
      new THREE.Quaternion(),
      new THREE.Vector3(w, w, w)
    );
    this.aspect = h / w;

    this.resize();
    window.addEventListener('resize', this._onResize);

    onStage('warmup');
    await this.controller.dummyRun(video);
    this.resume();
  }

  async _fetchTarget() {
    let res;
    try {
      res = await fetch(this.targetUrl);
    } catch {
      throw new CameraError('target', 'Could not load target', 'Network error while downloading the image target.');
    }
    const type = res.headers.get('content-type') || '';
    if (!res.ok || type.includes('text/html')) {
      throw new CameraError(
        'target',
        'Image target missing',
        `No compiled target at ${this.targetUrl}. Run "npm run compile-target" (see README).`
      );
    }
    return res.arrayBuffer();
  }

  _onUpdate(data) {
    if (data.type !== 'updateMatrix' || data.targetIndex !== this.targetIndex) return;
    const { worldMatrix } = data;
    if (worldMatrix) {
      const m = new THREE.Matrix4();
      m.elements = [...worldMatrix];
      m.multiply(this.postMatrix);
      this.anchor.matrix.copy(m);
      this.anchor.matrixWorldNeedsUpdate = true;
    }
    const nowVisible = !!worldMatrix;
    this.anchor.visible = nowVisible;
    if (nowVisible !== this.visible) {
      this.visible = nowVisible;
      (nowVisible ? this.onFound : this.onLost)?.();
    }
  }

  /** Stop analysing frames but keep the camera stream (fast resume). */
  pause() {
    if (!this.running) return;
    this.controller?.stopProcessVideo();
    this.running = false;
    if (this.visible) {
      this.visible = false;
      this.onLost?.();
    }
    this.anchor.visible = false;
  }

  resume() {
    if (this.running || !this.controller) return;
    this.running = true;
    this.controller.processVideo(this.video);
  }

  /** Release camera + tracker completely. */
  stop() {
    window.removeEventListener('resize', this._onResize);
    try {
      this.controller?.dispose();
    } catch (e) {
      console.warn('MindAR dispose failed', e);
    }
    this.controller = null;
    this.running = false;
    stopStream(this.stream);
    this.stream = null;
    this.video?.remove();
    this.video = null;
    this.anchor.visible = false;
    this.visible = false;
  }

  /**
   * IMPORTANT: MindAR's input loader draws frames with `video.width/height`,
   * i.e. the HTML attributes, which are 0 unless set explicitly. Without this
   * the tracker silently receives empty frames and never detects anything.
   */
  _syncVideoAttributes() {
    const v = this.video;
    if (!v) return;
    v.setAttribute('width', v.videoWidth);
    v.setAttribute('height', v.videoHeight);
  }

  /** Fit video (object-fit: cover) and match the camera FOV to it. */
  resize() {
    const { video, container, controller, camera } = this;
    if (!video || !controller) return;
    this._syncVideoAttributes();
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    const videoRatio = video.videoWidth / video.videoHeight;
    const containerRatio = cw / ch;
    let vw, vh;
    if (videoRatio > containerRatio) {
      vh = ch;
      vw = vh * videoRatio;
    } else {
      vw = cw;
      vh = vw / videoRatio;
    }

    const proj = controller.getProjectionMatrix();
    const inputRatio = controller.inputWidth / controller.inputHeight;
    let videoDisplayHeight;
    if (inputRatio > containerRatio) {
      videoDisplayHeight = ch * (video.videoWidth / controller.inputWidth);
    } else {
      videoDisplayHeight = (cw / controller.inputWidth) * controller.inputHeight * (video.videoHeight / controller.inputHeight);
    }
    const fovAdjust = ch / videoDisplayHeight;

    camera.fov = (2 * Math.atan((1 / proj[5]) * fovAdjust) * 180) / Math.PI;
    camera.near = proj[14] / (proj[10] - 1.0);
    camera.far = proj[14] / (proj[10] + 1.0);
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();

    Object.assign(video.style, {
      top: `${-(vh - ch) / 2}px`,
      left: `${-(vw - cw) / 2}px`,
      width: `${vw}px`,
      height: `${vh}px`,
    });
  }
}
