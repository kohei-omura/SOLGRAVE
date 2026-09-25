/* ══════════════════════════════════════════════════════════════
   figure.js ── 人の姿を組む（主人公と日和）
     外部の模型・画像を使わず、回転体（旋盤）・帯（髪の房）・
     キャンバスに描いた顔で、頭身の高い人の姿を作る。
     腕は二関節の逆運動学で、握る物へ手を伸ばす。
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const Y_UP = new THREE.Vector3(0, 1, 0);

/* ── 材質 ── */
function skinMat(tone) {
  return new THREE.MeshPhysicalMaterial({
    color: tone || 0xf0cdb8, roughness: 0.62, metalness: 0,
    sheen: 0.25, sheenColor: new THREE.Color(0xffa898), sheenRoughness: 0.6,
    emissive: new THREE.Color(0x3a1008), emissiveIntensity: 0.18,
    envMapIntensity: 0.5        // 皮膚の下の血色（簡易の散乱）
  });
}
function clothMat(color, opts) {
  opts = opts || {};
  return new THREE.MeshPhysicalMaterial({
    color, roughness: opts.r == null ? 0.78 : opts.r, metalness: opts.me || 0,
    sheen: opts.sheen == null ? 0.6 : opts.sheen, sheenColor: new THREE.Color(opts.sheenColor || 0xffffff),
    sheenRoughness: 0.7, side: opts.ds ? THREE.DoubleSide : THREE.FrontSide,
    clearcoat: opts.cc || 0, clearcoatRoughness: 0.4
  });
}
function hairMat(color, sheenColor) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.34, metalness: 0.05,
    sheen: 0.7, sheenColor: new THREE.Color(sheenColor || 0x5a5a88), sheenRoughness: 0.4,
    clearcoat: 0.2, clearcoatRoughness: 0.35, side: THREE.DoubleSide
  });
}

