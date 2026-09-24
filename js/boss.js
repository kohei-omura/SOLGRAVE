/* ══════════════════════════════════════════════════════════════
   boss.js ── 階の主（三つの相）
     姿は forms.js の28体から。主ごとに攻めの型が違う：
     突進・弾・渦弾・範囲・召喚・分身・霧化・爪。
     第三相は共通：天窓を撃ち割り、光の柱で縛る。
   ══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { LORDS, buildLord, tintForm } from './forms.js';

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
    this.maxHp = Math.round(170 * (1 + (this.floor - 1) * 0.45));
    this.hp = this.maxHp;
    this.power = Math.round(120 * (1 + (this.floor - 1) * 0.3));
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
    let moves = L.moves.slice();
    if (this.phase >= 2 && L.p2 !== 'clone' && L.p2 !== 'rage') moves.push(L.p2, L.p2);
    if (d > 3.8) moves = moves.filter(m => m !== 'claw');
    if (!moves.length) moves = ['volley'];
    this._moveN++;
    return moves[(this._moveN * 7 + Math.floor(Math.random() * moves.length)) % moves.length];
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
    const fast = this.rage ? 0.6 : (this.phase === 3 ? 0.8 : 1);
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

  _end(cd) { this._act = null; this.atkCd = cd; }

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
