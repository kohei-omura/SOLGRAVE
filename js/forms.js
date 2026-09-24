/* ══════════════════════════════════════════════════════════════
   forms.js ── 異形の姿を組む
     階の主（28体）と中ボス（10体）の「形そのもの」をここで作る。
     色違いではなく、骨格・翼・尾・触手・首の数まで作り分ける。
     外部の模型は使わず、基本形の組み合わせだけで組む。
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const HP = Math.PI / 2;

/* ── 組み立ての道具 ── */
export class Kit {
  constructor() {
    this.root = new THREE.Group();
    this.anims = [];          // (t, st) => void
    this.mats = [];
    this.eyeMats = [];
  }
  m(color, o) {
    o = o || {};
    const mt = new THREE.MeshStandardMaterial({
      color, roughness: o.r == null ? 0.72 : o.r, metalness: o.me == null ? 0.08 : o.me,
      emissive: new THREE.Color(o.e == null ? 0x000000 : o.e), emissiveIntensity: o.ei || 0,
      transparent: o.op != null, opacity: o.op == null ? 1 : o.op,
      side: o.ds ? THREE.DoubleSide : THREE.FrontSide,
      depthWrite: o.op == null
    });
    this.mats.push(mt);
    return mt;
  }
  glow(c, i) { const g = this.m(c, { e: c, ei: i == null ? 2.6 : i, r: 0.4 }); return g; }
  eyeGlow(c, i) { const g = this.glow(c, i == null ? 4 : i); this.eyeMats.push(g); return g; }
  grp(p, parent) {
    const g = new THREE.Group();
    if (p) g.position.set(p[0], p[1], p[2]);
    (parent || this.root).add(g);
    return g;
  }
  add(geo, mat, p, r, s, parent) {
    const me = new THREE.Mesh(geo, mat);
    if (p) me.position.set(p[0], p[1], p[2]);
    if (r) me.rotation.set(r[0], r[1], r[2]);
    if (s) { if (typeof s === 'number') me.scale.setScalar(s); else me.scale.set(s[0], s[1], s[2]); }
    me.castShadow = true;
    (parent || this.root).add(me);
    return me;
  }
  sphere(rad, mat, p, s, parent, seg) { return this.add(new THREE.SphereGeometry(rad, seg || 14, Math.max(6, (seg || 14) - 2)), mat, p, null, s, parent); }
  box(w, h, d, mat, p, r, parent) { return this.add(new THREE.BoxGeometry(w, h, d), mat, p, r, null, parent); }
  cyl(a, b, h, mat, p, r, parent, seg) { return this.add(new THREE.CylinderGeometry(a, b, h, seg || 12), mat, p, r, null, parent); }
  cone(rad, h, mat, p, r, parent, seg) { return this.add(new THREE.ConeGeometry(rad, h, seg || 10), mat, p, r, null, parent); }
  cap(rad, len, mat, p, r, parent) { return this.add(new THREE.CapsuleGeometry(rad, len, 5, 10), mat, p, r, null, parent); }
  torus(R, r, mat, p, rot, parent, arc) { return this.add(new THREE.TorusGeometry(R, r, 8, 28, arc || Math.PI * 2), mat, p, rot, null, parent); }

  /** 光る両眼 */
  eyes(parent, y, z, dx, rad, color, n) {
    n = n || 2;
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * dx;
      this.sphere(rad, this.eyeGlow(color), [x, y, z], null, parent, 8);
    }
  }
  /** 反り返る角（円錐を連ねる） */
  horn(parent, p, len, rad, bendX, bendZ, mat) {
    let g = this.grp(p, parent);
    const base = g;
    const n = 4, seg = len / n;
    for (let i = 0; i < n; i++) {
      const r0 = rad * (1 - i / n), r1 = rad * (1 - (i + 1) / n) + 0.004;
      this.cyl(r1, r0, seg, mat, [0, seg / 2, 0], null, g, 7);
      const ng = this.grp([0, seg, 0], g);
      ng.rotation.x = bendX; ng.rotation.z = bendZ;
      g = ng;
    }
    return base;
  }
  /** 鎖状の連なり（尾・首・触手）。+Y 方向へ伸びる */
  chain(parent, p, n, seg, r0, r1, mat, sway, opt) {
    opt = opt || {};
    const base = this.grp(p, parent);
    let g = base;
    const links = [];
    for (let i = 0; i < n; i++) {
      const k = i / Math.max(1, n - 1);
      const r = r0 + (r1 - r0) * k;
      if (opt.caps) this.cap(r, seg * 0.8, mat, [0, seg / 2, 0], null, g);
      else this.sphere(r, mat, [0, seg / 2, 0], null, g, 10);
      const ng = this.grp([0, seg, 0], g);
      if (opt.bend) { ng.rotation.x = opt.bend[0]; ng.rotation.z = opt.bend[1] || 0; }
      links.push(ng);
      g = ng;
    }
    base.userData.tip = g;
    if (sway) {
      const ph = Math.random() * 6.28;
      const bx = links.map(l => l.rotation.x), bz = links.map(l => l.rotation.z);
      this.anims.push((t, st) => {
        const a = sway.a * (1 + (st.rage || 0) * 0.6);
        links.forEach((l, i) => {
          l.rotation.x = bx[i] + Math.sin(t * sway.f + i * 0.6 + ph) * a;
          l.rotation.z = bz[i] + Math.cos(t * sway.f * 0.8 + i * 0.5 + ph) * a * (sway.z == null ? 0.6 : sway.z);
        });
      });
    }
    return base;
  }
  /** 蝙蝠の翼（膜） */
  batWing(parent, side, p, span, mat, boneMat, flap) {
    const piv = this.grp(p, parent);
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(span * 0.35, span * 0.42);
    sh.lineTo(span * 1.0, span * 0.28);
    sh.quadraticCurveTo(span * 0.82, 0.02, span * 0.9, -span * 0.3);
    sh.quadraticCurveTo(span * 0.62, -span * 0.12, span * 0.58, -span * 0.44);
    sh.quadraticCurveTo(span * 0.36, -span * 0.16, span * 0.26, -span * 0.4);
    sh.quadraticCurveTo(span * 0.12, -span * 0.12, 0, -span * 0.12);
    const geo = new THREE.ShapeGeometry(sh, 10);
    const mesh = this.add(geo, mat, [0, 0, 0], [0, 0, 0], [side, 1, 1], piv);
    mesh.material.side = THREE.DoubleSide;
    // 骨
    [[0.35, 0.42], [1.0, 0.28], [0.9, -0.3], [0.58, -0.44], [0.26, -0.4]].forEach(([x, y]) => {
      const len = Math.hypot(x, y) * span;
      const b = this.cyl(0.02 * span, 0.035 * span, len, boneMat, [side * x * span / 2, y * span / 2, 0.01], [0, 0, Math.atan2(y, x * side) - HP], piv, 5);
      b.castShadow = false;
    });
    piv.rotation.y = side * 0.5;
    const f = flap || 3;
    this.anims.push((t, st) => {
      piv.rotation.z = side * (0.25 + Math.sin(t * f * (1 + (st.rage || 0) * 0.5)) * 0.45);
      piv.rotation.y = side * (0.55 + Math.sin(t * f + 1) * 0.15);
    });
    return piv;
  }
  /** 羽根の翼 */
  featherWing(parent, side, p, span, mat, n, flap) {
    const piv = this.grp(p, parent);
    n = n || 7;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const len = span * (0.55 + 0.45 * Math.sin(k * Math.PI * 0.9 + 0.2));
      const f = this.box(0.16 * span / 2, len, 0.03, mat, [side * (0.15 + k * span * 0.8), len * 0.35 - k * 0.3 * span, -k * 0.05], [0, 0, side * (-0.3 - k * 1.1)], piv);
      f.castShadow = true;
    }
    piv.rotation.y = side * 0.45;
    this.anims.push((t, st) => {
      piv.rotation.z = side * (Math.sin(t * (flap || 2.4)) * 0.35 - 0.1);
    });
    return piv;
  }
  /** 裾の裂けた衣 */
  robe(parent, rTop, rBot, h, mat, y, tatter) {
    const geo = new THREE.CylinderGeometry(rTop, rBot, h, 18, 3, true);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const yy = pos.getY(i);
      if (yy < -h / 2 + 0.01 && tatter) {
        const a = Math.atan2(pos.getZ(i), pos.getX(i));
        pos.setY(i, yy + (Math.sin(a * 7) * 0.5 + 0.5) * tatter);
      }
    }
    geo.computeVertexNormals();
    mat.side = THREE.DoubleSide;
    const me = this.add(geo, mat, [0, y, 0], null, null, parent);
    return me;
  }
  /** 冠 */
  crown(parent, r, y, mat, spikes, gem) {
    const g = this.grp([0, y, 0], parent);
    this.cyl(r, r * 1.05, 0.14, mat, [0, 0, 0], null, g, 16);
    for (let i = 0; i < spikes; i++) {
      const a = i / spikes * Math.PI * 2;
      this.cone(r * 0.2, r * (i % 2 ? 0.6 : 0.9), mat, [Math.cos(a) * r, r * 0.35, Math.sin(a) * r], null, g, 5);
    }
    if (gem) this.sphere(r * 0.18, gem, [0, 0.05, r], null, g, 8);
    return g;
  }
  /** 上下にゆっくり漂う */
  hover(g, amp, f) {
    const y0 = g.position.y;
    this.anims.push(t => { g.position.y = y0 + Math.sin(t * (f || 1.6)) * amp; });
  }
  spin(g, speed, axis) {
    this.anims.push(t => { g.rotation[axis || 'y'] = t * speed; });
  }
  /** 腕（上腕・前腕・手の先） */
  arm(parent, side, p, len, r, mat, handMat) {
    const sh = this.grp(p, parent);
    this.cap(r, len * 0.45, mat, [0, -len * 0.28, 0], null, sh);
    const el = this.grp([0, -len * 0.55, 0], sh);
    this.cap(r * 0.85, len * 0.4, handMat || mat, [0, -len * 0.25, 0], null, el);
    const hand = this.grp([0, -len * 0.5, 0], el);
    sh.rotation.z = side * 0.25;
    el.rotation.x = -0.4;
    return { sh, el, hand };
  }
  done(extra) {
    this.root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    return Object.assign({ root: this.root, anims: this.anims, mats: this.mats, eyeMats: this.eyeMats }, extra || {});
  }
}

/* 腕を振る所作を足す（攻撃の瞬間 st.atk が 1→0） */
function swingArms(K, arms, amp) {
  const base = arms.map(a => ({ x: a.sh.rotation.x, z: a.sh.rotation.z }));
  K.anims.push((t, st) => {
    arms.forEach((a, i) => {
      const s = i % 2 ? -1 : 1;
      a.sh.rotation.x = base[i].x + Math.sin(t * 2 + i) * 0.12 - (st.atk || 0) * (amp || 1.6);
      a.sh.rotation.z = base[i].z + s * Math.sin(t * 1.3) * 0.05;
    });
  });
}

