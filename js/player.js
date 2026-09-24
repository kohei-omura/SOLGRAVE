/* player.js ── 陽光狩人 */
import * as THREE from 'three';
import { metalMaterial, glowMaterial, fleshMaterial } from './gfx.js';
import { buildWeaponModel } from './weapons.js';
import { buildHero } from './figure.js';

/* 武器ごとの構え（手元の向き）。模型は +Z が刃先 */
const REST = {
  gun: [0, 0, 0], dagger: [-0.25, 0, 0], sword: [-0.55, 0.15, 0], staff: [-1.15, 0, 0.15],
  mace: [-0.7, 0, 0], axe: [-0.7, 0.1, 0], bow: [0, 0, -1.35], spear: [-0.08, 0, 0],
  katar: [0, 0, 0], tome: [0.1, 0, 0], claw: [0, 0, 0], whip: [-0.3, 0, 0],
  lute: [0.2, 0.5, 0.35], ninjato: [0.6, 0.35, 0], shuriken: [-0.2, 0, 0]
};
/* 動きの長さ（秒） */
const ANIM_DUR = { swing: 0.26, stab: 0.14, thrust: 0.26, smash: 0.42, punch: 0.1, whip: 0.36,
  iai: 0.22, bow: 0.34, cast: 0.34, throw: 0.3, strum: 0.4, shoot: 0.1 };
const ease = k => 1 - Math.pow(1 - k, 3);

