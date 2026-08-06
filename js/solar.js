/* ══════════════════════════════════════════════════════════════
   solar.js ── 太陽ボタン：陽の化身
     押すと「太陽！」と叫び、向日葵の妖精が現れ、天から陽が降りる。
     陽力が満ち、2分間だけ無敵・与ダメージ10倍になる。
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { glowMaterial, fleshMaterial } from './gfx.js';

export const SOLAR_DURATION = 120;   // 2分
export const SOLAR_DMG_MUL = 10;

export class Solar {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.active = false;
    this.time = 0;
    this.cd = 0;              // 再使用まで
    this.intro = 0;           // 降臨演出の残り
    this.group = new THREE.Group();
    this._build();
    scene.add(this.group);
    this.group.visible = false;
  }

  _build() {
    // ── 天から降る光柱 ──
    this.pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 3.4, 30, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff3c8, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      })
    );
    this.pillar.position.y = 15;
    this.group.add(this.pillar);

    // ── 足元の陣 ──
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 3.6, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd970, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.06;
    this.group.add(this.ring);

    this.light = new THREE.PointLight(0xfff0c0, 0, 34, 1.6);
    this.light.position.y = 3;
    this.group.add(this.light);

    // ── 向日葵の妖精 ──
    this.fairy = new THREE.Group();
    const petal = glowMaterial(0xffd23a, 1.9);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), petal);
      p.scale.set(1, 0.35, 2.1);
      p.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42);
      p.rotation.y = -a;
      this.fairy.add(p);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), fleshMaterial(0x5a3a1a));
    core.scale.set(1, 0.5, 1);
    this.fairy.add(core);
    // 顔
    [-1, 1].forEach(sx => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), fleshMaterial(0x1a1208));
      e.position.set(0.1 * sx, 0.16, 0.2);
      this.fairy.add(e);
    });
    // 羽
    [-1, 1].forEach(sx => {
      const w = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false })
      );
      w.scale.set(0.28, 1.1, 0.7);
      w.position.set(0.42 * sx, 0.08, -0.28);
      this.fairy.add(w);
      if (!this.wings) this.wings = [];
      this.wings.push(w);
    });
    this.fairy.position.set(1.5, 2.6, 0.4);
    this.group.add(this.fairy);

    // ── 化身のオーラ（主人公を包む） ──
    this.aura = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.2,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide })
    );
    this.aura.position.y = 1.2;
    this.group.add(this.aura);
  }

  get ready() { return !this.active && this.cd <= 0; }
  get remain() { return this.active ? Math.max(0, SOLAR_DURATION - this.time) : 0; }

  /** 発動。成功したら true */
  invoke(sun, audio) {
    if (!this.ready) return false;
    this.active = true;
    this.time = 0;
    this.intro = 2.2;
    sun.charge(100);                 // 陽力が満ちる
    if (audio) {
      audio.sfx('purify');
      audio.sfx('refill');
    }
    this.pillar.visible = true; this.ring.visible = true; this.aura.visible = true;
    this.group.visible = true;
    return true;
  }

  end() {
    this.active = false;
    this.time = 0;
    this.cd = 90;                    // 再使用まで90秒
    this.group.visible = false;
  }

  update(dt, playerPos, t) {
    if (this.cd > 0) this.cd -= dt;
    if (!this.active) return;

    this.time += dt;
    if (this.time >= SOLAR_DURATION) { this.end(); return; }

    this.group.position.set(playerPos.x, 0, playerPos.z);

    // 降臨演出（最初の2.2秒）
    if (this.intro > 0) {
      this.intro -= dt;
      const k = Math.max(0, this.intro / 2.2);
      this.pillar.visible = true;
      this.ring.visible = true;
      this.aura.visible = true;
      this.pillar.material.opacity = 0.10 + k * 0.28;
      this.pillar.scale.setScalar(0.6 + (1 - k) * 0.6);
      this.light.intensity = 2.5 + k * 5;
      if (this.particles && Math.random() < 0.9) {
        this.particles.emit(playerPos, 6, { color: [1, 0.95, 0.7], size: 4.2, up: -3.2, yOff: 8, life: 1.2 });
      }
    } else {
      // 降り注ぎは最初だけ。以後は柱も陣も消し、主人公自身が燃える
      this.pillar.visible = false;
      this.ring.visible = false;
      this.aura.visible = false;
      this.light.intensity = 1.4 + Math.sin(t * 3) * 0.25;   // 控えめに
    }

    // 陣とオーラ
    this.ring.rotation.z += dt * 1.1;
    this.ring.material.opacity = 0.4 + Math.sin(t * 3.2) * 0.14;
    this.aura.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
    this.aura.material.opacity = 0.16 + Math.sin(t * 5) * 0.05;

    // 妖精はふわふわ回りながら付いてくる
    const a = t * 0.8;
    this.fairy.position.set(Math.cos(a) * 1.9, 2.5 + Math.sin(t * 1.7) * 0.28, Math.sin(a) * 1.9);
    this.fairy.rotation.y = -a + Math.PI / 2;
    this.fairy.rotation.z = Math.sin(t * 2.2) * 0.16;
    if (this.wings) {
      const f = 0.6 + Math.abs(Math.sin(t * 18)) * 0.7;
      this.wings.forEach(w => { w.scale.y = 1.1 * f; });
    }

    // 光の粒
    if (this.particles && Math.random() < 0.45) {
      this.particles.emit(playerPos, 2, { color: [1, 0.93, 0.6], size: 2.6, up: 1.6, yOff: 0.6 });
    }
  }
}
