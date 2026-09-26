/* ══════════════════════════════════════════════════════════════
   legend.js ── 伝説の装備
     武器17・防具4・護符4（主人公）と、日和の装束6。
     それぞれに「固有の力」（ab）と「見た目の色」（glow / pal / gun）を持たせる。
     力の中身は main.js の legendHit / legendTick / onHurt が働かせる。
   ══════════════════════════════════════════════════════════════ */

/* 新しく加わる伝説の品（既存の w5・a5・t5・mw5・ma5・mt5・xsword2・xbow2 はここで力を与える） */
export function legendGear() {
  return {
    w6: { slot: 'weapon', name: '月下の魔弾',   rare: 5, mods: { ATK: 78, DEX: 40, CRI: 20 },          desc: '伝説。月光を宿した銀の回転式' },
    w7: { slot: 'weapon', name: '雷神の鳴筒',   rare: 5, mods: { ATK: 84, MATK: 40, CRI: 16 },         desc: '伝説。黒鉄に雷を封じた大型拳銃' },
    a6: { slot: 'armor', name: '月読の羽衣',   rare: 5, mods: { DEF: 50, MDEF: 70, AGI: 40, HP: 60 },  desc: '伝説。夜の銀糸で織られた外套' },
    a7: { slot: 'armor', name: '須佐之男の鎧', rare: 5, mods: { DEF: 90, HP: 140, ATK: 24 },           desc: '伝説。嵐をまとう黒紫の鎧' },
    a8: { slot: 'armor', name: '八岐の鱗鎧',   rare: 5, mods: { DEF: 80, MDEF: 60, HP: 120 },          desc: '伝説。大蛇の鱗を綴った翠の鎧' },
    t6: { slot: 'charm', name: '天の生玉',     rare: 5, mods: { HP: 80, LUK: 40, MDEF: 30 },           desc: '伝説。命を一度だけ繋ぎとめる玉' },
    t7: { slot: 'charm', name: '天羽々斬の鍔', rare: 5, mods: { ATK: 40, CRI: 40, DEX: 20 },           desc: '伝説。大蛇を斬った剣の鍔' },
    t8: { slot: 'charm', name: '浦島の玉手箱', rare: 5, mods: { LUK: 90, AGI: 20, MP: 30 },            desc: '伝説。開けてはならぬ宝の箱' },
    mw6: { who: 'miko', slot: 'weapon', name: '天鈿女の神楽鈴', rare: 5, mods: { MATK: 96, DEX: 50, AGI: 30 }, desc: '伝説。舞えば闇が退く鈴' },
    ma6: { who: 'miko', slot: 'armor',  name: '輝夜の羽衣',     rare: 5, mods: { MDEF: 90, AGI: 50, MP: 40 },  desc: '伝説。月の都の羽衣' },
    mt6: { who: 'miko', slot: 'charm',  name: '天の真名井',     rare: 5, mods: { MP: 90, MATK: 40, LUK: 30 },  desc: '伝説。尽きぬ霊水を湛えた小瓶' }
  };
}

/* 銃以外の各武器に、伝説の一振り（x<種類>3）を加える。名前と力 */
export const LEGEND_WEAPON_NAMES = {
  dagger: '夜叉の双牙', staff: '八咫の神杖', mace: '建御雷の槌', axe: '大山祇の鉞', spear: '天之瓊矛',
  katar: '氷刃の阿修羅', tome: '古事記原本', claw: '白虎の爪', whip: '八岐の鎖鞭', lute: '天鈿女の琵琶',
  ninjato: '月読の影刀', shuriken: '迦楼羅の羽車'
};

