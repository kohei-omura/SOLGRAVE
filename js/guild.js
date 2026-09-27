/* ══════════════════════════════════════════════════════════════
   guild.js ── 冒険者ギルドと、仲間との暮らし
     ・冒険者の等級（D → C → B → A → S → SS → SSS → 伝説の勇者級）
       依頼をこなすと功績が貯まり、等級が上がる。等級で使える武器が広がる。
     ・依頼：街ごとに三つ。討伐・踏破・主の討伐・中ボス・稼ぎ
     ・交流：仲間との絆（0〜100）。話す・贈り物・出かける。
       絆が深まると恋人に、住まいと誓いの指輪があれば結婚できる（一夫多妻が認められた世界）。
       結婚した相手と日々を重ねると、やがて子を授かる。
       ※ 性的な場面は描かない。暮らしと家族の物語として扱う。
   ══════════════════════════════════════════════════════════════ */
import { RANKS, RANK_PTS, RANK_NAME, CHAR } from './roster.js';

const KEY = 'solgrave_guild';

/* 絆の段階 */
export const BOND = [
  { at: 0, name: '顔見知り' }, { at: 15, name: '仲間' }, { at: 35, name: '友人' },
  { at: 55, name: '特別な人' }, { at: 70, name: '恋人' }, { at: 90, name: '婚約者' }, { at: 100, name: '伴侶' }
];
export function bondName(v, married) { if (married) return '伴侶'; let n = BOND[0].name; BOND.forEach(b => { if (v >= b.at && b.at < 100) n = b.name; }); return n; }

/* 贈り物（道具屋・ギルドの売店で買う） */
export const GIFTS = {
  花束: { price: 60, pt: 4 }, 甘味: { price: 40, pt: 3 }, 紅茶: { price: 50, pt: 3 }, 宝石: { price: 400, pt: 9 },
  簪: { price: 180, pt: 6 }, 古書: { price: 150, pt: 5 }, 剣帯: { price: 160, pt: 5 }, 真珠: { price: 300, pt: 8 },
  和菓子: { price: 70, pt: 4 }, 氷菓子: { price: 60, pt: 4 }, 白い花: { price: 60, pt: 4 }, 薔薇: { price: 120, pt: 5 },
  木の実: { price: 30, pt: 3 }, 干し魚: { price: 30, pt: 3 }, 風鈴: { price: 80, pt: 4 }, 金貨: { price: 200, pt: 5 },
  団子: { price: 40, pt: 3 }, 手裏剣: { price: 90, pt: 4 }, 蜂蜜酒: { price: 120, pt: 5 }, 火薬: { price: 90, pt: 4 },
  月見団子: { price: 70, pt: 4 }, 星砂: { price: 250, pt: 7 }, 歯車: { price: 120, pt: 5 }, 肉料理: { price: 90, pt: 4 }
};
export const RING_PRICE = 3000;

/* 出かける先（街の趣ごと） */
export const DATES = ['市場を歩く', '茶屋でひと休み', '丘の上で夕陽を見る', '湖で舟遊び', '星空の下を散歩', '花畑でお弁当', '劇場で歌劇を観る'];

/* 子の名（授かった時に選ぶ） */
const CHILD_NAMES = { f: ['陽菜', 'ひかり', 'あかり', 'さくら', 'ルミ', 'セレン', 'ミア', 'リリィ'], m: ['陽斗', '光', '朔', 'レイ', 'ノア', 'カイト', '蓮', 'アル'] };

