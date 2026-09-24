/* ══════════════════════════════════════════════════════════════
   jobs.js ── 職業・技（スキルツリー）・装備
     位が上がるごとに技の点を得て、条件を満たした技を覚えていく。
     技は霊力（MP）を使う。装備は能力値を底上げする。
   ══════════════════════════════════════════════════════════════ */
import { weaponGear } from './weapons.js';

/* ── 五つの職 ──
   bias は素の伸び方への倍率。役割がはっきり分かれるようにしてある。 */
export const JOBS = {
  hunter: {
    id: 'hunter', name: '陽狩人', short: '狩',
    arms: ['gun', 'bow', 'shuriken'],
    desc: '陽光銃の扱いに長ける。遠くから確実に祓う。',
    bias: { ATK: 1.20, DEX: 1.15, CRI: 1.10, AGI: 1.05, MATK: 0.85, MP: 0.85, HP: 0.95 }
  },
  blade: {
    id: 'blade', name: '陽剣士', short: '剣',
    arms: ['sword', 'axe', 'spear', 'ninjato'],
    desc: '陽を刃に宿し、間合いを詰めて斬り伏せる。',
    bias: { ATK: 1.30, HP: 1.15, DEF: 1.10, AGI: 1.05, MATK: 0.75, MP: 0.75, DEX: 0.9 }
  },
  caster: {
    id: 'caster', name: '陽術士', short: '術',
    arms: ['staff', 'tome', 'lute'],
    desc: '陽の理を操る。霊力を糧に大きな術を放つ。',
    bias: { MATK: 1.35, MP: 1.35, MDEF: 1.15, LUK: 1.05, ATK: 0.70, DEF: 0.80, HP: 0.85 }
  },
  swift: {
    id: 'swift', name: '韋駄天', short: '韋',
    arms: ['dagger', 'katar', 'claw', 'whip', 'ninjato'],
    desc: '風のごとく駆ける。速さと技巧で翻弄する。',
    bias: { AGI: 1.35, DEX: 1.25, CRI: 1.15, LUK: 1.10, HP: 0.85, DEF: 0.80, MATK: 0.9 }
  },
  guard: {
    id: 'guard', name: '守護者', short: '守',
    arms: ['mace', 'axe', 'spear', 'sword'],
    desc: '陽の盾を掲げ、すべてを受け止める。',
    bias: { HP: 1.35, DEF: 1.30, MDEF: 1.20, ATK: 0.95, AGI: 0.80, DEX: 0.85, CRI: 0.8 }
  }
};

