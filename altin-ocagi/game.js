// Altın Ocağı — idle mining empire.
// Shafts dig ore into their crates, the elevator hauls it up to the vault as cash. Managers automate a stage
// and keep it working while the app is closed (offline earnings, capped). Every 25 levels doubles a shaft.
// Every mine is a village of a Travian-style empire (empire.js): buildings on free plots, iron, troops,
// conquest and oases. Villages sit on a world map; the biome of their tile sets the mine's look and rules.
(() => {
  'use strict';

  const G = Save.game('maden', {
    cash: 20, earned: 0, last: 0, boostUntil: 0,
    shafts: [{ l: 1, m: false, st: 0 }], elev: { l: 1, m: false },
    cur: 0, regions: null, giftAt: 0, townBoostUntil: 0,
    cards: {}, chest: { pity: 0, free: '' }, deals: null,
    shop: { pick: 0, shift: 0, lift: 0, outfit: 'klasik', outfits: ['klasik'], adOutfit: 0, vtheme: 'bolge', vthemes: ['bolge'], adVtheme: 0, wskin: 'tas', wskins: ['tas'], adWskin: 0 },
  });
  // Regions of the world map. mul scales both income and prices; oreOff picks the region's own ores.
  const REGIONS = [
    { id: 'vadi', name: L('Green Valley', 'Yeşil Vadi'), icon: '🌲', mul: 1, oreOff: 0, rule: L('Fertile valley: businesses 25% faster', 'Bereketli vadi: işletmeler %25 hızlı'), mod: { biz: 1.25 }, car: L('Horse cart', 'Atlı araba'), goals: [6, 3, 2e6], sky: ['#4aa8f0', '#d4f1ff'], grass: '#5bc26b', dirt: '#7a5230', earth: ['#6b4a2e', '#5e4027'], back: '#4a3120', card: ['#3f9e4a', '#1d5a2c'], support: '#8a5a2b', lamp: '#fff3b0' },
    { id: 'col', name: L('Scorching Desert', 'Kızgın Çöl'), icon: '🏜️', mul: 1, oreOff: 5, rule: L('Dry air: elevator 40% faster', 'Kuru hava: asansör %40 hızlı'), mod: { lift: 1.4 }, car: L('Truck', 'Kamyon'), goals: [7, 4, 1e7], sky: ['#f5a04a', '#ffe8b8'], grass: '#e8c27a', dirt: '#c98b4a', earth: ['#b77a44', '#a86d3a'], back: '#6e4524', card: ['#f0a040', '#8a4a18'], support: '#c9a26a', lamp: '#ffe0a0' },
    { id: 'buz', name: L('Glacier Peak', 'Buzul Dağı'), icon: '🏔️', mul: 1, oreOff: 10, rule: L('Frozen veins: digging 50% slower but ore worth 2x', 'Donmuş damarlar: kazı %50 yavaş ama cevher 2x değerli'), mod: { dig: 1.5, ore: 2 }, car: L('Sled', 'Kızak'), goals: [8, 5, 5e7], sky: ['#7fb8e8', '#eef8ff'], grass: '#eef6ff', dirt: '#9ab4c8', earth: ['#7890a8', '#6a8298'], back: '#3e5268', card: ['#8ecbff', '#2a4d7a'], support: '#bfe6ff', lamp: '#bff4ff' },
    { id: 'volkan', name: L('Volcano Island', 'Volkan Adası'), icon: '🌋', mul: 1, oreOff: 15, rule: L('Lava heat: floors produce 2x, the elevator carries half', 'Lav ısısı: katlar 2x üretir, asansör yarım taşır'), mod: { ore: 2, cap: 0.5 }, car: L('Mine train', 'Maden treni'), goals: [9, 6, 2e8], sky: ['#5a1a1a', '#ff8a4a'], grass: '#3a3030', dirt: '#4a2a22', earth: ['#3a2622', '#2f1f1c'], back: '#1a0e0c', card: ['#ff5a2a', '#4a0e0a'], support: '#2a2a2a', lamp: '#ff7a3a' },
    { id: 'ay', name: L('Moon Base', 'Ay Üssü'), icon: '🌙', mul: 1, oreOff: 20, rule: L('Low gravity: elevator and transport 2x faster', 'Düşük yerçekimi: asansör ve taşıma 2x hızlı'), mod: { lift: 2, trans: 2 }, car: L('Moon rover', 'Ay aracı'), goals: [10, 8, 1e9], sky: ['#05051a', '#2a2a5a'], grass: '#c8c8d0', dirt: '#8a8a96', earth: ['#6a6a78', '#5e5e6c'], back: '#2a2a36', card: ['#7a7aff', '#14143a'], support: '#9aa3b0', lamp: '#9ff0ff' },
  ];
  // Old single-mine saves become region 0.
  if (!G.regions) {
    G.regions = [{ cash: G.cash, earned: G.earned, shafts: G.shafts, elev: G.elev, biz: {} }];
    G.cur = 0;
  }
  const RG = () => G.regions[G.cur], REG = () => REGIONS[RG().b || 0];
  const MOD = k => REG().mod[k] || 1;
  // Older saves: every region gets a transport stage (matching its elevator so nothing stalls) + goal flags.
  // A fresh region with every stage.
  const newRegion = (k, extra) => Object.assign({ b: k, cash: 50 * REGIONS[k].mul, earned: 0, shafts: [{ l: 1, m: false, st: 0 }], elev: { l: 1, m: true }, trans: { l: 1, m: true }, depo: 0, goals: [false, false, false], speed: {}, biz: {}, left: Date.now() }, extra || {});
  G.regions.forEach((r, k) => {
    if (r.b == null) r.b = Math.min(k, REGIONS.length - 1);
    if (!r.trans) r.trans = { l: r.elev.l, m: r.elev.m };
    if (r.depo == null) r.depo = 0;
    if (!r.goals) r.goals = [false, false, false];
    if (!r.speed) r.speed = {};
    // The elevator and the transport run on their own from the start (no manager to buy).
    r.elev.m = true; r.trans.m = true;
  });
  // Every village has its own treasury (Travian-style); caravans from the Maden Pazarı move cash between them.
  // Saves from the short-lived shared-wallet build: the pooled cash stays with the village that was open.
  if (G.wallet != null) { G.regions.forEach((r, k) => { r.cash = k === (G.cur || 0) ? G.wallet : 0; }); delete G.wallet; }
  // G.shafts / G.elev / G.cash always mirror the active region.
  function bindRegion(k) {
    G.cur = k;
    const r = RG();
    G.shafts = r.shafts; G.elev = r.elev; G.cash = r.cash; G.earned = r.earned || 0;
  }
  function syncRegion() { const r = RG(); r.cash = G.cash; r.earned = G.earned; }
  // Saves from the x8 / region-multiplier economy: money is converted by the ratio of the old to the new income of
  // the region's deepest floor, so everyone keeps the same "amount of progress" in readable numbers.
  if (!G.econ2) {
    const OLD_MUL = [1, 60, 3600, 216000, 1.3e7];
    const fOf = G.regions.map(r => { const n = (r.shafts || []).length || 1; return floorK(n - 1) / (Math.pow(8, n - 1) * (OLD_MUL[r.b || 0] || 1)); });
    G.regions.forEach((r, k) => {
      const f = fOf[k];
      for (const key of ['cash', 'depo', 'earned']) if (r[key]) r[key] *= f;
      (r.shafts || []).forEach(s => { s.st = (s.st || 0) * f; });
    });
    G.regions.forEach((r, k) => {
      const dl = Math.log(fOf[k] * (OLD_MUL[r.b || 0] || 1)) / Math.log(1.3); // the old capacity also carried the region multiplier
      if (r.elev) r.elev.l = Math.max(1, Math.round(r.elev.l + dl));
      if (r.trans) r.trans.l = Math.max(1, Math.round(r.trans.l + dl));
    });
    // Caravans and armies on the way carry old-scale cash too (and attacks remember their village's income).
    for (const m of G.moves || []) {
      const k = m.type === 'caravan' ? m.to : m.from, f = fOf[k] != null ? fOf[k] : 1;
      if (m.cash) m.cash *= f;
      if (m.income) m.income *= f;
    }
    G.econ2 = 1;
  }
  bindRegion(Math.min(G.cur || 0, G.regions.length - 1));
  // Every floor digs something new: 30 hand-made ores, then generated names forever (no repeats).
  const ORE_EN = 'Gold|Ruby|Emerald|Sapphire|Amethyst|Diamond|Topaz|Obsidian|Opal|Mithril|Lava Crystal|Ice Core|Moonstone|Thunderstone|Dragon Blood|Stardust|Sky Iron|Adamantite|Ghost Opal|Sun Ruby|Nebula Glass|Plasma Essence|Time Sand|Phoenix Feather|Soul Crystal|Quantum Ore|Black Hole Stone|Dark Matter|Cosmic Core|Infinity Stone'.split('|');
  const ORE_LIST = [
    ['Altın', '#ffd23f'], ['Yakut', '#ff5a6e'], ['Zümrüt', '#3be07a'], ['Safir', '#4ea8ff'], ['Ametist', '#c07bff'],
    ['Elmas', '#dff6ff'], ['Topaz', '#ff9a3c'], ['Obsidyen', '#6a5a8a'], ['Opal', '#7df9e0'], ['Mitril', '#b8d4ff'],
    ['Lav Kristali', '#ff5a1f'], ['Buz Çekirdeği', '#a8f0ff'], ['Ay Taşı', '#e8e4ff'], ['Şimşek Taşı', '#fff36b'], ['Ejder Kanı', '#d6173a'],
    ['Yıldız Tozu', '#ffe7a8'], ['Gök Demiri', '#8fa3c8'], ['Adamantit', '#5fd3c4'], ['Hayalet Opal', '#d8f7ff'], ['Güneş Yakutu', '#ff7a3c'],
    ['Nebula Camı', '#b07bff'], ['Plazma Özü', '#ff4df0'], ['Zaman Kumu', '#e3c27a'], ['Anka Tüyü', '#ff9d2e'], ['Ruh Kristali', '#9fffd6'],
    ['Kuantum Cevheri', '#39e0ff'], ['Kara Delik Taşı', '#3a2a5a'], ['Karanlık Madde', '#5b3fa0'], ['Kozmik Çekirdek', '#ff5fa0'], ['Sonsuzluk Taşı', '#ffffff'],
  ];
  const ORE_PRE = L('Ancient|Noble|Mystic|Shining|Sacred|Legendary|Storm|Silent|Radiant|Boundless', 'Kadim|Asil|Gizemli|Parlayan|Kutsal|Efsanevi|Fırtına|Sessiz|Işıyan|Uçsuz').split('|');
  const ORE_BASE = L('Crystal|Ore|Core|Stone|Essence|Vein|Prism|Orb', 'Kristal|Cevher|Çekirdek|Taş|Öz|Damar|Prizma|Küre').split('|');
  const oreCache = [];
  // Each region starts further along the ore list, so every region digs its own materials.
  const oreOf = i => oreAt(i + REG().oreOff);
  function oreAt(i) {
    if (oreCache[i]) return oreCache[i];
    let o;
    if (i < ORE_LIST.length) o = { name: L(ORE_EN[i], ORE_LIST[i][0]), c: ORE_LIST[i][1] };
    else {
      const k = i - ORE_LIST.length, tier = Math.floor(k / (ORE_PRE.length * ORE_BASE.length));
      const name = ORE_PRE[k % ORE_PRE.length] + ' ' + ORE_BASE[Math.floor(k / ORE_PRE.length) % ORE_BASE.length] + (tier ? ' ' + ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.min(8, tier - 1)] : '');
      // Golden-angle hue walk keeps neighbouring floors clearly different.
      const h = (k * 137.508) % 360, l = 55 + (k % 3) * 8;
      o = { name, c: hsl(h, 85, l) };
    }
    return (oreCache[i] = o);
  }
  function hsl(h, sat, l) {
    sat /= 100; l /= 100;
    const f = n => { const k = (n + h / 30) % 12, a = sat * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); };
    return '#' + f(0) + f(8) + f(4);
  }
  const OFFLINE_CAP = 3 * 3600;
  const CYCLE = 4;

  // ---------- Economy ----------
  // Every region is its own mine starting small (they used to multiply all money by 60, 3600, 216000…, which is
  // how 11-digit amounts with "aa" units appeared). Opening regions still raises income everywhere (regionBonus).
  const RM = () => 1;
  // Every region opened beyond the first adds +50% income in all regions.
  const regionBonus = () => 1 + 0.2 * (G.regions.length - 1);
  // Mastery: every 25 levels on ANY floor adds +5% to the whole mine, so upper floors stay worth upgrading.
  const mastery = () => 1 + 0.05 * G.shafts.reduce((a, s) => a + Math.floor(s.l / 25), 0);
  const goalBonus = () => 1 + 0.1 * RG().goals.filter(Boolean).length;
  const pickBonus = () => 1 + 0.25 * G.shop.pick;
  // ---------- Super managers (collection cards from the Manager Chest; duplicates level them up) ----------
  const CARDS = {
    kazmaci: { icon: '⛏️', r: 'epic', name: L('Master Digger', 'Usta Kazmacı'), per: 0.08, desc: v => L('Floors produce +', 'Katların üretimi +%') + Math.round(v * 100) + L('%', '') },
    asansorcu: { icon: '🛗', r: 'rare', name: L('Lift Master', 'Asansör Ustası'), per: 0.1, desc: v => L('Elevator capacity +', 'Asansör kapasitesi +%') + Math.round(v * 100) + L('%', '') },
    surucu: { icon: '🚚', r: 'rare', name: L('Ace Driver', 'Usta Sürücü'), per: 0.1, desc: v => L('Vehicle capacity +', 'Araç kapasitesi +%') + Math.round(v * 100) + L('%', '') },
    muhasebe: { icon: '📒', r: 'common', name: L('Accountant', 'Muhasebeci'), per: 0.06, desc: v => L('Village buildings +', 'Köy binaları +%') + Math.round(v * 100) + L('%', '') },
    bankaci: { icon: '🏦', r: 'common', name: L('Bank Manager', 'Banka Müdürü'), per: 0.2, desc: v => L('Mine Gift +', 'Maden Hediyesi +%') + Math.round(v * 100) + L('%', '') },
    gece: { icon: '🌙', r: 'rare', name: L('Night Watch', 'Gece Bekçisi'), per: 0.1, desc: v => L('Offline earnings +', 'Çevrimdışı kazanç +%') + Math.round(v * 100) + L('%', '') },
    kasif: { icon: '🧭', r: 'epic', name: L('Explorer', 'Kâşif'), per: 0.05, desc: v => L('New floors -', 'Yeni kat açma -%') + Math.round(v * 100) + L('%', '') },
    kral: { icon: '👑', r: 'legendary', name: L('Gold King', 'Altın Kral'), per: 0.05, desc: v => L('All income +', 'Tüm gelir +%') + Math.round(v * 100) + L('%', '') },
  };
  const CARD_MAX = 10, cardLv = k => Math.min(CARD_MAX, (G.cards || {})[k] || 0), card = k => cardLv(k) * CARDS[k].per;
  const incomeBoost = () => regionBonus() * bizBonus() * mastery() * goalBonus() * pickBonus() * Empire.oasisMul('nakit') * (1 + card('kral')) * PlayerLv.mul(); // player level bonus
  // Growth per deeper floor: x2.2 for the first 15 floors, then x1.5, so even deep mines stay in readable numbers.
  // r scales the step for prices (a bit steeper than income, so progress takes play but never walls off).
  function floorK(i, r) { return Math.pow(2.2 * (r || 1), Math.min(i, 15)) * Math.pow(1.5 * (r || 1), Math.max(0, i - 15)); }
  const base = i => 2 * floorK(i) * RM() * incomeBoost();
  const milestone = l => { const k = Math.floor(l / 25); return Math.pow(2, Math.min(k, 4)) * Math.pow(1.25, Math.max(0, k - 4)); };
  const shaftRate = (i, l) => base(i) * l * milestone(l) * (1 + card('kazmaci')) * MOD('ore') / MOD('dig') * Empire.oasisMul('cevher');   // cash per second (Cevher Vahası +25% each)
  const cycle = () => CYCLE * MOD('dig');
  // Deeper floors pay more but cost disproportionately more, so going down takes real play.
  // Derin Damar oases make digging cheaper (each: price / 1.25, i.e. -20%).
  // Prices grow only a little faster than the income of each deeper floor, so the mine never walls off
  // (simulated: floor 30 after ~0.6 days of active play, floor 40 after ~10).
  const shaftCost = (i, l) => 10 * floorK(i, 1.083) * Math.pow(1.15, l - 1) * RM() / Empire.oasisMul('damar');
  const unlockCost = i => 400 * floorK(i, 1.318) * RM() / Empire.oasisMul('damar') / (1 + card('kasif'));
  const shaftMgrCost = i => 150 * floorK(i, 1.136) * RM();
  // A new floor also needs the floor above it developed (capped: it used to reach Lv.242 by floor 30).
  const unlockNeed = i => Math.min(25, 10 + 3 * (i - 1));
  const canUnlockDepth = i => i === 0 || G.shafts[i - 1].l >= unlockNeed(i);
  const elevMgrCost = () => 300 * RM();
  // The cage moves at a believable speed (at most 5 floors a second), stops only at floors with ore and turns back
  // when it is full. Deep mines get a bigger cage (it used to race through 30 floors in a second and a half);
  // speed bonuses beyond the visual limit turn into capacity.
  const VMAX = 5, STOP = 0.25;
  const liftPerk = () => 1 + 0.2 * G.shop.lift;
  const elevSpeedRaw = l => Math.min(3.5, 1.5 + 0.04 * (l - 1)) * MOD('lift') * liftPerk() * Empire.oasisMul('hiz');
  const elevSpeed = l => Math.min(VMAX, elevSpeedRaw(l));
  const elevCap = l => 40 * Math.pow(1.3, l - 1) * RM() * incomeBoost() * MOD('ore') * MOD('cap') * Math.max(1, G.shafts.length / 4) * Math.max(1, elevSpeedRaw(l) / VMAX) * (1 + card('asansorcu'));
  const elevTrip = () => { const n = G.shafts.length; return 2 * n / elevSpeed(G.elev.l) + STOP * n; };
  const elevRate = () => elevCap(G.elev.l) / elevTrip();
  const elevCost = l => 25 * Math.pow(1.33, l - 1) * RM();
  // Transport: carts / trucks / trains carry ore from the surface depot to the bank.
  const transCap = l => 60 * Math.pow(1.3, l - 1) * RM() * incomeBoost() * MOD('ore') * (1 + card('surucu'));
  const transTrip = l => 5 / (Math.min(3, 1 + 0.04 * (l - 1)) * MOD('trans') * liftPerk() * Empire.oasisMul('hiz'));
  const transRate = () => transCap(RG().trans.l) / transTrip(RG().trans.l);
  const transCost = l => 30 * Math.pow(1.33, l - 1) * RM();
  const transMgrCost = () => 500 * RM();
  const mineFlow = () => Math.min(totalRate(true), elevRate(), transRate());

  // ---------- Town businesses (per region) ----------
  // cost: first level price; inc: cash per cycle at level 1; time: cycle seconds. Scaled by the region.
  const BIZ = [
    { id: 'demirci', icon: '⚒️', name: L('Blacksmith', 'Demirci'), cost: 60, inc: 8, time: 3 },
    { id: 'kuyumcu', icon: '💍', name: L('Jeweller', 'Kuyumcu'), cost: 900, inc: 90, time: 6 },
    { id: 'pazar', icon: '🏪', name: L('Mine Market', 'Maden Pazarı'), cost: 14e3, inc: 1100, time: 12 },
    { id: 'otel', icon: '🏨', name: L('Miners\' Hotel', 'Madenci Oteli'), cost: 2.2e5, inc: 1.4e4, time: 24 },
    { id: 'tren', icon: '🚂', name: L('Ore Train', 'Cevher Treni'), cost: 3.5e6, inc: 1.8e5, time: 48 },
    { id: 'banka', icon: '🏦', name: L('Gold Bank', 'Altın Bankası'), cost: 6e7, inc: 2.4e6, time: 96 },
    { id: 'rafineri', icon: '🏭', name: L('Refinery', 'Rafineri'), cost: 1e9, inc: 3.2e7, time: 192 },
    { id: 'darphane', icon: '🪙', name: L('Mint', 'Darphane'), cost: 1.8e10, inc: 4.5e8, time: 384 },
  ];
  const bizIncome = (b, l) => b.inc * l * Math.pow(2, Math.floor(l / 25)) * RM() * regionBonus() * pickBonus() * (1 + card('muhasebe'));
  // Production buildings earn continuously (cash per second); the valley rule speeds them up.
  const bizPerSec = (id, l) => { const b = BIZ.find(x => x.id === id); return b ? bizIncome(b, l) / b.time * MOD('biz') : 0; };
  // Each 25 levels of a production building gives the village's mine +10%.
  const bizMilestones = () => RG().slots ? RG().slots.reduce((a, x) => a + (x && BIZ.some(b => b.id === x.t) ? Math.floor(x.l / 25) : 0), 0) : 0;
  function bizBonus() { return 1 + 0.1 * bizMilestones(); }
  const bizRate = () => (RG().slots ? Empire.cashBuildings().reduce((a, x) => a + bizPerSec(x.t, x.l), 0) * Empire.oasisMul('nakit') : 0);
  // Star-coin shop: permanent perks and miner outfits (shared coins from all games).
  const PERKS = {
    pick: { icon: '⛏️', name: L('Golden Pickaxe', 'Altın Kazma'), desc: l => (l ? L('All income +' + 25 * l + '%', 'Tüm gelir +%' + 25 * l) : L('No bonus', 'Bonus yok')), max: 4, cost: l => 40 * Math.pow(2, l) },
    shift: { icon: '🌙', name: L('Night Shift', 'Gece Vardiyası'), desc: l => L('Offline ' + (3 + l) + ' hours', 'Çevrimdışı ' + (3 + l) + ' saat'), max: 5, cost: l => 25 * Math.pow(2, l) },
    lift: { icon: '⚡', name: L('Turbo Engine', 'Turbo Motor'), desc: l => (l ? L('Elevator and transport +' + 20 * l + '% speed', 'Asansör ve taşıma +%' + 20 * l + ' hız') : L('No bonus', 'Bonus yok')), max: 3, cost: l => 50 * Math.pow(2, l) },
  };
  const OUTFITS = {
    klasik: { name: L('Classic', 'Klasik'), color: '#ff9f1c', hat: '#ffd23f', cost: 0 },
    mavi: { name: L('Blue Overalls', 'Mavi Tulum'), color: '#3b82f6', hat: '#e5e7eb', cost: 30 },
    yesil: { name: L('Forest', 'Orman'), color: '#22c55e', hat: '#14532d', cost: 60 },
    kirmizi: { name: L('Firefighter', 'İtfaiye'), color: '#ef4444', hat: '#fbbf24', cost: 100 },
    mor: { name: L('Night', 'Gece'), color: '#7c3aed', hat: '#1f2937', cost: 180 },
    altin: { name: L('Gold', 'Altın'), color: '#fbbf24', hat: '#fff3b0', ads: 2 },
    astronot: { name: L('Astronaut', 'Astronot'), color: '#f1f5f9', hat: '#94a3b8', cost: 400 },
    kral: { name: L('Royal', 'Kraliyet'), color: '#7a1fa0', hat: '#ffd23f', pack: true, rarity: 'legendary' },
  };
  // Village skins (star coins): a roof/banner colour for every village, and the look of the town wall.
  const VTHEMES = {
    bolge: { name: L('Region colour', 'Bölge rengi'), color: '#3b82f6', cost: 0 },
    bahar: { name: L('Spring', 'Bahar'), color: '#ec4899', hue: 330, cost: 250 },
    altin: { name: L('Golden Palace', 'Altın Saray'), color: '#f2b52a', hue: 45, cost: 300 },
    kizil: { name: L('Crimson', 'Kızıl'), color: '#dc2626', hue: 0, cost: 400 },
    gece: { name: L('Night Castle', 'Gece Kalesi'), color: '#7c3aed', hue: 270, cost: 500 },
    zumrut: { name: L('Emerald', 'Zümrüt'), color: '#10b981', hue: 155, ads: 2 },
  };
  const WSKINS = {
    tas: { name: L('Stone', 'Taş'), color: '#9a958c', cost: 0 },
    buz: { name: L('Ice Wall', 'Buz Suru'), color: '#a5e4ff', tint: '#c4ecff', cost: 350 },
    lav: { name: L('Lava Wall', 'Lav Suru'), color: '#b0413e', tint: '#c0544a', cost: 450 },
    altin: { name: L('Golden Wall', 'Altın Sur'), color: '#f2c14e', tint: '#ffd97a', cost: 600 },
    obsidyen: { name: L('Obsidian', 'Obsidyen'), color: '#4c4680', tint: '#6a64a0', ads: 3 },
  };
  // One skin collection per key: [skins, selected, owned, ad counter].
  const COLL = { outfit: [OUTFITS, 'outfit', 'outfits', 'adOutfit'], vtheme: [VTHEMES, 'vtheme', 'vthemes', 'adVtheme'], wskin: [WSKINS, 'wskin', 'wskins', 'adWskin'] };
  // Kit.skins() emits skin/skinBuy/skinAd; prefix them with the collection so one shop can hold several.
  const collSkins = c => Kit.skins(COLL[c][0], { skin: G.shop[COLL[c][1]], skins: G.shop[COLL[c][2]], adSkin: G.shop[COLL[c][3]] }, Save.data.coins, (k, s) => skinArt(c, s))
    .replace(/data-act="skin(Buy|Ad)?" data-arg="/g, (m, suf) => 'data-act="c' + (suf || 'Sel') + '" data-arg="' + c + ':');
  const offlineCap = () => (3 + G.shop.shift) * 3600;
  const boosted = () => Date.now() < G.boostUntil;
  const mult = () => (boosted() ? 2 : 1);
  const totalRate = managedOnly => G.shafts.reduce((a, s, i) => a + (!managedOnly || s.m ? shaftRate(i, s.l) : 0), 0);

  // Short, familiar units (bin/milyon/milyar/trilyon…), at most 3 significant digits: "12,4 Mn" / "12.4M".
  const UNITS = L('K|M|B|T|Qa|Qi|Sx|Sp|Oc|No', 'B|Mn|Mr|Tn|Kd|Kn|Sk|Sp|Ok|Nn').split('|');
  // Past the named units it goes on like idle games do: aa, ab, … zz (never 8.2e55 or Infinity).
  function fmt(n) {
    if (n === Infinity || n > 1e300) return '∞';
    if (!(n >= 1000)) return String(Math.max(0, Math.floor(n || 0)));
    let u = -1;
    while (n >= 1000 && u < UNITS.length - 1 + 26 * 26) { n /= 1000; u++; }
    let t = n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
    if (t.includes('.')) t = t.replace(/\.?0+$/, ''); // 1.50 → 1.5, but 310 stays 310
    const k = u - UNITS.length, unit = k < 0 ? UNITS[u] : String.fromCharCode(97 + Math.floor(k / 26)) + String.fromCharCode(97 + k % 26);
    return (window.DEC_COMMA ? t.replace('.', ',') : t) + ' ' + unit;
  }

  // ---------- Canvas / layout ----------
  const W = 400, SURF = 250, ROW = 132, TABBAR = 66;
  const $ = id => document.getElementById(id);
  const cvs = $('c'), ctx = cvs.getContext('2d');
  // 3D cut-away of the mine when WebGL is available; the 2D canvas then only draws buttons and numbers.
  const R3 = window.Mine3D ? window.Mine3D.init($('c3d')) : null;
  if (!R3 && $('c3d') && $('c3d').style) $('c3d').style.display = 'none';
  const FONT = "'Baloo', system-ui, sans-serif";
  let dpr = 1, sc = 1, viewTop = 0, viewH = 700, scrollY = 0;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cvs.width = Math.round(innerWidth * dpr); cvs.height = Math.round(innerHeight * dpr);
    sc = innerWidth / W;
    const sa = UI.safeArea();
    viewTop = sa.hudBottom;
    const de = document.documentElement;
    if (de && de.style && de.style.setProperty) de.style.setProperty('--hudh', sa.hudBottom + 'px');
    viewH = (innerHeight - viewTop - sa.bottom - TABBAR) / sc;
    clampScroll();
  }
  const contentH = () => SURF + (G.shafts.length + 1) * ROW + 60;
  function clampScroll() { scrollY = Math.max(0, Math.min(scrollY, contentH() - viewH)); }
  addEventListener('resize', resize);
  resize();
  setTimeout(resize, 400);
  if (document.fonts && document.fonts.load) document.fonts.load("800 14px 'Baloo'").catch(() => { });

  // Runtime (not saved): cycle progress per shaft + elevator trip.
  const run = { shafts: G.shafts.map(() => ({ t: 0, on: false })), elev: { t: 0, on: false, load: 0, took: false }, trans: { t: 0, on: false, load: 0, done: false }, biz: {}, floats: [], time: 0, goalT: 1 };
  let view = 'mine', bizMode = 1;
  let buttons = [];
  let sheetOpen = null;

  // ---------- Simulation ----------
  function tick(dt) {
    run.time += dt;
    // Each miner drops his share into the crate when he gets back, so the pile grows piece by piece.
    const C = cycle();
    G.shafts.forEach((s, i) => {
      const r = run.shafts[i];
      if (s.m) r.on = true;
      if (!r.on) return;
      const n = minersOf(s), step = C / n, prev = r.t;
      r.t += dt;
      const drops = Math.min(n, Math.floor(r.t / step) - Math.floor(prev / step));
      if (drops > 0) s.st += shaftRate(i, s.l) * C * mult() * drops / n;
      if (r.t >= C) {
        r.t -= C;
        if (!s.m) { r.on = false; r.t = 0; }
      }
    });
    // Elevator: pos is in floors (0 = surface, i + 1 = floor i). Down floor by floor, a short stop where there
    // is ore, up when the cage is full or no ore is left below.
    const e = run.elev, V = elevSpeed(G.elev.l);
    if (G.elev.m && !e.on && G.shafts.some(s => s.st > 0.5)) Object.assign(e, { on: true, dir: 1, pos: 0, next: 0, wait: 0, load: 0, room: elevCap(G.elev.l) * mult() });
    if (e.on) {
      e.t = (e.t || 0) + dt;
      const oreBelow = k => G.shafts.some((s, j) => j >= k && s.st > 0.5);
      if (e.wait > 0) e.wait -= dt;
      else if (e.dir > 0) {
        e.pos = Math.min(e.next + 1, e.pos + V * dt);
        if (e.pos >= e.next + 1) {
          const s = G.shafts[e.next], take = Math.min(e.room, s.st);
          if (take > 0) { s.st -= take; e.room -= take; e.load += take; e.wait = STOP; }
          e.next++;
          if (e.room <= 0 || e.next >= G.shafts.length || !oreBelow(e.next)) e.dir = -1;
        }
      } else {
        e.pos = Math.max(0, e.pos - V * dt);
        if (e.pos <= 0) {
          // The elevator unloads into the surface depot; transport takes it to the bank.
          if (e.load > 0) RG().depo += e.load;
          Object.assign(e, { on: false, t: 0, load: 0, pos: 0 });
        }
      }
    }
    const tr = run.trans, TR = RG().trans, ttrip = transTrip(TR.l);
    if (TR.m && !tr.on && RG().depo > 0.5) startTrans();
    if (tr.on) {
      tr.t += dt;
      if (!tr.done && tr.t >= ttrip / 2) {
        tr.done = true;
        if (tr.load > 0) { G.cash += tr.load; G.earned += tr.load; run.floats.push({ txt: '+' + fmt(tr.load), life: 1 }); if (view === 'mine') Sfx.play('cash'); }
      }
      if (tr.t >= ttrip) { tr.on = false; tr.t = 0; tr.load = 0; tr.done = false; }
    }
    // Region goals: checked once a second.
    if ((run.goalT -= dt) <= 0) { run.goalT = 1; checkGoals(); }
    // Village buildings pay continuously; the empire runs construction, training and marches.
    const bg = bizRate() * dt * mult();
    G.cash += bg; G.earned += bg;
    Empire.tick(dt);
    for (const f of run.floats) f.life -= dt * 0.8;
    run.floats = run.floats.filter(f => f.life > 0);
  }
  const minersOf = s => Math.min(3, 1 + Math.floor(s.l / 10));
  function startTrans() {
    const tr = run.trans;
    if (tr.on || RG().depo <= 0.5) return;
    tr.load = Math.min(RG().depo, transCap(RG().trans.l) * mult()); RG().depo -= tr.load;
    tr.on = true; tr.t = 0; tr.done = false;
  }
  // Goals per region: floors, business managers, total earnings. Each gives coins + a permanent +10%.
  const goalText = (k, j) => { k = G.regions[k].b || 0; const g = REGIONS[k].goals; return [L('Open ' + g[0] + ' floors', g[0] + ' kat aç'), L('Build ' + (g[1] + 3) + ' buildings', (g[1] + 3) + ' bina kur'), L('Earn ' + fmt(g[2] * REGIONS[k].mul) + ' in total', fmt(g[2] * REGIONS[k].mul) + ' toplam kazanç')][j]; };
  function goalDone(j) {
    const g = REG().goals, r = RG();
    if (j === 0) return G.shafts.length >= g[0];
    if (j === 1) return Empire.buildingCount() >= g[1] + 3;
    return G.earned >= g[2] * REG().mul;
  }
  function checkGoals() {
    const r = RG();
    for (let j = 0; j < 3; j++) {
      if (r.goals[j] || !goalDone(j)) continue;
      r.goals[j] = true;
      const coins = 5 * (G.cur + 1) * (j + 1);
      Save.addCoins(coins); Sfx.play('win');
      UI.toast(L('🏆 Goal done: ', '🏆 Görev tamam: ') + goalText(G.cur, j) + ' · +' + coins + L(' ⭐, income +10%', ' ⭐, gelir +%10'));
      save();
    }
  }
  // Managed income of region k over secs (mine limited by its elevator + managed businesses).
  function idleGain(k, secs) {
    const cur = G.cur;
    syncRegion(); bindRegion(k);
    const mine = G.elev.m && RG().trans.m ? mineFlow() : 0, gain = (mine + bizRate()) * secs;
    syncRegion(); bindRegion(cur);
    return gain;
  }
  // Regions you are not looking at keep earning with their managers; credited when you return.
  function creditRegion(k, now) {
    const r = G.regions[k];
    if (r.left) {
      const secs = Math.min(offlineCap(), (now - r.left) / 1000);
      if (secs > 5) { const g = idleGain(k, secs); r.cash += g; r.earned = (r.earned || 0) + g; r.left = now; return g; }
    }
    r.left = now;
    return 0;
  }

  // Offline earnings: managed shafts, carried by a managed elevator, limited by the elevator.
  function offline() {
    const now = Date.now();
    if (!G.last) { G.last = now; Save.save(); return; }
    const secs = Math.min(offlineCap(), (now - G.last) / 1000);
    G.last = now;
    G.regions.forEach((r, k) => { if (k !== G.cur) creditRegion(k, now); });
    if (secs < 60) return;
    const gain = idleGain(G.cur, secs) * (1 + card('gece'));
    if (gain < 1) return;
    const mins = Math.round(secs / 60);
    panel('<div class="ribbon">' + L('WHILE YOU WERE AWAY', 'SEN YOKKEN') + '</div><div class="stars"><span>⛏️</span></div>' +
      '<p class="sub">' + L('Your managers worked for ', 'Yöneticilerin ') + (mins >= 60 ? Math.floor(mins / 60) + L(' h ', ' sa ') + (mins % 60) + L(' min', ' dk') : mins + L(' min', ' dk')) + L('', ' boyunca çalıştı') + (secs >= offlineCap() ? L(' (max ' + offlineCap() / 3600 + ' hours)', ' (en fazla ' + offlineCap() / 3600 + ' saat)') : '') + '.</p>' +
      '<div class="reward">💵 +' + fmt(gain) + '</div>' +
      '<button class="btn gold big pulse" data-act="offline" data-arg="2"><span class="ad-ico">AD</span>' + L('2x CLAIM', '2x AL') + ' · +' + fmt(gain * 2) + '</button>' +
      '<button class="btn gray" data-act="offline" data-arg="1">' + L('Claim', 'Al') + '</button>', true);
    pendingOffline = gain;
  }
  let pendingOffline = 0;

  // ---------- Input: drag to scroll, tap to press drawn buttons ----------
  // A fling keeps gliding after the finger lifts and slows down (velocity from the last ~80 ms of the drag);
  // touching the screen stops it at once.
  let drag = null, flingV = 0;
  cvs.addEventListener('pointerdown', e => { flingV = 0; drag = { y: e.clientY, s: scrollY, moved: false, hist: [[performance.now(), e.clientY]] }; try { cvs.setPointerCapture(e.pointerId); } catch (_) { } });
  cvs.addEventListener('pointermove', e => {
    if (!drag) return;
    const dy = e.clientY - drag.y, t = performance.now();
    if (Math.abs(dy) > 14) drag.moved = true;
    if (drag.moved) { scrollY = drag.s - dy / sc; clampScroll(); }
    drag.hist.push([t, e.clientY]); while (drag.hist.length > 2 && t - drag.hist[0][0] > 80) drag.hist.shift();
  });
  function stepFling(dt) {
    if (!flingV || drag) return;
    scrollY += flingV * dt; const before = scrollY; clampScroll();
    if (scrollY !== before) flingV = 0; // hit the top or bottom
    flingV *= Math.pow(0.04, dt);       // friction: ~96% of the speed gone after a second
    if (Math.abs(flingV) < 20) flingV = 0;
  }
  // Taps go through the browser's click (it already tells a tap from a scroll, with a finger-sized slop);
  // pointer events only drive scrolling. A little padding makes the drawn buttons easier to hit.
  let lastDragMoved = false;
  cvs.addEventListener('pointerup', e => {
    lastDragMoved = !!(drag && drag.moved);
    if (drag && drag.moved && drag.hist.length > 1) {
      const a = drag.hist[0], b = [performance.now(), e.clientY], dtv = (b[0] - a[0]) / 1000;
      if (dtv > 0.005) flingV = Math.max(-6000, Math.min(6000, -(b[1] - a[1]) / dtv / sc));
      if (Math.abs(flingV) < 150) flingV = 0;
    }
    drag = null;
  });
  cvs.addEventListener('pointercancel', () => { drag = null; });
  cvs.addEventListener('click', e => {
    if (lastDragMoved || !$('ov').classList.contains('hidden')) { lastDragMoved = false; return; }
    const x = e.clientX / sc, y = (e.clientY - viewTop) / sc + scrollY, pad = 6;
    const b = buttons.find(b => x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad);
    if (b) { Sfx.play('click'); actions[b.act](b.arg); }
  });

  // ---------- Actions ----------
  const actions = {
    dig(i) { const r = run.shafts[i]; if (!r.on) { r.on = true; r.t = 0; UI.vibrate(10); } },
    haul() { const e = run.elev; if (!e.on) { Object.assign(e, { on: true, dir: 1, pos: 0, next: 0, wait: 0, load: 0, room: elevCap(G.elev.l) * mult(), t: 0 }); UI.vibrate(10); } },
    shaft(i) { openShaft(+i); },
    elev() { openElev(); },
    trans() { openTrans(); },
    haulT() { if (!run.trans.on) { if (RG().depo <= 0.5) { UI.toast(L('The depot is empty: bring ore up with the elevator first', 'Depo boş: önce asansörle cevher çıkar')); return; } startTrans(); UI.vibrate(10); } },
    // Shop: daily deals, Manager Chests, the store pack.
    mdeal(id) {
      const d = mineDeals()[+id]; if (!d || d.got) return;
      if (!Save.spend(d.cost)) { UI.toast(L('Not enough ⭐ stars', 'Yetersiz ⭐ yıldız')); return; }
      G.deals.got.push(d.id);
      if (d.id === 0) { const v = d.inc * 3 * 3600; G.cash += v; G.earned += v; if (window.Fx) Fx.reveal({ title: L('Daily deal', 'Günlük fırsat'), items: [{ icon: '💵', label: '+' + fmt(v), sub: L('3 h of income', '3 saatlik gelir'), rarity: 'legendary' }] }).then(renderShop); }
      else if (d.id === 1) openManagerChests(1);
      else { G.elev.l += 10; if (window.Fx) Fx.reveal({ title: L('Daily deal', 'Günlük fırsat'), items: [{ icon: '🛗', label: L('Elevator Lv.', 'Asansör Sv.') + G.elev.l, sub: '+10', rarity: 'epic' }] }).then(renderShop); }
      save(); renderShop();
    },
    async mchest(arg) {
      if (arg === 'free') {
        if (!(await Ads.rewarded('maden_manager_chest'))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
        G.chest.free = today(); return openManagerChests(1);
      }
      const n = +arg, c = n >= 10 ? CHEST10 : CHEST_COST;
      if (!Save.spend(c)) { UI.toast(L('Not enough ⭐ stars', 'Yetersiz ⭐ yıldız')); return; }
      openManagerChests(n);
    },
    async mpack() { if (!window.IAP) return; const r = await IAP.buy('pack_maden'); if (r === 'unavailable') UI.toast(L('Store unavailable right now', 'Mağaza şu an kullanılamıyor')); applyPacks(); renderShop(); },
    // Star-coin shop.
    perkBuy(k) {
      const p = PERKS[k], l = G.shop[k];
      if (l >= p.max) return;
      if (!Save.spend(p.cost(l))) { UI.toast(L('Not enough stars', 'Yetersiz yıldız')); return; }
      G.shop[k]++; Sfx.play('coin'); UI.toast(p.icon + ' ' + p.name + ' ↑'); save(); renderShop();
    },
    skin(k) { actions.outfit(k); }, skinBuy(k) { actions.outfitBuy(k); }, skinAd(k) { actions.outfitAd(k); },
    cSel(arg) { const [c, k] = arg.split(':'), [, sel, own] = COLL[c]; if (G.shop[own].includes(k)) { G.shop[sel] = k; save(); applyOutfit(); Empire.markDirty(); renderShop(); } },
    cBuy(arg) {
      const [c, k] = arg.split(':'), [set, sel, own] = COLL[c];
      if (!Save.spend(set[k].cost)) { UI.toast(L('Not enough ⭐ stars', 'Yetersiz ⭐ yıldız')); return; }
      G.shop[own].push(k); G.shop[sel] = k; Sfx.play('coin'); UI.toast(set[k].name + L(' unlocked!', ' açıldı!')); save(); applyOutfit(); renderShop();
    },
    async cAd(arg) {
      const [c, k] = arg.split(':'), [set, sel, own, ad] = COLL[c];
      if (!(await Ads.rewarded('maden_skin_' + c + '_' + k))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      G.shop[ad]++;
      if (G.shop[ad] >= set[k].ads) { G.shop[own].push(k); G.shop[sel] = k; applyOutfit(); UI.toast(set[k].name + L(' unlocked!', ' açıldı!')); }
      save(); renderShop();
    },
    outfit(k) { if (G.shop.outfits.includes(k)) { G.shop.outfit = k; save(); applyOutfit(); renderShop(); } },
    outfitBuy(k) {
      if (!Save.spend(OUTFITS[k].cost)) { UI.toast(L('Not enough stars', 'Yetersiz yıldız')); return; }
      G.shop.outfits.push(k); G.shop.outfit = k; Sfx.play('coin'); UI.toast(OUTFITS[k].name + L(' unlocked!', ' açıldı!')); save(); applyOutfit(); renderShop();
    },
    async outfitAd(k) {
      if (!(await Ads.rewarded('maden_outfit_' + k))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      G.shop.adOutfit++;
      if (G.shop.adOutfit >= OUTFITS[k].ads) { G.shop.outfits.push(k); G.shop.outfit = k; applyOutfit(); UI.toast(OUTFITS[k].name + L(' unlocked!', ' açıldı!')); }
      save(); renderShop();
    },
    // Rewarded: one hour of the current passive income right away (every 15 minutes).
    async gift() {
      if (Date.now() < G.giftAt) { UI.toast(L('Gift ready in ' + Math.ceil((G.giftAt - Date.now()) / 60000) + ' min', 'Hediye ' + Math.ceil((G.giftAt - Date.now()) / 60000) + ' dk sonra hazır')); return; }
      const amount = Math.max(100 * RM(), ((G.elev.m && RG().trans.m ? mineFlow() : 0) + bizRate()) * 3600) * (1 + card('bankaci'));
      if (!(await Ads.rewarded('maden_gift'))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      G.cash += amount; G.earned += amount; G.giftAt = Date.now() + 15 * 60e3;
      Sfx.play('coin'); UI.toast('🎁 +' + fmt(amount)); save(); if (view === 'shop') renderShop();
    },
    // Town workshop (speed) + ad boost.
    unlock() {
      const i = G.shafts.length, cost = unlockCost(i);
      if (!canUnlockDepth(i)) { UI.toast(L('Floor ' + i + ' must reach Lv.' + unlockNeed(i) + ' first', 'Önce Kat ' + i + ' Sv.' + unlockNeed(i) + ' olmalı')); return; }
      if (G.cash < cost) { UI.toast(L('Not enough cash', 'Yetersiz nakit')); return; }
      G.cash -= cost;
      G.shafts.push({ l: 1, m: false, st: 0 });
      run.shafts.push({ t: 0, on: false });
      const bonus = 2 + i;
      Save.addCoins(bonus);
      Sfx.play('win');
      UI.toast(L('⛏️ Floor ' + (i + 1) + ' opened! +', '⛏️ Kat ' + (i + 1) + ' açıldı! +') + bonus + ' ⭐');
      Ads.track('mine_unlock', { shaft: i + 1 });
      save();
    },
    mgr(arg) {
      if (arg === 'e') {
        if (G.cash < elevMgrCost()) { UI.toast(L('Not enough cash', 'Yetersiz nakit')); return; }
        G.cash -= elevMgrCost(); G.elev.m = true;
      } else if (arg === 't') {
        if (G.cash < transMgrCost()) { UI.toast(L('Not enough cash', 'Yetersiz nakit')); return; }
        G.cash -= transMgrCost(); RG().trans.m = true;
      } else {
        const i = +arg, c = shaftMgrCost(i);
        if (G.cash < c) { UI.toast(L('Not enough cash', 'Yetersiz nakit')); return; }
        G.cash -= c; G.shafts[i].m = true;
      }
      Sfx.play('coin'); UI.toast(L('👷 Manager hired!', '👷 Yönetici işe başladı!')); save();
    },
    oddsTip() { const b = document.querySelector('[data-act=oddsTip]'); if (b && window.Kit) Kit.tip(b, '<b>' + L('Chest odds', 'Sandık olasılıkları') + '</b><small>' + chestOdds() + '</small>', 5000); },
    async boost() {
      if (!(await Ads.rewarded('maden_boost'))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      G.boostUntil = Math.min(Date.now() + 4 * 3600e3, Math.max(Date.now(), G.boostUntil) + 30 * 60e3);
      UI.toast(L('⚡ 2x production for 30 minutes!', '⚡ 30 dakika 2x üretim!')); Sfx.play('power'); save();
    },
    up(arg) {
      const [what, n] = arg.split(':');
      const times = n === 'max' ? 1000 : +n;
      let bought = 0;
      for (let k = 0; k < times; k++) {
        if (what === 'e') { const c = elevCost(G.elev.l); if (G.cash < c) break; G.cash -= c; G.elev.l++; }
        else if (what === 't') { const c = transCost(RG().trans.l); if (G.cash < c) break; G.cash -= c; RG().trans.l++; }
        else {
          const i = +what, s = G.shafts[i], c = shaftCost(i, s.l);
          if (G.cash < c) break;
          G.cash -= c; s.l++;
          if (s.l % 25 === 0) { Save.addCoins(1); UI.toast(s.l <= 100 ? L('🎉 Lv.' + s.l + ': production 2x! +1 ⭐', '🎉 Sv.' + s.l + ': üretim 2x! +1 ⭐') : L('🎉 Lv.' + s.l + ': production +25%! +1 ⭐', '🎉 Sv.' + s.l + ': üretim +%25! +1 ⭐')); }
        }
        bought++;
      }
      if (!bought) { UI.toast(L('Not enough cash', 'Yetersiz nakit')); return; }
      Ads.track('mine_upgrade', { what, n: bought });
      Sfx.play('coin'); save();
      what === 'e' ? openElev() : what === 't' ? openTrans() : openShaft(+what);
    },
    async offline(m) {
      if (!pendingOffline) return;
      if (+m === 2 && !(await Ads.rewarded('maden_offline_x2'))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      const g = pendingOffline * (+m === 2 ? 2 : 1);
      pendingOffline = 0; G.cash += g; G.earned += g; save();
      closePanel(); UI.toast('💵 +' + fmt(g)); Sfx.play('coin');
    },
    close() { closePanel(); },
    tab(v) { setView(v); },
    home() { save(); UI.goHome('../index.html'); },
  };

  function upButtons(key, costFn, level) {
    let c1 = costFn(level), c10 = 0, n = 0, cm = 0, lv = level, cash = G.cash;
    for (let k = 0; k < 10; k++) c10 += costFn(level + k);
    while (n < 1000) { const c = costFn(lv); if (cash < c) break; cash -= c; cm += c; lv++; n++; }
    // The MAX count sits in a corner badge so big counts (x100, x1000) never widen the button.
    return '<div class="row upbs">' +
      '<button class="btn ' + (G.cash >= c1 ? 'green' : 'gray') + '" data-act="up" data-arg="' + key + ':1">x1<small>💵 ' + fmt(c1) + '</small></button>' +
      '<button class="btn ' + (G.cash >= c10 ? 'green' : 'gray') + '" data-act="up" data-arg="' + key + ':10">x10<small>💵 ' + fmt(c10) + '</small></button>' +
      '<button class="btn ' + (n ? 'gold' : 'gray') + '" data-act="up" data-arg="' + key + ':max">' + L('MAX', 'MAKS') + (n ? '<em class="upn no-gi">×' + fmt(n) + '</em>' : '') + '<small>💵 ' + fmt(cm || c1) + '</small></button></div>';
  }
  function openShaft(i) {
    const s = G.shafts[i], ore = oreOf(i), next25 = (Math.floor(s.l / 25) + 1) * 25;
    panel('<p class="t-lg">' + L('Floor ', 'Kat ') + (i + 1) + ' · ' + ore.name + '</p>' +
      '<span class="chip">' + L('Level ', 'Seviye ') + s.l + ' · ' + (s.m ? L('👷 managed', '👷 yönetici var') : L('dug by hand', 'elle kazılıyor')) + '</span>' +
      '<div class="upg"><div><b>' + L('Production', 'Üretim') + '</b><small>' + fmt(shaftRate(i, s.l)) + L('/s → ', '/sn → ') + fmt(shaftRate(i, s.l + 1)) + L('/s', '/sn') + '</small></div></div>' +
      '<div class="upg"><div><b>' + (next25 <= 100 ? L('Next 2x bonus', 'Sonraki 2x bonus') : L('Next +25% bonus', 'Sonraki +%25 bonus')) + '</b><small>' + L('Level ' + next25 + ' (' + (next25 - s.l) + ' levels to go)', 'Seviye ' + next25 + ' (' + (next25 - s.l) + ' seviye kaldı)') + '</small></div></div>' +
      upButtons(String(i), l => shaftCost(i, l), s.l) +
      '<button class="btn gray small" data-act="close">' + L('Close', 'Kapat') + '</button>');
    sheetOpen = 'shaft';
  }
  function openTrans() {
    const l = RG().trans.l, reg = REG();
    panel('<p class="t-lg">🚚 ' + reg.car + '</p><span class="chip">' + L('Level ', 'Seviye ') + l + ' · ' + (RG().trans.m ? L('👷 has a driver', '👷 sürücü var') : L('sent by hand', 'elle gönderiliyor')) + '</span>' +
      '<div class="upg"><div><b>' + L('Capacity', 'Kapasite') + '</b><small>' + fmt(transCap(l)) + ' → ' + fmt(transCap(l + 1)) + L(' / trip', ' / sefer') + '</small></div></div>' +
      '<div class="upg"><div><b>' + L('Haul rate', 'Taşıma hızı') + '</b><small>' + fmt(transRate()) + L('/s (elevator: ', '/sn (asansör: ') + fmt(elevRate()) + L('/s)', '/sn)') + '</small></div></div>' +
      '<div class="upg"><div><b>' + L('Waiting in the depot', 'Depoda bekleyen') + '</b><small>' + fmt(RG().depo) + '</small></div></div>' +
      (transRate() < Math.min(totalRate(false), elevRate()) ? '<div class="hint">' + L('💡 The depot fills with ore you cannot haul. Upgrade the vehicle!', '💡 Depo taşıyamadığın cevherle doluyor. Aracı yükselt!') + '</div>' : '') +
      upButtons('t', transCost, l) +
      '<button class="btn gray small" data-act="close">' + L('Close', 'Kapat') + '</button>');
    sheetOpen = 'trans';
  }
  function openElev() {
    const l = G.elev.l;
    panel('<p class="t-lg">' + L('Elevator', 'Asansör') + '</p><span class="chip">' + L('Level ', 'Seviye ') + l + ' · ' + (G.elev.m ? L('👷 managed', '👷 yönetici var') : L('run by hand', 'elle çalışıyor')) + '</span>' +
      '<div class="upg"><div><b>' + L('Capacity', 'Kapasite') + '</b><small>' + fmt(elevCap(l)) + ' → ' + fmt(elevCap(l + 1)) + L(' / trip', ' / tur') + '</small></div></div>' +
      '<div class="upg"><div><b>' + L('Haul rate', 'Taşıma hızı') + '</b><small>' + fmt(elevRate()) + L('/s (all floors: ', '/sn (katların toplamı: ') + fmt(totalRate(false)) + L('/s)', '/sn)') + '</small></div></div>' +
      (elevRate() < totalRate(false) ? '<div class="hint">' + L('💡 The elevator cannot keep up with the floors. Upgrade it!', '💡 Asansör katlara yetişemiyor. Onu yükselt!') + '</div>' : '') +
      upButtons('e', elevCost, l) +
      '<button class="btn gray small" data-act="close">' + L('Close', 'Kapat') + '</button>');
    sheetOpen = 'elev';
  }

  function panel(html, center) {
    // Redrawing an open panel (tab switch, upgrade) swaps its content only, so the pop-in animation doesn't replay.
    const ov = $('ov'), cls = 'overlay' + (center ? ' center' : ''), sh = ov.className === cls && ov.querySelector(':scope > .sheet');
    ov.className = cls;
    if (sh) sh.innerHTML = html; else ov.innerHTML = '<div class="sheet">' + html + '</div>';
    Ads.banner(true);
  }
  function closePanel() { $('ov').classList.add('hidden'); sheetOpen = null; Ads.banner(false); }
  $('ov').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled && actions[b.dataset.act]) { Sfx.play('click'); actions[b.dataset.act](b.dataset.arg); }
    else if (e.target === $('ov') && !pendingOffline) closePanel();
  });
  $('homeBtn').onclick = () => actions.home();
  $('boostBtn').onclick = () => actions.boost();
  $('soundBtn').textContent = Sfx.icon();
  $('soundBtn').onclick = () => { UI.toast(Sfx.toggle()); $('soundBtn').textContent = Sfx.icon(); };
  UI.onBack(() => {
    if (!$('ov').classList.contains('hidden') && !pendingOffline) closePanel();
    else if (view !== 'mine') setView('mine');
    else actions.home();
  });

  function save() { syncRegion(); G.last = Date.now(); Save.save(); }
  setInterval(save, 5000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else offline(); });

  // ---------- Empire hookup ----------
  // Run fn with village k bound as the active one (for other villages' numbers).
  function withRegion(k, fn) {
    if (k === G.cur) return fn();
    const cur = G.cur; syncRegion(); bindRegion(k);
    try { return fn(); } finally { syncRegion(); bindRegion(cur); }
  }
  function newVillage(b, x, y, name, floors) {
    const v = newRegion(b, { x, y, name, left: Date.now(), iron: 2000, protectUntil: Date.now() + 24 * 3600e3 });
    if (floors) { v.shafts = Array.from({ length: floors }, (_, i) => ({ l: Math.max(1, 20 - i * 2), m: true, st: 0 })); v.elev = { l: 20, m: true }; v.trans = { l: 20, m: true }; }
    G.regions.push(v); Empire.ensureVillage(v, G.regions.length - 1); save();
    return G.regions.length - 1;
  }
  Empire.init({
    G, REGIONS, actions, fmt, toast: m => UI.toast(m), sfx: n => Sfx.play(n), save: () => save(), panel: h => panel(h), closePanel: () => closePanel(),
    mulOf: k => REGIONS[G.regions[k == null ? G.cur : k].b || 0].mul,
    cash: () => G.cash, spend: c => { if (G.cash < c) return false; G.cash -= c; return true; },
    cashOf: k => (k == null || k === G.cur ? G.cash : G.regions[k].cash),
    addCash: (k, v) => { if (k == null || k === G.cur) { G.cash += v; if (v > 0) G.earned += v; } else { G.regions[k].cash += v; } },
    incomeOf: k => withRegion(k, () => (G.elev.m && RG().trans.m ? mineFlow() : 0) + bizRate()),
    bizIncomeOf: (t, l, k) => withRegion(k == null ? G.cur : k, () => bizPerSec(t, l)),
    newVillage, switchRegion: k => switchRegion(k), setView: v => setView(v),
    skins: () => ({ hue: VTHEMES[G.shop.vtheme] ? VTHEMES[G.shop.vtheme].hue : undefined, vid: G.shop.vtheme, wallId: WSKINS[G.shop.wskin] ? G.shop.wskin : 'tas' }),
    mineOf: k => withRegion(k == null ? G.cur : k, () => ({ floors: G.shafts.length, best: G.shafts.reduce((a, s) => Math.max(a, s.l), 0) })),
  });

  // ---------- Regions, town and map views ----------
  setInterval(() => {
    const now = Date.now();
    G.regions.forEach((r, k) => { if (k !== G.cur) creditRegion(k, now); });
  }, 10000);
  // Village / mine switcher (the region pill in the HUD).
  function regionList() {
    let h = '<p class="t-lg">' + L('🏘️ Your villages', '🏘️ Köylerin') + '</p><p class="sub">' + L('Every village has its own treasury. Money travels between villages by caravan from the Mine Market. Tap a village to go there.', 'Her köyün kendi kasası var. Köyler arası para, Maden Pazarı\'ndan kervanla gider. Geçmek istediğin köye dokun.') + '</p><div class="rlist">';
    G.regions.forEach((r, k) => {
      const b = REGIONS[r.b || 0], rate = k === G.cur ? (G.elev.m && RG().trans.m ? mineFlow() : 0) + bizRate() : idleGain(k, 1);
      h += '<button class="rrow' + (k === G.cur ? ' new' : '') + '" data-act="goRegion" data-arg="' + k + '"><i class="ok">' + b.icon + '</i><span><b>' + (k === 0 ? '👑 ' : '') + (r.name || b.name) + (k === G.cur ? L(' · you are here', ' · buradasın') : '') + '</b><small>' + b.name + ' · ' + r.shafts.length + L(' floors · 💵 ', ' kat · 💵 ') + fmt(k === G.cur ? G.cash : r.cash) + ' · +' + fmt(rate) + L('/s', '/sn') + '</small></span></button>';
    });
    panel(h + '</div><div class="row"><button class="btn small" data-act="tab" data-arg="map">' + L('🗺️ Map', '🗺️ Harita') + '</button><button class="btn gray small" data-act="close">' + L('Close', 'Kapat') + '</button></div>');
  }
  $('regionPill').onclick = () => { Sfx.play('click'); regionList(); };
  actions.goRegion = k => { k = +k; closePanel(); if (k !== G.cur) switchRegion(k); setView(view); };
  function switchRegion(k) {
    syncRegion();
    G.regions[G.cur].left = Date.now();
    bindRegion(k);
    const g = creditRegion(k, Date.now());
    run.shafts = G.shafts.map(() => ({ t: 0, on: false }));
    run.elev = { t: 0, on: false, load: 0, took: false }; run.trans = { t: 0, on: false, load: 0, done: false }; run.biz = {}; run.floats = [];
    scrollY = 0;
    if (R3 && R3.setTheme) R3.setTheme(REG());
    if (g > 0) UI.toast(L('👷 Your managers earned ' + fmt(g) + ' while you were away', '👷 Yöneticiler sen yokken ' + fmt(g) + ' kazandı'));
    save();
  }
  const tabButtons = () => (document.querySelectorAll ? Array.from(document.querySelectorAll('.tabbar button')) : []);
  function setView(v) {
    view = v;
    $('town').classList.toggle('hidden', v !== 'town');
    $('map').classList.toggle('hidden', v !== 'map');
    $('shop').classList.toggle('hidden', v !== 'shop');
    // Hide the mine canvases behind the other tabs (it used to peek out under the HUD).
    for (const id of ['c', 'c3d']) if ($(id) && $(id).style) $(id).style.visibility = v === 'mine' ? '' : 'hidden';
    document.body.classList.toggle('offmine', v !== 'mine');
    tabButtons().forEach(b => b.classList.toggle('on', b.dataset.arg === v));
    if (v === 'town') Empire.renderVillage($('town'));
    if (v === 'map') Empire.renderMap($('map'));
    if (v === 'shop') renderShop();
  }
  const secsTxt = t => (t >= 60 ? Math.floor(t / 60) + L('m', 'dk') + (t % 60 ? ' ' + Math.round(t % 60) + L('s', 'sn') : '') : Math.ceil(t) + L('s', 'sn'));
  // Previews of what a skin changes: a miner in the outfit, a house with the theme's roof, a piece of the wall.
  function skinArt(kind, sk) {
    const c = sk.color || '#888', svg = b => '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' + b + '</svg>';
    if (kind === 'outfit') return svg('<rect x="22" y="34" width="20" height="20" rx="5" fill="' + c + '" stroke="#2a1606" stroke-width="2.5"/><rect x="18" y="52" width="12" height="7" rx="2" fill="#5a3a22"/><rect x="34" y="52" width="12" height="7" rx="2" fill="#5a3a22"/>' +
      '<circle cx="32" cy="27" r="10" fill="#ffd2a8" stroke="#2a1606" stroke-width="2.5"/><path d="M20 25 Q32 8 44 25 Z" fill="' + (sk.hat || '#ffd23f') + '" stroke="#2a1606" stroke-width="2.5"/><circle cx="32" cy="19" r="3" fill="#fff8b0"/>' +
      '<path d="M46 30 L56 46" stroke="#8a5a2b" stroke-width="3.5"/><path d="M50 28 Q57 30 60 36" fill="none" stroke="#9aa6b8" stroke-width="4"/>');
    if (kind === 'vtheme') { const roof = sk.hue != null ? 'hsl(' + sk.hue + ',75%,50%)' : c;
      return svg('<rect x="12" y="30" width="40" height="26" fill="#efe2c4" stroke="#2a1606" stroke-width="2.5"/><path d="M8 32 L32 12 L56 32 Z" fill="' + roof + '" stroke="#2a1606" stroke-width="2.5"/><rect x="27" y="40" width="10" height="16" fill="#7a4a22"/>' +
        '<path d="M46 12 L46 2" stroke="#2a1606" stroke-width="2"/><path d="M46 2 L58 6 L46 10 Z" fill="' + roof + '"/><rect x="16" y="36" width="7" height="7" fill="#9fd8ff" stroke="#2a1606" stroke-width="1.5"/><rect x="41" y="36" width="7" height="7" fill="#9fd8ff" stroke="#2a1606" stroke-width="1.5"/>'); }
    const w = sk.tint || c;
    return svg('<path d="M6 58 V28 h8 v-6 h8 v6 h8 v-6 h8 v6 h8 v-6 h8 v6 h4 V58 Z" fill="' + w + '" stroke="#2a1606" stroke-width="2.5"/><path d="M6 40 H58 M6 50 H58 M18 28 V40 M34 28 V40 M50 28 V40 M26 40 V50 M42 40 V50 M14 50 V58 M30 50 V58 M46 50 V58" stroke="rgba(0,0,0,.28)" stroke-width="1.5"/>' +
      '<rect x="26" y="44" width="12" height="14" rx="6" fill="#3a2414"/>');
  }
  // Daily deals (reset at midnight): income, a cheap Manager Chest, elevator levels.
  const today = () => new Date().toDateString();
  function mineDeals() {
    if (!G.deals || G.deals.day !== today()) G.deals = { day: today(), got: [] };
    const inc = Math.max(100, ((G.elev.m && RG().trans.m ? mineFlow() : 0) + bizRate()));
    return [
      { id: 0, icon: '💵', title: L('3 h of income', '3 saatlik gelir'), val: fmt(inc * 3 * 3600), cost: 30, off: 40 },
      { id: 1, icon: '🎴', title: L('Manager Chest', 'Yönetici Sandığı'), val: '×1', cost: 35, off: 30 },
      { id: 2, icon: '🛗', title: L('Elevator +10 Lv.', 'Asansör +10 Sv.'), val: L('free upgrade', 'bedava geliştirme'), cost: 40, off: 50 },
    ].map(d => Object.assign(d, { got: G.deals.got.includes(d.id), inc }));
  }
  const CHEST_COST = 50, CHEST10 = 450, RW = { common: 50, rare: 32, epic: 15, legendary: 3 };
  function rollCard(minRare) {
    const keys = Object.keys(CARDS).filter(k => !minRare || CARDS[k].r !== 'common'), tot = keys.reduce((a, k) => a + RW[CARDS[k].r], 0);
    let x = Math.random() * tot; for (const k of keys) { x -= RW[CARDS[k].r]; if (x <= 0) return k; } return keys[0];
  }
  // Odds shown in the shop, derived from the same weights rollCard() uses.
  function chestOdds() {
    const keys = Object.keys(CARDS), tot = keys.reduce((a, k) => a + RW[CARDS[k].r], 0);
    const p = r => keys.filter(k => CARDS[k].r === r).reduce((a, k) => a + RW[CARDS[k].r], 0) / tot;
    const f = x => (Math.round(x * 1000) / 10).toLocaleString(LANG);
    return L('Odds: Common ' + f(p('common')) + '%, Rare ' + f(p('rare')) + '%, Epic ' + f(p('epic')) + '%, Legendary ' + f(p('legendary')) + '% · Legendary guaranteed by the 30th chest',
      'Olasılıklar: Sıradan %' + f(p('common')) + ', Nadir %' + f(p('rare')) + ', Epik %' + f(p('epic')) + ', Efsanevi %' + f(p('legendary')) + ' · 30. sandıkta Efsanevi garanti');
  }
  // Opens n Manager Chests: 10 at once guarantee an Epic or better; a visible counter guarantees a Legendary every 30.
  function openManagerChests(n) {
    const got = [];
    for (let i = 0; i < n; i++) {
      G.chest.pity = (G.chest.pity || 0) + 1;
      let k = rollCard(false);
      if (G.chest.pity >= 30) k = 'kral';
      if (n >= 10 && i === n - 1 && !got.some(x => ['epic', 'legendary'].includes(CARDS[x].r))) k = Math.random() < 0.2 ? 'kral' : Math.random() < 0.5 ? 'kazmaci' : 'kasif';
      if (CARDS[k].r === 'legendary') G.chest.pity = 0;
      got.push(k);
      G.cards[k] = Math.min(CARD_MAX, (G.cards[k] || 0) + 1);
    }
    save(); Ads.track('chest_open', { game: 'maden', n });
    const items = got.map(k => ({ icon: CARDS[k].icon, label: CARDS[k].name, sub: L('Lv.', 'Sv.') + cardLv(k) + ' · ' + CARDS[k].desc(card(k)), rarity: CARDS[k].r }));
    if (window.Fx) Fx.reveal({ title: L('Manager Chest', 'Yönetici Sandığı'), chest: n >= 10 ? 'royal' : 'gold', items }).then(renderShop); else renderShop();
  }
  // A pack bought through the store (ortak/iap.js marks it pending): 12 h income, 5 chests, the royal outfit.
  function applyPacks() {
    const g = Save.load().games.maden; if (!g || !g.packPending) return;
    const n = g.packPending; g.packPending = 0; G.packPending = 0;
    const inc = Math.max(100, ((G.elev.m && RG().trans.m ? mineFlow() : 0) + bizRate()));
    G.cash += inc * 12 * 3600 * n; G.earned += inc * 12 * 3600 * n;
    if (!G.shop.outfits.includes('kral')) G.shop.outfits.push('kral');
    G.shop.outfit = 'kral'; applyOutfit(); openManagerChests(5 * n);
  }
  document.addEventListener('offer', e => { if (e.detail === 'pack_maden') applyPacks(); });
  function renderShop() {
    const coins = Save.data.coins, giftLeft = G.giftAt - Date.now(), deals = mineDeals(), freeChest = G.chest.free !== today();
    const P = window.IAP && IAP.OFFERS.pack_maden, owned = window.IAP && IAP.bought('pack_maden');
    let h = '<div class="shead"><b>' + L('Mine Shop', 'Maden Mağazası') + '</b><span class="bal">⭐ ' + Kit.fmt(coins) + '</span></div>' +
      // 1. Daily
      '<div class="msect">🔥 ' + L('Daily deals', 'Günlük fırsatlar') + '</div><div class="mdeals">' +
      '<div class="mdeal free"><em class="g">' + L('FREE', 'BEDAVA') + '</em><div class="di">🎁</div><b>' + L('Mine Gift', 'Maden Hediyesi') + '</b><small>' + L('1 h of income', '1 saatlik gelir') + '</small>' +
        '<button class="btn small ' + (giftLeft > 0 ? 'gray' : 'green') + '" data-act="gift">' + (giftLeft > 0 ? '⏳ ' + Math.ceil(giftLeft / 60000) + L(' min', ' dk') : '<span class="ad-ico">AD</span>' + L('Claim', 'Al')) + '</button></div>' +
      deals.map(d => '<div class="mdeal' + (d.got ? ' got' : '') + '"><em>-%' + d.off + '</em><div class="di">' + d.icon + '</div><b>' + d.title + '</b><small>' + d.val + '</small>' +
        (d.got ? '<button class="btn small gray" disabled>✓</button>' : '<button class="btn small ' + (coins >= d.cost ? 'purple' : 'gray') + '" data-act="mdeal" data-arg="' + d.id + '">⭐ ' + d.cost + '</button>') + '</div>').join('') + '</div>' +
      // 2. Managers
      '<div class="msect">🎴 ' + L('Super Managers', 'Süper Yöneticiler') + '</div>' +
      '<div class="mchest"><div class="mci">' + (window.Art ? Art.chest('royal') : '🎴') + '</div><div class="mct"><b>' + L('Manager Chest', 'Yönetici Sandığı') + '<button class="oddsi" data-act="oddsTip">ⓘ</button></b><small>' + L('New managers join, duplicates level up. 10×: Epic+ guaranteed.', 'Yeni yönetici katılır, aynısı seviye atlar. 10×: Epik+ garanti.') + '</small>' +
        '<div class="pity"><i style="width:' + Math.round((G.chest.pity || 0) / 30 * 100) + '%"></i><span>' + L('Legendary in ', 'Efsanevi garantisi: ') + (30 - (G.chest.pity || 0)) + '</span></div></div>' +
        '<div class="mcb">' + (freeChest ? '<button class="btn small green" data-act="mchest" data-arg="free"><span class="ad-ico">AD</span>' + L('Free', 'Bedava') + '</button>' : '<button class="btn small ' + (coins >= CHEST_COST ? 'purple' : 'gray') + '" data-act="mchest" data-arg="1">⭐ ' + CHEST_COST + '</button>') +
        '<button class="btn small ' + (coins >= CHEST10 ? 'gold' : 'gray') + '" data-act="mchest" data-arg="10">10× ⭐ ' + CHEST10 + '</button></div></div>' +
      '<div class="mcards">' + Object.keys(CARDS).map(k => { const C = CARDS[k], lv = cardLv(k);
        return '<div class="mcard r-' + C.r + (lv ? '' : ' none') + '"><span class="rar">' + Kit.rarityName(C.r) + '</span><div class="ci">' + (lv ? C.icon : '❔') + '</div><b>' + C.name + '</b><small>' + (lv ? C.desc(card(k)) : L('Not found yet', 'Henüz bulunmadı')) + '</small>' + (lv ? '<i>' + L('Lv.', 'Sv.') + lv + '</i>' : '') + '</div>'; }).join('') + '</div>' +
      // 3. Pack
      (P ? '<div class="kpack' + (owned ? ' owned' : '') + '"><span class="badge">' + L('ONE TIME', 'TEK SEFER') + '</span><div class="kpi">🎁</div><div class="kpt"><b>' + L('Mine Tycoon Pack', 'Maden Baronu Paketi') + '</b>' +
        '<ul><li>💵 ' + L('12 hours of income', '12 saatlik gelir') + '</li><li>🎴 ' + L('5 Manager Chests', '5 Yönetici Sandığı') + '</li><li>👑 ' + L('Royal outfit (only here)', 'Kraliyet kıyafeti (sadece burada)') + '</li><li>⭐ +' + P.stars + '</li></ul></div>' +
        (owned ? '<button class="btn small gray" disabled>✓ ' + L('Owned', 'Sahipsin') + '</button>' : '<button class="btn gold" data-act="mpack">' + IAP.priceOf('pack_maden') + '</button>') + '</div>' : '') +
      // 4. Permanent boosts
      '<div class="msect">⚡ ' + L('Permanent boosts', 'Kalıcı güçlendirmeler') + '</div>';
    for (const k in PERKS) {
      const p = PERKS[k], l = G.shop[k], max = l >= p.max, c = max ? 0 : p.cost(l);
      h += '<div class="bz"><div class="bz-ico">' + p.icon + '<i>' + l + '/' + p.max + '</i></div><div class="bz-main"><div class="bz-top"><b>' + p.name + '</b><span>' + p.desc(l) + '</span></div>' +
        (max ? '<span class="rg-state">' + L('✓ Max level', '✓ En üst seviye') + '</span>' : '<button class="btn small ' + (coins >= c ? 'gold' : 'gray') + '" data-act="perkBuy" data-arg="' + k + '">' + p.desc(l + 1) + ' · ⭐ ' + Kit.fmt(c) + '</button>') + '</div></div>';
    }
    // 5. Looks, with previews
    h += '<div class="msect">👷 ' + L('Miner Outfits', 'Madenci Kıyafetleri') + '</div>' +
      Kit.skins(OUTFITS, { skin: G.shop.outfit, skins: G.shop.outfits, adSkin: G.shop.adOutfit }, coins, (k, s) => skinArt('outfit', s)) +
      '<div class="msect">🏰 ' + L('Village Themes', 'Köy Temaları') + '</div>' + collSkins('vtheme') +
      '<div class="msect">🧱 ' + L('Wall Skins', 'Sur Skinleri') + '</div>' + collSkins('wskin');
    $('shop').innerHTML = h;
  }
  function applyOutfit() { const o = OUTFITS[G.shop.outfit] || OUTFITS.klasik; if (R3 && R3.setOutfit) R3.setOutfit(o.color, o.hat, G.shop.outfit in OUTFITS ? G.shop.outfit : 'klasik'); }
  $('shop').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && actions[b.dataset.act]) { Sfx.play('click'); actions[b.dataset.act](b.dataset.arg); } });
  $('town').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && actions[b.dataset.act]) { Sfx.play('click'); actions[b.dataset.act](b.dataset.arg); } });
  $('map').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && actions[b.dataset.act]) { Sfx.play('click'); actions[b.dataset.act](b.dataset.arg); } });
  tabButtons().forEach(b => { b.onclick = () => { Sfx.play('click'); setView(b.dataset.arg); }; });

  // ---------- Render ----------
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function text(t, x, y, size, fill, stroke, align) {
    ctx.font = '800 ' + size + 'px ' + FONT; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.26); ctx.strokeStyle = stroke || '#2a1606'; ctx.strokeText(t, x, y);
    ctx.fillStyle = fill || '#fff'; ctx.fillText(t, x, y);
  }
  function button(x, y, w, h, label, color, act, arg, sub) {
    const dark = color === 'gray' ? '#3d4463' : color === 'gold' ? '#c47a00' : color === 'purple' ? '#5a2ec8' : '#149a45';
    const mid = color === 'gray' ? '#6b7394' : color === 'gold' ? '#ffcf3f' : color === 'purple' ? '#a07bff' : '#3be07a';
    ctx.fillStyle = dark; rr(x, y + 4, w, h, 10); ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#ffffff'); g.addColorStop(0.08, mid); g.addColorStop(1, dark);
    ctx.fillStyle = g; rr(x, y, w, h, 10); ctx.fill();
    text(label, x + w / 2, y + (sub ? h * 0.36 : h / 2 + 1), sub ? 13 : 14, '#fff', dark);
    if (sub) { ctx.font = '700 10px ' + FONT; ctx.fillStyle = '#fff'; ctx.fillText(sub, x + w / 2, y + h * 0.74); }
    buttons.push({ x, y, w, h, act, arg });
  }
  function miner(x, y, dir, carrying, ore, swing) {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 14, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff9f1c'; ctx.strokeStyle = '#6b3a00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x, y - 5, 11, Math.PI, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff8b0'; ctx.beginPath(); ctx.arc(x + dir * 8, y - 9, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + dir * 4, y + 1, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + dir * 5, y + 1.5, 1.6, 0, Math.PI * 2); ctx.fill();
    if (swing != null) {
      ctx.save(); ctx.translate(x + dir * 8, y); ctx.rotate(dir * (-0.9 + swing * 1.6));
      ctx.strokeStyle = '#7a4a1e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -18); ctx.stroke();
      ctx.strokeStyle = '#b0b8c8'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-8, -18); ctx.quadraticCurveTo(0, -23, 8, -18); ctx.stroke();
      ctx.restore();
    }
    if (carrying) { ctx.fillStyle = ore; ctx.strokeStyle = '#6b4a00'; ctx.beginPath(); ctx.arc(x - dir * 10, y - 4, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }

  function drawSurface() {
    if (!R3) drawSurfaceScenery();
    const e = run.elev;
    drawSurfaceUI(e);
  }
  function drawSurfaceScenery() {
    ctx.save(); ctx.translate(0, SURF - 200);
    const g = ctx.createLinearGradient(0, 0, 0, SURF);
    g.addColorStop(0, '#6ec3ff'); g.addColorStop(1, '#d4f1ff');
    ctx.fillStyle = g; ctx.fillRect(0, -400, W, SURF + 400);
    ctx.fillStyle = '#fff4a8'; ctx.beginPath(); ctx.arc(330, 40, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (const [x, y] of [[80, 40], [180, 26]]) { ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.arc(x + 16, y - 6, 16, 0, 7); ctx.arc(x + 34, y, 13, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#5bc26b'; ctx.fillRect(0, SURF - 46, W, 16);
    ctx.fillStyle = '#7a5230'; ctx.fillRect(0, SURF - 30, W, 30);
    // Vault building.
    ctx.fillStyle = '#c9504a'; ctx.strokeStyle = '#5a1a14'; ctx.lineWidth = 3;
    rr(232, 70, 150, 84, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8c2a24'; ctx.beginPath(); ctx.moveTo(222, 74); ctx.lineTo(307, 40); ctx.lineTo(392, 74); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; rr(262, 84, 90, 22, 6); ctx.fill(); ctx.stroke();
    text(L('VAULT', 'KASA'), 307, 96, 15, '#fff', '#8a5200');
    ctx.fillStyle = '#3a1e10'; rr(292, 116, 30, 38, 4); ctx.fill();
    for (let k = 0; k < 5; k++) { ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#b37800'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(250 + k * 8, 150 - (k % 2) * 5, 9, 4, 0, 0, 7); ctx.fill(); ctx.stroke(); }
    // Headframe + wheel.
    ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(30, SURF - 30); ctx.lineTo(62, 70); ctx.lineTo(100, SURF - 30); ctx.stroke();
    ctx.save(); ctx.translate(62, 74); ctx.rotate(run.elev.on ? run.time * 4 : 0);
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.stroke();
    for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
  }
  function drawSurfaceUI(e) {
    // Elevator (left) and transport (right) controls above the buildings.
    button(112, 12, 128, 38, L('🛗 Elevator Lv.', '🛗 Asansör Sv.') + G.elev.l, 'green', 'elev', '', fmt(elevCap(G.elev.l) * mult()) + L('/trip', '/tur'));
    if (!G.elev.m) {
      button(112, 56, 60, 32, e.on ? '…' : '▲', e.on ? 'gray' : 'gold', 'haul');
      button(178, 56, 62, 32, '👷', G.cash >= elevMgrCost() ? 'purple' : 'gray', 'mgr', 'e', fmt(elevMgrCost()));
    }
    const T_ = RG().trans, tr = run.trans;
    button(250, 12, 142, 38, '🚚 ' + REG().car + L(' Lv.', ' Sv.') + T_.l, 'green', 'trans', '', fmt(transCap(T_.l) * mult()) + L('/trip', '/sefer'));
    if (!T_.m) {
      button(250, 56, 68, 32, tr.on ? '…' : '▶', tr.on ? 'gray' : 'gold', 'haulT');
      button(324, 56, 68, 32, '👷', G.cash >= transMgrCost() ? 'purple' : 'gray', 'mgr', 't', fmt(transMgrCost()));
    }
    if (RG().depo > 0.5) text('📦 ' + fmt(RG().depo), 140, SURF - 104, 12, '#fff', '#3a1e0a');
    for (const f of run.floats) { ctx.globalAlpha = Math.min(1, f.life * 2); text(f.txt, 327, 110 - (1 - f.life) * 30, 20, '#ffe066', '#6b4a00'); }
    ctx.globalAlpha = 1;
  }

  function minerPos(i) {
    const s = G.shafts[i], r = run.shafts[i], n = minersOf(s), out = [];
    for (let k = 0; k < 3; k++) {
      if (k >= n) { out.push(null); continue; }
      const ph = r.on ? ((r.t / cycle()) + k / n) % 1 : 0;
      let x, dir = 1, carrying = false, swing = null;
      if (ph < 0.35) x = 180 + (ph / 0.35) * 150;
      else if (ph < 0.65) { x = 330; swing = (Math.sin(run.time * 14 + k) + 1) / 2; }
      else { x = 330 - ((ph - 0.65) / 0.35) * 150; dir = -1; carrying = true; }
      if (!r.on) { x = 190 + k * 30; swing = null; carrying = false; dir = 1; }
      out.push({ x, dir, carrying, swing, bob: swing == null && r.on ? Math.abs(Math.sin(ph * 40)) * 2 : 0 });
    }
    return out;
  }
  // Cage height from its position in floors (0 = surface, i + 1 = floor i).
  const cageY = () => { const p = run.elev.on ? run.elev.pos || 0 : 0; return SURF - 40 + p * ROW - 10 * Math.min(1, p); };

  function drawShaft(i, top) {
    const s = G.shafts[i], r = run.shafts[i], ore = oreOf(i).c;
    const t0 = top + 30, t1 = top + ROW - 14;
    if (!R3) {
    // Rock background with stones.
    ctx.fillStyle = i % 2 ? '#5a3c22' : '#62432a'; ctx.fillRect(0, top, W, ROW);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    for (let k = 0; k < 7; k++) { const x = (i * 97 + k * 61) % W, y = top + ((i * 53 + k * 37) % ROW); ctx.beginPath(); ctx.ellipse(x, y, 9, 5, 0, 0, 7); ctx.fill(); }
    // Tunnel.
    ctx.fillStyle = '#2b1c10'; rr(112, t0, 280, t1 - t0, 10); ctx.fill();
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 5;
    for (let x = 190; x < 380; x += 70) { ctx.beginPath(); ctx.moveTo(x, t1); ctx.lineTo(x, t0 + 4); ctx.lineTo(x + 22, t0 + 4); ctx.stroke(); }
    // Rock face with ore veins.
    ctx.fillStyle = '#7b6552'; rr(352, t0 + 4, 36, t1 - t0 - 8, 8); ctx.fill();
    for (let k = 0; k < 5; k++) { ctx.fillStyle = ore; ctx.beginPath(); ctx.arc(362 + (k * 13) % 22, t0 + 16 + k * 14, 4, 0, 7); ctx.fill(); }
    // Crate.
    ctx.fillStyle = '#b07a3e'; ctx.strokeStyle = '#4a2a0c'; ctx.lineWidth = 2.5;
    rr(116, t1 - 34, 48, 34, 4); ctx.fill(); ctx.stroke();
    if (s.st > 0) { ctx.fillStyle = ore; ctx.beginPath(); ctx.arc(128, t1 - 36, 7, Math.PI, 0); ctx.arc(142, t1 - 38, 9, Math.PI, 0); ctx.arc(155, t1 - 35, 6, Math.PI, 0); ctx.fill(); }
    }
    text(fmt(s.st), 140, t1 - 16, 12, '#fff', '#3a1e0a');
    // Miners: walk to the face, dig, walk back with ore.
    if (!R3) for (const mp of minerPos(i)) if (mp) miner(mp.x, t1 - 18 - mp.bob, mp.dir, mp.carrying, ore, mp.swing);
    // Plate + buttons.
    // Plate fits long ore names by shrinking the text.
    const plate = L('FLOOR ', 'KAT ') + (i + 1) + ' · ' + oreOf(i).name.toUpperCase();
    ctx.font = '800 11px ' + FONT;
    const pw = ctx.measureText(plate).width, fs = pw > 104 ? 11 * 104 / pw : 11, bw = Math.max(92, Math.min(118, pw * fs / 11 + 14));
    ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(112, top + 4, bw, 22, 11); ctx.fill();
    text(plate, 112 + bw / 2, top + 15, fs, '#fff', '#000');
    button(290, top + 2, 102, 26, L('⬆ Lv.', '⬆ Sv.') + s.l, G.cash >= shaftCost(i, s.l) ? 'green' : 'gray', 'shaft', String(i));
    ctx.font = '700 11px ' + FONT; ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'right';
    ctx.fillText(fmt(shaftRate(i, s.l) * mult()) + L('/s', '/sn'), 284, top + 16);
    if (!s.m) {
      if (!r.on) button(222, t0 + 22, 64, 40, L('⛏ DIG', '⛏ KAZ'), 'gold', 'dig', String(i));
      else { ctx.fillStyle = 'rgba(255,255,255,.2)'; rr(222, t0 + 50, 64, 6, 3); ctx.fill(); ctx.fillStyle = '#ffd23f'; rr(222, t0 + 50, 64 * r.t / cycle(), 6, 3); ctx.fill(); }
      button(292, t0 + 22, 56, 40, '👷', G.cash >= shaftMgrCost(i) ? 'purple' : 'gray', 'mgr', String(i), fmt(shaftMgrCost(i)));
    } else {
      ctx.fillStyle = '#8b5cf6'; ctx.beginPath(); ctx.arc(190, t0 + 16, 13, 0, 7); ctx.fill();
      text('👷', 190, t0 + 17, 14, '#fff', '#3b1a8a');
    }
  }

  function drawElevatorShaft(bottom) {
    if (R3) return;
    ctx.fillStyle = '#2a2320'; ctx.fillRect(22, SURF - 30, 86, bottom - SURF + 30);
    ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(30, SURF - 30); ctx.lineTo(30, bottom); ctx.moveTo(100, SURF - 30); ctx.lineTo(100, bottom); ctx.stroke();
    const e = run.elev, y = cageY();
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(65, 74); ctx.lineTo(65, y); ctx.stroke();
    ctx.fillStyle = '#9aa3b5'; ctx.strokeStyle = '#2e3354'; ctx.lineWidth = 3;
    rr(36, y, 58, 40, 5); ctx.fill(); ctx.stroke();
    if (e.load > 0) { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(52, y + 30, 8, Math.PI, 0); ctx.arc(70, y + 28, 10, Math.PI, 0); ctx.fill(); }
    ctx.strokeStyle = '#2e3354'; ctx.beginPath(); ctx.moveTo(36, y + 14); ctx.lineTo(94, y + 14); ctx.stroke();
    if (G.elev.m) { ctx.fillStyle = '#8b5cf6'; ctx.beginPath(); ctx.arc(80, y + 10, 8, 0, 7); ctx.fill(); }
  }

  function draw() {
    buttons = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (R3) ctx.clearRect(0, 0, cvs.width, cvs.height);
    else { ctx.fillStyle = '#3a2716'; ctx.fillRect(0, 0, cvs.width, cvs.height); }
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, 0, dpr * (viewTop - scrollY * sc));
    drawSurface();
    const n = G.shafts.length, bottom = SURF + (n + 1) * ROW;
    for (let i = 0; i < n; i++) drawShaft(i, SURF + i * ROW);
    // Locked next shaft.
    const top = SURF + n * ROW;
    if (!R3) {
      ctx.fillStyle = '#2a1a0e'; ctx.fillRect(0, top, W, ROW + 80);
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      for (let k = 0; k < 8; k++) ctx.fillRect(112 + k * 36, top + 30, 20, 60);
    }
    const uc = unlockCost(n);
    text(L('🔒 FLOOR ', '🔒 KAT ') + (n + 1) + ' · ' + oreOf(n).name, 250, top + 40, 16, '#fff', '#000');
    const depthOk = canUnlockDepth(n);
    button(170, top + 62, 160, 44, L('Open new floor', 'Yeni kat aç'), depthOk && G.cash >= uc ? 'gold' : 'gray', 'unlock', '', depthOk ? '💵 ' + fmt(uc) + ' · +' + (2 + n) + ' ⭐' : L('🔒 Floor ' + n + ' Lv.' + unlockNeed(n) + ' needed', '🔒 Kat ' + n + ' Sv.' + unlockNeed(n) + ' gerekli'));
    drawElevatorShaft(bottom);
    hudDom();
  }
  // HUD numbers (DOM) and empire timers: updated on every tab, not only while the mine is drawn.
  function hudDom() {
    UI.txt($('cash'), fmt(G.cash));
    // Warn when the elevator is the bottleneck (ore piles up in the shaft crates).
    // Passive income: only managed shafts, and only if the elevator has a manager too.
    const passive = (G.elev.m && RG().trans.m ? mineFlow() : 0) + bizRate();
    const need = totalRate(true), slowLift = G.elev.m && elevRate() < need * 0.95, slowCar = !slowLift && RG().trans.m && transRate() < Math.min(need, elevRate()) * 0.95;
    UI.txt($('rate'), fmt(passive * mult()) + L('/s', '/sn') + (slowLift ? L(' · ⚠️ elevator', ' · ⚠️ asansör') : slowCar ? L(' · ⚠️ transport', ' · ⚠️ taşıma') : ''));
    UI.prop($('rate'), 'color', slowLift || slowCar ? '#ff8a95' : '');
    const left = G.boostUntil - Date.now();
    UI.html($('boostBtn'), left > 0 ? '⚡ 2x · ' + Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0') : '<span class="ad-ico">AD</span>' + L('2x 30m', '2x 30dk'));
    UI.txt($('coins'), Kit.fmt(Save.data.coins));
    UI.txt($('regionPill'), REG().icon + ' ' + (RG().name || REG().name) + ' ▾');
    // Keep the views below the HUD even if its height changes.
    if ((hudCheck = (hudCheck + 1) % 30) === 0) { const hb = UI.safeArea().hudBottom, de = document.documentElement; if (hb !== viewTop && de && de.style && de.style.setProperty) { resize(); } }
    if (Empire.isDirty()) { if (view === 'town') Empire.renderVillage($('town')); if (view === 'map') Empire.renderMap($('map')); }
    Empire.updateTimers();
  }
  let mapTick = 0, hudCheck = 0;

  let last = performance.now();
  function loop(t) {
    requestAnimationFrame(loop);
    if (t - last < 7) return; // follow the screen (up to 120 Hz): 60 fps looked choppy on 120 Hz phones
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    tick(dt);
    if (view === 'town') Empire.frame(dt);
    if (view !== 'mine') { hudDom(); return; } // the mine is hidden behind the other tabs: don't draw it
    stepFling(dt);
    if (R3) R3.render({ shafts: G.shafts, ores: G.shafts.map((_, i) => oreOf(i).c).concat(oreOf(G.shafts.length).c), SURF, ROW, sc, viewTop, scrollY, time: run.time,
      elevOn: run.elev.on, cageY: cageY(), cageLoad: run.elev.load, minerPos,
      transP: run.trans.on ? run.trans.t / transTrip(RG().trans.l) : 0, transOn: run.trans.on, transLoad: run.trans.load, depo: RG().depo });
    draw();
  }
  // Preview hooks: #demo gives a developed mine, #town / #map open those views.
  if ((location.hash || '').includes('demo')) {
    G.cash = 4e9; G.shafts.length = 0; for (let i = 0; i < 6; i++) G.shafts.push({ l: 60 - i * 8, m: true, st: 0 }); G.elev.l = 60; G.elev.m = true;
    const sl = RG().slots;
    ['rally', 'barracks', 'stable', 'kosk', 'wall', 'demirci', 'kuyumcu', 'pazar'].forEach((t, i) => { sl[i + 1] = { t, l: [3, 8, 5, 10, 6, 20, 25, 15][i] }; });
    RG().iron = 5000; RG().troops = { milis: 120, kilic: 60, hafif: 30, senator: 2, kolonici: 3 };
    run.shafts = G.shafts.map(() => ({ t: 0, on: false }));
    const want = ['col', 'buz', 'volkan', 'ay'].findIndex(id => location.hash.includes(id)) + 1;
    while (want && G.regions.length <= want) G.regions.push(newRegion(G.regions.length, { cash: 1e6 * REGIONS[G.regions.length].mul, shafts: [{ l: 30, m: true, st: 0 }, { l: 20, m: true, st: 0 }, { l: 10, m: false, st: 0 }], elev: { l: 30, m: true }, trans: { l: 30, m: true } }));
    if (want) { bindRegion(want); run.shafts = G.shafts.map(() => ({ t: 0, on: false })); }
  }
  if (R3 && R3.setTheme) R3.setTheme(REG());
  applyOutfit();
  offline();
  { const m = (location.hash || '').match(/town|map|shop/); if (m) setView(m[0]); }
  // Test hook: #demo-taptest taps the elevator button like a finger and reports what opened.
  if ((location.hash || '').includes('taptest')) setTimeout(() => {
    const b = buttons.find(x => x.act === 'elev'), out = [];
    out.push('btn ' + JSON.stringify(b) + ' viewTop ' + viewTop + ' sc ' + sc + ' scroll ' + scrollY + ' sheet ' + sheetOpen);
    const cx = (b.x + b.w / 2) * sc, cy = viewTop + (b.y + b.h / 2 - scrollY) * sc;
    const at = document.elementFromPoint(cx, cy);
    out.push('elementAt ' + (at ? at.tagName + '#' + at.id + '.' + at.className : 'none'));
    cvs.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, pointerId: 1, bubbles: true }));
    cvs.dispatchEvent(new PointerEvent('pointerup', { clientX: cx, clientY: cy, pointerId: 1, bubbles: true }));
    cvs.dispatchEvent(new MouseEvent('click', { clientX: cx, clientY: cy, bubbles: true }));
    out.push('overlay ' + $('ov').className + ' sheet ' + sheetOpen);
    const pre = document.createElement('pre'); pre.id = 'taptest'; pre.textContent = out.join(' ;; '); document.body.appendChild(pre);
  }, 1500);
  // Test hook: #demo-etest drives the empire (build, train, attack, conquer, found) and prints the results.
  if ((location.hash || '').includes('etest')) {
    const out = [], log = x => out.push(x), w = G.world.tiles, act = actions;
    act.build('9:hideout'); log('build queued ' + RG().bqs.length); RG().bqs.forEach(b => { b.done = 0; }); Empire.tick(0.01); log('hideout lvl ' + Empire.lvlOf('hideout'));
    act.train('milis:10'); log('trainQ ' + RG().trainQ.length); RG().trainQ.forEach(q => { q.next = 0; q.per = 0; }); Empire.tick(0.01); log('milis ' + RG().troops.milis);
    const npcKey = Object.keys(w).filter(k => w[k].type === 'npc').sort((p, q) => { const [a1, b1] = p.split(',').map(Number), [a2, b2] = q.split(',').map(Number); return Math.hypot(a1, b1) - Math.hypot(a2, b2); })[0];
    w[npcKey].def = { milis: 1 }; w[npcKey].wall = 0; w[npcKey].loyal = 10;
    act.tile(npcKey); act.sendSel('milis:all'); act.sendSel('senator:all'); act.sendGo('conquer');
    G.moves.forEach(m => m.at = 0); Empire.tick(0.01);
    const lastT = () => { const t = Date.now(); return t; };
    setTimeout(() => {
      Empire.tick(0.01); log('villages ' + G.regions.length + ' · reports ' + (G.reports || []).map(r => r.title).join(' | '));
      const empty = []; for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const k = x + ',' + y; if (!w[k] && !G.regions.some(v => v.x === x && v.y === y) && Math.hypot(x, y) > 1.5) empty.push(k); }
      RG().exp = 0; act.tile(empty[0]); act.sendGo('found'); G.moves.forEach(m => m.at = 0);
      setTimeout(() => { Empire.tick(0.01); log('after found villages ' + G.regions.length + ' names ' + G.regions.map(v => v.name + '@' + v.x + '|' + v.y + ' b' + v.b).join(', '));
        const pre = document.createElement('pre'); pre.id = 'etest'; pre.textContent = out.join(' ;; '); document.body.appendChild(pre); }, 1300);
    }, 1300);
  }
  Sfx.music(true);
  setTimeout(() => { if (window.Village3D && Village3D.warm) Village3D.warm(); }, 1500);
  setTimeout(applyPacks, 1200); // a pack bought earlier (or on another page) is delivered here
  requestAnimationFrame(loop);
})();
