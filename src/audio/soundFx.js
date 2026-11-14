/**
 * Futuristic UI sound design — synthesised live with the Web Audio API.
 * No audio files: nothing to download, license or cache, and it weighs ~0 KB.
 *
 * Browsers only allow audio after a user gesture, so call `sfx.unlock()` from a
 * click/tap handler (Start AR / Explore in 3D do this).
 *
 * Sounds
 *   ambient()   low evolving drone while the experience is open
 *   scanning()  sonar ping loop while looking for the advert
 *   lockOn()    rising chime when the advert is detected
 *   lost()      falling tone when tracking is lost
 *   select()    blip + shimmer when a component is opened
 *   close()     soft down-blip
 *   explode()/assemble()  filtered noise sweeps
 *   whoosh()    mode switch (AR ⇄ 3D)
 *   tick()      tiny UI click
 */
const STORAGE_KEY = 'autovision.muted';

class SoundFx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = readMuted();
    this._ambient = null;
    this._scanTimer = null;
    this._noise = null;
  }

  /** Create / resume the AudioContext. Must run inside a user gesture. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      // Gentle limiter so stacked sounds never clip
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master.connect(comp).connect(this.ctx.destination);
      this.reverb = this._makeReverb();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    try {
      localStorage.setItem(STORAGE_KEY, m ? '1' : '0');
    } catch {}
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /* ───────────── building blocks ───────────── */

  _tone({ type = 'sine', freq = 440, to = null, start = 0, dur = 0.2, gain = 0.2, attack = 0.005, reverb = 0.25, detune = 0 }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    this._route(g, reverb);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  _noiseSweep({ from = 400, to = 4000, dur = 0.6, gain = 0.15, q = 6, start = 0, reverb = 0.3 }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + start;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = q;
    bp.frequency.setValueAtTime(from, t);
    bp.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g);
    this._route(g, reverb);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  _route(node, reverbAmount) {
    node.connect(this.master);
    if (reverbAmount > 0 && this.reverb) {
      const send = this.ctx.createGain();
      send.gain.value = reverbAmount;
      node.connect(send).connect(this.reverb);
    }
  }

  _noiseBuffer() {
    if (this._noise) return this._noise;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return (this._noise = buf);
  }

  /** Synthetic "large hall" impulse response → spacious, sci-fi tail. */
  _makeReverb() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2.4;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    const out = ctx.createGain();
    out.gain.value = 0.55;
    conv.connect(out).connect(this.master);
    return conv;
  }

  /* ───────────── sounds ───────────── */

  tick() {
    this._tone({ type: 'triangle', freq: 2400, to: 1800, dur: 0.05, gain: 0.05, reverb: 0.05 });
  }

  whoosh() {
    this._noiseSweep({ from: 300, to: 5000, dur: 0.55, gain: 0.12, q: 3 });
    this._tone({ type: 'sine', freq: 180, to: 520, dur: 0.5, gain: 0.08 });
  }

  select() {
    this._tone({ type: 'sine', freq: 880, dur: 0.12, gain: 0.14 });
    this._tone({ type: 'sine', freq: 1320, start: 0.06, dur: 0.18, gain: 0.1 });
    this._tone({ type: 'triangle', freq: 1760, start: 0.12, dur: 0.5, gain: 0.05, reverb: 0.6 });
  }

  close() {
    this._tone({ type: 'sine', freq: 990, to: 520, dur: 0.16, gain: 0.08 });
  }

  lockOn() {
    // rising arpeggio + shimmer
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this._tone({ type: 'sine', freq: f, start: i * 0.07, dur: 0.35, gain: 0.12, reverb: 0.5 }));
    this._tone({ type: 'sawtooth', freq: 130.8, to: 261.6, dur: 0.6, gain: 0.04, reverb: 0.4 });
    this._noiseSweep({ from: 2000, to: 9000, dur: 0.7, gain: 0.05, q: 10, start: 0.1 });
    if (navigator.vibrate) navigator.vibrate([18, 40, 18]);
  }

  lost() {
    this._tone({ type: 'sine', freq: 660, to: 330, dur: 0.35, gain: 0.08, reverb: 0.4 });
  }

  explode() {
    this._noiseSweep({ from: 200, to: 6000, dur: 0.9, gain: 0.14, q: 4 });
    this._tone({ type: 'sawtooth', freq: 90, to: 360, dur: 0.8, gain: 0.05 });
  }

  assemble() {
    this._noiseSweep({ from: 6000, to: 200, dur: 0.8, gain: 0.12, q: 4 });
    this._tone({ type: 'sawtooth', freq: 360, to: 90, dur: 0.7, gain: 0.05 });
    this._tone({ type: 'sine', freq: 220, start: 0.7, dur: 0.25, gain: 0.1 });
  }

  /** Sonar ping every 1.8 s while scanning. */
  scanning(on) {
    clearInterval(this._scanTimer);
    this._scanTimer = null;
    if (!on) return;
    const ping = () => {
      this._tone({ type: 'sine', freq: 1480, dur: 0.6, gain: 0.05, reverb: 0.7 });
      this._tone({ type: 'sine', freq: 1480 * 1.5, start: 0.02, dur: 0.3, gain: 0.015, reverb: 0.7 });
    };
    ping();
    this._scanTimer = setInterval(ping, 1800);
  }

  /** Low, slowly breathing drone. */
  ambient(on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (!on) {
      if (this._ambient) {
        const a = this._ambient;
        a.gain.gain.setTargetAtTime(0.0001, t, 0.4);
        setTimeout(() => a.oscs.forEach((o) => o.stop()), 2000);
        this._ambient = null;
      }
      return;
    }
    if (this._ambient) return;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.Q.value = 4;
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(lp.frequency);
    const oscs = [55, 55.4, 82.4, 110.2].map((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = i < 2 ? 'sawtooth' : 'triangle';
      o.frequency.value = f;
      o.connect(lp);
      o.start();
      return o;
    });
    lfo.start();
    oscs.push(lfo);
    lp.connect(gain);
    this._route(gain, 0.35);
    gain.gain.setTargetAtTime(0.045, t, 1.2);
    this._ambient = { gain, oscs };
  }

  stopAll() {
    this.scanning(false);
    this.ambient(false);
  }
}

function readMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export const sfx = new SoundFx();
