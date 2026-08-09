/* ══════════════════════════════════════════════════════════════
   menu.js ── 陣中帳（メニュー画面）
     人物の姿を大きく映し、能力値の割り振りを行う。
     姿は本編と同じ模型を、別の場面で回しながら描く。
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { STAT_KEYS, STAT_INFO, expToNext, MAX_LV } from './stats.js';
import { JOBS, SKILLS, GEAR, SLOTS, skillsOf, canLearn } from './jobs.js';

/* いまの値が実際に何をもたらしているかを言葉にする */
function effectOf(k, c, who) {
  const v = c.get(k);
  const pct = (x) => Math.round(x * 100) + '%';
  if (who === 'miko') {
    switch (k) {
      case 'MATK': return '一度に癒す心 ' + (1 + Math.floor(v / 55)) + 'つ';
      case 'MP':   return '霊力 ' + c.maxMp + '（祓い1回 ' + Math.max(6, 12 - Math.floor(v / 90)) + ' 消費）';
      case 'DEX':  return '祓いの待機 ' + (Math.max(3, 12 / (1 + v * 0.009))).toFixed(1) + '秒';
      case 'MDEF': return '加護 ' + pct(Math.min(0.5, v * 0.0035)) + ' × ' + (3 + v * 0.02).toFixed(0) + '秒';
      case 'AGI':  return '追従の速さ ×' + Math.min(2.0, 1 + v * 0.008).toFixed(2);
      case 'LUK':  return '倍で癒す割合 ' + pct(Math.min(0.5, v * 0.0035));
      case 'ATK':  return '杖の打ち払い ' + (v * 0.02).toFixed(2);
      case 'DEF':  case 'HP': return 'よろけからの立ち直り ×' + (1 + c.get('DEF') * 0.02 + c.get('HP') * 0.008).toFixed(2);
      default: return '—';
    }
  }
  switch (k) {
    case 'HP':   return '心 ' + c.maxHp + 'つ';
    case 'ATK':  return '弾の威力 ×' + c.atkMul.toFixed(2);
    case 'MATK': return '溜め弾の威力 ×' + c.matkMul.toFixed(2);
    case 'DEF':  return '物理の傷 ' + pct(c.defCut) + ' 軽減' + (c.defCut >= 0.78 ? '（上限）' : '');
    case 'MDEF': return '霊的な傷 ' + pct(c.mdefCut) + ' 軽減' + (c.mdefCut >= 0.78 ? '（上限）' : '');
    case 'AGI':  return '速さ ×' + c.speedMul.toFixed(2) + (c.speedMul >= 2.1 ? '（上限）' : '') + ' ／ 回避 ' + pct(c.evade);
    case 'CRI':  return '会心 ' + pct(c.critRate) + (c.critRate >= 0.6 ? '（上限）' : '') + ' ／ 倍率 ×' + c.critMul.toFixed(2);
    case 'DEX':  return '溜め ' + (1.1 / c.chargeMul).toFixed(2) + '秒';
    case 'LUK':  return '会心倍率 ×' + c.critMul.toFixed(2) + ' ／ 拾い物 ×' + c.dropMul.toFixed(2);
    case 'MP':   return '霊力 ' + c.maxMp + '（技で使用）';
    default: return '—';
  }
}

export class Menu {
  constructor(party, makers) {
    this.party = party;          // { hero: Character, miko: Character }
    this.makers = makers;        // { hero: ()=>Group, miko: ()=>Group }
    this.who = 'hero';
    this.page = 'stat';
    this.open = false;
    this._raf = 0;
    this._built = false;
  }

