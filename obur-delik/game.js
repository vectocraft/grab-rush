// Hungry Hole — Hole.io-like: steer a hole through a themed map, swallow whatever fits, grow, and out-eat the
// rival holes before the clock runs out. Bigger holes swallow smaller ones (and you).
// Seven maps (each its own Kenney 3D prop set and ground), three modes: Classic (level progression),
// Battle (no respawns, last hole standing) and Solo (no rivals, eat as much of the map as you can).
(() => {
  'use strict';

  const G = Save.game('delik', {
    gold: 150, level: 1, best: 0, fails: 0, skin: 'mavi', skins: ['mavi'], adSkin: 0, upgrades: { size: 0, speed: 0, time: 0 },
    map: 'auto', mode: 'classic', solo: {}, battleWins: 0, maps: [], diff: 'normal',
  });
  // Hole rims, bought with the shared stars (or ads). Keys are kept from the first release (saves).
  const SKINS = {
    mavi: { name: L('Ocean', 'Okyanus'), color: '#3b82f6', cost: 0, rarity: 'common' },
    yesil: { name: L('Lime', 'Yeşil'), color: '#22c55e', cost: 50, rarity: 'common' },
    kral: { name: L('Royal Gold', 'Kraliyet Altını'), fx: 'gold', color: 'radial-gradient(circle at 35% 30%,#fff3b0,#ffcf3f 50%,#9a6a00)', rim: '#ffcf3f', pack: true, rarity: 'legendary' },
    mor: { name: L('Grape', 'Mor'), color: '#a855f7', cost: 90, rarity: 'common' },
    altin: { name: L('Golden', 'Altın'), color: '#fbbf24', ads: 2, rarity: 'rare' },
    turuncu: { name: L('Tangerine', 'Turuncu'), color: '#f97316', cost: 180, rarity: 'rare' },
    pembe: { name: L('Bubblegum', 'Pembe'), color: '#ec4899', cost: 350, rarity: 'rare' },
    beyaz: { name: L('Frost', 'Buz'), color: '#e0f2fe', cost: 700, rarity: 'epic' },
    lava: { name: L('Lava', 'Lav'), fx: 'lava', color: 'radial-gradient(circle at 35% 30%,#ffe07a,#ff5a1f 55%,#8a1500)', rim: '#ff5a1f', cost: 800, rarity: 'epic' },
    neon: { name: L('Neon Pulse', 'Neon'), fx: 'neon', color: 'radial-gradient(circle at 35% 30%,#b9fbff,#22d3ee 50%,#0e3a8a)', rim: '#22d3ee', cost: 1000, rarity: 'epic' },
    rainbow: { name: L('Rainbow', 'Gökkuşağı'), fx: 'rainbow', color: 'conic-gradient(#ff4d4d,#ffb84d,#fff04d,#4dff88,#4dd2ff,#9b6bff,#ff4dd8,#ff4d4d)', rim: '#ff4d4d', cost: 1300, rarity: 'legendary' },
    galaxy: { name: L('Galaxy', 'Galaksi'), fx: 'galaxy', color: 'radial-gradient(circle at 30% 30%,#fff 0 2px,transparent 3px),radial-gradient(circle at 70% 60%,#fff 0 1.5px,transparent 2.5px),radial-gradient(circle,#9b6bff,#2a1170 70%)', rim: '#9b6bff', cost: 1600, rarity: 'legendary' },
  };
  // Skin tab / pack: the hole itself in that skin (Hole3D.thumb), the plain ball without WebGL.
  const skinArt = (k, s) => { const u = R3 && R3.thumb && R3.thumb(s.rim || s.color, s.fx); return u ? '<img class="cthumb" src="' + u + '" alt="">' : '<span class="ball" style="background:' + s.color + '"></span>'; };
  let startBigAd = false;
  const UPG = {
    size: { icon: '⭕', name: L('Starting Size', 'Başlangıç Boyu'), max: 10, val: l => L('+' + 10 * l + '% size', '+%' + 10 * l + ' boy') },
    speed: { icon: '👟', name: L('Speed', 'Hız'), max: 10, val: l => L('+' + 4 * l + '% speed', '+%' + 4 * l + ' hız') },
    time: { icon: '⏱️', name: L('Time', 'Süre'), max: 10, val: l => (90 + 4 * l) + L(' s', ' sn') },
  };
  // Starting size: the upgrade (+10%/level) and the rewarded "start big" (+70%) stack.
  const startMul = () => (1 + 0.1 * G.upgrades.size) * (startBigAd ? 1.7 : 1);
  const upgCost = k => Math.round(100 * Math.pow(1.6, G.upgrades[k]));
  const upgDesc = k => { const u = UPG[k], l = G.upgrades[k]; return l >= u.max ? u.val(l) : u.val(l) + ' → ' + u.val(l + 1); };
  const ease = () => Math.min(0.3, 0.1 * (G.fails || 0));

  // ---------- Maps ----------
  // Every map fills the same roles (sizes below) with its own 3D models (obur-delik/models.js, Kenney CC0).
  // ground: 'city' (asphalt, lane dashes, crosswalks) · 'paths' (dirt paths) · 'beach' (boardwalks, sea) · 'table' (picnic cloth)
  // drive: models that drive along the roads (none: more walkers instead).
  const PEOPLE = ['man_a', 'man_b', 'man_c', 'man_d', 'man_e', 'man_f', 'woman_b', 'woman_c', 'woman_d', 'woman_e', 'woman_f'];
  const CARS = ['car_sedan', 'car_taxi', 'car_police', 'car_van', 'car_suv', 'car_hatch', 'car_sport', 'car_lux', 'car_truck'];
  const SUBURB = ['sub_a', 'sub_c', 'sub_d', 'sub_e', 'sub_f', 'sub_h', 'sub_k', 'sub_m', 'sub_o', 'sub_r', 'sub_u'];
  const MAPS = [
    { id: 'city', name: L('Downtown', 'Şehir Merkezi'), icon: '🏙️', ground: 'city', sky: '#bfe6ff', edge: '#79c35f', walk: '#d9d4c7', park: '#8fd16a', lawn: '#a7d98a', pave: '#cfc9bb', road: '#5d6470', line: '#f5f5f5',
      roles: { cone: ['car_cone'], hydrant: ['car_box'], bin: ['trash'], person: PEOPLE, bench: ['park_bench', 'bench'], lamp: ['lantern'], bush: ['planter', 'flowers'], tree: ['tree_round', 'tree_tall'],
        car: CARS, kiosk: ['stall_drinks', 'stall_food', 'stall_info'], bus: ['car_delivery', 'car_garbage', 'car_fire', 'car_ambulance'],
        house: ['com_a', 'com_b', 'com_c', 'com_d', 'com_h'], building: ['com_i', 'com_j', 'com_k', 'com_l', 'com_n', 'com_f', 'com_g'], tower: ['sky_a', 'sky_b', 'sky_c', 'sky_d', 'sky_e'] },
      drive: { car: CARS, bus: ['car_delivery', 'car_garbage', 'car_fire', 'car_ambulance'] } },
    { id: 'suburb', name: L('Sunny Suburbs', 'Güneşli Banliyö'), icon: '🏡', ground: 'city', sky: '#c4ecff', edge: '#6dbb55', walk: '#e2dccb', park: '#86cc62', lawn: '#9bd67a', pave: '#d8d1bf', road: '#686f7a', line: '#ffffff',
      roofs: ['#e05a47', '#4f7bd9', '#3fae6a', '#8a5a3c', '#7a5bd0', '#e0a43a'],
      roles: { cone: ['car_cone'], hydrant: ['pet_chick'], bin: ['trash', 'pet_bunny'], person: PEOPLE.concat(['pet_dog', 'pet_cat']), bench: ['bench'], lamp: ['lantern'], bush: ['planter', 'flowers'], tree: ['tree_tall', 'tree_small', 'tree_round'],
        car: CARS, kiosk: ['stall_food', 'stall_drinks'], bus: ['car_delivery', 'car_garbage'],
        house: SUBURB, building: ['sub_n', 'sub_t', 'sub_d'], tower: ['water_tower', 'factory_m'] },
      drive: { car: CARS, bus: ['car_delivery', 'car_garbage'] } },
    { id: 'food', name: L('Snack Land', 'Atıştırma Diyarı'), icon: '🍩', ground: 'table', sky: '#ffe3ef', edge: '#ffcadb', walk: '#ffffff', park: '#fff6e8', lawn: '#fff1f6', pave: '#f7f3ff', road: '#ef5a6f', line: '#ffffff',
      roles: { cone: ['f_cherries', 'f_strawberry'], hydrant: ['f_cookie', 'f_lolly'], bin: ['f_donut', 'f_apple'], person: ['f_banana', 'f_carrot', 'gingerbread'], bench: ['f_hotdog', 'f_taco'],
        lamp: ['f_fries', 'f_soda'], bush: ['f_cupcake', 'f_croissant'], tree: ['f_icecream', 'f_pineapple', 'f_sundae'], car: ['f_burger', 'f_sandwich', 'f_mug'],
        kiosk: ['f_watermelon', 'f_cheese', 'f_waffle'], bus: ['f_pizza', 'f_pan'], house: ['f_cake', 'f_turkey', 'f_ham'], building: ['f_cake', 'f_burger', 'f_watermelon'], tower: ['f_cake', 'f_sundae', 'f_icecream'] },
      drive: null },
    { id: 'beach', name: L('Pirate Cove', 'Korsan Koyu'), icon: '🏴‍☠️', ground: 'beach', sky: '#aee8ff', edge: '#2fb3e0', walk: '#f1dfae', park: '#e9d49a', lawn: '#cfe59a', pave: '#ecd9a4', road: '#c99a5b', line: '#a8783f',
      roles: { cone: ['pir_ball', 'pir_bottle'], hydrant: ['grass_plant'], bin: ['pir_barrel'], person: PEOPLE.concat(['pet_crab', 'pet_parrot']), bench: ['pir_crate', 'pir_crate2'], lamp: ['pir_flag'],
        bush: ['rock_sand_a', 'grass_plant'], tree: ['palm', 'palm_bend', 'palm_big'], car: ['boat_s', 'pir_cannon', 'pir_chest'], kiosk: ['hut', 'boat_l'], bus: ['rock_sand_b', 'hut'],
        house: ['pir_tower_s', 'ship_s'], building: ['ship_p', 'ship_l', 'pir_gate'], tower: ['pir_tower_l', 'ship_pl'] },
      drive: null },
    { id: 'farm', name: L('Wild Farm', 'Vahşi Çiftlik'), icon: '🐮', ground: 'paths', sky: '#cdeeff', edge: '#5fae4a', walk: '#7cbf57', park: '#8fd16a', lawn: '#a4d86f', pave: '#b9d880', road: '#b48a5a', line: '#000',
      roles: { cone: ['pet_chick', 'mushrooms'], hydrant: ['crop_pumpkin', 'crop_melon'], bin: ['pet_bunny', 'stump'], person: ['pet_pig', 'pet_dog', 'pet_cat', 'pet_fox', 'man_a', 'woman_c'], bench: ['fence', 'logs', 'hay'],
        lamp: ['corn'], bush: ['rock_big', 'flowers'], tree: ['tree_round', 'tree_round_l', 'tree_tall'], car: ['pet_cow', 'pet_deer', 'pet_hog', 'car_tractor'], kiosk: ['tent', 'container_a', 'container_c'],
        bus: ['pet_elephant', 'pet_giraffe', 'car_digger'], house: ['barn_a', 'barn_b', 'barn_c', 'barn_d'], building: ['tank', 'windmill', 'factory_d'], tower: ['silo', 'water_tower'] },
      drive: { car: ['car_tractor'], bus: ['car_digger'] } },
    { id: 'winter', name: L('Snowy Village', 'Karlı Köy'), icon: '⛄', ground: 'city', sky: '#dce9f5', edge: '#f4f8fb', walk: '#e6edf2', park: '#f0f5f8', lawn: '#e8f0f5', pave: '#d3dce4', road: '#7a8593', line: '#ffffff',
      roofs: ['#f4f8ff', '#e8eef8', '#c93a3a', '#f4f8ff'],
      roles: { cone: ['candy_cane'], hydrant: ['gift_b'], bin: ['gift_a', 'gift_c'], person: ['gingerbread', 'nutcracker', 'pet_penguin', 'man_c', 'woman_e', 'man_e'], bench: ['bench', 'sled'], lamp: ['lantern'],
        bush: ['snow_pile', 'snow_rocks'], tree: ['tree_snow_a', 'tree_snow_b'], car: ['reindeer', 'sled', 'pet_polar', 'car_suv'], kiosk: ['snowman', 'snowman_hat'], bus: ['train_loco', 'train_wagon'],
        house: SUBURB, building: ['sub_n', 'sub_t'], tower: ['xmas_tree'] },
      drive: { car: ['car_suv', 'car_van'], bus: ['train_loco'] } },
    { id: 'spooky', name: L('Haunted Hills', 'Perili Tepeler'), icon: '🎃', ground: 'paths', night: true, sky: '#141338', edge: '#1d3328', walk: '#2b4a3e', park: '#24453a', lawn: '#2b4a3e', pave: '#33503f', road: '#3d3446', line: '#000',
      roles: { cone: ['candles'], hydrant: ['urn'], bin: ['pumpkin', 'pumpkin_carved'], person: ['ghost', 'skeleton', 'zombie', 'vampire', 'keeper'], bench: ['grave_round', 'grave_cross', 'grave_bevel', 'grave_deco', 'grave_bench'],
        lamp: ['post_single', 'post_double'], bush: ['hay', 'fire_basket', 'rocks_tall'], tree: ['pine', 'pine_crooked', 'pine_fall'], car: ['coffin', 'altar', 'pumpkin_tall'], kiosk: ['crypt_s', 'obelisk'],
        bus: ['crypt'], house: ['crypt_l', 'barn_c'], building: ['pir_tower_s', 'pir_gate'], tower: ['pir_tower_l'] },
      drive: null },
    // Premium maps (bought with stars): denser blocks, composite landmarks (scripts/hole-composites.js).
    { id: 'funpark', name: L('Fun Park', 'Lunapark'), icon: '🎢', stars: 300, dense: 1.5, ground: 'city', sky: '#ffe6f6', edge: '#7fd36a', walk: '#ffd9a0', park: '#9be27a', lawn: '#b6ec8e', pave: '#ffe6b8', road: '#8b7cf6', line: '#ffffff',
      roles: { cone: ['flowers', 'f_lolly'], hydrant: ['trash', 'f_soda'], bin: ['f_icecream', 'f_cupcake'], person: PEOPLE, bench: ['park_bench', 'bench'], lamp: ['fp_drop', 'lantern'],
        bush: ['planter', 'flowers'], tree: ['tree_round', 'tree_round_l'], car: ['fp_train', 'coaster_car'], kiosk: ['stall_food', 'stall_drinks', 'stall_info', 'stall_wc', 'ride'],
        bus: ['park_gate', 'fp_train'], house: ['fp_coaster_s', 'fp_coaster_s', 'stall_food'], building: ['fp_coaster_w', 'park_gate'], tower: ['fp_coaster_l'] },
      drive: { car: ['fp_train'], bus: ['fp_train'] } },
    { id: 'castle', name: L('Castle Kingdom', 'Kale Krallığı'), icon: '🏰', stars: 500, dense: 1.5, ground: 'paths', sky: '#cfe8ff', edge: '#5aa648', walk: '#8cc865', park: '#7fc35a', lawn: '#97d16e', pave: '#c9b58a', road: '#a88a5c', line: '#000',
      roles: { cone: ['ck_rocks_s', 'mushrooms'], hydrant: ['ck_trunk', 'pir_barrel'], bin: ['hay', 'ck_log'], person: PEOPLE.concat(['pet_dog', 'pet_chick']), bench: ['ck_log', 'fence', 'ck_stairs'],
        lamp: ['ck_banner', 'ck_flag'], bush: ['ck_rocks', 'flowers'], tree: ['ck_tree_l', 'ck_tree_s', 'pine'], car: ['ck_catapult', 'ck_ballista', 'ck_ram'], kiosk: ['ck_trebuchet', 'ck_tent', 'tent'],
        bus: ['ck_siege', 'ck_trebuchet'], house: ['ck_house', 'ck_hall', 'ck_tent'], building: ['ck_gatehouse', 'ck_hall'], tower: ['ck_castle'] },
      drive: { car: ['ck_ram', 'ck_catapult'], bus: ['ck_siege'] } },
  ];
  // 4x maps: districts that borrow other maps' props and block colours, plus raised decks with things on top.
  const roleOf = id => MAPS.find(m => m.id === id).roles;
  const INDUSTRY = { cone: ['car_cone'], hydrant: ['car_box'], bin: ['trash'], person: PEOPLE, bench: ['logs', 'fence'], lamp: ['lantern'], bush: ['planter', 'rock_big'], tree: ['tree_tall'],
    car: ['car_truck', 'car_van', 'car_delivery'], kiosk: ['container_a', 'container_b', 'container_c'], bus: ['car_digger', 'car_garbage'], house: ['factory_a', 'factory_b', 'factory_d'],
    building: ['factory_m', 'factory_n', 'tank'], tower: ['water_tower', 'silo'] };
  MAPS.push(
    { id: 'megacity', name: L('Mega City', 'Mega Şehir'), icon: '🌆', stars: 800, big: 2, ground: 'city', sky: '#bfe2ff', edge: '#6fbf5a', walk: '#d9d4c7', park: '#8fd16a', lawn: '#a7d98a', pave: '#cfc9bb', road: '#555c68', line: '#f5f5f5',
      roles: roleOf('city'), drive: { car: CARS, bus: ['car_delivery', 'car_garbage', 'car_fire', 'car_ambulance'] }, deck: { color: '#8a94a6', trim: '#ffd23f' },
      zones: [{ roles: roleOf('city') }, { roles: roleOf('suburb'), lawn: '#9bd67a' }, { roles: INDUSTRY, pave: '#b9b2a2', park: '#9aa58a', lawn: '#a8ad98' }, { roles: roleOf('funpark'), pave: '#ffe6b8', park: '#9be27a', lawn: '#b6ec8e' }],
      zoneOf: (d, q) => (d < 0.35 ? 0 : d < 0.7 ? (q % 2 ? 1 : 0) : q === 0 ? 3 : q === 3 ? 2 : 1) },
    { id: 'fantasy', name: L('Fairy Realm', 'Masal Diyarı'), icon: '🧚', stars: 1000, big: 2, ground: 'paths', sky: '#d4ecff', edge: '#5aa648', walk: '#8cc865', park: '#7fc35a', lawn: '#97d16e', pave: '#c9b58a', road: '#a88a5c', line: '#000',
      roles: roleOf('castle'), drive: { car: ['ck_ram', 'ck_catapult', 'car_tractor'], bus: ['ck_siege'] }, deck: { color: '#9a6a3a', trim: '#ffe07a' },
      zones: [{ roles: roleOf('castle') }, { roles: roleOf('farm') }, { roles: roleOf('spooky'), pave: '#5a6a5a', park: '#3f5a48', lawn: '#4a6a52' }, { roles: roleOf('beach'), pave: '#ecd9a4', park: '#e9d49a', lawn: '#cfe59a' }],
      zoneOf: (d, q) => (d < 0.4 ? 0 : q === 1 ? 2 : q === 2 ? 3 : 1) },
  );
  const BASE_MAPS = MAPS.filter(m => !m.stars);
  // Rival difficulty (menu): speed and cleverness of the rival holes; harder pays more.
  const DIFF = {
    easy: { name: L('Easy', 'Kolay'), spd: 0.86, smart: 0.6, bots: -1, pay: 0.7 },
    normal: { name: L('Normal', 'Normal'), spd: 1, smart: 1, bots: 0, pay: 1 },
    hard: { name: L('Hard', 'Zor'), spd: 1.1, smart: 1.3, bots: 1, pay: 1.4 },
    master: { name: L('Master', 'Usta'), spd: 1.2, smart: 1.6, bots: 2, pay: 1.8 },
  };
  const diff = () => DIFF[G.diff] || DIFF.normal;
  BASE_MAPS.forEach((m, i) => { m.lv = i + 1; }); // map i unlocks at level i+1 (the level that first visits it)
  const mapById = id => MAPS.find(m => m.id === id) || MAPS[0];
  const unlocked = m => (m.stars ? (G.maps || []).includes(m.id) : G.level >= m.lv);
  // The map of a classic level: the player's pick, otherwise the levels walk through the free maps.
  const mapFor = lv => (G.map !== 'auto' && unlocked(mapById(G.map)) ? mapById(G.map) : BASE_MAPS[(lv - 1) % BASE_MAPS.length]);
  const MODES = {
    classic: { icon: '🏆', name: L('Classic', 'Klasik'), lv: 1, desc: L('Be the biggest when time runs out', 'Süre bitince en büyük sen ol') },
    battle: { icon: '⚔️', name: L('Battle', 'Savaş'), lv: 3, desc: L('No respawns: last hole standing wins', 'Yeniden doğma yok: son kalan delik kazanır') },
    solo: { icon: '🎯', name: 'Solo', lv: 2, desc: L('No rivals: eat as much of the map as you can', 'Rakip yok: haritanın olabildiğince çoğunu ye') },
  };

  // s: footprint radius (fits into a hole of radius > s/0.92), h: height. Value = s².
  const TYPES = {
    cone: { s: 3, h: 6 }, hydrant: { s: 3, h: 7 }, bin: { s: 4, h: 8 }, person: { s: 4, h: 14 }, bench: { s: 6, h: 6 },
    lamp: { s: 4, h: 28 }, bush: { s: 7, h: 9 }, tree: { s: 9, h: 30 }, car: { s: 11, h: 11 }, kiosk: { s: 15, h: 18 },
    bus: { s: 20, h: 18 }, house: { s: 26, h: 32 }, building: { s: 38, h: 80 }, tower: { s: 52, h: 140 },
  };
  // 2D fallback colours per role.
  const COL2D = { cone: '#ff7a1a', hydrant: '#e53935', bin: '#3a8a4a', person: '#3b82f6', bench: '#8a5a2b', lamp: '#4a5160', bush: '#3f9e4a', tree: '#2f7a3a', car: '#ef4444', kiosk: '#f59e0b', bus: '#ffc83d', house: '#e8a87c', building: '#9ec5e8', tower: '#9fb4c8' };
  const BOT_NAMES = L('Gobbler Vortex Vacuum Twister Abyss Pit Tunnel Muncher Chomp Crater', 'Obur Girdap Vakum Hortum Kuyu Çukur Tünel Mide Hapır Krater').split(' ');
  const BOT_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4'];
  const P = 210, ROAD = 40, CELL = 60, K = 0.55, EAT = 0.92, EAT_HOLE = 1.12; // a hole eats another 12% smaller (by size, not score)
  const POWERS = { mag: { icon: '🧲', name: L('Magnet', 'Mıknatıs'), t: 8, c: '#ff4d6d' }, spd: { icon: '⚡', name: L('Speed', 'Hız'), t: 6, c: '#ffd23f' }, ice: { icon: '❄️', name: L('Freeze', 'Dondur'), t: 3.5, c: '#7dd3fc' } };

  // ---------- Canvas ----------
  const $ = id => document.getElementById(id);
  const cvs = $('c'), ctx = cvs.getContext('2d');
  const FONT = "'Baloo', system-ui, sans-serif";
  const SHOT = /[?&]shot/.test((typeof location !== 'undefined' && location.search) || ''); // key-art capture
  // 3D renderer when WebGL is available; otherwise (old devices, tests) the 2D renderer below is used.
  const R3 = window.Delik3D ? window.Delik3D.init($('c3d')) : null;
  if (!R3 && $('c3d') && $('c3d').style) $('c3d').style.display = 'none';
  let dpr = 1;
  function resize() {
    dpr = Math.min(R3 ? 1.5 : 2, window.devicePixelRatio || 1);
    cvs.width = Math.round(innerWidth * dpr); cvs.height = Math.round(innerHeight * dpr);
    if (R3) R3.fit();
  }
  addEventListener('resize', resize);
  resize(); setTimeout(resize, 400);
  if (document.fonts && document.fonts.load) document.fonts.load("800 14px 'Baloo'").catch(() => { });

  function rng(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pick = (r, a) => a[Math.floor(r() * a.length)];

  let S = null;
  let mode = 'menu', paused = false, pendingReward = 0, pendingStars = 0, menuTab = 'up';
  const skin = () => SKINS[G.skin] || SKINS.mavi;
  const skinColor = () => skin().rim || skin().color;
  const curMode = () => (MODES[G.mode] && G.level >= MODES[G.mode].lv ? G.mode : 'classic');

  // ---------- Level ----------
  let R = null; // level rng (placement)
  function put(type, x, y, rot, model) {
    const map = S.map, list = (S.zoneRoles && S.zoneRoles[type]) || map.roles[type];
    const m = model || (list ? pick(R, list) : '');
    const o = { type, s: TYPES[type].s, h: TYPES[type].h, x, y, rot: rot || 0, state: 0, ft: 0, m, c: COL2D[type] };
    if (map.roofs && (type === 'house' || type === 'building')) o.tint = pick(R, map.roofs);
    S.objs.push(o);
    return o;
  }
  // Scatter n objects of a type inside a block without overlapping what is already there.
  function scatter(r, cx, cy, half, n, type, taken) {
    const s = TYPES[type].s;
    n = Math.round(n * (S.map.dense || 1)); // premium maps are packed with more detail
    for (let k = 0, tries = 0; k < n && tries < n * 12; tries++) {
      const x = cx + (r() * 2 - 1) * (half - s), y = cy + (r() * 2 - 1) * (half - s);
      if (taken.some(t => Math.hypot(t.x - x, t.y - y) < t.s + s + 3)) continue;
      taken.push(put(type, x, y, r() * 6.28));
      k++;
    }
  }
  function genCity(r) {
    const { n, lv, map } = S, half = (P - ROAD) / 2;
    const yaw = () => Math.floor(r() * 4) * Math.PI / 2;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const cx = (i + 0.5) * P, cy = (j + 0.5) * P, roll = r();
      const center = i === Math.floor(n / 2) && j === Math.floor(n / 2);
      let kind = center ? 'plaza' : (lv >= 2 || S.solo) && roll < 0.26 ? 'downtown' : roll < 0.52 ? 'houses' : roll < 0.8 ? 'park' : 'plaza';
      const zd = Math.max(Math.abs(i + 0.5 - n / 2), Math.abs(j + 0.5 - n / 2)) / (n / 2), zq = (i < n / 2 ? 0 : 1) + (j < n / 2 ? 0 : 2);
      const zone = map.zones ? map.zones[map.zoneOf(zd, zq)] : null;
      S.zoneRoles = zone ? zone.roles : null;
      if (map.deck && !center && kind !== 'downtown' && r() < 0.22) kind = 'deck';
      S.blocks.push({ i, j, kind, col: zone && (kind === 'park' ? zone.park : kind === 'houses' ? zone.lawn : zone.pave) });
      const taken = [];
      if (kind === 'downtown') {
        if ((lv >= 3 || S.solo) && r() < 0.35) taken.push(put('tower', cx, cy, yaw()));
        else for (const [dx, dy] of [[-40, -40], [40, -40], [-40, 40], [40, 40]]) if (r() < 0.85) taken.push(put('building', cx + dx, cy + dy, yaw()));
        scatter(r, cx, cy, half, 3, 'person', taken);
        scatter(r, cx, cy, half, 2, 'bin', taken);
      } else if (kind === 'houses') {
        // Houses face the street on their side of the block.
        for (const [dx, dy] of [[-42, -42], [42, -42], [-42, 42], [42, 42]]) if (r() < 0.9) taken.push(put('house', cx + dx, cy + dy, dy < 0 ? Math.PI : 0));
        scatter(r, cx, cy, half, 3, 'tree', taken);
        scatter(r, cx, cy, half, 3, 'bush', taken);
        scatter(r, cx, cy, half, 1, 'car', taken);
      } else if (kind === 'park') {
        if (r() < 0.4) taken.push(put('kiosk', cx, cy, yaw()));
        scatter(r, cx, cy, half, 7, 'tree', taken);
        scatter(r, cx, cy, half, 4, 'bush', taken);
        scatter(r, cx, cy, half, 3, 'bench', taken);
        scatter(r, cx, cy, half, 2, 'lamp', taken);
        scatter(r, cx, cy, half, 3, 'person', taken);
      } else if (kind === 'deck') {
        // A raised deck: low things underneath, a load of bigger things on top that drop when a hole waits below.
        const dk = { x: cx, y: cy, r: 52, h: 26, t: 0, items: [] };
        S.decks.push(dk);
        scatter(r, cx, cy, half, 4, 'bench', taken); scatter(r, cx, cy, half, 3, 'bin', taken); scatter(r, cx, cy, half, 5, 'person', taken);
        const top = [];
        for (const t of ['car', 'car', 'kiosk', 'bench', 'person', 'person', 'bin', 'bush', 'car']) {
          const s = TYPES[t].s;
          for (let tries = 0; tries < 12; tries++) {
            const a = r() * Math.PI * 2, d = r() * (dk.r - s - 6), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
            if (top.some(o => Math.hypot(o.x - x, o.y - y) < o.s + s + 2)) continue;
            const o = put(t, x, y, r() * 6.28); o.alt = dk.h + 3; o.deck = dk; dk.items.push(o); top.push(o); break;
          }
        }
      } else {
        scatter(r, cx, cy, half, 2, 'kiosk', taken);
        if (r() < 0.5) scatter(r, cx, cy, half, 1, 'bus', taken);
        scatter(r, cx, cy, half, 3, 'bench', taken);
        scatter(r, cx, cy, half, 4, 'lamp', taken);
        scatter(r, cx, cy, half, 2, 'bin', taken);
        scatter(r, cx, cy, half, 3, 'cone', taken);
        scatter(r, cx, cy, half, 1, 'hydrant', taken);
        scatter(r, cx, cy, half, 7, 'person', taken);
      }
      // Walkers stroll around their block (more of them on maps without traffic).
      for (const o of taken) if (o.type === 'person' && r() < (map.drive ? 0.6 : 0.85) * (map.big ? 0.4 : 1)) { o.mv = 'walk'; o.hx = cx; o.hy = cy; o.wx = o.x; o.wy = o.y; }
    }
    S.zoneRoles = null;
    // Streets: parked cars, cones, hydrants; some vehicles drive around the grid.
    for (let k = 0; k <= n; k++) for (let i = 0; i < n; i++) for (const axis of [0, 1]) {
      const a = k * P, b0 = i * P + ROAD / 2 + 14, b1 = (i + 1) * P - ROAD / 2 - 14;
      const xy = (along, side) => (axis ? [a + side, along] : [along, a + side]);
      const rot = axis ? 0 : Math.PI / 2;
      if (k > 0 && k < n && r() < 0.7) { const [x, y] = xy(b0 + r() * (b1 - b0), r() < 0.5 ? -12 : 12); put('car', x, y, rot + (r() < 0.5 ? Math.PI : 0)); }
      if (r() < 0.25) { const [x, y] = xy(b0 + r() * (b1 - b0), r() < 0.5 ? -4 : 4); put('cone', x, y, r() * 6.28); }
      if (r() < 0.35) { const [x, y] = xy(b0 + r() * 20, r() < 0.5 ? -24 : 24); put('hydrant', x, y, r() * 6.28); }
    }
    if (map.drive) for (let k = 0; k < n + 2; k++) {
      const axis = k % 2, line = (1 + Math.floor(r() * (n - 1))) * P, dir = r() < 0.5 ? -1 : 1, lane = dir * 10 * (axis ? 1 : -1);
      const along = r() * n * P, x = axis ? line + lane : along, y = axis ? along : line + lane;
      const big = r() < 0.15, o = put(big ? 'bus' : 'car', x, y, axis ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2), pick(r, big ? map.drive.bus : map.drive.car));
      o.mv = 'drive'; o.axis = axis; o.dir = dir; o.v = 26 + r() * 16;
    }
  }
  function buildGrid() {
    S.gw = Math.ceil(S.M / CELL) + 1;
    S.grid = Array.from({ length: S.gw * S.gw }, () => []);
    for (const o of S.objs) if (o.mv) S.movers.push(o); else { o.cell = cellOf(o.x, o.y); S.grid[o.cell].push(o); }
  }
  const cellOf = (x, y) => clamp(Math.floor(y / CELL), 0, S.gw - 1) * S.gw + clamp(Math.floor(x / CELL), 0, S.gw - 1);
  function forCells(x, y, rad, fn) {
    const x0 = clamp(Math.floor((x - rad) / CELL), 0, S.gw - 1), x1 = clamp(Math.floor((x + rad) / CELL), 0, S.gw - 1);
    const y0 = clamp(Math.floor((y - rad) / CELL), 0, S.gw - 1), y1 = clamp(Math.floor((y + rad) / CELL), 0, S.gw - 1);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const a = S.grid[cy * S.gw + cx]; for (let i = 0; i < a.length; i++) fn(a[i]); }
    for (const o of S.movers) fn(o);
  }

  function addHole(o) {
    const h = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, dx: 0, dy: 0, mass: 0, score: 0, dead: 0, inv: 0, frozen: 0, think: 0, pow: { mag: 0, spd: 0 }, spd: 1, smart: 1, eaten: 0, kills: 0, out: false }, o);
    h.r = h.rt = h.r0;
    h.tx = h.x; h.ty = h.y; h.fx = h.fy = 0;
    S.holes.push(h);
    return h;
  }
  const radiusOf = h => Math.sqrt(h.r0 * h.r0 + K * h.mass);

  // gm: 'classic' | 'battle' | 'solo'. Battle and solo replay the current level's layout without advancing it.
  function newLevel(lv, gm) {
    gm = gm || 'classic';
    const map = mapFor(lv), big = map.big || 1, D = diff();
    const r = rng(lv * 7919 + 3 + (gm === 'solo' ? 101 : gm === 'battle' ? 202 : 0)), e = gm === 'classic' ? ease() : 0, n = (lv <= 3 ? 10 : lv < 10 ? 11 : 12) * big;
    const boss = gm === 'classic' && lv % 10 === 0;
    R = r;
    S = {
      lv, gm, solo: gm === 'solo', battle: gm === 'battle', t: 0, dur: ((gm === 'solo' ? 100 : 90) + 4 * G.upgrades.time) * (big > 1 ? 2.3 : 1), P, ROAD, n, M: n * P, map, theme: map, boss, big, decks: [], dropping: [],
      objs: [], movers: [], falling: [], anim: [], holes: [], pups: [], texts: [], banner: null, pupT: 5, contUsed: false, blocks: [], total: 0, last10: false,
    };
    genCity(r);
    buildGrid();
    S.total = S.objs.reduce((a, o) => a + o.s * o.s, 0);
    if (!R3) S.ground = makeGround(); // 3D draws the ground itself (crisp at any map size)
    const mid = Math.round(n / 2) * P;
    S.me = addHole({ name: L('YOU', 'SEN'), c: skinColor(), skinFx: skin().fx || '', bot: false, r0: 11 * startMul(), x: mid, y: mid, spd: 1 + 0.04 * G.upgrades.speed });
    const bots = S.solo ? 0 : Math.max(1, (gm === 'battle' ? 5 : lv === 1 ? 3 : lv < 5 ? 4 : 5) + D.bots + (big > 1 ? 2 : 0));
    // Rivals start on a ring of intersections around the centre, spread evenly.
    const spots = [];
    for (let b = 0; b < bots; b++) {
      const a = (b + 0.5) / bots * Math.PI * 2 + r() * 0.4, Rr = S.M * 0.36;
      spots.push([clamp(Math.round((S.M / 2 + Math.cos(a) * Rr) / P), 1, n - 1) * P, clamp(Math.round((S.M / 2 + Math.sin(a) * Rr) / P), 1, n - 1) * P]);
    }
    const skill = (0.68 + 0.016 * Math.min(lv - 1, 25)) * (1 - e) * (lv <= 2 ? 0.88 : 1) * D.spd; // first levels teach the game
    const colors = BOT_COLORS.filter(c => c !== skinColor());
    for (let b = 0; b < bots; b++) {
      const big = boss && b === 0;
      addHole({
        name: big ? L('BLACK HOLE', 'KARA DELİK') : BOT_NAMES[(lv + b * 3) % BOT_NAMES.length], c: big ? '#7c3aed' : colors[b % colors.length], bot: true, boss: big,
        r0: 11 * (big ? 1.6 : 1), x: spots[b][0], y: spots[b][1], spd: skill * (big ? 1.05 : 1), smart: Math.min(0.97, (0.4 + 0.03 * lv + (S.battle ? 0.15 : 0)) * D.smart) * (1 - e), think: b * 0.1,
      });
    }
    if (big > 1) banner('🌍 4x ' + map.name.toUpperCase(), L('Giant map · ' + Math.round(S.dur) + ' s · stand under the decks!', 'Dev harita · ' + Math.round(S.dur) + ' sn · platformların altında bekle!'), '#7dffae');
    else if (startBigAd) banner(L('⭕ BIG START!', '⭕ BÜYÜK BAŞLANGIÇ!'), L('You start 70% bigger', '%70 büyük başladın'), '#7dffae');
    else if (boss) banner(L('👑 BLACK HOLE', '👑 KARA DELİK'), L('Boss level: beat it!', 'Boss seviyesi: onu geç!'), '#c4b5fd');
    else if (S.battle) banner(L('⚔️ BATTLE', '⚔️ SAVAŞ'), L('No respawns · last hole standing', 'Yeniden doğma yok · son kalan kazanır'), '#ffb4b4');
    else if (S.solo) banner('🎯 SOLO', L('Eat as much of ' + map.name + ' as you can', map.name + ' haritasının olabildiğince çoğunu ye'), '#bff3ff');
    if (R3) R3.setLevel(S);
  }

  // Ground for the 2D fallback: sidewalks, block surfaces, roads.
  function makeGround() {
    const th = S.map, M = S.M, px = 1024, k = px / M, c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    g.fillStyle = th.road; g.fillRect(0, 0, px, px);
    for (const b of S.blocks) {
      g.fillStyle = th.walk; g.fillRect((b.i * P + ROAD / 2) * k, (b.j * P + ROAD / 2) * k, (P - ROAD) * k, (P - ROAD) * k);
      g.fillStyle = b.kind === 'park' ? th.park : b.kind === 'houses' ? th.lawn : th.pave;
      g.fillRect((b.i * P + ROAD / 2 + 9) * k, (b.j * P + ROAD / 2 + 9) * k, (P - ROAD - 18) * k, (P - ROAD - 18) * k);
    }
    return c;
  }

  // ---------- Simulation ----------
  function banner(txt, sub, c) { S.banner = { txt, sub: sub || '', c: c || '#fff', life: 2.4 }; }
  function floatText(x, y, txt, c) { S.texts.push({ x, y, txt, c, life: 1 }); }
  const alive = h => !h.out && h.dead <= 0;

  // Bot brain: flee bigger holes, chase clearly smaller ones, otherwise head for the richest food nearby.
  function think(h) {
    let fx = 0, fy = 0, chase = null;
    for (const o of S.holes) {
      if (o === h || !alive(o)) continue;
      const d = Math.hypot(o.x - h.x, o.y - h.y) || 1;
      if (o.r > h.r * 1.15 && d < o.r + h.r + 110) { const w = 1 + 110 / d; fx += (h.x - o.x) / d * w; fy += (h.y - o.y) / d * w; }
      else if (o.inv <= 0 && h.r > o.r * 1.25 && d < (S.battle ? 240 : 170) && (!chase || d < chase.d)) chase = { x: o.x, y: o.y, d };
    }
    let tgt = null;
    if (chase && Math.random() < h.smart) tgt = chase;
    else {
      let best = 0;
      const lim = h.r * EAT, careless = Math.random() > h.smart;
      forCells(h.x, h.y, 230, o => {
        if (o.state || o.alt || o.s > lim) return;
        const d = Math.hypot(o.x - h.x, o.y - h.y), v = o.s * o.s / (d + 40) * (careless ? Math.random() : 1);
        if (v > best) { best = v; tgt = o; }
      });
    }
    if (!tgt) {
      if (!h.wander || Math.hypot(h.wander.x - h.x, h.wander.y - h.y) < 30) h.wander = { x: 40 + Math.random() * (S.M - 80), y: 40 + Math.random() * (S.M - 80) };
      tgt = h.wander;
    }
    h.tx = tgt.x; h.ty = tgt.y; h.fx = fx; h.fy = fy;
  }
  function steer(h, dt) {
    h.think -= dt;
    if (h.think <= 0) { h.think = 0.25 + Math.random() * 0.2; think(h); }
    let dx = (h.tx - h.x), dy = (h.ty - h.y);
    const d = Math.hypot(dx, dy) || 1;
    dx = dx / d + h.fx * 2; dy = dy / d + h.fy * 2;
    const m = Math.hypot(dx, dy) || 1;
    h.dx = dx / m; h.dy = dy / m;
  }

  let joy = null;
  function playerDir(h) {
    if (S.auto) return steer(h, 1 / 60);
    if (!joy) { h.dx = h.dy = 0; return; }
    const dx = joy.x - joy.sx, dy = joy.y - joy.sy, d = Math.hypot(dx, dy);
    if (d < 5) { h.dx = h.dy = 0; return; }
    const th = Math.min(1, d / 34);
    h.dx = dx / d * th; h.dy = dy / d * th;
  }

  function swallow(o, h) { o.state = 1; o.by = h; o.ft = 0; o.x0 = o.x; o.y0 = o.y; S.falling.push(o); }
  function gain(h, o) {
    h.mass += o.s * o.s; h.score += o.s * o.s / 4; h.eaten += o.s * o.s;
    h.rt = radiusOf(h);
    if (h === S.me) {
      Sfx.play('pop');
      S.combo = (S.comboT > 0 ? S.combo : 0) + 1; S.comboT = 1.2;
      if (o.s >= 15) floatText(h.x, h.y - h.r, '+' + Math.round(o.s * o.s / 4), '#ffe066');
      else if (S.combo >= 8 && S.combo % 4 === 0) floatText(h.x, h.y - h.r, 'x' + S.combo + L(' COMBO', ' KOMBO'), '#7dffae');
      if (o.s >= 38) UI.vibrate(25);
    }
  }
  function eatHole(a, b) {
    a.mass += b.mass * 0.25 + 40; a.score += b.score * 0.1 + 20; a.rt = radiusOf(a); a.kills++;
    b.score *= 0.9; b.mass *= 0.5; b.dead = 2.6; b.pow.mag = b.pow.spd = 0;
    if (S.battle) b.out = true;
    if (b === S.me) {
      banner(S.battle ? L('ELIMINATED!', 'ELENDİN!') : L('SWALLOWED!', 'YUTULDUN!'), S.battle ? L(a.name + ' ate you', a.name + ' seni yuttu') : L(a.name + ' ate you · you lost 10% of your score', a.name + ' seni yuttu · puanının %10\'u gitti'), '#ff6b7a'); UI.vibrate(120); Sfx.play('lose'); joy = null;
      if (S.battle) S.endIn = 1.4;
    }
    if (a === S.me) { banner('😋 ' + L(b.name + ' swallowed!', b.name + ' yutuldu!'), '+' + Math.round(b.score * 0.1 + 20) + L(' points', ' puan'), '#ffe066'); UI.vibrate(60); Sfx.play('boss'); }
  }
  function respawn(h) {
    let best = null, bd = -1;
    for (let k = 0; k < 12; k++) {
      const x = (1 + Math.floor(Math.random() * (S.n - 1))) * P, y = (1 + Math.floor(Math.random() * (S.n - 1))) * P;
      const d = Math.min(...S.holes.filter(o => o !== h && alive(o)).map(o => Math.hypot(o.x - x, o.y - y) - o.r), 9999);
      if (d > bd) { bd = d; best = [x, y]; }
    }
    h.x = best[0]; h.y = best[1]; h.vx = h.vy = 0;
    h.r = h.r0; h.rt = radiusOf(h); h.inv = 4; h.wander = null;
  }

  function update(dt) {
    S.t += dt;
    S.anim.length = 0;
    S.comboT = (S.comboT || 0) - dt;
    const left = S.dur - S.t;
    if (left <= 10 && !S.last10) { S.last10 = true; banner(L('⏱️ LAST 10 SECONDS', '⏱️ SON 10 SANİYE'), '', '#ffd23f'); }
    // Holes.
    for (const h of S.holes) {
      if (h.out) { if (h.dead > 0) h.dead -= dt; continue; }
      if (h.dead > 0) { h.dead -= dt; if (h.dead <= 0) respawn(h); continue; }
      h.inv = Math.max(0, h.inv - dt);
      h.pow.mag = Math.max(0, h.pow.mag - dt); h.pow.spd = Math.max(0, h.pow.spd - dt);
      h.r += (h.rt - h.r) * Math.min(1, dt * 4);
      if (h.frozen > 0) { h.frozen -= dt; h.vx = h.vy = 0; continue; }
      if (h.bot) steer(h, dt); else playerDir(h);
      const sp = 95 * h.spd * (1 + Math.min(0.5, h.r / 320)) * (h.pow.spd > 0 ? 1.5 : 1);
      const k = Math.min(1, dt * 8);
      h.vx += (h.dx * sp - h.vx) * k; h.vy += (h.dy * sp - h.vy) * k;
      h.x = clamp(h.x + h.vx * dt, 0, S.M); h.y = clamp(h.y + h.vy * dt, 0, S.M);
    }
    // Moving people and traffic.
    for (const o of S.movers) {
      if (o.state) continue;
      if (o.mv === 'drive') {
        const v = o.v * o.dir * dt;
        if (o.axis) o.y = (o.y + v + S.M) % S.M; else o.x = (o.x + v + S.M) % S.M;
      } else {
        const dx = o.wx - o.x, dy = o.wy - o.y, d = Math.hypot(dx, dy);
        if (d < 2) { o.wx = o.hx + (Math.random() * 2 - 1) * 70; o.wy = o.hy + (Math.random() * 2 - 1) * 70; }
        else { o.x += dx / d * 9 * dt; o.y += dy / d * 9 * dt; o.rot = Math.atan2(dx, dy); o.walk = (o.walk || 0) + dt * 8; }
      }
      S.anim.push(o);
    }
    // Swallowing (the magnet also pulls fitting things in from further away).
    for (const h of S.holes) {
      if (!alive(h)) continue;
      const mag = h.pow.mag > 0, reach = mag ? h.r * 2.6 : h.r + 60, lim = h.r * EAT;
      forCells(h.x, h.y, reach, o => {
        if (o.state || o.alt || o.s > lim) return;
        const dx = h.x - o.x, dy = h.y - o.y, d = Math.hypot(dx, dy);
        if (d < h.r - o.s * 0.3) swallow(o, h);
        // Anything that fits and hangs over the rim tips in: it slides toward the centre (big buildings used to stay
        // standing on a hole that already covered most of them).
        else if ((mag && d < reach) || d < h.r + o.s * 0.6) {
          const st = Math.min(d, (mag ? 120 : 70 + h.r) * dt);
          o.x += dx / d * st; o.y += dy / d * st;
          if (!o.mv) { const c = cellOf(o.x, o.y); if (c !== o.cell) { const a = S.grid[o.cell]; a.splice(a.indexOf(o), 1); S.grid[c].push(o); o.cell = c; } }
          S.anim.push(o);
        }
      });
    }
    // Decks: a hole waiting underneath shakes the load down, one piece at a time.
    for (const dk of S.decks) {
      if (dk.gone) continue;
      const big = S.holes.find(x => alive(x) && x.r * EAT > dk.r * 0.85 && Math.hypot(x.x - dk.x, x.y - dk.y) < x.r * 0.6);
      if (big) {
        dk.gone = true;
        for (const o of dk.items) { o.alt = 0; swallow(o, big); }
        dk.items = [];
        big.mass += dk.r * dk.r * 0.6; big.score += dk.r * dk.r * 0.15; big.rt = radiusOf(big);
        if (big === S.me) { banner('🏗️ ' + L('Deck swallowed!', 'Platform yutuldu!'), '', '#ffe066'); UI.vibrate(60); Sfx.play('boss'); }
        continue;
      }
      if (!dk.items.length) continue;
      const h = S.holes.find(x => alive(x) && Math.hypot(x.x - dk.x, x.y - dk.y) < dk.r - 4);
      if (!h || (dk.t -= dt) > 0) continue;
      dk.t = 0.5;
      const o = dk.items.splice(Math.floor(Math.random() * dk.items.length), 1)[0];
      o.fall = 0; o.from = o.alt; o.x = h.x + (Math.random() * 2 - 1) * h.r * 0.45; o.y = h.y + (Math.random() * 2 - 1) * h.r * 0.45;
      S.dropping.push(o);
      if (h === S.me && o.s >= 9) UI.vibrate(15);
    }
    for (const o of S.dropping) {
      o.fall = Math.min(1, o.fall + dt / 0.45); o.alt = o.from * (1 - o.fall * o.fall); S.anim.push(o);
      if (o.fall >= 1) { o.alt = 0; o.landed = true; const c = cellOf(o.x, o.y); if (c !== o.cell) { const a = S.grid[o.cell]; a.splice(a.indexOf(o), 1); S.grid[c].push(o); o.cell = c; } }
    }
    S.dropping = S.dropping.filter(o => !o.landed);
    // Falling into the hole: slide toward its centre, sink, then count.
    for (const o of S.falling) {
      const h = o.by;
      o.ft = Math.min(1, o.ft + dt * (2.6 - Math.min(1.3, o.s / 40)));
      const e = o.ft * o.ft * 0.7;
      o.x = o.x0 + (h.x - o.x0) * e; o.y = o.y0 + (h.y - o.y0) * e;
      const d = Math.hypot(h.x - o.x, h.y - o.y) || 1;
      o.tdx = (h.x - o.x) / d; o.tdy = (h.y - o.y) / d;
      if (o.ft >= 1) { o.state = 2; gain(h, o); }
      S.anim.push(o);
    }
    S.falling = S.falling.filter(o => o.state === 1);
    // Holes swallowing holes.
    for (const a of S.holes) for (const b of S.holes) {
      if (a === b || !alive(a) || !alive(b) || b.inv > 0 || a.r < b.r * EAT_HOLE) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.r - b.r * 0.4) eatHole(a, b);
    }
    if (S.battle && !S.endIn && S.holes.filter(h => !h.out).length <= 1) S.endIn = 1.4;
    // Power-ups.
    S.pupT -= dt;
    if (S.pupT <= 0 && S.pups.length < 5) {
      S.pupT = 7;
      const kinds = Object.keys(POWERS).filter(k => !(S.solo && k === 'ice'));
      S.pups.push({ kind: kinds[Math.floor(Math.random() * kinds.length)], x: (Math.floor(Math.random() * (S.n + 1))) * P, y: (0.5 + Math.floor(Math.random() * S.n)) * P, t: 0 });
    }
    for (const p of S.pups) {
      p.t += dt;
      for (const h of S.holes) {
        if (!alive(h) || p.done || Math.hypot(h.x - p.x, h.y - p.y) > h.r + 9) continue;
        p.done = true;
        const pw = POWERS[p.kind];
        if (p.kind === 'ice') {
          for (const o of S.holes) if (o !== h && alive(o)) o.frozen = pw.t;
          if (h !== S.me) banner(L('❄️ FROZEN', '❄️ DONDURULDUN'), L(h.name + ' froze everyone', h.name + ' herkesi dondurdu'), '#7dd3fc');
        } else h.pow[p.kind] = pw.t;
        if (h === S.me) { banner(pw.icon + ' ' + pw.name.toUpperCase() + '!', '', pw.c); Sfx.play('coin'); }
      }
    }
    S.pups = S.pups.filter(p => !p.done);
    for (const t of S.texts) t.life -= dt;
    S.texts = S.texts.filter(t => t.life > 0);
    if (S.banner) { S.banner.life -= dt; if (S.banner.life <= 0) S.banner = null; }
    $('timer').textContent = '⏱️ ' + Math.max(0, Math.ceil(left));
    $('timer').classList.toggle('warn', left <= 10);
    if (S.endIn) { S.endIn -= dt; if (S.endIn <= 0) { finish(); return; } }
    if (left <= 0) finish();
  }

  const ranking = () => S.holes.slice().sort((a, b) => (a.out - b.out) || (b.score - a.score));
  function finish() {
    if (S.solo) return soloEnd();
    const rk = ranking();
    if (S.battle && S.me.out) return lose(S.holes.filter(h => !h.out).length + 1);
    if (rk[0] === S.me) win(); else lose(rk.indexOf(S.me) + 1);
  }

  // ---------- Input: a floating joystick anywhere on screen ----------
  cvs.addEventListener('pointerdown', e => {
    if (mode !== 'play' || paused) return;
    joy = { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY };
    try { cvs.setPointerCapture(e.pointerId); } catch (_) { }
  });
  cvs.addEventListener('pointermove', e => {
    if (!joy) return;
    joy.x = e.clientX; joy.y = e.clientY;
    const dx = joy.x - joy.sx, dy = joy.y - joy.sy, d = Math.hypot(dx, dy);
    if (d > 60) { joy.sx = joy.x - dx / d * 60; joy.sy = joy.y - dy / d * 60; }
  });
  const stop = () => { joy = null; };
  cvs.addEventListener('pointerup', stop);
  cvs.addEventListener('pointercancel', stop);

  // ---------- Screens ----------
  function hud() {
    const lv = S && mode !== 'menu' ? S.lv : G.level, m = S && mode !== 'menu' ? S.map : mapFor(G.level);
    const gm = S && mode !== 'menu' ? S.gm : curMode();
    $('lvl').innerHTML = (gm === 'classic' ? L('Level ', 'Seviye ') + lv : MODES[gm].icon + ' ' + MODES[gm].name) + '<small>' + m.icon + ' ' + m.name + '</small>';
    $('coins').textContent = Kit.fmt(Save.data.coins);
  }
  function panel(html, center) {
    // Redrawing an open panel (tab switch, upgrade) swaps its content only, so the pop-in animation doesn't replay.
    const ov = $('ov'), cls = 'overlay' + (center ? ' center' : ''), sh = ov.className === cls && ov.querySelector(':scope > .sheet');
    ov.className = cls;
    if (sh) sh.innerHTML = html; else ov.innerHTML = '<div class="sheet">' + html + '</div>';
    $('timerRow').classList.add('hidden');
    joy = null;
    Ads.banner(true); hud();
  }
  function closePanel() { $('ov').classList.add('hidden'); $('timerRow').classList.remove('hidden'); Ads.banner(false); }

  const HELP =
    L('<div class="upg"><div><b>👆 Drag</b><small>Slide your finger anywhere on the screen and the hole follows.</small></div></div>', '<div class="upg"><div><b>👆 Sürükle</b><small>Ekranın herhangi bir yerinden parmağını kaydır, delik o yöne gider.</small></div></div>') +
    L('<div class="upg"><div><b>🕳️ Swallow what fits</b><small>Anything smaller than the hole falls in. Grow to eat houses, ships and skyscrapers.</small></div></div>', '<div class="upg"><div><b>🕳️ Sığanı yut</b><small>Delikten küçük olan her şey düşer. Büyüdükçe evleri, gemileri ve gökdelenleri yut.</small></div></div>') +
    L('<div class="upg"><div><b>⚔️ Holes</b><small>You can swallow a hole 20% smaller than you. Stay away from bigger ones!</small></div></div>', '<div class="upg"><div><b>⚔️ Delikler</b><small>Senden %20 küçük deliği yutabilirsin. Büyüklerden uzak dur!</small></div></div>') +
    L('<div class="upg"><div><b>🧲 ⚡ ❄️ Power-ups</b><small>Magnet pulls things in, Speed helps you escape, Freeze stops your rivals.</small></div></div>', '<div class="upg"><div><b>🧲 ⚡ ❄️ Güçler</b><small>Mıknatıs çevreyi çeker, hız kaçırır, buz rakipleri dondurur.</small></div></div>') +
    L('<div class="upg"><div><b>🗺️ 9 maps · 3 modes</b><small>New maps unlock as you level up; premium maps open with stars. Battle: no respawns. Solo: eat the whole map.</small></div></div>', '<div class="upg"><div><b>🗺️ 9 harita · 3 mod</b><small>Seviye atladıkça yeni haritalar açılır, premium haritalar yıldızla açılır. Savaş: yeniden doğma yok. Solo: bütün haritayı ye.</small></div></div>');

  function mapCards() {
    // Locked maps show their real icon greyed out with the requirement written over it.
    const card = m => {
      const open = m.id === 'auto' || unlocked(m), on = (G.map || 'auto') === m.id, best = G.solo[m.id];
      const req = m.stars ? '⭐ ' + m.stars : L('Level ', 'Seviye ') + m.lv;
      const act = open ? 'data-act="map" data-arg="' + m.id + '"' : m.stars ? 'data-act="mapBuy" data-arg="' + m.id + '"' : 'disabled';
      return '<button class="mapc' + (on ? ' on' : '') + (open ? '' : ' locked') + (m.stars ? ' prem' : '') + '" ' + act + '>' +
        (m.big ? '<span class="x4">4x</span>' : '') + '<span class="mi">' + m.icon + '</span><b>' + m.name + '</b><small>' + (open ? (m.id === 'auto' ? L('Every level a new map', 'Her seviye yeni harita') : best ? L('Solo best ' + best + '%', 'Solo rekor %' + best) : on ? L('Selected', 'Seçili') : L('Tap to play here', 'Burada oynamak için dokun')) : m.big ? L('Giant map · 3.5 min rounds', 'Dev harita · 3,5 dk tur') : m.stars ? L('Premium · extra detailed', 'Premium · ekstra detaylı') : L('Unlocks at level ' + m.lv, m.lv + '. seviyede açılır')) + '</small>' +
        (open ? '' : '<em class="req' + (m.stars ? ' buy' : '') + '">' + (m.stars ? '' : '🔒 ') + req + '</em>') + '</button>';
    };
    return '<div class="mapc-row">' + [{ id: 'auto', icon: '🔀', name: L('Tour', 'Tur'), lv: 1 }].concat(BASE_MAPS).map(card).join('') + '</div>' +
      '<div class="sect"><h2>✨ ' + L('Premium maps', 'Premium haritalar') + '</h2></div><div class="mapc-row">' + MAPS.filter(m => m.stars).map(card).join('') + '</div>';
  }
  function diffRow() {
    return '<div class="diffs"><span>' + L('Rivals', 'Rakip') + '</span>' + Object.keys(DIFF).map(k => '<button class="diff d-' + k + ((G.diff || 'normal') === k ? ' on' : '') + '" data-act="diff" data-arg="' + k + '">' + DIFF[k].name + '</button>').join('') + '</div>' +
      (DIFF[G.diff] && DIFF[G.diff].pay !== 1 ? '<p class="tip" style="margin:0">' + L('Rewards x' + DIFF[G.diff].pay, 'Ödüller x' + DIFF[G.diff].pay) + '</p>' : '');
  }
  function modeTabs() {
    return '<div class="modes">' + Object.keys(MODES).map(k => {
      const md = MODES[k], open = G.level >= md.lv, on = curMode() === k;
      return '<button class="mode' + (on ? ' on' : '') + '" ' + (open ? 'data-act="mode" data-arg="' + k + '"' : 'disabled') + '><b>' + (open ? md.icon : '🔒') + ' ' + md.name + '</b><small>' + (open ? md.desc : L('Unlocks at level ' + md.lv, md.lv + '. seviyede açılır')) + '</small></button>';
    }).join('') + '</div>';
  }

  function startMenu() {
    mode = 'menu';
    const gm = curMode();
    newLevel(G.level, gm);
    const coins = Save.data.coins;
    const items = Object.keys(UPG).map(k => ({ key: k, icon: UPG[k].icon, name: UPG[k].name, level: G.upgrades[k], max: UPG[k].max, desc: upgDesc(k), cost: upgCost(k) }));
    const info = gm === 'solo' ? '🎯 Solo · ' + S.map.icon + ' ' + S.map.name + (G.solo[S.map.id] ? L(' · best ' + G.solo[S.map.id] + '%', ' · rekor %' + G.solo[S.map.id]) : '')
      : '🕳️ ' + (S.holes.length - 1) + L(' rivals', ' rakip') + (S.boss ? L(' · <b class="t-gold">BOSS: BLACK HOLE</b>', ' · <b class="t-gold">BOSS: KARA DELİK</b>') : '') + ' · ' + S.map.icon + ' ' + S.map.name;
    panel(Kit.hero('delik.webp', 'Hungry Hole') +
      (gm === 'classic' ? Kit.road(G.level, lv => lv % 10 === 0) : '') +
      modeTabs() + diffRow() +
      '<button class="chip mapchip" data-act="tab" data-arg="map">' + info + ' · <b>' + L('change ▸', 'değiştir ▸') + '</b></button>' +
      '<button class="btn green big pulse" data-act="play">' + L('PLAY', 'OYNA') + '</button>' +
      (startBigAd ? '<span class="chip">' + L('⭕ You start the next round 70% bigger', '⭕ Sonraki tura %70 büyük başlıyorsun') + '</span>' : '<button class="btn purple" data-act="bigAd"><span class="ad-ico">AD</span>' + L('⭕ Start big', '⭕ Büyük başla') + '</button>') +
      Kit.tabs(menuTab, [{ id: 'up', label: L('⚡ Upgrade', '⚡ Geliştir') }, { id: 'map', label: L('🗺️ Maps', '🗺️ Harita') }, { id: 'skin', label: L('🎨 Skins', '🎨 Görünüm') }, { id: 'shop', label: L('🛒 Shop', '🛒 Mağaza') }, { id: 'help', label: L('❓ How', '❓ Nasıl') }]) +
      (menuTab === 'shop' ? Kit.shop('delik', G, startMenu, { packSkin: L('Royal Gold', 'Kraliyet Altını'), skins: SKINS, packKey: 'kral', art: skinArt, packDesc: L('A glowing royal gold hole', 'Parıldayan kraliyet altını bir delik') }) : menuTab === 'help' ? HELP : menuTab === 'map' ? mapCards() : menuTab === 'skin' ? Kit.skins(SKINS, G, coins, skinArt) : Kit.upgrades(items, G.gold, '💰')) +
      '<div class="row" style="justify-content:center"><button class="btn gray small" data-act="home">' + L('⌂ Home', '⌂ Ana Menü') + '</button></div>');
  }
  const boardHtml = () => '<div class="board">' + ranking().map((h, i) => '<div class="' + (h === S.me ? 'me' : '') + (h.out ? ' out' : '') + '"><span>' + (i + 1) + '.</span><i style="background:' + h.c + '"></i><b>' + h.name + (h.out ? ' 💀' : '') + '</b><em>' + Math.round(h.score) + '</em></div>').join('') + '</div>';
  const eatenPct = () => Math.round(S.me.eaten / S.total * 100);
  function win() {
    mode = 'end';
    const lv = S.lv, rk = ranking(), ratio = S.me.score / Math.max(1, rk[1] ? rk[1].score : 1);
    const base = Math.round((40 + 8 * Math.min(lv, 60) + Math.max(0, lv - 60)) * diff().pay * (S.big > 1 ? 1.5 : 1) * PlayerLv.mul()); // player level bonus
    let stars;
    if (S.battle) {
      pendingReward = Math.round(base * 1.5); stars = S.holes.every(h => h === S.me || h.out) ? 3 : ratio >= 1.4 ? 2 : 1; G.battleWins = (G.battleWins || 0) + 1;
      Ads.track('battle_win', { game: 'delik', level: lv });
    } else {
      pendingReward = base * (S.boss ? 2 : 1);
      G.level = lv + 1; G.best = Math.max(G.best, lv); G.fails = 0;
      stars = ratio >= 1.6 ? 3 : ratio >= 1.25 ? 2 : 1;
      Ads.track('level_win', { game: 'delik', level: lv, score: Math.round(S.me.score), ratio: Math.round(ratio * 100) / 100, map: S.map.id });
    }
    Save.save();
    Sfx.play('win');
    pendingStars = stars + (S.boss ? 3 : 0) + (G.diff === 'hard' ? 1 : G.diff === 'master' ? 2 : 0);
    const nextMap = !S.battle && G.map === 'auto' ? mapFor(G.level) : null;
    const newMap = !S.battle && MAPS.find(m => m.lv === G.level);
    panel(Kit.win({ title: S.battle ? L('LAST ONE STANDING!', 'AYAKTA KALAN SENSİN!') : L("YOU'RE #1!", '1. SENSİN!'), sub: (S.battle ? L('Battle', 'Savaş') : L('Level ', 'Seviye ') + lv) + L(' · you swallowed ' + eatenPct() + '% of ' + S.map.name, ' · ' + S.map.name + ' haritasının %' + eatenPct() + '\'ini yuttun'), stars, reward: pendingReward, gems: pendingStars, ads: Kit.adsFor(G.level - 1) }) +
      (newMap ? '<div class="unlock">' + L('🗺️ New map unlocked: ', '🗺️ Yeni harita açıldı: ') + '<b>' + newMap.icon + ' ' + newMap.name + '</b></div>' : nextMap ? '<p class="tip">' + L('Next map: ', 'Sonraki harita: ') + nextMap.icon + ' ' + nextMap.name + '</p>' : '') +
      boardHtml(), true);
  }
  function soloEnd() {
    mode = 'end';
    const pct = eatenPct(), id = S.map.id, prev = G.solo[id] || 0;
    const stars = pct >= 85 ? 3 : pct >= 65 ? 2 : pct >= 40 ? 1 : 0;
    G.solo[id] = Math.max(prev, pct); Save.save();
    pendingReward = Math.round((20 + 4 * Math.min(G.level, 60)) * (0.5 + pct / 40) * PlayerLv.mul());
    pendingStars = stars + (pct > prev && prev > 0 ? 1 : 0);
    Ads.track('solo_end', { game: 'delik', map: id, pct });
    Sfx.play(stars ? 'win' : 'lose');
    panel(Kit.win({ title: pct > prev ? L('NEW RECORD!', 'YENİ REKOR!') : L('SOLO DONE', 'SOLO BİTTİ'), sub: S.map.icon + ' ' + S.map.name + L(' · ' + pct + '% swallowed', ' · %' + pct + ' yutuldu') + (prev ? L(' · best ' + Math.max(prev, pct) + '%', ' · rekor %' + Math.max(prev, pct)) : ''), stars, reward: pendingReward, gems: pendingStars, ads: Kit.adsFor(G.level - 1) }) +
      L('<p class="tip">⭐ 40% · ⭐⭐ 65% · ⭐⭐⭐ 85% of the map</p>', '<p class="tip">⭐ %40 · ⭐⭐ %65 · ⭐⭐⭐ %85 harita</p>'), true);
  }
  function lose(place) {
    mode = 'end';
    if (!S.battle) { G.fails = (G.fails || 0) + 1; Save.save(); }
    Ads.track('level_fail', { game: 'delik', level: S.lv, fails: G.fails, place, mode: S.gm });
    Sfx.play('lose');
    panel(Kit.lose({
      title: S.battle ? L('ELIMINATED', 'ELENDİN') : L('YOU FINISHED #' + place, place + '. OLDUN'),
      sub: (S.battle ? L('Battle · place ' + place, 'Savaş · ' + place + '. sıra') : L('Level ' + S.lv + ' · winner: ' + ranking()[0].name, 'Seviye ' + S.lv + ' · birinci ' + ranking()[0].name)),
      hint: S.battle ? L('💡 Grow on small things first and keep away from bigger holes.', '💡 Önce küçüklerle büyü, büyük deliklerden uzak dur.') : ease() > 0 ? L('💡 Next try your rivals will be ' + Math.round(ease() * 100) + '% slower.', '💡 Sonraki denemede rakipler %' + Math.round(ease() * 100) + ' daha yavaş olacak.') : L('💡 Grab the small stuff fast first, then move on to houses and buildings.', '💡 Önce küçükleri hızlıca topla, büyüyünce evlere ve binalara geç.'),
      extraButtons: boardHtml() + (S.contUsed ? '' : '<button class="btn purple big" data-act="cont"><span class="ad-ico">AD</span>' + (S.battle ? L('Revive · keep going', 'Canlan · devam et') : L('+15 s · Continue', '+15 sn · Devam')) + '</button>') +
        '<div class="row"><button class="btn green" data-act="retry">' + L('↻ Retry', '↻ Tekrar') + '</button><button class="btn gray" data-act="menu">' + L('Menu', 'Menü') + '</button></div>',
    }), true);
  }

  const actions = {
    play() { newLevel(G.level, curMode()); startBigAd = false; closePanel(); mode = 'play'; paused = false; hud(); Ads.track('level_start', { game: 'delik', level: S.lv, ease: ease(), mode: S.gm, map: S.map.id }); },
    tab(t) { menuTab = t; startMenu(); },
    map(id) { G.map = id; Save.save(); startMenu(); },
    diff(k) { if (DIFF[k]) { G.diff = k; Save.save(); startMenu(); } },
    mapBuy(id) {
      const m = mapById(id);
      if (!m.stars || unlocked(m)) return;
      if (!Save.spend(m.stars)) { UI.toast(L('Not enough ⭐ stars (' + m.stars + ' needed)', 'Yetersiz ⭐ yıldız (' + m.stars + ' gerekli)')); return; }
      G.maps = (G.maps || []).concat(id); G.map = id; Save.save(); Sfx.play('win');
      Ads.track('map_buy', { game: 'delik', map: id, stars: m.stars });
      UI.toast(m.icon + ' ' + m.name + L(' unlocked!', ' açıldı!')); startMenu();
    },
    mode(k) { if (G.level >= MODES[k].lv) { G.mode = k; Save.save(); startMenu(); } },
    async bigAd() {
      if (!(await Ads.rewarded('delik_start_big'))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      startBigAd = true; UI.toast(L('⭕ You start the next round big', '⭕ Sonraki tura büyük başlarsın')); startMenu();
    },
    skin(k) { if (G.skins.includes(k)) { G.skin = k; Save.save(); startMenu(); } },
    skinBuy(k) {
      if (!Save.spend(SKINS[k].cost)) { UI.toast(L('Not enough ⭐ stars', 'Yetersiz ⭐ yıldız')); return; }
      G.skins.push(k); G.skin = k; Save.save(); UI.toast(SKINS[k].name + L(' unlocked!', ' açıldı!')); Sfx.play('coin'); startMenu();
    },
    async skinAd(k) {
      if (!(await Ads.rewarded('delik_skin_' + k))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      G.adSkin++;
      if (G.adSkin >= SKINS[k].ads) { G.skins.push(k); G.skin = k; UI.toast(SKINS[k].name + L(' unlocked!', ' açıldı!')); }
      Save.save(); startMenu();
    },
    buy(k) {
      if (G.upgrades[k] >= UPG[k].max) return;
      if (G.gold < upgCost(k)) { UI.toast(L('Not enough gold', 'Yetersiz oyun altını')); return; }
      G.gold -= upgCost(k);
      G.upgrades[k]++; Save.save(); UI.toast(UPG[k].icon + ' ' + UPG[k].name + ' ↑'); Sfx.play('coin'); startMenu();
    },
    async claim(m) {
      if (!pendingReward) return;
      if (+m === 3 && !(await Kit.multiAd('delik_win_x3', Kit.adsFor(G.level - 1), 'win' + pendingReward, '[data-act=claim][data-arg="3"]'))) return;
      const amount = pendingReward * (+m === 3 ? 3 : 1);
      G.gold += amount; Save.addCoins(pendingStars); UI.toast('💰 +' + amount + (pendingStars ? ' · ⭐ +' + pendingStars : '')); pendingReward = 0; pendingStars = 0; Save.save(); Sfx.play('coin');
      if (S && S.gm === 'classic') await Ads.levelEnd(G.level - 1);
      startMenu();
    },
    async cont() {
      if (S.contUsed) return;
      if (!(await Ads.rewarded('delik_continue'))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      S.contUsed = true; S.endIn = 0;
      if (S.battle) { S.me.out = false; S.me.dead = 0; respawn(S.me); S.dur = Math.max(S.dur, S.t + 30); }
      else S.dur = S.t + 15;
      S.last10 = false;
      closePanel(); mode = 'play'; paused = false; hud();
    },
    retry() { actions.play(); },
    menu() { startMenu(); },
    resume() { paused = false; closePanel(); },
    home() { UI.goHome('../index.html'); },
  };
  $('ov').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled && actions[b.dataset.act]) { Sfx.play('click'); actions[b.dataset.act](b.dataset.arg); }
  });
  $('soundBtn').textContent = Sfx.icon();
  $('soundBtn').onclick = () => { UI.toast(Sfx.toggle()); $('soundBtn').textContent = Sfx.icon(); };
  $('pauseBtn').onclick = () => {
    if (mode !== 'play') return;
    paused = true;
    panel('<p class="t-lg">' + L('Paused', 'Duraklatıldı') + '</p><button class="btn green big" data-act="resume">' + L('▶ Resume', '▶ Devam') + '</button><button class="btn gray" data-act="menu">' + L('Quit round', 'Oyundan çık') + '</button>', true);
  };
  UI.onBack(() => {
    if (mode === 'play' && !paused) { $('pauseBtn').onclick(); return; }
    if (mode === 'menu') { UI.goHome('../index.html'); return; }
    startMenu();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && !paused) $('pauseBtn').onclick(); });

  // ---------- Render ----------
  function text(t, x, y, size, fill, stroke) {
    ctx.font = '800 ' + size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.26); ctx.strokeStyle = stroke || '#1b1464'; ctx.strokeText(t, x, y);
    ctx.fillStyle = fill || '#fff'; ctx.fillText(t, x, y);
  }
  // Overlay shared by both renderers; W2S maps a world point (+height) to CSS pixels.
  function drawOverlay(W2S) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (SHOT) return;
    const lead = ranking()[0];
    for (const p of S.pups) { const q = W2S(p.x, p.y, 14 + Math.sin(p.t * 4) * 3); text(POWERS[p.kind].icon, q.x, q.y, 26, '#fff', 'rgba(0,0,0,.35)'); }
    for (const h of S.holes) {
      if (!alive(h)) continue;
      const q = W2S(h.x, h.y - h.r, 0);
      if (h.inv > 0 && Math.floor(h.inv * 8) % 2) ctx.globalAlpha = 0.4;
      const me = S.me, prey = h !== me && alive(me) && me.r >= h.r * EAT_HOLE, threat = h !== me && alive(me) && h.r >= me.r * EAT_HOLE;
      text((prey ? '😋 ' : threat ? '⚠️ ' : '') + (h === lead && !S.solo ? '👑 ' : '') + h.name + (h.frozen > 0 ? ' ❄️' : ''), q.x, q.y - 14, h === S.me ? 15 : 13, prey ? '#b6ffb6' : threat ? '#ffb0b0' : '#fff', prey ? '#0b6a2a' : threat ? '#8a1020' : h.c);
      ctx.globalAlpha = 1;
    }
    for (const t of S.texts) { const q = W2S(t.x, t.y, 20 + (1 - t.life) * 40); ctx.globalAlpha = Math.min(1, t.life * 2); text(t.txt, q.x, q.y, 18, t.c, '#6b4a00'); }
    ctx.globalAlpha = 1;
    if (mode !== 'play' || SHOT) return;
    const top = UI.safeArea().hudBottom + 8;
    ctx.font = '800 12px ' + FONT;
    if (S.solo) {
      // Map-eaten meter instead of a leaderboard.
      const pct = S.me.eaten / S.total, w = 150, x = innerWidth - w - 8;
      ctx.fillStyle = 'rgba(15,10,40,.6)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, top, w, 22, 11); else ctx.rect(x, top, w, 22); ctx.fill();
      ctx.fillStyle = '#3be07a'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x + 3, top + 3, Math.max(8, (w - 6) * Math.min(1, pct)), 16, 8); else ctx.rect(x + 3, top + 3, (w - 6) * Math.min(1, pct), 16); ctx.fill();
      for (const m of [40, 65, 85]) { const mx = x + 3 + (w - 6) * m / 100; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(mx - 1, top + 3, 2, 16); }
      text(L(Math.round(pct * 100) + '% eaten', '%' + Math.round(pct * 100) + ' yendi'), x + w / 2, top + 11, 12, '#fff');
    } else {
      // Leaderboard (top right, under the HUD).
      const rk = ranking();
      rk.forEach((h, i) => {
        const y = top + i * 20, me = h === S.me;
        ctx.globalAlpha = h.out ? 0.45 : 1;
        ctx.fillStyle = me ? 'rgba(59,130,246,.55)' : 'rgba(15,10,40,.55)';
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(innerWidth - 138, y, 130, 18, 9); else ctx.rect(innerWidth - 138, y, 130, 18); ctx.fill();
        ctx.fillStyle = h.c; ctx.beginPath(); ctx.arc(innerWidth - 126, y + 9, 5, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText((i + 1) + '. ' + h.name + (h.out ? ' 💀' : ''), innerWidth - 116, y + 9.5);
        ctx.textAlign = 'right'; ctx.fillText(String(Math.round(h.score)), innerWidth - 14, y + 9.5);
        ctx.globalAlpha = 1;
      });
    }
    // Active powers.
    const pw = Object.keys(S.me.pow).filter(k => S.me.pow[k] > 0);
    pw.forEach((k, i) => text(POWERS[k].icon + ' ' + Math.ceil(S.me.pow[k]), innerWidth / 2 + (i - (pw.length - 1) / 2) * 70, innerHeight - 60, 18, '#fff', POWERS[k].c));
    if (S.banner) {
      const b = S.banner, a = Math.min(1, b.life * 2), y = innerHeight * 0.3;
      ctx.globalAlpha = a; text(b.txt, innerWidth / 2, y, 30, b.c); if (b.sub) text(b.sub, innerWidth / 2, y + 30, 14, '#fff'); ctx.globalAlpha = 1;
    }
    if (S.me.dead > 0 && !S.me.out) text(L('Respawning… ', 'Yeniden doğuyorsun… ') + Math.ceil(S.me.dead), innerWidth / 2, innerHeight * 0.55, 18, '#fff');
    if (S.lv === 1 && S.t < 6 && S.gm === 'classic') { ctx.globalAlpha = 0.7 + Math.sin(S.t * 4) * 0.3; text(L('Drag your finger, swallow what fits!', 'Parmağını sürükle, sığanı yut!'), innerWidth / 2, innerHeight * 0.72, 20); ctx.globalAlpha = 1; }
    if (joy) {
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(joy.sx, joy.sy, 60, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(joy.x, joy.y, 18, 0, 7); ctx.fill();
    }
  }

  // 2D fallback: top-down camera following the player.
  const cam = { x: 0, y: 0, w: 260 };
  function draw2D(dt) {
    const th = S.map, me = S.me;
    cam.x += (me.x - cam.x) * Math.min(1, dt * 5); cam.y += (me.y - cam.y) * Math.min(1, dt * 5);
    cam.w += (250 + me.r * 5.5 - cam.w) * Math.min(1, dt * 2);
    const sc = innerWidth / cam.w, ox = innerWidth / 2 - cam.x * sc, oy = innerHeight * 0.55 - cam.y * sc;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = th.edge; ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
    ctx.drawImage(S.ground, 0, 0, S.M, S.M);
    for (const h of S.holes) {
      if (h.dead > 2.3) { /* shrinking */ } else if (h.dead > 0 || h.out) continue;
      const r = h.dead > 0 ? h.r * (h.dead - 2.3) / 0.3 : h.r;
      ctx.fillStyle = '#07070c'; ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = h.c; ctx.lineWidth = Math.max(1.5, r * 0.12); ctx.stroke();
    }
    const x0 = cam.x - cam.w, x1 = cam.x + cam.w, y0 = cam.y - cam.w * 2, y1 = cam.y + cam.w * 2;
    for (const o of S.objs) {
      if (o.state === 2 || o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1) continue;
      const k = o.state === 1 ? 1 - o.ft : 1, s = o.s * k;
      ctx.globalAlpha = o.state === 1 ? 0.4 + 0.6 * k : 1;
      ctx.fillStyle = o.tint || o.c;
      if (s > 14) ctx.fillRect(o.x - s * 0.66, o.y - s * 0.66, s * 1.32, s * 1.32);
      else { ctx.beginPath(); ctx.arc(o.x, o.y, s * 0.8, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    drawOverlay((x, y) => ({ x: ox + x * sc, y: oy + y * sc }));
  }
  function draw3D(dt) {
    R3.render(S, dt, { playing: mode === 'play' && !paused });
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cvs.width, cvs.height);
    drawOverlay((x, y, h) => R3.project(x, y, h));
  }

  let last = performance.now();
  function loop(t) {
    requestAnimationFrame(loop);
    if (t - last < 7) return; // follow the screen (up to 120 Hz): 60 fps looked choppy on 120 Hz phones
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (mode === 'play' && !paused) update(dt);
    if (!S) return;
    if (R3) draw3D(dt); else draw2D(dt);
  }
  startMenu();
  // Preview/screenshot hooks: #play starts a level, #demo lets a bot play 25 s, #map=<id> picks a map.
  const hm = /map=(\w+)/.exec(location.hash || '');
  if (hm) { G.map = hm[1]; if (G.level < 8) G.level = 8; if (mapById(hm[1]).stars && !G.maps.includes(hm[1])) G.maps.push(hm[1]); startMenu(); }
  if (/play|demo/.test(location.hash || '')) actions.play();
  if (/demo/.test(location.hash || '')) { S.auto = true; for (let i = 0; i < 500; i++) update(0.05); }
  window.__delik = { get S() { return S; }, get G() { return G; }, newLevel: (lv, gm) => newLevel(lv, gm), MAPS, update: dt => update(dt), R3 }; // test hook
  Sfx.music(true);
  requestAnimationFrame(loop);
})();
