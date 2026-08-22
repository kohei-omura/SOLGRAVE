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
    grain: { value: 0.055 },
    aberr: { value: 0.0016 }
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
      // ビネット
      float v = smoothstep(0.85, 0.18, length(d) * vignette);
      col.rgb *= mix(0.80, 1.0, v);
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
    this.renderer.toneMappingExposure = 1.85;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;   // 柔らかい影は重いので通常の影に
    // 影は毎フレーム焼き直さず、数フレームに一度でよい
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this._shadowTick = 0;
    this.scale = 1;
    this._applyPixelRatio();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070b);
    this.scene.fog = new THREE.FogExp2(0x05070b, 0.028);

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

    const strength = this.quality === 'low' ? 0.55 : this.quality === 'high' ? 0.95 : 0.75;
    // ブルームは半分の解像度で十分。滲みの見た目は変わらず負荷が大きく下がる
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w * 0.5, h * 0.5), strength, 0.72, 0.62);
    this.composer.addPass(this.bloom);

    if (this.quality !== 'low') {
      this.grade = new ShaderPass(GradeShader);
      this.composer.addPass(this.grade);
      this.fxaa = new ShaderPass(FXAAShader);
      this.composer.addPass(this.fxaa);
    }
    this.resize();
  }

  setQuality(q) {
    this.quality = q;
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
