/* audio.js ── 外部音源なし。Web Audio で合成する */
/* 端末に入っている読み上げ機能で台詞を喋らせる。
   外部音源を持たずに声を出せる唯一の手段。iOSも対応。 */
/* ── 声の設計 ──────────────────────────────
   読み上げ機能で操れるのは「声・速さ・高さ・音量」だけ。
   そこで台詞を句に割り、句ごとに速さと高さを変えて
   抑揚（演技）を作る。間（ま）も挟んで生っぽさを出す。
─────────────────────────────────────── */

/* 人物ごとの地の声 */
/* ── 声の型 ──
   g：男 m／女 f、prefer：合う声の名前（端末に入っていれば使う）、pitch／rate：高さと速さ。
   端末の日本語の声（iPhone：Kyoko・O-Ren・Otoya・Hattori、Eddy・Flo・Grandma・Grandpa・Reed・Rocko・Sandy・Shelley など、
   Windows：Haruka・Ayumi・Sayaka・Nanami・Ichiro・Keita、Chrome：Google 日本語）を人ごとに振り分け、
   同じ声しか無い端末でも高さ・速さ・揺らぎで一人ずつ違う声に聞こえるようにする。 */
const VOICE_PROFILE = {
  // 主人公：やんちゃで元気な少年。高めで速く、跳ねるように
  hero:  { g: 'm', pitch: 1.32, rate: 1.16, jitterP: 0.07, jitterR: 0.06, prefer: /Otoya|Hattori|Keita|Reed/i },
  // 日和：芯のある豊かな声。高すぎず、ゆっくりめで体温を出す
  miko:  { g: 'f', pitch: 1.12, rate: 0.94, jitterP: 0.04, jitterR: 0.03, prefer: /O-?Ren|Kyoko|Nanami|Haruka/i },
  // 街の人々
  shop:     { g: 'f', pitch: 1.22, rate: 1.12, prefer: /Sandy|Kyoko|Ayumi/i },            // 道具屋・陽子：明るい商売声
  inn:      { g: 'f', pitch: 1.38, rate: 1.04, prefer: /Shelley|Flo|Sayaka/i },           // 宿の娘・芹：幼さの残る声
  smith:    { g: 'm', pitch: 0.62, rate: 0.9,  prefer: /Grandpa|Rocko|Ichiro/i },         // 鍛冶・鉄爺：太くしゃがれた声
  kid:      { g: 'm', pitch: 1.8,  rate: 1.24, prefer: /Eddy|Otoya/i },                   // 豆太：元気な男の子
  girl1:    { g: 'f', pitch: 1.5,  rate: 1.06, prefer: /Flo|Kyoko/i },                    // 花売り・燐：ふわりと甘い
  girl2:    { g: 'f', pitch: 1.18, rate: 0.9,  prefer: /O-?Ren|Haruka/i },                // 水汲み・澪：落ち着いた声
  old:      { g: 'm', pitch: 0.72, rate: 0.78, prefer: /Grandpa|Hattori|Ichiro/i },       // 語り部・宗庵：ゆったり低い
  friend:   { g: 'm', pitch: 0.98, rate: 1.1,  prefer: /Reed|Hattori|Keita/i },           // 狩人仲間・颯：兄貴分
  guest:    { g: 'm', pitch: 0.88, rate: 1.0,  prefer: /Rocko|Otoya/i },                  // 旅の薬売り
  traveler: { g: 'f', pitch: 1.3,  rate: 1.1,  prefer: /Sandy|Sayaka/i },                 // 行商の娘・紬
  cook:     { g: 'f', pitch: 0.92, rate: 1.0,  prefer: /Grandma|Kyoko|Ayumi/i },          // 女将・千代：貫禄
  appr:     { g: 'm', pitch: 1.14, rate: 1.18, prefer: /Eddy|Keita/i },                   // 弟子・鋼太：勢いのある若者
  scholar:  { g: 'f', pitch: 1.1,  rate: 0.96, prefer: /Shelley|Nanami/i },               // 書生・蛍：知的で静か
  mother:   { g: 'f', pitch: 1.0,  rate: 0.92, prefer: /Kyoko|Haruka/i },                 // 母・結：やわらかい
  child:    { g: 'f', pitch: 1.9,  rate: 1.15, prefer: /Flo|Sandy/i },                    // 娘・小春：小さな女の子
  gp:       { g: 'm', pitch: 0.66, rate: 0.82, prefer: /Grandpa|Ichiro/i },               // 祖父・源蔵
  farmer:   { g: 'm', pitch: 0.84, rate: 0.96, prefer: /Rocko|Otoya/i },                  // 百姓・茂：素朴
  weaver:   { g: 'f', pitch: 1.06, rate: 0.88, prefer: /Grandma|O-?Ren|Ayumi/i },         // 機織り・綾
  boy:      { g: 'm', pitch: 1.7,  rate: 1.2,  prefer: /Eddy|Reed/i }                     // 息子・太一
};
const MALE_RE = /Otoya|Hattori|Ichiro|Keita|Eddy|Grandpa|Reed|Rocko|Daichi|Naoki|Takumi|Male|男/i;
const FEMALE_RE = /Kyoko|O-?Ren|Haruka|Ayumi|Sayaka|Nanami|Mizuki|Flo\b|Grandma|Sandy|Shelley|Female|女/i;
/** 名前から決まった数を作る（同じ人はいつも同じ声になる） */
function _hash(str) { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }

