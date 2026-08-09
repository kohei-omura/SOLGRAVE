/* ══════════════════════════════════════════════════════════════
   jobs.js ── 職業・技（スキルツリー）・装備
     位が上がるごとに技の点を得て、条件を満たした技を覚えていく。
     技は霊力（MP）を使う。装備は能力値を底上げする。
   ══════════════════════════════════════════════════════════════ */

/* ── 五つの職 ──
   bias は素の伸び方への倍率。役割がはっきり分かれるようにしてある。 */
export const JOBS = {
  hunter: {
    id: 'hunter', name: '陽狩人', short: '狩',
    desc: '陽光銃の扱いに長ける。遠くから確実に祓う。',
    bias: { ATK: 1.20, DEX: 1.15, CRI: 1.10, AGI: 1.05, MATK: 0.85, MP: 0.85, HP: 0.95 }
  },
  blade: {
    id: 'blade', name: '陽剣士', short: '剣',
    desc: '陽を刃に宿し、間合いを詰めて斬り伏せる。',
    bias: { ATK: 1.30, HP: 1.15, DEF: 1.10, AGI: 1.05, MATK: 0.75, MP: 0.75, DEX: 0.9 }
  },
  caster: {
    id: 'caster', name: '陽術士', short: '術',
    desc: '陽の理を操る。霊力を糧に大きな術を放つ。',
    bias: { MATK: 1.35, MP: 1.35, MDEF: 1.15, LUK: 1.05, ATK: 0.70, DEF: 0.80, HP: 0.85 }
  },
  swift: {
    id: 'swift', name: '韋駄天', short: '韋',
    desc: '風のごとく駆ける。速さと技巧で翻弄する。',
    bias: { AGI: 1.35, DEX: 1.25, CRI: 1.15, LUK: 1.10, HP: 0.85, DEF: 0.80, MATK: 0.9 }
  },
  guard: {
    id: 'guard', name: '守護者', short: '守',
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
  // 防具
  a0: { slot: 'armor', name: '狩人の外套',   rare: 0, mods: { DEF: 0 },               desc: '着慣れた外套' },
  a1: { slot: 'armor', name: '鞣革の胴当て', rare: 1, mods: { DEF: 8, HP: 10 },       desc: '軽くて丈夫' },
  a2: { slot: 'armor', name: '陽紋の鎧',     rare: 2, mods: { DEF: 18, MDEF: 10 },    desc: '陽の紋が彫られた鎧' },
  a3: { slot: 'armor', name: '黄金の法衣',   rare: 3, mods: { DEF: 26, MDEF: 24, MP: 20 }, desc: '術士のための衣' },
  a4: { slot: 'armor', name: '不滅の陽鎧',   rare: 4, mods: { DEF: 44, HP: 60, MDEF: 28 }, desc: '陽そのものを纏う' },
  // 護符
  t0: { slot: 'charm', name: '木彫りの護符', rare: 0, mods: { LUK: 0 },               desc: '母の手彫り' },
  t1: { slot: 'charm', name: '銀の鈴',       rare: 1, mods: { AGI: 8, LUK: 4 },       desc: '澄んだ音が響く' },
  t2: { slot: 'charm', name: '日輪の勾玉',   rare: 2, mods: { MATK: 14, MP: 16 },     desc: '仄かに温かい' },
  t3: { slot: 'charm', name: '八咫の羽',     rare: 3, mods: { AGI: 20, CRI: 12, LUK: 14 }, desc: '導きの鳥の羽' },
  t4: { slot: 'charm', name: '天照の欠片',   rare: 4, mods: { ATK: 20, MATK: 20, LUK: 30 }, desc: '陽の欠片' }
};

export const SLOTS = [
  { id: 'weapon', name: '武器' },
  { id: 'armor',  name: '防具' },
  { id: 'charm',  name: '護符' }
];

/** 階の深さに応じて落ちる装備を選ぶ */
export function rollGear(floor, luck) {
  const keys = Object.keys(GEAR);
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
