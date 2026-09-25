/* ══════════════════════════════════════════════════════════════
   town.js ── 地上の街「陽ノ辻（ひのつじ）」
     縦穴のまわりに開けた宿場町。住人と話し、道具を購う。
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { stoneMaterial, metalMaterial, glowMaterial, fleshMaterial, patternMaterial, worldUV } from './gfx.js';

/* ── 住人 ──
   kind: 'shop' 道具屋／'inn' 宿／'smith' 鍛冶／その他は語らい相手 */
export const TOWNSFOLK = [
  { id: 'shop', indoor: true, name: '陽子（ようこ）', role: '道具屋', kind: 'shop',
    x: -14, z: -6, hair: 0x3a2418, cloth: 0xb85a3a, skin: 0xf2d8bc,
    lines: ['よく戻ったねぇ。掘り出し物、見ていくかい？',
            'その傷……無理はいけないよ。',
            '深いところの品は、うちにも滅多に入らないのさ。'] },
  { id: 'inn', indoor: true,  name: '芹（せり）',     role: '宿の娘', kind: 'inn',
    x: 14, z: -7, hair: 0x1d1620, cloth: 0x6a8ab0, skin: 0xf6dcc8,
    lines: ['おかえりなさい。少し休んでいかれますか？',
            '湯を沸かしてあります。ゆっくりどうぞ。',
            '……ご無事で、ほんとうによかった。'] },
  { id: 'smith', indoor: true, name: '鉄爺（てつじい）', role: '鍛冶', kind: 'smith',
    x: -16, z: 8, hair: 0xd8d0c4, cloth: 0x4a4038, skin: 0xd8b892,
    lines: ['銃はな、魔法じゃねぇ。手入れが命だ。',
            '陽ってのは、溜めるより使い方よ。',
            'また持ってきな。見てやる。'] },
  { id: 'kid',   name: '豆太（まめた）', role: '町の子', kind: 'talk',
    x: 4, z: -15, hair: 0x2a1c14, cloth: 0x8aa85a, skin: 0xf0d0aa,
    lines: ['にいちゃん、また潜るの！？かっけー！',
            'おれも大きくなったら、陽光銃つかうんだ！',
            '巫女のねえちゃん、きれいだよね。'] },
  { id: 'girl1', name: '燐（りん）',     role: '花売り', kind: 'talk',
    x: -7, z: 12,  hair: 0x4a2a3a, cloth: 0xd88aa0, skin: 0xf8e0cc,
    lines: ['向日葵、いかがですか。陽を向く花ですよ。',
            'あなたが戻るたび、町が明るくなる気がします。',
            '……こんど、話し相手になってくださいね。'] },
  { id: 'girl2', name: '澪（みお）',     role: '水汲み', kind: 'talk',
    x: 15, z: 10,  hair: 0x1a2a3a, cloth: 0x7ab0c0, skin: 0xf4dcc4,
    lines: ['井戸の水、冷たくておいしいですよ。',
            '地の底は、まだ暗いままですか。',
            '無事に帰ってきてくれるなら、それでいいんです。'] },
  { id: 'old', indoor: true,  name: '宗庵（そうあん）', role: '語り部', kind: 'talk',
    x: 0, z: -22, hair: 0xc8c0b4, cloth: 0x5a4a6a, skin: 0xd0b898,
    lines: ['この下には、幾層もの闇が眠っておる。',
            '主を祓えば、次の主が目を覚ます。終わりはない。',
            '……それでも、陽は昇るのじゃ。'] },
  { id: 'friend', name: '颯（はやて）',  role: '狩人仲間', kind: 'talk',
    x: 9, z: 14,  hair: 0x2a2018, cloth: 0x6a7a4a, skin: 0xe8c8a4,
    lines: ['よう。今日はどこまで潜った？',
            'おれもいつか、お前みたいに深くまで行くよ。',
            '無茶すんなよ。待ってる奴がいるんだからな。'] }
];

