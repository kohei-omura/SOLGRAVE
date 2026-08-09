/* ══════════════════════════════════════════════════════════════
   stats.js ── 能力値と成長
     Lv.1〜999。上がるたびに割り振り点を得る。
     HP／MP／ATK／DEF／MATK／MDEF／AGI／CRI／DEX／LUK
   ══════════════════════════════════════════════════════════════ */

import { JOBS, SKILLS, GEAR, canLearn } from './jobs.js';

export const MAX_LV = 999;
export const POINTS_PER_LV = 5;

export const STAT_KEYS = ['HP', 'MP', 'ATK', 'DEF', 'MATK', 'MDEF', 'AGI', 'CRI', 'DEX', 'LUK'];

export const STAT_INFO = {
  HP:   { name: '体力',   desc: '傷を受けられる余地。1点で最大HPが少し増える' },
  MP:   { name: '霊力',   desc: '術の元手。技を使うために要る' },
  ATK:  { name: '攻撃',   desc: '陽光弾の威力' },
  DEF:  { name: '守り',   desc: '受ける傷を減らす' },
  MATK: { name: '霊撃',   desc: 'チャージ弾と術の威力' },
  MDEF: { name: '霊防',   desc: '呪いや霊的な攻撃を和らげる' },
  AGI:  { name: '敏捷',   desc: '動きの速さと回避' },
  CRI:  { name: '会心',   desc: '会心の一撃が出る割合' },
  DEX:  { name: '技巧',   desc: 'チャージの速さと命中' },
  LUK:  { name: '幸運',   desc: '拾い物の質と会心の伸び' }
};

/* 素の伸び方（職業ごとに後で差をつける） */
const BASE = { HP: 12, MP: 6, ATK: 5, DEF: 4, MATK: 4, MDEF: 4, AGI: 5, CRI: 3, DEX: 4, LUK: 3 };
const GROWTH = { HP: 0.9, MP: 0.45, ATK: 0.32, DEF: 0.28, MATK: 0.26, MDEF: 0.26, AGI: 0.3, CRI: 0.14, DEX: 0.24, LUK: 0.16 };

/** その水準に上がるのに要る経験値 */
export function expToNext(lv) {
  if (lv >= MAX_LV) return Infinity;
  return Math.floor(18 * Math.pow(lv, 1.85) + 22 * lv + 30);
}

export class Character {
  constructor(name, opts) {
    opts = opts || {};
    this.name = name;
    this.lv = 1;
    this.exp = 0;
    this.points = 0;                 // 未割り振り
    this.alloc = {};                 // 割り振った点
    STAT_KEYS.forEach(k => { this.alloc[k] = 0; });
    this.job = opts.job || '';       // 職の id
    this.bias = opts.bias || {};
    this.learned = {};               // 覚えた技
    this.skillPts = 0;               // 技の点
    this.gear = { weapon: '', armor: '', charm: '' };
    this.bag = [];                   // 持ち物（装備の id）
  }

  /** 割り振り前の素の値 */
  /** 職による伸びの倍率 */
  _bias(k) {
    const j = JOBS[this.job];
    const jb = (j && j.bias && j.bias[k] != null) ? j.bias[k] : 1;
    const ob = (this.bias && this.bias[k] != null) ? this.bias[k] : 1;
    return jb * ob;
  }
  base(k) {
    const m = this._bias(k);
    const b = (BASE[k] || 3) * m;
    const g = (GROWTH[k] || 0.2) * m;
    return Math.floor(b + g * (this.lv - 1));
  }
  /** 装備による加算 */
  gearMod(k) {
    let n = 0;
    Object.keys(this.gear).forEach(sl => {
      const id = this.gear[sl];
      const g = id && GEAR[id];
      if (g && g.mods && g.mods[k]) n += g.mods[k];
    });
    return n;
  }
  /** 覚えた技による加算・倍率 */
  skillMod(kind) {
    let add = 0, mul = 1;
    Object.keys(this.learned).forEach(id => {
      const sk = SKILLS[id];
      if (!sk || !sk.effect) return;
      const e = sk.effect;
      if (kind === 'atk'   && e.atk)   mul += e.atk;
      if (kind === 'matk'  && e.matk)  mul += e.matk;
      if (kind === 'def'   && e.def && e.def < 1) mul += e.def;
      if (kind === 'DEF'   && e.def && e.def >= 1) add += e.def;
      if (kind === 'MDEF'  && e.mdef)  add += e.mdef;
      if (kind === 'speed' && e.speed) mul += e.speed;
      if (kind === 'crit'  && e.crit)  add += e.crit;
      if (kind === 'critMul' && e.critMul) add += e.critMul;
      if (kind === 'evade' && e.evade) add += e.evade;
      if (kind === 'guard' && e.guard) mul *= e.guard;
      if (kind === 'mpRegen' && e.mpRegen) mul *= e.mpRegen;
      if (kind === 'hp'    && e.hp)    mul += e.hp;
      if (kind === 'mp'    && e.mp)    mul += e.mp;
      if (kind === 'dex'   && e.dex)   mul += e.dex;
      if (kind === 'fireRate' && e.fireRate) mul *= e.fireRate;
    });
    return { add, mul };
  }
  /** 技を覚える */
  learn(id) {
    const c = canLearn(id, this.lv, this.learned);
    if (!c.ok) return c;
    if (this.skillPts < 1) return { ok: false, why: '技の点が足りない' };
    this.skillPts--;
    this.learned[id] = true;
    return { ok: true, why: '' };
  }
  /** 装備する */
  equip(id) {
    const g = GEAR[id];
    if (!g) return false;
    if (this.bag.indexOf(id) < 0) return false;
    this.gear[g.slot] = id;
    return true;
  }
  /** 拾う */
  pick(id) { if (GEAR[id] && this.bag.indexOf(id) < 0) { this.bag.push(id); return true; } return false; }

