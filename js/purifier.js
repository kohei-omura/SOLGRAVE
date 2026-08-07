/* ══════════════════════════════════════════════════════════════
   purifier.js ── 神聖機器
     棺を台座に据えると四方の柱から光線が走り、浄化が始まる。
     照射のあいだ、棺から吸血鬼の思念体が這い出して暴れ、
     棺を台座から引き剥がす。棺を撃って暴れを鎮め、
     台座へ押し戻すと再び照射が始まる。
     思念体の体力が尽きたとき、完全浄化となる。
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { metalMaterial, glowMaterial, stoneMaterial, fleshMaterial } from './gfx.js';

export const PURIFY_HP = 100;

export class Purifier {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.active = false;
    this.done = false;
    this.hp = PURIFY_HP;          // 思念体の残り
    this.beaming = false;         // 照射中か
    this.socket = new THREE.Vector3(0, 0, 0);
    this.socketR = 2.0;
    this.rage = 0;                // 反発の強さ 0〜1
    this.purity = 1;              // 陽光の輝き 1=澄む 0=黒ずむ
    this.shots = 0;               // 機器に撃ち込んだ回数
    this.dark = 0;                // 黒ずんだまま経った時間
    this.group = new THREE.Group();
    this._build();
    scene.add(this.group);
    this.group.visible = false;
  }

  _build() {
    // ── 台座 ──
    const base = stoneMaterial(81, 0x9a9287);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 0.5, 24), base);
    b.position.y = 0.25; b.receiveShadow = true;
    this.group.add(b);
    // 台座の紋
    this.seal = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 2.2, 40),
      new THREE.MeshBasicMaterial({ color: 0xffe1a0, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    this.seal.rotation.x = -Math.PI / 2;
    this.seal.position.y = 0.52;
    this.group.add(this.seal);

    // ── 四方の柱と照射口 ──
    this.emitters = [];
    const frame = metalMaterial(82, 0x8d94a2);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const px = Math.cos(a) * 5.2, pz = Math.sin(a) * 5.2;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.0, 0.5), frame);
      pillar.position.set(px, 2.5, pz);
      pillar.castShadow = true;
      this.group.add(pillar);
      // 天冠
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.7, 8), frame);
      cap.position.set(px, 5.3, pz);
      this.group.add(cap);
      // 照射口の玉
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), glowMaterial(0xfff0c0, 0.4));
      lens.position.set(px, 4.1, pz);
      this.group.add(lens);
      // 光線（照射中だけ現れる）
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.2, 1, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 0.75,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      );
      beam.visible = false;
      this.group.add(beam);
      const lt = new THREE.PointLight(0xffe6b0, 0, 12, 2);
      lt.position.set(px, 4.1, pz);
      this.group.add(lt);
      this.emitters.push({ pillar, lens, beam, light: lt, x: px, z: pz, y: 4.1 });
    }

    // ── 思念体（棺から這い出す影） ──
    this.wraith = new THREE.Group();
    const wm = new THREE.MeshStandardMaterial({
      color: 0x2a1030, roughness: 0.9, transparent: true, opacity: 0.82,
      emissive: new THREE.Color(0x3a0a12), emissiveIntensity: 0.9
    });
    const wbody = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.6, 12), wm);
    wbody.position.y = 1.3;
    this.wraith.add(wbody);
    const wh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), wm);
    wh.scale.set(0.88, 1.15, 0.9);
    wh.position.y = 2.6;
    this.wraith.add(wh);
    [-1, 1].forEach(sx => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glowMaterial(0xff2a2a, 4.2));
      e.position.set(0.11 * sx, 2.66, 0.25);
      this.wraith.add(e);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 1.0, 4, 8), wm);
      arm.position.set(0.72 * sx, 1.8, 0);
      arm.rotation.z = sx * 0.55;
      this.wraith.add(arm);
      this.wraithArms = this.wraithArms || [];
      this.wraithArms.push({ m: arm, sx });
    });
    this.wraithLight = new THREE.PointLight(0xff2a2a, 0, 14, 2);
    this.wraithLight.position.y = 2.4;
    this.wraith.add(this.wraithLight);
    this.wraith.visible = false;
    this.group.add(this.wraith);
  }

  place(pos) {
    this.group.position.copy(pos);
    this.socket.copy(pos);
    this.group.visible = true;
  }

  begin(sunPower) {
    this.active = true; this.done = false;
    this.hp = PURIFY_HP;
    this.rage = 0; this.purity = 1; this.shots = 0; this.dark = 0;
    this.sunAtStart = sunPower;
    this.wraith.visible = true;
    // 陽力が高いほど浄化が速く進む
    this.rate = 3.2 + (sunPower / 100) * 4.0;
  }

  /** 棺が台座に乗っているか */
  onSocket(coffinPos) {
    if (!coffinPos) return false;
    const dx = coffinPos.x - this.socket.x, dz = coffinPos.z - this.socket.z;
    return dx * dx + dz * dz < this.socketR * this.socketR;
  }

  /** 神聖機器に陽光弾が当たった。陽光が輝きを取り戻す */
  hitDevice(bx, bz) {
    if (!this.active) return false;
    // 台座の周りか、四本の柱のいずれかに当たれば有効
    const dx = bx - this.socket.x, dz = bz - this.socket.z;
    let ok = (dx * dx + dz * dz) < 3.4 * 3.4;
    if (!ok) {
      for (const e of this.emitters) {
        const ex = this.socket.x + e.x, ez = this.socket.z + e.z;
        if (Math.hypot(bx - ex, bz - ez) < 1.6) { ok = true; break; }
      }
    }
    if (!ok) return false;
    this.shots++;
    this.purity = Math.min(1, this.purity + 0.34);
    this.rage = Math.max(0, this.rage - 0.28);
    return true;
  }

  /** 当てる的の位置（画面案内用） */
  get corePos() { return this.socket; }

  /**
   * @param coffinPos 棺の現在地（暴れで押し出す）
   * @returns 押し出しベクトル {x,z}
   */
  update(dt, t, coffinPos) {
    const push = { x: 0, z: 0 };
    if (!this.group.visible || !coffinPos) return push;

    this.seal.rotation.z += dt * 0.5;

    if (!this.active) {
      this.emitters.forEach(e => {
        e.beam.visible = false; e.light.intensity = 0; e.lens.material.emissiveIntensity = 0.4;
      });
      return push;
    }

    // ── 思念体が反発し、陽光が黒ずんでいく ──
    this.rage = Math.min(1, this.rage + dt * 0.16);
    this.purity = Math.max(0, this.purity - (0.055 + this.rage * 0.10) * dt);
    this.beaming = this.purity > 0.06;

    // 澄んだ光のときだけ浄化が進む（黒ずむほど効かない）
    const eff = Math.max(0, (this.purity - 0.18) / 0.82);
    if (eff > 0) {
      this.hp = Math.max(0, this.hp - this.rate * eff * dt);
      this.dark = 0;
      if (this.particles && Math.random() < 0.5 * eff) {
        this.particles.emit(coffinPos, 2, { color: [1, 0.95, 0.75], size: 2.8, up: 2.2, yOff: 0.6 });
      }
    } else {
      this.dark += dt;
    }
    if (this.hp <= 0) { this.active = false; this.done = true; this.wraith.visible = false; }

    // ── 光線の見た目：澄んだ金 → 黒ずんだ紫 ──
    const p = this.purity;
    const cr = 0.10 + p * 0.90, cg = 0.03 + p * 0.92, cb = 0.14 + p * 0.68;
    this.emitters.forEach((e, i) => {
      e.beam.visible = this.beaming || p > 0.02;
      const from = new THREE.Vector3(e.x, e.y, e.z);
      const to = new THREE.Vector3(coffinPos.x - this.socket.x, 0.7, coffinPos.z - this.socket.z);
      const mid = from.clone().add(to).multiplyScalar(0.5);
      const len = from.distanceTo(to);
      e.beam.position.copy(mid);
      e.beam.scale.set(1, len, 1);
      e.beam.lookAt(to.x, to.y, to.z);
      e.beam.rotateX(Math.PI / 2);
      e.beam.material.color.setRGB(cr, cg, cb);
      e.beam.material.opacity = (0.22 + p * 0.5) + Math.sin(t * 9 + i) * 0.08 * p;
      e.light.color.setRGB(cr, cg, cb);
      e.light.intensity = 0.6 + p * 3.6 + Math.sin(t * 7 + i) * 0.5 * p;
      e.lens.material.emissive.setRGB(cr, cg, cb);
      e.lens.material.emissiveIntensity = 0.4 + p * 2.4;
    });
    // 台座の紋も曇る
    this.seal.material.color.setRGB(cr, cg, cb);
    this.seal.material.opacity = 0.14 + p * 0.34;

    // ── 思念体 ──
    if (this.wraith.visible) {
      const agi = 1 - p;                       // 黒ずむほど暴れる
      this.wraith.position.set(
        coffinPos.x - this.socket.x + Math.sin(t * 2.4) * 0.7 * agi,
        0.4 + Math.sin(t * 3) * 0.2,
        coffinPos.z - this.socket.z + Math.cos(t * 2.0) * 0.7 * agi
      );
      this.wraith.rotation.y += dt * (0.8 + agi * 3.0);
      this.wraith.scale.setScalar(0.75 + (1 - this.hp / PURIFY_HP) * 0.5);
      this.wraithLight.intensity = 1.2 + agi * 4;
      if (this.wraithArms) {
        this.wraithArms.forEach((a, i) => {
          a.m.rotation.z = a.sx * (0.55 + Math.sin(t * (5 + agi * 10) + i) * 0.6 * agi);
        });
      }
      if (this.particles && agi > 0.4 && Math.random() < agi * 0.5) {
        this.particles.emit(coffinPos, 2, { color: [0.4, 0.08, 0.3], size: 3.2, up: 1.6, yOff: 1.2 });
      }
      // 完全に黒ずむと、じわじわ棺を押し出す（放置は許さない）
      if (this.dark > 2.5) {
        const a = t * 1.1;
        push.x = Math.cos(a) * 1.6;
        push.z = Math.sin(a) * 1.6;
      }
    }
    return push;
  }

  /** 浄化率と判定 */
  result(sealRatio, sunPower) {
    const cleared = this.done;
    // 撃ち込みが少ないほど（＝光を絶やさなかったほど）美しい浄化
    let rate = cleared ? 100 - Math.max(0, (this.shots - 6) * 1.6)
                       : Math.round((1 - this.hp / PURIFY_HP) * 100);
    rate = Math.max(0, Math.min(100, Math.round(rate * 0.82 + sealRatio * 12 + Math.min(6, sunPower / 16))));
    const full = cleared && sunPower >= 90 && this.shots <= 12;
    return { rate, full, cleared, shots: this.shots };
  }
}
