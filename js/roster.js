/* ══════════════════════════════════════════════════════════════
   roster.js ── 仲間になる者たち
     女性21人・男性9人（おおよそ7対3）。全員が成人（18歳以上）。
     base：土台の体（hero＝男／heroine＝女）。tint：髪・瞳・衣の色。
     人ごとの模型（VRoid）を設定から入れると、その人はその模型で現れる。
     town：出会える街。rank：ギルドで仲間にできる冒険者の等級。
     role：fighter（戦う）／healer（癒す）。job：職（使える武器が決まる）。
     likes：喜ぶ贈り物。romance：恋仲になれるか。
   ══════════════════════════════════════════════════════════════ */

const F = 'f', M = 'm';

export const CHARACTERS = [
  // ── はじまりの二人 ──
  { id: 'sun', name: '陽光狩人', short: '陽', g: M, age: 21, base: 'hero', title: '陽を継ぐ狩人', job: 'hunter', role: 'fighter',
    town: 'hinomori', rank: 'D', start: true, weapon: 'w0', voice: 'hero',
    bias: { ATK: 1.15, DEX: 1.1, AGI: 1.05, MATK: 0.85, MP: 0.8 },
    intro: '陽の力を継いだ最後の狩人。闇に沈んだ地上に陽を取り戻すため、地下へ潜る。' },
  { id: 'hiyori', name: '日和', short: '日', g: F, age: 19, base: 'heroine', title: '陽ノ里の巫女', job: 'caster', role: 'healer',
    town: 'hinomori', rank: 'D', start: true, weapon: 'mw0', voice: 'miko', romance: true, likes: ['花束', '甘味'],
    bias: { MATK: 1.25, MP: 1.3, MDEF: 1.15, ATK: 0.7, DEF: 0.85 },
    intro: '陽ノ里の社を守る巫女。穏やかだが芯が強く、祓いの力で仲間を支える。' },

  // ── 王都ルミナス ──
  { id: 'seraphina', name: 'セラフィナ', short: 'セ', g: F, age: 20, base: 'heroine', title: '白銀の聖騎士', job: 'guard', role: 'fighter',
    town: 'luminas', rank: 'C', romance: true, likes: ['剣帯', '甘味'], weapon: 'xsword0',
    tint: { hair: 0xe8ecf4, eye: 0x4a8ad8, top: 0xf0f2f8, accent: 0x3a5ab0, bottom: 0x2a3a6a, shoes: 0x8a8e98 },
    bias: { DEF: 1.3, HP: 1.2, ATK: 1.1, AGI: 0.85 }, voice: 'v_knightess',
    intro: '王家に仕える聖騎士団の副長。生真面目で、困っている者を放っておけない。' },
  { id: 'olivia', name: 'オリヴィア', short: 'オ', g: F, age: 20, base: 'heroine', title: '薔薇の王女', job: 'blade', role: 'fighter',
    town: 'luminas', rank: 'B', romance: true, likes: ['宝石', '花束'], weapon: 'xsword0',
    tint: { hair: 0xf0b8a0, eye: 0x6a4ab0, top: 0xf8e0ea, accent: 0xd84a7a, bottom: 0xb03060, shoes: 0xe8d0a0 },
    bias: { ATK: 1.1, AGI: 1.15, LUK: 1.2, DEF: 0.9 }, voice: 'v_princess',
    intro: 'ルミナスの第二王女。城を抜け出しては冒険者の真似事をしている。細剣の腕は本物。' },
  { id: 'sophia', name: 'ソフィア', short: 'ソ', g: F, age: 24, base: 'heroine', title: '王立学院の賢者', job: 'caster', role: 'fighter',
    town: 'luminas', rank: 'C', romance: true, likes: ['古書', '紅茶'], weapon: 'xtome0',
    tint: { hair: 0x6a4028, eye: 0x3a8a5a, top: 0x3a4a6a, accent: 0xc9a227, bottom: 0x2a2a3a, shoes: 0x3a2a1a },
    bias: { MATK: 1.35, MP: 1.25, ATK: 0.7, HP: 0.9 }, voice: 'v_scholar',
    intro: '王立学院で最年少の教授になった魔導学者。眼鏡の奥で好奇心が光る。' },
  { id: 'leon', name: 'レオン', short: 'レ', g: M, age: 20, base: 'hero', title: '聖剣の勇者', job: 'blade', role: 'fighter',
    town: 'luminas', rank: 'A', weapon: 'xsword1',
    tint: { hair: 0xe8c860, eye: 0x3a7ad8, top: 0xe8e8f0, accent: 0x2a4a9a, bottom: 0x3a3a50, shoes: 0x6a5030 },
    bias: { ATK: 1.2, HP: 1.15, DEF: 1.1, MATK: 1.0 }, voice: 'v_brave',
    intro: '聖剣に選ばれた若き勇者。まっすぐで、誰とでもすぐ打ち解ける。' },

  // ── 森の都エルヴィン ──
  { id: 'mireille', name: 'ミレイユ', short: 'ミ', g: F, age: 120, looks: 20, base: 'heroine', title: '森の射手（エルフ）', job: 'hunter', role: 'fighter',
    town: 'elvin', rank: 'D', romance: true, likes: ['木の実', '花束'], weapon: 'xbow0',
    tint: { hair: 0xb8e0a0, eye: 0x3aa06a, top: 0x5a8a4a, accent: 0xd8c890, bottom: 0x3a5a2a, shoes: 0x5a4028 },
    bias: { DEX: 1.3, AGI: 1.2, ATK: 1.05, DEF: 0.8 }, voice: 'v_elf',
    intro: '森の都を守るエルフの射手。長く生きているが、人の街のことは何も知らない。' },
  { id: 'nagi', name: 'ナギ', short: 'ナ', g: F, age: 19, base: 'heroine', title: '風の精霊術師', job: 'caster', role: 'fighter',
    town: 'elvin', rank: 'C', romance: true, likes: ['風鈴', '甘味'], weapon: 'xstaff0',
    tint: { hair: 0x9ae8d0, eye: 0x4ac0c0, top: 0xe8f8f4, accent: 0x5ad0b0, bottom: 0x3a8a8a, shoes: 0xd8e8e0 },
    bias: { MATK: 1.3, AGI: 1.2, MP: 1.1, DEF: 0.8 }, voice: 'v_airy',
    intro: '風の精霊と話せる娘。気ままで、ふらりと現れてはふらりと消える。' },
  { id: 'tia', name: 'ティア', short: 'テ', g: F, age: 18, base: 'heroine', title: '猫の獣人の拳士', job: 'swift', role: 'fighter',
    town: 'elvin', rank: 'D', romance: true, likes: ['干し魚', '甘味'], weapon: 'xclaw0',
    tint: { hair: 0xf09a3a, eye: 0xd8b020, top: 0xf8e8d0, accent: 0xe06a2a, bottom: 0x3a2a2a, shoes: 0x6a4028 },
    bias: { AGI: 1.35, ATK: 1.1, CRI: 1.2, MATK: 0.7 }, voice: 'v_cat',
    intro: '人懐っこい猫の獣人。食べることと昼寝が好きで、拳は驚くほど速い。' },

  // ── 港町アクアポート ──
  { id: 'marina', name: 'マリナ', short: 'マ', g: F, age: 20, base: 'heroine', title: '人魚の歌姫', job: 'caster', role: 'healer',
    town: 'aqua', rank: 'C', romance: true, likes: ['真珠', '花束'], weapon: 'mw1',
    tint: { hair: 0x5ad0e0, eye: 0x2a8ad8, top: 0xe0f8ff, accent: 0x3ab0d0, bottom: 0x2a6aa0, shoes: 0xd8e8f0 },
    bias: { MATK: 1.25, MP: 1.3, LUK: 1.2, ATK: 0.7 }, voice: 'v_singer',
    intro: '港の酒場で歌う人魚の娘。その歌声は傷を癒すと噂される。' },
  { id: 'chloe', name: 'クロエ', short: 'ク', g: F, age: 21, base: 'heroine', title: '蒼の銃士', job: 'hunter', role: 'fighter',
    town: 'aqua', rank: 'C', romance: true, likes: ['火薬', '紅茶'], weapon: 'w1',
    tint: { hair: 0x2a3a6a, eye: 0x8ab0e8, top: 0x2a3a5a, accent: 0xc9a227, bottom: 0x1a1a2a, shoes: 0x2a1a14 },
    bias: { DEX: 1.3, CRI: 1.2, ATK: 1.1, HP: 0.9 }, voice: 'v_cool',
    intro: '港を守る海軍の銃士。無口で冷静。実は甘い物に目がない。' },
  { id: 'kai', name: 'カイ', short: 'カ', g: M, age: 22, base: 'hero', title: '蒼の槍士', job: 'guard', role: 'fighter',
    town: 'aqua', rank: 'C', weapon: 'xspear0',
    tint: { hair: 0x3a6ad0, eye: 0x6ad0f0, top: 0x2a4a7a, accent: 0xe8e8f0, bottom: 0x1a2a3a, shoes: 0x3a2a1a },
    bias: { ATK: 1.15, DEF: 1.15, HP: 1.1, AGI: 1.0 }, voice: 'v_calm',
    intro: '海の民の槍使い。寡黙だが仲間思い。' },

  // ── 東の都カグラ ──
  { id: 'kaguya', name: 'カグヤ', short: 'カ', g: F, age: 22, base: 'heroine', title: '月下の姫武者', job: 'blade', role: 'fighter',
    town: 'kagura', rank: 'B', romance: true, likes: ['簪', '和菓子'], weapon: 'xninjato0',
    tint: { hair: 0x14101a, eye: 0xb03a4a, top: 0xf0e8f0, accent: 0x8a2a5a, bottom: 0x3a1a3a, shoes: 0x2a1a14 },
    bias: { ATK: 1.25, AGI: 1.15, CRI: 1.15, MATK: 0.8 }, voice: 'v_noble',
    intro: '東の都を治める家の姫。月夜に刀を振るう姿は、見る者を惹きつける。' },
  { id: 'rin', name: 'リン', short: 'リ', g: F, age: 19, base: 'heroine', title: '影の忍', job: 'swift', role: 'fighter',
    town: 'kagura', rank: 'C', romance: true, likes: ['団子', '手裏剣'], weapon: 'xshuriken0',
    tint: { hair: 0x4a2a6a, eye: 0x9a6ad8, top: 0x2a2030, accent: 0xb3424a, bottom: 0x1a1420, shoes: 0x1a1414 },
    bias: { AGI: 1.35, CRI: 1.25, DEX: 1.1, DEF: 0.8 }, voice: 'v_quiet',
    intro: 'カグヤに仕える忍。任務には忠実だが、褒められると照れる。' },
  { id: 'yuu', name: 'ユウ', short: 'ユ', g: M, age: 18, base: 'hero', title: '異界から来た剣士', job: 'blade', role: 'fighter',
    town: 'hinomori', rank: 'D', weapon: 'xsword0',
    tint: { hair: 0x1a1a24, eye: 0x4a3a2a, top: 0x1a1a2a, accent: 0xe8e8f0, bottom: 0x2a2a3a, shoes: 0x1a1a1a },
    bias: { ATK: 1.1, AGI: 1.1, LUK: 1.3, DEF: 0.95 }, voice: 'v_boy',
    intro: '気がつけばこの世界にいたという少年。前の世界の知識で、ときどき皆を驚かせる。' },

  // ── 雪原の街フロスティア ──
  { id: 'yuki', name: 'ユキ', short: 'ユ', g: F, age: 20, base: 'heroine', title: '雪女の末裔', job: 'caster', role: 'fighter',
    town: 'frostia', rank: 'B', romance: true, likes: ['氷菓子', '白い花'], weapon: 'xtome0',
    tint: { hair: 0xf0f8ff, eye: 0x8ad8ff, top: 0xe8f4ff, accent: 0x8ab0e8, bottom: 0xa8c8f0, shoes: 0xe8f0f8 },
    bias: { MATK: 1.35, MDEF: 1.2, MP: 1.15, HP: 0.85 }, voice: 'v_snow',
    intro: '雪山に住む雪女の血を引く娘。人の温もりに触れるのは、あなたが初めて。' },
  { id: 'freya', name: 'フレイヤ', short: 'フ', g: F, age: 22, base: 'heroine', title: '戦乙女', job: 'guard', role: 'fighter',
    town: 'frostia', rank: 'A', romance: true, likes: ['蜂蜜酒', '剣帯'], weapon: 'xaxe0',
    tint: { hair: 0xf0c050, eye: 0x4a9ad8, top: 0xd8dce8, accent: 0xb3424a, bottom: 0x5a3a2a, shoes: 0x6a4a2a },
    bias: { ATK: 1.3, HP: 1.25, DEF: 1.1, MATK: 0.8 }, voice: 'v_valkyrie',
    intro: '北の地の戦乙女。豪快に笑い、豪快に戦う。酒の席では誰にも負けない。' },
  { id: 'gald', name: 'ガルド', short: 'ガ', g: M, age: 45, base: 'hero', title: '老練の鍛冶戦士', job: 'guard', role: 'fighter',
    town: 'frostia', rank: 'C', weapon: 'xmace0',
    tint: { hair: 0x9a9aa0, eye: 0x6a5a4a, top: 0x5a4030, accent: 0x8a8e98, bottom: 0x3a3028, shoes: 0x2a2018 },
    bias: { DEF: 1.35, HP: 1.3, ATK: 1.15, AGI: 0.8 }, voice: 'v_old',
    intro: '北の鍛冶場を仕切る親方。若い頃は名の知れた戦士だった。' },

  // ── 砂漠都市サハラン ──
  { id: 'ciel', name: 'シエル', short: 'シ', g: F, age: 19, base: 'heroine', title: '砂の盗賊', job: 'swift', role: 'fighter',
    town: 'saharan', rank: 'C', romance: true, likes: ['金貨', '甘味'], weapon: 'xdagger0',
    tint: { hair: 0x3ab0a0, eye: 0xe8b030, top: 0xf0e0c0, accent: 0xd88a3a, bottom: 0x6a4a2a, shoes: 0x8a6a3a },
    bias: { AGI: 1.3, LUK: 1.3, CRI: 1.15, DEF: 0.8 }, voice: 'v_rogue',
    intro: '砂漠の義賊。口は悪いが、盗んだ物は貧しい者に配っている。' },
  { id: 'shin', name: 'シン', short: 'シ', g: M, age: 21, base: 'hero', title: '銀の暗殺者', job: 'swift', role: 'fighter',
    town: 'saharan', rank: 'B', weapon: 'xkatar0',
    tint: { hair: 0xd8dce4, eye: 0xb03a3a, top: 0x1a1a22, accent: 0x6a6a7a, bottom: 0x14141a, shoes: 0x14141a },
    bias: { AGI: 1.3, CRI: 1.3, ATK: 1.1, HP: 0.85 }, voice: 'v_cold',
    intro: '砂の国の暗殺者ギルドを抜けた男。影から仲間を守る。' },

  // ── 天空界：空中都市セレスティア ──
  { id: 'iris', name: 'アイリス', short: 'ア', g: F, age: 21, base: 'heroine', title: '地上に降りた天使', job: 'caster', role: 'healer',
    town: 'celestia', rank: 'B', romance: true, likes: ['白い花', '甘味'], weapon: 'mw2',
    tint: { hair: 0xfff0c0, eye: 0xe8c040, top: 0xfffaf0, accent: 0xffd24a, bottom: 0xf0e8d8, shoes: 0xfff8e8 },
    bias: { MATK: 1.3, MP: 1.3, MDEF: 1.25, ATK: 0.7 }, voice: 'v_angel',
    intro: '天空界から地上を見守ってきた天使。地上の暮らしに興味津々。' },
  { id: 'luna', name: 'ルナ', short: 'ル', g: F, age: 21, base: 'heroine', title: '月の巫女', job: 'caster', role: 'healer',
    town: 'celestia', rank: 'A', romance: true, likes: ['月見団子', '宝石'], weapon: 'mw3',
    tint: { hair: 0xd8c8f8, eye: 0x8a6ad8, top: 0xf0ecff, accent: 0x6a5ab0, bottom: 0x3a2a6a, shoes: 0xe8e0f8 },
    bias: { MATK: 1.35, MP: 1.35, LUK: 1.2, ATK: 0.7 }, voice: 'v_moon',
    intro: '月の神に仕える巫女。日和とは遠い昔に縁があったらしい。' },
  { id: 'alto', name: 'アルト', short: 'ア', g: M, age: 23, base: 'hero', title: '風の吟遊詩人', job: 'caster', role: 'fighter',
    town: 'celestia', rank: 'C', weapon: 'xlute0',
    tint: { hair: 0x8a5a3a, eye: 0x5aa06a, top: 0x3a6a4a, accent: 0xe8d090, bottom: 0x3a3028, shoes: 0x5a4028 },
    bias: { MATK: 1.2, LUK: 1.3, AGI: 1.1, DEF: 0.85 }, voice: 'v_bard',
    intro: '空を渡り歩く吟遊詩人。どこへ行っても、なぜか顔が利く。' },

  // ── 魔界：魔都ネクロポリス ──
  { id: 'beatrice', name: 'ベアトリス', short: 'ベ', g: F, age: 500, looks: 20, base: 'heroine', title: '吸血鬼の姫', job: 'swift', role: 'fighter',
    town: 'necro', rank: 'A', romance: true, likes: ['紅茶', '薔薇'], weapon: 'xwhip0',
    tint: { hair: 0x1a0a14, eye: 0xe02a3a, top: 0x1a1018, accent: 0xb01a2a, bottom: 0x2a0a14, shoes: 0x1a0a0a },
    bias: { AGI: 1.25, MATK: 1.2, CRI: 1.2, HP: 1.0 }, voice: 'v_vamp',
    intro: '魔都を治める吸血鬼の姫。退屈しのぎに、陽を追う人間を見に来た。' },
  { id: 'val', name: 'ヴァル', short: 'ヴ', g: M, age: 24, base: 'hero', title: '黒の魔導士', job: 'caster', role: 'fighter',
    town: 'necro', rank: 'B', weapon: 'xstaff1',
    tint: { hair: 0x2a1a3a, eye: 0xa04ae0, top: 0x1a1426, accent: 0x6a3aaa, bottom: 0x14101a, shoes: 0x14101a },
    bias: { MATK: 1.4, MP: 1.2, ATK: 0.7, DEF: 0.85 }, voice: 'v_dark',
    intro: '魔界で禁術を修めた魔導士。皮肉屋だが、約束は必ず守る。' },
  { id: 'sieg', name: 'ジーク', short: 'ジ', g: M, age: 25, base: 'hero', title: '竜人の戦士', job: 'guard', role: 'fighter',
    town: 'necro', rank: 'B', weapon: 'xaxe1',
    tint: { hair: 0xc03a2a, eye: 0xe8a020, top: 0x5a2a1a, accent: 0xd8a040, bottom: 0x3a1a14, shoes: 0x2a1410 },
    bias: { ATK: 1.3, HP: 1.3, DEF: 1.2, AGI: 0.85 }, voice: 'v_dragon',
    intro: '竜の血を引く戦士。力比べが好きで、負けると素直に笑う。' },

  // ── 星海：月面都市セレーネ／星船都市アストラ ──
  { id: 'noel', name: 'ノエル', short: 'ノ', g: F, age: 20, base: 'heroine', title: '星の修道女', job: 'caster', role: 'healer',
    town: 'selene', rank: 'S', romance: true, likes: ['星砂', '甘味'], weapon: 'mw3',
    tint: { hair: 0xf8e8b0, eye: 0x5a8ae8, top: 0xf8f8ff, accent: 0x2a3a8a, bottom: 0x1a1a4a, shoes: 0xe8e8f8 },
    bias: { MATK: 1.3, MP: 1.35, MDEF: 1.3, ATK: 0.7 }, voice: 'v_nun',
    intro: '月面の修道院で星に祈る修道女。星々の声を聞くことができる。' },
  { id: 'eris', name: 'エリス', short: 'エ', g: F, age: 23, base: 'heroine', title: '紅の竜騎士', job: 'guard', role: 'fighter',
    town: 'selene', rank: 'S', romance: true, likes: ['剣帯', '肉料理'], weapon: 'xspear1',
    tint: { hair: 0xd02a3a, eye: 0xe8b040, top: 0x3a1a1a, accent: 0xd8a040, bottom: 0x2a1414, shoes: 0x3a2a1a },
    bias: { ATK: 1.25, DEF: 1.2, HP: 1.2, AGI: 1.05 }, voice: 'v_dragoon',
    intro: '星竜を駆る竜騎士。凛とした佇まいで、戦場では誰よりも前に立つ。' },
  { id: 'stella', name: 'ステラ', short: 'ス', g: F, age: 19, base: 'heroine', title: '星船の機巧技師', job: 'hunter', role: 'fighter',
    town: 'astra', rank: 'SS', romance: true, likes: ['歯車', '甘味'], weapon: 'w2',
    tint: { hair: 0xff8ab0, eye: 0x4ad0e8, top: 0xe8f0f8, accent: 0x4ad0e8, bottom: 0x3a4a6a, shoes: 0xd8e0e8 },
    bias: { DEX: 1.35, MATK: 1.1, LUK: 1.2, HP: 0.9 }, voice: 'v_genki',
    intro: '星船都市の天才技師。自作の銃と機巧で戦う。好きなことになると止まらない。' },
  { id: 'alicia', name: 'アリシア', short: 'ア', g: F, age: 18, base: 'heroine', title: '星の剣姫', job: 'blade', role: 'fighter',
    town: 'astra', rank: 'SSS', romance: true, likes: ['花束', '宝石'], weapon: 'xsword1',
    tint: { hair: 0xf8e060, eye: 0x3a9ad8, top: 0xf8f4ff, accent: 0x6a8ae8, bottom: 0x2a2a5a, shoes: 0xe8e0f8 },
    bias: { ATK: 1.3, AGI: 1.25, CRI: 1.2, LUK: 1.15 }, voice: 'v_princess',
    intro: '星の海の果てから来た剣姫。伝説の勇者を探している。' },
  { id: 'ardo', name: 'アルドール', short: 'ア', g: M, age: 30, base: 'hero', title: '星海の守護者', job: 'guard', role: 'fighter',
    town: 'astra', rank: 'SSS', weapon: 'xmace1',
    tint: { hair: 0xe8e8f0, eye: 0x4ad0e8, top: 0x2a3a5a, accent: 0xc9a227, bottom: 0x1a2030, shoes: 0x2a2a3a },
    bias: { DEF: 1.4, HP: 1.35, MDEF: 1.2, AGI: 0.85 }, voice: 'v_guardian',
    intro: '星船都市の守護者。千年の時を戦い抜いた、伝説級の騎士。' }
];

export const CHAR = {};
CHARACTERS.forEach(c => { CHAR[c.id] = c; });
export function charOf(id) { return CHAR[id] || CHAR.sun; }

/* ── 冒険者の等級 ── */
export const RANKS = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'LEGEND'];
export const RANK_NAME = { D: 'D', C: 'C', B: 'B', A: 'A', S: 'S', SS: 'SS', SSS: 'SSS', LEGEND: '伝説の勇者級' };
export const RANK_PTS = { D: 0, C: 120, B: 360, A: 800, S: 1600, SS: 3000, SSS: 5200, LEGEND: 9000 };
export function rankIndex(r) { return Math.max(0, RANKS.indexOf(r)); }
/** 武器の等級ごとに、使うために要る冒険者の等級 */
export const RANK_FOR_RARE = ['D', 'D', 'C', 'B', 'A', 'S'];