export class Voice {
  constructor() {
    this.enabled = true;
    this.volume = 1.0;
    this.unlocked = false;
    this.voices = [];
    this.jaFemale = null;
    this.jaMale = null;
    this.lastError = '';
    this.supported = (typeof window !== 'undefined' && 'speechSynthesis' in window);
    this._queue = [];
    this._pick();
    try {
      if (this.supported && speechSynthesis.addEventListener) {
        speechSynthesis.addEventListener('voiceschanged', () => this._pick());
      }
      let n = 0;
      const t = setInterval(() => { this._pick(); if (++n > 12 || this.voices.length) clearInterval(t); }, 400);
    } catch (e) {}
  }

  _pick() {
    if (!this.supported) return;
    try {
      const list = speechSynthesis.getVoices() || [];
      if (!list.length) return;
      this.voices = list;
      const ja = list.filter(v => /^ja/i.test(v.lang) || /Japanese|日本/i.test(v.name));
      this.ja = ja;
      this.poolM = ja.filter(v => MALE_RE.test(v.name));
      this.poolF = ja.filter(v => FEMALE_RE.test(v.name) || (!MALE_RE.test(v.name)));
      this._cache = {};
      this.jaFemale = this._voiceFor('miko');
      this.jaMale   = this._voiceFor('hero');
    } catch (e) { this.lastError = String(e); }
  }

