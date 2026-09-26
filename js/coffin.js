/* coffin.js ── 灰の核 → 封印QTE → 運搬 */
import * as THREE from 'three';
import { metalMaterial, glowMaterial, stoneMaterial } from './gfx.js';

export class Coffin {
  constructor(scene, particles) {
    this.scene = scene; this.particles = particles;
    this.state = 'none';     // none / core / sealing / carry / done
    this.p = new THREE.Vector3();
    this.r = 1.1;
    this.sealHits = 0;       // QTE成功数（0〜4）
    this.sealTry = 0;
    this.qte = null;         // {t, dur, hit}
    this.integrity = 3;      // 攻撃を受けると減る
    this.group = new THREE.Group();
    this._build();
    scene.add(this.group);
    this.group.visible = false;
  }
  _build() {
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), glowMaterial(0xb0a0ff, 2.6));
    this.core.position.y = 0.8;
    this.group.add(this.core);
    this.coreLight = new THREE.PointLight(0xa090ff, 2.4, 10, 2);
    this.coreLight.position.y = 1;
    this.group.add(this.coreLight);

    // ── 棺：肩の張った六角の黒漆に、金の縁取り・隅金具・日輪の十字と紅玉、側面の把手、封じの鎖 ──
    this.box = new THREE.Group();
    const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x1a0608, roughness: 0.22, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 });
    const velvet = new THREE.MeshStandardMaterial({ color: 0x5a0a14, roughness: 0.9 });
    const gold = metalMaterial(72, 0xd8aa3a), bandMat = gold;
    const ruby = glowMaterial(0xff2a4a, 2.2, true);
    this._ruby = ruby;
    // 上から見た輪郭（頭 +Z が細く、肩で最も広く、足へ細まる）
    const outline = [[0, 1.22], [0.34, 1.22], [0.6, 0.62], [0.36, -1.22], [-0.36, -1.22], [-0.6, 0.62], [-0.34, 1.22]];
    const shapeOf = (k) => { const sh = new THREE.Shape(); outline.forEach(([x, z], i) => { if (i === 0) sh.moveTo(x * k, z * k); else sh.lineTo(x * k, z * k); }); sh.closePath(); return sh; };
    const slab = (k, h, y, mat, bevel) => {
      const g = new THREE.ExtrudeGeometry(shapeOf(k), { depth: h, bevelEnabled: !!bevel, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, steps: 1 });
      g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
      const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
      this.box.add(m); return m;
    };
    slab(1.04, 0.08, 0.0, gold);              // 台座の金
    slab(1.0, 0.56, 0.08, lacquer);           // 胴
    slab(1.03, 0.05, 0.62, gold);             // 胴と蓋の境の金帯
    slab(0.97, 0.16, 0.67, lacquer, true);    // 蓋
    slab(0.8, 0.05, 0.86, velvet);            // 蓋の上の天鵞絨の段
    // 縁取り：輪郭に沿って金の棒
    const edge = (y, k, r) => {
      for (let i = 0; i < outline.length; i++) {
        const [x0, z0] = outline[i], [x1, z1] = outline[(i + 1) % outline.length];
        const A = new THREE.Vector3(x0 * k, y, -z0 * k), B = new THREE.Vector3(x1 * k, y, -z1 * k);
        const d = B.clone().sub(A), L = d.length();
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), gold);
        m.position.copy(A.clone().add(B).multiplyScalar(0.5));
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
        this.box.add(m);
      }
    };
    edge(0.9, 0.82, 0.018); edge(0.84, 0.99, 0.022);
    // 隅金具（六つの角に金の飾りと小さな尖り）
    outline.slice(1).forEach(([x, z]) => {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), gold); c.position.set(x * 1.02, 0.66, -z * 1.02); this.box.add(c);
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 8), gold); sp.position.set(x * 1.02, 0.76, -z * 1.02); this.box.add(sp);
    });
    // 日輪の十字と紅玉（蓋の上）
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 1.5), gold); crossV.position.set(0, 0.9, -0.05); this.box.add(crossV);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.1), gold); crossH.position.set(0, 0.9, -0.4); this.box.add(crossH);
    const sun = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 10, 32), gold); sun.rotation.x = -Math.PI / 2; sun.position.set(0, 0.91, -0.4); this.box.add(sun);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, ray = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.09, 6), gold);
      ray.position.set(Math.cos(a) * 0.24, 0.91, -0.4 + Math.sin(a) * 0.24); ray.rotation.set(Math.PI / 2, 0, -a + Math.PI / 2); this.box.add(ray);
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 1), ruby); gem.scale.set(1, 0.6, 1); gem.position.set(0, 0.95, -0.4); this.box.add(gem);
    // 側面の把手（左右三つずつ）
    [-1, 1].forEach(sd => [0.35, -0.2, -0.75].forEach(z => {
      const w = z > 0.3 ? 0.58 : 0.5 - (0.3 - z) * 0.1;
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.016, 8, 16, Math.PI), gold);
      h.rotation.set(0, sd * Math.PI / 2, Math.PI); h.position.set(sd * (w + 0.02), 0.4, -z); this.box.add(h);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.22), gold); plate.position.set(sd * w, 0.45, -z); this.box.add(plate);
    }));
    // 封じの鎖：胴に巻き付く二重の輪
    const linkM = metalMaterial(73, 0x9a8a5a);
    [0.45, -0.55].forEach(z => {
      for (let i = 0; i < 14; i++) {
        const t = i / 13, x = -0.5 + t * 1.0;
        const l = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 12), linkM);
        l.position.set(x * (z > 0 ? 1 : 0.82), 0.93 + Math.sin(t * Math.PI) * 0.02, -z); l.rotation.set(0, (i % 2) ? Math.PI / 2 : 0, Math.PI / 2);
        this.box.add(l);
      }
    });
    this.sealGlow = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.018, 8, 40), glowMaterial(0xffe9a8, 2.0));
    this.sealGlow.rotation.x = -Math.PI / 2;
    this.sealGlow.position.set(0, 0.93, -0.4);
    this.box.add(this.sealGlow);
    // 鎖を掛ける環（足もと）
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 8, 14), bandMat);
    hook.rotation.x = Math.PI / 2;
    hook.position.set(0, 0.5, 1.28);
    this.box.add(hook);
    this.box.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.box.visible = false;
    this.group.add(this.box);

    // ── 鎖（掴んでいる間だけ現れる） ──
    this.chain = new THREE.Group();
    this.chainLinks = [];
    const linkMat = metalMaterial(73, 0x9a8a5a);
    for (let i = 0; i < 12; i++) {
      const l = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.026, 6, 12), linkMat);
      l.rotation.x = (i % 2) ? Math.PI / 2 : 0;
      this.chain.add(l);
      this.chainLinks.push(l);
    }
    this.chain.visible = false;
    this.scene.add(this.chain);
  }
  spawnCore(pos) {
    this.state = 'core';
    this.p.copy(pos); this.p.y = 0;
    this.group.position.copy(this.p);
    this.group.visible = true;
    this.core.visible = true; this.box.visible = false;
    this.sealHits = 0; this.sealTry = 0; this.integrity = 3;
  }
  /** 封印QTEを1回開始 */
  startQte() {
    if (this.sealTry >= 4) return false;
    this.state = 'sealing';
    this.qte = { t: 0, dur: 1.25, hit: false };
    this.sealTry++;
    return true;
  }
  /** タイミング入力。円が最小に近いほど成功 */
  tapQte() {
    if (!this.qte || this.qte.hit) return null;
    const ratio = this.qte.t / this.qte.dur;      // 0→1で縮む
    const diff = Math.abs(ratio - 0.82);          // 0.82あたりが「ちょうど」
    this.qte.hit = true;
    if (diff < 0.07) { this.sealHits++; return 'perfect'; }
    if (diff < 0.15) { this.sealHits++; return 'good'; }
    return 'miss';
  }
  update(dt, t) {
    if (!this.group.visible) return;
    if (this.state === 'core' || this.state === 'sealing') {
      this.core.rotation.y += dt * 1.2;
      this.core.rotation.x += dt * 0.6;
      this.core.position.y = 0.8 + Math.sin(t * 2) * 0.12;
      this.coreLight.intensity = 2.4 + Math.sin(t * 4) * 0.5;
      if (this.particles && Math.random() < 0.3) {
        this.particles.emit(this.p, 2, { color: [0.65, 0.55, 1], size: 2.2, up: 1.2, yOff: 0.8 });
      }
    }
    if (this.qte) {
      this.qte.t += dt;
      if (this.qte.t >= this.qte.dur) {
        if (!this.qte.hit) { /* 見逃し＝失敗 */ }
        this.qte = null;
        if (this.sealTry >= 4) this.sealComplete();
        else this.startQte();
      }
    }
    if (this.state === 'carry') {
      this.sealGlow.material.emissiveIntensity = 1.2 + this.integrity * 0.4 + Math.sin(t * 3) * 0.2;
      if (this._ruby) this._ruby.emissiveIntensity = 1.8 + Math.sin(t * 2.2) * 0.8;
      this.group.position.copy(this.p);
    }
  }
  sealComplete() {
    this.state = 'carry';
    this.core.visible = false;
    this.box.visible = true;
  }
  /** 鎖を掛ける（長押しの間だけ） */
  grab(px, pz) {
    const d = Math.hypot(this.p.x - px, this.p.z - pz);
    if (d > 3.6) return false;
    this.chained = true;
    this.chain.visible = true;
    return true;
  }
  release() {
    this.chained = false;
    this.chain.visible = false;
  }

  /**
   * 鎖で曳く。プレイヤーが動けば棺も付いてくる。
   * 鎖の長さ(2.2)を超えたぶんだけ引き寄せられる。
   */
  drag(px, pz, dt, world) {
    if (!this.chained) return false;
    const LEN = 2.2;
    const dx = this.p.x - px, dz = this.p.z - pz;
    const d = Math.hypot(dx, dz) || 0.0001;
    if (d > LEN) {
      const over = d - LEN;
      const k = Math.min(1, dt * 9);          // 少し遅れて付いてくる
      this.p.x -= (dx / d) * over * k;
      this.p.z -= (dz / d) * over * k;
      world.resolve(this.p, this.r);
    }
    this.group.rotation.y = Math.atan2(dx, dz);
    return true;
  }

  /** 鎖の描画をプレイヤーと棺の間に張る */
  drawChain(px, pz) {
    if (!this.chained) return;
    const ax = px, az = pz, ay = 1.05;
    const bx = this.p.x, bz = this.p.z, by = 0.5;
    const n = this.chainLinks.length;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const sag = Math.sin(t * Math.PI) * 0.22;
      const l = this.chainLinks[i];
      l.position.set(ax + (bx - ax) * t, ay + (by - ay) * t - sag, az + (bz - az) * t);
      l.lookAt(bx, by, bz);
      if (i % 2) l.rotateZ(Math.PI / 2);
    }
  }
  damage() {
    this.integrity = Math.max(0, this.integrity - 1);
    return this.integrity <= 0;
  }
  hide() { this.group.visible = false; this.state = 'none'; }
  /** 封印率（0〜1）：QTE成功数から */
  get sealRatio() { return this.sealHits / 4; }
}