/* ═══════════════ 階の主 ═══════════════
   pattern : 基本の攻め（rush 突進／volley 弾／spiral 渦弾／zones 範囲／
             summon 召喚／clone 分身／mist 霧化／claw 爪）
   p2      : 第二相の技と、そのとき出す文言
   hitR/hitY : 当たりの大きさと高さ
─────────────────────────────────────── */
export const LORDS = [
  { id: 'vampire',  name: '古き吸血鬼',       aura: 0xff1a1a, moves: ['mist', 'rush', 'claw', 'volley'], p2: 'clone', p2t: '影 を 見 極 め よ', hitR: 1.6, hitY: 1.8 },
  { id: 'lich',     name: 'リッチ',           aura: 0x7affd0, moves: ['volley', 'zones', 'claw'], p2: 'summon', p2t: '骸 の 軍 勢 を 祓 え', hitR: 1.6, hitY: 2.0 },
  { id: 'dullahan', name: 'デュラハン',       aura: 0x8affd0, moves: ['rush', 'claw', 'zones'], p2: 'rage', p2t: '首 無 き 騎 士 が 猛 る', hitR: 1.9, hitY: 1.8 },
  { id: 'banshee',  name: 'バンシー',         aura: 0xb0c8ff, moves: ['spiral', 'volley'], p2: 'clone', p2t: '泣 き 声 の 主 を 探 せ', hitR: 1.5, hitY: 2.2 },
  { id: 'nolife',   name: 'ノーライフキング', aura: 0xffe08a, moves: ['volley', 'summon', 'zones'], p2: 'zones', p2t: '王 の 裁 き を 避 け よ', hitR: 1.8, hitY: 2.0 },
  { id: 'shuten',   name: '酒呑童子',         aura: 0xffb020, moves: ['rush', 'claw', 'zones'], p2: 'rage', p2t: '鬼 の 怒 り を 凌 げ', hitR: 2.2, hitY: 2.0 },
  { id: 'kyubi',    name: '九尾の狐',         aura: 0xffd24a, moves: ['spiral', 'volley', 'rush'], p2: 'clone', p2t: '真 の 狐 を 見 極 め よ', hitR: 2.0, hitY: 1.4 },
  { id: 'tengu',    name: '崇徳上皇・大天狗', aura: 0xff6a2a, moves: ['volley', 'rush', 'spiral'], p2: 'summon', p2t: '天 狗 の 眷 属 が 舞 う', hitR: 1.8, hitY: 2.2 },
  { id: 'orochi',   name: '八岐大蛇',         aura: 0x6affa0, moves: ['volley', 'zones', 'claw'], p2: 'spiral', p2t: '八 つ の 首 が 吼 え る', hitR: 2.6, hitY: 1.8 },
  { id: 'typhon',   name: 'テュポーン',       aura: 0xff5a3a, moves: ['zones', 'volley', 'rush'], p2: 'spiral', p2t: '百 の 蛇 頭 が 嵐 を 呼 ぶ', hitR: 2.4, hitY: 2.6 },
  { id: 'medusa',   name: 'メドゥーサ',       aura: 0xa0ff6a, moves: ['volley', 'claw', 'summon'], p2: 'zones', p2t: '石 化 の 眼 差 し を 避 け よ', hitR: 1.8, hitY: 1.9 },
  { id: 'loki',     name: 'ロキ',             aura: 0x6affb0, moves: ['volley', 'spiral', 'rush'], p2: 'clone', p2t: '欺 き の 神 を 見 破 れ', hitR: 1.5, hitY: 1.9 },
  { id: 'vritra',   name: 'ヴリトラ',         aura: 0x4ad0ff, moves: ['rush', 'zones', 'volley'], p2: 'rage', p2t: '堰 き 止 め る 竜 が 暴 れ る', hitR: 2.6, hitY: 1.6 },
  { id: 'pazuzu',   name: 'パズズ',           aura: 0xffe24a, moves: ['spiral', 'rush', 'summon'], p2: 'spiral', p2t: '熱 風 の 渦 を 抜 け よ', hitR: 1.8, hitY: 2.2 },
  { id: 'baal',     name: 'バアル',           aura: 0xd08aff, moves: ['volley', 'summon', 'rush'], p2: 'clone', p2t: '三 つ 首 の 王 を 見 極 め よ', hitR: 2.2, hitY: 2.2 },
  { id: 'amon',     name: 'アモン',           aura: 0xff5a1a, moves: ['rush', 'volley', 'claw'], p2: 'zones', p2t: '地 獄 の 炎 を 避 け よ', hitR: 2.0, hitY: 1.4 },
  { id: 'marchosias', name: 'マルコシアス',   aura: 0x8ab0ff, moves: ['rush', 'spiral', 'claw'], p2: 'rage', p2t: '翼 あ る 狼 が 猛 る', hitR: 2.0, hitY: 1.6 },
  { id: 'buer',     name: 'ブエル',           aura: 0xffc86a, moves: ['rush', 'spiral', 'zones'], p2: 'spiral', p2t: '五 脚 の 車 輪 が 回 る', hitR: 2.0, hitY: 1.4 },
  { id: 'beelzebub', name: 'ベルゼブブ',      aura: 0xa0ff4a, moves: ['volley', 'summon', 'spiral'], p2: 'summon', p2t: '蠅 の 群 れ を 祓 え', hitR: 2.0, hitY: 2.2 },
  { id: 'asmodeus', name: 'アスモデウス',     aura: 0xff4a8a, moves: ['volley', 'zones', 'rush'], p2: 'clone', p2t: '三 貌 の 王 を 見 破 れ', hitR: 2.0, hitY: 2.2 },
  { id: 'lilith',   name: 'リリス',           aura: 0xff6ad0, moves: ['spiral', 'volley', 'claw'], p2: 'clone', p2t: '夜 の 魔 女 を 見 極 め よ', hitR: 1.5, hitY: 2.0 },
  { id: 'iblis',    name: 'イブリース',       aura: 0xff8a2a, moves: ['zones', 'volley', 'rush'], p2: 'zones', p2t: '劫 火 を 凌 げ', hitR: 1.8, hitY: 2.2 },
  { id: 'satan',    name: 'サタン',           aura: 0xff2020, moves: ['zones', 'volley', 'summon', 'rush'], p2: 'rage', p2t: '魔 王 が 真 の 姿 を 現 す', hitR: 2.6, hitY: 2.6 },
  { id: 'cthulhu',  name: 'クトゥルフ',       aura: 0x4affc8, moves: ['zones', 'summon', 'volley'], p2: 'spiral', p2t: '夢 見 る 神 が 目 覚 め る', hitR: 2.8, hitY: 2.6 },
  { id: 'nyarla',   name: 'ニャルラトホテプ', aura: 0xb04aff, moves: ['clone', 'volley', 'spiral'], p2: 'clone', p2t: '千 の 貌 か ら 本 体 を 探 せ', hitR: 1.8, hitY: 2.2 },
  { id: 'yog',      name: 'ヨグ＝ソトース',   aura: 0xffe0ff, moves: ['spiral', 'zones', 'summon'], p2: 'spiral', p2t: '門 に し て 鍵 が 開 く', hitR: 2.8, hitY: 2.4 },
  { id: 'azathoth', name: 'アザトース',       aura: 0xff40ff, moves: ['spiral', 'zones', 'volley'], p2: 'zones', p2t: '白 痴 の 魔 王 が 蠢 く', hitR: 3.0, hitY: 2.4 },
  { id: 'progenitor', name: '夜の始祖',       aura: 0xff3a1a, moves: ['mist', 'rush', 'volley', 'zones'], p2: 'clone', p2t: '夜 そ の も の を 見 極 め よ', hitR: 2.0, hitY: 2.2 }
];