/** 住人の姿を作る（街と家の中で共用） */
export function makeFolk(def, ox, oz) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(def.fat ? 0.34 : 0.26, def.small ? 0.36 : 0.62, 5, 10), fleshMaterial(def.cloth));
  body.position.y = def.small ? 0.62 : 0.92;
  g.add(body);
  const hy = def.small ? 1.08 : 1.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(def.small ? 0.2 : 0.22, 14, 12), fleshMaterial(def.skin));
  head.position.y = hy;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(def.small ? 0.215 : 0.235, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
    fleshMaterial(def.hair));
  hair.position.y = hy + 0.03;
  g.add(hair);
  if (def.long || def.id === 'girl1' || def.id === 'girl2' || def.id === 'inn') {
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 5, 9), fleshMaterial(def.hair));
    back.position.set(0, hy - 0.3, -0.15);
    g.add(back);
  }
  if (def.apron) {
    const ap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.05), fleshMaterial(def.apron));
    ap.position.set(0, 0.8, 0.26);
    g.add(ap);
  }
  if (def.beard) {
    const bd = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 8), fleshMaterial(def.hair));
    bd.position.set(0, hy - 0.22, 0.14); bd.rotation.x = Math.PI;
    g.add(bd);
  }
  [-1, 1].forEach(sx => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), fleshMaterial(0x241c26));
    e.position.set(0.075 * sx, hy - 0.01, 0.2);
    g.add(e);
  });
  const mark = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8),
    glowMaterial(def.kind === 'shop' ? 0xffd24a : def.kind === 'inn' ? 0x8ad0ff :
                 def.kind === 'smith' ? 0xff8a5a : 0xa0ffc0, 2.0));
  mark.position.y = hy + 0.5;
  g.add(mark);
  g.position.set((ox || 0) + def.x, 0, (oz || 0) + def.z);
  if (def.face != null) g.rotation.y = def.face;
  return { def, group: g, mark, markY: hy + 0.5, home: g.position.clone(), t: Math.random() * 6.28, line: 0 };
}

/** 話しかける。次の台詞を返す */
export function talkTo(n) {
  if (!n) return null;
  const l = n.def.lines[n.line % n.def.lines.length];
  n.line++;
  return { name: n.def.name, role: n.def.role, text: l, kind: n.def.kind };
}

/* 街の家の種類（家の並び順に対応）。中に入ると場面が切り替わる */
export const HOUSE_KIND = ['home', 'shop', 'smith', 'home', 'inn', 'home', 'home', 'lib', 'home', 'home', 'home'];
const SIGN = { shop: '道具', inn: '宿', smith: '鍛冶', lib: '書' };

