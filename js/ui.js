/* ui.js ── 画面の出し入れとトースト */
const $ = s => document.querySelector(s);

export const UI = {
  el: {},
  init() {
    ['rotate','boot','perm','title','hud','pad','cutin','config','records','result','shop','talk','toast']
      .forEach(id => { this.el[id] = document.getElementById(id); });
    this.el.bootFill = $('#boot-fill');
    this.el.bootMsg  = $('#boot-msg');
    this.el.sunFill  = $('#sun-fill');
    this.el.sunNum   = $('#sun-num');
    this.el.sunSrc   = $('#sun-src');
    this.el.sunIcon  = $('#sun-icon');
    this.el.sunFull  = $('#sun-full');
    this.el.hp       = $('#hud-hp');
    this.el.obj      = $('#hud-obj');
    this.el.fps      = $('#hud-fps');
    this.el.boss     = $('#hud-boss');
    this.el.bossFill = $('#boss-fill');
    this.el.bossPhase= $('#boss-phase');
    this.el.cutinTxt = $('#cutin-txt');
    this.el.titleSun = $('#title-sun');
    this.el.titleSrc = $('#title-src');
    this.el.solar    = $('#hud-solar');
    this.el.solarRem = $('#solar-remain');
    this.el.shout    = $('#shout');
    this._checkOrient();
    window.addEventListener('resize', () => this._checkOrient());
    window.addEventListener('orientationchange', () => setTimeout(() => this._checkOrient(), 200));
  },
  _checkOrient() {
    const portrait = window.innerHeight > window.innerWidth;
    if (this.el.rotate) this.el.rotate.hidden = !portrait;
  },
  show(id) { const e = this.el[id]; if (e) e.hidden = false; },
  hide(id) { const e = this.el[id]; if (e) e.hidden = true; },
  boot(pct, msg) {
    if (this.el.bootFill) this.el.bootFill.style.width = pct + '%';
    if (this.el.bootMsg && msg) this.el.bootMsg.textContent = msg;
  },
  sun(v, srcLabel, srcIcon) {
    if (this.el.sunFill) this.el.sunFill.style.width = v + '%';
    if (this.el.sunNum) this.el.sunNum.textContent = Math.round(v);
    if (this.el.sunSrc && srcLabel) this.el.sunSrc.textContent = srcLabel;
    if (this.el.sunIcon && srcIcon) this.el.sunIcon.textContent = srcIcon;
    if (this.el.sunFull) this.el.sunFull.hidden = v < 99.5;
    if (this.el.titleSun) this.el.titleSun.textContent = Math.round(v);
    if (this.el.titleSrc && srcLabel) this.el.titleSrc.textContent = srcLabel;
  },
  hp(cur, max, guard, guardMax) {
    const fill = document.getElementById('hp-fill');
    const num = document.getElementById('hp-num');
    const bar = fill && fill.parentNode;
    if (!fill) return;
    // 心の数に、いまの心の耐久を足して滑らかに見せる
    const g = (guardMax > 0) ? Math.max(0, Math.min(1, guard / guardMax)) : 1;
    const ratio = max > 0 ? Math.max(0, Math.min(1, ((cur - 1) + g) / max)) : 0;
    fill.style.width = (cur <= 0 ? 0 : ratio * 100) + '%';
    if (num) num.textContent = cur + ' / ' + max;
    if (bar) bar.classList.toggle('low', cur <= 1);
  },
  objective(t) { if (this.el.obj) this.el.obj.textContent = t; },
  solar(on, remain) {
    if (!this.el.solar) return;
    this.el.solar.hidden = !on;
    if (on && this.el.solarRem) {
      const m = Math.floor(remain / 60), sec = Math.floor(remain % 60);
      this.el.solarRem.textContent = '陽 の 化 身　残り ' + m + ':' + ('0' + sec).slice(-2);
    }
  },
  shout(text) {
    const e = this.el.shout; if (!e) return;
    e.textContent = text;
    e.hidden = false;
    e.style.animation = 'none'; void e.offsetWidth; e.style.animation = '';
    clearTimeout(this._shoutT);
    this._shoutT = setTimeout(() => { e.hidden = true; }, 1650);
  },
  fps(v) { if (this.el.fps) this.el.fps.textContent = v + ' fps'; },
  bossBar(ratio, phaseText) {
    if (this.el.bossFill) this.el.bossFill.style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%';
    if (this.el.bossPhase && phaseText) this.el.bossPhase.textContent = phaseText;
  },
  cutin(text, ms) {
    return new Promise(res => {
      if (!this.el.cutin) { res(); return; }
      this.el.cutinTxt.textContent = text;
      this.el.cutin.hidden = false;
      setTimeout(() => { this.el.cutin.hidden = true; res(); }, ms || 1400);
    });
  },
  _toastTimer: 0,
  toast(msg, ms) {
    const e = this.el.toast; if (!e) return;
    e.textContent = msg; e.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { e.hidden = true; }, ms || 2600);
  }
};