/* ── 技 ──
   kind: 'active'（技ボタンで使う）／'passive'（覚えるだけで効く）
   need: 覚えるのに要る位　req: 先に覚えておく技
   cost: 霊力の消費　cd: 再使用までの秒
─────────────────────────────────────────── */
export const SKILLS = {
  /* 陽狩人 */
  h1: { job: 'hunter', name: '速射',       kind: 'passive', need: 2,  desc: '撃つ間隔が15%縮まる',            effect: { fireRate: 0.85 } },
  h2: { job: 'hunter', name: '貫きの弾',   kind: 'passive', need: 6,  req: 'h1', desc: '通常弾が敵を1体貫く',    effect: { pierce1: true } },
  h3: { job: 'hunter', name: '陽光散弾',   kind: 'active',  need: 10, req: 'h1', cost: 14, cd: 6,
        desc: '前方へ5発を扇状に撃つ',        effect: { shotgun: 5 } },
  h4: { job: 'hunter', name: '鷹の目',     kind: 'passive', need: 16, req: 'h2', desc: '会心率+8%、会心の倍率+0.3', effect: { crit: 0.08, critMul: 0.3 } },
  h5: { job: 'hunter', name: '極光の一矢', kind: 'active',  need: 24, req: 'h3', cost: 32, cd: 14,
        desc: '前方を貫く極太の光条を放つ',    effect: { lance: true } },
  h6: { job: 'hunter', name: '陽の狩人',   kind: 'passive', need: 34, req: 'h4', desc: '攻撃+12%、技巧+12%',    effect: { atk: 0.12, dex: 0.12 } },

  /* 陽剣士 */
  b1: { job: 'blade', name: '陽刃',       kind: 'active',  need: 2,  cost: 8,  cd: 2.2,
        desc: '間合いの敵を薙ぎ払う',          effect: { slash: 3.0 } },
  b2: { job: 'blade', name: '不屈',       kind: 'passive', need: 6,  req: 'b1', desc: '心の耐久が30%増す',      effect: { guard: 1.3 } },
  b3: { job: 'blade', name: '踏み込み',   kind: 'passive', need: 10, req: 'b1', desc: '駆け抜けの間、敵を弾く', effect: { dashHit: true } },
  b4: { job: 'blade', name: '陽炎斬り',   kind: 'active',  need: 16, req: 'b3', cost: 26, cd: 10,
        desc: '前方へ突進しながら斬り裂く',    effect: { rush: true } },
  b5: { job: 'blade', name: '反攻',       kind: 'passive', need: 24, req: 'b2', desc: '傷を受けた直後の一撃が2倍', effect: { revenge: 2.0 } },
  b6: { job: 'blade', name: '陽の剣聖',   kind: 'passive', need: 34, req: 'b5', desc: '攻撃+15%、守り+10%',    effect: { atk: 0.15, def: 0.10 } },

  /* 陽術士 */
  c1: { job: 'caster', name: '陽珠',      kind: 'active',  need: 2,  cost: 10, cd: 3,
        desc: '追尾する光の珠を放つ',          effect: { orb: 1 } },
  c2: { job: 'caster', name: '霊力循環',  kind: 'passive', need: 6,  req: 'c1', desc: '霊力の戻りが50%速まる',  effect: { mpRegen: 1.5 } },
  c3: { job: 'caster', name: '陽輪',      kind: 'active',  need: 10, req: 'c1', cost: 24, cd: 8,
        desc: '周囲に光の輪を広げ、触れた敵を焼く', effect: { nova: 6.0 } },
  c4: { job: 'caster', name: '陽の加護',  kind: 'passive', need: 16, req: 'c2', desc: '霊防+15、被る霊的な傷を軽く', effect: { mdef: 15 } },
  c5: { job: 'caster', name: '天日の柱',  kind: 'active',  need: 24, req: 'c3', cost: 40, cd: 16,
        desc: '狙った場所へ天から光の柱を落とす', effect: { pillar: true } },
  c6: { job: 'caster', name: '陽の賢者',  kind: 'passive', need: 34, req: 'c4', desc: '霊撃+18%、霊力+30%',    effect: { matk: 0.18, mp: 0.3 } },

  /* 韋駄天 */
  s1: { job: 'swift', name: '疾走',       kind: 'passive', need: 2,  desc: '速さ+10%',                      effect: { speed: 0.10 } },
  s2: { job: 'swift', name: '二段駆け',   kind: 'passive', need: 6,  req: 's1', desc: '駆け抜けを続けて2回使える', effect: { dash2: true } },
  s3: { job: 'swift', name: '陽の残像',   kind: 'active',  need: 10, req: 's2', cost: 16, cd: 7,
        desc: '残像を置き、敵の目を欺く',      effect: { decoy: true } },
  s4: { job: 'swift', name: '見切り',     kind: 'passive', need: 16, req: 's2', desc: '回避+10%',              effect: { evade: 0.10 } },
  s5: { job: 'swift', name: '瞬影',       kind: 'active',  need: 24, req: 's3', cost: 30, cd: 12,
        desc: '一瞬で間合いを詰め、周囲を斬る', effect: { blink: true } },
  s6: { job: 'swift', name: '韋駄天',     kind: 'passive', need: 34, req: 's4', desc: '速さ+12%、会心+6%',     effect: { speed: 0.12, crit: 0.06 } },

  /* 守護者 */
  g1: { job: 'guard', name: '堅牢',       kind: 'passive', need: 2,  desc: '守り+12',                        effect: { def: 12 } },
  g2: { job: 'guard', name: '陽の盾',     kind: 'active',  need: 6,  req: 'g1', cost: 18, cd: 12,
        desc: '10秒のあいだ受ける傷を半分に',  effect: { shield: 10 } },
  g3: { job: 'guard', name: '仁王立ち',   kind: 'passive', need: 10, req: 'g1', desc: '心の耐久が50%増す',     effect: { guard: 1.5 } },
  g4: { job: 'guard', name: '護りの号令', kind: 'active',  need: 16, req: 'g2', cost: 22, cd: 14,
        desc: '日和ごと守り、霊力を分け与える', effect: { rally: true } },
  g5: { job: 'guard', name: '反射',       kind: 'passive', need: 24, req: 'g3', desc: '傷を受けた時、周囲を弾く', effect: { thorn: true } },
  g6: { job: 'guard', name: '不動の守',   kind: 'passive', need: 34, req: 'g5', desc: '体力+20%、守り+15%',    effect: { hp: 0.20, def: 0.15 } }
};

