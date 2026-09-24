/* ══════════════════════════════════════════════════════════════
   interior.js ── 家の中（戸口をくぐると場面が切り替わる）
     道具屋・宿・鍛冶・語り部の庵・民家（三つの間取り）。
     部屋割り・住人・家具・小物を家ごとに作り込み、調べも変える。
     街から遠く離れた場所に組み立て、出ると街へ戻る。
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { World } from './world.js';
import { stoneMaterial, metalMaterial, glowMaterial, fleshMaterial } from './gfx.js';
import { makeFolk, TOWNSFOLK, talkTo } from './town.js';
import { buildWeaponModel } from './weapons.js';

export const OX = 0, OZ = -900;       // 家の中はここに組む
const WH = 2.9;                        // 壁の高さ（見下ろす視点を遮らない）

/* 家ごとの住人 */
const FOLK = {
  shopGuest: { id: 'guest', name: '旅の薬売り', role: '客', kind: 'talk', hair: 0x2a2a2a, cloth: 0x5a6a4a, skin: 0xe8c8a8,
    lines: ['ここの陽子さんは目利きでね。', '地下の品は高く売れるんだ。', '薬なら、わしの荷にもあるよ。'] },
  innGuest: { id: 'traveler', name: '行商の娘・紬', role: '泊まり客', kind: 'talk', hair: 0x3a2018, cloth: 0xa06a8a, skin: 0xf6dcc8, long: true,
    lines: ['芹さんのお味噌汁、日本一なんです。', 'あなたが噂の陽光狩人さん？', '明日は西の聖域まで行くつもりです。'] },
  innCook: { id: 'cook', name: '女将・千代', role: '宿の女将', kind: 'talk', hair: 0x4a4a4a, cloth: 0x6a3a3a, skin: 0xf0d0b0, apron: 0xf0ece0, fat: true,
    lines: ['芹は働き者でね、自慢の娘だよ。', '腹が減っては戦はできぬってね。', '部屋は二階。ゆっくりおし。'] },
  apprentice: { id: 'appr', name: '弟子・鋼太', role: '鍛冶見習い', kind: 'talk', hair: 0x1a1a1a, cloth: 0x4a3a2a, skin: 0xe0b890, apron: 0x6a4a2a,
    lines: ['鉄爺の打つ刃は、陽を吸うんです。', 'いつか俺も伝説の一振りを……！', '火の番は俺の仕事っす。'] },
  scholar: { id: 'scholar', name: '書生・蛍', role: '語り部の弟子', kind: 'talk', hair: 0x1a1a2a, cloth: 0x3a4a6a, skin: 0xf4dcc4, long: true,
    lines: ['地下の主たちは、古い神話そのままの姿なのです。', '十階ごとに、地の底の景色が変わるそうです。', '仕掛けを解けば、封じられた者が目覚めます。'] },
  mother: { id: 'mother', name: '母・結', role: '住人', kind: 'talk', hair: 0x2a1a14, cloth: 0x8a6a4a, skin: 0xf2d8bc, apron: 0xe8e0d0, long: true,
    lines: ['いつも町を守ってくれてありがとう。', 'お茶でもいかが？', '夫は井戸の修理に出てるの。'] },
  child: { id: 'child', name: '娘・小春', role: '住人', kind: 'talk', hair: 0x2a1a14, cloth: 0xe08aa0, skin: 0xf8e0cc, small: true,
    lines: ['おにいちゃん、つよいの？', 'ひよりおねえちゃんみたいになりたい！', 'これ、あげる！（どんぐりをもらった）'] },
  grandpa: { id: 'gp', name: '祖父・源蔵', role: '住人', kind: 'talk', hair: 0xd8d0c4, cloth: 0x4a4a5a, skin: 0xd8b892, beard: true,
    lines: ['わしも若い頃は潜ったものよ。', '天窓の光を侮るでないぞ。', '孫の顔を見るのが何よりの楽しみじゃ。'] },
  farmer: { id: 'farmer', name: '百姓・茂', role: '住人', kind: 'talk', hair: 0x2a2018, cloth: 0x6a7a4a, skin: 0xd8b890,
    lines: ['今年の米は陽が足りなくてな。', 'あんたが陽を取り戻してくれるなら……', '畑の案山子が夜に動いた気がするんだ。'] },
  weaver: { id: 'weaver', name: '機織り・綾', role: '住人', kind: 'talk', hair: 0x1a1a24, cloth: 0x8a4a6a, skin: 0xf8e0cc, long: true,
    lines: ['日和様の千早は、わたしが織ったのですよ。', '糸にも陽を通すと、丈夫になるの。', '良い布が織れたら、見せに来てくださいね。'] },
  boy: { id: 'boy', name: '息子・太一', role: '住人', kind: 'talk', hair: 0x1a1a1a, cloth: 0x4a6aa0, skin: 0xf0d0aa, small: true,
    lines: ['木の剣で修行してるんだ！', '地下にはお宝があるんでしょ？', 'おかあちゃんには内緒だよ。'] }
};