/* ═══ 主の姿 ═══ */
const BUILD = {
  vampire(K, dark) {
    const cloth = K.m(0x120e18), skin = K.m(0xd8cec4, { r: 0.5 }), red = K.m(0x6b0f18);
    const b = K.grp([0, 0, 0]);
    K.cap(0.36, 1.0, cloth, [0, 1.75, 0], null, b);
    K.box(0.34, 0.8, 0.12, red, [0, 1.85, 0.3], null, b);
    const cape = K.robe(b, 0.5, 1.9, 2.6, K.m(0x0d0a12, { ds: true }), 1.55, 0.35);
    cape.rotation.y = Math.PI;
    [-1, 1].forEach(sx => K.box(0.12, 0.95, 0.5, red, [0.34 * sx, 2.62, -0.16], [-0.2, 0, sx * 0.28], b));
    K.sphere(0.3, skin, [0, 2.62, 0], [0.88, 1.18, 0.95], b);
    K.cone(0.17, 0.3, skin, [0, 2.34, 0.06], [Math.PI, 0, 0], b);
    K.sphere(0.32, K.m(0x0a0810), [0, 2.7, -0.06], [0.95, 1.1, 1.2], b);
    K.eyes(b, 2.66, 0.26, 0.12, 0.055, 0xff1a1a);
    [-1, 1].forEach(sx => K.cone(0.035, 0.16, K.m(0xfff4e8), [0.07 * sx, 2.42, 0.24], [Math.PI, 0, 0], b));
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.44 * sx, 2.3, 0], 1.3, 0.08, cloth, skin));
    arms.forEach(a => { for (let i = 0; i < 5; i++) K.cone(0.022, 0.26, K.m(0x1a1218), [(i - 2) * 0.05, -0.1, 0.02], [Math.PI + 0.3, 0, 0], a.hand, 5); });
    swingArms(K, arms);
    K.batWing(b, 1, [0.25, 2.3, -0.3], 1.5, K.m(0x2a0a14, { ds: true }), cloth, 2.2);
    K.batWing(b, -1, [-0.25, 2.3, -0.3], 1.5, K.m(0x2a0a14, { ds: true }), cloth, 2.2);
    return K.done({ height: 3 });
  },
  lich(K) {
    const robe = K.m(0x1a1030, { ds: true }), bone = K.m(0xe8e0c8, { r: 0.6 }), gold = K.m(0xc9a227, { me: 0.8, r: 0.3 });
    const b = K.grp([0, 0.6, 0]); K.hover(b, 0.25, 1.4);
    K.robe(b, 0.35, 1.3, 2.4, robe, 1.1, 0.5);
    K.robe(b, 0.5, 0.9, 1.0, K.m(0x3a1a60, { ds: true }), 2.0, 0.2);
    const skull = K.grp([0, 2.65, 0.05], b);
    K.sphere(0.3, bone, [0, 0, 0], [0.9, 1, 1], skull);
    K.box(0.3, 0.14, 0.2, bone, [0, -0.22, 0.08], null, skull);
    K.eyes(skull, 0.02, 0.24, 0.1, 0.07, 0x7affd0);
    K.crown(skull, 0.28, 0.22, gold, 7, K.glow(0x7affd0));
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.5 * sx, 2.2, 0], 1.2, 0.06, bone));
    swingArms(K, arms, 1.2);
    // 杖
    const st = K.grp([0, 0, 0], arms[0].hand);
    K.cyl(0.04, 0.05, 2.6, K.m(0x2a2030), [0, 0.6, 0], null, st);
    K.sphere(0.22, K.glow(0x7affd0, 3), [0, 1.95, 0], null, st);
    K.torus(0.3, 0.03, gold, [0, 1.95, 0], [HP, 0, 0], st);
    // 周りを巡る魂
    const orb = K.grp([0, 1.6, 0], b); K.spin(orb, 1.4);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; K.sphere(0.12, K.glow(0x7affd0, 2), [Math.cos(a) * 1.6, Math.sin(i) * 0.3, Math.sin(a) * 1.6], null, orb, 8); }
    return K.done({ height: 3.4 });
  },
  dullahan(K) {
    const arm = K.m(0x2a2a34, { me: 0.8, r: 0.35 }), trim = K.m(0x8a7a4a, { me: 0.8, r: 0.3 }), cape = K.m(0x14141a, { ds: true });
    const b = K.grp([0, 0, 0]);
    // 馬
    const horse = K.grp([0, 0, 0], b);
    K.cap(0.55, 1.8, K.m(0x0c0c10), [0, 1.5, 0], [HP, 0, 0], horse);
    K.cap(0.22, 0.7, K.m(0x0c0c10), [0, 2.2, 1.2], [0.6, 0, 0], horse);
    K.box(0.3, 0.3, 0.7, K.m(0x0c0c10), [0, 2.5, 1.55], [0.3, 0, 0], horse);
    K.eyes(horse, 2.6, 1.9, 0.14, 0.06, 0x8affd0);
    const legs = [];
    [[-0.35, 0.8], [0.35, 0.8], [-0.35, -0.8], [0.35, -0.8]].forEach(([x, z], i) => {
      const l = K.grp([x, 1.2, z], horse);
      K.cap(0.11, 1.0, K.m(0x0c0c10), [0, -0.6, 0], null, l);
      K.sphere(0.14, K.glow(0x8affd0, 1.4), [0, -1.15, 0], null, l, 8);
      legs.push(l);
    });
    K.anims.push(t => legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 6 + (i % 2 ? Math.PI : 0) + (i > 1 ? 1 : 0)) * 0.5; }));
    // 騎士（首なし）
    const kn = K.grp([0, 2.0, -0.2], b);
    K.cap(0.34, 0.7, arm, [0, 0.7, 0], null, kn);
    [-1, 1].forEach(sx => K.sphere(0.24, trim, [0.4 * sx, 1.1, 0], [1, 0.7, 1], kn));
    K.cyl(0.18, 0.22, 0.12, K.glow(0x8affd0, 2), [0, 1.25, 0], null, kn);
    K.robe(kn, 0.3, 0.9, 1.6, cape, 0.4, 0.3).rotation.y = Math.PI;
    // 小脇に抱えた首
    const head = K.grp([-0.55, 0.6, 0.35], kn);
    K.sphere(0.22, arm, [0, 0, 0], null, head);
    K.eyes(head, 0.02, 0.18, 0.08, 0.05, 0x8affd0);
    // 槍
    const arms = [K.arm(kn, 1, [0.45, 1.1, 0], 1.0, 0.09, arm)];
    const lance = K.grp([0, 0, 0], arms[0].hand);
    K.cone(0.16, 3.4, trim, [0, 0.2, 1.4], [HP, 0, 0], lance);
    swingArms(K, arms, 1.0);
    return K.done({ height: 3.4 });
  },
  banshee(K) {
    const dress = K.m(0xc8d8ff, { op: 0.6, e: 0x6080c0, ei: 0.6, ds: true }), hair = K.m(0xe8f0ff, { op: 0.7, ds: true });
    const b = K.grp([0, 0.9, 0]); K.hover(b, 0.35, 1.1);
    K.robe(b, 0.25, 1.1, 2.6, dress, 1.0, 0.9);
    K.cap(0.22, 0.5, dress, [0, 2.3, 0], null, b);
    const head = K.grp([0, 2.95, 0], b);
    K.sphere(0.22, K.m(0xf0f4ff, { e: 0x8090c0, ei: 0.4 }), [0, 0, 0], [0.9, 1.1, 0.9], head);
    // 叫ぶ口
    K.sphere(0.07, K.m(0x000000), [0, -0.08, 0.2], [1, 1.6, 0.5], head);
    K.eyes(head, 0.05, 0.18, 0.08, 0.04, 0xb0c8ff);
    // 流れる長い髪
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - 0.5) * 2.4;
      K.chain(head, [Math.sin(a) * 0.18, 0.05, -0.12], 6, 0.3, 0.07, 0.02, hair, { a: 0.2, f: 2 + i * 0.1 }, { bend: [-0.4, a * 0.15] }).rotation.x = Math.PI - 0.3;
    }
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.35 * sx, 2.55, 0], 1.3, 0.05, dress));
    arms.forEach(a => { a.sh.rotation.z = (a === arms[0] ? -1 : 1) * 1.2; });
    swingArms(K, arms, 0.8);
    return K.done({ height: 3.6 });
  },
  nolife(K) {
    const bone = K.m(0xd8d0b8), gold = K.m(0xd8b040, { me: 0.9, r: 0.25 }), robe = K.m(0x5a0a14, { ds: true });
    const b = K.grp([0, 0, 0]);
    // 玉座ごと浮かぶ
    const th = K.grp([0, 0.3, -0.5], b);
    K.box(1.6, 0.4, 1.2, gold, [0, 0.3, 0], null, th);
    K.box(1.6, 2.6, 0.25, K.m(0x2a1a10), [0, 1.6, -0.5], null, th);
    K.crown(th, 0.8, 3.0, gold, 5);
    K.robe(b, 0.4, 1.3, 2.0, robe, 1.2, 0.25);
    // 肋骨
    const rib = K.grp([0, 2.1, 0.1], b);
    for (let i = 0; i < 5; i++) K.torus(0.3 - i * 0.03, 0.03, bone, [0, -i * 0.13, 0], [HP, 0, 0], rib, Math.PI * 1.4);
    K.cyl(0.05, 0.05, 0.8, bone, [0, -0.25, -0.2], null, rib);
    const skull = K.grp([0, 2.75, 0.05], b);
    K.sphere(0.3, bone, [0, 0, 0], null, skull);
    K.eyes(skull, 0.02, 0.25, 0.1, 0.08, 0xffe08a);
    K.crown(skull, 0.3, 0.26, gold, 9, K.glow(0xff3030));
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.5 * sx, 2.4, 0], 1.4, 0.06, bone));
    const sc = K.grp([0, 0, 0], arms[1].hand);
    K.cyl(0.05, 0.05, 2.2, gold, [0, 0.4, 0], null, sc);
    K.sphere(0.2, K.glow(0xffe08a, 3), [0, 1.6, 0], null, sc);
    swingArms(K, arms, 1.2);
    return K.done({ height: 3.4 });
  },
  shuten(K) {
    const skin = K.m(0xb83a2a, { r: 0.6 }), cloth = K.m(0x2a1a40, { ds: true }), iron = K.m(0x3a3a44, { me: 0.8, r: 0.35 });
    const b = K.grp([0, 0, 0]);
    K.cap(0.6, 1.0, skin, [0, 2.0, 0], null, b);
    K.sphere(0.55, skin, [0, 2.6, 0.15], [1.2, 0.8, 0.8], b);
    K.robe(b, 0.6, 1.0, 1.2, cloth, 1.1, 0.2);
    [-1, 1].forEach(sx => { const l = K.cap(0.22, 0.8, skin, [0.35 * sx, 0.6, 0]); });
    const head = K.grp([0, 3.3, 0.1], b);
    K.sphere(0.42, skin, [0, 0, 0], [1, 1.05, 1], head);
    K.box(0.6, 0.2, 0.2, K.m(0xfff0e0), [0, -0.22, 0.32], null, head);
    [-1, 1].forEach(sx => K.cone(0.05, 0.22, K.m(0xfff0e0), [0.18 * sx, -0.08, 0.38], [0, 0, 0], head));
    K.eyes(head, 0.08, 0.36, 0.15, 0.07, 0xffb020);
    K.horn(head, [0.2, 0.3, 0], 0.7, 0.1, -0.15, -0.25, K.m(0xf0e0c0));
    K.horn(head, [-0.2, 0.3, 0], 0.7, 0.1, -0.15, 0.25, K.m(0xf0e0c0));
    // 蓬髪
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; K.cone(0.14, 0.6, K.m(0x2a1010), [Math.cos(a) * 0.35, 0.2, Math.sin(a) * 0.35 - 0.1], [Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8], head, 6); }
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.8 * sx, 2.7, 0], 1.6, 0.2, skin));
    // 金棒
    const club = K.grp([0, 0, 0], arms[0].hand);
    K.cyl(0.26, 0.12, 2.4, iron, [0, 0.9, 0.4], [0.3, 0, 0], club);
    for (let i = 0; i < 10; i++) K.cone(0.05, 0.14, iron, [Math.cos(i) * 0.24, 1.2 + (i % 5) * 0.25, 0.4 + Math.sin(i) * 0.24], [Math.sin(i), 0, Math.cos(i)], club, 5);
    // 瓢箪
    K.sphere(0.2, K.m(0xc8a060), [0, -0.1, 0], [1, 1.3, 1], arms[1].hand);
    swingArms(K, arms, 2.0);
    return K.done({ height: 4 });
  },
  kyubi(K) {
    const fur = K.m(0xf0d8a0, { r: 0.8 }), white = K.m(0xfff8f0), red = K.m(0xc02020);
    const b = K.grp([0, 0, 0]);
    K.cap(0.5, 1.4, fur, [0, 1.3, 0], [HP, 0, 0], b);
    const head = K.grp([0, 1.9, 1.2], b);
    K.sphere(0.42, fur, [0, 0, 0], [1, 0.9, 1.1], head);
    K.cone(0.22, 0.6, white, [0, -0.1, 0.45], [HP, 0, 0], head);
    [-1, 1].forEach(sx => K.cone(0.14, 0.45, fur, [0.25 * sx, 0.4, -0.05], [0, 0, -sx * 0.2], head));
    K.eyes(head, 0.08, 0.36, 0.16, 0.06, 0xffd24a);
    K.box(0.5, 0.06, 0.05, red, [0, 0.12, 0.38], null, head);
    const legs = [];
    [[-0.3, 0.6], [0.3, 0.6], [-0.3, -0.6], [0.3, -0.6]].forEach(([x, z]) => { const l = K.grp([x, 1.1, z], b); K.cap(0.12, 0.8, fur, [0, -0.5, 0], null, l); legs.push(l); });
    K.anims.push(t => legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 5 + i * 1.6) * 0.35; }));
    // 九本の尾
    for (let i = 0; i < 9; i++) {
      const a = (i / 8 - 0.5) * 2.4;
      const tl = K.chain(b, [0, 1.4, -0.8], 7, 0.36, 0.2, 0.12, i % 2 ? fur : white, { a: 0.18, f: 1.6 + i * 0.07 }, { bend: [0.18, 0] });
      tl.rotation.set(-2.2 + Math.abs(a) * 0.2, 0, a);
      K.sphere(0.14, K.glow(0xffb040, 2.2), [0, 0.2, 0], null, tl.userData.tip, 8);
    }
    return K.done({ height: 2.8 });
  },
  tengu(K) {
    const skin = K.m(0xc03020), robe = K.m(0xf0ece0, { ds: true }), kasa = K.m(0x201818), feather = K.m(0x1a1a24, { ds: true });
    const b = K.grp([0, 0.4, 0]); K.hover(b, 0.3, 1.3);
    K.robe(b, 0.4, 1.2, 2.2, robe, 1.0, 0.3);
    K.robe(b, 0.6, 1.0, 0.9, K.m(0xc9a227, { ds: true }), 1.8, 0.1);
    const head = K.grp([0, 2.6, 0.05], b);
    K.sphere(0.32, skin, [0, 0, 0], null, head);
    K.cone(0.07, 0.7, skin, [0, 0, 0.55], [HP, 0, 0], head);
    K.eyes(head, 0.1, 0.27, 0.12, 0.05, 0xff6a2a);
    K.box(0.4, 0.3, 0.3, kasa, [0, 0.35, 0], null, head);
    K.sphere(0.36, K.m(0xf0f0f0), [0, -0.3, 0.1], [1, 1.3, 0.6], head);  // 白髭
    K.featherWing(b, 1, [0.3, 2.2, -0.3], 2.8, feather, 9, 2);
    K.featherWing(b, -1, [-0.3, 2.2, -0.3], 2.8, feather, 9, 2);
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.55 * sx, 2.1, 0], 1.3, 0.1, robe, skin));
    // 羽団扇
    const fan = K.grp([0, 0, 0], arms[0].hand);
    for (let i = 0; i < 9; i++) K.box(0.08, 0.7, 0.02, K.m(0x3a2a1a), [0, 0.4, 0], [0, 0, (i - 4) * 0.16], fan);
    swingArms(K, arms, 1.4);
    return K.done({ height: 3.4 });
  },
  orochi(K) {
    const scale = K.m(0x1a4a2a, { r: 0.5, me: 0.2 }), belly = K.m(0x8a7a40);
    const b = K.grp([0, 0, 0]);
    K.sphere(1.3, scale, [0, 1.0, -0.4], [1.2, 0.8, 1.3], b);
    // 八つの首
    for (let i = 0; i < 8; i++) {
      const a = (i / 7 - 0.5) * 2.6;
      const nk = K.chain(b, [Math.sin(a) * 0.9, 1.4, 0.3], 7, 0.42, 0.28, 0.2, scale, { a: 0.14, f: 1.2 + i * 0.13 }, { bend: [0.12, 0] });
      nk.rotation.set(0.2 + (i % 3) * 0.1, 0, -a * 0.55);
      const hd = K.grp([0, 0.2, 0], nk.userData.tip);
      hd.rotation.x = 1.3;
      K.cone(0.26, 0.7, scale, [0, 0.2, 0], null, hd);
      K.cone(0.2, 0.55, belly, [0, 0.15, 0.1], [0.4, 0, 0], hd);
      K.eyes(hd, 0.05, 0.15, 0.13, 0.05, 0xff3030);
    }
    // 八つの尾
    for (let i = 0; i < 4; i++) {
      const tl = K.chain(b, [(i - 1.5) * 0.4, 0.6, -1.6], 6, 0.4, 0.26, 0.08, scale, { a: 0.2, f: 1.4 + i * 0.2 });
      tl.rotation.x = -1.4;
    }
    return K.done({ height: 3.6 });
  },
  typhon(K) {
    const skin = K.m(0x6a4a3a), scale = K.m(0x2a4a3a, { r: 0.5 }), fire = K.glow(0xff5a3a, 2.4);
    const b = K.grp([0, 0, 0]);
    // 蛇の下半身（二本がとぐろ）
    [-1, 1].forEach(sx => {
      const c = K.chain(b, [0.4 * sx, 0.4, 0], 8, 0.4, 0.4, 0.12, scale, { a: 0.12, f: 1.2 }, { bend: [0, sx * 0.55] });
      c.rotation.set(HP, 0, sx * 0.5);
    });
    K.cap(0.7, 1.4, skin, [0, 2.4, 0], null, b);
    K.sphere(0.7, skin, [0, 3.2, 0], [1.5, 0.7, 0.9], b);
    const head = K.grp([0, 3.9, 0.1], b);
    K.sphere(0.36, skin, [0, 0, 0], null, head);
    K.eyes(head, 0.05, 0.3, 0.13, 0.07, 0xff5a3a);
    // 肩から生える無数の蛇頭
    for (let i = 0; i < 10; i++) {
      const a = (i / 9 - 0.5) * 3.0;
      const s = K.chain(b, [Math.sin(a) * 0.9, 3.3, -0.2], 4, 0.3, 0.12, 0.08, scale, { a: 0.3, f: 2 + i * 0.2 });
      s.rotation.set(-0.3, 0, -a * 0.7);
      K.eyes(s.userData.tip, 0.05, 0.08, 0.05, 0.03, 0xff5a3a);
    }
    K.batWing(b, 1, [0.5, 3.4, -0.4], 2.6, K.m(0x3a1a14, { ds: true }), skin, 1.8);
    K.batWing(b, -1, [-0.5, 3.4, -0.4], 2.6, K.m(0x3a1a14, { ds: true }), skin, 1.8);
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.9 * sx, 3.1, 0], 1.8, 0.2, skin));
    arms.forEach(a => K.sphere(0.2, fire, [0, -0.1, 0], null, a.hand, 8));
    swingArms(K, arms, 1.8);
    return K.done({ height: 4.6 });
  },
  medusa(K) {
    const skin = K.m(0x9ab08a), scale = K.m(0x3a6a2a, { r: 0.5 }), gold = K.m(0xc9a227, { me: 0.8, r: 0.3 });
    const b = K.grp([0, 0, 0]);
    const tail = K.chain(b, [0, 0.35, 0], 9, 0.45, 0.42, 0.08, scale, { a: 0.12, f: 1.6 }, { bend: [0.35, 0] });
    tail.rotation.set(-HP - 0.2, 0, 0);
    K.cap(0.34, 0.9, skin, [0, 1.8, 0], null, b);
    K.torus(0.36, 0.05, gold, [0, 1.5, 0], [HP, 0, 0], b);
    const head = K.grp([0, 2.6, 0.05], b);
    K.sphere(0.27, skin, [0, 0, 0], [0.9, 1.1, 0.95], head);
    K.eyes(head, 0.04, 0.24, 0.09, 0.05, 0xa0ff6a);
    // 蛇の髪
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const s = K.chain(head, [Math.cos(a) * 0.2, 0.15, Math.sin(a) * 0.2 - 0.05], 5, 0.14, 0.05, 0.025, scale, { a: 0.35, f: 3 + i * 0.1 });
      s.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
      K.eyes(s.userData.tip, 0.02, 0.03, 0.02, 0.015, 0xff3030);
    }
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.4 * sx, 2.2, 0], 1.2, 0.07, skin));
    const bow = K.grp([0, 0, 0], arms[1].hand);
    K.torus(0.7, 0.04, gold, [0, 0, 0.1], [0, HP, 0], bow, Math.PI);
    swingArms(K, arms, 1.2);
    return K.done({ height: 3.0 });
  },
  loki(K) {
    const green = K.m(0x1a5a3a, { ds: true }), gold = K.m(0xd8b040, { me: 0.8, r: 0.25 }), skin = K.m(0xe0d0c0);
    const b = K.grp([0, 0, 0]);
    K.robe(b, 0.35, 0.9, 2.0, green, 1.0, 0.4);
    K.cap(0.3, 0.8, green, [0, 2.1, 0], null, b);
    const head = K.grp([0, 2.8, 0], b);
    K.sphere(0.26, skin, [0, 0, 0], null, head);
    K.eyes(head, 0.03, 0.23, 0.09, 0.04, 0x6affb0);
    // 角冠
    K.horn(head, [0.15, 0.18, -0.02], 0.9, 0.06, -0.3, -0.3, gold);
    K.horn(head, [-0.15, 0.18, -0.02], 0.9, 0.06, -0.3, 0.3, gold);
    // 蛇のマフラー
    const sn = K.chain(b, [0, 2.45, 0.2], 10, 0.2, 0.08, 0.05, K.m(0x2a8a4a), { a: 0.2, f: 2.5 });
    sn.rotation.set(HP, 0, 0.5);
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.4 * sx, 2.3, 0], 1.2, 0.07, green, skin));
    [0, 1].forEach(i => K.sphere(0.14, K.glow(0x6affb0, 3), [0, -0.05, 0], null, arms[i].hand, 8));
    // 仮面の群れが周りを巡る
    const ring = K.grp([0, 1.8, 0], b); K.spin(ring, -0.9);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; K.box(0.35, 0.45, 0.06, gold, [Math.cos(a) * 1.7, Math.sin(i * 2) * 0.3, Math.sin(a) * 1.7], [0, -a + HP, 0], ring); }
    swingArms(K, arms, 1.1);
    return K.done({ height: 3.2 });
  },
  vritra(K) {
    const scale = K.m(0x1a3a6a, { r: 0.4, me: 0.3 }), belly = K.m(0x8ab0c0);
    const b = K.grp([0, 0, 0]);
    const body = K.chain(b, [0, 0.8, -2.5], 10, 0.7, 0.7, 0.25, scale, { a: 0.1, f: 1.2, z: 1.2 }, { bend: [0, 0.12] });
    body.rotation.set(HP - 0.15, 0, 0);
    const neck = K.chain(b, [0, 0.8, -0.2], 5, 0.5, 0.6, 0.4, scale, { a: 0.1, f: 1.4 }, { bend: [-0.2, 0] });
    neck.rotation.x = 0.3;
    const hd = K.grp([0, 0.3, 0], neck.userData.tip); hd.rotation.x = 1.1;
    K.cone(0.45, 1.3, scale, [0, 0.4, 0], null, hd);
    K.cone(0.38, 1.0, belly, [0, 0.25, 0.18], [0.35, 0, 0], hd);
    K.eyes(hd, 0.15, 0.3, 0.2, 0.08, 0x4ad0ff);
    [-1, 1].forEach(sx => K.horn(hd, [0.2 * sx, -0.1, -0.2], 0.9, 0.08, 0.3, sx * 0.3, K.m(0xd0e0f0)));
    // 背びれ
    for (let i = 0; i < 6; i++) K.cone(0.14, 0.7, K.glow(0x4ad0ff, 1.2), [0, 1.6 - i * 0.05, -0.4 - i * 0.6], [-0.3, 0, 0], b, 4);
    return K.done({ height: 3.0 });
  },
  pazuzu(K) {
    const skin = K.m(0x8a6a3a, { r: 0.6 }), fur = K.m(0x6a4a2a), feather = K.m(0x4a3a2a, { ds: true });
    const b = K.grp([0, 0, 0]);
    K.cap(0.45, 1.2, skin, [0, 1.9, 0], null, b);
    [-1, 1].forEach(sx => { const l = K.grp([0.3 * sx, 1.1, 0], b); K.cap(0.15, 0.7, skin, [0, -0.4, 0], null, l); for (let i = 0; i < 3; i++) K.cone(0.05, 0.3, K.m(0x2a2010), [(i - 1) * 0.08, -0.95, 0.12], [HP, 0, 0], l, 5); });
    const head = K.grp([0, 3.0, 0.1], b);
    K.sphere(0.42, fur, [0, 0, -0.05], [1.2, 1.2, 1], head);
    K.sphere(0.3, skin, [0, -0.05, 0.2], null, head);
    K.box(0.35, 0.12, 0.15, K.m(0xfff0d0), [0, -0.2, 0.42], null, head);
    K.eyes(head, 0.05, 0.45, 0.13, 0.07, 0xffe24a);
    [-1, 1].forEach(sx => K.horn(head, [0.25 * sx, 0.3, 0], 0.5, 0.06, -0.2, -sx * 0.3, K.m(0xe0d0b0)));
    // 四枚の翼
    [[1, 3.0, 2.4], [-1, 3.0, 2.4], [1, 2.5, 1.8], [-1, 2.5, 1.8]].forEach(([sx, y, sp]) => K.featherWing(b, sx, [0.3 * sx, y, -0.35], sp, feather, 7, 2.6));
    // 蠍の尾
    const tl = K.chain(b, [0, 1.3, -0.4], 8, 0.3, 0.14, 0.06, K.m(0x3a2a1a), { a: 0.15, f: 2 }, { bend: [-0.35, 0] });
    tl.rotation.x = -2.4;
    K.cone(0.1, 0.4, K.glow(0xffe24a, 2), [0, 0.2, 0], [0.8, 0, 0], tl.userData.tip);
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.6 * sx, 2.5, 0], 1.4, 0.12, skin));
    arms[0].sh.rotation.z = 2.4; arms[1].sh.rotation.z = -0.3;
    swingArms(K, arms, 1.2);
    return K.done({ height: 3.8 });
  },
  baal(K) {
    const skin = K.m(0x3a2a3a), toad = K.m(0x5a7a3a), cat = K.m(0x8a6a4a), man = K.m(0xd8c0a8), gold = K.m(0xd8b040, { me: 0.8, r: 0.3 });
    const b = K.grp([0, 0, 0]);
    K.sphere(1.0, skin, [0, 1.8, 0], [1.2, 0.8, 1.1], b);
    // 八本の蜘蛛脚
    const legs = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const l = K.grp([Math.cos(a) * 0.9, 1.7, Math.sin(a) * 0.9], b);
      l.rotation.y = -a;
      const up = K.grp([0, 0, 0], l); up.rotation.z = -0.9;
      K.cap(0.08, 1.2, skin, [0, 0.7, 0], null, up);
      const lo = K.grp([0, 1.4, 0], up); lo.rotation.z = 2.3;
      K.cap(0.06, 1.6, skin, [0, 0.9, 0], null, lo);
      legs.push(up);
    }
    K.anims.push(t => legs.forEach((l, i) => { l.rotation.z = -0.9 + Math.sin(t * 5 + i * 1.3) * 0.15; }));
    // 三つの首：蛙・人・猫
    [[toad, -0.8, 0xa0ff4a], [man, 0, 0xd08aff], [cat, 0.8, 0xffd24a]].forEach(([mt, x, ec], i) => {
      const h = K.grp([x, 2.6, 0.5], b);
      K.sphere(0.34, mt, [0, 0, 0], i === 0 ? [1.2, 0.8, 1] : null, h);
      K.eyes(h, 0.08, 0.28, 0.12, 0.06, ec);
      if (i === 1) K.crown(h, 0.26, 0.3, gold, 6);
      if (i === 2) [-1, 1].forEach(sx => K.cone(0.1, 0.25, cat, [0.18 * sx, 0.3, 0], null, h));
      K.anims.push(t => { h.rotation.y = Math.sin(t * 1.2 + i) * 0.4; });
    });
    return K.done({ height: 3.2 });
  },
  amon(K) {
    const fur = K.m(0x3a2a24, { r: 0.85 }), scale = K.m(0x2a3a2a);
    const b = K.grp([0, 0, 0]);
    K.cap(0.55, 1.6, fur, [0, 1.5, 0], [HP, 0, 0], b);
    const head = K.grp([0, 2.1, 1.3], b);
    K.sphere(0.45, fur, [0, 0, 0], [1, 0.9, 1.1], head);
    K.cone(0.28, 0.7, fur, [0, -0.1, 0.5], [HP, 0, 0], head);
    K.eyes(head, 0.12, 0.38, 0.17, 0.07, 0xff5a1a);
    [-1, 1].forEach(sx => K.cone(0.13, 0.4, fur, [0.26 * sx, 0.42, -0.05], null, head));
    // 口から漏れる炎
    const fl = K.cone(0.2, 0.6, K.glow(0xff6a1a, 3), [0, -0.2, 0.95], [-HP, 0, 0], head);
    K.anims.push((t, st) => { fl.scale.setScalar(0.6 + Math.sin(t * 20) * 0.15 + (st.atk || 0) * 1.4); });
    const legs = [];
    [[-0.35, 0.7], [0.35, 0.7], [-0.35, -0.7], [0.35, -0.7]].forEach(([x, z]) => { const l = K.grp([x, 1.2, z], b); K.cap(0.14, 0.8, fur, [0, -0.5, 0], null, l); legs.push(l); });
    K.anims.push(t => legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 6 + i * 1.6) * 0.4; }));
    // 蛇の尾
    const tl = K.chain(b, [0, 1.6, -1.1], 8, 0.35, 0.18, 0.06, scale, { a: 0.25, f: 2.2 }, { bend: [0.2, 0] });
    tl.rotation.x = -2.0;
    K.eyes(tl.userData.tip, 0.1, 0.06, 0.05, 0.04, 0xff5a1a);
    return K.done({ height: 2.8 });
  },
  marchosias(K) {
    const fur = K.m(0x5a6a8a, { r: 0.8 }), feather = K.m(0x2a3a5a, { ds: true });
    const b = K.grp([0, 0.3, 0]); K.hover(b, 0.25, 1.8);
    K.cap(0.55, 1.5, fur, [0, 1.4, 0], [HP, 0, 0], b);
    const head = K.grp([0, 2.0, 1.2], b);
    K.sphere(0.42, fur, [0, 0, 0], [1, 0.9, 1.1], head);
    K.cone(0.25, 0.65, fur, [0, -0.1, 0.45], [HP, 0, 0], head);
    K.eyes(head, 0.12, 0.36, 0.16, 0.07, 0x8ab0ff);
    [-1, 1].forEach(sx => K.cone(0.12, 0.45, fur, [0.24 * sx, 0.42, -0.05], null, head));
    K.featherWing(b, 1, [0.4, 2.0, 0], 3.0, feather, 9, 2.8);
    K.featherWing(b, -1, [-0.4, 2.0, 0], 3.0, feather, 9, 2.8);
    const legs = [];
    [[-0.35, 0.6], [0.35, 0.6], [-0.35, -0.6], [0.35, -0.6]].forEach(([x, z]) => { const l = K.grp([x, 1.1, z], b); K.cap(0.13, 0.7, fur, [0, -0.45, 0], null, l); K.cone(0.05, 0.2, K.glow(0x8ab0ff, 1.5), [0, -0.9, 0.1], [HP, 0, 0], l, 5); legs.push(l); });
    K.anims.push(t => legs.forEach((l, i) => { l.rotation.x = 0.4 + Math.sin(t * 3 + i) * 0.2; }));
    const tl = K.chain(b, [0, 1.5, -1.0], 7, 0.35, 0.14, 0.06, K.m(0x2a3a4a), { a: 0.3, f: 2 });
    tl.rotation.x = -2.0;
    return K.done({ height: 3.0 });
  },
  buer(K) {
    const fur = K.m(0xb08a4a, { r: 0.8 }), mane = K.m(0x6a3a1a), hoof = K.m(0x2a2020);
    const b = K.grp([0, 1.5, 0]);
    // 獅子の頭が中心、五本の山羊脚が車輪状に回る
    const head = K.grp([0, 0, 0], b);
    K.sphere(0.7, fur, [0, 0, 0], null, head);
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; K.cone(0.2, 0.8, mane, [Math.cos(a) * 0.7, Math.sin(a) * 0.7, -0.2], [0, 0, a - HP], head, 6); }
    K.cone(0.3, 0.5, fur, [0, -0.15, 0.65], [HP, 0, 0], head);
    K.eyes(head, 0.15, 0.6, 0.25, 0.09, 0xffc86a);
    K.box(0.4, 0.1, 0.1, K.m(0xfff0d0), [0, -0.35, 0.62], null, head);
    const wheel = K.grp([0, 0, -0.2], b);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      const l = K.grp([0, 0, 0], wheel); l.rotation.z = a;
      K.cap(0.14, 1.1, fur, [0, 1.1, 0], null, l);
      K.box(0.3, 0.25, 0.3, hoof, [0, 1.85, 0], null, l);
    }
    K.anims.push((t, st) => { wheel.rotation.z = t * (2.5 + (st.rage || 0) * 3); });
    return K.done({ height: 3.4 });
  },
  beelzebub(K) {
    const chit = K.m(0x1a2a14, { r: 0.3, me: 0.5 }), wingM = K.m(0xa0c0a0, { op: 0.35, ds: true, e: 0x304030, ei: 0.4 });
    const b = K.grp([0, 0.8, 0]); K.hover(b, 0.35, 2.4);
    K.sphere(0.8, chit, [0, 1.5, -0.4], [0.9, 0.8, 1.4], b);
    K.sphere(0.55, chit, [0, 2.2, 0.4], null, b);
    const head = K.grp([0, 2.6, 0.8], b);
    K.sphere(0.4, chit, [0, 0, 0], null, head);
    // 巨大な複眼
    [-1, 1].forEach(sx => K.sphere(0.26, K.eyeGlow(0xa0ff4a, 2.2), [0.25 * sx, 0.08, 0.2], [1, 1.2, 1], head, 12));
    K.cone(0.05, 0.4, chit, [0, -0.3, 0.3], [2.4, 0, 0], head, 5);
    [-1, 1].forEach(sx => {
      [0, 1].forEach(k => {
        const w = K.grp([0.4 * sx, 2.4 - k * 0.3, 0], b);
        K.sphere(0.9, wingM, [sx * 0.9, 0.2, -0.3], [1.2, 0.08, 0.5], w, 10);
        K.anims.push(t => { w.rotation.z = sx * Math.sin(t * 40 + k) * 0.3; });
      });
    });
    const legs = [];
    for (let i = 0; i < 6; i++) { const sx = i % 2 ? 1 : -1; const l = K.grp([0.4 * sx, 2.0 - Math.floor(i / 2) * 0.35, 0.4], b); K.cap(0.05, 1.0, chit, [0, -0.5, 0.2], [0.4, 0, sx * 0.4], l); legs.push(l); }
    K.anims.push(t => legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 4 + i) * 0.3; }));
    K.crown(head, 0.3, 0.35, K.m(0xd8b040, { me: 0.9, r: 0.3 }), 7);
    return K.done({ height: 3.6 });
  },
  asmodeus(K) {
    const skin = K.m(0x8a2a3a), gold = K.m(0xd8b040, { me: 0.85, r: 0.3 }), robe = K.m(0x3a0a20, { ds: true });
    const b = K.grp([0, 0, 0]);
    // 竜にまたがる
    const drg = K.grp([0, 0, 0], b);
    K.cap(0.55, 1.6, K.m(0x2a1a1a), [0, 1.2, 0], [HP, 0, 0], drg);
    const dn = K.chain(drg, [0, 1.3, 1.0], 4, 0.4, 0.35, 0.25, K.m(0x2a1a1a), { a: 0.1, f: 1.5 }, { bend: [0.2, 0] });
    dn.rotation.x = 0.8;
    K.cone(0.3, 0.9, K.m(0x2a1a1a), [0, 0.3, 0], [1.2, 0, 0], dn.userData.tip);
    [[-0.3, 0.6], [0.3, 0.6], [-0.3, -0.6], [0.3, -0.6]].forEach(([x, z]) => K.cap(0.12, 0.7, K.m(0x2a1a1a), [x, 0.5, z], null, drg));
    const rid = K.grp([0, 1.9, -0.2], b);
    K.robe(rid, 0.3, 0.9, 1.4, robe, 0.3, 0.2);
    K.cap(0.3, 0.7, skin, [0, 0.9, 0], null, rid);
    // 三つの貌（牛・人・羊）
    [[-0.38, 0x6a4a3a, 'bull'], [0, 0xd8a090, 'man'], [0.38, 0xe8e0d0, 'ram']].forEach(([x, c, k]) => {
      const h = K.grp([x, 1.65, 0.05], rid);
      K.sphere(0.2, K.m(c), [0, 0, 0], null, h);
      K.eyes(h, 0.03, 0.17, 0.07, 0.035, 0xff4a8a);
      if (k === 'bull') [-1, 1].forEach(sx => K.horn(h, [0.12 * sx, 0.1, 0], 0.4, 0.04, 0, -sx * 0.5, K.m(0xe0d0b0)));
      if (k === 'ram') [-1, 1].forEach(sx => K.horn(h, [0.12 * sx, 0.1, -0.05], 0.5, 0.05, 0.9, -sx * 0.4, K.m(0xc0b090)));
      if (k === 'man') K.crown(h, 0.18, 0.2, gold, 5);
    });
    K.batWing(rid, 1, [0.25, 1.3, -0.25], 1.6, K.m(0x4a0a1a, { ds: true }), skin, 2.4);
    K.batWing(rid, -1, [-0.25, 1.3, -0.25], 1.6, K.m(0x4a0a1a, { ds: true }), skin, 2.4);
    const arms = [-1, 1].map(sx => K.arm(rid, sx, [0.4 * sx, 1.2, 0], 1.1, 0.07, skin));
    const sp = K.grp([0, 0, 0], arms[0].hand);
    K.cyl(0.03, 0.03, 2.6, gold, [0, 0.5, 0.2], [0.4, 0, 0], sp);
    swingArms(K, arms, 1.2);
    return K.done({ height: 3.8 });
  },
  lilith(K) {
    const skin = K.m(0xe8d0d8), dress = K.m(0x1a0a1a, { ds: true }), hair = K.m(0x0a0a10, { ds: true });
    const b = K.grp([0, 0.5, 0]); K.hover(b, 0.2, 1.2);
    K.robe(b, 0.22, 1.2, 2.4, dress, 1.0, 0.6);
    K.cap(0.24, 0.6, dress, [0, 2.3, 0], null, b);
    const head = K.grp([0, 2.95, 0], b);
    K.sphere(0.23, skin, [0, 0, 0], [0.9, 1.1, 0.95], head);
    K.eyes(head, 0.03, 0.2, 0.08, 0.035, 0xff6ad0);
    for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 2.2; const hc = K.chain(head, [Math.sin(a) * 0.18, 0.1, -0.1], 7, 0.28, 0.06, 0.02, hair, { a: 0.22, f: 1.4 + i * 0.1 }, { bend: [-0.25, 0] }); hc.rotation.set(Math.PI - 0.4, 0, a * 0.3); }
    [-1, 1].forEach(sx => K.horn(head, [0.1 * sx, 0.18, 0], 0.4, 0.035, -0.4, -sx * 0.2, K.m(0x2a0a2a)));
    K.batWing(b, 1, [0.2, 2.5, -0.2], 2.0, K.m(0x3a0a2a, { ds: true, e: 0x3a0020, ei: 0.4 }), dress, 1.6);
    K.batWing(b, -1, [-0.2, 2.5, -0.2], 2.0, K.m(0x3a0a2a, { ds: true, e: 0x3a0020, ei: 0.4 }), dress, 1.6);
    // 月の輪
    K.torus(1.2, 0.04, K.glow(0xff6ad0, 2), [0, 2.9, -0.6], null, b);
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.32 * sx, 2.55, 0], 1.1, 0.05, skin));
    swingArms(K, arms, 1.0);
    return K.done({ height: 3.6 });
  },
  iblis(K) {
    const smoke = K.m(0x2a1a14, { op: 0.75, ds: true, e: 0x401000, ei: 0.5 }), fire = K.glow(0xff8a2a, 2.6);
    const b = K.grp([0, 0.4, 0]); K.hover(b, 0.3, 1.1);
    // 無煙の火から成る躯
    K.robe(b, 0.5, 0.05, 2.0, smoke, 0.8, 0);
    K.cap(0.5, 1.0, K.m(0x3a2010, { e: 0xff4010, ei: 0.5 }), [0, 2.3, 0], null, b);
    for (let i = 0; i < 10; i++) {
      const f = K.cone(0.2, 0.9, fire, [Math.cos(i) * 0.4, 2.3 + (i % 3) * 0.4, Math.sin(i) * 0.4], null, b, 6);
      K.anims.push(t => { f.scale.y = 0.7 + Math.sin(t * 9 + i) * 0.35; });
    }
    const head = K.grp([0, 3.3, 0], b);
    K.sphere(0.33, K.m(0x1a0a08), [0, 0, 0], null, head);
    K.eyes(head, 0.04, 0.3, 0.12, 0.07, 0xff8a2a);
    [-1, 1].forEach(sx => K.horn(head, [0.2 * sx, 0.2, 0], 0.8, 0.07, -0.1, -sx * 0.5, K.m(0x0a0a0a)));
    K.featherWing(b, 1, [0.4, 2.8, -0.3], 2.6, K.m(0x1a0a08, { ds: true }), 8, 1.8);
    K.featherWing(b, -1, [-0.4, 2.8, -0.3], 2.6, K.m(0x1a0a08, { ds: true }), 8, 1.8);
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.6 * sx, 2.8, 0], 1.4, 0.12, K.m(0x3a2010)));
    arms.forEach(a => K.sphere(0.25, fire, [0, 0, 0], null, a.hand, 8));
    swingArms(K, arms, 1.4);
    return K.done({ height: 3.8 });
  },
  satan(K) {
    const skin = K.m(0x6a1010, { r: 0.55 }), dark = K.m(0x1a0808), gold = K.m(0xd8b040, { me: 0.85, r: 0.3 });
    const b = K.grp([0, 0, 0]);
    [-1, 1].forEach(sx => {
      const l = K.grp([0.4 * sx, 1.4, 0], b);
      K.cap(0.24, 0.8, skin, [0, -0.3, 0], null, l);
      const lo = K.grp([0, -0.8, 0], l); lo.rotation.x = 0.6;
      K.cap(0.18, 0.7, skin, [0, -0.35, 0], null, lo);
      K.box(0.3, 0.2, 0.4, dark, [0, -0.8, 0.1], null, lo);
    });
    K.cap(0.7, 1.3, skin, [0, 2.5, 0], null, b);
    K.sphere(0.75, skin, [0, 3.3, 0], [1.5, 0.75, 0.95], b);
    const head = K.grp([0, 4.0, 0.15], b);
    K.sphere(0.42, skin, [0, 0, 0], [0.95, 1.1, 1], head);
    K.cone(0.14, 0.3, dark, [0, -0.35, 0.25], [Math.PI + 0.3, 0, 0], head, 6);
    K.eyes(head, 0.08, 0.36, 0.15, 0.08, 0xff2020);
    [-1, 1].forEach(sx => K.horn(head, [0.25 * sx, 0.3, 0], 1.3, 0.13, 0.35, -sx * 0.5, dark));
    K.batWing(b, 1, [0.5, 3.4, -0.5], 3.4, K.m(0x2a0808, { ds: true }), dark, 1.5);
    K.batWing(b, -1, [-0.5, 3.4, -0.5], 3.4, K.m(0x2a0808, { ds: true }), dark, 1.5);
    const tl = K.chain(b, [0, 1.6, -0.5], 9, 0.35, 0.12, 0.04, skin, { a: 0.2, f: 1.6 });
    tl.rotation.x = -2.2;
    K.cone(0.14, 0.35, dark, [0, 0.15, 0], null, tl.userData.tip, 3);
    const arms = [-1, 1].map(sx => K.arm(b, sx, [1.0 * sx, 3.3, 0], 2.0, 0.2, skin));
    const tri = K.grp([0, 0, 0], arms[0].hand);
    K.cyl(0.05, 0.05, 4.4, gold, [0, 1.0, 0.3], [0.3, 0, 0], tri);
    [-0.25, 0, 0.25].forEach(x => K.cone(0.07, 0.6, gold, [x, 3.3, 1.0], [0.3, 0, 0], tri, 4));
    // 燃える光冠
    K.torus(0.8, 0.05, K.glow(0xff2020, 2.8), [0, 4.2, -0.4], null, b);
    swingArms(K, arms, 1.9);
    return K.done({ height: 5 });
  },
  cthulhu(K) {
    const skin = K.m(0x2a5a4a, { r: 0.4, me: 0.2 }), dark = K.m(0x1a3a2a);
    const b = K.grp([0, 0, 0]);
    [-1, 1].forEach(sx => K.cap(0.35, 1.2, skin, [0.5 * sx, 0.9, 0], null, b));
    K.cap(0.85, 1.6, skin, [0, 2.6, 0], null, b);
    const head = K.grp([0, 4.0, 0.1], b);
    K.sphere(0.7, skin, [0, 0.3, -0.1], [1, 1.35, 1.1], head);
    K.eyes(head, 0.25, 0.6, 0.25, 0.1, 0x4affc8);
    // 顔の触手
    for (let i = 0; i < 10; i++) {
      const a = (i / 9 - 0.5) * 1.6;
      const tc = K.chain(head, [Math.sin(a) * 0.45, -0.2, 0.45], 7, 0.18, 0.1, 0.02, dark, { a: 0.28, f: 1.6 + i * 0.13 }, { bend: [0.15, 0] });
      tc.rotation.set(Math.PI - 0.2, 0, a * 0.4);
    }
    K.batWing(b, 1, [0.5, 3.4, -0.6], 3.2, K.m(0x1a2a24, { ds: true }), dark, 1.3);
    K.batWing(b, -1, [-0.5, 3.4, -0.6], 3.2, K.m(0x1a2a24, { ds: true }), dark, 1.3);
    const arms = [-1, 1].map(sx => K.arm(b, sx, [1.0 * sx, 3.2, 0], 2.1, 0.22, skin));
    arms.forEach(a => { for (let i = 0; i < 4; i++) K.cone(0.05, 0.4, dark, [(i - 1.5) * 0.1, -0.15, 0.05], [Math.PI, 0, 0], a.hand, 5); });
    swingArms(K, arms, 1.7);
    return K.done({ height: 5 });
  },
  nyarla(K) {
    const dark = K.m(0x05050a, { r: 0.3 }), robe = K.m(0x0a0a14, { ds: true });
    const b = K.grp([0, 0, 0]);
    K.robe(b, 0.3, 1.1, 2.6, robe, 1.3, 0.7);
    K.cap(0.3, 0.8, dark, [0, 2.6, 0], null, b);
    // 顔の無い頭。代わりに燃える三つの眼
    const head = K.grp([0, 3.3, 0], b);
    K.sphere(0.3, dark, [0, 0, 0], [0.9, 1.3, 0.9], head);
    K.eyes(head, 0.05, 0.25, 0.1, 0.06, 0xb04aff, 3);
    // 背の闇から生える触腕
    for (let i = 0; i < 8; i++) {
      const a = (i / 7 - 0.5) * 2.8;
      const tc = K.chain(b, [Math.sin(a) * 0.3, 2.6, -0.3], 8, 0.35, 0.1, 0.02, dark, { a: 0.3, f: 1.2 + i * 0.15 }, { bend: [-0.1, 0] });
      tc.rotation.set(-0.6, 0, -a * 0.6);
    }
    const ring = K.grp([0, 3.3, -0.3], b); K.spin(ring, 0.5, 'z');
    for (let i = 0; i < 3; i++) K.torus(0.8 + i * 0.3, 0.02, K.glow(0xb04aff, 2), [0, 0, 0], [0, 0, i], ring);
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.4 * sx, 2.8, 0], 1.3, 0.06, dark));
    swingArms(K, arms, 1.0);
    return K.done({ height: 3.8 });
  },
  yog(K) {
    const orbM = K.m(0xd8c0e8, { r: 0.1, me: 0.6, e: 0x604080, ei: 0.7 });
    const b = K.grp([0, 2.2, 0]); K.hover(b, 0.35, 0.8);
    // 虹色の球の集合体
    const cl = K.grp([0, 0, 0], b);
    const orbs = [];
    for (let i = 0; i < 22; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * 6.28, r = 0.6 + Math.random() * 1.0;
      const s = K.sphere(0.25 + Math.random() * 0.35, i % 3 ? orbM : K.glow([0xff80ff, 0x80ffff, 0xffff80][i % 3], 2.2),
        [Math.sqrt(1 - u * u) * Math.cos(th) * r, u * r, Math.sqrt(1 - u * u) * Math.sin(th) * r], null, cl, 12);
      orbs.push({ s, p: s.position.clone(), ph: Math.random() * 6 });
    }
    K.anims.push(t => orbs.forEach(o => { o.s.position.copy(o.p).multiplyScalar(1 + Math.sin(t * 1.5 + o.ph) * 0.12); }));
    K.spin(cl, 0.4);
    // 門の輪
    [0, 1, 2].forEach(i => { const r = K.torus(2.0 + i * 0.35, 0.05, K.glow(0xffe0ff, 1.6), [0, 0, 0], [i * 0.9, i, 0], b); K.anims.push(t => { r.rotation.y = t * (0.3 + i * 0.2); }); });
    K.eyes(b, 0.2, 1.4, 0.25, 0.14, 0xffe0ff);
    return K.done({ height: 4.4 });
  },
  azathoth(K) {
    const flesh = K.m(0x4a1a4a, { r: 0.4, e: 0x200020, ei: 0.5 });
    const b = K.grp([0, 2.0, 0]); K.hover(b, 0.25, 0.6);
    const core = K.sphere(1.2, flesh, [0, 0, 0], null, b, 18);
    K.anims.push(t => { core.scale.set(1 + Math.sin(t * 2.3) * 0.08, 1 + Math.sin(t * 1.7) * 0.1, 1 + Math.cos(t * 2) * 0.08); });
    for (let i = 0; i < 14; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * 6.28;
      const tc = K.chain(b, [0, 0, 0], 7, 0.4, 0.22, 0.04, flesh, { a: 0.35, f: 1 + i * 0.1 });
      tc.rotation.set(Math.acos(u), th, 0);
    }
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; K.sphere(0.12, K.eyeGlow(0xff40ff, 3), [Math.cos(a) * 1.15, Math.sin(a * 2) * 0.5, Math.sin(a) * 1.15], null, b, 8); }
    // 取り巻きの笛吹き（小さな光）
    const ring = K.grp([0, -1.2, 0], b); K.spin(ring, 0.8);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; K.cone(0.15, 0.6, K.glow(0xff80ff, 1.8), [Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6], null, ring, 6); }
    return K.done({ height: 4.2 });
  },
  progenitor(K) {
    const r = BUILD.vampire(K);
    const gold = K.m(0xd8b040, { me: 0.9, r: 0.25 });
    K.crown(K.root.children[0], 0.28, 2.95, gold, 9, K.glow(0xff3a1a, 3));
    K.torus(1.4, 0.05, K.glow(0xff3a1a, 2.6), [0, 2.6, -0.7], null, K.root.children[0]);
    return r;
  }
};