export const SHOT_COST = 1;
export const CHARGE_COST = 15;

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector3();
    this.aim = new THREE.Vector3(0, 0, 1);   // 模型の正面は +Z
    this.radius = 0.6;
    this.hp = 3; this.maxHp = 3;
    this.guard = 150;        // いまの心の耐久。守りが高いほど減りにくい
    this.guardMax = 150;
    this.cutPhys = 0;        // 物理の軽減率（能力値から設定される）
    this.cutMag = 0;
    this.evade = 0;          // 完全回避率
    this.wardT = 0;          // 祓いの加護（巫女のMDEF由来）
    this.wardCut = 0;
    this.invuln = 0;
    this.speed = 7.5;
    this.dashCd = 0;
    this.dashT = 0;      // ダッシュの残り時間
    this.charging = 0;
    this.pushing = false;
    this.walkT = 0;
    this.solarOn = false;   // 陽の化身か
    this._solarK = 0;       // 変身の進み具合 0→1
    this.group = new THREE.Group();
    this._build();
    // 全身を一つの軸に載せ直す（回避の転がり・被弾ののけぞりに使う）
    this.body = new THREE.Group();
    while (this.group.children.length) this.body.add(this.group.children[0]);
    this.group.add(this.body);
    // 手元（武器を握る軸）
    this.hand = new THREE.Group();
    this.hand.position.set(0.3, 1.34, 0.12);
    this.body.add(this.hand);
    this.offHand = new THREE.Group();
    this.offHand.position.set(-0.3, 1.34, 0.12);
    this.body.add(this.offHand);
    this.wtype = 'gun'; this.wrare = 0;
    this.stance = 'normal';
    this._atk = null;
    this._hurtT = 0; this._victory = 0;
    [this.orb, this.chargeRing, this.chargeRing2, this.sigil, this.flame, this.demon]
      .forEach(o => { if (o) o.userData.noPortrait = true; });
    scene.add(this.group);
  }

  /** 持つ武器を替える（手元の模型も差し替える） */
  setWeapon(type, rare) {
    type = type || 'gun'; rare = rare || 0;
    if (this.wtype === type && this.wrare === rare && this._wModel !== undefined) return;
    this.wtype = type; this.wrare = rare;
    [this.hand, this.offHand].forEach(h => { while (h.children.length) h.remove(h.children[0]); });
    this._wModel = null; this._wOff = null;
    this.gun.visible = (type === 'gun');
    if (type !== 'gun') {
      this._wModel = buildWeaponModel(type, rare);
      this._wModel.scale.setScalar(1.3);          // 見下ろしでも形が分かる大きさに
      this.hand.add(this._wModel);
      if (type === 'katar' || type === 'claw') {
        this._wOff = buildWeaponModel(type, rare);
        this._wOff.scale.setScalar(1.3);
        this.offHand.add(this._wOff);
      }
    }
    this._applyStance();
  }
  /** 銃の構え */
  setStance(id) { this.stance = id || 'normal'; this._applyStance(); }
  _applyStance() {
    const dual = this.wtype === 'gun' && this.stance === 'dual';
    if (dual && !this._gun2) {
      this._gun2 = this.gun.clone(true);
      this._gun2.position.set(-0.26, 1.36, 0.2);
      this.body.add(this._gun2);
    }
    if (this._gun2) this._gun2.visible = dual;
  }
  /** 攻撃の所作を始める */
  playAttack(anim, step) {
    this._atk = { anim, t: 0, dur: ANIM_DUR[anim] || 0.2, step: step || 0 };
  }
  /** 勝利の所作 */
  cheer() { this._victory = 2.4; }
  _animWeapon(dt, t) {
    const r = REST[this.wtype] || REST.gun;
    const H = this.hand, O = this.offHand;
    let rx = r[0], ry = r[1], rz = r[2], pz = 0.12, py = 1.34, oz = 0.12, orx = 0;
    const a = this._atk;
    if (a) {
      a.t += dt;
      const k = Math.min(1, a.t / a.dur), e = ease(k), s = (a.step % 2) ? -1 : 1;
      const back = Math.sin(k * Math.PI);
      switch (a.anim) {
        case 'swing': ry = s * (1.5 - e * 3.0); rx = -0.2 + back * 0.2; break;
        case 'iai':   ry = -1.7 + e * 3.3; rx = 0.15; break;
        case 'stab':  pz += back * 0.55; ry = s * 0.15; rx = 0; break;
        case 'thrust': pz += -0.35 + e * 1.1 - (k > 0.7 ? (k - 0.7) * 2.2 : 0); rx = 0; break;
        case 'smash': rx = -2.1 + e * 2.7; break;
        case 'punch': if (s > 0) pz += back * 0.5; else oz += back * 0.5; rx = 0; break;
        case 'whip':  rx = -1.6 + e * 1.9; ry = 0.2; break;
        case 'bow':   orx = 0; oz = 0.12 - back * 0.45; break;
        case 'cast':  rx = r[0] - back * 0.9; py += back * 0.2; break;
        case 'throw': rx = -2.2 + e * 2.6; ry = 0.3; break;
        case 'strum': rz = r[2] + Math.sin(k * Math.PI * 4) * 0.2; break;
        case 'shoot': this.gun.position.z = 0.2 - 0.14 * back; if (this._gun2) this._gun2.position.z = 0.2 - 0.14 * back; break;
      }
      if (k >= 1) { this._atk = null; this.gun.position.z = 0.2; if (this._gun2) this._gun2.position.z = 0.2; }
    }
    // 鞭はしなる
    if (this._wModel && this._wModel.userData.whip) {
      const segs = this._wModel.userData.whip.children;
      const act = a && a.anim === 'whip' ? Math.sin((a.t / a.dur) * Math.PI) : 0;
      segs.forEach((sg, i) => {
        sg.position.y = -i * 0.02 - Math.sin(t * 5 + i * 0.5) * 0.02 * i - act * 0.0;
        sg.position.z = 0.15 + i * (0.1 + act * 0.42);
      });
    }
    H.rotation.set(rx, ry, rz);
    H.position.set(0.3, py, pz);
    O.rotation.set(orx, -ry * 0.3, 0);
    O.position.set(-0.3, 1.34, oz);
    // 銃の構え
    if (this.wtype === 'gun' && !this.charging) {
      const st = this.stance;
      const gy = st === 'hip' ? 1.02 : st === 'rapid' ? 1.52 : 1.36;
      this.gun.position.y += (gy - this.gun.position.y) * Math.min(1, dt * 12);
      this.gun.rotation.z = st === 'hip' ? 0.5 : 0;
      this.gun.position.x = st === 'rapid' ? 0.12 : 0.26;
    }
  }

  _build() {
    // ── 人の姿（figure.js）：長外套の青年 ──
    this.fig = buildHero();
    this.group.add(this.fig.root);
    this._coatMats = this.fig.coatMats;
    this._pauldrons = this.fig.pauldrons;
    this.legs = this.fig.legs;
    const brim = this.fig.hatParts[0], crown = this.fig.hatParts[1], band = this.fig.hatParts[2], collar = this.fig.hatParts[3];

    // ── 陽光銃（正面 +Z） ──
    this.gun = new THREE.Group();
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.5), fleshMaterial(0x4a3524));
    stock.position.z = -0.18;
    this.gun.add(stock);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.17, 0.42), metalMaterial(55, 0x6a6e78));
    body.position.z = 0.2;
    this.gun.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.9, 12), metalMaterial(56, 0x8a7a52));
    barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.82;
    this.gun.add(barrel);
    this.rings = [];
    [0.55, 0.82, 1.08].forEach(z => {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 16), glowMaterial(0xffd98a, 0.6, true));
      r.position.z = z; r.rotation.y = Math.PI / 2;
      this.gun.add(r);
      this.rings.push(r);
    });
    this.muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), glowMaterial(0xffe9a8, 2.2, true));
    this.muzzle.position.z = 1.28;
    this.gun.add(this.muzzle);
    this.gun.position.set(0.26, 1.36, 0.2);   // 両手で構える位置
    this.group.add(this.gun);

    // 溜め演出
    this.orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 14), glowMaterial(0xfff0c0, 3.0, true));
    this.orb.position.set(0.26, 1.36, 1.6);
    this.orb.visible = false;
    this.group.add(this.orb);
    this.chargeRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 8, 28), glowMaterial(0xffd070, 2.4, true));
    this.chargeRing.position.set(0.26, 1.36, 1.6);
    this.chargeRing.visible = false;
    this.group.add(this.chargeRing);
    this.chargeRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.03, 8, 28), glowMaterial(0xfff2c8, 2.0, true));
    this.chargeRing2.position.set(0.26, 1.36, 1.6);
    this.chargeRing2.visible = false;
    this.group.add(this.chargeRing2);
    // 足元の陣
    this.sigil = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1.15, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    this.sigil.rotation.x = -Math.PI / 2;
    this.sigil.position.y = 0.05;
    this.sigil.visible = false;
    this.group.add(this.sigil);

    // 変身で光らせる対象を集める
    this._mats = [];
    this.group.traverse(o => {
      if (o.material && o.material.emissive && this._mats.indexOf(o.material) < 0) {
        this._mats.push(o.material);
        o.material.userData._baseEmi = o.material.emissive.getHex();
        o.material.userData._baseInt = o.material.emissiveIntensity || 0;
        o.material.userData._baseCol = o.material.color ? o.material.color.getHex() : 0xffffff;
      }
    });
    // ── 陽の化身「太陽の魔神」──
    // 帽子と外套を隠し、角・光輪・燃える鬣（たてがみ）が現れる
    this.mortalParts = [brim, crown, band, collar];
    this.demon = new THREE.Group();
    const emb = (c, i) => new THREE.MeshStandardMaterial({
      color: c, emissive: new THREE.Color(c), emissiveIntensity: i,
      roughness: 0.35, metalness: 0.1
    });
    // 双角
    [-1, 1].forEach(sx => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.62, 8), emb(0xffb020, 2.2));
      horn.position.set(0.17 * sx, 2.16, -0.02);
      horn.rotation.z = sx * -0.42;
      horn.rotation.x = -0.22;
      this.demon.add(horn);
    });
    // 背の光輪
    this.halo = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.055, 10, 32), emb(0xffd24a, 2.6));
    this.halo.position.set(0, 1.95, -0.42);
    this.demon.add(this.halo);
    // 光輪の棘
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6), emb(0xffe27a, 2.2));
      sp.position.set(Math.cos(a) * 1.02, 1.95 + Math.sin(a) * 1.02, -0.42);
      sp.rotation.z = a - Math.PI / 2;
      this.demon.add(sp);
    }
    // 燃える鬣（頭のまわりの炎）
    this.mane = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 6), emb(0xff8c20, 2.4));
      fl.position.set(Math.cos(a) * 0.3, 2.1, Math.sin(a) * 0.3);
      fl.rotation.x = Math.cos(a) * 0.4;
      fl.rotation.z = -Math.sin(a) * 0.4;
      this.demon.add(fl);
      this.mane.push({ m: fl, a });
    }
    // 胸の陽紋
    this.crest = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 8, 18), emb(0xfff0a0, 3.0));
    this.crest.position.set(0, 1.42, 0.3);
    this.demon.add(this.crest);
    this.demon.visible = false;
    this.demon.position.y = -0.22;      // 新しい背丈に合わせる
    this.group.add(this.demon);

    // 燃える殻
    this.flame = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 20, 16),
      new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.24,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide })
    );
    this.flame.position.y = 1.15;
    this.flame.visible = false;
    this.group.add(this.flame);

    this.lamp = new THREE.PointLight(0xffe0b0, 5.0, 26, 1.6);
    this.lamp.position.set(0, 1.7, 0);
    this.group.add(this.lamp);
    this.muzzleLight = new THREE.PointLight(0xffe9a8, 0, 9, 2);
    this.muzzleLight.position.set(0.26, 1.36, 1.3);
    this.group.add(this.muzzleLight);
  }

  reset(p) {
    this.pos.copy(p); this.vel.set(0, 0, 0);
    this._atk = null; this._hurtT = 0; this._victory = 0;
    if (this.body) this.body.rotation.set(0, 0, 0);
    this.hp = this.maxHp; this.invuln = 0; this.charging = 0; this.pushing = false;
  }
  /**
   * 傷を受ける。守りが高いほど心が減りにくい。
   * @param power 元の威力（既定100＝守り0なら一撃で心1つ）
   * @param magical 霊的な攻撃か
   * @returns 'evade' 回避 / 'guard' 耐えた / 'lost' 心が減った / false 無敵中
   */
  hurt(power, magical) {
    if (this.invuln > 0) return false;
    if (Math.random() < this.evade) { this.invuln = 0.6; return 'evade'; }
    // 守りが高いほど、心1つを失うまでに耐えられる回数が増えるようにする。
    // 最低ダメージを低くし、軽減がそのまま回数に効くようにした。
    const cut = Math.min(0.92, (magical ? this.cutMag : this.cutPhys) + (this.wardT > 0 ? this.wardCut : 0));
    const dmg = Math.max(1.5, (power || 100) * (1 - cut));
    this._hurtT = 0.45;
    this.guard -= dmg;
    this.invuln = 1.2;
    if (this.guard <= 0) {
      this.hp = Math.max(0, this.hp - 1);
      this.guard = this.guardMax;
      this.invuln = 1.5;
      return 'lost';
    }
    return 'guard';
  }
  /** 心が満ちたときに耐久も戻す */
  heal(n) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + (n || 1));
    this.guard = this.guardMax;
    return this.hp > before;
  }

  update(dt, input, world, t) {
    if (this.invuln > 0) this.invuln -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.wardT > 0) this.wardT -= dt;

    let sp = this.speed * (this.moveMul || 1) * (this.pushing ? 0.5 : 1) * (this.charging > 0 ? 0.45 : 1);
    // ダッシュ：1フレームだけ速くしても進まないため、0.22秒ぶん持続させる。
    // 立ち止まっていても、向いている方向へ踏み込めるようにする。
    if (this.dashT > 0) this.dashT -= dt;
    if (input.dash && this.dashCd <= 0 && this.dashT <= 0) {
      this.dashCd = 0.8; this.dashT = 0.22;
      this.invuln = Math.max(this.invuln, 0.22);   // 踏み込み中は当たらない
      if (!input.mx && !input.mz) { this._dashDir = this.aim.clone(); }
      else this._dashDir = null;
    }
    if (this.dashT > 0) sp *= 3.4;
    let mag = Math.min(1, Math.hypot(input.mx, input.mz));
    const len = Math.hypot(input.mx, input.mz) || 1;
    if (this.dashT > 0 && this._dashDir) {       // 静止からの踏み込み
      this.vel.x = this._dashDir.x * sp; this.vel.z = this._dashDir.z * sp; mag = 1;
    } else {
      this.vel.x = (input.mx / len) * sp * mag;
      this.vel.z = (input.mz / len) * sp * mag;
    }
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    world.resolve(this.pos, this.radius);
    // 坂や階段の高さに滑らかに乗る
    if (world.heightAt) {
      const gy = world.heightAt(this.pos.x, this.pos.z);
      this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 10);
    }

    if (input.ax || input.az) this.aim.set(input.ax, 0, input.az).normalize();
    else if (this.vel.lengthSq() > 0.01) this.aim.copy(this.vel).setY(0).normalize();

    this.group.position.copy(this.pos);
    this.group.rotation.y = Math.atan2(this.aim.x, this.aim.z);
    this._baseY = this.pos.y;

    if (mag > 0.05) {
      this.walkT += dt * 9 * mag;
      this.legs[0].rotation.x = Math.sin(this.walkT) * 0.5;
      this.legs[1].rotation.x = -Math.sin(this.walkT) * 0.5;
    } else {
      this.legs[0].rotation.x *= 0.85;
      this.legs[1].rotation.x *= 0.85;
    }

    // ── 全身の所作：回避の転がり／被弾ののけぞり／勝利 ──
    if (this.dashT > 0) {
      const k = 1 - this.dashT / 0.22;
      const th = k * Math.PI * 2;
      this.body.rotation.x = th;
      // 腰（高さ1）を軸に転がるよう、足元の軸をずらす
      this.body.position.set(0, 1 - Math.cos(th) + Math.sin(k * Math.PI) * 0.35, -Math.sin(th));
    } else if (this._hurtT > 0) {
      this._hurtT -= dt;
      const k = this._hurtT / 0.45;
      this.body.rotation.x = -0.45 * Math.sin(k * Math.PI);
      this.body.rotation.z = 0.12 * Math.sin(t * 40) * k;
      this.body.position.y = 0;
    } else if (this._victory > 0) {
      this._victory -= dt;
      const k = this._victory / 2.4;
      this.body.rotation.x = 0;
      this.body.rotation.y = (1 - k) * Math.PI * 2 * Math.min(1, (1 - k) * 2.5);
      this.body.position.y = Math.abs(Math.sin((1 - k) * Math.PI * 3)) * 0.3;
      this.hand.rotation.x = -2.4;
    } else {
      this.body.rotation.x *= 0.7; this.body.rotation.z *= 0.7; this.body.rotation.y *= 0.8;
      this.body.position.y *= 0.7; this.body.position.z *= 0.7;
    }
    if (this._victory <= 0) this._animWeapon(dt, t);
    this._reachArms(t, dt, mag > 0.05);
    if (!this.avatar) this.fig.update(t, { moving: mag > 0.05 });

    const c = this.charging;
    if (c > 0) {
      this.group.position.y = this.pos.y - 0.14 * c;
      this.gun.rotation.x = -0.4 * c;
      this.gun.position.y = 1.36 + 0.14 * c;
      this.orb.visible = true;
      this.orb.scale.setScalar(0.35 + c * 1.25 + Math.sin(t * 22) * 0.05 * c);
      this.orb.material.emissiveIntensity = 2 + c * 6;
      this.chargeRing.visible = true;
      this.chargeRing.scale.setScalar(1.7 - c * 0.9);
      this.chargeRing.rotation.z += dt * (2 + c * 12);
      this.chargeRing.material.emissiveIntensity = 1.5 + c * 5;
      this.chargeRing2.visible = c > 0.45;
      this.chargeRing2.scale.setScalar(2.2 - c * 1.3);
      this.chargeRing2.rotation.z -= dt * (3 + c * 9);
      this.sigil.visible = true;
      this.sigil.rotation.z += dt * 1.6;
      this.sigil.scale.setScalar(0.7 + c * 0.6);
      this.sigil.material.opacity = 0.25 + c * 0.5;
      this.rings.forEach((r, i) => {
        r.material.emissiveIntensity = 0.6 + c * 6 * (1 - i * 0.2);
        r.scale.setScalar(1 + c * 0.3);
      });
      this.lamp.intensity = 5.0 + c * 6;
      this.muzzleLight.intensity = c * 5;
    } else {
      this.group.position.y = this.pos.y;
      this.gun.rotation.x *= 0.8;
      this.orb.visible = false;
      this.chargeRing.visible = false;
      this.chargeRing2.visible = false;
      this.sigil.visible = false;
      this.rings.forEach(r => { r.material.emissiveIntensity = 0.6; r.scale.setScalar(1); });
      this.lamp.intensity = 5.0;
      this.muzzleLight.intensity *= 0.86;
    }

    if (this._legend && this.legendAura) {
      this.legendAura.rotation.y = Math.sin(t * 0.8) * 0.1;
      if (this.legendRing) this.legendRing.rotation.z += dt * 0.6;
      if (this.legendCape) this.legendCape.rotation.z = Math.sin(t * 2.2) * 0.06;
    }
    if (this.charmGlow && this.charmGlow.visible) this.charmGlow.rotation.z += dt * 0.8;
    this.group.visible = !(this.invuln > 0 && Math.floor(t * 12) % 2 === 0);
    this.muzzle.material.emissiveIntensity = 2.2 + c * 3;
  }

  /** 外部の人物モデルに差し替える（null で元の姿へ） */
  useAvatar(rig) {
    if (this.avatar) this.body.remove(this.avatar.root);
    this.avatar = rig || null;
    this.fig.root.visible = !rig;
    if (rig) this.body.add(rig.root);
  }

  /** 腕を握る物へ伸ばす（二関節の逆運動学） */
  _reachArms(t, dt, moving) {
    const F = this.fig;
    const R = F.arms[0], L = F.arms[1];
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    let rt, lt;
    if (this._victory > 0) {
      rt = v(0.22, 2.05, 0.12); lt = v(-0.3, 1.0, 0.1);
    } else if (this.wtype === 'gun') {
      const gp = this.gun.position;
      rt = v(gp.x, gp.y - 0.06, gp.z + 0.02);
      if (this.stance === 'dual' && this._gun2) { const g2 = this._gun2.position; lt = v(g2.x, g2.y - 0.06, g2.z + 0.02); }
      else if (this.stance === 'hip') lt = v(-0.24, 1.02, 0.1 + Math.sin(t * 2) * 0.02);
      else lt = v(gp.x - 0.05, gp.y - 0.05, gp.z + 0.42);
    } else {
      rt = this.hand.position.clone();
      if (this.wtype === 'katar' || this.wtype === 'claw' || this.wtype === 'bow' || this.wtype === 'lute' || this.wtype === 'tome') lt = this.offHand.position.clone();
      else lt = v(-0.27, 1.0 + Math.sin(t * 2) * 0.01, 0.06 + Math.sin(this.walkT) * 0.08);
    }
    if (this.avatar) {
      // 外部モデル：体の座標をワールドへ直して、同じ手先へ腕を伸ばす
      const relaxed = !(this._victory > 0) && this.wtype !== 'gun' && !(this.wtype === 'katar' || this.wtype === 'claw' || this.wtype === 'bow' || this.wtype === 'lute' || this.wtype === 'tome');
      const hip = this.wtype === 'gun' && this.stance === 'hip';
      this.body.updateMatrixWorld(true);
      this.avatar.update(dt || 0.016, t, {
        moving, walkT: this.walkT,
        right: this.body.localToWorld(rt.clone()),
        left: (relaxed || hip) ? null : this.body.localToWorld(lt.clone())
      });
      return;
    }
    F.setArm(R, rt); F.setArm(L, lt);
  }

  /** 陽の化身へ／から戻す */
  setSolar(on) {
    this.solarOn = !!on;
    if (!on) {
      this.flame.visible = false;
      this.demon.visible = false;
      this.mortalParts.forEach(o => { o.visible = true; });
      this.group.scale.setScalar(1);
      this._mats.forEach(m => {
        m.emissive.setHex(m.userData._baseEmi);
        m.emissiveIntensity = m.userData._baseInt;
        if (m.color) m.color.setHex(m.userData._baseCol);
      });
      this.lamp.color.setHex(0xffe0b0);
      this.lamp.distance = 26;
    }
  }

  /** 化身中の見た目を毎フレーム進める */
  updateSolar(dt, t) {
    const target = this.solarOn ? 1 : 0;
    this._solarK += (target - this._solarK) * Math.min(1, dt * 4);
    const k = this._solarK;
    if (k < 0.01) return;
    // 身体が大きくなる
    this.group.scale.setScalar(1 + k * 0.45);
    // 黄金に燃える
    this._mats.forEach(m => {
      m.emissive.setHex(0xffb020);
      m.emissiveIntensity = m.userData._baseInt + k * 1.5;
      if (m.color) m.color.lerpColors(
        new THREE.Color(m.userData._baseCol), new THREE.Color(0xffd24a), k * 0.75);
    });
    // 魔神の意匠（角・光輪・鬣・陽紋）
    this.demon.visible = k > 0.08;
    this.mortalParts.forEach(o => { o.visible = k < 0.5; });   // 帽子は消える
    this.halo.rotation.z += dt * 0.5;
    this.crest.rotation.z -= dt * 1.4;
    this.mane.forEach((f, i) => {
      const w = 1 + Math.sin(t * 12 + i) * 0.28;
      f.m.scale.set(1, w, 1);
      f.m.position.y = 2.1 + Math.sin(t * 9 + i * 0.7) * 0.05;
    });
    // 炎の殻がゆらぐ
    this.flame.visible = k > 0.05;
    const puls = 1 + Math.sin(t * 9) * 0.06 + Math.sin(t * 17) * 0.03;
    this.flame.scale.setScalar((0.9 + k * 0.5) * puls);
    this.flame.material.opacity = 0.10 + k * 0.16 + Math.sin(t * 11) * 0.03;
    this.lamp.color.setHex(0xffc23a);
    this.lamp.intensity = 5 + k * 3;
    this.lamp.distance = 26 + k * 12;
  }

  /** 陣中帳に映すための姿（本編とは別に組み直す） */
  makePortrait() {
    if (this.avatar) return this.avatar.makePortrait();
    const g = this.group.clone(true);
    // 演出用の飾りは外し、素の立ち姿にする
    g.traverse(o => {
      if (o.isLight) o.visible = false;
      if (o.userData && o.userData.noPortrait) o.visible = false;
    });
    g.scale.setScalar(1);
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    return g;
  }

  /**
   * 装備に応じて姿を変える。
   * @param g {weapon, armor, charm} の等級 0〜5
   */
  applyLook(g) {
    g = g || {};
    const wr = g.weapon || 0, ar = g.armor || 0, cr = g.charm || 0;

    // ── 銃：等級が上がるほど銃身が太く、金環が増え、輝く ──
    const gunCol = [0x6a6e78, 0x7a7e88, 0x9a8a5a, 0xc0a050, 0xd8b860, 0xffd24a][wr] || 0x6a6e78;
    this.gun.traverse(o => {
      if (o.isMesh && o.material && o.material.color && o !== this.muzzle) {
        if (o.material.metalness > 0.5) o.material.color.setHex(gunCol);
      }
    });
    this.rings.forEach((r, i) => {
      r.visible = (i < 1 + Math.floor(wr * 0.8));
      if (r.material.emissive) {
        r.material.emissive.setHex(wr >= 5 ? 0xffd24a : 0xffd98a);
        r.material.emissiveIntensity = 0.6 + wr * 0.5;
      }
    });
    this.gun.scale.set(1 + wr * 0.05, 1 + wr * 0.05, 1 + wr * 0.07);
    this.muzzle.material.emissiveIntensity = 2.2 + wr * 0.8;

    // ── 防具：外套の色と肩当ての大きさ ──
    const coatCol = [0x2b2f3e, 0x35404f, 0x3a4a5a, 0x4a3a5a, 0x5a4a2a, 0xb08a30][ar] || 0x2b2f3e;
    if (this._coatMats) this._coatMats.forEach(m => m.color.setHex(coatCol));
    if (this._pauldrons) this._pauldrons.forEach(p => {
      p.scale.set(1 + ar * 0.08, 0.72 + ar * 0.05, 1 + ar * 0.08);
      if (p.material.color) p.material.color.setHex(ar >= 5 ? 0xffd24a : 0x8a7a52);
    });

    // ── 伝説の装備：黄金の外套と背の光輪 ──
    const legend = (wr >= 5 || ar >= 5 || cr >= 5);
    if (!this.legendAura) {
      const grp = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 10, 28),
        glowMaterial(0xffd24a, 2.6, true));
      ring.position.set(0, 1.5, -0.35);
      grp.add(ring);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 6), glowMaterial(0xffe27a, 2.2, true));
        sp.position.set(Math.cos(a) * 0.9, 1.5 + Math.sin(a) * 0.9, -0.35);
        sp.rotation.z = a - Math.PI / 2;
        grp.add(sp);
      }
      // 揺れる金の外套
      const cape = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.9, 1.5, 12, 1, true, 0.7, Math.PI * 1.6),
        new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.7,
          emissive: new THREE.Color(0x6a4a10), emissiveIntensity: 0.8, side: THREE.DoubleSide }));
      cape.position.set(0, 1.15, -0.24);
      grp.add(cape);
      this.legendRing = ring;
      this.legendCape = cape;
      this.legendAura = grp;
      this.group.add(grp);
    }
    this.legendAura.visible = legend;
    this._legend = legend;
    // 護符の等級で足元が輝く
    if (!this.charmGlow) {
      this.charmGlow = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.85, 24),
        new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.3,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      this.charmGlow.rotation.x = -Math.PI / 2;
      this.charmGlow.position.y = 0.04;
      this.group.add(this.charmGlow);
    }
    this.charmGlow.visible = cr >= 2;
    this.charmGlow.material.opacity = 0.12 + cr * 0.07;
  }

  muzzleFlash(strong) { this.muzzleLight.intensity = strong ? 8 : 3; }

  /** 銃口の実座標。回転に頼らず aim から直に出す */
  muzzleWorld(left) {
    const right = new THREE.Vector3(-this.aim.z, 0, this.aim.x);
    return new THREE.Vector3(this.pos.x, this.pos.y + 1.36, this.pos.z)
      .addScaledVector(this.aim, this.wtype === 'gun' ? 1.3 : 0.9)
      .addScaledVector(right, left ? -0.26 : 0.26);
  }
}
