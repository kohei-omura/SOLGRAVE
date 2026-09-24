/* ══════════════════════════════════════════════════════════════
   enemy.js ── 4種の不死者と、弾・灰化の粒子
     歩兵ゾンビ／走行ゾンビ／盾持ち／飛行コウモリ
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { fleshMaterial, metalMaterial, glowMaterial } from './gfx.js';
import { buildElite, ELITES } from './forms.js';
import { inShape } from './weapons.js';

export const EnemyKind = {
  WALKER: 0, RUNNER: 1, SHIELD: 2, BAT: 3, SKELETON: 4, MUMMY: 5, GHOST: 6, WISP: 7,
  WOLF: 8, TREANT: 9, KNIGHT: 10, GARGOYLE: 11, FROST: 12, YETI: 13, MAGMA: 14, IMP: 15,
  SCARECROW: 16, HARPY: 17, KYONSHI: 18, BANSHEE: 19
};

/* 種ごとの性質
   fly: 宙に浮く高さ　wall: 壁を抜けるか　ranged: 撃つ間隔（秒）
   hop: 跳ねて進む　front: 正面の弾を弾く　exp: 経験 */
const SPEC = {
  0:  { name: 'ゾンビ',       hp: 3,  speed: 2.0, r: 0.55, dmgR: 1.2, exp: 16 },
  1:  { name: 'グール',       hp: 2,  speed: 4.4, r: 0.5,  dmgR: 1.1, exp: 22 },
  2:  { name: '盾持ちの骸',   hp: 6,  speed: 1.5, r: 0.7,  dmgR: 1.4, exp: 34, front: true },
  3:  { name: '吸血蝙蝠',     hp: 2,  speed: 5.0, r: 0.42, dmgR: 1.0, exp: 20, fly: 1.45, wall: true },
  4:  { name: 'スケルトン',   hp: 3,  speed: 2.9, r: 0.5,  dmgR: 1.1, exp: 20 },
  5:  { name: 'マミー',       hp: 7,  speed: 1.4, r: 0.6,  dmgR: 1.3, exp: 32 },
  6:  { name: 'ゴースト',     hp: 2,  speed: 2.5, r: 0.5,  dmgR: 1.1, exp: 22, fly: 1.1, wall: true },
  7:  { name: '鬼火',         hp: 2,  speed: 2.0, r: 0.4,  dmgR: 0.9, exp: 24, fly: 1.6, ranged: 2.8 },
  8:  { name: '屍狼',         hp: 3,  speed: 5.2, r: 0.55, dmgR: 1.1, exp: 24 },
  9:  { name: '朽ち木',       hp: 9,  speed: 1.1, r: 0.8,  dmgR: 1.5, exp: 36 },
  10: { name: '亡霊騎士',     hp: 7,  speed: 2.0, r: 0.65, dmgR: 1.3, exp: 38, front: true },
  11: { name: 'ガーゴイル',   hp: 5,  speed: 3.8, r: 0.6,  dmgR: 1.2, exp: 30, fly: 2.0 },
  12: { name: '氷霊',         hp: 3,  speed: 2.2, r: 0.5,  dmgR: 1.1, exp: 28, fly: 1.3, ranged: 2.6 },
  13: { name: '雪鬼',         hp: 10, speed: 2.2, r: 0.85, dmgR: 1.6, exp: 40 },
  14: { name: '溶岩塊',       hp: 6,  speed: 1.6, r: 0.75, dmgR: 1.4, exp: 32 },
  15: { name: '火蜥蜴',       hp: 3,  speed: 3.0, r: 0.5,  dmgR: 1.1, exp: 28, ranged: 2.4 },
  16: { name: '案山子',       hp: 4,  speed: 2.4, r: 0.55, dmgR: 1.2, exp: 26, hop: true },
  17: { name: 'ハーピー',     hp: 3,  speed: 4.4, r: 0.5,  dmgR: 1.1, exp: 30, fly: 1.8, ranged: 3.2 },
  18: { name: 'キョンシー',   hp: 4,  speed: 3.2, r: 0.5,  dmgR: 1.2, exp: 26, hop: true },
  19: { name: '泣き女',       hp: 3,  speed: 2.4, r: 0.5,  dmgR: 1.1, exp: 30, fly: 1.2, ranged: 3.6, ringShot: true }
};
export function specOf(kind) { return SPEC[kind] || SPEC[0]; }

/* 部位を合成して一つの形にする（BufferGeometryUtils を使わない） */
function mergeParts(parts) {
  const geos = [];
  parts.forEach(p => {
    let g = p.g.clone();
    if (g.index) g = g.toNonIndexed();
    g.scale(p.s ? p.s[0] : 1, p.s ? p.s[1] : 1, p.s ? p.s[2] : 1);
    if (p.r) { g.rotateX(p.r[0] || 0); g.rotateY(p.r[1] || 0); g.rotateZ(p.r[2] || 0); }
    g.translate(p.t[0], p.t[1], p.t[2]);
    geos.push(g);
  });
  let total = 0;
  geos.forEach(g => { total += g.attributes.position.count; });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  let off = 0;
  geos.forEach(g => {
    pos.set(g.attributes.position.array, off * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, off * 3);
    off += g.attributes.position.count;
    g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

/* ── 弾 ─────────────────────────────────────
   見た目（look）ごとに描き分ける：orb 陽光弾／arrow 矢／page 頁／
   wave 音の輪／star 手裏剣。probe は見えない当たり判定（近接の届き）。 */
export class Bullets {
  constructor(scene, max) {
    this.max = max || 90;
    this.list = [];
    const mk = (geo, mat) => {
      const m = new THREE.InstancedMesh(geo, mat, this.max);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false; m.count = 0;
      scene.add(m);
      return m;
    };
    const arrow = new THREE.CylinderGeometry(0.035, 0.05, 1.1, 6); arrow.rotateX(Math.PI / 2);
    const page = new THREE.BoxGeometry(0.34, 0.03, 0.44);
    const wave = new THREE.TorusGeometry(1, 0.07, 6, 28); wave.rotateX(Math.PI / 2);
    const star = new THREE.OctahedronGeometry(1, 0); star.scale(0.9, 0.12, 0.9);
    this.looks = {
      orb:   mk(new THREE.SphereGeometry(0.14, 8, 6), glowMaterial(0xffeeb0, 3.2)),
      arrow: mk(arrow, glowMaterial(0xfff4c8, 2.6)),
      page:  mk(page, glowMaterial(0xfff8e0, 2.0)),
      wave:  mk(wave, new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false })),
      star:  mk(star, metalMaterial(62, 0xd8d8e0))
    };
    this.mesh = this.looks.orb;          // 互換のため
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 0, 1);
  }
  fire(pos, dir, opts) {
    opts = opts || {};
    if (this.list.length >= this.max) this.list.shift();
    const b = {
      p: pos.clone(), d: dir.clone().normalize(),
      speed: opts.speed || 34,
      life: opts.life || 1.5,
      pierce: !!opts.pierce,
      dmg: opts.dmg || 1,
      r: opts.r || 0.2,
      look: opts.look || 'orb',
      homing: opts.homing || 0,
      boomerang: !!opts.boomerang,
      grow: opts.grow || 0,
      probe: !!opts.probe,
      stun: opts.stun || 0,
      breaker: !!opts.breaker,
      age: 0
    };
    b.r0 = b.r; b.life0 = b.life;
    this.list.push(b);
    return b;
  }
  /** ctx.seek(b) 追う先 ／ ctx.home 戻る先（手裏剣） */
  update(dt, world, ctx) {
    this.impacts = [];            // このフレームで壁や置物に当たって消えた弾
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      b.age += dt;
      b.prev = { x: b.p.x, y: b.p.y, z: b.p.z };   // 線分判定のため直前の位置を残す
      if (b.homing && ctx && ctx.seek) {
        const tg = ctx.seek(b);
        if (tg) {
          const want = new THREE.Vector3(tg.x - b.p.x, tg.y - b.p.y, tg.z - b.p.z).normalize();
          b.d.lerp(want, Math.min(1, b.homing * dt)).normalize();
        }
      }
      if (b.boomerang && ctx && ctx.home && b.age > b.life0 * 0.42) {
        b.returning = true;
      }
      if (b.returning && ctx && ctx.home) {
        const h = ctx.home;
        const want = new THREE.Vector3(h.x - b.p.x, (h.y + 1.3) - b.p.y, h.z - b.p.z);
        if (want.length() < 1.3) { this.list.splice(i, 1); continue; }
        b.d.lerp(want.normalize(), Math.min(1, 7 * dt)).normalize();
        b.life = Math.max(b.life, 0.3);
      }
      if (b.grow) b.r = b.r0 + b.grow * (b.age / b.life0);
      b.p.addScaledVector(b.d, b.speed * dt);
      b.life -= dt;
      if (b.life <= 0) { this.list.splice(i, 1); continue; }
      // 壁で消える（貫通弾も壁は抜けない）。直前位置から0.12刻みで確かめる
      const dx = b.p.x - b.prev.x, dz = b.p.z - b.prev.z;
      const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
      let hitWall = false;
      const probe = new THREE.Vector3();
      for (let k = 1; k <= n; k++) {
        probe.set(b.prev.x + dx * k / n, b.p.y, b.prev.z + dz * k / n);
        const before = probe.clone();
        world.resolve(probe, 0.12);
        if (before.distanceToSquared(probe) > 0.0001) { hitWall = true; break; }
      }
      if (hitWall) {
        if (b.boomerang && !b.returning) { b.returning = true; b.p.set(b.prev.x, b.prev.y, b.prev.z); }
        else if (!b.returning) {
          this.impacts.push({ p: probe.clone(), probe: b.probe, pierce: b.pierce });
          this.list.splice(i, 1);
        }
      }
    }
    this._sync();
  }
  _sync() {
    const cnt = {};
    Object.keys(this.looks).forEach(k => { cnt[k] = 0; });
    const t = performance.now() / 1000;
    for (const b of this.list) {
      if (b.probe) continue;
      const im = this.looks[b.look] || this.looks.orb;
      const k = b.look in cnt ? b.look : 'orb';
      const i = cnt[k]++;
      this._q.setFromUnitVectors(this._up, b.d);
      let sc = b.pierce && b.look === 'orb' ? 1.8 : 1;
      if (b.look === 'orb' && b.r > 0.3) sc = b.r / 0.2;
      if (b.look === 'wave') sc = b.r;
      if (b.look === 'star') {
        this._q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t * 22);
        sc = b.r;
      }
      if (b.look === 'page') this._q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(t * 12 + i) * 0.6));
      this._s.set(sc, sc, sc);
      this._m.compose(b.p, this._q, this._s);
      im.setMatrixAt(i, this._m);
    }
    Object.keys(this.looks).forEach(k => {
      const im = this.looks[k];
      im.count = cnt[k];
      im.visible = cnt[k] > 0;
      im.instanceMatrix.needsUpdate = true;
    });
  }
  clear() { this.list.length = 0; this._sync(); }
}