export class Town {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.npcs = [];
    this.built = false;
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
    this.npcs = [];
    this.townLights = null;
    this.built = false;
  }

  /** 街を建てる。colliders は world のものを借りる */
  build(colliders) {
    this.clear();
    const wall = patternMaterial('plaster', 0xe8e0cc, 2.5);
    const roof = patternMaterial('roof', 0x4a4a58, 1.4, { rough: 0.8, metal: 0.2 });
    const wood = patternMaterial('plank', 0x4a3424, 1.2);
    const base = patternMaterial('block', 0x8a8478, 1.6);
    const beam = patternMaterial('plank', 0x2e2018, 1.0);

    const box = (w, h, d, x, y, z, mat, solid) => {
      const g = new THREE.BoxGeometry(w, h, d);
      if (mat.userData && mat.userData.worldUV) { g.translate(x, y, z); worldUV(g, mat.userData.worldUV); g.translate(-x, -y, -z); }
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = true;
      this.group.add(m);
      if (solid && colliders) {
        colliders.push({ min: { x: x - w / 2, z: z - d / 2 }, max: { x: x + w / 2, z: z + d / 2 } });
      }
      return m;
    };

    // ── 家並み ──
    // 広場（半径20）の外周に、区画を分けて建てる
    const houses = [
      [-25, -12, 8, 7], [-25, 2, 8, 7], [-25, 16, 8, 7],
      [25, -12, 8, 7], [25, 2, 8, 7], [25, 16, 8, 7],
      [-13, -26, 9, 7], [3, -26, 9, 7], [19, -26, 8, 7],
      [-30, -24, 7, 6], [30, -24, 7, 6]
    ];
    this.rooms = [];
    this.doors = [];
    houses.forEach((h, i) => {
      const [x, z, w, d] = h;
      const ht = 3.4 + (i % 3) * 0.6;
      const kind = HOUSE_KIND[i] || 'home';
      // 外観は閉じた家。南面の戸口から中へ入ると、家ごとの内部へ場面が移る
      box(w, ht, d, x, ht / 2, z, wall, true);
      // 腰板と柱
      box(w + 0.1, 0.8, d + 0.1, x, 0.4, z, wood, false);
      [-1, 1].forEach(sx => box(0.3, ht, 0.3, x + sx * (w / 2), ht / 2, z + d / 2, wood, false));
      // 戸と暖簾
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.5, 0.12), wood);
      door.position.set(x, 1.25, z + d / 2 + 0.05);
      this.group.add(door);
      const noren = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.9),
        new THREE.MeshStandardMaterial({ color: kind === 'home' ? 0x3a4a6a : 0xb3424a, side: THREE.DoubleSide, roughness: 0.9 }));
      noren.position.set(x, 2.15, z + d / 2 + 0.14);
      this.group.add(noren);
      // 看板（店だけ）
      if (SIGN[kind]) {
        const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
        const c2 = cv.getContext('2d');
        c2.fillStyle = '#2a1a10'; c2.fillRect(0, 0, 128, 64);
        c2.strokeStyle = '#c9a227'; c2.lineWidth = 4; c2.strokeRect(3, 3, 122, 58);
        c2.fillStyle = '#f0d890'; c2.font = 'bold 40px serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
        c2.fillText(SIGN[kind], 64, 34);
        const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshStandardMaterial({ map: tex, emissive: new THREE.Color(0x302010), emissiveIntensity: 0.4 }));
        sign.position.set(x, ht - 0.6, z + d / 2 + 0.08);
        this.group.add(sign);
      }
      // 戸口の灯り（入れる印）
      const mat = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 24),
        new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.35,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      mat.rotation.x = -Math.PI / 2; mat.position.set(x, 0.05, z + d / 2 + 1.0);
      this.group.add(mat);
      this.doors.push({ x, z: z + d / 2 + 0.6, kind, variant: i, ring: mat, outZ: z + d / 2 + 2.6 });
      this.rooms.push({ x, z, w, d });
      // 石の土台と、真壁造りの柱・梁（漆喰の壁に黒い木組み）
      box(w + 0.3, 0.55, d + 0.3, x, 0.27, z, base, false);
      [-1, 0, 1].forEach(k => {
        box(0.22, ht, 0.22, x + k * (w / 2), ht / 2, z + d / 2 + 0.02, beam, false);
        box(0.22, ht, 0.22, x + k * (w / 2), ht / 2, z - d / 2 - 0.02, beam, false);
      });
      [-1, 1].forEach(k => box(0.22, ht, 0.22, x + k * (w / 2 + 0.02), ht / 2, z, beam, false));
      box(w + 0.2, 0.22, 0.24, x, ht * 0.62, z + d / 2 + 0.03, beam, false);
      box(w + 0.2, 0.24, 0.26, x, ht - 0.1, z + d / 2 + 0.03, beam, false);
      box(w + 0.2, 0.24, 0.26, x, ht - 0.1, z - d / 2 - 0.03, beam, false);
      [-1, 1].forEach(k => box(0.26, 0.24, d + 0.2, x + k * (w / 2 + 0.03), ht - 0.1, z, beam, false));
      // 切妻屋根（瓦葺き・深い軒）。棟は東西に通す
      const rw = w / 2 + 0.9, rh = 2.0, rd = d + 1.4;
      const shape = new THREE.Shape();
      shape.moveTo(-rw, 0); shape.lineTo(0, rh); shape.lineTo(rw, 0); shape.lineTo(rw - 0.25, -0.12); shape.lineTo(0, rh - 0.3); shape.lineTo(-rw + 0.25, -0.12); shape.closePath();
      const rg = new THREE.ExtrudeGeometry(shape, { depth: rd, bevelEnabled: false });
      rg.translate(0, 0, -rd / 2);
      rg.rotateY(Math.PI / 2);
      rg.translate(x, ht, z);
      rg.computeVertexNormals();
      worldUV(rg, 1.4);
      const r = new THREE.Mesh(rg, roof);
      r.castShadow = true; r.receiveShadow = true;
      this.group.add(r);
      // 妻壁（東西の三角）と棟瓦
      const gshape = new THREE.Shape(); gshape.moveTo(-d / 2, 0); gshape.lineTo(0, rh - 0.32); gshape.lineTo(d / 2, 0); gshape.closePath();
      [-1, 1].forEach(k => {
        const gg = new THREE.ShapeGeometry(gshape);
        gg.rotateY(k * Math.PI / 2);                 // 外を向く面にする
        gg.translate(x + k * (w / 2 + 0.01), ht, z);
        worldUV(gg, 2.5);
        this.group.add(new THREE.Mesh(gg, wall));
      });
      box(w + 1.9, 0.26, 0.3, x, ht + rh - 0.02, z, beam, false);
      // 障子窓（灯り）
      [-1, 1].forEach(sx => {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.8),
          new THREE.MeshStandardMaterial({ color: 0xffe8b8, emissive: new THREE.Color(0xffd48a), emissiveIntensity: 1.2 }));
        win.position.set(x + sx * (w / 2 - 1.3), ht * 0.55, z + d / 2 + 0.02);
        this.group.add(win);
      });
      const wl = new THREE.PointLight(0xffd48a, 1.0, 8, 2);
      wl.visible = false;
      wl.position.set(x, ht * 0.55, z + d / 2 + 0.8);
      this.group.add(wl);
      (this.townLights = this.townLights || []).push(wl);
    });

    // ── 道の石畳 ──
    // 区画を分ける小径
    [[-19, 0, 4, 44], [19, 0, 4, 44], [0, -20, 60, 4]].forEach(([x, z, w, d]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), stoneMaterial(204, 0xb0a690));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.025, z);
      m.receiveShadow = true;
      this.group.add(m);
    });

    // ── 灯籠 ──
    this.lanterns = [];
    [[-18, -14], [18, -14], [-18, 14], [18, 14], [-21, 0], [21, 0], [0, 24], [0, -24]].forEach(([x, z]) => {
      box(0.5, 2.2, 0.5, x, 1.1, z, wood, false);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.8), glowMaterial(0xffd48a, 1.6));
      lamp.position.set(x, 2.6, z);
      this.group.add(lamp);
      const l = new THREE.PointLight(0xffc878, 2.4, 14, 2);
      l.visible = false;
      l.position.set(x, 2.7, z);
      this.group.add(l);
      this.lanterns.push({ lamp, light: l, phase: Math.random() * 6.28 });
      (this.townLights = this.townLights || []).push(l);
    });

    // ── 鳥居（縦穴の手前） ──
    const torii = metalMaterial(206, 0xb3424a);
    box(0.5, 6, 0.5, -4.6, 3, 30, torii, true);
    box(0.5, 6, 0.5, 4.6, 3, 30, torii, true);
    box(11.6, 0.6, 0.8, 0, 6.2, 30, torii, false);
    box(10, 0.4, 0.6, 0, 5.3, 30, torii, false);

    // ── 住人 ──
    // 店の者と語り部は家の中にいる
    TOWNSFOLK.filter(d => !d.indoor).forEach(def => this._addNpc(def, colliders));
    this.built = true;
    return this;
  }

  _addNpc(def, colliders) {
    const n = makeFolk(def);
    this.group.add(n.group);
    if (colliders) {
      colliders.push({ min: { x: def.x - 0.4, z: def.z - 0.4 }, max: { x: def.x + 0.4, z: def.z + 0.4 } });
    }
    this.npcs.push(n);
  }

  /** 近くの住人を返す */
  near(x, z, r) {
    let best = null, bd = (r || 2.6) * (r || 2.6);
    for (const n of this.npcs) {
      const dx = n.group.position.x - x, dz = n.group.position.z - z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  /** 話しかける。次の台詞を返す */
  talk(n) { return talkTo(n); }

  /** 戸口に立ったか */
  doorAt(x, z) {
    if (!this.doors) return null;
    for (const d of this.doors) if (Math.abs(x - d.x) < 1.5 && Math.abs(z - d.z) < 1.1) return d;
    return null;
  }

  /** 近い灯りだけ点ける */
  cullLights(px, pz, maxOn) {
    if (!this.townLights) return;
    maxOn = maxOn || 6;
    const a = this.townLights;
    for (const l of a) { const dx = l.position.x - px, dz = l.position.z - pz; l._d = dx * dx + dz * dz; }
    const s = a.slice().sort((x, y) => x._d - y._d);
    for (let i = 0; i < s.length; i++) s[i].visible = (i < maxOn && s[i]._d < 1200);
  }

  update(t, playerPos) {
    if (this.doors) this.doors.forEach((d, i) => { d.ring.material.opacity = 0.25 + Math.sin(t * 2.4 + i) * 0.15; });
    // 灯籠の揺らぎ
    if (this.lanterns) {
      for (const l of this.lanterns) {
        if (!l.light.visible) continue;
        const f = 1 + Math.sin(t * 3 + l.phase) * 0.08;
        l.light.intensity = 2.4 * f;
        l.lamp.material.emissiveIntensity = 1.6 * f;
      }
    }
    // 住人はその場で軽く揺れ、近づくとこちらを向く
    for (const n of this.npcs) {
      n.t += 0.01;
      n.group.position.y = Math.sin(n.t * 1.4) * 0.03;
      n.mark.position.y = (n.markY || 2.0) + Math.sin(t * 2 + n.t) * 0.07;
      n.mark.rotation.y += 0.02;
      if (playerPos) {
        const dx = playerPos.x - n.group.position.x, dz = playerPos.z - n.group.position.z;
        if (dx * dx + dz * dz < 36) {
          const want = Math.atan2(dx, dz);
          let cur = n.group.rotation.y;
          let diff = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          n.group.rotation.y = cur + diff * 0.08;
        }
      }
    }
  }
}
