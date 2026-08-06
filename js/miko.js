/* ══════════════════════════════════════════════════════════════
   miko.js ── 供の巫女「日和（ひより）」
     つかず離れず付いてきて、隙を見て祓いの舞で癒やす。
     暗い地下では手燈籠が周囲を照らす。
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { fleshMaterial, glowMaterial, metalMaterial } from './gfx.js';

export class Miko {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.pos = new THREE.Vector3();
    this.radius = 0.45;
    this.healCd = 0;          // 回復の再使用まで
    this.mp = 34; this.maxMp = 34;   // 霊力（祓いに使う）
    this.mpRegen = 1.2;
    this.healCost = 12;
    this.healAmount = 1;
    this.cdMax = 12;
    this.followSpeed = 9.5;
    this.critHeal = 0.03;     // まれに倍で癒す
    this.stagger = 0;         // 打たれてよろけている残り
    this.toughness = 1;       // 立ち直りの速さ（HP/DEF由来）
    this.sweep = 0;           // 杖で打ち払う力（ATK由来）
    this.wardCut = 0;         // 加護の軽減率（MDEF由来）
    this.wardSec = 0;
    this.healing = 0;         // 舞の残り時間
    this.follow = 2.6;        // 追従距離
    this.walkT = 0;
    this.group = new THREE.Group();
    this._build();
    scene.add(this.group);
  }

  _build() {
    const hakama = 0xb3424a, haku = 0xf4efe6, hair = 0x1b1620;

    // 緋袴
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.52, 0.82, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: hakama, roughness: 0.8, side: THREE.DoubleSide })
    );
    skirt.position.y = 0.5; skirt.castShadow = true;
    this.group.add(skirt);

    // 白衣
    const top = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.42, 6, 12), fleshMaterial(haku));
    top.position.y = 1.08; top.castShadow = true;
    this.group.add(top);
    // 袖
    this.sleeves = [];
    [-1, 1].forEach(s => {
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 0.46, 10), fleshMaterial(haku));
      sl.position.set(0.3 * s, 1.06, 0);
      sl.castShadow = true;
      this.group.add(sl);
      this.sleeves.push(sl);
    });

    // 頭
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 14), fleshMaterial(0xf6dcc8));
    head.position.y = 1.52; head.castShadow = true;
    this.group.add(head);

    // 前髪
    const bang = new THREE.Mesh(new THREE.SphereGeometry(0.225, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), fleshMaterial(hair));
    bang.position.y = 1.55;
    this.group.add(bang);
    // 後ろ髪（長い黒髪）
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.62, 6, 10), fleshMaterial(hair));
    back.position.set(0, 1.18, -0.16);
    back.castShadow = true;
    this.group.add(back);
    // 結い紐
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.035, 8, 16), fleshMaterial(0xf4efe6));
    tie.rotation.x = Math.PI / 2; tie.position.set(0, 1.32, -0.16);
    this.group.add(tie);

    // 目（伏し目がちの点目）
    [-1, 1].forEach(s => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), fleshMaterial(0x241c26));
      e.position.set(0.075 * s, 1.5, 0.19);
      this.group.add(e);
    });

    // 髪飾り（鈴）
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), metalMaterial(91, 0xc9a227));
    bell.position.set(0.18, 1.62, 0.06);
    this.group.add(bell);
    this.bell = bell;

    // ── 祓いの杖（普段は光らない。祓いのときだけ灯る） ──
    this.staff = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.034, 1.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.8, metalness: 0.05 })
    );
    shaft.position.y = 0.05;
    this.staff.add(shaft);
    // 金の環飾り
    [0.5, 0.62].forEach(y => {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 8, 14), metalMaterial(93, 0xc9a227));
      r.rotation.x = Math.PI / 2; r.position.y = y;
      this.staff.add(r);
    });
    // 先端の輪（遊環）
    this.staffRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 10, 22), metalMaterial(94, 0xc9a227));
    this.staffRing.position.y = 0.86;
    this.staff.add(this.staffRing);
    // 小さな鈴を4つ
    this.staffBells = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const bl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), metalMaterial(95, 0xd8b84a));
      bl.position.set(Math.cos(a) * 0.16, 0.78, Math.sin(a) * 0.16);
      this.staff.add(bl);
      this.staffBells.push({ m: bl, a });
    }
    // 宝珠（祓いのときだけ発光）
    this.orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 12, 10),
      new THREE.MeshStandardMaterial({
        color: 0xf0e4d0, emissive: new THREE.Color(0xffe9a8),
        emissiveIntensity: 0, roughness: 0.35, metalness: 0.1
      })
    );
    this.orb.position.y = 0.86;
    this.staff.add(this.orb);
    // 紙垂（しで）
    [-1, 1].forEach(sx => {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.012), fleshMaterial(0xf4efe6));
      sh.position.set(0.1 * sx, 0.66, 0);
      this.staff.add(sh);
    });
    this.staff.position.set(0.34, 0.62, 0.1);
    this.staff.rotation.z = -0.16;
    this.group.add(this.staff);

    // 杖の灯り（普段は消灯）
    this.staffLight = new THREE.PointLight(0xffe9a8, 0, 14, 2);
    this.staffLight.position.set(0.34, 1.48, 0.1);
    this.group.add(this.staffLight);

    // 祓いの舞（回復）の陣
    this.circle = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 1.9, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    this.circle.rotation.x = -Math.PI / 2;
    this.circle.position.y = 0.06;
    this.group.add(this.circle);
  }

  /** 陣中帳に映すための姿 */
  makePortrait() {
    const g = this.group.clone(true);
    g.traverse(o => { if (o.isLight) o.visible = false; });
    g.scale.setScalar(1);
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    if (this.circle) {
      const i = this.group.children.indexOf(this.circle);
      if (i >= 0 && g.children[i]) g.children[i].visible = false;
    }
    return g;
  }

  /** 能力値を実際の働きに反映する */
  applyStats(c) {
    if (!c) return;
    this.maxMp    = c.maxMp;
    this.mp       = Math.min(this.mp, this.maxMp);
    this.mpRegen  = c.mpRegen;
    this.healAmount = 1 + Math.floor(c.get('MATK') / 55);          // 霊撃：癒す量
    this.healCost = Math.max(6, 12 - Math.floor(c.get('MP') / 90)); // 霊力：燃費
    this.cdMax    = Math.max(3, 12 / (1 + c.get('DEX') * 0.009));   // 技巧：待機短縮
    this.followSpeed = 9.5 * Math.min(2.0, 1 + c.get('AGI') * 0.008); // 敏捷：追従
    this.critHeal = Math.min(0.5, c.get('LUK') * 0.0035);           // 幸運：倍加
    this.toughness = 1 + c.get('DEF') * 0.02 + c.get('HP') * 0.008; // 体力/守り：立ち直り
    this.sweep    = c.get('ATK') * 0.02;                            // 攻撃：打ち払い
    this.wardCut  = Math.min(0.5, c.get('MDEF') * 0.0035);          // 霊防：加護
    this.wardSec  = 3 + c.get('MDEF') * 0.02;
  }

  /** 祓えるか */
  canHeal() { return this.healCd <= 0 && this.stagger <= 0 && this.mp >= this.healCost; }

  /** 打たれてよろける */
  knock() {
    this.stagger = Math.max(this.stagger, 2.2 / this.toughness);
    this.healing = 0;
  }

  reset(p) {
    this.pos.copy(p).add(new THREE.Vector3(1.6, 0, -1.2));
    this.healCd = 0; this.healing = 0; this.stagger = 0; this.mp = this.maxMp;
    this.group.position.copy(this.pos);
  }

  /**
   * @returns 'heal' を返したらプレイヤーを1回復させる
   */
  update(dt, player, world, t, inDanger) {
    const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
    const d = Math.hypot(dx, dz) || 1;

    // つかず離れず。危ないときは少し離れる
    const want = inDanger ? this.follow + 1.4 : this.follow;
    let sp = 0;
    if (d > want + 0.4) sp = Math.min(9.5, player.speed * 1.15);
    else if (d < want - 0.8) sp = -3.2;
    if (sp !== 0) {
      this.pos.x += (dx / d) * sp * dt;
      this.pos.z += (dz / d) * sp * dt;
      world.resolve(this.pos, this.radius);
      this.walkT += dt * 8;
    } else {
      this.walkT += dt * 1.6;
    }
    this.group.position.copy(this.pos);
    // 進む向き（止まっているときはプレイヤーの方を向く）
    const face = Math.atan2(dx, dz);
    let cur = this.group.rotation.y;
    let diff = ((face - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.group.rotation.y = cur + diff * Math.min(1, dt * 6);

    // 袖と鈴の揺れ
    this.sleeves[0].rotation.x = Math.sin(this.walkT) * 0.35;
    this.sleeves[1].rotation.x = -Math.sin(this.walkT) * 0.35;
    this.bell.position.y = 1.62 + Math.sin(t * 6) * 0.012;
    // 杖は歩くとわずかに揺れ、鈴が鳴るように動く
    this.staff.rotation.z = -0.16 + Math.sin(t * 2.2) * 0.05;
    this.staffBells.forEach((b, i) => {
      b.m.position.y = 0.78 + Math.sin(t * 7 + i * 1.4) * 0.008;
    });

    // 霊力は少しずつ戻る
    this.mp = Math.min(this.maxMp, this.mp + this.mpRegen * dt);
    if (this.stagger > 0) {
      this.stagger -= dt;
      this.staff.rotation.z = -0.16 + Math.sin(t * 22) * 0.18;   // よろける
    }
    // 回復
    if (this.healCd > 0) this.healCd -= dt;
    let out = null;
    if (this.healing > 0) {
      this.healing -= dt;
      const k = Math.max(0, this.healing / 1.6);
      this.circle.material.opacity = 0.55 * k;
      this.circle.scale.setScalar(0.6 + (1 - k) * 0.9);
      this.circle.rotation.z += dt * 2.4;
      this.sleeves[0].rotation.z = 0.9 * k;
      this.sleeves[1].rotation.z = -0.9 * k;
      // 杖を掲げ、宝珠が灯る
      const lift = Math.sin((1 - k) * Math.PI);
      this.staff.rotation.z = -0.16 - lift * 0.9;
      this.staff.position.y = 0.62 + lift * 0.3;
      this.orb.material.emissiveIntensity = 4.5 * k;
      this.staffRing.material.emissive = this.staffRing.material.emissive || null;
      this.staffLight.intensity = 5.5 * k;
      if (this.particles && Math.random() < 0.5) {
        this.particles.emit(this.pos, 3, { color: [1, 0.96, 0.78], size: 2.6, up: 2.2, yOff: 0.4 });
      }
      if (this.healing <= 0) {
        this.sleeves[0].rotation.z = 0; this.sleeves[1].rotation.z = 0;
        this.circle.material.opacity = 0;
        this.orb.material.emissiveIntensity = 0;
        this.staffLight.intensity = 0;
        this.staff.rotation.z = -0.16;
        this.staff.position.y = 0.62;
      }
    }
    // 回復は「祓い」ボタンから呼ぶ。ここでは待機時間を進めるだけ
    // （以前ここで自動発動していたため、待機時間が延々と上書きされていた）
    return out;
  }
}
