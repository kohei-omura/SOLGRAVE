/* ══════════════════════════════════════════════════════════════
   miko.js ── 供の巫女「日和（ひより）」
     つかず離れず付いてきて、隙を見て祓いの舞で癒やす。
     暗い地下では手燈籠が周囲を照らす。
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { fleshMaterial, glowMaterial, metalMaterial } from './gfx.js';
import { buildHeroine } from './figure.js';

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
    // ── 人の姿（figure.js）：腰まで届く黒髪、白衣に緋袴 ──
    this.fig = buildHeroine();
    this.group.add(this.fig.root);
    this.sleeves = this.fig.sleeves;
    // 髪飾りの小さな鈴
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), metalMaterial(91, 0xc9a227));
    bell.position.set(0.1, 1.64, -0.03);
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
    this.staff.position.set(0.34, 0.66, 0.12);
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

  /**
   * 装備の等級で姿を変える（0〜5）。伝説級は冠・光の羽衣・勾玉の輪。
   * @param g {weapon, armor, charm}
   */
  applyLook(g) {
    g = g || {};
    const wr = g.weapon || 0, ar = g.armor || 0, cr = g.charm || 0;
    const key = wr + '|' + ar + '|' + cr;
    if (this._lookKey === key) return;
    this._lookKey = key;
    if (this.look) this.group.remove(this.look);
    const L = this.look = new THREE.Group();
    this.group.add(L);
    this._lookAnim = [];
    const gold = metalMaterial(96, 0xd8b040), white = fleshMaterial(0xfaf6ee);
    const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || L).add(m); return m; };

    // ── 祓いの道具（杖の先を飾る） ──
    if (this.tipGroup) this.staff.remove(this.tipGroup);
    const tip = new THREE.Group(); tip.position.y = 0.86; this.staff.add(tip); L.userData.tip = tip;
    this.staffRing.material = (wr >= 3) ? gold : metalMaterial(94, 0xc9a227);
    if (wr >= 1) for (let i = 0; i < 3 + wr * 2; i++) {
      const a = i / (3 + wr * 2) * Math.PI * 2;
      add(new THREE.SphereGeometry(0.03, 8, 6), gold, Math.cos(a) * 0.2, -0.12 - (i % 2) * 0.05, Math.sin(a) * 0.2, tip);
    }
    if (wr >= 2) for (let i = 0; i < 6; i++) {
      const sh = add(new THREE.BoxGeometry(0.05, 0.28, 0.01), white, Math.cos(i) * 0.12, -0.3, Math.sin(i) * 0.12, tip);
      sh.rotation.y = i;
    }
    if (wr >= 4) add(new THREE.SphereGeometry(0.11, 12, 10), glowMaterial(0xffe0a0, 3.0), 0, 0, 0, tip);
    if (wr >= 5) {            // 日輪を戴く杖
      const sun = new THREE.Group(); sun.position.y = 0.3; tip.add(sun);
      add(new THREE.TorusGeometry(0.26, 0.03, 8, 28), glowMaterial(0xffd24a, 3.0), 0, 0, 0, sun);
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        const r = add(new THREE.ConeGeometry(0.03, 0.18, 5), glowMaterial(0xffe27a, 2.6), Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0, sun);
        r.rotation.z = a - Math.PI / 2;
      }
      this._lookAnim.push((t) => { sun.rotation.z = t * 0.8; });
    }
    this.tipGroup = tip;

    // ── 装束 ──
    const robeCol = [0, 0xfaf6ee, 0xe8a0b0, 0xe8eef8, 0xf4f0ff, 0xfff4d8][ar];
    if (ar >= 1) {            // 千早（透ける上衣）
      const ch = add(new THREE.CylinderGeometry(0.17, 0.3, 0.5, 18, 1, true),
        new THREE.MeshStandardMaterial({ color: robeCol, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.6 }), 0, 1.2, 0);
      ch.castShadow = false;
      add(new THREE.TorusGeometry(0.15, 0.012, 6, 16), fleshMaterial(0xb3424a), 0, 1.3, 0.0).rotation.x = Math.PI / 2;
    }
    if (ar >= 3) {            // 長い打掛の裾
      const uk = add(new THREE.CylinderGeometry(0.2, 0.44, 1.3, 20, 1, true, Math.PI * 0.2, Math.PI * 1.6),
        new THREE.MeshStandardMaterial({ color: robeCol, roughness: 0.5, side: THREE.DoubleSide,
          emissive: new THREE.Color(ar >= 5 ? 0x6a4a10 : 0x202030), emissiveIntensity: 0.4 }), 0, 0.7, -0.02);
      uk.rotation.y = 0;   // 前を開けて緋袴を見せる
    }
    if (ar >= 4) {            // 宙に揺れる羽衣
      [-1, 1].forEach(sx => {
        const rib = new THREE.Group(); rib.position.set(0.22 * sx, 1.28, -0.1); L.add(rib);
        const segs = [];
        for (let i = 0; i < 8; i++) {
          const sgm = add(new THREE.BoxGeometry(0.16, 0.02, 0.2),
            new THREE.MeshStandardMaterial({ color: ar >= 5 ? 0xffe8a0 : 0xe8f0ff, transparent: true, opacity: 0.7,
              emissive: new THREE.Color(ar >= 5 ? 0xffc040 : 0x8090c0), emissiveIntensity: ar >= 5 ? 1.2 : 0.5, side: THREE.DoubleSide }),
            sx * (0.06 + i * 0.07), -i * 0.1, -i * 0.05, rib);
          segs.push(sgm);
        }
        this._lookAnim.push((t) => segs.forEach((sg, i) => { sg.position.y = -i * 0.1 + Math.sin(t * 2.4 + i * 0.6) * 0.04 * i; sg.rotation.z = Math.sin(t * 2 + i) * 0.3; }));
      });
    }
    if (ar >= 5) {            // 黄金の冠と背の光輪
      const crown = new THREE.Group(); crown.position.set(0, 1.66, -0.01); crown.scale.setScalar(0.72); L.add(crown);
      add(new THREE.CylinderGeometry(0.2, 0.22, 0.06, 16), gold, 0, 0, 0, crown);
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2;
        add(new THREE.ConeGeometry(0.03, i % 2 ? 0.14 : 0.24, 5), gold, Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.2, crown);
      }
      add(new THREE.SphereGeometry(0.04, 8, 6), glowMaterial(0xff6a6a, 2.6), 0, 0.05, 0.22, crown);
      const halo = add(new THREE.TorusGeometry(0.5, 0.025, 8, 32), glowMaterial(0xffd24a, 2.6), 0, 1.5, -0.32);
      this._lookAnim.push((t) => { halo.rotation.z = t * 0.5; });
    }

    // ── 髪飾り・護符 ──
    if (cr >= 1) {            // 桜の簪
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        add(new THREE.SphereGeometry(0.022, 6, 5), fleshMaterial(0xffb0c8), -0.1 + Math.cos(a) * 0.03, 1.64 + Math.sin(a) * 0.03, -0.02);
      }
    }
    if (cr >= 2) {            // 勾玉の首飾り
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * 0.2 + i / 6 * Math.PI * 0.6;
        add(new THREE.SphereGeometry(0.016, 6, 5), glowMaterial(0x6affa0, 1.2), Math.cos(a) * 0.1, 1.36 - Math.sin(a) * 0.04, Math.sin(a) * 0.1);
      }
    }
    if (cr >= 3 && ar < 5) {  // 前天冠
      add(new THREE.BoxGeometry(0.18, 0.035, 0.02), gold, 0, 1.655, 0.1);
      add(new THREE.ConeGeometry(0.025, 0.08, 4), gold, 0, 1.7, 0.1);
    }
    if (cr >= 5) {            // 宙に浮かぶ勾玉の輪
      const ring = new THREE.Group(); ring.position.y = 1.1; L.add(ring);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        const mg = add(new THREE.SphereGeometry(0.06, 8, 6), glowMaterial(i % 2 ? 0x6affa0 : 0xffd24a, 2.4), Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75, ring);
        mg.scale.set(1, 1, 1.5);
      }
      this._lookAnim.push((t) => { ring.rotation.y = t * 1.2; ring.position.y = 1.1 + Math.sin(t * 2) * 0.08; });
    }
    // 伝説級の光
    this._legendGlow = (wr >= 5 || ar >= 5 || cr >= 5);
    L.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }

  /** 外部の人物モデルに差し替える（null で元の姿へ） */
  useAvatar(rig) {
    if (this.avatar) this.group.remove(this.avatar.root);
    this.avatar = rig || null;
    this.fig.root.visible = !rig;
    if (this.bell) this.bell.visible = !rig;
    if (rig) this.group.add(rig.root);
  }

  /** 陣中帳に映すための姿 */
  makePortrait() {
    if (this.avatar) return this.avatar.makePortrait();
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
    this.bell.position.y = 1.64 + Math.sin(t * 6) * 0.008;
    if (this.avatar) {
      // 右手は杖を握り、祓いの舞では左手も掲げる
      this.group.updateMatrixWorld(true);
      const grip = this.staff.localToWorld(new THREE.Vector3(0, 0.3, 0));
      const lift = this.healing > 0 ? this.group.localToWorld(new THREE.Vector3(-0.28, 1.45, 0.25)) : null;
      const dtA = this._lastA ? Math.min(0.1, t - this._lastA) : 0.016; this._lastA = t;
      this.avatar.update(dtA, t, { moving: sp !== 0, walkT: this.walkT, right: grip, left: lift });
    } else this.fig.update(t, { moving: sp !== 0 });
    // 杖は歩くとわずかに揺れ、鈴が鳴るように動く
    this.staff.rotation.z = -0.16 + Math.sin(t * 2.2) * 0.05;
    this.staffBells.forEach((b, i) => {
      b.m.position.y = 0.78 + Math.sin(t * 7 + i * 1.4) * 0.008;
    });

    if (this._lookAnim) this._lookAnim.forEach(f => f(t));
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