/** 主の姿を作る */
export function buildLord(id) {
  const K = new Kit();
  const f = BUILD[id] || BUILD.vampire;
  return f(K);
}

/* ═══════════════ 中ボス ═══════════════ */
export const ELITES = {
  deathknight: { name: 'デスナイト', aura: 0x6ad0ff },
  skelwarrior: { name: 'スケルトンウォーリア', aura: 0xffe08a },
  wraith:      { name: 'レイス', aura: 0x9a6aff },
  spectre:     { name: 'スペクター', aura: 0x8affff },
  draugr:      { name: 'ドラウグル', aura: 0x8ad0ff },
  poltergeist: { name: 'ポルターガイスト', aura: 0xff8ad0 },
  kyonshi:     { name: 'キョンシーの王', aura: 0xff4a4a },
  ghoul:       { name: 'グールの長', aura: 0xc8ff4a },
  mummy:       { name: 'マミーの王', aura: 0xffd24a },
  zombie:      { name: 'ゾンビの巨人', aura: 0x9aff6a }
};

const EBUILD = {
  deathknight(K) {
    const plate = K.m(0x1a1c24, { me: 0.9, r: 0.28 }), edge = K.m(0x6a7a8a, { me: 0.9, r: 0.2 }), cape = K.m(0x0a0a14, { ds: true, e: 0x001030, ei: 0.4 });
    const b = K.grp([0, 0, 0]);
    [-1, 1].forEach(sx => K.cap(0.18, 0.8, plate, [0.25 * sx, 0.6, 0], null, b));
    K.cap(0.45, 0.8, plate, [0, 1.6, 0], null, b);
    [-1, 1].forEach(sx => { K.sphere(0.32, edge, [0.55 * sx, 2.1, 0], [1, 0.7, 1], b); K.cone(0.08, 0.5, edge, [0.7 * sx, 2.35, 0], [0, 0, -sx * 0.6], b, 5); });
    K.robe(b, 0.4, 1.0, 1.9, cape, 1.1, 0.5).rotation.y = Math.PI;
    const head = K.grp([0, 2.5, 0], b);
    K.cyl(0.24, 0.28, 0.5, plate, [0, 0, 0], null, head);
    K.box(0.4, 0.05, 0.1, K.eyeGlow(0x6ad0ff, 4), [0, 0.02, 0.25], null, head);
    K.horn(head, [0.2, 0.2, 0], 0.5, 0.05, -0.3, -0.4, edge);
    K.horn(head, [-0.2, 0.2, 0], 0.5, 0.05, -0.3, 0.4, edge);
    // 冷たい霊炎
    for (let i = 0; i < 6; i++) { const f = K.cone(0.1, 0.5, K.glow(0x6ad0ff, 2), [Math.cos(i) * 0.2, 0.4, Math.sin(i) * 0.2 - 0.05], null, head, 5); K.anims.push(t => { f.scale.y = 0.8 + Math.sin(t * 10 + i) * 0.4; }); }
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.55 * sx, 2.0, 0], 1.2, 0.13, plate));
    const sw = K.grp([0, 0, 0], arms[0].hand);
    K.box(0.18, 2.4, 0.05, edge, [0, 0.9, 0.3], [0.3, 0, 0], sw);
    K.box(0.04, 2.2, 0.06, K.glow(0x6ad0ff, 2), [0, 0.9, 0.31], [0.3, 0, 0], sw);
    swingArms(K, arms, 1.8);
    return K.done({ height: 3 });
  },
  skelwarrior(K) {
    const bone = K.m(0xe0d8c0), iron = K.m(0x5a5048, { me: 0.7, r: 0.4 });
    const b = K.grp([0, 0, 0]);
    [-1, 1].forEach(sx => K.cyl(0.07, 0.07, 1.2, bone, [0.22 * sx, 0.6, 0], null, b, 6));
    K.cyl(0.08, 0.08, 1.0, bone, [0, 1.6, 0], null, b, 6);
    for (let i = 0; i < 5; i++) K.torus(0.34 - i * 0.03, 0.035, bone, [0, 2.0 - i * 0.14, 0], [HP, 0, 0], b, Math.PI * 1.5);
    const head = K.grp([0, 2.5, 0], b);
    K.sphere(0.26, bone, [0, 0, 0], null, head);
    K.box(0.26, 0.12, 0.18, bone, [0, -0.2, 0.07], null, head);
    K.eyes(head, 0.02, 0.22, 0.09, 0.06, 0xffe08a);
    K.cyl(0.28, 0.3, 0.2, iron, [0, 0.15, 0], null, head);
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.45 * sx, 2.2, 0], 1.3, 0.05, bone));
    K.cyl(0.5, 0.5, 0.08, iron, [0, 0, 0.2], [HP, 0, 0], arms[1].hand, 16);
    const ax = K.grp([0, 0, 0], arms[0].hand);
    K.cyl(0.04, 0.04, 1.6, K.m(0x3a2a1a), [0, 0.5, 0.2], [0.3, 0, 0], ax);
    K.box(0.6, 0.5, 0.05, iron, [0.25, 1.2, 0.45], [0.3, 0, 0], ax);
    swingArms(K, arms, 1.7);
    return K.done({ height: 2.8 });
  },
  wraith(K) {
    const robe = K.m(0x14101e, { ds: true, op: 0.88 }), bone = K.m(0xd0c8e0);
    const b = K.grp([0, 0.6, 0]); K.hover(b, 0.3, 1.4);
    K.robe(b, 0.3, 1.1, 2.6, robe, 1.0, 1.0);
    const hood = K.grp([0, 2.5, 0], b);
    K.sphere(0.36, robe, [0, 0, -0.05], [1, 1.2, 1.1], hood);
    K.sphere(0.2, K.m(0x000000), [0, -0.05, 0.12], null, hood);
    K.eyes(hood, -0.02, 0.28, 0.08, 0.05, 0x9a6aff);
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.45 * sx, 2.1, 0], 1.3, 0.1, robe, bone));
    const sc = K.grp([0, 0, 0], arms[0].hand);
    K.cyl(0.04, 0.04, 2.6, K.m(0x2a2030), [0, 0.6, 0], null, sc);
    const blade = K.torus(0.8, 0.06, K.m(0xb0b8c8, { me: 0.9, r: 0.2 }), [0.6, 1.9, 0], [0, 0, 0.3], sc, Math.PI * 0.6);
    K.torus(0.8, 0.02, K.glow(0x9a6aff, 2.4), [0.6, 1.9, 0.02], [0, 0, 0.3], sc, Math.PI * 0.6);
    // 鎖
    K.chain(b, [0, 1.2, 0.2], 6, 0.2, 0.05, 0.05, K.m(0x6a6a7a, { me: 0.8 }), { a: 0.3, f: 2 }).rotation.x = Math.PI;
    swingArms(K, arms, 1.5);
    return K.done({ height: 3.2 });
  },
  spectre(K) {
    const ghost = K.m(0xa0f0ff, { op: 0.45, e: 0x40a0c0, ei: 0.8, ds: true });
    const b = K.grp([0, 0.6, 0]); K.hover(b, 0.4, 1.0);
    K.robe(b, 0.25, 0.9, 2.8, ghost, 1.2, 1.1);
    const rib = K.grp([0, 2.2, 0], b);
    for (let i = 0; i < 5; i++) K.torus(0.3 - i * 0.03, 0.035, K.glow(0x8affff, 2.2), [0, -i * 0.14, 0], [HP, 0, 0], rib, Math.PI * 1.5);
    K.sphere(0.12, K.glow(0xffffff, 3.5), [0, -0.3, 0], null, rib, 10);
    const head = K.grp([0, 2.95, 0], b);
    K.sphere(0.3, ghost, [0, 0, 0], [0.9, 1.3, 0.9], head);
    K.eyes(head, 0.05, 0.24, 0.1, 0.06, 0x8affff);
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.4 * sx, 2.45, 0], 1.8, 0.06, ghost));
    arms.forEach(a => { for (let i = 0; i < 4; i++) K.cone(0.02, 0.35, K.glow(0x8affff, 2), [(i - 1.5) * 0.05, -0.15, 0], [Math.PI, 0, 0], a.hand, 4); });
    swingArms(K, arms, 1.2);
    return K.done({ height: 3.6 });
  },
  draugr(K) {
    const skin = K.m(0x5a6a7a), fur = K.m(0x6a5a4a, { r: 0.9 }), iron = K.m(0x4a5058, { me: 0.8, r: 0.35 }), ice = K.glow(0x8ad0ff, 1.8);
    const b = K.grp([0, 0, 0]);
    [-1, 1].forEach(sx => K.cap(0.2, 0.8, fur, [0.25 * sx, 0.6, 0], null, b));
    K.cap(0.5, 0.9, iron, [0, 1.7, 0], null, b);
    K.sphere(0.6, fur, [0, 2.2, -0.05], [1.4, 0.5, 1.1], b);
    const head = K.grp([0, 2.65, 0], b);
    K.sphere(0.28, skin, [0, 0, 0], null, head);
    K.eyes(head, 0.03, 0.24, 0.1, 0.05, 0x8ad0ff);
    K.sphere(0.31, iron, [0, 0.08, -0.02], [1, 0.8, 1], head);
    // 鹿の角の兜
    [-1, 1].forEach(sx => { const h = K.horn(head, [0.2 * sx, 0.2, 0], 0.9, 0.05, -0.2, -sx * 0.6, K.m(0xd8c8a8)); K.horn(h, [0, 0.35, 0], 0.4, 0.03, 0.4, sx * 0.4, K.m(0xd8c8a8)); });
    for (let i = 0; i < 6; i++) K.cone(0.05, 0.3, ice, [(i - 2.5) * 0.12, -0.35, 0.18], [Math.PI, 0, 0], head, 4);
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.6 * sx, 2.1, 0], 1.3, 0.14, skin));
    const ax = K.grp([0, 0, 0], arms[0].hand);
    K.cyl(0.05, 0.05, 2.0, K.m(0x3a2a1a), [0, 0.6, 0.2], [0.3, 0, 0], ax);
    K.cyl(0.55, 0.55, 0.06, iron, [0.3, 1.5, 0.5], [HP, 0.3, 0], ax, 16);
    K.torus(0.55, 0.03, ice, [0.3, 1.5, 0.5], [0, 0.3, 0], ax, Math.PI);
    swingArms(K, arms, 1.8);
    return K.done({ height: 3.2 });
  },
  poltergeist(K) {
    const b = K.grp([0, 1.6, 0]); K.hover(b, 0.3, 1.5);
    K.sphere(0.5, K.eyeGlow(0xff8ad0, 2.6), [0, 0, 0], null, b, 16);
    K.sphere(0.2, K.m(0x000000), [0, 0, 0.42], null, b, 10);
    // 渦を巻く家具と皿
    const ring = K.grp([0, 0, 0], b); K.spin(ring, 1.6);
    const wood = K.m(0x5a3a24), plate = K.m(0xe8e8f0);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2, r = 1.4 + (i % 3) * 0.4;
      const o = i % 3 === 0 ? K.box(0.5, 0.6, 0.5, wood, [Math.cos(a) * r, Math.sin(i) * 0.8, Math.sin(a) * r], [i, i * 2, 0], ring)
        : i % 3 === 1 ? K.cyl(0.25, 0.25, 0.04, plate, [Math.cos(a) * r, Math.sin(i) * 0.8, Math.sin(a) * r], [i, 0, i], ring, 14)
        : K.cone(0.08, 0.6, K.m(0xb0b8c8, { me: 0.9 }), [Math.cos(a) * r, Math.sin(i) * 0.8, Math.sin(a) * r], [i, i, i], ring, 5);
      K.anims.push(t => { o.rotation.x = t * (1 + i * 0.2); });
    }
    const ring2 = K.grp([0, 0, 0], b); K.spin(ring2, -1.1);
    for (let i = 0; i < 3; i++) K.torus(0.9 + i * 0.2, 0.02, K.glow(0xff8ad0, 1.8), [0, 0, 0], [i, i * 0.7, 0], ring2);
    return K.done({ height: 3 });
  },
  kyonshi(K) {
    const robe = K.m(0x1a2a4a, { ds: true }), skin = K.m(0x9ab0a0), gold = K.m(0xd8b040, { me: 0.8, r: 0.3 });
    const b = K.grp([0, 0, 0]);
    K.robe(b, 0.4, 0.8, 2.2, robe, 1.1, 0.1);
    K.box(1.0, 0.1, 0.9, gold, [0, 1.8, 0], null, b);
    const head = K.grp([0, 2.6, 0], b);
    K.sphere(0.3, skin, [0, 0, 0], null, head);
    K.eyes(head, 0.03, 0.26, 0.1, 0.05, 0xff4a4a);
    K.cyl(0.32, 0.35, 0.35, K.m(0x1a1a2a), [0, 0.28, 0], null, head);
    K.sphere(0.08, K.glow(0xff4a4a, 2), [0, 0.35, 0.3], null, head, 8);
    // 額の呪符
    const fuda = K.box(0.2, 0.5, 0.01, K.m(0xf0d860, { e: 0xa08020, ei: 0.4 }), [0, -0.1, 0.31], null, head);
    K.anims.push(t => { fuda.rotation.x = -0.2 + Math.sin(t * 6) * 0.25; });
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.45 * sx, 2.2, 0], 1.3, 0.12, robe, skin));
    arms.forEach(a => { a.sh.rotation.x = -HP; a.sh.rotation.z = 0; a.el.rotation.x = 0; for (let i = 0; i < 4; i++) K.cone(0.02, 0.3, K.m(0x2a3a2a), [(i - 1.5) * 0.05, -0.12, 0], [Math.PI, 0, 0], a.hand, 4); });
    // 跳ねる
    K.anims.push(t => { b.position.y = Math.abs(Math.sin(t * 5)) * 0.5; });
    return K.done({ height: 3 });
  },
  ghoul(K) {
    const skin = K.m(0x6a7a4a), dark = K.m(0x2a2a1a);
    const b = K.grp([0, 0, 0]);
    K.cap(0.5, 1.0, skin, [0, 1.5, 0.3], [0.9, 0, 0], b);
    const head = K.grp([0, 1.8, 1.1], b);
    K.sphere(0.35, skin, [0, 0, 0], [1, 0.9, 1.2], head);
    K.box(0.4, 0.12, 0.2, K.m(0xe8e0c0), [0, -0.22, 0.25], null, head);
    K.eyes(head, 0.08, 0.3, 0.14, 0.06, 0xc8ff4a);
    // 四本の長い腕
    const arms = [[-1, 1.9], [1, 1.9], [-1, 1.4], [1, 1.4]].map(([sx, y]) => K.arm(b, sx, [0.5 * sx, y, 0.6], 1.8, 0.1, skin));
    arms.forEach(a => { for (let i = 0; i < 3; i++) K.cone(0.03, 0.4, dark, [(i - 1) * 0.07, -0.15, 0], [Math.PI + 0.4, 0, 0], a.hand, 4); });
    [-1, 1].forEach(sx => K.cap(0.16, 0.8, skin, [0.35 * sx, 0.6, -0.2], null, b));
    // 背の骨棘
    for (let i = 0; i < 6; i++) K.cone(0.07, 0.4, K.m(0xe0d8c0), [0, 2.0 - i * 0.12, 0.4 - i * 0.2], [-0.6, 0, 0], b, 5);
    swingArms(K, arms, 1.4);
    return K.done({ height: 2.6 });
  },
  mummy(K) {
    const wrap = K.m(0xd8c8a0, { r: 0.95 }), gold = K.m(0xd8b040, { me: 0.9, r: 0.25 }), blue = K.m(0x1a3a8a, { me: 0.4, r: 0.4 });
    const b = K.grp([0, 0, 0]);
    [-1, 1].forEach(sx => K.cap(0.2, 0.9, wrap, [0.25 * sx, 0.65, 0], null, b));
    K.cap(0.42, 0.9, wrap, [0, 1.75, 0], null, b);
    for (let i = 0; i < 6; i++) K.torus(0.44, 0.03, wrap, [0, 1.3 + i * 0.18, 0], [HP + (i % 2 ? 0.2 : -0.2), 0, 0], b);
    K.box(0.9, 0.5, 0.1, gold, [0, 2.15, 0.35], null, b);
    const head = K.grp([0, 2.6, 0], b);
    K.sphere(0.27, wrap, [0, 0, 0], null, head);
    K.eyes(head, 0.03, 0.24, 0.09, 0.05, 0xffd24a);
    // 王の頭巾（ネメス）
    K.box(0.7, 0.5, 0.35, gold, [0, 0.05, -0.1], null, head);
    [-1, 1].forEach(sx => K.box(0.18, 0.7, 0.1, blue, [0.3 * sx, -0.35, 0.05], null, head));
    K.cone(0.06, 0.2, gold, [0, 0.35, 0.22], [0.3, 0, 0], head, 5);
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.5 * sx, 2.1, 0], 1.3, 0.11, wrap));
    const ank = K.grp([0, 0, 0], arms[0].hand);
    K.cyl(0.04, 0.04, 1.6, gold, [0, 0.4, 0.2], null, ank);
    K.torus(0.18, 0.04, K.glow(0xffd24a, 2.2), [0, 1.35, 0.2], null, ank);
    K.box(0.5, 0.06, 0.06, gold, [0, 1.1, 0.2], null, ank);
    // 漂う包帯
    for (let i = 0; i < 4; i++) K.chain(b, [(i - 1.5) * 0.25, 1.4, -0.3], 5, 0.25, 0.04, 0.03, wrap, { a: 0.3, f: 2 + i * 0.3 }).rotation.x = Math.PI - 0.6;
    swingArms(K, arms, 1.4);
    return K.done({ height: 3 });
  },
  zombie(K) {
    const skin = K.m(0x5c6b42), cloth = K.m(0x3a3028, { ds: true });
    const b = K.grp([0, 0, 0]);
    [-1, 1].forEach(sx => K.cap(0.3, 1.0, skin, [0.35 * sx, 0.8, 0], null, b));
    K.cap(0.75, 1.1, skin, [0, 2.3, 0.2], [0.3, 0, 0], b);
    K.robe(b, 0.8, 0.9, 1.0, cloth, 1.6, 0.4);
    const head = K.grp([0, 3.3, 0.6], b);
    K.sphere(0.4, skin, [0, 0, 0], null, head);
    K.eyes(head, 0.05, 0.35, 0.15, 0.08, 0x9aff6a);
    K.box(0.5, 0.15, 0.3, K.m(0x2a1010), [0, -0.25, 0.25], null, head);
    const arms = [-1, 1].map(sx => K.arm(b, sx, [0.9 * sx, 2.8, 0.3], 2.2, 0.22, skin));
    for (let i = 0; i < 5; i++) K.torus(0.25, 0.04, K.m(0xe0d8c0), [0.3, 2.2 - i * 0.14, 0.75], [0, 0, 0], b, Math.PI);
    swingArms(K, arms, 1.6);
    return K.done({ height: 3.8 });
  }
};

export function buildElite(id) {
  const K = new Kit();
  const f = EBUILD[id] || EBUILD.deathknight;
  return f(K);
}

/** 姿の材質を暗く／透かして作り直す（分身・思念体用） */
export function tintForm(root, color, opacity, emissive) {
  const g = root.clone(true);
  const cache = new Map();
  g.traverse(o => {
    if (!o.isMesh) return;
    let m = cache.get(o.material);
    if (!m) {
      m = o.material.clone();
      if (color != null) m.color.multiplyScalar(color);
      if (opacity != null) { m.transparent = true; m.opacity = opacity; m.depthWrite = false; }
      if (emissive != null && m.emissive) { m.emissive.setHex(emissive); m.emissiveIntensity = Math.max(m.emissiveIntensity, 0.9); }
      cache.set(o.material, m);
    }
    o.material = m;
    o.castShadow = false;
  });
  return g;
}
