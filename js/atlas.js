/* ══════════════════════════════════════════════════════════════
   atlas.js ── 世界の地図
     地上（アルディア大陸）・天空界・魔界・星海（宇宙）に散らばる街。
     近い街へは歩いて、少し遠ければ馬車・船・飛空艇・星船で、
     一度訪れた遠い街へは転移陣で。地下を深く進むほど行ける街が増える。
   ══════════════════════════════════════════════════════════════ */

export const WORLDS = {
  ground: { name: '地上　アルディア大陸' },
  sky:    { name: '天空界' },
  abyss:  { name: '魔界' },
  space:  { name: '星海' }
};

/* theme：街の色と趣（town.js / world.js が使う）
   sky 空の色、fog 霞、ground 地面、plaster 壁、roof 屋根、timber 柱、style 家の形、props 飾り */
export const REGIONS = [
  { id: 'hinomori', name: '陽ノ里', world: 'ground', x: 0.30, y: 0.62, unlock: 0, bgm: 'surface',
    desc: 'はじまりの里。社と古い遺跡の縦穴がある。',
    theme: { sky: 0xa8bcd4, fog: 0.0035, ground: 0x6f7a4c, plaster: 0xe8e0cc, roof: 0x3a3a44, timber: 0x3a2a1e, style: 'wa', props: 'meadow' } },
  { id: 'luminas', name: '王都ルミナス', world: 'ground', x: 0.46, y: 0.50, unlock: 0, bgm: 'surface',
    desc: '大陸の中心、白亜の王都。冒険者ギルドの本部がある。',
    theme: { sky: 0xb0c8e8, fog: 0.003, ground: 0x7a7a6a, plaster: 0xf2eee4, roof: 0x3a5a9a, timber: 0x6a5a4a, style: 'west', props: 'city' } },
  { id: 'elvin', name: '森の都エルヴィン', world: 'ground', x: 0.30, y: 0.34, unlock: 3, bgm: 'surface',
    desc: '大樹に抱かれたエルフの都。精霊と獣人が暮らす。',
    theme: { sky: 0x98c0a8, fog: 0.006, ground: 0x4a6a3a, plaster: 0xd8d0b0, roof: 0x3a6a3a, timber: 0x5a4028, style: 'elf', props: 'forest' } },
  { id: 'aqua', name: '港町アクアポート', world: 'ground', x: 0.64, y: 0.70, unlock: 6, bgm: 'surface',
    desc: '青い屋根の港町。船が南の海へ出る。',
    theme: { sky: 0x9ad0f0, fog: 0.0028, ground: 0xc8b890, plaster: 0xf4f4f0, roof: 0x2a6ab0, timber: 0x8a7a6a, style: 'port', props: 'sea' } },
  { id: 'kagura', name: '東の都カグラ', world: 'ground', x: 0.82, y: 0.56, unlock: 10, bgm: 'surface',
    desc: '桜と朱の橋の都。姫武者と忍が守る。',
    theme: { sky: 0xe8c8d0, fog: 0.004, ground: 0x7a6a50, plaster: 0xf0e4d4, roof: 0x2a2a30, timber: 0xb3424a, style: 'wa', props: 'sakura' } },
  { id: 'frostia', name: '雪原の街フロスティア', world: 'ground', x: 0.52, y: 0.18, unlock: 14, bgm: 'surface',
    desc: '白銀の雪原の城下町。戦乙女と鍛冶の街。',
    theme: { sky: 0xb8c8dc, fog: 0.0042, ground: 0xb8c4d0, plaster: 0xd0c8bc, roof: 0xdce4ec, timber: 0x4a3a2a, style: 'snow', props: 'snow' } },
  { id: 'saharan', name: '砂漠都市サハラン', world: 'ground', x: 0.74, y: 0.30, unlock: 18, bgm: 'surface',
    desc: '砂丘に囲まれた交易都市。義賊と暗殺者の噂が絶えない。',
    theme: { sky: 0xf0d8a8, fog: 0.004, ground: 0xd8b880, plaster: 0xe8c898, roof: 0xc88a4a, timber: 0x8a5a3a, style: 'desert', props: 'desert' } },
  { id: 'celestia', name: '空中都市セレスティア', world: 'sky', x: 0.40, y: 0.40, unlock: 25, bgm: 'surface',
    desc: '雲の上に浮かぶ天使の都。飛空艇でしか辿り着けない。',
    theme: { sky: 0x9ec0ec, fog: 0.0016, ground: 0xc4ccd8, plaster: 0xeae6dc, roof: 0xd8b040, timber: 0xe8e0d0, style: 'sky', props: 'clouds' } },
  { id: 'necro', name: '魔都ネクロポリス', world: 'abyss', x: 0.60, y: 0.50, unlock: 35, bgm: 'surface',
    desc: '赤い月の下の魔族の都。転移陣でしか行けない。',
    theme: { sky: 0x3a1420, fog: 0.008, ground: 0x2a1c1c, plaster: 0x4a3a44, roof: 0x1a1018, timber: 0x6a1a24, style: 'demon', props: 'demon' } },
  { id: 'selene', name: '月面都市セレーネ', world: 'space', x: 0.35, y: 0.55, unlock: 50, bgm: 'surface',
    desc: '月の上の硝子の円蓋の街。星船が行き交う。',
    theme: { sky: 0x05070f, fog: 0.0015, ground: 0x9a9aa4, plaster: 0xe8ecf4, roof: 0x8ab0e8, timber: 0x6a7a8a, style: 'moon', props: 'stars' } },
  { id: 'astra', name: '星船都市アストラ', world: 'space', x: 0.70, y: 0.40, unlock: 70, bgm: 'surface',
    desc: '星の海を渡る巨大な船の上の都。伝説の勇者級の猛者が集う。',
    theme: { sky: 0x0a0818, fog: 0.0015, ground: 0x4a4a5a, plaster: 0xd8e0f0, roof: 0x4ad0e8, timber: 0x2a3a5a, style: 'moon', props: 'stars' } }
];
export const REGION = {};
REGIONS.forEach(r => { REGION[r.id] = r; });

