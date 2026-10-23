// Çağlar Savaşı — Age of War-like lane battle in portrait: your base at the bottom, the enemy on top.
// Earn gold + XP from kills, evolve through seven ages, build a turret, call the age's special attack.
(() => {
  'use strict';

  // One war runs from the Stone Age to the Future: every age you reach is a level (paid out on the spot); every
  // war starts again in the Stone Age (upgrades stay), destroying the enemy base wins the war.
  const G = Save.game('cag', { gold: null, level: 1, best: 0, fails: 0, wars: 0, war: { age: 0 }, skin: 'mavi', skins: ['mavi'], adSkin: 0, upgrades: { income: 0, wall: 0, drill: 0 } });
  // Each game has its own 💰 gold for upgrades; ⭐ stars (top right) are the scarce shared currency.
  if (G.gold == null) { G.gold = 400 + 60 * (G.level || 1); Save.save(); }
  // Army colours, bought with the shared star coins (or ads for the golden one).
  const SKINS = {
    mavi: { name: L('Blue', 'Mavi'), color: '#3b82f6', d: '#123a8a', l: '#9fd0ff', cost: 0 },
    yesil: { name: L('Green', 'Yeşil'), color: '#22c55e', d: '#0b5e29', l: '#b7ffcf', cost: 50 },
    kral: { name: L('Royal Gold', 'Kraliyet Altını'), color: '#ffcf3f', d: '#8a5a00', l: '#fff3b0', pack: true, rarity: 'legendary' },
    mor: { name: L('Purple', 'Mor'), color: '#a855f7', d: '#4b1a8a', l: '#e2c8ff', cost: 90 },
    altin: { name: L('Gold', 'Altın'), color: '#fbbf24', d: '#8a5a00', l: '#fff0b0', ads: 2 },
    turuncu: { name: L('Orange', 'Turuncu'), color: '#f97316', d: '#7a3000', l: '#ffd0a8', cost: 180 },
    turkuaz: { name: L('Turquoise', 'Turkuaz'), color: '#14b8a6', d: '#0a4f48', l: '#a8fff2', cost: 350 },
    siyah: { name: L('Shadow', 'Gölge'), color: '#374151', d: '#0b0f18', l: '#9ca3af', cost: 700 },
    pembe: { name: L('Pink', 'Pembe'), color: '#ec4899', d: '#7a1646', l: '#ffc2e0', cost: 250 },
    buz: { name: L('Ice', 'Buz'), color: '#38bdf8', d: '#0c4a6e', l: '#c8f0ff', cost: 450 },
  };
  let startGoldAd = false;
  const UPG = {
    income: { icon: '💰', name: L('Treasury', 'Hazine'), max: 10, val: l => L('+' + 15 * l + '% income', '+%' + 15 * l + ' gelir') },
    wall: { icon: '🧱', name: L('Castle Wall', 'Kale Duvarı'), max: 10, val: l => L('+' + 10 * l + '% base HP', '+%' + 10 * l + ' üs canı') },
    drill: { icon: '⚔️', name: L('Drill', 'Talim'), max: 10, val: l => L('+' + 6 * l + '% damage', '+%' + 6 * l + ' hasar') },
  };
  const upgCost = k => Math.round(100 * Math.pow(1.6, G.upgrades[k]));
  const upgDesc = k => { const u = UPG[k], l = G.upgrades[k]; return l >= u.max ? u.val(l) : u.val(l) + ' → ' + u.val(l + 1); };
  const ease = () => Math.min(0.3, 0.1 * (G.fails || 0));

  // ---------- Ages & units ----------
  // Seven ages. `look` picks the scenery/base family the renderers share (0 stone … 4 future).
  const AGES = [
    { name: L('Stone Age', 'Taş Devri'), look: 0, sky: ['#9fe0ff', '#dff6ff'], ground: '#7cc464', road: '#c9a46a', special: L('Meteor', 'Göktaşı'), sIcon: '☄️' },
    { name: L('Ancient Age', 'Antik Çağ'), look: 1, sky: ['#ffe1a8', '#fff6e0'], ground: '#a9b860', road: '#d8c49a', special: L('Fire Pots', 'Ateş Çömlekleri'), sIcon: '🔥' },
    { name: L('Middle Ages', 'Orta Çağ'), look: 1, sky: ['#a8c8ff', '#e6eeff'], ground: '#6aa84f', road: '#a7a29a', special: L('Arrow Rain', 'Ok Yağmuru'), sIcon: '🏹' },
    { name: L('Gunpowder Age', 'Barut Çağı'), look: 2, sky: ['#ffd9a8', '#fff1dc'], ground: '#b9a15a', road: '#b58a55', special: L('Cannon Fire', 'Top Ateşi'), sIcon: '💥' },
    { name: L('World War', 'Dünya Savaşı'), look: 3, sky: ['#b8b4a0', '#e8e2cc'], ground: '#8a8a5a', road: '#6e6450', special: L('Bombers', 'Bombardıman'), sIcon: '💣' },
    { name: L('Modern Age', 'Modern Çağ'), look: 3, sky: ['#9fb4c8', '#dde6ee'], ground: '#7d8a70', road: '#5b6168', special: L('Air Strike', 'Hava Saldırısı'), sIcon: '✈️' },
    { name: L('Future', 'Gelecek'), look: 4, sky: ['#1b1a4a', '#3a2f7a'], ground: '#23305e', road: '#2c2c54', special: L('Orbital Laser', 'Yörünge Lazeri'), sIcon: '⚡' },
  ];
  const LOOK = AGES.map(a => a.look);
  // Every unit fits its weapon: `shot` makes it ranged (projectile kind), otherwise it fights hand to hand.
  // range: how far it hits; splash: area of a heavy shot (damage falls off with distance).
  const UNITS = [
    [{ n: L('Caveman', 'Mağara Adamı') }, { n: L('Slinger', 'Sapancı'), shot: 'stone' }, { n: L('Dino Rider', 'Dino Binici') }],
    [{ n: L('Hoplite', 'Hoplit') }, { n: L('Javelin Thrower', 'Mızrak Atıcı'), shot: 'javelin' }, { n: L('Chariot', 'Savaş Arabası') }],
    [{ n: L('Swordsman', 'Kılıççı') }, { n: L('Crossbowman', 'Arbaletçi'), shot: 'bolt' }, { n: L('Knight', 'Şövalye') }],
    [{ n: L('Bayonet', 'Süngü Eri') }, { n: L('Musketeer', 'Tüfekçi'), shot: 'bullet' }, { n: L('Cannon', 'Top'), shot: 'ball', range: 150, splash: 26 }],
    [{ n: L('Flamethrower', 'Alev Makinesi'), shot: 'flame', range: 52 }, { n: L('Rifleman', 'Piyade'), shot: 'bullet' }, { n: L('Tank', 'Tank'), shot: 'shell', range: 140, splash: 30 }],
    [{ n: L('Shotgunner', 'Pompalı Asker'), shot: 'bullet', range: 56 }, { n: L('Sniper', 'Keskin Nişancı'), shot: 'bullet', range: 170 }, { n: L('Battle Tank', 'Muharebe Tankı'), shot: 'shell', range: 150, splash: 34 }],
    [{ n: L('Robot', 'Robot') }, { n: L('Laser Trooper', 'Lazer Robotu'), shot: 'laser' }, { n: L('Mech', 'Dev Mech'), shot: 'plasma', range: 150, splash: 36 }],
  ];
  const unitName = (age, type) => UNITS[age][type].n;
  const XP_TO = [600, 1400, 3300, 7800, 18400, 43000];
  // type: 0 front-line, 1 ranged, 2 heavy
  const BASE = [
    { cost: 15, hp: 55, dmg: 16, range: 20, rate: 1.0, speed: 46, build: 0.75 },
    { cost: 25, hp: 40, dmg: 12, range: 105, rate: 1.2, speed: 43, build: 1.05 },
    { cost: 100, hp: 290, dmg: 40, range: 24, rate: 1.3, speed: 32, build: 1.8 },
  ];
  // Seven ages grow a bit slower per age than the old five, so the Future ends about as strong as before ×1.2.
  const AGE_P = 1.85, COST_P = 2.1;
  const stat = (age, type) => {
    const b = BASE[type], u = UNITS[age][type], m = Math.pow(AGE_P, age);
    return { cost: Math.round(b.cost * Math.pow(COST_P, age)), hp: b.hp * m, dmg: b.dmg * m, range: u.range || b.range + age * 5, rate: b.rate, speed: b.speed, build: b.build / (1 + 0.22 * age), shot: u.shot || null, splash: u.splash || 0 };
  };
  // Base defenses: up to 3 slots, a rapid and a heavy kind per age; each fires its own projectile.
  const DEF = {
    rapid: { names: L('Sling Tower|Scorpion|Crossbow Tower|Light Cannon|Machine Gun|Heavy Machine Gun|Laser Turret', 'Sapan Kulesi|Akrep Kulesi|Arbalet Kulesi|Hafif Top|Makineli Tüfek|Ağır Makineli|Lazer Taret').split('|'),
      shot: ['stone', 'bolt', 'bolt', 'ball', 'bullet', 'bullet', 'laser'],
      cost: a => Math.round(110 * Math.pow(COST_P, a)), dmg: a => 9 * Math.pow(1.8, a), rate: 0.55, range: 210, splash: 0 },
    heavy: { names: L('Rock Thrower|Stone Catapult|Catapult|Cannon|Mortar|Rocket Launcher|Plasma Cannon', 'Taş Mancınığı|Taş Atar|Mancınık|Top|Havan|Roketatar|Plazma Topu').split('|'),
      shot: ['boulder', 'boulder', 'boulder', 'ball', 'shell', 'rocket', 'plasma'],
      cost: a => Math.round(220 * Math.pow(COST_P, a)), dmg: a => 34 * Math.pow(1.8, a), rate: 2.4, range: 250, splash: 45 },
  };
  // Units/defenses as pictures: the 3D renderer draws thumbnails of the real models; emoji only as a fallback.
  const FALLBACK = [['🪨', '🪃', '🦖'], ['🛡️', '🗡️', '🐎'], ['⚔️', '🏹', '🐎'], ['🗡️', '🎯', '💣'], ['🔥', '🎯', '🛡️'], ['🎯', '🔭', '🛡️'], ['🤖', '🔆', '🦾']];
  const unitIcon = (age, type, side) => { const u = R3 && R3.thumb && R3.thumb('u', age, type, TEAM[side || 0]); return u ? '<img class="uimg" src="' + u + '" alt="">' : FALLBACK[age][type]; };
  const defIcon = (kind, age) => { const u = R3 && R3.thumb && R3.thumb('d', age, kind, TEAM[0]); return u ? '<img class="dimg" src="' + u + '" alt="">' : kind === 'rapid' ? '🏹' : '💣'; };
  const SLOT_COST = [0, 350, 1200];
  const SLOT_X = [0, -62, 62];
  const specialDmg = age => 70 * Math.pow(AGE_P, age);
  const SPECIAL_CD = 50;
  const LANE = 470;                 // lane length (player base front = 0, enemy base front = LANE)
  const baseHp = (age, bonus) => 2500 * Math.pow(1.65, age) * (1 + bonus);
  // In-battle rewarded boosts (once per battle each): a reinforcement wave, and a short power mode.
  const REINF_AT = 60, POWER_LEN = 60;
  // No sudden death: a war ends only when a base falls. Long stalemates heat up instead: after 7 minutes every
  // unit (both sides) hits +15% harder per 30 s, so the stronger army breaks through.
  const RAGE_AT = 420, rage = () => 1 + Math.max(0, S.t - RAGE_AT) / 30 * 0.15;
  const income = sd => 3.5 * Math.pow(COST_P, sd.age) * sd.incMul;

  // ---------- Canvas ----------
  const W = 400, H = 720;
  const $ = id => document.getElementById(id);
  const cvs = $('c'), ctx = cvs.getContext('2d');
  const FONT = "'Baloo', system-ui, sans-serif";
  // 3D renderer when WebGL is available; otherwise (old devices, tests) the 2D renderer below is used.
  const R3 = window.War3D ? window.War3D.init($('c3d'), LANE) : null;
  if (!R3 && $('c3d') && $('c3d').style) $('c3d').style.display = 'none';
  let dpr = 1, sc = 1, ox = 0, oy = 0;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cvs.width = Math.round(innerWidth * dpr); cvs.height = Math.round(innerHeight * dpr);
    const sa = UI.safeArea(), panelH = ($('panel') && $('panel').offsetHeight) || 150;
    const avail = innerHeight - sa.hudBottom - panelH;
    sc = Math.min(innerWidth / W, avail / H);
    ox = (innerWidth - W * sc) / 2; oy = sa.hudBottom + (avail - H * sc) / 2;
    if (R3) R3.fit(sa.hudBottom + 30, innerHeight - panelH - 26);
    if ($('boosts')) $('boosts').style.bottom = (panelH + 26) + 'px';
  }
  addEventListener('resize', resize);
  resize(); setTimeout(resize, 400);
  if (document.fonts && document.fonts.load) document.fonts.load("800 14px 'Baloo'").catch(() => { });
  const Y = p => 588 - p;       // lane position -> canvas y (player base front at 588)

  let S = null;
  let mode = 'menu', paused = false, pendingReward = 0, pendingStars = 0, menuTab = 'up';

  // ---------- Level ----------
  // Difficulty follows the wars won (a war is ~5 levels), not the level number.
  const warLv = () => 1 + (G.wars || 0);
  function newLevel(lv) {
    const d = warLv(), e = ease(), a0 = 0, g0 = Math.pow(COST_P, a0);
    const mul = (0.9 + 0.045 * Math.min(d - 1, 30) + 0.004 * Math.max(0, d - 25)) * (1 - e);
    S = {
      lv, t: 0, a0, units: [], shots: [], fx: [], texts: [], shake: 0, banner: null,
      side: [
        { gold: (startGoldAd ? 500 : 250) * g0, xp: 0, age: a0, hp: 0, max: 0, queue: [], qt: 0, slots: [null, null, null], open: a0 >= 2 ? 2 : 1, scd: 12, incMul: 1 + 0.15 * G.upgrades.income, dmg: 1 + 0.06 * G.upgrades.drill, bonus: 0.1 * G.upgrades.wall },
        { gold: 250 * g0, xp: 0, age: a0, hp: 0, max: 0, queue: [], qt: 0, slots: [{ kind: 'rapid', age: a0, cd: 1 }, d >= 12 ? { kind: 'heavy', age: a0, cd: 2 } : null, null], open: 2, scd: 30, incMul: mul, dmg: 1 + Math.min(0.7, 0.03 * (d - 1)), hpMul: (1 + Math.min(0.7, 0.03 * (d - 1))) * (1 - e), bonus: (0.25 + 0.03 * Math.min(d - 1, 40)) * (1 - e), think: 1, forceAge: Math.max(80, 140 - d) },
      ],
      reviveUsed: false, reinfUsed: false, powerUsed: false, powerT: 0,
    };
    for (const sd of S.side) { sd.max = sd.hp = baseHp(a0, sd.bonus); }
    if (R3) R3.reset();
  }

  // ---------- Simulation ----------
  function spawn(side, type) {
    const sd = S.side[side], st = stat(sd.age, type);
    S.units.push({ side, type, age: sd.age, hp: st.hp * (sd.hpMul || 1), max: st.hp * (sd.hpMul || 1), dmg: st.dmg * sd.dmg, range: st.range, rate: st.rate, speed: st.speed, cost: st.cost, shot: st.shot, splash: st.splash,
      p: side === 0 ? 0 : LANE, cd: 0.3, lx: (Math.random() - 0.5) * 50, walk: Math.random() * 10, hit: 0 });
  }
  function enqueue(side, type) {
    const sd = S.side[side], st = stat(sd.age, type);
    if (sd.queue.length >= 5 || sd.gold < st.cost) return false;
    sd.gold -= st.cost;
    sd.queue.push({ type, t: st.build });
    return true;
  }
  function evolve(side) {
    const sd = S.side[side];
    if (sd.age >= AGES.length - 1 || sd.xp < XP_TO[sd.age]) return false;
    sd.xp -= XP_TO[sd.age]; sd.age++;
    const nm = baseHp(sd.age, sd.bonus);
    sd.hp += nm - sd.max; sd.max = nm;
    if (side === 0) { Sfx.play('boss'); S.fx.push({ kind: 'flash', t: 0.8 }); levelUp(sd.age); }
    return true;
  }
  function openSlot(side, i) {
    const sd = S.side[side];
    if (i !== sd.open || i > 2 || sd.gold < SLOT_COST[i]) return false;
    sd.gold -= SLOT_COST[i]; sd.open++;
    return true;
  }
  // Build a defense of the current age in slot i (also upgrades an older one; the old one is traded in at 50%).
  function buildDef(side, i, kind) {
    const sd = S.side[side], old = sd.slots[i];
    if (i >= sd.open || (old && old.kind === kind && old.age >= sd.age)) return false;
    const cost = DEF[kind].cost(sd.age) - (old ? Math.round(DEF[old.kind].cost(old.age) * 0.5) : 0);
    if (sd.gold < cost) return false;
    sd.gold -= Math.max(0, cost);
    sd.slots[i] = { kind, age: sd.age, cd: 0.5 };
    return true;
  }
  function sellDef(side, i) {
    const sd = S.side[side], d = sd.slots[i];
    if (!d) return false;
    sd.gold += Math.round(DEF[d.kind].cost(d.age) * 0.5);
    sd.slots[i] = null;
    return true;
  }
  function special(side) {
    const sd = S.side[side];
    if (sd.scd > 0) return false;
    sd.scd = SPECIAL_CD;
    const dmg = specialDmg(sd.age) * sd.dmg;
    const siege = side === 1 && S.siege, age = sd.age;
    // Where the enemy is thickest (the special aims there), else the middle of the field.
    const foes = S.units.filter(u => !u.dead && u.side !== side), fP = foes.length ? foes.reduce((a, u) => a + u.p, 0) / foes.length : LANE / 2;
    const span = () => side === 0 ? 80 + Math.random() * (LANE - 80) : siege ? Math.random() * 110 : Math.random() * (LANE - 80);
    const drop = (o, k) => S.fx.push(Object.assign({ kind: 'drop', side, age, x: 60 + Math.random() * 280, p: span(), t: 0.9 + k * 0.06, dmg: dmg / 4 }, o));
    // Every age has its own special: what falls, how it hits and what it leaves behind.
    if (age === 0) for (let k = 0; k < 10; k++) drop({ big: true, dmg: dmg / 3, r: 70 }, k);                                   // Meteor: fewer, bigger rocks
    else if (age === 1) for (let k = 0; k < 12; k++) drop({ burn: 2.5, dmg: dmg / 6 }, k);                                    // Fire pots: they keep burning
    else if (age === 2) for (let k = 0; k < 40; k++) drop({ arrow: true, dmg: dmg / 12, r: 26, t: 0.7 + Math.random() * 0.8 }, k); // Arrow rain: many small hits
    else if (age === 3) for (let k = 0; k < 9; k++) drop({ p: side === 0 ? 70 + k * (LANE - 90) / 8 : LANE - 70 - k * (LANE - 90) / 8, x: 200, t: 0.5 + k * 0.22, dmg: dmg / 3.5, r: 55 }, k); // Cannon barrage: a marching line
    else if (age === 4) { S.fx.push({ kind: 'plane', side, t: 2.6, max: 2.6 }); for (let k = 0; k < 10; k++) drop({ p: side === 0 ? 60 + k * (LANE - 70) / 9 : LANE - 60 - k * (LANE - 70) / 9, x: 170 + Math.random() * 60, t: 0.6 + k * 0.17, dmg: dmg / 3.2, r: 60, bomb: true }, k); } // Bombers
    else if (age === 5) { for (let k = 0; k < 3; k++) drop({ p: Math.max(30, Math.min(LANE - 30, fP + (k - 1) * 40)), x: 200 + (k - 1) * 40, t: 1.1 + k * 0.25, dmg: dmg * 0.75, r: 95, missile: true }, k); } // Air strike: heavy missiles on the crowd
    else { S.fx.push({ kind: 'beam', side, p: side === 0 ? 40 : LANE - 40, t: 2.2, max: 2.2, dmg: dmg * 1.4 }); }               // Orbital laser: a beam sweeps the lane, stuns
    S.specialName = AGES[age].special;
    if (side === 0) { Sfx.play('boss'); UI.vibrate(40); }
    return true;
  }
  // Long matches: after 8 min both sides' towers slowly lose punch (-6%/min, down to 40%), so a final-age
  // stalemate between two walls of towers breaks without a visible sudden-death rule. Bases never melt.
  const towerFade = () => S.t < 480 ? 1 : Math.max(0.4, 1 - (S.t - 480) / 60 * 0.06);
  function damageUnit(u, dmg, bySide, byTower) {
    u.hp -= dmg; u.hit = 0.15;
    if (u.hp <= 0 && !u.dead) {
      u.dead = true;
      const k = S.side[bySide], gold = Math.round(u.cost * (byTower ? 0.55 : 0.7));
      k.gold += gold;
      k.xp += Math.round(u.cost * (byTower ? 1.3 : 1.6));
      S.texts.push({ x: 200 + u.lx, p: u.p, txt: '+' + gold, c: bySide === 0 ? '#ffe066' : 'rgba(0,0,0,0)', life: 1 });
      if (bySide === 0) Sfx.play('pop');
    }
  }
  function damageBase(side, dmg) {
    const sd = S.side[side];
    sd.hp -= dmg;
    S.side[1 - side].xp += dmg * 0.25;
    if (side === 0) S.shake = Math.min(8, S.shake + 2);
  }

  function aiThink() {
    const ai = S.side[1], me = S.side[0];
    // The rival keeps pace: ~25 s after you reach a new age it follows (so every age is a fair fight), and it
    // also moves on by itself after a while.
    if (ai.age < me.age) ai.lag = (ai.lag || 0) + 0.85; else ai.lag = 0;
    if ((ai.lag > 25 || S.t > ai.forceAge * (ai.age + 1 - S.a0)) && ai.age < me.age && ai.age < AGES.length - 1) ai.xp = Math.max(ai.xp, XP_TO[ai.age]);
    // ...and never runs away: kills feed it XP, so a losing player used to face troops two ages ahead.
    if (ai.age < me.age + (warLv() >= 20 ? 1 : 0)) evolve(1);
    for (let i = 0; i < ai.open; i++) {
      const d = ai.slots[i], kind = d ? d.kind : i === 1 ? 'heavy' : 'rapid';
      if ((!d || d.age < ai.age) && ai.gold > DEF[kind].cost(ai.age) * 1.4) { buildDef(1, i, kind); break; }
    }
    if (ai.open < 3 && ai.gold > SLOT_COST[ai.open] * 2 && S.t > 40) openSlot(1, ai.open);
    const myUnits = S.units.filter(u => u.side === 0 && !u.dead);
    // Siege: you have kept no troops in the field for a while (turtling behind towers) → heavier waves, and the
    // special attack is aimed at your base.
    S.siege = S.t - (S.lastMine || 0) > 25 && S.t > 30;
    if (S.siege && !S.siegeWarned) { S.siegeWarned = true; S.banner = { txt: L('⚠️ SIEGE!', '⚠️ KUŞATMA!'), sub: L('No troops on the field: the enemy will attack in waves and its special will hit your base', 'Sahada askerin yok: rakip dalga dalga saldıracak, özel saldırısı üssünü vuracak'), life: 3.5 }; }
    if (!S.siege) S.siegeWarned = false;
    if (ai.scd <= 0 && (myUnits.length >= 5 || S.siege)) special(1);
    // Against a turtle the rival saves up and sends waves (5-9 units, heavy-leaning) instead of feeding the
    // towers one unit at a time; in an open fight it keeps its usual steady stream.
    // Open fight: it saves up and sends groups (a trickle just feeds your towers), but never leaves its base bare
    // while your troops are close.
    const wave = S.siege ? Math.min(9, 5 + Math.floor(S.t / 120)) : Math.min(6, 3 + Math.floor(warLv() / 8));
    const avg = (stat(ai.age, 0).cost + stat(ai.age, 1).cost + stat(ai.age, 2).cost) / 3;
    const danger = myUnits.some(u => u.p > LANE * 0.55);
    if (danger) ai.waveLeft = Math.max(ai.waveLeft || 0, ai.queue.length < 3 ? 1 : 0);
    else if (!ai.waveLeft && ai.gold >= wave * avg * 0.85) ai.waveLeft = wave;
    if (ai.waveLeft > 0 && ai.queue.length < 5) {
      const heavyShare = myUnits.filter(u => u.type === 2).length / Math.max(1, myUnits.length), rangedShare = myUnits.filter(u => u.type === 1).length / Math.max(1, myUnits.length);
      const r = Math.random();
      // Counters: heavies against your heavies, a fast front line against your ranged troops.
      const type = r < (S.siege ? 0.45 : 0.2 + heavyShare * 0.35) ? 2 : r < 0.55 - rangedShare * 0.25 ? 1 : 0;
      if (enqueue(1, type) || (type === 2 && enqueue(1, Math.random() < 0.5 ? 0 : 1))) ai.waveLeft--;
      else if (ai.gold < stat(ai.age, 0).cost) ai.waveLeft = 0; // out of gold: the wave is what it is
    }
  }

  function update(dt) {
    S.t += dt;
    if (S.powerT > 0) S.powerT = Math.max(0, S.powerT - dt);
    if (S.t > RAGE_AT && !S.rageWarned) { S.rageWarned = true; S.banner = { txt: L('🔥 THE WAR HEATS UP!', '🔥 SAVAŞ KIZIŞIYOR!'), sub: L('All troops hit harder over time', 'Tüm birlikler giderek daha sert vuruyor'), life: 3 }; }
    S.shake = Math.max(0, S.shake - dt * 16);
    for (let s = 0; s < 2; s++) {
      const sd = S.side[s];
      // Besieging a turtle, the rival earns faster and recharges its special twice as fast.
      const siegeBoost = s === 1 && S.siege;
      sd.gold += income(sd) * dt * (siegeBoost ? 1.6 : 1) * (s === 0 && S.powerT > 0 ? 2 : 1);
      sd.scd = Math.max(0, sd.scd - dt * (siegeBoost ? 2 : 1));
      if (sd.queue.length) {
        sd.queue[0].t -= dt;
        const blocked = S.units.some(u => u.side === s && !u.dead && (s === 0 ? u.p < 16 : u.p > LANE - 16));
        if (sd.queue[0].t <= 0 && !blocked) spawn(s, sd.queue.shift().type);
      }
      // Defenses.
      sd.slots.forEach((d, i) => {
        if (!d) return;
        d.cd -= dt;
        if (d.cd > 0) return;
        const spec = DEF[d.kind];
        const inRange = S.units.filter(u => u.side !== s && !u.dead && (s === 0 ? u.p < spec.range : u.p > LANE - spec.range));
        if (!inRange.length) return;
        const tgt = inRange.reduce((a, b) => (s === 0 ? (b.p < a.p ? b : a) : (b.p > a.p ? b : a)));
        d.cd = spec.rate;
        S.shots.push({ from: s === 0 ? -40 : LANE + 40, fx: 200 + SLOT_X[i], to: tgt, t: 0, dur: d.kind === 'heavy' ? 0.6 : 0.22, dmg: spec.dmg(d.age) * sd.dmg * towerFade(), side: s, kind: spec.shot[d.age], tower: d.kind, slot: i, splash: spec.splash, age: d.age });
      });
    }
    S.side[1].think -= dt;
    if (S.side[1].think <= 0) { S.side[1].think = 0.7 + Math.random() * 0.4; aiThink(); }

    // Units: move, stop behind friends, fight the closest enemy in front.
    const alive = S.units.filter(u => !u.dead);
    if (alive.some(u => u.side === 0)) S.lastMine = S.t;
    for (const u of alive) {
      if (u.stun > 0) continue; // frozen by the orbital laser
      const dir = u.side === 0 ? 1 : -1;
      let enemy = null, ed = Infinity;
      for (const o of alive) {
        if (o.side === u.side || o.dead) continue;
        const d = (o.p - u.p) * dir;
        if (d >= -8 && d < ed) { ed = d; enemy = o; }
      }
      const baseD = u.side === 0 ? LANE - u.p : u.p;
      let friendAhead = Infinity;
      for (const o of alive) if (o !== u && o.side === u.side) { const d = (o.p - u.p) * dir; if (d > 0 && d < friendAhead) friendAhead = d; }
      const pw = u.side === 0 && S.powerT > 0, pm = (pw ? 2 : 1) * rage(); // power mode: double damage, faster attacks and march
      u.cd -= dt * (pw ? 1.5 : 1); u.hit = Math.max(0, u.hit - dt);
      const target = enemy && ed <= u.range ? enemy : null;
      if (target || baseD <= u.range) {
        if (u.cd <= 0) {
          u.cd = u.rate;
          if (u.shot) {
            const slow = u.shot === 'ball' || u.shot === 'shell' || u.shot === 'plasma' || u.shot === 'javelin' || u.shot === 'stone';
            S.shots.push({ from: u.p, fx: 200 + u.lx, to: target, base: target ? null : 1 - u.side, t: 0, dur: slow ? 0.45 : u.shot === 'flame' ? 0.18 : 0.25, dmg: u.dmg * pm, side: u.side, kind: u.shot, unit: true, splash: target ? u.splash : 0, age: u.age });
          } else if (target) damageUnit(target, u.dmg * pm, u.side);
          else damageBase(1 - u.side, u.dmg * pm);
          u.swing = 0.25;
        }
      } else if (friendAhead > 20) {
        u.p += dir * u.speed * dt * (pw ? 1.5 : 1); u.walk += dt * u.speed * 0.25;
      }
      u.swing = Math.max(0, (u.swing || 0) - dt);
    }
    // Shots.
    for (const sh of S.shots) {
      sh.t += dt;
      if (sh.t >= sh.dur && !sh.done) {
        sh.done = true;
        if (sh.splash && sh.to) {
          const at = sh.to.p, tower = !!sh.tower;
          if (!sh.to.dead) damageUnit(sh.to, sh.dmg, sh.side, tower);
          const near = S.units.filter(u => !u.dead && u !== sh.to && u.side !== sh.side && Math.abs(u.p - at) < sh.splash).sort((a, b) => Math.abs(a.p - at) - Math.abs(b.p - at)).slice(0, 5);
          for (const u of near) damageUnit(u, sh.dmg * 0.35 * (1 - Math.abs(u.p - at) / sh.splash), sh.side, tower);
          S.fx.push({ kind: 'boomAt', p: at, x: 200 + sh.to.lx, t: 0.35, age: sh.age, shot: sh.kind });
        } else if (sh.to && !sh.to.dead) damageUnit(sh.to, sh.dmg, sh.side, !!sh.tower);
        else if (sh.base != null) damageBase(sh.base, sh.dmg);
      }
    }
    S.shots = S.shots.filter(s => !s.done);
    // Special effects.
    for (const f of S.fx) {
      f.t -= dt;
      if (f.kind === 'drop' && f.t <= 0 && !f.hitDone) {
        f.hitDone = true;
        const r = f.r || 60;
        for (const u of S.units) if (!u.dead && u.side !== f.side && Math.abs(u.p - f.p) < r) damageUnit(u, f.dmg, f.side);
        if (f.side === 1 && f.p < 70) damageBase(0, f.dmg * 0.6);
        if (f.side === 0 && f.p > LANE - 70) damageBase(1, f.dmg * 0.6);
        S.shake = Math.max(S.shake, f.arrow ? 1 : f.missile ? 8 : 4);
        f.boom = 0.4;
        if (f.burn) S.fx.push({ kind: 'burn', side: f.side, p: f.p, x: f.x, t: f.burn, dmg: f.dmg * 0.6 });
      }
      if (f.boom) f.boom -= dt;
      // Burning ground: damage over time to foes standing in it.
      if (f.kind === 'burn' && (f.tick = (f.tick || 0) - dt) <= 0) { f.tick = 0.5; for (const u of S.units) if (!u.dead && u.side !== f.side && Math.abs(u.p - f.p) < 40) damageUnit(u, f.dmg * 0.5, f.side); }
      // Orbital laser: sweeps from the own base across the lane, hits once per unit and stuns it.
      if (f.kind === 'beam') {
        const k = 1 - f.t / f.max; f.p = f.side === 0 ? 40 + k * (LANE - 60) : LANE - 40 - k * (LANE - 60);
        for (const u of S.units) if (!u.dead && u.side !== f.side && Math.abs(u.p - f.p) < 26 && !(f.hit || (f.hit = new Set())).has(u)) { f.hit.add(u); damageUnit(u, f.dmg / 3, f.side); u.stun = 2; }
        S.shake = Math.max(S.shake, 2);
      }
    }
    S.fx = S.fx.filter(f => (f.kind === 'drop' ? f.t > -0.4 : f.t > 0));
    for (const u of S.units) if (u.stun > 0) u.stun -= dt;
    if (S.banner && (S.banner.life -= dt) <= 0) S.banner = null;
    for (const t of S.texts) { t.p += 30 * dt * (t.c ? 1 : 0); t.life -= dt; }
    S.texts = S.texts.filter(t => t.life > 0);
    S.units = S.units.filter(u => !u.dead);

    const [me, en] = S.side;
    if (en.hp <= 0 && (me.hp > 0 || me.hp / me.max > en.hp / en.max)) win();
    else if (me.hp <= 0) lose();
    updatePanel();
  }

  // ---------- Bottom panel (DOM) ----------
  // Writes only what changed: this runs every frame and every DOM write costs a style/layout pass on the phone.
  const txt = UI.txt, prop = UI.prop;
  // Boost buttons pop in when they become available and vanish once used (power mode shows its countdown).
  function showBoost(b, on) { if (b.classList.contains('hidden') === on) { b.classList.toggle('hidden', !on); b.classList.toggle('in', on); } }
  function updateBoosts() {
    const bs = $('boosts'); if (bs.classList.contains('hidden')) bs.classList.remove('hidden');
    showBoost($('bReinf'), !S.reinfUsed && S.t >= REINF_AT);
    const pOn = S.powerT > 0; showBoost($('bPower'), pOn || (!S.powerUsed && S.t >= 20));
    $('bPower').classList.toggle('on', pOn); // active: glowing with its countdown (a second tap does nothing)
    txt($('bReinfL'), L('Reinforcements', 'Destek ordusu'));
    txt($('bPowerL'), pOn ? '2x · ' + Math.ceil(S.powerT) + L('s', 'sn') : L('2x Power', '2x Güç'));
  }
  async function boostAd(kind) {
    if (mode !== 'play' || paused || (kind === 'reinf' ? S.reinfUsed : S.powerUsed)) return;
    paused = true;
    const ok = await Ads.rewarded(kind === 'reinf' ? 'cag_reinforce' : 'cag_power');
    if (mode !== 'play') return;
    closePanel(); paused = false; // the ad may have opened the pause sheet (app hidden)
    if (!ok) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
    if (kind === 'reinf') {
      S.reinfUsed = true;
      // Three of the age's heaviest units march in from behind the base, free and outside the queue.
      for (let k = 0; k < 3; k++) { spawn(0, 2); S.units[S.units.length - 1].p = -k * 26; }
      S.banner = { txt: L('🚩 REINFORCEMENTS!', '🚩 DESTEK ORDUSU!'), sub: L('3 heavy units join the battle', '3 ağır birim savaşa katıldı'), life: 2.5 };
    } else {
      S.powerUsed = true; S.powerT = POWER_LEN;
      S.banner = { txt: L('⚡ POWER MODE!', '⚡ GÜÇ MODU!'), sub: L('60 s: 2x damage, faster troops, 2x gold', '60 sn: 2x hasar, hızlı birlikler, 2x altın'), life: 2.5 };
    }
    S.shake = 6; Sfx.play('coin');
  }
  function updatePanel() {
    if (!S) return;
    updateBoosts();
    const me = S.side[0], age = AGES[me.age];
    for (let t = 0; t < 3; t++) {
      const b = $('u' + t), st = stat(me.age, t);
      const key = me.age + ':' + t;
      if (b.dataset.k !== key && !(b._retry > performance.now())) { const ic = unitIcon(me.age, t); if (ic.startsWith('<img')) b.dataset.k = key; else b._retry = performance.now() + 1000; b.querySelector('.ico').innerHTML = ic; b.title = unitName(me.age, t); const nm = b.querySelector('.nm'); if (nm) nm.textContent = unitName(me.age, t); }
      txt(b.querySelector('.cost'), st.cost);
      const dis = me.gold < st.cost || me.queue.length >= 5; if (b.disabled !== dis) b.disabled = dis;
    }
    txt($('tur').querySelector('.cost'), me.slots.filter(Boolean).length + '/' + me.open);
    $('tur').classList.toggle('ready', me.slots.some((d, i) => i < me.open && (!d || d.age < me.age) && me.gold >= DEF[d ? d.kind : 'rapid'].cost(me.age)));
    txt($('spc').querySelector('.ico'), age.sIcon);
    txt($('spcName'), age.special);
    prop($('spc'), '--p', Math.round((1 - me.scd / SPECIAL_CD) * 100));
    $('spc').classList.toggle('ready', me.scd <= 0);
    if ($('spc').disabled !== me.scd > 0) $('spc').disabled = me.scd > 0;
    txt($('gold'), Math.floor(me.gold));
    const need = XP_TO[me.age];
    prop($('xpfill'), 'width', (need ? Math.min(100, Math.round(me.xp / need * 1000) / 10) : 100) + '%');
    txt($('xptxt'), need ? AGES[me.age].name + ' · XP ' + Math.floor(me.xp) + '/' + need : AGES[me.age].name + L(' · final age', ' · son çağ'));
    $('evo').classList.toggle('hidden', !(need && me.xp >= need));
    const qk = me.age + ':' + me.queue.map(q => q.type).join(''); if ($('queue').dataset.k !== qk && !($('queue')._retry > performance.now() && $('queue')._qk === qk)) { $('queue')._qk = qk; $('queue')._retry = performance.now() + 1000; const h = me.queue.map(q => unitIcon(me.age, q.type)).join(''); if (!h.includes('<img') === !me.queue.length) $('queue').dataset.k = qk; $('queue').innerHTML = h; }
  }
  for (let t = 0; t < 3; t++) $('u' + t).onclick = () => { if (mode === 'play' && !paused && enqueue(0, t)) Sfx.play('click'); };
  $('tur').onclick = () => { if (mode === 'play' && !paused) { paused = true; defSheet(); } };
  $('bReinf').onclick = () => boostAd('reinf');
  $('bPower').onclick = () => boostAd('power');
  $('spc').onclick = () => { if (mode === 'play' && !paused) special(0); };
  // Hold the special for what this age's one does.
  const SPECIAL_TIP = [L('Big burning rocks fall on the enemy.', 'Düşmanın üstüne büyük yanan kayalar düşer.'), L('Fire pots burst and leave burning ground.', 'Ateş çömlekleri patlar, yerde yanan alan bırakır.'),
    L('A rain of arrows over the whole field.', 'Bütün alana ok yağmuru.'), L('A barrage marches from your base to theirs.', 'Bir top salvosu üssünden onlarınkine doğru ilerler.'),
    L('Bombers fly over and drop a line of bombs.', 'Bombardıman uçakları geçip bir sıra bomba bırakır.'), L('Heavy missiles hit where the enemy is thickest.', 'Ağır füzeler düşmanın en kalabalık yerine iner.'),
    L('A laser sweeps the lane and freezes every foe for 2 s.', 'Lazer koridoru tarar, her düşmanı 2 sn dondurur.')];
  if (window.Kit && Kit.holdTip) Kit.holdTip($('spc'), () => { const a = S ? S.side[0].age : 0; return '<b>' + AGES[a].sIcon + ' ' + AGES[a].special + '</b><small>' + SPECIAL_TIP[a] + L(' Recharges in ', ' Dolma süresi ') + SPECIAL_CD + L(' s.', ' sn.') + '</small>'; });
  $('evo').onclick = () => { if (mode === 'play' && !paused) evolve(0); };

  function defSheet() {
    const me = S.side[0];
    let h = '<p class="t-lg">' + L('Defense', 'Savunma') + '</p><span class="chip">💰 ' + Math.floor(me.gold) + L(' gold · ', ' altın · ') + AGES[me.age].name + '</span>';
    for (let i = 0; i < 3; i++) {
      const d = me.slots[i];
      if (i >= me.open) {
        h += '<div class="upg"><div><b>🔒 ' + L('Slot ', 'Yuva ') + (i + 1) + '</b><small>' + L('Open a new defense slot', 'Yeni savunma yuvası aç') + '</small></div>' +
          (i === me.open ? '<button class="btn small ' + (me.gold >= SLOT_COST[i] ? 'green' : 'gray') + '" data-act="slot" data-arg="' + i + '">💰 ' + SLOT_COST[i] + '</button>' : '') + '</div>';
      } else if (!d) {
        h += '<div class="upg dempty"><div><b>' + L('Slot ', 'Yuva ') + (i + 1) + L(' · empty', ' · boş') + '</b><small>' + L('Rapid fire or area damage', 'Hızlı atış ya da alan hasarı') + '</small></div><div class="dbtns">' +
          ['rapid', 'heavy'].map(k => '<button class="btn small dbtn ' + (me.gold >= DEF[k].cost(me.age) ? (k === 'rapid' ? 'green' : 'purple') : 'gray') + '" data-act="def" data-arg="' + i + '_' + k + '">' + defIcon(k, me.age) + '<span><b>' + DEF[k].names[me.age] + '</b><i class="dc">💰 ' + DEF[k].cost(me.age) + '</i></span></button>').join('') + '</div></div>';
      } else {
        const spec = DEF[d.kind], up = d.age < me.age, upCost = spec.cost(me.age) - Math.round(spec.cost(d.age) * 0.5);
        // Built slot: name and damage on top, the buttons in their own row below (they used to sit over the text).
        h += '<div class="upg dempty"><div class="drow">' + defIcon(d.kind, d.age) + '<div><b>' + L('Slot ', 'Yuva ') + (i + 1) + ' · ' + spec.names[d.age] + '</b><small>' + Math.round(spec.dmg(d.age) / spec.rate) + L(' dmg/s', ' hasar/sn') + (d.kind === 'heavy' ? L(' · area', ' · alan') : '') + (up ? L(' · upgrade to ', ' · yükselt: ') + spec.names[me.age] : '') + '</small></div></div><div class="dbtns">' +
          (up ? '<button class="btn small ' + (me.gold >= upCost ? 'gold' : 'gray') + '" data-act="def" data-arg="' + i + '_' + d.kind + '">⬆ 💰 ' + upCost + '</button>' : '<button class="btn small gray" disabled>✓ ' + L('Up to date', 'Güncel') + '</button>') +
          '<button class="btn small gray" data-act="sell" data-arg="' + i + '">' + L('Sell · +', 'Sat · +') + Math.round(spec.cost(d.age) * 0.5) + '</button></div></div>';
      }
    }
    h += '<button class="btn green" data-act="resume">' + L('▶ Back to battle', '▶ Savaşa dön') + '</button>';
    panel(h, true);
  }

  // ---------- Screens ----------
  function hud() {
    const lv = S && mode !== 'menu' ? S.lv : G.level;
    $('lvl').innerHTML = L('Level ', 'Seviye ') + lv + '<small>Age Wars</small>';
    $('coins').textContent = Kit.fmt(Save.data.coins);
  }
  function panel(html, center) {
    // Redrawing an open panel (tab switch, upgrade) swaps its content only, so the pop-in animation doesn't replay.
    const ov = $('ov'), cls = 'overlay' + (center ? ' center' : ''), sh = ov.className === cls && ov.querySelector(':scope > .sheet');
    ov.className = cls;
    if (sh) sh.innerHTML = html; else ov.innerHTML = '<div class="sheet">' + html + '</div>';
    $('panel').classList.add('hidden'); $('boosts').classList.add('hidden');
    Ads.banner(true); hud();
  }
  function closePanel() { $('ov').classList.add('hidden'); $('panel').classList.remove('hidden'); Ads.banner(false); resize(); }

  const HELP =
    L('<div class="upg"><div><b>⚔️ Send troops</b><small>Train soldiers with the buttons below. Every enemy you kill gives gold and XP.</small></div></div>', '<div class="upg"><div><b>⚔️ Birlik gönder</b><small>Alttaki düğmelerle asker üret. Öldürdüğün her düşman altın ve XP verir.</small></div></div>') +
    L('<div class="upg"><div><b>🌟 New age = new level</b><small>Evolve when your XP is full: you get the reward at once and the battle goes on. Every war starts in the Stone Age; your upgrades stay.</small></div></div>', '<div class="upg"><div><b>🌟 Çağ atla = seviye atla</b><small>XP dolunca çağ atla: ödülü hemen alırsın, savaş sürer. Her savaş Taş Devri\'nden başlar; geliştirmelerin kalır.</small></div></div>') +
    L('<div class="upg"><div><b>🏰 Win the war</b><small>Destroy the enemy base: 3x reward. The next war starts again in the Stone Age against a slightly stronger rival.</small></div></div>', '<div class="upg"><div><b>🏰 Savaşı kazan</b><small>Düşman üssünü yık: 3 kat ödül. Sonraki savaş Taş Devri\'nden, biraz daha güçlü rakiple başlar.</small></div></div>') +
    L('<div class="upg"><div><b>🗼 Defense</b><small>3 slots on your base: rapid fire (archers, machine guns…) or area damage (catapults, cannons…). Upgrade them when you evolve.</small></div></div>', '<div class="upg"><div><b>🗼 Savunma</b><small>Üssünün üstünde 3 yuva: hızlı atış (okçu, makineli…) ya da alan hasarı (mancınık, top…). Çağ atlayınca yükselt.</small></div></div>') +
    L('<div class="upg"><div><b>☄️ Special attack</b><small>When the ring is full it rains destruction on the whole front.</small></div></div>', '<div class="upg"><div><b>☄️ Özel saldırı</b><small>Halka dolunca bütün cepheye yıkım yağdırır.</small></div></div>');

  function startMenu() {
    mode = 'menu';
    newLevel(G.level);
    const coins = Save.data.coins;
    const items = Object.keys(UPG).map(k => ({ key: k, icon: UPG[k].icon, name: UPG[k].name, level: G.upgrades[k], max: UPG[k].max, desc: upgDesc(k), cost: upgCost(k) }));
    panel(Kit.hero('cag.webp', 'Age Wars') +
      Kit.road(G.level, lv => lv % 10 === 0) +
      '<span class="chip">⚔️ ' + L('War ' + ((G.wars || 0) + 1), ((G.wars || 0) + 1) + '. savaş') + ' · ' + L('start in the Stone Age', 'Taş Devri\'nden başla') + L(' · every age = new level', ' · her çağ = yeni seviye') + '</span>' +
      '<button class="btn green big pulse" data-act="play">' + L('FIGHT', 'SAVAŞ') + '</button>' +
      (startGoldAd ? '<span class="chip">' + L('💰 Treasury ready: you start with 500 gold', '💰 Hazine hazır: 500 altınla başlıyorsun') + '</span>' : '<button class="btn purple" data-act="goldAd"><span class="ad-ico">AD</span>' + L('💰 Start with 500 gold', '💰 500 altınla başla') + '</button>') +
      Kit.tabs(menuTab, [{ id: 'up', label: L('⚡ Upgrade', '⚡ Geliştir') }, { id: 'skin', label: L('🎨 Outfit', '🎨 Kıyafet') }, { id: 'shop', label: L('🛒 Shop', '🛒 Mağaza') }, { id: 'help', label: L('❓ How', '❓ Nasıl') }]) +
      (menuTab === 'shop' ? Kit.shop('cag', G, startMenu, { packSkin: L('Royal Gold', 'Kraliyet Altını'), skins: SKINS, packKey: 'kral', art: skinArt, packDesc: L('Gold armour, a crown, a red cape, a war banner and a golden aura for your army and castle', 'Ordunu ve kaleni altın zırh, taç, kırmızı pelerin, savaş sancağı ve altın aura ile donatır') }) : menuTab === 'help' ? HELP : menuTab === 'skin' ? Kit.skins(SKINS, G, coins, skinArt) : Kit.upgrades(items, G.gold, '💰')) +
      '<div class="row" style="justify-content:center"><button class="btn gray small" data-act="home">' + L('⌂ Home', '⌂ Ana Menü') + '</button></div>');
  }
  // Reaching a new age: a level is done, paid at once, and the age becomes the war's checkpoint.
  function levelUp(age) {
    const lv = G.level, reward = 40 + 8 * Math.min(lv, 60) + Math.max(0, lv - 60);
    G.level = lv + 1; G.best = Math.max(G.best, lv); G.fails = 0; G.war = { age }; G.gold += reward; Save.addCoins(1); Save.save();
    S.lv = G.level; hud();
    S.banner = { txt: L('🌟 LEVEL ' + lv + ' DONE', '🌟 SEVİYE ' + lv + ' TAMAM'), sub: AGES[age].name + ' · +' + reward + L(' 💰 · +1 ⭐', ' 💰 · +1 ⭐'), life: 3.5 };
    Ads.track('level_win', { game: 'cag', level: lv, time: Math.round(S.t), age });
    Sfx.play('win');
  }
  function win() {
    mode = 'end';
    const lv = S.lv, pct = S.side[0].hp / S.side[0].max;
    // Enemy base destroyed: the war is won (a level of its own, paid 3x), the next war starts in the Stone Age.
    pendingReward = Math.round(3 * (40 + 8 * Math.min(lv, 60) + Math.max(0, lv - 60)) * PlayerLv.mul()); // player level bonus
    G.level = lv + 1; G.best = Math.max(G.best, lv); G.fails = 0; G.wars = (G.wars || 0) + 1; G.war = { age: 0 }; Save.save();
    Ads.track('level_win', { game: 'cag', level: lv, time: Math.round(S.t), age: S.side[0].age, war: G.wars });
    Sfx.play('win');
    const stars = pct > 0.7 ? 3 : pct > 0.35 ? 2 : 1;
    pendingStars = stars + 3;
    panel(Kit.win({ title: L('WAR WON!', 'SAVAŞ KAZANILDI!'), sub: L('War ' + G.wars + ' · ' + Math.floor(S.t / 60) + ' min ' + Math.round(S.t % 60) + ' s · ', G.wars + '. savaş · ' + Math.floor(S.t / 60) + ' dk ' + Math.round(S.t % 60) + ' sn · ') + AGES[S.side[0].age].name, stars, reward: pendingReward, gems: pendingStars, ads: Kit.adsFor(G.level - 1) }), true);
  }
  function lose() {
    mode = 'end';
    G.fails = (G.fails || 0) + 1; Save.save();
    Ads.track('level_fail', { game: 'cag', level: S.lv, fails: G.fails, time: Math.round(S.t) });
    Sfx.play('lose');
    panel(Kit.lose({
      title: L('BASE FELL', 'ÜS DÜŞTÜ'),
      sub: L('Level ' + S.lv + ' · enemy base ' + Math.round(Math.max(0, S.side[1].hp) / S.side[1].max * 100) + '%', 'Seviye ' + S.lv + ' · rakip üs %' + Math.round(Math.max(0, S.side[1].hp) / S.side[1].max * 100)),
      hint: L('🏁 The next war starts in the Stone Age.', '🏁 Sonraki savaş Taş Devri\'nden başlar.') + (ease() > 0 ? L(' The enemy will be ' + Math.round(ease() * 100) + '% weaker.', ' Rakip %' + Math.round(ease() * 100) + ' daha zayıf olacak.') : L(' Put archers behind your front line, evolve when XP is full.', ' Okçuları öndekilerin arkasına diz, XP dolunca çağ atla.')),
      extraButtons: (S.reviveUsed ? '' : '<button class="btn purple big" data-act="revive"><span class="ad-ico">AD</span>' + L('Repair Base · Continue', 'Üssü Onar · Devam') + '</button>') +
        '<div class="row"><button class="btn green" data-act="retry">' + L('↻ Retry', '↻ Tekrar') + '</button><button class="btn gray" data-act="menu">' + L('Menu', 'Menü') + '</button></div>',
    }), true);
  }

  const actions = {
    play() { newLevel(G.level); startGoldAd = false; closePanel(); mode = 'play'; paused = false; hud(); Ads.track('level_start', { game: 'cag', level: S.lv, ease: ease() }); },
    tab(t) { menuTab = t; startMenu(); },
    async goldAd() {
      if (!(await Ads.rewarded('cag_start_gold'))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      startGoldAd = true; UI.toast(L('💰 You start the next war with 500 gold', '💰 Sonraki savaşa 500 altınla başlarsın')); startMenu();
    },
    skin(k) { if (G.skins.includes(k)) { G.skin = k; applySkin(); Save.save(); startMenu(); } },
    skinBuy(k) {
      if (!Save.spend(SKINS[k].cost)) { UI.toast(L('Not enough ⭐ stars', 'Yetersiz ⭐ yıldız')); return; }
      G.skins.push(k); G.skin = k; applySkin(); Save.save(); UI.toast(SKINS[k].name + L(' unlocked!', ' açıldı!')); Sfx.play('coin'); startMenu();
    },
    async skinAd(k) {
      if (!(await Ads.rewarded('cag_skin_' + k))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      G.adSkin++;
      if (G.adSkin >= SKINS[k].ads) { G.skins.push(k); G.skin = k; applySkin(); UI.toast(SKINS[k].name + L(' unlocked!', ' açıldı!')); }
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
      if (+m === 3 && !(await Kit.multiAd('cag_win_x3', Kit.adsFor(G.level - 1), 'win' + pendingReward, '[data-act=claim][data-arg="3"]'))) return;
      const amount = pendingReward * (+m === 3 ? 3 : 1);
      G.gold += amount; Save.addCoins(pendingStars); UI.toast('💰 +' + amount + (pendingStars ? ' · ⭐ +' + pendingStars : '')); pendingReward = 0; pendingStars = 0; Save.save(); Sfx.play('coin');
      await Ads.levelEnd(G.level - 1);
      startMenu();
    },
    async revive() {
      if (S.reviveUsed) return;
      if (!(await Ads.rewarded('cag_revive'))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      S.reviveUsed = true;
      const me = S.side[0];
      me.hp = me.max * 0.6;
      S.units = S.units.filter(u => !(u.side === 1 && u.p < LANE * 0.5));
      closePanel(); mode = 'play'; hud();
    },
    retry() { actions.play(); },
    slot(i) { if (openSlot(0, +i)) { Sfx.play('coin'); } else UI.toast(L('Not enough gold', 'Yetersiz altın')); defSheet(); },
    def(arg) { const [i, k] = arg.split('_'); if (buildDef(0, +i, k)) { Sfx.play('coin'); UI.toast('🏰 ' + DEF[k].names[S.side[0].age]); } else UI.toast(L('Not enough gold', 'Yetersiz altın')); defSheet(); },
    sell(i) { if (sellDef(0, +i)) Sfx.play('coin'); defSheet(); },
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
    panel('<p class="t-lg">' + L('Paused', 'Duraklatıldı') + '</p><button class="btn green big" data-act="resume">' + L('▶ Resume', '▶ Devam') + '</button><button class="btn gray" data-act="menu">' + L('Leave battle', 'Savaştan çık') + '</button>', true);
  };
  UI.onBack(() => {
    if (mode === 'play' && !paused) { $('pauseBtn').onclick(); return; }
    if (mode === 'menu') { UI.goHome('../index.html'); return; }
    startMenu();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && !paused) $('pauseBtn').onclick(); });

  // ---------- Render ----------
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function text(t, x, y, size, fill, stroke) {
    ctx.font = '800 ' + size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.26); ctx.strokeStyle = stroke || '#1b1464'; ctx.strokeText(t, x, y);
    ctx.fillStyle = fill || '#fff'; ctx.fillText(t, x, y);
  }
  const TEAM = [{ c: '#3b82f6', d: '#123a8a', l: '#9fd0ff' }, { c: '#ef4444', d: '#7a0f1e', l: '#ffb3b3' }];
  // Shop art: the player's front-line soldier of the current age, rendered from the real model wearing that skin's gear.
  // The model textures load late, so it falls back to a colour ball and the menu redraws a few times until all are ready.
  let artRetry = 0;
  function skinArt(k, s) {
    const url = R3 && R3.thumb && R3.thumb('u', (G.war && G.war.age) || 0, 0, { c: s.color, d: s.d, l: s.l }, k);
    if (url) return '<img class="cthumb" src="' + url + '" alt="">';
    if (artRetry < 6) { artRetry++; setTimeout(() => { if (mode === 'menu' && (menuTab === 'skin' || menuTab === 'shop')) startMenu(); }, 500); }
    return '<span class="ball" style="background:' + s.color + '"></span>';
  }
  function applySkin() { const k = SKINS[G.skin] || SKINS.mavi; TEAM[0] = { c: k.color, d: k.d, l: k.l }; }
  applySkin();

  function drawBase(side, y) {
    const sd = S.side[side], age = LOOK[sd.age], tm = TEAM[side], x = 200;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 34, 100, 14, 0, 0, 7); ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#1e1a2e';
    if (age === 0) { // cave
      ctx.fillStyle = '#8a8378'; ctx.beginPath(); ctx.ellipse(x, y + 10, 90, 44, 0, Math.PI, 0); ctx.lineTo(x + 90, y + 34); ctx.lineTo(x - 90, y + 34); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2b2520'; ctx.beginPath(); ctx.ellipse(x, y + 34, 30, 26, 0, Math.PI, 0); ctx.fill();
    } else if (age === 1) { // castle
      ctx.fillStyle = '#b8b0a0'; ctx.fillRect(x - 80, y - 20, 160, 54); ctx.strokeRect(x - 80, y - 20, 160, 54);
      for (let k = 0; k < 7; k++) { ctx.fillRect(x - 80 + k * 24, y - 32, 14, 12); ctx.strokeRect(x - 80 + k * 24, y - 32, 14, 12); }
      ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(x, y + 34, 18, Math.PI, 0); ctx.fill();
    } else if (age === 2) { // fort
      ctx.fillStyle = '#b58a55'; ctx.beginPath(); ctx.moveTo(x - 95, y + 34); ctx.lineTo(x - 70, y - 24); ctx.lineTo(x + 70, y - 24); ctx.lineTo(x + 95, y + 34); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#4b3520'; ctx.fillRect(x - 16, y + 6, 32, 28);
    } else if (age === 3) { // bunker
      ctx.fillStyle = '#7d8590'; rr(x - 90, y - 16, 180, 50, 16); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1f2937'; rr(x - 50, y - 2, 100, 12, 6); ctx.fill();
    } else { // tech tower
      const g = ctx.createLinearGradient(x - 70, 0, x + 70, 0); g.addColorStop(0, '#312e81'); g.addColorStop(0.5, '#6d7cff'); g.addColorStop(1, '#312e81');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 80, y + 34); ctx.lineTo(x - 40, y - 40); ctx.lineTo(x + 40, y - 40); ctx.lineTo(x + 80, y + 34); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7df9ff'; ctx.beginPath(); ctx.arc(x, y - 10, 10 + Math.sin(S.t * 5) * 2, 0, 7); ctx.fill();
    }
    // Flag.
    ctx.strokeStyle = '#1e1a2e'; ctx.beginPath(); ctx.moveTo(x + 60, y - 20); ctx.lineTo(x + 60, y - 56); ctx.stroke();
    ctx.fillStyle = tm.c; ctx.beginPath(); ctx.moveTo(x + 60, y - 56); ctx.lineTo(x + 86, y - 48 + Math.sin(S.t * 6) * 3); ctx.lineTo(x + 60, y - 40); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Defenses on top of the base.
    sd.slots.forEach((d, i) => {
      const dx = x + SLOT_X[i], dy = y - 30;
      if (!d) { if (side === 0 && i < sd.open) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.setLineDash([4, 4]); rr(dx - 13, dy - 14, 26, 26, 6); ctx.stroke(); ctx.setLineDash([]); } return; }
      const metal = ['#8a6a4a', '#8a8a96', '#555c68', '#4b5563', '#3b3f9a'][LOOK[d.age]];
      ctx.strokeStyle = '#1e1a2e'; ctx.lineWidth = 2.5;
      ctx.fillStyle = metal; rr(dx - 14, dy - 10, 28, 24, 5); ctx.fill(); ctx.stroke();
      const aim = side === 0 ? -1 : 1;
      if (d.kind === 'heavy') {
        ctx.fillStyle = tm.c; ctx.beginPath(); ctx.arc(dx, dy - 12, 11, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2b2b33'; rr(dx - 6, dy - 12 + (aim < 0 ? -20 : 0), 12, 20, 4); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = tm.c; rr(dx - 8, dy - 24, 16, 16, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = d.age >= 6 ? '#7df9ff' : '#2b2b33'; rr(dx - 2.5, dy - 16 + (aim < 0 ? -16 : 0), 5, 16, 2); ctx.fill();
      }
      if (d.age < sd.age) { text('⬆', dx + 14, dy - 22, 11, '#ffd23f'); }
    });
    // HP bar.
    const by = side === 0 ? y + 50 : y + 42, pct = Math.max(0, sd.hp / sd.max);
    ctx.fillStyle = 'rgba(15,10,40,.85)'; rr(x - 90, by, 180, 16, 8); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = side === 0 ? '#3be07a' : '#ff4757'; if (pct > 0) { rr(x - 87, by + 3, 174 * pct, 10, 5); ctx.fill(); }
    text(Math.ceil(Math.max(0, sd.hp)) + ' · ' + AGES[sd.age].name, x, by + 8.5, 11);
  }

  function drawUnit(u) {
    const tm = TEAM[u.side], x = 200 + u.lx, y = Y(u.p), bob = Math.abs(Math.sin(u.walk)) * 2.5, dir = u.side === 0 ? -1 : 1;
    const big = u.type === 2, r = big ? 15 : 10, la = LOOK[u.age];
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.9, r, r * 0.35, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = tm.d; ctx.lineJoin = 'round';
    if (big) {
      // Heavy unit per age: dino, horse, cannon, tank, mech.
      const bodyC = ['#6fcf5b', '#8a5a3c', '#3c3c3c', '#5b6b4a', '#9aa3c8'][la];
      ctx.fillStyle = bodyC;
      if (la === 2) { ctx.beginPath(); ctx.arc(x - 9, y + 6, 7, 0, 7); ctx.arc(x + 9, y + 6, 7, 0, 7); ctx.fill(); ctx.stroke(); rr(x - 5, y - 16 + dir * 4, 10, 24, 4); ctx.fill(); ctx.stroke(); }
      else if (la === 3) { rr(x - 16, y - 12, 32, 26, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = tm.c; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillRect(x - 2, y + dir * 22 - (dir > 0 ? 0 : 0), 4, -dir * 16); }
      else { ctx.beginPath(); ctx.ellipse(x, y - bob, 15, 12, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y + dir * 12 - bob, 7, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = tm.c; ctx.beginPath(); ctx.arc(x, y - 12 - bob, 7, 0, 7); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = tm.c; ctx.beginPath(); ctx.arc(x, y - bob, r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = tm.l; ctx.beginPath(); ctx.arc(x - 3, y - bob - 3, 3, 0, 7); ctx.fill();
      // Headgear per age.
      const hat = ['#8a5a2b', '#9ca3af', '#1f2937', '#556b2f', '#7df9ff'][la];
      ctx.fillStyle = hat; ctx.beginPath(); ctx.arc(x, y - bob - 3, r, Math.PI, 0); ctx.fill(); ctx.stroke();
      // Weapon.
      const sw = u.swing ? 1 : 0;
      ctx.strokeStyle = u.type === 1 ? '#5a3a1a' : '#d1d5db'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + 8, y - bob); ctx.lineTo(x + 8 + sw * 6, y - bob + dir * (14 - sw * 4)); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 3, y - bob + dir * 3, 2.4, 0, 7); ctx.arc(x + 3, y - bob + dir * 3, 2.4, 0, 7); ctx.fill();
    }
    if (u.hit) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(x, y - bob, r + 2, 0, 7); ctx.fill(); }
    if (u.hp < u.max) {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - 12, y - r - 12, 24, 4);
      ctx.fillStyle = u.side === 0 ? '#3be07a' : '#ff4757'; ctx.fillRect(x - 12, y - r - 12, 24 * u.hp / u.max, 4);
    }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const age = AGES[S ? S.side[0].age : 0];
    const g = ctx.createLinearGradient(0, 0, 0, cvs.height); g.addColorStop(0, age.sky[0]); g.addColorStop(1, age.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, cvs.width, cvs.height);
    const sh = S && S.shake ? S.shake : 0;
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (ox + (Math.random() - 0.5) * sh), dpr * (oy + (Math.random() - 0.5) * sh));
    // Ground + road.
    ctx.fillStyle = age.ground; rr(-40, 40, W + 80, H - 40, 30); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    for (let k = 0; k < 18; k++) { ctx.beginPath(); ctx.arc((k * 97) % W, 60 + (k * 131) % (H - 80), 10 + (k % 3) * 5, 0, 7); ctx.fill(); }
    ctx.fillStyle = age.road; rr(125, 40, 150, H - 80, 20); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.setLineDash([14, 14]); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(200, 120); ctx.lineTo(200, 600); ctx.stroke(); ctx.setLineDash([]);
    if (!S) return;
    drawBase(1, 70);
    drawBase(0, 630);
    const order = S.units.slice().sort((a, b) => Y(a.p) - Y(b.p));
    for (const u of order) drawUnit(u);
    for (const s of S.shots) {
      const k = Math.min(1, s.t / s.dur);
      const tx = s.to ? 200 + s.to.lx : 200, tp = s.to ? s.to.p : (s.base === 1 ? LANE + 20 : -20);
      const x = s.fx + (tx - s.fx) * k, y = Y(s.from + (tp - s.from) * k) - Math.sin(k * Math.PI) * 18;
      ctx.fillStyle = s.kind === 'laser' || s.kind === 'plasma' ? '#7df9ff' : s.kind === 'flame' ? '#ff8a2a' : s.kind === 'bullet' ? '#ffd23f' : s.kind === 'ball' || s.kind === 'shell' || s.kind === 'rocket' ? '#222' : s.kind === 'boulder' || s.kind === 'stone' ? '#7a6a5a' : '#fff3c4';
      ctx.beginPath(); ctx.arc(x, y, s.kind === 'boulder' || s.kind === 'shell' || s.kind === 'plasma' ? 6 : s.kind === 'ball' || s.kind === 'rocket' ? 5 : 3, 0, 7); ctx.fill();
    }
    for (const f of S.fx) {
      if (f.kind === 'flash') { ctx.fillStyle = 'rgba(255,255,255,' + f.t * 0.6 + ')'; ctx.fillRect(-50, -50, W + 100, H + 100); continue; }
      if (f.kind === 'boomAt') { ctx.fillStyle = 'rgba(255,150,40,' + f.t * 2 + ')'; ctx.beginPath(); ctx.arc(f.x, Y(f.p), 46 * (1 - f.t * 2), 0, 7); ctx.fill(); continue; }
      if (f.kind !== 'drop') continue; // burning ground, laser beam and bombers are drawn by the 3D renderer only
      const y = Y(f.p);
      if (f.t > 0) { const fall = Math.max(0, f.t) * 420; text(AGES[f.age].sIcon, f.x, y - fall, 26); }
      else if (f.boom > 0) { ctx.fillStyle = 'rgba(255,160,40,' + f.boom * 2 + ')'; ctx.beginPath(); ctx.arc(f.x, y, 40 * (1 - f.boom), 0, 7); ctx.fill(); }
    }
    for (const t of S.texts) if (t.c && t.c !== 'rgba(0,0,0,0)') { ctx.globalAlpha = Math.max(0, t.life); text(t.txt, t.x, Y(t.p) - 20, 14, t.c, '#6b4a00'); }
    ctx.globalAlpha = 1;
    if (S.banner) { const b = S.banner; ctx.globalAlpha = Math.min(1, b.life * 2); text(b.txt, 200, 300, 26, '#ffe066', '#6b3a00'); text(b.sub, 200, 330, 13, '#fff'); ctx.globalAlpha = 1; }
    if (mode === 'play' && S.lv === 1 && S.t < 8) { ctx.globalAlpha = 0.7 + Math.sin(S.t * 4) * 0.3; text(L('Send troops from below!', 'Aşağıdan asker gönder!'), 200, 470, 20); ctx.globalAlpha = 1; }
  }

  // Screen-space overlay on top of the 3D scene: HP bars, floating gold, flash, banners.
  function bar(x, y, w, h, pct, c) {
    ctx.fillStyle = 'rgba(15,10,40,.85)'; rr(x - w / 2, y, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = c; if (pct > 0) { rr(x - w / 2 + 3, y + 3, (w - 6) * pct, h - 6, (h - 6) / 2); ctx.fill(); }
  }
  let layoutT = 0, hudB = 0, panelH = 150;
  function drawOverlay3D() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cvs.width, cvs.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = innerWidth / 2;
    for (const u of S.units) {
      if (u.hp >= u.max) continue;
      const p = R3.project(u.p, u.lx, u.type === 2 ? 46 : 46), w = u.type === 2 ? 30 : 24;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(p.x - w / 2, p.y, w, 4);
      ctx.fillStyle = u.side === 0 ? '#3be07a' : '#ff4757'; ctx.fillRect(p.x - w / 2, p.y, w * u.hp / u.max, 4);
    }
    for (const t of S.texts) if (t.c && t.c !== 'rgba(0,0,0,0)') {
      const p = R3.project(t.p, t.x - 200, 30);
      ctx.globalAlpha = Math.max(0, t.life); text(t.txt, p.x, p.y, 14, t.c, '#6b4a00');
    }
    ctx.globalAlpha = 1;
    // Base HP bars: the enemy's above its base, ours just above the unit panel.
    // HUD / panel heights are layout reads: refresh them twice a second, not every frame (forced layout).
    if (!(layoutT-- > 0)) { layoutT = 30; hudB = UI.safeArea().hudBottom; panelH = ($('panel') && $('panel').offsetHeight) || 150; }
    for (let s = 0; s < 2; s++) {
      const sd = S.side[s], w = Math.min(220, innerWidth * 0.55);
      const y = s === 1 ? Math.max(hudB + 4, R3.projectBase(1, 100).y - 20) : innerHeight - panelH - 24;
      bar(cx, y, w, 18, Math.max(0, sd.hp / sd.max), s === 0 ? '#3be07a' : '#ff4757');
      text(Math.ceil(Math.max(0, sd.hp)) + ' · ' + AGES[sd.age].name, cx, y + 9.5, 11);
    }
    for (const f of S.fx) if (f.kind === 'flash') { ctx.fillStyle = 'rgba(255,255,255,' + f.t * 0.6 + ')'; ctx.fillRect(0, 0, innerWidth, innerHeight); }
    const mid = R3.project(LANE / 2, 0, 0);
    if (S.banner) { const b = S.banner; ctx.globalAlpha = Math.min(1, b.life * 2); text(b.txt, cx, mid.y - 40, 28, '#ffe066', '#6b3a00'); text(b.sub, cx, mid.y - 8, 14, '#fff'); ctx.globalAlpha = 1; }
    if (mode === 'play' && S.lv === 1 && S.t < 8) { const p = R3.project(LANE * 0.25, 0, 0); ctx.globalAlpha = 0.7 + Math.sin(S.t * 4) * 0.3; text(L('Send troops from below!', 'Aşağıdan asker gönder!'), cx, p.y, 20); ctx.globalAlpha = 1; }
  }

  let last = performance.now();
  function loop(t) {
    requestAnimationFrame(loop);
    if (t - last < 7) return; // follow the screen (up to 120 Hz): 60 fps looked choppy on 120 Hz phones
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (mode === 'play' && !paused) update(dt);
    if (R3 && S) { R3.render(S, dt, { ages: AGES, team: TEAM, slotX: SLOT_X, gear: G.skin }); drawOverlay3D(); }
    else draw();
  }
  window.__cag = { get S() { return S; }, get mode() { return mode; }, G, actions, enqueue, evolve, buildDef, openSlot, spawn, update, aiThink, special, newLevel, updatePanel, setMode: m => { mode = m; } }; // test hook
  startMenu();
  if (location.hash === '#play' || location.hash === '#demo') actions.play();
  if (location.hash === '#demo') {
    S.side[0].gold = 900; S.side[0].xp = 950;
    for (let i = 0; i < 700; i++) { if (i % 30 === 0) { enqueue(0, i % 90 === 0 ? 2 : i % 60 === 0 ? 1 : 0); } if (i === 200) { evolve(0); buildDef(0, 0, 'rapid'); } update(0.05); }
  }
  Sfx.music(true);
  requestAnimationFrame(loop);
})();
