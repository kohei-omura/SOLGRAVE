/* ══════════════════════════════════════════════════════════════
   guildui.js ── ギルドの窓と、世界の地図
     依頼｜仲間｜編成｜交流｜住まい　の五つの頁と、旅の地図。
   ══════════════════════════════════════════════════════════════ */
import { CHARACTERS, CHAR, RANKS, RANK_NAME, RANK_PTS, rankIndex } from './roster.js';
import { GIFTS, RING_PRICE, DATES, talkLine, bondName } from './guild.js';
import { script, placeOf, SceneUI } from './scenes.js';
import { ROUTES, REGIONS, REGION, WORLDS, waysTo, unlocked, MODE_NAME, MODE_ICON } from './atlas.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const hex = n => '#' + (n >>> 0).toString(16).padStart(6, '0');
const RECRUIT_COST = { D: 200, C: 500, B: 1200, A: 2500, S: 5000, SS: 9000, SSS: 15000, LEGEND: 30000 };
const HOUSE_PRICE = { hinomori: 3000, luminas: 8000, elvin: 5000, aqua: 6000, kagura: 7000, frostia: 5000, saharan: 6000, celestia: 12000, necro: 10000, selene: 15000, astra: 20000 };

export class GuildUI {
  constructor(game) {
    this.g = game;
    this.tab = 'quest';
    this.scene = new SceneUI(game);
    const el = document.getElementById('guild');
    el.querySelectorAll('.gd-tab').forEach(b => b.addEventListener('click', () => { this.tab = b.dataset.t; this.render(); }));
    document.getElementById('guild-close').addEventListener('click', () => this.hide());
    document.getElementById('atlas-close').addEventListener('click', () => this.hideMap());
  }
  get G() { return this.g.guild; }
  get P() { return this.g.party; }
  show(tab) { if (tab) this.tab = tab; document.getElementById('guild').hidden = false; this.render(); }
  hide() { document.getElementById('guild').hidden = true; this.g.applyStats(); }
  toast(t, ms) { this.g.toast(t, ms); }

