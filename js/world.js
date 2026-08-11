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
    this.gimmicks = null;
    this.spawnPoints = []; this.exit = null; this.bossRoom = null;
  }

  _box(w, h, d, x, y, z, mat, collide) {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
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
  buildSurface() {
    this.clear();
    this.isSurface = true;

    const floorMat = stoneMaterial(11, 0x8d8471);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), floorMat);
    f.rotation.x = -Math.PI / 2; f.receiveShadow = true;
    this.group.add(f);

    // 外周の崩れた石壁
    const wallMat = stoneMaterial(12, 0x7c8493);
    const R = 26;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      const h = 2.4 + ((i * 37) % 10) * 0.22;
      const m = this._box(3.2, h, 1.6, x, h / 2, z, wallMat, true);
      m.rotation.y = -a;
    }

    // 中央の祭壇（浄化装置の土台）
    const alt = stoneMaterial(13, 0x9a9287);
    this._box(7, 0.6, 7, 0, 0.3, 0, alt, false);
    this._box(1.1, 1.6, 1.1, -2.4, 1.1, -2.4, alt, true);
    this._box(1.1, 1.6, 1.1, 2.4, 1.1, -2.4, alt, true);

    // 地下への入口
    const holeMat = new THREE.MeshStandardMaterial({ color: 0x05070b, roughness: 1 });
    const hole = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), holeMat);
    hole.rotation.x = -Math.PI / 2; hole.position.set(0, 0.02, 12);
    this.group.add(hole);
    const ring = metalMaterial(14, 0x7a6a44);
    const rm = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.16, 8, 28), ring);
    rm.rotation.x = -Math.PI / 2; rm.position.set(0, 0.1, 12);
    this.group.add(rm);
    this.entrance = { x: 0, z: 12, r: 2.2 };

    this.playerStart = new THREE.Vector3(0, 0, 20);
    return this;
  }

  /* ── 地下ダンジョン ─────────────────────── */
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
    const GW = Math.min(6, 3 + Math.floor(this.floor / 2));
    const GH = Math.min(6, 3 + Math.floor((this.floor + 1) / 2));
    const CELL = 34;                       // 部屋の間隔

    const floorMat = stoneMaterial(21, 0x6f747f);
    const wallMat  = stoneMaterial(22, 0x7b8291);

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
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
        fl.rotation.x = -Math.PI / 2; fl.position.set(cx, 0, cz); fl.receiveShadow = true;
        this.group.add(fl);
        const cl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
        cl.rotation.x = Math.PI / 2; cl.position.set(cx, WALL_H, cz);
        this.group.add(cl);

        // 四方の壁（通じている面だけ戸口を空ける）
        const rowZ = (zPos, open) => {
          if (!open) { this._box(w + T2 * 2, WALL_H, T2, cx, WALL_H / 2, zPos, wallMat, true); return; }
          const side = (w + T2 * 2 - DOOR) / 2;
          if (side > 0.1) {
            this._box(side, WALL_H, T2, cx - (DOOR / 2 + side / 2), WALL_H / 2, zPos, wallMat, true);
            this._box(side, WALL_H, T2, cx + (DOOR / 2 + side / 2), WALL_H / 2, zPos, wallMat, true);
          }
          const lin = new THREE.Mesh(new THREE.BoxGeometry(DOOR + 1.2, 0.7, T2 + 0.2), wallMat);
          lin.position.set(cx, WALL_H - 0.35, zPos); this.group.add(lin);
        };
        const colX = (xPos, open) => {
          if (!open) { this._box(T2, WALL_H, d + T2 * 2, xPos, WALL_H / 2, cz, wallMat, true); return; }
          const side = (d + T2 * 2 - DOOR) / 2;
          if (side > 0.1) {
            this._box(T2, WALL_H, side, xPos, WALL_H / 2, cz - (DOOR / 2 + side / 2), wallMat, true);
            this._box(T2, WALL_H, side, xPos, WALL_H / 2, cz + (DOOR / 2 + side / 2), wallMat, true);
          }
          const lin = new THREE.Mesh(new THREE.BoxGeometry(T2 + 0.2, 0.7, DOOR + 1.2), wallMat);
          lin.position.set(xPos, WALL_H - 0.35, cz); this.group.add(lin);
        };
        rowZ(cz - d / 2 - T2 / 2, c.N);
        rowZ(cz + d / 2 + T2 / 2, c.S);
        colX(cx - w / 2 - T2 / 2, c.W);
        colX(cx + w / 2 + T2 / 2, c.E);

        // 通路
        if (c.S) this._corridorZ(cx, cz + d / 2, cz + CELL - d / 2, wallMat, floorMat, DOOR);
        if (c.E) this._corridorX(cz, cx + w / 2, cx + CELL - w / 2, wallMat, floorMat, DOOR);

        // 松明
        this._addTorch(cx - w / 2 + 1.8, cz - d / 2 + 1.8);
        this._addTorch(cx + w / 2 - 1.8, cz + d / 2 - 1.8);

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

    this.bossRoom = far.room;
    this.startRoom = cells[0][0].room;
    this._addBossWindow(this.bossRoom);

    // ── 仕掛け ──
    this.gimmicks = { keys: [], doors: [], switches: [], hazards: [], chests: [] };
    this.startRoom = cells[0][0].room;
    // 鍵は必ず1つ置く（行き止まりが無ければ、入口から遠い部屋へ）
    const candidates = dead.length ? dead : this.rooms.filter(r => r !== this.startRoom && r !== this.bossRoom);
    const pool = candidates.length ? candidates : this.rooms.filter(r => r !== this.startRoom);
    const keyRoom = pool[Math.floor(rnd() * pool.length)] || this.rooms[1];
    if (keyRoom) this._addKey(keyRoom.x, keyRoom.z);
    // 宝箱も最低2つ
    const chestPool = this.rooms.filter(r => r !== this.startRoom && r !== this.bossRoom && r !== keyRoom);
    for (let i = 0; i < Math.min(3, chestPool.length); i++) {
      const r = chestPool[Math.floor(rnd() * chestPool.length)];
      if (r && !this.gimmicks.chests.some(c => c.x === r.x && c.z === r.z)) this._addChest(r.x + 4, r.z + 4);
    }
    // ボス部屋の手前に封印扉
    const bx = this.bossRoom.x, bz = this.bossRoom.z;
    this._addSealDoor(bx, bz - this.bossRoom.d / 2 - 1.0);
    // 撃つと開く祭壇
    const sw = this.rooms[Math.floor(this.rooms.length / 2)];
    if (sw && sw !== this.bossRoom) this._addSwitch(sw.x, sw.z);
    // 光の罠（踏むと傷つく床）
    this.rooms.forEach((r, i) => {
      if (i % 4 === 2 && r !== this.startRoom && r !== this.bossRoom) {
        this._addHazard(r.x + 3, r.z - 3);
      }
    });

    this.playerStart = new THREE.Vector3(this.startRoom.x, 0, this.startRoom.z);
    this.exit = { x: this.startRoom.x, z: this.startRoom.z, r: 2.6 };
    const ex = glowMaterial(0xffd98a, 1.6);
    const em = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.14, 8, 26), ex);
    em.rotation.x = -Math.PI / 2;
    em.position.set(this.exit.x, 0.12, this.exit.z);
    this.group.add(em);
    return this;
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
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, len), floorMat);
    fl.rotation.x = -Math.PI / 2; fl.position.set(cx, 0, mz); fl.receiveShadow = true;
    this.group.add(fl);
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(W, len), floorMat);
    cl.rotation.x = Math.PI / 2; cl.position.set(cx, WALL_H, mz);
    this.group.add(cl);
    this._box(T, WALL_H, len, cx - W / 2 - T / 2, WALL_H / 2, mz, wallMat, true);
    this._box(T, WALL_H, len, cx + W / 2 + T / 2, WALL_H / 2, mz, wallMat, true);
  }
  /** 東西の通路 */
  _corridorX(cz, x1, x2, wallMat, floorMat, W) {
    const len = Math.abs(x2 - x1) + 6;
    const mx = (x1 + x2) / 2;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(len, W), floorMat);
    fl.rotation.x = -Math.PI / 2; fl.position.set(mx, 0, cz); fl.receiveShadow = true;
    this.group.add(fl);
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(len, W), floorMat);
    cl.rotation.x = Math.PI / 2; cl.position.set(mx, WALL_H, cz);
    this.group.add(cl);
    this._box(len, WALL_H, T, mx, WALL_H / 2, cz - W / 2 - T / 2, wallMat, true);
    this._box(len, WALL_H, T, mx, WALL_H / 2, cz + W / 2 + T / 2, wallMat, true);
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
      glowMaterial(0xff8a3a, 2.6)
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
  /** 円（プレイヤー/敵）と壁AABBの押し戻し */
  resolve(pos, radius) {
    // 高速移動でも抜けないよう二度当てる
    for (let pass = 0; pass < 2; pass++)
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
    if (!this.torches) return;
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
      for (let i = 0; i < sh.length; i++) sh[i].light.visible = (i < 3);
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
