/* ══════════════════════════════════════════════════════════════
   weapons.js ── 十五の武器
     銃・短剣・剣・杖・鈍器・斧・弓・槍・カタール・本・爪・鞭・
     楽器・忍者刀・風魔手裏剣。
     近接は扇形／直線の当たり判定、遠隔は弾・矢・投擲。
     手元の模型もここで組む（外部の素材は使わない）。
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { metalMaterial, glowMaterial, fleshMaterial } from './gfx.js';

/* ── 武器の種類 ──
   kind   : 'melee' 近接 ／ 'ranged' 遠隔
   shape  : 'arc' 扇形 ／ 'line' 直線 ／ 'proj' 飛び道具
   range  : 届く距離　arc: 扇の半角（ラジアン）　width: 直線の幅
   dmg    : 1撃の威力（銃の通常弾＝1）　cd: 次の攻撃までの秒
   cost   : 1撃に使う陽力　stat: 威力を伸ばす能力値
   anim   : 手元の動き　combo: 連なる振りの数
─────────────────────────────────────────── */
export const WEAPONS = {
  gun:      { id: 'gun', name: '銃', icon: '銃', kind: 'ranged', shape: 'proj', range: 40, dmg: 1.0, cd: 0.14, cost: 1, stat: 'ATK', anim: 'shoot',
              proj: { speed: 34, life: 1.2, r: 0.2, look: 'orb' }, desc: '陽光弾を撃つ。構えを変えられる' },
  dagger:   { id: 'dagger', name: '短剣', icon: '短', kind: 'melee', shape: 'arc', range: 2.3, arc: 0.85, dmg: 0.95, cd: 0.16, cost: 0.3, stat: 'ATK', anim: 'stab', combo: 3,
              crit: 0.12, desc: '素早い三連の突き。会心が出やすい' },
  sword:    { id: 'sword', name: '剣', icon: '剣', kind: 'melee', shape: 'arc', range: 3.3, arc: 1.25, dmg: 2.3, cd: 0.36, cost: 0.5, stat: 'ATK', anim: 'swing', combo: 3,
              desc: '大きく薙ぎ払う。攻守の均衡がよい' },
  staff:    { id: 'staff', name: '杖', icon: '杖', kind: 'ranged', shape: 'proj', range: 30, dmg: 1.9, cd: 0.46, cost: 1.5, stat: 'MATK', anim: 'cast',
              proj: { speed: 17, life: 2.2, r: 0.45, look: 'orb', homing: 3.2 }, desc: '敵を追う陽の珠を放つ（霊撃で伸びる）' },
  mace:     { id: 'mace', name: '鈍器', icon: '鎚', kind: 'melee', shape: 'arc', range: 2.9, arc: 0.8, dmg: 3.6, cd: 0.72, cost: 0.7, stat: 'ATK', anim: 'smash',
              breaker: true, stun: 0.9, quake: 2.2, desc: '振り下ろして地を揺らす。盾ごと砕く' },
  axe:      { id: 'axe', name: '斧', icon: '斧', kind: 'melee', shape: 'arc', range: 3.1, arc: 1.65, dmg: 3.1, cd: 0.62, cost: 0.6, stat: 'ATK', anim: 'swing', combo: 2,
              knock: 1.4, desc: '重く広い一振り。敵を吹き飛ばす' },
  bow:      { id: 'bow', name: '弓', icon: '弓', kind: 'ranged', shape: 'proj', range: 60, dmg: 2.1, cd: 0.5, cost: 1.2, stat: 'ATK', anim: 'bow',
              proj: { speed: 62, life: 1.2, r: 0.22, look: 'arrow', pierce: true }, desc: '速く遠くまで届き、敵を貫く矢' },
  spear:    { id: 'spear', name: '槍', icon: '槍', kind: 'melee', shape: 'line', range: 5.2, width: 0.95, dmg: 2.0, cd: 0.4, cost: 0.5, stat: 'ATK', anim: 'thrust',
              desc: '長い間合いの突き。列を貫く' },
  katar:    { id: 'katar', name: 'カタール', icon: '刀', kind: 'melee', shape: 'line', range: 2.4, width: 1.1, dmg: 0.85, cd: 0.13, cost: 0.3, stat: 'ATK', anim: 'punch', hits: 2,
              crit: 0.1, desc: '両手の刃で一度に二度刺す' },
  tome:     { id: 'tome', name: '本', icon: '書', kind: 'ranged', shape: 'proj', range: 30, dmg: 1.15, cd: 0.62, cost: 2, stat: 'MATK', anim: 'cast',
              proj: { speed: 22, life: 1.8, r: 0.32, look: 'page', homing: 1.8, count: 3, spread: 0.34 }, desc: '頁が三枚、扇に舞って敵を追う' },
  claw:     { id: 'claw', name: '爪', icon: '爪', kind: 'melee', shape: 'arc', range: 1.9, arc: 1.05, dmg: 0.72, cd: 0.09, cost: 0.2, stat: 'ATK', anim: 'punch', combo: 4,
              desc: '最速の連打。拳で押し込む' },
  whip:     { id: 'whip', name: '鞭', icon: '鞭', kind: 'melee', shape: 'line', range: 6.8, width: 0.8, dmg: 1.45, cd: 0.5, cost: 0.4, stat: 'ATK', anim: 'whip',
              pull: 1.6, desc: '最も長い近接。打った敵を引き寄せる' },
  lute:     { id: 'lute', name: '楽器', icon: '琴', kind: 'ranged', shape: 'proj', range: 14, dmg: 0.95, cd: 0.56, cost: 1.2, stat: 'MATK', anim: 'strum',
              proj: { speed: 11, life: 1.2, r: 0.7, grow: 2.2, look: 'wave', pierce: true }, desc: '広がる音の輪。群れをまとめて祓う' },
  ninjato:  { id: 'ninjato', name: '忍者刀', icon: '忍', kind: 'melee', shape: 'arc', range: 3.0, arc: 1.0, dmg: 1.6, cd: 0.22, cost: 0.4, stat: 'ATK', anim: 'iai', combo: 3,
              dashLine: 7.0, desc: '駆け抜けながら振ると居合で一閃する' },
  shuriken: { id: 'shuriken', name: '風魔手裏剣', icon: '星', kind: 'ranged', shape: 'proj', range: 20, dmg: 1.7, cd: 0.8, cost: 1.0, stat: 'ATK', anim: 'throw',
              proj: { speed: 25, life: 1.5, r: 0.7, look: 'star', pierce: true, boomerang: true }, desc: '大きな手裏剣。弧を描いて戻ってくる' }
};
export const WEAPON_ORDER = ['gun', 'dagger', 'sword', 'staff', 'mace', 'axe', 'bow', 'spear',
  'katar', 'tome', 'claw', 'whip', 'lute', 'ninjato', 'shuriken'];

