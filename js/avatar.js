/* ══════════════════════════════════════════════════════════════
   avatar.js ── 外部の人物モデル（VRM／glTF）を取り込む
     ・設定画面で選んだファイルは、この端末の中（IndexedDB）にだけ保存する
       （公開サイトに置かないので、配布が禁じられたモデルでも自分の端末で使える）
     ・VRM は人型の骨を使い、歩き・腕の逆運動学・瞬き・揺れ物（髪や裾）を動かす
     ・無ければ、これまで通りコードで組んだ姿を使う
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { solveElbow } from './figure.js';

const DB = 'solgrave_models', STORE = 'models';
function db() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB, 1);
    rq.onupgradeneeded = () => { rq.result.createObjectStore(STORE); };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
function tx(mode, fn) {
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(STORE, mode), st = t.objectStore(STORE);
    const rq = fn(st);
    t.oncomplete = () => res(rq && rq.result);
    t.onerror = () => rej(t.error);
  }));
}

export const ModelStore = {
  /** 端末に保存する { buf, name, flip } */
  save(who, buf, name) { return tx('readwrite', st => st.put({ buf, name, flip: false, at: Date.now() }, who)); },
  load(who) { return tx('readonly', st => st.get(who)).catch(() => null); },
  remove(who) { return tx('readwrite', st => st.delete(who)); },
  async setFlip(who, flip) {
    const r = await this.load(who);
    if (!r) return;
    r.flip = !!flip;
    return tx('readwrite', st => st.put(r, who));
  }
};

let _libs = null;
function libs() {
  // 二体を同時に読むので、読み込みは一度だけにまとめる
  if (!_libs) _libs = Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/utils/SkeletonUtils.js'),
    import('@pixiv/three-vrm').catch(() => null)
  ]).then(([{ GLTFLoader }, SK, VRM]) => ({ GLTFLoader, SK, VRM }))
    .catch(e => { _libs = null; throw e; });
  return _libs;
}

/** 読み込んで人形を作る。height は背丈（m） */
/* 同梱の人物（作者：大村晃平。VRoid Studio で作成） */
export const BUNDLED = { hero: 'models/hero.vrm', heroine: 'models/heroine.vrm' };

export async function loadAvatar(who, height) {
  // 設定で選んだ物があればそれを、無ければ同梱のモデルを使う
  const rec = await ModelStore.load(who);
  if (rec && rec.buf) return buildRig(rec.buf, height, rec.flip, rec.name);
  if (localStorage.getItem('solgrave_nomodel_' + who) === '1') return null;   // 標準の姿を選んだ
  const url = BUNDLED[who];
  if (!url) return null;
  const r = await fetch(url);
  if (!r.ok) return null;
  return buildRig(await r.arrayBuffer(), height, false, who === 'hero' ? '陽光狩人（同梱）' : '日和（同梱）');
}

export async function buildRig(buf, height, flip, name) {
  const { GLTFLoader, SK, VRM } = await libs();
  const loader = new GLTFLoader();
  if (VRM) loader.register(p => new VRM.VRMLoaderPlugin(p));
  const gltf = await new Promise((res, rej) => loader.parse(buf, '', res, rej));
  const vrm = gltf.userData && gltf.userData.vrm;
  let root;
  if (vrm) {
    try { VRM.VRMUtils.removeUnnecessaryVertices(gltf.scene); } catch (e) {}
    try { (VRM.VRMUtils.combineSkeletons || VRM.VRMUtils.removeUnnecessaryJoints)(gltf.scene); } catch (e) {}
    VRM.VRMUtils.rotateVRM0(vrm);            // 旧形式は向きを揃える
    root = vrm.scene;
  } else {
    root = gltf.scene;
  }
  return new AvatarRig(root, vrm, gltf.animations, height, flip, SK, name);
}