/* 道：mode は walk（徒歩）・carriage（馬車）・ship（船）・airship（飛空艇）・starship（星船）。cost は陽貨 */
export const ROUTES = [
  ['hinomori', 'luminas', 'walk', 0],
  ['luminas', 'elvin', 'walk', 0],
  ['hinomori', 'elvin', 'walk', 0],
  ['luminas', 'aqua', 'carriage', 60],
  ['luminas', 'frostia', 'carriage', 120],
  ['luminas', 'saharan', 'carriage', 140],
  ['aqua', 'kagura', 'ship', 180],
  ['frostia', 'saharan', 'carriage', 100],
  ['luminas', 'celestia', 'airship', 500],
  ['celestia', 'selene', 'starship', 1200],
  ['selene', 'astra', 'starship', 800]
];
export const MODE_NAME = { walk: '徒歩', carriage: '馬車', ship: '船', airship: '飛空艇', starship: '星船', gate: '転移陣' };
export const MODE_ICON = { walk: '👣', carriage: '🐎', ship: '⛵', airship: '🎈', starship: '🚀', gate: '✦' };

/** from から to へ行く手立て（直接の道があればそれ、無ければ訪れた街どうしの転移陣） */
export function waysTo(from, to, visited) {
  const out = [];
  ROUTES.forEach(([a, b, mode, cost]) => {
    if ((a === from && b === to) || (b === from && a === to)) out.push({ mode, cost });
  });
  if (visited && visited.indexOf(to) >= 0 && visited.indexOf(from) >= 0) out.push({ mode: 'gate', cost: 100 });
  return out;
}
/** 地下の深さ（到達した最深の層）で、その街へ行けるか */
export function unlocked(r, maxFloor) { return (maxFloor || 1) >= (r.unlock || 0); }
