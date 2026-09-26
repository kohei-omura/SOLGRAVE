/* ══════════════════════════════════════════════════════════════
   bestiary.js ── 雑兵の造形と描き方
     ・部位ごとの色（頂点色）、光る目や裂け目（glow）、金属の照り（metal）
     ・手足・翼・尾・顎は「部位番号」と「付け根」を持ち、頂点シェーダーで動かす
       （InstancedMesh のまま歩く・羽ばたく・掴みかかる・怯むので、数が多くても軽い）
     ・表面は三次元の雑音で汚れ・斑を乗せ、単色の塊に見えないようにする
   部位番号：1 左脚 2 右脚 3 左腕 4 右腕 5 左翼 6 右翼 7 頭 8 尾 9 左後脚 10 右後脚 11 顎
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

/* ── 部位 ── */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
/** 形の一片。o: c 色, glow 光, metal 金属, p 部位, pv 付け根, r 回転(XYZ), s 拡縮, q 四元数 */
function part(g, t, o) {
  o = o || {};
  return { g, t, r: o.r, s: o.s, q: o.q, c: o.c == null ? 0x888888 : o.c, glow: o.glow || 0, metal: o.metal || 0,
    p: o.p || 0, pv: o.pv || [0, 0, 0] };
}
/** a から b へ伸びる円柱／カプセル */
function limb(a, b, r, o, r2) {
  const A = V(...a), B = V(...b);
  const d = B.clone().sub(A), L = d.length();
  const g = r2 != null ? new THREE.CylinderGeometry(r2, r, L, 10, 1) : new THREE.CapsuleGeometry(r, Math.max(0.001, L), 4, 10);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
  const m = A.add(B).multiplyScalar(0.5);
  return part(g, [m.x, m.y, m.z], Object.assign({}, o, { q }));
}
const S = (r, w, h) => new THREE.SphereGeometry(r, w || 16, h || 12);
const Bx = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const Cy = (a, b, h, n) => new THREE.CylinderGeometry(a, b, h, n || 12);
const Co = (r, h, n, open) => new THREE.ConeGeometry(r, h, n || 10, 1, !!open);
const To = (R, r, arc) => new THREE.TorusGeometry(R, r, 6, 18, arc || Math.PI * 2);
const Ic = (r, d) => new THREE.IcosahedronGeometry(r, d || 0);
const Do = (r) => new THREE.DodecahedronGeometry(r, 0);
const Oc = (r) => new THREE.OctahedronGeometry(r, 0);

