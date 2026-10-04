/* ══════════════════════════════════════════════════════════════
   townplan.js ── 街ごとの街並みの設計図
     家の並べ方（座標）と、広場の飾り（landmark）を街ごとに決める。
     家は [x, z, w, d]。番号の役目は town.js の HOUSE_KIND に従う
       （5＝ギルド、3＝自宅、1＝道具、2＝鍛冶、4＝宿、7＝書）。
     ギルドと自宅は、どの街でも東側に置く。
     守る決まり：広場（半径15）と縦穴への参道（|x|<9, z>6）は空ける。
   ══════════════════════════════════════════════════════════════ */

const D2R = Math.PI / 180;
const R1 = v => Math.round(v * 10) / 10;

/* 南の参道を避け、東西北にぐるりと並べる。angles は度（東0・北90） */
function arc(angles, rad, w, d, rz) {
  return angles.map((a, i) => {
    const r = typeof rad === 'function' ? rad(i) : rad;
    return [R1(r * Math.cos(a * D2R)), R1(-r * Math.sin(a * D2R) * (rz || 1)), typeof w === 'function' ? w(i) : w, typeof d === 'function' ? d(i) : d];
  });
}
const span = (a0, a1, n) => Array.from({ length: n }, (_, i) => a0 + (a1 - a0) * i / (n - 1));

/* 番号の割り当て：東にいちばん近い二軒を、ギルド(5)と自宅(3)に */
function assign(list) {
  const idx = list.map((h, i) => i);
  const score = i => -list[i][0] * 1 + Math.abs(list[i][2 - 1 + 0] * 0) + Math.abs(list[i][1]) * 0.5;   // 東ほど小さい
  const east = idx.slice().sort((a, b) => score(a) - score(b));
  const out = new Array(list.length);
  out[5] = list[east[0]]; out[3] = list[east[1]];
  const rest = idx.filter(i => i !== east[0] && i !== east[1]);
  const slots = []; for (let i = 0; i < list.length; i++) if (i !== 3 && i !== 5) slots.push(i);
  // 残りは北から西へ順に（店・宿・鍛冶・書が散らばる）
  rest.sort((a, b) => Math.atan2(-list[a][1], list[a][0]) - Math.atan2(-list[b][1], list[b][0]));
  slots.forEach((s, k) => { out[s] = list[rest[k]]; });
  return out;
}