/* ── 敵の弾・地を打つ術（主・中ボス・思念体が使う） ── */
export class Hostile {
  constructor(scene, max) {
    this.max = max || 90;
    this.list = [];
    this.zones = [];          // 予兆つきの範囲攻撃
    this.blasts = [];         // このフレームで弾けた範囲攻撃
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.3, 1),
      glowMaterial(0xff3a5a, 3.0), this.max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    scene.add(this.mesh);
    this.halo = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2040, transparent: true, opacity: 0.28,
        blending: THREE.AdditiveBlending, depthWrite: false }), this.max);
    this.halo.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.halo.frustumCulled = false; this.halo.count = 0;
    scene.add(this.halo);
    // 範囲攻撃の輪（使い回す）
    this.zoneMeshes = [];
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40),
        new THREE.MeshBasicMaterial({ color: 0xff3040, transparent: true, opacity: 0.7,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 32),
        new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.2,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      fill.rotation.x = -Math.PI / 2;
      g.add(ring); g.add(fill);
      g.visible = false;
      scene.add(g);
      this.zoneMeshes.push({ g, ring, fill, used: false });
    }
    this._m = new THREE.Matrix4();
  }
  /** 弾を撃つ */
  fire(pos, dir, opts) {
    opts = opts || {};
    if (this.list.length >= this.max) this.list.shift();
    const d = dir.clone(); d.y = opts.keepY ? d.y : 0; d.normalize();
    this.list.push({ p: pos.clone(), d, speed: opts.speed || 9, life: opts.life || 4,
      r: opts.r || 0.4, power: opts.power || 100, magical: opts.magical !== false,
      size: opts.size || 1, curve: opts.curve || 0 });
  }
  /** 狙いを中心に扇状に撃つ */
  fan(pos, dir, n, spread, opts) {
    for (let i = 0; i < n; i++) {
      const a = (n === 1) ? 0 : (i - (n - 1) / 2) * spread;
      this.fire(pos, dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a), opts);
    }
  }
  /** 全周に撃つ */
  ring(pos, n, phase, opts) {
    for (let i = 0; i < n; i++) {
      const a = phase + i / n * Math.PI * 2;
      this.fire(pos, new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), opts);
    }
  }
  /** 予兆の輪を置き、delay秒後に弾ける */
  zone(x, z, r, delay, power) {
    const zm = this.zoneMeshes.find(m => !m.used);
    if (!zm) return;
    zm.used = true;
    zm.g.visible = true;
    zm.g.position.set(x, 0.07, z);
    zm.g.scale.set(r, 1, r);
    this.zones.push({ x, z, r, t: 0, delay: delay || 1.2, power: power || 120, zm });
  }
  update(dt, world) {
    this.blasts.length = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      if (b.curve) b.d.applyAxisAngle(new THREE.Vector3(0, 1, 0), b.curve * dt);
      b.p.addScaledVector(b.d, b.speed * dt);
      b.life -= dt;
      if (b.life <= 0) { this.list.splice(i, 1); continue; }
      if (world) {
        const before = b.p.clone();
        world.resolve(b.p, 0.1);
        if (before.distanceToSquared(b.p) > 0.0001) this.list.splice(i, 1);
      }
    }
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t += dt;
      const k = Math.min(1, z.t / z.delay);
      z.zm.fill.scale.setScalar(k);
      z.zm.ring.material.opacity = 0.4 + Math.abs(Math.sin(z.t * 12)) * 0.5;
      z.zm.fill.material.opacity = 0.12 + k * 0.3;
      if (z.t >= z.delay) {
        this.blasts.push(z);
        z.zm.used = false; z.zm.g.visible = false;
        this.zones.splice(i, 1);
      }
    }
    this._sync();
  }
  _sync() {
    const t = performance.now() / 1000;
    let n = 0;
    for (const b of this.list) {
      const sc = b.size * (1 + Math.sin(t * 14 + n) * 0.12);
      this._m.makeScale(sc, sc, sc);
      this._m.setPosition(b.p.x, b.p.y, b.p.z);
      this.mesh.setMatrixAt(n, this._m);
      this.halo.setMatrixAt(n, this._m);
      n++;
    }
    this.mesh.count = n; this.halo.count = n;
    this.mesh.visible = this.halo.visible = n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.halo.instanceMatrix.needsUpdate = true;
  }
  /** 当たった弾を取り除き、その威力を返す */
  hitTest(px, py, pz, r) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      const dx = b.p.x - px, dy = b.p.y - py, dz = b.p.z - pz;
      const rr = r + b.r * b.size;
      if (dx * dx + dz * dz < rr * rr && Math.abs(dy) < 1.4) {
        this.list.splice(i, 1);
        return b;
      }
    }
    return null;
  }
  clear() {
    this.list.length = 0;
    this.zones.forEach(z => { z.zm.used = false; z.zm.g.visible = false; });
    this.zones.length = 0;
    this._sync();
  }
}

