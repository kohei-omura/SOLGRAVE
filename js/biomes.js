/* ══════════════════════════════════════════════════════════════
   biomes.js ── 地下の趣（10階ごとに切り替わる）
     墓地／森林／王宮／寒冷地／火山／草原／天空都市／深淵／砂の墓所／虚空
     床・壁・天井の素材、置物、霧と灯りの色、調べ、出る敵を決める。
   ══════════════════════════════════════════════════════════════ */
import { EnemyKind as K } from './enemy.js';

export const BIOMES = [
  { id: 'grave', name: '墓地', sub: '朽ちた墓標の地下墓所',
    floor: 0x6a6860, wall: 0x7b7f88, ceil: 0x4a4c54, rough: 0.9,
    fog: 0x1d2531, fogD: 0.013, sky: 0xa8bcd8, ground: 0x5a5348, torch: 0x9affc0, bgm: 'grave',
    roster: [K.WALKER, K.RUNNER, K.SHIELD, K.BAT, K.SKELETON, K.GHOST],
    elites: ['deathknight', 'skelwarrior', 'wraith'] },
  { id: 'forest', name: '森林', sub: '陽を忘れた地底の森',
    floor: 0x3a4a2a, wall: 0x4a3a2a, ceil: 0x1a2a14, rough: 0.95,
    fog: 0x14241a, fogD: 0.016, sky: 0x9ad0a0, ground: 0x2a3a1a, torch: 0xc8ff8a, bgm: 'forest',
    roster: [K.WOLF, K.TREANT, K.BAT, K.WISP, K.WALKER, K.RUNNER],
    elites: ['ghoul', 'wraith', 'zombie'] },
  { id: 'palace', name: '王宮', sub: '滅びた吸血の王宮',
    floor: 0x6a2a30, wall: 0xb8b0a0, ceil: 0x3a2a30, rough: 0.35, metal: 0.2,
    fog: 0x2a1a20, fogD: 0.011, sky: 0xffd8c0, ground: 0x5a3a30, torch: 0xffc070, bgm: 'palace',
    roster: [K.KNIGHT, K.GARGOYLE, K.GHOST, K.SKELETON, K.SHIELD, K.BAT],
    elites: ['deathknight', 'spectre', 'poltergeist'] },
  { id: 'frost', name: '寒冷地', sub: '凍てついた氷の回廊',
    floor: 0xc8d8e8, wall: 0x9ab8d0, ceil: 0x6a88a0, rough: 0.2, metal: 0.1,
    fog: 0x8aa8c8, fogD: 0.018, sky: 0xd8f0ff, ground: 0x8aa0b8, torch: 0x8ad0ff, bgm: 'frost',
    roster: [K.FROST, K.YETI, K.SKELETON, K.GHOST, K.WOLF, K.BAT],
    elites: ['draugr', 'spectre', 'skelwarrior'] },
  { id: 'volcano', name: '火山', sub: '溶岩の流れる灼熱の坑',
    floor: 0x2a1c18, wall: 0x3a2a24, ceil: 0x1a1210, rough: 0.9,
    fog: 0x3a1408, fogD: 0.014, sky: 0xff9a60, ground: 0x6a2a10, torch: 0xff6a20, bgm: 'volcano',
    roster: [K.MAGMA, K.IMP, K.SKELETON, K.RUNNER, K.GARGOYLE, K.WISP],
    elites: ['skelwarrior', 'deathknight', 'ghoul'] },
  { id: 'grass', name: '草原', sub: '月の照らす地底の野',
    floor: 0x4a6a3a, wall: 0x6a6a5a, ceil: 0x0e1430, rough: 0.95,
    fog: 0x1a2440, fogD: 0.010, sky: 0xb0c8ff, ground: 0x3a5a2a, torch: 0xffe08a, bgm: 'grass',
    roster: [K.SCARECROW, K.WOLF, K.HARPY, K.MUMMY, K.KYONSHI, K.WALKER],
    elites: ['kyonshi', 'zombie', 'ghoul'] },
  { id: 'sky', name: '天空都市', sub: '星の海に浮かぶ白亜の都',
    floor: 0xe8e4d8, wall: 0xf0ece0, ceil: 0x0a1030, rough: 0.3, metal: 0.15,
    fog: 0x2a3a6a, fogD: 0.009, sky: 0xe0e8ff, ground: 0x8a8aa0, torch: 0xd0e0ff, bgm: 'sky',
    roster: [K.HARPY, K.GARGOYLE, K.GHOST, K.KNIGHT, K.BANSHEE, K.WISP],
    elites: ['spectre', 'poltergeist', 'deathknight'] },
  { id: 'abyss', name: '深淵', sub: '名状しがたきものの寝所',
    floor: 0x2a1a30, wall: 0x3a2040, ceil: 0x140a1a, rough: 0.5, metal: 0.2,
    fog: 0x1a0a24, fogD: 0.017, sky: 0xc08aff, ground: 0x2a0a30, torch: 0xd06aff, bgm: 'abyss',
    roster: [K.BANSHEE, K.MUMMY, K.GHOST, K.WISP, K.SHIELD, K.GARGOYLE],
    elites: ['poltergeist', 'wraith', 'spectre'] },
  { id: 'desert', name: '砂の墓所', sub: '王たちが眠る砂の底',
    floor: 0xc8a870, wall: 0xb89a68, ceil: 0x6a5a3a, rough: 0.95,
    fog: 0x5a4020, fogD: 0.013, sky: 0xffe0a0, ground: 0x8a6a3a, torch: 0xffb040, bgm: 'desert',
    roster: [K.MUMMY, K.SCARECROW, K.SKELETON, K.IMP, K.KYONSHI, K.RUNNER],
    elites: ['mummy', 'skelwarrior', 'kyonshi'] },
  { id: 'void', name: '虚空', sub: '夜が生まれる場所',
    floor: 0x1a1a24, wall: 0x2a2a3a, ceil: 0x05050a, rough: 0.25, metal: 0.4,
    fog: 0x0a0a14, fogD: 0.015, sky: 0xff8a8a, ground: 0x1a0a14, torch: 0xff4a6a, bgm: 'void',
    roster: [K.BANSHEE, K.KNIGHT, K.YETI, K.MAGMA, K.HARPY, K.GHOST, K.FROST, K.TREANT],
    elites: ['deathknight', 'wraith', 'draugr', 'poltergeist', 'mummy'] }
];

export function biomeOf(floor) {
  const band = Math.floor((Math.max(1, floor) - 1) / 10);
  return BIOMES[band % BIOMES.length];
}
