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
    this.colliders = []; this.shafts = []; this.rooms = [];
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
  buildDungeon(seed) {
    this.clear();
    this.isSurface = false;
    const rnd = rngFactory(seed || 12345);
    const roomCount = 5 + Math.floor(rnd() * 4);   // 5〜8

    const floorMat = stoneMaterial(21, 0x6f747f);
    const wallMat  = stoneMaterial(22, 0x7b8291);

    // 部屋を一列＋分岐で並べる
    let cx = 0, cz = 0;
    for (let i = 0; i < roomCount; i++) {
      const w = 26 + Math.floor(rnd() * 16);   // 部屋を大きく
      const d = 24 + Math.floor(rnd() * 14);
      const room = { x: cx, z: cz, w, d, index: i };
      this.rooms.push(room);

      // 床
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
      fl.rotation.x = -Math.PI / 2;
      fl.position.set(cx, 0, cz);
      fl.receiveShadow = true;
      this.group.add(fl);

      // 天井（最深部以外）
      const cl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
      cl.rotation.x = Math.PI / 2;
      cl.position.set(cx, WALL_H, cz);
      this.group.add(cl);

      // 四方の壁。通路が繋がる面は「戸口」ぶんを空けて左右に分けて置く
      const DOOR = 11;                       // 通路の幅と揃える
      const hasNorth = (i > 0);              // 手前の部屋から来る
      const hasSouth = (i < roomCount - 1);  // 次の部屋へ抜ける

      const wallRow = (zPos, open) => {
        if (!open) {
          this._box(w + T * 2, WALL_H, T, cx, WALL_H / 2, zPos, wallMat, true);
          return;
        }
        // 中央に DOOR ぶんの隙間を残す
        const side = (w + T * 2 - DOOR) / 2;
        if (side > 0.1) {
          this._box(side, WALL_H, T, cx - (DOOR / 2 + side / 2), WALL_H / 2, zPos, wallMat, true);
          this._box(side, WALL_H, T, cx + (DOOR / 2 + side / 2), WALL_H / 2, zPos, wallMat, true);
        }
        // 戸口の上に鴨居を渡して「入口」らしく見せる
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(DOOR + 1.2, 0.7, T + 0.2), wallMat);
        lintel.position.set(cx, WALL_H - 0.35, zPos);
        lintel.castShadow = true;
        this.group.add(lintel);
        // 縁の飾り
        [-1, 1].forEach(sx => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, WALL_H - 0.7, T + 0.25), wallMat);
          post.position.set(cx + sx * (DOOR / 2 + 0.25), (WALL_H - 0.7) / 2, zPos);
          post.castShadow = true;
          this.group.add(post);
          this.colliders.push({
            min: { x: post.position.x - 0.25, z: zPos - (T + 0.25) / 2 },
            max: { x: post.position.x + 0.25, z: zPos + (T + 0.25) / 2 }
          });
        });
      };

      wallRow(cz - d / 2 - T / 2, hasNorth);
      wallRow(cz + d / 2 + T / 2, hasSouth);
      this._box(T, WALL_H, d, cx - w / 2 - T / 2, WALL_H / 2, cz, wallMat, true);
      this._box(T, WALL_H, d, cx + w / 2 + T / 2, WALL_H / 2, cz, wallMat, true);

      // 天窓：2〜3部屋に1つ
      if (i > 0 && i % 2 === 1 && i !== roomCount - 1) {
        this._addShaft(cx + (rnd() - 0.5) * (w * 0.4), cz + (rnd() - 0.5) * (d * 0.4));
      }
      // 松明
      this._addTorch(cx - w / 2 + 1.6, cz - d / 2 + 1.6);
      this._addTorch(cx + w / 2 - 1.6, cz + d / 2 - 1.6);
      this._addTorch(cx - w / 2 + 1.6, cz + d / 2 - 1.6);
      this._addTorch(cx + w / 2 - 1.6, cz - d / 2 + 1.6);

      // 敵の湧き位置
      if (i > 0) {
        const n = 2 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) {
          this.spawnPoints.push(new THREE.Vector3(
            cx + (rnd() - 0.5) * (w - 4), 0, cz + (rnd() - 0.5) * (d - 4)
          ));
        }
      }

      // 次の部屋へ通路を伸ばす
      if (i < roomCount - 1) {
        const corrLen = 10 + rnd() * 8;
        const nz = cz + d / 2 + corrLen + 6;
        this._corridor(cx, cz + d / 2, cx, nz - 6, wallMat, floorMat);
        cz = nz;
      }
    }

    this.bossRoom = this.rooms[this.rooms.length - 1];
    // 最深部は広く、天井に窓の意匠
    this._addBossWindow(this.bossRoom);

    this.playerStart = new THREE.Vector3(this.rooms[0].x, 0, this.rooms[0].z);
    this.exit = { x: this.rooms[0].x, z: this.rooms[0].z - this.rooms[0].d / 2 + 1.5, r: 2.4 };
    // 出口の目印
    const ex = glowMaterial(0xffd98a, 1.4);
    const em = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 8, 24), ex);
    em.rotation.x = -Math.PI / 2;
    em.position.set(this.exit.x, 0.12, this.exit.z);
    this.group.add(em);

    return this;
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

  update(t) {
    if (this.torches) {
      for (const tr of this.torches) {
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