/* ── 灰・火の粉の粒子 ───────────────────── */
export class Particles {
  constructor(scene, max) {
    this.max = max || 500;
    this.pos = new Float32Array(this.max * 3);
    this.vel = new Float32Array(this.max * 3);
    this.life = new Float32Array(this.max);
    this.size = new Float32Array(this.max);
    this.col = new Float32Array(this.max * 3);
    this.head = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {},
      vertexShader: `
        attribute float aSize; attribute vec3 aColor; varying vec3 vC;
        void main(){ vC=aColor;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = aSize * (220.0 / -mv.z);
          gl_Position = projectionMatrix * mv; }
      `,
      fragmentShader: `
        varying vec3 vC;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.05, length(d));
          if(a<0.01) discard;
          gl_FragColor = vec4(vC, a);
        }
      `
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = g;
  }
  emit(p, n, opts) {
    opts = opts || {};
    const spread = opts.spread || 2.2;
    const c = opts.color || [1, 0.86, 0.5];
    for (let k = 0; k < n; k++) {
      const i = this.head; this.head = (this.head + 1) % this.max;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y + (opts.yOff || 1);
      this.pos[i * 3 + 2] = p.z;
      this.vel[i * 3] = (Math.random() - 0.5) * spread;
      this.vel[i * 3 + 1] = (opts.up || 1.6) + Math.random() * spread * 0.6;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * spread;
      this.life[i] = opts.life || (0.7 + Math.random() * 0.8);
      this.size[i] = (opts.size || 2.6) * (0.6 + Math.random() * 0.8);
      this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2];
    }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 1.6 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] *= 0.985;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
  }
}

