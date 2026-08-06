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

    this.box = new THREE.Group();
    const wood = stoneMaterial(71, 0x4a3a2a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 2.4), wood);
    b.position.y = 0.35; b.castShadow = true;
    this.box.add(b);
    const bandMat = metalMaterial(72, 0x8a7a44);
    [-0.7, 0.7].forEach(z => {
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.14, 0.16), bandMat);
      band.position.set(0, 0.35, z);
      this.box.add(band);
    });
    this.sealGlow = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 20), glowMaterial(0xffe9a8, 2.0));
    this.sealGlow.rotation.x = -Math.PI / 2;
    this.sealGlow.position.y = 0.74;
    this.box.add(this.sealGlow);
    // 鎖を掛ける環
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 8, 14), bandMat);
    hook.rotation.x = Math.PI / 2;
    hook.position.set(0, 0.5, 1.22);
    this.box.add(hook);
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
