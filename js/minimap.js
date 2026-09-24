/* ══════════════════════════════════════════════════════════════
   minimap.js ── 右上の見取り図
     はじめは何も描かれておらず、歩いた場所だけが浮かび上がる。
   ══════════════════════════════════════════════════════════════ */

export class Minimap {
  constructor() {
    this.cv = null;
    this.ctx = null;
    this.seen = new Set();      // 踏破した格子
    this.cell = 3.2;            // 記録する粗さ（世界の単位）
    this.scale = 0.9;           // 描く倍率
    this.enabled = true;
    this.world = null;
    this._t = 0;
  }

  attach() {
    this.cv = document.getElementById('minimap');
    if (!this.cv) return false;
    this.ctx = this.cv.getContext('2d');
    return true;
  }

  /** 階が変わったら記録を消す */
  reset(world) {
    this.seen.clear();
    this.world = world;
    this._bounds = null;
  }

  _key(x, z) {
    return Math.round(x / this.cell) + ',' + Math.round(z / this.cell);
  }

  /**
   * いま踏み入れている区画を覚える。
   * 点を塗るのではなく「部屋」「通路」という単位で覚えるので、
   * 部屋どうしの壁が黒いまま残り、繋がって見えることがない。
   */
  mark(px, pz) {
    const w = this.world;
    if (!w || !w.mapAreas) return;
    w.mapAreas.forEach((a, i) => {
      if (this.seen.has(i)) return;
      if (Math.abs(px - a.x) < a.w / 2 - 0.5 && Math.abs(pz - a.z) < a.d / 2 - 0.5) {
        this.seen.add(i);
      }
    });
  }

  /** 地図の広がりを求める */
  _calcBounds() {
    const w = this.world;
    if (!w) return null;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const add = (x, z, m) => {
      x0 = Math.min(x0, x - m); x1 = Math.max(x1, x + m);
      z0 = Math.min(z0, z - m); z1 = Math.max(z1, z + m);
    };
    (w.mapAreas || []).forEach(a => add(a.x, a.z, Math.max(a.w, a.d) / 2 + 3));
    if (!isFinite(x0) && w.rooms) w.rooms.forEach(r => add(r.x, r.z, Math.max(r.w, r.d) / 2 + 4));
    return { x0, x1, z0, z1 };
  }

  draw(px, pz, camYaw, opts) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, W = this.cv.width, H = this.cv.height;
    c.clearRect(0, 0, W, H);

    if (!this._bounds) this._bounds = this._calcBounds();
    const B = this._bounds;
    if (!B) return;

    const spanX = (B.x1 - B.x0) || 1, spanZ = (B.z1 - B.z0) || 1;
    const k = Math.min(W / spanX, H / spanZ) * this.scale;
    const ox = W / 2 - ((B.x0 + B.x1) / 2) * k;
    const oz = H / 2 - ((B.z0 + B.z1) / 2) * k;
    const toX = x => ox + x * k;
    const toZ = z => oz + z * k;

    // 背景
    c.fillStyle = 'rgba(6,7,10,0.55)';
    c.fillRect(0, 0, W, H);

    // 踏み入れた区画だけを描く。区画の外は黒いまま＝壁
    const w = this.world;
    const areas = (w && w.mapAreas) || [];
    const inset = 0.6;
    this.seen.forEach(i => {
      const a = areas[i];
      if (!a) return;
      c.fillStyle = (a.kind === 'boss') ? 'rgba(210,170,90,0.32)'
        : (a.kind === 'hall') ? 'rgba(150,168,196,0.34)'
        : 'rgba(176,194,220,0.40)';
      const x = toX(a.x - a.w / 2 + inset), z = toZ(a.z - a.d / 2 + inset);
      const ww = Math.max(1, (a.w - inset * 2) * k), dd = Math.max(1, (a.d - inset * 2) * k);
      c.fillRect(x, z, ww, dd);
      if (a.kind !== 'hall') {
        c.strokeStyle = (a.kind === 'boss') ? 'rgba(201,162,39,0.75)' : 'rgba(201,162,39,0.45)';
        c.lineWidth = 1;
        c.strokeRect(x, z, ww, dd);
      }
    });

    // 目印
    // 目印を出すかどうか（踏み入れた区画の近くだけ）
    const inSeen = (x, z) => {
      const ar = (w && w.mapAreas) || [];
      for (const i of this.seen) {
        const a = ar[i];
        if (!a) continue;
        if (Math.abs(x - a.x) < a.w / 2 + 3 && Math.abs(z - a.z) < a.d / 2 + 3) return true;
      }
      return false;
    };

    const dot = (x, z, col, rad, ring) => {
      c.beginPath(); c.arc(toX(x), toZ(z), rad, 0, 6.284);
      c.fillStyle = col; c.fill();
      if (ring) {
        c.strokeStyle = col; c.lineWidth = 1.4;
        c.beginPath();
        c.arc(toX(x), toZ(z), rad + 2.6 + Math.sin(this._t * 3) * 1.2, 0, 6.284);
        c.stroke();
      }
    };
    if (w.warp && inSeen(w.warp.x, w.warp.z)) dot(w.warp.x, w.warp.z, '#9ad8ff', 3);
    if (w.rest && inSeen(w.rest.x, w.rest.z)) dot(w.rest.x, w.rest.z, '#9affd0', 3);
    if (w.grandDoor && inSeen(w.grandDoor.x, w.grandDoor.z))
      dot(w.grandDoor.x, w.grandDoor.z, w.grandDoor.open ? '#ffd24a' : '#ff5a70', 3.4, !w.grandDoor.open);
    (w.gimmicks && w.gimmicks.chests || []).forEach(ch => {
      if (!ch.opened && inSeen(ch.x, ch.z)) dot(ch.x, ch.z, '#e8c060', 2.4);
    });
    // 仕掛けの目印（踏み入れた所だけ）
    if (w.gimmickMarks) w.gimmickMarks().forEach(m => { if (inSeen(m.x, m.z)) dot(m.x, m.z, m.c, 2.8, m.ring); });
    if (opts && opts.elite && inSeen(opts.elite.x, opts.elite.z))
      dot(opts.elite.x, opts.elite.z, '#ff8a3a', 3.2, true);
    if (opts && opts.secret && inSeen(opts.secret.x, opts.secret.z))
      dot(opts.secret.x, opts.secret.z, '#ffd700', 3.6, true);

    // 自分（向き付き）
    const mx = toX(px), mz = toZ(pz);
    c.save();
    c.translate(mx, mz);
    c.rotate(-(camYaw || 0));
    c.beginPath();
    c.moveTo(0, -5.4); c.lineTo(3.6, 4.2); c.lineTo(0, 2.2); c.lineTo(-3.6, 4.2);
    c.closePath();
    c.fillStyle = '#fff2c8'; c.fill();
    c.restore();

    // 縁
    c.strokeStyle = 'rgba(201,162,39,0.45)';
    c.lineWidth = 1.2;
    c.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  tick(dt) { this._t += dt; }
}