  unlock() {
    if (!this.supported || this.unlocked) return this.unlocked;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0.01; u.rate = 2; u.lang = 'ja-JP';
      speechSynthesis.speak(u);
      this.unlocked = true;
      this._pick();
    } catch (e) { this.lastError = String(e); }
    return this.unlocked;
  }

  /** 人ごとの声：合う名前の声 → 同じ性別の声を名前で振り分け → どれか日本語の声 */
  _voiceFor(who) {
    if (!this.ja || !this.ja.length) return null;
    this._cache = this._cache || {};
    if (this._cache[who] !== undefined) return this._cache[who];
    const prof = VOICE_PROFILE[who] || VOICE_PROFILE.hero;
    let v = null;
    const good = this.ja.filter(x => prof.prefer && prof.prefer.test(x.name));
    if (good.length) {
      // 名前の並び順に合わせて、最初に挙げた声ほど優先する
      const src = String(prof.prefer.source).split('|').map(t => t.replace(/[\\^$()]/g, ''));
      good.sort((a, b) => src.findIndex(t => new RegExp(t, 'i').test(a.name)) - src.findIndex(t => new RegExp(t, 'i').test(b.name)));
      // いちばん合う声の、高音質版（Enhanced／Premium）があればそちら
      const top = src.find(t => new RegExp(t, 'i').test(good[0].name));
      const same = good.filter(x => new RegExp(top, 'i').test(x.name));
      v = same.find(x => /Enhanced|Premium|拡張|高品質/i.test(x.name)) || good[0];
    } else {
      const pool = prof.g === 'f' ? this.poolF : this.poolM;
      if (pool && pool.length) v = pool[_hash(who) % pool.length];
      else v = this.ja[_hash(who) % this.ja.length];
    }
    this._cache[who] = v;
    return v;
  }

  /** 1句を喋る（内部用） */
  _utter(text, who, pitch, rate, vol, delay) {
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'ja-JP';
    // 声の指定に失敗しても、台詞そのものは喋れるようにする
    try { const v = this._voiceFor(who); if (v) u.voice = v; } catch (e) { this.lastError = String(e); }
    u.pitch = Math.max(0, Math.min(2, pitch));
    u.rate = Math.max(0.1, Math.min(10, rate));
    u.volume = Math.max(0, Math.min(1, vol));
    u.onerror = (e) => { this.lastError = (e && e.error) || 'error'; };
    if (delay > 0) setTimeout(() => { try { speechSynthesis.speak(u); } catch (e) {} }, delay);
    else speechSynthesis.speak(u);
  }

  /**
   * 台詞を喋る。
   * @param who 'hero' | 'miko'
   * @param opts.style 'normal' | 'shout'（決め台詞）| 'soft'（囁き）| 'hurt'
   * @param opts.segments 句ごとに抑揚を変える指定 [{t:'文', p:高さ倍率, r:速さ倍率, gap:後の間ms}]
   */
  say(text, who, opts) {
    if (!this.enabled || !this.supported) return false;
    opts = opts || {};
    try {
      if (!this.unlocked) this.unlock();
      if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();

      const prof = VOICE_PROFILE[who] || VOICE_PROFILE.hero;
      // 毎回わずかに揺らして機械らしさを消す
      const jp = 1 + (Math.random() - 0.5) * (prof.jitterP ?? 0.04);
      const jr = 1 + (Math.random() - 0.5) * (prof.jitterR ?? 0.03);
      let basePitch = prof.pitch * jp;
      let baseRate = prof.rate * jr;
      let baseVol = this.volume;

      // 言い回しの型
      if (opts.style === 'shout') {
        // 一言で場を支配する声：低く、ぐっと遅く、目一杯
        basePitch = prof.pitch * 0.62;
        baseRate = prof.rate * 0.58;
        baseVol = Math.min(1, this.volume * 1.0);
      } else if (opts.style === 'soft') {
        basePitch = prof.pitch * 1.02; baseRate = prof.rate * 0.86; baseVol = this.volume * 0.8;
      } else if (opts.style === 'hurt') {
        basePitch = prof.pitch * 1.22; baseRate = prof.rate * 1.25;
      }

      const segs = opts.segments;
      if (segs && segs.length) {
        let delay = 0;
        segs.forEach(sg => {
          this._utter(sg.t, who, basePitch * (sg.p || 1), baseRate * (sg.r || 1), baseVol, delay);
          // だいたいの発話時間＋指定の間
          delay += (String(sg.t).length * 105) / (baseRate * (sg.r || 1)) + (sg.gap || 0);
        });
      } else {
        this._utter(text, who, basePitch, baseRate, baseVol, 0);
      }
      return true;
    } catch (e) { this.lastError = String(e); return false; }
  }

  status() {
    return {
      supported: this.supported, unlocked: this.unlocked,
      voices: this.voices.length, ja: !!(this.jaFemale || this.jaMale),
      jaName: (this.jaFemale && this.jaFemale.name) || (this.jaMale && this.jaMale.name) || 'なし',
      enabled: this.enabled, error: this.lastError
    };
  }
  stop() { try { if (this.supported) speechSynthesis.cancel(); } catch (e) {} }
  setEnabled(on) { this.enabled = !!on; if (!on) this.stop(); }
  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); }
}

