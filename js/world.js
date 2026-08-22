/* ══════════════════════════════════════════════════════════════
   world.js ── 地上と地下ダンジョンの生成
     部屋5〜8＋通路。天窓（シャフト）でのみ陽力を補給できる
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { stoneMaterial, metalMaterial, glowMaterial, noiseTexture } from './gfx.js';

const WALL_H = 6.5;      // 天井を高く
const T = 1.0;   // 壁の厚み

function rngFactory(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export class World {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality || 'mid';
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.colliders = [];     // {min:{x,z}, max:{x,z}}
    this.ramps = [];         // 登れる場所 {x1,z1,x2,z2,y1,y2,w}
    this.plats = [];         // 平らな高台 {x,z,r,y}
    this.shafts = [];        // 天窓 {x,z,r,mesh,light}
    this.rooms = [];
    this.spawnPoints = [];
    this.exit = null;        // 地上への出口
    this.bossRoom = null;
    this.isSurface = false;
  }

  clear() {
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const m = Array.isArray(o.material) ? o.material : [o.material];
        m.forEach(x => { if (x.map) x.map.dispose(); x.dispose(); });
      }
    });
    this.scene.remove(this.group);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.colliders = []; this.shafts = []; this.rooms = []; this.torches = [];
    this._batches = null; this._planes = null;
    this.ramps = []; this.plats = [];
    this.gimmicks = null; this.wards = null; this.wardRing = null; this.sanctuary = null;
    this.warp = null; this.warpRings = null; this.warpCol = null;
    this.grandDoor = null; this.rest = null; this.doorCrest = null;
    this.bossSeal = null; this.restRing = null; this.restOrb = null;
    this.spawnPoints = []; this.exit = null; this.bossRoom = null;
  }

  /** 壁などをためておき、あとで1つにまとめて描く（描画呼び出しを減らす） */
  _batch(w, h, d, x, y, z, mat, collide) {
    if (!this._batches) this._batches = new Map();
    let arr = this._batches.get(mat);
    if (!arr) { arr = []; this._batches.set(mat, arr); }
    arr.push([w, h, d, x, y, z]);
    if (collide) {
      this.colliders.push({ min: { x: x - w / 2, z: z - d / 2 },
                            max: { x: x + w / 2, z: z + d / 2 } });
    }
  }

  /** 平らな面（床・天井）をためる */
  _batchPlane(w, d, x, y, z, faceUp, mat) {
    if (!this._planes) this._planes = new Map();
    let arr = this._planes.get(mat);
    if (!arr) { arr = []; this._planes.set(mat, arr); }
    arr.push([w, d, x, y, z, faceUp]);
  }

  /** ためた形を材質ごとに1つのメッシュへ */
  _flushBatches() {
    if (!this._batches) return;
    this._batches.forEach((arr, mat) => {
      if (!arr.length) return;
      let total = 0, idxTotal = 0;
      const geos = arr.map(([w, h, d, x, y, z]) => {
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(x, y, z);
        total += g.attributes.position.count;
        idxTotal += g.index ? g.index.count : 0;
        return g;
      });
      const pos = new Float32Array(total * 3);
      const nor = new Float32Array(total * 3);
      const uv  = new Float32Array(total * 2);
      const idx = new Uint32Array(idxTotal);
      let vo = 0, io = 0;
      geos.forEach(g => {
        pos.set(g.attributes.position.array, vo * 3);
        nor.set(g.attributes.normal.array, vo * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
        const ia = g.index.array;
        for (let i = 0; i < ia.length; i++) idx[io + i] = ia[i] + vo;
        vo += g.attributes.position.count;
        io += ia.length;
        g.dispose();
      });
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      out.setIndex(new THREE.BufferAttribute(idx, 1));
      const m = new THREE.Mesh(out, mat);
      m.castShadow = false; m.receiveShadow = true;
      this.group.add(m);
      arr.length = 0;
    });
    this._batches.clear();

    if (this._planes) {
      this._planes.forEach((arr, mat) => {
        if (!arr.length) return;
        let total = 0, idxTotal = 0;
        const geos = arr.map(([w, d, x, y, z, up]) => {
          const g = new THREE.PlaneGeometry(w, d);
          g.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
          g.translate(x, y, z);
          total += g.attributes.position.count;
          idxTotal += g.index ? g.index.count : 0;
          return g;
        });
        const pos = new Float32Array(total * 3);
        const nor = new Float32Array(total * 3);
        const uv  = new Float32Array(total * 2);
        const idx = new Uint32Array(idxTotal);
        let vo = 0, io = 0;
        geos.forEach(g => {
          pos.set(g.attributes.position.array, vo * 3);
          nor.set(g.attributes.normal.array, vo * 3);
          if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
          const ia = g.index.array;
          for (let i = 0; i < ia.length; i++) idx[io + i] = ia[i] + vo;
          vo += g.attributes.position.count; io += ia.length;
          g.dispose();
        });
        const out = new THREE.BufferGeometry();
        out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        out.setIndex(new THREE.BufferAttribute(idx, 1));
        const m = new THREE.Mesh(out, mat);
        m.castShadow = false; m.receiveShadow = true;
        this.group.add(m);
        arr.length = 0;
      });
      this._planes.clear();
    }
  }

  _box(w, h, d, x, y, z, mat, collide) {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.castShadow = false; m.receiveShadow = true;   // 壁は影を落とさない（描画を軽く）
    this.group.add(m);
    if (collide) {
      this.colliders.push({
        min: { x: x - w / 2, z: z - d / 2 },
        max: { x: x + w / 2, z: z + d / 2 }
      });
    }
    return m;
  }

  /* ── 地上 ───────────────────────────────── */
  /* ── 地上 ───────────────────────────────
     街（中央）／ 聖域（西・墓と教会）／ 遺跡（南・階段状の神殿）
     の三つの区画に分ける。
  ──────────────────────────────────────── */
  buildSurface() {
    this.clear();
    this.isSurface = true;

    const ground = stoneMaterial(11, 0x8d8471);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), ground);
    f.rotation.x = -Math.PI / 2; f.receiveShadow = true;
    this.group.add(f);

    const stone = stoneMaterial(13, 0x9a9287);
    const dark  = stoneMaterial(15, 0x5a5560);
    const wood  = stoneMaterial(16, 0x6a5238);

    /* ── 街の敷石（中央の広場と大路） ── */
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(20, 48), stoneMaterial(14, 0xb0a690));
    plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.02, 0);
    plaza.receiveShadow = true;
    this.group.add(plaza);
    // 南へ伸びる参道（遺跡へ）
    const road = new THREE.Mesh(new THREE.PlaneGeometry(11, 60), stoneMaterial(17, 0xa89c88));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, 34);
    this.group.add(road);
    // 西へ伸びる小径（聖域へ）
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(46, 7), stoneMaterial(18, 0x8f8574));
    lane.rotation.x = -Math.PI / 2; lane.position.set(-30, 0.02, 0);
    this.group.add(lane);

    /* ══ 聖域（西の外れ）── 墓・教会・結界・呪札 ══ */
    const SX = -52, SZ = 0;
    this.sanctuary = { x: SX, z: SZ, r: 22 };
    // 荒れた土
    const soil = new THREE.Mesh(new THREE.CircleGeometry(21, 40), stoneMaterial(19, 0x4a4640));
    soil.rotation.x = -Math.PI / 2; soil.position.set(SX, 0.03, SZ);
    this.group.add(soil);
    // 教会（尖塔つき）
    const ch = new THREE.Mesh(new THREE.BoxGeometry(9, 7, 13), dark);
    ch.position.set(SX - 1, 3.5, SZ - 15); ch.castShadow = false;
    this.group.add(ch);
    this.colliders.push({ min: { x: SX - 5.5, z: SZ - 21.5 }, max: { x: SX + 3.5, z: SZ - 8.5 } });
    const spire = new THREE.Mesh(new THREE.ConeGeometry(3.2, 9, 6), dark);
    spire.position.set(SX - 1, 11.5, SZ - 15); spire.castShadow = false;
    this.group.add(spire);
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.4, 0.3), metalMaterial(20, 0xc9a227));
    cross1.position.set(SX - 1, 17.2, SZ - 15);
    this.group.add(cross1);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.3), metalMaterial(20, 0xc9a227));
    cross2.position.set(SX - 1, 17.6, SZ - 15);
    this.group.add(cross2);
    // 墓石を並べる
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const rr = 12 + (i % 4) * 2.4;
      const gx = SX + Math.cos(a) * rr, gz = SZ + Math.sin(a) * rr;
      const h = 1.1 + (i % 3) * 0.35;
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.7, h, 0.3), dark);
      g.position.set(gx, h / 2, gz); g.rotation.y = a + (i % 2 ? 0.2 : -0.15);
      g.castShadow = false;
      this.group.add(g);
      if (i % 3 === 0) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.4), dark);
        cap.position.set(gx, h + 0.08, gz); cap.rotation.y = g.rotation.y;
        this.group.add(cap);
      }
    }
    // 結界の柱と注連縄めいた綱
    this.wards = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = SX + Math.cos(a) * 18, pz = SZ + Math.sin(a) * 18;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 3.4, 8), wood);
      p.position.set(px, 1.7, pz); p.castShadow = false;
      this.group.add(p);
      this.colliders.push({ min: { x: px - 0.3, z: pz - 0.3 }, max: { x: px + 0.3, z: pz + 0.3 } });
      // 呪札（ゆれる）
      for (let k = 0; k < 3; k++) {
        const fuda = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.7),
          new THREE.MeshStandardMaterial({ color: 0xf0e8d8, side: THREE.DoubleSide, roughness: 0.9 }));
        fuda.position.set(px + (k - 1) * 0.34, 2.9, pz + 0.16);
        this.group.add(fuda);
        this.wards.push({ m: fuda, phase: Math.random() * 6.28 });
      }
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glowMaterial(0x9ad8ff, 1.6));
      lamp.position.set(px, 3.6, pz);
      this.group.add(lamp);
    }
    // 結界の輪（地面）
    const ward = new THREE.Mesh(new THREE.RingGeometry(17.6, 18.4, 64),
      new THREE.MeshBasicMaterial({ color: 0x8ad0ff, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ward.rotation.x = -Math.PI / 2; ward.position.set(SX, 0.05, SZ);
    this.group.add(ward);
    this.wardRing = ward;
    this.purifierSpot = new THREE.Vector3(SX, 0, SZ);

    /* ══ 遺跡（南に遠く）── 階段状の神殿 ══ */
    const PX = 0, PZ = 74;
    const pyr = stoneMaterial(23, 0x9c8d70);
    // 五段のピラミッド
    for (let i = 0; i < 5; i++) {
      const w = 34 - i * 6;
      const h = 3.4;
      const y = i * h + h / 2;
      const step = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), pyr);
      step.position.set(PX, y, PZ); step.castShadow = false; step.receiveShadow = true;
      this.group.add(step);
      const half = w / 2;
      // 正面（南から北へ登る道）だけ空け、左右と裏は塞ぐ
      this.colliders.push({ min: { x: PX - half, z: PZ - 2.0 }, max: { x: PX - 5.6, z: PZ + half } });
      this.colliders.push({ min: { x: PX + 5.6, z: PZ - 2.0 }, max: { x: PX + half, z: PZ + half } });
      this.colliders.push({ min: { x: PX - half, z: PZ + half - 1.2 }, max: { x: PX + half, z: PZ + half } });
    }
    // 正面の大階段（見た目）
    const STEP_N = 16, STEP_Z0 = PZ - 26, STEP_Z1 = PZ - 3.0, STEP_TOP = 19.0;
    for (let i = 0; i < STEP_N; i++) {
      const t = i / (STEP_N - 1);
      const st = new THREE.Mesh(new THREE.BoxGeometry(11, 0.7, (STEP_Z1 - STEP_Z0) / STEP_N + 0.5), pyr);
      st.position.set(PX, STEP_TOP * t, STEP_Z0 + (STEP_Z1 - STEP_Z0) * t);
      st.receiveShadow = true; st.castShadow = false;
      this.group.add(st);
    }
    // 登れる坂として登録（ここを歩くと高さが上がる）
    this.ramps.push({ x1: PX, z1: STEP_Z0, x2: PX, z2: STEP_Z1, y1: 0, y2: STEP_TOP, w: 5.5 });
    // 頂上の平場
    this.plats.push({ x: PX, z: PZ, r: 6.5, y: STEP_TOP });
    // 頂上の祠と入口
    const shrine = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 9), pyr);
    shrine.position.set(PX, 19.5, PZ); shrine.castShadow = false;
    this.group.add(shrine);
    const doorway = new THREE.Mesh(new THREE.BoxGeometry(4.4, 4.2, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x06080c, roughness: 1 }));
    doorway.position.set(PX, 19.1, PZ - 4.5);
    this.group.add(doorway);
    // 入口を縁取る石柱と篝火
    [-1, 1].forEach(sx => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 5.4, 8), pyr);
      p.position.set(PX + sx * 3.4, 19.7, PZ - 4.6); p.castShadow = false;
      this.group.add(p);
      const fire = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), glowMaterial(0xff9a4a, 2.6));
      fire.position.set(PX + sx * 3.4, 22.7, PZ - 4.6);
      this.group.add(fire);
      const l = new THREE.PointLight(0xffa860, 3.0, 18, 1.6);
      l.visible = false;
      l.position.set(PX + sx * 3.4, 22.7, PZ - 4.6);
      this.group.add(l);
      if (!this.torches) this.torches = [];
      this.torches.push({ fire, light: l, phase: Math.random() * 6.28 });
    });
    // 蛇の意匠（階段の脇）
    [-1, 1].forEach(sx => {
      for (let i = 0; i < 6; i++) {
        const seg = new THREE.Mesh(new THREE.SphereGeometry(0.7 - i * 0.06, 10, 8), pyr);
        seg.position.set(PX + sx * 5.9, 0.7 + i * 2.6, PZ - 16 + i * 2.2);
        this.group.add(seg);
      }
    });

    // 入口の判定（頂上の祠）
    this.entrance = { x: PX, z: PZ - 4.5, r: 3.2, y: 19 };
    const em = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.16, 8, 28), metalMaterial(24, 0xc9a227));
    em.rotation.x = -Math.PI / 2; em.position.set(PX, 17.2, PZ - 4.5);
    this.group.add(em);

    this.playerStart = new THREE.Vector3(0, 0, -6);
    return this;
  }

  /* ── 地下ダンジョン（迷路） ─────────────────
     格子状に部屋を並べ、深さ優先で穴を掘って迷路にする。
     行き止まりには褒美、道中には仕掛けを置く。
     ボスは入口から最も遠い部屋。
  ──────────────────────────────────────── */
  buildDungeon(seed, floor) {
    this.clear();
    this.isSurface = false;
    this.floor = floor || 1;
    const rnd = rngFactory(seed || 12345);

    // 階が深いほど広くなる
    // 深いほど広がる（上限8×8）。10階ごとに趣が変わる
    const band = Math.floor((this.floor - 1) / 10);
    const GW = Math.min(8, 3 + Math.floor(this.floor / 4) + Math.min(2, band));
    const GH = Math.min(8, 3 + Math.floor((this.floor + 2) / 4) + Math.min(2, band));
    this.band = band;
    const CELL = 34;                       // 部屋の間隔

    // 10階ごとに石の色が変わる
    const TONE = [
      [0x6f747f, 0x7b8291], [0x7a6f5f, 0x8a8070], [0x5f6f7a, 0x6f8290],
      [0x7a5f6f, 0x8a7080], [0x5f7a63, 0x708a74], [0x7a7a5f, 0x8a8a70],
      [0x6a5f7a, 0x7a7090], [0x7a6a5f, 0x8a7a70], [0x5f6a7a, 0x707a8a], [0x7a5f5f, 0x8a7070]
    ];
    const tn = TONE[this.band % TONE.length];
    const floorMat = stoneMaterial(21 + this.band, tn[0]);
    const wallMat  = stoneMaterial(22 + this.band, tn[1]);

    // ── 迷路を掘る（深さ優先） ──
    const cells = [];
    for (let y = 0; y < GH; y++) {
      cells[y] = [];
      for (let x = 0; x < GW; x++) {
        cells[y][x] = { x, y, visited: false, N: false, S: false, E: false, W: false, dist: 0 };
      }
    }
    const stack = [cells[0][0]];
    cells[0][0].visited = true;
    while (stack.length) {
      const c = stack[stack.length - 1];
      const nb = [];
      if (c.y > 0      && !cells[c.y - 1][c.x].visited) nb.push(['N', cells[c.y - 1][c.x]]);
      if (c.y < GH - 1 && !cells[c.y + 1][c.x].visited) nb.push(['S', cells[c.y + 1][c.x]]);
      if (c.x < GW - 1 && !cells[c.y][c.x + 1].visited) nb.push(['E', cells[c.y][c.x + 1]]);
      if (c.x > 0      && !cells[c.y][c.x - 1].visited) nb.push(['W', cells[c.y][c.x - 1]]);
      if (!nb.length) { stack.pop(); continue; }
      const [dir, next] = nb[Math.floor(rnd() * nb.length)];
      c[dir] = true;
      next[{ N: 'S', S: 'N', E: 'W', W: 'E' }[dir]] = true;
      next.visited = true;
      next.dist = c.dist + 1;
      stack.push(next);
    }
    // 少しだけ環をつくる（一本道すぎないように）
    const loops = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < loops; i++) {
      const x = Math.floor(rnd() * (GW - 1)), y = Math.floor(rnd() * GH);
      if (!cells[y][x].E) { cells[y][x].E = true; cells[y][x + 1].W = true; }
    }

    // ── 大広間へ通じる部屋を先に決める ──
    // 迷路の一番南の列から、入口から最も遠い部屋を選ぶ。
    // 先に S を開けておくことで、南壁に必ず戸口ができる。
    let gateCell = null;
    for (let x = 0; x < GW; x++) {
      const c = cells[GH - 1][x];
      if (!gateCell || c.dist > gateCell.dist) gateCell = c;
    }
    gateCell.S = true;
    this.gateCell = gateCell;

    // ── 部屋を建てる ──
    const DOOR = 11;
    const T2 = T;
    this.grid = cells; this.gw = GW; this.gh = GH; this.cellSize = CELL;
    let far = cells[0][0];
    const dead = [];

    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const c = cells[y][x];
        const cx = (x - (GW - 1) / 2) * CELL;
        const cz = (y - (GH - 1) / 2) * CELL;
        const w = 20 + Math.floor(rnd() * 6);
        const d = 20 + Math.floor(rnd() * 6);
        const room = { x: cx, z: cz, w, d, gx: x, gy: y, cell: c };
        this.rooms.push(room);
        c.room = room;
        if (c.dist > far.dist) far = c;
        const exits = (c.N ? 1 : 0) + (c.S ? 1 : 0) + (c.E ? 1 : 0) + (c.W ? 1 : 0);
        if (exits === 1 && !(x === 0 && y === 0)) dead.push(room);

        // 床と天井
        this._batchPlane(w, d, cx, 0, cz, true, floorMat);
        this._batchPlane(w, d, cx, WALL_H, cz, false, floorMat);

        // 四方の壁（通じている面だけ戸口を空ける）
        const rowZ = (zPos, open) => {
          if (!open) { this._box(w + T2 * 2, WALL_H, T2, cx, WALL_H / 2, zPos, wallMat, true); return; }
          // 戸口ぶんだけ空け、左右は必ず端まで届かせる
          const total = w + T2 * 2;
          const side = (total - DOOR) / 2;
          if (side > 0.05) {
            this._batch(side + T2, WALL_H, T2 * 1.6, cx - (DOOR / 2 + side / 2), WALL_H / 2, zPos, wallMat, true);
            this._batch(side + T2, WALL_H, T2 * 1.6, cx + (DOOR / 2 + side / 2), WALL_H / 2, zPos, wallMat, true);
          }
          this._batch(DOOR + 1.2, 0.7, T2 + 0.2, cx, WALL_H - 0.35, zPos, wallMat, false);
        };
        const colX = (xPos, open) => {
          if (!open) { this._batch(T2, WALL_H, d + T2 * 2, xPos, WALL_H / 2, cz, wallMat, true); return; }
          const total = d + T2 * 2;
          const side = (total - DOOR) / 2;
          if (side > 0.05) {
            this._batch(T2 * 1.6, WALL_H, side + T2, xPos, WALL_H / 2, cz - (DOOR / 2 + side / 2), wallMat, true);
            this._batch(T2 * 1.6, WALL_H, side + T2, xPos, WALL_H / 2, cz + (DOOR / 2 + side / 2), wallMat, true);
          }
          this._batch(T2 + 0.2, 0.7, DOOR + 1.2, xPos, WALL_H - 0.35, cz, wallMat, false);
        };
        rowZ(cz - d / 2 - T2 / 2, c.N);
        rowZ(cz + d / 2 + T2 / 2, c.S);
        colX(cx - w / 2 - T2 / 2, c.W);
        colX(cx + w / 2 + T2 / 2, c.E);
        // 四隅の継ぎ目を塞ぐ（ここに隙間ができて抜けていた）
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
          this._batch(T2 * 2.4, WALL_H, T2 * 2.4,
            cx + sx * (w / 2 + T2 / 2), WALL_H / 2, cz + sz * (d / 2 + T2 / 2), wallMat, true);
        });

        // 通路
        if (c.S && y < GH - 1) this._corridorZ(cx, cz + d / 2, cz + CELL - d / 2, wallMat, floorMat, DOOR);
        if (c.E) this._corridorX(cz, cx + w / 2, cx + CELL - w / 2, wallMat, floorMat, DOOR);

        // 松明
        this._addTorch(cx - w / 2 + 1.8, cz - d / 2 + 1.8);
        if ((x + y) % 2 === 0) this._addTorch(cx + w / 2 - 1.8, cz + d / 2 - 1.8);

        // 天窓は3部屋に1つ程度
        if ((x + y) % 3 === 1) this._addShaft(cx + (rnd() - 0.5) * 6, cz + (rnd() - 0.5) * 6);

        // 敵の湧き
        if (!(x === 0 && y === 0)) {
          const n = 2 + Math.floor(rnd() * 3) + Math.floor(this.floor / 2);
          for (let k = 0; k < n; k++) {
            this.spawnPoints.push(new THREE.Vector3(
              cx + (rnd() - 0.5) * (w - 5), 0, cz + (rnd() - 0.5) * (d - 5)));
          }
        }
      }
    }

    this.startRoom = cells[0][0].room;
    // 迷路の南端から、専用の大広間へつなげる
    const gate = gateCell.room;
    this.gateRoom = gate;
    this._buildBossHall(gate);
    this._addBossWindow(this.bossRoom);

    // ── 仕掛け ──
    this.gimmicks = { keys: [], doors: [], switches: [], hazards: [], chests: [] };
    this.startRoom = cells[0][0].room;
    // 鍵は必ず1つ置く（行き止まりが無ければ、入口から遠い部屋へ）
    const candidates = dead.length ? dead : this.rooms.filter(r => r !== this.startRoom && r !== this.bossRoom);
    const pool = candidates.length ? candidates : this.rooms.filter(r => r !== this.startRoom);
    const keyRoom = pool[Math.floor(rnd() * pool.length)] || this.rooms[1];
    // 鍵は中ボスが落とす。地面には置かない
    // 宝箱も最低2つ
    const chestPool = this.rooms.filter(r => r !== this.startRoom && r !== this.bossRoom && r !== keyRoom);
    for (let i = 0; i < Math.min(3, chestPool.length); i++) {
      const r = chestPool[Math.floor(rnd() * chestPool.length)];
      if (r && !this.gimmicks.chests.some(c => c.x === r.x && c.z === r.z)) this._addChest(r.x + 4, r.z + 4);
    }
    // 中ほどの部屋に一時記録の祠
    const midRoom = this.rooms[Math.floor(this.rooms.length / 2)] || this.rooms[1];
    if (midRoom && midRoom !== this.startRoom && midRoom !== this.bossRoom) {
      this._addRest(midRoom.x + 5, midRoom.z - 5);
    }
    // 撃つと開く祭壇
    const sw = this.rooms[Math.floor(this.rooms.length / 2)];
    if (sw && sw !== this.bossRoom) this._addSwitch(sw.x, sw.z);
    // 光の罠（踏むと傷つく床）
    this.rooms.forEach((r, i) => {
      if (i % 4 === 2 && r !== this.startRoom && r !== this.bossRoom) {
        this._addHazard(r.x + 3, r.z - 3);
      }
    });

    this._flushBatches();

    this.playerStart = new THREE.Vector3(this.startRoom.x, 0, this.startRoom.z);

    // ── 帰還のワープ台 ──
    // 降り立った真下ではなく、入口の部屋の「奥の端」に置く
    const sr = this.startRoom;
    const wx = sr.x + (sr.w / 2 - 4.5) * (sr.cell.E ? -1 : 1);
    const wz = sr.z + (sr.d / 2 - 4.5) * (sr.cell.S ? -1 : 1);
    this._addWarp(wx, wz);
    this.exit = { x: wx, z: wz, r: 2.8 };
    return this;
  }

  /** 迷路の外に、豪華な大広間を建てる。大扉だけが入口 */
  _buildBossHall(gate) {
    const HW = 46, HD = 40;                       // とにかく広く
    const HH = WALL_H + 5.5;                      // 天井も高く
    const hx = gate.x;
    const hz = gate.z + gate.d / 2 + 30 + HD / 2;   // 迷路の外に出す
    this.bossRoom = { x: hx, z: hz, w: HW, d: HD, isHall: true, cell: { N: true, S: false, E: false, W: false } };

    // ── 別素材：磨いた黒曜と金 ──
    const marble = new THREE.MeshStandardMaterial({
      color: 0x2e2a3a, roughness: 0.22, metalness: 0.45,
      emissive: new THREE.Color(0x0e0a14), emissiveIntensity: 0.6
    });
    const gold = metalMaterial(130, 0xc9a227);
    const wallM = new THREE.MeshStandardMaterial({
      color: 0x3a3448, roughness: 0.3, metalness: 0.35
    });

    // 床（市松）
    for (let i = 0; i < 8; i++) for (let k = 0; k < 7; k++) {
      const t = ((i + k) % 2 === 0);
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(HW / 8, HD / 7),
        t ? marble : new THREE.MeshStandardMaterial({ color: 0x4a4258, roughness: 0.25, metalness: 0.4 }));
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(hx - HW / 2 + HW / 8 * (i + 0.5), 0.01, hz - HD / 2 + HD / 7 * (k + 0.5));
      tile.receiveShadow = true;
      this.group.add(tile);
    }
    // 天井
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HW, HD), wallM);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(hx, HH, hz);
    this.group.add(ceil);

    // 四方の壁（北面だけ大扉ぶんを空ける）
    const DOORW = 13;
    const wall = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallM);
      m.position.set(x, y, z); m.receiveShadow = true;
      this.group.add(m);
      this.colliders.push({ min: { x: x - w / 2, z: z - d / 2 }, max: { x: x + w / 2, z: z + d / 2 } });
    };
    const side = (HW - DOORW) / 2;
    wall(side, HH, 1.4, hx - (DOORW / 2 + side / 2), HH / 2, hz - HD / 2);   // 北・左
    wall(side, HH, 1.4, hx + (DOORW / 2 + side / 2), HH / 2, hz - HD / 2);   // 北・右
    wall(HW + 2.8, HH, 1.4, hx, HH / 2, hz + HD / 2);                        // 南
    wall(1.4, HH, HD, hx - HW / 2, HH / 2, hz);                              // 西
    wall(1.4, HH, HD, hx + HW / 2, HH / 2, hz);                              // 東

    // ── 参道（最奥の部屋から大扉まで） ──
    const cw = 11;
    const z0 = gate.z + gate.d / 2 - 2, z1 = hz - HD / 2 + 2;
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(cw, z1 - z0 + 4), marble);
    cl.rotation.x = -Math.PI / 2; cl.position.set(hx, 0.01, (z0 + z1) / 2);
    this.group.add(cl);
    const cc = new THREE.Mesh(new THREE.PlaneGeometry(cw, z1 - z0 + 4), wallM);
    cc.rotation.x = Math.PI / 2; cc.position.set(hx, WALL_H, (z0 + z1) / 2);
    this.group.add(cc);
    wall(1.4, WALL_H, z1 - z0 + 4, hx - cw / 2, WALL_H / 2, (z0 + z1) / 2);
    wall(1.4, WALL_H, z1 - z0 + 4, hx + cw / 2, WALL_H / 2, (z0 + z1) / 2);

    // ── 飾り：金の大紋章・列柱・燭台・玉座の段 ──
    const seal = new THREE.Mesh(new THREE.RingGeometry(6.0, 12.0, 64),
      new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    seal.rotation.x = -Math.PI / 2; seal.position.set(hx, 0.06, hz);
    this.group.add(seal);
    this.bossSeal = seal;

    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const px = hx + Math.cos(a) * 17, pz = hz + Math.sin(a) * 15;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.15, HH - 0.6, 12), gold);
      p.position.set(px, (HH - 0.6) / 2, pz);
      this.group.add(p);
      this.colliders.push({ min: { x: px - 1.0, z: pz - 1.0 }, max: { x: px + 1.0, z: pz + 1.0 } });
      const fire = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), glowMaterial(0xff8a3a, 2.6, true));
      fire.position.set(px, HH - 0.3, pz);
      this.group.add(fire);
      const l = new THREE.PointLight(0xffa860, 3.0, 22, 1.6);
      l.visible = false; l.position.set(px, HH - 0.3, pz);
      this.group.add(l);
      (this.torches = this.torches || []).push({ fire, light: l, phase: Math.random() * 6.28 });
    }
    // 奥の玉座段
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.5, 0.8, 32), marble);
    dais.position.set(hx, 0.4, hz + 6);
    dais.receiveShadow = true;
    this.group.add(dais);

    // ── 大扉（唯一の入口） ──
    this._addGrandDoor(hx, hz - HD / 2);
    this.bossStand = new THREE.Vector3(hx, 0, hz + 6);
  }

  /** ボスの間：一番広く、柱と燭台で飾る。手前に豪華な大扉 */
  _makeBossHall(room, wallMat, floorMat) {
    const cx = room.x, cz = room.z;
    // 床の紋
    const seal = new THREE.Mesh(new THREE.RingGeometry(4.5, 9.0, 48),
      new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    seal.rotation.x = -Math.PI / 2; seal.position.set(cx, 0.05, cz);
    this.group.add(seal);
    this.bossSeal = seal;
    // 列柱
    const pillar = metalMaterial(120, 0x9a8a6a);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = cx + Math.cos(a) * 10.5, pz = cz + Math.sin(a) * 10.5;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, WALL_H - 0.4, 10), pillar);
      p.position.set(px, (WALL_H - 0.4) / 2, pz);
      this.group.add(p);
      this.colliders.push({ min: { x: px - 0.7, z: pz - 0.7 }, max: { x: px + 0.7, z: pz + 0.7 } });
      // 燭台
      const fire = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), glowMaterial(0xff8a3a, 2.4, true));
      fire.position.set(px, WALL_H - 0.2, pz);
      this.group.add(fire);
      const l = new THREE.PointLight(0xffa860, 2.6, 16, 1.6);
      l.visible = false;
      l.position.set(px, WALL_H - 0.2, pz);
      this.group.add(l);
      (this.torches = this.torches || []).push({ fire, light: l, phase: Math.random() * 6.28 });
    }
  }

  /** ボスの間の大扉（鍵で開く） */
  _addGrandDoor(x, z) {
    const g = new THREE.Group();
    const frame = metalMaterial(121, 0x8a7a4a);
    const panel = new THREE.MeshStandardMaterial({
      color: 0x2a2030, roughness: 0.6, metalness: 0.35,
      emissive: new THREE.Color(0x5a1020), emissiveIntensity: 0.9
    });
    // 両開きの扉
    this.doorLeaves = [];
    [-1, 1].forEach(sx => {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(6.2, WALL_H - 0.4, 0.7), panel);
      leaf.position.set(sx * 3.1, (WALL_H - 0.4) / 2, 0);
      g.add(leaf);
      this.doorLeaves.push({ m: leaf, sx });
    });
    // 縁飾りと柱
    [-1, 1].forEach(sx => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, WALL_H + 0.6, 10), frame);
      p.position.set(sx * 6.9, (WALL_H + 0.6) / 2, 0);
      g.add(p);
      this.colliders.push({ min: { x: x + sx * 6.9 - 0.9, z: z - 0.9 },
                            max: { x: x + sx * 6.9 + 0.9, z: z + 0.9 } });
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(15.4, 1.2, 1.0), frame);
    lintel.position.set(0, WALL_H + 0.2, 0);
    g.add(lintel);
    // 鍵穴（大きく光らせて分かるように）
    const kh = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.3, 20), metalMaterial(131, 0xd8c07a));
    plate.rotation.x = Math.PI / 2; plate.position.set(0, WALL_H / 2 - 1.9, -0.55);
    kh.add(plate);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.34, 16),
      new THREE.MeshBasicMaterial({ color: 0x120c08 }));
    hole.position.set(0, WALL_H / 2 - 1.9, -0.72);
    kh.add(hole);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x120c08 }));
    slot.position.set(0, WALL_H / 2 - 2.2, -0.72);
    kh.add(slot);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.09, 10, 26), glowMaterial(0xffd24a, 2.4, true));
    halo.position.set(0, WALL_H / 2 - 1.9, -0.6);
    kh.add(halo);
    g.add(kh);
    this.keyhole = { group: kh, halo };

    // 中央の紋章
    const crest = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.18, 12, 30), glowMaterial(0xff3a5a, 2.2, true));
    crest.position.set(0, WALL_H / 2 + 1.4, -0.5);
    g.add(crest);
    this.doorCrest = crest;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 6), glowMaterial(0xff5a70, 1.8));
      sp.position.set(Math.cos(a) * 2.0, WALL_H / 2 + 1.4 + Math.sin(a) * 2.0, -0.5);
      sp.rotation.z = a - Math.PI / 2;
      g.add(sp);
    }
    g.position.set(x, 0, z);
    this.group.add(g);
    const col = { min: { x: x - 6.2, z: z - 0.5 }, max: { x: x + 6.2, z: z + 0.5 } };
    this.colliders.push(col);
    this.grandDoor = { x, z, group: g, collider: col, open: false };
  }

  /** 大扉を開ける */
  openGrandDoor() {
    const d = this.grandDoor;
    if (!d || d.open) return false;
    d.open = true;
    d.anim = 0;                      // 0→1 で観音開き
    const i = this.colliders.indexOf(d.collider);
    if (i >= 0) this.colliders.splice(i, 1);
    return true;
  }

  /** 一時記録の祠（現在の階に置く） */
  _addRest(x, z) {
    const g = new THREE.Group();
    const base = stoneMaterial(122, 0x9a9287);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.0, 0.4, 20), base);
    p.position.y = 0.2;
    g.add(p);
    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 3.0, 6), base);
    obelisk.position.y = 1.9;
    g.add(obelisk);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), glowMaterial(0x9affd0, 2.4, true));
    orb.position.y = 3.7;
    g.add(orb);
    this.restOrb = orb;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 32),
      new THREE.MeshBasicMaterial({ color: 0x9affd0, transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.42;
    g.add(ring);
    this.restRing = ring;
    const l = new THREE.PointLight(0x9affd0, 2.4, 14, 2);
    l.position.set(0, 3.7, 0);
    g.add(l);
    g.position.set(x, 0, z);
    this.group.add(g);
    this.rest = { x, z, r: 2.6, group: g };
  }

  /** 帰還のワープ台（魔法陣） */
  _addWarp(x, z) {
    const g = new THREE.Group();
    const base = stoneMaterial(107, 0xa89c88);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.4, 0.35, 28), base);
    plate.position.y = 0.17; plate.receiveShadow = true;
    g.add(plate);
    // 三重の輪
    this.warpRings = [];
    [[1.0, 1.25, 0.55], [1.8, 2.0, 0.42], [2.5, 2.75, 0.34]].forEach(([a, b, o], i) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(a, b, 48),
        new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: o,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.36 + i * 0.002;
      g.add(m);
      this.warpRings.push({ m, dir: (i % 2 ? -1 : 1) * (0.3 + i * 0.2) });
    });
    // 放射する文様
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1.1),
        new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.4,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      bar.rotation.x = -Math.PI / 2; bar.rotation.z = -a;
      bar.position.set(Math.cos(a) * 2.15, 0.37, Math.sin(a) * 2.15);
      g.add(bar);
    }
    // 四隅の石柱
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 2.6, 8), metalMaterial(108, 0x7a8a9a));
      p.position.set(Math.cos(a) * 3.0, 1.3, Math.sin(a) * 3.0); p.castShadow = false;
      g.add(p);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), glowMaterial(0x9ad8ff, 2.2));
      orb.position.set(Math.cos(a) * 3.0, 2.8, Math.sin(a) * 3.0);
      g.add(orb);
    }
    // 立ち上る光
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.5, 6, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    col.position.y = 3;
    g.add(col);
    this.warpCol = col;
    const l = new THREE.PointLight(0x9ad8ff, 2.6, 16, 2);
    l.position.set(0, 2, 0);
    g.add(l);
    g.position.set(x, 0, z);
    this.group.add(g);
    this.warp = { x, z, group: g };
  }

  /* ── 仕掛けの部品 ── */
  _addKey(x, z) {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), metalMaterial(101, 0xd8b84a));
    shaft.position.y = 0.25; g.add(shaft);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 8, 16), metalMaterial(102, 0xd8b84a));
    ring.position.y = 0.62; ring.rotation.x = Math.PI / 2; g.add(ring);
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.07), metalMaterial(103, 0xd8b84a));
    t1.position.set(0.1, 0.08, 0); g.add(t1);
    g.position.set(x, 0.6, z);
    this.group.add(g);
    const l = new THREE.PointLight(0xffd24a, 2.2, 10, 2);
    l.position.set(x, 1, z); this.group.add(l);
    this.gimmicks.keys.push({ x, z, mesh: g, light: l, taken: false });
  }
  _addSealDoor(x, z) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3a2a3c, roughness: 0.7, metalness: 0.3,
      emissive: new THREE.Color(0x5a1020), emissiveIntensity: 1.1
    });
    const d = new THREE.Mesh(new THREE.BoxGeometry(12, WALL_H, 0.6), mat);
    d.position.set(x, WALL_H / 2, z); d.castShadow = true;
    this.group.add(d);
    const sigil = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.14, 10, 28), glowMaterial(0xff3a5a, 2.4));
    sigil.position.set(x, WALL_H / 2, z - 0.4);
    this.group.add(sigil);
    const col = { min: { x: x - 6, z: z - 0.4 }, max: { x: x + 6, z: z + 0.4 } };
    this.colliders.push(col);
    this.gimmicks.doors.push({ x, z, mesh: d, sigil, collider: col, open: false });
  }
  _addSwitch(x, z) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.4, 10), stoneMaterial(104, 0x8a8a94));
    base.position.set(x, 0.7, z); base.castShadow = true;
    this.group.add(base);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), glowMaterial(0xff5a6a, 2.2));
    orb.position.set(x, 1.7, z);
    this.group.add(orb);
    const l = new THREE.PointLight(0xff5a6a, 2.0, 12, 2);
    l.position.set(x, 1.7, z); this.group.add(l);
    this.colliders.push({ min: { x: x - 0.9, z: z - 0.9 }, max: { x: x + 0.9, z: z + 0.9 } });
    this.gimmicks.switches.push({ x, z, orb, light: l, on: false });
  }
  _addHazard(x, z) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20),
      new THREE.MeshBasicMaterial({ color: 0x8a2030, transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.04, z);
    this.group.add(m);
    this.gimmicks.hazards.push({ x, z, r: 2.2, mesh: m, phase: Math.random() * 6.28 });
  }
  _addChest(x, z) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.8), stoneMaterial(105, 0x6a5238));
    box.position.y = 0.35; box.castShadow = true; g.add(box);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.18, 0.85), metalMaterial(106, 0x9a8a5a));
    lid.position.y = 0.78; g.add(lid);
    g.position.set(x, 0, z);
    this.group.add(g);
    this.colliders.push({ min: { x: x - 0.55, z: z - 0.4 }, max: { x: x + 0.55, z: z + 0.4 } });
    this.gimmicks.chests.push({ x, z, mesh: g, lid, opened: false });
  }

  /** 鍵を拾う／扉を開く／宝箱を開ける。起きたことを返す */
  interact(px, pz, hasKey) {
    const out = [];
    if (!this.gimmicks) return out;
    this.gimmicks.keys.forEach(k => {
      if (!k.taken && Math.hypot(px - k.x, pz - k.z) < 2.2) {
        k.taken = true; k.mesh.visible = false; k.light.intensity = 0;
        out.push('key');
      }
    });
    this.gimmicks.doors.forEach(d => {
      if (!d.open && hasKey && Math.hypot(px - d.x, pz - d.z) < 4.0) {
        d.open = true; d.mesh.visible = false; d.sigil.visible = false;
        const i = this.colliders.indexOf(d.collider);
        if (i >= 0) this.colliders.splice(i, 1);
        out.push('door');
      }
    });
    this.gimmicks.chests.forEach(c => {
      if (!c.opened && Math.hypot(px - c.x, pz - c.z) < 2.2) {
        c.opened = true; c.lid.rotation.x = -1.1; c.lid.position.z = -0.35;
        out.push('chest');
      }
    });
    return out;
  }

  /** 祭壇を撃つ */
  shootSwitch(bx, bz) {
    if (!this.gimmicks || !this.gimmicks.switches) return false;
    for (const s of this.gimmicks.switches) {
      if (!s.on && Math.hypot(bx - s.x, bz - s.z) < 1.6) {
        s.on = true;
        s.orb.material.emissive.setHex(0x6affa0);
        s.orb.material.color.setHex(0x6affa0);
        s.light.color.setHex(0x6affa0);
        // 封印扉がひとつ開く
        const d = this.gimmicks.doors.find(x => !x.open);
        if (d) {
          d.open = true; d.mesh.visible = false; d.sigil.visible = false;
          const i = this.colliders.indexOf(d.collider);
          if (i >= 0) this.colliders.splice(i, 1);
        }
        return true;
      }
    }
    return false;
  }

  /** 光の罠に触れているか */
  onHazard(x, z) {
    if (!this.gimmicks || !this.gimmicks.hazards) return null;
    for (const h of this.gimmicks.hazards) {
      if (Math.hypot(x - h.x, z - h.z) < h.r) return h;
    }
    return null;
  }

  /** 南北の通路 */
  _corridorZ(cx, z1, z2, wallMat, floorMat, W) {
    const len = Math.abs(z2 - z1) + 6;   // 部屋の壁と重ねて隙間を無くす
    const mz = (z1 + z2) / 2;
    this._batchPlane(W, len, cx, 0, mz, true, floorMat);
    this._batchPlane(W, len, cx, WALL_H, mz, false, floorMat);
    this._batch(T * 1.6, WALL_H, len, cx - W / 2 - T / 2, WALL_H / 2, mz, wallMat, true);
    this._batch(T * 1.6, WALL_H, len, cx + W / 2 + T / 2, WALL_H / 2, mz, wallMat, true);
  }
  /** 東西の通路 */
  _corridorX(cz, x1, x2, wallMat, floorMat, W) {
    const len = Math.abs(x2 - x1) + 6;
    const mx = (x1 + x2) / 2;
    this._batchPlane(len, W, mx, 0, cz, true, floorMat);
    this._batchPlane(len, W, mx, WALL_H, cz, false, floorMat);
    this._batch(len, WALL_H, T * 1.6, mx, WALL_H / 2, cz - W / 2 - T / 2, wallMat, true);
    this._batch(len, WALL_H, T * 1.6, mx, WALL_H / 2, cz + W / 2 + T / 2, wallMat, true);
  }

  _corridor(x1, z1, x2, z2, wallMat, floorMat) {
    const w = 11;   // 通路を広く
    const len = Math.abs(z2 - z1) + 18;
    const mz = (z1 + z2) / 2;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, len), floorMat);
    fl.rotation.x = -Math.PI / 2; fl.position.set(x1, 0, mz); fl.receiveShadow = true;
    this.group.add(fl);
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(w, len), floorMat);
    cl.rotation.x = Math.PI / 2; cl.position.set(x1, WALL_H, mz);
    this.group.add(cl);
    this._box(T, WALL_H, len, x1 - w / 2 - T / 2, WALL_H / 2, mz, wallMat, true);
    this._box(T, WALL_H, len, x1 + w / 2 + T / 2, WALL_H / 2, mz, wallMat, true);
  }

  /** 天窓：円錐の体積光＋補給判定 */
  _addShaft(x, z) {
    const r = 3.2;
    const geo = new THREE.CylinderGeometry(r * 0.45, r * 1.25, WALL_H + 1.2, 24, 1, true);
    const tex = noiseTexture(128, 4, 31, [1, 0.95, 0.8]);
    tex.repeat.set(1, 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffe6a8, map: tex, transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(geo, mat);
    beam.position.set(x, (WALL_H + 1.2) / 2 - 0.5, z);
    this.group.add(beam);

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(r * 1.25, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff2cc, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2; disc.position.set(x, 0.03, z);
    this.group.add(disc);

    const light = new THREE.PointLight(0xffe0a0, 4.5, 22, 1.7);
    light.position.set(x, 2.6, z);
    this.group.add(light);

    this.shafts.push({ x, z, r: r * 1.25, beam, disc, light, tex });
  }

  _addTorch(x, z) {
    const pole = metalMaterial(41, 0x4a4238);
    this._box(0.16, 1.5, 0.16, x, 0.75, z, pole, false);
    const fire = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      glowMaterial(0xff8a3a, 2.6, true)
    );
    fire.position.set(x, 1.62, z);
    this.group.add(fire);
    const l = new THREE.PointLight(0xffa860, 3.4, 20, 1.6);
    l.visible = false;   // 近づいた時だけ点ける（描画負荷を抑える）
    l.position.set(x, 1.7, z);
    this.group.add(l);
    if (!this.torches) this.torches = [];
    this.torches.push({ fire, light: l, phase: Math.random() * 6.28 });
  }

  /** 最深部：天井の窓（P3で撃ち割る） */
  _addBossWindow(room) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a3040, roughness: 0.4, metalness: 0.3,
      emissive: new THREE.Color(0x223047), emissiveIntensity: 0.5
    });
    const win = new THREE.Mesh(new THREE.CircleGeometry(4.2, 28), mat);
    win.rotation.x = Math.PI / 2;
    win.position.set(room.x, WALL_H - 0.05, room.z);
    this.group.add(win);
    this.bossWindow = { mesh: win, broken: false, x: room.x, z: room.z, hp: 3 };
  }

  /** 窓を割って光の柱を落とす */
  breakBossWindow() {
    if (!this.bossWindow || this.bossWindow.broken) return null;
    this.bossWindow.broken = true;
    this.bossWindow.mesh.visible = false;
    const r = this.bossWindow;
    this._addShaft(r.x, r.z);
    const s = this.shafts[this.shafts.length - 1];
    s.isBoss = true;
    return s;
  }

  /* ── 判定 ────────────────────────────── */
  /** その地点の地面の高さ。坂と高台を見る */
  heightAt(x, z) {
    let y = 0;
    if (this.plats) {
      for (const p of this.plats) {
        if ((x - p.x) ** 2 + (z - p.z) ** 2 < p.r * p.r) y = Math.max(y, p.y);
      }
    }
    if (this.ramps) {
      for (const r of this.ramps) {
        const dx = r.x2 - r.x1, dz = r.z2 - r.z1;
        const len2 = dx * dx + dz * dz;
        if (len2 < 1e-6) continue;
        let t = ((x - r.x1) * dx + (z - r.z1) * dz) / len2;
        if (t < 0 || t > 1) continue;
        // 坂の中心からの横ずれ
        const cx = r.x1 + dx * t, cz = r.z1 + dz * t;
        const off = Math.hypot(x - cx, z - cz);
        if (off > r.w) continue;
        y = Math.max(y, r.y1 + (r.y2 - r.y1) * t);
      }
    }
    return y;
  }

  /** 円（プレイヤー/敵）と壁AABBの押し戻し */
  resolve(pos, radius) {
    // 高速移動でも抜けないよう二度当てる
    for (let pass = 0; pass < 3; pass++)
    for (const c of this.colliders) {
      const cx = Math.max(c.min.x, Math.min(pos.x, c.max.x));
      const cz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        const d = Math.sqrt(d2) || 0.0001;
        const push = radius - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
      }
    }
    return pos;
  }

  /** その地点が天窓の光の中か */
  inShaft(x, z) {
    for (const s of this.shafts) {
      const dx = x - s.x, dz = z - s.z;
      if (dx * dx + dz * dz < s.r * s.r) return s;
    }
    return null;
  }

  /** 近くの灯りだけを点ける。遠くは消して描画負荷を下げる */
  cullLights(px, pz, maxOn) {
    maxOn = maxOn || 6;
    if (!this.torches || !this.torches.length) return;
    const arr = this.torches;
    for (const tr of arr) {
      const dx = tr.light.position.x - px, dz = tr.light.position.z - pz;
      tr._d = dx * dx + dz * dz;
    }
    const sorted = arr.slice().sort((a, b) => a._d - b._d);
    for (let i = 0; i < sorted.length; i++) sorted[i].light.visible = (i < maxOn && sorted[i]._d < 900);
    if (this.shafts) {
      const sh = this.shafts.slice().sort((a, b) =>
        ((a.x - px) ** 2 + (a.z - pz) ** 2) - ((b.x - px) ** 2 + (b.z - pz) ** 2));
      for (let i = 0; i < sh.length; i++) sh[i].light.visible = (i < 2);
    }
  }

  update(t) {
    if (this.gimmicks) {
      if (this.gimmicks.hazards) {
        for (const h of this.gimmicks.hazards) {
          h.mesh.material.opacity = 0.24 + Math.abs(Math.sin(t * 1.6 + h.phase)) * 0.36;
        }
      }
      if (this.gimmicks.keys) {
        for (const k of this.gimmicks.keys) {
          if (!k.taken) { k.mesh.rotation.y += 0.02; k.mesh.position.y = 0.6 + Math.sin(t * 2) * 0.12; }
        }
      }
    }
    if (this.wards) {
      for (const w of this.wards) {
        w.m.rotation.z = Math.sin(t * 1.6 + w.phase) * 0.18;
      }
    }
    if (this.wardRing) this.wardRing.material.opacity = 0.16 + Math.sin(t * 1.2) * 0.07;
    if (this.doorCrest) this.doorCrest.rotation.z += 0.01;
    if (this.keyhole && this.grandDoor && !this.grandDoor.open) {
      this.keyhole.halo.rotation.z += 0.02;
      this.keyhole.halo.material.emissiveIntensity = 2.0 + Math.sin(t * 3) * 0.9;
    } else if (this.keyhole) this.keyhole.group.visible = false;
    // 扉が開く所作
    if (this.grandDoor && this.grandDoor.open && this.grandDoor.anim < 1) {
      this.grandDoor.anim = Math.min(1, this.grandDoor.anim + 0.012);
      const k = this.grandDoor.anim;
      const e = 1 - Math.pow(1 - k, 3);
      if (this.doorLeaves) this.doorLeaves.forEach(L => {
        L.m.rotation.y = L.sx * e * 1.35;
        L.m.position.x = L.sx * (3.1 + e * 2.6);
      });
      if (this.doorCrest) this.doorCrest.material.opacity = 1 - e;
    }
    if (this.bossSeal) this.bossSeal.rotation.z += 0.004;
    if (this.restRing) { this.restRing.rotation.z += 0.02; }
    if (this.restOrb) { this.restOrb.position.y = 3.7 + Math.sin(t * 2) * 0.14; }
    if (this.warpRings) {
      for (const w of this.warpRings) w.m.rotation.z += w.dir * 0.016;
      if (this.warpCol) this.warpCol.material.opacity = 0.12 + Math.sin(t * 2) * 0.05;
    }
    if (this.torches) {
      for (const tr of this.torches) {
        if (!tr.light.visible) continue;
        const f = 1 + Math.sin(t * 7 + tr.phase) * 0.12 + Math.sin(t * 13.3 + tr.phase) * 0.06;
        tr.light.intensity = 3.4 * f;
        tr.fire.scale.setScalar(f);
      }
    }
    for (const s of this.shafts) {
      if (s.tex) { s.tex.offset.y = (t * 0.12) % 1; }
      s.light.intensity = 4.5 + Math.sin(t * 2.1 + s.x) * 0.4;
    }
  }
}
