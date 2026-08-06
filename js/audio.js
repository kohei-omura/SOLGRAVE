/* audio.js ── 外部音源なし。Web Audio で合成する */
export class Audio {
  constructor() {
    this.ctx = null; this.master = null;
    this.volume = 0.6; this.muted = false;
    this._bgmTimer = 0; this._step = 0;
  }
  /* 最初のタップの同期ハンドラ内で呼ぶこと */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume * 0.5;
      this.master.connect(this.ctx.destination);
      // 無音を1回鳴らして解錠
      const b = this.ctx.createBuffer(1, 1, 22050);
      const s = this.ctx.createBufferSource();
      s.buffer = b; s.connect(this.master); s.start(0);
      return true;
    } catch (e) { return false; }
  }
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume * 0.5;
  }
  setMute(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume * 0.5;
  }
  _noise(dur, vol, lpFrom, lpTo, delay) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t0 = c.currentTime + (delay || 0);
    const n = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(lpFrom || 8000, t0);
    lp.frequency.exponentialRampToValueAtTime(Math.max(80, lpTo || 400), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(lp); lp.connect(g); g.connect(this.master); src.start(t0);
  }
  _tone(f, dur, type, vol, delay, slideTo) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol || 0.12, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  sfx(kind) {
    if (!this.ctx || this.muted) return;
    switch (kind) {
      case 'shot':    this._noise(0.14, 0.22, 7000, 500); this._tone(680, 0.08, 'square', 0.07); break;
      case 'charge':  this._tone(180, 0.9, 'sawtooth', 0.08, 0, 900); break;
      case 'beam':    this._noise(0.4, 0.3, 9000, 300); this._tone(120, 0.5, 'sawtooth', 0.16, 0, 60); break;
      case 'ash':     this._noise(0.5, 0.16, 11000, 900); break;
      case 'hit':     this._tone(90, 0.2, 'square', 0.2); this._noise(0.12, 0.14, 2000, 200); break;
      case 'hurt':    this._tone(160, 0.3, 'sawtooth', 0.2, 0, 60); this._noise(0.2, 0.2, 1200, 120); break;
      case 'empty':   this._tone(220, 0.09, 'square', 0.08); this._tone(160, 0.09, 'square', 0.07, 0.09); break;
      case 'refill':  [440, 660, 880].forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.12, i * 0.09)); break;
      case 'seal':    this._tone(320, 0.3, 'triangle', 0.14); this._tone(480, 0.4, 'sine', 0.1, 0.12); break;
      case 'good':    this._tone(880, 0.14, 'square', 0.13); this._tone(1320, 0.18, 'triangle', 0.11, 0.1); break;
      case 'bad':     this._tone(140, 0.3, 'sawtooth', 0.14, 0, 70); break;
      case 'pile':    this._noise(0.3, 0.32, 3000, 90); this._tone(70, 0.35, 'sine', 0.24); break;
      case 'purify':  [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone(f, 0.7, 'triangle', 0.12, i * 0.13)); break;
      case 'phase':   this._noise(0.6, 0.2, 6000, 200); this._tone(110, 0.8, 'sawtooth', 0.14, 0, 440); break;
    }
  }
  startBGM() {
    if (!this.ctx || this._bgmTimer) return;
    const beat = 0.95;
    this._step = 0;
    // 低い持続音（不協和な短二度を重ねて落ち着かなくする）
    this._drone = [];
    try {
      [41.2, 43.65, 61.7].forEach((f, i) => {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = i === 2 ? 'triangle' : 'sawtooth';
        o.frequency.value = f;
        g.gain.value = 0.055;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 320;
        // ゆっくり唸る
        const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
        lfo.frequency.value = 0.07 + i * 0.03; lg.gain.value = 2.2;
        lfo.connect(lg); lg.connect(o.detune); lfo.start();
        o.connect(lp); lp.connect(g); g.connect(this.master); o.start();
        this._drone.push({ o, g, lfo });
      });
    } catch (e) {}

    const tick = () => {
      if (this.muted || document.hidden) return;
      const s = this._step;
      // 心臓の鼓動のような二連打
      if (s % 4 === 0) { this._tone(52, 0.34, 'sine', 0.16); this._tone(48, 0.28, 'sine', 0.12, 0.17); }
      // 遠くで軋む音
      if (s % 8 === 5) this._noise(0.9, 0.05, 1400, 160);
      // 不規則に差し込む金属音
      if (s % 16 === 11) this._tone(1180, 0.5, 'triangle', 0.05, 0, 690);
      // 半音でぶつかる音（不安）
      if (s % 8 === 2) { this._tone(329.6, 0.7, 'sine', 0.045); this._tone(311.1, 0.7, 'sine', 0.04); }
      // ときおり息のようなノイズ
      if (s % 12 === 7) this._noise(1.4, 0.035, 900, 240);
      this._step++;
    };
    tick();
    this._bgmTimer = setInterval(tick, beat * 1000);
  }
  stopBGM() {
    clearInterval(this._bgmTimer); this._bgmTimer = 0;
    if (this._drone) {
      this._drone.forEach(d => { try { d.o.stop(); d.lfo.stop(); } catch (e) {} });
      this._drone = null;
    }
  }
}