/* ── 銃の構え ── */
export const GUN_STANCES = {
  normal: { id: 'normal', name: '通常',   cd: 1.0,  dmg: 1.0,  spread: 0,    speed: 1.0, move: 1.0 },
  rapid:  { id: 'rapid',  name: '連射',   cd: 0.55, dmg: 0.62, spread: 0.07, speed: 1.1, move: 0.85, ramp: true },
  dual:   { id: 'dual',   name: '二丁',   cd: 0.78, dmg: 0.78, spread: 0.03, speed: 1.0, move: 0.95, dual: true },
  hip:    { id: 'hip',    name: '腰だめ', cd: 0.85, dmg: 0.85, spread: 0.12, speed: 0.95, move: 1.18 }
};
export const STANCE_ORDER = ['normal', 'rapid', 'dual', 'hip'];

/* ── 武器の装備品（等級ごとの銘） ──
   jobs.js の GEAR に混ぜ込む。wtype がその種類を表す。 */
const NAMES = {
  dagger:   [['鉄の短剣', 1], ['月影の懐刀', 3], ['暁の匕首', 4]],
  sword:    [['鋼の剣', 1], ['陽紋の長剣', 3], ['天叢雲', 5]],
  staff:    [['樫の杖', 1], ['日輪の錫杖', 3], ['天照の御杖', 4]],
  mace:     [['鉄の棍棒', 1], ['金剛杵', 3], ['雷神の槌', 4]],
  axe:      [['樵の斧', 1], ['紅蓮の大斧', 3], ['破軍の戦斧', 4]],
  bow:      [['狩りの弓', 1], ['梓弓', 3], ['天之麻迦古弓', 5]],
  spear:    [['素槍', 1], ['十文字槍', 3], ['天沼矛', 4]],
  katar:    [['鉄のカタール', 1], ['双陽の刺刃', 3], ['ジャマダハル', 4]],
  tome:     [['祝詞の帳', 1], ['陽の祈祷書', 3], ['天の真書', 4]],
  claw:     [['革の拳鍔', 1], ['虎の爪', 3], ['金烏の鉤爪', 4]],
  whip:     [['革の鞭', 1], ['茨の鞭', 3], ['日輪の光鞭', 4]],
  lute:     [['古びた琵琶', 1], ['神楽笛', 3], ['天の琴', 4]],
  ninjato:  [['忍び刀', 1], ['影縫い', 3], ['夜刀神', 4]],
  shuriken: [['風車手裏剣', 1], ['風魔の大手裏剣', 3], ['天狗の羽手裏剣', 4]]
};
export function weaponGear() {
  const out = {};
  Object.keys(NAMES).forEach(t => {
    NAMES[t].forEach(([nm, rare], i) => {
      const W = WEAPONS[t];
      const pw = [0, 6, 12, 22, 36, 60][rare];
      const mods = {};
      mods[W.stat] = pw;
      if (W.anim === 'stab' || W.anim === 'punch') mods.CRI = Math.round(pw * 0.4);
      else if (t === 'axe' || t === 'mace') mods.HP = Math.round(pw * 0.5);
      else if (t === 'bow' || t === 'shuriken' || t === 'whip') mods.DEX = Math.round(pw * 0.4);
      else if (W.stat === 'MATK') mods.MP = Math.round(pw * 0.6);
      else mods.AGI = Math.round(pw * 0.3);
      out['x' + t + i] = { slot: 'weapon', who: 'hero', wtype: t, name: nm, rare, mods, desc: W.desc };
    });
  });
  return out;
}

