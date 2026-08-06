/* ══════════════════════════════════════════════════════════════
   sun.js ── 陽力（ようりょく）の取得
     第一：背面カメラの輝度（映像は表示も保存も送信もしない）
     第二：位置情報 + Open-Meteo の雲量
     第三：端末時刻から太陽高度を簡易計算
     さらに「練習モード」では手動スライダーの値を使う
   ══════════════════════════════════════════════════════════════ */

const EMA_A = 0.2;          // 指数移動平均の係数
const CAM_SIZE = 64;        // 縮小先の一辺
const CAM_INTERVAL = 1000;  // 1秒ごと
const GEO_INTERVAL = 600000; // 10分ごと

export const SunSource = {
  NONE: 'none',
  CAMERA: 'camera',
  WEATHER: 'weather',
  CLOCK: 'clock',
  MANUAL: 'manual'
};

const LABEL = {
  none: '測定中',
  camera: 'カメラ',
  weather: '天気',
  clock: '時刻推定',
  manual: '練習モード'
};
const ICON = {
  none: '·', camera: '☀', weather: '☁', clock: '◐', manual: '⚙'
};

export class Sun {
  constructor(onChange) {
    this.value = 0;              // 0〜100
    this.source = SunSource.NONE;
    this.onChange = onChange || (() => {});
    this._ema = null;
    this._stream = null;
    this._video = null;
    this._canvas = null;
    this._ctx = null;
    this._camTimer = 0;
    this._geoTimer = 0;
    this._manual = 70;
    this._practice = false;
    this._stopped = false;
  }

  get label() { return LABEL[this.source] || '—'; }
  get icon() { return ICON[this.source] || '·'; }
  get isFull() { return this.value >= 99.5; }

  /** 練習モード（手動指定） */
  setPractice(on, value) {
    this._practice = !!on;
    if (typeof value === 'number') this._manual = value;
    if (this._practice) {
      this._stopCamera();
      this.source = SunSource.MANUAL;
      this._set(this._manual, true);
    } else {
      this._ema = null;
      this.start(this._allowCamera);
    }
  }
  setManual(v) {
    this._manual = Math.max(0, Math.min(100, v));
    if (this._practice) this._set(this._manual, true);
  }

  /** 取得を開始する。allowCamera=false ならカメラは試さない */
  async start(allowCamera) {
    this._allowCamera = !!allowCamera;
    this._stopped = false;
    if (this._practice) { this.source = SunSource.MANUAL; this._set(this._manual, true); return; }

    if (allowCamera) {
      const ok = await this._startCamera();
      if (ok) return;
    }
    const ok2 = await this._startWeather();
    if (ok2) return;
    this._startClock();
  }

  stop() {
    this._stopped = true;
    this._stopCamera();
    clearInterval(this._geoTimer);
  }