const PLANS = {
  /* 陽ノ里：区画に整然と（これまで通り） */
  hinomori: {
    houses: [[-25, -12, 8, 7], [-25, 2, 8, 7], [-25, 16, 8, 7], [25, -12, 8, 7], [25, 2, 8, 7], [25, 16, 8, 7], [-13, -26, 9, 7], [3, -26, 9, 7], [19, -26, 8, 7], [-30, -24, 7, 6], [30, -24, 7, 6]],
    roads: 'grid', plaza: 0, lm: []
  },
  /* 王都：大きな円環の通りに、立派な家が向かい合う。中央に噴水 */
  luminas: { houses: assign(arc(span(-52, 232, 11), 29, 10, 8)), roads: 'ring', ringR: 29, plaza: 13, lm: ['fountain'], sk: 1.15 },
  /* 森の都：木々の間に点々と。中央の北に大樹 */
  elvin: { houses: assign(arc(span(-48, 228, 11), i => (i % 2 ? 31 : 24), 7, 6.2)), roads: 'wind', plaza: 9, lm: ['bigtree'], sk: 0.95 },
  /* 港町：北の海に面して一列。桟橋と帆柱 */
  aqua: {
    houses: assign([[-28, -27, 10, 7], [-14, -27, 10, 7], [0, -27, 10, 7], [14, -27, 10, 7], [28, -27, 10, 7], [-26, -8, 8, 7], [-26, 8, 8, 7], [26, -8, 8, 7], [26, 8, 8, 7], [-33, 20, 7, 6], [33, 20, 7, 6]]),
    roads: 'grid', plaza: 10, lm: ['pier'], sk: 1
  },
  /* 都カグラ：北へ伸びる大通りの両側に。朱の鳥居と桜 */
  kagura: {
    houses: assign([[-13, -18, 8, 7], [13, -18, 8, 7], [-13, -30, 8, 7], [13, -30, 8, 7], [-29, -12, 8, 7], [-29, 0, 8, 7], [-29, 12, 8, 7], [29, -12, 8, 7], [29, 0, 8, 7], [29, 12, 8, 7], [0, -35, 12, 8]]),
    roads: 'avenue', plaza: 11, lm: ['toriiN', 'sakura'], sk: 1
  },
  /* 雪原の街：焚き火を囲み、肩を寄せ合う小さな輪 */
  frostia: { houses: assign(arc(span(-50, 230, 11), 25, 7.4, 6)), roads: 'ring', ringR: 25, plaza: 9, lm: ['bonfire'], sk: 1 },
  /* 砂漠都市：露店の天幕の周りに、四角い家が肩を寄せる迷路のような街 */
  saharan: {
    houses: assign([[-27, -26, 9, 7], [-15, -26, 7, 6], [15, -26, 7, 6], [27, -26, 9, 7], [-27, -14, 8, 8], [27, -14, 8, 8], [-14, -36, 8, 6], [14, -36, 8, 6], [-30, 2, 7, 7], [30, 2, 7, 7], [0, -37, 10, 6]]),
    roads: 'grid', plaza: 12, lm: ['bazaar'], sk: 1.05
  },
  /* 空中都市：二重の弧に白い家。浮かぶ水晶 */
  celestia: { houses: assign(arc(span(-48, 228, 11), i => (i % 2 ? 33 : 24.5), 8, 7)), roads: 'ring', ringR: 28.5, plaza: 12, lm: ['crystal'], sk: 1.05 },
  /* 魔都：石畳の大通りに黒い家が連なる。奥に尖塔 */
  necro: {
    houses: assign([[-14, -19, 8, 7], [14, -19, 8, 7], [-14, -31, 8, 7], [14, -31, 8, 7], [-24, -8, 8, 7], [24, -8, 8, 7], [-24, 6, 8, 7], [24, 6, 8, 7], [-30, -22, 7, 6], [30, -22, 7, 6], [0, -38, 9, 6]]),
    roads: 'avenue', plaza: 10, lm: ['spire', 'brazier'], sk: 1.05
  },
  /* 月面都市：円蓋が環をなす。中央に着陸の輪 */
  selene: { houses: assign(arc(span(-50, 230, 11), 28, 8, 7)), roads: 'ring', ringR: 28, plaza: 11, lm: ['pad'], sk: 1 },
  /* 星船都市：甲板の左右に、長い舷が並ぶ。中央に帆柱の灯 */
  astra: {
    houses: assign([[-26, -24, 8, 6], [-26, -10, 8, 6], [-26, 4, 8, 6], [-26, 18, 8, 6], [26, -24, 8, 6], [26, -10, 8, 6], [26, 4, 8, 6], [26, 18, 8, 6], [-12, -31, 9, 6], [0, -31, 9, 6], [12, -31, 9, 6]]),
    roads: 'grid', plaza: 10, lm: ['beacon', 'rails'], sk: 1
  }
};

export function planOf(id) { return PLANS[id] || PLANS.hinomori; }
export const PLAN_IDS = Object.keys(PLANS);

/** 設計の自己点検：重なり・広場・参道。問題の一覧を返す（空なら良し） */
export function checkPlan(id) {
  const P = planOf(id), bad = [], H = P.houses;
  if (H.length !== 11) bad.push('家の数 ' + H.length);
  H.forEach((a, i) => {
    const [x, z, w, d] = a;
    if (Math.abs(x) < 9 + w / 2 && z + d / 2 > 6 && z - d / 2 < 100) bad.push(i + ' 参道');
    const nx = Math.max(Math.abs(x) - w / 2, 0), nz = Math.max(Math.abs(z + 2) - d / 2, 0);   // 広場の中心(0,-2)から家までの近さ
    if (Math.hypot(nx, nz) < 14.5) bad.push(i + ' 広場に近い ' + R1(Math.hypot(nx, nz)));
    if (Math.hypot(x, z) > 40) bad.push(i + ' 遠い');
    H.forEach((b, j) => { if (j > i && Math.abs(x - b[0]) < (w + b[2]) / 2 + 1.2 && Math.abs(z - b[1]) < (d + b[3]) / 2 + 1.2) bad.push(i + '×' + j + ' 重なり'); });
  });
  if (!(H[5] && H[5][0] >= 18)) bad.push('ギルドが東でない');
  if (!(H[3] && H[3][0] >= 18)) bad.push('自宅が東でない');
  return bad;
}
