/* ══════════════════════════════════════════════════════════════
   main.js ── 初期化とゲームループ
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { Gfx, glowMaterial } from './gfx.js';
import { Sun } from './sun.js';
import { World } from './world.js';
import { Player, SHOT_COST, CHARGE_COST } from './player.js';
import { Enemies, Bullets, Particles, EnemyKind } from './enemy.js';
import { Boss } from './boss.js';
import { Coffin } from './coffin.js';
import { Purifier } from './purifier.js';
import { Miko } from './miko.js';
import { Solar, SOLAR_DMG_MUL } from './solar.js';
import { Party, expOf, STAT_KEYS } from './stats.js';
import { Menu } from './menu.js';
import { UI } from './ui.js';
import { Save, Config } from './save.js';
import { Audio, Voice } from './audio.js';

const Phase = {
  TITLE: 'title', SURFACE: 'surface', DUNGEON: 'dungeon',
  BOSS: 'boss', SEAL: 'seal', CARRY: 'carry', PILE: 'pile', RESULT: 'result'
};

class Game {
  constructor() {
    this.cfg = Config.load();
    this.phase = Phase.TITLE;
    this.input = { mx: 0, mz: 0, ax: 0, az: 0, fire: false, charge: false, dash: false };
    this.keys = {};
    this.stats = { hits: 0, maxSun: 0, start: 0, kills: 0 };
    this.shotCd = 0;
    this.chargeT = 0;
    this.spawnT = 0;
    this.floor = 1;
    this.hasKey = false;
  }

  async boot() {
    window.__solStarted = true;
    UI.init();
    UI.boot(10, '描画を用意しています…');

    const canvas = document.getElementById('view');
    this.gfx = new Gfx(canvas, this.cfg.quality);
    window.addEventListener('resize', () => this.gfx.resize());

    UI.boot(30, '世界を組み立てています…');
    this.world = new World(this.gfx.scene, this.cfg.quality);
    this.particles = new Particles(this.gfx.scene, this.cfg.quality === 'low' ? 260 : 560);
    this.bullets = new Bullets(this.gfx.scene, 90);
    this.enemies = new Enemies(this.gfx.scene, this.particles);
    this.player = new Player(this.gfx.scene);
    this.miko = new Miko(this.gfx.scene, this.particles);
    this.solar = new Solar(this.gfx.scene, this.particles);
    this.boss = new Boss(this.gfx.scene, this.particles);
    this.coffin = new Coffin(this.gfx.scene, this.particles);
    this.pile = new Purifier(this.gfx.scene, this.particles);

    // 光
    this.sunLight = new THREE.DirectionalLight(0xfff0d0, 2.2);
    this.sunLight.position.set(18, 30, 12);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 1; this.sunLight.shadow.camera.far = 90;
    this.sunLight.shadow.camera.left = -40; this.sunLight.shadow.camera.right = 40;
    this.sunLight.shadow.camera.top = 40; this.sunLight.shadow.camera.bottom = -40;
    this.gfx.scene.add(this.sunLight);
    this.ambient = new THREE.AmbientLight(0x9fb0c8, 1.5);
    this.gfx.scene.add(this.ambient);
    // 地下でも足元が見えるよう、空と地面からの回り込みを足す
    this.hemi = new THREE.HemisphereLight(0xa8bcd8, 0x5a5348, 1.1);
    this.gfx.scene.add(this.hemi);

    UI.boot(55, '音を用意しています…');
    // ── 一党（狩人と巫女） ──
    this.party = Party.load({
      hero: { name: '陽光狩人', job: '狩人', bias: { ATK: 1.15, DEX: 1.1, AGI: 1.05, MATK: 0.85, MP: 0.8 } },
      miko: { name: '日和', job: '巫女', bias: { MATK: 1.25, MP: 1.3, MDEF: 1.15, ATK: 0.7, DEF: 0.85 } }
    });
    this.menu = new Menu(this.party, {
      hero: () => this.player.makePortrait(),
      miko: () => this.miko.makePortrait()
    });
    this.menu.onChange = () => { Party.save(this.party); this.applyStats(); };

    this.audio = new Audio();
    this.voice = new Voice();
    this.audio.setVolume(this.cfg.volume / 100);
    this.audio.setMute(this.cfg.mute);
    this.voice.setEnabled(this.cfg.voice !== false);
    this.voice.setVolume(this.cfg.volume / 100);

    UI.boot(75, '陽力を測ります…');
    this.sun = new Sun((v, src) => {
      UI.sun(v, this.sunLabel(), this.sunIcon());
      if (v > this.stats.maxSun) this.stats.maxSun = v;
      // 陽力がまったく無いと何もできないため、遊び方を案内する
      if (this.phase === Phase.TITLE && v < 3 && !this.cfg.practice && !this._nightHinted) {
        this._nightHinted = true;
        UI.toast('いまは陽が届いていません。設定の「練習モード」で陽力を決めれば夜でも遊べます', 5200);
      }
    });

    this.bindInput();
    this.bindUI();
    this.applyStats();

    UI.boot(100, '準備ができました');
    setTimeout(() => {
      UI.hide('boot');
      if (this.cfg.allowCamera === null) UI.show('perm');
      else this.startSun();
      UI.show('title');
    }, 400);

    this.last = performance.now() / 1000;
    requestAnimationFrame(t => this.loop(t));
  }

  /** 能力値を実際の動きへ反映する */
  applyStats() {
    const h = this.party.hero, m = this.party.miko;
    if (this.player) {
      const before = this.player.maxHp;
      this.player.maxHp = h.maxHp;
      if (this.player.hp > this.player.maxHp) this.player.hp = this.player.maxHp;
      if (this.player.maxHp > before) this.player.hp += (this.player.maxHp - before);
      this.player.speed = 7.5 * h.speedMul;
      this.player.cutPhys = h.defCut;
      this.player.cutMag = h.mdefCut;
      this.player.evade = h.evade;
      UI.hp(this.player.hp, this.player.maxHp);
    }
    if (this.miko) this.miko.applyStats(m);
  }

  sunLabel() { return this.sun ? this.sun.label : '—'; }
  sunIcon() { return this.sun ? this.sun.icon : '·'; }

  startSun() {
    this.sun.setPractice(this.cfg.practice, this.cfg.manual);
    if (!this.cfg.practice) this.sun.start(this.cfg.allowCamera === true);
  }

  /* ── 入力 ─────────────────────────────── */
  bindInput() {
    addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'Space') this.onAction();
      if (e.code === 'KeyQ') this.invokeSolar();
      if (e.code === 'KeyE') this.invokeHeal();
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });

    const canvas = document.getElementById('view');
    canvas.addEventListener('mousemove', e => {
      const cx = innerWidth / 2, cy = innerHeight / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const len = Math.hypot(dx, dy) || 1;
      this.input.ax = dx / len; this.input.az = dy / len;
    });
    canvas.addEventListener('mousedown', e => {
      this.audio.unlock(); this.voice.unlock();
      if (e.button === 0) { this.input.fire = true; this.onAction(); }
    });
    addEventListener('mouseup', () => { this.input.fire = false; });

    // 仮想スティック
    const setupStick = (id, onMove) => {
      const el = document.getElementById(id);
      if (!el) return;
      const knob = el.querySelector('i');
      let active = null;
      const rect = () => el.getBoundingClientRect();
      const start = e => {
        this.audio.unlock(); this.voice.unlock();
        const t = e.changedTouches ? e.changedTouches[0] : e;
        active = t.identifier != null ? t.identifier : 'mouse';
        move(e);
      };
      const move = e => {
        if (active === null) return;
        const list = e.changedTouches ? Array.from(e.changedTouches) : [e];
        const t = list.find(x => (x.identifier != null ? x.identifier : 'mouse') === active);
        if (!t) return;
        const r = rect();
        let dx = t.clientX - (r.left + r.width / 2);
        let dy = t.clientY - (r.top + r.height / 2);
        const max = r.width / 2 - 12;
        const d = Math.hypot(dx, dy);
        if (d > max) { dx = dx / d * max; dy = dy / d * max; }
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        onMove(dx / max, dy / max);
        e.preventDefault();
      };
      const end = e => {
        active = null;
        knob.style.transform = '';
        onMove(0, 0);
      };
      el.addEventListener('touchstart', start, { passive: false });
      el.addEventListener('touchmove', move, { passive: false });
      el.addEventListener('touchend', end);
      el.addEventListener('touchcancel', end);
      el.addEventListener('mousedown', start);
      addEventListener('mousemove', e => { if (active !== null) move(e); });
      addEventListener('mouseup', end);
    };
    setupStick('stick-l', (x, y) => { this.input.mx = x; this.input.mz = y; });
    setupStick('stick-r', (x, y) => {
      if (x || y) { this.input.ax = x; this.input.az = y; this.input.fire = true; }
      else this.input.fire = false;
    });
    const dash = document.getElementById('btn-dash');
    if (dash) {
      dash.addEventListener('touchstart', e => { this.input.dash = true; e.preventDefault(); }, { passive: false });
      dash.addEventListener('touchend', () => { this.input.dash = false; });
    }
    const solarBtn = document.getElementById('btn-solar');
    if (solarBtn) {
      const go = e => { if (e) e.preventDefault(); this.audio.unlock(); this.voice.unlock(); this.invokeSolar(); };
      solarBtn.addEventListener('touchstart', go, { passive: false });
      solarBtn.addEventListener('click', go);
    }
    const healBtn = document.getElementById('btn-heal');
    if (healBtn) {
      const go2 = e => { if (e) e.preventDefault(); this.audio.unlock(); this.voice.unlock(); this.invokeHeal(); };
      healBtn.addEventListener('touchstart', go2, { passive: false });
      healBtn.addEventListener('click', go2);
    }
    const chg = document.getElementById('btn-charge');
    if (chg) {
      chg.addEventListener('touchstart', e => { this.input.charge = true; this.onAction(); e.preventDefault(); }, { passive: false });
      chg.addEventListener('touchend', () => { this.input.charge = false; });
    }
  }

  /** 決定操作（QTE・杭打ちなど） */
  onAction() {
    if (this.phase === Phase.SEAL && this.coffin.qte) {
      const r = this.coffin.tapQte();
      if (r === 'perfect') { this.audio.sfx('good'); UI.toast('会心'); }
      else if (r === 'good') { this.audio.sfx('good'); UI.toast('成功'); }
      else if (r === 'miss') { this.audio.sfx('bad'); UI.toast('しくじった'); }
    }
  }

  /* ── 陽の化身 ───────────────────────────── */
  invokeSolar() {
    if (this.phase === Phase.TITLE || this.phase === Phase.RESULT) return;
    if (!this.solar.ready) {
      if (this.solar.active) UI.toast('すでに陽の化身です');
      else UI.toast('陽の力が戻るまで あと' + Math.ceil(this.solar.cd) + '秒');
      this.audio.sfx('empty');
      return;
    }
    if (this.solar.invoke(this.sun, this.audio)) {
      UI.shout('太 陽 ！');
      this.voice.say('太陽！', 'hero', { rate: 0.95, pitch: 0.8 });
      UI.toast('向日葵の妖精が現れ、天から陽が降りそそぐ', 3400);
      UI.sun(this.sun.value, this.sunLabel(), this.sunIcon());
    }
  }

  /* ── 巫女の祓い（手動） ─────────────────── */
  invokeHeal() {
    if (this.phase === Phase.TITLE || this.phase === Phase.RESULT) return;
    const m = this.miko;
    if (m.stagger > 0) { UI.toast('日和がよろめいている（あと' + Math.ceil(m.stagger) + '秒）'); this.audio.sfx('empty'); return; }
    if (m.healCd > 0) { UI.toast('祓いの支度中（あと' + Math.ceil(m.healCd) + '秒）'); this.audio.sfx('empty'); return; }
    if (m.mp < m.healCost) { UI.toast('霊力が足りない（' + Math.floor(m.mp) + ' / ' + m.healCost + '）'); this.audio.sfx('empty'); return; }
    const d = Math.hypot(this.player.pos.x - m.pos.x, this.player.pos.z - m.pos.z);
    if (d > 7) { UI.toast('日和が遠い。近づいて呼べ'); this.audio.sfx('empty'); return; }

    m.mp -= m.healCost;
    m.healing = 1.6;
    m.healCd = m.cdMax;
    const crit = Math.random() < m.critHeal;
    const amount = m.healAmount * (crit ? 2 : 1);
    this.player.wardT = m.wardSec;
    this.player.wardCut = m.wardCut;
    const healed = this.player.heal(amount);
    UI.hp(this.player.hp, this.player.maxHp);
    UI.shout(crit ? '大 祓 い ！' : '祓 い ま す');
    this.voice.say(crit ? '大祓い！' : '祓います', 'miko');
    this.audio.sfx('seal');
    UI.toast((healed ? ('心を' + amount + 'つ癒した') : '傷は無いが加護を得た') +
      (m.wardCut > 0 ? ('　加護 ' + Math.round(m.wardCut * 100) + '%×' + Math.round(m.wardSec) + '秒') : ''), 2600);
  }

  /* ── UI ───────────────────────────────── */
  bindUI() {
    const on = (id, fn) => { const e = document.getElementById(id); if (e) e.addEventListener('click', fn); };

    on('perm-yes', async () => {
      this.audio.unlock(); this.voice.unlock();
      this.cfg.allowCamera = true; Config.save(this.cfg);
      UI.hide('perm');
      await this.sun.start(true);
      if (this.sun.source !== 'camera') UI.toast('カメラを使えないため、天気か時刻から推定します');
      UI.sun(this.sun.value, this.sunLabel(), this.sunIcon());
    });
    on('perm-no', async () => {
      this.audio.unlock(); this.voice.unlock();
      this.cfg.allowCamera = false; Config.save(this.cfg);
      UI.hide('perm');
      await this.sun.start(false);
      UI.sun(this.sun.value, this.sunLabel(), this.sunIcon());
    });

    on('btn-start', () => { this.audio.unlock(); this.voice.unlock(); this.startRun(); });
    on('btn-config', () => { this.syncConfigUI(); UI.show('config'); });
    on('btn-menu-title', () => { this.menu.show('hero'); });
    on('menu-close', () => { this.menu.hide(); Party.save(this.party); });
    document.querySelectorAll('.menu-tab').forEach(b => {
      b.addEventListener('click', () => { this.menu.who = b.dataset.who; this.menu.show(); });
    });
    const mb = document.getElementById('btn-menu');
    if (mb) {
      const openMenu = e => { if (e) e.preventDefault(); this.menu.show(); };
      mb.addEventListener('touchstart', openMenu, { passive: false });
      mb.addEventListener('click', openMenu);
    }
    on('cfg-close', () => UI.hide('config'));
    on('btn-records', async () => { await this.showRecords(); UI.show('records'); });
    on('rec-close', () => UI.hide('records'));
    on('res-retry', () => { UI.hide('result'); this.startRun(); });
    on('res-title', () => { UI.hide('result'); this.toTitle(); });

    const q = document.getElementById('cfg-quality');
    if (q) q.addEventListener('change', () => {
      this.cfg.quality = q.value; Config.save(this.cfg);
      this.gfx.setQuality(q.value);
      UI.toast('画質を変えました');
    });
    const vol = document.getElementById('cfg-vol');
    if (vol) vol.addEventListener('input', () => {
      this.cfg.volume = +vol.value; Config.save(this.cfg);
      this.audio.setVolume(this.cfg.volume / 100);
    });
    const mute = document.getElementById('cfg-mute');
    if (mute) mute.addEventListener('change', () => {
      this.cfg.mute = mute.checked; Config.save(this.cfg);
      this.audio.setMute(this.cfg.mute);
    this.voice.setEnabled(this.cfg.voice !== false);
    this.voice.setVolume(this.cfg.volume / 100);
    });
    const vc = document.getElementById('cfg-voice');
    if (vc) {
      vc.checked = this.cfg.voice !== false;
      vc.addEventListener('change', () => {
        this.cfg.voice = vc.checked; Config.save(this.cfg);
        this.voice.setEnabled(vc.checked);
        this.showVoiceNote();
      });
    }
    const vt = document.getElementById('cfg-voice-test');
    if (vt) {
      vt.addEventListener('click', () => {
        this.voice.unlock();
        const ok = this.voice.say('陽光狩人、参ります', 'hero');
        setTimeout(() => this.showVoiceNote(), 350);
        if (!ok) UI.toast('声を出せませんでした');
      });
    }
    const prac = document.getElementById('cfg-practice');
    const row = document.getElementById('row-manual');
    if (prac) prac.addEventListener('change', () => {
      this.cfg.practice = prac.checked; Config.save(this.cfg);
      if (row) row.hidden = !prac.checked;
      this.sun.setPractice(prac.checked, this.cfg.manual);
      if (!prac.checked) this.sun.start(this.cfg.allowCamera === true);
    });
    const man = document.getElementById('cfg-manual');
    if (man) man.addEventListener('input', () => {
      this.cfg.manual = +man.value; Config.save(this.cfg);
      this.sun.setManual(this.cfg.manual);
    });
  }
  /** 声の状態を設定画面に出す */
  showVoiceNote() {
    const el = document.getElementById('voice-note');
    if (!el) return;
    const st = this.voice.status();
    if (!st.supported) { el.textContent = 'この端末は読み上げに対応していません'; return; }
    if (!st.enabled) { el.textContent = '声は切ってあります'; return; }
    if (!st.voices) { el.textContent = '声の一覧をまだ取得できていません。「試す」を押すと読み込まれます'; return; }
    if (!st.ja) { el.textContent = '日本語の声が見つかりません（設定→アクセシビリティ→読み上げコンテンツ→声 で日本語を追加してください）'; return; }
    el.textContent = '使う声：' + st.jaName + '　／　鳴らない時は本体側面の消音スイッチをご確認ください';
  }

  syncConfigUI() {
    const set = (id, prop, v) => { const e = document.getElementById(id); if (e) e[prop] = v; };
    set('cfg-quality', 'value', this.cfg.quality);
    set('cfg-vol', 'value', this.cfg.volume);
    set('cfg-mute', 'checked', this.cfg.mute);
    set('cfg-practice', 'checked', this.cfg.practice);
    set('cfg-manual', 'value', this.cfg.manual);
    const row = document.getElementById('row-manual');
    if (row) row.hidden = !this.cfg.practice;
    this.showVoiceNote();
  }
  async showRecords() {
    const body = document.getElementById('rec-body');
    if (!body) return;
    try {
      const rows = await Save.all();
      if (!rows.length) { body.innerHTML = '<div class="rec-empty">まだ記録がありません</div>'; return; }
      body.innerHTML = rows.map(r => {
        const d = new Date(r.at);
        return `<div class="rec-row"><span class="rk">${r.rank}</span>
          <span style="flex:1">${d.getMonth() + 1}/${d.getDate()} ${('0' + d.getHours()).slice(-2)}:${('0' + d.getMinutes()).slice(-2)}</span>
          <span>浄化 ${r.rate}％</span><span>${r.time}秒</span></div>`;
      }).join('');
    } catch (e) {
      body.innerHTML = '<div class="rec-empty">記録を読み込めませんでした</div>';
    }
  }

  /* ── 進行 ─────────────────────────────── */
  toTitle() {
    this.phase = Phase.TITLE;
    UI.hide('hud'); UI.hide('pad');
    UI.show('title');
    this.enemies.clear(); this.bullets.clear();
    this.boss.despawn(); this.boss.cleanup(); this.coffin.hide();
    this.pile.group.visible = false;
  }

  startRun() {
    if (this.sun.value < 3 && !this.cfg.practice) {
      UI.toast('陽力がありません。日の当たる場所へ出るか、設定の「練習モード」を使ってください', 5000);
      this.syncConfigUI(); UI.show('config');
      return;
    }
    UI.hide('title'); UI.show('hud');
    if ('ontouchstart' in window) UI.show('pad');
    this.stats = { hits: 0, maxSun: this.sun.value, start: performance.now(), kills: 0 };
    this.enemies.clear(); this.bullets.clear();
    this.boss.despawn(); this.boss.cleanup(); this.coffin.hide();
    this.solar.end(); this.solar.cd = 0;
    this.enterSurface();
  }

  enterSurface() {
    this.phase = Phase.SURFACE;
    this.audio.startBGM('surface');
    this.world.buildSurface();
    this.player.reset(this.world.playerStart);
    this.miko.reset(this.world.playerStart);
    this.sunLight.intensity = 3.0;
    this.ambient.intensity = 1.5;
    this.hemi.intensity = 1.1;
    this.gfx.scene.fog.density = 0.008;
    this.pile.place(new THREE.Vector3(0, 0, 0));
    UI.hp(this.player.hp, this.player.maxHp);
    UI.objective('陽力を溜め、南の縦穴から地下へ');
    UI.hide('hud-boss');
    const bh = document.getElementById('hud-boss'); if (bh) bh.hidden = true;
  }

  enterDungeon() {
    this.phase = Phase.DUNGEON;
    this.audio.startBGM('dungeon');
    this.hasKey = false;
    this.world.buildDungeon(Date.now() % 100000, this.floor);
    this.player.reset(this.world.playerStart);
    this.miko.reset(this.world.playerStart);
    this.sunLight.intensity = 1.1;
    this.ambient.intensity = 2.6;
    this.hemi.intensity = 2.3;
    this.gfx.scene.fog.density = 0.013;
    this.gfx.scene.background.setHex(0x1d2531);
    this.gfx.scene.fog.color.setHex(0x1d2531);
    this.enemies.clear();
    // 湧き
    const kinds = [EnemyKind.WALKER, EnemyKind.RUNNER, EnemyKind.SHIELD, EnemyKind.BAT];
    this.world.spawnPoints.forEach((p, i) => {
      this.enemies.spawn(kinds[i % kinds.length], p);
    });
    UI.objective('最深部へ。天窓の光で陽力を補え');
    UI.toast('日光は届かない。天窓の下でのみ陽力が戻る');
  }

  async enterBoss() {
    this.phase = Phase.BOSS;
    this.audio.startBGM('boss');
    this.voice.say('ここが最深部か。行くぞ', 'hero');
    await UI.cutin('古 き 吸 血 鬼', 1600);
    const r = this.world.bossRoom;
    this.boss.spawn(new THREE.Vector3(r.x, 0, r.z - 4));
    const bh = document.getElementById('hud-boss'); if (bh) bh.hidden = false;
    UI.bossBar(1, '第一相');
    UI.objective('霧を散らし、闇を討て');
    this.audio.sfx('phase');
  }

  async onBossPhase(p) {
    const txt = p === 2 ? '第 二 相 ／ 影 を 見 極 め よ' : '第 三 相 ／ 天 窓 を 撃 て';
    await UI.cutin(txt, 1500);
    UI.bossBar(this.boss.hp / this.boss.maxHp, p === 2 ? '第二相' : '第三相');
    UI.objective(p === 2 ? '最も影の濃い個体が本体' : '天井の窓を撃ち割り、光の柱で縛れ');
    this.audio.sfx('phase');
  }

  async onBossDead() {
    this.grantExp(expOf(0, true));
    this.boss.cleanup();
    this.boss.despawn();
    const bh = document.getElementById('hud-boss'); if (bh) bh.hidden = true;
    this.particles.emit(this.boss.p, 60, { color: [0.8, 0.8, 0.9], size: 4, up: 3.4 });
    this.audio.sfx('ash');
    await UI.cutin('灰 の 核', 1300);
    this.phase = Phase.SEAL;
    this.coffin.spawnCore(this.boss.p.clone());
    UI.objective('灰の核に近づき、拍に合わせて封じよ');
  }

  finishPile() {
    const bh3 = document.getElementById('hud-boss'); if (bh3) bh3.hidden = true;
    const res = this.pile.result(this.coffin.sealRatio, this.sun.value);
    this.showResult(res);
  }

  async showResult(res) {
    this.phase = Phase.RESULT;
    const time = Math.round((performance.now() - this.stats.start) / 1000);
    let rank = 'D';
    if (res.full) rank = 'S';
    else if (res.rate >= 88 && this.stats.hits <= 2) rank = 'A';
    else if (res.rate >= 70) rank = 'B';
    else if (res.rate >= 50) rank = 'C';

    if (res.full) {
      await UI.cutin('完 全 浄 化', 1800);
      this.audio.sfx('purify');
      this.particles.emit(this.pile.group.position, 120, { color: [1, 1, 0.9], size: 5, up: 5, life: 2.2 });
    }
    const ttl = document.getElementById('res-ttl');
    if (ttl) ttl.textContent = res.full ? '完全浄化' : (res.rate >= 60 ? '浄化' : '不完全');
    const body = document.getElementById('res-body');
    if (body) {
      body.innerHTML =
        `<div class="res-rank">${rank}</div>` +
        `<div class="res-line"><span>浄化率</span><b>${res.rate}％</b></div>` +
        `<div class="res-line"><span>タイム</span><b>${time}秒</b></div>` +
        `<div class="res-line"><span>最大陽力</span><b>${Math.round(this.stats.maxSun)}％</b></div>` +
        `<div class="res-line"><span>被弾数</span><b>${this.stats.hits}</b></div>` +
        `<div class="res-line"><span>祓った数</span><b>${this.stats.kills}</b></div>`;
    }
    UI.show('result');
    try { await Save.add({ rank, rate: res.rate, time, maxSun: Math.round(this.stats.maxSun), hits: this.stats.hits }); }
    catch (e) { UI.toast('記録の保存に失敗しました'); }
  }

  async gameOver() {
    this.phase = Phase.RESULT;
    await UI.cutin('陽 は 落 ち た', 1500);
    const ttl = document.getElementById('res-ttl');
    if (ttl) ttl.textContent = '力尽きた';
    const body = document.getElementById('res-body');
    if (body) body.innerHTML = '<div class="res-rank">—</div><div class="res-line"><span>祓った数</span><b>' + this.stats.kills + '</b></div>';
    UI.show('result');
  }

  /* ── ループ ───────────────────────────── */
  loop(nowMs) {
    requestAnimationFrame(t => this.loop(t));
    const now = nowMs / 1000;
    let dt = now - this.last;
    this.last = now;
    if (dt > 0.1) dt = 0.1;

    const fps = this.gfx.watchPerf(dt);
    UI.fps(fps);

    // キーボード
    if (this.phase !== Phase.TITLE && this.phase !== Phase.RESULT) {
      let mx = 0, mz = 0;
      if (this.keys['KeyW']) mz -= 1;
      if (this.keys['KeyS']) mz += 1;
      if (this.keys['KeyA']) mx -= 1;
      if (this.keys['KeyD']) mx += 1;
      if (mx || mz) { this.input.mx = mx; this.input.mz = mz; }
      else if (!('ontouchstart' in window)) { this.input.mx = 0; this.input.mz = 0; }
      this.input.dash = !!this.keys['ShiftLeft'] || !!this.keys['ShiftRight'] || this.input.dash;
    }

    this.world.update(now);
    this.particles.update(dt);
    this.bullets.update(dt, this.world);
    this.coffin.update(dt, now);
    this.pile.update(dt, now, this.coffin.p);

    if (this.phase !== Phase.TITLE && this.phase !== Phase.RESULT) {
      this.updatePlay(dt, now);
    }

    // カメラ追従（見下ろし気味）
    const p = this.player.pos;
    const camTarget = new THREE.Vector3(p.x, 12.5, p.z + 11);
    this.gfx.camera.position.lerp(camTarget, 1 - Math.pow(0.0015, dt));
    this.gfx.camera.lookAt(p.x, 1.2, p.z);

    this.gfx.render(now);
  }

  updatePlay(dt, now) {
    const P = this.player;
    P.update(dt, this.input, this.world, now);

    // 射撃
    this.shotCd -= dt;
    const wantCharge = this.input.charge || this.keys['ShiftLeft'] === undefined && false;
    if (this.input.charge) {
      this.chargeT += dt;
      P.charging = Math.min(1, this.chargeT / (1.1 / this.party.hero.chargeMul));
      if (this.chargeT > (1.1 / this.party.hero.chargeMul) && !this._chargeSfx) { this.audio.sfx('charge'); this._chargeSfx = true; }
    } else if (this.chargeT > 0) {
      // 離した瞬間に撃つ
      if (this.chargeT >= (1.1 / this.party.hero.chargeMul)) this.fire(true);
      this.chargeT = 0; P.charging = 0; this._chargeSfx = false;
    }
    if (this.input.fire && !this.input.charge && this.shotCd <= 0 && !P.pushing) {
      this.fire(false);
    }

    // 天窓で補給
    const s = this.world.inShaft(P.pos.x, P.pos.z);
    if (s) {
      this.sun.charge(18 * dt);
      if (!this._inShaft) { this.audio.sfx('refill'); this._inShaft = true; }
    } else this._inShaft = false;

    // 供の巫女
    const danger = !!this.enemies.touching(P.pos.x, P.pos.z) || (this.phase === Phase.BOSS);
    this.miko.update(dt, P, this.world, now, danger);   // 回復は「祓い」ボタンで手動

    // 祭壇を撃ったか（迷路の仕掛け）
    if (this.world.shootSwitch) {
      for (let i = this.bullets.list.length - 1; i >= 0; i--) {
        const b = this.bullets.list[i];
        if (this.world.shootSwitch(b.p.x, b.p.z)) {
          this.bullets.list.splice(i, 1);
          this.audio.sfx('phase');
          UI.toast('祭壇が灯り、封印がひとつ解けた');
          break;
        }
      }
    }

    // 陽の化身
    this.solar.update(dt, P.pos, now);
    P.setSolar(this.solar.active);
    P.updateSolar(dt, now);
    if (this.solar.active) {
      P.invuln = Math.max(P.invuln, 0.3);      // 無敵を維持
      UI.solar(true, this.solar.remain);
      // 触れた不死者はその場で灰になる
      const burned = this.enemies.burnNear(P.pos.x, P.pos.z, 2.4);
      if (burned > 0) {
        this.stats.kills += burned;
        this.audio.sfx('ash');
        this.particles.emit(P.pos, 10 * burned, { color: [1, 0.85, 0.35], size: 3.6, up: 2.6, yOff: 0.8 });
      }
    } else {
      UI.solar(false, 0);
    }
    const sb = document.getElementById('btn-solar');
    if (sb) sb.disabled = !this.solar.ready;
    const hb = document.getElementById('btn-heal');
    if (hb) hb.disabled = this.miko.healCd > 0;

    // 敵
    this.enemies.update(dt, P.pos, this.world, this.audio);
    const killed = this.enemies.hitTest(this.bullets, (e) => {
      this.stats.kills++;
      this.audio.sfx('ash');
      this.grantExp(expOf(e.kind, false));
    }, this.audio);

    // 被弾
    const hit = this.enemies.touching(P.pos.x, P.pos.z);
    if (hit) {
      const res = P.hurt(100, false);
      if (res === 'evade') UI.toast('かわした');
      else if (res) {
        this.stats.hits++;
        UI.hp(P.hp, P.maxHp);
        this.audio.sfx('hurt');
        if (res === 'lost' && P.hp <= 0) { this.gameOver(); return; }
      }
    }
    const mhit = this.enemies.touching(this.miko.pos.x, this.miko.pos.z);
    if (mhit && this.miko.stagger <= 0) {
      this.miko.knock();
      this.audio.sfx('hit');
      UI.toast('日和が打たれた');
      this.voice.say('きゃっ', 'miko', { rate: 1.2 });
    }
    if (this.miko.sweep > 0) {
      this.enemies.pushAway(this.miko.pos.x, this.miko.pos.z, 1.8, this.miko.sweep * dt * 60);
    }

    // ボス
    if (this.phase === Phase.BOSS && this.boss.alive) {
      const act = this.boss.update(dt, P.pos, this.world, this.audio, p => this.onBossPhase(p));
      // 弾がボスに当たるか
      for (let i = this.bullets.list.length - 1; i >= 0; i--) {
        const b = this.bullets.list[i];
        const dx = b.p.x - this.boss.p.x, dz = b.p.z - this.boss.p.z;
        const dy = b.p.y - 1.4;
        if (dx * dx + dy * dy + dz * dz < 1.6 * 1.6) {
          const ok = this.boss.takeHit(b.dmg * 3, b.pierce);
          this.particles.emit(new THREE.Vector3(this.boss.p.x, 1.4, this.boss.p.z), 5,
            { color: ok ? [1, 0.5, 0.4] : [0.6, 0.5, 0.8], size: 2.4 });
          this.audio.sfx('hit');
          if (!b.pierce) this.bullets.list.splice(i, 1);
          UI.bossBar(this.boss.hp / this.boss.maxHp);
          if (this.boss.hp <= 0) { this.onBossDead(); return; }
        }
      // P3：天井の窓を撃つ
        if (this.boss.phase === 3 && this.world.bossWindow && !this.world.bossWindow.broken) {
          const w = this.world.bossWindow;
          if (b.p.y > 3.2 && Math.hypot(b.p.x - w.x, b.p.z - w.z) < 3.0) {
            w.hp--; this.bullets.list.splice(i, 1);
            this.particles.emit(new THREE.Vector3(w.x, 4, w.z), 8, { color: [0.7, 0.8, 1], size: 2.6 });
            if (w.hp <= 0) {
              this.world.breakBossWindow();
              this.audio.sfx('refill');
              UI.toast('窓が割れた。光の柱に誘い込め');
            }
          }
        }
      }
      if (act === 'claw' && P.hurt(120, true)) {
        this.stats.hits++; UI.hp(P.hp, P.maxHp); this.audio.sfx('hurt');
        if (P.hp <= 0) { this.gameOver(); return; }
      }
    }

    // 進行の切り替え
    if (this.phase === Phase.SURFACE) {
      const e = this.world.entrance;
      if (e && Math.hypot(P.pos.x - e.x, P.pos.z - e.z) < e.r) {
        this.enterDungeon();
      }
      UI.objective(this.sun.isFull ? '満陽。南の縦穴から地下へ' : '陽力 ' + Math.round(this.sun.value) + '％／縦穴は南');
    } else if (this.phase === Phase.DUNGEON) {
      const r = this.world.bossRoom;
      if (r && Math.hypot(P.pos.x - r.x, P.pos.z - r.z) < Math.max(r.w, r.d) * 0.4) {
        this.enterBoss();
      }
      // 仕掛け（鍵・扉・宝箱）
      const acts = this.world.interact(P.pos.x, P.pos.z, this.hasKey);
      acts.forEach(a => {
        if (a === 'key') {
          this.hasKey = true;
          this.audio.sfx('refill');
          this.voice.say('鍵を見つけた', 'hero');
          UI.toast('封印の鍵を手に入れた');
        } else if (a === 'door') {
          this.audio.sfx('phase');
          UI.toast('封印が解けた');
        } else if (a === 'chest') {
          this.audio.sfx('good');
          const exp = 120 + this.floor * 60;
          this.grantExp(exp);
          UI.toast('宝を開けた（経験 ' + exp + '）');
        }
      });
      // 光の罠
      const hz = this.world.onHazard(P.pos.x, P.pos.z);
      if (hz && !this.solar.active) {
        const res = P.hurt(60, true);
        if (res === 'lost' || res === 'guard') {
          UI.hp(P.hp, P.maxHp); this.audio.sfx('hurt');
          if (P.hp <= 0) { this.gameOver(); return; }
        }
      }

      // 入口（最初の部屋の光の輪）に戻れば地上へ引き返せる
      const ex = this.world.exit;
      if (ex && Math.hypot(P.pos.x - ex.x, P.pos.z - ex.z) < ex.r) {
        if (!this._exitHint) {
          this._exitHint = true;
          UI.toast('光の輪の上で少し待つと地上へ戻れます');
        }
        this._exitHold = (this._exitHold || 0) + dt;
        if (this._exitHold > 1.2) {
          this._exitHold = 0; this._exitHint = false;
          this.enterSurface();
          UI.toast('地上へ戻った');
        }
      } else { this._exitHold = 0; this._exitHint = false; }
    } else if (this.phase === Phase.SEAL) {
      const d = Math.hypot(P.pos.x - this.coffin.p.x, P.pos.z - this.coffin.p.z);
      if (this.coffin.state === 'core' && d < 2.4) {
        this.coffin.startQte();
        UI.objective('円が縮みきる瞬間に合わせよ（残り ' + (4 - this.coffin.sealTry + 1) + '）');
      }
      if (this.coffin.state === 'carry') {
        this.phase = Phase.CARRY;
        UI.objective('棺を出口まで押して運べ');
        UI.toast('封印 ' + this.coffin.sealHits + '/4');
        // 運搬中の追加湧き
        this.spawnT = 4;
      }
    } else if (this.phase === Phase.CARRY) {
      // 長押しで鎖を掛け、そのまま歩けば棺が付いてくる
      if (this.input.fire) {
        if (!this.coffin.chained) {
          if (this.coffin.grab(P.pos.x, P.pos.z)) UI.toast('鎖を掛けた。そのまま歩け');
          else if (!this._farHint) { this._farHint = true; UI.toast('棺に近づいて長押し'); }
        }
      } else { this.coffin.release(); this._farHint = false; }
      P.pushing = this.coffin.chained;
      if (this.coffin.chained) {
        this.coffin.drag(P.pos.x, P.pos.z, dt, this.world);
        this.coffin.drawChain(P.pos.x, P.pos.z);
      }
      // 棺への攻撃
      const atk = this.enemies.touching(this.coffin.p.x, this.coffin.p.z);
      if (atk && !this._coffinCd) {
        this._coffinCd = 1.2;
        if (this.coffin.damage()) {
          UI.toast('封印が緩んだ。もう一度封じよ');
          this.coffin.state = 'core'; this.coffin.core.visible = true;
          this.coffin.box.visible = false; this.coffin.sealTry = 0;
          this.phase = Phase.SEAL;
        } else UI.toast('棺が狙われている');
        this.audio.sfx('hit');
      }
      if (this._coffinCd) this._coffinCd = Math.max(0, this._coffinCd - dt);
      // 追加湧き
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 6;
        const sp = this.world.spawnPoints[Math.floor(Math.random() * this.world.spawnPoints.length)];
        if (sp) this.enemies.spawn(Math.random() < 0.5 ? EnemyKind.WALKER : EnemyKind.RUNNER, sp);
      }
      // 出口へ
      const ex = this.world.exit;
      if (ex && Math.hypot(this.coffin.p.x - ex.x, this.coffin.p.z - ex.z) < ex.r) {
        this.enterPile();
      }
    } else if (this.phase === Phase.PILE) {
      if (this.input.fire && !this.coffin.chained) this.coffin.grab(P.pos.x, P.pos.z);
      if (!this.input.fire) this.coffin.release();
      if (this.coffin.chained) {
        this.coffin.drag(P.pos.x, P.pos.z, dt, this.world);
        this.coffin.drawChain(P.pos.x, P.pos.z);
      }
      const push = this.pile.update(dt, now, this.coffin.p);
      this.coffin.p.x += push.x * dt * 8;
      this.coffin.p.z += push.z * dt * 8;
      this.coffin.group.position.copy(this.coffin.p);

      for (let i = this.bullets.list.length - 1; i >= 0; i--) {
        const b = this.bullets.list[i];
        const dx = b.p.x - this.coffin.p.x, dz = b.p.z - this.coffin.p.z;
        if (dx * dx + dz * dz < 1.8 * 1.8 && b.p.y < 2.4) {
          if (this.pile.hitCoffin()) {
            this.audio.sfx('seal');
            this.particles.emit(this.coffin.p, 10, { color: [1, 0.9, 0.6], size: 2.8, up: 2 });
          }
          this.bullets.list.splice(i, 1);
        }
      }

      UI.bossBar(this.pile.hp / 100, this.pile.beaming ? '浄化 照射中' : '照射が途切れている');
      UI.objective(this.pile.beaming
        ? '照射中。暴れたら棺を撃って鎮めよ'
        : '棺を台座へ戻せ（長押しで鎖）');
      if (this.pile.done) this.finishPile();
    }
  }

  enterPile() {
    this.phase = Phase.PILE;
    this.world.buildSurface();
    this.player.reset(new THREE.Vector3(0, 0, 6));
    this.miko.reset(new THREE.Vector3(0, 0, 6));
    this.sunLight.intensity = 3.0;
    this.ambient.intensity = 1.5;
    this.hemi.intensity = 1.1;
    this.gfx.scene.fog.density = 0.008;
    this.enemies.clear();
    this.pile.place(new THREE.Vector3(0, 0, 0));
    this.coffin.p.set(0, 0, 0);
    this.coffin.group.position.copy(this.coffin.p);
    this.pile.begin(this.sun.value);
    const bh2 = document.getElementById('hud-boss');
    if (bh2) { bh2.hidden = false; const nm = bh2.querySelector('.boss-name'); if (nm) nm.textContent = '吸血鬼の思念体'; }
    UI.bossBar(1, '浄化 照射中');
    UI.objective('照射中。暴れたら棺を撃って鎮めよ');
    UI.toast('四方の光が棺を焼く。思念体が暴れたら棺を撃て', 4200);
  }

  /** 経験値を配る（巫女は7割） */
  grantExp(n) {
    const up1 = this.party.hero.gain(n);
    const up2 = this.party.miko.gain(Math.floor(n * 0.7));
    if (up1 || up2) {
      this.applyStats();
      Party.save(this.party);
      const who = [];
      if (up1) who.push('狩人 Lv.' + this.party.hero.lv);
      if (up2) who.push('日和 Lv.' + this.party.miko.lv);
      UI.shout('位 が 上 が っ た');
      this.voice.say('力が湧いてくる', 'hero');
      UI.toast(who.join('　／　') + '　（陣中帳で割り振れます）', 3600);
      this.audio.sfx('good');
    }
  }

  fire(charged) {
    const cost = this.solar.active ? 0 : (charged ? CHARGE_COST : SHOT_COST);
    if (cost > 0 && !this.sun.consume(cost)) {
      this.audio.sfx('empty');
      UI.toast('陽力が足りない。天窓を探せ');
      return;
    }
    const P = this.player;
    const from = P.muzzleWorld();
    const h = this.party.hero;
    let mul = this.solar.active ? SOLAR_DMG_MUL : 1;
    mul *= charged ? h.matkMul : h.atkMul;
    if (Math.random() < h.critRate) { mul *= h.critMul; this._crit = true; } else this._crit = false;
    this.bullets.fire(from, P.aim, charged
      ? { speed: 46, life: 1.4, pierce: true, dmg: 4 * mul, r: 0.4 }
      : { speed: 34, life: 1.2, dmg: 1 * mul, r: 0.2 });
    P.muzzleFlash(charged);
    this.audio.sfx(charged ? 'beam' : 'shot');
    this.shotCd = charged ? 0.5 : 0.14;
    this.particles.emit(from, charged ? 10 : 3, { color: [1, 0.92, 0.6], size: charged ? 3 : 1.8, up: 0.3, yOff: 0 });
  }
}

/* ── 起動 ─────────────────────────────── */
const game = new Game();
window.__g = game;   // 検証・デバッグ用
game.boot().catch(e => {
  const msg = (e && e.message) ? e.message : String(e);
  if (window.__solFail) window.__solFail('起動に失敗しました：' + msg);
  try { UI.init(); UI.toast('起動に失敗しました：' + msg, 8000); } catch (x) {}
  console.error(e);
});

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