/* ── 敵の群れ ───────────────────────────── */
export class Enemies {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.list = [];
    this.meshes = {};
    this.hostile = null;           // 敵の弾（main から渡す）
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._yAxis = new THREE.Vector3(0, 1, 0);
    this._buildInstanced();
  }
  _buildInstanced() {
    const MAX = 40;
    const mk = (geo, mat) => {
      const im = new THREE.InstancedMesh(geo, mat, MAX);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = true; im.frustumCulled = false; im.count = 0;
      this.scene.add(im);
      return im;
    };
    const S = THREE.SphereGeometry, C = THREE.CapsuleGeometry, B = THREE.BoxGeometry,
      CO = THREE.ConeGeometry, CY = THREE.CylinderGeometry, TO = THREE.TorusGeometry;
    const G = {};
    // 歩兵ゾンビ：前かがみ、頭が垂れ、腕が長い
    G[0] = mergeParts([
      { g: new C(0.3, 0.62, 5, 9),  t: [0, 0.95, 0.06], r: [0.32, 0, 0] },
      { g: new S(0.23, 12, 10),     t: [0, 1.45, 0.28], s: [1, 0.92, 1.1] },
      { g: new B(0.26, 0.1, 0.12),  t: [0, 1.32, 0.46] },
      { g: new C(0.085, 0.62, 4, 7),t: [0.33, 0.92, 0.16], r: [0.5, 0, 0.16] },
      { g: new C(0.085, 0.66, 4, 7),t: [-0.33, 0.88, 0.2], r: [0.68, 0, -0.2] },
      { g: new C(0.1, 0.5, 4, 7),   t: [0.14, 0.34, 0] },
      { g: new C(0.1, 0.5, 4, 7),   t: [-0.14, 0.34, 0] },
      { g: new B(0.34, 0.05, 0.05), t: [0, 1.02, 0.24] },
      { g: new B(0.3, 0.05, 0.05),  t: [0, 0.9, 0.24] }
    ]);
    // 走行ゾンビ（グール）：四つん這いに近い低い姿勢
    G[1] = mergeParts([
      { g: new C(0.24, 0.72, 5, 9), t: [0, 0.72, 0], r: [1.15, 0, 0] },
      { g: new S(0.2, 12, 10),      t: [0, 0.78, 0.56], s: [1, 0.85, 1.25] },
      { g: new CO(0.09, 0.24, 6),   t: [0, 0.72, 0.78], r: [1.57, 0, 0] },
      { g: new C(0.07, 0.44, 4, 7), t: [0.26, 0.42, 0.3], r: [0.9, 0, 0] },
      { g: new C(0.07, 0.44, 4, 7), t: [-0.26, 0.42, 0.3], r: [0.9, 0, 0] },
      { g: new C(0.08, 0.46, 4, 7), t: [0.17, 0.34, -0.3], r: [-0.5, 0, 0] },
      { g: new C(0.08, 0.46, 4, 7), t: [-0.17, 0.34, -0.3], r: [-0.5, 0, 0] }
    ]);
    // 盾持ち：肥大した巨躯と分厚い板
    G[2] = mergeParts([
      { g: new C(0.42, 0.8, 6, 10), t: [0, 1.05, 0] },
      { g: new S(0.26, 12, 10),     t: [0, 1.66, 0.1], s: [1.1, 0.85, 1] },
      { g: new B(0.9, 1.25, 0.16),  t: [0, 1.05, 0.52] },
      { g: new B(0.95, 0.1, 0.06),  t: [0, 1.5, 0.6] },
      { g: new B(0.95, 0.1, 0.06),  t: [0, 0.6, 0.6] },
      { g: new C(0.13, 0.5, 4, 7),  t: [0.2, 0.32, 0] },
      { g: new C(0.13, 0.5, 4, 7),  t: [-0.2, 0.32, 0] }
    ]);
    // 飛行コウモリ
    G[3] = mergeParts([
      { g: new C(0.16, 0.3, 5, 8),  t: [0, 0, 0], r: [1.4, 0, 0] },
      { g: new S(0.15, 10, 8),      t: [0, 0.04, 0.24], s: [1, 0.9, 1.1] },
      { g: new CO(0.05, 0.16, 5),   t: [0.07, 0.16, 0.18], r: [-0.2, 0, -0.2] },
      { g: new CO(0.05, 0.16, 5),   t: [-0.07, 0.16, 0.18], r: [-0.2, 0, 0.2] },
      { g: new B(0.62, 0.03, 0.34), t: [0.42, 0.04, -0.05], r: [0, 0, 0.22] },
      { g: new B(0.62, 0.03, 0.34), t: [-0.42, 0.04, -0.05], r: [0, 0, -0.22] }
    ]);
    // スケルトン：細い骨と肋、剣
    G[4] = mergeParts([
      { g: new CY(0.05, 0.05, 0.8, 5), t: [0.13, 0.4, 0] }, { g: new CY(0.05, 0.05, 0.8, 5), t: [-0.13, 0.4, 0] },
      { g: new CY(0.05, 0.05, 0.7, 5), t: [0, 1.1, 0] },
      { g: new TO(0.2, 0.03, 5, 12, 4.4), t: [0, 1.25, 0], r: [1.57, 0, 0] },
      { g: new TO(0.18, 0.03, 5, 12, 4.4), t: [0, 1.12, 0], r: [1.57, 0, 0] },
      { g: new TO(0.16, 0.03, 5, 12, 4.4), t: [0, 0.99, 0], r: [1.57, 0, 0] },
      { g: new S(0.19, 10, 8), t: [0, 1.62, 0.04] },
      { g: new B(0.2, 0.08, 0.14), t: [0, 1.46, 0.08] },
      { g: new CY(0.035, 0.035, 0.7, 5), t: [0.3, 1.1, 0.1], r: [0.3, 0, 0.2] },
      { g: new CY(0.035, 0.035, 0.7, 5), t: [-0.3, 1.1, 0.1], r: [0.3, 0, -0.2] },
      { g: new B(0.06, 0.03, 0.9), t: [0.36, 0.85, 0.5] }
    ]);
    // マミー：包帯の巻かれた太い躯
    G[5] = mergeParts([
      { g: new C(0.36, 0.8, 6, 10), t: [0, 1.0, 0] },
      { g: new S(0.24, 12, 10), t: [0, 1.66, 0.06] },
      { g: new TO(0.37, 0.04, 5, 16), t: [0, 0.8, 0], r: [1.4, 0, 0] },
      { g: new TO(0.37, 0.04, 5, 16), t: [0, 1.1, 0], r: [1.8, 0, 0] },
      { g: new TO(0.25, 0.04, 5, 16), t: [0, 1.66, 0.06], r: [1.3, 0, 0] },
      { g: new C(0.1, 0.6, 4, 7), t: [0.36, 1.2, 0.35], r: [1.4, 0, 0] },
      { g: new C(0.1, 0.6, 4, 7), t: [-0.36, 1.2, 0.35], r: [1.4, 0, 0] },
      { g: new C(0.13, 0.5, 4, 7), t: [0.16, 0.32, 0] }, { g: new C(0.13, 0.5, 4, 7), t: [-0.16, 0.32, 0] }
    ]);
    // ゴースト：裾の消える霊体
    G[6] = mergeParts([
      { g: new CO(0.5, 1.4, 12, 1, true), t: [0, -0.3, 0], r: [Math.PI, 0, 0] },
      { g: new S(0.32, 12, 10), t: [0, 0.45, 0] },
      { g: new C(0.07, 0.5, 4, 7), t: [0.4, 0.2, 0.25], r: [1.2, 0, 0.3] },
      { g: new C(0.07, 0.5, 4, 7), t: [-0.4, 0.2, 0.25], r: [1.2, 0, -0.3] }
    ]);
    // 鬼火：燃える玉と尾
    G[7] = mergeParts([
      { g: new S(0.3, 12, 10), t: [0, 0, 0] },
      { g: new CO(0.26, 0.9, 10), t: [0, 0.1, -0.45], r: [-1.3, 0, 0] },
      { g: new CO(0.12, 0.5, 8), t: [0.15, 0.3, -0.2], r: [-0.8, 0, -0.3] }
    ]);
    // 屍狼
    G[8] = mergeParts([
      { g: new C(0.26, 0.8, 5, 9), t: [0, 0.75, 0], r: [1.57, 0, 0] },
      { g: new S(0.22, 10, 8), t: [0, 0.95, 0.6] },
      { g: new CO(0.12, 0.35, 6), t: [0, 0.88, 0.85], r: [1.57, 0, 0] },
      { g: new CO(0.06, 0.2, 5), t: [0.11, 1.15, 0.55] }, { g: new CO(0.06, 0.2, 5), t: [-0.11, 1.15, 0.55] },
      { g: new C(0.06, 0.5, 4, 6), t: [0.16, 0.32, 0.4] }, { g: new C(0.06, 0.5, 4, 6), t: [-0.16, 0.32, 0.4] },
      { g: new C(0.06, 0.5, 4, 6), t: [0.16, 0.32, -0.4] }, { g: new C(0.06, 0.5, 4, 6), t: [-0.16, 0.32, -0.4] },
      { g: new CO(0.08, 0.6, 5), t: [0, 0.9, -0.7], r: [-2.0, 0, 0] }
    ]);
    // 朽ち木：幹と枝の腕
    G[9] = mergeParts([
      { g: new CY(0.35, 0.55, 1.8, 9), t: [0, 0.9, 0] },
      { g: new CO(0.12, 1.0, 6), t: [0.5, 1.6, 0.1], r: [0, 0, -1.0] },
      { g: new CO(0.12, 1.0, 6), t: [-0.5, 1.5, 0.1], r: [0, 0, 1.1] },
      { g: new CO(0.08, 0.7, 5), t: [0.2, 2.1, -0.1], r: [0.3, 0, -0.4] },
      { g: new CO(0.1, 0.8, 5), t: [-0.25, 2.0, 0], r: [-0.2, 0, 0.5] },
      { g: new CO(0.1, 0.6, 5), t: [0.45, 0.15, 0.1], r: [0, 0, -1.9] },
      { g: new CO(0.1, 0.6, 5), t: [-0.45, 0.15, 0.1], r: [0, 0, 1.9] }
    ]);
    // 亡霊騎士：甲冑と盾と槍
    G[10] = mergeParts([
      { g: new C(0.34, 0.7, 6, 10), t: [0, 1.1, 0] },
      { g: new CY(0.2, 0.24, 0.4, 10), t: [0, 1.75, 0] },
      { g: new CO(0.06, 0.4, 5), t: [0, 2.1, 0] },
      { g: new S(0.2, 8, 6), t: [0.38, 1.5, 0], s: [1, 0.7, 1] }, { g: new S(0.2, 8, 6), t: [-0.38, 1.5, 0], s: [1, 0.7, 1] },
      { g: new B(0.7, 1.0, 0.1), t: [-0.3, 1.1, 0.45] },
      { g: new CY(0.03, 0.03, 2.2, 5), t: [0.4, 1.1, 0.4], r: [1.2, 0, 0] },
      { g: new C(0.12, 0.5, 4, 7), t: [0.16, 0.34, 0] }, { g: new C(0.12, 0.5, 4, 7), t: [-0.16, 0.34, 0] }
    ]);
    // ガーゴイル：石の翼と角
    G[11] = mergeParts([
      { g: new C(0.3, 0.5, 5, 9), t: [0, 0, 0], r: [0.4, 0, 0] },
      { g: new S(0.22, 10, 8), t: [0, 0.45, 0.2] },
      { g: new CO(0.05, 0.3, 5), t: [0.12, 0.7, 0.15], r: [-0.4, 0, -0.3] }, { g: new CO(0.05, 0.3, 5), t: [-0.12, 0.7, 0.15], r: [-0.4, 0, 0.3] },
      { g: new B(1.0, 0.04, 0.5), t: [0.6, 0.3, -0.2], r: [0, 0, 0.5] }, { g: new B(1.0, 0.04, 0.5), t: [-0.6, 0.3, -0.2], r: [0, 0, -0.5] },
      { g: new C(0.08, 0.4, 4, 6), t: [0.18, -0.45, 0.1] }, { g: new C(0.08, 0.4, 4, 6), t: [-0.18, -0.45, 0.1] }
    ]);
    // 氷霊：尖った氷の結晶体
    G[12] = mergeParts([
      { g: new THREE.OctahedronGeometry(0.4, 0), t: [0, 0, 0], s: [0.8, 1.6, 0.8] },
      { g: new THREE.OctahedronGeometry(0.2, 0), t: [0.45, 0.2, 0], s: [0.6, 1.4, 0.6], r: [0, 0, -0.6] },
      { g: new THREE.OctahedronGeometry(0.2, 0), t: [-0.45, 0.2, 0], s: [0.6, 1.4, 0.6], r: [0, 0, 0.6] },
      { g: new THREE.OctahedronGeometry(0.15, 0), t: [0, -0.6, 0], s: [0.6, 1.8, 0.6] }
    ]);
    // 雪鬼：毛深い巨躯
    G[13] = mergeParts([
      { g: new S(0.7, 12, 10), t: [0, 1.4, 0], s: [1, 1.1, 0.85] },
      { g: new S(0.35, 10, 8), t: [0, 2.2, 0.2] },
      { g: new CO(0.08, 0.35, 5), t: [0.2, 2.5, 0.1], r: [0, 0, -0.5] }, { g: new CO(0.08, 0.35, 5), t: [-0.2, 2.5, 0.1], r: [0, 0, 0.5] },
      { g: new C(0.2, 1.0, 5, 8), t: [0.75, 1.1, 0.2], r: [0.3, 0, 0.15] }, { g: new C(0.2, 1.0, 5, 8), t: [-0.75, 1.1, 0.2], r: [0.3, 0, -0.15] },
      { g: new C(0.22, 0.5, 5, 8), t: [0.3, 0.4, 0] }, { g: new C(0.22, 0.5, 5, 8), t: [-0.3, 0.4, 0] }
    ]);
    // 溶岩塊：ごつごつの岩の塊
    G[14] = mergeParts([
      { g: new THREE.DodecahedronGeometry(0.6, 0), t: [0, 0.8, 0] },
      { g: new THREE.DodecahedronGeometry(0.35, 0), t: [0.45, 1.3, 0.1] },
      { g: new THREE.DodecahedronGeometry(0.3, 0), t: [-0.4, 1.35, -0.1] },
      { g: new THREE.DodecahedronGeometry(0.3, 0), t: [0, 1.55, 0.2] },
      { g: new THREE.DodecahedronGeometry(0.28, 0), t: [0.3, 0.25, 0] }, { g: new THREE.DodecahedronGeometry(0.28, 0), t: [-0.3, 0.25, 0] }
    ]);
    // 火蜥蜴：低く長い体と尾
    G[15] = mergeParts([
      { g: new C(0.2, 0.9, 5, 9), t: [0, 0.4, 0], r: [1.57, 0, 0] },
      { g: new S(0.2, 10, 8), t: [0, 0.5, 0.7], s: [1, 0.8, 1.3] },
      { g: new CO(0.14, 1.0, 6), t: [0, 0.35, -0.95], r: [-1.57, 0, 0] },
      { g: new C(0.05, 0.3, 4, 6), t: [0.25, 0.2, 0.3], r: [0, 0, 0.8] }, { g: new C(0.05, 0.3, 4, 6), t: [-0.25, 0.2, 0.3], r: [0, 0, -0.8] },
      { g: new C(0.05, 0.3, 4, 6), t: [0.25, 0.2, -0.3], r: [0, 0, 0.8] }, { g: new C(0.05, 0.3, 4, 6), t: [-0.25, 0.2, -0.3], r: [0, 0, -0.8] },
      { g: new CO(0.06, 0.25, 5), t: [0, 0.7, 0.4] }, { g: new CO(0.06, 0.25, 5), t: [0, 0.68, 0.1] }
    ]);
    // 案山子：一本足と十字の腕、笠
    G[16] = mergeParts([
      { g: new CY(0.05, 0.05, 1.4, 5), t: [0, 0.7, 0] },
      { g: new CY(0.04, 0.04, 1.4, 5), t: [0, 1.4, 0], r: [0, 0, 1.57] },
      { g: new CO(0.4, 1.0, 8, 1, true), t: [0, 1.1, 0] },
      { g: new S(0.22, 10, 8), t: [0, 1.8, 0] },
      { g: new CO(0.55, 0.3, 12), t: [0, 2.05, 0] }
    ]);
    // ハーピー：鳥の翼と爪
    G[17] = mergeParts([
      { g: new C(0.22, 0.5, 5, 9), t: [0, 0, 0], r: [0.3, 0, 0] },
      { g: new S(0.17, 10, 8), t: [0, 0.5, 0.1] },
      { g: new B(1.2, 0.03, 0.45), t: [0.7, 0.2, -0.1], r: [0, 0.2, 0.35] }, { g: new B(1.2, 0.03, 0.45), t: [-0.7, 0.2, -0.1], r: [0, -0.2, -0.35] },
      { g: new CO(0.25, 0.6, 5), t: [0, -0.4, -0.35], r: [-2.4, 0, 0] },
      { g: new C(0.05, 0.4, 4, 6), t: [0.12, -0.45, 0.1] }, { g: new C(0.05, 0.4, 4, 6), t: [-0.12, -0.45, 0.1] }
    ]);
    // キョンシー：両腕を前に伸ばす
    G[18] = mergeParts([
      { g: new CY(0.28, 0.4, 1.3, 10), t: [0, 0.75, 0] },
      { g: new S(0.21, 10, 8), t: [0, 1.62, 0] },
      { g: new CY(0.22, 0.24, 0.24, 10), t: [0, 1.82, 0] },
      { g: new B(0.14, 0.3, 0.01), t: [0, 1.58, 0.21] },
      { g: new C(0.08, 0.6, 4, 7), t: [0.2, 1.3, 0.45], r: [1.57, 0, 0] }, { g: new C(0.08, 0.6, 4, 7), t: [-0.2, 1.3, 0.45], r: [1.57, 0, 0] }
    ]);
    // 泣き女：長い髪と裂けた衣
    G[19] = mergeParts([
      { g: new CO(0.45, 1.6, 12, 1, true), t: [0, -0.3, 0], r: [Math.PI, 0, 0] },
      { g: new S(0.2, 10, 8), t: [0, 0.65, 0] },
      { g: new C(0.18, 0.8, 5, 8), t: [0, 0.35, -0.12] },
      { g: new C(0.05, 0.7, 4, 6), t: [0.35, 0.4, 0.2], r: [0, 0, -1.9] }, { g: new C(0.05, 0.7, 4, 6), t: [-0.35, 0.4, 0.2], r: [0, 0, 1.9] }
    ]);

    const skin = (c, e) => new THREE.MeshStandardMaterial({
      color: c, roughness: 0.95, metalness: 0.02,
      emissive: new THREE.Color(e || 0x220a0a), emissiveIntensity: 0.35
    });
    const ghostly = (c, e, op) => new THREE.MeshStandardMaterial({
      color: c, roughness: 0.5, emissive: new THREE.Color(e), emissiveIntensity: 1.0,
      transparent: true, opacity: op, depthWrite: false
    });
    const MAT = {
      0: skin(0x6f7a52), 1: skin(0x8a5a3a), 2: metalMaterial(61, 0x5a6570), 3: skin(0x4a3a52),
      4: skin(0xe0d8c0, 0x1a1408), 5: skin(0xcfc0a0, 0x1a1408), 6: ghostly(0xc0e0ff, 0x4070a0, 0.55),
      7: ghostly(0x80c0ff, 0x4aa0ff, 0.85), 8: skin(0x4a4a50), 9: skin(0x4a3a28, 0x0a1a04),
      10: metalMaterial(63, 0x3a4050), 11: skin(0x6a6a70), 12: ghostly(0xb8e8ff, 0x60b0e0, 0.75),
      13: skin(0xe8eef4, 0x101820), 14: new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.9,
        emissive: new THREE.Color(0xff4010), emissiveIntensity: 0.9 }),
      15: skin(0xc04a1a, 0x401000), 16: skin(0xb89a5a), 17: skin(0x8a6a8a), 18: skin(0x2a3a5a),
      19: ghostly(0xe0d8ff, 0x8070c0, 0.6)
    };
    Object.keys(G).forEach(k => { this.meshes[k] = mk(G[k], MAT[k]); });
    this.meshes[7].castShadow = false; this.meshes[6].castShadow = false;
    this.meshes[12].castShadow = false; this.meshes[19].castShadow = false;

    // 隠しの間に眠る黄金の守り手（専用の姿）
    this.goldMesh = new THREE.InstancedMesh(
      this.meshes[EnemyKind.SHIELD].geometry,
      new THREE.MeshStandardMaterial({
        color: 0xffcf4a, emissive: new THREE.Color(0xff9a10), emissiveIntensity: 1.6,
        roughness: 0.2, metalness: 0.95
      }), 2);
    this.goldMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.goldMesh.frustumCulled = false;
    this.goldMesh.castShadow = true;
    this.scene.add(this.goldMesh);
    this.goldLight = new THREE.PointLight(0xffc040, 0, 26, 2);
    this.scene.add(this.goldLight);

    this.rareRings = new THREE.InstancedMesh(
      new THREE.TorusGeometry(0.55, 0.06, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0x9affd0, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false }),
      16);
    this.rareRings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rareRings.frustumCulled = false;
    this.scene.add(this.rareRings);
  }
  /** 階の深さに応じた強化率を決める */
  setFloor(floor) {
    this.floor = Math.max(1, floor || 1);
    this.hpMul = 1 + (this.floor - 1) * 0.55;
    this.spMul = Math.min(1.9, 1 + (this.floor - 1) * 0.06);
    this.dmgMul = 1 + (this.floor - 1) * 0.28;
    this.rareRate = Math.min(0.22, 0.03 + (this.floor - 1) * 0.018);
  }

  /** 中ボス：仕掛けを解くと目覚める。簡単には倒れない。鍵を落とす */
  spawnElite(pos, floor, id) {
    const f = Math.max(1, floor || 1);
    id = ELITES[id] ? id : 'deathknight';
    const hp = Math.round(70 * (1 + (f - 1) * 0.65));
    const form = buildElite(id);
    const model = new THREE.Group();
    form.root.scale.setScalar(1.25);
    model.add(form.root);
    // 守りの殻（無敵の間だけ見える）
    const ward = new THREE.Mesh(new THREE.SphereGeometry(2.4, 20, 14),
      new THREE.MeshBasicMaterial({ color: ELITES[id].aura, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ward.position.y = 1.8;
    model.add(ward);
    const light = new THREE.PointLight(ELITES[id].aura, 3.2, 16, 2);
    light.position.y = 3.0;
    model.add(light);
    // 足元の紋
    const sig = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 36),
      new THREE.MeshBasicMaterial({ color: ELITES[id].aura, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    sig.rotation.x = -Math.PI / 2; sig.position.y = 0.06;
    model.add(sig);
    model.position.copy(pos);
    this.scene.add(model);
    const e = {
      kind: EnemyKind.SHIELD, hp, maxHp: hp, eliteId: id, name: ELITES[id].name,
      p: pos.clone(), r: 1.5, speed: 2.8 * (this.spMul || 1),
      burn: 0, stagger: 0, dead: false, ash: 0, y: 0,
      phase: Math.random() * 6.28, rare: false, elite: true,
      model, form, wardMesh: ward, sig, aura: light,
      ai: { mode: 'chase', t: 0, cd: 2.2, atk: 0, n: 0 },
      power: Math.round(110 * (this.dmgMul || 1))
    };
    this.list.push(e);
    return e;
  }

  /** 隠しの間に眠る黄金の守り手。強く、輝き、稀なる宝を落とす */
  spawnGolden(pos, floor) {
    const f = Math.max(1, floor || 1);
    const hp = Math.round(120 * (1 + (f - 1) * 0.9));
    const e = {
      kind: EnemyKind.SHIELD, hp, maxHp: hp,
      p: pos.clone(), r: 2.2, speed: 3.0,
      burn: 0, stagger: 0, dead: false, ash: 0, y: 0,
      phase: 0, rare: false, elite: true, golden: true
    };
    this.list.push(e);
    return e;
  }

  spawn(kind, pos, forceRare) {
    const sp = SPEC[kind] || SPEC[0];
    if (!this.meshes[kind]) kind = 0;
    const rare = forceRare || (Math.random() < (this.rareRate || 0));
    const hm = (this.hpMul || 1) * (rare ? 4.5 : 1);
    const maxHp = Math.max(1, Math.round(sp.hp * hm));
    const e = {
      kind, hp: maxHp, maxHp,
      p: pos.clone(), r: sp.r * (rare ? 1.35 : 1),
      speed: sp.speed * (this.spMul || 1) * (rare ? 0.88 : 1),
      burn: 0, stagger: 0, dead: false, ash: 0,
      y: sp.fly || 0,
      phase: Math.random() * 6.28,
      shootT: (sp.ranged || 0) * (0.5 + Math.random()),
      rare: rare
    };
    this.list.push(e);
    return e;
  }
  _dropModel(e) {
    if (e.model) { this.scene.remove(e.model); e.model = null; }
  }
  clear() {
    this.list.forEach(e => this._dropModel(e));
    this.list.length = 0; this._sync();
  }
  get alive() { return this.list.filter(e => !e.dead && e.ash <= 0).length; }
  get eliteAlive() { return this.list.some(e => e.elite && !e.golden && !e.dead); }

  /** 体の中心の高さ */
  _cy(e) {
    if (e.elite) return e.y + 1.6;
    const sp = SPEC[e.kind];
    return sp && sp.fly ? e.y : e.y + 0.95;
  }

  /** 傷を与える（弾・近接の共通口）。倒れたら true */
  _damage(e, dmg, onKill, opts) {
    opts = opts || {};
    if (e.dead) return false;
    if (e.ward) return false;
    e.hp -= dmg;
    e.stagger = e.elite ? 0 : Math.max(e.stagger, opts.stun || 0.25);
    if (!e.elite) e.burn = Math.max(e.burn, 1.6);   // 中ボスは燃え尽きで倒れない
    if (this.particles) this.particles.emit(new THREE.Vector3(e.p.x, this._cy(e), e.p.z), 6, { color: [1, 0.7, 0.3], size: 2.2, yOff: 0 });
    if (e.hp <= 0) { e.dead = true; e.ash = 0.9; if (onKill) onKill(e); return true; }
    return false;
  }

  /** 弾との当たり判定。倒したら数を返す */
  hitTest(bullets, onKill, audio) {
    let killed = 0;
    for (let bi = bullets.list.length - 1; bi >= 0; bi--) {
      const b = bullets.list[bi];
      if (b.probe) continue;
      if (!b.hitSet) b.hitSet = new Set();
      for (const e of this.list) {
        if (e.dead) continue;
        if (b.pierce && b.hitSet.has(e)) continue;      // 貫通弾は同じ敵に一度だけ
        // この1フレームで弾が通った線分と、敵の球との最短距離で判定する
        const ex = e.p.x, ez = e.p.z, ey = this._cy(e);
        const px = b.prev ? b.prev.x : b.p.x, py = b.prev ? b.prev.y : b.p.y, pz = b.prev ? b.prev.z : b.p.z;
        const sx = b.p.x - px, sy = b.p.y - py, sz = b.p.z - pz;
        const seg2 = sx * sx + sy * sy + sz * sz;
        let t = 0;
        if (seg2 > 1e-6) {
          t = ((ex - px) * sx + (ey - py) * sy + (ez - pz) * sz) / seg2;
          t = Math.max(0, Math.min(1, t));
        }
        const dx = ex - (px + sx * t), dy = ey - (py + sy * t), dz = ez - (pz + sz * t);
        const sp = SPEC[e.kind];
        const vAllow = e.elite ? 1.9 : (sp && sp.fly ? 1.15 : 0.75);
        const hitR = e.r + b.r + (e.elite ? 0.9 : 0.45);
        const dyc = Math.max(0, Math.abs(dy) - vAllow);
        if (dx * dx + dyc * dyc + dz * dz < hitR * hitR) {
          // 盾を持つ者は正面からの通常弾を弾く
          if (!e.elite && sp && sp.front && !b.pierce && !b.breaker) {
            const toB = this._v.set(b.p.x - e.p.x, 0, b.p.z - e.p.z).normalize();
            if (e.facing && toB.dot(e.facing) > 0.2) {
              if (audio) audio.sfx('hit');
              bullets.list.splice(bi, 1);
              break;
            }
          }
          if (e.ward) {
            if (audio) audio.sfx('hit');
            if (this.particles) this.particles.emit(new THREE.Vector3(b.p.x, b.p.y, b.p.z), 4, { color: [0.6, 0.7, 1], size: 2, yOff: 0 });
            if (!b.pierce) { bullets.list.splice(bi, 1); break; }
            continue;
          }
          b.hitSet.add(e);
          if (this._damage(e, b.dmg, onKill, { stun: b.stun })) killed++;
          if (!b.pierce) { bullets.list.splice(bi, 1); break; }
        }
      }
    }
    return killed;
  }

  /**
   * 近接の一撃。扇形（arc）か直線（line）の中の敵すべてに当てる。
   * @returns 当たった敵の配列
   */
  strike(ox, oz, dx, dz, W, dmg, onKill, audio, opts) {
    opts = opts || {};
    const range = opts.range || W.range, aw = W.shape === 'line' ? (opts.width || W.width) : (opts.arc || W.arc);
    const hits = [];
    for (const e of this.list) {
      if (e.dead) continue;
      const sp = SPEC[e.kind];
      if (!e.elite && sp && sp.fly && e.y > 2.4) continue;
      if (!inShape(ox, oz, dx, dz, e.p.x, e.p.z, W.shape === 'line' ? 'line' : 'arc', range, aw, e.r * (e.elite ? 1.2 : 1))) continue;
      // 盾は正面から弾く（鈍器は盾ごと砕く）
      if (!e.elite && sp && sp.front && !W.breaker && e.facing) {
        const tx = ox - e.p.x, tz = oz - e.p.z, l = Math.hypot(tx, tz) || 1;
        if ((tx / l) * e.facing.x + (tz / l) * e.facing.z > 0.3) {
          if (audio) audio.sfx('hit');
          e.stagger = Math.max(e.stagger, 0.12);
          continue;
        }
      }
      if (e.ward) continue;
      hits.push(e);
      const n = W.hits || 1;
      for (let i = 0; i < n; i++) this._damage(e, dmg, onKill, { stun: W.stun || 0.3 });
      if (!e.elite && !e.dead) {
        const vx = e.p.x - ox, vz = e.p.z - oz, l = Math.hypot(vx, vz) || 1;
        if (W.knock) { e.p.x += vx / l * W.knock; e.p.z += vz / l * W.knock; }
        if (W.pull) { const pl = Math.min(W.pull, l - 1.2); if (pl > 0) { e.p.x -= vx / l * pl; e.p.z -= vz / l * pl; } }
      }
    }
    return hits;
  }

  _eliteAI(e, dt, target, world, audio) {
    const ai = e.ai;
    const dx = target.x - e.p.x, dz = target.z - e.p.z;
    const d = Math.hypot(dx, dz) || 1;
    const H = this.hostile;
    ai.cd -= dt; ai.t -= dt;
    ai.atk = Math.max(0, ai.atk - dt * 2.5);
    e.ward = false;
    const face = () => { e.facing = new THREE.Vector3(dx / d, 0, dz / d); };
    const muzzle = () => new THREE.Vector3(e.p.x, 1.8, e.p.z);
    if (ai.mode === 'chase') {
      face();
      if (d > 2.6) { e.p.x += dx / d * e.speed * dt; e.p.z += dz / d * e.speed * dt; }
      if (ai.cd <= 0) {
        ai.n++;
        const opts = ['volley', 'dash', 'zones', 'volley', 'ward', 'dash'];
        ai.mode = opts[(ai.n + Math.floor(Math.random() * 2)) % opts.length];
        ai.t = ai.mode === 'dash' ? 0.7 : ai.mode === 'ward' ? 2.2 : ai.mode === 'zones' ? 0.6 : 0.9;
        ai.shot = 0;
        if (ai.mode === 'dash') ai.dir = new THREE.Vector3(dx / d, 0, dz / d);
      }
    } else if (ai.mode === 'dash') {
      if (ai.t > 0.35) {
        // 予兆：身を沈めて震える
        e.model && (e.model.rotation.z = Math.sin(performance.now() / 30) * 0.08);
        face(); ai.dir.set(dx / d, 0, dz / d);
      } else {
        e.p.addScaledVector(ai.dir, 15 * dt);
        ai.atk = 1;
        if (this.particles && Math.random() < 0.5) this.particles.emit(e.p, 3, { color: [0.6, 0.6, 0.9], size: 3, up: 0.6, yOff: 1 });
      }
      if (ai.t <= 0) { ai.mode = 'chase'; ai.cd = 2.4; if (e.model) e.model.rotation.z = 0; }
    } else if (ai.mode === 'volley') {
      face();
      if (H && ai.shot < 3 && ai.t < 0.9 - ai.shot * 0.25) {
        ai.shot++;
        ai.atk = 1;
        H.fan(muzzle(), new THREE.Vector3(dx, 0, dz), 5, 0.22, { speed: 10 + this.floor * 0.1, power: e.power * 0.8, size: 0.9 });
        if (audio) audio.sfx('hit');
      }
      if (ai.t <= 0) { ai.mode = 'chase'; ai.cd = 2.6; }
    } else if (ai.mode === 'zones') {
      face();
      if (H && !ai.shot) {
        ai.shot = 1; ai.atk = 1;
        H.zone(target.x, target.z, 2.8, 1.1, e.power);
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * 6.28;
          H.zone(target.x + Math.cos(a) * 4, target.z + Math.sin(a) * 4, 2.4, 1.3 + i * 0.2, e.power);
        }
      }
      if (ai.t <= 0) { ai.mode = 'chase'; ai.cd = 2.8; }
    } else if (ai.mode === 'ward') {
      e.ward = true;
      face();
      if (ai.t <= 0) { ai.mode = 'chase'; ai.cd = 2.0; e.ward = false; if (H) H.ring(muzzle(), 12, Math.random(), { speed: 7, power: e.power * 0.7, size: 0.8 }); }
    }
    world.resolve(e.p, e.r);
  }

  update(dt, target, world, audio, onKill) {
    const now = performance.now() / 1000;
    this._tgt = target;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.ash > 0) {
        e.ash -= dt;
        if (this.particles && Math.random() < 0.6) {
          this.particles.emit(new THREE.Vector3(e.p.x, this._cy(e) - 0.8, e.p.z), 3, { color: [0.8, 0.8, 0.85], size: 2.0, up: 1.2 });
        }
        if (e.ash <= 0) { this._dropModel(e); this.list.splice(i, 1); }
        continue;
      }
      if (e.stagger > 0) { e.stagger -= dt; continue; }
      const sp = SPEC[e.kind] || SPEC[0];
      // 遠くの者は眠らせておく（端末の負荷を抑える。近づけば動き出す）
      const fx = target.x - e.p.x, fz = target.z - e.p.z;
      if (!e.elite && fx * fx + fz * fz > 48 * 48) continue;

      // 天窓の光に入ると浄化される
      const s = e.elite ? null : world.inShaft(e.p.x, e.p.z);
      if (s) {
        e.dead = true; e.ash = 0.7;
        if (onKill) onKill(e);          // 天窓の光で祓われた時も数える
        if (audio) audio.sfx('ash');
        if (this.particles) this.particles.emit(new THREE.Vector3(e.p.x, e.y, e.p.z), 22, { color: [1, 0.95, 0.7], size: 3.2, up: 3 });
        continue;
      }

      if (e.burn > 0) {
        e.burn -= dt;
        if (this.particles && Math.random() < 0.35) {
          this.particles.emit(new THREE.Vector3(e.p.x, e.y, e.p.z), 2, { color: [1, 0.5, 0.15], size: 1.8, up: 1.4 });
        }
        if (e.burn <= 0) {
          e.dead = true; e.ash = 0.8;
          if (onKill) onKill(e);        // 燃え尽きた時も撃破として扱う
          if (audio) audio.sfx('ash');
          continue;
        }
      }

      if (e.elite && !e.golden) { this._eliteAI(e, dt, target, world, audio); continue; }

      // 追跡
      const dx = target.x - e.p.x, dz = target.z - e.p.z;
      const d = Math.hypot(dx, dz) || 1;
      const dirx = dx / d, dirz = dz / d;
      e.facing = new THREE.Vector3(dirx, 0, dirz);
      let spd = e.speed;
      if (e.kind === EnemyKind.RUNNER || e.kind === EnemyKind.WOLF) spd *= (1 + Math.sin(now * 3.3 + e.phase) * 0.25);
      if (sp.hop) { const h = Math.sin(now * 6 + e.phase); spd *= Math.max(0, h) * 2.2; e.y = Math.max(0, h) * 0.45; }
      // 撃つ者は間合いを保つ
      if (sp.ranged) {
        if (d < 6) spd *= -0.6;
        else if (d < 11) spd *= 0.2;
        e.shootT -= dt;
        if (e.shootT <= 0 && d < 18 && this.hostile) {
          e.shootT = sp.ranged * (0.8 + Math.random() * 0.4);
          const from = new THREE.Vector3(e.p.x, Math.max(1.0, e.y), e.p.z);
          const pw = Math.round(70 * (this.dmgMul || 1));
          if (sp.ringShot) this.hostile.ring(from, 8, Math.random(), { speed: 6, power: pw, size: 0.6 });
          else this.hostile.fire(from, new THREE.Vector3(dx, 0, dz), { speed: 8.5, power: pw, size: 0.65 });
        }
      }
      e.p.x += dirx * spd * dt;
      e.p.z += dirz * spd * dt;
      if (sp.fly) {
        e.y = sp.fly + Math.sin(now * 2.5 + e.phase) * 0.35;
        if (!sp.wall) world.resolve(e.p, e.r);
      } else {
        world.resolve(e.p, e.r);
      }
    }
    this._sync();
  }

  /** 陽の化身・技に触れた不死者を即座に灰へ。消した数を返す */
  burnNear(px, pz, r, onKill) {
    let n = 0;
    for (const e of this.list) {
      if (e.dead) continue;
      const dx = e.p.x - px, dz = e.p.z - pz;
      if (dx * dx + dz * dz < r * r) {
        if (e.elite) { if (!e.ward) e.hp -= 12; if (e.hp > 0) continue; }
        e.dead = true; e.ash = 0.6; n++;
        if (onKill) onKill(e);
        if (this.particles) {
          this.particles.emit(new THREE.Vector3(e.p.x, e.y, e.p.z), 14,
            { color: [1, 0.9, 0.5], size: 3.2, up: 2.8 });
        }
      }
    }
    return n;
  }

  /** その場から敵を押し返す（巫女の杖） */
  pushAway(px, pz, r, force) {
    for (const e of this.list) {
      if (e.dead || e.elite) continue;
      const dx = e.p.x - px, dz = e.p.z - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        e.p.x += (dx / d) * force; e.p.z += (dz / d) * force;
      }
    }
  }

  /** プレイヤーへの接触判定 */
  get contactPower() { return Math.round(100 * (this.dmgMul || 1)); }

  touching(px, pz) {
    for (const e of this.list) {
      if (e.dead) continue;
      const sp = SPEC[e.kind] || SPEC[0];
      const R = e.elite ? e.r + 0.7 : sp.dmgR;
      if (sp.fly && !e.elite && e.y > 2.2) continue;
      const dx = e.p.x - px, dz = e.p.z - pz;
      if (dx * dx + dz * dz < R * R) return e;
    }
    return null;
  }

  /** 狙いを助ける：一番近い敵の方向へわずかに弾を寄せる */
  assistAim(from, dir, maxAngle) {
    let best = null, bestDot = Math.cos(maxAngle || 0.22);
    for (const e of this.list) {
      if (e.dead) continue;
      const ey = this._cy(e);
      const vx = e.p.x - from.x, vy = ey - from.y, vz = e.p.z - from.z;
      const len = Math.hypot(vx, vy, vz);
      if (len < 0.5 || len > 22) continue;
      const dot = (vx / len) * dir.x + (vz / len) * dir.z;
      if (dot > bestDot) { bestDot = dot; best = { x: vx / len, y: vy / len, z: vz / len }; }
    }
    return best;
  }

  /** いちばん近い敵（追尾弾の行き先） */
  nearest(p, maxD, cone, dir) {
    let best = null, bd = (maxD || 20) * (maxD || 20);
    for (const e of this.list) {
      if (e.dead) continue;
      const dx = e.p.x - p.x, dz = e.p.z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > bd) continue;
      if (cone && dir) { const l = Math.sqrt(d2) || 1; if ((dx * dir.x + dz * dir.z) / l < cone) continue; }
      bd = d2; best = e;
    }
    return best ? new THREE.Vector3(best.p.x, this._cy(best), best.p.z) : null;
  }

  _sync() {
    const counts = {};
    Object.keys(this.meshes).forEach(k => counts[k] = 0);
    const t = performance.now() / 1000;
    for (const e of this.list) {
      if (e.golden) continue;          // 黄金は専用の姿で描く
      if (e.elite) {
        if (!e.model) continue;
        const k = e.ash > 0 ? Math.max(0.01, e.ash) : 1;
        e.model.position.set(e.p.x, e.y, e.p.z);
        if (e.facing) {
          const want = Math.atan2(e.facing.x, e.facing.z);
          let diff = ((want - e.model.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          e.model.rotation.y += diff * 0.15;
        }
        e.model.scale.setScalar(k);
        const st = { atk: e.ai ? e.ai.atk : 0, rage: e.hp < e.maxHp * 0.4 ? 1 : 0 };
        e.form.anims.forEach(f => f(t, st));
        e.wardMesh.material.opacity = e.ward ? 0.22 + Math.sin(t * 20) * 0.08 : 0;
        e.sig.rotation.z = t * 0.8;
        e.aura.intensity = 3 + Math.sin(t * 3) * 0.8 + (st.rage ? 1.5 : 0);
        continue;
      }
      const im = this.meshes[e.kind];
      if (!im) continue;
      // 描く数には限りがあるので、遠い者は描かない（近くの者を優先）
      if (this._tgt && (e.p.x - this._tgt.x) ** 2 + (e.p.z - this._tgt.z) ** 2 > 70 * 70) continue;
      const idx = counts[e.kind]++;
      if (idx >= 40) continue;
      const scale = (e.ash > 0 ? Math.max(0.01, e.ash) : 1) * (e.rare ? 1.35 : 1);
      let yaw = e.facing ? Math.atan2(e.facing.x, e.facing.z) : 0;
      if (e.kind === EnemyKind.WISP || e.kind === EnemyKind.FROST) yaw += t * 2;
      this._q.setFromAxisAngle(this._yAxis, yaw);
      this._v.set(e.p.x, e.y, e.p.z);
      this._s.set(scale, scale, scale);
      this._m.compose(this._v, this._q, this._s);
      im.setMatrixAt(idx, this._m);
    }
    Object.keys(this.meshes).forEach(k => {
      const im = this.meshes[k];
      im.count = Math.min(40, counts[k]);
      im.visible = im.count > 0;
      im.instanceMatrix.needsUpdate = true;
    });
    // 黄金の守り手
    if (this.goldMesh) {
      let gn = 0;
      for (const e of this.list) {
        if (e.dead || !e.golden || gn >= this.goldMesh.count) continue;
        const sc = (e.ash > 0 ? Math.max(0.01, e.ash) : 1) * 3.2;
        this._m.makeRotationY(Math.atan2(e.facing ? e.facing.x : 0, e.facing ? e.facing.z : 1));
        this._m.setPosition(e.p.x, e.y + Math.sin(t * 1.6) * 0.12, e.p.z);
        this._m.scale(new THREE.Vector3(sc, sc, sc));
        this.goldMesh.setMatrixAt(gn++, this._m);
        if (this.goldLight) {
          this.goldLight.position.set(e.p.x, e.y + 2.4, e.p.z);
          this.goldLight.intensity = 4.5 + Math.sin(t * 3) * 1.2;
        }
      }
      for (let i = gn; i < this.goldMesh.count; i++) this.goldMesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001));
      this.goldMesh.instanceMatrix.needsUpdate = true;
      if (gn === 0 && this.goldLight) this.goldLight.intensity = 0;
    }

    // レアの輪
    if (this.rareRings) {
      let n = 0;
      for (const e of this.list) {
        if (e.dead || !(e.rare || e.golden) || n >= 16) continue;
        this._m.makeTranslation(e.p.x, this._cy(e) + 1.4 + Math.sin(t * 2 + e.phase) * 0.12, e.p.z);
        this._m.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        this._m.multiply(new THREE.Matrix4().makeRotationZ(t * 1.4));
        this.rareRings.setMatrixAt(n++, this._m);
      }
      this.rareRings.count = n;
      this.rareRings.visible = n > 0;
      this.rareRings.instanceMatrix.needsUpdate = true;
    }
  }
}
