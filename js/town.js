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
    x: -9, z: -4, hair: 0x3a2418, cloth: 0xb85a3a, skin: 0xf2d8bc,
    lines: ['よく戻ったねぇ。掘り出し物、見ていくかい？',
            'その傷……無理はいけないよ。',
            '深いところの品は、うちにも滅多に入らないのさ。'] },
  { id: 'inn',   name: '芹（せり）',     role: '宿の娘', kind: 'inn',
    x: 9,  z: -5, hair: 0x1d1620, cloth: 0x6a8ab0, skin: 0xf6dcc8,
    lines: ['おかえりなさい。少し休んでいかれますか？',
            '湯を沸かしてあります。ゆっくりどうぞ。',
            '……ご無事で、ほんとうによかった。'] },
  { id: 'smith', name: '鉄爺（てつじい）', role: '鍛冶', kind: 'smith',
    x: -13, z: 4, hair: 0xd8d0c4, cloth: 0x4a4038, skin: 0xd8b892,
    lines: ['銃はな、魔法じゃねぇ。手入れが命だ。',
            '陽ってのは、溜めるより使い方よ。',
            'また持ってきな。見てやる。'] },
  { id: 'kid',   name: '豆太（まめた）', role: '町の子', kind: 'talk',
    x: 3,  z: -12, hair: 0x2a1c14, cloth: 0x8aa85a, skin: 0xf0d0aa,
    lines: ['にいちゃん、また潜るの！？かっけー！',
            'おれも大きくなったら、陽光銃つかうんだ！',
            '巫女のねえちゃん、きれいだよね。'] },
  { id: 'girl1', name: '燐（りん）',     role: '花売り', kind: 'talk',
    x: -4, z: 7,  hair: 0x4a2a3a, cloth: 0xd88aa0, skin: 0xf8e0cc,
    lines: ['向日葵、いかがですか。陽を向く花ですよ。',
            'あなたが戻るたび、町が明るくなる気がします。',
            '……こんど、話し相手になってくださいね。'] },
  { id: 'girl2', name: '澪（みお）',     role: '水汲み', kind: 'talk',
    x: 13, z: 6,  hair: 0x1a2a3a, cloth: 0x7ab0c0, skin: 0xf4dcc4,
    lines: ['井戸の水、冷たくておいしいですよ。',
            '地の底は、まだ暗いままですか。',
            '無事に帰ってきてくれるなら、それでいいんです。'] },
  { id: 'old',   name: '宗庵（そうあん）', role: '語り部', kind: 'talk',
    x: 0,  z: -16, hair: 0xc8c0b4, cloth: 0x5a4a6a, skin: 0xd0b898,
    lines: ['この下には、幾層もの闇が眠っておる。',
            '主を祓えば、次の主が目を覚ます。終わりはない。',
            '……それでも、陽は昇るのじゃ。'] },
  { id: 'friend', name: '颯（はやて）',  role: '狩人仲間', kind: 'talk',
    x: 6,  z: 9,  hair: 0x2a2018, cloth: 0x6a7a4a, skin: 0xe8c8a4,
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
    const houses = [
      [-11, -6, 6, 5], [11, -7, 7, 5], [-16, 3, 6, 6], [16, 4, 6, 6],
      [-6, 10, 5, 5], [7, 12, 6, 5], [-2, -19, 7, 5], [18, -2, 5, 6], [-19, -3, 5, 5]
    ];
    houses.forEach((h, i) => {
      const [x, z, w, d] = h;
      const ht = 3.4 + (i % 3) * 0.6;
      box(w, ht, d, x, ht / 2, z, wall, true);
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
    const path = new THREE.Mesh(new THREE.PlaneGeometry(9, 46),
      stoneMaterial(204, 0xa89c88));
    path.rotation.x = -Math.PI / 2; path.position.set(0, 0.02, -2);
    path.receiveShadow = true;
    this.group.add(path);
    const cross = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), stoneMaterial(205, 0xa89c88));
    cross.rotation.x = -Math.PI / 2; cross.position.set(0, 0.02, 2);
    this.group.add(cross);

    // ── 灯籠 ──
    this.lanterns = [];
    [[-6, -10], [6, -10], [-6, 8], [6, 8], [-14, 0], [14, 0]].forEach(([x, z]) => {
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
    box(0.5, 5, 0.5, -3.2, 2.5, 15, torii, true);
    box(0.5, 5, 0.5, 3.2, 2.5, 15, torii, true);
    box(8.4, 0.5, 0.7, 0, 5.1, 15, torii, false);
    box(7.2, 0.35, 0.5, 0, 4.4, 15, torii, false);

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