/** 部位を一つの形にまとめ、色・光・金属・部位番号・付け根を頂点に持たせる */
export function mergeParts(parts) {
  const geos = [];
  parts.forEach(p => {
    let g = p.g.clone();
    if (g.index) g = g.toNonIndexed();
    if (p.s) g.scale(p.s[0], p.s[1], p.s[2]);
    if (p.q) g.applyQuaternion(p.q);
    if (p.r) { g.rotateX(p.r[0] || 0); g.rotateY(p.r[1] || 0); g.rotateZ(p.r[2] || 0); }
    g.translate(p.t[0], p.t[1], p.t[2]);
    geos.push([g, p]);
  });
  let total = 0;
  geos.forEach(([g]) => { total += g.attributes.position.count; });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  const glow = new Float32Array(total), metal = new Float32Array(total), pid = new Float32Array(total), piv = new Float32Array(total * 3);
  const c = new THREE.Color();
  let off = 0;
  geos.forEach(([g, p]) => {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, off * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, off * 3);
    c.setHex(p.c);
    for (let i = 0; i < n; i++) {
      const j = off + i;
      col[j * 3] = c.r; col[j * 3 + 1] = c.g; col[j * 3 + 2] = c.b;
      glow[j] = p.glow; metal[j] = p.metal; pid[j] = p.p;
      piv[j * 3] = p.pv[0]; piv[j * 3 + 1] = p.pv[1]; piv[j * 3 + 2] = p.pv[2];
    }
    off += n;
    g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
  out.setAttribute('aMetal', new THREE.BufferAttribute(metal, 1));
  out.setAttribute('aPart', new THREE.BufferAttribute(pid, 1));
  out.setAttribute('aPivot', new THREE.BufferAttribute(piv, 3));
  out.computeBoundingSphere();
  return out;
}

/* ── 描き方（MeshStandardMaterial に手足の動きと表面の斑を足す） ── */
const ANIM_VS = /* glsl */`
attribute float aPart; attribute float aGlow; attribute float aMetal; attribute vec3 aPivot; attribute vec4 aAnim;
uniform float uGait; uniform float uTime;
varying float vGlow; varying float vMetal; varying float vHurt; varying vec3 vObj;
mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 rotZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
mat3 partRot(){
  float ph = aAnim.x, amp = aAnim.y, atk = aAnim.z;
  float s = sin(ph);
  int p = int(aPart + 0.5);
  bool quad = uGait > 0.5 && uGait < 1.5;
  if (p == 1) return rotX((quad ? 0.7 : 0.55) * s * amp);
  if (p == 2) return rotX(-(quad ? 0.7 : 0.55) * s * amp);
  if (p == 9) return rotX(-0.7 * s * amp);
  if (p == 10) return rotX(0.7 * s * amp);
  if (p == 3) return quad ? rotX(-0.7 * s * amp - atk * 0.9) : rotX(-0.45 * s * amp - atk * 1.2 * (0.6 + 0.4 * sin(uTime * 9.0 + ph)));
  if (p == 4) return quad ? rotX(0.7 * s * amp - atk * 0.9) : rotX(0.45 * s * amp - atk * 1.2 * (0.6 + 0.4 * cos(uTime * 9.0 + ph)));
  if (p == 5) return rotZ(sin(ph * 2.0) * 0.75);
  if (p == 6) return rotZ(-sin(ph * 2.0) * 0.75);
  if (p == 7) return rotX(sin(ph * 2.0) * 0.07 * amp + atk * 0.22 + sin(uTime * 1.3 + ph) * 0.05);
  if (p == 8) return rotY(sin(ph * 1.3 + uTime) * 0.45);
  if (p == 11) return rotX(0.12 + atk * 0.4 + sin(uTime * 3.0 + ph) * 0.06);
  return mat3(1.0);
}
`;

const NOISE_FS = /* glsl */`
uniform float uNoise; uniform float uGlowK;
varying float vGlow; varying float vMetal; varying float vHurt; varying vec3 vObj;
float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;

function inject(mat, depthOnly) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGait = mat.userData.uGait;
    sh.uniforms.uTime = mat.userData.uTime;
    sh.uniforms.uNoise = mat.userData.uNoise || { value: 0 };
    sh.uniforms.uGlowK = mat.userData.uGlowK || { value: 1 };
    sh.vertexShader = ANIM_VS + sh.vertexShader;
    if (!depthOnly) {
      sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\n  mat3 PR = partRot(); objectNormal = PR * objectNormal;');
    }
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  ${depthOnly ? 'mat3 PR = partRot();' : ''}
  transformed = aPivot + PR * (transformed - aPivot);
  float amp_ = aAnim.y;
  if (uGait < 0.5) transformed.y += abs(cos(aAnim.x)) * 0.05 * amp_;
  else if (uGait > 2.5 && uGait < 3.5) transformed.y += sin(aAnim.x * 0.5) * 0.12;
  else if (uGait > 3.5) transformed.y += abs(sin(aAnim.x)) * 0.35 * amp_;
  vGlow = aGlow; vMetal = aMetal; vHurt = aAnim.w; vObj = position;`);
    if (depthOnly) {
      sh.vertexShader = sh.vertexShader.replace('varying float vGlow; varying float vMetal; varying float vHurt; varying vec3 vObj;',
        'float vGlow; float vMetal; float vHurt; vec3 vObj;');
      return;
    }
    sh.fragmentShader = NOISE_FS + sh.fragmentShader;
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  {
    float n = vn(vObj * 9.0) * 0.55 + vn(vObj * 23.0) * 0.3 + vn(vObj * 3.0) * 0.15;
    diffuseColor.rgb *= mix(1.0, 0.62 + n * 0.72, uNoise * (1.0 - vGlow));
    diffuseColor.rgb *= mix(1.0, 0.72, uNoise * smoothstep(0.5, -0.1, vObj.y) * 0.6);   // 足元ほど煤ける
  }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.3, vMetal);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  metalnessFactor = mix(metalnessFactor, 0.92, vMetal);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += vColor.rgb * vGlow * 2.4 * uGlowK + vec3(1.0, 0.92, 0.85) * vHurt * 0.9;`);
  };
  mat.customProgramCacheKey = () => 'enemy' + (depthOnly ? 'D' : '');
}

/** 敵の材質を作る。k：gait（0 二足 1 四足 2 飛ぶ 3 漂う 4 跳ねる）, rough, metal, opacity, noise */
export function enemyMaterial(k) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: k.rough == null ? 0.82 : k.rough, metalness: k.metal || 0,
    transparent: k.opacity != null && k.opacity < 1, opacity: k.opacity == null ? 1 : k.opacity,
    depthWrite: !(k.opacity != null && k.opacity < 1),
    emissive: new THREE.Color(0x000000)
  });
  m.userData.uGait = { value: k.gait || 0 };
  m.userData.uTime = { value: 0 };
  m.userData.uNoise = { value: k.noise == null ? 1 : k.noise };
  m.userData.uGlowK = { value: k.glowK == null ? 1 : k.glowK };
  inject(m, false);
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  d.userData = m.userData;
  inject(d, true);
  m.userData.depth = d;
  return m;
}

/* ── 人型の骨組み（多くの不死者で使い回す） ──
   o: h 背丈, hunch 前屈み, armFwd 腕を前へ, sk 肌, top 上衣, low 下衣, eye 目の色, thick 太さ */
function humanoid(o) {
  const k = o.h || 1, th = o.thick || 1, hn = o.hunch || 0, af = o.armFwd == null ? 0.3 : o.armFwd;
  const P = [];
  const hipY = 0.9 * k;
  const sh = [0, hipY + Math.cos(hn) * 0.5 * k, Math.sin(hn) * 0.5 * k];
  const neck = [0, sh[1] + 0.1 * k, sh[2] + 0.04 * k + Math.sin(hn) * 0.05];
  const head = [0, neck[1] + 0.17 * k, neck[2] + 0.05 * k + Math.sin(hn) * 0.08];
  // 胴：胸と腰
  P.push(limb([0, hipY, 0], sh, 0.2 * th * k, { c: o.top }));
  P.push(part(S(0.23 * th * k), [0, hipY + 0.02, 0], { c: o.low, s: [1.05, 0.7, 0.85] }));
  if (!o.smooth) P.push(part(S(0.25 * th * k), [0, sh[1] - 0.12 * k, sh[2] * 0.85], { c: o.top, s: [1.25, 0.9, 0.8] }));
  // 首と頭
  P.push(limb([0, sh[1] - 0.02, sh[2]], neck, 0.07 * k, { c: o.sk, p: 7, pv: neck }));
  P.push(part(S(0.14 * k), head, { c: o.sk, s: [0.95, 1.08, 1.05], p: 7, pv: neck }));
  if (o.eye) {
    [-1, 1].forEach(sd => P.push(part(S(0.026 * k, 8, 6), [sd * 0.05 * k, head[1] + 0.02 * k, head[2] + 0.125 * k],
      { c: o.eye, glow: 1, p: 7, pv: neck })));
    [-1, 1].forEach(sd => P.push(part(Bx(0.07 * k, 0.02 * k, 0.03 * k), [sd * 0.05 * k, head[1] + 0.055 * k, head[2] + 0.12 * k],
      { c: 0x1a1414, p: 7, pv: neck, r: [0, 0, sd * 0.25] })));   // 眉の影
  }
  if (o.jaw) {
    const jp = [0, head[1] - 0.05 * k, head[2] + 0.02 * k];
    P.push(part(Bx(0.15 * k, 0.05 * k, 0.12 * k), [0, head[1] - 0.1 * k, head[2] + 0.07 * k], { c: o.sk, p: 11, pv: jp }));
    for (let i = 0; i < 5; i++) P.push(part(Co(0.009 * k, 0.03 * k, 4), [(-0.04 + i * 0.02) * k, head[1] - 0.075 * k, head[2] + 0.12 * k],
      { c: 0xe8e0c8, r: [Math.PI, 0, 0], p: 11, pv: jp }));
  }
  // 腕：肩から肘、肘から手、指
  [[3, 1], [4, -1]].forEach(([pid, sd]) => {
    const s0 = [sd * 0.24 * th * k, sh[1] - 0.04 * k, sh[2]];
    const el = [s0[0] + sd * 0.05 * k, s0[1] - Math.cos(af) * 0.3 * k, s0[2] + Math.sin(af) * 0.3 * k];
    const af2 = af + 0.25;
    const wr = [el[0] + sd * 0.01, el[1] - Math.cos(af2) * 0.28 * k, el[2] + Math.sin(af2) * 0.28 * k];
    const tone = o.sleeve || o.sk;
    P.push(part(S((o.smooth ? 0.075 : 0.09) * th * k), s0, { c: o.top, p: pid, pv: s0 }));
    P.push(limb(s0, el, 0.065 * th * k, { c: tone, p: pid, pv: s0 }));
    P.push(limb(el, wr, 0.055 * th * k, { c: o.sk, p: pid, pv: s0 }));
    const hd = [wr[0], wr[1] - Math.cos(af2) * 0.06 * k, wr[2] + Math.sin(af2) * 0.06 * k];
    P.push(part(S(0.055 * k), hd, { c: o.sk, s: [0.8, 1.1, 0.7], p: pid, pv: s0 }));
    for (let f = 0; f < 3; f++) {
      const tip = [hd[0] + (f - 1) * 0.025 * k, hd[1] - Math.cos(af2) * 0.09 * k, hd[2] + Math.sin(af2) * 0.09 * k];
      P.push(limb(hd, tip, 0.012 * k, { c: o.claw || o.sk, p: pid, pv: s0 }));
    }
  });
  // 脚
  [[1, 1], [2, -1]].forEach(([pid, sd]) => {
    const h0 = [sd * 0.12 * th * k, hipY, 0];
    const kn = [sd * 0.13 * th * k, 0.48 * k, 0.05 * k];
    const an = [sd * 0.13 * th * k, 0.08 * k, -0.01 * k];
    P.push(limb(h0, kn, 0.085 * th * k, { c: o.low, p: pid, pv: h0 }));
    P.push(limb(kn, an, 0.065 * th * k, { c: o.shin || o.low, p: pid, pv: h0 }));
    P.push(part(Bx(0.11 * k, 0.07 * k, 0.24 * k), [an[0], 0.035, 0.05 * k], { c: o.foot || 0x2a2420, p: pid, pv: h0 }));
  });
  return { P, head, neck, sh, hipY, k };
}
/** 肋骨の筋 */
function ribs(P, y, z, n, w, c) {
  for (let i = 0; i < n; i++) P.push(part(To(w - i * 0.012, 0.012, Math.PI * 0.9), [0, y - i * 0.07, z], { c, r: [Math.PI / 2, 0, Math.PI * 0.05] }));
}
/** ぼろ布の垂れ */
function rags(P, y, r, n, len, c, pid, pv) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const l = len * (0.7 + ((i * 37) % 10) / 20);
    P.push(part(Bx(0.12, l, 0.015), [Math.sin(a) * r, y - l / 2, Math.cos(a) * r], { c, r: [0, a, (i % 2 ? 0.08 : -0.08)], p: pid || 0, pv: pv || [0, 0, 0] }));
  }
}

/* ── 各種の姿 ── */
export function buildBestiary() {
  const G = {}, K = {};

  // 0 ゾンビ：前屈みで両腕を突き出す。裂けた服、覗く肋、濁った赤い眼
  {
    const H = humanoid({ h: 1, hunch: 0.35, armFwd: 1.25, sk: 0x7b8a60, top: 0x4c4236, low: 0x33343e, eye: 0xff5a2a, jaw: true, claw: 0x3a3020, shin: 0x6a7a52 });
    ribs(H.P, H.sh[1] - 0.12, H.sh[2] * 0.9 + 0.2, 3, 0.16, 0xd8ccb0);
    rags(H.P, H.hipY + 0.05, 0.22, 7, 0.28, 0x4c4236);
    H.P.push(part(S(0.05), [0.12, H.sh[1] - 0.2, H.sh[2] + 0.2], { c: 0x6a1a14, glow: 0.15 }));   // 傷
    G[0] = H.P; K[0] = { gait: 0, rough: 0.9 };
  }
  // 1 グール：低く這い、長い腕を前脚のように使う。背骨の棘
  {
    const H = humanoid({ h: 0.95, hunch: 1.2, armFwd: 0.35, sk: 0xa08468, top: 0x9a7c62, low: 0x5a4a3c, eye: 0xffe04a, jaw: true, claw: 0x2a2018, thick: 0.85 });
    for (let i = 0; i < 6; i++) H.P.push(part(Co(0.035, 0.14, 5), [0, 0.95 + i * 0.03, -0.02 + i * 0.09], { c: 0xe0d4b8, r: [-0.5, 0, 0] }));
    rags(H.P, 0.95, 0.18, 5, 0.2, 0x3a2e24);
    G[1] = H.P; K[1] = { gait: 1, rough: 0.8 };
  }
  // 2 盾持ちの骸：巨躯に鉄の鎧と大盾。兜の奥で赤く光る眼
  {
    const H = humanoid({ h: 1.15, thick: 1.45, hunch: 0.1, armFwd: 0.7, sk: 0x5f6c5a, top: 0x4a5058, low: 0x3a3a40, eye: 0xff3020, sleeve: 0x4a5058 });
    const hy = H.head[1], hz = H.head[2];
    H.P.push(part(S(0.19, 16, 12, ), [0, hy + 0.04, hz], { c: 0x5a6068, metal: 1, s: [1, 1.05, 1.1], p: 7, pv: H.neck }));
    H.P.push(part(Bx(0.26, 0.03, 0.06), [0, hy + 0.02, hz + 0.17], { c: 0x1a1a1e, p: 7, pv: H.neck }));
    [-1, 1].forEach(sd => H.P.push(part(S(0.2), [sd * 0.36, H.sh[1] + 0.02, H.sh[2]], { c: 0x5a6068, metal: 1, s: [1.1, 0.6, 1], p: sd > 0 ? 3 : 4, pv: [sd * 0.35, H.sh[1], H.sh[2]] })));
    H.P.push(part(Cy(0.3, 0.34, 0.5, 14), [0, H.sh[1] - 0.25, H.sh[2] * 0.6], { c: 0x565c64, metal: 1 }));
    // 大盾（左腕と一緒に動く）
    const pv = [0.35, H.sh[1], H.sh[2]];
    H.P.push(part(Bx(0.85, 1.2, 0.1), [0.3, 1.05, 0.62], { c: 0x4a4038, p: 3, pv }));
    H.P.push(part(Bx(0.9, 0.08, 0.13), [0.3, 1.6, 0.63], { c: 0x6a6e76, metal: 1, p: 3, pv }));
    H.P.push(part(Bx(0.9, 0.08, 0.13), [0.3, 0.5, 0.63], { c: 0x6a6e76, metal: 1, p: 3, pv }));
    H.P.push(part(Cy(0.14, 0.14, 0.04, 16), [0.3, 1.05, 0.68], { c: 0x7a1a1a, glow: 0.35, r: [Math.PI / 2, 0, 0], p: 3, pv }));
    for (let i = 0; i < 8; i++) H.P.push(part(S(0.025, 6, 4), [0.3 + Math.cos(i * 0.785) * 0.3, 1.05 + Math.sin(i * 0.785) * 0.45, 0.68], { c: 0x9a9ea6, metal: 1, p: 3, pv }));
    G[2] = H.P; K[2] = { gait: 0, rough: 0.7 };
  }
  // 3 吸血蝙蝠：毛の胴、大きな耳と牙、骨の通った膜の翼
  {
    const P = [];
    P.push(part(S(0.17), [0, 0, 0], { c: 0x3a2e38, s: [1, 0.9, 1.3] }));
    P.push(part(S(0.13), [0, 0.06, 0.2], { c: 0x3e3040, p: 7, pv: [0, 0.02, 0.12] }));
    P.push(part(Co(0.04, 0.05, 6), [0, 0.03, 0.33], { c: 0x6a4a58, r: [Math.PI / 2, 0, 0], p: 7, pv: [0, 0.02, 0.12] }));
    [-1, 1].forEach(sd => {
      P.push(part(Co(0.05, 0.2, 6), [sd * 0.07, 0.21, 0.18], { c: 0x4a3848, r: [-0.2, 0, -sd * 0.25], p: 7, pv: [0, 0.02, 0.12] }));
      P.push(part(S(0.022, 8, 6), [sd * 0.05, 0.09, 0.31], { c: 0xff2a2a, glow: 1, p: 7, pv: [0, 0.02, 0.12] }));
      P.push(part(Co(0.01, 0.05, 4), [sd * 0.025, -0.01, 0.31], { c: 0xf0e8e0, r: [Math.PI, 0, 0], p: 7, pv: [0, 0.02, 0.12] }));
      const pid = sd > 0 ? 5 : 6, pv = [sd * 0.12, 0.02, 0];
      // 翼の骨（指）と膜
      [[0.55, 0.12], [0.62, -0.06], [0.48, -0.2]].forEach(([len, dz], i) => {
        P.push(limb([sd * 0.12, 0.02, 0], [sd * (0.12 + len), 0.06 - i * 0.04, dz], 0.012, { c: 0x2a2028, p: pid, pv }));
      });
      P.push(part(Bx(0.52, 0.01, 0.36), [sd * 0.4, 0.03, -0.02], { c: 0x5a3848, p: pid, pv, r: [0, 0, sd * 0.05] }));
      P.push(part(Bx(0.3, 0.01, 0.2), [sd * 0.62, 0.01, -0.1], { c: 0x4a2c3c, p: pid, pv }));
    });
    P.push(limb([0.05, -0.1, -0.05], [0.07, -0.22, -0.02], 0.015, { c: 0x2a2028 }));
    P.push(limb([-0.05, -0.1, -0.05], [-0.07, -0.22, -0.02], 0.015, { c: 0x2a2028 }));
    G[3] = P; K[3] = { gait: 2, rough: 0.85 };
  }
  // 4 スケルトン：背骨・肋・骨盤・頭蓋。錆びた剣と腰布、眼窩に青い火
  {
    const P = [], bone = 0xe4dac2, k = 1;
    const neck = [0, 1.5, 0.02];
    for (let i = 0; i < 9; i++) P.push(part(Cy(0.035, 0.04, 0.06, 8), [0, 0.95 + i * 0.065, 0.0 + Math.sin(i * 0.4) * 0.02], { c: bone }));
    ribs(P, 1.38, 0.0, 5, 0.17, bone);
    P.push(part(To(0.13, 0.035, Math.PI), [0, 0.92, 0], { c: bone, r: [Math.PI / 2, 0, 0], s: [1, 1, 0.8] }));   // 骨盤
    P.push(part(S(0.15), [0, 1.66, 0.04], { c: bone, s: [0.9, 1, 1.05], p: 7, pv: neck }));
    [-1, 1].forEach(sd => {
      P.push(part(S(0.04, 8, 6), [sd * 0.055, 1.66, 0.16], { c: 0x0a0a10, p: 7, pv: neck }));
      P.push(part(S(0.022, 8, 6), [sd * 0.055, 1.66, 0.18], { c: 0x60c8ff, glow: 1, p: 7, pv: neck }));
    });
    P.push(part(Bx(0.13, 0.04, 0.1), [0, 1.53, 0.1], { c: bone, p: 11, pv: [0, 1.57, 0.04] }));
    for (let i = 0; i < 6; i++) P.push(part(Bx(0.012, 0.025, 0.01), [-0.045 + i * 0.018, 1.565, 0.16], { c: 0xf4ecd8, p: 11, pv: [0, 1.57, 0.04] }));
    [[3, 1], [4, -1]].forEach(([pid, sd]) => {
      const s0 = [sd * 0.2, 1.42, 0], e = [sd * 0.26, 1.13, 0.12], w = [sd * 0.26, 0.9, 0.3];
      P.push(part(S(0.05, 8, 6), s0, { c: bone, p: pid, pv: s0 }));
      P.push(limb(s0, e, 0.025, { c: bone, p: pid, pv: s0 }));
      P.push(limb(e, w, 0.02, { c: bone, p: pid, pv: s0 }));
      for (let f = 0; f < 4; f++) P.push(limb(w, [w[0] + (f - 1.5) * 0.02, w[1] - 0.08, w[2] + 0.04], 0.008, { c: bone, p: pid, pv: s0 }));
    });
    // 錆びた剣（右手）
    const pvR = [-0.2, 1.42, 0];
    P.push(part(Bx(0.05, 0.03, 0.9), [-0.26, 0.88, 0.75], { c: 0x7a6a5a, metal: 0.7, p: 4, pv: pvR }));
    P.push(part(Bx(0.2, 0.04, 0.04), [-0.26, 0.88, 0.3], { c: 0x5a4a3a, metal: 0.5, p: 4, pv: pvR }));
    [[1, 1], [2, -1]].forEach(([pid, sd]) => {
      const h0 = [sd * 0.1, 0.92, 0], kn = [sd * 0.11, 0.5, 0.04], an = [sd * 0.11, 0.08, 0];
      P.push(limb(h0, kn, 0.03, { c: bone, p: pid, pv: h0 }));
      P.push(part(S(0.04, 8, 6), kn, { c: bone, p: pid, pv: h0 }));
      P.push(limb(kn, an, 0.026, { c: bone, p: pid, pv: h0 }));
      P.push(part(Bx(0.08, 0.04, 0.18), [an[0], 0.03, 0.05], { c: bone, p: pid, pv: h0 }));
    });
    rags(P, 0.98, 0.15, 6, 0.3, 0x5a2a2a);
    G[4] = P; K[4] = { gait: 0, rough: 0.7 };
  }
  // 5 マミー：幾重もの包帯、隙間の暗がり、片目だけ琥珀に光る
  {
    const H = humanoid({ h: 1.05, thick: 1.2, hunch: 0.15, armFwd: 1.35, sk: 0xd6c6a0, top: 0xcdbd96, low: 0xc4b48c, eye: null, sleeve: 0xd0c098 });
    for (let i = 0; i < 12; i++) H.P.push(part(To(0.24 + (i % 3) * 0.02, 0.022), [0, 0.85 + i * 0.07, 0.02 + (i > 7 ? 0.05 : 0)], { c: i % 2 ? 0xe0d0aa : 0xb8a880, r: [Math.PI / 2 + (i % 2 ? 0.2 : -0.2), 0, 0] }));
    for (let i = 0; i < 4; i++) H.P.push(part(To(0.13, 0.018), [0, H.head[1] - 0.06 + i * 0.05, H.head[2]], { c: 0xe0d0aa, r: [Math.PI / 2 + (i % 2 ? 0.3 : -0.25), 0, 0], p: 7, pv: H.neck }));
    H.P.push(part(S(0.03, 8, 6), [0.05, H.head[1] + 0.02, H.head[2] + 0.13], { c: 0xffb030, glow: 1, p: 7, pv: H.neck }));
    H.P.push(part(S(0.035, 8, 6), [-0.05, H.head[1] + 0.02, H.head[2] + 0.12], { c: 0x1a1410, p: 7, pv: H.neck }));
    rags(H.P, 1.2, 0.27, 5, 0.5, 0xc0b088);
    G[5] = H.P; K[5] = { gait: 0, rough: 0.95 };
  }
  // 6 ゴースト：頭巾の奥の闇に二つの光、裾は裂けて消える
  {
    const P = [];
    P.push(part(Co(0.48, 1.3, 16, true), [0, -0.25, 0], { c: 0xc8e0ff, r: [Math.PI, 0, 0] }));
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P.push(part(Co(0.12, 0.6, 6), [Math.sin(a) * 0.38, -0.85, Math.cos(a) * 0.38], { c: 0xa8c8f0, r: [Math.PI, 0, 0] })); }
    P.push(part(S(0.3), [0, 0.45, 0], { c: 0xd8ecff, s: [1, 1.1, 1] }));
    P.push(part(S(0.2), [0, 0.42, 0.14], { c: 0x0a1020, s: [1, 1.1, 0.6] }));
    [-1, 1].forEach(sd => P.push(part(S(0.035, 8, 6), [sd * 0.08, 0.46, 0.25], { c: 0x9ad8ff, glow: 1 })));
    [[3, 1], [4, -1]].forEach(([pid, sd]) => {
      const s0 = [sd * 0.3, 0.2, 0.05];
      P.push(limb(s0, [sd * 0.45, 0.05, 0.45], 0.06, { c: 0xc0dcff, p: pid, pv: s0 }));
      for (let f = 0; f < 3; f++) P.push(limb([sd * 0.45, 0.05, 0.45], [sd * (0.45 + (f - 1) * 0.04), -0.05, 0.58], 0.012, { c: 0xd8ecff, p: pid, pv: s0 }));
    });
    G[6] = P; K[6] = { gait: 3, rough: 0.4, opacity: 0.62, glowK: 1.2, noise: 0.5 };
  }
  // 7 鬼火：白い芯、青い炎の殻と揺らめく尾
  {
    const P = [];
    P.push(part(S(0.16), [0, 0, 0], { c: 0xe8f4ff, glow: 1 }));
    P.push(part(S(0.3), [0, 0, 0], { c: 0x4aa0ff, glow: 0.6 }));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P.push(part(Co(0.1, 0.45, 8), [Math.sin(a) * 0.14, 0.25, Math.cos(a) * 0.14], { c: 0x6ab8ff, glow: 0.7, r: [Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4] })); }
    P.push(part(Co(0.24, 0.9, 10), [0, 0.1, -0.45], { c: 0x3a80e0, glow: 0.6, r: [-1.3, 0, 0], p: 8, pv: [0, 0, -0.1] }));
    G[7] = P; K[7] = { gait: 3, rough: 0.3, opacity: 0.85, glowK: 1.4, noise: 0.3 };
  }
  // 8 屍狼：肋の覗く痩せた胴、牙の並ぶ顎、緑に光る眼、揺れる尾
  {
    const P = [], fur = 0x4a4a52, bone = 0xd8d0b8;
    P.push(limb([0, 0.78, -0.42], [0, 0.85, 0.35], 0.24, { c: fur }));
    P.push(part(S(0.26), [0, 0.9, 0.3], { c: 0x3e3e46, s: [1, 1.05, 1] }));
    ribs(P, 0.88, 0.0, 4, 0.2, bone);
    const nk = [0, 0.95, 0.45];
    P.push(limb(nk, [0, 1.02, 0.66], 0.13, { c: fur, p: 7, pv: nk }));
    P.push(part(S(0.17), [0, 1.04, 0.7], { c: fur, s: [0.9, 0.85, 1], p: 7, pv: nk }));
    P.push(part(Bx(0.14, 0.1, 0.24), [0, 1.0, 0.88], { c: 0x3a3a40, p: 7, pv: nk }));
    P.push(part(Bx(0.12, 0.05, 0.22), [0, 0.92, 0.87], { c: 0x3a3a40, p: 11, pv: [0, 0.96, 0.76] }));
    for (let i = 0; i < 4; i++) [-1, 1].forEach(sd => P.push(part(Co(0.012, 0.05, 4), [sd * 0.05, 0.955, 0.8 + i * 0.045], { c: 0xf0e8d8, r: [Math.PI, 0, 0], p: 7, pv: nk })));
    [-1, 1].forEach(sd => {
      P.push(part(Co(0.05, 0.16, 5), [sd * 0.09, 1.2, 0.66], { c: fur, r: [-0.2, 0, -sd * 0.2], p: 7, pv: nk }));
      P.push(part(S(0.024, 8, 6), [sd * 0.07, 1.08, 0.83], { c: 0x7aff6a, glow: 1, p: 7, pv: nk }));
    });
    [[1, 1, 0.32], [2, -1, 0.32], [9, 1, -0.38], [10, -1, -0.38]].forEach(([pid, sd, z]) => {
      const h0 = [sd * 0.15, 0.8, z], kn = [sd * 0.17, 0.45, z + (z > 0 ? 0.04 : -0.1)], ft = [sd * 0.17, 0.05, z + 0.02];
      P.push(limb(h0, kn, 0.07, { c: fur, p: pid, pv: h0 }));
      P.push(limb(kn, ft, 0.045, { c: z > 0 ? fur : bone, p: pid, pv: h0 }));
      P.push(part(Bx(0.09, 0.05, 0.14), [ft[0], 0.03, ft[2] + 0.04], { c: 0x2a2a2e, p: pid, pv: h0 }));
    });
    P.push(limb([0, 0.85, -0.5], [0, 0.7, -0.95], 0.05, { c: fur, p: 8, pv: [0, 0.85, -0.5] }, 0.015));
    G[8] = P; K[8] = { gait: 1, rough: 0.9 };
  }
  // 9 朽ち木：樹皮の幹に節の顔、根の脚、枝の腕、苔と葉
  {
    const P = [], bark = 0x4a3a28, moss = 0x4a6a2a;
    P.push(part(Cy(0.32, 0.5, 1.9, 12), [0, 0.95, 0], { c: bark }));
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; P.push(part(Bx(0.06, 1.6, 0.05), [Math.sin(a) * 0.38, 0.9, Math.cos(a) * 0.38], { c: 0x3a2c1c, r: [0, a, 0] })); }
    [-1, 1].forEach(sd => P.push(part(S(0.06, 8, 6), [sd * 0.1, 1.55, 0.32], { c: 0xffa040, glow: 1 })));
    P.push(part(S(0.11, 10, 8), [0, 1.35, 0.33], { c: 0x140c06, s: [1.4, 0.6, 0.5] }));
    [[3, 1], [4, -1]].forEach(([pid, sd]) => {
      const s0 = [sd * 0.3, 1.6, 0];
      P.push(limb(s0, [sd * 0.85, 1.3, 0.35], 0.09, { c: bark, p: pid, pv: s0 }, 0.05));
      P.push(limb([sd * 0.85, 1.3, 0.35], [sd * 1.0, 0.95, 0.6], 0.05, { c: bark, p: pid, pv: s0 }, 0.02));
      P.push(limb([sd * 0.6, 1.45, 0.2], [sd * 0.75, 1.8, 0.3], 0.04, { c: bark, p: pid, pv: s0 }, 0.01));
      P.push(part(Ic(0.2, 1), [sd * 0.72, 1.85, 0.28], { c: 0x3a5a22, p: pid, pv: s0 }));
    });
    [[1, 1], [2, -1]].forEach(([pid, sd]) => {
      const h0 = [sd * 0.25, 0.4, 0];
      P.push(limb(h0, [sd * 0.55, 0.05, 0.25], 0.1, { c: bark, p: pid, pv: h0 }, 0.04));
      P.push(limb(h0, [sd * 0.45, 0.05, -0.3], 0.08, { c: bark, p: pid, pv: h0 }, 0.03));
    });
    [[0, 2.05, 0], [0.2, 1.95, -0.1], [-0.22, 1.98, 0.05]].forEach(t => P.push(part(Ic(0.3, 1), t, { c: 0x3a5a22 })));
    for (let i = 0; i < 5; i++) P.push(part(S(0.12, 8, 6), [Math.sin(i * 1.3) * 0.42, 0.3 + i * 0.3, Math.cos(i * 1.3) * 0.42], { c: moss, s: [1, 0.5, 1] }));
    G[9] = P; K[9] = { gait: 0, rough: 0.95 };
  }
  // 10 亡霊騎士：黒鋼の甲冑に金の縁取り、羽根飾り、外套、盾と槍。面頬の奥が青白く光る
  {
    const H = humanoid({ h: 1.12, thick: 1.25, armFwd: 0.6, sk: 0x2a2e38, top: 0x353b48, low: 0x2e333e, sleeve: 0x353b48, shin: 0x3a404c, foot: 0x2a2e36 });
    const hy = H.head[1], hz = H.head[2], nk = H.neck;
    H.P.push(part(Cy(0.17, 0.19, 0.34, 16), [0, hy + 0.02, hz], { c: 0x3a4050, metal: 1, p: 7, pv: nk }));
    H.P.push(part(S(0.17), [0, hy + 0.18, hz], { c: 0x3a4050, metal: 1, s: [1, 0.6, 1], p: 7, pv: nk }));
    H.P.push(part(Bx(0.22, 0.025, 0.05), [0, hy + 0.04, hz + 0.17], { c: 0xbfe0ff, glow: 1, p: 7, pv: nk }));
    H.P.push(part(Bx(0.02, 0.36, 0.04), [0, hy + 0.02, hz + 0.18], { c: 0xb89a4a, metal: 1, p: 7, pv: nk }));
    for (let i = 0; i < 5; i++) H.P.push(part(Co(0.04, 0.3, 6), [0, hy + 0.35 + i * 0.02, hz - 0.05 - i * 0.07], { c: 0x8a1a24, r: [-0.6 - i * 0.2, 0, 0], p: 7, pv: nk }));
    H.P.push(part(Cy(0.3, 0.26, 0.55, 16), [0, H.sh[1] - 0.24, H.sh[2]], { c: 0x3a4050, metal: 1 }));
    H.P.push(part(To(0.3, 0.02), [0, H.sh[1] - 0.02, H.sh[2]], { c: 0xb89a4a, metal: 1, r: [Math.PI / 2, 0, 0] }));
    [-1, 1].forEach(sd => H.P.push(part(S(0.18), [sd * 0.33, H.sh[1] + 0.02, H.sh[2]], { c: 0x3a4050, metal: 1, s: [1.15, 0.7, 1.05], p: sd > 0 ? 3 : 4, pv: [sd * 0.3, H.sh[1], H.sh[2]] })));
    for (let i = 0; i < 6; i++) H.P.push(part(Bx(0.26, 0.95, 0.02), [Math.sin(i * 0.45 - 1.1) * 0.25, H.hipY + 0.05, -0.22 - Math.cos(i * 0.45 - 1.1) * 0.05], { c: 0x4a1218, r: [0.15, i * 0.45 - 1.1, 0] }));   // 外套
    const pvL = [0.3, H.sh[1], H.sh[2]], pvR = [-0.3, H.sh[1], H.sh[2]];
    H.P.push(part(Bx(0.62, 0.95, 0.08), [0.36, 1.1, 0.5], { c: 0x2e3440, metal: 1, p: 3, pv: pvL }));
    H.P.push(part(Bx(0.08, 0.8, 0.1), [0.36, 1.1, 0.55], { c: 0xb89a4a, metal: 1, p: 3, pv: pvL }));
    H.P.push(part(Bx(0.5, 0.08, 0.1), [0.36, 1.2, 0.55], { c: 0xb89a4a, metal: 1, p: 3, pv: pvL }));
    H.P.push(limb([-0.36, 0.85, -0.4], [-0.36, 1.25, 1.5], 0.025, { c: 0x2a2420, p: 4, pv: pvR }));
    H.P.push(part(Co(0.06, 0.35, 6), [-0.36, 1.3, 1.7], { c: 0xc8ccd4, metal: 1, r: [Math.PI / 2 - 0.2, 0, 0], p: 4, pv: pvR }));
    G[10] = H.P; K[10] = { gait: 0, rough: 0.55 };
  }
  // 11 ガーゴイル：石の体、捻れた角、骨張った翼、爪と尾。橙の眼
  {
    const P = [], st = 0x6e6e74;
    P.push(part(S(0.3), [0, 0, 0], { c: st, s: [1, 1.1, 0.9] }));
    P.push(part(S(0.26), [0, 0.2, 0.08], { c: 0x76767c, s: [1.2, 0.8, 0.9] }));
    const nk = [0, 0.35, 0.15];
    P.push(part(S(0.18), [0, 0.5, 0.25], { c: st, s: [1, 0.9, 1.1], p: 7, pv: nk }));
    P.push(part(Bx(0.18, 0.08, 0.12), [0, 0.42, 0.38], { c: 0x5e5e64, p: 11, pv: [0, 0.46, 0.3] }));
    [-1, 1].forEach(sd => {
      P.push(limb([sd * 0.1, 0.62, 0.2], [sd * 0.2, 0.85, 0.05], 0.04, { c: 0x4a4a50, p: 7, pv: nk }, 0.008));
      P.push(part(S(0.028, 8, 6), [sd * 0.07, 0.53, 0.4], { c: 0xff8a2a, glow: 1, p: 7, pv: nk }));
      const pid = sd > 0 ? 5 : 6, pv = [sd * 0.2, 0.2, -0.1];
      P.push(limb(pv, [sd * 0.9, 0.55, -0.25], 0.035, { c: 0x5a5a60, p: pid, pv }));
      P.push(limb([sd * 0.9, 0.55, -0.25], [sd * 1.15, 0.1, -0.3], 0.02, { c: 0x5a5a60, p: pid, pv }));
      P.push(part(Bx(0.85, 0.02, 0.5), [sd * 0.62, 0.3, -0.25], { c: 0x585860, p: pid, pv, r: [0, 0, sd * 0.35] }));
      const s0 = [sd * 0.27, 0.15, 0.1];
      P.push(limb(s0, [sd * 0.3, -0.2, 0.3], 0.06, { c: st, p: sd > 0 ? 3 : 4, pv: s0 }));
      for (let f = 0; f < 3; f++) P.push(part(Co(0.015, 0.08, 4), [sd * 0.3 + (f - 1) * 0.03, -0.28, 0.33], { c: 0x2a2a2e, r: [Math.PI, 0, 0], p: sd > 0 ? 3 : 4, pv: s0 }));
      const h0 = [sd * 0.15, -0.2, 0];
      P.push(limb(h0, [sd * 0.18, -0.55, 0.1], 0.07, { c: st, p: sd > 0 ? 1 : 2, pv: h0 }));
    });
    P.push(limb([0, -0.15, -0.25], [0, -0.45, -0.8], 0.05, { c: st, p: 8, pv: [0, -0.15, -0.25] }, 0.01));
    G[11] = P; K[11] = { gait: 2, rough: 0.9 };
  }
  // 12 氷霊：透ける結晶の群れと、中の光る核
  {
    const P = [];
    P.push(part(Oc(0.4), [0, 0, 0], { c: 0xbfe8ff, s: [0.75, 1.6, 0.75] }));
    P.push(part(S(0.14), [0, 0.05, 0], { c: 0xeaffff, glow: 1 }));
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      P.push(part(Oc(0.16), [Math.sin(a) * 0.5, Math.sin(i * 2.1) * 0.3, Math.cos(a) * 0.5], { c: 0xa8dcff, s: [0.55, 1.5, 0.55], r: [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5], p: i % 2 ? 5 : 6, pv: [0, 0, 0] }));
    }
    P.push(part(Oc(0.15), [0, -0.65, 0], { c: 0x9ad0f8, s: [0.6, 1.9, 0.6] }));
    G[12] = P; K[12] = { gait: 3, rough: 0.12, metal: 0.1, opacity: 0.82, glowK: 1.1, noise: 0.35 };
  }
  // 13 雪鬼：毛むくじゃらの巨躯、青黒い顔と角、太い腕
  {
    const H = humanoid({ h: 1.4, thick: 1.8, hunch: 0.35, armFwd: 0.45, sk: 0x405070, top: 0xb4bec8, low: 0xa8b2bc, sleeve: 0xb4bec8, eye: 0x6affff, jaw: true, claw: 0x20283a });
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39, y = 0.9 + (i / 26) * 1.0;
      H.P.push(part(Ic(0.2, 0), [Math.sin(a) * 0.36, y, Math.cos(a) * 0.3 + 0.1], { c: i % 3 ? 0xbcc6d0 : 0x9eaab6 }));
    }
    [-1, 1].forEach(sd => H.P.push(limb([sd * 0.1, H.head[1] + 0.1, H.head[2]], [sd * 0.26, H.head[1] + 0.3, H.head[2] - 0.1], 0.05, { c: 0x2a2a34, p: 7, pv: H.neck }, 0.01)));
    G[13] = H.P; K[13] = { gait: 0, rough: 0.95 };
  }
  // 14 溶岩塊：黒い岩の塊の継ぎ目から溶岩が光る
  {
    const P = [], rk = 0x2a1c16, mg = 0xff5a10;
    P.push(part(Do(0.6), [0, 0.95, 0], { c: rk }));
    P.push(part(S(0.5, 12, 10), [0, 0.95, 0], { c: mg, glow: 1, s: [1.02, 1.02, 1.02] }));
    [[0.4, 1.4, 0.1, 0.35], [-0.38, 1.45, -0.1, 0.3], [0, 1.65, 0.2, 0.3], [0.1, 0.55, 0.3, 0.25]].forEach(([x, y, z, r]) => {
      P.push(part(Do(r), [x, y, z], { c: rk, r: [x * 3, y, z * 2] }));
      P.push(part(S(r * 0.8, 10, 8), [x, y, z], { c: mg, glow: 1 }));
    });
    [-1, 1].forEach(sd => {
      P.push(part(S(0.05, 8, 6), [sd * 0.12, 1.3, 0.52], { c: 0xffe070, glow: 1, p: 7, pv: [0, 1.2, 0] }));
      const s0 = [sd * 0.55, 1.2, 0];
      P.push(part(Do(0.26), [sd * 0.75, 0.85, 0.2], { c: rk, p: sd > 0 ? 3 : 4, pv: s0 }));
      P.push(part(Do(0.2), [sd * 0.7, 1.1, 0.1], { c: rk, p: sd > 0 ? 3 : 4, pv: s0 }));
      P.push(part(S(0.17, 8, 6), [sd * 0.75, 0.85, 0.2], { c: mg, glow: 0.8, p: sd > 0 ? 3 : 4, pv: s0 }));
      const h0 = [sd * 0.25, 0.55, 0];
      P.push(part(Do(0.26), [sd * 0.3, 0.25, 0], { c: rk, p: sd > 0 ? 1 : 2, pv: h0 }));
    });
    G[14] = P; K[14] = { gait: 0, rough: 0.9, glowK: 1.1 };
  }
  // 15 火蜥蜴：赤い鱗の長い胴、黄の腹、背の炎の棘、黄色い眼
  {
    const P = [], sc = 0xb8401a, bl = 0xe0a040;
    P.push(limb([0, 0.4, -0.45], [0, 0.42, 0.45], 0.2, { c: sc }));
    P.push(part(S(0.18), [0, 0.3, 0], { c: bl, s: [1, 0.6, 2.4] }));
    const nk = [0, 0.45, 0.55];
    P.push(part(S(0.18), [0, 0.5, 0.72], { c: sc, s: [1, 0.75, 1.35], p: 7, pv: nk }));
    P.push(part(Bx(0.18, 0.05, 0.22), [0, 0.42, 0.82], { c: bl, p: 11, pv: [0, 0.46, 0.66] }));
    [-1, 1].forEach(sd => P.push(part(S(0.035, 8, 6), [sd * 0.1, 0.6, 0.8], { c: 0xffe040, glow: 1, p: 7, pv: nk })));
    for (let i = 0; i < 7; i++) P.push(part(Co(0.05, 0.22, 5), [0, 0.62, -0.4 + i * 0.13], { c: 0xff7a20, glow: 0.8 }));
    P.push(limb([0, 0.4, -0.5], [0, 0.25, -1.3], 0.13, { c: sc, p: 8, pv: [0, 0.4, -0.5] }, 0.02));
    P.push(part(Co(0.07, 0.3, 6), [0, 0.28, -1.4], { c: 0xffa030, glow: 1, r: [-Math.PI / 2, 0, 0], p: 8, pv: [0, 0.4, -0.5] }));
    [[1, 1, 0.3], [2, -1, 0.3], [9, 1, -0.3], [10, -1, -0.3]].forEach(([pid, sd, z]) => {
      const h0 = [sd * 0.18, 0.35, z];
      P.push(limb(h0, [sd * 0.38, 0.2, z + 0.05], 0.055, { c: sc, p: pid, pv: h0 }));
      P.push(limb([sd * 0.38, 0.2, z + 0.05], [sd * 0.4, 0.03, z + 0.1], 0.04, { c: sc, p: pid, pv: h0 }));
    });
    G[15] = P; K[15] = { gait: 1, rough: 0.55, glowK: 1.1 };
  }
  // 16 案山子：一本足、藁の胴、麻袋の頭に縫い目の光る目と口、笠
  {
    const P = [], straw = 0xc8a85a, sack = 0xb8a070;
    P.push(part(Cy(0.05, 0.05, 1.4, 8), [0, 0.7, 0], { c: 0x5a4028 }));
    P.push(part(Co(0.42, 1.0, 12, true), [0, 1.1, 0], { c: 0x6a5a3a }));
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; P.push(part(Bx(0.03, 0.4, 0.01), [Math.sin(a) * 0.4, 0.5, Math.cos(a) * 0.4], { c: straw, r: [Math.cos(a) * 0.3, a, -Math.sin(a) * 0.3] })); }
    P.push(part(S(0.24), [0, 1.82, 0], { c: sack, s: [1, 1.05, 0.95], p: 7, pv: [0, 1.6, 0] }));
    [-1, 1].forEach(sd => P.push(part(Co(0.05, 0.07, 3), [sd * 0.08, 1.87, 0.21], { c: 0xff9a20, glow: 1, r: [Math.PI / 2, 0, 0], p: 7, pv: [0, 1.6, 0] })));
    P.push(part(Bx(0.18, 0.03, 0.02), [0, 1.74, 0.22], { c: 0xff7a10, glow: 1, p: 7, pv: [0, 1.6, 0] }));
    for (let i = 0; i < 5; i++) P.push(part(Bx(0.005, 0.05, 0.01), [-0.07 + i * 0.035, 1.74, 0.225], { c: 0x2a1a0a, p: 7, pv: [0, 1.6, 0] }));
    P.push(part(Co(0.55, 0.3, 16), [0, 2.08, 0], { c: 0xb09050, p: 7, pv: [0, 1.6, 0] }));
    [[3, 1], [4, -1]].forEach(([pid, sd]) => {
      const s0 = [0, 1.45, 0];
      P.push(limb(s0, [sd * 0.75, 1.42, 0], 0.035, { c: 0x5a4028, p: pid, pv: s0 }));
      P.push(part(Cy(0.09, 0.07, 0.5, 8), [sd * 0.4, 1.44, 0], { c: 0x6a5a3a, r: [0, 0, Math.PI / 2], p: pid, pv: s0 }));
      for (let f = 0; f < 5; f++) P.push(part(Bx(0.18, 0.02, 0.01), [sd * 0.82, 1.42 + (f - 2) * 0.03, 0], { c: straw, r: [0, 0, (f - 2) * 0.2], p: pid, pv: s0 }));
    });
    G[16] = P; K[16] = { gait: 4, rough: 0.95 };
  }
  // 17 ハーピー：羽毛の胴と白い顔、長い髪、層になった羽の翼、鉤爪
  {
    const P = [], fe = 0x8a6a8a;
    P.push(part(S(0.2), [0, 0, 0], { c: fe, s: [1, 1.2, 0.85] }));
    P.push(part(S(0.13), [0, 0.12, 0.06], { c: 0xe8d0c8, s: [1.2, 0.8, 0.8] }));
    const nk = [0, 0.28, 0.02];
    P.push(part(S(0.13), [0, 0.42, 0.06], { c: 0xecd6cc, s: [0.9, 1.08, 1], p: 7, pv: nk }));
    P.push(part(S(0.15), [0, 0.46, 0.0], { c: 0x3a1a3a, s: [1.05, 1.1, 1.05], p: 7, pv: nk }));
    for (let i = 0; i < 6; i++) P.push(part(Bx(0.05, 0.4, 0.02), [(i - 2.5) * 0.045, 0.25, -0.1], { c: 0x3a1a3a, r: [0.2, 0, (i - 2.5) * 0.05], p: 7, pv: nk }));
    [-1, 1].forEach(sd => {
      P.push(part(S(0.02, 8, 6), [sd * 0.045, 0.43, 0.17], { c: 0xff6ac0, glow: 1, p: 7, pv: nk }));
      const pid = sd > 0 ? 5 : 6, pv = [sd * 0.16, 0.1, -0.05];
      for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
        P.push(part(Bx(0.12, 0.012, 0.36 - r * 0.08), [sd * (0.24 + i * 0.16), 0.14 - i * 0.02 - r * 0.015, -0.08 - r * 0.07], { c: r === 0 ? 0x6a4a6a : r === 1 ? 0x8a6a8a : 0xb08ab0, p: pid, pv, r: [0, sd * (0.1 + i * 0.05), 0] }));
      }
      const h0 = [sd * 0.1, -0.2, 0];
      P.push(limb(h0, [sd * 0.12, -0.5, 0.08], 0.035, { c: 0xc8a060, p: sd > 0 ? 1 : 2, pv: h0 }));
      for (let f = 0; f < 3; f++) P.push(part(Co(0.012, 0.08, 4), [sd * 0.12 + (f - 1) * 0.03, -0.55, 0.14], { c: 0x1a1a1a, r: [Math.PI / 2 + 0.5, 0, 0], p: sd > 0 ? 1 : 2, pv: h0 }));
    });
    P.push(part(Co(0.22, 0.55, 8), [0, -0.35, -0.3], { c: 0x6a4a6a, r: [-2.4, 0, 0], p: 8, pv: [0, -0.1, -0.1] }));
    G[17] = P; K[17] = { gait: 2, rough: 0.85 };
  }
  // 18 キョンシー：清朝の官服に金の縁、帽子、青ざめた顔と額の御札、腕を前へ
  {
    const H = humanoid({ h: 1.0, thick: 1.15, armFwd: Math.PI / 2, sk: 0xb8ccb0, top: 0x243a6a, low: 0x243a6a, sleeve: 0x243a6a, eye: 0x9aff9a, shin: 0x1a2a4a, foot: 0x0a0a0a });
    H.P.push(part(Cy(0.3, 0.42, 1.0, 16), [0, 0.95, 0], { c: 0x243a6a }));
    H.P.push(part(Cy(0.43, 0.43, 0.05, 16), [0, 0.46, 0], { c: 0xc9a227, metal: 0.8 }));
    H.P.push(part(Bx(0.08, 0.9, 0.02), [0, 1.0, 0.31], { c: 0xc9a227, metal: 0.8 }));
    H.P.push(part(Cy(0.17, 0.19, 0.12, 16), [0, H.head[1] + 0.13, H.head[2]], { c: 0x10141a, p: 7, pv: H.neck }));
    H.P.push(part(S(0.035, 8, 6), [0, H.head[1] + 0.22, H.head[2]], { c: 0xc92a2a, p: 7, pv: H.neck }));
    H.P.push(part(Bx(0.1, 0.24, 0.005), [0, H.head[1] - 0.02, H.head[2] + 0.145], { c: 0xe8d060, p: 7, pv: H.neck, r: [-0.15, 0, 0] }));
    H.P.push(part(Bx(0.02, 0.18, 0.006), [0, H.head[1] - 0.02, H.head[2] + 0.15], { c: 0xc92a2a, glow: 0.4, p: 7, pv: H.neck, r: [-0.15, 0, 0] }));
    G[18] = H.P; K[18] = { gait: 4, rough: 0.7 };
  }
  // 19 泣き女：裂けた白い衣、顔を覆う長い黒髪、青白い腕
  {
    const P = [];
    P.push(part(Co(0.45, 1.6, 16, true), [0, -0.3, 0], { c: 0xe8e4f4, r: [Math.PI, 0, 0] }));
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; P.push(part(Bx(0.14, 0.7, 0.01), [Math.sin(a) * 0.4, -0.95, Math.cos(a) * 0.4], { c: 0xd8d4ec, r: [0, a, (i % 2 ? 0.1 : -0.1)] })); }
    P.push(part(S(0.18), [0, 0.35, 0], { c: 0xe0dcf0, s: [1.1, 1, 0.8] }));
    const nk = [0, 0.5, 0];
    P.push(part(S(0.14), [0, 0.68, 0.02], { c: 0xd8dce8, p: 7, pv: nk }));
    P.push(part(S(0.16), [0, 0.7, -0.01], { c: 0x0a0a10, s: [1.05, 1.08, 1.05], p: 7, pv: nk }));
    for (let i = 0; i < 9; i++) P.push(part(Bx(0.04, 0.9, 0.02), [(i - 4) * 0.035, 0.3, 0.13 - Math.abs(i - 4) * 0.02], { c: 0x0a0a12, r: [-0.05, 0, (i - 4) * 0.03], p: 7, pv: nk }));
    [-1, 1].forEach(sd => P.push(part(S(0.018, 8, 6), [sd * 0.045, 0.67, 0.155], { c: 0xc8a0ff, glow: 1, p: 7, pv: nk })));
    [[3, 1], [4, -1]].forEach(([pid, sd]) => {
      const s0 = [sd * 0.2, 0.45, 0];
      P.push(limb(s0, [sd * 0.4, 0.15, 0.3], 0.035, { c: 0xd8dcec, p: pid, pv: s0 }));
      P.push(limb([sd * 0.4, 0.15, 0.3], [sd * 0.42, 0.25, 0.55], 0.03, { c: 0xd8dcec, p: pid, pv: s0 }));
    });
    G[19] = P; K[19] = { gait: 3, rough: 0.6, opacity: 0.8, glowK: 1.2, noise: 0.5 };
  }
  // 黄金の守り手：金の甲冑の巨兵。胸と兜に日輪、背に光輪、両手に大剣
  {
    const H = humanoid({ h: 1.1, thick: 1.5, armFwd: 0.55, sk: 0xd8a830, top: 0xe0b440, low: 0xc89a30, sleeve: 0xe0b440, shin: 0xd4a838, foot: 0xb88a28 });
    H.P.forEach(p => { p.metal = 1; });
    const hy = H.head[1], hz = H.head[2], nk = H.neck;
    H.P.push(part(S(0.2), [0, hy + 0.05, hz], { c: 0xf0c450, metal: 1, s: [1, 1.1, 1.1], p: 7, pv: nk }));
    H.P.push(part(Bx(0.26, 0.03, 0.05), [0, hy + 0.04, hz + 0.19], { c: 0xfff0a0, glow: 1, p: 7, pv: nk }));
    for (let i = 0; i < 7; i++) H.P.push(part(Co(0.03, 0.2, 5), [Math.sin((i - 3) * 0.35) * 0.18, hy + 0.25 + Math.cos((i - 3) * 0.35) * 0.08, hz - 0.02], { c: 0xffd24a, metal: 1, r: [0, 0, -(i - 3) * 0.35], p: 7, pv: nk }));
    H.P.push(part(Cy(0.3, 0.26, 0.55, 16), [0, H.sh[1] - 0.24, H.sh[2]], { c: 0xe8bc48, metal: 1 }));
    H.P.push(part(Cy(0.12, 0.12, 0.03, 20), [0, H.sh[1] - 0.2, H.sh[2] + 0.3], { c: 0xfff0a0, glow: 1, r: [Math.PI / 2, 0, 0] }));
    H.P.push(part(To(0.55, 0.025), [0, H.sh[1] + 0.1, H.sh[2] - 0.35], { c: 0xffe070, glow: 0.8 }));
    [-1, 1].forEach(sd => H.P.push(part(S(0.2), [sd * 0.36, H.sh[1] + 0.02, H.sh[2]], { c: 0xf0c450, metal: 1, s: [1.2, 0.7, 1.05], p: sd > 0 ? 3 : 4, pv: [sd * 0.34, H.sh[1], H.sh[2]] })));
    const pvR = [-0.34, H.sh[1], H.sh[2]];
    H.P.push(part(Bx(0.08, 0.04, 1.3), [-0.38, 0.95, 1.0], { c: 0xfff4d0, metal: 1, glow: 0.3, p: 4, pv: pvR }));
    H.P.push(part(Bx(0.36, 0.06, 0.06), [-0.38, 0.95, 0.32], { c: 0xffd24a, metal: 1, p: 4, pv: pvR }));
    G.golden = H.P; K.golden = { gait: 0, rough: 0.3, metal: 0.9, glowK: 1.2, noise: 0.35 };
  }

  const out = {};
  Object.keys(G).forEach(k => { out[k] = { geo: mergeParts(G[k]), opt: K[k] }; });
  return out;
}

/* ── 町の人々 ──
   人型の骨組みに、着物（袖・衽・帯）、袴や前掛け、髪型（髷・結い上げ・下ろし髪・白髪）、
   顔（白目と瞳・眉・鼻・口）を足す。def：町の人の定義（hair / cloth / skin / apron / fat / small / beard / long） */
export function buildFolk(def) {
  const female = !!(def.long || /girl|inn|shop|traveler|cook|scholar|mother|child|weaver/.test(def.id));
  const old = /old|smith|gp/.test(def.id);
  const small = !!def.small;
  const k = small ? 0.66 : 1;
  const H = humanoid({ h: k, smooth: true, thick: def.fat ? 1.3 : (female ? 0.9 : 1.05), hunch: old ? 0.22 : 0.02, armFwd: 0.12,
    sk: def.skin, top: def.cloth, low: female ? def.cloth : 0x3a3a48, sleeve: def.cloth, shin: female ? def.cloth : 0x2e2e3a, foot: 0x5a4030 });
  const P = H.P, hd = H.head, nk = H.neck, sh = H.sh;
  // 子どもは頭を大きめに
  const hs = small ? 1.25 : 1;
  if (small) P.push(part(S(0.14 * k * hs), hd, { c: def.skin, s: [0.96, 1.05, 1.02], p: 7, pv: nk }));
  const R = 0.14 * k * hs;
  // 顔：白目・瞳・眉・鼻・口・頬
  [-1, 1].forEach(sd => {
    const ex = sd * R * 0.36, ey = hd[1] + R * 0.12, ez = hd[2] + R * 0.86;
    P.push(part(S(R * 0.2, 10, 8), [ex, ey, ez], { c: 0xf4f0ea, s: [1.25, 0.9, 0.5], p: 7, pv: nk }));
    P.push(part(S(R * 0.13, 10, 8), [ex, ey, ez + R * 0.07], { c: 0x2a1c18, s: [1, 1.1, 0.5], p: 7, pv: nk }));
    P.push(part(S(R * 0.04, 6, 4), [ex + R * 0.04, ey + R * 0.05, ez + R * 0.13], { c: 0xffffff, glow: 0.3, p: 7, pv: nk }));
    P.push(part(Bx(R * 0.45, R * 0.07, R * 0.08), [ex, ey + R * 0.3, ez - R * 0.02], { c: old ? 0xc8c0b4 : def.hair, r: [0, 0, sd * (female ? 0.12 : -0.08)], p: 7, pv: nk }));
    if (female || small) P.push(part(S(R * 0.16, 8, 6), [sd * R * 0.5, hd[1] - R * 0.22, hd[2] + R * 0.78], { c: 0xf0a0a0, s: [1.2, 0.6, 0.4], p: 7, pv: nk }));
  });
  P.push(part(Co(R * 0.1, R * 0.28, 6), [0, hd[1] - R * 0.08, hd[2] + R * 0.98], { c: def.skin, r: [Math.PI / 2 - 0.3, 0, 0], p: 7, pv: nk }));
  P.push(part(Bx(R * 0.36, R * 0.05, R * 0.05), [0, hd[1] - R * 0.42, hd[2] + R * 0.88], { c: female ? 0xc05a5a : 0x7a4a40, p: 7, pv: nk }));
  [-1, 1].forEach(sd => P.push(part(S(R * 0.2, 8, 6), [sd * R * 0.98, hd[1], hd[2]], { c: def.skin, s: [0.5, 1, 0.8], p: 7, pv: nk })));   // 耳
  // 髪
  const hair = old ? 0xc8c0b4 : def.hair;
  P.push(part(new THREE.SphereGeometry(R * 1.07, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), [0, hd[1] + R * 0.06, hd[2] - R * 0.04], { c: hair, p: 7, pv: nk }));
  P.push(part(new THREE.SphereGeometry(R * 1.06, 18, 12, Math.PI * 0.62, Math.PI * 1.76, Math.PI * 0.3, Math.PI * 0.42), [0, hd[1], hd[2] - R * 0.05], { c: hair, p: 7, pv: nk }));
  for (let i = 0; i < 7; i++) P.push(part(Bx(R * 0.28, R * 0.5, R * 0.1), [(i - 3) * R * 0.26, hd[1] + R * 0.62, hd[2] + R * 0.78], { c: hair, r: [0.35, 0, (i - 3) * 0.08], p: 7, pv: nk }));   // 前髪
  if (female) {
    if (def.long) {
      for (let i = 0; i < 7; i++) P.push(part(Bx(R * 0.36, R * 3.2, R * 0.14), [(i - 3) * R * 0.3, hd[1] - R * 1.2, hd[2] - R * 0.78 + Math.abs(i - 3) * R * 0.12], { c: hair, r: [0.12, (i - 3) * 0.2, 0], p: 7, pv: nk }));
    } else {
      P.push(part(S(R * 0.6), [0, hd[1] + R * 0.75, hd[2] - R * 0.55], { c: hair, s: [1.3, 0.9, 1], p: 7, pv: nk }));   // 結い上げ
      P.push(part(Cy(R * 0.03, R * 0.03, R * 2.4, 6), [0, hd[1] + R * 0.8, hd[2] - R * 0.5], { c: 0xc9a227, metal: 1, r: [0, 0, Math.PI / 2 - 0.3], p: 7, pv: nk }));   // 簪
      P.push(part(S(R * 0.14, 8, 6), [R * 1.1, hd[1] + R * 1.1, hd[2] - R * 0.5], { c: 0xd84a6a, p: 7, pv: nk }));
    }
  } else if (!small) {
    P.push(part(Cy(R * 0.18, R * 0.22, R * 0.9, 8), [0, hd[1] + R * 1.02, hd[2] - R * 0.1], { c: hair, r: [Math.PI / 2, 0, 0], p: 7, pv: nk }));   // 髷
  } else {
    P.push(part(S(R * 0.35), [0, hd[1] + R * 0.95, hd[2] - R * 0.2], { c: hair, p: 7, pv: nk }));
  }
  if (def.beard) {
    P.push(part(Co(R * 0.55, R * 1.4, 10), [0, hd[1] - R * 1.1, hd[2] + R * 0.55], { c: hair, r: [Math.PI + 0.25, 0, 0], p: 7, pv: nk }));
    [-1, 1].forEach(sd => P.push(part(Bx(R * 0.5, R * 0.12, R * 0.1), [sd * R * 0.3, hd[1] - R * 0.35, hd[2] + R * 0.9], { c: hair, r: [0, 0, sd * 0.3], p: 7, pv: nk })));
  }
  // 着物：衽の重なり（白い襟）、帯、袖、裾
  const tY = H.hipY, top = sh[1];
  const th = (def.fat ? 1.3 : (female ? 0.9 : 1.05));
  // 胴を一枚の布で包み、なだらかな着物の線にする
  P.push(part(Cy(0.19 * k * th, 0.22 * k * th, top - tY + 0.05, 20), [0, (top + tY) / 2, sh[2] * 0.45], { c: def.cloth, s: [1.15, 1, 0.85], r: [(sh[2] / (top - tY)) * 0.9, 0, 0] }));
  // 襟：首元から帯へ、左前で重なる V の字（下の白襟と、上の色襟）
  const zTop = sh[2] + 0.2 * k * th + 0.03, zBot = sh[2] * 0.2 + 0.22 * k * th * 0.85 + 0.03;
  [[1, 0xf2eee4], [-1, 0xf2eee4]].forEach(([sd, col]) => {
    P.push(limb([sd * 0.08 * k, top + 0.03 * k, zTop - 0.02], [sd * 0.004 * k, tY + 0.2 * k, zBot], 0.018 * k, { c: col }));
  });
  P.push(part(Cy(0.215 * k * (def.fat ? 1.3 : 1), 0.215 * k * (def.fat ? 1.3 : 1), 0.12 * k, 16), [0, tY + 0.14 * k, 0], { c: female ? 0xc9a227 : 0x2a2a30, metal: female ? 0.3 : 0 }));   // 帯
  if (female) P.push(part(Bx(0.28 * k, 0.16 * k, 0.1 * k), [0, tY + 0.16 * k, -0.2 * k], { c: 0xb3424a }));   // 帯の結び
  [[3, 1], [4, -1]].forEach(([pid, sd]) => {
    const s0 = [sd * 0.24 * k, sh[1] - 0.04 * k, sh[2]];
    P.push(part(Bx(0.1 * k, 0.32 * k, 0.22 * k), [sd * 0.3 * k, sh[1] - 0.3 * k, sh[2] + 0.03], { c: def.cloth, p: pid, pv: s0 }));   // 袖の袂
  });
  if (female) P.push(part(Cy(0.22 * k, 0.3 * k, 0.8 * k, 18, 1), [0, 0.45 * k, 0.01], { c: def.cloth }));        // 長い裾
  else P.push(part(Cy(0.23 * k, 0.32 * k, 0.5 * k, 16, 1), [0, 0.62 * k, 0], { c: 0x3a3a48 }));               // 袴
  if (def.apron) P.push(part(Bx(0.36 * k, 0.62 * k, 0.02), [0, tY - 0.05 * k, 0.25 * k * (def.fat ? 1.2 : 1)], { c: def.apron }));
  const geo = mergeParts(P);
  geo.setAttribute('aAnim', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 4), 4));
  return geo;
}

let _folkMat = null;
/** 町の人の材質（布の斑を控えめに） */
export function folkMaterial() {
  if (!_folkMat) _folkMat = enemyMaterial({ gait: 0, rough: 0.78, noise: 0.25 });
  return _folkMat;
}