  /** 割り振りを含めた実際の値 */
  get(k) {
    let v = this.base(k) + (this.alloc[k] || 0) + this.gearMod(k);
    if (k === 'DEF')  v += this.skillMod('DEF').add;
    if (k === 'MDEF') v += this.skillMod('MDEF').add;
    return Math.max(0, Math.round(v));
  }

  /** 全能力値をまとめて返す */
  all() {
    const o = {};
    STAT_KEYS.forEach(k => { o[k] = this.get(k); });
    return o;
  }

  /** 経験値を得る。上がった段数を返す */
  gain(n) {
    if (this.lv >= MAX_LV) return 0;
    this.exp += Math.max(0, Math.floor(n));
    let ups = 0;
    while (this.lv < MAX_LV && this.exp >= expToNext(this.lv)) {
      this.exp -= expToNext(this.lv);
      this.lv++;
      this.points += POINTS_PER_LV;
      if (this.lv % 2 === 0) this.skillPts++;   // 2段ごとに技の点
      ups++;
      if (ups > 400) break;          // 一度に上がりすぎるのを防ぐ
    }
    return ups;
  }

  /** 1点振る */
  spend(k, n) {
    n = n || 1;
    if (STAT_KEYS.indexOf(k) < 0) return false;
    if (this.points < n) return false;
    this.points -= n;
    this.alloc[k] = (this.alloc[k] || 0) + n;
    return true;
  }

  /** 割り振りをやり直す */
  reset() {
    let back = 0;
    STAT_KEYS.forEach(k => { back += this.alloc[k] || 0; this.alloc[k] = 0; });
    this.points += back;
    return back;
  }

  /* ── 実際の効果に変換する ── */
  get maxHp()    { return 3 + Math.floor(this.get('HP') * this.skillMod('hp').mul / 14); }
  get maxMp()    { return Math.round((20 + this.get('MP') * 2) * this.skillMod('mp').mul); }
  get atkMul()   { return (1 + this.get('ATK') * 0.035) * this.skillMod('atk').mul; }
  get matkMul()  { return (1 + this.get('MATK') * 0.04) * this.skillMod('matk').mul; }
  get defCut()   { return Math.min(0.78, this.get('DEF') * 0.0045); }   // 物理の軽減（上限78%）
  get mdefCut()  { return Math.min(0.78, this.get('MDEF') * 0.0045); }  // 霊的の軽減
  // 速さは上限を設ける（初期の2.1倍まで）。振りすぎても壊れないように
  get speedMul() { return Math.min(2.4, (1 + this.get('AGI') * 0.009) * this.skillMod('speed').mul); }
  get evade()    { return Math.min(0.45, this.get('AGI') * 0.0011 + this.skillMod('evade').add); }
  get mpRegen()  { return (1.2 + this.get('MP') * 0.03) * this.skillMod('mpRegen').mul; }
  get critRate() { return Math.min(0.7, this.get('CRI') * 0.008 + this.get('LUK') * 0.002 + this.skillMod('crit').add); }
  get critMul()  { return 1.8 + this.get('LUK') * 0.01 + this.skillMod('critMul').add; }
  get chargeMul(){ return (1 + this.get('DEX') * 0.012) * this.skillMod('dex').mul; }
  get dropMul()  { return 1 + this.get('LUK') * 0.01; }
  get guardMul() { return this.skillMod('guard').mul; }
  get fireRateMul() { return this.skillMod('fireRate').mul; }
  /** 覚えている技の一覧 */
  activeSkills() {
    return Object.keys(this.learned).filter(id => SKILLS[id] && SKILLS[id].kind === 'active');
  }

  toJSON() {
    return { name: this.name, lv: this.lv, exp: this.exp, points: this.points,
      alloc: this.alloc, job: this.job,
      learned: this.learned, skillPts: this.skillPts, gear: this.gear, bag: this.bag };
  }
  static fromJSON(o, opts) {
    const c = new Character(o.name || '—', opts);
    c.lv = Math.max(1, Math.min(MAX_LV, o.lv || 1));
    c.exp = o.exp || 0;
    c.points = o.points || 0;
    c.job = o.job || (opts && opts.job) || '';
    STAT_KEYS.forEach(k => { c.alloc[k] = (o.alloc && o.alloc[k]) || 0; });
    c.learned = o.learned || {};
    c.skillPts = o.skillPts || 0;
    c.gear = Object.assign({ weapon: '', armor: '', charm: '' }, o.gear || {});
    c.bag = Array.isArray(o.bag) ? o.bag : [];
    return c;
  }
}

/* ── 敵から得られる経験値 ── */
export function expOf(kind, isBoss) {
  if (isBoss) return 900;
  return [16, 22, 34, 20][kind] || 18;
}

/* ── 保存 ── */
const PARTY_KEY = 'solgrave_party';
export const Party = {
  save(party) {
    try {
      const o = {};
      Object.keys(party).forEach(k => { o[k] = party[k].toJSON(); });
      localStorage.setItem(PARTY_KEY, JSON.stringify(o));
    } catch (e) {}
  },
  load(defs) {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(PARTY_KEY) || 'null'); } catch (e) {}
    const out = {};
    Object.keys(defs).forEach(k => {
      const d = defs[k];
      out[k] = (raw && raw[k])
        ? Character.fromJSON(raw[k], d)
        : new Character(d.name, d);
    });
    return out;
  },
  clear() { try { localStorage.removeItem(PARTY_KEY); } catch (e) {} }
};
