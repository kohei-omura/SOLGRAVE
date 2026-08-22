/* ══════════════════════════════════════════════════════════════
   purifier.js ── 神聖機器「陽輪盤（ようりんばん）」
     大魔法陣の四隅に陽光照射機。はじめ銃口は天を向いている。
     陽光弾を当てるとその機が棺へ向き直る。四基すべてが向いたら
     陣の下端の集光台に立ち、陽を集める所作で浄化が始まる。
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { metalMaterial, glowMaterial, stoneMaterial } from './gfx.js';

export const PURIFY_HP = 100;

export const Step = {
  WAIT:   'wait',    // 棺を運んでくる
  LOCKED: 'locked',  // 棺が固定された。照射機を撃つ
  READY:  'ready',   // 四基が向いた。集光台へ
  PURIFY: 'purify',  // 浄化中
  DONE:   'done'
};

export class Purifier {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.step = Step.WAIT;
    this.active = false;
    this.done = false;
    this.hp = PURIFY_HP;
    this.purity = 1;
    this.rage = 0;
    this.shots = 0;
    this.dark = 0;
    this.charge = 0;
    this.rate = 4;
    this.socket = new THREE.Vector3(0, 0, 0);
    this.socketR = 2.4;
    this.focusR = 2.6;
    this.focusPos = new THREE.Vector3(0, 0, 13);
    this.group = new THREE.Group();
    this._build();
    scene.add(this.group);
    this.group.visible = false;
  }

  _build() {
    const base = stoneMaterial(81, 0xa89c88);
    const frame = metalMaterial(82, 0x8d94a2);
    const gold = metalMaterial(88, 0xc9a227);

    /* ── 大魔法陣 ── */
    this.rings = [];
    [[13.4, 14.0, 0.30], [12.2, 12.5, 0.20], [8.6, 9.2, 0.26], [4.4, 4.8, 0.24], [2.0, 2.3, 0.30]]
      .forEach(([a, b, o], i) => {
        const m = new THREE.Mesh(new THREE.RingGeometry(a, b, 64),
          new THREE.MeshBasicMaterial({ color: 0xffe1a0, transparent: true, opacity: o,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        m.rotation.x = -Math.PI / 2; m.position.y = 0.03 + i * 0.002;
        this.group.add(m);
        this.rings.push({ m, dir: (i % 2 ? -1 : 1) * (0.06 + i * 0.03) });
      });
    this.runes = new THREE.Group();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const len = (i % 3 === 0) ? 2.6 : 1.4;
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.16, len),
        new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.35,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      bar.rotation.x = -Math.PI / 2; bar.rotation.z = -a;
      bar.position.set(Math.cos(a) * 10.8, 0.04, Math.sin(a) * 10.8);
      this.runes.add(bar);
    }
    this.group.add(this.runes);
    [0, Math.PI / 2].forEach(a => {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 26),
        new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.18,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      bar.rotation.x = -Math.PI / 2; bar.rotation.z = a; bar.position.y = 0.032;
      this.group.add(bar);
    });

    /* ── 棺を据える台座と鉤爪 ── */
    const b = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 0.55, 28), base);
    b.position.y = 0.27; b.receiveShadow = true;
    this.group.add(b);
    this.clamps = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.5), metalMaterial(87, 0x9a8a5a));
      c.position.set(Math.cos(a) * 2.1, 0.6, Math.sin(a) * 2.1);
      c.rotation.y = -a; c.rotation.x = -0.5;
      this.group.add(c);
      this.clamps.push({ m: c });
    }

    /* ── 四隅の照射機 ── */
    this.emitters = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const px = Math.cos(a) * 9.4, pz = Math.sin(a) * 9.4;
      const g = new THREE.Group();
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.3, 1.2, 12), base);
      ped.position.y = 0.6; ped.castShadow = true; g.add(ped);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 3.0, 12), frame);
      col.position.y = 2.6; col.castShadow = true; g.add(col);
      [1.6, 3.4].forEach(y => {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 8, 20), gold);
        r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r);
      });
      const head = new THREE.Group();
      head.position.y = 4.3;
      head.add(new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 14), frame));
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.9, 14), frame);
      barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.95; barrel.castShadow = true;
      head.add(barrel);
      [0.55, 1.15, 1.7].forEach(z => {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 18), gold);
        r.rotation.y = Math.PI / 2; r.position.z = z; head.add(r);
      });
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), glowMaterial(0xfff0c0, 0.5, true));
      lens.position.z = 1.92; head.add(lens);
      head.rotation.x = -Math.PI / 2;      // はじめは天を向く
      g.add(head);

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.26, 1, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 0.7,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.visible = false;
      this.group.add(beam);

      const lt = new THREE.PointLight(0xffe6b0, 0, 14, 2);
      lt.position.set(px, 4.3, pz);
      this.group.add(lt);

      g.position.set(px, 0, pz);
      this.group.add(g);
      this.emitters.push({ g, head, lens, beam, light: lt, x: px, z: pz, y: 4.3, aimed: false, turn: 0 });
    }

    /* ── 集光台（陣の下端） ── */
    this.focus = new THREE.Group();
    const fp = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.4, 24), base);
    fp.position.y = 0.2; this.focus.add(fp);
    this.focusRing = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.1, 10, 32), gold);
    this.focusRing.rotation.x = -Math.PI / 2; this.focusRing.position.y = 0.44;
    this.focus.add(this.focusRing);
    this.focusGlow = new THREE.Mesh(new THREE.CircleGeometry(2.0, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe1a0, transparent: true, opacity: 0.2,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    this.focusGlow.rotation.x = -Math.PI / 2; this.focusGlow.position.y = 0.42;
    this.focus.add(this.focusGlow);
    this.focus.position.set(0, 0, 13.0);
    this.group.add(this.focus);

    /* ── 思念体 ── */
    this.wraith = new THREE.Group();
    const wm = new THREE.MeshStandardMaterial({
      color: 0x2a1030, roughness: 0.9, transparent: true, opacity: 0.85,
      emissive: new THREE.Color(0x3a0a12), emissiveIntensity: 0.9 });
    const wbody = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.8, 12), wm);
    wbody.position.y = 1.4; this.wraith.add(wbody);
    const wh = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), wm);
    wh.scale.set(0.88, 1.15, 0.9); wh.position.y = 2.8; this.wraith.add(wh);
    this.wraithArms = [];
    [-1, 1].forEach(sx => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), glowMaterial(0xff2a2a, 4.2, true));
      e.position.set(0.12 * sx, 2.86, 0.27); this.wraith.add(e);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 1.1, 4, 8), wm);
      arm.position.set(0.78 * sx, 1.9, 0); arm.rotation.z = sx * 0.55;
      this.wraith.add(arm);
      this.wraithArms.push({ m: arm, sx });
    });
    this.wraithLight = new THREE.PointLight(0xff2a2a, 0, 14, 2);
    this.wraithLight.position.y = 2.4; this.wraith.add(this.wraithLight);
    this.wraith.visible = false;
    this.group.add(this.wraith);
  }

  place(pos) {
    this.group.position.copy(pos);
    this.socket.copy(pos);
    this.focusPos.set(pos.x, 0, pos.z + 13.0);
    this.group.visible = true;
  }

  reset(sunPower) {
    this.step = Step.WAIT;
    this.active = false; this.done = false;
    this.hp = PURIFY_HP; this.purity = 1; this.rage = 0;
    this.shots = 0; this.dark = 0; this.charge = 0;
    this.sunAtStart = sunPower;
    this.rate = 3.4 + (sunPower / 100) * 4.2;
    this.wraith.visible = false;
    this.emitters.forEach(e => {
      e.aimed = false; e.turn = 0;
      e.beam.visible = false; e.light.intensity = 0;
      e.lens.material.emissiveIntensity = 0.5;
    });
    this.clamps.forEach(c => { c.m.rotation.x = -0.5; });
  }
  begin(sunPower) { this.reset(sunPower); }

  onSocket(p) {
    if (!p) return false;
    const dx = p.x - this.socket.x, dz = p.z - this.socket.z;
    return dx * dx + dz * dz < this.socketR * this.socketR;
  }
  lock() {
    if (this.step !== Step.WAIT) return false;
    this.step = Step.LOCKED;
    return true;
  }
  hitEmitter(bx, bz) {
    if (this.step !== Step.LOCKED) return null;
    for (let i = 0; i < this.emitters.length; i++) {
      const e = this.emitters[i];
      const ex = this.socket.x + e.x, ez = this.socket.z + e.z;
      if (!e.aimed && Math.hypot(bx - ex, bz - ez) < 2.2) {
        e.aimed = true; this.shots++;
        const left = this.emitters.filter(x => !x.aimed).length;
        if (left === 0) this.step = Step.READY;
        return { index: i, left };
      }
    }
    return null;
  }
  onFocus(px, pz) {
    const dx = px - this.focusPos.x, dz = pz - this.focusPos.z;
    return dx * dx + dz * dz < this.focusR * this.focusR;
  }
  gather(dt, sunPower) {
    if (this.step !== Step.READY) return this.charge;
    this.charge = Math.min(1, this.charge + dt * (0.45 + (sunPower / 100) * 0.35));
    if (this.charge >= 1) {
      this.step = Step.PURIFY; this.active = true; this.wraith.visible = true;
    }
    return this.charge;
  }
  hitDevice(bx, bz) {
    if (this.step !== Step.PURIFY) return false;
    const dx = bx - this.socket.x, dz = bz - this.socket.z;
    let ok = (dx * dx + dz * dz) < 3.6 * 3.6;
    if (!ok) for (const e of this.emitters) {
      if (Math.hypot(bx - (this.socket.x + e.x), bz - (this.socket.z + e.z)) < 2.2) { ok = true; break; }
    }
    if (!ok) return false;
    this.shots++;
    this.purity = Math.min(1, this.purity + 0.34);
    this.rage = Math.max(0, this.rage - 0.28);
    return true;
  }

  get corePos() { return this.socket; }
  get aimedCount() { return this.emitters.filter(e => e.aimed).length; }

  update(dt, t, coffinPos) {
    const push = { x: 0, z: 0 };
    if (!this.group.visible) return push;

    this.rings.forEach(r => { r.m.rotation.z += r.dir * dt; });
    this.runes.rotation.y -= dt * 0.05;

    this.emitters.forEach(e => {
      const want = e.aimed ? 1 : 0;
      e.turn += (want - e.turn) * Math.min(1, dt * 3.2);
      const tx = -e.x, ty = 0.8 - e.y, tz = -e.z;
      const yaw = Math.atan2(tx, tz);
      const pitch = Math.atan2(ty, Math.hypot(tx, tz));
      e.head.rotation.y = yaw * e.turn;
      e.head.rotation.x = (-Math.PI / 2) * (1 - e.turn) + pitch * e.turn;
      e.lens.material.emissiveIntensity = 0.5 + e.turn * 2.0;
    });

    const lockK = (this.step === Step.WAIT) ? 0 : 1;
    this.clamps.forEach(c => {
      c.m.rotation.x += ((-0.5 * (1 - lockK)) - c.m.rotation.x) * Math.min(1, dt * 4);
    });

    const readyK = (this.step === Step.READY) ? 1 : 0;
    this.focusGlow.material.opacity = 0.12 + readyK * (0.25 + this.charge * 0.5)
      + Math.sin(t * 4) * 0.05 * readyK;
    this.focusRing.rotation.z += dt * (0.4 + this.charge * 3);
    this.focusRing.scale.setScalar(1 + this.charge * 0.12);

    if (this.step !== Step.PURIFY) {
      this.emitters.forEach(e => { e.beam.visible = false; e.light.intensity = e.turn * 1.4; });
      return push;
    }

    this.rage = Math.min(1, this.rage + dt * 0.16);
    this.purity = Math.max(0, this.purity - (0.055 + this.rage * 0.10) * dt);
    const eff = Math.max(0, (this.purity - 0.18) / 0.82);
    if (eff > 0) {
      this.hp = Math.max(0, this.hp - this.rate * eff * dt);
      this.dark = 0;
      if (this.particles && Math.random() < 0.5 * eff) {
        this.particles.emit(coffinPos || this.socket, 2,
          { color: [1, 0.95, 0.75], size: 2.8, up: 2.2, yOff: 0.6 });
      }
    } else this.dark += dt;
    if (this.hp <= 0) {
      this.active = false; this.done = true; this.step = Step.DONE;
      this.wraith.visible = false;
    }

    const p = this.purity;
    const cr = 0.10 + p * 0.90, cg = 0.03 + p * 0.92, cb = 0.14 + p * 0.68;
    this.emitters.forEach((e, i) => {
      e.beam.visible = true;
      const from = new THREE.Vector3(e.x, e.y, e.z);
      const to = new THREE.Vector3(0, 0.8, 0);
      const mid = from.clone().add(to).multiplyScalar(0.5);
      e.beam.position.copy(mid);
      e.beam.scale.set(1, from.distanceTo(to), 1);
      e.beam.lookAt(this.group.position.x, 0.8, this.group.position.z);
      e.beam.rotateX(Math.PI / 2);
      e.beam.material.color.setRGB(cr, cg, cb);
      e.beam.material.opacity = (0.22 + p * 0.52) + Math.sin(t * 9 + i) * 0.08 * p;
      e.light.color.setRGB(cr, cg, cb);
      e.light.intensity = 0.6 + p * 3.6;
      e.lens.material.emissive.setRGB(cr, cg, cb);
      e.lens.material.emissiveIntensity = 0.5 + p * 2.6;
    });
    this.rings.forEach(r => { r.m.material.color.setRGB(cr, cg, cb); });

    const agi = 1 - p;
    this.wraith.position.set(0, 0.4 + Math.sin(t * 3) * 0.2, 0);
    this.wraith.rotation.y += dt * (0.8 + agi * 3.0);
    this.wraith.scale.setScalar(0.8 + (1 - this.hp / PURIFY_HP) * 0.5);
    this.wraithLight.intensity = 1.2 + agi * 4;
    this.wraithArms.forEach((a, i) => {
      a.m.rotation.z = a.sx * (0.55 + Math.sin(t * (5 + agi * 10) + i) * 0.6 * agi);
    });
    if (this.particles && agi > 0.4 && Math.random() < agi * 0.5) {
      this.particles.emit(this.socket, 2, { color: [0.4, 0.08, 0.3], size: 3.2, up: 1.6, yOff: 1.2 });
    }
    return push;
  }

  result(sealRatio, sunPower) {
    const cleared = this.done;
    let rate = cleared ? 100 - Math.max(0, (this.shots - 10) * 1.4)
                       : Math.round((1 - this.hp / PURIFY_HP) * 100);
    rate = Math.max(0, Math.min(100, Math.round(rate * 0.82 + sealRatio * 12 + Math.min(6, sunPower / 16))));
    const full = cleared && sunPower >= 90 && this.shots <= 16;
    return { rate, full, cleared, shots: this.shots };
  }
}