const DEF = {
  shop:  { name: '道具屋「陽だまり」', bgm: 'shop',  w: 24, d: 18, floor: 0x7a5a3a, wall: 0xd8c8a8 },
  inn:   { name: '宿「芹の湯」',       bgm: 'inn',   w: 30, d: 22, floor: 0x8a6a44, wall: 0xe0d0b0 },
  smith: { name: '鍛冶場「鉄爺」',     bgm: 'smith', w: 26, d: 20, floor: 0x4a4038, wall: 0x6a5a4a },
  lib:   { name: '語り部の庵',         bgm: 'lib',   w: 22, d: 18, floor: 0x6a5238, wall: 0xc8b898 },
  home:  { name: '民家',               bgm: 'home',  w: 22, d: 18, floor: 0xb8a878, wall: 0xe8dcc0 }
};

export class Interior {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.colliders = [];
    this.npcs = [];
    this.lights = [];
    this.anims = [];
    this.active = false;
  }

  clear() {
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.scene.remove(this.group);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.colliders = []; this.npcs = []; this.lights = []; this.anims = [];
    this._batches = null; this._planes = null; this._geos = null; this._ceilMat = null;
    this.active = false;
  }

  /* world.js の統合描画をそのまま借りる（壁・床は材質ごとに1メッシュ） */
  _batch(...a) { return World.prototype._batch.apply(this, a); }
  _batchPlane(...a) { return World.prototype._batchPlane.apply(this, a); }
  _prop(...a) { return World.prototype._prop.apply(this, a); }
  _flushBatches() { return World.prototype._flushBatches.call(this); }
  _flushGeos() { return World.prototype._flushGeos.call(this); }

  /** 家の中を組む */
  build(kind, variant) {
    this.clear();
    const D = DEF[kind] || DEF.home;
    this.kind = kind; this.def = D;
    const W = D.w, Dp = D.d;
    const floorMat = stoneMaterial(501, D.floor), wallMat = stoneMaterial(502, D.wall);
    const wood = stoneMaterial(503, 0x6a4a2a), dark = fleshMaterial(0x2a1c14);
    this.floorMat = floorMat;
    // 床
    this._batchPlane(W, Dp, OX, 0, OZ, true, floorMat);
    // 壁（南は低い腰壁。上から覗けるように）
    const T = 0.5;
    this._batch(W + T * 2, WH, T, OX, WH / 2, OZ - Dp / 2 - T / 2, wallMat, true);
    this._batch(T, WH, Dp + T * 2, OX - W / 2 - T / 2, WH / 2, OZ, wallMat, true);
    this._batch(T, WH, Dp + T * 2, OX + W / 2 + T / 2, WH / 2, OZ, wallMat, true);
    const DOOR = 3.2, side = (W - DOOR) / 2;
    this._batch(side, 1.0, T, OX - DOOR / 2 - side / 2, 0.5, OZ + Dp / 2 + T / 2, wallMat, true);
    this._batch(side, 1.0, T, OX + DOOR / 2 + side / 2, 0.5, OZ + Dp / 2 + T / 2, wallMat, true);
    // 柱と梁
    for (let i = 0; i <= 4; i++) {
      const x = OX - W / 2 + (W / 4) * i;
      this._batch(0.35, WH + 0.3, 0.35, x, (WH + 0.3) / 2, OZ - Dp / 2, wood, false);
    }
    this._batch(W, 0.3, 0.3, OX, WH + 0.1, OZ - Dp / 2, wood, false);
    // 出口（暖簾と光る敷物）
    const exitMat = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    exitMat.rotation.x = -Math.PI / 2; exitMat.position.set(OX, 0.03, OZ + Dp / 2 - 0.2);
    this.group.add(exitMat);
    this.exitMat = exitMat;
    this.exit = { x: OX, z: OZ + Dp / 2 + 0.3 };
    this.spawn = new THREE.Vector3(OX, 0, OZ + Dp / 2 - 2.2);

    const put = (fn) => fn.call(this, { W, Dp, wood, dark, wallMat, floorMat, variant: variant || 0 });
    if (kind === 'shop') put(this._shop);
    else if (kind === 'inn') put(this._inn);
    else if (kind === 'smith') put(this._smith);
    else if (kind === 'lib') put(this._lib);
    else put(this._home);

    // 部屋全体をほのかに照らす吊り灯り
    this._lamp(OX - W / 4, 2.4, OZ - Dp / 6, 0xffd08a, 2.6);
    this._lamp(OX + W / 4, 2.4, OZ + Dp / 6, 0xffd08a, 2.6);
    this._flushBatches();
    this.active = true;
    return this;
  }

  /* ── 部品 ── */
  _solid(x, z, hw, hd) { this.colliders.push({ min: { x: x - hw, z: z - hd }, max: { x: x + hw, z: z + hd } }); }
  _box(w, h, d, x, y, z, mat, solid) { this._batch(w, h, d, x, y, z, mat, !!solid); }
  _lamp(x, y, z, color, power) {
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.5, 10), glowMaterial(color, 1.6));
    shade.position.set(x, y, z); this.group.add(shade);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, WH + 1 - y, 4), fleshMaterial(0x1a1a1a));
    cord.position.set(x, y + (WH + 1 - y) / 2, z); this.group.add(cord);
    const l = new THREE.PointLight(color, power || 2.4, 14, 1.8);
    l.position.set(x, y - 0.3, z); this.group.add(l);
    this.lights.push(l);
    return l;
  }
  _folk(def, x, z, face) {
    const d = Object.assign({}, def, { x: x - OX, z: z - OZ, face: face == null ? 0 : face });
    const n = makeFolk(d, OX, OZ);
    this.group.add(n.group);
    this._solid(x, z, 0.4, 0.4);
    this.npcs.push(n);
    return n;
  }
  _townFolk(id, x, z, face) {
    const def = TOWNSFOLK.find(t => t.id === id);
    return def ? this._folk(def, x, z, face) : null;
  }
  _table(x, z, w, d, h, mat) {
    this._box(w, 0.1, d, x, h, z, mat);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => this._box(0.1, h, 0.1, x + sx * (w / 2 - 0.1), h / 2, z + sz * (d / 2 - 0.1), mat));
    this._solid(x, z, w / 2, d / 2);
  }
  _shelf(x, z, w, h, rot, mat, items) {
    // 奥行き0.5の棚（rot=0 で南向き）
    const dz = 0.5;
    const ax = rot ? dz : w, az = rot ? w : dz;
    this._box(ax, h, az, x, h / 2, z, mat);
    this._solid(x, z, ax / 2, az / 2);
    const cols = [0xb3424a, 0x4a8ab0, 0x6aa04a, 0xc9a227, 0x8a5ab0, 0xe8e0d0];
    for (let r = 0; r < 3; r++) {
      const y = 0.5 + r * (h - 0.6) / 3;
      this._box(ax + 0.05, 0.05, az + 0.05, x, y, z, mat);
      const n = Math.floor(w / 0.35);
      for (let i = 0; i < n; i++) {
        if (Math.random() < 0.2) continue;
        const off = -w / 2 + 0.2 + i * 0.35;
        const px = rot ? x + (rot > 0 ? 0.3 : -0.3) : x + off, pz = rot ? z + off : z + 0.3;
        const col = cols[(i + r) % cols.length];
        if (items === 'books') this._prop(this._g('box'), fleshMaterial(col), px, y + 0.2, pz, 0, [rot ? 0.3 : 0.12, 0.34 + (i % 3) * 0.05, rot ? 0.12 : 0.3]);
        else if (items === 'jars') this._prop(this._g('cyl'), fleshMaterial(col), px, y + 0.16, pz, 0, [0.22, 0.3, 0.22]);
        else this._prop(this._g('sph'), glowMaterial(col, 0.6), px, y + 0.13, pz, 0, [0.2, 0.26, 0.2]);
      }
    }
  }
  _g(k) {
    if (!this._pg) this._pg = {
      box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
      sph: new THREE.SphereGeometry(0.5, 12, 10), cone: new THREE.ConeGeometry(0.5, 1, 10),
      tor: new THREE.TorusGeometry(0.5, 0.06, 6, 20)
    };
    return this._pg[k];
  }
  _rug(x, z, w, d, col) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), fleshMaterial(col));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.receiveShadow = true;
    this.group.add(m);
    const b = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 4, 1), fleshMaterial(0xc9a227));
    b.rotation.set(-Math.PI / 2, 0, Math.PI / 4); b.scale.set(w * 0.7, d * 0.7, 1); b.position.set(x, 0.025, z);
    this.group.add(b);
  }
  _barrel(x, z, mat) {
    this._prop(this._g('cyl'), mat || fleshMaterial(0x6a4a2a), x, 0.5, z, 0, [0.9, 1.0, 0.9]);
    this._prop(this._g('tor'), metalMaterial(510, 0x4a4a4a), x, 0.25, z, 0, [0.9, 0.9, 0.9], Math.PI / 2);
    this._prop(this._g('tor'), metalMaterial(510, 0x4a4a4a), x, 0.8, z, 0, [0.9, 0.9, 0.9], Math.PI / 2);
    this._solid(x, z, 0.45, 0.45);
  }
  _tatami(x, z, w, d) {
    const mat = fleshMaterial(0xc8c080);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.12, z); m.receiveShadow = true;
    this.group.add(m);
    this._box(w + 0.2, 0.12, d + 0.2, x, 0.06, z, stoneMaterial(503, 0x6a4a2a));
    const edge = fleshMaterial(0x2a3a2a);
    for (let i = 0; i <= Math.floor(w / 1.8); i++) this._box(0.06, 0.02, d, x - w / 2 + i * 1.8, 0.13, z, edge);
    this._box(w, 0.02, 0.06, x, 0.13, z, edge);
  }
  _shoji(x, z, len, rotY) {
    const frame = stoneMaterial(503, 0x6a4a2a), paper = new THREE.MeshStandardMaterial({ color: 0xfff8e8, emissive: new THREE.Color(0xffe8c0), emissiveIntensity: 0.25, roughness: 0.9 });
    const ax = rotY ? 0.1 : len, az = rotY ? len : 0.1;
    const p = new THREE.Mesh(new THREE.BoxGeometry(ax, 2.2, az), paper);
    p.position.set(x, 1.1, z); this.group.add(p);
    for (let i = 0; i <= 4; i++) {
      const o = -len / 2 + i * len / 4;
      this._box(rotY ? 0.14 : 0.06, 2.2, rotY ? 0.06 : 0.14, x + (rotY ? 0 : o), 1.1, z + (rotY ? o : 0), frame);
    }
    for (let k = 0; k < 3; k++) this._box(rotY ? 0.14 : len, 0.05, rotY ? len : 0.14, x, 0.5 + k * 0.7, z, frame);
    this._solid(x, z, ax / 2, az / 2);
  }
  _fire(x, y, z, scale) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.35 * scale, 0.9 * scale, 10), glowMaterial(0xff8a3a, 3.0, true));
    f.position.set(x, y + 0.4 * scale, z); this.group.add(f);
    const l = new THREE.PointLight(0xff9a50, 3.4, 12, 1.8); l.position.set(x, y + 1, z); this.group.add(l);
    this.lights.push(l);
    this.anims.push((t) => { const k = 1 + Math.sin(t * 11) * 0.12 + Math.sin(t * 17) * 0.06; f.scale.set(k, k * 1.1, k); l.intensity = 3.0 * k; });
    return f;
  }

  /* ── 道具屋 ── */
  _shop(o) {
    const { W, Dp, wood } = o;
    this._rug(OX, OZ + 2, 8, 5, 0x8a2a30);
    // 帳場（カウンター）
    this._box(10, 1.05, 1.0, OX, 0.52, OZ - 3, wood, true);
    this._box(10.2, 0.08, 1.2, OX, 1.08, OZ - 3, stoneMaterial(504, 0x4a2a1a));
    this._prop(this._g('cyl'), metalMaterial(505, 0xc9a227), OX + 3, 1.25, OZ - 3, 0, [0.3, 0.3, 0.3]);   // 秤
    this._prop(this._g('box'), fleshMaterial(0xe8d8b0), OX - 2, 1.16, OZ - 3, 0.2, [0.7, 0.05, 0.5]);   // 帳面
    this._townFolk('shop', OX, OZ - 5, 0);
    // 奥の棚
    this._shelf(OX - 6, OZ - Dp / 2 + 0.6, 7, 2.5, 0, fleshMaterial(0x5a3a24), 'jars');
    this._shelf(OX + 6, OZ - Dp / 2 + 0.6, 7, 2.5, 0, fleshMaterial(0x5a3a24), 'potions');
    // 横の棚
    this._shelf(OX - W / 2 + 0.6, OZ + 1, 6, 2.2, 1, fleshMaterial(0x5a3a24), 'jars');
    // 品台（護符を並べる）
    this._table(OX + 7, OZ + 3, 3, 1.6, 0.8, wood);
    for (let i = 0; i < 5; i++) this._prop(this._g('sph'), glowMaterial([0x6affa0, 0xffd24a, 0xff8ad0, 0x8ad0ff, 0xffffff][i], 1.2), OX + 6 + i * 0.5, 0.95, OZ + 3, 0, 0.18);
    // 樽と米俵
    this._barrel(OX - 9, OZ + 5); this._barrel(OX - 8, OZ + 6.2);
    for (let i = 0; i < 3; i++) this._prop(this._g('cyl'), fleshMaterial(0xd8c890), OX + 9.5, 0.35 + i * 0.55, OZ - 6, 0, [0.7, 1.1, 0.7], 0, Math.PI / 2);
    this._solid(OX + 9.5, OZ - 6, 0.6, 0.6);
    // 吊るした干し草と提灯
    for (let i = 0; i < 4; i++) {
      const lan = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), glowMaterial(0xff6a4a, 1.4));
      lan.scale.set(1, 1.3, 1); lan.position.set(OX - 4.5 + i * 3, 2.5, OZ - 1); this.group.add(lan);
    }
    this._folk(FOLK.shopGuest, OX - 3, OZ + 2.5, Math.PI);
  }

  /* ── 宿 ── */
  _inn(o) {
    const { W, Dp, wood } = o;
    // 受付
    this._box(4, 1.0, 0.9, OX - 8, 0.5, OZ + 3, wood, true);
    this._townFolk('inn', OX - 8, OZ + 1.6, 0);
    this._prop(this._g('sph'), metalMaterial(505, 0xc9a227), OX - 7, 1.1, OZ + 3, 0, 0.16);   // 呼び鈴
    // 囲炉裏
    this._box(2.4, 0.3, 2.4, OX, 0.15, OZ - 1, stoneMaterial(506, 0x4a4a4a), true);
    this._box(1.8, 0.1, 1.8, OX, 0.31, OZ - 1, fleshMaterial(0x2a1a14));
    this._fire(OX, 0.3, OZ - 1, 0.9);
    this._box(0.05, 2.4, 0.05, OX, 1.5, OZ - 1, fleshMaterial(0x1a1a1a));
    this._prop(this._g('sph'), metalMaterial(507, 0x2a2a2a), OX, 1.0, OZ - 1, 0, [0.6, 0.45, 0.6]);   // 鉄瓶
    // 膳と座布団
    [[-4, -4], [4, -4], [-4, 2], [4, 2]].forEach(([x, z]) => {
      this._table(OX + x, OZ + z, 2.2, 1.2, 0.4, wood);
      [-1, 1].forEach(s => this._prop(this._g('box'), fleshMaterial(0x8a2a30), OX + x, 0.06, OZ + z + s * 1.1, 0, [0.8, 0.12, 0.8]));
      this._prop(this._g('cyl'), fleshMaterial(0xf0ece0), OX + x - 0.4, 0.52, OZ + z, 0, [0.25, 0.14, 0.25]);
      this._prop(this._g('cyl'), fleshMaterial(0x3a2a1a), OX + x + 0.4, 0.52, OZ + z, 0, [0.25, 0.14, 0.25]);
    });
    this._folk(FOLK.innGuest, OX + 4, OZ + 3.2, Math.PI);
    this._folk(FOLK.innCook, OX - 2.5, OZ - 6.5, 0.4);
    // 奥の階段（二階へ）
    for (let i = 0; i < 8; i++) this._box(3, 0.3 * (i + 1), 0.6, OX - W / 2 + 2, 0.15 * (i + 1), OZ - Dp / 2 + 5.2 - i * 0.6, wood, false);
    this._solid(OX - W / 2 + 2, OZ - Dp / 2 + 3, 1.5, 2.6);
    // 東の客間（障子で仕切る）
    this._shoji(OX + W / 2 - 7, OZ - 4, 8, true);
    this._tatami(OX + W / 2 - 3.5, OZ - 4, 6, 7.5);
    [-1.5, 1.5].forEach(z => {
      this._prop(this._g('box'), fleshMaterial(0xf0ece0), OX + W / 2 - 3.5, 0.25, OZ - 4 + z, 0, [2.0, 0.22, 1.1]);
      this._prop(this._g('box'), fleshMaterial(0x6a8ab0), OX + W / 2 - 3.2, 0.36, OZ - 4 + z, 0, [1.4, 0.06, 1.0]);
      this._prop(this._g('cyl'), fleshMaterial(0xf0ece0), OX + W / 2 - 4.4, 0.4, OZ - 4 + z, 0, [0.3, 0.6, 0.3], 0, Math.PI / 2);
    });
    // 提灯
    for (let i = 0; i < 5; i++) {
      const lan = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 12), glowMaterial(0xfff0d0, 1.4));
      lan.position.set(OX - 10 + i * 5, 2.5, OZ + 6); this.group.add(lan);
    }
    // 湯殿へ続く暖簾
    const noren = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ color: 0x3a5a8a, side: THREE.DoubleSide }));
    noren.position.set(OX + W / 2 - 0.3, 2.0, OZ + 5); noren.rotation.y = Math.PI / 2; this.group.add(noren);
  }

  /* ── 鍛冶 ── */
  _smith(o) {
    const { W, Dp, wood } = o;
    const brick = stoneMaterial(508, 0x7a3a2a), iron = metalMaterial(509, 0x3a3a40);
    // 炉と煙突の覆い
    this._box(4, 1.3, 3, OX - 6, 0.65, OZ - Dp / 2 + 2.2, brick, true);
    this._box(3, 0.1, 2, OX - 6, 1.31, OZ - Dp / 2 + 2.2, glowMaterial(0xff4a10, 2.6, true));
    this._fire(OX - 6, 1.3, OZ - Dp / 2 + 2.2, 1.2);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.8, 4), brick);
    hood.rotation.y = Math.PI / 4; hood.position.set(OX - 6, WH + 0.2, OZ - Dp / 2 + 2.2); this.group.add(hood);
    // 鞴（ふいご）
    this._box(1.2, 0.5, 2, OX - 8.8, 0.5, OZ - Dp / 2 + 2.2, fleshMaterial(0x5a3a24), true);
    // 金床
    this._box(1.4, 0.4, 0.6, OX - 1.5, 0.9, OZ - 3, iron);
    this._box(0.6, 0.7, 0.5, OX - 1.5, 0.35, OZ - 3, iron);
    this._prop(this._g('cone'), iron, OX - 0.6, 0.9, OZ - 3, 0, [0.3, 0.6, 0.3], 0, -Math.PI / 2);
    this._solid(OX - 1.5, OZ - 3, 0.8, 0.4);
    this._townFolk('smith', OX - 1.5, OZ - 4.4, 0);
    this._folk(FOLK.apprentice, OX - 7.5, OZ - 3.2, 0.6);
    // 焼き入れの桶
    this._barrel(OX + 1.2, OZ - 4, fleshMaterial(0x5a4a3a));
    this._prop(this._g('cyl'), glowMaterial(0x4a8ab0, 0.5), OX + 1.2, 1.0, OZ - 4, 0, [0.8, 0.02, 0.8]);
    // 砥石
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.2, 18), stoneMaterial(511, 0x8a8a84));
    wheel.rotation.z = Math.PI / 2; wheel.position.set(OX + 5, 1.0, OZ - 5); this.group.add(wheel);
    this._box(0.8, 0.9, 0.4, OX + 5, 0.45, OZ - 5, wood, true);
    this.anims.push((t) => { wheel.rotation.x = t * 3; });
    // 武器掛け（打った武器を並べる）
    const racks = [['sword', 'axe', 'spear', 'mace', 'ninjato'], ['dagger', 'katar', 'claw', 'whip', 'shuriken'], ['bow', 'staff', 'tome', 'lute']];
    racks.forEach((row, r) => {
      const z = OZ - 1 + r * 3.2, x0 = OX + W / 2 - 1.0;
      this._box(0.3, 2.4, 3.0, x0, 1.2, z, wood, true);
      row.forEach((t, i) => {
        const m = buildWeaponModel(t, 1 + ((i + r) % 4));
        m.position.set(x0 - 0.35, 0.9 + (i % 2) * 0.1, z - 1.2 + i * 0.6);
        m.rotation.set(-Math.PI / 2, 0, 0);
        m.scale.setScalar(t === 'spear' || t === 'staff' ? 0.9 : 1.2);
        this.group.add(m);
      });
    });
    // 作業台と道具
    this._table(OX + 2, OZ + 3, 3.6, 1.6, 0.9, wood);
    for (let i = 0; i < 4; i++) this._prop(this._g('box'), iron, OX + 0.8 + i * 0.8, 1.0, OZ + 3, i * 0.4, [0.12, 0.08, 0.6]);
    // 炭の山と薪
    for (let i = 0; i < 8; i++) this._prop(this._g('sph'), fleshMaterial(0x1a1a1a), OX - 9.5 + (i % 3) * 0.5, 0.2 + Math.floor(i / 3) * 0.2, OZ + 4 + (i % 2) * 0.4, 0, 0.5);
    for (let i = 0; i < 6; i++) this._prop(this._g('cyl'), fleshMaterial(0x5a3a1a), OX - 9, 0.2 + Math.floor(i / 3) * 0.35, OZ + 6 + (i % 3) * 0.35, 0, [0.3, 1.6, 0.3], 0, Math.PI / 2);
    this._solid(OX - 9.2, OZ + 5, 1.0, 1.6);
  }

  /* ── 語り部の庵 ── */
  _lib(o) {
    const { W, Dp, wood } = o;
    this._shelf(OX - 6, OZ - Dp / 2 + 0.6, 8, 2.6, 0, fleshMaterial(0x4a2a18), 'books');
    this._shelf(OX + 6, OZ - Dp / 2 + 0.6, 8, 2.6, 0, fleshMaterial(0x4a2a18), 'books');
    this._shelf(OX - W / 2 + 0.6, OZ + 1, 8, 2.4, 1, fleshMaterial(0x4a2a18), 'books');
    this._shelf(OX + W / 2 - 0.6, OZ + 1, 8, 2.4, -1, fleshMaterial(0x4a2a18), 'books');
    this._tatami(OX, OZ - 1, 8, 6);
    this._table(OX, OZ - 1, 2.6, 1.4, 0.45, wood);
    this._townFolk('old', OX, OZ - 2.6, 0);
    this._folk(FOLK.scholar, OX + 3.5, OZ + 1.5, -0.8);
    // 蝋燭と巻物
    for (let i = 0; i < 3; i++) {
      this._prop(this._g('cyl'), fleshMaterial(0xf8f0e0), OX - 0.8 + i * 0.8, 0.62, OZ - 1.4, 0, [0.08, 0.3, 0.08]);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glowMaterial(0xffc060, 3));
      f.position.set(OX - 0.8 + i * 0.8, 0.82, OZ - 1.4); this.group.add(f);
    }
    for (let i = 0; i < 4; i++) this._prop(this._g('cyl'), fleshMaterial(0xe8d8b0), OX - 0.6 + i * 0.4, 0.55, OZ - 0.6, 0, [0.1, 0.8, 0.1], 0, Math.PI / 2);
    // 星図の天球
    const orb = new THREE.Group(); orb.position.set(OX - 6, 1.3, OZ + 5);
    [0, 1, 2].forEach(i => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.02, 6, 28), metalMaterial(512, 0xc9a227)); r.rotation.set(i, i * 0.7, 0); orb.add(r); });
    orb.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), glowMaterial(0xffd24a, 2)));
    this.group.add(orb);
    this.anims.push((t) => { orb.rotation.y = t * 0.4; });
    this._box(0.6, 0.7, 0.6, OX - 6, 0.35, OZ + 5, wood, true);
    // 床の間の掛軸
    const scroll = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.0), fleshMaterial(0xf0e8d0));
    scroll.position.set(OX, 1.6, OZ - Dp / 2 + 0.3); this.group.add(scroll);
    const ink = new THREE.Mesh(new THREE.CircleGeometry(0.35, 20), fleshMaterial(0x1a1a1a));
    ink.position.set(OX, 1.8, OZ - Dp / 2 + 0.32); this.group.add(ink);
  }

  /* ── 民家（三つの間取り） ── */
  _home(o) {
    const { W, Dp, wood } = o;
    const v = o.variant % 3;
    // 土間と板の間を分ける
    this._box(W, 0.2, 0.2, OX, 0.1, OZ + 3, wood);
    this._tatami(OX - 3, OZ - 3, 9, 7);
    // ちゃぶ台と座布団
    const cc = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.08, 20), fleshMaterial(0x6a4028));
    cc.position.set(OX - 3, 0.5, OZ - 3); this.group.add(cc);
    this._box(0.1, 0.4, 0.1, OX - 3, 0.3, OZ - 3, wood, false);
    this._solid(OX - 3, OZ - 3, 1.0, 1.0);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      this._prop(this._g('box'), fleshMaterial(0x8a3a4a), OX - 3 + Math.cos(a) * 1.5, 0.18, OZ - 3 + Math.sin(a) * 1.5, 0, [0.7, 0.1, 0.7]);
    }
    this._prop(this._g('cyl'), fleshMaterial(0xf0ece0), OX - 3.2, 0.6, OZ - 3, 0, [0.15, 0.12, 0.15]);
    this._prop(this._g('sph'), fleshMaterial(0xe8e0c8), OX - 2.7, 0.6, OZ - 3.1, 0, [0.35, 0.15, 0.35]);
    // 床の間（掛軸と花）
    this._box(2.6, 0.2, 1.0, OX - 6.5, 0.2, OZ - Dp / 2 + 0.6, wood, true);
    const scroll = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), fleshMaterial([0xf0e8d0, 0xe8e0f0, 0xf0f0e0][v]));
    scroll.position.set(OX - 6.5, 1.6, OZ - Dp / 2 + 0.3); this.group.add(scroll);
    this._prop(this._g('cyl'), fleshMaterial(0x3a5a6a), OX - 6, 0.5, OZ - Dp / 2 + 0.6, 0, [0.3, 0.5, 0.3]);
    for (let i = 0; i < 3; i++) this._prop(this._g('sph'), glowMaterial([0xff8ab0, 0xffe08a, 0xffffff][(i + v) % 3], 0.6), OX - 6 + (i - 1) * 0.15, 0.95 + i * 0.1, OZ - Dp / 2 + 0.6, 0, 0.14);
    // 竈（かまど）と水瓶
    this._box(2.4, 1.0, 1.2, OX + W / 2 - 2, 0.5, OZ + 6, stoneMaterial(506, 0x6a5a4a), true);
    this._prop(this._g('sph'), metalMaterial(507, 0x2a2a2a), OX + W / 2 - 2.5, 1.2, OZ + 6, 0, [0.7, 0.5, 0.7]);
    this._fire(OX + W / 2 - 1.5, 0.25, OZ + 6.6, 0.4);
    this._barrel(OX + W / 2 - 1.2, OZ + 3.8, fleshMaterial(0x6a5a4a));
    // 障子の仕切りと奥の寝間
    this._shoji(OX + 3, OZ - 4, 7, true);
    this._tatami(OX + 7, OZ - 4, 6, 7);
    this._prop(this._g('box'), fleshMaterial(0xf0ece0), OX + 7, 0.25, OZ - 4.5, 0, [2.2, 0.2, 1.4]);
    this._prop(this._g('box'), fleshMaterial([0xb3424a, 0x4a6aa0, 0x6a8a4a][v]), OX + 7.3, 0.36, OZ - 4.5, 0, [1.6, 0.06, 1.3]);
    // 箪笥
    this._box(1.6, 1.8, 0.6, OX + 9.5, 0.9, OZ - Dp / 2 + 0.6, fleshMaterial(0x5a3a24), true);
    for (let i = 0; i < 4; i++) this._prop(this._g('sph'), metalMaterial(505, 0xc9a227), OX + 9.5, 0.4 + i * 0.4, OZ - Dp / 2 + 0.95, 0, 0.08);
    // 住人（間取りごとに家族が違う）
    if (v === 0) { this._folk(FOLK.mother, OX - 1.2, OZ - 3, -Math.PI / 2); this._folk(FOLK.child, OX - 4.6, OZ - 3, Math.PI / 2); }
    else if (v === 1) { this._folk(FOLK.grandpa, OX - 3, OZ - 4.6, 0); this._folk(FOLK.boy, OX + 1, OZ + 5, Math.PI); }
    else { this._folk(FOLK.weaver, OX - 3, OZ - 1.4, Math.PI); this._folk(FOLK.farmer, OX + 5, OZ + 5, Math.PI); }
    // 機織り機（三つ目の家）
    if (v === 2) {
      this._box(2.0, 1.6, 0.1, OX + 5, 0.8, OZ + 1, wood, true);
      for (let i = 0; i < 12; i++) this._box(0.02, 1.2, 0.02, OX + 4.2 + i * 0.14, 0.9, OZ + 1.1, fleshMaterial(0xe08aa0));
    }
  }

  /** 近くの住人 */
  near(x, z, r) {
    let best = null, bd = (r || 2.6) * (r || 2.6);
    for (const n of this.npcs) {
      const dx = n.group.position.x - x, dz = n.group.position.z - z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  talk(n) { return talkTo(n); }

  /** 出口に立ったか */
  atExit(x, z) { return this.exit && Math.abs(x - this.exit.x) < 1.7 && z > this.exit.z - 1.1; }

  update(t, playerPos) {
    this.anims.forEach(f => f(t));
    if (this.exitMat) this.exitMat.material.opacity = 0.25 + Math.sin(t * 2.4) * 0.12;
    for (const n of this.npcs) {
      n.mark.position.y = (n.markY || 2.0) + Math.sin(t * 2 + n.t) * 0.07;
      n.mark.rotation.y += 0.02;
      if (playerPos) {
        const dx = playerPos.x - n.group.position.x, dz = playerPos.z - n.group.position.z;
        if (dx * dx + dz * dz < 25) {
          const want = Math.atan2(dx, dz);
          let diff = ((want - n.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          n.group.rotation.y += diff * 0.08;
        }
      }
    }
  }
}
