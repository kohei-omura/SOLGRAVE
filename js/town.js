/* ══════════════════════════════════════════════════════════════
   town.js ── 地上の街「陽ノ辻（ひのつじ）」
     縦穴のまわりに開けた宿場町。住人と話し、道具を購う。
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { stoneMaterial, metalMaterial, glowMaterial, fleshMaterial } from './gfx.js';

/* ── 住人 ──
   kind: 'shop' 道具屋／'inn' 宿／'smith' 鍛冶／その他は語らい相手 */
export const TOWNSFOLK = [
  { id: 'shop',  name: '陽子（ようこ）', role: '道具屋', kind: 'shop',
    x: -14, z: -6, hair: 0x3a2418, cloth: 0xb85a3a, skin: 0xf2d8bc,
    lines: ['よく戻ったねぇ。掘り出し物、見ていくかい？',
            'その傷……無理はいけないよ。',
            '深いところの品は、うちにも滅多に入らないのさ。'] },
  { id: 'inn',   name: '芹（せり）',     role: '宿の娘', kind: 'inn',
    x: 14, z: -7, hair: 0x1d1620, cloth: 0x6a8ab0, skin: 0xf6dcc8,
    lines: ['おかえりなさい。少し休んでいかれますか？',
            '湯を沸かしてあります。ゆっくりどうぞ。',
            '……ご無事で、ほんとうによかった。'] },
  { id: 'smith', name: '鉄爺（てつじい）', role: '鍛冶', kind: 'smith',
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
  { id: 'old',   name: '宗庵（そうあん）', role: '語り部', kind: 'talk',
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
    this.built = false;
  }

  /** 街を建てる。colliders は world のものを借りる */
  build(colliders) {
    this.clear();
    const wall = stoneMaterial(201, 0x9a8f7e);
    const roof = stoneMaterial(202, 0x7a4038);
    const wood = stoneMaterial(203, 0x6a5238);

    const box = (w, h, d, x, y, z, mat, solid) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
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
    houses.forEach((h, i) => {
      const [x, z, w, d] = h;
      const ht = 3.4 + (i % 3) * 0.6;
      const T = 0.4, DOOR = 2.4;
      // 中空にして、南面に戸口を空ける
      // 北・東・西の壁
      box(w, ht, T, x, ht / 2, z - d / 2 + T / 2, wall, true);
      box(T, ht, d, x - w / 2 + T / 2, ht / 2, z, wall, true);
      box(T, ht, d, x + w / 2 - T / 2, ht / 2, z, wall, true);
      // 南面は戸口を残して左右に
      const side = (w - DOOR) / 2;
      if (side > 0.1) {
        box(side, ht, T, x - (DOOR / 2 + side / 2), ht / 2, z + d / 2 - T / 2, wall, true);
        box(side, ht, T, x + (DOOR / 2 + side / 2), ht / 2, z + d / 2 - T / 2, wall, true);
      }
      // 鴨居
      box(DOOR + 0.6, 0.5, T, x, ht - 0.25, z + d / 2 - T / 2, wood, false);
      // 床
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(w - T * 2, d - T * 2), wood);
      fl.rotation.x = -Math.PI / 2; fl.position.set(x, 0.04, z);
      fl.receiveShadow = true;
      this.group.add(fl);
      // ── 中の調度 ──
      const put = (gw, gh, gd, gx, gy, gz, mat) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, gd), mat);
        m.position.set(gx, gy, gz); m.castShadow = true;
        this.group.add(m);
        colliders && colliders.push({ min: { x: gx - gw / 2, z: gz - gd / 2 },
                                      max: { x: gx + gw / 2, z: gz + gd / 2 } });
      };
      if (i % 3 === 0) {          // 寝間
        put(1.9, 0.5, 1.1, x - w / 4, 0.25, z - d / 4, wood);
        put(0.5, 0.5, 0.5, x + w / 4, 0.25, z - d / 4, wall);
      } else if (i % 3 === 1) {   // 台所
        put(1.6, 0.9, 0.7, x, 0.45, z - d / 2 + 1.2, wall);
        put(0.7, 0.7, 0.7, x - w / 4, 0.35, z + d / 4, wood);
      } else {                    // 仕事場
        put(1.5, 0.75, 0.9, x, 0.38, z, wood);
        put(0.6, 1.4, 0.6, x + w / 4, 0.7, z - d / 4, wall);
      }
      // 室内の灯り
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), glowMaterial(0xffd48a, 2.0));
      lamp.position.set(x, ht - 0.7, z);
      this.group.add(lamp);
      const il = new THREE.PointLight(0xffd48a, 1.6, 9, 2);
      il.position.set(x, ht - 0.8, z);
      this.group.add(il);
      this.rooms.push({ x, z, w, d });
      // 切妻屋根
      const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 1.9, 4), roof);
      r.position.set(x, ht + 0.95, z); r.rotation.y = Math.PI / 4; r.castShadow = true;
      this.group.add(r);
      // 障子窓（灯り）
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9),
        new THREE.MeshStandardMaterial({ color: 0xffe8b8, emissive: new THREE.Color(0xffd48a), emissiveIntensity: 1.2 }));
      win.position.set(x, ht * 0.55, z + d / 2 + 0.02);
      this.group.add(win);
      const wl = new THREE.PointLight(0xffd48a, 1.0, 8, 2);
      wl.position.set(x, ht * 0.55, z + d / 2 + 0.6);
      this.group.add(wl);
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
      l.position.set(x, 2.7, z);
      this.group.add(l);
      this.lanterns.push({ lamp, light: l, phase: Math.random() * 6.28 });
    });

    // ── 鳥居（縦穴の手前） ──
    const torii = metalMaterial(206, 0xb3424a);
    box(0.5, 6, 0.5, -4.6, 3, 30, torii, true);
    box(0.5, 6, 0.5, 4.6, 3, 30, torii, true);
    box(11.6, 0.6, 0.8, 0, 6.2, 30, torii, false);
    box(10, 0.4, 0.6, 0, 5.3, 30, torii, false);

    // ── 住人 ──
    TOWNSFOLK.forEach(def => this._addNpc(def, colliders));
    this.built = true;
    return this;
  }

  _addNpc(def, colliders) {
    const g = new THREE.Group();
    // 体
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.62, 5, 10), fleshMaterial(def.cloth));
    body.position.y = 0.92; body.castShadow = true;
    g.add(body);
    // 頭
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), fleshMaterial(def.skin));
    head.position.y = 1.5; head.castShadow = true;
    g.add(head);
    // 髪
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.235, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
      fleshMaterial(def.hair));
    hair.position.y = 1.53;
    g.add(hair);
    if (def.id === 'girl1' || def.id === 'girl2' || def.id === 'inn') {
      const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 5, 9), fleshMaterial(def.hair));
      back.position.set(0, 1.2, -0.15);
      g.add(back);
    }
    // 目
    [-1, 1].forEach(sx => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), fleshMaterial(0x241c26));
      e.position.set(0.075 * sx, 1.49, 0.2);
      g.add(e);
    });
    // 役目の印（頭上）
    const mark = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8),
      glowMaterial(def.kind === 'shop' ? 0xffd24a : def.kind === 'inn' ? 0x8ad0ff :
                   def.kind === 'smith' ? 0xff8a5a : 0xa0ffc0, 2.0));
    mark.position.y = 2.0;
    g.add(mark);

    g.position.set(def.x, 0, def.z);
    this.group.add(g);
    if (colliders) {
      colliders.push({ min: { x: def.x - 0.4, z: def.z - 0.4 }, max: { x: def.x + 0.4, z: def.z + 0.4 } });
    }
    this.npcs.push({
      def, group: g, mark, home: new THREE.Vector3(def.x, 0, def.z),
      t: Math.random() * 6.28, line: 0
    });
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
  talk(n) {
    if (!n) return null;
    const l = n.def.lines[n.line % n.def.lines.length];
    n.line++;
    return { name: n.def.name, role: n.def.role, text: l, kind: n.def.kind };
  }

  update(t, playerPos) {
    // 灯籠の揺らぎ
    if (this.lanterns) {
      for (const l of this.lanterns) {
        const f = 1 + Math.sin(t * 3 + l.phase) * 0.08;
        l.light.intensity = 2.4 * f;
        l.lamp.material.emissiveIntensity = 1.6 * f;
      }
    }
    // 住人はその場で軽く揺れ、近づくとこちらを向く
    for (const n of this.npcs) {
      n.t += 0.01;
      n.group.position.y = Math.sin(n.t * 1.4) * 0.03;
      n.mark.position.y = 2.0 + Math.sin(t * 2 + n.t) * 0.07;
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