/* ── 手元の模型 ──
   握りを原点に、刃先が +Z を向くように組む。 */
const RARE_METAL = [0x7a7e88, 0x8a8e98, 0x9aa0aa, 0xb09a5a, 0xc8a850, 0xffd24a];
const RARE_GLOW  = [0, 0, 0xffe0a0, 0xffc860, 0xffb040, 0xfff0a0];

export function buildWeaponModel(type, rare) {
  rare = rare || 1;
  const g = new THREE.Group();
  const metal = metalMaterial(300 + rare, RARE_METAL[rare] || 0x8a8e98);
  const dark = metalMaterial(310, 0x3a3440);
  const wood = fleshMaterial(0x5a3a24);
  const cloth = fleshMaterial(0x8a2a30);
  const glow = RARE_GLOW[rare] ? glowMaterial(RARE_GLOW[rare], 1.4 + rare * 0.4) : null;
  const add = (geo, mat, x, y, z, rx, ry, rz) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const Cyl = (a, b, h, s) => new THREE.CylinderGeometry(a, b, h, s || 8);
  const Cone = (r, h, s) => new THREE.ConeGeometry(r, h, s || 8);
  const HZ = Math.PI / 2;
  // 刃：平たい箱の先に尖り
  const blade = (len, wid, z0, mat) => {
    add(Box(wid, 0.03, len), mat, 0, 0, z0 + len / 2);
    const tip = add(Cone(wid * 0.72, wid * 1.6, 4), mat, 0, 0, z0 + len + wid * 0.8, HZ, 0, 0);
    tip.scale.set(1, 1, 0.2);
    if (glow) add(Box(0.012, 0.035, len * 0.92), glow, 0, 0, z0 + len * 0.5);
  };

  switch (type) {
    case 'dagger':
      add(Cyl(0.03, 0.035, 0.18), wood, 0, 0, -0.02, HZ);
      add(Box(0.2, 0.04, 0.04), metal, 0, 0, 0.08);
      blade(0.34, 0.07, 0.1, metal);
      break;
    case 'sword':
      add(Cyl(0.03, 0.035, 0.26), cloth, 0, 0, -0.06, HZ);
      add(new THREE.SphereGeometry(0.05, 8, 6), metal, 0, 0, -0.21);
      add(Box(0.36, 0.06, 0.06), metal, 0, 0, 0.1);
      blade(1.05, 0.11, 0.13, metal);
      break;
    case 'staff': {
      add(Cyl(0.03, 0.035, 1.7), wood, 0, 0, 0.35, HZ);
      const ring = add(new THREE.TorusGeometry(0.16, 0.025, 8, 20), metal, 0, 0, 1.3);
      ring.rotation.y = HZ;
      add(new THREE.SphereGeometry(0.09, 12, 10), glow || glowMaterial(0xffe9a8, 1.6), 0, 0, 1.3);
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2;
        add(new THREE.SphereGeometry(0.03, 6, 5), metal, Math.cos(a) * 0.16, Math.sin(a) * 0.16, 1.22);
      }
      break;
    }
    case 'mace':
      add(Cyl(0.035, 0.04, 0.85), wood, 0, 0, 0.3, HZ);
      add(new THREE.SphereGeometry(0.17, 12, 10), metal, 0, 0, 0.8);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        add(Cone(0.05, 0.16, 5), metal, Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0.8, 0, 0, a - HZ);
      }
      if (glow) add(new THREE.TorusGeometry(0.19, 0.02, 6, 16), glow, 0, 0, 0.8);
      break;
    case 'axe': {
      add(Cyl(0.035, 0.04, 1.05), wood, 0, 0, 0.35, HZ);
      const head = add(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 16, 1, false, 0, Math.PI), metal, 0.02, 0, 0.78, 0, 0, HZ);
      head.rotation.set(0, HZ, HZ);
      add(Box(0.1, 0.08, 0.16), dark, 0, 0, 0.78);
      if (glow) add(Box(0.02, 0.05, 0.6), glow, 0.33, 0, 0.78);
      break;
    }
    case 'bow': {
      const arc = add(new THREE.TorusGeometry(0.6, 0.025, 6, 24, Math.PI * 0.9), wood, 0, 0, 0.05);
      arc.rotation.set(0, HZ, HZ + Math.PI * 0.05);
      arc.position.set(0, 0, -0.25);
      add(Cyl(0.004, 0.004, 1.12), fleshMaterial(0xe8e0c8), 0, 0, -0.22, 0, 0, 0);
      add(Cyl(0.035, 0.035, 0.16), cloth, 0, 0, 0.33, 0, 0, 0);
      if (glow) add(new THREE.SphereGeometry(0.05, 8, 6), glow, 0, 0.58, 0.1);
      break;
    }
    case 'spear':
      add(Cyl(0.03, 0.035, 2.2), wood, 0, 0, 0.55, HZ);
      blade(0.36, 0.09, 1.66, metal);
      add(Box(0.42, 0.04, 0.05), metal, 0, 0, 1.66);
      add(Box(0.08, 0.1, 0.1), cloth, 0, 0, 1.58);
      break;
    case 'katar':
      [-0.08, 0.08].forEach(x => add(Box(0.025, 0.05, 0.22), metal, x, 0, 0));
      add(Cyl(0.02, 0.02, 0.16), wood, 0, 0, 0, 0, 0, HZ);
      blade(0.42, 0.13, 0.1, metal);
      break;
    case 'tome': {
      add(Box(0.42, 0.1, 0.32), cloth, 0, 0, 0.18);
      add(Box(0.38, 0.08, 0.3), fleshMaterial(0xf0e8d0), 0.02, 0, 0.18);
      add(new THREE.TorusGeometry(0.09, 0.015, 6, 16), glow || metal, 0, 0.055, 0.18, HZ);
      break;
    }
    case 'claw':
      add(Box(0.2, 0.12, 0.14), dark, 0, 0, 0);
      for (let i = 0; i < 3; i++) {
        const c = add(Cone(0.025, 0.42, 5), metal, (i - 1) * 0.07, 0, 0.26, HZ, 0, 0);
        c.rotation.x = HZ - 0.15;
      }
      if (glow) add(Box(0.2, 0.02, 0.02), glow, 0, 0.07, 0.05);
      break;
    case 'whip': {
      add(Cyl(0.03, 0.035, 0.26), cloth, 0, 0, 0, HZ);
      const segs = new THREE.Group();
      for (let i = 0; i < 12; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.03 - i * 0.0015, 6, 5), i % 3 === 0 && glow ? glow : wood);
        s.position.set(0, -i * 0.02, 0.15 + i * 0.1);
        segs.add(s);
      }
      g.add(segs);
      g.userData.whip = segs;
      break;
    }
    case 'lute': {
      const body = add(new THREE.SphereGeometry(0.22, 14, 10), wood, 0, 0, 0.1);
      body.scale.set(1, 0.35, 1.25);
      add(Box(0.07, 0.04, 0.6), dark, 0, 0.02, 0.5);
      add(Box(0.1, 0.05, 0.12), wood, 0, 0.02, 0.84, -0.4, 0, 0);
      for (let i = 0; i < 4; i++) add(Cyl(0.003, 0.003, 0.85), fleshMaterial(0xe8e0c8), (i - 1.5) * 0.02, 0.06, 0.4, HZ);
      if (glow) add(new THREE.TorusGeometry(0.07, 0.012, 6, 14), glow, 0, 0.08, 0.1, HZ);
      break;
    }
    case 'ninjato':
      add(Cyl(0.028, 0.03, 0.3), fleshMaterial(0x1a1a22), 0, 0, -0.05, HZ);
      add(Box(0.16, 0.16, 0.025), dark, 0, 0, 0.11);
      blade(0.78, 0.075, 0.13, metal);
      break;
    case 'shuriken': {
      const hub = add(Cyl(0.08, 0.08, 0.05, 12), dark, 0, 0, 0.3);
      hub.rotation.x = 0;
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2;
        const b = add(Cone(0.12, 0.62, 3), metal, Math.cos(a) * 0.3, 0, 0.3 + Math.sin(a) * 0.3);
        b.rotation.set(HZ, 0, 0); b.rotation.z = 0;
        b.lookAt(Math.cos(a) * 2, 0, 0.3 + Math.sin(a) * 2); b.rotateX(HZ);
        b.scale.set(1, 1, 0.18);
      }
      if (glow) add(new THREE.TorusGeometry(0.12, 0.015, 6, 16), glow, 0, 0.03, 0.3, HZ);
      break;
    }
    default:
      break;
  }
  // 伝説の武器は光の粒をまとう
  if (rare >= 5) {
    const aura = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.12,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    aura.position.z = 0.5; aura.scale.set(0.6, 0.6, 1.6);
    g.add(aura);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/* ── 銃の模型 ──
   原点＝右手の握り（人差し指の付け根のあたり）。銃口は +Z。単位は m、実物の寸法に合わせる。
   0〜2：拳銃（古い・磨いた・二連）　3：大口径の回転式（S&W M500 風）
   4：大型の自動拳銃（デザートイーグル風）　5：対物狙撃銃（バレット M82 風）
   戻り値の userData：muzzleZ（銃口の Z）、support（左手で支える点）、rings（溜めで光る部品）、long（両手持ちの長物か） */
export function buildGun(rare) {
  rare = Math.max(0, Math.min(5, rare || 0));
  const g = new THREE.Group();
  const rings = [];
  const add = (geo, mat, x, y, z, rx, ry, rz, par) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    m.castShadow = true;
    (par || g).add(m);
    return m;
  };
  const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const Cyl = (a, b, h, s) => new THREE.CylinderGeometry(a, b, h, s || 12);
  const HZ = Math.PI / 2;
  const ring = (r, t, z, col, inten, y) => {
    const m = add(new THREE.TorusGeometry(r, t, 6, 20), glowMaterial(col, inten, true), 0, y || 0, z);
    rings.push(m);
    return m;
  };
  // 握り：下へ伸び、下端が少し後ろへ倒れる
  const grip = (mat, w, h, d, tilt) => add(Box(w, h, d), mat, 0, -0.035 - h / 2, -0.012, tilt == null ? -0.28 : tilt);
  const guard = (mat) => {
    add(Box(0.012, 0.008, 0.05), mat, 0, -0.058, 0.035);
    add(Box(0.012, 0.03, 0.008), mat, 0, -0.045, 0.058);
  };
  let muzzleZ = 0.2, support = new THREE.Vector3(0.012, -0.075, 0.0), long = false;

  if (rare <= 2) {
    // ── 拳銃：遊底と枠と握り。等級で仕上げが変わる ──
    const slideCol = [0x3c3f45, 0xa8aeb8, 0x9a7a44][rare];
    const frameCol = [0x2a2c30, 0x1c1d21, 0x2a2420][rare];
    const slide = metalMaterial(401 + rare, slideCol), frame = metalMaterial(404, frameCol);
    const gripM = fleshMaterial([0x3a2a1e, 0x5a3a22, 0x6a2a2a][rare]);
    add(Box(0.03, 0.034, 0.19), slide, 0, 0.012, 0.055);              // 遊底
    add(Box(0.028, 0.02, 0.15), frame, 0, -0.016, 0.05);              // 枠
    for (let i = 0; i < 5; i++) add(Box(0.031, 0.026, 0.004), frame, 0, 0.012, -0.02 + i * 0.008);  // 遊底の溝
    add(Box(0.006, 0.008, 0.012), frame, 0, 0.033, 0.14);             // 照星
    add(Box(0.022, 0.008, 0.01), frame, 0, 0.033, -0.03);             // 照門
    grip(gripM, 0.03, 0.1, 0.044);
    guard(frame);
    add(Box(0.004, 0.022, 0.006), frame, 0, -0.04, 0.03, 0.3);        // 引き金
    if (rare === 2) {
      // 二連の銃身：上下に二つの口
      add(Cyl(0.009, 0.009, 0.05, 10), slide, 0, 0.022, 0.16, HZ);
      add(Cyl(0.009, 0.009, 0.05, 10), slide, 0, -0.004, 0.16, HZ);
      muzzleZ = 0.19;
      ring(0.017, 0.004, 0.17, 0xffc860, 0.9, 0.009);
    } else {
      add(Cyl(0.008, 0.008, 0.012, 10), frame, 0, 0.012, 0.152, HZ);
      muzzleZ = 0.16;
      if (rare === 1) {
        add(Box(0.031, 0.004, 0.16), glowMaterial(0xffd98a, 0.7), 0, 0.03, 0.055);   // 金の象嵌
      }
      ring(0.014, 0.003, 0.145, 0xffd98a, 0.6, 0.012);
    }
  } else if (rare === 3) {
    // ── 回転式：M500 風。長い銃身と全長の下支え、太い弾倉、黒い枠に金と紅 ──
    const frame = metalMaterial(410, 0x1e1a1c), gold = metalMaterial(411, 0xc9a227);
    const gripM = fleshMaterial(0x8a1f2a);
    add(Box(0.036, 0.05, 0.1), frame, 0, 0.0, 0.0);                  // 枠
    add(Box(0.036, 0.02, 0.06), frame, 0, 0.034, -0.02);             // 上の帯
    add(Cyl(0.03, 0.03, 0.058, 10), gold, 0, 0.004, 0.03, HZ);   // 弾倉（5発）
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      add(Box(0.006, 0.006, 0.05), frame, Math.cos(a) * 0.029, 0.004 + Math.sin(a) * 0.029, 0.03);   // 弾倉の溝
    }
    add(Cyl(0.013, 0.013, 0.24, 14), gold, 0, 0.012, 0.18, HZ);       // 銃身
    add(Box(0.034, 0.03, 0.24), frame, 0, 0.012, 0.18);              // 太い銃身まわり
    add(Box(0.026, 0.026, 0.23), frame, 0, -0.018, 0.18);            // 下支え（アンダーラグ）
    add(Box(0.03, 0.01, 0.22), frame, 0, 0.032, 0.18);               // 上のリブ
    // 銃口の制退器：両脇の穴
    add(Box(0.04, 0.034, 0.04), gold, 0, 0.012, 0.31);
    for (let i = 0; i < 3; i++) add(Box(0.042, 0.018, 0.006), frame, 0, 0.012, 0.296 + i * 0.012);
    // 刻印の光
    const eng = glowMaterial(0xff6a3a, 1.1);
    add(Box(0.035, 0.003, 0.2), eng, 0, 0.0, 0.18);
    add(Box(0.006, 0.008, 0.012), gold, 0, 0.041, 0.28);            // 照星
    add(Box(0.012, 0.02, 0.012), gold, 0, 0.035, -0.055, -0.6);       // 撃鉄
    grip(gripM, 0.034, 0.11, 0.05, -0.36);
    add(Box(0.036, 0.004, 0.052), gold, 0, -0.14, -0.05, -0.36);      // 握りの金の縁
    guard(gold);
    muzzleZ = 0.34;
    ring(0.024, 0.004, 0.33, 0xff8a4a, 0.9, 0.012);
    ring(0.034, 0.003, 0.03, 0xffc860, 0.6, 0.004);
  } else if (rare === 4) {
    // ── 大型の自動拳銃：デザートイーグル風。角張った遊底、三角の銃身、金と黒の虎縞 ──
    const gold = metalMaterial(420, 0xd8b860), black = metalMaterial(421, 0x141416);
    const gripM = fleshMaterial(0x1a1a1c);
    add(Box(0.036, 0.046, 0.14), gold, 0, 0.016, 0.0);               // 遊底
    add(Box(0.034, 0.024, 0.13), black, 0, -0.018, 0.02);            // 枠
    for (let i = 0; i < 7; i++) add(Box(0.037, 0.03, 0.004), black, 0, 0.018, -0.06 + i * 0.007);   // 遊底の溝
    // 三角の銃身（上が尖る）と、その上の照準溝
    add(Cyl(0.03, 0.03, 0.17, 3), gold, 0, 0.02, 0.15, -HZ, 0, 0);   // 頂点が上を向く
    add(Box(0.012, 0.008, 0.17), black, 0, 0.036, 0.15);
    for (let i = 0; i < 4; i++) add(Box(0.03, 0.008, 0.006), black, 0, 0.022, 0.2 + i * 0.012);   // 銃口の抜き穴
    add(Cyl(0.009, 0.009, 0.01, 10), black, 0, 0.018, 0.236, HZ);
    // 虎縞（深紅に光る）
    const stripe = glowMaterial(0xb3424a, 1.6);
    for (let i = 0; i < 5; i++) add(Box(0.038, 0.004, 0.012), stripe, 0, 0.004 + (i % 2) * 0.012, -0.04 + i * 0.022, 0.5);
    add(Box(0.006, 0.01, 0.01), black, 0, 0.045, 0.22);               // 照星
    add(Box(0.03, 0.01, 0.014), black, 0, 0.042, -0.064);             // 照門
    grip(gripM, 0.034, 0.12, 0.054, -0.3);
    add(Box(0.036, 0.1, 0.004), stripe, 0, -0.09, 0.003, -0.3);       // 握りの縁の光
    guard(black);
    add(Box(0.004, 0.024, 0.006), gold, 0, -0.042, 0.03, 0.3);
    muzzleZ = 0.245;
    ring(0.03, 0.004, 0.225, 0xffb040, 1.0, 0.02);
    ring(0.03, 0.003, 0.08, 0xb3424a, 0.8, 0.02);
  } else {
    // ── 対物狙撃銃：バレット M82 風。白銀と金、日輪の光条。両手で抱えて撃つ ──
    long = true;
    const S = 0.78;                                  // 実寸 1.45m を画面向けに少し詰める
    const b = new THREE.Group(); b.scale.setScalar(S); g.add(b);
    const pearl = metalMaterial(430, 0xe6e0d2), gold = metalMaterial(431, 0xffd24a), dark = metalMaterial(432, 0x24262c);
    const gripM = fleshMaterial(0x2a2a2e);
    const A = (geo, mat, x, y, z, rx, ry, rz) => add(geo, mat, x, y, z, rx, ry, rz, b);
    A(Box(0.06, 0.1, 0.62), pearl, 0, 0.03, 0.12);                   // 上下の機関部
    A(Box(0.062, 0.02, 0.62), gold, 0, -0.018, 0.12);                // 金の継ぎ目
    for (let i = 0; i < 8; i++) A(Box(0.064, 0.05, 0.008), dark, 0, 0.05, 0.3 + i * 0.03);  // 放熱の溝
    A(Box(0.02, 0.01, 0.55), dark, 0, 0.085, 0.1);                   // 上のレール
    // 銃身と大きな制退器
    A(Cyl(0.02, 0.022, 0.62, 14), dark, 0, 0.04, 0.72, HZ);
    A(Box(0.1, 0.06, 0.12), gold, 0, 0.04, 1.06);
    for (let i = 0; i < 2; i++) A(Box(0.104, 0.04, 0.022), dark, 0, 0.04, 1.03 + i * 0.05);
    A(Box(0.106, 0.064, 0.012), pearl, 0, 0.04, 1.0);
    // 照準器：金の筒、前の硝子が光る
    A(Cyl(0.024, 0.024, 0.3, 14), gold, 0, 0.14, 0.08, HZ);
    A(Cyl(0.032, 0.026, 0.06, 14), gold, 0, 0.14, 0.26, HZ);
    A(Cyl(0.03, 0.024, 0.05, 14), gold, 0, 0.14, -0.08, HZ);
    A(Cyl(0.028, 0.028, 0.004, 14), glowMaterial(0x9ad8ff, 1.8), 0, 0.14, 0.292, HZ);
    A(Box(0.02, 0.05, 0.02), dark, 0, 0.1, 0.02); A(Box(0.02, 0.05, 0.02), dark, 0, 0.1, 0.16);
    // 弾倉・握り・引き金
    A(Box(0.05, 0.14, 0.09), dark, 0, -0.08, 0.1, 0.12);
    A(Box(0.036, 0.12, 0.05), gripM, 0, -0.08, -0.02, -0.28);
    A(Box(0.012, 0.01, 0.06), dark, 0, -0.03, 0.03);
    // 銃床：後ろへ伸び、肩当て
    A(Box(0.05, 0.08, 0.36), pearl, 0, 0.02, -0.3);
    A(Box(0.054, 0.12, 0.04), dark, 0, 0.0, -0.49);
    A(Box(0.03, 0.06, 0.16), gold, 0, -0.04, -0.34);
    // 畳んだ二脚
    A(Box(0.012, 0.012, 0.28), dark, 0.03, -0.01, 0.62, 0.05);
    A(Box(0.012, 0.012, 0.28), dark, -0.03, -0.01, 0.62, 0.05);
    // 日輪の光条（両脇）
    const sun = glowMaterial(0xffe28a, 1.4);
    A(Box(0.064, 0.006, 0.5), sun, 0, 0.005, 0.12);
    A(Box(0.066, 0.004, 0.2), sun, 0, 0.055, -0.3);
    muzzleZ = 1.12 * S;
    support = new THREE.Vector3(0.0, -0.035, 0.42 * S);
    ring(0.03 * S, 0.004, 0.86 * S, 0xffe28a, 0.9, 0.04 * S);
    ring(0.03 * S, 0.004, 0.66 * S, 0xffe28a, 0.9, 0.04 * S);
    ring(0.08 * S, 0.005, 1.0 * S, 0xfff0a0, 0.8, 0.04 * S);
  }
  // 原点から握りを下げる：原点は握りの上端、銃口はやや上
  g.userData = { muzzleZ, support, rings, long, rare };
  return g;
}

