/* player.js ── 陽光狩人 */
import * as THREE from 'three';
import { metalMaterial, glowMaterial, fleshMaterial } from './gfx.js';

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
    this.guard = 100;        // いまの心の耐久。守りが高いほど減りにくい
    this.guardMax = 100;
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
    scene.add(this.group);
  }

  _build() {
    const coatC = 0x2b2f3e, trimC = 0xb8934a, skinC = 0xe8cdb0;

    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.62, 0.95, 10, 1, true),
      new THREE.MeshStandardMaterial({ color: coatC, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide })
    );
    skirt.position.y = 0.62; skirt.castShadow = true;
    this.group.add(skirt);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.62, 6, 12), fleshMaterial(coatC));
    torso.position.y = 1.32; torso.castShadow = true;
    this.group.add(torso);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.055, 8, 18), metalMaterial(52, trimC));
    collar.rotation.x = Math.PI / 2; collar.position.y = 1.72;
    this.group.add(collar);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), fleshMaterial(skinC));
    head.position.y = 1.94; head.castShadow = true;
    this.group.add(head);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.55, 0.05, 20), fleshMaterial(0x1e222c));
    brim.position.y = 2.06;
    this.group.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.32, 16), fleshMaterial(0x1e222c));
    crown.position.y = 2.22; crown.castShadow = true;
    this.group.add(crown);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 8, 18), metalMaterial(53, trimC));
    band.rotation.x = Math.PI / 2; band.position.y = 2.09;
    this.group.add(band);

    [-1, 1].forEach(s => {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), metalMaterial(54, 0x8a7a52));
      p.position.set(0.4 * s, 1.6, 0); p.scale.set(1, 0.72, 1);
      p.castShadow = true;
      this.group.add(p);
    });

    this.legs = [];
    [-1, 1].forEach(s => {
      const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 4, 8), fleshMaterial(0x1a1d26));
      l.position.set(0.16 * s, 0.4, 0);
      this.group.add(l);
      this.legs.push(l);
    });

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
    this.gun.position.set(0.26, 1.36, 0);
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
    const cut = Math.min(0.9, (magical ? this.cutMag : this.cutPhys) + (this.wardT > 0 ? this.wardCut : 0));
    const dmg = Math.max(6, (power || 100) * (1 - cut));   // 最低でも少しは通る
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

    let sp = this.speed * (this.pushing ? 0.5 : 1) * (this.charging > 0 ? 0.45 : 1);
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
      this.gun.position.y += (1.36 - this.gun.position.y) * 0.3;
      this.orb.visible = false;
      this.chargeRing.visible = false;
      this.chargeRing2.visible = false;
      this.sigil.visible = false;
      this.rings.forEach(r => { r.material.emissiveIntensity = 0.6; r.scale.setScalar(1); });
      this.lamp.intensity = 5.0;
      this.muzzleLight.intensity *= 0.86;
    }

    this.group.visible = !(this.invuln > 0 && Math.floor(t * 12) % 2 === 0);
    this.muzzle.material.emissiveIntensity = 2.2 + c * 3;
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
    const g = this.group.clone(true);
    // 演出用の飾りは外し、素の立ち姿にする
    g.traverse(o => {
      if (o.isLight) o.visible = false;
    });
    g.scale.setScalar(1);
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    // 溜め・化身の意匠は隠す
    ['orb', 'chargeRing', 'chargeRing2', 'sigil', 'flame', 'demon'].forEach(k => {
      if (this[k]) {
        const i = this.group.children.indexOf(this[k]);
        if (i >= 0 && g.children[i]) g.children[i].visible = false;
      }
    });
    return g;
  }

  muzzleFlash(strong) { this.muzzleLight.intensity = strong ? 8 : 3; }

  /** 銃口の実座標。回転に頼らず aim から直に出す */
  muzzleWorld() {
    const right = new THREE.Vector3(-this.aim.z, 0, this.aim.x);
    return new THREE.Vector3(this.pos.x, 1.36, this.pos.z)
      .addScaledVector(this.aim, 1.3)
      .addScaledVector(right, 0.26);
  }
}
