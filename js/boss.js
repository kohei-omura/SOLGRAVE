/* ══════════════════════════════════════════════════════════════
   boss.js ── 階の主（三つの相）
     姿は forms.js の28体から。主ごとに攻めの型が違う：
     突進・弾・渦弾・範囲・召喚・分身・霧化・爪。
     第三相は共通：天窓を撃ち割り、光の柱で縛る。
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { LORDS, buildLord, tintForm } from './forms.js';

/* 主が覚える新しい技（主ごとに組み合わせが変わる）と、第三相の大技 */
const EXTRA = ['beam', 'meteor', 'cross', 'wall', 'slam', 'serpent', 'dash3', 'rain'];
const ULTS = ['nova', 'storm'];

export class Boss {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.group = new THREE.Group();
    this.alive = false;
    this.maxHp = 340; this.hp = 340;
    this.phase = 1;
    this.p = new THREE.Vector3();
    this.r = 1.0;
    this.mist = 0;          // 霧化(無敵)
    this.stun = 0;          // 硬直
    this.atkCd = 1.6;
    this.clones = [];       // 分身
    this.hostile = null;    // 敵の弾（main から渡す）
    this.summon = null;     // 眷属を呼ぶ関数（main から渡す）
    this.lord = LORDS[0];
    this.aura = new THREE.PointLight(0xff2a2a, 2.4, 18, 2);
    this.aura.position.y = 3;
    this.group.add(this.aura);
    this._act = null;
    scene.add(this.group);
    this.group.visible = false;
    this.setFloor(1);
  }

  /** 階ごとの主。深いほど強く、姿そのものが変わる */
  setFloor(floor) {
    this.floor = Math.max(1, floor || 1);
    const L = LORDS[(this.floor - 1) % LORDS.length];
    const cycle = Math.floor((this.floor - 1) / LORDS.length);
    this.lordName = L.name + (cycle > 0 ? '・' + ['', '再臨', '真', '極'][Math.min(3, cycle)] : '');
    if (this.lord !== L || !this.form) {
      if (this.form) this.group.remove(this.form.root);
      this.lord = L;
      this.form = buildLord(L.id);
      this.group.add(this.form.root);
    }
    this.p2text = L.p2t;
    this.scaleK = 1.5 + Math.min(0.6, (this.floor - 1) * 0.012);   // 主は見上げる大きさ
    this.group.scale.setScalar(this.scaleK);
    this.hitR = (L.hitR || 1.6) * this.scaleK;
    this.hitY = (L.hitY || 1.6) * this.scaleK;
    this.r = Math.min(2.2, 0.8 + this.hitR * 0.35);
    // 以前は弱すぎたため、体力を約2.3倍・一撃を約1.3倍に。さらに主人公の攻めの強さに合わせて体力を上げ、
    // 装備を揃えても一方的にならないようにする（powerK は main から渡す）
    this.maxHp = Math.round(390 * (1 + (this.floor - 1) * 0.55) * Math.max(1, this.powerK || 1));
    this.hp = this.maxHp;
    this.power = Math.round(155 * (1 + (this.floor - 1) * 0.32));
    // 主ごとに、元の技に加えて新しい技を二つ（第二相でもう一つ、第三相で大技）
    const i0 = LORDS.indexOf(L);
    const E = EXTRA.length, o = Math.floor(i0 / E);
    this.extra = [EXTRA[(i0 + o) % E], EXTRA[(i0 + 3 + o) % E]];
    this.extra2 = EXTRA[(i0 + 6 + o) % E];
    this.ultimate = ULTS[i0 % ULTS.length];
    this.aura.color.setHex(L.aura);
    return this.lordName;
  }

  spawn(pos) {
    this.alive = true; this.hp = this.maxHp; this.phase = 1;
    this.p.copy(pos); this.mist = 0; this.stun = 0; this.atkCd = 2.2;
    this._act = null; this.rage = 0; this._moveN = 0; this._summonCd = 6;
    this.cleanup();
    this.group.visible = true;
    this.group.position.copy(this.p);
    this.group.rotation.set(0, Math.PI, 0);
  }
  despawn() { this.alive = false; this.group.visible = false; this.cleanup(); }

  /** 思念体（浄化の場に現れる巨大な影）を作る */
  makeWraith() {
    return tintForm(this.form.root, 0.55, 0.6, this.lord.aura);
  }

  /** 弾を受ける。true=有効打 */
  takeHit(dmg, isPierce) {
    if (!this.alive) return false;
    if (this.mist > 0) {
      this.mist = Math.max(0, this.mist - 0.5);   // 霧は弾で散らせる
      return false;
    }
    const mul = (this.phase === 3 && this.stun > 0 && isPierce) ? 4 : (this.stun > 0 ? 1.6 : 1);
    this.hp = Math.max(0, this.hp - dmg * mul);
    return true;
  }

  _chooseMove(d) {
    const L = this.lord;
    let moves = L.moves.slice().concat(this.extra || []);
    if (this.phase >= 2 && L.p2 !== 'clone' && L.p2 !== 'rage') moves.push(L.p2, L.p2);
    if (this.phase >= 2 && this.extra2) moves.push(this.extra2);
    if (this.phase >= 3 && this.ultimate) moves.push(this.ultimate, this.ultimate);
    if (d > 3.8) moves = moves.filter(m => m !== 'claw');
    // 同じ技を続けない
    if (moves.length > 1 && this._last) moves = moves.filter(m => m !== this._last);
    if (!moves.length) moves = ['volley'];
    this._moveN++;
    const m = moves[(this._moveN * 7 + Math.floor(Math.random() * moves.length)) % moves.length];
    this._last = m;
    return m;
  }

  update(dt, target, world, audio, onPhase) {
    if (!this.alive) return;
    const t = performance.now() / 1000;
    const L = this.lord;

    // 相の移り変わり
    const ratio = this.hp / this.maxHp;
    if (this.phase === 1 && ratio <= 0.66) { this.phase = 2; this._enterP2(); if (onPhase) onPhase(2); }
    else if (this.phase === 2 && ratio <= 0.33) { this.phase = 3; this._enterP3(); if (onPhase) onPhase(3); }

    const st = { atk: this._act ? this._act.k || 0 : 0, rage: this.rage };
    this.form.anims.forEach(f => f(t, st));

    if (this.stun > 0) {
      this.stun -= dt;
      this.form.root.rotation.z = Math.sin(t * 24) * 0.1;
      this.group.position.copy(this.p);
      return;
    }
    this.form.root.rotation.z *= 0.85;

    const dx = target.x - this.p.x, dz = target.z - this.p.z;
    const d = Math.hypot(dx, dz) || 1;
    const H = this.hostile;
    // 技の合間：以前より短く、相が進むほど詰める
    const fast = (this.rage ? 0.5 : (this.phase === 3 ? 0.6 : this.phase === 2 ? 0.72 : 0.85));
    let out = null;

    // 霧化（吸血鬼の系譜）
    if (L.moves.indexOf('mist') >= 0 && this.phase === 1) {
      this.mist = Math.max(0, this.mist - dt);
      if (this.mist <= 0 && Math.random() < dt * 0.6 && !this._act) {
        this.mist = 1.6;
        if (this.particles) this.particles.emit(this.p, 16, { color: [0.5, 0.4, 0.6], size: 3.4, up: 1.2 });
      }
    }

    const a = this._act;
    if (!a) {
      // 追う
      const sp = (this.mist > 0 ? 9.5 : 3.8) * (this.rage ? 1.4 : 1);
      if (d > 2.4) { this.p.x += (dx / d) * sp * dt; this.p.z += (dz / d) * sp * dt; }
      this.atkCd -= dt;
      if (this.atkCd <= 0) {
        const m = this._chooseMove(d);
        this._act = { m, t: 0, k: 0, n: 0, dir: new THREE.Vector3(dx / d, 0, dz / d) };
      }
      // 召喚の相は、ときどき眷属を呼ぶ
      if (this.phase >= 2 && L.p2 === 'summon') {
        this._summonCd -= dt;
        if (this._summonCd <= 0 && this.summon) { this._summonCd = 9; this.summon(this.p, 2); }
      }
    } else {
      a.t += dt;
      const from = () => new THREE.Vector3(this.p.x, 1.6 * this.scaleK, this.p.z);
      const aimDir = new THREE.Vector3(dx, 0, dz);
      const pw = this.power;
      switch (a.m) {
        case 'claw':
          a.k = Math.min(1, a.t / 0.35);
          if (a.t > 0.35 && !a.done) { a.done = true; if (d < 3.8 * this.scaleK) out = 'claw'; }
          if (a.t > 0.6) this._end(1.0 * fast);
          break;
        case 'rush':
          if (a.t < 0.65) {                         // 予兆
            a.k = a.t / 0.65; a.dir.set(dx / d, 0, dz / d);
            this.form.root.rotation.x = -0.25 * a.k;
          } else {
            this.form.root.rotation.x = 0.3;
            this.p.addScaledVector(a.dir, 17 * dt);
            if (!a.done && d < 2.4 * this.scaleK) { a.done = true; out = 'claw'; }
            if (this.particles && Math.random() < 0.6) this.particles.emit(this.p, 3, { color: [0.6, 0.2, 0.3], size: 3.2, up: 0.8 });
          }
          if (a.t > 1.15) { this.form.root.rotation.x = 0; this._end(2.0 * fast); }
          break;
        case 'volley': {
          a.k = Math.max(0, 1 - a.t * 2);
          const n = this.phase >= 2 ? 3 : 2;
          if (H && a.n < n && a.t > 0.3 + a.n * 0.35) {
            a.n++; a.k = 1;
            H.fan(from(), aimDir, 5 + this.phase, 0.2, { speed: 10 + this.floor * 0.08, power: pw * 0.7, size: 1.1 });
            if (audio) audio.sfx('hit');
          }
          if (a.t > 0.4 + n * 0.35) this._end(1.8 * fast);
          break;
        }
        case 'spiral':
          a.k = 0.6;
          if (H && a.t > a.n * 0.24 && a.n < 7) {
            a.n++;
            H.ring(from(), 8, a.n * 0.26, { speed: 7, power: pw * 0.6, size: 0.9, curve: 0.25 });
          }
          if (a.t > 2.0) this._end(2.2 * fast);
          break;
        case 'zones':
          a.k = Math.min(1, a.t * 2);
          if (H && !a.done) {
            a.done = true;
            H.zone(target.x, target.z, 3.0, 1.2, pw);
            const n = 3 + this.phase;
            for (let i = 0; i < n; i++) {
              const an = i / n * Math.PI * 2 + Math.random();
              const rr = 3.5 + Math.random() * 4;
              H.zone(target.x + Math.cos(an) * rr, target.z + Math.sin(an) * rr, 2.6, 1.3 + i * 0.12, pw);
            }
          }
          if (a.t > 1.4) this._end(2.4 * fast);
          break;
        case 'summon':
          a.k = Math.min(1, a.t * 2);
          if (!a.done && this.summon) { a.done = true; this.summon(this.p, 2 + (this.phase >= 2 ? 1 : 0)); }
          if (a.t > 1.0) this._end(3.0 * fast);
          break;
        case 'clone':
          if (!a.done) { a.done = true; this._makeClones(3); }
          if (a.t > 0.6) this._end(4.0);
          break;
        /* ── 新しい技 ── */
        case 'beam': {        // 薙ぎ払う光線：狙いの左から右へ、細かな弾を途切れなく流す
          a.k = 1;
          if (!a.base) a.base = Math.atan2(dx, dz);
          const T = 1.8, sweep = 1.3;
          if (a.t < 0.5) { a.k = a.t / 0.5; if (this.particles && Math.random() < 0.5) this.particles.emit(from(), 2, { color: [1, 0.3, 0.3], size: 2.4, up: 0.2, yOff: 0 }); }
          else if (H && a.t < 0.5 + T) {
            a.acc = (a.acc || 0) + dt;
            while (a.acc > 0.04) {
              a.acc -= 0.04;
              const u = (a.t - 0.5) / T, ang = a.base - sweep + u * sweep * 2 * (a.flip ? -1 : 1) + (a.flip ? sweep * 2 : 0);
              H.fire(from(), new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang)), { speed: 20, power: pw * 0.55, size: 0.75, life: 2.2 });
            }
          }
          if (a.t > 0.8 + T) this._end(2.2 * fast);
          break;
        }
        case 'meteor': {      // 流星：主人公の足もとを追って、次々に落ちる
          a.k = 0.8;
          const n = 5 + this.phase;
          if (H && a.n < n && a.t > a.n * 0.32) {
            a.n++;
            H.zone(target.x + (Math.random() - 0.5) * 1.5, target.z + (Math.random() - 0.5) * 1.5, 2.3, 0.85, pw * 1.1);
          }
          if (a.t > n * 0.32 + 1.0) this._end(2.4 * fast);
          break;
        }
        case 'cross': {       // 十字と斜め十字を交互に、回しながら四度
          a.k = 0.7;
          if (H && a.n < 4 && a.t > a.n * 0.4) {
            const ph = a.n * Math.PI / 8 + (a.n % 2 ? Math.PI / 4 : 0);
            a.n++;
            for (let q = 0; q < 4; q++) for (let r = 0; r < 3; r++) {
              const an = ph + q * Math.PI / 2;
              H.fire(from(), new THREE.Vector3(Math.sin(an), 0, Math.cos(an)), { speed: 8 + r * 2.5, power: pw * 0.6, size: 0.9 });
            }
            if (audio) audio.sfx('hit');
          }
          if (a.t > 2.0) this._end(2.0 * fast);
          break;
        }
        case 'wall': {        // 弾の壁：横一列に一か所だけ隙間。三枚押し寄せる
          a.k = 0.8;
          if (H && a.n < 3 && a.t > 0.3 + a.n * 0.75) {
            a.n++;
            const fwd = new THREE.Vector3(dx / d, 0, dz / d), side = new THREE.Vector3(fwd.z, 0, -fwd.x);
            const gap = Math.floor(Math.random() * 9) - 4;
            for (let i = -7; i <= 7; i++) {
              if (Math.abs(i - gap) <= 1) continue;
              const o = from().addScaledVector(side, i * 1.1).addScaledVector(fwd, -1);
              H.fire(o, fwd, { speed: 7.5, power: pw * 0.65, size: 1.0, life: 5 });
            }
          }
          if (a.t > 2.8) this._end(2.0 * fast);
          break;
        }
        case 'slam': {        // 跳びかかって叩きつけ：着地で衝撃の輪
          if (!a.to) a.to = new THREE.Vector3(target.x, 0, target.z);
          if (a.t < 0.55) { a.k = a.t / 0.55; this.form.root.position.y = Math.sin(a.t / 0.55 * Math.PI * 0.5) * 2.2; this.p.lerp(a.to, Math.min(1, dt * 3.5)); }
          else if (!a.done) {
            a.done = true; this.form.root.position.y = 0;
            if (H) { H.ring(from().setY(0.6), 22, 0, { speed: 9, power: pw * 0.8, size: 1.0 }); H.ring(from().setY(0.6), 22, 0.14, { speed: 6, power: pw * 0.8, size: 1.0 }); }
            if (d < 3.6 * this.scaleK) out = 'claw';
            if (this.particles) this.particles.emit(this.p, 30, { color: [0.8, 0.6, 0.4], size: 4, up: 2.6 });
            if (audio) audio.sfx('pile');
          }
          if (a.t > 1.2) { this.form.root.position.y = 0; this._end(2.2 * fast); }
          break;
        }
        case 'serpent': {     // 蛇行弾：左右に曲がる弾を扇に撒く
          a.k = 0.8;
          if (H && a.n < 3 && a.t > a.n * 0.45) {
            a.n++;
            for (let i = 0; i < 6; i++) {
              const an = Math.atan2(dx, dz) + (i - 2.5) * 0.3;
              H.fire(from(), new THREE.Vector3(Math.sin(an), 0, Math.cos(an)), { speed: 8, power: pw * 0.6, size: 0.85, curve: (i % 2 ? 1 : -1) * (0.9 + a.n * 0.2), life: 4 });
            }
          }
          if (a.t > 1.8) this._end(2.0 * fast);
          break;
        }
        case 'dash3': {       // 三連の突進：一度ごとに狙い直す
          const seg = 0.75, k = Math.floor(a.t / seg), u = (a.t % seg) / seg;
          if (k >= 3) { this.form.root.rotation.x = 0; this._end(2.4 * fast); break; }
          if (u < 0.35) { a.dir.set(dx / d, 0, dz / d); a.k = u / 0.35; this.form.root.rotation.x = -0.2; a.hit = false; }
          else { this.form.root.rotation.x = 0.3; this.p.addScaledVector(a.dir, 20 * dt); if (!a.hit && d < 2.4 * this.scaleK) { a.hit = true; out = 'claw'; } }
          break;
        }
        case 'rain': {        // 降りそそぐ呪い：部屋じゅうに小さな輪が次々と
          a.k = 0.6;
          if (H && a.n < 14 && a.t > a.n * 0.12) {
            a.n++;
            const an = Math.random() * Math.PI * 2, rr = Math.random() * 9;
            H.zone(target.x + Math.cos(an) * rr, target.z + Math.sin(an) * rr, 1.5, 0.9, pw * 0.8);
          }
          if (a.t > 2.6) this._end(2.2 * fast);
          break;
        }
        /* ── 第三相の大技 ── */
        case 'nova': {        // 滅びの星：溜めてから三重の輪、中心に大きな輪
          a.k = Math.min(1, a.t / 1.0);
          if (a.t < 1.0 && this.particles && Math.random() < 0.7) this.particles.emit(this.p, 3, { color: [1, 0.3, 0.4], size: 3, up: 3 });
          if (H && !a.done && a.t > 1.0) {
            a.done = true;
            for (let r = 0; r < 3; r++) H.ring(from(), 28, r * 0.11, { speed: 6 + r * 3, power: pw * 0.75, size: 1.1 });
            H.zone(this.p.x, this.p.z, 4.5, 0.2, pw * 1.3);
            if (audio) audio.sfx('phase');
          }
          if (a.t > 2.2) this._end(2.6 * fast);
          break;
        }
        case 'storm': {       // 螺旋の嵐：二重の螺旋を三秒間
          a.k = 1;
          a.acc = (a.acc || 0) + dt;
          while (H && a.acc > 0.09 && a.t < 3.0) {
            a.acc -= 0.09; a.n++;
            const an = a.n * 0.33;
            [0, Math.PI].forEach(o => H.fire(from(), new THREE.Vector3(Math.sin(an + o), 0, Math.cos(an + o)), { speed: 9, power: pw * 0.55, size: 0.85 }));
          }
          if (a.t > 3.4) this._end(2.6 * fast);
          break;
        }
        default:
          this._end(1.2);
      }
    }
    // 分身は本体の周りを巡る
    if (this.clones.length) {
      this.clones.forEach((c, i) => {
        const an = t * 1.5 + (i * Math.PI * 2 / this.clones.length);
        c.p.set(this.p.x + Math.cos(an) * 5.5, 0, this.p.z + Math.sin(an) * 5.5);
        c.mesh.position.copy(c.p);
        c.mesh.rotation.y = Math.atan2(target.x - c.p.x, target.z - c.p.z);
      });
      if (this._cloneT != null) { this._cloneT -= dt; if (this._cloneT <= 0) this.cleanup(); }
    }

    // 第三相：天窓の光の下で硬直する
    if (this.phase === 3) {
      const s = world.inShaft(this.p.x, this.p.z);
      if (s && s.isBoss) {
        this.stun = 2.6; this._act = null;
        if (audio) audio.sfx('phase');
        if (this.particles) this.particles.emit(this.p, 24, { color: [1, 0.95, 0.7], size: 3.6, up: 3 });
      }
    }

    world.resolve(this.p, this.r);
    this.group.position.copy(this.p);
    const want = Math.atan2(dx, dz);
    let diff = ((want - this.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.group.rotation.y += diff * Math.min(1, dt * 5);

    // 霧化は薄く
    const op = this.mist > 0 ? 0.35 : 1;
    if (this._op !== op) {
      this._op = op;
      this.form.mats.forEach(m => {
        if (m.userData.baseOp == null) m.userData.baseOp = m.opacity, m.userData.baseTr = m.transparent;
        m.opacity = m.userData.baseOp * op;
        m.transparent = op < 1 || m.userData.baseTr;
      });
    }
    this.aura.intensity = 2.0 + Math.sin(t * 3) * 0.4 + (this.phase - 1) * 0.8 + this.rage * 1.2;
    return out;
  }

  _end(cd) { this._act = null; this.atkCd = cd; if (this.form) this.form.root.position.y = 0; }

  _makeClones(n, permanent) {
    this.cleanup();
    for (let i = 0; i < n; i++) {
      // 本体は最も影が濃い＝暗い個体。分身は少し明るくする
      const m = tintForm(this.form.root, 1.45 + i * 0.12, null, null);
      m.scale.setScalar(this.scaleK);
      m.position.copy(this.p);
      this.scene.add(m);
      this.clones.push({ mesh: m, p: this.p.clone() });
    }
    this._cloneT = permanent ? null : 6;
  }

  _enterP2() {
    const p2 = this.lord.p2;
    if (p2 === 'clone') this._makeClones(5, true);
    if (p2 === 'rage') this.rage = 1;
    if (p2 === 'summon' && this.summon) this.summon(this.p, 3);
    this.mist = 0;
    this.atkCd = 1.2; this._act = null;
  }
  _enterP3() {
    this.cleanup();
    this.mist = 0;
  }
  cleanup() {
    this.clones.forEach(c => this.scene.remove(c.mesh));
    this.clones = [];
    this._cloneT = null;
  }
}