  /** 姿を映すための小さな場面を用意する */
  _setupStage() {
    const cv = document.getElementById('menu-canvas');
    if (!cv) return false;
    this.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.5;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    this.camera.position.set(0, 1.5, 5.4);
    this.camera.lookAt(0, 1.3, 0);

    // 見栄えのする三点照明
    const key = new THREE.DirectionalLight(0xfff0d8, 3.4);
    key.position.set(3, 5, 4); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fb6d8, 1.5);
    fill.position.set(-4, 2, 3); this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffc978, 2.6);
    rim.position.set(-2, 3, -5); this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight(0x8894a8, 1.4));

    // 足元の円座
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 40),
      new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    this.scene.add(disc);

    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    this._built = true;
    return true;
  }

  _swapModel() {
    if (!this._built) return;
    while (this.holder.children.length) this.holder.remove(this.holder.children[0]);
    const mk = this.makers[this.who];
    if (mk) {
      const g = mk();
      if (g) this.holder.add(g);
    }
  }

  show(who) {
    if (who) this.who = who;
    if (!this._built && !this._setupStage()) return;
    const el = document.getElementById('menu');
    if (el) el.hidden = false;
    this.open = true;
    this._swapModel();
    this.render();
    this._loop();
  }

  hide() {
    this.open = false;
    cancelAnimationFrame(this._raf);
    const el = document.getElementById('menu');
    if (el) el.hidden = true;
  }

  _loop() {
    cancelAnimationFrame(this._raf);
    const step = () => {
      if (!this.open) return;
      this._raf = requestAnimationFrame(step);
      const cv = this.renderer.domElement;
      const w = cv.clientWidth, h = cv.clientHeight;
      if (w > 0 && h > 0 && (cv.width !== w || cv.height !== h)) {
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
      }
      this.holder.rotation.y += 0.006;
      this.renderer.render(this.scene, this.camera);
    };
    step();
  }

  setPage(p) { this.page = p; this.render(); }

  /** 数値の表示を組み立てる */
  render() {
    const c = this.party[this.who];
    if (!c) return;

    // 誰を見ているか
    document.querySelectorAll('.menu-tab').forEach(b => {
      b.classList.toggle('on', b.dataset.who === this.who);
    });

    const nameEl = document.getElementById('menu-name');
    if (nameEl) nameEl.textContent = c.name;
    const jobEl = document.getElementById('menu-job');
    if (jobEl) jobEl.textContent = c.job || '（職はまだ定まっていない）';

    const lvEl = document.getElementById('menu-lv');
    if (lvEl) lvEl.textContent = c.lv;
    const need = expToNext(c.lv);
    const expEl = document.getElementById('menu-exp');
    if (expEl) {
      expEl.textContent = (c.lv >= MAX_LV) ? '極まった' : (c.exp + ' / ' + need);
    }
    const barEl = document.getElementById('menu-expbar');
    if (barEl) barEl.style.width = (c.lv >= MAX_LV ? 100 : Math.min(100, c.exp / need * 100)) + '%';

    const ptEl = document.getElementById('menu-points');
    if (ptEl) {
      ptEl.textContent = c.points;
      ptEl.parentNode.classList.toggle('has', c.points > 0);
    }

    // 頁の切り替え
    document.querySelectorAll('.menu-page').forEach(b => b.classList.toggle('on', b.dataset.page === this.page));
    const panes = { stat: 'menu-stats', skill: 'menu-skill', gear: 'menu-gear', job: 'menu-job' };
    Object.keys(panes).forEach(k => {
      const el = document.getElementById(panes[k]);
      if (el) el.hidden = (k !== this.page);
    });
    if (this.page === 'skill') { this._renderSkill(c); return; }
    if (this.page === 'gear')  { this._renderGear(c); return; }
    if (this.page === 'job')   { this._renderJob(c); return; }

    const body = document.getElementById('menu-stats');
    if (!body) return;
    body.innerHTML = STAT_KEYS.map(k => {
      const info = STAT_INFO[k];
      const canUp = c.points > 0;
      return '<div class="st-row">' +
        '<span class="st-key">' + k + '</span>' +
        '<span class="st-name">' + info.name + '</span>' +
        '<span class="st-val">' + c.get(k) +
          (c.alloc[k] ? '<i class="st-add">+' + c.alloc[k] + '</i>' : '') + '</span>' +
        '<button class="st-btn" data-k="' + k + '"' + (canUp ? '' : ' disabled') + '>＋</button>' +
        '<div class="st-desc"><b class="st-eff">' + effectOf(k, c, this.who) + '</b>　' + info.desc + '</div>' +
        '</div>';
    }).join('');

    body.querySelectorAll('.st-btn').forEach(b => {
      b.addEventListener('click', () => {
        if (c.spend(b.dataset.k, 1)) {
          this.render();
          if (this.onChange) this.onChange();
        }
      });
    });
  }

  /* ── 技 ── */
  _renderSkill(c) {
    const el = document.getElementById('menu-skill');
    if (!el) return;
    if (!c.job) { el.innerHTML = '<div class="rec-empty">まず「職」を定めてください</div>'; return; }
    const list = skillsOf(c.job);
    el.innerHTML =
      '<div class="menu-pt' + (c.skillPts > 0 ? ' has' : '') + '"><span>覚えられる技の点</span><b>' + c.skillPts + '</b></div>' +
      list.map(sk => {
        const has = !!c.learned[sk.id];
        const ck = canLearn(sk.id, c.lv, c.learned);
        const cls = has ? 'learned' : (ck.ok ? '' : 'locked');
        const kind = sk.kind === 'active' ? '技' : '常';
        const cost = sk.kind === 'active' ? ('　霊力' + sk.cost + '／' + sk.cd + '秒') : '';
        return '<div class="sk-row ' + cls + '">' +
          '<span class="sk-nm">' + esc(sk.name) + '<i>' + kind + '</i></span>' +
          (has ? '<span class="sk-have">習得</span>'
               : '<button class="sk-btn" data-id="' + sk.id + '"' + (ck.ok && c.skillPts > 0 ? '' : ' disabled') + '>覚える</button>') +
          '<div class="sk-ds">' + esc(sk.desc) + cost +
            (has ? '' : (ck.ok ? '' : '　<span style="color:var(--shu)">' + esc(ck.why) + '</span>')) + '</div>' +
          '</div>';
      }).join('');
    el.querySelectorAll('.sk-btn').forEach(b => {
      b.addEventListener('click', () => {
        const r = c.learn(b.dataset.id);
        if (r.ok) { this.render(); if (this.onChange) this.onChange(); }
      });
    });
  }

  /* ── 装備 ── */
  _renderGear(c) {
    const el = document.getElementById('menu-gear');
    if (!el) return;
    const modTxt = (g) => Object.keys(g.mods || {}).filter(k => g.mods[k])
      .map(k => k + '+' + g.mods[k]).join(' ');
    el.innerHTML = SLOTS.map(sl => {
      const cur = c.gear[sl.id];
      const owned = c.bag.filter(id => GEAR[id] && GEAR[id].slot === sl.id);
      return '<div class="gr-slot"><div class="gr-hd">' + sl.name + '</div>' +
        '<div class="gr-cur">' + (cur && GEAR[cur] ? esc(GEAR[cur].name) + '<span class="gr-mod">' + modTxt(GEAR[cur]) + '</span>' : '—') + '</div>' +
        '<div class="gr-list">' +
          (owned.length ? owned.map(id =>
            '<button class="gr-item' + (id === cur ? ' on' : '') + '" data-id="' + id + '">' +
            esc(GEAR[id].name) + '<span class="gr-mod">' + modTxt(GEAR[id]) + '</span></button>').join('')
            : '<span style="font-size:11px;color:var(--mut)">持っていません</span>') +
        '</div></div>';
    }).join('');
    el.querySelectorAll('.gr-item').forEach(b => {
      b.addEventListener('click', () => {
        if (c.equip(b.dataset.id)) { this.render(); if (this.onChange) this.onChange(); }
      });
    });
  }

  /* ── 職 ── */
  _renderJob(c) {
    const el = document.getElementById('menu-job');
    if (!el) return;
    const keys = Object.keys(JOBS);
    el.innerHTML =
      '<div class="note" style="margin-bottom:8px">職を選ぶと伸び方が変わり、その職の技を覚えられます。' +
      (c.job ? '変えると覚えた技は失われます。' : '') + '</div>' +
      keys.map(k => {
        const j = JOBS[k];
        const bias = Object.keys(j.bias).filter(x => j.bias[x] >= 1.1)
          .map(x => x + '×' + j.bias[x].toFixed(2)).join('　');
        return '<div class="jb-row' + (c.job === k ? ' on' : '') + '" data-job="' + k + '">' +
          '<div class="jb-nm"><b>' + esc(j.short) + '</b>' + esc(j.name) + '</div>' +
          '<div class="jb-ds">' + esc(j.desc) + '</div>' +
          '<div class="jb-bias">' + bias + '</div></div>';
      }).join('');
    el.querySelectorAll('.jb-row').forEach(b => {
      b.addEventListener('click', () => {
        const k = b.dataset.job;
        if (c.job === k) return;
        if (c.job && Object.keys(c.learned).length) {
          if (!confirm('職を変えると、覚えた技は失われます。よろしいですか。')) return;
        }
        // 覚えた技を返す
        const back = Object.keys(c.learned).length;
        c.learned = {};
        c.skillPts += back;
        c.job = k;
        this.render();
        if (this.onChange) this.onChange();
      });
    });
  }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g,
    m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