/* ── 斬撃・突きの残光 ── */
export class SlashFX {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this._geo = new Map();
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.BufferGeometry(),
        new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      this.pool.push({ m, t: 0, dur: 0.2 });
    }
    this._line = new THREE.PlaneGeometry(1, 1);
    this._line.rotateX(-Math.PI / 2);
    this._line.translate(0, 0, 0.5);
    this._ring = new THREE.RingGeometry(0.82, 1, 40);
    this._ring.rotateX(-Math.PI / 2);
    this.head = 0;
  }
  _arcGeo(arc) {
    const k = Math.round(arc * 100);
    let g = this._geo.get(k);
    if (!g) {
      // 扇の中心が +Z を向くように作る
      g = new THREE.RingGeometry(0.35, 1, 28, 1, Math.PI / 2 - arc, arc * 2);
      g.rotateX(-Math.PI / 2);
      g.scale(1, 1, -1);
      this._geo.set(k, g);
    }
    return g;
  }
  _take() {
    const s = this.pool[this.head];
    this.head = (this.head + 1) % this.pool.length;
    return s;
  }
  /** 扇の斬撃 */
  arc(pos, yaw, range, arc, color, flip, y) {
    const s = this._take();
    s.m.geometry = this._arcGeo(arc);
    s.m.position.set(pos.x, (y == null ? 1.2 : y), pos.z);
    s.m.rotation.set(flip ? 0.25 : -0.25, yaw, 0);
    s.m.scale.set(range, 1, range);
    s.m.material.color.setHex(color || 0xfff0c0);
    s.t = 0; s.dur = 0.2; s.grow = 1.08; s.base = range;
    s.m.visible = true;
  }
  /** 直線の突き */
  line(pos, yaw, range, width, color, y) {
    const s = this._take();
    s.m.geometry = this._line;
    s.m.position.set(pos.x, (y == null ? 1.25 : y), pos.z);
    s.m.rotation.set(0, yaw, 0);
    s.m.scale.set(width, 1, range);
    s.m.material.color.setHex(color || 0xfff0c0);
    s.t = 0; s.dur = 0.16; s.grow = 1; s.base = range;
    s.m.visible = true;
  }
  /** 地を打つ輪 */
  ring(pos, r, color) {
    const s = this._take();
    s.m.geometry = this._ring;
    s.m.position.set(pos.x, 0.1, pos.z);
    s.m.rotation.set(0, 0, 0);
    s.m.scale.set(r * 0.3, 1, r * 0.3);
    s.m.material.color.setHex(color || 0xffd070);
    s.t = 0; s.dur = 0.35; s.grow = 3.3; s.base = r * 0.3; s.isRing = true;
    s.m.visible = true;
  }
  update(dt) {
    for (const s of this.pool) {
      if (!s.m.visible) continue;
      s.t += dt;
      const k = s.t / s.dur;
      if (k >= 1) { s.m.visible = false; s.isRing = false; continue; }
      s.m.material.opacity = (1 - k) * 0.85;
      if (s.isRing) { const sc = s.base * (1 + k * (s.grow - 1)); s.m.scale.set(sc, 1, sc); }
      else if (s.grow !== 1) { const sc = s.base * (1 + k * (s.grow - 1)); s.m.scale.set(sc, 1, sc); }
    }
  }
}

/** 扇または直線に入っているか（xz平面） */
export function inShape(ox, oz, dx, dz, px, pz, shape, range, arcOrWidth, extraR) {
  const vx = px - ox, vz = pz - oz;
  const d = Math.hypot(vx, vz);
  const r = extraR || 0;
  if (d > range + r) return false;
  if (shape === 'line') {
    const along = vx * dx + vz * dz;
    if (along < -0.4) return false;
    const side = Math.abs(vx * dz - vz * dx);
    return side < arcOrWidth / 2 + r;
  }
  if (d < 0.9 + r) return true;
  const cos = (vx * dx + vz * dz) / (d || 1);
  const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
  return ang < arcOrWidth + Math.atan2(r, d);
}
