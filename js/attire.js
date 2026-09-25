/* ══════════════════════════════════════════════════════════════
   attire.js ── 外部モデル（VRM）に装備を着せる
     防具・護符の等級に応じて、肩当て・籠手・胸の紋・外套・光輪、
     日和には簪・勾玉・前天冠・羽衣・冠を、人形の骨に直接付ける。
     骨に付けるので、動いても体から浮かない。
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const gold = () => new THREE.MeshStandardMaterial({ color: 0xd8b040, metalness: 0.95, roughness: 0.25 });
const steel = (c) => new THREE.MeshStandardMaterial({ color: c || 0x9aa2ae, metalness: 0.9, roughness: 0.3 });
const glow = (c, i) => new THREE.MeshStandardMaterial({ color: c, emissive: new THREE.Color(c), emissiveIntensity: i || 2, roughness: 0.4 });
const cloth = (c, o) => new THREE.MeshPhysicalMaterial(Object.assign({ color: c, roughness: 0.6, sheen: 0.7, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide }, o || {}));

/** 体の寸法を骨から測る */
function measure(rig) {
  const y = n => rig.boneY(n);
  const head = y('head') || rig.height * 0.87, neck = y('neck') || head - 0.08;
  const chest = y('upperChest') || y('chest') || head - 0.25;
  const hips = y('hips') || rig.height * 0.52;
  return { head, neck, chest, hips, top: rig.height, headH: Math.max(0.16, rig.height - head) };
}

