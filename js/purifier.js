/* ══════════════════════════════════════════════════════════════
   purifier.js ── 神聖機器「陽輪盤（ようりんばん）」
     大魔法陣の四隅に陽光照射機。はじめ銃口は天を向いている。
     陽光弾を当てるとゲージが溜まり、満ちた機から棺へ倒れ込む。
     四基すべてが向いたら陣の下端の集光台で陽を集め、浄化が始まる。
     浄化中は主の思念体が巨大化して現れ、一基ずつ黒ずませる。
     黒ずんだ機に陽光弾を当ててゲージを戻すと、主は別の機を狙う。
     主の反発の弾で倒れると、浄化はやり直しになる。
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

      // 陽のゲージ（柱の脇に立つ目盛り）
      const gb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.6, 0.22),
        new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.6 }));
      const fillGeo = new THREE.BoxGeometry(0.16, 1, 0.26); fillGeo.translate(0, 0.5, 0);
      const fill = new THREE.Mesh(fillGeo, glowMaterial(0xffd070, 2.2, true));
      const gauge = new THREE.Group();
      gb.position.y = 1.3; gauge.add(gb);
      fill.scale.y = 0.001; gauge.add(fill);
      gauge.position.set(-Math.sin(a) * 1.25, 1.2, Math.cos(a) * 1.25);
      g.add(gauge);
      g.position.set(px, 0, pz);
      this.group.add(g);
      this.emitters.push({ g, head, lens, beam, light: lt, x: px, z: pz, y: 4.3, aimed: false, turn: 0,
        gauge: 0, shown: 0, fill, dark: false });
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

  /** 主の姿から作った思念体を据える（巨大化させる） */
  setWraith(form) {
    if (this.bigWraith) this.group.remove(this.bigWraith);
    this.bigWraith = form || null;
    if (form) {
      form.visible = false;
      this.group.add(form);
    }
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
    // 黒ずみの無い時の進み（陽力が高いほど速い）。一気には進まない
    this.rate = 2.0 + (sunPower / 100) * 1.4;
    this.darkIdx = -1; this.darkWait = 3.0; this.lastDark = -1;
    this.shootT = 2.5; this.volley = 0;
    this.wraith.visible = false;
    if (this.bigWraith) this.bigWraith.visible = false;
    this.emitters.forEach(e => {
      e.aimed = false; e.turn = 0; e.gauge = 0; e.shown = 0; e.dark = false;
      e.beam.visible = false; e.light.intensity = 0;
      e.lens.material.emissiveIntensity = 0.5;
    });
    this.clamps.forEach(c => { c.m.rotation.x = -0.5; });
  }
  begin(sunPower) { this.reset(sunPower); this.hitsTaken = 0; this.fails = 0; }

  /** 浄化に失敗した。棺は据えたまま、照射機からやり直す */
  fail() {
    this.fails = (this.fails || 0) + 1;
    const sp = this.sunAtStart;
    this.reset(sp);
    this.step = Step.LOCKED;
  }

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
  /**
   * 照射機に陽光弾が当たった。
   * power: 溜まる量（通常弾 0.12／溜め弾 0.34 ほど）
   */
  hitEmitter(bx, bz, power) {
    if (this.step !== Step.LOCKED && this.step !== Step.PURIFY) return null;
    power = power || 0.12;
    for (let i = 0; i < this.emitters.length; i++) {
      const e = this.emitters[i];
      const ex = this.socket.x + e.x, ez = this.socket.z + e.z;
      if (Math.hypot(bx - ex, bz - ez) > 2.2) continue;
      this.shots++;
      if (this.step === Step.LOCKED) {
        if (e.aimed) return { index: i, full: true, left: this.emitters.filter(x => !x.aimed).length };
        e.gauge = Math.min(1, e.gauge + power);
        if (e.gauge >= 1) e.aimed = true;
        const left = this.emitters.filter(x => !x.aimed).length;
        if (left === 0) this.step = Step.READY;
        return { index: i, gauge: e.gauge, aimed: e.aimed, left };
      }
      // 浄化中：黒ずんだ機だけが応える
      if (!e.dark) return { index: i, clean: true };
      e.gauge = Math.min(1, e.gauge + power * 0.8);
      if (e.gauge >= 1) {
        e.dark = false; this.darkIdx = -1;
        this.darkWait = 2.2 + Math.random() * 2.2;
        return { index: i, restored: true };
      }
      return { index: i, gauge: e.gauge };
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
      this.step = Step.PURIFY; this.active = true;
      if (this.bigWraith) this.bigWraith.visible = true; else this.wraith.visible = true;
      this.darkWait = 3.5;
    }
    return this.charge;
  }
  get corePos() { return this.socket; }
  get aimedCount() { return this.emitters.filter(e => e.aimed).length; }

  /** @param playerPos 思念体が狙う先 */
  update(dt, t, coffinPos, playerPos) {
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
      // 満ちた瞬間にぐらりと倒れ込む（行き過ぎてから戻る）
      const over = Math.sin(Math.min(1, e.turn) * Math.PI) * 0.25;
      e.head.rotation.x = (-Math.PI / 2) * (1 - e.turn) + pitch * e.turn + over;
      e.shown += (e.gauge - e.shown) * Math.min(1, dt * 8);
      e.fill.scale.y = Math.max(0.001, e.shown * 2.6);
      const fm = e.fill.material;
      if (e.dark) { fm.emissive.setHex(0x8a2aff); fm.color.setHex(0x8a2aff); }
      else if (e.aimed) { fm.emissive.setHex(0xfff0a0); fm.color.setHex(0xfff0a0); }
      else { fm.emissive.setHex(0xffb040); fm.color.setHex(0xffb040); }
      fm.emissiveIntensity = 1.6 + (e.gauge >= 1 ? Math.sin(t * 6) * 0.6 : 0) + (e.dark ? Math.sin(t * 12) * 0.8 : 0);
      if (this.step !== Step.PURIFY) e.lens.material.emissiveIntensity = 0.5 + e.turn * 2.0 + e.gauge * 0.8;
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

    // ── 主が一基ずつ黒ずませる ──
    if (this.darkIdx < 0) {
      this.darkWait -= dt;
      if (this.darkWait <= 0) {
        let i = Math.floor(Math.random() * 4);
        if (i === this.lastDark) i = (i + 1 + Math.floor(Math.random() * 3)) % 4;
        this.darkIdx = i; this.lastDark = i;
        const e = this.emitters[i];
        e.dark = true;
        this.onDark && this.onDark(i);
      }
    } else {
      const e = this.emitters[this.darkIdx];
      // 黒ずみに侵されてゲージが減る（弾で戻す）
      e.gauge = Math.max(0.1, e.gauge - dt * 0.9 * (e.gauge > 0.4 ? 1 : 0.15));
    }
    const slow = this.darkIdx >= 0;
    this.purity = slow ? Math.max(0.15, this.purity - dt * 1.5) : Math.min(1, this.purity + dt * 1.2);
    this.hp = Math.max(0, this.hp - this.rate * (slow ? 0.05 : 1) * dt);
    if (!slow && this.particles && Math.random() < 0.5) {
      this.particles.emit(coffinPos || this.socket, 2, { color: [1, 0.95, 0.75], size: 2.8, up: 2.2, yOff: 0.6 });
    }
    if (this.hp <= 0) {
      this.active = false; this.done = true; this.step = Step.DONE;
      this.wraith.visible = false;
      if (this.bigWraith) this.bigWraith.visible = false;
      this.emitters.forEach(e => { e.dark = false; });
      return push;
    }

    // ── 光線（黒ずんだ機は紫黒） ──
    this.emitters.forEach((e, i) => {
      e.beam.visible = true;
      const from = new THREE.Vector3(e.x, e.y, e.z);
      const to = new THREE.Vector3(0, 0.8, 0);
      e.beam.position.copy(from.clone().add(to).multiplyScalar(0.5));
      e.beam.scale.set(e.dark ? 0.6 : 1, from.distanceTo(to), e.dark ? 0.6 : 1);
      e.beam.lookAt(this.group.position.x, 0.8, this.group.position.z);
      e.beam.rotateX(Math.PI / 2);
      const k = e.dark ? 0.12 : 1;
      e.beam.material.color.setRGB(e.dark ? 0.35 : 1, e.dark ? 0.05 : 0.95, e.dark ? 0.5 : 0.75);
      e.beam.material.opacity = e.dark ? 0.35 + Math.sin(t * 20) * 0.15 : 0.7 + Math.sin(t * 9 + i) * 0.08;
      e.light.color.setRGB(e.dark ? 0.5 : 1, e.dark ? 0.1 : 0.92, e.dark ? 0.7 : 0.7);
      e.light.intensity = 0.6 + k * 3.6;
      e.lens.material.emissive.setRGB(e.dark ? 0.4 : 1, e.dark ? 0.05 : 0.94, e.dark ? 0.6 : 0.75);
      e.lens.material.emissiveIntensity = 0.5 + k * 2.6;
    });
    const p = this.purity;
    this.rings.forEach(r => { r.m.material.color.setRGB(0.3 + p * 0.7, 0.1 + p * 0.85, 0.4 + p * 0.4); });

    // ── 思念体：巨大化して光線に反発する ──
    const W = this.bigWraith || this.wraith;
    const grow = 1 - this.hp / PURIFY_HP;
    const tgt = this.darkIdx >= 0 ? this.emitters[this.darkIdx] : null;
    W.position.set(0, 0.8 + Math.sin(t * 1.6) * 0.3, 0);
    const lookX = playerPos ? playerPos.x - this.group.position.x : 0, lookZ = playerPos ? playerPos.z - this.group.position.z : 1;
    const face = tgt ? Math.atan2(tgt.x, tgt.z) : Math.atan2(lookX, lookZ);
    let diff = ((face - W.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    W.rotation.y += diff * Math.min(1, dt * 3);
    W.scale.setScalar((this.bigWraith ? 2.3 : 1.6) + grow * 0.6 + Math.sin(t * 3) * 0.04);
    this.wraithLight.intensity = 1.2 + (slow ? 4 : 1.5);
    if (this.particles && Math.random() < (slow ? 0.5 : 0.2)) {
      this.particles.emit(this.socket, 2, { color: [0.4, 0.08, 0.3], size: 3.6, up: 1.6, yOff: 3 });
    }

    // ── 反発のエネルギー弾（避けないと傷つく） ──
    if (this.hostile && playerPos) {
      this.shootT -= dt;
      if (this.shootT <= 0) {
        this.volley++;
        const from = new THREE.Vector3(this.group.position.x, 4.2, this.group.position.z);
        const dir = new THREE.Vector3(playerPos.x - from.x, 0, playerPos.z - from.z);
        const pw = this.power || 110;
        if (this.volley % 4 === 0) this.hostile.ring(from, 12, Math.random(), { speed: 6.5, power: pw, size: 1.1 });
        else this.hostile.fan(from, dir, 3, 0.28, { speed: 8.5, power: pw, size: 1.1 });
        this.shootT = slow ? 1.4 : 2.0;
      }
    }
    return push;
  }

  result(sealRatio, sunPower) {
    const cleared = this.done;
    let rate = cleared ? 100 - (this.hitsTaken || 0) * 4 - (this.fails || 0) * 15
                       : Math.round((1 - this.hp / PURIFY_HP) * 100);
    rate = Math.max(0, Math.min(100, Math.round(Math.max(30, rate) * 0.82 + sealRatio * 12 + Math.min(6, sunPower / 16))));
    const full = cleared && sunPower >= 90 && !(this.hitsTaken) && !(this.fails);
    return { rate, full, cleared, shots: this.shots };
  }
}