/* ── 趣と家ごとの調べ（生成の手掛かり） ──
   drone: 持続音 [周波数, 波形]　root: 旋律の主音　scale: 音階（半音）
   beat: 拍の秒　mel: 旋律を鳴らす間隔　inst: 旋律の音色
   chord: 和音（半音の組）と鳴らす間隔　perc: 打楽器の型（x低 o中 h高 a金床） */
const BGM_DEF = {
  forest:  { beat: 0.8,  drone: [[55, 'triangle'], [82.4, 'sine']], lp: 520, root: 220, scale: [0, 3, 5, 7, 10, 12], mel: 3, inst: 'sine', vol: 0.05, perc: '....h...', wind: 5 },
  palace:  { beat: 0.42, drone: [[55, 'sawtooth']], lp: 380, root: 220, scale: [0, 2, 3, 5, 7, 8, 11, 12], mel: 1, inst: 'square', vol: 0.028, chord: [[0, 3, 7], [5, 8, 12], [7, 11, 14], [0, 3, 7]], chordEvery: 6, perc: 'x..o..' },
  frost:   { beat: 1.1,  drone: [[110, 'sine'], [164.8, 'sine']], lp: 900, root: 880, scale: [0, 2, 4, 7, 9, 12], mel: 1, inst: 'sine', vol: 0.03, bells: true, wind: 4 },
  volcano: { beat: 0.38, drone: [[36.7, 'sawtooth'], [55, 'sawtooth']], lp: 260, root: 110, scale: [0, 1, 4, 5, 7, 8, 10], mel: 4, inst: 'sawtooth', vol: 0.045, perc: 'x.x.o.x.xxo.x.o.' },
  grass:   { beat: 0.7,  drone: [[98, 'sine']], lp: 700, root: 392, scale: [0, 2, 4, 7, 9, 12, 14], mel: 2, inst: 'triangle', vol: 0.045, crickets: true },
  sky:     { beat: 1.0,  drone: [[130.8, 'sine'], [196, 'sine']], lp: 1200, root: 523, scale: [0, 4, 7, 11, 14, 16], mel: 1, inst: 'triangle', vol: 0.035, chord: [[0, 4, 7, 11], [5, 9, 12, 16]], chordEvery: 8 },
  abyss:   { beat: 1.3,  drone: [[36.7, 'sawtooth'], [51.9, 'sawtooth'], [38.9, 'triangle']], lp: 240, root: 185, scale: [0, 1, 6, 7, 11], mel: 3, inst: 'sine', vol: 0.04, perc: 'x.......' },
  desert:  { beat: 0.5,  drone: [[73.4, 'sawtooth']], lp: 420, root: 293.7, scale: [0, 1, 4, 5, 7, 8, 10, 12], mel: 2, inst: 'triangle', vol: 0.045, perc: 'x..o.xo.' },
  void:    { beat: 0.6,  drone: [[41.2, 'sawtooth'], [43.7, 'sawtooth']], lp: 300, root: 246.9, scale: [0, 1, 3, 6, 7, 9, 10], mel: 2, inst: 'square', vol: 0.03, perc: 'x...o...x.x.o...' },
  shop:    { beat: 0.34, drone: [], root: 523, scale: [0, 2, 4, 7, 9, 12], mel: 1, inst: 'triangle', vol: 0.045, chord: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], chordEvery: 8, perc: 'x.h.o.h.' },
  inn:     { beat: 0.72, drone: [[130.8, 'sine']], lp: 600, root: 392, scale: [0, 2, 5, 7, 9, 12], mel: 1, inst: 'triangle', vol: 0.045, koto: true },
  smith:   { beat: 0.55, drone: [[65.4, 'sawtooth']], lp: 300, root: 196, scale: [0, 3, 5, 7, 10], mel: 4, inst: 'sine', vol: 0.04, perc: 'a...a.a.' },
  home:    { beat: 0.6,  drone: [], root: 659, scale: [0, 2, 4, 5, 7, 9, 12], mel: 1, inst: 'sine', vol: 0.04, chord: [[0, 4, 7], [5, 9, 12]], chordEvery: 8 },
  lib:     { beat: 1.4,  drone: [[87.3, 'sine']], lp: 500, root: 349, scale: [0, 2, 3, 5, 7, 8, 10], mel: 1, inst: 'sine', vol: 0.035, chord: [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 10, 14]], chordEvery: 4 }
};