/** 陽光狩人 */
export function dressHero(rig, g) {
  rig.clearGear();
  rig.gearAnims = [];
  if (!rig.H) return;
  const wr = g.weapon || 0, ar = g.armor || 0, cr = g.charm || 0;
  const M = measure(rig);
  const chestBone = rig.H.getNormalizedBoneNode('upperChest') ? 'upperChest' : 'chest';
  // ── 防具 ──
  if (ar >= 1) {        // 革の籠手（前腕）
    ['left', 'right'].forEach(side => {
      const s = side === 'left' ? 1 : -1;
      const len = (rig.len && rig.len[side + 'LowerArm']) || 0.24;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, len * 0.55, 14, 1, true), cloth(0x4a2a18, { roughness: 0.5, side: THREE.DoubleSide }));
      m.rotation.z = Math.PI / 2;
      rig.attach(side + 'LowerArm', m, [s * len * 0.62, 0, 0]);
      if (ar >= 3) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.006, 6, 20), gold());
        band.rotation.y = Math.PI / 2;
        rig.attach(side + 'LowerArm', band, [s * len * 0.35, 0, 0]);
      }
    });
  }
  if (ar >= 2) {        // 肩当て（二枚重ね）
    ['left', 'right'].forEach(side => {
      const s = side === 'left' ? 1 : -1;
      const grp = new THREE.Group();
      const c = ar >= 5 ? 0xe8c060 : ar >= 4 ? 0xb8b8c8 : 0x8a8e98;
      for (let i = 0; i < 2; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.075 - i * 0.012, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), steel(c));
        p.scale.set(1.05, 0.55, 1.1); p.position.set(s * i * 0.03, 0.02 - i * 0.03, 0);
        p.rotation.z = -s * (0.35 + i * 0.2);
        grp.add(p);
      }
      if (ar >= 3) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.006, 6, 24), gold());
        rim.rotation.x = Math.PI / 2; rim.scale.set(1.05, 1.1, 1); rim.position.y = 0.02; rim.rotation.y = -s * 0.35;
        grp.add(rim);
      }
      rig.attach(side + 'UpperArm', grp, [s * 0.03, 0.035, 0]);
    });
  }
  if (ar >= 3) {        // 喉当て
    const gorget = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.014, 8, 28, Math.PI * 1.2), gold());
    gorget.rotation.set(Math.PI / 2, 0, Math.PI * 1.4);
    rig.attach('neck', gorget, [0, 0.0, 0.01]);
  }
  if (ar >= 4) {        // 胸に燃える陽紋
    const em = new THREE.Group();
    em.add(new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 8, 24), gold()));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), glow(0xffd070, 3));
    em.add(core);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const r = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.022, 4), gold());
      r.position.set(Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0); r.rotation.z = a - Math.PI / 2;
      em.add(r);
    }
    rig.attach(chestBone, em, [0, 0.02, 0.115]);
    rig.gearAnims.push(t => { em.rotation.z = t * 0.6; core.material.emissiveIntensity = 2.5 + Math.sin(t * 3) * 0.8; });
  }
  if (ar >= 5) {        // 黄金の外套（背）と光輪
    const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, 0.95, 20, 6, true, Math.PI * 0.62, Math.PI * 0.76),
      cloth(0xc9a227, { metalness: 0.5, roughness: 0.35, emissive: new THREE.Color(0x5a3a08), emissiveIntensity: 0.6 }));
    const holder = new THREE.Group(); holder.add(cape); cape.position.y = -0.48;   // 円筒の背側だけを使う
    rig.attach(chestBone, holder, [0, 0.05, -0.06]);
    rig.gearAnims.push((t, mv) => { holder.rotation.x = 0.12 + (mv ? 0.35 : 0) + Math.sin(t * 2.2) * 0.04; });
    const halo = new THREE.Group();
    halo.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.01, 8, 40), glow(0xffd24a, 2.6)));
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.06, 5), glow(0xffe27a, 2.2));
      sp.position.set(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0); sp.rotation.z = a - Math.PI / 2;
      halo.add(sp);
    }
    rig.attach('head', halo, [0, M.headH * 0.45, -0.16]);
    rig.gearAnims.push(t => { halo.rotation.z = t * 0.4; });
  }
  // ── 護符 ──
  if (cr >= 2) {        // 胸元の護符
    const pend = new THREE.Group();
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.003, 4, 24, Math.PI), gold());
    chain.rotation.z = Math.PI; pend.add(chain);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.018, 0), glow([0, 0, 0x6affa0, 0x8ad0ff, 0xff8ad0, 0xffd24a][cr], 2.4));
    gem.position.y = -0.075; gem.scale.set(0.8, 1.3, 0.5); pend.add(gem);
    rig.attach(chestBone, pend, [0, 0.12, 0.1]);
  }
  if (cr >= 5) {        // 胸のまわりを巡る陽の粒
    const ring = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), glow(0xffe08a, 3));
      m.position.set(Math.cos(a) * 0.36, Math.sin(i * 1.7) * 0.05, Math.sin(a) * 0.36);
      ring.add(m);
    }
    rig.attach('spine', ring, [0, 0.05, 0]);
    rig.gearAnims.push(t => { ring.rotation.y = t * 1.2; });
  }
}

