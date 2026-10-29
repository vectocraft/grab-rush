// Arrow Legends — Archero-style roguelite. Move with a floating joystick; stand still and the hero fires at the
// nearest enemy. Clear a room and its door opens. Chapters grow from 10 to 50 rooms; inside every 10 rooms
// room 5 is an angel and room 10 a boss (the last one is the chapter boss, the others save a checkpoint).
// Level-ups offer 1 of 3 skills, so every run builds differently. Between runs: equipment (rarity, levels,
// 3-to-1 merges), heroes with passives, talents and chests — the long-term goals the shop sells.
(() => {
  'use strict';

  const G = Save.game('arrow', {
    gold: 300, chapter: 1, best: {}, hero: 'rogue', heroes: ['rogue'], shards: {}, inv: null, eq: { weapon: 0, armor: 0, ring: 0, amulet: 0 },
    scrolls: { weapon: 0, armor: 0, ring: 0, amulet: 0 }, talents: { atk: 0, hp: 0, heal: 0, gold: 0, speed: 0, crit: 0 },
    chest: { pity: 0, free: 0 }, uid: 1, fails: 0, runs: 0, adSkin: 0, skins: ['rogue'], skin: 'rogue', outfits: [], outfit: {}, skinAds: {},
  });
  // Legacy test balances only: preserve normal balances and all existing talent levels.
  if (G.gold > 1e10) { G.gold = 1000000; Save.save(); }
  // Full integer gold keeps even small rewards visible at large balances.
  const NUMF = new Intl.NumberFormat(LANG === 'tr' ? 'tr-TR' : 'en-US'); // toLocaleString builds a formatter per call
  const goldFmt = n => NUMF.format(Math.floor(n));
  // Outfits (skins.js): bought with stars per hero (owned as 'hero.id'), worn one per hero. Cosmetic only.
  const outfitOf = h => window.ArrowSkins ? ArrowSkins.find(h, G.outfit[h]) : null;
  const hasOutfit = (h, id) => !id || G.outfits.includes(h + '.' + id);

  // ---------- Equipment ----------
  const SLOTS = ['weapon', 'armor', 'ring', 'amulet'];
  const RAR = [
    { id: 'common', c: '#9aa3b5', name: () => L('Common', 'Sıradan'), mul: 1, max: 10 },
    { id: 'great', c: '#3fc76a', name: () => L('Great', 'Güzel'), mul: 1.4, max: 20 },
    { id: 'rare', c: '#3b8cff', name: () => L('Rare', 'Nadir'), mul: 1.95, max: 30 },
    { id: 'epic', c: '#b05cff', name: () => L('Epic', 'Epik'), mul: 2.7, max: 40 },
    { id: 'legendary', c: '#ffb12a', name: () => L('Legendary', 'Efsanevi'), mul: 3.7, max: 50 },
    { id: 'mythic', c: '#ff4d5a', name: () => L('Mythic', 'Mitik'), mul: 5, max: 60 },
    // Top tier: only reached by merging three Mythic items.
    { id: 'celestial', c: '#3fe8ff', name: () => L('Celestial', 'Göksel'), mul: 6.8, max: 70 },
  ];
  // Item bases. st: flat stats at common level 1 (scaled by rarity and level); pc: percent bonuses (scaled by rarity only).
  const BASES = {
    bow: { cls: 'archer', slot: 'weapon', icon: '🏹', name: () => L('Longbow', 'Uzun Yay'), st: { atk: 30 }, pc: { atkSpd: 0.05 } },
    xbow: { cls: 'archer', slot: 'weapon', icon: '🎯', name: () => L('Crossbow', 'Arbalet'), st: { atk: 26 }, pc: { crit: 0.04 } },
    staff: { cls: 'mage', slot: 'weapon', icon: '🔮', name: () => L('Arcane Staff', 'Gizem Asası'), st: { atk: 24 }, pc: { dmg: 0.08 } },
    tome: { cls: 'mage', slot: 'weapon', icon: '📖', name: () => L('Spell Tome', 'Büyü Kitabı'), st: { atk: 30 }, pc: { dmg: 0.05, crit: 0.02 } },
    blades: { cls: 'archer', slot: 'weapon', icon: '⚔️', name: () => L('Twin Daggers', 'İkiz Hançer'), st: { atk: 28 }, pc: { critDmg: 0.15 } },
    vest: { cls: 'archer', slot: 'armor', icon: '🦺', name: () => L('Leather Vest', 'Deri Yelek'), st: { hp: 120 }, pc: { speed: 0.03 } },
    robe: { cls: 'mage', slot: 'armor', icon: '🥋', name: () => L('Mystic Robe', 'Gizem Cübbesi'), st: { hp: 90 }, pc: { dodge: 0.04 } },
    plate: { slot: 'armor', icon: '🛡️', name: () => L('Iron Plate', 'Demir Zırh'), st: { hp: 170 }, pc: { block: 0.05 } },
    ruby: { slot: 'ring', icon: '💍', name: () => L('Ruby Ring', 'Yakut Yüzük'), st: { atk: 10 }, pc: { dmg: 0.05 } },
    eagle: { slot: 'ring', icon: '🦅', name: () => L('Eagle Ring', 'Kartal Yüzüğü'), st: { atk: 8 }, pc: { crit: 0.04 } },
    serpent: { slot: 'ring', icon: '🐍', name: () => L('Serpent Ring', 'Yılan Yüzüğü'), st: { hp: 40 }, pc: { dodge: 0.04 } },
    heart: { slot: 'amulet', icon: '❤️', name: () => L('Heart Amulet', 'Kalp Muskası'), st: { hp: 60 }, pc: { hpPct: 0.06 } },
    wolf: { slot: 'amulet', icon: '🐺', name: () => L('Wolf Fang', 'Kurt Dişi'), st: { atk: 12 }, pc: { critDmg: 0.12 } },
    angel: { slot: 'amulet', icon: '👼', name: () => L('Angel Charm', 'Melek Tılsımı'), st: { hp: 50 }, pc: { heal: 0.25 } },
  };
  const STAT_NAMES = {
    atk: () => L('Attack', 'Saldırı'), hp: () => L('HP', 'Can'), atkSpd: () => L('Attack speed', 'Saldırı hızı'), crit: () => L('Crit chance', 'Kritik şansı'),
    critDmg: () => L('Crit damage', 'Kritik hasarı'), dmg: () => L('Damage', 'Hasar'), speed: () => L('Move speed', 'Hareket hızı'), dodge: () => L('Dodge', 'Kaçınma'),
    block: () => L('Damage taken', 'Alınan hasar'), hpPct: () => L('Max HP', 'Maks can'), heal: () => L('Healing', 'İyileşme'),
  };
  const itemStats = it => {
    const b = BASES[it.b], r = RAR[it.r], out = {};
    for (const k in b.st) out[k] = Math.round(b.st[k] * r.mul * (1 + 0.08 * (it.l - 1)));
    for (const k in b.pc) out[k] = b.pc[k] * (1 + 0.35 * it.r);
    return out;
  };
  // Economy and difficulty numbers live in economy-rules.js (shared with the models in tests/).
  const AR = window.ArrowRules;
  const upCost = it => ({ gold: AR.upCost(it.l, it.r), scrolls: 1 + Math.floor(it.l / 5) });
  const newItem = (b, r) => ({ id: G.uid++, b, r, l: 1 });
  if (!G.inv) { G.inv = [newItem('xbow', 0), newItem('vest', 0)]; G.eq.weapon = G.inv[0].id; G.eq.armor = G.inv[1].id; Save.save(); }
  const itemById = id => G.inv.find(i => i.id === id);
  const randBase = () => { const all = Object.keys(BASES), mine = all.filter(k => fits({ b: k })); const l = Math.random() < 0.75 ? mine : all; return l[Math.floor(Math.random() * l.length)]; };
  // Every hero has its own loadout (G.eqs[hero]); G.eq always points at the current hero's.
  const fits = (it, h) => !BASES[it.b].cls || BASES[it.b].cls === HEROES[h || G.hero].cls;
  const wornByAny = id => Object.values(G.eqs || {}).some(e => SLOTS.some(s => e[s] === id));
  function useLoadout(h) {
    G.eqs = G.eqs || {};
    if (!G.eqs[h]) { G.eqs[h] = { weapon: 0, armor: 0, ring: 0, amulet: 0 }; for (const sl of SLOTS) { const it = itemById(G.eq[sl]); if (it && fits(it, h)) G.eqs[h][sl] = it.id; } }
    for (const sl of SLOTS) { const it = itemById(G.eqs[h][sl]); if (!it || !fits(it, h)) G.eqs[h][sl] = 0; }
    G.eq = G.eqs[h];
  }
  const equipped = () => SLOTS.map(s => itemById(G.eq[s])).filter(Boolean);

  // ---------- Heroes ----------
  const HEROES = {
    rogue: { cls: 'archer', name: L('Rogue', 'Haydut'), icon: '🗡️', model: 'rogue', shot: 'blade', cost: 0, passive: () => L('+15% attack speed', '+%15 saldırı hızı'), mods: { atkSpd: 0.15 } },
    ranger: { cls: 'archer', name: L('Ranger', 'Korucu'), icon: '🎯', model: 'ranger', shot: 'bolt', cost: 650, passive: () => L('+12% crit chance, +30% crit damage', '+%12 kritik şansı, +%30 kritik hasarı'), mods: { crit: 0.12, critDmg: 0.3 } },
    mage: { cls: 'mage', name: L('Mage', 'Büyücü'), icon: '🧙', model: 'mage', shot: 'orb', cost: 400, passive: () => L('Shots bounce to 1 more enemy, +10% damage', 'Atışlar 1 düşmana daha seker, +%10 hasar'), mods: { dmg: 0.1, ricochet: 1 } },
    frost: { cls: 'mage', name: L('Frost Cleric', 'Buz Rahibi'), icon: '❄️', model: 'frost', shot: 'orb', cost: 900, start: { ice: 1 }, passive: () => L('Starts with Frost Orb, +20% damage', 'Buz Küresi ile başlar, +%20 hasar'), mods: { dmg: 0.2 } },
  };
  // ---------- Talents (gold, individual upgrades) ----------
  const TALENTS = {
    atk: { icon: '⚔️', name: () => L('Strength', 'Güç'), desc: l => L('Attack +' + 3 * l + '%', 'Saldırı +%' + 3 * l) },
    hp: { icon: '❤️', name: () => L('Vitality', 'Dayanıklılık'), desc: l => L('Max HP +' + 3 * l + '%', 'Maks can +%' + 3 * l) },
    heal: { icon: '💖', name: () => L('Recovery', 'İyileşme'), desc: l => L('Heal ' + 2 * l + '% on level up', 'Seviye atlayınca %' + 2 * l + ' iyileş') },
    gold: { icon: '💰', name: () => L('Greed', 'Açgözlülük'), desc: l => L('Gold +' + 2 * l + '%', 'Altın +%' + 2 * l) },
    speed: { icon: '👟', name: () => L('Agility', 'Çeviklik'), desc: l => L('Move speed +' + 2 * l + '%', 'Hareket hızı +%' + 2 * l) },
    crit: { icon: '🎯', name: () => L('Precision', 'İsabet'), desc: l => L('Crit chance +' + l + '%', 'Kritik şansı +%' + l) },
  };
  // Talent level as used by stats, never above the cap.
  // Caps: Strength and Vitality open up (+2 per chapter) once the player is past the early chapters.
  const talMax = k => AR.talentMax(k, G.chapter - 1);
  const tal = k => Math.min(G.talents[k] || 0, talMax(k));
  const talentCost = k => AR.talentCost(G.talents[k]);

  // ---------- Chapters ----------
  // Every chapter (10 rooms) has its own world: floor, walls, banners, obstacles, decoration, ground pools and
  // ambient particles (render3d.js reads `th`). The six themes repeat with tougher enemies.
  const CHAPTERS = [
    { name: () => L('Crypt of Bones', 'Kemik Mahzeni'), floor: '#7f9a94', // teal stone, like the key art (docs/art-target)
      light: '#ffd9a8', fog: '#1a1410', carpet: '#a3202e',
      th: { tiles: ['floor', 'floor_dirt'], wall: 'wall', wall2: 'wall_cracked', banner: 'banner', obst: ['barrel', 'boxes', 'crates', 'barrels', 'keg', 'table', 'chest'], deco: ['candles', 'rubble', 'coins', 'barrels'], fx: 'dust' } },
    { name: () => L('Sunken Halls', 'Batık Salonlar'), floor: '#5f8f8f', light: '#a8ffe8', fog: '#071a1e', carpet: '#2f7fb0',
      th: { tiles: ['floor', 'floor_rocks'], wall: 'wall_arch', wall2: 'wall', banner: 'banner_blue', obst: ['pir_barrel', 'pir_crate', 'pir_crate2', 'trunk', 'pir_chest'], deco: ['pir_bottle', 'coins', 'rubble', 'bottle'], pool: 'water', fx: 'bubbles' } },
    { name: () => L('Haunted Cellar', 'Perili Kiler'), floor: '#6a5a7a', light: '#d9b8ff', fog: '#130d1c', carpet: false,
      th: { tiles: ['floor_wood', 'floor_wood'], wall: 'wall_shelves', wall2: 'wall_window', banner: 'banner_green', obst: ['coffin', 'grave_cross', 'grave_round', 'pumpkin_tall', 'urn', 'grave_deco'], deco: ['pumpkin', 'candle_lit', 'candles', 'urn'], fx: 'wisps' } },
    { name: () => L('Molten Depths', 'Erimiş Derinlikler'), floor: '#7a4a36', light: '#ffb07a', fog: '#200a04', carpet: false,
      th: { tiles: ['floor_rocky', 'floor_dirt'], wall: 'wall_cracked', wall2: 'wall_broken', banner: 'banner_shield', obst: ['rocks_tall', 'altar', 'obelisk', 'barrel'] /* no 'rubble' obstacle: the model is a long strip of loose pebbles, shrunk to obstacle size it lay flat and read as a shadow while still blocking (tester, G-19) */, deco: ['fire_basket', 'rubble', 'coins'], pool: 'lava', fx: 'embers' } },
    { name: () => L('Frozen Catacombs', 'Donmuş Yeraltı'), floor: '#a8c4dc', light: '#cfe9ff', fog: '#0c1626', carpet: '#7fb8e0',
      th: { tiles: ['floor', 'floor_rocks'], wall: 'wall', wall2: 'wall_cracked', banner: 'banner_white', obst: ['snow_rocks', 'tree_snow', 'tree_snow_b', 'barrel', 'crates'], deco: ['snow_pile', 'snow_rocks', 'candles'], pool: 'ice', fx: 'snow' } },
    { name: () => L('Necropolis', 'Ölüler Şehri'), floor: '#6e7a62', light: '#c8ff9a', fog: '#0b1408', carpet: '#4a7a36',
      th: { tiles: ['floor', 'floor_dirt'], wall: 'wall_gated', wall2: 'wall', banner: 'banner_green', obst: ['obelisk', 'crypt', 'grave_deco', 'altar', 'pine_crooked'], deco: ['post', 'candle_lit', 'grave_round'], fx: 'fireflies' } },
  ];
  const chapterOf = n => CHAPTERS[(n - 1) % CHAPTERS.length];
  // Chapter length: 10, 20, 30, 40, then 50 rooms. A chapter is cut into 10-room stages; every stage ends in a boss
  // and is a bit harder than the one before (more foes, stronger), so a long chapter keeps climbing.
  const { roomsOf, stage, stageRoom, step, goldScale, winBonus } = AR, power = AR.enemyPower;
  // Once per save (economy v2/v3, 25 Oct 2026, tester feedback): Greed used to be applied twice and talents had no
  // cap, so saves hold absurd gold and talent levels. Clamp talents to the caps and trim gold to ~10 chapter clears.
  if ((G.econ || 1) < 3) {
    for (const k in TALENTS) G.talents[k] = Math.min(G.talents[k] || 0, talMax(k));
    G.gold = Math.min(G.gold, Math.max(3000, 100 * winBonus(G.chapter)));
    G.econ = 3; Save.save();
  }

  // ---------- Skills (one of three on every level-up) ----------
  const SKILLS = {
    front: { icon: '⬆️', name: () => L('Front Arrow +1', 'Ön Ok +1'), desc: () => L('One more arrow side by side', 'Yan yana bir ok daha') },
    multi: { icon: '⏩', name: () => L('Multishot', 'Çoklu Atış'), desc: () => L('Fire an extra volley', 'Fazladan bir atış dalgası') },
    diag: { cls: 'archer', icon: '↗️', max: 2, name: () => L('Diagonal Arrows', 'Çapraz Oklar'), desc: () => L('+2 arrows at an angle', 'Açılı +2 ok') },
    side: { cls: 'archer', icon: '↔️', max: 2, name: () => L('Side Arrows', 'Yan Oklar'), desc: () => L('Shoot left and right too', 'Sağa ve sola da atar') },
    rear: { cls: 'archer', icon: '⬇️', max: 2, name: () => L('Rear Arrow', 'Arka Ok'), desc: () => L('Shoot behind you', 'Arkana da atar') },
    ricochet: { cls: 'archer', icon: '🔀', max: 3, name: () => L('Ricochet', 'Seken Ok'), desc: () => L('Arrows bounce to another enemy', 'Ok başka düşmana seker') },
    pierce: { cls: 'archer', icon: '📌', max: 2, name: () => L('Piercing Shot', 'Delici Atış'), desc: () => L('Arrows go through enemies', 'Oklar düşmanları deler') },
    wall: { cls: 'archer', icon: '🧱', max: 2, name: () => L('Bouncy Wall', 'Duvar Sekmesi'), desc: () => L('Arrows bounce off walls', 'Oklar duvardan seker') },
    atk: { icon: '⚔️', name: () => L('Attack Boost', 'Saldırı Artışı'), desc: () => L('Attack +25%', 'Saldırı +%25') },
    spd: { icon: '⚡', name: () => L('Attack Speed', 'Atış Hızı'), desc: () => L('Attack speed +20%', 'Atış hızı +%20') },
    crit: { icon: '💥', name: () => L('Crit Master', 'Kritik Ustası'), desc: () => L('Crit chance +10%, crit damage +40%', 'Kritik şansı +%10, kritik hasarı +%40') },
    hp: { icon: '❤️', name: () => L('HP Boost', 'Can Artışı'), desc: () => L('Max HP +20% and heal', 'Maks can +%20 ve iyileş') },
    fire: { icon: '🔥', name: () => L('Blaze', 'Alev Oku'), desc: () => L('Arrows set enemies on fire', 'Oklar düşmanı yakar') },
    ice: { icon: '❄️', name: () => L('Freeze', 'Buz Oku'), desc: () => L('Arrows slow enemies', 'Oklar düşmanı yavaşlatır') },
    bolt: { icon: '🌩️', name: () => L('Lightning', 'Yıldırım'), desc: () => L('Hits chain lightning to nearby foes', 'İsabetler yakındakilere yıldırım zinciri atar') },
    orbit: { cls: 'mage', icon: '🌀', max: 3, name: () => L('Fire Circle', 'Ateş Çemberi'), desc: () => L('Fire orbs circle around you', 'Etrafında ateş küreleri döner') },
    vamp: { icon: '🩸', name: () => L('Bloodthirst', 'Kan Emici'), desc: () => L('Heal on every kill', 'Her öldürmede iyileş') },
    dodge: { icon: '💨', name: () => L('Dodge Master', 'Kaçınma Ustası'), desc: () => L('Dodge +10%', 'Kaçınma +%10') },
    move: { icon: '🏃', name: () => L('Run & Gun', 'Koşarken Atış'), desc: () => L('Shoot while walking too (slower)', 'Yürürken de ateş et (daha yavaş)') },
    rain: { cls: 'archer', icon: '🏹', max: 3, name: () => L('Arrow Rain', 'Ok Yağmuru'), desc: () => L('Arrows rain down on enemies every few seconds', 'Birkaç saniyede bir düşmanların üstüne ok yağar') },
    headshot: { cls: 'archer', icon: '🎯', max: 3, name: () => L('Headshot', 'Kafadan Vuruş'), desc: () => L('5% chance to slay a non-boss enemy outright', '%5 şansla boss olmayan düşmanı tek atışta indirir') },
    nova: { cls: 'mage', icon: '🔮', max: 3, name: () => L('Arcane Nova', 'Arkan Nova'), desc: () => L('A blast of magic bursts around you and pushes foes back', 'Etrafında büyü dalgası patlar, düşmanları iter') },
    meteor: { cls: 'mage', icon: '☄️', max: 3, name: () => L('Meteor', 'Meteor'), desc: () => L('A meteor crashes on an enemy every few seconds', 'Birkaç saniyede bir düşmana meteor düşer') },
    split: { cls: 'mage', icon: '✨', max: 2, name: () => L('Splitting Orb', 'Bölünen Küre'), desc: () => L('Orbs split into 2 shards on hit', 'Küre isabette 2 parçaya bölünür') },
    trail: { cls: 'archer', icon: '🔥', max: 3, name: () => L('Flame Trail', 'Alev İzi'), desc: () => L('You leave burning ground behind you', 'Arkanda yanan zemin bırakırsın') },
    blades: { cls: 'archer', icon: '🗡️', max: 3, name: () => L('Spinning Blades', 'Dönen Bıçaklar'), desc: () => L('Blades whirl around you', 'Etrafında bıçaklar döner') },
    poison: { cls: 'mage', icon: '💀', max: 3, name: () => L('Toxic Cloud', 'Zehir Bulutu'), desc: () => L('Orbs leave a poison pool where they hit', 'Küreler çarptığı yerde zehir gölü bırakır') },
    frostaura: { cls: 'mage', icon: '❄️', max: 3, name: () => L('Frost Aura', 'Buz Aurası'), desc: () => L('Nearby enemies are chilled and hurt', 'Yakındaki düşmanlar donar ve hasar alır') },
    shield: { cls: 'mage', icon: '🛡️', max: 2, name: () => L('Mana Shield', 'Mana Kalkanı'), desc: () => L('A magic bubble blocks one hit, then recharges', 'Büyü kalkanı bir darbeyi engeller, sonra dolar') },
    // Small, common picks: they keep a level-up useful but rarely exciting, so a bad hand is worth a reroll.
    atkS: { t: 1, icon: '🗡️', max: 5, name: () => L('Sharp Tips', 'Keskin Uçlar'), desc: () => L('Attack +10%', 'Saldırı +%10') },
    spdS: { t: 1, icon: '⏱️', max: 5, name: () => L('Quick Hands', 'Çevik Eller'), desc: () => L('Attack speed +8%', 'Atış hızı +%8') },
    hpS: { t: 1, icon: '🛡', max: 5, name: () => L('Tough Skin', 'Kalın Deri'), desc: () => L('Max HP +8%', 'Maks can +%8') },
    potion: { t: 1, icon: '💖', max: 99, name: () => L('Potion', 'İksir'), desc: () => L('Heal 30% HP now', 'Canının %30\'unu hemen yenile') },
    greed: { t: 1, icon: '🪙', max: 3, name: () => L('Gold Rush', 'Altın Avcısı'), desc: () => L('+20% gold in this run', 'Bu koşuda +%20 altın') },
    wisdom: { t: 1, icon: '📖', max: 3, name: () => L('Wisdom', 'Bilgelik'), desc: () => L('+15% XP: level up sooner', '+%15 tecrübe: daha çabuk seviye atla') },
    boots: { t: 1, icon: '💨', max: 3, name: () => L('Swift Boots', 'Hızlı Çizmeler'), desc: () => L('Move speed +8%', 'Hareket hızı +%8') },
    // Unlocked chapter by chapter (a new one joins the pool as the player goes further).
    giant: { t: 3, unlock: 2, icon: '👹', max: 3, name: () => L('Giant Slayer', 'Dev Avcısı'), desc: () => L('+30% damage to bosses and guardians', 'Boss ve muhafızlara +%30 hasar') },
    rage: { t: 3, unlock: 3, icon: '🔥', max: 2, name: () => L('Berserk', 'Öfke'), desc: () => L('Below half HP: damage +35%', 'Canın yarının altındayken hasar +%35') },
    execute: { t: 4, unlock: 4, icon: '💀', max: 1, name: () => L('Executioner', 'Cellat'), desc: () => L('Non-boss enemies under 15% HP die at once', 'Canı %15\'in altına düşen (boss olmayan) düşman anında ölür') },
    second: { t: 4, unlock: 5, icon: '👼', max: 1, name: () => L('Second Wind', 'İkinci Nefes'), desc: () => L('Once per run: survive a fatal hit with 50% HP', 'Koşu başına bir kez: ölümcül darbeden %50 canla kurtul') },
  };
  // Skill rarity (1 common … 4 legendary): rarer ones are stronger and come up less often in the 3 offered.
  { const T = { dodge: 1, atk: 2, spd: 2, crit: 2, hp: 2, vamp: 2, wall: 2, side: 2, rear: 2, diag: 2, move: 2, shield: 2, meteor: 4, rain: 4, nova: 4, bolt: 4 };
    for (const k in SKILLS) SKILLS[k].t = SKILLS[k].t || T[k] || 3; }
  const SK_TIER = [null, { c: '#9aa3b5', w: 8, name: () => L('Common', 'Sıradan') }, { c: '#3b8cff', w: 6, name: () => L('Rare', 'Nadir') },
    { c: '#b05cff', w: 4, name: () => L('Epic', 'Epik') }, { c: '#ffb12a', w: 1.3, name: () => L('Legendary', 'Efsanevi') }];

  // Shared skills read differently for a mage (orbs, not arrows).
  const MAGE_SK = {
    front: [() => L('Extra Orb +1', 'Ek Küre +1'), () => L('One more orb side by side', 'Yan yana bir küre daha')],
    multi: [() => L('Twin Cast', 'Çift Büyü'), () => L('Cast an extra volley', 'Fazladan bir büyü dalgası')],
    fire: [() => L('Fire Orb', 'Alev Küresi'), () => L('Orbs set enemies on fire', 'Küreler düşmanı yakar')],
    ice: [() => L('Frost Orb', 'Buz Küresi'), () => L('Orbs slow enemies', 'Küreler düşmanı yavaşlatır')],
    move: [() => L('Walking Cast', 'Yürürken Büyü'), () => L('Cast while walking too (slower)', 'Yürürken de büyü yap (daha yavaş)')],
  };
  const skName = k => (heroCls() === 'mage' && MAGE_SK[k] ? MAGE_SK[k][0] : SKILLS[k].name)();
  const skDesc = k => (heroCls() === 'mage' && MAGE_SK[k] ? MAGE_SK[k][1] : SKILLS[k].desc)();

  // ---------- Canvas / renderer ----------
  const $ = id => document.getElementById(id);
  const cvs = $('c'), ctx = cvs.getContext('2d');
  const FONT = "'Baloo', system-ui, sans-serif";
  const SHOT = /[?&]shot/.test((typeof location !== 'undefined' && location.search) || '');
  const R3 = window.Arrow3D ? window.Arrow3D.init($('c3d')) : null;
  if (!R3 && $('c3d') && $('c3d').style) $('c3d').style.display = 'none';
  if (SHOT && document.body.classList) document.body.classList.add('shot'); // key-art capture: no HUD
  let dpr = 1;
  function resize() {
    dpr = Math.min(R3 ? 1.5 : 2, window.devicePixelRatio || 1);
    cvs.width = Math.round(innerWidth * dpr); cvs.height = Math.round(innerHeight * dpr);
    if (R3) R3.fit();
  }
  addEventListener('resize', resize);
  resize(); setTimeout(resize, 400);

  function rng(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  // ---------- Run state ----------
  const RW = 13, RH = 21; // room half-sizes (x: -RW..RW, z: -RH..RH); door at z = -RH
  // Knight and Barbarian were retired (every hero is now an archer or a mage); owners get the matching new hero.
  { const MIG = { knight: 'ranger', barbarian: 'frost' };
    G.heroes = [...new Set(G.heroes.map(h => MIG[h] || h))].filter(h => HEROES[h]);
    if (!G.heroes.length) G.heroes = ['rogue'];
    G.hero = MIG[G.hero] || G.hero; if (!HEROES[G.hero]) G.hero = G.heroes[0]; }
  // The War Axe was retired with the Knight and Barbarian: owned axes become Spell Tomes (same rarity and level).
  for (const it of G.inv || []) if (it.b === 'axe') it.b = 'tome';
  useLoadout(G.hero);
  const heroCls = () => HEROES[(S && S.hero) || G.hero].cls;
  let S = null;
  let frameGap = 7, costAcc = 0, costN = 0, menuSkip = false, bandN = 0, menuHold = 0;
  let mode = 'menu', paused = false, tab = 'battle', pick = null, selChapter = G.chapter;

  function heroStats() {
    const h = HEROES[G.hero], st = { atk: 100, hp: 600, atkSpd: 1.25, crit: 0.05, critDmg: 1, dmg: 0, speed: 9, dodge: 0, block: 0, hpPct: 0, heal: 0, ricochet: 0, lifeKill: 0 };
    for (const it of equipped()) { const s = itemStats(it); for (const k in s) st[k] += k === 'atkSpd' ? s[k] * 1.25 : k === 'speed' ? s[k] * 9 : s[k]; }
    for (const k in h.mods) st[k] += k === 'atkSpd' ? h.mods[k] * 1.25 : h.mods[k];
    st.atk *= 1 + 0.03 * tal('atk'); st.hp = st.hp * (1 + st.hpPct) * (1 + 0.03 * tal('hp')); st.speed *= 1 + 0.02 * tal('speed'); st.crit += 0.01 * tal('crit');
    st.atk = Math.round(st.atk); st.hp = Math.round(st.hp);
    return st;
  }
  const powerScore = () => { const s = heroStats(); return Math.round(s.atk * (1 + s.crit * s.critDmg) * s.atkSpd + s.hp / 4); };

  // The look of the equipped gear on the hero: weapon rarity → hand glow, best of armour/ring/amulet → aura ring.
  function gearLook() {
    const r = s => { const it = itemById(G.eq[s]); return it ? it.r : -1; };
    const w = r('weapon'), a = Math.max(r('armor'), r('ring'), r('amulet'));
    const m = Math.max(w, a);
    return { weapon: w >= 2 ? RAR[w].c : null, aura: a >= 2 ? RAR[a].c : null, legendary: m >= 4, mythic: m >= 5, celestial: m >= 6 };
  }
  function newRun(chapter, from) {
    const st = heroStats();
    S = {
      chapter, room: from || 0, from: from || 0, t: 0, st, hero: G.hero, gearLook: gearLook(), heroModel: HEROES[G.hero].model, heroTint: HEROES[G.hero].tint || null, skin: outfitOf(G.hero), shotKind: HEROES[G.hero].shot,
      p: { x: 0, z: RH - 4, vx: 0, vz: 0, hp: st.hp, max: st.hp, cd: 0, face: 0, moving: false, inv: 0, lv: 1, xp: 0, anim: 0, atkT: 0, dead: false },
      skills: Object.assign({}, HEROES[G.hero].start || {}), enemies: [], shots: [], foes: [], drops: [], fx: [], texts: [], props: [], spikes: [], gold: 0, kills: 0,
      cleared: false, wave2: [], revived: false, pending: 0, angel: null, banner: null, door: false, items: [], scrolls: 0, orbT: 0, rerolls: 2,
    };
    nextRoom();
    // A skill unlocked by this chapter: announce it once.
    const fresh = Object.keys(SKILLS).find(k => SKILLS[k].unlock === chapter && !(G.skSeen || []).includes(k));
    if (fresh) { (G.skSeen = G.skSeen || []).push(fresh); Save.save(); banner('✨ ' + L('New skill: ', 'Yeni yetenek: ') + skName(fresh), skDesc(fresh)); }
  }
  const sk = k => S.skills[k] || 0;
  const atkMul = () => (1 + 0.25 * sk('atk') + 0.1 * sk('atkS')) * (sk('rage') && S.p.hp < S.p.max / 2 ? 1 + 0.35 * sk('rage') : 1);

  // Collision radius of an obstacle from its model: drawn at most 3.15 units wide and 4 tall (render3d.js uses the
  // same rule), so a thin obelisk or a small coffin does not get an invisible 3-unit wall around it.
  const propR = kind => {
    const m = window.ARROW_PROPS && ARROW_PROPS[kind]; if (!m) return 1.5;
    // Obstacles are kept modest (the lower camera made big crates and barrels fill the room).
    const w = Math.max(m.max[0] - m.min[0], m.max[2] - m.min[2]), h = m.max[1] - m.min[1], k = Math.min(2.4 / w, 2.8 / h);
    return Math.max(0.6, Math.min(1.15, w * k / 2.1));
  };
  // A random spot inside the room, clear of obstacles and at least `keep` away from the hero.
  function freeSpot(r, keep) {
    let x = 0, z = -RH + 4, tries = 0;
    do { x = (r() * 2 - 1) * (RW - 2); z = -RH + 3 + r() * (RH * 2 - 7); tries++; }
    while (tries < 40 && (S.props.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 1.4) || Math.hypot(x - S.p.x, z - S.p.z) < keep));
    return [x, z];
  }
  function nextRoom() {
    S.room++;
    const r = rng(S.chapter * 1009 + S.room * 31 + G.runs * 7), boss = stageRoom(S.room) === 10, angel = stageRoom(S.room) === 5;
    const last = S.room >= roomsOf(S.chapter);
    S.enemies = []; S.shots = []; S.foes = []; S.drops = []; S.fx = []; S.props = []; S.spikes = []; S.cleared = false; S.door = false; S.angel = null;
    S.wave2 = []; S.clearT = 0; S.autoDoor = false; S.flow = null; S.doorFlow = null; S.intro = null; S.warns = []; S.chest = null;
    S.p.x = 0; S.p.z = RH - 3; S.p.vx = S.p.vz = 0; S.t = 0;
    // Obstacles on a 4.4-unit grid, away from the spawn and the door; gaps between them stay walkable.
    if (!boss && !angel) {
      const n = 3 + Math.floor(r() * 4), kinds = chapterOf(S.chapter).th.obst;
      for (let k = 0, tries = 0; k < n && tries < 60; tries++) {
        // Never on the carpet that runs from the entrance to the door (column x = 0): the way out stays clear.
        const gx = [-2, -1, 1, 2][Math.floor(r() * 4)], gz = -3 + Math.floor(r() * 7), x = gx * 4.4, z = gz * 4.4;
        if (z > RH - 9 || z < -RH + 5 || S.props.some(o => Math.abs(o.x - x) < 4 && Math.abs(o.z - z) < 4)) continue;
        const kind = kinds[Math.floor(r() * kinds.length)];
        S.props.push({ kind, x, z, r: propR(kind), rot: Math.floor(r() * 4) * Math.PI / 2 }); k++;
      }
      if (S.chapter >= 2 && r() < 0.5) S.spikes.push({ x: (r() < 0.5 ? -1 : 1) * 7, z: -2 + Math.floor(r() * 3) * 4, t: r() * 3 });
    }
    buildSolid();
    if (angel) { S.angel = { x: 0, z: -4, used: false }; S.cleared = true; S.door = true; banner('👼 ' + L('Angel Room', 'Melek Odası'), L('Touch the angel for a blessing', 'Kutsama için meleğe dokun')); }
    else if (isMini(S.room)) {
      const c = bossCrew(S.chapter), name = MINI[c];
      spawn(GUARD_MODEL[c], 0, -7, { boss: true, mid: true, mini: true, bossName: name(), crew: c });
      for (let k = 0; k < 2; k++) spawn(pickSpecies('minion'), k % 2 ? 6 : -6, -4);
      S.intro = { t: 0, dur: 2.0, x: 0, z: -7, name: name(), sub: L('MINI BOSS · the chapter boss is next', 'ARA BOSS · sırada bölüm bossu var') };
    }
    else if (boss) {
      const [kind, bossName, crew] = bossOf(last);
      spawn(kind, 0, -8, { boss: true, mid: !last, bossName: bossName(), crew });
      for (let k = 0; k < 2 + stage(S.room); k++) spawn(pickSpecies('minion'), k % 2 ? 6 : -6, -4 + Math.floor(k / 2) * 3);
      // Entrance: the camera pushes in on the boss, black bars slide in, the name rolls across, the boss roars.
      S.intro = { t: 0, dur: 2.6, x: 0, z: -8, name: bossName(),
        sub: last ? L('CHAPTER BOSS', 'BÖLÜM BOSSU') : L('GUARDIAN · STAGE ', 'MUHAFIZ · AŞAMA ') + (stage(S.room) + 1) + '/' + roomsOf(S.chapter) / 10 };
    } else {
      const k = step(S.chapter, S.room);
      const types = ['minion', 'minion', 'minion'].concat(k >= 2 ? ['archer'] : []).concat(k >= 6 ? ['warrior'] : []).concat(k >= 14 ? ['necro'] : []);
      const n = Math.min(14, 3 + Math.floor(stageRoom(S.room) * 0.5) + Math.floor((S.chapter - 1) * 0.5) + stage(S.room));
      // From room 4 of a stage on, the room comes in two waves: the second rises when the first is almost down.
      const first = stageRoom(S.room) >= 4 ? Math.ceil(n * 0.6) : n;
      // Elites (from chapter 2): bigger, tougher, a golden aura, burst into orbs when they die, richer loot.
      const eliteP = S.chapter < 2 ? 0 : Math.min(0.3, 0.08 + 0.02 * (S.chapter - 2) + 0.03 * stage(S.room));
      for (let k = 0; k < n; k++) {
        const [x, z] = freeSpot(r, 11), t = pickSpecies(types[Math.floor(r() * types.length)]), el = r() < eliteP;
        if (k < first) spawn(t, x, z, el ? { elite: true } : null); else S.wave2.push(el ? { t, elite: true } : t);
      }
    }
    if (R3) R3.setRoom(S, chapterOf(S.chapter));
    $('room').textContent = S.chapter + '-' + S.room;
  }

  // speed: tiles per second (scaled up a little every chapter, see spdMul).
  // Four fighting styles (ai) and many species wearing them: every chapter has its own crew and its own boss.
  const ROLE = {
    minion: { hp: 230, dmg: 45, speed: 6.4, r: 0.9, xp: 6, gold: 4, scale: 1 },
    warrior: { hp: 560, dmg: 85, speed: 4.6, r: 1.1, xp: 12, gold: 8, scale: 1.1 },
    archer: { hp: 260, dmg: 70, speed: 5.2, r: 0.9, xp: 9, gold: 6, scale: 1 },
    necro: { hp: 340, dmg: 60, speed: 4.4, r: 0.9, xp: 12, gold: 8, scale: 1 },
  };
  const FOES = {};
  const species = (ai, list) => list.forEach(k => { FOES[k] = Object.assign({ ai }, ROLE[ai]); });
  species('minion', ['minion', 'greenblob', 'frog', 'fishb', 'mushnub', 'pinkblob', 'cactoro', 'demonf', 'bunny', 'pigeon', 'orc', 'ninja']);
  species('warrior', ['warrior', 'orcskull', 'fish', 'monkroose', 'demon', 'yeti', 'dino', 'glubx', 'mushking', 'dragonx', 'alpakingx', 'golex', 'hywirl', 'spikyblob', 'mushx', 'dragon', 'birb', 'armabee']);
  species('archer', ['archer', 'squidle', 'ghost', 'goleling', 'alpaking', 'tribal']);
  species('necro', ['necro', 'glub', 'ghostskull', 'bluedemon', 'wizardb', 'alien']);
  const ROSTER = [
    { minion: ['minion', 'greenblob'], archer: ['archer'], warrior: ['warrior', 'orcskull'], necro: ['necro'], boss: ['warrior', () => L('Bone King', 'Kemik Kral')] },
    { minion: ['frog', 'fishb'], archer: ['squidle'], warrior: ['fish'], necro: ['glub'], boss: ['glubx', () => L('Deep Glub', 'Derin Glub')] },
    { minion: ['mushnub', 'pinkblob'], archer: ['ghost'], warrior: ['monkroose'], necro: ['ghostskull'], boss: ['mushking', () => L('Mushroom King', 'Mantar Kral')] },
    { minion: ['cactoro', 'demonf'], archer: ['goleling'], warrior: ['demon'], necro: ['bluedemon'], boss: ['dragonx', () => L('Magma Dragon', 'Magma Ejderhası')] },
    { minion: ['bunny', 'pigeon'], archer: ['alpaking'], warrior: ['yeti'], necro: ['wizardb'], boss: ['alpakingx', () => L('Frost King', 'Ayaz Kral')] },
    { minion: ['orc', 'ninja'], archer: ['tribal'], warrior: ['dino'], necro: ['alien'], boss: ['golex', () => L('Stone Colossus', 'Taş Dev')] },
  ];
  // The six crews repeat from chapter 7, but never the same way: every later loop mixes in a second crew and
  // brings another crew's boss; guardians (bosses every 10 rooms) are always someone else than the chapter boss.
  const loopOf = ch => Math.floor((ch - 1) / ROSTER.length);
  const crewOf = ch => (ch - 1) % ROSTER.length;
  const mixOf = ch => loopOf(ch) ? (crewOf(ch) + 2 * loopOf(ch) + 1) % ROSTER.length : -1;
  const bossCrew = ch => (crewOf(ch) + loopOf(ch)) % ROSTER.length;
  // Guardians (every 10 rooms) and the mini boss (just before the chapter boss) have models of their own (chars-7.js).
  const GUARD_MODEL = ['hywirl', 'spikyblob', 'mushx', 'dragon', 'birb', 'armabee'];
  const MINI = [() => L('Grave Wisp', 'Mezar Ruhu'), () => L('Reef Spiker', 'Mercan Dikeni'), () => L('Toadstool Brute', 'Zehirli Mantar'), () => L('Cinder Drake', 'Kor Ejderi'),
    () => L('Snow Roc', 'Kar Kuşu'), () => L('War Hornet', 'Savaş Eşekarısı')];
  const GUARD = [() => L('Bone Warden', 'Kemik Bekçisi'), () => L('Tide Sentinel', 'Gelgit Nöbetçisi'), () => L('Spore Lord', 'Spor Lordu'), () => L('Ember Fiend', 'Kor İblisi'),
    () => L('Rime Tyrant', 'Kırağı Zorbası'), () => L('Rock Guardian', 'Kaya Muhafızı')];
  const roster = () => ROSTER[crewOf(S.chapter)];
  const pickSpecies = role => {
    const m = mixOf(S.chapter), l = m >= 0 && Math.random() < 0.45 ? ROSTER[m][role] : roster()[role];
    return l[Math.floor(Math.random() * l.length)];
  };
  // [model, name, crew] of the boss in this room: the chapter boss last, guardians before it.
  function bossOf(last) {
    if (last) { const c = bossCrew(S.chapter); return [ROSTER[c].boss[0], ROSTER[c].boss[1], c]; }
    const c = (bossCrew(S.chapter) + 1 + stage(S.room)) % ROSTER.length;
    return [GUARD_MODEL[c], GUARD[c], c];
  }
  // The mini boss of the last stage: the chapter boss crew's guardian model, smaller, with its own name.
  const isMini = room => stage(room) === Math.floor((roomsOf(S.chapter) - 1) / 10) && stageRoom(room) === 9;
  // Chunks a chapter needs: its own crew, the mixed crew and every boss crew it can meet.
  const chunksFor = ch => { const s = new Set([crewOf(ch) + 1, bossCrew(ch) + 1, 'x']); if (mixOf(ch) >= 0) s.add(mixOf(ch) + 1); for (let k = 0; k < roomsOf(ch) / 10; k++) s.add((bossCrew(ch) + 1 + k) % ROSTER.length + 1); return [...s]; };
  // Chapters 2-6 bring their own models (chars-N.js), streamed in after the menu is up.
  const chunkOf = ch => (ch - 1) % ROSTER.length + 1;
  const loadAll = ch => Promise.all(chunksFor(ch).map(n => loadChunk(n)));
  const chunksReady = ch => chunksFor(ch).every(n => n === 1 || ((window.ARROW_CHARS || {}).loaded || {})[n === 'x' ? 7 : n]);
  const chunkWait = {};
  function loadChunk(ch) {
    const n = ch === 'x' ? 7 : chunkOf(ch), A = window.ARROW_CHARS; // 'x': chars-7.js, guardians and mini bosses
    if (n === 1 || !A || (A.loaded && A.loaded[n])) return Promise.resolve();
    return chunkWait[n] || (chunkWait[n] = new Promise(res => { const sc = document.createElement('script'); sc.src = 'chars-' + n + '.js'; sc.onload = sc.onerror = () => res(); document.head.appendChild(sc); }));
  }
  setTimeout(() => { let p = Promise.resolve(); for (let ch = 2; ch <= ROSTER.length; ch++) p = p.then(() => new Promise(r => setTimeout(r, 400))).then(() => loadChunk(ch)); }, 1500);

  // Enemies get quicker room by room and chapter by chapter (chapter 1 starts gentle: it teaches the game).
  const spdMul = () => Math.min(1.3, 0.8 + 0.01 * step(S.chapter, S.room));
  function spawn(kind, x, z, o) {
    const f = FOES[kind], mini = o && o.mini, pw = power(S.chapter, S.room) * (o && o.boss ? (mini ? 4.5 : o.mid ? 7.5 : 12) : 1);
    const e = Object.assign({ kind, ai: f.ai, x, z, hp: f.hp * pw, max: f.hp * pw, dmg: f.dmg * power(S.chapter, S.room) * (o && o.boss ? (mini ? 1.1 : o.mid ? 1.2 : 1.35) : 1), speed: f.speed, r: f.r * (o && o.boss ? (mini ? 1.7 : 2.2) : 1),
      scale: f.scale * (o && o.boss ? (mini ? 1.8 : o.mid ? 2.3 : 2.8) : 1), cd: 0.6 + Math.random() * 1.2, state: 'rise', st: 0.8, anim: Math.random() * 4, face: Math.atan2(S.p.x - x, S.p.z - z), burn: 0, slow: 0, flash: 0, boss: false, phase: 0,
      flank: Math.random() * Math.PI * 2, side: Math.random() < 0.5 ? -1 : 1, kbx: 0, kbz: 0 }, o || {});
    if (e.elite) { e.hp = e.max = e.max * 2.4; e.dmg *= 1.3; e.scale *= 1.25; e.r *= 1.15; }
    S.enemies.push(e);
    fx('rise', x, z);
    return e;
  }
  const fx = (kind, x, z, c, n) => { if (R3 && R3.fx) R3.fx(kind, x, z, c, n); };
  function banner(txt, sub) { S.banner = { txt, sub: sub || '', life: 2.4 }; }
  function floatText(x, z, txt, c, big) { S.texts.push({ x, z, txt, c, life: big ? 1.05 : 0.9, max: big ? 1.05 : 0.9, big, dx: (Math.random() - 0.5) * 1.6 }); }

  // ---------- Combat ----------
  function fire() {
    const p = S.p, st = S.st, tgt = nearestEnemy(p);
    if (!tgt) return;
    p.face = Math.atan2(tgt.x - p.x, tgt.z - p.z);
    p.atkT = 0.25;
    const volleys = 1 + sk('multi');
    for (let v = 0; v < volleys; v++) S.queue = (S.queue || []).concat([{ at: S.t + v * 0.12, a: p.face }]);
    Sfx.play('shoot');
  }
  function volley(a) {
    const p = S.p, n = 1 + sk('front'), dirs = [0];
    if (sk('diag')) dirs.push(-0.5, 0.5);
    if (sk('diag') > 1) dirs.push(-0.8, 0.8);
    if (sk('side')) dirs.push(-Math.PI / 2, Math.PI / 2);
    if (sk('rear')) dirs.push(Math.PI);
    for (const d of dirs) {
      const ang = a + d, cx = Math.sin(ang), cz = Math.cos(ang), px = Math.cos(ang), pz = -Math.sin(ang);
      const count = d === 0 ? n : 1;
      for (let k = 0; k < count; k++) {
        const off = (k - (count - 1) / 2) * 0.7;
        S.shots.push({ x: p.x + px * off + cx * 0.8, z: p.z + pz * off + cz * 0.8, vx: cx * 30, vz: cz * 30, a: ang, life: 1.6, hit: [], ric: sk('ricochet') + S.st.ricochet, pierce: sk('pierce'), wall: sk('wall') });
      }
    }
  }
  function nearestEnemy(p, exclude) {
    let best = null, bd = 1e9;
    for (const e of S.enemies) if (e.state !== 'rise' && e.hp > 0 && !(exclude && exclude.includes(e))) { const d = dist(p, e); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function hurtEnemy(e, base, src) {
    if (e.hp <= 0) return;
    const st = S.st, critC = st.crit + 0.1 * sk('crit'), crit = Math.random() < critC;
    let dmg = base * (1 + st.dmg) * (crit ? 2 + st.critDmg - 1 + 0.4 * sk('crit') : 1) * (0.92 + Math.random() * 0.16);
    if (e.boss && sk('giant')) dmg *= 1 + 0.3 * sk('giant');
    if (!e.boss && sk('execute') && e.hp - dmg > 0 && e.hp - dmg < e.max * 0.15) { dmg = e.hp; floatText(e.x, e.z, L('EXECUTE!', 'İNFAZ!'), '#c08cff', true); fx('crit', e.x, e.z, '#c08cff', 1); }
    if (src === 'shot' && !e.boss && sk('headshot') && Math.random() < 0.05 * sk('headshot')) { dmg = Math.max(dmg, e.hp); floatText(e.x, e.z, L('HEADSHOT!', 'KAFADAN!'), '#ffd23f', true); fx('crit', e.x, e.z, '#ffd23f', 1); fx('headshot', e.x, e.z); S.hitStop = 0.09; }
    e.hp -= dmg; e.flash = 0.12;
    // Damage numbers (Archero style): crits big and golden with '!', damage over time in its element's colour.
    const NUM_C = { burn: '#ff9a3a', fire: '#ff9a3a', poison: '#9dff5a', aura: '#9fe8ff', meteor: '#ffb04a', nova: '#d7a8ff', orb: '#ffb04a' };
    floatText(e.x, e.z, Math.round(dmg) + (crit ? '!' : ''), crit ? '#ffd23f' : NUM_C[src] || '#ffffff', crit);
    fx('hit', e.x, e.z, crit ? '#ff5a5a' : src === 'burn' ? '#ff8a1f' : '#ffe9a8', crit ? 14 : 7);
    if (src === 'shot') fx('shothit', e.x, e.z, null, crit ? 2 : 1);
    if (crit) { S.shake = Math.max(S.shake || 0, 0.35); S.hitStop = 0.07; fx('crit', e.x, e.z, '#ffd23f', 1); }
    if (src === 'shot') {
      if (sk('fire')) { if (!(e.burn > 0)) fx('ignite', e.x, e.z, '#ff8a1f', 1); e.burn = 3; }
      if (sk('ice')) { if (!(e.slow > 0)) fx('freeze', e.x, e.z, '#9be7ff', 1); e.slow = 2; }
      if (sk('bolt')) { e.shock = 0.5; let n = 0; for (const o of S.enemies) if (o !== e && o.hp > 0 && dist(o, e) < 7 && n < 2) { n++; o.hp -= base * 0.3; o.flash = 0.12; o.shock = 0.6; S.fx.push({ kind: 'zap', x: e.x, z: e.z, x2: o.x, z2: o.z, life: 0.2 }); if (o.hp <= 0) kill(o); } }
    }
    if (e.hp <= 0) kill(e);
  }
  function kill(e) {
    if (e.killed) { e.hp = 0; e.state = 'dead'; return; }
    e.killed = true; e.hp = 0; e.state = 'dead'; e.st = 0.9;
    fx('die', e.x, e.z, e.boss ? '#ffd56a' : '#e8e0d0', e.boss ? 60 : 22); if (e.boss) S.shake = 1;
    if (e.slow > 0 && sk('ice')) fx('shatter', e.x, e.z);
    if (e.elite) { for (let k = 0; k < 8; k++) enemyShot(e, k / 8 * Math.PI * 2, 7, 'orb'); fx('nova', e.x, e.z, '#ffd23f', 1); S.fx.push({ kind: 'boom', x: e.x, z: e.z, r: 3, life: 0.4, c: '#ffd23f' }); }
    const f = FOES[e.kind], g = Math.round(f.gold * (e.boss ? 25 : e.elite ? 3 : 1) * (0.8 + Math.random() * 0.4) * goldScale(S.chapter) * (1 + 0.2 * sk('greed')));
    S.drops.push({ x: e.x, z: e.z, gold: g, xp: f.xp * (e.boss ? 10 : 1), t: 0 });
    S.kills++;
    const heal = (sk('vamp') * 0.02 + S.st.lifeKill) * S.p.max;
    if (heal > 0) { S.p.hp = Math.min(S.p.max, S.p.hp + heal); if (sk('vamp')) fx('drain', e.x, e.z, S.p); fx('heal', S.p.x, S.p.z, sk('vamp') ? '#ff5a7a' : '#7dffae', 1); floatText(S.p.x, S.p.z, '+' + Math.round(heal), '#7dffae'); }
    Sfx.play(e.boss ? 'boss' : 'pop');
    if (e.boss) {
      UI.vibrate(80);
      // The chapter boss goes down in slow motion with a big shake: a short cinematic beat before the chest drops.
      if (S.room >= roomsOf(S.chapter) && !e.mini) { S.slowMo = 1.1; S.shake = Math.max(S.shake || 0, 1.2); fx('levelup', e.x, e.z, '#ffd23f', 60); }
      // Boss loot: an item and scrolls, collected at the end of the run.
      const rar = rollRarity(S.chapter, false);
      const b = randBase();
      S.items.push({ b, r: rar }); S.scrolls += 2 + S.chapter;
      if (S.room < roomsOf(S.chapter) && !e.mini) { // a guardian: checkpoint + 2 stage stars
        G.ckpt = G.ckpt || {}; G.ckpt[S.chapter] = Math.max(G.ckpt[S.chapter] || 0, S.room); G.best[S.chapter] = Math.max(G.best[S.chapter] || 0, S.room); Save.save();
        S.stageStars = (S.stageStars || 0) + 2; floatText(e.x, e.z, L('CHECKPOINT!', 'ARA KAYIT!'), '#7dffae', true);
      }
    } else if (Math.random() < (e.elite ? 0.1 : 0.03)) {
      // Any foe can drop a piece of gear (kept at the end of the run, even a lost one).
            S.items.push({ b: randBase(), r: rollRarity(S.chapter, false) });
      floatText(e.x, e.z, L('GEAR!', 'EŞYA!'), '#ffd23f', true); fx('levelup', e.x, e.z, '#ffd23f', 24);
    }
  }
  function hurtPlayer(d, src) {
    const p = S.p, st = S.st;
    if (p.inv > 0 || p.dead || mode !== 'play') return;
    if (sk('shield') && !(S.shieldT > 0)) { S.shieldT = 8 - 2 * (sk('shield') - 1); p.inv = 0.5; fx('shieldpop', p.x, p.z, '#8fd8ff', 1); floatText(p.x, p.z, L('BLOCKED', 'ENGELLENDİ'), '#8fd8ff'); return; }
    if (Math.random() < st.dodge + 0.1 * sk('dodge')) { floatText(p.x, p.z, L('DODGE', 'KAÇTI'), '#9fe7ff'); fx('dodge', p.x, p.z); p.inv = 0.25; return; }
    d *= 1 - Math.min(0.6, st.block);
    p.hp -= d; p.inv = 0.4; S.hurtT = 0.4; if (S.dmgLog) { const k = src || '?'; S.dmgLog[k] = (S.dmgLog[k] || 0) + d; S.lastHit = k; } // dmgLog: balance bot
    S.shake = Math.max(S.shake || 0, 0.3); fx('hurt', p.x, p.z, '#ff4d5a', 10);
    floatText(p.x, p.z, '-' + Math.round(d), '#ff6b6b');
    UI.vibrate(30); Sfx.play('hit');
    if (p.hp <= 0 && sk('second') && !S.secondUsed) { S.secondUsed = true; p.hp = p.max * 0.5; p.inv = 2; fx('levelup', p.x, p.z, '#ffe08a', 50); floatText(p.x, p.z, L('SECOND WIND!', 'İKİNCİ NEFES!'), '#ffe08a', true); return; }
    if (p.hp <= 0) { p.hp = 0; p.dead = true; setTimeout(() => { if (mode === 'play') dieScreen(); }, 700); }
  }

  // ---------- Enemy AI ----------
  // Every enemy turns at a limited rate (no spinning with the hero), walks around obstacles through the room's
  // flow field and winds up before it hits, so attacks can be dodged. Each kind keeps its own style.
  function turnTo(e, a, dt, rate) {
    const d = ((a - e.face) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI, m = (rate == null ? 5 : rate) * dt;
    e.face += clamp(d, -m, m);
    return Math.abs(d);
  }
  function think(e, dt) {
    const p = S.p, d = dist(e, p), sp = e.speed * spdMul() * (e.slow > 0 ? 0.5 : 1) * dt, toP = Math.atan2(p.x - e.x, p.z - e.z);
    e.cd -= dt; e.moving = false;
    const go = (ang, s, rate) => { turnTo(e, ang, dt, rate); e.x += Math.sin(e.face) * s; e.z += Math.cos(e.face) * s; e.moving = s > 0; };
    const chase = (s, tx, tz) => go(pathDir(e, tx == null ? p.x : tx, tz == null ? p.z : tz), s);
    if (e.boss) return bossThink(e, dt, d, toP, (a, s) => go(a, s, 3), sp);
    if (e.ai === 'minion') {
      // Close in from its own side, wind up, lunge, then back off (no hugging).
      if (e.state === 'wind') { e.st -= dt; turnTo(e, toP, dt, 2.5); if (e.st <= 0) { e.state = 'atk'; e.st = 0.2; e.hit = false; } return; }
      if (e.state === 'atk') { e.st -= dt; go(e.face, sp * 2.6, 0); if (!e.hit && dist(e, p) < e.r + 1) { e.hit = true; hurtPlayer(e.dmg, (e.boss ? 'boss ' : '') + e.kind + ' melee'); fx('hit', (e.x + p.x) / 2, (e.z + p.z) / 2, '#ff8a5a', 16); } if (e.st <= 0) { e.state = 'back'; e.st = 0.5; } return; }
      if (e.state === 'back') { e.st -= dt; go(toP + Math.PI + e.side * 0.7, sp * 0.75, 7); if (e.st <= 0) { e.state = 'walk'; e.cd = 1 + Math.random() * 0.8; } return; }
      if (d < 2.7 && e.cd <= 0) { e.state = 'wind'; e.st = 0.4; return; }
      if (d < 7) chase(sp, p.x + Math.sin(e.flank) * 2.4, p.z + Math.cos(e.flank) * 2.4); else chase(sp);
    } else if (e.ai === 'warrior') {
      // Aims (red line), charges in a straight line it cannot steer, then catches its breath.
      if (e.state === 'aim') { e.st -= dt; turnTo(e, toP, dt, 2.5); if (e.st <= 0) { e.state = 'dash'; e.st = 0.5; e.hit = false; } return; }
      if (e.state === 'dash') { e.st -= dt; go(e.face, sp * 4.3, 0); if (Math.random() < dt * 30) fx('rise', e.x, e.z); if (!e.hit && d < e.r + 1) { e.hit = true; hurtPlayer(e.dmg, (e.boss ? 'boss ' : '') + e.kind + ' dash'); fx('slam', p.x, p.z); S.shake = Math.max(S.shake || 0, 0.45); } if (e.st <= 0) { e.state = 'tired'; e.st = 0.7; } return; }
      if (e.state === 'tired') { e.st -= dt; if (e.st <= 0) { e.state = 'walk'; e.cd = 2 + Math.random(); } return; }
      if (e.cd <= 0 && d < 13 && clearLine(e, p)) { e.state = 'aim'; e.st = 0.65; S.fx.push({ kind: 'line', x: e.x, z: e.z, a: toP, e, len: 13, life: 0.65 }); return; }
      chase(sp);
    } else if (e.ai === 'archer') {
      // Keeps its distance, circles the hero, shoots fast bolts after a short aim.
      if (e.state === 'aim') { e.st -= dt; turnTo(e, toP, dt, 6); if (e.st <= 0) { enemyShot(e, e.face, 19, 'bolt'); e.state = 'walk'; e.cd = 1.4 + Math.random() * 0.7; } return; }
      if (e.cd <= 0 && d < 20 && clearLine(e, p)) { e.state = 'aim'; e.st = 0.45; S.fx.push({ kind: 'line', x: e.x, z: e.z, a: toP, e, len: 22, life: 0.45, thin: true }); return; }
      if (d < 8) go(toP + Math.PI + e.side * 0.5, sp);
      else if (d > 14 || !clearLine(e, p)) chase(sp);
      else { if (Math.random() < dt * 0.5) e.side *= -1; go(toP + Math.PI / 2 * e.side, sp * 0.7); }
    } else if (e.ai === 'necro') {
      // Wanders, casts a fan of orbs and now and then blinks to another spot.
      if (e.state === 'cast') { e.st -= dt; turnTo(e, toP, dt, 4); if (e.st <= 0) { for (let k = -2; k <= 2; k++) enemyShot(e, e.face + k * 0.22, 10, 'orb'); e.state = 'walk'; e.cd = 2.3 + Math.random() * 0.6; } return; }
      e.blink = (e.blink == null ? 4 + Math.random() * 3 : e.blink) - dt;
      if (e.blink <= 0) { e.blink = 5 + Math.random() * 3; const [x, z] = freeSpot(Math.random, 6); fx('blink', e.x, e.z); e.x = x; e.z = z; e.to = null; fx('blink', x, z); e.cd = Math.max(e.cd, 0.7); return; }
      if (e.cd <= 0) { e.state = 'cast'; e.st = 0.6; return; }
      if (!e.to || Math.hypot(e.to.x - e.x, e.to.z - e.z) < 1) { const [x, z] = freeSpot(Math.random, 5); e.to = { x, z }; }
      chase(sp, e.to.x, e.to.z);
    }
  }
  function bossThink(e, dt, d, toP, walk, sp) {
    e.phaseT = (e.phaseT || 0) - dt;
    if (e.state === 'rise') return;
    // Below half HP the boss is enraged: faster phases, quicker steps, both of its moves.
    if (!e.rage && e.hp < e.max / 2) { e.rage = true; e.speed *= 1.25; banner('🔥 ' + e.bossName, L('is enraged!', 'öfkelendi!')); S.shake = 0.9; Sfx.play('boss'); fx('nova', e.x, e.z, '#ff3a2a', 1); S.fx.push({ kind: 'boom', x: e.x, z: e.z, r: 8, life: 0.4, c: '#ff3a2a' }); }
    if (e.phaseT <= 0) {
      e.phase = (e.phase + 1) % (e.rage ? 5 : 4); e.phaseT = e.rage ? 2.7 : 3.8;
      if (e.phase === 4) { e.state = 'cast2'; e.st = 0.6; }
      if (e.phase === 0) { e.state = 'aim'; e.st = 0.8; e.face = toP; S.fx.push({ kind: 'line', x: e.x, z: e.z, a: toP, len: 20, life: 0.8, wide: true }); }
      if (e.phase === 1) { e.state = 'cast'; e.st = 0.7; }
      if (e.phase === 2) { e.state = 'summon'; e.st = 0.6; }
      if (e.phase === 3) { e.state = 'slam'; e.st = 0.9; S.fx.push({ kind: 'ring', x: e.x, z: e.z, r: 7, life: 0.9 }); }
    }
    e.st -= dt;
    if (e.state === 'aim' && e.st <= 0) { e.state = 'dash'; e.st = 0.8; }
    else if (e.state === 'dash') { e.x += Math.sin(e.face) * sp * 4.5; e.z += Math.cos(e.face) * sp * 4.5; e.moving = true; if (d < e.r + 1) hurtPlayer(e.dmg, 'boss ' + e.kind + ' charge'); if (e.st <= 0) e.state = 'walk'; }
    else if ((e.state === 'cast' || e.state === 'cast2') && e.st <= 0) {
      // Even phases use the boss's own move, the second cast its other one.
      bossSignature(e, toP, e.state === 'cast2' || (e.rage && Math.random() < 0.5));
      e.state = 'walk';
    }
    else if (e.state === 'summon' && e.st <= 0) { if (S.enemies.filter(o => o.hp > 0).length < 8) for (const s of [-1, 1]) spawn(pickSpecies(e.ai === 'necro' ? 'archer' : 'minion'), clamp(e.x + s * 4, -RW + 2, RW - 2), e.z + 2); e.state = 'walk'; }
    else if (e.state === 'slam' && e.st <= 0) { if (d < 7.5) hurtPlayer(e.dmg * 1.2, 'boss ' + e.kind + ' slam'); S.fx.push({ kind: 'boom', x: e.x, z: e.z, r: 7.5, life: 0.4 }); fx('slam', e.x, e.z); S.shake = 0.6; UI.vibrate(40); e.state = 'walk'; }
    else if (e.state === 'walk') { if (d > 4) walk(toP, sp * 0.8); else if (d < e.r + 1 && (e.touch = (e.touch || 0) - dt) <= 0) { hurtPlayer(e.dmg * 0.6, 'boss ' + e.kind + ' touch'); e.touch = 1; } }
  }
  // Every chapter boss has its own move (guardians use their chapter boss's move too).
  function warn(x, z, r, delay, dmg, fxKind, c, slow) {
    x = clamp(x, -RW + 1, RW - 1); z = clamp(z, -RH + 1, RH - 1);
    S.warns.push({ x, z, r, t: 0, delay, dmg, fx: fxKind, c, slow }); S.fx.push({ kind: 'ring', x, z, r, life: delay, max: delay, c });
  }
  function bossSignature(e, toP, alt) {
    const p = S.p, own = e.crew != null ? e.crew : crewOf(S.chapter), sig = alt ? (own + 3) % ROSTER.length : own;
    e.face = toP;
    if (sig === 0) { for (let k = -3; k <= 3; k++) enemyShot(e, toP + k * 0.2, 11, 'axe'); Sfx.play('shoot'); }                       // Bone King: axe fan
    else if (sig === 1) { for (let k = 0; k < 18; k++) enemyShot(e, k / 18 * Math.PI * 2 + e.anim, 8, 'orb');                           // Deep Glub: double tide ring
      for (let k = 0; k < 12; k++) enemyShot(e, (k + 0.5) / 12 * Math.PI * 2 + e.anim, 5, 'orb'); fx('freeze', e.x, e.z, '#7cc8ff', 1); }
    else if (sig === 2) { for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.random(), d = k ? 3.5 : 0;               // Mushroom King: spore bombs
      warn(p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, 2.6, 1.1 + k * 0.15, e.dmg * 0.8, 'ignite', '#8dff5a'); } }
    else if (sig === 3) { for (let w = 0; w < 2; w++) setTimeout(() => { if (e.hp > 0 && S.enemies.includes(e)) for (let k = -5; k <= 5; k++) enemyShot(e, toP + k * 0.09, 14, 'orb'); }, w * 260); // Magma Dragon: fire breath
      fx('ignite', e.x, e.z, '#ff7a1a', 1); S.shake = Math.max(S.shake || 0, 0.4); }
    else if (sig === 4) { for (let k = 1; k <= 6; k++) { const f = k / 6;                                                              // Frost King: ice spike line
      warn(e.x + (p.x - e.x) * f * 1.15, e.z + (p.z - e.z) * f * 1.15, 1.9, 0.55 + k * 0.12, e.dmg * 0.7, 'freeze', '#9be7ff', true); } }
    else { for (let k = 0; k < 6; k++) warn(p.x + (Math.random() - 0.5) * 9, p.z + (Math.random() - 0.5) * 9, 2.4, 1 + Math.random() * 0.5, e.dmg, 'slam', '#c9b08a'); // Stone Colossus: rockfall
      warn(p.x, p.z, 2.4, 1.3, e.dmg, 'slam', '#c9b08a'); }
  }
  function enemyShot(e, a, speed, kind) {
    S.foes.push({ x: e.x + Math.sin(a) * 1.2, z: e.z + Math.cos(a) * 1.2, vx: Math.sin(a) * speed, vz: Math.cos(a) * speed, a, dmg: e.dmg * (kind === 'orb' ? 0.8 : kind === 'axe' ? 0.7 : 1), kind, life: 4 });
  }

  // ---------- Collision helpers ----------
  // Obstacles are round (close to what is drawn), so you and the enemies slide past them and fit between them.
  const propHit = (o, x, z, r) => Math.hypot(x - o.x, z - o.z) < o.r * 0.85 + r;
  function blocked(x, z, r) {
    if (x < -RW + r || x > RW - r || z < -RH + r || z > RH - r) return true;
    for (const o of S.props) if (propHit(o, x, z, r)) return true;
    if (S.angel && !S.angel.used && Math.hypot(x - S.angel.x, z - S.angel.z) < 1.4 + r) return true;
    return false;
  }
  function moveCircle(o, dx, dz, r) {
    if (!blocked(o.x + dx, o.z + dz, r)) { o.x += dx; o.z += dz; return; }
    if (!blocked(o.x + dx, o.z, r)) o.x += dx;
    else if (!blocked(o.x, o.z + dz, r)) o.z += dz;
    else {
      // Wedged on a round obstacle: slide along its edge (the tangent closest to the wanted direction).
      const q = S.props.find(o2 => propHit(o2, o.x + dx, o.z + dz, r));
      if (q) {
        const a = Math.atan2(o.x - q.x, o.z - q.z), m = Math.hypot(dx, dz), tx = Math.cos(a), tz = -Math.sin(a), sg = tx * dx + tz * dz >= 0 ? 1 : -1;
        const nx = o.x + tx * m * sg, nz = o.z + tz * m * sg;
        if (!blocked(nx, nz, r)) { o.x = nx; o.z = nz; }
      }
    }
  }
  const inProp = (x, z) => S.props.some(o => Math.hypot(x - o.x, z - o.z) < o.r * 0.8);
  // Line of sight (for shooting and for walking straight at a target).
  function clearLine(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.6);
    for (let i = 1; i < n; i++) { const x = a.x + (b.x - a.x) * i / n, z = a.z + (b.z - a.z) * i / n; if (S.props.some(o => Math.hypot(x - o.x, z - o.z) < o.r * 0.85 + 0.7)) return false; }
    return true;
  }
  // Flow field: distance (in 1x1 cells) from every cell to the hero, refreshed a few times a second.
  const GX = RW * 2, GZ = RH * 2;
  const cellAt = (x, z) => clamp(Math.floor(z + RH), 0, GZ - 1) * GX + clamp(Math.floor(x + RW), 0, GX - 1);
  function buildSolid() {
    S.solid = new Uint8Array(GX * GZ);
    for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) { const x = -RW + i + 0.5, z = -RH + j + 0.5; if (S.props.some(o => Math.hypot(x - o.x, z - o.z) < o.r * 0.85 + 0.75)) S.solid[j * GX + i] = 1; }
    S.flowAt = -1;
  }
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const buildFlow = () => { S.flow = flowFrom(S.p.x, S.p.z, S.flow); };
  // Distance field from a point (the hero, or the door once the room is clear).
  function flowFrom(x, z, into) {
    const f = into || new Int16Array(GX * GZ), q = new Int32Array(GX * GZ), start = cellAt(x, z);
    f.fill(-1); f[start] = 0; let h = 0, t = 0; q[t++] = start;
    while (h < t) {
      const c = q[h++], ci = c % GX, cj = (c - ci) / GX;
      for (const [di, dj] of NB) {
        const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= GX || j >= GZ) continue;
        const n = j * GX + i; if (f[n] >= 0 || S.solid[n]) continue;
        if (di && dj && (S.solid[cj * GX + i] || S.solid[j * GX + ci])) continue; // no corner cutting
        f[n] = f[c] + (di && dj ? 14 : 10); q[t++] = n;
      }
    }
    return f;
  }
  // Direction to walk toward (tx, tz): straight when nothing is in the way, otherwise downhill on the flow field.
  function pathDir(e, tx, tz, field) {
    const direct = Math.atan2(tx - e.x, tz - e.z), F = field || S.flow;
    if (!F || clearLine(e, { x: tx, z: tz })) return direct;
    const c = cellAt(e.x, e.z), ci = c % GX, cj = (c - ci) / GX;
    let best = F[c] >= 0 ? F[c] : 1e9, bx = null, bz = null;
    for (const [di, dj] of NB) {
      const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= GX || j >= GZ) continue;
      const v = F[j * GX + i]; if (v >= 0 && v < best) { best = v; bx = -RW + i + 0.5; bz = -RH + j + 0.5; }
    }
    return bx == null ? direct : Math.atan2(bx - e.x, bz - e.z);
  }

  // ---------- Update ----------
  let joy = null;
  // Pools on the floor (lava / water / ice): the renderer lays them out and lists them in S.hazards.
  const hazardAt = (x, z, pad) => { for (const q of S.hazards || []) if (Math.hypot(x - q.x, z - q.z) < q.r * 0.85 + (pad || 0)) return q; return null; };
  function hazards(dt) {
    const p = S.p, hz = hazardAt(p.x, p.z, 0.3);
    if (hz && hz.kind === 'lava' && !p.dead && (S.lavaT = (S.lavaT || 0) - dt) <= 0) { S.lavaT = 0.45; hurtPlayer(S.p.max * 0.04 + 6, 'lava'); fx('hit', p.x, p.z, '#ff7a1a', 10); }
    for (const e of S.enemies) {
      if (e.hp <= 0 || e.state === 'rise' || e.boss) continue;
      const q = hazardAt(e.x, e.z, 0.2); if (!q) continue;
      if (q.kind === 'lava') { e.burn = Math.max(e.burn || 0, 1.2); }
      else e.slow = Math.max(e.slow || 0, 0.3);
    }
  }
  function update(dt) {
    // Hit-stop: a crit or a kill freezes the action for a few frames, so big hits land with weight.
    if (S.hitStop > 0) { S.hitStop -= dt; dt *= 0.08; }
    else if (S.slowMo > 0) { S.slowMo -= dt; dt *= 0.3; }
    if (S.intro) {
      const I = S.intro; I.t += dt;
      for (const e of S.enemies) { e.anim += dt * 7; if (e.state === 'rise') { e.st -= dt; if (e.st <= 0) e.state = 'walk'; } }
      if (I.t > 1.05 && !I.roar) { I.roar = true; S.shake = 1.1; Sfx.play('boss'); UI.vibrate(150); fx('slam', I.x, I.z); fx('crit', I.x, I.z, '#ff5a3a', 1); }
      S.shake = Math.max(0, (S.shake || 0) - dt * 1.2);
      if (I.t >= I.dur) S.intro = null;
      return;
    }
    S.t += dt;
    // Telegraphed boss strikes: a flashing ring on the floor, then the hit lands.
    if (S.warns.length) {
      for (const w of S.warns) {
        w.t += dt;
        if (w.t >= w.delay) { w.done = true; if (!S.p.dead && Math.hypot(S.p.x - w.x, S.p.z - w.z) < w.r + 0.4) { hurtPlayer(w.dmg, 'warn ' + (w.fx || '')); if (w.slow) S.p.slowT = 1.2; } fx(w.fx, w.x, w.z, w.c, 16); S.shake = Math.max(S.shake || 0, 0.35); }
      }
      S.warns = S.warns.filter(w => !w.done);
    }
    const p = S.p, st = S.st;
    if (S.hazards && S.hazards.length) hazards(dt);
    // Player movement (floating joystick).
    let mx = 0, mz = 0;
    if (joy && !p.dead) {
      const dx = joy.x - joy.sx, dy = joy.y - joy.sy, d = Math.hypot(dx, dy);
      if (d > 6) { const k = Math.min(1, d / 40); mx = dx / d * k; mz = dy / d * k; }
    }
    if (joy) S.autoDoor = false;
    // After the chapter boss the hero walks to the boss chest instead of the door.
    const goal = S.chest ? [S.chest.x, S.chest.z + 2] : [0, -RH + 0.5];
    if (S.autoDoor && !p.dead && !(S.chest && S.chest.open >= 0)) { if (!S.doorFlow) S.doorFlow = flowFrom(goal[0], goal[1] - (S.chest ? 0 : -0.1)); const a = pathDir(p, goal[0], goal[1], S.doorFlow); mx = Math.sin(a); mz = Math.cos(a); }
    if (S.chest && S.chest.open >= 0) { mx = 0; mz = 0; }
    if (S.ctl && !p.dead) { mx = S.ctl.mx; mz = S.ctl.mz; } // balance bot (test hook)
    if (S.auto && !p.dead) { const t = nearestEnemy(p); if (t && dist(t, p) < 3.5) { const a = Math.atan2(p.x - t.x, p.z - t.z); mx = Math.sin(a) * 0.8; mz = Math.cos(a) * 0.8; } else if (S.angel && !S.angel.used) { const a = Math.atan2(S.angel.x - p.x, S.angel.z - p.z); mx = Math.sin(a); mz = Math.cos(a); } else if (S.cleared) S.autoDoor = true; }
    p.moving = Math.hypot(mx, mz) > 0.1;
    if (p.moving) {
      const hz = hazardAt(p.x, p.z, 0.4), s = st.speed * (1 + 0.08 * sk('boots')) * (S.p.slowT > 0 ? 0.6 : 1) * dt * (hz && hz.kind !== 'lava' ? (hz.kind === 'ice' ? 0.6 : 0.7) : 1);
      moveCircle(p, mx * s, mz * s, 0.55);
      p.face = Math.atan2(mx, mz); p.anim += dt * 9;
    }
    p.inv = Math.max(0, p.inv - dt); p.atkT = Math.max(0, p.atkT - dt);
    // Shooting while standing still (Archero's rule); Run & Gun (skill and/or shop perk) also fires while walking, slower.
    p.cd -= dt;
    const walkFire = Math.min(0.9, (sk('move') ? 0.35 + 0.25 * (sk('move') - 1) : 0) + (G.perkMove ? 0.45 : 0));
    if ((!p.moving || walkFire > 0) && !p.dead && p.cd <= 0 && S.enemies.some(e => e.hp > 0 && e.state !== 'rise')) {
      p.cd = 1 / (st.atkSpd * (1 + 0.2 * sk('spd') + 0.08 * sk('spdS')) * (p.moving ? walkFire : 1));
      fire();
    }
    if (S.queue && S.queue.length) { const due = S.queue.filter(q => q.at <= S.t); S.queue = S.queue.filter(q => q.at > S.t); for (const q of due) volley(q.a); }
    // Fire circle.
    if (sk('orbit')) {
      S.orbT += dt * 2.6;
      const n = 2 * sk('orbit');
      for (let k = 0; k < n; k++) {
        const a = S.orbT + k / n * Math.PI * 2, ox = p.x + Math.sin(a) * 2.6, oz = p.z + Math.cos(a) * 2.6;
        for (const e of S.enemies) if (e.hp > 0 && e.state !== 'rise' && Math.hypot(e.x - ox, e.z - oz) < e.r + 0.6 && !(e.orbHit > S.t)) { e.orbHit = S.t + 0.4; hurtEnemy(e, st.atk * atkMul() * 0.45, 'orb'); }
      }
    }
    // Timed class skills.
    const sAtk = st.atk * atkMul();
    // Ground zones (flame trail, poison pools): they tick damage on whoever stands in them.
    if (sk('trail') && p.moving && (S.trailT = (S.trailT || 0) - dt) <= 0) { S.trailT = 0.22; (S.zones = S.zones || []).push({ kind: 'fire', x: p.x, z: p.z, r: 1.3 + 0.2 * sk('trail'), life: 2.4, max: 2.4, dmg: 0.12 + 0.06 * sk('trail') }); }
    if (S.zones && S.zones.length) {
      for (const zn of S.zones) {
        zn.life -= dt; zn.tick = (zn.tick || 0) - dt;
        if (zn.tick <= 0) { zn.tick = 0.4; for (const e of S.enemies) if (e.hp > 0 && e.state !== 'rise' && Math.hypot(e.x - zn.x, e.z - zn.z) < zn.r + e.r) { hurtEnemy(e, sAtk * zn.dmg, zn.kind); if (zn.kind === 'fire') e.burn = Math.max(e.burn || 0, 1); else e.psn = 0.6; } }
      }
      S.zones = S.zones.filter(zn => zn.life > 0);
    }
    if (sk('frostaura')) {
      const r = 3.2 + 0.7 * sk('frostaura'); S.auraR = r; S.auraT = (S.auraT || 0) - dt;
      const tick = S.auraT <= 0; if (tick) S.auraT = 0.5;
      for (const e of S.enemies) if (e.hp > 0 && e.state !== 'rise' && Math.hypot(e.x - p.x, e.z - p.z) < r + e.r) { e.slow = Math.max(e.slow || 0, 0.3); if (tick) hurtEnemy(e, sAtk * (0.1 + 0.07 * sk('frostaura')), 'aura'); }
    } else S.auraR = 0;
    if (sk('blades')) {
      S.bladeT = (S.bladeT || 0) + dt * 4.2;
      const n = 1 + sk('blades');
      for (let k = 0; k < n; k++) {
        const a = S.bladeT + k / n * Math.PI * 2, ox = p.x + Math.sin(a) * 3.6, oz = p.z + Math.cos(a) * 3.6;
        for (const e of S.enemies) if (e.hp > 0 && e.state !== 'rise' && Math.hypot(e.x - ox, e.z - oz) < e.r + 0.8 && !(e.bladeHit > S.t)) { e.bladeHit = S.t + 0.35; hurtEnemy(e, sAtk * 0.4, 'blade'); }
      }
    }
    const alive = S.enemies.filter(e => e.hp > 0 && e.state !== 'rise' && e.state !== 'dead');
    S.shieldT = Math.max(0, (S.shieldT || 0) - dt); S.shieldOn = sk('shield') > 0 && !(S.shieldT > 0);
    if (sk('nova') && alive.length && (S.novaT = (S.novaT || 2) - dt) <= 0) {
      S.novaT = 3.4 - 0.5 * (sk('nova') - 1); const r = 5 + 0.8 * sk('nova');
      for (const e of alive) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < r + e.r) { hurtEnemy(e, sAtk * (0.7 + 0.35 * sk('nova')), 'nova'); if (!e.boss && d > 0.01) { e.kbx += (e.x - p.x) / d * 14; e.kbz += (e.z - p.z) / d * 14; } } }
      S.fx.push({ kind: 'nova', x: p.x, z: p.z, r, life: 0.5 }); fx('nova', p.x, p.z, '#b36bff', 1); S.shake = Math.max(S.shake || 0, 0.25);
    }
    if (sk('meteor') && alive.length && (S.metT = (S.metT || 3) - dt) <= 0) {
      S.metT = 4.6 - 0.8 * (sk('meteor') - 1);
      const t = alive[Math.floor(Math.random() * alive.length)];
      (S.meteors = S.meteors || []).push({ x: t.x, z: t.z, at: S.t + 0.7 });
      S.fx.push({ kind: 'meteor', x: t.x, z: t.z, r: 3.4, life: 0.7, max: 0.7 });
    }
    if (S.meteors && S.meteors.length) {
      for (const m of S.meteors.filter(m => m.at <= S.t)) {
        for (const e of S.enemies) if (e.hp > 0 && e.state !== 'rise' && Math.hypot(e.x - m.x, e.z - m.z) < 3.4 + e.r) { hurtEnemy(e, sAtk * (1.6 + 0.6 * sk('meteor')), 'meteor'); e.burn = 3; }
        fx('meteorhit', m.x, m.z, '#ff7a1a', 1); S.shake = Math.max(S.shake || 0, 0.6);
      }
      S.meteors = S.meteors.filter(m => m.at > S.t);
    }
    if (sk('rain') && alive.length && (S.rainT = (S.rainT || 2.5) - dt) <= 0) {
      S.rainT = 3.6 - 0.5 * (sk('rain') - 1);
      for (let k = 0; k < Math.min(alive.length, sk('rain') + 1); k++) {
        const t = alive[Math.floor(Math.random() * alive.length)];
        (S.rains = S.rains || []).push({ x: t.x, z: t.z, at: S.t + 0.45 });
        S.fx.push({ kind: 'rain', x: t.x, z: t.z, r: 2.4, life: 0.45, max: 0.45 });
      }
    }
    if (S.rains && S.rains.length) {
      for (const m of S.rains.filter(m => m.at <= S.t)) {
        for (const e of S.enemies) if (e.hp > 0 && e.state !== 'rise' && Math.hypot(e.x - m.x, e.z - m.z) < 2.4 + e.r) hurtEnemy(e, sAtk * (0.8 + 0.3 * sk('rain')), 'rain');
        fx('rainhit', m.x, m.z, '#fff1a8', 1);
      }
      S.rains = S.rains.filter(m => m.at > S.t);
    }
    // Player shots.
    const atk = sAtk;
    for (const s of S.shots) {
      s.life -= dt; s.x += s.vx * dt; s.z += s.vz * dt;
      const out = s.x < -RW || s.x > RW || s.z < -RH || s.z > RH;
      if (out || inProp(s.x, s.z)) {
        if (s.wall > 0 && out) { s.wall--; if (s.x < -RW || s.x > RW) s.vx *= -1; else s.vz *= -1; s.x = clamp(s.x, -RW, RW); s.z = clamp(s.z, -RH, RH); s.a = Math.atan2(s.vx, s.vz); fx('wallbounce', s.x, s.z); }
        else s.life = 0;
        continue;
      }
      for (const e of S.enemies) {
        if (e.hp <= 0 || e.state === 'rise' || s.hit.includes(e) || Math.hypot(e.x - s.x, e.z - s.z) > e.r + 0.4) continue;
        s.hit.push(e);
        hurtEnemy(e, atk * Math.pow(0.85, sk('multi')), 'shot');
        if (!e.boss) { const k = 7 / Math.hypot(s.vx, s.vz); e.kbx += s.vx * k; e.kbz += s.vz * k; }
        if (s.ric > 0) {
          s.ric--;
          const n = nearestEnemy(e, s.hit);
          if (n) { const a = Math.atan2(n.x - e.x, n.z - e.z); s.vx = Math.sin(a) * 30; s.vz = Math.cos(a) * 30; s.a = a; s.x = e.x; s.z = e.z; s.life = 1; fx('ricochet', e.x, e.z); break; }
        }
        if (sk('poison') && !s.child) (S.zones = S.zones || []).push({ kind: 'poison', x: e.x, z: e.z, r: 1.6 + 0.3 * sk('poison'), life: 2.5 + 0.5 * sk('poison'), max: 2.5 + 0.5 * sk('poison'), dmg: 0.1 + 0.06 * sk('poison') });
        if (sk('split') && !s.child) fx('split', e.x, e.z);
        if (sk('split') && !s.child) for (const d of [-0.7, 0.7]) { const a2 = s.a + d * (sk('split') > 1 ? 1.3 : 1); S.shots.push({ x: e.x, z: e.z, vx: Math.sin(a2) * 26, vz: Math.cos(a2) * 26, a: a2, life: 0.6, hit: [e], ric: 0, pierce: 0, wall: 0, child: 1 }); }
        if (s.pierce > 0) { s.pierce--; fx('pierce', e.x, e.z, s.a); continue; }
        s.life = 0; break;
      }
    }
    S.shots = S.shots.filter(s => s.life > 0);
    // Enemies (the flow field to the hero is rebuilt 5 times a second).
    if ((S.flowT = (S.flowT || 0) - dt) <= 0) { S.flowT = 0.2; buildFlow(); }
    for (const e of S.enemies) {
      e.anim += dt * 7; e.flash = Math.max(0, e.flash - dt);
      // A foe at 0 HP is always dead, whatever its AI state says (a burn tick used to kill it and then think()
      // set it walking again: a 'ghost' that kept attacking in a cleared room).
      if (e.hp <= 0 && e.state !== 'dead') kill(e);
      if (e.state === 'dead') { e.st -= dt; continue; }
      if (e.state === 'rise') { e.st -= dt; if (e.st <= 0) e.state = 'walk'; continue; }
      if (e.burn > 0) { e.burn -= dt; e.burnT = (e.burnT || 0) - dt; if (e.burnT <= 0) { e.burnT = 0.5; hurtEnemy(e, atk * 0.12, 'burn'); } }
      if (e.state === 'dead') continue;
      e.slow = Math.max(0, e.slow - dt);
      if (e.shock > 0) e.shock -= dt; if (e.psn > 0) e.psn -= dt; // shown by the renderer only
      const x0 = e.x, z0 = e.z;
      think(e, dt);
      const dx = e.x - x0 + e.kbx * dt, dz = e.z - z0 + e.kbz * dt; e.x = x0; e.z = z0;
      e.kbx *= Math.max(0, 1 - dt * 8); e.kbz *= Math.max(0, 1 - dt * 8);
      moveCircle(e, dx, dz, e.r * 0.7);
      // Keep apart from each other.
      for (const o of S.enemies) if (o !== e && o.hp > 0) { const d = Math.hypot(o.x - e.x, o.z - e.z), m = e.r + o.r; if (d > 0 && d < m) { const k = (m - d) / d * 0.25; moveCircle(e, (e.x - o.x) * k, (e.z - o.z) * k, e.r * 0.8); } }
    }
    S.enemies = S.enemies.filter(e => e.state !== 'dead' || e.st > 0);
    // Enemy shots.
    for (const s of S.foes) {
      s.life -= dt; s.x += s.vx * dt; s.z += s.vz * dt;
      const fc = s.kind === 'axe' ? '#ff9a4a' : s.kind === 'bolt' ? '#ff5050' : '#d07bff';
      if (s.x < -RW || s.x > RW || s.z < -RH || s.z > RH || inProp(s.x, s.z)) { s.life = 0; fx('hit', s.x, s.z, fc, 8); }
      else if (Math.hypot(s.x - p.x, s.z - p.z) < 0.9 && !p.dead) { hurtPlayer(s.dmg, 'shot ' + (s.kind || '')); s.life = 0; fx('hit', s.x, s.z, fc, 16); }
    }
    S.foes = S.foes.filter(s => s.life > 0);
    // Spike traps (up 1 s out of 3).
    for (const sp of S.spikes) { sp.t += dt; sp.up = sp.t % 3 < 1; if (sp.up && Math.abs(p.x - sp.x) < 2 && Math.abs(p.z - sp.z) < 2) hurtPlayer(40 * power(S.chapter, S.room), 'spikes'); }
    // Room cleared: loot flies to the hero, the door opens.
    // Second wave rises when the first is almost down.
    if (S.wave2.length && S.enemies.filter(e => e.hp > 0).length <= 2) {
      for (const t of S.wave2) { const [x, z] = freeSpot(Math.random, 9); if (t.t) spawn(t.t, x, z, { elite: true }); else spawn(t, x, z); }
      S.wave2 = []; banner('⚠️ ' + L('Wave 2!', '2. Dalga!'), ''); Sfx.play('boss');
    }
    if (!S.cleared && !S.wave2.length && S.enemies.every(e => e.hp <= 0)) { const last = S.room >= roomsOf(S.chapter); S.cleared = true; S.door = !last; S.clearT = 0; S.foes = []; S.warns = []; Sfx.play('win');
      // Chapter boss down: a big boss chest drops in the middle of the room in place of the door.
      if (last) { S.chest = { x: 0, z: -RH * 0.42, t: 0, open: -1 }; S.shake = 0.6; banner('👑 ' + L('Boss defeated!', 'Boss yenildi!'), L('Open the boss chest', 'Boss sandığını aç')); }
      // A cleared room gives back 8% HP, so long chapters do not grind the hero down.
      { const hl = Math.round(S.p.max * 0.08); if (S.p.hp < S.p.max) { S.p.hp = Math.min(S.p.max, S.p.hp + hl); floatText(S.p.x, S.p.z, '+' + hl, '#7dffae'); } } if (!last) fx('door', 0, -RH + 1); if (!last) banner(L('Room cleared!', 'Oda temizlendi!'), L('⬆ Walk to the glowing door', '⬆ Parlayan kapıya yürü')); }
    // Door guidance: after a short idle the hero walks to the door by himself (any touch takes over again).
    if (S.cleared && (S.door || (S.chest && S.chest.open < 0)) && !(S.angel && !S.angel.used)) { S.clearT += dt; if (!S.drops.length && !joy && !p.moving && S.clearT > 2.2 && mode === 'play') S.autoDoor = true; }
    for (const d of S.drops) {
      d.t += dt;
      if (S.cleared && d.t > 0.4) {
        const a = Math.atan2(p.x - d.x, p.z - d.z), v = 26 * dt; d.x += Math.sin(a) * v; d.z += Math.cos(a) * v;
        if (Math.hypot(p.x - d.x, p.z - d.z) < 1) { d.done = true; S.gold += d.gold; gainXp(d.xp); Sfx.play('coin'); }
      }
    }
    S.drops = S.drops.filter(d => !d.done);
    // Angel.
    if (S.angel && !S.angel.used && Math.hypot(p.x - S.angel.x, p.z - S.angel.z) < 3) { S.angel.used = true; angelScreen(); return; }
    // Boss chest: touch it to open (a short shake and burst in 3D), then the chapter rewards.
    if (S.chest) {
      const c = S.chest; c.t += dt;
      if (c.open < 0 && c.t > 0.8 && !S.drops.length && Math.hypot(p.x - c.x, p.z - c.z) < 3.6) { c.open = 0; S.autoDoor = false; Sfx.play('boss'); }
      if (c.open >= 0) { c.open += dt; if (c.open > 0.55 && !c.burst) { c.burst = true; S.shake = 0.8; Sfx.play('win'); } if (c.open > 1.25) return chapterWin(); }
    }
    // Door.
    if (S.door && p.z < -RH + 1.6 && Math.abs(p.x) < 2.2 && !S.drops.length) {
      if (S.room >= roomsOf(S.chapter)) return chapterWin();
      Sfx.play('click'); nextRoom(); return;
    }
    S.shake = Math.max(0, (S.shake || 0) - dt * 2.5); S.hurtT = Math.max(0, (S.hurtT || 0) - dt); S.p.slowT = Math.max(0, (S.p.slowT || 0) - dt);
    for (const f of S.fx) { f.life -= dt; if (f.e) { f.x = f.e.x; f.z = f.e.z; f.a = f.e.face; } }
    S.fx = S.fx.filter(f => f.life > 0);
    for (const t of S.texts) t.life -= dt;
    S.texts = S.texts.filter(t => t.life > 0);
    if (S.banner) { S.banner.life -= dt; if (S.banner.life <= 0) S.banner = null; }
    hudStats();
  }
  function gainXp(n) {
    const p = S.p;
    p.xp += n * (1 + 0.15 * sk('wisdom'));
    const need = () => 30 + 22 * (p.lv - 1);
    while (p.xp >= need()) { p.xp -= need(); p.lv++; S.pending++; fx('levelup', p.x, p.z, '#7dffae', 40); }
    if (S.room >= roomsOf(S.chapter) && S.cleared) S.pending = 0; // boss down: the chapter ends, no skill pick
    if (S.pending && mode === 'play' && S.drops.every(d => d.done)) levelUpScreen();
  }

  // ---------- Input ----------
  cvs.addEventListener('pointerdown', e => { if (mode !== 'play' || paused) return; joy = { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY }; try { cvs.setPointerCapture(e.pointerId); } catch (_) { } });
  cvs.addEventListener('pointermove', e => { if (!joy) return; joy.x = e.clientX; joy.y = e.clientY; const dx = joy.x - joy.sx, dy = joy.y - joy.sy, d = Math.hypot(dx, dy); if (d > 55) { joy.sx = joy.x - dx / d * 55; joy.sy = joy.y - dy / d * 55; } });
  const stopJoy = () => { joy = null; };
  cvs.addEventListener('pointerup', stopJoy);
  cvs.addEventListener('pointercancel', stopJoy);

  // ---------- In-run screens ----------
  let endFrames = 0;
  function overlay(html, cls) {
    // Redrawing an open sheet (item upgrade, equip) swaps its content only, so the pop-in animation doesn't replay.
    const ov = $('ov'), c = 'overlay center' + (cls ? ' ' + cls : ''), sh = ov.className === c && ov.querySelector(':scope > .sheet');
    ov.className = c;
    if (sh) sh.innerHTML = html; else ov.innerHTML = '<div class="sheet">' + html + '</div>';
    joy = null;
  }
  function closeOverlay() { $('ov').className = 'overlay hidden'; $('ov').innerHTML = ''; }
  // Tapping the dark area around a menu popup (item sheet etc.) closes it.
  $('ov').addEventListener('click', e => { if (e.target === $('ov') && mode === 'menu') { closeOverlay(); renderMenu(); } });
  function skillChoices() {
    const cls = heroCls(), ch = Math.max(G.chapter, S.chapter);
    // At most MAX_SKILLS different skills a run (the potion is a one-off and does not count); after that only
    // the ones you have level up, and once all of those are maxed a level-up gives a bonus box instead.
    const full = ownedSkills().length >= MAX_SKILLS;
    const keys = Object.keys(SKILLS).filter(k => sk(k) < SKILLS[k].max && (!SKILLS[k].cls || SKILLS[k].cls === cls) && !(SKILLS[k].unlock > ch) &&
      (full ? sk(k) > 0 && k !== 'potion' : k !== 'potion' || S.p.hp < S.p.max * 0.8));
    // Weighted by rarity: commons often, legendaries seldom.
    const out = [];
    while (out.length < 3 && keys.length) {
      let r = Math.random() * keys.reduce((a, k) => a + SK_TIER[SKILLS[k].t].w, 0), i = 0;
      while ((r -= SK_TIER[SKILLS[keys[i]].t].w) > 0 && i < keys.length - 1) i++;
      out.push(keys.splice(i, 1)[0]);
    }
    return out;
  }
  const MAX_SKILLS = 8;
  const ownedSkills = () => Object.keys(S.skills).filter(k => S.skills[k] > 0 && k !== 'potion');
  // Every skill maxed: the level-up opens a bonus box (gold, scrolls, a heal or, rarely, a piece of gear).
  function bonusBox() {
    S.pending = Math.max(0, S.pending - 1); mode = 'pick'; closeOverlay();
    const x = Math.random();
    let item;
    if (x < 0.1) { const g = { b: randBase(), r: rollRarity(S.chapter, false) }; S.items.push(g); item = { icon: icon(g.b), label: RAR[g.r].name(), sub: BASES[g.b].name(), rarity: RAR[g.r].id }; }
    else if (x < 0.35) { S.scrolls += 2; item = { icon: '📜', label: '+2', sub: L('Scrolls', 'Parşömen'), rarity: 'rare' }; }
    else if (x < 0.6) { S.p.hp = Math.min(S.p.max, S.p.hp + S.p.max * 0.35); item = { icon: '💖', label: '+35%', sub: L('Heal', 'İyileşme'), rarity: 'epic' }; }
    else { const g = Math.round(80 * goldScale(S.chapter)); S.gold += g; item = { icon: '💰', label: '+' + goldFmt(g), sub: L('Gold', 'Altın'), rarity: 'common' }; }
    const done = () => { mode = 'play'; if (S.pending) levelUpScreen(); };
    if (window.Fx) Fx.reveal({ title: L('Bonus Box', 'Bonus Kutusu'), chest: 'gold', items: [item] }).then(done); else { UI.toast(item.label + ' ' + item.sub); done(); }
  }
  function levelUpScreen() {
    if (!S.pending) return;
    mode = 'pick'; pick = skillChoices();
    if (!pick.length) return bonusBox();
    overlay('<div class="ribbon">' + L('LEVEL UP!', 'SEVİYE ATLADIN!') + '</div><p class="sub">' + L('Pick a skill', 'Bir yetenek seç') + ' · ' + L('Lv.', 'Sv.') + S.p.lv + ' · ' + ownedSkills().length + '/' + MAX_SKILLS + (S.pending > 1 ? ' · ' + L(S.pending + ' picks left', S.pending + ' seçim kaldı') : '') + '</p>' +
      '<div class="skillpick">' + pick.map(k => '<button class="skc t' + SKILLS[k].t + '" style="--tc:' + SK_TIER[SKILLS[k].t].c + '" data-act="skill" data-arg="' + k + '"><span class="ski">' + skillIcon(k) + '<i class="skt">' + SK_TIER[SKILLS[k].t].name() + '</i></span><b>' + skName(k) + '</b><small>' + skDesc(k) + '</small>' + (sk(k) ? '<em>' + L('Lv.', 'Sv.') + (sk(k) + 1) + '</em>' : '') + '</button>').join('') + '</div>' +
      (S.rerolls > 0 ? '<button class="btn purple" data-act="reroll"><span class="ad-ico">AD</span>' + L('🎲 Reroll', '🎲 Yeniden çevir') + '</button>' : ''));
  }
  function angelScreen() {
    mode = 'pick';
    if (!skillChoices().length) {
      overlay('<div class="ribbon">👼 ' + L('Angel', 'Melek') + '</div><p class="sub">' + L('All skills are maxed', 'Tüm yeteneklerin dolu') + '</p>' +
        '<div class="skillpick two"><button class="skc" data-act="angel" data-arg="heal"><span class="ski">' + (window.GI ? GI.svg('sk:heal') : '💖') + '</span><b>' + L('Full heal', 'Tam iyileş') + '</b><small>' + L('Restore all HP', 'Canının tamamını yenile') + '</small></button></div>');
      return;
    }
    overlay('<div class="ribbon">👼 ' + L('Angel', 'Melek') + '</div><p class="sub">' + L('Choose a blessing', 'Bir kutsama seç') + '</p>' +
      '<div class="skillpick two"><button class="skc" data-act="angel" data-arg="heal"><span class="ski">' + (window.GI ? GI.svg('sk:heal') : '💖') + '</span><b>' + L('Heal', 'İyileş') + '</b><small>' + L('Restore 40% HP', 'Canının %40\'ını yenile') + '</small></button>' +
      '<button class="skc" data-act="angel" data-arg="skill"><span class="ski">' + (window.GI ? GI.svg('sk:new') : '✨') + '</span><b>' + L('New skill', 'Yeni yetenek') + '</b><small>' + L('Pick 1 of 3 skills', '3 yetenekten 1\'ini seç') + '</small></button></div>');
  }
  function dieScreen() {
    mode = 'dead';
    const can = !S.revived;
    overlay('<div class="ribbon lose">' + L('YOU FELL', 'DÜŞTÜN') + '</div><p class="sub">' + L('Chapter ', 'Bölüm ') + S.chapter + ' · ' + L('room ', 'oda ') + S.room + '/' + roomsOf(S.chapter) + '</p>' +
      (can ? '<button class="btn purple big" data-act="revive" data-arg="ad"><span class="ad-ico">AD</span>' + L('Revive', 'Canlan') + '</button>' +
        '<button class="btn gold" data-act="revive" data-arg="star">⭐ 20 · ' + L('Revive', 'Canlan') + '</button>' : '') +
      '<button class="btn gray" data-act="giveup">' + L('End run', 'Koşuyu bitir') + '</button>');
  }
  function runRewards(win) {
    const ch = S.chapter, roomsDone = win ? roomsOf(ch) : S.room - 1, ran = roomsDone - S.from;
    const bonus = win ? winBonus(ch) : 0;
    const gold = Math.round((S.gold + bonus) * (1 + 0.02 * tal('gold')) * PlayerLv.mul()); // Greed (once) and player level bonus
    G.gold += gold;
    const scrolls = S.scrolls + (win ? 2 : ran >= 5 ? 1 : 0), got = {};
    for (let k = 0; k < scrolls; k++) { const s = SLOTS[Math.floor(Math.random() * 4)]; G.scrolls[s]++; got[s] = (got[s] || 0) + 1; }
    if (!win && ran >= 5) { S.items.push({ b: randBase(), r: rollRarity(ch, false) }); }
    const items = S.items.map(i => { const it = newItem(i.b, i.r); G.inv.push(it); return it; });
    G.best[ch] = Math.max(G.best[ch] || 0, roomsDone);
    G.runs++;
    let stars = (win ? 3 + Math.min(ch, 7) : ran >= 5 ? 1 : 0) + (S.stageStars || 0);
    if (win) { if (G.ckpt) delete G.ckpt[ch]; if (ch === G.chapter) { G.chapter++; selChapter = G.chapter; } }
    Save.addCoins(stars); Save.save();
    return { gold, scrolls: got, items, stars, roomsDone };
  }
  // Result loot: one row of totals (gold, stars, scrolls), then the items grouped by type and rarity, rarest first,
  // at most two rows of small tiles (the rest is summed up in a "+N" tile).
  function lootHtml(r) {
    const by = {};
    for (const it of r.items) { const k = it.b + ':' + it.r; (by[k] = by[k] || { b: it.b, r: it.r, n: 0 }).n++; }
    const gs = Object.values(by).sort((a, b) => b.r - a.r || b.n - a.n), MAX = 10, shown = gs.length > MAX ? gs.slice(0, MAX - 1) : gs;
    const rest = gs.slice(shown.length).reduce((a, g) => a + g.n, 0);
    return '<div class="loot">' +
      '<div class="lootc r-rare"><b>💰</b><span>+' + goldFmt(r.gold) + '</span></div>' +
      (r.stars ? '<div class="lootc r-legendary"><b>⭐</b><span>+' + r.stars + '</span></div>' : '') +
      (Object.keys(r.scrolls).length ? '<div class="lootc r-common"><b>📜</b><span>+' + Object.values(r.scrolls).reduce((x, y) => x + y, 0) + '</span></div>' : '') + '</div>' +
      (gs.length ? '<p class="loott">' + L('Items', 'Eşyalar') + ' · ' + r.items.length + '</p><div class="lootg">' +
        shown.map(g => '<div class="lgi" style="--rc:' + RAR[g.r].c + '" title="' + RAR[g.r].name() + ' ' + BASES[g.b].name() + '"><b class="lic">' + icon(g.b) + '</b>' + (g.n > 1 ? '<i>×' + g.n + '</i>' : '') + '</div>').join('') +
        (rest ? '<div class="lgi more">+' + rest + '</div>' : '') + '</div>' : '');
  }
  function chapterWin() {
    mode = 'end'; S.pending = 0;
    const first = S.chapter === G.chapter, chest = [], ch = S.chapter;
    // Boss chest: more and better items in later chapters. Every item has a floor rarity by chapter, the first clear
    // adds a guaranteed top item, and late bosses can drop Legendary. Mythic and Celestial only come from merging.
    const n = (first ? 3 : 2) + Math.min(3, Math.floor(ch / 8)), floor = ch >= 40 ? 3 : ch >= 20 ? 2 : ch >= 8 ? 1 : 0;
    for (let k = 0; k < n; k++) {
      let r = Math.max(floor, rollRarity(ch, false));
      if (k === 0 && first) r = Math.max(r, Math.min(4, 2 + Math.floor(ch / 15)));
      if (ch >= 25 && Math.random() < 0.04 + 0.002 * ch) r = 4;
      const it = { b: randBase(), r }; S.items.push(it); chest.push(it);
    }
    chest.sort((x, y) => x.r - y.r); // the best card is revealed last
    const r = runRewards(true);
    if (window.Fx) {
      mode = 'pick';
      Fx.reveal({ title: L('Boss Chest', 'Boss Sandığı'), chest: first || ch >= 20 ? 'royal' : 'gold',
        items: chest.map(it => ({ icon: icon(it.b), label: RAR[it.r].name(), sub: BASES[it.b].name(), rarity: RAR[it.r].id })) }).then(() => winScreen(r));
    } else winScreen(r);
  }
  function winScreen(r) {
    mode = 'end';
    Ads.track('level_win', { game: 'arrow', level: S.chapter, kills: S.kills });
    Sfx.play('win');
    overlay('<div class="rays"></div><div class="ribbon">' + L('CHAPTER CLEAR!', 'BÖLÜM TAMAM!') + '</div><div class="stars"><span>⭐</span><span>⭐</span><span>⭐</span></div>' +
      '<p class="sub">' + L('Chapter ', 'Bölüm ') + S.chapter + ' · ' + chapterOf(S.chapter).name() + ' · ' + S.kills + L(' kills', ' öldürme') + '</p>' + lootHtml(r) +
      (r.gold > 0 ? '<button class="btn gold big pulse" data-act="double"><span class="ad-ico">AD</span>' + L('2x GOLD', '2x ALTIN') + ' · +' + goldFmt(r.gold) + (doubleAds(S.chapter) > 1 ? ' · 📺 ' + doubleAds(S.chapter) : '') + '</button>' : '') +
      '<button class="btn gray" data-act="tomenu">' + L('Continue', 'Devam') + '</button>');
    pendingDouble = r.gold; doubleSeen = 0; doubleNeed = doubleAds(S.chapter);
  }
  let pendingDouble = 0, doubleSeen = 0, doubleNeed = 1;
  // Late chapters pay a lot of gold, so doubling it costs more ads: 1 up to chapter 10, 2 up to 30, then 3.
  const doubleAds = ch => ch > 30 ? 3 : ch > 10 ? 2 : 1;
  function runOver() {
    mode = 'end';
    const r = runRewards(false);
    Ads.track('level_fail', { game: 'arrow', level: S.chapter, room: S.room });
    overlay('<div class="ribbon lose">' + L('RUN OVER', 'KOŞU BİTTİ') + '</div><p class="sub">' + L('Chapter ', 'Bölüm ') + S.chapter + ' · ' + L('reached room ', 'ulaşılan oda ') + S.room + '/' + roomsOf(S.chapter) + '</p>' + lootHtml(r) +
      '<div class="hint">' + L('💡 Upgrade your gear and talents, then try again. Power: ', '💡 Ekipmanını ve yeteneklerini geliştirip tekrar dene. Güç: ') + powerScore() + '</div>' +
      (r.gold > 0 ? '<button class="btn gold big" data-act="double"><span class="ad-ico">AD</span>' + L('2x GOLD', '2x ALTIN') + ' · +' + goldFmt(r.gold) + (doubleAds(S.chapter) > 1 ? ' · 📺 ' + doubleAds(S.chapter) : '') + '</button>' : '') +
      '<button class="btn gray" data-act="tomenu">' + L('Continue', 'Devam') + '</button>');
    pendingDouble = r.gold; doubleSeen = 0; doubleNeed = doubleAds(S.chapter);
  }

  // ---------- Menu (Archero-style: tabs at the bottom) ----------
  const slotName = s => ({ weapon: L('Weapon', 'Silah'), armor: L('Armor', 'Zırh'), ring: L('Ring', 'Yüzük'), amulet: L('Amulet', 'Muska') })[s];
  function showMenu() {
    mode = 'menu'; S = null; closeOverlay();
    document.body.classList.add('inmenu');
    menuScene();
    renderMenu();
    Ads.banner(true);
  }
  const icon = b => (window.GI && GI.has('gear:' + b) ? GI.svg('gear:' + b) : window.ArrowIcons ? ArrowIcons.item(b) : BASES[b].icon);
  const slotIcon = s => (window.ArrowIcons ? ArrowIcons.slot(s) : '');
  const skillIcon = k => (window.GI && heroCls() === 'mage' && GI.has('skm:' + k) ? GI.svg('skm:' + k) : window.GI && GI.has('sk:' + k) ? GI.svg('sk:' + k) : window.ArrowIcons ? ArrowIcons.skill(k) : SKILLS[k].icon);
  // Bag view: everything not equipped, identical items (type + rarity + level) stacked, best first.
  function bagStacks() {
    const eq = new Set(SLOTS.map(s => G.eq[s])), groups = new Map();
    for (const it of G.inv) { if (eq.has(it.id)) continue; const k = it.b + '|' + it.r + '|' + it.l; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
    return Array.from(groups.values()).sort((a, b) => b[0].r - a[0].r || b[0].l - a[0].l || b.length - a.length);
  }
  // Triples that can merge: same base and rarity, below the top rarity, at most one of them worn.
  const wornSet = () => { const w = new Set(); for (const e of Object.values(G.eqs || {})) for (const s of SLOTS) if (e[s]) w.add(e[s]); return w; };
  const bagGroups = () => { const by = {}; for (const it of G.inv) if (it.r < RAR.length - 1) (by[it.b + ':' + it.r] = by[it.b + ':' + it.r] || []).push(it); return by; };
  // Groups that can merge right now (3 alike, or 2 alike plus a worn one).
  function mergeCount() {
    const worn = wornSet();
    return Object.values(bagGroups()).filter(g => { const w = g.filter(x => worn.has(x.id)).length; return g.length - w >= (w ? 2 : 3); }).length;
  }
  // Merge everything in one pass, lowest rarity first, so results chain upwards (a worn item is always the one that
  // levels up; the highest-level spares are eaten first and the kept item takes the best level). Returns the upgraded items.
  function mergeEverything() {
    const worn = wornSet(), by = bagGroups(), gone = new Set(), ups = new Set();
    for (let r = 0; r < RAR.length - 1; r++) for (const key of Object.keys(by)) {
      if (+key.split(':')[1] !== r) continue;
      const g = by[key].sort((a, b) => b.l - a.l); delete by[key];
      const W = g.filter(x => worn.has(x.id)), F = g.filter(x => !worn.has(x.id));
      while (F.length >= (W.length ? 2 : 3)) {
        const keep = W.length ? W.shift() : F.shift(), food = F.splice(0, 2);
        for (const f of food) gone.add(f);
        keep.r++; keep.l = Math.max(keep.l, food[0].l, food[1].l); ups.add(keep);
        if (keep.r < RAR.length - 1) { const k2 = keep.b + ':' + keep.r; (by[k2] = by[k2] || []).push(keep); }
      }
    }
    if (gone.size) G.inv = G.inv.filter(x => !gone.has(x));
    return { ups, n: gone.size / 2 };
  }
  function tile(it, act, count) {
    const b = BASES[it.b], r = RAR[it.r];
    return '<button class="itile r-' + r.id + (fits(it) ? '' : ' nofit') + '" style="--rc:' + r.c + '" ' + (act ? 'data-act="' + act + '" data-arg="' + it.id + '"' : '') + '><span class="ii">' + icon(it.b) + '</span><span class="il">' + L('Lv.', 'Sv.') + it.l + '</span><span class="is">' + slotIcon(b.slot) + '</span>' + (count > 1 ? '<span class="ic">' + count + '</span>' : '') + '</button>';
  }
  // Menu 3D scene: the chosen hero, or on the Heroes tab the hero being browsed (locked ones shown as a dim silhouette).
  let viewHero = G.hero, viewSkin = null; // viewSkin: outfit id previewed on the Heroes tab ('' = classic), null = the worn one
  const shownSkin = k => tab === 'heroes' && viewSkin != null ? (window.ArrowSkins ? ArrowSkins.find(k, viewSkin) : null) : outfitOf(k);
  function menuScene() {
    if (!R3) return;
    const k = tab === 'heroes' ? viewHero : G.hero, h = HEROES[k], sk = shownSkin(k);
    R3.setMenu(h.model, chapterOf(selChapter), h.tint, tab === 'heroes' && !G.heroes.includes(k) && !sk, sk);
    R3.menuGear = tab === 'heroes' && k !== G.hero ? null : gearLook();
  }
  function browseHero(d) { const ks = Object.keys(HEROES); viewHero = ks[(ks.indexOf(viewHero) + d + ks.length) % ks.length]; viewSkin = null; renderMenu(); }
  // Swipe left/right over the hero to browse.
  { let sx = null;
    addEventListener('pointerdown', e => { sx = mode === 'menu' && tab === 'heroes' && !e.target.closest('#apanel, .anavbar, .mtop, #ov') ? e.clientX : null; });
    addEventListener('pointerup', e => { if (sx != null && Math.abs(e.clientX - sx) > 40) browseHero(e.clientX < sx ? 1 : -1); sx = null; }); }
  // Outfit strip under the hero: classic + the hero's outfits as baked 3D portraits (scripts/make-skin-art.js); the
  // previewed one turns on a turntable. Tap to preview; owned ones are put on at once.
  // Absolute URL: it goes into a CSS variable, and a relative url() there resolves against the stylesheet that uses it.
  const skinImg = (k, id) => new URL('../ortak/img/skins/' + k + '-' + (id || 'base') + '.webp', location.href).href;
  function skinRow(k, own) {
    if (!window.ArrowSkins) return '';
    const cur = shownSkin(k), cid = cur ? cur.id : '', worn = G.outfit[k] || '';
    const tile = (id, name, rar, s) => {
      const mine = hasOutfit(k, id), rc = rar ? RAR.find(r => r.id === rar).c : '#9aa3b5';
      const price = mine ? (own && id === worn ? L('Worn', 'Giyili') : L('Owned', 'Sende')) : s.ads ? '📺 ' + (G.skinAds[k + '.' + id] || 0) + '/' + s.ads : '⭐ ' + s.cost;
      return '<button class="sktile r-' + (rar || 'common') + (id === cid ? ' on' : '') + (mine ? ' own' : '') + '" style="--rc:' + rc + ';--img:url(' + skinImg(k, id) + ')" data-act="skinView" data-arg="' + (id || '-') + '">' +
        '<span class="skpic">' + (own && id === worn ? '<em>✓</em>' : '') + '</span><b>' + name + '</b><small>' + price + '</small></button>';
    };
    return '<div class="skrow">' + tile('', L('Classic', 'Klasik')) + ArrowSkins.SKINS[k].map(s => tile(s.id, s.name(), s.rar, s)).join('') + '</div>';
  }
  function unlockOutfit(k, sk) {
    G.outfits.push(k + '.' + sk.id); G.outfit[k] = sk.id; viewSkin = sk.id; Save.save(); renderMenu();
    if (R3 && R3.celebrate) R3.celebrate();
    setTimeout(() => reward({ title: sk.name() + L(' unlocked!', ' açıldı!'), items: [{ icon: '<span class="rwskin" style="--img:url(' + skinImg(k, sk.id) + ')"></span>', label: sk.name(), sub: HEROES[k].name, rarity: sk.rar }] }), 1100);
  }
  function renderMenu() {
    // The new panel gets the next frames to itself: the 3D hero waits ~1/4 s (measured on the phone: tab switches
    // and upgrades stalled 50-110 ms while both drew).
    menuHold = performance.now() + 250;
    menuScene();
    $('mgold').textContent = goldFmt(G.gold); $('mstars').textContent = Kit.fmt(Save.data.coins);
    document.querySelectorAll && document.querySelectorAll('.anav').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    let h = '';
    if (tab === 'battle') {
      const c = chapterOf(selChapter), best = G.best[selChapter] || 0, unlocked = selChapter <= G.chapter, rooms = roomsOf(selChapter), per = rooms / 10;
      const done = selChapter < G.chapter || best >= rooms, ck = done ? 0 : (G.ckpt || {})[selChapter] || 0;
      // 10 pips; in a long chapter each pip is `per` rooms and a pip holding a boss room (every 10th) is marked.
      const pips = Array.from({ length: 10 }, (_, i) => '<i class="' + (done || (i + 1) * per <= best ? 'on' : '') + (per === 1 && i === 4 ? ' ang' : Math.floor((i + 1) * per / 10) > Math.floor(i * per / 10) ? ' boss' : '') + '"></i>').join('');
      h = '<div class="chap" style="--cc:' + c.light + '">' +
        '<button class="carr" data-act="chap" data-arg="-1"' + (selChapter > 1 ? '' : ' disabled') + '>◀</button>' +
        '<div class="cbody"><span class="cmed">' + selChapter + '</span><div class="ctext"><small>' + L('CHAPTER ', 'BÖLÜM ') + selChapter + '</small><b>' + c.name() + '</b>' +
        '<div class="pips">' + pips + '</div><span class="cbest">' + (done ? L('✓ Cleared', '✓ Tamamlandı') + ' · ' + rooms + L(' rooms', ' oda') : L('Best: room ', 'En iyi: oda ') + best + '/' + rooms + (ck ? ' · 🚩 ' + ck : '')) + '</span></div></div>' +
        '<button class="carr" data-act="chap" data-arg="1"' + (selChapter < G.chapter ? '' : ' disabled') + '>▶</button></div>' +
        '<div class="pwr"><span>' + HEROES[G.hero].icon + ' <b class="hn">' + HEROES[G.hero].name + '</b></span><span>⚔️ ' + L('Power ', 'Güç ') + '<b>' + powerScore() + '</b></span></div>' +
        (unlocked ? '<button class="btn gold big startbtn pulse" data-act="start" data-arg="' + ck + '">▶ ' + (ck ? L('CONTINUE · room ', 'DEVAM · oda ') + (ck + 1) : L('START', 'BAŞLA')) + '</button>' +
          (ck ? '<button class="btn small gray" data-act="start" data-arg="0">↺ ' + L('Start from room 1', 'Baştan başla') + '</button>' : '') : '');
    } else if (tab === 'gear') {
      const st = heroStats(), mc = mergeCount();
      h = '<div class="gearp"><div class="slots">' + SLOTS.map(s => { const it = itemById(G.eq[s]); return '<div class="slot"><small>' + slotName(s) + '</small>' + (it ? tile(it, 'item') : '<button class="itile empty"><span class="ii">' + slotIcon(s) + '</span></button>') + '</div>'; }).join('') + '</div>' +
        '<div class="stats"><span>⚔️ ' + st.atk + '</span><span>❤️ ' + st.hp + '</span><span>⚡ ' + st.atkSpd.toFixed(2) + '/s</span><span>💥 ' + Math.round(st.crit * 100) + '%</span></div>' +
        '<div class="scr">' + SLOTS.map(s => '📜 ' + slotName(s) + ' <b>' + G.scrolls[s] + '</b>').join(' · ') + '</div>' +
        '<div class="sect bagh"><h2>' + L('Bag', 'Çanta') + '</h2>' + (mc ? '<button class="btn small gold mergeb" data-act="mergeAll">⭐ ' + L('Merge', 'Birleştir') + '<i>' + mc + '</i></button>' : '') + '</div>' +
        '<div class="bag">' +
        bagStacks().map(g => tile(g[0], 'item', g.length)).join('') + '</div>' +
        '<p class="tip">' + L('3 identical items (same type and rarity) merge into the next rarity.', 'Aynı tür ve nadirlikte 3 eşya birleşip bir üst nadirliğe çıkar.') + '</p></div>';
    } else if (tab === 'heroes') {
      const ks = Object.keys(HEROES), k = viewHero, hh = HEROES[k], own = G.heroes.includes(k), on = G.hero === k, sk = shownSkin(k);
      h = '<div class="hsel' + (own ? '' : ' locked') + '">' +
        '<button class="carr" data-act="browse" data-arg="-1">◀</button>' +
        '<div class="hbody"><span class="hcls ' + hh.cls + '">' + (hh.cls === 'mage' ? L('MAGE', 'BÜYÜCÜ') : L('ARCHER', 'OKÇU')) + '</span>' +
        '<b class="hname">' + (own ? '' : '🔒 ') + hh.name + '</b><small>' + hh.passive() + '</small>' +
        '<div class="hdots">' + ks.map(x => '<i class="' + (x === k ? 'on' : '') + (G.heroes.includes(x) ? '' : ' lk') + '"></i>').join('') + '</div></div>' +
        '<button class="carr" data-act="browse" data-arg="1">▶</button></div>' +
        skinRow(k, own) +
        (own && sk && !hasOutfit(k, sk.id) ? (sk.ads ? '<button class="btn big purple" data-act="skinAd" data-arg="' + sk.id + '"><span class="ad-ico">AD</span>' + L('Watch ad', 'Reklam izle') + ' · ' + (G.skinAds[k + '.' + sk.id] || 0) + '/' + sk.ads + '</button>'
            : '<button class="btn big ' + (Save.data.coins >= sk.cost ? 'gold' : 'gray') + '" data-act="skinBuy" data-arg="' + sk.id + '">' + L('Get outfit', 'Kıyafeti al') + ' · ⭐ ' + sk.cost + '</button>')
          : on ? '<button class="btn gray" disabled>✓ ' + L('Selected', 'Seçili') + '</button>'
          : own ? '<button class="btn green big" data-act="hero" data-arg="' + k + '">' + L('Select', 'Seç') + '</button>'
          : '<button class="btn big ' + (Save.data.coins >= hh.cost ? 'gold' : 'gray') + '" data-act="heroBuy" data-arg="' + k + '">' + L('Unlock', 'Aç') + ' · ⭐ ' + hh.cost + '</button>') +
        '<p class="tip">' + L('Swipe the hero to browse', 'Karakterleri görmek için kaydır') + '</p>';
    } else if (tab === 'talent') {
      h = '<div class="talents">' + Object.keys(TALENTS).map(k => {
        const t = TALENTS[k], level = G.talents[k], c = talentCost(k), can = G.gold >= c, max = talMax(k);
        return '<div class="tal"><span>' + t.icon + '</span><b>' + t.name() + '</b><em>' + L('Lv.', 'Sv.') + level + '/' + max + '</em>' +
          '<small>' + t.desc(level) + '</small>' + (level < max ? '<small>' + L('Next: ', 'Sonraki: ') + t.desc(level + 1) + '</small>' : '') +
          (level >= max ? '<button class="btn small gray" disabled>' + L('MAX', 'MAKS') + '</button></div>' :
          '<button class="btn small ' + (can ? 'green' : 'gray') + '" data-act="talent" data-arg="' + k + '"' + (can ? '' : ' disabled') + '>' +
          L('Upgrade', 'Geliştir') + ' · 💰 ' + goldFmt(c) + '</button></div>');
      }).join('') + '</div>';
    } else if (tab === 'shop') {
      const free = Date.now() >= (G.chest.free || 0);
      h = '<div class="chests">' +
        '<div class="chest ' + (free ? 'ready' : '') + '">' + (window.Art ? Art.chest('gold') : '📦') + '<b>' + L('Golden Chest', 'Altın Sandık') + '</b><small>' + L('Common – Epic gear', 'Sıradan – Epik ekipman') + '</small>' +
          (free ? '<button class="btn green" data-act="chest" data-arg="free"><span class="ad-ico">AD</span>' + L('Free', 'Bedava') + ' · ' + (G.chest.ads || 0) + '/2</button>' : '<button class="btn ' + (Save.data.coins >= 60 ? 'purple' : 'gray') + '" data-act="chest" data-arg="gold">⭐ 60</button>') + '</div>' +
        '<div class="chest royal">' + (window.Art ? Art.chest('royal') : '🎁') + '<b>' + L('Obsidian Chest', 'Obsidyen Sandık') + '</b><small>' + L('Rare+ gear · Epic guaranteed in ', 'Nadir+ ekipman · Epik garanti: ') + (10 - G.chest.pity) + '</small>' +
          '<button class="btn ' + (Save.data.coins >= 300 ? 'purple' : 'gray') + '" data-act="chest" data-arg="obs">⭐ 300</button></div></div>' +
        '<button class="btn ' + (Save.data.coins >= 2700 ? 'gold' : 'gray') + '" data-act="chest" data-arg="obs10">🎁 ' + L('10x Obsidian · ⭐ 2700 (save 10%)', '10x Obsidyen · ⭐ 2700 (%10 indirim)') + '</button>' +
        '<div class="sect"><h2>' + L('Supplies', 'Malzeme') + '</h2></div>' +
        '<div class="upg"><div><b>🏃 ' + L('Run & Gun (permanent)', 'Koşarken Atış (kalıcı)') + '</b><small>' + L('Shoot while walking, at 45% speed (the skill stacks on top)', 'Yürürken de %45 hızla ateş et (yetenekle üst üste eklenir)') + '</small></div>' + (G.perkMove ? '<span class="chip">✓ ' + L('Owned', 'Sahipsin') + '</span>' : '<button class="btn small ' + (Save.data.coins >= 400 ? 'gold' : 'gray') + '" data-act="perkMove">⭐ 400</button>') + '</div>' +
        '<div class="upg"><div><b>📜 ' + L('Scroll bundle', 'Parşömen paketi') + '</b><small>' + L('+3 scrolls for every slot', 'Her yuva için +3 parşömen') + '</small></div><button class="btn small ' + (Save.data.coins >= 120 ? 'gold' : 'gray') + '" data-act="scrollPack">⭐ 120</button></div>' +
        Kit.shop('arrow', G, renderMenu, { packName: L('Hero Pack', 'Kahraman Paketi'), packExtra: L('📜 +10 scrolls for every slot', '📜 Her yuvaya +10 parşömen') }) +
        '<p class="note">' + goldOdds() + '</p>';
    }
    $('apanel').innerHTML = h;
    $('apanel').className = 'apanel t-' + tab;
    // Keep the previewed outfit card in view in the sideways strip.
    const row = document.querySelector && document.querySelector('.skrow'), on = row && row.querySelector('.sktile.on');
    if (on) row.scrollLeft = on.offsetLeft - row.offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
  }
  // Golden Chest odds shown in the shop; they follow rollRarity() for the current chapter.
  function goldOdds() {
    const bump = Math.min(0.15, 0.02 * (G.chapter - 1)), ep = 0.015 + bump / 4, ra = 0.1 + bump - ep, gr = 0.3, co = 1 - 0.4 - bump;
    const f = x => (Math.round(x * 1000) / 10).toLocaleString(LANG);
    return L('Odds — Golden: Common ' + f(co) + '%, Great ' + f(gr) + '%, Rare ' + f(ra) + '%, Epic ' + f(ep) + '% (better in later chapters) · Obsidian: Rare 82%, Epic 16%, Legendary 2% · Epic or better guaranteed within 10 Obsidian opens',
      'Olasılıklar — Altın: Sıradan %' + f(co) + ', Güzel %' + f(gr) + ', Nadir %' + f(ra) + ', Epik %' + f(ep) + ' (ilerleyen bölümlerde artar) · Obsidyen: Nadir %82, Epik %16, Efsanevi %2 · 10 Obsidyen açılışında en az bir Epik garanti');
  }
  function rollRarity(ch, obs) {
    const x = Math.random();
    if (obs) return x < 0.02 ? 4 : x < 0.18 ? 3 : 2;
    const bump = Math.min(0.15, 0.02 * (ch - 1));
    return x < 0.015 + bump / 4 ? 3 : x < 0.1 + bump ? 2 : x < 0.4 + bump ? 1 : 0;
  }
  function openChests(kind, n) {
    const out = [];
    for (let k = 0; k < n; k++) {
      let r = rollRarity(G.chapter, kind !== 'gold');
      if (kind !== 'gold') { G.chest.pity++; if (r >= 3) G.chest.pity = 0; else if (G.chest.pity >= 10) { r = 3; G.chest.pity = 0; } }
      const b = randBase(), it = newItem(b, r);
      G.inv.push(it); out.push(it);
    }
    Save.save(); Ads.track('chest_open', { game: 'arrow', kind, n });
    reward({ title: kind === 'gold' ? L('Golden Chest', 'Altın Sandık') : L('Obsidian Chest', 'Obsidyen Sandık'), chest: kind === 'gold' ? 'gold' : 'royal',
      items: out.map(it => ({ icon: icon(it.b), label: RAR[it.r].name(), sub: BASES[it.b].name(), rarity: RAR[it.r].id })) });
  }
  // Purchase feedback: the shared reveal animation (ortak/fx.js), or a plain toast without it.
  function reward(o) {
    if (window.Fx) Fx.reveal(o).then(() => renderMenu());
    else { UI.toast(o.items.map(x => x.label).join(' · ')); renderMenu(); }
  }
  function itemSheet(id) {
    const it = itemById(id); if (!it) return;
    const b = BASES[it.b], r = RAR[it.r], st = itemStats(it), c = upCost(it), on = G.eq[b.slot] === it.id;
    const twins = G.inv.filter(x => x.b === it.b && x.r === it.r && x.id !== it.id && !wornByAny(x.id));
    const canMerge = it.r < RAR.length - 1 && twins.length >= 2;
    overlay('<div class="ihead r-' + r.id + '" style="--rc:' + r.c + '"><span class="ii">' + icon(it.b) + '</span><div><small>' + r.name() + ' · ' + slotName(b.slot) + '</small><b>' + b.name() + '</b><em>' + L('Lv.', 'Sv.') + it.l + '/' + r.max + '</em></div></div>' +
      '<div class="istats">' + Object.keys(st).map(k => '<span>' + STAT_NAMES[k]() + ' <b>' + (BASES[it.b].pc[k] != null ? (st[k] > 0 ? '+' : '') + L(Math.round(st[k] * 100) + '%', '%' + Math.round(st[k] * 100)) : '+' + st[k]) + '</b></span>').join('') + '</div>' +
      (b.cls ? '<p class="tip">' + (b.cls === 'mage' ? L('🔮 Mage gear', '🔮 Büyücü eşyası') : L('🏹 Archer gear', '🏹 Okçu eşyası')) + '</p>' : '') +
      '<div class="isrow">' + (on ? '<button class="btn gray" disabled>✓ ' + L('Equipped', 'Kuşanıldı') + '</button>' : fits(it) ? '<button class="btn green" data-act="equip" data-arg="' + it.id + '">' + L('Equip', 'Kuşan') + '</button>' : '<button class="btn gray" disabled>' + (b.cls === 'mage' ? L('Mage only', 'Sadece büyücü') : L('Archer only', 'Sadece okçu')) + '</button>') +
      (it.l < r.max ? '<button class="btn ' + (G.gold >= c.gold && G.scrolls[b.slot] >= c.scrolls ? 'gold' : 'gray') + ' upb" data-act="upItem" data-arg="' + it.id + '">⬆ 💰' + goldFmt(c.gold) + ' 📜' + c.scrolls + '</button>' : '<button class="btn gray" disabled>' + L('MAX', 'MAKS') + '</button>') + '</div>' +
      (it.r < RAR.length - 1 ? '<button class="btn ' + (canMerge ? 'purple' : 'gray') + '" data-act="merge" data-arg="' + it.id + '">🔮 ' + L('Merge 3 → ', '3 birleştir → ') + RAR[it.r + 1].name() + ' (' + (twins.length + 1) + '/3)</button>' : '') +
      (on || wornByAny(it.id) ? '' : '<button class="btn small gray" data-act="sell" data-arg="' + it.id + '">' + L('Sell +', 'Sat +') + goldFmt(sellValue(it)) + ' 💰</button>') +
      '<button class="btn gray" data-act="closeov">' + L('Close', 'Kapat') + '</button>');
  }
  const sellValue = it => Math.round(40 * (1 + it.r * 1.5) * it.l);

  // ---------- Actions ----------
  const need = c => { if (Save.data.coins >= c) return true; UI.toast(L('Not enough ⭐ stars', 'Yetersiz ⭐ yıldız')); return false; };
  const actions = {
    start(arg) {
      document.body.classList.remove('inmenu'); Ads.banner(false);
      // From a checkpoint the hero starts with the skill picks a run would have had by then.
      const from = Math.max(0, Math.min(+arg || 0, (G.ckpt || {})[selChapter] || 0));
      const go = () => { newRun(selChapter, from); mode = 'play'; paused = false; Ads.track('level_start', { game: 'arrow', level: selChapter });
        if (from) { S.pending = Math.min(10, Math.round(from / 4)); S.p.lv = 1 + S.pending; levelUpScreen(); } };
      if (chunksReady(selChapter)) go();
      else { UI.toast(L('Loading…', 'Yükleniyor…')); loadAll(selChapter).then(go); }
    },
    chap(d) { selChapter = clamp(selChapter + +d, 1, G.chapter); menuScene(); renderMenu(); },
    skill(k) {
      S.skills[k] = sk(k) + 1; S.pending--;
      if (k === 'hp' || k === 'hpS') { const add = S.p.max * (k === 'hp' ? 0.2 : 0.08); S.p.max += add; S.p.hp = Math.min(S.p.max, S.p.hp + add); }
      if (k === 'potion') { S.p.hp = Math.min(S.p.max, S.p.hp + S.p.max * 0.3); fx('heal', S.p.x, S.p.z, '#ff8ab0', 1); }
      if (k === 'hp' || k === 'hpS') fx('heal', S.p.x, S.p.z, '#ffcf5a', 1);
      fx('skill', S.p.x, S.p.z, k); // every skill shows its own effect when picked (render3d.js SKILL_FX)
      const heal = 0.02 * tal('heal') * S.p.max; if (heal) S.p.hp = Math.min(S.p.max, S.p.hp + heal);
      closeOverlay(); mode = 'play';
      if (S.pending) levelUpScreen();
    },
    async reroll() { if (!(await Ads.rewarded('arrow_reroll'))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; } S.rerolls--; levelUpScreen(); },
    angel(k) {
      if (mode !== 'pick') return; // a second tap after the choice
      if (k === 'heal' || !skillChoices().length) { S.p.hp = Math.min(S.p.max, S.p.hp + S.p.max * (skillChoices().length ? 0.4 : 1)); closeOverlay(); mode = 'play'; }
      else { closeOverlay(); S.pending++; levelUpScreen(); }
    },
    async revive(how) {
      if (how === 'ad') { if (!(await Ads.rewarded('arrow_revive'))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; } }
      else if (!need(20) || !Save.spend(20)) return;
      S.revived = true; S.p.dead = false; S.p.hp = S.p.max; S.p.inv = 2; S.foes = [];
      closeOverlay(); mode = 'play';
    },
    giveup() { runOver(); },
    async double() {
      if (!pendingDouble) return;
      if (!(await Ads.rewarded('arrow_double'))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      if (++doubleSeen < doubleNeed) {
        UI.toast(L('Ad ' + doubleSeen + '/' + doubleNeed + ' · one more!', 'Reklam ' + doubleSeen + '/' + doubleNeed + ' · bir tane daha!'));
        const b = document.querySelector('[data-act=double]'); if (b) b.innerHTML = '<span class="ad-ico">AD</span>' + L('2x GOLD', '2x ALTIN') + ' · 📺 ' + doubleSeen + '/' + doubleNeed;
        return;
      }
      G.gold += pendingDouble; UI.toast('💰 +' + goldFmt(pendingDouble)); pendingDouble = 0; Save.save(); showMenu();
    },
    async tomenu() { pendingDouble = 0; await Ads.levelEnd(G.chapter + G.runs); showMenu(); },
    tab(t) { tab = t; viewSkin = null; renderMenu(); },
    item(id) { itemSheet(+id); },
    equip(id) { const it = itemById(+id); if (!fits(it)) { UI.toast(BASES[it.b].cls === 'mage' ? L('Only mages can use this', 'Bunu sadece büyücüler kullanabilir') : L('Only archers can use this', 'Bunu sadece okçular kullanabilir')); return; } G.eq[BASES[it.b].slot] = it.id; Save.save(); Sfx.play('click'); closeOverlay(); renderMenu(); },
    upItem(id) {
      const it = itemById(+id), c = upCost(it), s = BASES[it.b].slot;
      if (it.l >= RAR[it.r].max) return;
      if (G.gold < c.gold || G.scrolls[s] < c.scrolls) { UI.toast(L('Not enough gold or scrolls', 'Yetersiz altın ya da parşömen')); return; }
      G.gold -= c.gold; G.scrolls[s] -= c.scrolls; it.l++; Save.save(); Sfx.play('coin'); Ads.track('gear_upgrade', { game: 'arrow' }); itemSheet(it.id); renderMenu();
    },
    merge(id) {
      const it = itemById(+id), twins = G.inv.filter(x => x.b === it.b && x.r === it.r && x.id !== it.id && !wornByAny(x.id));
      if (twins.length < 2 || it.r >= RAR.length - 1) { UI.toast(L('You need 3 identical items', '3 aynı eşya gerekli')); return; }
      G.inv = G.inv.filter(x => x !== twins[0] && x !== twins[1]);
      it.r++; Save.save(); closeOverlay();
      reward({ title: L('Merged!', 'Birleşti!'), items: [{ icon: icon(it.b), label: RAR[it.r].name(), sub: BASES[it.b].name(), rarity: RAR[it.r].id }] });
    },
    // Merge every possible triple in the bag at once (repeats, so three fresh merges can merge again). Worn items
    // are never used up; when a worn one is part of a triple it is the one that gets upgraded.
    mergeAll() {
      const { ups, n } = mergeEverything();
      // Summary shows only what you end up with (an item merged again later is shown at its final rarity).
      const made = {}; for (const it of ups) if (G.inv.includes(it)) { const k = it.b + ':' + it.r; made[k] = (made[k] || 0) + 1; }
      const ks = Object.keys(made).sort((a, b) => b.split(':')[1] - a.split(':')[1]); if (!n) { UI.toast(L('Nothing to merge', 'Birleştirilecek eşya yok')); return; }
      Save.save();
      reward({ title: L('Merged ', 'Birleşti: ') + n + '×', items: ks.slice(0, 9).map(k => { const [b, r] = k.split(':'); return { icon: icon(b), label: RAR[+r].name() + (made[k] > 1 ? ' ×' + made[k] : ''), sub: BASES[b].name(), rarity: RAR[+r].id }; }) });
    },
    sell(id) { const it = itemById(+id); G.gold += sellValue(it); G.inv = G.inv.filter(x => x !== it); Save.save(); closeOverlay(); renderMenu(); },
    browse(d) { browseHero(+d); },
    skinView(id) {
      id = id === '-' ? '' : id; const k = viewHero; viewSkin = id;
      // Owned outfit on an owned hero: put it on straight away.
      if (G.heroes.includes(k) && hasOutfit(k, id) && (G.outfit[k] || '') !== id) { G.outfit[k] = id; Save.save(); renderMenu(); if (id && R3 && R3.celebrate) R3.celebrate(); return; }
      renderMenu();
    },
    skinBuy(id) {
      const k = viewHero, sk = ArrowSkins.find(k, id); if (!sk || sk.ads || hasOutfit(k, id) || !G.heroes.includes(k) || !need(sk.cost)) return;
      Save.spend(sk.cost); unlockOutfit(k, sk);
    },
    // Ad outfits: every rewarded ad adds one to the counter; the last one unlocks it.
    async skinAd(id) {
      const k = viewHero, sk = ArrowSkins.find(k, id), key = k + '.' + id; if (!sk || !sk.ads || hasOutfit(k, id) || !G.heroes.includes(k)) return;
      if (!(await Ads.rewarded('arrow_skin'))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      G.skinAds[key] = (G.skinAds[key] || 0) + 1;
      if (G.skinAds[key] >= sk.ads) unlockOutfit(k, sk); else { Save.save(); renderMenu(); UI.toast(sk.name() + ' · ' + G.skinAds[key] + '/' + sk.ads); }
    },
    hero(k) { G.hero = k; useLoadout(k); Save.save(); menuScene(); renderMenu(); },
    heroBuy(k) {
      const c = HEROES[k].cost; if (!need(c)) return; Save.spend(c); G.heroes.push(k); G.hero = k; Save.save(); actions.hero(k);
      reward({ title: HEROES[k].name + L(' joined!', ' katıldı!'), items: [{ icon: HEROES[k].icon, label: HEROES[k].name, sub: HEROES[k].passive(), rarity: 'epic' }] });
    },
    talent(k) {
      if (!Object.prototype.hasOwnProperty.call(TALENTS, k) || G.talents[k] >= talMax(k)) return;
      const c = talentCost(k);
      if (G.gold < c) { UI.toast(L('Not enough gold', 'Yetersiz altın')); return; }
      G.gold -= c;
      G.talents[k]++; Save.save(); Sfx.play('coin');
      if (window.Fx) { const a = Fx.at(); Fx.burst(a.x, a.y, 'rare', 24); }
      UI.toast(TALENTS[k].icon + ' ' + TALENTS[k].name() + L(' Lv.', ' Sv.') + G.talents[k]); renderMenu();
    },
    async chest(kind) {
      // Free golden chest: 2 short ads (progress kept), then it refills in 8 hours.
      if (kind === 'free') {
        if (!(await Ads.short('arrow_chest'))) { UI.toast(L('No ad right now, try again soon', 'Şu an reklam yok, birazdan tekrar dene')); return; }
        G.chest.ads = (G.chest.ads || 0) + 1; Save.save();
        if (G.chest.ads < 2) { UI.toast(L('Ad 1/2 · one more!', 'Reklam 1/2 · bir tane daha!')); renderMenu(); return; }
        G.chest.ads = 0; G.chest.free = Date.now() + 8 * 3600e3; return openChests('gold', 1);
      }
      const c = kind === 'gold' ? 60 : kind === 'obs' ? 300 : 2700;
      if (!need(c)) return;
      Save.spend(c); openChests(kind === 'gold' ? 'gold' : 'obs', kind === 'obs10' ? 10 : 1);
    },
    perkMove() {
      if (G.perkMove || !need(400)) return; Save.spend(400); G.perkMove = 1; Save.save();
      reward({ title: L('Run & Gun unlocked!', 'Koşarken Atış açıldı!'), items: [{ icon: skillIcon('move'), label: L('Run & Gun', 'Koşarken Atış'), sub: L('permanent', 'kalıcı'), rarity: 'legendary' }] });
    },
    scrollPack() {
      if (!need(120)) return; Save.spend(120); SLOTS.forEach(s => { G.scrolls[s] += 3; }); Save.save(); Sfx.play('coin');
      reward({ title: L('Scroll bundle', 'Parşömen paketi'), items: SLOTS.map(s => ({ icon: slotIcon(s), label: '+3 📜', sub: slotName(s), rarity: 'rare' })) });
    },
    closeov() { closeOverlay(); renderMenu(); },
    home() { UI.goHome('../index.html'); },
    resume() { paused = false; closeOverlay(); mode = 'play'; },
    quit() { runOver(); },
  };
  const onAct = e => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled && actions[b.dataset.act]) { Sfx.play('click'); actions[b.dataset.act](b.dataset.arg); }
  };
  $('ov').addEventListener('click', onAct);
  $('menu').addEventListener('click', onAct);
  $('soundBtn').textContent = Sfx.icon();
  $('soundBtn').onclick = () => { UI.toast(Sfx.toggle()); $('soundBtn').textContent = Sfx.icon(); };
  $('pauseBtn').onclick = () => {
    if (mode !== 'play') return;
    paused = true; mode = 'pause';
    overlay('<p class="t-lg">' + L('Paused', 'Duraklatıldı') + '</p><div class="skillsnow">' + Object.keys(S.skills).map(k => '<span class="sk1">' + skillIcon(k) + (S.skills[k] > 1 ? '<i>×' + S.skills[k] + '</i>' : '') + '</span>').join('') + '</div>' +
      '<button class="btn green big" data-act="resume">' + L('▶ Resume', '▶ Devam') + '</button><button class="btn gray" data-act="quit">' + L('End run', 'Koşuyu bitir') + '</button>');
  };
  UI.onBack(() => {
    if (mode === 'play') { $('pauseBtn').onclick(); return; }
    if (mode === 'menu') { if (!$('ov').classList.contains('hidden')) { closeOverlay(); return; } UI.goHome('../index.html'); return; }
    if (mode === 'pause') actions.resume();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') $('pauseBtn').onclick(); });
  document.addEventListener('stars', () => renderMenu());

  // ---------- HUD + overlay drawing ----------
  // Skill bar: every skill taken this run, with its level, under the XP bar.
  let barKey = '';
  function skillBar() {
    const ks = Object.keys(S.skills).filter(k => S.skills[k] > 0), key = ks.map(k => k + S.skills[k]).join();
    if (key === barKey) return; barKey = key;
    $('skillbar').innerHTML = ks.map(k => '<span class="sb' + (sk(k) >= SKILLS[k].max ? ' max' : '') + '" data-sk="' + k + '">' + skillIcon(k) + '<em>' + (sk(k) >= SKILLS[k].max ? L('MAX', 'MAX') : sk(k)) + '</em></span>').join('');
  }
  // Tap a skill on the bar: what it does and its level (the run keeps going).
  function skillTip(el, k) {
    const s = SKILLS[k]; if (!s || !window.Kit) return;
    Kit.tip(el, '<b>' + s.name() + '</b> · ' + L('Lv.', 'Sv.') + sk(k) + '/' + s.max + '<small>' + s.desc() + (sk(k) >= s.max ? L(' · maxed', ' · en üst seviye') : L(' · each level adds more', ' · her seviye artırır')) + '</small>', 2800);
  }
  $('skillbar').addEventListener('pointerdown', e => { const b = e.target.closest('[data-sk]'); if (b) { e.stopPropagation(); skillTip(b, b.dataset.sk); } });
  const hudCache = {};
  function hudStats() {
    const p = S.p, need = 30 + 22 * (p.lv - 1);
    skillBar();
    const w = Math.round(p.xp / need * 100) + '%', lv = L('Lv.', 'Sv.') + p.lv, gd = goldFmt(S.gold);
    if (hudCache.w !== w) { hudCache.w = w; $('xpfill').style.width = w; }
    if (hudCache.lv !== lv) { hudCache.lv = lv; $('xplv').textContent = lv; }
    if (hudCache.gd !== gd) { hudCache.gd = gd; $('rgold').textContent = gd; }
  }
  // Outlined labels (damage numbers, HP, boss name) are rendered once per text/size/colour into a small canvas and
  // then blitted: strokeText + fillText for every label every frame was one of the top costs on the phone.
  const textCache = new Map();
  function textImg(t, size, fill, stroke) {
    const k = t + '|' + size + '|' + fill + '|' + stroke;
    let c = textCache.get(k);
    if (c) { textCache.delete(k); textCache.set(k, c); return c; } // keep recently used ones at the end (LRU)
    const font = '800 ' + size + 'px ' + FONT, lw = Math.max(3, size * 0.25), s = dpr;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(t).width + lw * 2 + 4), h = Math.ceil(size * 1.5 + lw * 2);
    c = document.createElement('canvas'); c.width = Math.ceil(w * s); c.height = Math.ceil(h * s); c.w = w; c.h = h;
    const g = c.getContext('2d'); g.scale(s, s);
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = lw;
    g.strokeStyle = stroke; g.strokeText(t, w / 2, h / 2); g.fillStyle = fill; g.fillText(t, w / 2, h / 2);
    textCache.set(k, c);
    if (textCache.size > 160) textCache.delete(textCache.keys().next().value);
    return c;
  }
  function text(t, x, y, size, fill, stroke) {
    // Sizes snap to whole pixels (the pop-in animation would otherwise make a new image every frame).
    const c = textImg(t, Math.max(6, Math.round(size)), fill || '#fff', stroke || '#1b1464');
    ctx.drawImage(c, x - c.w / 2, y - c.h / 2, c.w, c.h);
  }
  function bar(x, y, w, h, f, c) {
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = c; ctx.fillRect(x - w / 2, y, w * clamp(f, 0, 1), h);
  }
  function drawOverlay(W2S) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!S || SHOT) return;
    const p = S.p;
    // The edges flash red when the hero is hit: a CSS layer (#hurt) whose opacity follows hurtT. The dark lens
    // vignette is body::after. Both used to be a full-screen canvas gradient painted every frame.
    const ha = S.hurtT > 0 ? Math.min(1, 0.45 + S.hurtT * 1.4).toFixed(2) : '0';
    if (hudCache.hurt !== ha) { hudCache.hurt = ha; $('hurt').style.opacity = ha; }
    for (const e of S.enemies) {
      if (e.hp <= 0 || e.state === 'rise' || e.boss) continue;
      const q = W2S(e.x, e.z, 2.9 * e.scale * (e.scale > 2 ? 1.2 : 1.5));
      bar(q.x, q.y, 34, 4, e.hp / e.max, '#ff4d5a');
      // Status icons over the bar (Soul Knight / Archero): burning, frozen, shocked, poisoned.
      const ic = (e.burn > 0 ? '🔥' : '') + (e.slow > 0 ? '❄️' : '') + (e.shock > 0 ? '⚡' : '') + (e.psn > 0 ? '☠️' : '');
      if (ic) { const c = textImg(ic, 11, '#fff', 'rgba(0,0,0,.35)'); ctx.drawImage(c, q.x + 19, q.y + 2 - c.h / 2, c.w, c.h); }
    }
    const q = W2S(p.x, p.z, 4.3);
    bar(q.x, q.y, 46, 6, p.hp / p.max, '#3be07a');
    text(String(Math.ceil(p.hp)), q.x, q.y - 8, 11, '#fff', '#0b5e29');
    const boss = S.enemies.find(e => e.boss && e.hp > 0);
    if (boss && !S.intro) { const y = UI.safeArea().hudBottom + 30; bar(innerWidth / 2, y, innerWidth * 0.8, 12, boss.hp / boss.max, '#c81d3a'); text('👑 ' + (boss.bossName || ''), innerWidth / 2, y - 10, 13); }
    // Damage numbers pop in big, settle, drift a little sideways and float up (crits pop hardest).
    for (const t of S.texts) { const age = (t.max || 0.9) - t.life, w = W2S(t.x + (t.dx || 0) * age, t.z, 4.6 + age * 3), pop = age < 0.12 ? 1 + (1 - age / 0.12) * (t.big ? 0.9 : 0.5) : 1;
      ctx.globalAlpha = Math.min(1, t.life * 2.5); text(t.txt, w.x, w.y, (t.big ? 26 : 16) * pop, t.c, t.big ? '#5a0a00' : '#1a0a0a'); }
    ctx.globalAlpha = 1;
    if (S.intro) {
      const I = S.intro, a = clamp(Math.min(I.t / 0.35, (I.dur - I.t) / 0.35), 0, 1), bh = innerHeight * 0.1 * a, W = innerWidth;
      ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, innerHeight - bh, W, bh);
      const s = clamp((I.t - 0.4) / 0.35, 0, 1), e = 1 - Math.pow(1 - s, 3), x = -W + e * W, y = innerHeight * 0.7;
      ctx.globalAlpha = a;
      const g = ctx.createLinearGradient(0, y - 36, 0, y + 36); g.addColorStop(0, '#7a0a14'); g.addColorStop(0.5, '#c81d3a'); g.addColorStop(1, '#5a0610');
      ctx.fillStyle = g; ctx.fillRect(x, y - 36, W, 72); ctx.fillStyle = '#ffd56a'; ctx.fillRect(x, y - 39, W, 3); ctx.fillRect(x, y + 36, W, 3);
      text(I.sub, W / 2 + x, y - 15, 14, '#ffd56a', '#2a0505'); text('👑 ' + I.name, W / 2 + x, y + 11, 30, '#ffffff', '#2a0505');
      ctx.globalAlpha = 1;
    }
    if (S.banner) { const b = S.banner, a = Math.min(1, b.life * 2); ctx.globalAlpha = a; text(b.txt, innerWidth / 2, innerHeight * 0.32, 28, '#ffe07a'); if (b.sub) text(b.sub, innerWidth / 2, innerHeight * 0.32 + 28, 14); ctx.globalAlpha = 1; }
    // The open door is off screen: an arrow at the top edge shows the way.
    if (S.door && !(S.angel && !S.angel.used) && mode === 'play') {
      const d = W2S(0, -RH + 1, 2), top = UI.safeArea().hudBottom + 34;
      if (d.y < top) { const y = top + Math.sin(S.t * 6) * 5; ctx.globalAlpha = 0.95; text('⬆', clamp(d.x, 40, innerWidth - 40), y, 34, '#7dffae', '#0b3a1e'); text(L('DOOR', 'KAPI'), clamp(d.x, 40, innerWidth - 40), y + 26, 13, '#7dffae', '#0b3a1e'); ctx.globalAlpha = 1; }
    }
    if (S.chapter === 1 && S.room === 1 && S.t < 7) { ctx.globalAlpha = 0.7 + Math.sin(S.t * 4) * 0.3; text(L('Move to dodge · stand still to shoot!', 'Kaçmak için hareket et · durunca ateş eder!'), innerWidth / 2, innerHeight * 0.75, 17); ctx.globalAlpha = 1; }
    if (joy) {
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(joy.sx, joy.sy, 55, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(joy.x, joy.y, 18, 0, 7); ctx.fill();
    }
  }
  // 2D fallback (tests / no WebGL): top-down circles.
  function draw2D() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#2a2420'; ctx.fillRect(0, 0, cvs.width, cvs.height);
    if (!S) return;
    const sc = Math.min(innerWidth / (RW * 2 + 2), innerHeight / (RH * 2 + 6)), ox = innerWidth / 2, oy = innerHeight / 2;
    const W2S = (x, z, h) => ({ x: ox + x * sc, y: oy + z * sc - (h || 0) * sc * 0.5 });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#5a5048'; ctx.fillRect(ox - RW * sc, oy - RH * sc, RW * 2 * sc, RH * 2 * sc);
    for (const o of S.props) { ctx.fillStyle = '#8a6a4a'; ctx.fillRect(ox + (o.x - o.r) * sc, oy + (o.z - o.r) * sc, o.r * 2 * sc, o.r * 2 * sc); }
    for (const e of S.enemies) { ctx.fillStyle = e.hp > 0 ? '#e8e0d0' : '#555'; ctx.beginPath(); ctx.arc(ox + e.x * sc, oy + e.z * sc, e.r * sc, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.arc(ox + S.p.x * sc, oy + S.p.z * sc, 0.9 * sc, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffe07a'; for (const s of S.shots) ctx.fillRect(ox + s.x * sc - 2, oy + s.z * sc - 2, 4, 4);
    ctx.fillStyle = '#c084fc'; for (const s of S.foes) ctx.fillRect(ox + s.x * sc - 3, oy + s.z * sc - 3, 6, 6);
    drawOverlay(W2S);
  }

  let last = performance.now();
  function loop(t) {
    requestAnimationFrame(loop);
    // Follow the screen (up to 120 Hz) while frames are cheap; if drawing a frame costs more than ~6 ms the phone
    // would heat up and throttle, so drop to 60 fps for the rest of the session.
    if (t - last < frameGap) return;
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (mode === 'play' && !paused) update(dt);
    const r0 = performance.now();
    if (R3) {
      // A full-screen chest reveal hides the scene: don't draw it (keeps the reveal animation smooth).
      if (window.Fx && Fx.open && mode !== 'play') return;
      // Result screen: the room behind it is frozen, so draw it a couple of times and then stop (smooth buttons/animations).
      if (mode === 'end') { if (endFrames++ > 2) return; } else endFrames = 0;
      if (mode === 'menu' && (bandN++ % 15 === 0)) {
        // Measured every 15 frames, not every frame: reading layout each frame stalls the menu animations.
        // The hero stands in the free band between the top bar and the menu panel (measured: ads and phones differ).
        const bar = document.querySelector('.mtop'), card = document.querySelector(tab === 'battle' ? '#apanel .chap' : '#apanel'), H = innerHeight;
        if (bar && card && bar.getBoundingClientRect) R3.band = { top: (bar.getBoundingClientRect().bottom + 8) / H, bot: (card.getBoundingClientRect().top - 4) / H };
      }
      // The menu only shows an idle hero: draw it at half rate so the DOM panels below stay smooth.
      if (mode === 'menu' && ((menuSkip = !menuSkip) || t < menuHold)) { /* skip this frame */ } else
      R3.render(S, mode === 'art' ? 0 : dt, mode === 'art' ? 'play' : mode);
      if (mode === 'play') { costAcc += performance.now() - r0; costN++; if (costN >= 120) { if (costAcc / costN > 6) frameGap = 15; costAcc = 0; costN = 0; } }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cvs.width, cvs.height);
      drawOverlay((x, z, h) => R3.project(x, z, h));
    } else draw2D();
  }
  // Hub hooks / previews: #play starts chapter 1, #demo lets a bot play a few rooms.
  const tabBtns = document.querySelectorAll ? document.querySelectorAll('.anav') : [];
  tabBtns.forEach(b => { b.onclick = () => { Sfx.play('click'); tab = b.dataset.tab; viewSkin = null; renderMenu(); }; });
  showMenu();
  if (/play|demo|art/.test(location.hash || '')) actions.start();
  if (/^#art/.test(location.hash || '') && R3) {
    // Staged key art for the hub card: hero mid-shot, skeletons charging, arrows in flight.
    S.props = [{ kind: 'barrels', x: -9, z: -6, r: 1.5, rot: 0.4 }, { kind: 'crates', x: 9, z: -9, r: 1.5, rot: 0 }]; S.spikes = [];
    R3.setRoom(S, chapterOf(1));
    S.enemies = [];
    const put = (kind, x, z, o) => { const e = spawn(kind, x, z, o); e.state = 'walk'; e.moving = true; e.anim = Math.random() * 4; e.face = Math.atan2(-4 - x, 6 - z); return e; };
    S.heroModel = 'ranger'; S.shotKind = 'bolt'; S.skills.fire = 1; S.gearLook = { aura: '#ffb12a', weapon: '#ffb12a', legendary: true };
    put('orcskull', 1.5, -3); put('greenblob', 6, -1); put('greenblob', -3, -6); put('archer', 5, -9); put('warrior', -6, -11);
    S.enemies[0].burn = 3;
    S.enemies[1].flash = 0.1; S.texts.push({ x: 6, z: -1, txt: '128', c: '#ff5a5a', life: 0.8, big: true });
    S.p.x = -4; S.p.z = 6; S.p.face = Math.atan2(1.5 + 4, -3 - 6); S.p.atkT = 0.2; S.p.moving = false;
    for (const t of [0.25, 0.5, 0.75]) { const a = S.p.face; S.shots.push({ x: S.p.x + Math.sin(a) * 12 * t, z: S.p.z + Math.cos(a) * 12 * t, vx: 0, vz: 0, a, life: 9, hit: [] }); }
    mode = 'art'; R3.artCam = true;
  }
  if (/demo/.test(location.hash || '')) { S.auto = true; const n = /art/.test(location.hash) ? 30 : 300; for (let i = 0; i < n; i++) if (mode === 'play') update(0.05); }
  Sfx.music(true);
  requestAnimationFrame(loop);
  // Test hooks: step(n) runs the simulation n x 50 ms, taking the first skill offered and the angel's heal.
  window.__arrow = { get S() { return S; }, R3, get mode() { return mode; }, actions, G, spawn, nextRoom: () => nextRoom(), win: () => chapterWin(), levelUp() { S.pending++; levelUpScreen(); },
    run(ch, from) { selChapter = ch; newRun(ch, from || 0); mode = 'play'; paused = false; S.dmgLog = {}; return S; },
    stats: () => heroStats(),
    step(n) { for (let i = 0; i < n; i++) { if (mode === 'pick') { if (pick && pick.length && S.pending) actions.skill(pick[0]); else actions.angel('heal'); } if (mode !== 'play') break; update(0.05); } } };
})();