/* ── 台詞集（抑揚つき） ── */
export const LINES = {
  solar: { who: 'hero', style: 'shout',
    segments: [ { t: 'たい', p: 1.0, r: 0.9, gap: 40 }, { t: 'よォ！', p: 0.88, r: 0.62, gap: 0 } ] },
  levelUp: { who: 'hero',
    segments: [ { t: 'よっしゃ！', p: 1.12, r: 1.2, gap: 90 }, { t: '力が湧いてきた', p: 1.0, r: 1.05 } ] },
  key: { who: 'hero',
    segments: [ { t: 'お、', p: 1.15, r: 1.3, gap: 130 }, { t: '鍵見っけ！', p: 1.08, r: 1.15 } ] },
  bossIn: { who: 'hero',
    segments: [ { t: 'ここが最深部か', p: 0.95, r: 1.0, gap: 220 }, { t: '……行くぞ！', p: 1.05, r: 0.92 } ] },
  chest: { who: 'hero', segments: [ { t: 'やった、お宝だ！', p: 1.1, r: 1.18 } ] },
  hurt:  { who: 'hero', style: 'hurt', segments: [ { t: 'いっつ！', p: 1.0, r: 1.0 } ] },
  heal:  { who: 'miko',
    segments: [ { t: 'いま、', p: 1.0, r: 0.9, gap: 150 }, { t: '祓います', p: 0.96, r: 0.88 } ] },
  healCrit: { who: 'miko',
    segments: [ { t: '大祓い', p: 1.06, r: 0.82, gap: 120 }, { t: '——！', p: 0.94, r: 0.7 } ] },
  mikoHurt: { who: 'miko', style: 'hurt', segments: [ { t: 'きゃっ', p: 1.15, r: 1.3 } ] },
  mikoWorry: { who: 'miko', style: 'soft',
    segments: [ { t: '無理は、', p: 1.0, r: 0.88, gap: 170 }, { t: 'しないでくださいね', p: 0.97, r: 0.9 } ] }
};

