/* ══════════════════════════════════════════════════════════════
   stats.js ── 能力値と成長
     Lv.1〜999。上がるたびに割り振り点を得る。
     HP／MP／ATK／DEF／MATK／MDEF／AGI／CRI／DEX／LUK
   ══════════════════════════════════════════════════════════════ */

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
    this.job = opts.job || '';
    this.bias = opts.bias || {};     // 職業ごとの伸びの偏り
  }

  /** 割り振り前の素の値 */
  base(k) {
    const b = (BASE[k] || 3) * (this.bias[k] != null ? this.bias[k] : 1);
    const g = (GROWTH[k] || 0.2) * (this.bias[k] != null ? this.bias[k] : 1);
    return Math.floor(b + g * (this.lv - 1));
  }

  /** 割り振りを含めた実際の値 */
  get(k) {
    return this.base(k) + (this.alloc[k] || 0);
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
  get maxHp()    { return 3 + Math.floor(this.get('HP') / 14); }        // 心の数
  get maxMp()    { return 20 + this.get('MP') * 2; }
  get atkMul()   { return 1 + this.get('ATK') * 0.035; }
  get matkMul()  { return 1 + this.get('MATK') * 0.04; }
  get defCut()   { return Math.min(0.78, this.get('DEF') * 0.0045); }   // 物理の軽減（上限78%）
  get mdefCut()  { return Math.min(0.78, this.get('MDEF') * 0.0045); }  // 霊的の軽減
  // 速さは上限を設ける（初期の2.1倍まで）。振りすぎても壊れないように
  get speedMul() { return Math.min(2.1, 1 + this.get('AGI') * 0.009); }
  get evade()    { return Math.min(0.35, this.get('AGI') * 0.0011); }   // 完全回避
  get mpRegen()  { return 1.2 + this.get('MP') * 0.03; }                // 毎秒の霊力回復
  get critRate() { return Math.min(0.6, this.get('CRI') * 0.008 + this.get('LUK') * 0.002); }
  get critMul()  { return 1.8 + this.get('LUK') * 0.01; }
  get chargeMul(){ return 1 + this.get('DEX') * 0.012; }                // 溜めが速くなる
  get dropMul()  { return 1 + this.get('LUK') * 0.01; }

  toJSON() {
    return { name: this.name, lv: this.lv, exp: this.exp, points: this.points,
      alloc: this.alloc, job: this.job };
  }
  static fromJSON(o, opts) {
    const c = new Character(o.name || '—', opts);
    c.lv = Math.max(1, Math.min(MAX_LV, o.lv || 1));
    c.exp = o.exp || 0;
    c.points = o.points || 0;
    c.job = o.job || (opts && opts.job) || '';
    STAT_KEYS.forEach(k => { c.alloc[k] = (o.alloc && o.alloc[k]) || 0; });
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