  render() {
    const G = this.G, g = this.g;
    document.querySelectorAll('#guild .gd-tab').forEach(b => b.classList.toggle('on', b.dataset.t === this.tab));
    // 上段：等級と功績
    const nx = G.nextRank();
    const cur = RANK_PTS[G.rank], need = nx ? RANK_PTS[nx] : cur;
    document.getElementById('gd-rank').innerHTML =
      '<div class="gd-badge r-' + G.rank + '">' + (G.rank === 'LEGEND' ? '伝' : G.rank) + '</div>' +
      '<div class="gd-rinfo"><b>冒険者 ' + esc(RANK_NAME[G.rank]) + (G.rank === 'LEGEND' ? '' : ' 級') + '</b>' +
      '<div class="gd-bar"><i style="width:' + (nx ? Math.min(100, (G.pts - cur) / Math.max(1, need - cur) * 100) : 100) + '%"></i></div>' +
      '<span>' + (nx ? '功績 ' + G.pts + ' ／ 次の ' + RANK_NAME[nx] + ' 級まで ' + (need - G.pts) : '頂に立つ者') + '　・　陽貨 ' + g.coin + '</span></div>';
    const body = document.getElementById('gd-body');
    body.innerHTML = this['_' + this.tab]();
    body.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => this.act(b.dataset.act, b.dataset.id, b.dataset.x)));
  }

  /* ── 依頼 ── */
  _quest() {
    const G = this.G, town = G.town;
    const list = G.questsOf(town, this.g.floor);
    const ic = { kill: '⚔', floor: '⬇', boss: '👑', elite: '✦', coin: '◎', rare: '★' };
    return '<div class="gd-note">依頼を受けてから地下へ。達成したらここで報酬を受け取る。</div>' + list.map(q => {
      const done = q.prog >= q.need;
      return '<div class="gd-card' + (done ? ' done' : '') + '"><div class="gd-ic">' + (ic[q.type] || '・') + '</div>' +
        '<div class="gd-main"><b>' + esc(q.title) + '</b><div class="gd-bar s"><i style="width:' + Math.min(100, q.prog / q.need * 100) + '%"></i></div>' +
        '<span>' + q.prog + ' / ' + q.need + '　報酬：陽貨 ' + q.coin + '・功績 ' + q.pts + '</span></div>' +
        (done ? '<button class="gd-btn gold" data-act="claim" data-id="' + q.id + '">受け取る</button>'
          : q.taken ? '<span class="gd-tag">受注中</span>' : '<button class="gd-btn" data-act="take" data-id="' + q.id + '">受ける</button>') + '</div>';
    }).join('') + '<button class="gd-btn ghost" data-act="reroll">依頼を貼り替える（30陽貨）</button>';
  }

  /* ── 仲間：この街・訪れた街で誘える者 ── */
  _recruit() {
    const G = this.G, P = this.P;
    const here = CHARACTERS.filter(c => !c.start && G.visited.indexOf(c.town) >= 0);
    if (!here.length) return '<div class="gd-note">まだ誘える者はいない。新しい街を訪れよう。</div>';
    return '<div class="gd-note">訪れた街で出会った者たち。等級と支度金が足りれば仲間になる（誘った後は交流で絆を深めよう）。</div><div class="gd-grid">' + here.map(c => {
      const have = P.has(c.id), okRank = rankIndex(G.rank) >= rankIndex(c.rank);
      const cost = RECRUIT_COST[c.rank] || 500;
      return '<div class="gd-char' + (have ? ' have' : '') + '">' + this._face(c) +
        '<div class="gd-cname"><b>' + esc(c.name) + '</b><i>' + esc(c.title) + '</i><span>' + (c.g === 'f' ? '♀' : '♂') + ' ' + (c.looks ? '外見' + c.looks + '歳（' + c.age + '歳）' : c.age + '歳') + '・' + esc(REGION[c.town].name) + '</span></div>' +
        (have ? '<span class="gd-tag">仲間</span>'
          : '<button class="gd-btn' + (okRank && this.g.coin >= cost ? ' gold' : '') + '" data-act="recruit" data-id="' + c.id + '"' + (okRank ? '' : ' disabled') + '>' + (okRank ? '誘う ' + cost : RANK_NAME[c.rank] + '級から') + '</button>') + '</div>';
    }).join('') + '</div>';
  }

  /* ── 編成：操作する者と供を選ぶ ── */
  _party() {
    const P = this.P;
    return '<div class="gd-note">先頭（操作する者）と供を選ぶ。先頭は地上・地下どちらでも「交代」ボタンで入れ替えられる。</div><div class="gd-grid">' + P.recruited.map(id => {
      const c = CHAR[id], m = P.members[id];
      const role = id === P.leader ? '先頭' : id === P.companion ? '供' : '';
      return '<div class="gd-char' + (role ? ' sel' : '') + '">' + this._face(c) +
        '<div class="gd-cname"><b>' + esc(c.name) + '　Lv.' + m.lv + '</b><i>' + esc(c.title) + '</i><span>' + (c.role === 'healer' ? '癒し手' : '戦い手') + '</span></div>' +
        '<div class="gd-two">' + (role ? '<span class="gd-tag">' + role + '</span>' : '') +
        (id !== P.leader ? '<button class="gd-btn" data-act="lead" data-id="' + id + '">先頭に</button>' : '') +
        (id !== P.companion && id !== P.leader ? '<button class="gd-btn ghost" data-act="comp" data-id="' + id + '">供に</button>' : '') + '</div></div>';
    }).join('') + '</div>';
  }

  /* ── 交流：話す・贈る・出かける・想いを伝える ── */
  _bond() {
    const G = this.G, P = this.P;
    const list = P.recruited.filter(id => CHAR[id].romance);
    const gifts = Object.keys(G.gifts).filter(k => G.gifts[k] > 0);
    let h = '<div class="gd-note">絆は話す・贈り物・出かけるで深まる。恋人になり、住まいと誓いの指輪があれば結ばれる（この世界では幾人とも結ばれることが認められている）。' +
      '<br>持ち物：' + (gifts.length ? gifts.map(k => k + '×' + G.gifts[k]).join('・') : '贈り物なし') + '　誓いの指輪×' + G.rings + '</div>';
    h += '<div class="gd-shop">' + Object.keys(GIFTS).slice(0, 12).map(k => '<button class="gd-chip" data-act="buygift" data-id="' + k + '">' + k + ' ' + GIFTS[k].price + '</button>').join('') +
      '<button class="gd-chip gold" data-act="buyring">誓いの指輪 ' + RING_PRICE + '</button></div>';
    if (!list.length) return h + '<div class="gd-note">まだ交流できる仲間がいない。</div>';
    return h + list.map(id => {
      const c = CHAR[id], v = G.bondOf(id), married = G.spouses.indexOf(id) >= 0;
      const talked = G.talkedDay[id], dated = G.datedDay[id];
      return '<div class="gd-card bond">' + this._face(c) + '<div class="gd-main"><b>' + esc(c.name) + '　<i class="gd-stage">' + bondName(v, married) + '</i></b>' +
        '<div class="gd-bar heart"><i style="width:' + v + '%"></i></div><span>絆 ' + v + '　好きな物：' + esc((c.likes || []).join('・')) + '</span></div>' +
        '<div class="gd-acts">' +
        '<button class="gd-btn ghost" data-act="talk" data-id="' + id + '"' + (talked ? ' disabled' : '') + '>話す</button>' +
        '<button class="gd-btn ghost" data-act="gift" data-id="' + id + '"' + (gifts.length ? '' : ' disabled') + '>贈る</button>' +
        '<button class="gd-btn ghost" data-act="date" data-id="' + id + '"' + (dated || v < 15 ? ' disabled' : '') + '>出かける</button>' +
        (married ? '' : v >= 70 && G.lovers.indexOf(id) < 0 ? '<button class="gd-btn gold" data-act="confess" data-id="' + id + '">想いを伝える</button>'
          : G.lovers.indexOf(id) >= 0 ? '<button class="gd-btn gold" data-act="propose" data-id="' + id + '">結婚を申し込む</button>' : '') +
        '</div></div>';
    }).join('');
  }

  /* ── 住まい：家を持ち、家族と暮らす ── */
  _home() {
    const G = this.G, town = G.town, price = HOUSE_PRICE[town] || 6000;
    let h = '<div class="gd-note">家を持つと、街の「我が家」に帰れる。伴侶と日々を重ねると、やがて子を授かる（日は、地下から戻る・宿で休むと進む）。</div>';
    h += '<div class="gd-card"><div class="gd-ic">🏠</div><div class="gd-main"><b>' + (G.house ? '我が家：' + esc(REGION[G.house.town].name) : 'まだ家が無い') + '</b><span>' + (G.house ? '街の東、四軒目の家' : REGION[town].name + 'の家　' + price + '陽貨') + '</span></div>' +
      (G.house && G.house.town === town ? '<span class="gd-tag">この街</span>' : '<button class="gd-btn gold" data-act="buyhouse"' + (this.g.coin >= price ? '' : ' disabled') + '>' + (G.house ? 'この街へ越す ' : '買う ') + price + '</button>') + '</div>';
    h += '<div class="gd-sub">家族　―　' + G.day + '日目</div>';
    if (!G.spouses.length) h += '<div class="gd-note">まだ伴侶はいない。</div>';
    G.spouses.forEach(id => { const c = CHAR[id]; h += '<div class="gd-card">' + this._face(c) + '<div class="gd-main"><b>' + esc(c.name) + '</b><span>伴侶</span></div></div>'; });
    G.children.forEach(ch => { h += '<div class="gd-card"><div class="gd-ic">' + (ch.g === 'f' ? '👧' : '👦') + '</div><div class="gd-main"><b>' + esc(ch.name) + '</b><span>' + esc(CHAR[ch.mother] ? CHAR[ch.mother].name : '') + 'との子　' + ch.day + '日目に誕生</span></div></div>'; });
    return h;
  }

  _face(c) {
    const t = c.tint || { hair: c.id === 'hiyori' ? 0x14101a : 0x2a2a34, top: c.id === 'hiyori' ? 0xb3202c : 0x1e2230 };
    return '<div class="gd-face" style="--h:' + hex(t.hair || 0x222222) + ';--c:' + hex(t.top || 0x444444) + ';--e:' + hex(t.eye || 0x3a2a2a) + '"><i></i><b>' + esc(c.short || c.name[0]) + '</b></div>';
  }

  /* ── 操作 ── */
  async act(a, id, x) {
    const G = this.G, P = this.P, g = this.g;
    const pay = n => { if (g.coin < n) { this.toast('陽貨が足りない（' + g.coin + '／' + n + '）'); return false; } g.coin -= n; g.saveProgress(); return true; };
    switch (a) {
      case 'take': { const q = G.questsOf(G.town).find(q => q.id === id); if (q) { q.taken = true; if (q.type === 'floor') q.prog = 0; if (q.type === 'coin') q.base = g.coin; G.save(); this.toast('依頼を受けた：' + q.title); } break; }
      case 'claim': {
        const r = G.claim(G.town, id);
        if (r) { g.coin += r.coin; g.saveProgress(); g.audio.sfx('refill'); this.toast('報酬　陽貨 ' + r.coin + '・功績 ' + r.pts, 2400); if (r.up) { g.shout('冒 険 者 ' + RANK_NAME[r.up] + (r.up === 'LEGEND' ? '' : ' 級')); g.audio.sfx('purify'); } }
        break;
      }
      case 'reroll': if (pay(30)) { G.quests[G.town] = []; G.questsOf(G.town, g.floor); G.save(); } break;
      case 'recruit': {
        const c = CHAR[id]; const cost = RECRUIT_COST[c.rank] || 500;
        if (rankIndex(G.rank) < rankIndex(c.rank)) { this.toast(RANK_NAME[c.rank] + '級から誘える'); break; }
        if (!pay(cost)) break;
        P.add(c); g.outfitMembers(); g.saveParty(); G.addBond(id, 10);
        g.audio.sfx('good'); this.toast(c.name + 'が仲間になった！（編成で先頭・供に選べる）', 3000);
        g.voice.say(talkLine(c, 0, false).slice(0, 40), id);
        break;
      }
      case 'lead': { const comp = P.companion === id ? P.leader : P.companion; await g.setParty(id, comp); this.toast(CHAR[id].name + 'を先頭にした'); break; }
      case 'comp': { await g.setParty(P.leader, id); this.toast(CHAR[id].name + 'を供にした'); break; }
      case 'buygift': if (pay(GIFTS[id].price)) { G.gifts[id] = (G.gifts[id] || 0) + 1; G.save(); } break;
      case 'buyring': if (pay(RING_PRICE)) { G.rings++; G.save(); this.toast('誓いの指輪を手に入れた'); } break;
      case 'talk': {
        const c = CHAR[id]; G.talkedDay[id] = true; const v0 = G.bondOf(id), married = G.spouses.indexOf(id) >= 0;
        if (c.g === 'm' || !c.romance) { const v = G.addBond(id, 3); const line = talkLine(c, v, married); this.toast(c.name + '「' + line + '」', 3600); g.voice.say(line.slice(0, 40), id); break; }
        if (married) { await this.scene.play(script('home', id, {})); G.addBond(id, 2); break; }
        if (v0 < 35) { const line = talkLine(c, v0, false); G.addBond(id, 3); this.toast(c.name + '「' + line + '」', 3600); g.voice.say(line.slice(0, 40), id); break; }
        const hit = await this.scene.play(script('talk', id, { bond: v0 }));
        const v = G.addBond(id, hit === true ? 6 : 3);
        this.toast(hit === true ? c.name + 'は嬉しそうだ（絆 ' + v + '）' : c.name + 'との距離が少し縮まった（絆 ' + v + '）', 2600);
        break;
      }
      case 'gift': {
        const c = CHAR[id], have = Object.keys(G.gifts).filter(k => G.gifts[k] > 0);
        const liked = have.find(k => (c.likes || []).indexOf(k) >= 0);
        const k = liked || have[0]; if (!k) break;
        G.gifts[k]--; const pt = GIFTS[k].pt * (liked ? 2 : 1); G.addBond(id, pt);
        this.toast(c.name + 'に' + k + 'を贈った' + (liked ? '　―　とても喜んでいる！' : '') + '（絆＋' + pt + '）', 3000);
        break;
      }
      case 'date': {
        const c = CHAR[id], reg = REGION[G.town] || REGION.hinomori, place = placeOf(reg.theme && reg.theme.props);
        if (!pay(80)) break;
        G.datedDay[id] = true;
        const v0 = G.bondOf(id);
        const hit = await this.scene.play(script('date', id, { bond: v0, place }));
        const v = G.addBond(id, hit === true ? 12 : 7);
        this.toast(place.name + '。' + (hit === true ? c.name + 'の笑顔が眩しい' : '穏やかな時間が流れた') + '（絆 ' + v + '）', 3600);
        break;
      }
      case 'confess': {
        const c = CHAR[id];
        if (G.bondOf(id) < 70) break;
        await this.scene.play(script('confess', id, {}));
        G.lovers.push(id); G.addBond(id, 3); G.save();
        g.shout(c.name + 'と恋人になった'); g.audio.sfx('purify');
        g.voice.say('……うん。私も、ずっと好きだった', id);
        break;
      }
      case 'propose': {
        const c = CHAR[id];
        if (!G.house) { this.toast('先に住まいを持とう（住まいの頁）'); break; }
        if (G.rings < 1) { this.toast('誓いの指輪が要る（交流の頁で買える）'); break; }
        if (G.bondOf(id) < 90) { this.toast('もう少し絆を深めてから（絆90から）'); break; }
        await this.scene.play(script('propose', id, {}));
        G.rings--; G.lovers = G.lovers.filter(x => x !== id); G.spouses.push(id);
        G._wedDay = G._wedDay || {}; G._wedDay[id] = G.day; G.bond[id] = 100; G.save();
        g.shout(c.name + 'と結ばれた'); g.audio.sfx('purify');
        g.voice.say('はい。これからも、ずっと一緒に', id);
        this.toast('祝言を挙げた。我が家で' + c.name + 'が待っている', 4000);
        break;
      }
      case 'buyhouse': {
        const price = HOUSE_PRICE[G.town] || 6000;
        if (!pay(price)) break;
        G.house = { town: G.town }; G.save();
        this.toast(REGION[G.town].name + 'に家を持った！　街の東、四軒目が我が家', 3600);
        g.audio.sfx('good');
        break;
      }
    }
    this.render();
  }

  /* ══ 世界の地図 ══ */
  showMap() {
    const el = document.getElementById('atlas');
    el.hidden = false;
    this.renderMap();
  }
  hideMap() { document.getElementById('atlas').hidden = true; }
  renderMap() {
    const G = this.G, g = this.g, here = G.town, maxF = g.maxFloor || 1;
    const worlds = Object.keys(WORLDS);
    const body = document.getElementById('atlas-body');
    const X = r => 9 + r.x * 82, Y = r => 13 + r.y * 66;
    body.innerHTML = worlds.map(w => {
      const rs = REGIONS.filter(r => r.world === w);
      const lines = ROUTES.filter(([a, b]) => REGION[a].world === w && REGION[b].world === w).map(([a, b, mode]) => {
        const A = REGION[a], B = REGION[b], on = (a === here || b === here), seen = G.visited.indexOf(a) >= 0 && G.visited.indexOf(b) >= 0;
        return '<line class="' + (on ? 'on ' : '') + (seen ? 'seen ' : '') + 'm-' + mode + '" x1="' + X(A) + '" y1="' + Y(A) + '" x2="' + X(B) + '" y2="' + Y(B) + '"/>';
      }).join('');
      return '<div class="at-world"><div class="at-wname">' + WORLDS[w].name + '</div><div class="at-map w-' + w + '"><svg class="at-routes" viewBox="0 0 100 100" preserveAspectRatio="none">' + lines + '</svg>' + rs.map(r => {
        const open = unlocked(r, maxF), cur = r.id === here, seen = G.visited.indexOf(r.id) >= 0;
        return '<button class="at-node' + (cur ? ' cur' : '') + (open ? '' : ' lock') + (seen ? ' seen' : '') + '" style="left:' + X(r) + '%;top:' + Y(r) + '%" data-id="' + r.id + '">' +
          '<i></i><b>' + (open ? '' : '🔒 ') + esc(r.name) + '</b></button>';
      }).join('') + '</div></div>';
    }).join('');
    body.querySelectorAll('.at-node').forEach(b => b.addEventListener('click', () => this.pickTown(b.dataset.id)));
    document.getElementById('atlas-info').innerHTML = '<b>' + esc(REGION[here].name) + '</b>　' + esc(REGION[here].desc);
  }
  pickTown(id) {
    const G = this.G, g = this.g, r = REGION[id];
    const info = document.getElementById('atlas-info');
    if (id === G.town) { info.innerHTML = '<b>' + esc(r.name) + '</b>　いまいる街'; return; }
    if (!unlocked(r, g.maxFloor || 1)) { info.innerHTML = '<b>' + esc(r.name) + '</b>　地下' + r.unlock + '層まで進むと行けるようになる'; return; }
    const ways = waysTo(G.town, id, G.visited);
    if (!ways.length) { info.innerHTML = '<b>' + esc(r.name) + '</b>　ここからは直接行けない。近くの街を経由するか、一度訪れれば転移陣で行ける'; return; }
    info.innerHTML = '<b>' + esc(r.name) + '</b>　' + esc(r.desc) + '<div class="at-ways">' + ways.map(w =>
      '<button class="gd-btn' + (w.mode === 'gate' ? ' gold' : '') + '" data-mode="' + w.mode + '" data-cost="' + w.cost + '">' + MODE_ICON[w.mode] + ' ' + MODE_NAME[w.mode] + (w.cost ? '　' + w.cost + '陽貨' : '') + '</button>').join('') + '</div>';
    info.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', async () => {
      const cost = +b.dataset.cost;
      if (g.coin < cost) { this.toast('陽貨が足りない'); return; }
      g.coin -= cost; g.saveProgress();
      this.hideMap();
      await g.travelTo(id, b.dataset.mode);
    }));
  }
}
