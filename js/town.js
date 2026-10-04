/* ══════════════════════════════════════════════════════════════
   town.js ── 地上の街「陽ノ辻（ひのつじ）」
     縦穴のまわりに開けた宿場町。住人と話し、道具を購う。
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { buildFolk, folkMaterial } from './bestiary.js';
import { planOf } from './townplan.js';
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
  // 姿は bestiary.js：着物・帯・袖・髪型・顔まで一つの形にまとめる（描く手間は一回）
  const body = new THREE.Mesh(buildFolk(def), folkMaterial());
  body.castShadow = true; body.receiveShadow = true;
  body.customDepthMaterial = folkMaterial().userData.depth;
  g.add(body);
  const hy = def.small ? 1.08 : 1.5;
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
export const HOUSE_KIND = ['home', 'shop', 'smith', 'home', 'inn', 'guild', 'home', 'lib', 'home', 'home', 'home'];
const SIGN = { shop: '道具', inn: '宿', smith: '鍛冶', lib: '書', guild: 'ギルド', myhome: '我が家' };

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
  /**
   * @param region atlas.js の街（色・家の形・住人）。無ければ陽ノ里
   * @param opts { locals: その街で出会える仲間の定義[], homeHere: この街に自宅があるか }
   */
  build(colliders, region, opts) {
    this.clear();
    opts = opts || {};
    const T = (region && region.theme) || {};
    const style = T.style || 'wa';
    this.region = region || null;
    const wall = patternMaterial('plaster', T.plaster || 0xe8e0cc, 2.5);
    const roof = patternMaterial('roof', T.roof || 0x4a4a58, 1.4, { rough: 0.8, metal: 0.2 });
    const wood = patternMaterial('plank', 0x4a3424, 1.2);
    const base = patternMaterial('block', style === 'moon' ? 0x9aa0b0 : 0x8a8478, 1.6);
    const beam = patternMaterial('plank', T.timber || 0x2e2018, 1.0);

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
    const plan = planOf(region && region.id);
    const houses = plan.houses;
    this.plan = plan;
    this.rooms = [];
    this.doors = [];
    houses.forEach((h, i) => {
      const [x, z, w, d] = h;
      const ht = (3.4 + (i % 3) * 0.6) * (plan.sk || 1);
      let kind = HOUSE_KIND[i] || 'home';
      if (i === 3 && opts.homeHere) kind = 'myhome';     // 買った我が家
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
      if (style === 'wa') this.group.add(noren);
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
      if (style === 'desert') {
        // 平屋根と胸壁（砂の街）
        box(w + 0.6, 0.3, d + 0.6, x, ht + 0.15, z, beam, false);
        for (let q = -2; q <= 2; q++) box(0.5, 0.5, 0.3, x + q * (w / 4), ht + 0.55, z + d / 2 + 0.2, wall, false);
        const dm = new THREE.Mesh(new THREE.SphereGeometry(Math.min(w, d) * 0.28, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), roof);
        dm.position.set(x, ht + 0.3, z); this.group.add(dm);
      } else if (style === 'moon' || style === 'sky') {
        // 円蓋の屋根と細い尖塔（月面・天空）
        const dm = new THREE.Mesh(new THREE.SphereGeometry(Math.max(w, d) * 0.55, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), roof);
        dm.scale.set(1, 0.55, d / w); dm.position.set(x, ht, z); dm.castShadow = true; this.group.add(dm);
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.6, 8), glowMaterial(style === 'sky' ? 0xffe08a : 0x8ad0ff, 2));
        sp.position.set(x, ht + Math.max(w, d) * 0.3 + 0.8, z); this.group.add(sp);
      } else {
      // 切妻屋根（瓦葺き・深い軒）。棟は東西に通す
      const rw = w / 2 + 0.9, rh = (style === 'west' || style === 'snow' || style === 'demon') ? 3.2 : style === 'elf' ? 2.6 : 2.0, rd = d + 1.4;
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
      }
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
    const strip = (x, z, w, d, ry, col) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), stoneMaterial(204, col || 0xb0a690));
      m.rotation.x = -Math.PI / 2; m.rotation.z = ry || 0; m.position.set(x, 0.025, z);
      m.receiveShadow = true; this.group.add(m); return m;
    };
    if (plan.roads === 'grid') {
      // 区画を分ける小径
      [[-19, 0, 4, 44], [19, 0, 4, 44], [0, -20, 60, 4]].forEach(([x, z, w, d]) => strip(x, z, w, d));
    }
    if (plan.plaza) {
      const pz = new THREE.Mesh(new THREE.CircleGeometry(plan.plaza, 48), stoneMaterial(204, 0xc2b89e));
      pz.rotation.x = -Math.PI / 2; pz.position.set(0, 0.03, -2); pz.receiveShadow = true; this.group.add(pz);
    }
    if (plan.roads === 'ring') {
      const rr = new THREE.Mesh(new THREE.RingGeometry(plan.ringR - 9, plan.ringR - 5, 64), stoneMaterial(204, 0xb0a690));
      rr.rotation.x = -Math.PI / 2; rr.position.set(0, 0.026, -2); rr.receiveShadow = true; this.group.add(rr);
    }
    if (plan.roads === 'avenue') strip(0, -14, 5, 50);
    // 戸口から広場へ向かう小径
    houses.forEach(([x, z, w, d]) => {
      const dz = z + d / 2 + 1.2, dx = -x, dzz = -2 - dz, len = Math.hypot(dx, dzz);
      if (plan.roads === 'wind') strip(x + dx * 0.5, dz + dzz * 0.5, 2.4, len, Math.atan2(dx, dzz) * -1 + 0, 0xa89e86);
      else strip(x, z + d / 2 + 3.0, 3.2, 4.4);
    });

    // ── 灯籠 ──
    this.lanterns = [];
    const lampSpots = [[-18, -14], [18, -14], [-18, 14], [18, 14], [-21, 0], [21, 0], [0, 24], [0, -24]];
    if (plan.roads !== 'grid' || region && region.id !== 'hinomori') {
      for (let a = 0; a < 8; a++) lampSpots.push([Math.round(Math.cos(a * 0.785 + 0.39) * 17), Math.round(Math.sin(a * 0.785 + 0.39) * 17 - 2)]);
    }
    const lampOK = ([x, z]) => !houses.some(([hx, hz, w, d]) => Math.abs(x - hx) < w / 2 + 1.2 && Math.abs(z - hz) < d / 2 + 1.2) && !(Math.abs(x) < 9 && z > 6) && !(Math.abs(x) < 2.5 && Math.abs(z + 6) < 2.5);
    let lampN = 0;
    lampSpots.filter(p => (region && region.id === 'hinomori') || !region || lampOK(p)).forEach(([x, z]) => {
      if (region && region.id !== 'hinomori' && ++lampN > 12) return;
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

    // ── 広場の飾り（街ごと） ──
    (plan.lm || []).forEach(k => { try { this._landmark(k, { box, wall, wood, base, beam, roof, T, colliders }); } catch (e) { console.error(e); } });

    // ── 鳥居（縦穴の手前） ──
    const torii = metalMaterial(206, 0xb3424a);
    box(0.5, 6, 0.5, -4.6, 3, 30, torii, true);
    box(0.5, 6, 0.5, 4.6, 3, 30, torii, true);
    box(11.6, 0.6, 0.8, 0, 6.2, 30, torii, false);
    box(10, 0.4, 0.6, 0, 5.3, 30, torii, false);

    // ── 住人 ──
    // 店の者と語り部は家の中にいる
    if (!region || region.id === 'hinomori') TOWNSFOLK.filter(d => !d.indoor).forEach(def => this._addNpc(def, colliders));
    // その街で出会える仲間（まだ加わっていない者）が広場に立つ。話すとギルドで誘える
    (opts.locals || []).forEach((c, i) => {
      const a = (i / Math.max(1, opts.locals.length)) * Math.PI * 2 + 0.4;
      const t = c.tint || {};
      const def = { id: 'c_' + c.id, charId: c.id, name: c.name, role: c.title, kind: 'recruit',
        x: Math.cos(a) * 11, z: Math.sin(a) * 11 - 2, face: -a - Math.PI / 2,
        hair: t.hair || 0x2a1a14, cloth: t.top || 0x6a5a8a, skin: 0xf6dcc8, long: c.g === 'f', small: false,
        lines: [c.intro, '冒険者ギルドで声をかけてくれたら、一緒に行ってもいいよ'] };
      this._addNpc(def, colliders);
    });
    // 住人（どの街にも少し）
    if (region && region.id !== 'hinomori') {
      [['旅の商人', 0x5a6a4a, 0x2a2a2a], ['街の娘', 0xd88aa0, 0x3a2018], ['衛兵', 0x4a5a7a, 0x1a1a1a]].forEach(([nm, cloth, hair], i) => {
        this._addNpc({ id: 'cit' + i, name: nm, role: region.name + 'の住人', kind: 'talk', x: -8 + i * 8, z: 12, face: Math.PI,
          hair, cloth, skin: 0xf0d0b0, long: i === 1,
          lines: [region.desc, 'ようこそ、' + region.name + 'へ', '冒険者ギルドは東の大きな建物だよ'] }, colliders);
      });
    }
    this.built = true;
    return this;
  }


  /** 街ごとの目印。形はどれも安い箱と円柱と円錐だけで作る */
  _landmark(kind, h) {
    const { box, wood, base, beam, colliders } = h, G = this.group;
    const add = (geo, mat, x, y, z, ry) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.receiveShadow = true; G.add(m); return m; };
    const solid = (x, z, w, d) => { if (colliders) colliders.push({ min: { x: x - w / 2, z: z - d / 2 }, max: { x: x + w / 2, z: z + d / 2 } }); };
    const light = (x, y, z, col, I, R) => { const l = new THREE.PointLight(col, I, R, 2); l.visible = false; l.position.set(x, y, z); G.add(l); (this.townLights = this.townLights || []).push(l); return l; };
    const stone = new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.7 });
    const water = new THREE.MeshStandardMaterial({ color: 0x4a9ad8, roughness: 0.15, metalness: 0.1, emissive: new THREE.Color(0x103050), emissiveIntensity: 0.5 });
    if (kind === 'fountain') {
      add(new THREE.CylinderGeometry(3.2, 3.4, 0.7, 32), stone, 0, 0.35, 5);
      add(new THREE.CylinderGeometry(2.7, 2.7, 0.1, 32), water, 0, 0.66, 5);
      add(new THREE.CylinderGeometry(0.35, 0.5, 2.6, 12), stone, 0, 1.6, 5);
      add(new THREE.SphereGeometry(0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), stone, 0, 2.8, 5).scale.y = 0.5;
      add(new THREE.SphereGeometry(0.25, 12, 8), glowMaterial(0x9ad8ff, 2), 0, 3.2, 5);
      solid(0, 5, 6.4, 6.4);
    } else if (kind === 'bigtree') {
      const bark = patternMaterial('bark', 0x4a3a2c, 1.0), leaf = fleshMaterial(0x4a8a44);
      add(new THREE.CylinderGeometry(1.0, 1.7, 9, 12), bark, -10, 4.5, -15);
      [[0, 11, 0, 6], [3.5, 9.5, 1, 4.4], [-3.5, 9.8, -1, 4.6], [0, 13.5, 0, 3.6]].forEach(([dx, y, dz, r]) => { const c = add(new THREE.SphereGeometry(r, 16, 12), leaf, -10 + dx, y, -15 + dz); c.castShadow = true; });
      solid(-10, -15, 3.4, 3.4);
      light(-10, 6, -12, 0xa8ffb0, 1.4, 14);
    } else if (kind === 'pier') {
      const sea = new THREE.MeshStandardMaterial({ color: 0x2a78b8, roughness: 0.12, metalness: 0.2 });
      add(new THREE.PlaneGeometry(90, 26), sea, 0, 0.04, -50).rotation.x = -Math.PI / 2;
      for (let i = 0; i < 9; i++) box(5, 0.25, 1.6, 0, 0.35, -33 - i * 1.6, wood, false);
      box(0.4, 2.2, 0.4, 2.8, 1.2, -45, wood, false); box(0.4, 2.2, 0.4, -2.8, 1.2, -45, wood, false);
      add(new THREE.CylinderGeometry(0.16, 0.2, 13, 8), wood, 10, 6.5, -41);
      const sail = add(new THREE.PlaneGeometry(5, 8), new THREE.MeshStandardMaterial({ color: 0xf4f0e4, side: THREE.DoubleSide, roughness: 0.9 }), 10, 7, -39.4); sail.rotation.y = Math.PI / 2;
      add(new THREE.BoxGeometry(2.4, 0.8, 8), wood, 10, 0.5, -41);
      solid(10, -41, 2.6, 8.4);
    } else if (kind === 'toriiN') {
      const red = metalMaterial(206, 0xb3424a);
      [-13, -25].forEach(z => { box(0.5, 5.4, 0.5, -3.4, 2.7, z, red, true); box(0.5, 5.4, 0.5, 3.4, 2.7, z, red, true); box(9.2, 0.55, 0.8, 0, 5.6, z, red, false); box(8, 0.35, 0.55, 0, 4.7, z, red, false); });
    } else if (kind === 'sakura') {
      const bark = patternMaterial('bark', 0x4a3a2c, 1.0), bl = fleshMaterial(0xf4b8c8);
      add(new THREE.CylinderGeometry(0.5, 0.8, 4.2, 10), bark, -12, 2.1, -10);
      [[0, 5.4, 0, 3.4], [2.4, 4.8, 1, 2.4], [-2.4, 4.9, -1, 2.5]].forEach(([dx, y, dz, r]) => add(new THREE.SphereGeometry(r, 14, 10), bl, -12 + dx, y, -10 + dz));
      solid(-12, -10, 1.6, 1.6);
    } else if (kind === 'bonfire') {
      for (let i = 0; i < 6; i++) { const a = i * 1.047, lg = add(new THREE.CylinderGeometry(0.16, 0.16, 2.2, 6), wood, Math.cos(a) * 0.5, 0.5, 4 + Math.sin(a) * 0.5); lg.rotation.z = Math.cos(a) * 0.9; lg.rotation.x = Math.sin(a) * 0.9; }
      add(new THREE.ConeGeometry(0.8, 2.2, 8), glowMaterial(0xff9a3a, 2.4), 0, 1.4, 4);
      add(new THREE.ConeGeometry(0.4, 1.6, 8), glowMaterial(0xffe08a, 3), 0, 1.5, 4);
      add(new THREE.TorusGeometry(1.5, 0.3, 6, 16), stone, 0, 0.2, 4).rotation.x = Math.PI / 2;
      light(0, 2, 4, 0xff9a4a, 3.2, 20); solid(0, 4, 3, 3);
    } else if (kind === 'bazaar') {
      const cols = [0xb3424a, 0xc9a227, 0x3a6aa8, 0x6a3a8a];
      [[-12, -16], [12, -16], [0, -22], [-20, -4], [20, -4]].forEach(([x, z], i) => {
        [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]].forEach(([dx, dz]) => box(0.18, 2.6, 0.18, x + dx, 1.3, z + dz, wood, false));
        const cl = add(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshStandardMaterial({ color: cols[i % 4], side: THREE.DoubleSide, roughness: 0.9 }), x, 2.75, z); cl.rotation.x = -Math.PI / 2 + 0.12;
        box(2.4, 0.9, 1.0, x, 0.45, z, wood, true);
      });
    } else if (kind === 'crystal') {
      const cr = add(new THREE.OctahedronGeometry(2.2, 0), glowMaterial(0x9ad8ff, 1.8), 0, 5.2, -16); cr.scale.y = 1.7;
      add(new THREE.CylinderGeometry(1.2, 1.6, 0.8, 8), stone, 0, 0.4, -16);
      [0, 1, 2, 3].forEach(i => add(new THREE.CylinderGeometry(0.25, 0.3, 3.4, 8), stone, Math.cos(i * 1.571 + 0.78) * 3.6, 1.7, -16 + Math.sin(i * 1.571 + 0.78) * 3.6));
      solid(0, -16, 3, 3); light(0, 5, -16, 0x9ad8ff, 2.4, 20);
    } else if (kind === 'spire') {
      const dk = new THREE.MeshStandardMaterial({ color: 0x1c1420, roughness: 0.6, metalness: 0.3 });
      add(new THREE.BoxGeometry(8, 12, 8), dk, 0, 6, -45); add(new THREE.ConeGeometry(4.2, 16, 4), dk, 0, 20, -45).rotation.y = Math.PI / 4;
      [-1, 1].forEach(sx => add(new THREE.ConeGeometry(1.4, 9, 4), dk, sx * 5.5, 13.5, -45));
      add(new THREE.SphereGeometry(0.6, 12, 8), glowMaterial(0xff3a4a, 3), 0, 29, -45);
      light(0, 12, -38, 0xff4a5a, 2.4, 24);
    } else if (kind === 'brazier') {
      [[-6, -8], [6, -8], [-6, 6], [6, 6]].forEach(([x, z]) => { box(0.5, 1.4, 0.5, x, 0.7, z, beam, false); add(new THREE.CylinderGeometry(0.6, 0.35, 0.5, 8), beam, x, 1.6, z); add(new THREE.ConeGeometry(0.4, 1.0, 6), glowMaterial(0xff4a3a, 2.4), x, 2.2, z); });
    } else if (kind === 'pad') {
      add(new THREE.RingGeometry(3.4, 4.2, 40), new THREE.MeshBasicMaterial({ color: 0x8ad0ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0.06, -15).rotation.x = -Math.PI / 2;
      add(new THREE.CircleGeometry(3.4, 40), new THREE.MeshStandardMaterial({ color: 0x3a4660, roughness: 0.4, metalness: 0.5 }), 0, 0.05, -15).rotation.x = -Math.PI / 2;
      light(0, 2, -15, 0x8ad0ff, 2.0, 18);
    } else if (kind === 'beacon') {
      add(new THREE.CylinderGeometry(0.3, 0.5, 14, 10), new THREE.MeshStandardMaterial({ color: 0x8a9ab8, metalness: 0.7, roughness: 0.3 }), 0, 7, -15);
      add(new THREE.SphereGeometry(0.9, 14, 10), glowMaterial(0x4ad0e8, 3), 0, 14.4, -15);
      solid(0, -15, 1.4, 1.4); light(0, 13, -15, 0x4ad0e8, 2.6, 24);
    } else if (kind === 'rails') {
      const rl = new THREE.MeshStandardMaterial({ color: 0x8a9ab8, metalness: 0.7, roughness: 0.3 });
      [-37, 37].forEach(x => { add(new THREE.BoxGeometry(0.3, 0.2, 60), rl, x, 1.1, -6); for (let z = -34; z <= 22; z += 7) add(new THREE.BoxGeometry(0.3, 1.1, 0.3), rl, x, 0.55, z); });
    }
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