export class Audio {
  constructor() {
    this.ctx = null; this.master = null;
    this.volume = 0.6; this.muted = false;
    this._bgmTimer = 0; this._step = 0;
  }
  /* 最初のタップの同期ハンドラ内で呼ぶこと */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume * 0.5;
      this.master.connect(this.ctx.destination);
      // 無音を1回鳴らして解錠
      const b = this.ctx.createBuffer(1, 1, 22050);
      const s = this.ctx.createBufferSource();
      s.buffer = b; s.connect(this.master); s.start(0);
      return true;
    } catch (e) { return false; }
  }
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume * 0.5;
  }
  setMute(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume * 0.5;
  }
  _noise(dur, vol, lpFrom, lpTo, delay) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t0 = c.currentTime + (delay || 0);
    const n = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(lpFrom || 8000, t0);
    lp.frequency.exponentialRampToValueAtTime(Math.max(80, lpTo || 400), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(lp); lp.connect(g); g.connect(this.master); src.start(t0);
  }
  _tone(f, dur, type, vol, delay, slideTo) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol || 0.12, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  sfx(kind) {
    if (!this.ctx || this.muted) return;
    switch (kind) {
      case 'shot':    this._noise(0.14, 0.22, 7000, 500); this._tone(680, 0.08, 'square', 0.07); break;
      case 'charge':  this._tone(180, 0.9, 'sawtooth', 0.08, 0, 900); break;
      case 'beam':    this._noise(0.4, 0.3, 9000, 300); this._tone(120, 0.5, 'sawtooth', 0.16, 0, 60); break;
      case 'ash':     this._noise(0.5, 0.16, 11000, 900); break;
      case 'hit':     this._tone(90, 0.2, 'square', 0.2); this._noise(0.12, 0.14, 2000, 200); break;
      case 'hurt':    this._tone(160, 0.3, 'sawtooth', 0.2, 0, 60); this._noise(0.2, 0.2, 1200, 120); break;
      case 'empty':   this._tone(220, 0.09, 'square', 0.08); this._tone(160, 0.09, 'square', 0.07, 0.09); break;
      case 'refill':  [440, 660, 880].forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.12, i * 0.09)); break;
      case 'seal':    this._tone(320, 0.3, 'triangle', 0.14); this._tone(480, 0.4, 'sine', 0.1, 0.12); break;
      case 'good':    this._tone(880, 0.14, 'square', 0.13); this._tone(1320, 0.18, 'triangle', 0.11, 0.1); break;
      case 'bad':     this._tone(140, 0.3, 'sawtooth', 0.14, 0, 70); break;
      case 'pile':    this._noise(0.3, 0.32, 3000, 90); this._tone(70, 0.35, 'sine', 0.24); break;
      case 'purify':  [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone(f, 0.7, 'triangle', 0.12, i * 0.13)); break;
      case 'slash':   this._noise(0.16, 0.14, 9000, 1600); this._tone(420, 0.1, 'triangle', 0.05, 0, 900); break;
      case 'slashHit': this._noise(0.2, 0.22, 7000, 700); this._tone(160, 0.14, 'square', 0.1); break;
      case 'arrow':   this._noise(0.22, 0.12, 6000, 2400); this._tone(900, 0.12, 'sine', 0.05, 0, 400); break;
      case 'strum':   [392, 494, 587].forEach((f, i) => this._tone(f, 0.5, 'triangle', 0.07, i * 0.03)); break;
      case 'throw':   this._noise(0.3, 0.12, 5000, 1200); this._tone(300, 0.25, 'sawtooth', 0.04, 0, 700); break;
      case 'phase':   this._noise(0.6, 0.2, 6000, 200); this._tone(110, 0.8, 'sawtooth', 0.14, 0, 440); break;
    }
  }
  /** 場面ごとの調べ。'surface' 地上／'dungeon' 地下／'boss' 決戦 */
  startBGM(kind) {
    kind = kind || 'dungeon';
    if (this._bgmKind === kind && this._bgmTimer) return;
    this.stopBGM();
    this._bgmKind = kind;
    if (!this.ctx) return;
    this._step = 0;
    this._drone = [];

    if (kind === 'surface') {
      // ── 地上：明るく澄んだ調べ（長調・軽やか） ──
      const beat = 0.62;
      const scale = [0, 2, 4, 7, 9, 12, 14, 16];      // 長音階
      const root = 262;                                 // ド
      const chords = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]];
      const tick = () => {
        if (this.muted || document.hidden) return;
        const s = this._step;
        // 和音を柔らかく
        if (s % 8 === 0) {
          const ch = chords[(s / 8) % chords.length];
          ch.forEach((semi, i) => this._tone(root / 2 * Math.pow(2, semi / 12), beat * 7, 'triangle', 0.05, i * 0.02));
        }
        // 旋律
        if (s % 2 === 0) {
          const n = scale[Math.floor((Math.sin(s * 0.7) * 0.5 + 0.5) * (scale.length - 1))];
          this._tone(root * Math.pow(2, n / 12), beat * 1.3, 'sine', 0.048);
        }
        // 軽い刻み
        if (s % 4 === 2) this._noise(0.06, 0.035, 6000, 2400);
        if (s % 8 === 6) this._tone(root * 2, beat * 0.5, 'triangle', 0.035);
        this._step++;
      };
      tick();
      this._bgmTimer = setInterval(tick, beat * 1000);
      return;
    }

    if (kind === 'sacred') {
      // ── 聖域：神聖で澄んだ調べ（聖歌のような持続と鈴） ──
      const beat = 1.15;
      const root = 261.6;
      const chant = [0, 4, 7, 11, 12, 7, 4, 0];
      try {
        [root / 4, root / 4 * 1.5].forEach((fr, i) => {
          const o = this.ctx.createOscillator(), g = this.ctx.createGain();
          o.type = 'sine'; o.frequency.value = fr; g.gain.value = 0.06;
          o.connect(g); g.connect(this.master); o.start();
          this._drone.push({ o, g });
        });
      } catch (e) {}
      const tick = () => {
        if (this.muted || document.hidden) return;
        const s = this._step;
        // 澄んだ和音
        if (s % 4 === 0) [0, 4, 7].forEach((semi, i) =>
          this._tone(root * Math.pow(2, semi / 12), beat * 3.6, 'sine', 0.05, i * 0.05));
        // 聖歌のような旋律
        this._tone(root * 2 * Math.pow(2, chant[s % chant.length] / 12), beat * 1.6, 'triangle', 0.045);
        // 鈴
        if (s % 8 === 4) { this._tone(2093, 0.9, 'sine', 0.045); this._tone(3136, 0.7, 'sine', 0.03, 0.06); }
        // 微かな風
        if (s % 6 === 3) this._noise(1.6, 0.022, 3200, 900);
        this._step++;
      };
      tick();
      this._bgmTimer = setInterval(tick, beat * 1000);
      return;
    }

    if (kind === 'boss') {
      // ── 決戦：ヒーローものの燃える調べ（力強い行進） ──
      const beat = 0.32;
      const root = 98;                                  // 低いソ
      const riff = [0, 0, 7, 0, 10, 7, 5, 3];
      const melody = [12, 15, 19, 22, 19, 15, 17, 19];
      // 支える持続音
      try {
        [root / 2, root / 2 * 1.5].forEach((fr, i) => {
          const o = this.ctx.createOscillator(), g = this.ctx.createGain();
          o.type = 'sawtooth'; o.frequency.value = fr; g.gain.value = 0.05;
          const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
          o.connect(lp); lp.connect(g); g.connect(this.master); o.start();
          this._drone.push({ o, g });
        });
      } catch (e) {}
      const tick = () => {
        if (this.muted || document.hidden) return;
        const s = this._step;
        // 疾走する刻み
        this._noise(0.05, 0.05, 7000, 3000);
        if (s % 2 === 0) this._tone(58, 0.14, 'sine', 0.2);          // 太鼓
        if (s % 4 === 2) this._noise(0.12, 0.14, 5000, 900);         // 小太鼓
        // 低音の走句
        this._tone(root * Math.pow(2, riff[s % riff.length] / 12), beat * 0.9, 'sawtooth', 0.075);
        // 主旋律（勇ましい）
        if (s % 2 === 0) {
          const m = melody[Math.floor(s / 2) % melody.length];
          this._tone(root * Math.pow(2, m / 12), beat * 1.7, 'square', 0.06);
          this._tone(root * Math.pow(2, (m + 4) / 12), beat * 1.7, 'triangle', 0.03, 0.01);
        }
        // 決めの一撃
        if (s % 32 === 30) { this._noise(0.5, 0.2, 9000, 400); this._tone(root * 4, 0.6, 'square', 0.09, 0, root * 8); }
        this._step++;
      };
      tick();
      this._bgmTimer = setInterval(tick, beat * 1000);
      return;
    }

    if (BGM_DEF[kind]) { this._bgmGeneric(BGM_DEF[kind]); return; }

    // ── 地下（墓地）：不気味な持続音 ──
    const beat = 0.95;
    try {
      [41.2, 43.65, 61.7].forEach((fr, i) => {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = i === 2 ? 'triangle' : 'sawtooth';
        o.frequency.value = fr; g.gain.value = 0.055;
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
        const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
        lfo.frequency.value = 0.07 + i * 0.03; lg.gain.value = 2.2;
        lfo.connect(lg); lg.connect(o.detune); lfo.start();
        o.connect(lp); lp.connect(g); g.connect(this.master); o.start();
        this._drone.push({ o, g, lfo });
      });
    } catch (e) {}
    const tick = () => {
      if (this.muted || document.hidden) return;
      const s = this._step;
      if (s % 4 === 0) { this._tone(52, 0.34, 'sine', 0.16); this._tone(48, 0.28, 'sine', 0.12, 0.17); }
      if (s % 8 === 5) this._noise(0.9, 0.05, 1400, 160);
      if (s % 16 === 11) this._tone(1180, 0.5, 'triangle', 0.05, 0, 690);
      if (s % 8 === 2) { this._tone(329.6, 0.7, 'sine', 0.045); this._tone(311.1, 0.7, 'sine', 0.04); }
      if (s % 12 === 7) this._noise(1.4, 0.035, 900, 240);
      this._step++;
    };
    tick();
    this._bgmTimer = setInterval(tick, beat * 1000);
  }
  /** 手掛かりから調べを生成して鳴らし続ける */
  _bgmGeneric(D) {
    const c = this.ctx;
    try {
      (D.drone || []).forEach(([fr, type], i) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.value = fr; g.gain.value = 0.045;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = D.lp || 600;
        const lfo = c.createOscillator(), lg = c.createGain();
        lfo.frequency.value = 0.06 + i * 0.04; lg.gain.value = 3;
        lfo.connect(lg); lg.connect(o.detune); lfo.start();
        o.connect(lp); lp.connect(g); g.connect(this.master); o.start();
        this._drone.push({ o, g, lfo });
      });
    } catch (e) {}
    const sc = D.scale, R = D.root;
    const tick = () => {
      if (this.muted || document.hidden) return;
      const s = this._step;
      if (D.chord && s % (D.chordEvery || 8) === 0) {
        const ch = D.chord[Math.floor(s / (D.chordEvery || 8)) % D.chord.length];
        ch.forEach((semi, i) => this._tone(R / 2 * Math.pow(2, semi / 12), D.beat * (D.chordEvery || 8) * 0.9, 'triangle', D.vol * 0.7, i * 0.03));
      }
      if (s % (D.mel || 2) === 0) {
        const k = Math.floor((Math.sin(s * 0.91) * 0.5 + 0.5) * sc.length) % sc.length;
        const f = R * Math.pow(2, sc[k] / 12);
        this._tone(f, D.beat * (D.koto ? 2.2 : 1.4), D.inst, D.vol);
        if (D.koto) this._tone(f * 2, D.beat * 0.8, 'sine', D.vol * 0.3, 0.01);
      }
      if (D.bells && s % 3 === 1) this._tone(R * 2 * Math.pow(2, sc[(s * 5) % sc.length] / 12), 1.2, 'sine', 0.025);
      if (D.perc) {
        const p = D.perc[s % D.perc.length];
        if (p === 'x') this._tone(55, 0.18, 'sine', 0.16);
        if (p === 'o') this._noise(0.12, 0.08, 4000, 800);
        if (p === 'h') this._noise(0.04, 0.035, 9000, 5000);
        if (p === 'a') { this._tone(1760, 0.3, 'square', 0.03); this._tone(2637, 0.4, 'sine', 0.03, 0.005); this._noise(0.08, 0.1, 9000, 3000); }
      }
      if (D.wind && s % D.wind === 0) this._noise(2.2, 0.02, 2400, 500);
      if (D.crickets && s % 2 === 1) { this._tone(4200, 0.05, 'sine', 0.012); this._tone(4200, 0.05, 'sine', 0.012, 0.08); }
      this._step++;
    };
    tick();
    this._bgmTimer = setInterval(tick, D.beat * 1000);
  }
  stopBGM() {
    clearInterval(this._bgmTimer); this._bgmTimer = 0; this._bgmKind = null;
    if (this._drone) {
      this._drone.forEach(d => { try { d.o.stop(); d.lfo.stop(); } catch (e) {} });
      this._drone = null;
    }
  }
}