export class Guild {
  constructor() {
    this.rank = 'D'; this.pts = 0;
    this.quests = {};          // 街ごとの依頼 { townId: [q...] }
    this.done = 0;
    this.bond = {};            // 仲間ごとの絆
    this.talkedDay = {};       // その日に話したか
    this.datedDay = {};
    this.spouses = [];         // 結婚した相手（一夫多妻）
    this.lovers = [];          // 恋人
    this.engaged = [];         // 婚約
    this.rings = 0;            // 誓いの指輪
    this.gifts = {};           // 持っている贈り物 { 名: 数 }
    this.house = null;         // { town, name }
    this.children = [];        // { name, g, mother, day }
    this.day = 1;              // 日（街へ戻る・宿で休むと進む）
    this.visited = ['hinomori'];
    this.town = 'hinomori';
  }
  static load() {
    const G = new Guild();
    try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o) Object.assign(G, o); } catch (e) {}
    return G;
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this)); } catch (e) {} }

  /* ── 等級 ── */
  nextRank() { const i = RANKS.indexOf(this.rank); return i >= 0 && i < RANKS.length - 1 ? RANKS[i + 1] : null; }
  rankName() { return RANK_NAME[this.rank]; }
  addPts(n) {
    this.pts += n;
    let up = null;
    for (;;) { const nx = this.nextRank(); if (!nx || this.pts < RANK_PTS[nx]) break; this.rank = nx; up = nx; }
    this.save();
    return up;
  }

  /* ── 依頼 ── */
  questsOf(town, floor) {
    if (!this.quests[town] || !this.quests[town].length) this.quests[town] = this._gen(town, floor);
    return this.quests[town];
  }
  _gen(town, floor) {
    const f = Math.max(1, floor || 1), R = Math.random;
    const lvK = 1 + RANKS.indexOf(this.rank) * 0.6;
    const pool = [
      () => { const n = 8 + Math.floor(R() * 8 * lvK); return { type: 'kill', need: n, title: '不死者を' + n + '体祓え', coin: n * 12, pts: 10 + n }; },
      () => { const n = f + 1 + Math.floor(R() * 3); return { type: 'floor', need: n, title: '地下' + n + '層へ到達せよ', coin: 80 * n, pts: 25 + n * 3 }; },
      () => ({ type: 'boss', need: 1, title: '階の主をひとり祓え', coin: 300 + f * 60, pts: 60 + f * 2 }),
      () => ({ type: 'elite', need: 1, title: '封じられた中ボスを討て', coin: 200 + f * 40, pts: 40 + f }),
      () => { const n = 300 + Math.floor(R() * 5) * 200; return { type: 'coin', need: n, title: '陽貨を' + n + '集めよ', coin: Math.round(n * 0.3), pts: 20 }; },
      () => { const n = 3 + Math.floor(R() * 3); return { type: 'rare', need: n, title: '輝く不死者（稀少種）を' + n + '体討て', coin: n * 120, pts: 30 + n * 5 }; }
    ];
    const out = [];
    const used = new Set();
    while (out.length < 3) {
      const i = Math.floor(R() * pool.length);
      if (used.has(i)) continue;
      used.add(i);
      const q = pool[i](); q.prog = 0; q.id = town + '_' + Date.now().toString(36) + out.length; q.taken = false;
      out.push(q);
    }
    return out;
  }
  /** 出来事を依頼の進みに数える（受けた依頼だけ） */
  onEvent(type, n) {
    let changed = false;
    Object.keys(this.quests).forEach(t => (this.quests[t] || []).forEach(q => {
      if (!q.taken || q.prog >= q.need || q.type !== type) return;
      if (type === 'floor') q.prog = Math.max(q.prog, n); else q.prog = Math.min(q.need, q.prog + (n || 1));
      changed = true;
    }));
    if (changed) this.save();
    return changed;
  }
  readyCount() { let n = 0; Object.keys(this.quests).forEach(t => (this.quests[t] || []).forEach(q => { if (q.taken && q.prog >= q.need) n++; })); return n; }
  /** 達成した依頼の報酬を受け取る。{coin, pts, up} */
  claim(town, id) {
    const list = this.quests[town] || [];
    const i = list.findIndex(q => q.id === id);
    if (i < 0) return null;
    const q = list[i];
    if (q.prog < q.need) return null;
    list.splice(i, 1);
    this.done++;
    const up = this.addPts(q.pts);
    this.save();
    return { coin: q.coin, pts: q.pts, up };
  }

  /* ── 日々 ── */
  nextDay() {
    this.day++;
    this.talkedDay = {}; this.datedDay = {};
    // 伴侶と日々を重ねると、やがて子を授かる
    let born = null;
    this.spouses.forEach(id => {
      const mine = this.children.filter(c => c.mother === id);
      const since = this.day - (mine.length ? mine[mine.length - 1].day : (this._wedDay && this._wedDay[id]) || this.day);
      if (!born && mine.length < 3 && since >= 4 && Math.random() < 0.35) {
        const g = Math.random() < 0.5 ? 'f' : 'm';
        const names = CHILD_NAMES[g].filter(n => !this.children.some(c => c.name === n));
        born = { name: names[Math.floor(Math.random() * names.length)] || '陽', g, mother: id, day: this.day };
        this.children.push(born);
      }
    });
    this.save();
    return born;
  }

  /* ── 絆 ── */
  bondOf(id) { return this.bond[id] || 0; }
  addBond(id, n) { this.bond[id] = Math.max(0, Math.min(100, (this.bond[id] || 0) + n)); this.save(); return this.bond[id]; }
  stageOf(id) { return bondName(this.bondOf(id), this.spouses.indexOf(id) >= 0); }
}

/* 話しかけた時の台詞（絆の段階ごと） */
export function talkLine(def, bond, married) {
  const nm = def.name;
  if (def.g === 'm') return [def.intro, '俺は' + nm + '。' + def.title + 'だ。よろしく頼む', '背中は任せろ', '次はどこへ潜る？ 付き合うぜ'][Math.floor(Math.random() * 4)];
  if (married) return ['おかえりなさい。今日も無事でよかった', 'ねえ、次の休みはどこへ行こうか', 'あなたと一緒になれて、本当に幸せ'][Math.floor(Math.random() * 3)];
  if (bond >= 70) return ['……あなたの隣にいると、落ち着くの', '次の冒険も、一緒に行ってくれる？', 'ずっとこうしていられたらいいのに'][Math.floor(Math.random() * 3)];
  if (bond >= 35) return ['この前はありがとう。楽しかった！', 'あなたのこと、もっと知りたいな', '一緒だと、どんな敵も怖くない'][Math.floor(Math.random() * 3)];
  return [def.intro, '私は' + nm + '。' + def.title + 'よ。よろしくね', '冒険者なの？ 頼りにしてるわ'][Math.floor(Math.random() * 3)];
}