/** 日和 */
export function dressHeroine(rig, g) {
  rig.clearGear();
  rig.gearAnims = [];
  if (!rig.H) return;
  const wr = g.weapon || 0, ar = g.armor || 0, cr = g.charm || 0;
  const M = measure(rig);
  const chestBone = rig.H.getNormalizedBoneNode('upperChest') ? 'upperChest' : 'chest';
  const hh = M.headH;
  // ── 装束 ──
  if (ar >= 1) {        // 胸元の紅の結び
    const bow = new THREE.Group();
    const red = cloth(0xc02030);
    [-1, 1].forEach(s => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), red); l.scale.set(1.5, 0.8, 0.4); l.position.x = s * 0.025; bow.add(l); });
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), red); bow.add(knot);
    [-1, 1].forEach(s => { const t = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.003), red); t.position.set(s * 0.01, -0.035, 0); t.rotation.z = s * 0.2; bow.add(t); });
    rig.attach(chestBone, bow, [0, 0.07, 0.1]);
  }
  if (ar >= 3) {        // 肩から垂れる羽衣（宙に揺れる）
    const colr = ar >= 5 ? 0xffe8a0 : ar >= 4 ? 0xe8f0ff : 0xf6eef8;
    const mat = cloth(colr, { transparent: true, opacity: 0.72, emissive: new THREE.Color(ar >= 5 ? 0xffc040 : 0x8090c0), emissiveIntensity: ar >= 5 ? 1.0 : 0.35 });
    ['left', 'right'].forEach(side => {
      const s = side === 'left' ? 1 : -1;
      const rib = new THREE.Group();
      const segs = [];
      for (let i = 0; i < 9; i++) {
        const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.11), mat);
        sg.position.set(s * (0.02 + i * 0.012), -i * 0.1, -0.02 - i * 0.02);
        rib.add(sg); segs.push(sg);
      }
      rig.attach(side + 'UpperArm', rib, [s * 0.04, 0.02, -0.05]);
      rig.gearAnims.push((t, mv) => segs.forEach((sg, i) => {
        sg.position.z = -0.02 - i * (0.02 + (mv ? 0.02 : 0)) + Math.sin(t * 2.2 + i * 0.6) * 0.012 * i;
        sg.rotation.y = Math.sin(t * 1.8 + i) * 0.35;
      }));
    });
  }
  if (ar >= 5) {        // 黄金の冠と背の光輪
    const crown = new THREE.Group();
    crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.02, 24, 1, true), gold()));
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.012, i % 2 ? 0.05 : 0.08, 5), gold());
      sp.position.set(Math.cos(a) * 0.087, 0.03, Math.sin(a) * 0.087); crown.add(sp);
    }
    const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), glow(0xff5a6a, 2.6));
    jewel.position.set(0, 0.01, 0.09); crown.add(jewel);
    rig.attach('head', crown, [0, hh * 0.78, -0.005]);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.008, 8, 40), glow(0xffd24a, 2.6));
    rig.attach('head', halo, [0, hh * 0.35, -0.2]);
    rig.gearAnims.push(t => { halo.rotation.z = t * 0.5; });
  }
  // ── 髪飾り・護符 ──
  if (cr >= 1) {        // 桜の簪（右のこめかみ）
    const k = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), cloth(0xffb4c8, { side: THREE.FrontSide }));
      p.scale.set(1, 0.6, 1.2); p.position.set(Math.cos(a) * 0.016, Math.sin(a) * 0.016, 0); k.add(p);
    }
    k.add(new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), glow(0xffe08a, 1.5)));
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.08, 4), gold()); pin.rotation.z = 1.2; pin.position.x = 0.03; k.add(pin);
    rig.attach('head', k, [-0.075, hh * 0.55, 0.02]);
  }
  if (cr >= 2) {        // 勾玉の首飾り
    const nk = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 0.15 + i / 8 * Math.PI * 0.7;
      const b = new THREE.Mesh(new THREE.SphereGeometry(i === 4 ? 0.011 : 0.006, 8, 6), glow(i === 4 ? 0x6affa0 : 0xe8e0f0, i === 4 ? 1.6 : 0.3));
      if (i === 4) b.scale.set(0.8, 1.4, 0.7);
      b.position.set(Math.cos(a) * 0.065, -Math.sin(a) * 0.04, Math.sin(a) * 0.065);
      nk.add(b);
    }
    rig.attach('neck', nk, [0, -0.01, 0.005]);
  }
  if (cr >= 3 && ar < 5) {   // 前天冠
    const mk = new THREE.Group();
    mk.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.006), gold()));
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.035, 4), gold()); top.position.y = 0.02; mk.add(top);
    [-1, 1].forEach(s => { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.05, 4), gold()); d.position.set(s * 0.045, -0.025, 0); mk.add(d); });
    rig.attach('head', mk, [0, hh * 0.62, 0.095]);
  }
  if (cr >= 5) {        // 宙に浮かぶ勾玉の輪
    const ring = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), glow(i % 2 ? 0x6affa0 : 0xffd24a, 2.4));
      m.scale.set(1, 1, 1.5); m.position.set(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45);
      ring.add(m);
    }
    rig.attach('hips', ring, [0, 0.05, 0]);
    rig.gearAnims.push(t => { ring.rotation.y = t * 1.2; ring.position.y = Math.sin(t * 2) * 0.04; });
  }
}