/* ── 動かす仕組み ── */
export class AvatarRig {
  constructor(model, vrm, clips, height, flip, SK, name) {
    this.vrm = vrm; this.SK = SK; this.name = name || '';
    this.root = new THREE.Group();          // 足元が原点、正面 +Z
    this.holder = new THREE.Group();
    this.root.add(this.holder);
    this.holder.add(model);
    this.model = model;
    // VRM のトゥーン材質（MToon）は、場面の光に合わせて質感のある材質へ置き換える。
    // 光の数が変わっても壊れず、この作品の陰影・照り返しにもなじむ。
    const conv = new Map();
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      const swap = (m) => {
        if (!m || !(m.isMToonMaterial || m.isShaderMaterial)) return m;
        if (conv.has(m)) return conv.get(m);
        const n = new THREE.MeshStandardMaterial({
          map: m.map || null, color: (m.color && m.color.clone()) || new THREE.Color(0xffffff),
          normalMap: m.normalMap || null, emissiveMap: m.emissiveMap || null,
          emissive: (m.emissive && m.emissive.clone()) || new THREE.Color(0x000000),
          transparent: !!m.transparent, opacity: m.opacity == null ? 1 : m.opacity,
          alphaTest: m.alphaTest || 0, side: m.side, depthWrite: m.depthWrite,
          roughness: 0.72, metalness: 0
        });
        n.envMapIntensity = 0.45;
        if (n.map) n.map.colorSpace = THREE.SRGBColorSpace;
        conv.set(m, n);
        return n;
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });
    // 背丈を合わせ、足を地面に
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const h = Math.max(0.01, box.max.y - box.min.y);
    const k = height / h;
    this.holder.scale.setScalar(k);
    this.holder.position.y = -box.min.y * k;
    this.holder.rotation.y = flip ? Math.PI : 0;
    this.height = height;
    // 骨
    this.H = vrm && vrm.humanoid ? vrm.humanoid : null;
    const B = n => (this.H ? this.H.getNormalizedBoneNode(n) : null);
    this.bones = {};
    ['hips', 'spine', 'chest', 'neck', 'head', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand',
      'leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg'].forEach(n => { this.bones[n] = B(n); });
    // 骨の休みの向き（子の位置から求める。旧形式・新形式どちらでも効く）
    this.rest = {};
    const pair = [['leftUpperArm', 'leftLowerArm'], ['leftLowerArm', 'leftHand'], ['rightUpperArm', 'rightLowerArm'], ['rightLowerArm', 'rightHand']];
    pair.forEach(([a, b]) => {
      const A = this.bones[a], Bn = this.bones[b];
      if (A && Bn) {
        this.rest[a] = Bn.position.clone().normalize();
        this.len = this.len || {};
        this.len[a] = Bn.position.length();
      }
    });
    this.canIK = !!(this.bones.rightUpperArm && this.bones.rightLowerArm && this.bones.rightHand && this.rest.rightUpperArm);
    // 指の骨（握りの深さを武器ごとに変える）
    this.fingers = { left: [], right: [] };
    const F = ['Index', 'Middle', 'Ring', 'Little'], J = ['Proximal', 'Intermediate', 'Distal'];
    ['left', 'right'].forEach(side => {
      F.forEach((f, fi) => J.forEach((j, ji) => {
        const n = B(side + f + j);
        if (n) this.fingers[side].push({ n, f, ji, fi });
      }));
      ['ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal'].forEach((j, ji) => {
        const n = B(side + j);
        if (n) this.fingers[side].push({ n, f: 'Thumb', ji });
      });
      const mid = B(side + 'MiddleProximal'), hand = B(side + 'Hand');
      this.rest[side + 'Hand'] = mid ? mid.position.clone().normalize() : new THREE.Vector3(side === 'left' ? 1 : -1, 0, 0);
      this.palmLen = this.palmLen || {};
      this.palmLen[side] = mid ? mid.position.length() : 0.08;
    });
    this.grip = { left: 0.2, right: 0.2 };
    this.trigger = 0;
    // 装身具を付ける置き場（骨ごと）
    this.gear = [];
    // 骨の無い glTF は付属の動きを流す
    this.mixer = null;
    if (!vrm && clips && clips.length) {
      this.mixer = new THREE.AnimationMixer(model);
      this.mixer.clipAction(clips[0]).play();
    }
    this._blink = 2; this._blinkT = 0;
    this._q = new THREE.Quaternion(); this._v = new THREE.Vector3();
  }

  /** 骨 name を、ワールドの向き dir へ向ける */
  _aim(name, dirWorld) {
    const n = this.bones[name], rest = this.rest[name];
    if (!n || !rest) return;
    n.parent.getWorldQuaternion(this._q);
    const local = dirWorld.clone().normalize().applyQuaternion(this._q.invert());
    n.quaternion.setFromUnitVectors(rest, local);
    n.updateMatrixWorld(true);
  }

  /** 腕を手先のワールド座標へ伸ばす */
  reach(side, targetWorld, poleWorld) {
    const up = side + 'UpperArm', lo = side + 'LowerArm';
    const U = this.bones[up];
    if (!U || !this.rest[up] || !this.rest[lo]) return;
    U.parent.updateMatrixWorld(true);
    const S = U.getWorldPosition(new THREE.Vector3());
    const ws = this.holder.getWorldScale(new THREE.Vector3()).y;
    const L1 = this.len[up] * ws, L2 = this.len[lo] * ws;
    const { E, T } = solveElbow(S, targetWorld, L1, L2, poleWorld);
    this._aim(up, E.clone().sub(S));
    this._aim(lo, T.clone().sub(E));
  }

  /**
   * 手首の向き：前腕の向きに沿わせたまま、掌を palmWorld の方へ向ける。
   * 無ければ掌を体の内側へ向けて自然に垂らす。
   */
  orientHand(side, palmWorld) {
    const H = this.bones[side + 'Hand'], L = this.bones[side + 'LowerArm'];
    if (!H || !L) return;
    L.updateMatrixWorld(true);
    const hq = this.holder.getWorldQuaternion(new THREE.Quaternion());
    const r = this.rest[side + 'Hand'].clone().applyQuaternion(hq);           // 手の休みの向き（ワールド）
    const n0 = new THREE.Vector3(0, -1, 0).applyQuaternion(hq);                  // 休みの掌（下向き）
    const e = L.getWorldPosition(new THREE.Vector3());
    const h = H.getWorldPosition(new THREE.Vector3());
    const f = h.clone().sub(e).normalize();                                      // 前腕の向き
    let p = palmWorld ? palmWorld.clone() : new THREE.Vector3(side === 'left' ? -1 : 1, 0, 0).applyQuaternion(hq);
    p.sub(f.clone().multiplyScalar(p.dot(f)));
    if (p.lengthSq() < 1e-6) p = n0.clone(); p.normalize();
    const mk = (a, b) => { const c = new THREE.Vector3().crossVectors(a, b); return new THREE.Matrix4().makeBasis(a, b, c); };
    const n0o = n0.clone().sub(r.clone().multiplyScalar(n0.dot(r))).normalize();
    const Rw = mk(f, p).multiply(mk(r, n0o).transpose());                     // 休み→望みの回転
    const qW = new THREE.Quaternion().setFromRotationMatrix(Rw).multiply(hq);
    const pq = L.getWorldQuaternion(new THREE.Quaternion()).invert();
    H.quaternion.copy(pq.multiply(qW));
    H.updateMatrixWorld(true);
  }

  /** 指を曲げる */
  curl(side, amount, trigger) {
    const list = this.fingers[side];
    if (!list || !list.length) return;
    const sg = side === 'left' ? -1 : 1;
    const cur = this.grip[side] += (amount - this.grip[side]) * 0.35;
    list.forEach(({ n, f, ji, fi }) => {
      if (f === 'Thumb') {
        // 親指は掌の前へ回り込む
        n.rotation.set(0, sg * (0.25 + cur * 0.55) * (ji === 0 ? 1 : 0.5), sg * cur * (ji === 0 ? 0.2 : 0.45));
        return;
      }
      let a = cur * [1.0, 1.25, 0.9][ji] * (1 + fi * 0.06);
      if (f === 'Index' && trigger) a *= 0.45;                   // 引き金に掛けた人差し指
      n.rotation.set(0, 0, sg * a);
    });
  }

  /** 掌の中心（ワールド）。武器はここに収める */
  palm(side) {
    const H = this.bones[side + 'Hand'];
    if (!H) return null;
    const ws = this.holder.getWorldScale(new THREE.Vector3()).y;
    const hq = H.getWorldQuaternion(new THREE.Quaternion());
    const r = this.rest[side + 'Hand'].clone().applyQuaternion(hq);
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(hq);
    return H.getWorldPosition(new THREE.Vector3())
      .addScaledVector(r, this.palmLen[side] * ws * 0.75)
      .addScaledVector(down, 0.025 * ws);
  }

  /** 骨に装身具を付ける。off は骨の原点から、人形の向き（+Z 正面・+Y 上・-X 右）でのずれ */
  attach(bone, obj, off) {
    const n = this.bones[bone] || (this.H && this.H.getNormalizedBoneNode(bone));
    if (!n) return false;
    const k = this.holder.scale.x || 1;
    const flip = Math.abs(this.holder.rotation.y) > 1;
    const g = new THREE.Group();
    g.position.set((off ? off[0] : 0) / k * (flip ? -1 : 1), (off ? off[1] : 0) / k, (off ? off[2] : 0) / k * (flip ? -1 : 1));
    g.scale.setScalar(1 / k);
    if (flip) g.rotation.y = Math.PI;
    g.add(obj);
    n.add(g);
    this.gear.push({ n, g });
    return true;
  }
  clearGear() { this.gear.forEach(({ n, g }) => n.remove(g)); this.gear = []; }
  /** 骨のワールド高さ（装身具の置き場を測る） */
  boneY(name) {
    const n = this.bones[name] || (this.H && this.H.getNormalizedBoneNode(name));
    if (!n) return null;
    this.root.updateMatrixWorld(true);
    const p = n.getWorldPosition(new THREE.Vector3());
    return this.root.worldToLocal(p).y;
  }

  /** 腕を体の脇へ下ろす（ターゲットが無いとき） */
  relax(side, t) {
    const up = this.bones[side + 'UpperArm'], lo = this.bones[side + 'LowerArm'];
    if (!up) return;
    const s = side === 'left' ? 1 : -1;
    const r = this.rest[side + 'UpperArm'];
    // 休みの向きがどちら向きでも、下へ垂らす
    const down = new THREE.Vector3(r ? Math.sign(r.x) * 0.18 : 0, -1, 0.05).normalize();
    up.quaternion.setFromUnitVectors(r || new THREE.Vector3(s, 0, 0), down);
    up.rotateX(Math.sin(t * 1.6 + s) * 0.03);
    if (lo) lo.quaternion.identity();
  }

  update(dt, t, st) {
    st = st || {};
    const b = this.bones;
    if (this.H) {
      // 歩き（腿を振る）
      const w = st.moving ? Math.sin(st.walkT || t * 8) * 0.55 : 0;
      if (b.leftUpperLeg) b.leftUpperLeg.rotation.set(w, 0, 0);
      if (b.rightUpperLeg) b.rightUpperLeg.rotation.set(-w, 0, 0);
      // 膝は後ろにだけ曲がる（脚が後ろへ振れた時に曲げる）
      if (b.leftLowerLeg) b.leftLowerLeg.rotation.set(st.moving ? Math.max(0, w) * 0.9 : 0, 0, 0);
      if (b.rightLowerLeg) b.rightLowerLeg.rotation.set(st.moving ? Math.max(0, -w) * 0.9 : 0, 0, 0);
      // 息づかい
      if (b.chest) b.chest.rotation.set(Math.sin(t * 1.8) * 0.02, 0, 0);
      if (b.spine) b.spine.rotation.set(st.moving ? 0.06 : 0, 0, 0);
      this.root.updateMatrixWorld(true);
      // 腕
      const pole = (s) => new THREE.Vector3(0, -1, -0.6).applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion()))
        .add(new THREE.Vector3(s, 0, 0).applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(0.5));
      if (st.right && this.canIK) this.reach('right', st.right, pole(-1)); else this.relax('right', t);
      if (st.left && this.bones.leftUpperArm && this.rest.leftUpperArm) this.reach('left', st.left, pole(1)); else this.relax('left', t);
      // 手首：握る物に合わせて掌を向ける
      this.orientHand('right', st.palmR || null);
      this.orientHand('left', st.palmL || null);
      // 指：握りの深さ（0=開く 1=固く握る）。人差し指は引き金に掛ける
      this.curl('right', st.gripR == null ? 0.25 : st.gripR, st.trigger || 0);
      this.curl('left', st.gripL == null ? 0.25 : st.gripL, 0);
      // 瞬き
      const em = this.vrm.expressionManager;
      if (em) {
        this._blink -= dt;
        if (this._blink <= 0) { this._blinkT = 0.14; this._blink = 2.5 + Math.random() * 3; }
        let v = 0;
        if (this._blinkT > 0) { this._blinkT -= dt; v = Math.sin((1 - this._blinkT / 0.14) * Math.PI); }
        try { em.setValue('blink', v); } catch (e) {}
      }
    }
    if (this.gearAnims) this.gearAnims.forEach(f => f(t, st.moving));
    if (this.vrm) this.vrm.update(dt);        // 揺れ物（髪・裾）と表情の反映
    if (this.mixer) this.mixer.update(dt * (st.moving ? 1.3 : 1));
  }

  /** 陣中帳に映す複製（骨ごと複製する） */
  makePortrait() {
    const g = new THREE.Group();
    const c = this.SK.clone(this.holder);
    g.add(c);
    return g;
  }
}