/* ── 形の道具 ── */
/** 回転体。profile は [[半径, 高さ], ...]。ripple で襞（ひだ）をつける */
function lathe(profile, mat, seg, phiStart, phiLen, ripple) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, seg || 32, phiStart || 0, phiLen || Math.PI * 2);
  if (ripple) {
    const p = g.attributes.position;
    const y0 = profile[0][1], y1 = profile[profile.length - 1][1];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
      const a = Math.atan2(x, z);
      const k = Math.abs((y - y0) / ((y1 - y0) || 1));
      const f = 1 + ripple.amp * k * Math.sin(a * ripple.n);
      p.setX(i, x * f); p.setZ(i, z * f);
    }
    g.computeVertexNormals();
  }
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** 曲線に沿った帯（髪の房・襟巻き）。out は面の外向きの基準点 */
function ribbon(points, w0, w1, center, mat, seg) {
  const curve = new THREE.CatmullRomCurve3(points);
  const N = seg || 14;
  const pos = [], nor = [], uv = [], idx = [];
  const P = new THREE.Vector3(), T = new THREE.Vector3(), O = new THREE.Vector3(), S = new THREE.Vector3(), Nn = new THREE.Vector3();
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    curve.getPointAt(t, P);
    curve.getTangentAt(t, T);
    O.copy(P).sub(center).normalize();
    S.crossVectors(T, O).normalize();
    Nn.crossVectors(S, T).normalize();
    // 先に行くほど細く、先端は尖らせる
    const w = (w0 + (w1 - w0) * t) * (t > 0.85 ? (1 - t) / 0.15 * 0.8 + 0.2 : 1);
    pos.push(P.x - S.x * w / 2, P.y - S.y * w / 2, P.z - S.z * w / 2, P.x + S.x * w / 2, P.y + S.y * w / 2, P.z + S.z * w / 2);
    nor.push(Nn.x, Nn.y, Nn.z, Nn.x, Nn.y, Nn.z);
    uv.push(0, t, 1, t);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

/** 始点から伸びる手足（長さ1の筒を伸ばして使う） */
function limbMesh(r0, r1, mat) {
  const g = new THREE.CylinderGeometry(r1, r0, 1, 14, 1);
  g.translate(0, 0.5, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}
function placeLimb(m, a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length() || 0.001;
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(Y_UP, d.divideScalar(len));
  m.scale.set(1, len, 1);
}
/** 二関節の逆運動学：肩S・手先T・上腕L1・前腕L2、肘の向き pole */
export function solveElbow(S, T, L1, L2, pole) {
  const v = new THREE.Vector3().subVectors(T, S);
  let d = v.length();
  const maxD = L1 + L2 - 1e-3;
  if (d > maxD) { v.multiplyScalar(maxD / d); d = maxD; }
  const dir = v.clone().normalize();
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const E = S.clone().addScaledVector(dir, a).addScaledVector(p, h);
  const Tt = S.clone().add(v);
  return { E, T: Tt };
}

/* ── 顔（キャンバスに描いて頭に貼る） ── */
function drawFace(style, closed) {
  const W = 768, H = 512;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, W, H);
  const X = u => u * W, Yv = v => v * H;
  const S = style;
  // 頬の赤み
  [-1, 1].forEach(sd => {
    const g = c.createRadialGradient(X(0.5 + sd * 0.2), Yv(0.62), 2, X(0.5 + sd * 0.2), Yv(0.62), X(0.07));
    g.addColorStop(0, 'rgba(255,130,140,' + S.blush + ')'); g.addColorStop(1, 'rgba(255,130,140,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(X(0.5 + sd * 0.2), Yv(0.62), X(0.075), Yv(0.06), 0, 0, 7); c.fill();
  });
  // 眉
  [-1, 1].forEach(sd => {
    c.strokeStyle = S.brow; c.lineWidth = S.browW; c.lineCap = 'round';
    c.beginPath();
    const ix = X(0.5 + sd * 0.05), ox = X(0.5 + sd * 0.2);
    c.moveTo(ix, Yv(S.browY + S.browTilt));
    c.quadraticCurveTo(X(0.5 + sd * 0.13), Yv(S.browY - 0.035), ox, Yv(S.browY + 0.01));
    c.stroke();
  });
  // 目
  [-1, 1].forEach(sd => {
    const cx = X(0.5 + sd * 0.125), cy = Yv(0.47);
    const w = X(S.eyeW), h = Yv(S.eyeH);
    const inner = { x: cx - sd * w / 2, y: cy + h * 0.12 };
    const outer = { x: cx + sd * w / 2, y: cy - h * S.lift };
    const upper = () => {
      c.moveTo(inner.x, inner.y);
      c.bezierCurveTo(inner.x + sd * w * 0.18, cy - h * 0.78, outer.x - sd * w * 0.3, cy - h * 0.85, outer.x, outer.y);
    };
    if (closed) {
      c.strokeStyle = S.lash; c.lineWidth = h * 0.13; c.lineCap = 'round';
      c.beginPath(); c.moveTo(inner.x, cy + h * 0.05);
      c.quadraticCurveTo(cx, cy + h * 0.38, outer.x, cy + h * 0.02); c.stroke();
      for (let i = 0; i < 4; i++) {
        const t = 0.55 + i * 0.13, px = inner.x + (outer.x - inner.x) * t;
        c.lineWidth = h * 0.05; c.beginPath(); c.moveTo(px, cy + h * 0.2); c.lineTo(px + sd * h * 0.12, cy + h * 0.42); c.stroke();
      }
      return;
    }
    c.save();
    c.beginPath(); upper();
    c.bezierCurveTo(outer.x - sd * w * 0.22, cy + h * 0.6, inner.x + sd * w * 0.25, cy + h * 0.62, inner.x, inner.y);
    c.closePath();
    c.fillStyle = '#fbf7f6'; c.fill();
    c.clip();
    // 虹彩
    const ix = cx + sd * w * 0.02, iy = cy + h * 0.06, ir = h * 0.62;
    const ig = c.createRadialGradient(ix, iy + ir * 0.35, ir * 0.1, ix, iy, ir);
    ig.addColorStop(0, S.iris[2]); ig.addColorStop(0.55, S.iris[1]); ig.addColorStop(1, S.iris[0]);
    c.fillStyle = ig; c.beginPath(); c.ellipse(ix, iy, ir * 0.86, ir, 0, 0, 7); c.fill();
    // 虹彩の筋
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1.2;
    for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28; c.beginPath(); c.moveTo(ix + Math.cos(a) * ir * 0.3, iy + Math.sin(a) * ir * 0.34); c.lineTo(ix + Math.cos(a) * ir * 0.8, iy + Math.sin(a) * ir * 0.9); c.stroke(); }
    // 瞳孔と縁
    c.fillStyle = S.pupil; c.beginPath(); c.ellipse(ix, iy, ir * 0.3, ir * 0.38, 0, 0, 7); c.fill();
    c.strokeStyle = S.iris[0]; c.lineWidth = h * 0.06; c.beginPath(); c.ellipse(ix, iy, ir * 0.86, ir, 0, 0, 7); c.stroke();
    // 瞼の落とす影
    const sg = c.createLinearGradient(0, cy - h * 0.8, 0, cy);
    sg.addColorStop(0, 'rgba(60,30,40,0.55)'); sg.addColorStop(1, 'rgba(60,30,40,0)');
    c.fillStyle = sg; c.fillRect(cx - w, cy - h, w * 2, h);
    // 光
    c.fillStyle = 'rgba(255,255,255,0.95)';
    c.beginPath(); c.ellipse(ix - sd * ir * 0.32, iy - ir * 0.38, ir * 0.22, ir * 0.26, 0, 0, 7); c.fill();
    c.beginPath(); c.arc(ix + sd * ir * 0.35, iy + ir * 0.42, ir * 0.1, 0, 7); c.fill();
    c.restore();
    // 上睫毛の線（太く、目尻を跳ね上げる）
    c.strokeStyle = S.lash; c.lineCap = 'round'; c.lineJoin = 'round';
    c.lineWidth = h * S.lashW; c.beginPath(); upper(); c.stroke();
    c.beginPath(); c.moveTo(outer.x, outer.y); c.lineTo(outer.x + sd * w * 0.12, outer.y - h * 0.22); c.lineWidth = h * S.lashW * 0.6; c.stroke();
    for (let i = 0; i < S.lashes; i++) {
      const t = 0.5 + i * (0.5 / S.lashes);
      const px = inner.x + (outer.x - inner.x) * t, py = cy - h * (0.62 - 0.45 * Math.pow(t, 3));
      c.lineWidth = h * 0.05; c.beginPath(); c.moveTo(px, py); c.lineTo(px + sd * h * 0.22, py - h * 0.28); c.stroke();
    }
    // 下睫毛
    c.globalAlpha = 0.55; c.lineWidth = h * 0.05;
    c.beginPath(); c.moveTo(outer.x - sd * w * 0.05, outer.y + h * 0.1);
    c.quadraticCurveTo(cx + sd * w * 0.1, cy + h * 0.62, cx - sd * w * 0.15, cy + h * 0.6); c.stroke();
    // 二重の線
    c.globalAlpha = 0.35; c.lineWidth = h * 0.04;
    c.beginPath(); c.moveTo(inner.x + sd * w * 0.2, cy - h * 0.72);
    c.quadraticCurveTo(cx + sd * w * 0.1, cy - h * 1.05, outer.x - sd * w * 0.05, cy - h * 0.62); c.stroke();
    c.globalAlpha = 1;
  });
  // 鼻（影と光だけ）
  c.strokeStyle = 'rgba(170,100,90,0.45)'; c.lineWidth = 2.2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(X(0.505), Yv(0.585)); c.quadraticCurveTo(X(0.512), Yv(0.625), X(0.497), Yv(0.638)); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(X(0.498), Yv(0.6), 2, 6, 0, 0, 7); c.fill();
  // 口
  const my = Yv(S.mouthY);
  c.fillStyle = S.lip; c.globalAlpha = 0.55;
  c.beginPath(); c.ellipse(X(0.5), my + 6, X(S.mouthW * 0.8), 5, 0, 0, 7); c.fill();
  c.globalAlpha = 1;
  c.strokeStyle = S.mouth; c.lineWidth = 2.6;
  c.beginPath(); c.moveTo(X(0.5 - S.mouthW), my);
  c.quadraticCurveTo(X(0.5), my + S.smile, X(0.5 + S.mouthW), my - 1); c.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const FACE = {
  heroine: {   // 凛として涼やかな美人。切れ長の目、紫がかった瞳
    eyeW: 0.15, eyeH: 0.132, lift: 0.26, lashW: 0.2, lashes: 5,
    iris: ['#2a1438', '#6a3e8e', '#c8a8f0'], pupil: '#140818', lash: '#1a0e16',
    brow: 'rgba(40,24,30,0.85)', browW: 3.2, browY: 0.32, browTilt: 0.012,
    lip: '#e88a96', mouth: '#b4505e', mouthY: 0.765, mouthW: 0.028, smile: 3, blush: 0.32
  },
  hero: {      // 鋭い眼光の青年。琥珀の瞳、きりりと上がった眉
    eyeW: 0.145, eyeH: 0.1, lift: 0.18, lashW: 0.2, lashes: 2,
    iris: ['#4a2408', '#b8741a', '#ffd070'], pupil: '#1a0a04', lash: '#16100e',
    brow: 'rgba(30,24,28,0.95)', browW: 5.5, browY: 0.33, browTilt: 0.03,
    lip: '#c8807a', mouth: '#8a4a44', mouthY: 0.77, mouthW: 0.034, smile: 1.5, blush: 0.12
  }
};

/** 頭を作る。顔を貼った球と、あご・耳 */
/** 球の下半分を細らせ、小さな尖った顎にする（顔の絵も同じ形に曲げる） */
function sculpt(geo, r) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = Math.max(0, -y / r);                   // 0（目の高さ）→1（顎）
    const taper = 1 - 0.42 * Math.pow(k, 1.3);
    x *= taper;
    if (z > 0) z *= 1 - 0.12 * k + 0.1 * Math.pow(k, 3);   // 顎先はわずかに前へ
    y -= r * 0.12 * Math.pow(k, 2);                  // 顎を少し長く
    if (y > 0 && z > 0) z *= 1 - 0.05 * (y / r);     // 額はなだらかに
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}
function makeHead(r, skin, faceStyle) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(sculpt(new THREE.SphereGeometry(r, 40, 32), r), skin);
  head.scale.set(0.86, 1.08, 0.95);
  head.castShadow = true;
  g.add(head);
  [-1, 1].forEach(sd => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 10, 8), skin);
    ear.scale.set(0.45, 1, 0.8); ear.position.set(sd * r * 0.9, -r * 0.05, 0);
    g.add(ear);
  });
  const open = drawFace(FACE[faceStyle], false), shut = drawFace(FACE[faceStyle], true);
  const faceMat = new THREE.MeshStandardMaterial({ map: open, transparent: true, roughness: 0.6,
    polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
  const face = new THREE.Mesh(sculpt(new THREE.SphereGeometry(r * 1.004, 48, 32, Math.PI * 0.05, Math.PI * 0.9, Math.PI * 0.25, Math.PI * 0.55), r * 1.004), faceMat);
  face.scale.copy(head.scale);
  face.renderOrder = 2;
  g.add(face);
  return { g, head, faceMat, open, shut, r, rx: r * 0.86, ry: r * 1.08, rz: r * 0.95 };
}
/** 頭の面上の点（θ:上から, φ:正面から横へ） */
function onHead(H, theta, phi, k) {
  k = k || 1;
  return new THREE.Vector3(Math.sin(theta) * Math.sin(phi) * H.rx * k, Math.cos(theta) * H.ry * k, Math.sin(theta) * Math.cos(phi) * H.rz * k);
}

/* 瞬き */
function blinker(H) {
  let next = 2 + Math.random() * 3, shut = 0;
  return (t, dt) => {
    next -= dt;
    if (next <= 0 && shut <= 0) { shut = 0.12; H.faceMat.map = H.shut; next = 2.5 + Math.random() * 3.5; }
    if (shut > 0) { shut -= dt; if (shut <= 0) H.faceMat.map = H.open; }
  };
}

/* ═══════════════ 日和（ひより） ═══════════════
   腰まで届く真っ直ぐな黒髪、切り揃えた前髪、紫がかった瞳。
   白衣と緋袴。凛として、とびきり可愛らしく。 */
export function buildHeroine() {
  const root = new THREE.Group();
  const skin = skinMat(0xf6cdb8);
  const white = clothMat(0xfbf8f2, { sheen: 0.8, sheenColor: 0xfff4e8 });
  const red = clothMat(0xb3202c, { sheen: 0.7, sheenColor: 0xff6a70, r: 0.7 });
  const hairM = hairMat(0x0e0c14, 0x5a5a90);
  const anims = [];

  // 袴（襞つき）
  const hakama = lathe([[0.135, 1.03], [0.16, 0.98], [0.2, 0.82], [0.26, 0.55], [0.31, 0.28], [0.34, 0.06], [0.33, 0.04]], red, 48, 0, Math.PI * 2, { n: 14, amp: 0.035 });
  root.add(hakama);
  // 前の紐と結び
  const himo = new THREE.Mesh(new THREE.TorusGeometry(0.142, 0.012, 6, 32), red);
  himo.rotation.x = Math.PI / 2; himo.position.y = 1.0; root.add(himo);
  [-1, 1].forEach(sd => {
    const bow = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), red);
    bow.scale.set(1.4, 0.7, 0.5); bow.position.set(sd * 0.035, 0.98, 0.14); root.add(bow);
  });
  // 白衣（小袖）
  const top = lathe([[0.045, 1.43], [0.07, 1.39], [0.135, 1.345], [0.155, 1.29], [0.148, 1.2], [0.128, 1.1], [0.13, 1.0]], white, 40);
  root.add(top);
  // 襟：赤い襦袢がのぞき、白い衿が交差する
  const juban = lathe([[0.047, 1.43], [0.06, 1.395], [0.075, 1.36]], red, 24);
  juban.position.z = 0.008; root.add(juban);
  [-1, 1].forEach(sd => {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.012), white);
    band.position.set(sd * 0.03, 1.32, 0.105); band.rotation.set(-0.35, 0, sd * 0.55);
    root.add(band);
  });
  // 首
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.12, 16), skin);
  neck.position.y = 1.43; root.add(neck);

  // 腕と振袖（肩の軸ごと回せる）
  const sleeves = [];
  [-1, 1].forEach(sd => {
    const sh = new THREE.Group();
    sh.position.set(sd * 0.145, 1.33, 0);
    root.add(sh);
    const S = new THREE.Vector3(0, 0, 0);
    const T = sd < 0 ? new THREE.Vector3(-0.19, -0.35, 0.12) : new THREE.Vector3(0.06, -0.36, 0.16);   // 右手（-X）が杖を握る
    const { E } = solveElbow(S, T, 0.23, 0.22, new THREE.Vector3(sd * 0.6, -0.2, -1));
    const up = limbMesh(0.05, 0.046, white); placeLimb(up, S, E); sh.add(up);
    const fo = limbMesh(0.043, 0.032, white); placeLimb(fo, E, T.clone().lerp(E, 0.28)); sh.add(fo);
    const wrist = limbMesh(0.026, 0.022, skin); placeLimb(wrist, T.clone().lerp(E, 0.3), T); sh.add(wrist);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 10), skin);
    hand.scale.set(0.8, 1.2, 0.6); hand.position.copy(T).add(new THREE.Vector3(0, -0.03, 0)); sh.add(hand);
    // 垂れる大きな袖
    const sl = lathe([[0.055, 0], [0.09, -0.05], [0.12, -0.22], [0.12, -0.34], [0.02, -0.36]], white, 20);
    sl.scale.set(0.45, 1, 1);
    sl.position.copy(E).add(new THREE.Vector3(sd * 0.01, 0.04, -0.03));
    sh.add(sl);
    // 袖口の赤い括り紐
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 6, 20), red);
    cuff.position.copy(T.clone().lerp(E, 0.3)); cuff.quaternion.copy(fo.quaternion); cuff.rotateX(Math.PI / 2); sh.add(cuff);
    sleeves.push(sh);
    anims.push((t) => { sl.rotation.x = Math.sin(t * 1.6 + sd) * 0.05; });
  });

  // 足（白足袋と草履）
  [-1, 1].forEach(sd => {
    const tabi = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.1, 4, 10), white);
    tabi.rotation.x = Math.PI / 2; tabi.position.set(sd * 0.08, 0.045, 0.1); root.add(tabi);
    const zori = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.22), clothMat(0x8a5a3a));
    zori.position.set(sd * 0.08, 0.01, 0.1); root.add(zori);
  });

  // 頭
  const H = makeHead(0.118, skin, 'heroine');
  const headG = H.g; headG.position.set(0, 1.56, 0.01);
  root.add(headG);
  const hair = new THREE.Group(); headG.add(hair);
  const C0 = new THREE.Vector3(0, 0, 0);
  // 地肌を覆う頭頂
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.118 * 1.07, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.6), hairM);
  cap.scale.set(0.86, 1.08, 0.95); cap.rotation.x = -0.55; hair.add(cap);   // 前は生え際まで、後ろは襟足まで
  // 前髪：まっすぐ切り揃え、真ん中でわずかに分ける
  for (let i = 0; i < 17; i++) {
    const k = i / 16 - 0.5;
    const phi = k * Math.PI * 0.78;
    const part = Math.abs(k) < 0.05 ? -0.01 : 0;
    const len = 0.455 + (i % 3) * 0.008 + part + Math.abs(k) * 0.06;
    const pts = [onHead(H, 0.1, phi * 0.3, 1.06), onHead(H, 0.3, phi * 0.8, 1.12), onHead(H, 0.46, phi, 1.13), onHead(H, len * Math.PI * 0.95, phi * 1.02, 1.09)];
    hair.add(ribbon(pts, 0.05, 0.035, C0, hairM, 10));
  }
  // 顔の横に落ちる髪（胸元まで）
  [-1, 1].forEach(sd => {
    for (let j = 0; j < 3; j++) {
      const phi = sd * (Math.PI * (0.42 + j * 0.07));
      const top = onHead(H, 0.25, phi, 1.08), mid = onHead(H, 0.55, phi, 1.14);
      const low = mid.clone().add(new THREE.Vector3(sd * (0.02 + j * 0.01), -0.18, 0.02 - j * 0.02));
      const end = low.clone().add(new THREE.Vector3(sd * 0.03, -0.24 + j * 0.03, 0.01 - j * 0.02));
      hair.add(ribbon([top, mid, low, end], 0.06, 0.04, C0, hairM, 14));
    }
  });
  // 後ろ髪：腰まで届く真っ直ぐな黒髪（揺れる）
  const back = new THREE.Group(); back.position.set(0, -0.02, -0.02); hair.add(back);
  for (let i = 0; i < 26; i++) {
    const k = i / 25;
    const phi = Math.PI * (0.55 + k * 0.9);            // 横から背中を回って反対の横へ
    const s1 = onHead(H, 0.2, phi, 1.07), s2 = onHead(H, 0.62, phi, 1.12), s3 = onHead(H, 0.9, phi, 1.12);
    const fall = s3.clone(); fall.y -= 0.35; fall.x *= 1.25; fall.z = Math.min(fall.z, -0.02) * 1.3 - 0.03;
    const end = fall.clone(); end.y = -0.86 + Math.sin(i * 1.7) * 0.03; end.x *= 1.05; end.z -= 0.04;
    back.add(ribbon([s1, s2, s3, fall, end], 0.075, 0.05, new THREE.Vector3(0, -0.3, 0.02), hairM, 20));
  }
  // 白い丈長（髪を束ねる和紙）
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.02), white);
  tie.position.set(0, -0.42, -0.13); tie.rotation.x = 0.1; back.add(tie);
  [-1, 1].forEach(sd => {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.006), white);
    tail.position.set(sd * 0.03, -0.5, -0.135); tail.rotation.z = sd * 0.25; back.add(tail);
  });
  anims.push((t, st) => {
    const mv = st && st.moving ? 1 : 0;
    back.rotation.x = 0.03 + Math.sin(t * 1.3) * 0.02 + mv * (0.08 + Math.sin(t * 8) * 0.02);
    back.rotation.z = Math.sin(t * 0.9) * 0.02;
  });
  const blink = blinker(H);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  let lastT = 0;
  return {
    root, head: headG, sleeves, faceMat: H.faceMat, hakama, top,
    update(t, st) { const dt = lastT ? Math.min(0.1, t - lastT) : 0.016; lastT = t; blink(t, dt); anims.forEach(f => f(t, st)); }
  };
}