/* 力の一覧：ab（種類）・text（説明）・glow（光の色）。武器の見た目は glow、銃は gun（形と色）、防具・護符は pal */
export const LEGEND = {
  // ── 銃 ──
  w5:  { ab: 'sun',    glow: 0xffd24a, text: '着弾で陽が弾け、周りの敵も焼く' },
  w6:  { ab: 'homing', glow: 0x8ad0ff, text: '弾が月光の尾を引いて敵を追い、貫く', gun: { shape: 3, metal: 0xc8d4e8, accent: 0x2a3a6a } },
  w7:  { ab: 'chain',  glow: 0xc08aff, text: '当たると雷が近くの敵へ二度走る', gun: { shape: 4, metal: 0x2a2230, accent: 0x6a3aaa } },
  // ── 近接・その他 ──
  xsword2:    { ab: 'wave',   glow: 0x9ad8ff, text: '振るたびに斬撃の波が飛ぶ' },
  xbow2:      { ab: 'multi',  glow: 0xffe08a, text: '一度に三本の矢を放つ' },
  xdagger3:   { ab: 'crit',   glow: 0xff4a6a, text: '会心率+25%、会心の一撃がさらに重い' },
  xstaff3:    { ab: 'burst',  glow: 0xffa040, text: '陽の珠が弾けて周りを巻き込む' },
  xmace3:     { ab: 'chain',  glow: 0xc08aff, text: '打った敵から雷が走る' },
  xaxe3:      { ab: 'vamp',   glow: 0xff3a3a, text: '斬るたびに生命を吸い、ときに心を癒す' },
  xspear3:    { ab: 'giant',  glow: 0x6affd0, text: '間合いが1.5倍に伸びる' },
  xkatar3:    { ab: 'freeze', glow: 0xa8e8ff, text: '刺した敵を凍らせて動きを止める' },
  xtome3:     { ab: 'multi',  glow: 0xffe08a, text: '頁が倍の数だけ舞う' },
  xclaw3:     { ab: 'chain',  glow: 0xe8f4ff, text: '白虎の雷が爪から走る' },
  xwhip3:     { ab: 'burst',  glow: 0x6aff8a, text: '打った先で毒の花が弾ける' },
  xlute3:     { ab: 'freeze', glow: 0xffb0e0, text: '音の輪が敵を痺れさせる' },
  xninjato3:  { ab: 'wave',   glow: 0x8a8aff, text: '影の斬撃が遠くまで飛ぶ' },
  xshuriken3: { ab: 'giant',  glow: 0xff9a4a, text: '手裏剣が巨大になり、倍の敵を裂く' },
  // ── 防具（pal：外套・金具・光輪の色） ──
  a5: { ab: 'regen',  text: '15秒ごとに心がひとつ戻る', pal: { metal: 0xe8c060, cape: 0xc9a227, capeE: 0x5a3a08, halo: 0xffd24a, spike: 0xffe27a } },
  a6: { ab: 'mirage', text: '回避+20%。避けた直後は幻となって無敵', pal: { metal: 0xdce6f4, cape: 0x2e4a8a, capeE: 0x1a3a9a, halo: 0xa8d8ff, spike: 0xe0f4ff, moon: true } },
  a7: { ab: 'thorns', text: '傷を受けると嵐が巻き起こり、周りの敵を打つ', pal: { metal: 0x4a3a5a, cape: 0x2a1a3a, capeE: 0x5a2aa0, halo: 0xb07aff, spike: 0xd8a8ff, bolts: true } },
  a8: { ab: 'aegis',  text: '20秒ごとに鱗の守り（被ダメ半減・5秒）', pal: { metal: 0x3a7a52, cape: 0x1a3a2a, capeE: 0x1a6a3a, halo: 0x6affa0, spike: 0xa0ffc8, horns: true } },
  // ── 護符（pal：胸を巡る粒の色） ──
  t5: { ab: 'reflect', text: '傷を受けると光の弾を全方位に撃ち返す', pal: { mote: 0xffe08a } },
  t6: { ab: 'revive',  text: '一度の潜行につき一度だけ、倒れても立ち上がる', pal: { mote: 0x6affa0 } },
  t7: { ab: 'fury',    text: '会心率+20%、会心の倍率+0.8', pal: { mote: 0xff5a6a } },
  t8: { ab: 'fortune', text: '得る経験と陽貨が1.6倍', pal: { mote: 0xffa0d0 } },
  // ── 日和 ──
  mw5: { ab: 'blessing', glow: 0xffd24a, text: '祓いで癒す心がひとつ増える' },
  mw6: { ab: 'dance',    glow: 0xffb0e0, text: '祓いの舞が周りの敵を打ち払う' },
  ma5: { ab: 'steadfast', text: '日和がよろめかなくなる', pal: { hagoromo: 0xffe8a0, emi: 0xffc040, halo: 0xffd24a } },
  ma6: { ab: 'haste',     text: '祓いの待ち時間が35%縮む', pal: { hagoromo: 0xdce8ff, emi: 0x6a8aff, halo: 0xa8d8ff } },
  mt5: { ab: 'overflow', text: '祓いの加護が倍の長さ・より強く', pal: { mote: 0x6affa0 } },
  mt6: { ab: 'spring',   text: '日和の霊力の戻りが2倍', pal: { mote: 0x8ad0ff } }
};

export function legendOf(id) { return (id && LEGEND[id]) || null; }