/** その職の技を、覚える順に並べて返す */
export function skillsOf(job) {
  return Object.keys(SKILLS).filter(k => SKILLS[k].job === job)
    .sort((a, b) => SKILLS[a].need - SKILLS[b].need)
    .map(k => Object.assign({ id: k }, SKILLS[k]));
}

/** 覚えられるか */
export function canLearn(id, lv, learned) {
  const s = SKILLS[id];
  if (!s) return { ok: false, why: '存在しない技' };
  if (learned[id]) return { ok: false, why: 'すでに覚えている' };
  if (lv < s.need) return { ok: false, why: 'Lv.' + s.need + ' から' };
  if (s.req && !learned[s.req]) return { ok: false, why: '先に「' + SKILLS[s.req].name + '」' };
  return { ok: true, why: '' };
}

/* ── 装備 ──
   mods は能力値への加算。rare は落ちにくさ。 */
export const GEAR = {
  // 武器
  w0: { slot: 'weapon', name: '古びた陽光銃', rare: 0, mods: { ATK: 0 },              desc: '最初の相棒' },
  w1: { slot: 'weapon', name: '磨かれた銃身', rare: 1, mods: { ATK: 8, DEX: 4 },      desc: '手入れの行き届いた銃' },
  w2: { slot: 'weapon', name: '双陽の連銃',   rare: 2, mods: { ATK: 16, CRI: 8 },     desc: '二連の銃口が陽を吐く' },
  w3: { slot: 'weapon', name: '金烏の大筒',   rare: 3, mods: { ATK: 30, MATK: 14 },   desc: '日輪を撃ち出す大筒' },
  w4: { slot: 'weapon', name: '天日破',       rare: 4, mods: { ATK: 52, CRI: 14, DEX: 12 }, desc: '闇を貫くと伝わる銃' },
  w5: { slot: 'weapon', name: '天照大銃',     rare: 5, mods: { ATK: 90, CRI: 24, DEX: 20, MATK: 30 }, desc: '伝説。陽そのものを撃ち出す' },
  // 防具
  a0: { slot: 'armor', name: '狩人の外套',   rare: 0, mods: { DEF: 0 },               desc: '着慣れた外套' },
  a1: { slot: 'armor', name: '鞣革の胴当て', rare: 1, mods: { DEF: 8, HP: 10 },       desc: '軽くて丈夫' },
  a2: { slot: 'armor', name: '陽紋の鎧',     rare: 2, mods: { DEF: 18, MDEF: 10 },    desc: '陽の紋が彫られた鎧' },
  a3: { slot: 'armor', name: '黄金の法衣',   rare: 3, mods: { DEF: 26, MDEF: 24, MP: 20 }, desc: '術士のための衣' },
  a4: { slot: 'armor', name: '不滅の陽鎧',   rare: 4, mods: { DEF: 44, HP: 60, MDEF: 28 }, desc: '陽そのものを纏う' },
  a5: { slot: 'armor', name: '日輪の神衣',   rare: 5, mods: { DEF: 70, HP: 100, MDEF: 50, AGI: 16 }, desc: '伝説。黄金の外套と光輪' },
  // 護符
  t0: { slot: 'charm', name: '木彫りの護符', rare: 0, mods: { LUK: 0 },               desc: '母の手彫り' },
  t1: { slot: 'charm', name: '銀の鈴',       rare: 1, mods: { AGI: 8, LUK: 4 },       desc: '澄んだ音が響く' },
  t2: { slot: 'charm', name: '日輪の勾玉',   rare: 2, mods: { MATK: 14, MP: 16 },     desc: '仄かに温かい' },
  t3: { slot: 'charm', name: '八咫の羽',     rare: 3, mods: { AGI: 20, CRI: 12, LUK: 14 }, desc: '導きの鳥の羽' },
  t4: { slot: 'charm', name: '天照の欠片',   rare: 4, mods: { ATK: 20, MATK: 20, LUK: 30 }, desc: '陽の欠片' },
  t5: { slot: 'charm', name: '八咫鏡',       rare: 5, mods: { ATK: 34, MATK: 34, LUK: 50, CRI: 20 }, desc: '伝説。闇を映し返す鏡' },

  /* ── 日和の装備（who: 'miko'） ──
     武器＝祓いの道具（霊撃で癒す量）、防具＝装束（霊防で加護）、護符＝髪飾り */
  mw0: { who: 'miko', slot: 'weapon', name: '白木の御幣',   rare: 0, mods: { MATK: 0 },                    desc: '日和の手に馴染んだ御幣' },
  mw1: { who: 'miko', slot: 'weapon', name: '神楽鈴',       rare: 1, mods: { MATK: 10, DEX: 6 },           desc: '澄んだ音が穢れを払う' },
  mw2: { who: 'miko', slot: 'weapon', name: '玉串の錫杖',   rare: 2, mods: { MATK: 22, MP: 12 },           desc: '癒しの力が増す' },
  mw3: { who: 'miko', slot: 'weapon', name: '八咫の大幣',   rare: 3, mods: { MATK: 40, DEX: 18 },          desc: '祓いの間が短くなる' },
  mw4: { who: 'miko', slot: 'weapon', name: '天の羽々矢',   rare: 4, mods: { MATK: 64, MP: 30, LUK: 16 },  desc: '一度で多くを癒す' },
  mw5: { who: 'miko', slot: 'weapon', name: '天照の御杖',   rare: 5, mods: { MATK: 110, MP: 60, DEX: 40, LUK: 30 }, desc: '伝説。日輪を戴く杖' },
  ma0: { who: 'miko', slot: 'armor',  name: '白衣と緋袴',   rare: 0, mods: { MDEF: 0 },                    desc: '巫女の装い' },
  ma1: { who: 'miko', slot: 'armor',  name: '千早',         rare: 1, mods: { MDEF: 10, HP: 8 },            desc: '舞のための薄衣' },
  ma2: { who: 'miko', slot: 'armor',  name: '紅梅の装束',   rare: 2, mods: { MDEF: 22, DEF: 10 },          desc: '加護が長く続く' },
  ma3: { who: 'miko', slot: 'armor',  name: '月白の打掛',   rare: 3, mods: { MDEF: 38, AGI: 14, HP: 20 },  desc: '軽やかに付き従う' },
  ma4: { who: 'miko', slot: 'armor',  name: '天女の羽衣',   rare: 4, mods: { MDEF: 60, AGI: 24, MP: 24 },  desc: '宙に揺れる羽衣' },
  ma5: { who: 'miko', slot: 'armor',  name: '大日の神衣',   rare: 5, mods: { MDEF: 100, HP: 60, AGI: 40, DEF: 40 }, desc: '伝説。黄金の冠と光の羽衣' },
  mt0: { who: 'miko', slot: 'charm',  name: '紅の結い紐',   rare: 0, mods: { LUK: 0 },                     desc: '髪を結う紐' },
  mt1: { who: 'miko', slot: 'charm',  name: '桜の簪',       rare: 1, mods: { LUK: 10, MP: 6 },             desc: '倍で癒す割合が増す' },
  mt2: { who: 'miko', slot: 'charm',  name: '翡翠の勾玉',   rare: 2, mods: { MP: 20, LUK: 10 },            desc: '霊力が満ちる' },
  mt3: { who: 'miko', slot: 'charm',  name: '金の前天冠',   rare: 3, mods: { MATK: 18, LUK: 22, MDEF: 12 }, desc: '神楽の冠' },
  mt4: { who: 'miko', slot: 'charm',  name: '月読の櫛',     rare: 4, mods: { MATK: 30, LUK: 36, DEX: 20 }, desc: '夜を鎮める櫛' },
  mt5: { who: 'miko', slot: 'charm',  name: '八尺瓊勾玉',   rare: 5, mods: { MATK: 50, LUK: 60, MP: 50, DEX: 30 }, desc: '伝説。宙に浮かぶ勾玉の輪' }
};
Object.assign(GEAR, weaponGear());
/** 銃以外の武器の種類（未指定は銃） */
export function wtypeOf(id) {
  const g = GEAR[id];
  if (!g || g.slot !== 'weapon' || g.who === 'miko') return 'gun';
  return g.wtype || 'gun';
}

export const SLOTS = [
  { id: 'weapon', name: '武器' },
  { id: 'armor',  name: '防具' },
  { id: 'charm',  name: '護符' }
];

/** 階の深さに応じて落ちる装備を選ぶ（who: 'hero' / 'miko'） */
export function rollGear(floor, luck, who) {
  who = who || 'hero';
  const keys = Object.keys(GEAR).filter(k => (GEAR[k].who || 'hero') === who);
  const maxRare = Math.min(4, Math.floor(floor / 2));
  const bonus = Math.min(0.35, (luck || 0) * 0.002);
  const r = Math.random() + bonus;
  let want = 0;
  if (r > 0.96) want = 4; else if (r > 0.86) want = 3;
  else if (r > 0.66) want = 2; else if (r > 0.38) want = 1;
  want = Math.min(want, maxRare);
  const pool = keys.filter(k => GEAR[k].rare === want);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