/* ═══════════════ 陽光狩人 ═══════════════
   長身の青年。影の色の長外套、深紅の胴着と襟巻き、革の長靴。
   灰がかった黒髪と琥珀の瞳。 */
export function buildHero() {
  const root = new THREE.Group();
  const skin = skinMat(0xe8c4ac);
  const coatC = 0x1e2230;
  const coat = clothMat(coatC, { r: 0.7, sheen: 0.5, sheenColor: 0x8090b0, ds: true });
  const vest = clothMat(0x5a1018, { r: 0.6, sheen: 0.6, sheenColor: 0xff6060 });
  const shirt = clothMat(0xe8e4dc);
  const pants = clothMat(0x1a1a22, { r: 0.85 });
  const leather = clothMat(0x3a2418, { r: 0.45, sheen: 0.3, cc: 0.4 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.9, roughness: 0.3 });
  const scarfM = clothMat(0x9a1a24, { sheen: 0.8, sheenColor: 0xff7070, ds: true });
  const hairM = hairMat(0x24222c, 0x8a8aa8);
  const anims = [];

  // 脚（腰を軸に振る）
  const legs = [];
  [-1, 1].forEach(sd => {
    const hip = new THREE.Group(); hip.position.set(sd * 0.1, 0.98, 0); root.add(hip);
    const thigh = limbMesh(0.075, 0.062, pants); placeLimb(thigh, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.46, 0.01)); hip.add(thigh);
    const knee = new THREE.Group(); knee.position.set(0, -0.46, 0.01); hip.add(knee);
    const boot = limbMesh(0.058, 0.052, leather); placeLimb(boot, new THREE.Vector3(0, 0.06, 0), new THREE.Vector3(0, -0.44, 0)); knee.add(boot);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.062, 0.08, 16), leather); cuff.position.y = 0.04; knee.add(cuff);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.26), leather); foot.position.set(0, -0.48, 0.06); knee.add(foot);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), gold); buckle.position.set(sd * 0.055, -0.2, 0.03); knee.add(buckle);
    legs.push(hip);
    hip.userData.knee = knee;
  });
  // 胴（胴着・シャツの襟）
  const torso = lathe([[0.05, 1.6], [0.085, 1.57], [0.19, 1.49], [0.195, 1.36], [0.165, 1.18], [0.155, 1.06], [0.165, 0.98]], vest, 32);
  root.add(torso);
  const collarShirt = lathe([[0.052, 1.64], [0.06, 1.58], [0.09, 1.55]], shirt, 20);
  root.add(collarShirt);
  // 胴着の金ボタン
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), gold); b.position.set(0, 1.42 - i * 0.09, 0.172 - i * 0.004); root.add(b); }
  // ベルト
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.162, 0.018, 6, 32), leather);
  belt.rotation.x = Math.PI / 2; belt.position.y = 1.02; root.add(belt);
  const bk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.045, 0.02), gold); bk.position.set(0, 1.02, 0.17); root.add(bk);
  // 長外套（前が開く）。裾は膝下まで
  const coatMesh = lathe([[0.09, 1.62], [0.2, 1.53], [0.225, 1.42], [0.21, 1.25], [0.185, 1.1], [0.2, 1.0], [0.27, 0.75], [0.33, 0.5], [0.36, 0.4]], coat, 40, 0.42, Math.PI * 2 - 0.84);
  root.add(coatMesh);
  // 高い立ち襟
  const collar = lathe([[0.1, 1.58], [0.11, 1.66], [0.13, 1.74]], coat, 28, Math.PI * 0.3, Math.PI * 1.4);
  root.add(collar);
  // 前立ての金の縁取り
  [-1, 1].forEach(sd => {
    const a = sd * 0.42;
    const pts = [[0.2, 1.53], [0.225, 1.42], [0.21, 1.25], [0.185, 1.1], [0.2, 1.0], [0.27, 0.75], [0.33, 0.5], [0.36, 0.4]]
      .map(([r, y]) => new THREE.Vector3(Math.sin(a) * r * 1.01, y, Math.cos(a) * r * 1.01));
    root.add(ribbon(pts, 0.018, 0.018, new THREE.Vector3(0, 1, 0), gold, 16));
  });
  // 肩当て
  const pauldrons = [];
  [-1, 1].forEach(sd => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x8a7a52, metalness: 0.85, roughness: 0.35 }));
    p.scale.set(1.1, 0.7, 1.05); p.position.set(sd * 0.21, 1.5, 0); p.rotation.z = -sd * 0.35;
    root.add(p); pauldrons.push(p);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 6, 24), gold);
    rim.rotation.x = Math.PI / 2; p.add(rim);
  });
  // 襟巻き（首に巻き、二本の端が背になびく）
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.028, 10, 24), scarfM);
  scarf.rotation.x = Math.PI / 2 + 0.15; scarf.position.set(0, 1.6, 0); root.add(scarf);
  const tails = [];
  [-1, 1].forEach(sd => {
    const g = new THREE.Group(); g.position.set(sd * 0.04, 1.6, -0.07); root.add(g);
    const pts = [0, 1, 2, 3, 4].map(i => new THREE.Vector3(sd * (0.02 + i * 0.015), -i * 0.1, -i * 0.07));
    g.add(ribbon(pts, 0.07, 0.055, new THREE.Vector3(0, -0.2, 0.3), scarfM, 10));
    tails.push({ g, sd });
  });
  anims.push((t, st) => {
    const mv = st && st.moving ? 1 : 0;
    tails.forEach(({ g, sd }, i) => {
      g.rotation.x = -0.25 - mv * 0.7 + Math.sin(t * (3 + mv * 6) + i) * (0.08 + mv * 0.12);
      g.rotation.z = sd * 0.1 + Math.sin(t * 2.3 + i) * 0.06;
    });
    coatMesh.scale.set(1 + mv * 0.03, 1, 1 + Math.sin(t * 9) * 0.01 * mv);
  });
  // 首
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 16), skin);
  neck.position.y = 1.64; root.add(neck);

  // 腕（毎フレーム手先へ伸ばす）
  const mkArm = (sd) => {
    const upper = limbMesh(0.056, 0.05, coat), fore = limbMesh(0.05, 0.042, coat);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.05, 14), gold);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), leather);
    hand.scale.set(0.8, 1.1, 1.2);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), coat);
    [upper, fore, cuff, hand, elbow].forEach(m => { m.castShadow = true; root.add(m); });
    return { sd, S: new THREE.Vector3(sd * 0.2, 1.47, 0), upper, fore, cuff, hand, elbow, L1: 0.29, L2: 0.27 };
  };
  const arms = [mkArm(-1), mkArm(1)];   // [右, 左]。右は体の -X 側
  const setArm = (arm, target) => {
    const pole = new THREE.Vector3(arm.sd * 0.5, -0.6, -0.8);
    const { E, T } = solveElbow(arm.S, target, arm.L1, arm.L2, pole);
    placeLimb(arm.upper, arm.S, E);
    placeLimb(arm.fore, E, T);
    arm.elbow.position.copy(E);
    arm.hand.position.copy(T);
    arm.cuff.position.copy(E.clone().lerp(T, 0.85));
    arm.cuff.quaternion.copy(arm.fore.quaternion);
  };
  setArm(arms[0], new THREE.Vector3(-0.28, 1.0, 0.08));
  setArm(arms[1], new THREE.Vector3(0.28, 1.0, 0.08));

  // 頭
  const H = makeHead(0.126, skin, 'hero');
  const headG = H.g; headG.position.set(0, 1.79, 0.015);
  root.add(headG);
  const hair = new THREE.Group(); headG.add(hair);
  const C0 = new THREE.Vector3(0, 0, 0);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.126 * 1.08, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), hairM);
  cap.scale.set(0.86, 1.08, 0.95); cap.rotation.x = -0.55; hair.add(cap);
  // 前髪：鋭く尖った房が額に落ち、一房が片目にかかる
  for (let i = 0; i < 11; i++) {
    const k = i / 10 - 0.5;
    const phi = k * Math.PI * 0.72;
    const len = 0.42 + ((i * 7) % 5) * 0.015 + (i === 6 ? 0.05 : 0);
    const sweep = 0.12 + k * 0.15;
    const pts = [onHead(H, 0.08, phi * 0.3, 1.07), onHead(H, 0.28, phi + sweep * 0.5, 1.15), onHead(H, len * Math.PI, phi + sweep, 1.12)];
    hair.add(ribbon(pts, 0.07, 0.05, C0, hairM, 10));
  }
  // もみあげと襟足の跳ね
  [-1, 1].forEach(sd => {
    const pts = [onHead(H, 0.3, sd * Math.PI * 0.45, 1.08), onHead(H, 0.58, sd * Math.PI * 0.5, 1.1), onHead(H, 0.7, sd * Math.PI * 0.48, 1.06)];
    hair.add(ribbon(pts, 0.06, 0.04, C0, hairM, 8));
  });
  for (let i = 0; i < 9; i++) {
    const phi = Math.PI * (0.6 + i / 8 * 0.8);
    const pts = [onHead(H, 0.3, phi, 1.08), onHead(H, 0.7, phi, 1.12), onHead(H, 0.86, phi * 1.02, 1.2).add(new THREE.Vector3(0, -0.02, -0.02))];
    hair.add(ribbon(pts, 0.08, 0.05, C0, hairM, 8));
  }
  // 帽子（化身のときは消す）
  const hatM = clothMat(0x121318, { r: 0.55, sheen: 0.05 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.29, 0.02, 32), hatM);
  brim.position.set(0, 0.105, -0.01); brim.rotation.x = -0.08; headG.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.16, 24), hatM);
  crown.position.set(0, 0.19, -0.015); crown.rotation.x = -0.08; headG.add(crown);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.147, 0.014, 8, 28), gold);
  band.rotation.x = Math.PI / 2 - 0.08; band.position.set(0, 0.13, -0.013); headG.add(band);
  const feather = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.2, 6), scarfM);
  feather.position.set(0.14, 0.2, -0.02); feather.rotation.z = -0.9; headG.add(feather);

  const blink = blinker(H);
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  let lastT = 0;
  return {
    root, head: headG, legs, arms, setArm, pauldrons,
    coatMats: [coat], hat: [brim, crown, band, feather, hair.children[0]].filter(Boolean),
    hatParts: [brim, crown, band, feather], faceMat: H.faceMat, torso,
    update(t, st) { const dt = lastT ? Math.min(0.1, t - lastT) : 0.016; lastT = t; blink(t, dt); anims.forEach(f => f(t, st)); }
  };
}
