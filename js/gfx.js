/* ══════════════════════════════════════════════════════════════
   gfx.js ── レンダラ・材質・ポスト処理
     テクスチャは外部ファイルを使わず Canvas から作る
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ── 値ノイズ（決定論） ───────────────────────── */
function hash2(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + (seed || 0) * 1442695040;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf), v = smooth(yf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x, y, oct, seed) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < (oct || 4); i++) { v += valueNoise(x * f, y * f, seed) * amp; f *= 2; amp *= 0.5; }
  return v;
}

/* ── Canvas からテクスチャを作る ─────────────── */
export function noiseTexture(size, scale, seed, tint) {
  size = size || 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const t = tint || [1, 1, 1];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / size * (scale || 8), y / size * (scale || 8), 5, seed || 1);
      // 素の色を潰さないよう、濃淡の振れ幅を狭めて明るい側へ寄せる
      const v = Math.max(0, Math.min(255, (0.72 + n * 0.28) * 255));
      const i = (y * size + x) * 4;
      img.data[i] = v * t[0]; img.data[i + 1] = v * t[1]; img.data[i + 2] = v * t[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** ノイズから法線マップを作る */
export function normalTexture(size, scale, seed, strength) {
  size = size || 256; strength = strength || 2.2;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const h = (x, y) => fbm(((x + size) % size) / size * (scale || 8), ((y + size) % size) / size * (scale || 8), 5, seed || 1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** 粗さマップ（白いほどザラつく） */
export function roughTexture(size, scale, seed, lo, hi) {
  size = size || 256; lo = lo == null ? 0.45 : lo; hi = hi == null ? 0.95 : hi;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / size * (scale || 6), y / size * (scale || 6), 4, seed || 7);
      const v = (lo + n * (hi - lo)) * 255;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/* ── ビネット・グレイン・色収差 ───────────────── */
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    vignette: { value: 0.82 },
    grain: { value: 0.03 },
    aberr: { value: 0.0002 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time, vignette, grain, aberr;
    varying vec2 vUv;
    float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      // 色収差：外周ほどRGBをずらす
      float r2 = dot(d,d);
      vec2 off = d * r2 * aberr * 40.0;
      vec4 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;
      col.a = 1.0;
      // 映画のような色：暗部は青く、明部は暖かく、ゆるいS字で締める
      float l = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
      col.rgb = mix(col.rgb, col.rgb * vec3(0.92, 0.98, 1.08), (1.0 - smoothstep(0.0, 0.45, l)) * 0.55);
      col.rgb = mix(col.rgb, col.rgb * vec3(1.06, 1.01, 0.93), smoothstep(0.55, 1.0, l) * 0.5);
      col.rgb = clamp(col.rgb, 0.0, 1.0);
      col.rgb = mix(col.rgb, col.rgb * col.rgb * (3.0 - 2.0 * col.rgb), 0.28);
      // 彩度を少しだけ持ち上げる
      float l2 = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
      col.rgb = mix(vec3(l2), col.rgb, 1.08);
      // ビネット
      float v = smoothstep(0.85, 0.18, length(d) * vignette);
      col.rgb *= mix(0.78, 1.0, v);
      // フィルムグレイン
      float g = rand(uv * 800.0 + time) - 0.5;
      col.rgb += g * grain;
      gl_FragColor = col;
    }
  `
};

/* ── レンダラ一式 ─────────────────────────── */
export class Gfx {
  constructor(canvas, quality) {
    this.quality = quality || 'mid';
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance', alpha: false
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.62;
    this.renderer.shadowMap.enabled = true;
    // 中・高は輪郭のやわらかい影
    this.renderer.shadowMap.type = this.quality === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    // 影は毎フレーム焼き直さず、数フレームに一度でよい
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this._shadowTick = 0;
    this.scale = 1;
    this._applyPixelRatio();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070b);
    this.scene.fog = new THREE.FogExp2(0x05070b, 0.028);
    // 映り込み：外部画像を使わず、仮想の部屋から環境光を作る（金属・髪・肌に照り返しが乗る）
    try {
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = 0.45;
      pm.dispose();
    } catch (e) {}

    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 260);
    this.camera.position.set(0, 6, 9);

    this._setupPost();
    this._fpsSamples = [];
    this._lowSince = 0;
  }

  _applyPixelRatio() {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1) * this.scale;
    this.renderer.setPixelRatio(dpr);
  }

  _setupPost() {
    const w = window.innerWidth, h = window.innerHeight;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // 高画質：物の接地や凹みに落ちる柔らかな陰（環境遮蔽）
    this.gtao = null;
    if (this.quality === 'high') {
      try {
        this.gtao = new GTAOPass(this.scene, this.camera, w, h);
        this.gtao.blendIntensity = 0.85;
        this.gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 });
        this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 12 });
        this.composer.addPass(this.gtao);
      } catch (e) { this.gtao = null; }
    }
    const strength = this.quality === 'low' ? 0.45 : this.quality === 'high' ? 0.7 : 0.58;
    // ブルームは半分の解像度で十分。滲みの見た目は変わらず負荷が大きく下がる
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w * 0.5, h * 0.5), strength, 0.6, 0.85);
    this.composer.addPass(this.bloom);
    // 色の正しい変換（ACESの階調とsRGB）。これが無いと全体が眠い画になる
    this.composer.addPass(new OutputPass());

    if (this.quality !== 'low') {
      this.grade = new ShaderPass(GradeShader);
      this.composer.addPass(this.grade);
      if (this.quality === 'high') {
        try { this.smaa = new SMAAPass(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio()); this.composer.addPass(this.smaa); }
        catch (e) { this.fxaa = new ShaderPass(FXAAShader); this.composer.addPass(this.fxaa); }
      } else {
        this.fxaa = new ShaderPass(FXAAShader);
        this.composer.addPass(this.fxaa);
      }
    }
    this.resize();
  }

  setQuality(q) {
    this.quality = q;
    this.renderer.shadowMap.type = q === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.needsUpdate = true;
    this.fxaa = null; this.smaa = null;
    // パスを組み直す
    this.composer.passes.length = 0;
    this._setupPost();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this._applyPixelRatio();
    if (this.fxaa) {
      const pr = this.renderer.getPixelRatio();
      this.fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    }
  }

  /**
   * 場面じゅうの点光源から、近いものだけを点ける。
   * 点光源は数が増えるほど全ての物体の計算量が増えるため、
   * 見た目を変えずに負荷を下げる最も効く手立て。
   */
  /** 場面を作り替えたら光源を集め直す */
  rescanLights() { this._lightScan = 0; this._lights = null; }

  cullPointLights(px, pz, budget) {
    budget = budget || 6;
    if (!this._lightScan || this._lightScan < 1) {
      this._lights = [];
      this.scene.traverse(o => { if (o.isPointLight) this._lights.push(o); });
      this._lightScan = 20;
    }
    this._lightScan--;
    const arr = this._lights;
    if (!arr || !arr.length) return 0;
    const wp = new THREE.Vector3();
    for (const l of arr) {
      l.getWorldPosition(wp);
      const dx = wp.x - px, dz = wp.z - pz;
      l._d2 = dx * dx + dz * dz;
      if (l._base === undefined) l._base = l.intensity;
    }
    const sorted = arr.slice().sort((a, b) => a._d2 - b._d2);
    let on = 0;
    for (let i = 0; i < sorted.length; i++) {
      const l = sorted[i];
      const want = (i < budget) && (l._d2 < 2500) && (l._base > 0.01);
      if (l.visible !== want) l.visible = want;
      if (want) on++;
    }
    return on;
  }

  /** fpsが落ち続けたら解像度を下げる */
  watchPerf(dt) {
    const fps = 1 / Math.max(0.0001, dt);
    this._fpsSamples.push(fps);
    if (this._fpsSamples.length > 30) this._fpsSamples.shift();
    const avg = this._fpsSamples.reduce((a, b) => a + b, 0) / this._fpsSamples.length;
    if (avg < 45) {
      this._lowSince += dt;
      if (this._lowSince > 2 && this.scale > 0.6) {
        this.scale = Math.max(0.6, this.scale - 0.15);
        this._applyPixelRatio();
        this.resize();
        this._lowSince = 0;
      }
    } else {
      this._lowSince = 0;
    }
    return Math.round(avg);
  }

  render(t) {
    // 影の焼き直しは3フレームに一度
    this._shadowTick = (this._shadowTick + 1) % 3;
    this.renderer.shadowMap.needsUpdate = (this._shadowTick === 0);
    if (this.grade) this.grade.material.uniforms.time.value = t;
    this.composer.render();
  }
}

/* ── よく使う材質 ───────────────────────────── */
/* 同じ見た目の材質は使い回す。毎回作ると描画呼び出しが跳ね上がる */
const _matCache = new Map();
function _cached(key, make) {
  let m = _matCache.get(key);
  if (!m) { m = make(); _matCache.set(key, m); }
  return m;
}
export function clearMatCache() { _matCache.clear(); }

export function stoneMaterial(seed, color) {
  return _cached('stone|' + (color || 0x3a3d45), () => _makeStone(seed, color));
}
function _makeStone(seed, color) {
  const map = noiseTexture(256, 7, seed, [1, 0.98, 0.94]);
  map.repeat.set(4, 4);
  const nrm = normalTexture(256, 7, seed, 2.6); nrm.repeat.set(4, 4);
  const rgh = roughTexture(256, 5, seed + 3, 0.6, 0.98); rgh.repeat.set(4, 4);
  return new THREE.MeshStandardMaterial({
    color: color || 0x7b8291, map, normalMap: nrm, roughnessMap: rgh,
    roughness: 0.86, metalness: 0.06
  });
}
export function metalMaterial(seed, color) {
  return _cached('metal|' + (color || 0x6d727d), () => _makeMetal(seed, color));
}
function _makeMetal(seed, color) {
  const nrm = normalTexture(256, 12, seed, 1.4); nrm.repeat.set(2, 2);
  const rgh = roughTexture(256, 9, seed + 5, 0.18, 0.55); rgh.repeat.set(2, 2);
  return new THREE.MeshStandardMaterial({
    color: color || 0x6d727d, normalMap: nrm, roughnessMap: rgh,
    roughness: 0.35, metalness: 0.85
  });
}
export function fleshMaterial(color) {
  return _cached('flesh|' + (color || 0x6e7355), () =>
    new THREE.MeshStandardMaterial({ color: color || 0x6e7355, roughness: 0.85, metalness: 0.02 }));
}
/* 光る材質：強さを後から変えるものだけ個別に作る */
export function glowMaterial(color, intensity, unique) {
  if (!unique) {
    const k = 'glow|' + (color || 0xffe9a8) + '|' + (intensity == null ? 2.2 : intensity);
    return _cached(k, () => _makeGlow(color, intensity));
  }
  return _makeGlow(color, intensity);
}
function _makeGlow(color, intensity) {
  return new THREE.MeshStandardMaterial({
    color: color || 0xffe9a8, emissive: new THREE.Color(color || 0xffe9a8),
    emissiveIntensity: intensity == null ? 2.2 : intensity,
    roughness: 0.4, metalness: 0
  });
}
export { THREE };

/* ══ 模様のある質感（煉瓦・敷石・丸石・板・タイル・土・漆喰・切石） ══
   キャンバスに高さと色を描き、そこから法線・粗さを作る。外部の画像は使わない。
   継ぎ目なく並ぶよう、すべて端で巡回させて描く。 */
const _patCache = new Map();
function _rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function _pattern(kind, color, seed) {
  const N = 512;
  const H = new Float32Array(N * N);     // 高さ 0..1
  const A = new Float32Array(N * N * 3); // 色
  const R = new Float32Array(N * N);     // 粗さ
  const base = new THREE.Color(color);
  const rnd = _rng(seed || 7);
  const put = (i, h, k, rough, tint) => {
    H[i] = h; R[i] = rough;
    const t = tint || base;
    A[i * 3] = t.r * k; A[i * 3 + 1] = t.g * k; A[i * 3 + 2] = t.b * k;
  };
  const nz = (x, y, sc, sd) => fbm(x / N * sc, y / N * sc, 4, sd);
  // 巡回するボロノイ（敷石・丸石）
  const voronoi = (count, jit) => {
    const pts = [];
    const g = Math.round(Math.sqrt(count));
    for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) pts.push([(i + 0.5 + (rnd() - 0.5) * jit) / g * N, (j + 0.5 + (rnd() - 0.5) * jit) / g * N, rnd()]);
    return (x, y) => {
      let d1 = 1e9, d2 = 1e9, id = 0;
      for (const p of pts) {
        let dx = Math.abs(x - p[0]), dy = Math.abs(y - p[1]);
        if (dx > N / 2) dx = N - dx; if (dy > N / 2) dy = N - dy;
        const d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; d1 = d; id = p[2]; } else if (d < d2) d2 = d;
      }
      return { edge: Math.sqrt(d2) - Math.sqrt(d1), d: Math.sqrt(d1), id };
    };
  };
  const mortar = new THREE.Color(color).multiplyScalar(0.55).lerp(new THREE.Color(0x6a6660), 0.5);
  if (kind === 'brick' || kind === 'block') {
    const bh = kind === 'block' ? 128 : 64, bw = kind === 'block' ? 256 : 128, mw = kind === 'block' ? 5 : 6;
    const vary = []; for (let i = 0; i < 64; i++) vary.push(0.82 + rnd() * 0.3);
    for (let y = 0; y < N; y++) {
      const row = Math.floor(y / bh), off = (row % 2) * bw / 2;
      for (let x = 0; x < N; x++) {
        const xx = (x + off) % N, col = Math.floor(xx / bw);
        const ex = Math.min(xx % bw, bw - xx % bw), ey = Math.min(y % bh, bh - y % bh);
        const e = Math.min(ex, ey);
        const i = y * N + x, n = nz(x, y, 16, 3);
        if (e < mw) put(i, 0.05 + n * 0.1, 0.8 + n * 0.3, 0.95, mortar);
        else {
          const bev = Math.min(1, (e - mw) / 6);
          const v = vary[(row * 7 + col * 13) % 64];
          const chip = nz(x, y, 40, 9) > 0.72 ? 0.25 : 0;
          put(i, 0.55 + bev * 0.35 + n * 0.15 - chip, v * (0.85 + n * 0.3) * (1 - chip * 0.6), 0.75 + n * 0.2);
        }
      }
    }
  } else if (kind === 'flag' || kind === 'cobble') {
    const vo = voronoi(kind === 'flag' ? 16 : 64, kind === 'flag' ? 0.7 : 0.9);
    const gw = kind === 'flag' ? 4 : 5;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = vo(x, y), i = y * N + x, n = nz(x, y, 20, 5);
      if (v.edge < gw) put(i, 0.05 + n * 0.1, 0.55 + n * 0.3, 0.95, mortar);
      else {
        const dome = kind === 'cobble' ? Math.max(0, 1 - v.d / 40) : Math.min(1, (v.edge - gw) / 10);
        put(i, 0.45 + dome * 0.45 + n * 0.15, (0.62 + v.id * 0.3) * (0.8 + n * 0.3) * (0.8 + dome * 0.25), 0.7 + n * 0.25);
      }
    }
  } else if (kind === 'plank') {
    const ph = 64;
    for (let y = 0; y < N; y++) {
      const b = Math.floor(y / ph), off = (b * 173) % N;
      for (let x = 0; x < N; x++) {
        const i = y * N + x, ey = Math.min(y % ph, ph - y % ph);
        const grain = Math.sin((x + off) * 0.05 + nz(x + off, y, 8, 11) * 12) * 0.5 + 0.5;
        const seam = ((x + off) % 256) < 3;
        if (ey < 2 || seam) put(i, 0.05, 0.45, 0.9);
        else put(i, 0.6 + grain * 0.15, (0.8 + (b % 3) * 0.08) * (0.8 + grain * 0.35), 0.55 + grain * 0.25);
      }
    }
  } else if (kind === 'tile') {
    const tw = 128, gw = 3;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, e = Math.min(x % tw, tw - x % tw, y % tw, tw - y % tw);
      const vein = Math.abs(Math.sin(x * 0.02 + nz(x, y, 6, 21) * 9));
      if (e < gw) put(i, 0.1, 0.55, 0.8, mortar);
      else put(i, 0.8, 0.9 + (1 - vein) * 0.15 - (vein < 0.08 ? 0.25 : 0), 0.18 + (vein < 0.08 ? 0.3 : 0));
    }
  } else if (kind === 'dirt') {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, n = nz(x, y, 10, 31), m = nz(x, y, 50, 37);
      const peb = m > 0.7 ? (m - 0.7) * 3 : 0;
      put(i, 0.4 + n * 0.3 + peb * 0.4, 0.7 + n * 0.4 + peb * 0.3, 0.9 - peb * 0.2);
    }
  } else if (kind === 'roof') {   // 瓦
    const rh = 48, rw = 64;
    for (let y = 0; y < N; y++) {
      const row = Math.floor(y / rh), off = (row % 2) * rw / 2;
      for (let x = 0; x < N; x++) {
        const xx = (x + off) % N, u = (xx % rw) / rw, v = (y % rh) / rh;
        const arch = Math.sin(u * Math.PI);
        const i = y * N + x, n = nz(x, y, 16, 41);
        put(i, arch * (0.4 + v * 0.6), (0.6 + arch * 0.5) * (0.85 + n * 0.25), 0.45 + (1 - arch) * 0.4);
      }
    }
  } else {                        // plaster 漆喰
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, n = nz(x, y, 8, 51), c = nz(x, y, 60, 57);
      const crack = Math.abs(nz(x, y, 5, 59) - 0.5) < 0.008 ? 0.35 : 0;
      put(i, 0.5 + n * 0.2 - crack, 0.88 + n * 0.18 - crack + (c - 0.5) * 0.08, 0.85);
    }
  }
  // 色・法線・粗さのテクスチャ
  const mk = (fill) => {
    const c = document.createElement('canvas'); c.width = c.height = N;
    const ctx = c.getContext('2d'); const img = ctx.createImageData(N, N);
    for (let i = 0; i < N * N; i++) { const o = fill(i); img.data[i * 4] = o[0]; img.data[i * 4 + 1] = o[1]; img.data[i * 4 + 2] = o[2]; img.data[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
  };
  const map = mk(i => [Math.min(255, A[i * 3] * 255), Math.min(255, A[i * 3 + 1] * 255), Math.min(255, A[i * 3 + 2] * 255)]);
  map.colorSpace = THREE.SRGBColorSpace;
  const h = (x, y) => H[((y + N) % N) * N + ((x + N) % N)];
  const str = 6.0;
  const nor = mk(i => {
    const x = i % N, y = (i / N) | 0;
    let nx = -(h(x + 1, y) - h(x - 1, y)) * str, ny = (h(x, y + 1) - h(x, y - 1)) * str, nzv = 1;
    const l = Math.hypot(nx, ny, nzv); nx /= l; ny /= l; nzv /= l;
    return [(nx * 0.5 + 0.5) * 255, (ny * 0.5 + 0.5) * 255, (nzv * 0.5 + 0.5) * 255];
  });
  const rough = mk(i => { const v = R[i] * 255; return [v, v, v]; });
  return { map, nor, rough };
}

/**
 * 模様の材質。meters は模様1枚が覆う長さ（世界の単位）。
 * 形の UV を世界の位置から作り直して使う（worldUV を参照）。
 */
export function patternMaterial(kind, color, meters, opts) {
  opts = opts || {};
  const key = kind + '|' + color + '|' + (opts.rough || '') + '|' + (opts.metal || '');
  let m = _patCache.get(key);
  if (m) return m;
  const T = _pattern(kind, color, (color & 0xffff) + kind.length * 97);
  m = new THREE.MeshStandardMaterial({
    map: T.map, normalMap: T.nor, roughnessMap: T.rough,
    roughness: opts.rough == null ? 1 : opts.rough, metalness: opts.metal || 0,
    normalScale: new THREE.Vector2(opts.bump || 1.2, opts.bump || 1.2)
  });
  m.userData.worldUV = meters || 2;
  _patCache.set(key, m);
  return m;
}

/** 形の UV を、面の向きに応じて世界の位置から作り直す（模様が伸びない） */
export function worldUV(geo, meters, matrix) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  if (!p || !n) return geo;
  let uv = geo.attributes.uv;
  if (!uv) { uv = new THREE.BufferAttribute(new Float32Array(p.count * 2), 2); geo.setAttribute('uv', uv); }
  const v = new THREE.Vector3(), nn = new THREE.Vector3();
  const nm = matrix ? new THREE.Matrix3().getNormalMatrix(matrix) : null;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); nn.fromBufferAttribute(n, i);
    if (matrix) { v.applyMatrix4(matrix); nn.applyMatrix3(nm).normalize(); }
    const ax = Math.abs(nn.x), ay = Math.abs(nn.y), az = Math.abs(nn.z);
    let u, w;
    if (ay >= ax && ay >= az) { u = v.x; w = v.z; }
    else if (ax >= az) { u = v.z * Math.sign(nn.x || 1); w = v.y; }
    else { u = -v.x * Math.sign(nn.z || 1); w = v.y; }
    uv.setXY(i, u / meters, w / meters);
  }
  uv.needsUpdate = true;
  return geo;
}
