/* boss.js ── 吸血鬼（3フェーズ） */
import * as THREE from 'three';
import { fleshMaterial, glowMaterial, metalMaterial } from './gfx.js';

export class Boss {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.group = new THREE.Group();
    this.alive = false;
    this.maxHp = 340; this.hp = 340;   // 手応えのある体力
    this.phase = 1;
    this.p = new THREE.Vector3();
    this.r = 1.0;
    this.mist = 0;          // 霧化(無敵)
    this.stun = 0;          // 硬直
    this.atkCd = 1.6;
    this.clones = [];       // P2の分身
    this._build();
    scene.add(this.group);
    this.group.visible = false;
  }
  _build() {
    this.body = new THREE.Group();
    const cloth = (c, r) => new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? 0.85 : r, metalness: 0.05 });
    const emb = (c, i) => new THREE.MeshStandardMaterial({
      color: c, emissive: new THREE.Color(c), emissiveIntensity: i, roughness: 0.4, metalness: 0.2
    });

    // ── 長身痩躯の胴（黒の礼装） ──
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 1.0, 6, 12), cloth(0x120e18));
    torso.position.y = 1.75; torso.castShadow = true;
    this.body.add(torso);
    // 深紅の胸元
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.8, 0.12), cloth(0x5a0d14, 0.6));
    vest.position.set(0, 1.85, 0.3);
    this.body.add(vest);

    // ── 立ち襟のマント（背に大きく開く） ──
    this.cape = new THREE.Group();
    const capeMat = new THREE.MeshStandardMaterial({
      color: 0x0d0a12, roughness: 0.9, metalness: 0.02, side: THREE.DoubleSide
    });
    const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.9, 2.6, 16, 1, true, 0.6, Math.PI * 1.8), capeMat);
    cape.position.y = 1.55;
    cape.castShadow = true;
    this.cape.add(cape);
    // 裏地の深紅
    const lining = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 1.75, 2.5, 16, 1, true, 0.65, Math.PI * 1.7),
      new THREE.MeshStandardMaterial({ color: 0x6b0f18, roughness: 0.75, side: THREE.BackSide }));
    lining.position.y = 1.55;
    this.cape.add(lining);
    // 高い立ち襟
    [-1, 1].forEach(sx => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.95, 0.5), capeMat);
      col.position.set(0.34 * sx, 2.62, -0.16);
      col.rotation.z = sx * 0.28;
      col.rotation.x = -0.2;
      this.cape.add(col);
      const colIn = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.9, 0.46),
        new THREE.MeshStandardMaterial({ color: 0x6b0f18, roughness: 0.7 }));
      colIn.position.set(0.34 * sx, 2.62, -0.1);
      colIn.rotation.z = sx * 0.28; colIn.rotation.x = -0.2;
      this.cape.add(colIn);
    });
    this.body.add(this.cape);

    // ── 頭：面長・落ちくぼんだ眼窩・後ろへ流した髪 ──
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 16), cloth(0xd8cec4, 0.55));
    head.scale.set(0.88, 1.18, 0.95);
    head.position.y = 2.62; head.castShadow = true;
    this.body.add(head);
    // 尖った顎
    const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.3, 8), cloth(0xd8cec4, 0.55));
    jaw.position.set(0, 2.34, 0.06);
    jaw.rotation.x = Math.PI;
    this.body.add(jaw);
    // 後ろへ流した黒髪
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), cloth(0x0a0810));
    hair.scale.set(0.95, 1.15, 1.25);
    hair.position.set(0, 2.68, -0.06);
    this.body.add(hair);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.45, 5, 9), cloth(0x0a0810));
    tail.position.set(0, 2.42, -0.32);
    tail.rotation.x = 0.4;
    this.body.add(tail);

    // ── 赤く燃える眼 ──
    this.eyes = new THREE.Group();
    [-1, 1].forEach(sx => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), emb(0xff1a1a, 4.0));
      e.position.set(0.12 * sx, 2.66, 0.26);
      this.eyes.add(e);
    });
    this.body.add(this.eyes);
    // 眼窩の影
    [-1, 1].forEach(sx => {
      const so = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), cloth(0x2a1a1a, 1));
      so.scale.set(1, 0.7, 0.5);
      so.position.set(0.12 * sx, 2.66, 0.22);
      this.body.add(so);
    });

    // ── 長い牙 ──
    [-1, 1].forEach(sx => {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 6), cloth(0xfff4e8, 0.3));
      f.position.set(0.07 * sx, 2.42, 0.24);
      f.rotation.x = Math.PI;
      this.body.add(f);
    });

    // ── 骨ばった長い腕と鉤爪 ──
    this.arms = [];
    [-1, 1].forEach(sx => {
      const arm = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.6, 4, 8), cloth(0x120e18));
      upper.position.y = -0.3;
      arm.add(upper);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.55, 4, 8), cloth(0xd8cec4, 0.6));
      fore.position.y = -0.92;
      arm.add(fore);
      // 五本の鉤爪
      for (let i = 0; i < 5; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.26, 5), cloth(0x1a1218, 0.4));
        c.position.set((i - 2) * 0.055, -1.28, 0.02);
        c.rotation.x = Math.PI + 0.3;
        c.rotation.z = (i - 2) * 0.12;
        arm.add(c);
      }
      arm.position.set(0.44 * sx, 2.3, 0);
      arm.rotation.z = sx * 0.3;
      this.body.add(arm);
      this.arms.push({ g: arm, sx });
    });

    // ── 足元にわだかまる霧 ──
    this.mistMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x2a1a3a, transparent: true, opacity: 0.35,
        depthWrite: false, blending: THREE.NormalBlending })
    );
    this.mistMesh.scale.set(1.3, 0.28, 1.3);
    this.mistMesh.position.y = 0.22;
    this.body.add(this.mistMesh);

    this.aura = new THREE.PointLight(0xff2a2a, 2.4, 16, 2);
    this.aura.position.y = 2.5;
    this.body.add(this.aura);
    this.group.add(this.body);
    this.cloakMat = capeMat;
  }

  spawn(pos) {
    this.alive = true; this.hp = this.maxHp; this.phase = 1;
    this.p.copy(pos); this.mist = 0; this.stun = 0; this.atkCd = 2;
    this.dashCd = 3.5; this.batCd = 5;
    this.clones = [];
    this.group.visible = true;
    this.group.position.copy(this.p);
  }
  despawn() { this.alive = false; this.group.visible = false; this.clones.length = 0; }

  /** 弾を受ける。true=有効打 */
  takeHit(dmg, isPierce) {
    if (!this.alive) return false;
    if (this.mist > 0) {
      // 霧は通常弾で散らせる
      this.mist = Math.max(0, this.mist - 0.5);
      return false;
    }
    const mul = (this.phase === 3 && this.stun > 0 && isPierce) ? 4 : 1;
    this.hp = Math.max(0, this.hp - dmg * mul);
    return true;
  }

  update(dt, target, world, audio, onPhase) {
    if (!this.alive) return;
    const t = performance.now() / 1000;

    // フェーズ移行
    const ratio = this.hp / this.maxHp;
    if (this.phase === 1 && ratio <= 0.66) { this.phase = 2; this._enterP2(target); if (onPhase) onPhase(2); }
    else if (this.phase === 2 && ratio <= 0.33) { this.phase = 3; this._enterP3(); if (onPhase) onPhase(3); }

    if (this.stun > 0) {
      this.stun -= dt;
      this.body.rotation.z = Math.sin(t * 24) * 0.12;
      this.group.position.copy(this.p);
      return;
    }
    this.body.rotation.z *= 0.85;

    const dx = target.x - this.p.x, dz = target.z - this.p.z;
    const d = Math.hypot(dx, dz) || 1;

    if (this.phase === 1) {
      // 霧化して回避しつつ間合いを詰める
      this.mist = Math.max(0, this.mist - dt);
      if (this.mist <= 0 && Math.random() < dt * 0.9) {
        this.mist = 1.6;
        if (this.particles) this.particles.emit(this.p, 16, { color: [0.5, 0.4, 0.6], size: 3.4, up: 1.2 });
      }
      const sp = this.mist > 0 ? 9.5 : 4.2;
      this.p.x += (dx / d) * sp * dt;
      this.p.z += (dz / d) * sp * dt;
    } else if (this.phase === 2) {
      const sp = 5.0;
      this.p.x += (dx / d) * sp * dt;
      this.p.z += (dz / d) * sp * dt;
      // 分身を回転させる
      this.clones.forEach((c, i) => {
        const a = t * 1.5 + (i * Math.PI * 2 / this.clones.length);
        c.p.set(this.p.x + Math.cos(a) * 5.5, 0, this.p.z + Math.sin(a) * 5.5);
        c.mesh.position.copy(c.p);
      });
    } else {
      const sp = 4.0;
      this.p.x += (dx / d) * sp * dt;
      this.p.z += (dz / d) * sp * dt;
      // 窓の下に入ると硬直
      const s = world.inShaft(this.p.x, this.p.z);
      if (s && s.isBoss) {
        this.stun = 2.6;
        if (audio) audio.sfx('phase');
        if (this.particles) this.particles.emit(this.p, 24, { color: [1, 0.95, 0.7], size: 3.6, up: 3 });
      }
    }

    world.resolve(this.p, this.r);
    this.group.position.copy(this.p);
    this.group.rotation.y = Math.atan2(dx, dz);

    // 見た目：霧化は薄く
    this.cloakMat.opacity = this.mist > 0 ? 0.35 : 1;
    this.cloakMat.transparent = this.mist > 0;
    this.aura.intensity = 2.0 + Math.sin(t * 3) * 0.4 + (this.phase - 1) * 0.8;

    // 攻撃
    this.atkCd -= dt;
    if (this.atkCd <= 0 && d < 3.4) {
      this.atkCd = 1.0;
      return 'claw';
    }
    // 突進：間合いが開くと一気に詰める
    this.dashCd -= dt;
    if (this.dashCd <= 0 && d > 6 && this.mist <= 0) {
      this.dashCd = 4.5;
      this.p.x += (dx / d) * 5.5;
      this.p.z += (dz / d) * 5.5;
      world.resolve(this.p, this.r);
      if (this.particles) this.particles.emit(this.p, 14, { color: [0.5, 0.15, 0.25], size: 3.2, up: 1.6 });
      return 'dash';
    }
    return null;
  }

  _enterP2(target) {
    this.clones = [];
    for (let i = 0; i < 5; i++) {
      const mat = fleshMaterial(0x2a2230);
      // 本体は最も影が濃い＝暗い個体。分身は少し明るくする
      mat.color.multiplyScalar(1.32 + i * 0.09);
      const m = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.5, 10), mat);
      m.position.copy(this.p); m.castShadow = true;
      this.scene.add(m);
      this.clones.push({ mesh: m, p: this.p.clone() });
    }
  }
  _enterP3() {
    this.clones.forEach(c => this.scene.remove(c.mesh));
    this.clones = [];
  }
  cleanup() {
    this.clones.forEach(c => this.scene.remove(c.mesh));
    this.clones = [];
  }
}
