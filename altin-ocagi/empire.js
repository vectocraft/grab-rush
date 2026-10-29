// Altın Ocağı — Travian-style empire layer on top of the mines.
// Every mine is a village: 16 building plots you fill as you like (timed construction), a second resource
// (iron) for the army, barracks/stable/workshop/residence to train troops, senators to conquer barbarian
// villages, settlers to found new villages on empty land, and oases that give their village a bonus.
// Everything runs on real timestamps, so building, training and marches continue while the app is closed.
// game.js owns the mines and calls Empire.init(api) with accessors to its state.
(function () {
  'use strict';

  const SLOTS = 16, WORLD_R = 20, WALL_SLOT = SLOTS - 1;
  const MAX_BUILDERS = 5, BUILDER_COST = [0, 0, 50, 120, 250, 500]; // star price of the n-th builder, per village // the wall has its own plot: the village gate
  // Buildings. base: price for level 1 (scaled by the village), time: seconds for level 1, max level.
  const BUILD = {
    main: { name: L('Main Building', 'Ana Bina'), icon: '🏛️', base: 300, time: 20, max: 20, desc: L('Speeds up construction (6% per level).', 'İnşaatları hızlandırır (her seviye %6).') },
    rally: { name: L('Rally Point', 'Toplanma Alanı'), icon: '🚩', base: 200, time: 30, max: 20, req: { main: 1 }, desc: L('Needed to send armies. Reports live here.', 'Ordu göndermek için gerekli. Raporlar burada.') },
    barracks: { name: L('Barracks', 'Kışla'), icon: '⚔️', base: 600, time: 45, max: 20, req: { main: 3, rally: 1 }, desc: L('Trains infantry. Each level trains 5% faster.', 'Piyade eğitir. Her seviye eğitimi %5 hızlandırır.') },
    stable: { name: L('Stable', 'Ahır'), icon: '🐎', base: 1500, time: 60, max: 20, req: { barracks: 3 }, desc: L('Trains cavalry.', 'Süvari eğitir.') },
    workshop: { name: L('Workshop', 'Tamirhane'), icon: '🛠️', base: 3000, time: 90, max: 20, req: { barracks: 5, main: 5 }, desc: L('Builds rams (they break walls).', 'Koçbaşı üretir (surları yıkar).') },
    kosk: { name: L('Residence', 'Köşk'), icon: '🏯', base: 4000, time: 120, max: 20, req: { main: 5 }, desc: L('Lv.10: senators and settlers. Every 10 levels 1 expansion slot, every 5 levels 1 oasis slot.', 'Sv.10: senatör ve kolonici. Her 10 seviye 1 genişleme hakkı, her 5 seviye 1 vaha hakkı.') },
    wall: { name: L('Wall', 'Sur'), icon: '🧱', base: 800, time: 40, max: 20, req: { main: 2 }, desc: L('+4% village defense per level.', 'Köy savunmasına her seviye +%4.') },
    hideout: { name: L('Hideout', 'Sığınak'), icon: '🕳️', base: 250, time: 20, max: 10, desc: L('Hides 8% of your cash per level from barbarian raids.', 'Barbar yağmasında nakdin her seviye %8\'ini saklar.') },
    demirci: { name: L('Blacksmith', 'Demirci'), icon: '⚒️', prod: 'iron', base: 60, time: 15, max: 100, desc: L('Produces iron for the army.', 'Ordu için demir üretir.') },
    kuyumcu: { name: L('Jeweller', 'Kuyumcu'), icon: '💍', prod: 'cash', base: 900, time: 20, max: 100 },
    pazar: { name: L('Mine Market', 'Maden Pazarı'), icon: '🏪', prod: 'cash', base: 14e3, time: 25, max: 100 },
    otel: { name: L('Miners\' Hotel', 'Madenci Oteli'), icon: '🏨', prod: 'cash', base: 2.2e5, time: 30, max: 100 },
    tren: { name: L('Ore Train', 'Cevher Treni'), icon: '🚂', prod: 'cash', base: 3.5e6, time: 35, max: 100 },
    banka: { name: L('Gold Bank', 'Altın Bankası'), icon: '🏦', prod: 'cash', base: 6e7, time: 40, max: 100 },
    rafineri: { name: L('Refinery', 'Rafineri'), icon: '🏭', prod: 'cash', base: 1e9, time: 45, max: 100 },
    darphane: { name: L('Mint', 'Darphane'), icon: '🪙', prod: 'cash', base: 1.8e10, time: 50, max: 100 },
  };
  // Troops. atk / di (defence vs infantry) / dc (vs cavalry), spd: tiles per 10 min, carry: minutes of the
  // home village's income a unit can haul, cost: iron, time: seconds.
  const TROOPS = {
    milis: { name: L('Militia', 'Milis'), icon: '🗡️', b: 'barracks', atk: 40, di: 35, dc: 50, spd: 6, carry: 1, cost: 30, time: 20, cav: false },
    mizrak: { name: L('Spearman', 'Mızrakçı'), icon: '🔱', b: 'barracks', atk: 30, di: 70, dc: 60, spd: 6, carry: 0.8, cost: 50, time: 26, cav: false },
    kilic: { name: L('Swordsman', 'Kılıççı'), icon: '⚔️', b: 'barracks', lvl: 3, atk: 70, di: 40, dc: 25, spd: 5, carry: 1.2, cost: 60, time: 30, cav: false },
    hafif: { name: L('Light Cavalry', 'Hafif Süvari'), icon: '🐎', b: 'stable', atk: 120, di: 30, dc: 40, spd: 14, carry: 3, cost: 120, time: 45, cav: true },
    agir: { name: L('Heavy Cavalry', 'Ağır Süvari'), icon: '🏇', b: 'stable', lvl: 5, atk: 180, di: 80, dc: 105, spd: 10, carry: 2, cost: 220, time: 70, cav: true },
    koc: { name: L('Ram', 'Koçbaşı'), icon: '🪵', b: 'workshop', atk: 60, di: 30, dc: 75, spd: 4, carry: 0, cost: 300, time: 90, cav: false },
    senator: { name: L('Senator', 'Senatör'), icon: '🎖️', b: 'kosk', lvl: 10, atk: 50, di: 40, dc: 30, spd: 4, carry: 0, cost: 3000, time: 600, cav: false },
    kolonici: { name: L('Settler', 'Kolonici'), icon: '🧑‍🌾', b: 'kosk', lvl: 10, atk: 0, di: 80, dc: 80, spd: 5, carry: 0, cost: 1500, time: 300, cav: false },
  };
  const OASIS = {
    nakit: { name: L('Gold Oasis', 'Altın Vahası'), icon: '🌴', desc: L('village income +25%', 'köy geliri +%25') },
    demir: { name: L('Iron Oasis', 'Demir Vahası'), icon: '⛰️', desc: L('iron production +25%', 'demir üretimi +%25') },
    hiz: { name: L('Wind Oasis', 'Rüzgâr Vahası'), icon: '🌬️', desc: L('elevator and transport +25% speed', 'asansör ve taşıma +%25 hız') },
    cevher: { name: L('Ore Oasis', 'Cevher Vahası'), icon: '💎', desc: L('mine floor production +25%', 'maden katlarının üretimi +%25') },
    damar: { name: L('Deep Vein', 'Derin Damar'), icon: '⛏️', desc: L('opening and upgrading floors 20% cheaper', 'yeni kat açma ve kat yükseltme %20 ucuz') },
  };
  const NPC_NAMES = L('Black Rock|Fox Camp|Wolf Den|Steep Hill|Thorn Village|Wild Camp|Stone Tower|Red Tent|Misty Vale|Grey Barrow|Old Fort|Windy Camp', 'Kara Kaya|Tilki Obası|Kurt Yuvası|Sarp Tepe|Dikenli Köy|Yaban Obası|Taş Kule|Kızıl Çadır|Sisli Vadi|Boz Kurgan|Eski Hisar|Rüzgârlı Oba').split('|');
  const BARB = L('Barbarians', 'Barbarlar');
  // Barbarian fortresses (tester request G-22: big armies had nothing worth fighting). Six strongholds, far bigger
  // than the villages, taken in order. Each one that falls pays a treasure (hours of income, iron, stars) and a
  // permanent empire-wide bonus that stacks with the oases. They are never conquered, only brought down.
  const FORTS = [
    { name: L('Fortress I · Stone Gate', 'Kale I · Taş Kapı'), troops: 3e3, wall: 10, hours: 2, stars: 10, bonus: ['nakit', 0.10], desc: L('income +10% in all villages', 'tüm köylerde gelir +%10') },
    { name: L('Fortress II · Wolf Tower', 'Kale II · Kurt Burcu'), troops: 12e3, wall: 12, hours: 4, stars: 20, bonus: ['demir', 0.25], desc: L('iron production +25% in all villages', 'tüm köylerde demir üretimi +%25') },
    { name: L('Fortress III · Red Citadel', 'Kale III · Kızıl Hisar'), troops: 40e3, wall: 14, hours: 8, stars: 30, bonus: ['cevher', 0.15], desc: L('mine floor production +15% in all villages', 'tüm köylerde maden katı üretimi +%15') },
    { name: L('Fortress IV · Iron Keep', 'Kale IV · Demir Kale'), troops: 100e3, wall: 16, hours: 12, stars: 40, bonus: ['hiz', 0.15], desc: L('elevator and transport +15% speed', 'asansör ve taşıma +%15 hız') },
    { name: L('Fortress V · Eagle\'s Nest', 'Kale V · Kartal Yuvası'), troops: 250e3, wall: 18, hours: 24, stars: 60, bonus: ['damar', 0.15], desc: L('opening and upgrading floors ~13% cheaper', 'kat açma ve yükseltme ~%13 ucuz') },
    { name: L('Fortress VI · Barbarian Khan\'s Palace', 'Kale VI · Barbar Hanı Sarayı'), troops: 600e3, wall: 20, hours: 48, stars: 100, bonus: ['nakit', 0.25], desc: L('income +25% in all villages', 'tüm köylerde gelir +%25') },
  ];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

  let A = null;           // api from game.js
  let dirty = true, selTile = null, send = null, lastSec = 0, V3 = null, v3size = '';
  const now = () => Date.now();
  let clock = 0; // while replaying a move, the time it actually happened
  const tnow = () => clock || now();
  const G = () => A.G;
  const V = k => A.G.regions[k == null ? A.G.cur : k];
  const fmt = n => A.fmt(n);
  function dur(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    const d = Math.floor(h / 24);
    // Multi-day times (big troop queues) drop the seconds so they fit the narrow timer columns.
    if (d) return d + L('d ', 'g ') + (h % 24) + L('h', 'sa');
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0') : m + ':' + String(x).padStart(2, '0');
  }
  function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  // ---------- Village state ----------
  const bqAt = (v, i) => (v.bqs || []).find(b => b.slot === i);
  // A building type is taken once it stands on a plot or its first construction is running on an empty one.
  const hasType = (v, t) => v.slots.some(x => x && x.t === t) || (v.bqs || []).some(b => b.t === t && !v.slots[b.slot]);
  const freeBuilders = v => (v.builders || 1) - (v.bqs || []).length;
  function ensureVillage(v, k) {
    if (!v.bqs) { v.bqs = v.bq ? [v.bq] : []; delete v.bq; }
    if (!v.builders) v.builders = 1;
    if (!v.slots) {
      v.slots = new Array(SLOTS).fill(null);
      v.slots[0] = { t: 'main', l: 1 };
      // Old town businesses become buildings on the first plots.
      let s = 1;
      for (const id in (v.biz || {})) { const b = v.biz[id]; if (b && b.l > 0 && BUILD[id] && s < SLOTS) v.slots[s++] = { t: id, l: b.l }; }
    }
    const w = v.slots.findIndex(x => x && x.t === 'wall');
    if (w >= 0 && w !== WALL_SLOT) {
      [v.slots[w], v.slots[WALL_SLOT]] = [v.slots[WALL_SLOT], v.slots[w]];
      for (const b of v.bqs || []) { if (b.slot === w) b.slot = WALL_SLOT; else if (b.slot === WALL_SLOT) b.slot = w; }
    } else if (w < 0 && v.slots[WALL_SLOT] && !bqAt(v, WALL_SLOT)) {
      const free = v.slots.findIndex((x, i) => !x && i && i !== WALL_SLOT && !bqAt(v, i));
      if (free > 0) { v.slots[free] = v.slots[WALL_SLOT]; v.slots[WALL_SLOT] = null; }
    }
    // Old saves could hold the same building on several plots (a second one was allowed while the first was
    // still under construction): keep the highest level, refund the rest.
    if (!v.dedup) {
      v.dedup = 1;
      const best = {};
      v.slots.forEach((x, i) => { if (x && (!best[x.t] || x.l > v.slots[best[x.t]].l)) best[x.t] = i; });
      let back = 0;
      v.slots.forEach((x, i) => {
        if (!x || best[x.t] === i) return;
        for (let l = 0; l < x.l; l++) back += buildCost(x.t, l, k);
        v.slots[i] = null; v.bqs = v.bqs.filter(b => b.slot !== i);
      });
      const seen = {};
      v.bqs = v.bqs.filter(b => {
        if (v.slots[b.slot]) return true;
        if (best[b.t] != null || seen[b.t]) { back += buildCost(b.t, 0, k); return false; }
        return (seen[b.t] = true);
      });
      if (back > 0) A.addCash(k, back);
    }
    if (v.iron == null) v.iron = 200;
    if (!v.troops) v.troops = {};
    if (!v.trainQ) v.trainQ = [];
    if (!v.oases) v.oases = [];
    if (v.exp == null) v.exp = 0;
    if (v.x == null) { const p = [[0, 0], [3, -2], [-3, 3], [3, 3], [-5, -5]][k] || [k, k]; v.x = p[0]; v.y = p[1]; }
    if (!v.name) v.name = k === 0 ? L('Capital', 'Başkent') : A.REGIONS[v.b].name;
    if (!v.near && A.G.world) ensureNear(v);
  }
  const lvlOf = (t, k) => { const s = V(k).slots.find(x => x && x.t === t); return s ? s.l : 0; };
  const slotOf = (t, k) => V(k).slots.findIndex(x => x && x.t === t);
  const buildMul = () => (G().townBoostUntil > now() ? 2 : 1);
  const buildCost = (t, l, k) => { const b = BUILD[t]; return b.base * Math.pow(b.prod ? 1.14 : 1.6, l) * A.mulOf(k); };
  const buildTime = (t, l, k) => { const b = BUILD[t], raw = b.time * Math.pow(b.prod ? 1.08 : 1.32, l); return Math.min(b.prod ? 1800 : 5 * 3600, raw) / (1 + 0.06 * lvlOf('main', k)) / buildMul() * 1000; };
  // The mine drives the village: military/admin buildings go up to 2 levels per mine floor, production
  // buildings up to the level of the best mine floor; troops cost mine cash (5% of what the mine earns
  // while one unit trains) on top of iron.
  const levelCap = (t, k) => { const m = A.mineOf(k), b = BUILD[t]; return Math.min(b.max, b.prod ? Math.max(10, m.best + 10) : Math.max(5, m.floors * 2 + 2)); };
  const capText = (t, k) => (BUILD[t].prod ? L('🔒 Your best mine floor must be Lv.' + (levelCap(t, k) - 9), '🔒 Madende en iyi kat Sv.' + (levelCap(t, k) - 9) + ' olmalı') : L('🔒 The mine needs ' + Math.ceil((levelCap(t, k) - 1) / 2) + ' floors', '🔒 Madende ' + Math.ceil((levelCap(t, k) - 1) / 2) + ' kat olmalı'));
  // Cash per unit: 5% of the mine income over its training time (it was 30%, and grew with every mine upgrade). Iron is the real limit.
  const TROOP_CASH = 0.05;
  const troopCash = (t, k) => Math.max(5, TROOPS[t].time * A.incomeOf(k == null ? G().cur : k) * TROOP_CASH);
  const reqOk = (t, k) => { const r = BUILD[t].req || {}; return Object.keys(r).every(x => lvlOf(x, k) >= r[x]); };
  const reqText = t => Object.entries(BUILD[t].req || {}).map(([x, l]) => BUILD[x].name + L(' Lv.', ' Sv.') + l).join(', ');
  const trainTime = (tr, k) => TROOPS[tr].time * 1000 / (1 + 0.05 * lvlOf(TROOPS[tr].b, k)) / buildMul();
  // Iron per second of a village.
  // 1/s base + the blacksmith on top (Lv.1 ≈ 1.7/s, Lv.10 ≈ 12/s, Lv.20 ≈ 36/s): a militia (30 iron) every few seconds.
  const ironRate = k => { const l = lvlOf('demirci', k); return (1 + 0.65 * l * Math.pow(1.05, l)) * oasisMul('demir', k); };
  // Oases work for their own village; fallen fortresses (G().trophy) add an empire-wide bonus of the same kind.
  function oasisMul(kind, k) {
    const trophy = (A && A.G && A.G.trophy && A.G.trophy[kind]) || 0;
    const own = A && V(k) && V(k).oases ? V(k).oases.filter(o => o.kind === kind).length : 0;
    return (1 + 0.25 * own) * (1 + trophy);
  }
  const expSlots = k => Math.floor(lvlOf('kosk', k) / 10);
  const oasisSlots = k => Math.floor(lvlOf('kosk', k) / 5);
  const cashBuildings = k => V(k).slots.filter(s => s && BUILD[s.t].prod === 'cash');

  // ---------- World ----------
  const npcTile = (x, y, r) => { const d = Math.hypot(x, y), s = Math.max(1, Math.round(d * 1.3 + r() * 3)); return { type: 'npc', name: NPC_NAMES[Math.floor(r() * NPC_NAMES.length)], s, loyal: 100, def: npcArmy(s), wall: Math.min(20, Math.floor(s * 1.2)), stash: 4 + 2 * s, iron: 150 * s, last: now() }; };
  const oasisTile = (x, y, kind) => ({ type: 'oasis', kind, pow: Math.round(120 * Math.pow(Math.max(1.5, Math.hypot(x, y)), 1.5)), last: now() });
  function genTile(tiles, x, y, r) {
    const d = Math.hypot(x, y), key = x + ',' + y;
    if (d < 1.5 || tiles[key] || villageAt(x, y) >= 0) return;
    const roll = r(), kinds = Object.keys(OASIS);
    if (roll < 0.14) tiles[key] = npcTile(x, y, r);
    else if (roll < 0.24) tiles[key] = oasisTile(x, y, kinds[Math.floor(r() * kinds.length)]);
  }
  function world() {
    const g = G();
    if (!g.world) {
      const r = rng(Math.floor(Math.random() * 1e9) + 7), tiles = {};
      for (let y = -WORLD_R; y <= WORLD_R; y++) for (let x = -WORLD_R; x <= WORLD_R; x++) genTile(tiles, x, y, r);
      g.world = { tiles, raidAt: now() + 30 * 60e3, r: WORLD_R };
    } else if ((g.world.r || 7) < WORLD_R) {
      // Older saves: keep the known map, grow it around the edges.
      const r0 = g.world.r || 7, r = rng(Math.floor(Math.random() * 1e9) + 11);
      for (let y = -WORLD_R; y <= WORLD_R; y++) for (let x = -WORLD_R; x <= WORLD_R; x++) if (Math.abs(x) > r0 || Math.abs(y) > r0) genTile(g.world.tiles, x, y, r);
      g.world.r = WORLD_R;
    }
    if (!g.world.forts) placeForts(g.world);
    return g.world;
  }
  // One fortress per ring, further out for each tier; it may replace an ordinary barbarian village, never an oasis.
  function placeForts(w) {
    const r = rng(Math.floor(Math.random() * 1e9) + 3);
    FORTS.forEach((F, i) => {
      const rad = 4 + i * 2.6;
      for (let tries = 0; tries < 300; tries++) {
        const a = r() * Math.PI * 2, x = Math.round(Math.cos(a) * rad), y = Math.round(Math.sin(a) * rad), key = x + ',' + y, t = w.tiles[key];
        if (Math.abs(x) > WORLD_R || Math.abs(y) > WORLD_R || villageAt(x, y) >= 0 || (t && (t.type !== 'npc' || t.fort))) continue;
        w.tiles[key] = fortTile(i);
        break;
      }
    });
    w.forts = 1;
  }
  const fortTile = i => ({ type: 'npc', fort: i + 1, name: FORTS[i].name, s: 10 + 5 * i, loyal: 100, def: fortArmy(i), wall: FORTS[i].wall, stash: 0, iron: 0, last: now() });
  function fortArmy(i) { const n = FORTS[i].troops; return { milis: Math.round(n * 0.35), mizrak: Math.round(n * 0.35), hafif: Math.round(n * 0.15), agir: Math.round(n * 0.15) }; }
  // Fortresses fall in order: the next one opens when the previous is down.
  const fortOpen = n => n <= (G().fortsDown || 0) + 1;
  // Every village gets at least 2 oases (one working on the mine) and 2 barbarian villages within 3 tiles.
  function ensureNear(v) {
    const w = world(), r = Math.random, near = [];
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = v.x + dx, y = v.y + dy;
      if ((dx || dy) && Math.abs(x) <= WORLD_R && Math.abs(y) <= WORLD_R) near.push([x, y]);
    }
    const count = type => near.filter(([x, y]) => { const t = w.tiles[x + ',' + y]; return t && t.type === type; }).length;
    const free = () => near.filter(([x, y]) => !w.tiles[x + ',' + y] && villageAt(x, y) < 0 && Math.hypot(x, y) >= 1.5);
    let placed = 0;
    for (let n = count('oasis'); n < 2; n++) { const f = free(); if (!f.length) break; const [x, y] = f[Math.floor(r() * f.length)]; w.tiles[x + ',' + y] = oasisTile(x, y, placed++ === 0 ? (r() < 0.5 ? 'cevher' : 'damar') : Object.keys(OASIS)[Math.floor(r() * 5)]); }
    for (let n = count('npc'); n < 2; n++) { const f = free(); if (!f.length) break; const [x, y] = f[Math.floor(r() * f.length)]; w.tiles[x + ',' + y] = npcTile(x, y, r); }
    v.near = true;
  }
  const stashCap = t => 4 + 2 * t.s;
  function npcArmy(s) { const f = Math.pow(s, 1.55); return { milis: Math.round(8 * f), mizrak: Math.round(6 * f), hafif: Math.round(1.5 * f) }; }
  // Biome of a tile: valley around the capital, then desert / volcano / ice / valley by quadrant, moon in far corners.
  function biomeAt(x, y) {
    const d = Math.hypot(x, y);
    if (d <= 2.5) return 0;
    if (d >= 14) return 4;
    if (x >= 0 && y < 0) return 1;
    if (x >= 0) return 3;
    if (y >= 0) return 2;
    return 0;
  }
  const villageAt = (x, y) => G().regions.findIndex(v => v.x === x && v.y === y);
  const oasisOwner = (x, y) => G().regions.findIndex(v => v.oases.some(o => o.x === x && o.y === y));

  // Barbarian villages and oases recover over time.
  function regen(t) {
    const el = (now() - t.last) / 60000;
    if (el < 0.5) return;
    t.last = now();
    if (t.fort) { // a fortress refills its garrison slowly (0.3% a minute), so it can be worn down over several attacks
      if (t.fallen) return;
      const max = fortArmy(t.fort - 1);
      for (const k in max) t.def[k] = Math.min(max[k], (t.def[k] || 0) + max[k] * 0.003 * el);
      return;
    }
    if (t.type === 'npc') {
      const max = npcArmy(t.s);
      for (const k in max) t.def[k] = Math.min(max[k], (t.def[k] || 0) + max[k] * 0.02 * el);
      t.loyal = Math.min(100, t.loyal + el / 3);
      t.stash = Math.min(stashCap(t), t.stash + el * 0.12);
      t.iron = Math.min(150 * t.s, t.iron + 5 * t.s * el);
    } else t.animals = Math.min(1, (t.animals == null ? 1 : t.animals) + el * 0.01);
  }

  // ---------- Combat ----------
  const sum = (tr, f) => Object.keys(tr).reduce((a, k) => a + (tr[k] || 0) * f(TROOPS[k] || TROOPS.milis, k), 0);
  function fight(att, defTroops, defFlat, wall) {
    const atk = sum(att, t => t.atk), atkCav = sum(att, (t, k) => (TROOPS[k].cav ? t.atk : 0));
    const cavShare = atk ? atkCav / atk : 0;
    const wallEff = Math.max(0, wall - Math.floor((att.koc || 0) / 10));
    const def = (sum(defTroops, t => t.di * (1 - cavShare) + t.dc * cavShare) + defFlat) * Math.pow(1.04, wallEff) + 10;
    const win = atk > def;
    return { win, atk, def, attLoss: win ? Math.pow(def / atk, 1.5) : 1, defLoss: win ? 1 : Math.pow(atk / def, 1.5), wallEff };
  }
  const applyLoss = (tr, f) => { const out = {}; for (const k in tr) out[k] = Math.max(0, Math.round(tr[k] * (1 - f))); return out; };
  const lost = (before, after) => { const out = {}; for (const k in before) out[k] = Math.max(0, Math.round((before[k] || 0) - (after[k] || 0))); return out; };
  const count = tr => Object.values(tr).reduce((a, b) => a + (b || 0), 0);
  const troopsTxt = tr => Object.keys(tr).filter(k => tr[k] > 0).map(k => TROOPS[k].icon + Math.round(tr[k])).join(' ') || '—';
  // Travian-style troop table: one column per unit type, a row of counts and (optionally) a row of losses.
  function troopTable(tr, loss, label) {
    const keys = Object.keys(TROOPS);
    const cell = n => '<span' + (n ? '' : ' class="z"') + '>' + fmt(Math.round(n || 0)) + '</span>';
    return '<div class="ttab">' + (label ? '<div class="tl">' + label + '</div>' : '') +
      '<div class="tr hd">' + keys.map(k => '<span title="' + TROOPS[k].name + '">' + TROOPS[k].icon + '</span>').join('') + '</div>' +
      '<div class="tr">' + keys.map(k => cell(tr && tr[k])).join('') + '</div>' +
      (loss ? '<div class="tr loss">' + keys.map(k => cell(loss[k])).join('') + '</div>' : '') + '</div>';
  }
  const ago = t => { const m = Math.floor((now() - t) / 60000); return m < 1 ? L('just now', 'az önce') : m < 60 ? m + L(' min ago', ' dk önce') : m < 1440 ? Math.floor(m / 60) + L(' h ago', ' sa önce') : Math.floor(m / 1440) + L(' days ago', ' gün önce'); };

  // data (optional): { att, attLost, def, defLost, loot: { cash, iron }, from, to } — shown as Travian-style tables.
  function report(title, win, lines, data) {
    const g = G();
    (g.reports = g.reports || []).unshift({ t: tnow(), title, win, lines, data: data || null, read: false });
    g.reports.length = Math.min(g.reports.length, 40);
    A.toast((win ? '✅ ' : '❌ ') + title);
    dirty = true;
  }

  // Caravans (Maden Pazarı): each carries (5 + level/2) minutes of the TARGET village's income, so a rich
  // village can speed a young one up without finishing it; 1 caravan + 1 per 25 market levels (max 5).
  const caravans = k => 1 + Math.min(4, Math.floor(lvlOf('pazar', k) / 25));
  const caravansBusy = k => (G().moves || []).filter(m => (m.type === 'caravan' || m.type === 'caravanBack') && m.from === k).length;
  const caravanCap = (from, to) => Math.max(200 * A.mulOf(to), A.incomeOf(to) * 60 * (5 + lvlOf('pazar', from) / 2));
  const caravanIron = k => 500 + 100 * lvlOf('pazar', k);
  const caravanTrip = (a, b) => Math.max(60e3, Math.hypot(V(a).x - V(b).x, V(a).y - V(b).y) * 2 * 60e3);
  function caravanHtml(k) {
    const n = caravans(k), free = n - caravansBusy(k);
    let h = '<p class="rsec">' + L('🐫 Caravans · free ', '🐫 Kervanlar · boşta ') + free + '/' + n + '</p><p class="tip">' + L('A caravan carries ' + (5 + lvlOf('pazar', k) / 2) + ' minutes of the target village\'s income. The Market level raises capacity and the number of caravans.', 'Kervan, hedef köyün ' + (5 + lvlOf('pazar', k) / 2) + ' dakikalık gelirini taşır. Pazar seviyesi kapasiteyi ve kervan sayısını artırır.') + '</p>';
    h += '<p class="tip">' + L('Each caravan also carries ⚒️ ' + fmt(caravanIron(k)) + ' iron (grows with the Market level).', 'Her kervan ayrıca ⚒️ ' + fmt(caravanIron(k)) + ' demir taşır (Pazar seviyesiyle artar).') + '</p>';
    if (G().regions.length < 2) return h + '<p class="tip">' + L('You need a second village to send caravans (Residence Lv.10 + settlers, or conquest with a senator).', 'Kervan göndermek için ikinci bir köyün olmalı (Köşk Sv.10 + kolonici ya da senatörle fetih).') + '</p>';
    G().regions.forEach((v, j) => {
      if (j === k) return;
      const cap = caravanCap(k, j), amt = Math.min(cap, A.cash());
      h += '<div class="upg"><div><b>' + (j === 0 ? '👑 ' : '🏠 ') + v.name + '</b><small>🎒 ' + fmt(cap) + ' 💵 · ⏱ ' + dur(caravanTrip(k, j)) + '</small></div>' +
        '<button class="btn small ' + (free > 0 && amt > 0 ? 'gold' : 'gray') + '" data-act="caravan" data-arg="' + j + '">🐫 ' + fmt(amt) + '</button></div>';
    });
    return h;
  }
  function arrive(m) {
    if (m.type === 'caravan') {
      A.addCash(m.to, m.cash); V(m.to).iron += m.iron || 0;
      report(L('🐫 Caravan arrived: ', '🐫 Kervan ulaştı: ') + V(m.to).name, true, ['+' + fmt(m.cash) + ' 💵 · +' + fmt(m.iron || 0) + ' ⚒️ · ' + m.fromName + ' → ' + V(m.to).name]);
      G().moves.push({ id: now() + Math.random(), type: 'caravanBack', from: m.from, fromName: m.fromName, to: m.to, at: tnow() + m.trip, start: tnow() });
      return;
    }
    if (m.type === 'caravanBack') return;
    const w = world(), key = m.x + ',' + m.y, tile = w.tiles[key], from = V(m.from), src = m.fromName;
    if (m.type === 'return') {
      for (const k in m.troops) from.troops[k] = (from.troops[k] || 0) + m.troops[k];
      if (m.cash) A.addCash(m.from, m.cash);
      if (m.iron) from.iron += m.iron;
      if (m.cash || m.iron) A.toast(L('🎒 Army back: +', '🎒 Ordu döndü: +') + fmt(m.cash || 0) + ' 💵 · +' + fmt(m.iron || 0) + ' ⚔️');
      return;
    }
    if (m.type === 'found') {
      if (villageAt(m.x, m.y) >= 0 || tile) { report(L('Could not found the village: the land is taken', 'Köy kurulamadı: arazi dolu'), false, []); back(m, m.troops, 0, 0); return; }
      const k = A.newVillage(biomeAt(m.x, m.y), m.x, m.y, L('New Village ', 'Yeni Köy ') + G().regions.length);
      from.exp++;
      report(L('🏡 New village founded: ', '🏡 Yeni köy kuruldu: ') + A.REGIONS[biomeAt(m.x, m.y)].name, true, [m.x + '|' + m.y]);
      return k;
    }
    if (!tile) { back(m, m.troops, 0, 0); return; }
    regen(tile);
    if (tile.type === 'oasis') {
      const animals = tile.animals == null ? 1 : tile.animals, f = fight(m.troops, {}, tile.pow * animals, 0);
      const surv = applyLoss(m.troops, f.attLoss);
      if (f.win) {
        tile.animals = 0;
        const owner = oasisOwner(m.x, m.y), free = from.oases.length < oasisSlots(m.from);
        let msg = L('Oasis cleared', 'Vaha temizlendi');
        if (owner < 0 && free) { from.oases.push({ x: m.x, y: m.y, kind: tile.kind }); msg = OASIS[tile.kind].name + L(' captured (', ' ele geçirildi (') + OASIS[tile.kind].desc + ')'; }
        else if (owner < 0) msg += L(' · could not be linked: Residence level too low', ' · Köşk seviyesi yetmediği için bağlanamadı');
        report(msg, true, [L('Attack ', 'Saldırı ') + fmt(f.atk) + L(' / defense ', ' / savunma ') + fmt(f.def), L('Losses: ' + Math.round(f.attLoss * 100) + '%', 'Kayıp: %' + Math.round(f.attLoss * 100))], { from: src, to: OASIS[tile.kind].name, att: m.troops, attLost: lost(m.troops, surv), animals: Math.round(tile.pow * animals) });
        back(m, surv, 0, 0);
      } else { tile.animals = Math.max(0, animals * (1 - f.defLoss)); report(L('Oasis attack failed', 'Vaha saldırısı başarısız'), false, [L('Attack ', 'Saldırı ') + fmt(f.atk) + L(' / defense ', ' / savunma ') + fmt(f.def)], { from: src, to: OASIS[tile.kind].name, att: m.troops, attLost: m.troops, animals: Math.round(tile.pow * animals) }); }
      return;
    }
    if (tile.fort) return fortBattle(m, tile, src);
    // Barbarian village.
    const f = fight(m.troops, tile.def, 0, tile.wall), defBefore = Object.assign({}, tile.def);
    const surv = applyLoss(m.troops, f.attLoss);
    tile.def = applyLoss(tile.def, f.defLoss);
    const battle = { from: src, to: tile.name + ' (' + m.x + '|' + m.y + ')', att: m.troops, attLost: lost(m.troops, surv), def: defBefore, defLost: lost(defBefore, tile.def), wall: tile.wall };
    if (!f.win) { report(L('Attack on ' + tile.name + ' failed', tile.name + ' saldırısı başarısız'), false, [L('Attack ', 'Saldırı ') + fmt(f.atk) + L(' / defense ', ' / savunma ') + fmt(f.def), L('All troops lost', 'Tüm birlikler kayboldu')], battle); return; }
    if (f.wallEff < tile.wall) tile.wall = f.wallEff;
    tile.stash = Math.min(tile.stash, stashCap(tile));
    const carry = sum(surv, t => t.carry), lootMin = Math.min(tile.stash, carry), cash = lootMin * 60 * m.income, iron = Math.min(tile.iron, carry * 25);
    tile.stash -= lootMin; tile.iron -= iron;
    const lines = [L('Attack ', 'Saldırı ') + fmt(f.atk) + L(' / defense ', ' / savunma ') + fmt(f.def), L('Losses: ' + Math.round(f.attLoss * 100) + '%', 'Kayıp: %' + Math.round(f.attLoss * 100)), L('Loot: ', 'Ganimet: ') + fmt(cash) + ' 💵 · ' + fmt(iron) + ' ⚔️'];
    battle.loot = { cash, iron };
    if (m.type === 'conquer' && surv.senator > 0) {
      const drop = surv.senator * (20 + Math.random() * 10);
      tile.loyal -= drop;
      lines.push(L('Loyalty: ', 'Sadakat: ') + Math.max(0, Math.round(tile.loyal)) + '%');
      if (tile.loyal <= 0) {
        if (from.exp < expSlots(m.from)) {
          delete w.tiles[key];
          const k = A.newVillage(biomeAt(m.x, m.y), m.x, m.y, tile.name, Math.min(8, 2 + Math.floor(tile.s / 2)));
          from.exp++;
          surv.senator = 0;
          report('🎖️ ' + L(tile.name + ' conquered! It is your village now.', tile.name + ' fethedildi! Artık senin köyün.'), true, lines, battle);
          back(m, surv, cash, iron);
          return k;
        }
        tile.loyal = 1; lines.push(L('No free Residence expansion slot: no conquest', 'Köşk genişleme hakkın dolu: fetih olmadı'));
      }
    }
    battle.loyal = tile.loyal;
    report(L(tile.name + ' raided', tile.name + ' yağmalandı'), true, lines, battle);
    back(m, surv, cash, iron);
  }
  // A failed attack still kills part of the garrison, so a fortress can be worn down; a won one brings it down.
  function fortBattle(m, tile, src) {
    const F = FORTS[tile.fort - 1];
    if (tile.fallen || !fortOpen(tile.fort)) { back(m, m.troops, 0, 0); return; }
    const f = fight(m.troops, tile.def, 0, tile.wall), defBefore = Object.assign({}, tile.def);
    const surv = applyLoss(m.troops, f.attLoss);
    tile.def = applyLoss(tile.def, f.defLoss);
    const battle = { from: src, to: tile.name + ' (' + m.x + '|' + m.y + ')', att: m.troops, attLost: lost(m.troops, surv), def: defBefore, defLost: lost(defBefore, tile.def), wall: tile.wall };
    const head = L('Attack ', 'Saldırı ') + fmt(f.atk) + L(' / defense ', ' / savunma ') + fmt(f.def);
    if (!f.win) {
      report(L('Attack on ' + tile.name + ' failed', tile.name + ' saldırısı başarısız'), false, [head, L('All troops lost', 'Tüm birlikler kayboldu'), L('Garrison losses: ' + Math.round(f.defLoss * 100) + '% (it refills slowly)', 'Kale garnizonu kaybı: %' + Math.round(f.defLoss * 100) + ' (yavaş toparlanır)')], battle);
      return;
    }
    const g = G();
    tile.fallen = true; tile.def = {};
    g.fortsDown = Math.max(g.fortsDown || 0, tile.fort);
    g.trophy = g.trophy || {};
    g.trophy[F.bonus[0]] = (g.trophy[F.bonus[0]] || 0) + F.bonus[1];
    const cash = (m.income || 0) * 3600 * F.hours, iron = 4000 * tile.fort * tile.fort;
    Save.addCoins(F.stars);
    battle.loot = { cash, iron };
    report('🏰 ' + L(tile.name + ' has fallen!', tile.name + ' düştü!'), true, [head, L('Losses: ' + Math.round(f.attLoss * 100) + '%', 'Kayıp: %' + Math.round(f.attLoss * 100)),
      L('Treasure: ', 'Hazine: ') + fmt(cash) + ' 💵 · ' + fmt(iron) + ' ⚔️ · +' + F.stars + ' ⭐', L('Permanent bonus: ', 'Kalıcı bonus: ') + F.desc,
      tile.fort < FORTS.length ? L('Next: ' + FORTS[tile.fort].name + ' is open', 'Sıradaki: ' + FORTS[tile.fort].name + ' açıldı') : L('All fortresses have fallen!', 'Bütün kaleler düştü!')], battle);
    A.toast('🏰 ' + L(tile.name + ' has fallen! +' + F.stars + ' ⭐', tile.name + ' düştü! +' + F.stars + ' ⭐'));
    back(m, surv, cash, iron);
    dirty = true;
  }
  function back(m, troops, cash, iron) {
    if (!count(troops)) return;
    const t = travelMs(troops, m.dist);
    G().moves.push({ id: now() + Math.random(), type: 'return', from: m.from, fromName: m.fromName, x: m.x, y: m.y, dist: m.dist, troops, cash, iron, at: tnow() + t, start: tnow() });
  }
  const travelMs = (tr, dist) => { const s = Math.min(...Object.keys(tr).filter(k => tr[k] > 0).map(k => TROOPS[k].spd)); return Math.max(20000, dist * 10 / s * 60000); };

  // Barbarian raids against your villages (once you have a barracks): wall, troops and hideout matter.
  function raids() {
    const w = world(), g = G();
    if (now() < w.raidAt) return;
    w.raidAt = now() + (50 + Math.random() * 40) * 60e3;
    const targets = g.regions.map((v, k) => k).filter(k => lvlOf('barracks', k) > 0 && !(g.regions[k].protectUntil > now()));
    if (!targets.length) return;
    const k = targets[Math.floor(Math.random() * targets.length)], v = V(k), size = 1 + Math.floor((lvlOf('main', k) + lvlOf('barracks', k)) / 4 + g.regions.length * 0.3 + Math.random() * 2);
    const army = applyLoss(npcArmy(size), 0.45);
    g.moves.push({ id: now() + Math.random(), type: 'raid', to: k, troops: army, at: now() + 4 * 60e3, start: now() });
    A.toast(L('⚠️ Barbarians are coming to ' + v.name + '! 4 minutes', '⚠️ Barbarlar ' + v.name + ' köyüne geliyor! 4 dakika'));
    dirty = true;
  }
  function defendRaid(m) {
    const v = V(m.to), f = fight(m.troops, v.troops, 0, lvlOf('wall', m.to)), home = Object.assign({}, v.troops);
    const battle = { from: BARB, barb: true, to: v.name, att: m.troops, def: home, wall: lvlOf('wall', m.to) };
    if (!f.win) {
      // The raiders lost: all of them fall; the defenders lose a share.
      v.troops = applyLoss(v.troops, Math.min(1, f.defLoss));
      battle.attLost = m.troops; battle.defLost = lost(home, v.troops);
      report(L(v.name + ' fought off the barbarian raid', v.name + ' barbar akınını püskürttü'), true, [L('Attack ', 'Saldırı ') + fmt(f.atk) + L(' / defense ', ' / savunma ') + fmt(f.def)], battle);
      return;
    }
    // A lost defence costs half the army, some cash and iron, then 3 hours of peace to rebuild (no death spiral).
    v.troops = applyLoss(v.troops, 0.5);
    battle.attLost = lost(m.troops, applyLoss(m.troops, f.attLoss)); battle.defLost = lost(home, v.troops);
    const hide = Math.min(0.8, 0.08 * lvlOf('hideout', m.to)), taken = Math.min(A.incomeOf(m.to) * 300 * (1 - hide), A.cashOf(m.to));
    A.addCash(m.to, -taken);
    v.iron = Math.max(0, v.iron * 0.85);
    v.protectUntil = now() + 3 * 3600e3;
    battle.loot = { cash: taken, iron: 0 };
    report(L(v.name + ' was raided: -', v.name + ' yağmalandı: -') + fmt(taken) + ' 💵', false, [L('Attack ', 'Saldırı ') + fmt(f.atk) + L(' / defense ', ' / savunma ') + fmt(f.def), L('Add walls and troops; the Hideout protects your cash', 'Sur ve asker ekle, Sığınak nakdini korur')], battle);
  }

  // ---------- Tick ----------
  function tick(dt) {
    const g = G();
    if (!g.moves) g.moves = [];
    g.regions.forEach((v, k) => ensureVillage(v, k));
    // Iron flows in every village; training and construction complete on timestamps.
    g.regions.forEach((v, k) => {
      v.iron += ironRate(k) * dt;
      for (const b of v.bqs.filter(b => now() >= b.done)) {
        const s = v.slots[b.slot];
        if (s) s.l++; else v.slots[b.slot] = { t: b.t, l: 1 };
        A.toast('🏗️ ' + BUILD[b.t].name + L(' Lv.', ' Sv.') + (s ? s.l : 1) + (k !== g.cur ? ' · ' + v.name : ''));
        v.bqs.splice(v.bqs.indexOf(b), 1); dirty = true; A.save();
      }
      for (const q of v.trainQ) {
        while (q.n > 0 && now() >= q.next) { v.troops[q.t] = (v.troops[q.t] || 0) + 1; q.n--; q.next += q.per; dirty = true; }
      }
      v.trainQ = v.trainQ.filter(q => q.n > 0);
    });
    if (now() - lastSec > 1000) {
      lastSec = now();
      // Oldest first, one at a time: an attack that landed hours ago also returns (and pays) at the right time.
      let done = 0;
      for (; done < 500; done++) {
        let m = null;
        for (const x of g.moves) if (now() >= x.at && (!m || x.at < m.at)) m = x;
        if (!m) break;
        g.moves.splice(g.moves.indexOf(m), 1);
        clock = m.at;
        try { m.type === 'raid' ? defendRaid(m) : arrive(m); } finally { clock = 0; }
      }
      if (done) { A.save(); dirty = true; }
      raids();
    }
  }

  // ---------- Actions ----------
  const actions = {
    plot(i) {
      i = +i;
      const v = V(), s = v.slots[i];
      s ? openBuilding(i) : bqAt(v, i) ? openConstruction(i) : openEmpty(i);
    },
    build(arg) {
      const [i, t] = arg.split(':'), v = V(), s = v.slots[+i], l = s ? s.l : 0;
      if (bqAt(v, +i)) { A.toast(L('Construction is already running on this plot', 'Bu arsada inşaat sürüyor')); return; }
      if (freeBuilders(v) <= 0) { A.toast(L('All builders are busy', 'Bütün işçiler çalışıyor')); openBuilders(); return; }
      if (!s && hasType(v, t)) { A.toast(L('This village already has one', 'Bu köyde zaten var')); return; }
      if ((t === 'wall') !== (+i === WALL_SLOT)) { A.toast(L('The wall can only be built at the village gate', 'Sur sadece köy kapısına kurulur')); return; }
      if (l >= BUILD[t].max) return;
      if (l >= levelCap(t)) { A.toast(capText(t)); return; }
      if (!reqOk(t)) { A.toast(L('Requires: ', 'Gerekli: ') + reqText(t)); return; }
      const c = buildCost(t, l);
      if (!A.spend(c)) { A.toast(L('Not enough cash', 'Yetersiz nakit')); return; }
      v.bqs.push({ slot: +i, t, done: now() + buildTime(t, l), start: now() });
      Ads.track('build', { t, l: l + 1 });
      A.sfx('coin'); A.save(); A.closePanel(); dirty = true;
    },
    async finishAd(i) {
      const v = V(), b = bqAt(v, +i) || v.bqs[0];
      if (!b) return;
      if (!(await Ads.rewarded('maden_build_finish'))) { A.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      b.done = now(); dirty = true;
    },
    builders() { openBuilders(); },
    buyBuilder() {
      const v = V(), n = v.builders || 1;
      if (n >= MAX_BUILDERS) return;
      if (!Save.spend(BUILDER_COST[n + 1])) { A.toast(L('Not enough ⭐ stars', 'Yetersiz ⭐ yıldız')); return; }
      v.builders = n + 1; A.sfx('coin'); A.toast('👷 ' + v.name + L(': builder #' + v.builders + ' hired', ': ' + v.builders + '. işçi işe başladı')); A.save(); dirty = true; openBuilders();
    },
    async speedAd() {
      if (!(await Ads.rewarded('maden_build_speed'))) { A.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      G().townBoostUntil = Math.min(now() + 2 * 3600e3, Math.max(now(), G().townBoostUntil) + 15 * 60e3);
      A.toast(L('⚡ Construction and training 2x faster for 15 minutes!', '⚡ 15 dakika inşaat ve eğitim 2x hızlı!')); A.save(); dirty = true;
    },
    abandonOasis(arg) {
      const v = V(), i = +arg, o = v.oases[i], slot = slotOf('main');
      if (!o) return;
      if (abandonAsk !== i) { abandonAsk = i; if (slot >= 0) openBuilding(slot); return; }
      abandonAsk = -1; v.oases.splice(i, 1);
      A.toast('🌴 ' + OASIS[o.kind].name + L(' abandoned: the slot is free for a new oasis', ' terk edildi: yeni bir vaha için yer açıldı')); A.save(); dirty = true;
      if (slot >= 0) openBuilding(slot);
    },
    // Rewarded ad: the troops this building would train in the next quarter of the queue (15 min - 2 h) arrive right away.
    // The queue is sequential, so pulling every batch earlier by the same amount hands those units over and keeps the rest at its pace.
    async trainAd(b) {
      const v = V();
      if (!v.trainQ.some(q => TROOPS[q.t].b === b)) return;
      if (!(await Ads.rewarded('maden_train_skip'))) { A.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      const qs = v.trainQ.filter(q => TROOPS[q.t].b === b), end = Math.max(...qs.map(q => q.next + (q.n - 1) * q.per)), cut = Math.max(15 * 60e3, Math.min(2 * 3600e3, (end - now()) * 0.25));
      const left = () => qs.reduce((a, q) => a + q.n, 0), before = left();
      for (const q of qs) q.next -= cut;
      tick(0);
      const got = before - left();
      A.toast(L('⏩ ' + got + ' troops arrived (' + dur(cut) + ' of training)', '⏩ ' + got + ' asker hemen geldi (' + dur(cut) + ' eğitim)')); A.save(); dirty = true;
      const i = slotOf(b); if (i >= 0) openBuilding(i);
    },
    train(arg) {
      const [t, nArg] = arg.split(':'), v = V(), tr = TROOPS[t];
      const cc = troopCash(t), max = Math.floor(Math.min(v.iron / tr.cost, A.cash() / cc)), n = nArg === 'max' ? max : Math.min(+nArg, max);
      if (n <= 0) { A.toast(v.iron < tr.cost ? L('Not enough iron', 'Yetersiz demir') : L('Not enough cash (earn it in the mine)', 'Yetersiz nakit (madenden kazan)')); return; }
      if ((t === 'senator' || t === 'kolonici') && lvlOf('kosk') < 10) return;
      if (!A.spend(n * cc)) { A.toast(L('Not enough cash', 'Yetersiz nakit')); return; }
      v.iron -= n * tr.cost;
      const per = trainTime(t), last = v.trainQ.filter(q => TROOPS[q.t].b === tr.b).reduce((a, q) => Math.max(a, q.next + (q.n - 1) * q.per), now());
      v.trainQ.push({ t, n, per, next: Math.max(now(), last) + per });
      A.sfx('coin'); A.save(); dirty = true;
      openBuilding(slotOf(tr.b));
    },
    tile(key) { selTile = key; openTile(key); },
    sendSel(arg) {
      const [t, op] = arg.split(':'), home = V().troops[t] || 0;
      send.tr[t] = op === 'all' ? home : op === '0' ? 0 : Math.max(0, Math.min(home, (send.tr[t] || 0) + +op));
      openSend();
    },
    sendGo(type) {
      const v = V(), tr = {};
      for (const k in send.tr) if (send.tr[k] > 0) tr[k] = Math.min(send.tr[k], v.troops[k] || 0);
      if (type === 'found') { tr.kolonici = 3; if ((v.troops.kolonici || 0) < 3) { A.toast(L('3 settlers needed', '3 kolonici gerekli')); return; } }
      const ft = world().tiles[send.key];
      if (ft && ft.fort && (ft.fallen || !fortOpen(ft.fort) || type === 'conquer')) { A.toast(L('This fortress cannot be attacked now', 'Bu kaleye şu an saldırılamaz')); return; }
      if (type === 'conquer' && !(tr.senator > 0)) { A.toast(L('Pick at least 1 senator to conquer', 'Fetih için en az 1 senatör seç')); return; }
      if (!count(tr)) { A.toast(L('Pick troops', 'Birlik seç')); return; }
      if (!lvlOf('rally')) { A.toast(L('Build a Rally Point first', 'Önce Toplanma Alanı kur')); return; }
      if ((type === 'found' || type === 'conquer') && v.exp >= expSlots()) { A.toast(L('No Residence expansion slot (1 per 10 levels)', 'Köşk genişleme hakkın yok (her 10 seviye 1)')); return; }
      for (const k in tr) v.troops[k] -= tr[k];
      const dist = Math.hypot(send.x - v.x, send.y - v.y);
      G().moves.push({ id: now() + Math.random(), type: type === 'found' ? 'found' : type === 'conquer' ? 'conquer' : 'attack', from: G().cur, fromName: v.name, x: send.x, y: send.y, dist, troops: tr, income: A.incomeOf(G().cur), at: now() + travelMs(tr, dist), start: now() });
      A.toast(L('🚩 Army on the way · ', '🚩 Ordu yola çıktı · ') + dur(travelMs(tr, dist)));
      A.sfx('send'); A.save(); A.closePanel(); dirty = true;
    },
    goVillage(k) { k = +k; A.closePanel(); if (k !== G().cur) A.switchRegion(k); A.setView('mine'); },
    reports() { openReports(); },
    caravan(j) {
      j = +j; const k = G().cur;
      if (caravansBusy(k) >= caravans(k)) { A.toast(L('No free caravan', 'Boşta kervan yok')); return; }
      const amt = Math.min(caravanCap(k, j), A.cash());
      if (!(amt > 0) || !A.spend(amt)) { A.toast(L('Not enough cash', 'Yetersiz nakit')); return; }
      const trip = caravanTrip(k, j), iron = Math.floor(Math.min(V(k).iron, caravanIron(k)));
      V(k).iron -= iron;
      G().moves.push({ id: now() + Math.random(), type: 'caravan', from: k, fromName: V(k).name, to: j, cash: amt, iron, trip, at: now() + trip, start: now() });
      A.toast(L('🐫 Caravan on the way · ', '🐫 Kervan yola çıktı · ') + fmt(amt) + ' 💵 · ' + fmt(iron) + ' ⚒️ · ' + dur(trip)); A.sfx('send'); A.save(); dirty = true;
      const pi = slotOf('pazar'); if (pi >= 0) openBuilding(pi); else A.closePanel();
    },
    report(i) { openReport(+i); },
    reportsRead() { (G().reports || []).forEach(r => { r.read = true; }); A.save(); openReports(); hudIcons(); },
    goMap() { A.closePanel(); A.setView('map'); },
    mapHome() { const v = V(); centerMap(v.x, v.y); },
  };

  // ---------- Panels ----------
  function openConstruction(i) {
    const v = V(), b = bqAt(v, i);
    A.panel('<p class="t-lg">🏗️ ' + BUILD[b.t].icon + ' ' + BUILD[b.t].name + '</p><div class="hint">' + L('Under construction · ', 'İnşaat sürüyor · ') + '<b data-until="' + b.done + '">' + dur(b.done - now()) + '</b></div>' +
      '<button class="btn purple" data-act="finishAd" data-arg="' + i + '"><span class="ad-ico">AD</span>' + L('Finish now', 'Hemen bitir') + '</button><button class="btn gray small" data-act="close">' + L('Close', 'Kapat') + '</button>');
  }
  function openBuilders() {
    const v = V(), n = v.builders || 1;
    let h = '<p class="t-lg">' + L('👷 Builders · ', '👷 İnşaat İşçileri · ') + v.name + '</p><p class="sub">' + L('Each builder works on one construction at a time. Builders belong to this village (max ' + MAX_BUILDERS + ').', 'Her işçi aynı anda bir inşaat yapar. İşçiler bu köye özeldir (en fazla ' + MAX_BUILDERS + ').') + '</p>';
    for (let k = 1; k <= MAX_BUILDERS; k++) h += '<div class="upg"><div><b>' + (k <= n ? '✅' : '🔒') + ' ' + L('Builder #' + k, k + '. işçi') + '</b><small>' + (k === 1 ? L('Free in every village', 'Her köyde ücretsiz') : k <= n ? L('Working', 'Çalışıyor') : '⭐ ' + BUILDER_COST[k]) + '</small></div>' +
      (k === n + 1 ? '<button class="btn small ' + (Save.data.coins >= BUILDER_COST[k] ? 'gold' : 'gray') + '" data-act="buyBuilder">⭐ ' + BUILDER_COST[k] + '</button>' : '') + '</div>';
    A.panel(h + '<p class="tip">' + L('⭐ Balance: ', '⭐ Bakiye: ') + Save.data.coins + '</p><button class="btn gray small" data-act="close">' + L('Close', 'Kapat') + '</button>');
  }
  function openEmpty(i) {
    const v = V();
    let h = i === WALL_SLOT ? '<p class="t-lg">' + L('🧱 Village Gate', '🧱 Köy Kapısı') + '</p><p class="sub">' + L('The wall around the village is built here. Every level adds defense and makes the wall look stronger.', 'Köyü saran sur buradan kurulur. Her seviye savunmayı artırır ve surun görünümü güçlenir.') + '</p>'
      : '<p class="t-lg">' + L('Empty Plot', 'Boş Arsa') + '</p><p class="sub">' + L('Pick the building you want on this plot.', 'Bu arsaya kurmak istediğin binayı seç.') + '</p>';
    for (const t in BUILD) {
      if (t === 'main' || hasType(v, t) || (t === 'wall') !== (i === WALL_SLOT)) continue;
      const ok = reqOk(t), c = buildCost(t, 0);
      h += '<div class="upg"><div><b>' + BUILD[t].icon + ' ' + BUILD[t].name + '</b><small>' + (BUILD[t].desc || L('Earns cash continuously.', 'Sürekli nakit üretir.')) + (ok ? ' · ⏱ ' + dur(buildTime(t, 0)) : ' · 🔒 ' + reqText(t)) + '</small></div>' +
        (ok ? '<button class="btn small ' + (A.cash() >= c && freeBuilders(v) > 0 ? 'green' : 'gray') + '" data-act="build" data-arg="' + i + ':' + t + '">💵 ' + fmt(c) + '</button>' : '') + '</div>';
    }
    A.panel(h + '<button class="btn gray small" data-act="close">' + L('Close', 'Kapat') + '</button>');
  }
  function effectText(t, l, k) {
    const b = BUILD[t];
    if (b.prod === 'iron') return fmt(ironRate(k) * 60) + L(' iron/min', ' demir/dk');
    if (b.prod === 'cash') return fmt(A.bizIncomeOf(t, l, k)) + L(' 💵/s', ' 💵/sn');
    if (t === 'main') return L('Build speed +' + Math.round(6 * l) + '%', 'İnşaat hızı +%' + Math.round(6 * l));
    if (t === 'wall') return L('Defense +' + Math.round((Math.pow(1.04, l) - 1) * 100) + '%', 'Savunma +%' + Math.round((Math.pow(1.04, l) - 1) * 100));
    if (t === 'hideout') return L(Math.min(80, 8 * l) + '% of your cash is safe', 'Nakdin %' + Math.min(80, 8 * l) + '\'i güvende');
    if (t === 'kosk') return L('Expansion ', 'Genişleme ') + V(k).exp + '/' + Math.floor(l / 10) + L(' · oases ', ' · vaha ') + V(k).oases.length + '/' + Math.floor(l / 5);
    if (b.desc && (t === 'barracks' || t === 'stable' || t === 'workshop')) return L('Training speed +' + 5 * l + '%', 'Eğitim hızı +%' + 5 * l);
    return '';
  }
  function openBuilding(i) {
    const v = V(), s = v.slots[i], b = BUILD[s.t], k = G().cur, busy = bqAt(v, i);
    let h = '<p class="t-lg">' + b.icon + ' ' + b.name + '</p><span class="chip">' + L('Level ', 'Seviye ') + s.l + (effectText(s.t, s.l, k) ? ' · ' + effectText(s.t, s.l, k) : '') + '</span>' + (b.desc ? '<p class="sub">' + b.desc + '</p>' : '');
    if (busy) h += '<div class="hint">' + L('🏗️ Building level ' + (s.l + 1) + ' · ', '🏗️ Seviye ' + (s.l + 1) + ' yapılıyor · ') + '<b data-until="' + busy.done + '">' + dur(busy.done - now()) + '</b></div><button class="btn purple" data-act="finishAd" data-arg="' + i + '"><span class="ad-ico">AD</span>' + L('Finish now', 'Hemen bitir') + '</button>';
    else if (s.l < b.max && s.l >= levelCap(s.t, k)) h += '<div class="hint">' + capText(s.t, k) + L(' · grow the mine and the village grows too', ' · madeni büyüt, köy de büyüsün') + '</div>';
    else if (s.l < b.max) {
      const c = buildCost(s.t, s.l);
      h += '<button class="btn ' + (A.cash() >= c && freeBuilders(v) > 0 ? 'green' : 'gray') + '" data-act="build" data-arg="' + i + ':' + s.t + '">' + L('⬆ Lv.', '⬆ Sv.') + (s.l + 1) + ' · 💵 ' + fmt(c) + ' · ⏱ ' + dur(buildTime(s.t, s.l)) + '</button>' +
        (freeBuilders(v) <= 0 ? '<p class="tip">' + L('👷 All builders are busy · <a data-act="builders">hire a builder</a>', '👷 Bütün işçiler çalışıyor · <a data-act="builders">işçi al</a>') + '</p>' : '');
    } else h += '<span class="chip">' + L('✓ Max level', '✓ En üst seviye') + '</span>';
    // Training buildings.
    const units = Object.keys(TROOPS).filter(t => TROOPS[t].b === s.t);
    if (units.length) {
      // Training: one card per unit (stats as badges, cost line, three buy buttons), then the queue with progress.
      h += '<div class="tres"><span>⚒️ ' + L('Iron', 'Demir') + ' <b>' + fmt(v.iron) + '</b></span><span>💵 <b>' + fmt(A.cash()) + '</b></span></div><div class="tcards">';
      for (const t of units) {
        const tr = TROOPS[t], locked = (tr.lvl || 1) > s.l, q = v.trainQ.filter(x => x.t === t).reduce((a, x) => a + x.n, 0);
        const cc = troopCash(t, k), mx = Math.floor(Math.min(v.iron / tr.cost, A.cash() / cc));
        h += '<div class="tcard' + (locked ? ' locked' : '') + '"><div class="th"><span class="ti">' + tr.icon + '</span><div><b>' + tr.name + '</b><small>' + L('At home ', 'Köyde ') + fmt(v.troops[t] || 0) + (q ? ' · +' + fmt(q) + L(' training', ' eğitimde') : '') + '</small></div></div>' +
          '<div class="tst"><span title="attack">⚔️ ' + tr.atk + '</span><span title="defence vs infantry">🛡️ ' + tr.di + '</span><span title="defence vs cavalry">🐎 ' + tr.dc + '</span><span title="speed">👟 ' + tr.spd + '</span><span title="carry">🎒 ' + tr.carry + '</span></div>' +
          '<div class="tcost">' + L('1 unit: ', '1 asker: ') + '⚒️ ' + tr.cost + ' + 💵 ' + fmt(cc) + ' · ⏱ ' + Math.round(trainTime(t) / 1000) + L(' s', ' sn') + '</div>' +
          (locked ? '<div class="tlock">🔒 ' + b.name + ' ' + L('Lv.', 'Sv.') + tr.lvl + L(' needed', ' gerekli') + '</div>'
            : '<div class="tbtns"><button class="btn small ' + (mx >= 1 ? 'green' : 'gray') + '" data-act="train" data-arg="' + t + ':1">+1</button><button class="btn small ' + (mx >= 10 ? 'green' : 'gray') + '" data-act="train" data-arg="' + t + ':10">+10</button><button class="btn small ' + (mx ? 'gold' : 'gray') + '" data-act="train" data-arg="' + t + ':max">' + L('MAX', 'MAKS') + (mx ? ' · ' + fmt(mx) : '') + '</button></div>') + '</div>';
      }
      h += '</div>';
      const qs = v.trainQ.filter(x => TROOPS[x.t].b === s.t);
      if (qs.length) {
        const end = Math.max(...qs.map(x => x.next + (x.n - 1) * x.per));
        h += '<div class="tq"><p class="tql">' + L('⏳ Training queue', '⏳ Eğitim kuyruğu') + ' · ' + L('all done in ', 'tümü ') + '<b data-until="' + end + '"></b></p>' +
          qs.map(x => { const p = Math.max(0, Math.min(1, 1 - (x.next - now()) / x.per)); return '<div class="tqi"><span>' + TROOPS[x.t].icon + ' ' + fmt(x.n) + '× ' + TROOPS[x.t].name + '</span><i class="tqb"><i style="width:' + Math.round(p * 100) + '%"></i></i><b data-until="' + x.next + '"></b></div>'; }).join('') + '</div>' +
          '<button class="btn purple" data-act="trainAd" data-arg="' + s.t + '"><span class="ad-ico">AD</span>' + L('⏩ Get troops now: ', '⏩ Askerleri hemen al: ') + dur(Math.max(15 * 60e3, Math.min(2 * 3600e3, (end - now()) * 0.25))) + '</button>';
      }
    }
    if (s.t === 'rally') h += rallyHtml(k);
    if (s.t === 'pazar') h += caravanHtml(k);
    if (s.t === 'main') h += oasesHtml(k);
    A.panel(h + '<button class="btn gray small" data-act="close">' + L('Close', 'Kapat') + '</button>');
  }
  // Rally point: incoming, outgoing and home troops of village k (Travian's troop overview).
  // Main Building: the village's linked oases, each can be given up to free its slot for another one (asks once before it goes).
  let abandonAsk = -1;
  function oasesHtml(k) {
    const v = V(k);
    if (!v.oases.length) return '';
    return '<div class="tq"><p class="tql">' + L('🌴 Oases of this village', '🌴 Bu köyün vahaları') + ' · ' + v.oases.length + '/' + oasisSlots(k) + '</p>' +
      v.oases.map((o, i) => '<div class="upg"><div><b>' + OASIS[o.kind].icon + ' ' + OASIS[o.kind].name + '</b><br><small>' + o.x + '|' + o.y + ' · ' + OASIS[o.kind].desc + '</small></div>' +
        '<button class="btn small ' + (abandonAsk === i ? 'red' : 'gray') + '" data-act="abandonOasis" data-arg="' + i + '">' + (abandonAsk === i ? L('✔ Sure?', '✔ Emin misin?') : L('Abandon', 'Terk et')) + '</button></div>').join('') + '</div>';
  }
  function rallyHtml(k) {
    const v = V(k), ms = (G().moves || []).slice().sort((a, b) => a.at - b.at);
    const place = m => { const t = world().tiles[m.x + ',' + m.y]; return t ? (t.type === 'npc' ? t.name : OASIS[t.kind].name) + ' (' + m.x + '|' + m.y + ')' : m.x + '|' + m.y; };
    const row = (cls, label, m) => '<div class="mv ' + cls + '"><div class="mh"><b>' + label + '</b><span>⏱ <b data-until="' + m.at + '">' + dur(m.at - now()) + '</b></span></div>' + (m.troops ? troopTable(m.troops) : '') + '</div>';
    const inc = ms.filter(m => (m.type === 'raid' && m.to === k) || (m.type === 'return' && m.from === k) || (m.type === 'caravan' && m.to === k));
    const out = ms.filter(m => (m.type === 'attack' || m.type === 'conquer' || m.type === 'found' || m.type === 'caravan' || m.type === 'caravanBack') && m.from === k);
    let h = '<div class="rtabs"><button class="btn small" data-act="reports">' + L('📜 Reports', '📜 Raporlar') + (unread() ? ' (' + unread() + ')' : '') + '</button><button class="btn small green" data-act="goMap">' + L('🗺️ Send army', '🗺️ Ordu gönder') + '</button></div>';
    h += '<p class="rsec">' + L('⬇️ Incoming troops', '⬇️ Gelen birlikler') + '</p>' + (inc.length ? inc.map(m => m.type === 'caravan' ? row('in', L('🐫 Caravan · ', '🐫 Kervan · ') + m.fromName + ' · +' + fmt(m.cash) + ' 💵 · +' + fmt(m.iron || 0) + ' ⚒️', m) : m.type === 'raid' ? row('bad', L('⚠️ Barbarian attack → ', '⚠️ Barbar saldırısı → ') + v.name, m) : row('in', L('🎒 Returning · ', '🎒 Dönüş · ') + place(m) + (m.cash || m.iron ? ' · +' + fmt(m.cash || 0) + ' 💵 +' + fmt(m.iron || 0) + ' ⚒️' : ''), m)).join('') : '<p class="tip">' + L('None', 'Yok') + '</p>');
    h += '<p class="rsec">' + L('⬆️ Outgoing troops', '⬆️ Giden birlikler') + '</p>' + (out.length ? out.map(m => m.type === 'caravan' ? row('out', L('🐫 Caravan → ', '🐫 Kervan → ') + V(m.to).name + ' · ' + fmt(m.cash) + ' 💵', m) : m.type === 'caravanBack' ? row('out', L('🐫 Caravan returning ← ', '🐫 Kervan dönüyor ← ') + V(m.to).name, m) : row('out', (m.type === 'found' ? L('🧑‍🌾 Founding → ', '🧑‍🌾 Köy kurmaya → ') : m.type === 'conquer' ? L('🎖️ Conquest → ', '🎖️ Fetih → ') : L('⚔️ Attack → ', '⚔️ Saldırı → ')) + place(m), m)).join('') : '<p class="tip">' + L('None', 'Yok') + '</p>');
    h += '<p class="rsec">' + L('🏠 Troops at home', '🏠 Köydeki birlikler') + '</p>' + troopTable(v.troops, null, v.name);
    return h;
  }
  const unread = () => (G().reports || []).filter(r => !r.read).length;
  function openReports() {
    const rs = G().reports || [];
    A.panel('<p class="t-lg">' + L('📜 Reports', '📜 Raporlar') + '</p>' + (rs.length ? '<div class="rlist">' + rs.map((r, i) => '<button class="rrow' + (r.read ? '' : ' new') + '" data-act="report" data-arg="' + i + '"><i class="' + (r.win ? 'ok' : 'bad') + '">' + (r.data && (r.data.barb || r.data.from === 'Barbarlar') ? '🛡️' : '⚔️') + '</i><span><b>' + r.title + '</b><small>' + ago(r.t) + '</small></span></button>').join('') + '</div>' +
      '<button class="btn gray small" data-act="reportsRead">' + L('Mark all as read', 'Hepsini okundu yap') + '</button>' : '<p class="sub">' + L('No reports yet.', 'Henüz rapor yok.') + '</p>') + '<button class="btn gray small" data-act="close">' + L('Close', 'Kapat') + '</button>');
  }
  function openReport(i) {
    const r = (G().reports || [])[i];
    if (!r) return openReports();
    r.read = true; dirty = true;
    const d = r.data;
    let h = '<p class="t-lg">' + (r.win ? '✅ ' : '❌ ') + r.title + '</p><span class="chip">' + ago(r.t) + '</span>';
    if (d) {
      h += '<div class="rep"><p class="rsec att">' + L('⚔️ Attacker · ', '⚔️ Saldıran · ') + d.from + '</p>' + troopTable(d.att, d.attLost, L('Troops / losses', 'Birlikler / kayıp')) +
        '<p class="rsec def">' + L('🛡️ Defender · ', '🛡️ Savunan · ') + d.to + '</p>' + (d.def ? troopTable(d.def, d.defLost, L('Troops / losses', 'Birlikler / kayıp')) : '<p class="tip">' + L('Wild animals · power ', 'Vahşi hayvanlar · güç ') + fmt(d.animals || 0) + '</p>') +
        (d.wall != null ? '<p class="tip">' + L('🧱 Wall level ', '🧱 Sur seviyesi ') + d.wall + '</p>' : '') +
        (d.loot ? '<div class="loot">' + L('🎒 Loot: ', '🎒 Ganimet: ') + '<b>' + fmt(d.loot.cash || 0) + ' 💵</b> · <b>' + fmt(d.loot.iron || 0) + ' ⚒️</b></div>' : '') +
        (d.loyal != null ? '<p class="tip">' + L('🎖️ Loyalty ' + Math.max(0, Math.round(d.loyal)) + '%', '🎖️ Sadakat %' + Math.max(0, Math.round(d.loyal))) + '</p>' : '') + '</div>';
    } else h += '<p class="sub">' + r.lines.join('<br>') + '</p>';
    A.panel(h + '<div class="row"><button class="btn small" data-act="reports">' + L('◀ Reports', '◀ Raporlar') + '</button><button class="btn gray small" data-act="close">' + L('Close', 'Kapat') + '</button></div>');
    hudIcons();
  }
  // HUD: unread reports badge and a red alert while barbarians march on one of your villages.
  function hudIcons() {
    if (!document.getElementById) return;
    const b = document.getElementById('repBadge'), a = document.getElementById('atkBtn');
    if (b) { const n = unread(); UI.txt(b, n > 9 ? '9+' : String(n)); b.classList.toggle('hidden', !n); }
    if (a) a.classList.toggle('hidden', !(G().moves || []).some(m => m.type === 'raid'));
  }
  function openTile(key) {
    const [x, y] = key.split(',').map(Number), w = world(), t = w.tiles[key], vk = villageAt(x, y), v = V(), dist = Math.hypot(x - v.x, y - v.y);
    const bio = A.REGIONS[biomeAt(x, y)];
    let h = '';
    if (vk >= 0) {
      const o = V(vk);
      h = '<p class="t-lg">' + (vk === 0 ? '👑 ' : '🏠 ') + o.name + '</p><span class="chip">' + bio.icon + ' ' + bio.name + ' · ' + o.shafts.length + L(' floors · ', ' kat · ') + troopsTxt(o.troops) + '</span>' +
        (vk === G().cur ? '<p class="sub">' + L('You are here now.', 'Şu an buradasın.') + '</p>' : '<button class="btn green" data-act="goVillage" data-arg="' + vk + '">' + L('Go to village ▶', 'Köye git ▶') + '</button>');
      A.panel(h + '<button class="btn gray small" data-act="close">' + L('Close', 'Kapat') + '</button>');
      return;
    }
    send = { x, y, tr: {}, key };
    openSend();
  }
  function fortHtml(t, x, y, dist) {
    const F = FORTS[t.fort - 1], trophy = G().trophy || {};
    let h = '<p class="t-lg">' + (t.fallen ? '🏳️ ' : '🏰 ') + t.name + '</p><span class="chip">' + L('Barbarian fortress ', 'Barbar kalesi ') + t.fort + '/' + FORTS.length + ' · ' + x + '|' + y + ' · ' + dist.toFixed(1) + L(' tiles', ' kare') + '</span>';
    if (t.fallen) h += '<p class="sub">' + L('🏳️ Fallen. Permanent bonus: ', '🏳️ Düştü. Kalıcı bonus: ') + '<b>' + F.desc + '</b></p>';
    else {
      h += '<p class="sub">' + L('Garrison ', 'Garnizon ') + troopsTxt(t.def) + '<br>' + L('Defense ~', 'Savunma ~') + fmt(sum(t.def, u => (u.di + u.dc) / 2) * Math.pow(1.04, t.wall)) + L(' · Wall ', ' · Sur ') + t.wall + '</p>' +
        '<div class="loot">' + L('🏆 If it falls: ', '🏆 Düşürürsen: ') + '<b>' + F.hours + L(' hours of income + iron + ', ' saatlik gelir + demir + ') + F.stars + ' ⭐</b><br>' + L('✨ Permanent bonus: ', '✨ Kalıcı bonus: ') + '<b>' + F.desc + '</b><br><small>' + L('A lost attack still kills part of the garrison; it refills slowly (0.3%/min). Rams break the wall.', 'Kaybedilen saldırı da garnizonun bir kısmını öldürür; kale yavaş toparlanır (dakikada %0,3). Koçbaşı suru yıkar.') + '</small></div>';
      if (!fortOpen(t.fort)) h += '<p class="tip">🔒 ' + L('Bring down ' + FORTS[t.fort - 2].name + ' first.', 'Önce ' + FORTS[t.fort - 2].name + ' düşmeli.') + '</p>';
    }
    const won = Object.keys(trophy).filter(k => trophy[k] > 0);
    if (won.length) h += '<p class="tip">' + L('Your fortress bonuses: ', 'Kale bonusların: ') + won.map(k => OASIS[k].icon + ' +' + Math.round(trophy[k] * 100) + '%').join(' · ') + '</p>';
    return h;
  }
  function openSend() {
    const { x, y, key } = send, w = world(), t = w.tiles[key], v = V(), dist = Math.hypot(x - v.x, y - v.y), bio = A.REGIONS[biomeAt(x, y)];
    if (t) regen(t);
    let h;
    if (!t) h = '<p class="t-lg">' + bio.icon + L(' Empty land', ' Boş arazi') + '</p><span class="chip">' + bio.name + ' · ' + x + '|' + y + ' · ' + dist.toFixed(1) + L(' tiles', ' kare') + '</span><p class="sub">' + L('With 3 settlers you can found a new village (a new mine) here. Its rule: ', '3 kolonici ile buraya yeni köy (yeni maden) kurabilirsin. Kuralı: ') + bio.rule + '</p>';
    else if (t.type === 'oasis') {
      const own = oasisOwner(x, y);
      const slots = oasisSlots(), used = v.oases.length, animals = t.pow * (t.animals == null ? 1 : t.animals);
      h = '<p class="t-lg">' + OASIS[t.kind].icon + ' ' + OASIS[t.kind].name + '</p><span class="chip">' + x + '|' + y + ' · ' + dist.toFixed(1) + L(' tiles', ' kare') + '</span>' +
        '<div class="loot">' + L('✨ If you capture it: ', '✨ Fethedersen: ') + '<b>' + OASIS[t.kind].desc + '</b><br><small>' + L('The bonus works for the village you link it to (this one: ' + v.name + '). Oases of the same kind stack.', 'Bonus, vahayı bağladığın köyün kendisine işler (bu köy: ' + v.name + '). Aynı türden birden fazla vaha üst üste eklenir.') + '</small></div>' +
        (own >= 0 ? '<p class="sub">' + L('🔗 Linked to ' + V(own).name + '.', '🔗 ' + V(own).name + ' köyüne bağlı.') + '</p>'
          : '<p class="sub">' + L('🐺 Wild animals · power ~', '🐺 Vahşi hayvanlar · güç ~') + fmt(animals) + (animals < 1 ? L(' (cleared, can be linked now)', ' (temizlendi, hemen bağlanabilir)') : '') + '<br>' + L('🏯 Oasis slots: ', '🏯 Vaha hakkın: ') + used + '/' + slots + (used >= slots ? L(' · upgrade the Residence (+1 slot every 5 levels)', ' · Köşk\'ü yükselt (her 5 seviye +1 hak)') : '') + '</p>');
    } else if (t.fort) h = fortHtml(t, x, y, dist);
    else h = '<p class="t-lg">🛖 ' + t.name + '</p><span class="chip">' + L('Barbarian village · size ', 'Barbar köyü · büyüklük ') + t.s + ' · ' + dist.toFixed(1) + L(' tiles', ' kare') + '</span>' +
      '<p class="sub">' + L('Defense ~', 'Savunma ~') + fmt(sum(t.def, u => (u.di + u.dc) / 2) * Math.pow(1.04, t.wall)) + L(' · Wall ', ' · Sur ') + t.wall + L(' · Loyalty ' + Math.round(t.loyal) + '%', ' · Sadakat %' + Math.round(t.loyal)) + L(' · Loot ~', ' · Ganimet ~') + Math.round(Math.min(t.stash, stashCap(t))) + '/' + stashCap(t) + L(' min of income (refills slowly)', ' dk gelir (yavaş dolar)') + '</p>';
    const home = Object.keys(TROOPS).filter(k => (v.troops[k] || 0) > 0 && k !== 'kolonici');
    if (t || true) {
      h += home.length ? '' : '<p class="tip">' + L('No troops at home. Build barracks and train some.', 'Evde asker yok. Kışla kur ve asker bas.') + '</p>';
      for (const k of home) {
        const n = send.tr[k] || 0;
        h += '<div class="upg"><div><b>' + TROOPS[k].icon + ' ' + TROOPS[k].name + ' · ' + n + '/' + Math.floor(v.troops[k]) + '</b></div><div class="row" style="gap:4px">' +
          '<button class="btn small gray" data-act="sendSel" data-arg="' + k + ':0">0</button><button class="btn small green" data-act="sendSel" data-arg="' + k + ':10">+10</button><button class="btn small gold" data-act="sendSel" data-arg="' + k + ':all">' + L('All', 'Hepsi') + '</button></div></div>';
      }
    }
    const tr = {}; for (const k in send.tr) if (send.tr[k] > 0) tr[k] = send.tr[k];
    if (count(tr)) {
      const carry = sum(tr, u => u.carry), paid = sum(tr, u => u.time * TROOP_CASH) / 60;
      h += '<p class="sub">' + L('⚔️ Power ', '⚔️ Güç ') + fmt(sum(tr, u => u.atk)) + ' · ⏱ ' + dur(travelMs(tr, dist)) + '</p>' +
        '<div class="loot">' + L('🎒 Carry capacity: ', '🎒 Taşıma kapasitesi: ') + '<b>' + Math.round(carry) + L(' min of mine income', ' dk maden geliri') + '</b> (≈ ' + fmt(carry * 60 * A.incomeOf(G().cur)) + ' 💵)' +
        (paid > 0 ? '<br><small>' + L('This army cost ≈ ' + (paid < 1 ? Math.round(paid * 60) + ' s' : paid.toFixed(1) + ' min') + ' of income: one good raid can bring back ' + Math.max(1, Math.round(carry / paid)) + 'x that.', 'Bu ordunun maliyeti ≈ ' + (paid < 1 ? Math.round(paid * 60) + ' sn' : paid.toFixed(1) + ' dk') + ' gelirdi: tek başarılı yağma ' + Math.max(1, Math.round(carry / paid)) + ' katını getirebilir.') + '</small>' : '') + '</div>';
    }
    if (!t) h += '<button class="btn gold" data-act="sendGo" data-arg="found">' + L('🧑‍🌾 Found village (3 settlers · at home ', '🧑‍🌾 Köy kur (3 kolonici · evde ') + (v.troops.kolonici || 0) + ')</button>';
    else if (t.fort) {
      if (!t.fallen && fortOpen(t.fort)) h += '<button class="btn red" data-act="sendGo" data-arg="attack">' + L('⚔️ Attack the fortress', '⚔️ Kaleye saldır') + '</button>';
    } else {
      h += '<button class="btn red" data-act="sendGo" data-arg="attack">' + L('⚔️ Attack / Raid', '⚔️ Saldır / Yağmala') + '</button>';
      if (t.type === 'npc') h +='<button class="btn purple" data-act="sendGo" data-arg="conquer">' + L('🎖️ Conquer (with senator)', '🎖️ Fethet (senatörle)') + '</button>';
    }
    A.panel(h + '<button class="btn gray small" data-act="close">' + L('Close', 'Kapat') + '</button>');
  }

  // ---------- Views ----------
  function renderVillage(el) {
    ensureVillage(V(), G().cur);
    const v = V(), k = G().cur, bio = A.REGIONS[v.b];
    const moves = (G().moves || []).filter(m => m.from === k || m.to === k);
    let h = '<div class="vhead" style="--c1:' + bio.card[0] + ';--c2:' + bio.card[1] + '"><b>' + (k === 0 ? '👑 ' : '🏠 ') + v.name + ' · ' + bio.icon + ' ' + bio.name + '</b>' +
      '<small>' + L('⚔️ Iron ', '⚔️ Demir ') + '<b>' + fmt(v.iron) + '</b> (+' + fmt(ironRate(k) * 60) + L('/min) · Army: ', '/dk) · Ordu: ') + troopsTxt(v.troops) + '</small>' +
      '<small>' + L('👷 Builders ', '👷 İşçi ') + v.bqs.length + '/' + v.builders + (v.bqs.length ? ' · ' + v.bqs.map(b => BUILD[b.t].name + ' <b data-until="' + b.done + '">' + dur(b.done - now()) + '</b>').join(' · ') : L(' · tap a plot', ' · bir arsaya dokun')) + '</small>' +
      (v.builders < MAX_BUILDERS ? '<button class="btn small gold ws" data-act="builders">' + L('👷 Hire builder #' + (v.builders + 1) + ' · ⭐ ', '👷 İşçi al · ' + (v.builders + 1) + '. işçi ⭐ ') + BUILDER_COST[v.builders + 1] + '</button>' : '') +
      (v.protectUntil > now() ? '<small>' + L('🛡️ Protected: no barbarian raids · ', '🛡️ Koruma: barbar akını yok · ') + '<b data-until="' + v.protectUntil + '">' + dur(v.protectUntil - now()) + '</b></small>' : '') +
      (G().townBoostUntil > now() ? '<small>' + L('⚡ 2x speed · ', '⚡ 2x hız · ') + '<b data-until="' + G().townBoostUntil + '"></b></small>' : '<button class="btn small purple ws" data-act="speedAd"><span class="ad-ico">AD</span>' + L('⚡ 15 min 2x building & training', '⚡ 15 dk 2x inşaat ve eğitim') + '</button>') + '</div>';
    if (moves.length) h += '<div class="moves">' + moves.map(m => '<span class="' + (m.type === 'raid' ? 'bad' : '') + '">' + (m.type === 'raid' ? L('⚠️ Barbarian raid', '⚠️ Barbar akını') : m.type === 'return' ? L('🎒 Returning', '🎒 Dönüş') : m.type === 'found' ? L('🧑‍🌾 Founding a village', '🧑‍🌾 Köy kuruluyor') : m.type === 'caravan' ? (m.to === k ? L('🐫 Caravan coming', '🐫 Kervan geliyor') : L('🐫 Caravan → ', '🐫 Kervan → ') + V(m.to).name) : m.type === 'caravanBack' ? L('🐫 Caravan returning', '🐫 Kervan dönüyor') : (m.type === 'conquer' ? L('🎖️ Conquest ', '🎖️ Fetih ') : L('⚔️ Attack ', '⚔️ Saldırı ')) + m.x + '|' + m.y) + ' · <b data-until="' + m.at + '"></b></span>').join('') + '</div>';
    if (V3 !== false && window.Village3D) {
      // 3D village: persistent canvas, only the header and labels are rebuilt.
      if (!el.querySelector || !el.querySelector('#vwrap')) {
        el.innerHTML = '<div id="vhead"></div><div id="vwrap" class="v3d"><canvas id="vcan"></canvas><div id="vlab"></div></div>';
        V3 = window.Village3D.init(document.getElementById('vcan'));
        document.getElementById('vwrap').style.aspectRatio = '1 / ' + window.Village3D.RATIO.toFixed(3);
        if (!V3) { V3 = false; el.innerHTML = ''; return renderVillage(el); }
        document.getElementById('vcan').addEventListener('click', e => {
          const r = e.target.getBoundingClientRect(), i = V3.pick(e.clientX - r.left, e.clientY - r.top);
          if (i >= 0) { A.sfx('click'); actions.plot(i); }
        });
        v3size = '';
      }
      document.getElementById('vhead').innerHTML = h;
      labels();
      dirty = false;
      return;
    }
    h += '<div class="village" style="--c1:' + bio.grass + '">';
    v.slots.forEach((s, i) => {
      const bq = bqAt(v, i);
      h += '<button class="plot' + (s ? ' built' : '') + (bq ? ' busy' : '') + '" data-act="plot" data-arg="' + i + '">' +
        (s ? '<span class="pi">' + BUILD[s.t].icon + '</span><i>' + s.l + '</i><small>' + BUILD[s.t].name + '</small>' : bq ? '<span class="pi">🏗️</span><small>' + BUILD[bq.t].name + '</small>' : '<span class="plus">＋</span>') +
        (bq ? '<b class="pt" data-until="' + bq.done + '"></b>' : '') + '</button>';
    });
    el.innerHTML = h + '</div>';
    dirty = false;
  }
  const TILE = 46;
  let mapFor = -1, mapCenter = null;
  function centerMap(x, y) {
    const sc = document.querySelector && document.querySelector('#map .wscroll');
    if (!sc) { mapCenter = [x, y]; return; }
    sc.scrollLeft = (x + WORLD_R) * TILE + TILE / 2 + 6 - sc.clientWidth / 2;
    sc.scrollTop = (y + WORLD_R) * TILE + TILE / 2 + 6 - sc.clientHeight / 2;
  }
  function renderMap(el) {
    const w = world(), v = V(), k = G().cur;
    const old = el.querySelector && el.querySelector('.wscroll'), keep = old && mapFor === k ? [old.scrollLeft, old.scrollTop] : null;
    let h = '<div class="vhead" style="--c1:#4a44b8;--c2:#1b1464"><b>' + L('🗺️ World Map', '🗺️ Dünya Haritası') + '</b><small>' + L('Drag to explore · 👑 capital · 🏠 your village · 🛖 barbarians · 🏰 fortress · 🌴⛰️🌬️💎⛏️ oasis · found villages on empty tiles', 'Sürükleyerek gez · 👑 başkent · 🏠 köyün · 🛖 barbar · 🏰 kale · 🌴⛰️🌬️💎⛏️ vaha · boş kareye köy kur') + '</small>' +
      '<div class="row" style="gap:6px;margin-top:6px"><button class="btn small" data-act="mapHome">🏠 ' + v.name + ' (' + v.x + '|' + v.y + ')</button></div></div>' +
      '<div class="wscroll"><div class="wmap2" style="grid-template-columns:repeat(' + (2 * WORLD_R + 1) + ',' + (TILE - 2) + 'px)">';
    for (let y = -WORLD_R; y <= WORLD_R; y++) for (let x = -WORLD_R; x <= WORLD_R; x++) {
      const key = x + ',' + y, t = w.tiles[key], vk = villageAt(x, y), bio = A.REGIONS[vk >= 0 ? V(vk).b || 0 : biomeAt(x, y)];
      let icon = '', cls = '';
      if (vk >= 0) { icon = vk === 0 ? '👑' : '🏠'; cls = vk === k ? ' me' : ' own'; }
      else if (t && t.fort) { icon = t.fallen ? '🏳️' : '🏰'; cls = ' npc fort' + (t.fallen ? ' down' : fortOpen(t.fort) ? ' open' : ''); }
      else if (t && t.type === 'npc') { icon = '🛖'; cls = ' npc'; }
      else if (t) { icon = OASIS[t.kind].icon; cls = oasisOwner(x, y) >= 0 ? ' own' : ' oasis'; }
      h += '<button class="wt2' + cls + '" style="background:' + bio.card[0] + '" data-act="tile" data-arg="' + key + '">' + icon + (x % 5 === 0 && y % 5 === 0 ? '<small>' + x + '|' + y + '</small>' : '') + '</button>';
    }
    el.innerHTML = h + '</div></div>';
    const sc = el.querySelector && el.querySelector('.wscroll');
    if (sc && keep) { sc.scrollLeft = keep[0]; sc.scrollTop = keep[1]; }
    else if (sc) centerMap(v.x, v.y);
    mapFor = k; dirty = false;
  }
  // Level badges over the 3D buildings (re-placed when the canvas size changes).
  function labels() {
    const wrap = document.getElementById('vwrap');
    if (!wrap || !V3) return;
    const key = wrap.clientWidth + 'x' + wrap.clientHeight;
    if (key !== v3size && wrap.clientWidth > 0) { v3size = key; V3.resize(wrap.clientWidth, wrap.clientHeight); }
  }
  function frame(dt) {
    if (!V3) return;
    const wrap = document.getElementById('vwrap');
    if (!wrap) return;
    labels();
    const v = V(), bio = A.REGIONS[v.b], leaf = { col: '#8aa040', buz: '#2f6f5a', volkan: '#4a3a30', ay: '#8a8a96' }[bio.id];
    const info = i => { const x = v.slots[i]; if (x) return { icon: BUILD[x.t].icon, name: BUILD[x.t].name, lvl: x.l, max: BUILD[x.t].prod ? 100 : BUILD[x.t].max }; const b = bqAt(v, i); if (b) return { icon: BUILD[b.t].icon, name: BUILD[b.t].name, lvl: 1 }; return { icon: '➕', name: L('Empty plot', 'Boş arsa') }; };
    const home = {}; for (const t in v.troops) home[t] = Math.floor(v.troops[t]);
    V3.render({ slots: v.slots, bqs: v.bqs, wall: lvlOf('wall'), theme: Object.assign({ grass: bio.grass, leaf, id: bio.id }, A.skins ? A.skins() : {}), info, troops: home }, dt);
  }
  // Countdowns in any open view or panel.
  function updateTimers() {
    if (!document.querySelectorAll) return;
    for (const el of document.querySelectorAll('[data-until]')) el.textContent = dur(+el.dataset.until - now());
    hudIcons();
  }

  window.Empire = {
    BUILD, TROOPS,
    init(api) {
      A = api;
      A.G.regions.forEach((v, k) => ensureVillage(v, k));
      world();
      if (!A.G.moves) A.G.moves = [];
      Object.assign(A.actions, actions);
      const rb = document.getElementById && document.getElementById('repBtn'), ab = document.getElementById && document.getElementById('atkBtn');
      if (rb) rb.onclick = () => { A.sfx('click'); openReports(); };
      if (ab) ab.onclick = () => { A.sfx('click'); const k = G().cur, i = slotOf('rally', k); if (i >= 0) openBuilding(i); else openReports(); };
      hudIcons();
    },
    tick,
    ensureVillage,
    lvlOf, cashBuildings, oasisMul, buildingCount: k => V(k).slots.filter(Boolean).length,
    renderVillage, renderMap, updateTimers, frame,
    isDirty: () => dirty, markDirty() { dirty = true; },
    _t: { world, arrive, fortOpen, FORTS, G: () => A.G }, // test hook (tests/fort-test)
  };
})();
