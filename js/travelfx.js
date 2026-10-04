/* ══════════════════════════════════════════════════════════════
   travelfx.js ── 旅の演出
     地図の上を、出発の街から行き先の街へ。手段ごとに背景が変わる。
       徒歩・馬車：丘が流れる　船：波　飛空艇：雲　星船：星の流れ　転移陣：回る魔法陣
     演出が終わって到着の輪が広がる間に、街の入れ替えを済ませる。
   ══════════════════════════════════════════════════════════════ */
import { MODE_ICON } from './atlas.js';

export const HOW = { walk: '街道を歩いて', carriage: '馬車に揺られて', ship: '船で海を渡り', airship: '飛空艇で雲を越え', starship: '星船で星の海を渡り', gate: '転移陣をくぐって' };
const DUR = { walk: 3000, carriage: 2600, ship: 3000, airship: 3000, starship: 2400, gate: 1800 };
const hex = n => '#' + ((n >>> 0) & 0xffffff).toString(16).padStart(6, '0');
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const rnd = (() => { let s = 20240; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

function hills(col, amp, base) {
  let d = 'M0 40 L0 ' + base;
  for (let i = 0; i < 4; i++) { const x = i * 25; d += ' Q' + (x + 12.5) + ' ' + (base - amp * (0.6 + rnd() * 0.8)) + ' ' + (x + 25) + ' ' + (base - 2 + rnd() * 4); }
  d += ' L100 40Z';
  return '<svg viewBox="0 0 200 40" preserveAspectRatio="none"><g fill="' + col + '"><path d="' + d + '"/><path transform="translate(100 0)" d="' + d + '"/></g></svg>';
}
function waves(col, amp) {
  let d = 'M0 40 L0 20';
  for (let i = 0; i < 4; i++) d += ' q12.5 ' + (-amp) + ' 25 0 t0 0';
  const one = 'M0 20 q12.5 ' + (-amp) + ' 25 0 t25 0 t25 0 t25 0 L100 40 L0 40Z';
  return '<svg viewBox="0 0 200 40" preserveAspectRatio="none"><g fill="' + col + '"><path d="' + one + '"/><path transform="translate(100 0)" d="' + one + '"/></g></svg>';
}

function scene(mode, dest) {
  const sky = hex(dest.theme.sky);
  let h = '';
  if (mode === 'walk' || mode === 'carriage') {
    h += '<div class="tf-sun"></div>';
    h += '<div class="tf-layer l1" style="--sp:' + (mode === 'carriage' ? 26 : 38) + 's">' + hills('rgba(40,60,70,.55)', 14, 24) + '</div>';
    h += '<div class="tf-layer l2" style="--sp:' + (mode === 'carriage' ? 14 : 22) + 's">' + hills('rgba(22,34,40,.8)', 12, 28) + '</div>';
    h += '<div class="tf-layer l3" style="--sp:' + (mode === 'carriage' ? 7 : 12) + 's">' + hills('rgba(8,14,16,.95)', 8, 32) + '</div>';
    for (let i = 0; i < 14; i++) h += '<i class="tf-dust" style="left:' + (rnd() * 100) + '%;top:' + (55 + rnd() * 40) + '%;animation-delay:' + (-rnd() * 4) + 's;animation-duration:' + (2 + rnd() * 2) + 's"></i>';
  } else if (mode === 'ship') {
    h += '<div class="tf-moon"></div>';
    h += '<div class="tf-layer l1" style="--sp:18s">' + waves('rgba(60,120,190,.45)', 3) + '</div>';
    h += '<div class="tf-layer l2" style="--sp:11s">' + waves('rgba(30,80,150,.6)', 4) + '</div>';
    h += '<div class="tf-layer l3" style="--sp:6s">' + waves('rgba(10,40,90,.85)', 5) + '</div>';
    for (let i = 0; i < 18; i++) h += '<i class="tf-spark" style="left:' + (rnd() * 100) + '%;top:' + (62 + rnd() * 34) + '%;animation-delay:' + (-rnd() * 3) + 's"></i>';
  } else if (mode === 'airship') {
    for (let i = 0; i < 9; i++) { const w = 90 + rnd() * 170; h += '<i class="tf-cloud" style="top:' + (rnd() * 88) + '%;width:' + w + 'px;height:' + (w * 0.32) + 'px;animation-duration:' + (5 + rnd() * 7) + 's;animation-delay:' + (-rnd() * 8) + 's;opacity:' + (0.25 + rnd() * 0.45) + '"></i>'; }
  } else if (mode === 'starship') {
    h += '<div class="tf-neb"></div>';
    for (let i = 0; i < 46; i++) { const w = 24 + rnd() * 120; h += '<i class="tf-streak" style="top:' + (rnd() * 100) + '%;width:' + w + 'px;animation-duration:' + (0.5 + rnd() * 0.9) + 's;animation-delay:' + (-rnd() * 1.4) + 's;opacity:' + (0.3 + rnd() * 0.7) + '"></i>'; }
  } else {
    h += '<div class="tf-ring r1"></div><div class="tf-ring r2"></div><div class="tf-ring r3"></div><div class="tf-beam"></div>';
    for (let i = 0; i < 26; i++) h += '<i class="tf-rune" style="left:' + (rnd() * 100) + '%;animation-delay:' + (-rnd() * 2.4) + 's;animation-duration:' + (1.4 + rnd() * 1.4) + 's"></i>';
  }
  return h;
}

export class TravelFx {
  /** from→to を演出。during は到着の見せ場の間に走らせる処理（街の入れ替え） */
  play(from, to, mode, during) {
    return new Promise(resolve => {
      const root = document.getElementById('app') || document.body;
      const old = document.getElementById('travel'); if (old) old.remove();
      const el = document.createElement('div');
      el.id = 'travel'; el.className = 'tf tf-' + mode;
      const sameWorld = from && to && from.world === to.world;
      const P = (r, dx, dy) => sameWorld ? [8 + r.x * 84, 8 + r.y * 44] : [dx, dy];
      const A = P(from || to, 16, 40), B = P(to, 84, 20);
      const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, nx = -(B[1] - A[1]), ny = B[0] - A[0], nl = Math.hypot(nx, ny) || 1;
      const bend = mode === 'gate' ? 0 : 7;
      const C = [mx + nx / nl * bend, my + ny / nl * bend];
      const dPath = 'M' + A[0] + ' ' + A[1] + ' Q' + C[0] + ' ' + C[1] + ' ' + B[0] + ' ' + B[1];
      const others = sameWorld ? '' : '';
      el.innerHTML =
        '<div class="tf-bg" style="--sky:' + hex(to.theme.sky) + '"></div>' +
        '<div class="tf-scene">' + scene(mode, to) + '</div>' +
        '<svg class="tf-map" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">' +
          '<path class="tf-path" d="' + dPath + '"/><path class="tf-trail" d="' + dPath + '"/>' +
          '<g class="tf-pt a" transform="translate(' + A[0] + ' ' + A[1] + ')"><circle r="1.6"/><text y="5.2">' + (from ? from.name : '') + '</text></g>' +
          '<g class="tf-pt b" transform="translate(' + B[0] + ' ' + B[1] + ')"><circle class="ring" r="1.6"/><circle r="1.6"/><text y="5.2">' + to.name + '</text></g>' +
          '<text class="tf-veh" font-size="5" text-anchor="middle" dominant-baseline="middle">' + (MODE_ICON[mode] || '') + '</text>' +
        '</svg>' +
        '<div class="tf-text"><div class="tf-how">' + (HOW[mode] || '') + '</div><div class="tf-to">' + to.name + '</div></div>' +
        '<div class="tf-flash"></div><div class="tf-vig"></div>';
      root.appendChild(el);
      const path = el.querySelector('.tf-trail'), veh = el.querySelector('.tf-veh'), bpt = el.querySelector('.tf-pt.b');
      const L = path.getTotalLength();
      path.style.strokeDasharray = '0 ' + L;
      let skip = false; el.addEventListener('click', () => { skip = true; });
      requestAnimationFrame(() => el.classList.add('on'));
      const dur = DUR[mode] || 2600, t0 = performance.now() + 450;
      let arrived = false;
      const finish = async () => {
        el.classList.add('arrive');
        const t1 = performance.now();
        try { if (during) await during(); } catch (e) { console.error(e); }
        const wait = Math.max(0, 900 - (performance.now() - t1));
        setTimeout(() => {
          el.classList.add('out');
          setTimeout(() => { el.remove(); resolve(); }, 600);
        }, wait);
      };
      const tick = now => {
        let p = (now - t0) / dur; if (skip) p = 1;
        if (p < 0) return requestAnimationFrame(tick);
        p = Math.min(1, p);
        const e = ease(p), pt = path.getPointAtLength(L * e);
        path.style.strokeDasharray = (L * e) + ' ' + L;
        const bob = (mode === 'walk' || mode === 'carriage') ? Math.sin(p * 46) * 0.5 : mode === 'ship' ? Math.sin(p * 18) * 0.6 : 0;
        veh.setAttribute('x', pt.x); veh.setAttribute('y', pt.y + bob - 2.4);
        if (p >= 1 && !arrived) { arrived = true; veh.style.opacity = 0; bpt.classList.add('hit'); return finish(); }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
}
