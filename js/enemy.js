/* ══════════════════════════════════════════════════════════════
   enemy.js ── 4種の不死者と、弾・灰化の粒子
     歩兵ゾンビ／走行ゾンビ／盾持ち／飛行コウモリ
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { fleshMaterial, metalMaterial, glowMaterial } from './gfx.js';

export const EnemyKind = { WALKER: 0, RUNNER: 1, SHIELD: 2, BAT: 3 };

const SPEC = {
  0: { hp: 3, speed: 2.0, r: 0.55, dmgR: 1.2, color: 0x5c6b42 },
  1: { hp: 2, speed: 4.4, r: 0.5,  dmgR: 1.1, color: 0x7a5a3a },
  2: { hp: 6, speed: 1.5, r: 0.7,  dmgR: 1.4, color: 0x4a5560 },
  3: { hp: 2, speed: 5.0, r: 0.42, dmgR: 1.0, color: 0x3a2f40 }
};
SPEC[0].color = 0x5c6b42;

/* ── 弾 ─────────────────────────────────── */
export class Bullets {
  constructor(scene, max) {
    this.max = max || 90;
    this.list = [];
    const geo = new THREE.SphereGeometry(0.14, 8, 6);
    const mat = glowMaterial(0xffeeb0, 3.2);
    this.mesh = new THREE.InstancedMesh(geo, mat, this.max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this._m = new THREE.Matrix4();
    this._hide = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
  }
  fire(pos, dir, opts) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({
      p: pos.clone(), d: dir.clone().normalize(),
      speed: (opts && opts.speed) || 34,
      life: (opts && opts.life) || 1.5,
      pierce: !!(opts && opts.pierce),
      dmg: (opts && opts.dmg) || 1,
      r: (opts && opts.r) || 0.2
    });
  }
  update(dt, world) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      b.prev = { x: b.p.x, y: b.p.y, z: b.p.z };   // 線分判定のため直前の位置を残す
      b.p.addScaledVector(b.d, b.speed * dt);
      b.life -= dt;
      if (b.life <= 0) { this.list.splice(i, 1); continue; }
      // 壁で消える（貫通弾も壁は抜けない）
      const before = b.p.clone();
      world.resolve(b.p, 0.12);
      if (before.distanceToSquared(b.p) > 0.0001) this.list.splice(i, 1);
    }
    this._sync();
  }
  _sync() {
    for (let i = 0; i < this.max; i++) {
      if (i < this.list.length) {
        const b = this.list[i];
        this._m.makeTranslation(b.p.x, b.p.y, b.p.z);
        if (b.pierce) this._m.scale(new THREE.Vector3(1.8, 1.8, 1.8));
        this.mesh.setMatrixAt(i, this._m);
      } else {
        this.mesh.setMatrixAt(i, this._hide);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { this.list.length = 0; this._sync(); }
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
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._hide = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
    this._buildInstanced();
  }
  _buildInstanced() {
    const MAX = 40;
    const mk = (geo, mat) => {
      const im = new THREE.InstancedMesh(geo, mat, MAX);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = true; im.frustumCulled = false;
      this.scene.add(im);
      return im;
    };
    // 円錐や箱では怖くないので、部位を合成した「異形」の形を作る
    const merge = (parts) => {
      const geos = [];
      parts.forEach(p => {
        const g = p.g.clone();
        g.scale(p.s ? p.s[0] : 1, p.s ? p.s[1] : 1, p.s ? p.s[2] : 1);
        if (p.r) { g.rotateX(p.r[0] || 0); g.rotateY(p.r[1] || 0); g.rotateZ(p.r[2] || 0); }
        g.translate(p.t[0], p.t[1], p.t[2]);
        geos.push(g);
      });
      // BufferGeometryUtils を使わず、手でまとめる
      let total = 0, hasNormal = true;
      geos.forEach(g => { total += g.attributes.position.count; });
      const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
      const idx = []; let off = 0, vOff = 0;
      geos.forEach(g => {
        const pa = g.attributes.position.array, na = g.attributes.normal ? g.attributes.normal.array : null;
        pos.set(pa, off * 3);
        if (na) nor.set(na, off * 3); else hasNormal = false;
        const ia = g.index ? g.index.array : null;
        const n = g.attributes.position.count;
        if (ia) { for (let i = 0; i < ia.length; i++) idx.push(ia[i] + off); }
        else { for (let i = 0; i < n; i++) idx.push(i + off); }
        off += n; vOff++;
      });
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      if (hasNormal) out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      out.setIndex(idx);
      if (!hasNormal) out.computeVertexNormals();
      return out;
    };

    const S = THREE.SphereGeometry, C = THREE.CapsuleGeometry, B = THREE.BoxGeometry, CO = THREE.ConeGeometry;

    // 歩兵ゾンビ：前かがみ、頭が垂れ、腕が長い
    const walker = merge([
      { g: new C(0.3, 0.62, 5, 9),  t: [0, 0.95, 0.06], r: [0.32, 0, 0] },        // 胴（前傾）
      { g: new S(0.23, 12, 10),     t: [0, 1.45, 0.28], s: [1, 0.92, 1.1] },      // 頭
      { g: new B(0.26, 0.1, 0.12),  t: [0, 1.32, 0.46] },                          // 顎
      { g: new C(0.085, 0.62, 4, 7),t: [0.33, 0.92, 0.16], r: [0.5, 0, 0.16] },   // 右腕（垂れる）
      { g: new C(0.085, 0.66, 4, 7),t: [-0.33, 0.88, 0.2], r: [0.68, 0, -0.2] },  // 左腕
      { g: new C(0.1, 0.5, 4, 7),   t: [0.14, 0.34, 0] },                          // 右脚
      { g: new C(0.1, 0.5, 4, 7),   t: [-0.14, 0.34, 0] },                         // 左脚
      { g: new B(0.34, 0.05, 0.05), t: [0, 1.02, 0.24] },                          // 剥き出しの肋
      { g: new B(0.3, 0.05, 0.05),  t: [0, 0.9, 0.24] }
    ]);
    // 走行ゾンビ：四つん這いに近い低い姿勢
    const runner = merge([
      { g: new C(0.24, 0.72, 5, 9), t: [0, 0.72, 0], r: [1.15, 0, 0] },
      { g: new S(0.2, 12, 10),      t: [0, 0.78, 0.56], s: [1, 0.85, 1.25] },
      { g: new CO(0.09, 0.24, 6),   t: [0, 0.72, 0.78], r: [1.57, 0, 0] },        // 突き出た口
      { g: new C(0.07, 0.44, 4, 7), t: [0.26, 0.42, 0.3], r: [0.9, 0, 0] },
      { g: new C(0.07, 0.44, 4, 7), t: [-0.26, 0.42, 0.3], r: [0.9, 0, 0] },
      { g: new C(0.08, 0.46, 4, 7), t: [0.17, 0.34, -0.3], r: [-0.5, 0, 0] },
      { g: new C(0.08, 0.46, 4, 7), t: [-0.17, 0.34, -0.3], r: [-0.5, 0, 0] }
    ]);
    // 盾持ち：肥大した巨躯と分厚い板
    const shield = merge([
      { g: new C(0.42, 0.8, 6, 10), t: [0, 1.05, 0] },
      { g: new S(0.26, 12, 10),     t: [0, 1.66, 0.1], s: [1.1, 0.85, 1] },
      { g: new B(0.9, 1.25, 0.16),  t: [0, 1.05, 0.52] },                          // 盾
      { g: new B(0.95, 0.1, 0.06),  t: [0, 1.5, 0.6] },
      { g: new B(0.95, 0.1, 0.06),  t: [0, 0.6, 0.6] },
      { g: new C(0.13, 0.5, 4, 7),  t: [0.2, 0.32, 0] },
      { g: new C(0.13, 0.5, 4, 7),  t: [-0.2, 0.32, 0] }
    ]);
    // 飛行コウモリ：翼を広げた異形
    const bat = merge([
      { g: new C(0.16, 0.3, 5, 8),  t: [0, 0, 0], r: [1.4, 0, 0] },
      { g: new S(0.15, 10, 8),      t: [0, 0.04, 0.24], s: [1, 0.9, 1.1] },
      { g: new CO(0.05, 0.16, 5),   t: [0.07, 0.16, 0.18], r: [-0.2, 0, -0.2] },  // 耳
      { g: new CO(0.05, 0.16, 5),   t: [-0.07, 0.16, 0.18], r: [-0.2, 0, 0.2] },
      { g: new B(0.62, 0.03, 0.34), t: [0.42, 0.04, -0.05], r: [0, 0, 0.22] },    // 翼
      { g: new B(0.62, 0.03, 0.34), t: [-0.42, 0.04, -0.05], r: [0, 0, -0.22] }
    ]);

    const skin = (c) => new THREE.MeshStandardMaterial({
      color: c, roughness: 0.95, metalness: 0.02,
      emissive: new THREE.Color(0x220a0a), emissiveIntensity: 0.35
    });
    this.meshes[EnemyKind.WALKER] = mk(walker, skin(0x6f7a52));
    this.meshes[EnemyKind.RUNNER] = mk(runner, skin(0x8a5a3a));
    this.meshes[EnemyKind.SHIELD] = mk(shield, metalMaterial(61, 0x5a6570));
    this.meshes[EnemyKind.BAT]    = mk(bat,    skin(0x4a3a52));

    // レア個体の輪（頭上に浮かぶ）
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
    // 深いほど硬く、速く、痛い
    this.hpMul = 1 + (this.floor - 1) * 0.55;
    this.spMul = Math.min(1.9, 1 + (this.floor - 1) * 0.06);
    this.dmgMul = 1 + (this.floor - 1) * 0.28;
    this.rareRate = Math.min(0.22, 0.03 + (this.floor - 1) * 0.018);
  }

  spawn(kind, pos, forceRare) {
    const sp = SPEC[kind];
    const rare = forceRare || (Math.random() < (this.rareRate || 0));
    const hm = (this.hpMul || 1) * (rare ? 4.5 : 1);
    const maxHp = Math.max(1, Math.round(sp.hp * hm));
    this.list.push({
      kind, hp: maxHp, maxHp,
      p: pos.clone(), r: sp.r * (rare ? 1.35 : 1),
      speed: sp.speed * (this.spMul || 1) * (rare ? 0.88 : 1),
      burn: 0, stagger: 0, dead: false, ash: 0,
      y: kind === EnemyKind.BAT ? 1.8 : 0,
      phase: Math.random() * 6.28,
      rare: rare
    });
  }
  clear() { this.list.length = 0; this._sync(); }
  get alive() { return this.list.filter(e => !e.dead && e.ash <= 0).length; }

  /** 弾との当たり判定。倒したら数を返す */
  hitTest(bullets, onKill, audio) {
    let killed = 0;
    for (let bi = bullets.list.length - 1; bi >= 0; bi--) {
      const b = bullets.list[bi];
      for (const e of this.list) {
        if (e.dead) continue;
        // この1フレームで弾が通った線分と、敵の球との最短距離で判定する
        // （点で判定すると高速な弾が敵を飛び越してしまう）
        const ex = e.p.x, ey = e.y + 1.0, ez = e.p.z;
        const px = b.prev ? b.prev.x : b.p.x, py = b.prev ? b.prev.y : b.p.y, pz = b.prev ? b.prev.z : b.p.z;
        const sx = b.p.x - px, sy = b.p.y - py, sz = b.p.z - pz;
        const seg2 = sx * sx + sy * sy + sz * sz;
        let t = 0;
        if (seg2 > 1e-6) {
          t = ((ex - px) * sx + (ey - py) * sy + (ez - pz) * sz) / seg2;
          t = Math.max(0, Math.min(1, t));
        }
        const cx2 = px + sx * t, cy2 = py + sy * t, cz2 = pz + sz * t;
        const dx = ex - cx2, dy = ey - cy2, dz = ez - cz2;
        const hitR = e.r + b.r + 0.45;      // 当たりやすいよう少し余裕を持たせる
        if (dx * dx + dy * dy + dz * dz < hitR * hitR) {
          // 盾持ちは正面からの通常弾を弾く
          if (e.kind === EnemyKind.SHIELD && !b.pierce) {
            const toB = this._v.set(b.p.x - e.p.x, 0, b.p.z - e.p.z).normalize();
            const face = this._v.clone();
            if (e.facing && toB.dot(e.facing) < -0.2) {
              if (audio) audio.sfx('hit');
              if (!b.pierce) bullets.list.splice(bi, 1);
              break;
            }
          }
          e.hp -= b.dmg;
          e.stagger = 0.25;
          e.burn = Math.max(e.burn, 1.6);
          if (this.particles) this.particles.emit(new THREE.Vector3(e.p.x, e.y, e.p.z), 6, { color: [1, 0.7, 0.3], size: 2.2 });
          if (e.hp <= 0 && !e.dead) { e.dead = true; e.ash = 0.9; killed++; if (onKill) onKill(e); }
          if (!b.pierce) { bullets.list.splice(bi, 1); break; }
        }
      }
    }
    return killed;
  }

  update(dt, target, world, audio) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.ash > 0) {
        e.ash -= dt;
        if (this.particles && Math.random() < 0.6) {
          this.particles.emit(new THREE.Vector3(e.p.x, e.y, e.p.z), 3, { color: [0.8, 0.8, 0.85], size: 2.0, up: 1.2 });
        }
        if (e.ash <= 0) this.list.splice(i, 1);
        continue;
      }
      if (e.stagger > 0) { e.stagger -= dt; continue; }

      // 天窓の光に入ると浄化される
      const s = world.inShaft(e.p.x, e.p.z);
      if (s) {
        e.dead = true; e.ash = 0.7;
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
          if (audio) audio.sfx('ash');
          continue;
        }
      }

      // 追跡
      const dx = target.x - e.p.x, dz = target.z - e.p.z;
      const d = Math.hypot(dx, dz) || 1;
      const dirx = dx / d, dirz = dz / d;
      e.facing = new THREE.Vector3(dirx, 0, dirz);
      let sp = e.speed;
      if (e.kind === EnemyKind.RUNNER) sp *= (1 + Math.sin(performance.now() / 300 + e.phase) * 0.25);
      e.p.x += dirx * sp * dt;
      e.p.z += dirz * sp * dt;
      if (e.kind === EnemyKind.BAT) {
        e.y = 1.6 + Math.sin(performance.now() / 400 + e.phase) * 0.5;
      } else {
        world.resolve(e.p, e.r);
      }
    }
    this._sync();
  }

  /** 陽の化身に触れた不死者を即座に灰へ。消した数を返す */
  burnNear(px, pz, r) {
    let n = 0;
    for (const e of this.list) {
      if (e.dead) continue;
      const dx = e.p.x - px, dz = e.p.z - pz;
      if (dx * dx + dz * dz < r * r) {
        e.dead = true; e.ash = 0.6; n++;
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
      if (e.dead) continue;
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
      const sp = SPEC[e.kind];
      const dx = e.p.x - px, dz = e.p.z - pz;
      if (dx * dx + dz * dz < sp.dmgR * sp.dmgR) return e;
    }
    return null;
  }

  _sync() {
    const counts = {};
    Object.keys(this.meshes).forEach(k => counts[k] = 0);
    for (const e of this.list) {
      const im = this.meshes[e.kind];
      if (!im) continue;
      const idx = counts[e.kind]++;
      if (idx >= im.count) continue;
      const scale = (e.ash > 0 ? Math.max(0.01, e.ash) : 1) * (e.rare ? 1.35 : 1);
      this._m.makeTranslation(e.p.x, e.y, e.p.z);
      if (e.facing) {
        this._q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(e.facing.x, e.facing.z));
        this._m.multiply(new THREE.Matrix4().makeRotationFromQuaternion(this._q));
      }
      this._m.scale(new THREE.Vector3(scale, scale, scale));
      im.setMatrixAt(idx, this._m);
    }
    Object.keys(this.meshes).forEach(k => {
      const im = this.meshes[k];
      for (let i = counts[k]; i < im.count; i++) im.setMatrixAt(i, this._hide);
      im.instanceMatrix.needsUpdate = true;
    });
    // レアの輪
    if (this.rareRings) {
      let n = 0;
      const t = performance.now() / 1000;
      for (const e of this.list) {
        if (e.dead || !e.rare || n >= this.rareRings.count) continue;
        this._m.makeTranslation(e.p.x, e.y + 2.4 + Math.sin(t * 2 + e.phase) * 0.12, e.p.z);
        this._m.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        this._m.multiply(new THREE.Matrix4().makeRotationZ(t * 1.4));
        this.rareRings.setMatrixAt(n++, this._m);
      }
      for (let i = n; i < this.rareRings.count; i++) this.rareRings.setMatrixAt(i, this._hide);
      this.rareRings.instanceMatrix.needsUpdate = true;
    }
  }
}