  /* ── 第一候補：カメラ輝度 ────────────────────── */
  async _startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false
      });
    } catch (e) {
      return false;
    }
    try {
      const v = document.createElement('video');
      v.setAttribute('playsinline', '');
      v.muted = true;
      v.srcObject = this._stream;
      await v.play();
      this._video = v;

      const c = document.createElement('canvas');
      c.width = CAM_SIZE; c.height = CAM_SIZE;
      this._canvas = c;
      this._ctx = c.getContext('2d', { willReadFrequently: true });

      this.source = SunSource.CAMERA;
      clearInterval(this._camTimer);
      this._camTimer = setInterval(() => this._sampleCamera(), CAM_INTERVAL);
      this._sampleCamera();
      return true;
    } catch (e) {
      this._stopCamera();
      return false;
    }
  }

  _sampleCamera() {
    if (this._stopped || !this._video || !this._ctx) return;
    try {
      // 64x64へ縮小して描き、そのフレームだけを見る（保存も送信もしない）
      this._ctx.drawImage(this._video, 0, 0, CAM_SIZE, CAM_SIZE);
      const d = this._ctx.getImageData(0, 0, CAM_SIZE, CAM_SIZE).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) {
        sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      }
      const mean = sum / (CAM_SIZE * CAM_SIZE);   // 0〜255
      // 屋内(約40)で低く、直射日光(約230)で満ちるように写す
      const raw = Math.max(0, Math.min(100, ((mean - 28) / (225 - 28)) * 100));
      this._set(raw);
    } catch (e) { /* 一時的な失敗は無視して次の秒を待つ */ }
  }

  _stopCamera() {
    clearInterval(this._camTimer);
    this._camTimer = 0;
    if (this._stream) {
      try { this._stream.getTracks().forEach(t => t.stop()); } catch (e) {}
      this._stream = null;
    }
    if (this._video) { try { this._video.pause(); } catch (e) {} this._video.srcObject = null; this._video = null; }
    this._canvas = null; this._ctx = null;
  }

  /* ── 第二候補：位置情報 + 天気 ────────────────── */
  _getPosition() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) { rej(new Error('no geo')); return; }
      navigator.geolocation.getCurrentPosition(
        p => res(p.coords),
        e => rej(e),
        { timeout: 8000, maximumAge: 600000, enableHighAccuracy: false }
      );
    });
  }

  async _startWeather() {
    let coords;
    try { coords = await this._getPosition(); } catch (e) { return false; }
    const fetchOnce = async () => {
      if (this._stopped) return;
      try {
        const url = 'https://api.open-meteo.com/v1/forecast'
          + '?latitude=' + coords.latitude.toFixed(3)
          + '&longitude=' + coords.longitude.toFixed(3)
          + '&current=cloud_cover,is_day&timezone=auto';
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error('weather ' + r.status);
        const j = await r.json();
        const cur = j && j.current;
        if (!cur) throw new Error('no current');
        const isDay = Number(cur.is_day);
        const cloud = Number(cur.cloud_cover);
        const v = (isDay === 0) ? 0 : Math.max(0, (100 - (isNaN(cloud) ? 50 : cloud)) * 0.8);
        this.source = SunSource.WEATHER;
        this._set(v, true);
      } catch (e) {
        // 取得できなければ時刻推定へ落とす
        if (this.source !== SunSource.CLOCK) this._startClock();
      }
    };
    await fetchOnce();
    clearInterval(this._geoTimer);
    this._geoTimer = setInterval(fetchOnce, GEO_INTERVAL);
    return this.source === SunSource.WEATHER;
  }

  /* ── 第三候補：時刻から太陽高度を簡易計算 ──────── */
  _startClock() {
    this.source = SunSource.CLOCK;
    const tick = () => {
      if (this._stopped) return;
      this._set(this._solarByClock(), true);
    };
    tick();
    clearInterval(this._geoTimer);
    this._geoTimer = setInterval(tick, 60000);
  }

  /** 緯度35度固定・正午100%・日没後0%の簡易モデル */
  _solarByClock(now) {
    now = now || new Date();
    const LAT = 35 * Math.PI / 180;
    const start = new Date(now.getFullYear(), 0, 0);
    const doy = Math.floor((now - start) / 86400000);
    // 太陽赤緯（近似）
    const decl = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + doy) / 365);
    const h = now.getHours() + now.getMinutes() / 60;
    const hourAngle = (h - 12) * 15 * Math.PI / 180;
    // 太陽高度
    const alt = Math.asin(
      Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(hourAngle)
    );
    if (alt <= 0) return 0;                       // 日没後
    return Math.max(0, Math.min(100, Math.sin(alt) * 118));
  }

  /* ── 値の更新（平滑化つき） ──────────────────── */
  _set(raw, immediate) {
    const v = Math.max(0, Math.min(100, raw));
    if (immediate || this._ema === null) this._ema = v;
    else this._ema = this._ema + EMA_A * (v - this._ema);
    const next = Math.round(this._ema * 10) / 10;
    if (next !== this.value) {
      this.value = next;
      this.onChange(this.value, this.source);
    }
  }

  /** ゲーム側から消費する（射撃など）。足りなければ false */
  consume(cost) {
    if (this.value < cost) return false;
    this.value = Math.max(0, Math.round((this.value - cost) * 10) / 10);
    this._ema = this.value;
    this.onChange(this.value, this.source);
    return true;
  }

  /** 天窓などで補給する */
  charge(amount) {
    this.value = Math.min(100, Math.round((this.value + amount) * 10) / 10);
    this._ema = this.value;
    this.onChange(this.value, this.source);
  }
}
