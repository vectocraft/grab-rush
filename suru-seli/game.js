// Sürü Seli — squad shooter in the spirit of Mob Control's ads. Your squad runs up the road firing bullets.
// Reward lanes only bring rewards (soldier gates you can shoot to raise, supply crates); enemy lanes only bring
// the enemy flood.
// Crates hand out better guns, mortar teams and air strikes. The level ends at an enemy fortress that sits on
// the enemy lane while the reward lane keeps delivering.
(() => {
  'use strict';

  const G = Save.game('suru', {
    gold: null, level: 1, best: 0, fails: 0, skin: 'mavi', skins: ['mavi'], adSkin: 0,
    upgrades: { squad: 0, dmg: 0, rate: 0, air: 0 },
  });
  // Each game has its own 💰 gold for upgrades; ⭐ stars (top right) are the scarce shared currency.
  if (G.gold == null) { G.gold = 400 + 60 * (G.level || 1); Save.save(); }
  // Saves from the earlier cannon version: carry old upgrades over to the new squad upgrades once.
  if (G.upgrades.power != null || G.upgrades.giant != null) {
    const u = G.upgrades;
    u.squad = Math.max(u.squad || 0, Math.min(15, u.power || 0));
    u.dmg = Math.max(u.dmg || 0, Math.min(15, (u.giant || 0) + Math.floor((u.power || 0) / 2)));
    delete u.power; delete u.giant;
    Save.save();
  }
  if (G.upgrades.air == null) G.upgrades.air = 0;
  const SKINS = {
    mavi: { name: L('Blue', 'Mavi'), color: '#3b82f6', cost: 0 },
    yesil: { name: L('Green', 'Yeşil'), color: '#22c55e', cost: 40 },
    kral: { name: L('Royal Gold', 'Kraliyet Altını'), color: '#ffcf3f', pack: true, rarity: 'legendary' },
    mor: { name: L('Purple', 'Mor'), color: '#a855f7', cost: 80 },
    altin: { name: L('Gold', 'Altın'), color: '#fbbf24', ads: 2 },
    turuncu: { name: L('Orange', 'Turuncu'), color: '#f97316', cost: 150 },
    pembe: { name: L('Pink', 'Pembe'), color: '#ec4899', cost: 300 },
    beyaz: { name: L('Pearl', 'İnci'), color: '#e2e8f0', cost: 600 },
  };
  const UPG = {
    squad: { icon: '🪖', name: L('Starting Squad', 'Başlangıç Takımı'), max: 15, val: l => (5 + 2 * l) + L(' soldiers', ' asker') },
    dmg: { icon: '💥', name: L('Bullet Power', 'Mermi Gücü'), max: 15, val: l => L('+' + 8 * l + '% damage', '+%' + 8 * l + ' hasar') },
    rate: { icon: '⚡', name: L('Fire Rate', 'Atış Hızı'), max: 15, val: l => L('+' + 6 * l + '% rate', '+%' + 6 * l + ' hız') },
    air: { icon: '✈️', name: L('Air Support', 'Hava Desteği'), max: 10, val: l => (l ? L('plane every ' + airEvery(l) + ' s', 'her ' + airEvery(l) + ' sn uçak') : L('none', 'yok')) },
  };
  const upgLv = k => Math.min(UPG[k].max, G.upgrades[k] || 0);
  const airEvery = l => 34 - 2 * l;
  const upgCost = k => Math.round((k === 'air' ? 160 : 90) * Math.pow(1.6, upgLv(k)));
  const upgDesc = k => { const u = UPG[k], l = upgLv(k); return l >= u.max ? u.val(l) : u.val(l) + ' → ' + u.val(l + 1); };
  const ease = () => Math.min(0.45, 0.15 * (G.fails || 0));

  // Guns picked up from crates during a level. `gun` picks the 3D model.
  const WEAPONS = [
    { name: L('Pistol', 'Tabanca'), icon: '🔫', dmg: 1, rate: 0.42, spread: 1, speed: 560, color: '#fff3b0', kind: 'bullet', gun: 0 },
    { name: L('Rifle', 'Tüfek'), icon: '🎯', dmg: 1.6, rate: 0.3, spread: 1, speed: 640, color: '#ffe066', kind: 'bullet', gun: 1 },
    { name: L('Machine Gun', 'Makineli'), icon: '🔥', dmg: 1, rate: 0.12, spread: 1, speed: 700, color: '#ffb020', kind: 'bullet', gun: 2 },
    { name: L('Shotgun', 'Pompalı'), icon: '💢', dmg: 1.4, rate: 0.45, spread: 3, speed: 560, color: '#ff8a4c', kind: 'pellet', gun: 3 },
    { name: L('Rocket Launcher', 'Roketatar'), icon: '🚀', dmg: 6, rate: 0.75, spread: 1, speed: 420, color: '#ff5a3c', splash: 38, kind: 'rocket', gun: 4 },
    { name: L('Laser', 'Lazer'), icon: '⚡', dmg: 2.4, rate: 0.1, spread: 1, speed: 900, color: '#7df9ff', pierce: true, kind: 'laser', gun: 5 },
  ];
  const CRATE_ICON = { mortar: '💣', air: '✈️', troops: '🪖' };
  // V3: a 3D world per 10 levels (same cadence as ortak/themes.js; the 2D field colours come along for the 2D renderer).
  const WORLDS = [
    { env: 'gece', icon: '🌃', name: L('Night Valley', 'Gece Vadisi') },
    { env: 'col', icon: '🏜️', name: L('Desert', 'Çöl'), field: ['#7c4a1e', '#3a2614', '#5a3a1a'] },
    { env: 'kar', icon: '❄️', name: L('Snowfield', 'Kar Diyarı'), field: ['#334155', '#1e3a4f', '#0c4a6e'] },
    { env: 'volkan', icon: '🌋', name: L('Volcano', 'Volkan'), field: ['#7f1d1d', '#3b0f0f', '#431407'] },
    { env: 'neon', icon: '🌆', name: L('Neon City', 'Neon Şehir'), field: ['#4c1d95', '#1e0b3a', '#0b2a4a'] },
    { env: 'sehir', icon: '🏙️', name: L('Night City', 'Gece Şehri'), field: ['#1e293b', '#111827', '#1f2937'] },
  ];
  const worldOf = lv => Themes.pick ? Themes.pick(WORLDS, lv) : Themes.forLevel(lv);
  // Support abilities: free to use (no ads), recharge over time, unlocked by level.
  const SUP = {
    heli: { icon: '🚁', name: L('Reinforcements', 'Takviye'), cd: 28, first: 8, lv: 1 },
    strike: { icon: '🚀', name: L('Missile Strike', 'Füze Yağmuru'), cd: 22, first: 12, lv: 2 },
    shield: { icon: '🛡️', name: L('Shield', 'Kalkan'), cd: 26, first: 15, lv: 3 },
  };

  const W = 400, H = 720, TAU = Math.PI * 2;
  const SQUAD_Y = 610, ROAD_L = 24, ROAD_R = 376, MID = 200, SCROLL = 70, CASTLE_Y = 110;
  // Lane layouts across the road: 'r' = reward lane, 'e' = enemy lane.
  const lanesOf = (kinds, n) => kinds.split('').map((k, i) => {
    const a = ROAD_L + (ROAD_R - ROAD_L) * i / n, b = ROAD_L + (ROAD_R - ROAD_L) * (i + 1) / n;
    return { k: k === 'R' ? 'r' : 'e', a, b, c: (a + b) / 2, w: b - a };
  });
  const LAYOUTS = { two: lanesOf('RE', 2) };
  const $ = id => document.getElementById(id);
  const cvs = $('c'), ctx = cvs.getContext('2d');
  // 3D when WebGL is available; otherwise the 2D renderer below.
  const R3 = window.Suru3D ? window.Suru3D.init($('c3d')) : null;
  window.__suru = { get S() { return S; }, R3 }; // test hook
  if (!R3 && $('c3d') && $('c3d').style) $('c3d').style.display = 'none';
  const FONT = "'Baloo', system-ui, sans-serif";
  let dpr = 1, sc = 1, ox = 0, oy = 0;
  function resize() {
    dpr = Math.min(R3 ? 1.5 : 2, window.devicePixelRatio || 1);
    cvs.width = Math.round(innerWidth * dpr); cvs.height = Math.round(innerHeight * dpr);
    const sa = UI.safeArea(), avail = innerHeight - sa.hudBottom - sa.bottom - 4;
    sc = Math.min(innerWidth / W, avail / H);
    ox = (innerWidth - W * sc) / 2; oy = sa.hudBottom + (avail - H * sc) / 2;
  }
  addEventListener('resize', () => { resize(); if (R3 && S) R3.fit(); });
  resize();
  setTimeout(() => { resize(); if (R3 && S) R3.fit(); }, 400);
  if (document.fonts && document.fonts.load) document.fonts.load("800 14px 'Baloo'").catch(() => { });
  const toWorld = e => (R3 ? R3.pick(e.clientX, e.clientY) : { x: (e.clientX - ox) / sc, y: (e.clientY - oy) / sc });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const frac = v => v - Math.floor(v);
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  let S = null;
  let mode = 'menu', paused = false, pendingReward = 0, pendingStars = 0, menuTab = 'up', startGunAd = false;
  const skinColor = () => (SKINS[G.skin] || SKINS.mavi).color;
  // Shop art: the baked 3D soldier in that skin (scripts/suru-skin-art.html); absolute URL because it sits in a CSS variable.
  const skinArt = k => '<span class="skp" style="--img:url(' + new URL('../ortak/img/skins/suru-' + k + '.webp', location.href).href + ')"></span>';
  let nextId = 1;

  // Road position s of a point at screen y: s = dist - y (fixed points on the road keep their s).
  function layoutAt(s) {
    const segs = S.segs;
    for (let i = segs.length - 1; i > 0; i--) if (s >= segs[i].s0) return LAYOUTS[segs[i].lay];
    return LAYOUTS[segs[0].lay];
  }

  // ---------- Level ----------
  // Level flavour: each level from 3 on gets one (later two) modifiers that change what the flood does.
  const MODS = {
    sniper: { name: L('Snipers', 'Nişancılar'), icon: '🎯', sub: L('They shoot from afar — get close to them!', 'Uzaktan ateş ediyorlar — yanlarına git!') },
    bomber: { name: L('Bombers', 'Bombacılar'), icon: '💣', sub: L('They explode on contact — shoot from afar!', 'Değerlerse patlarlar — uzaktan vur!') },
    shield: { name: L('Shield Bearers', 'Kalkanlılar'), icon: '🛡️', sub: L('Bullet-proof — rockets and mortars work', 'Mermiye dayanıklı — roket ve havan işe yarar') },
    fast: { name: L('Fast Flood', 'Hızlı Sel'), icon: '⚡', sub: L('Enemies run and attack from range', 'Düşmanlar koşuyor ve uzaktan saldırıyor') },
    mines: { name: L('Minefield', 'Mayınlı Yol'), icon: '☢️', sub: L('Mines on the reward lane — shoot them clear!', 'Ödül yolunda mayınlar var — vurup temizle!') },
    swarm: { name: L('Swarm', 'Kalabalık'), icon: '🐜', sub: L('Many more enemies', 'Çok daha fazla düşman') },
  };
  // End-of-road bosses rotate every level.
  const BOSSES = {
    kale: { name: L('Enemy Castle', 'Düşman Kalesi'), icon: '🏰', sub: L('Dodge its cannons, bring it down!', 'Toplarından kaç, kaleyi yık!'), hp: 1, w: 150 },
    dev: { name: L('Armored Giant', 'Zırhlı Dev'), icon: '👹', sub: L('Walking at you — drop it before it gets close!', 'Sana doğru yürüyor — yaklaşmadan indir!'), hp: 0.75, w: 64 },
    tank: { name: L('Armored Tank', 'Zırhlı Tank'), icon: '🛡️', sub: L('Armored: rockets, mortars and lasers hit harder', 'Zırhlı: roket, havan ve lazer daha etkili'), hp: 0.8, w: 104 },
    heli: { name: L('Gunship', 'Savaş Helikopteri'), icon: '🚁', sub: L('It chases you — keep moving!', 'Peşinden geliyor — sürekli hareket et!'), hp: 0.6, w: 92 },
    ejder: { name: L('Fire Drake', 'Ateş Ejderi'), icon: '🐉', sub: L('Watch the red marks — its fire rains down there!', 'Kırmızı izlere dikkat — ateşi oraya yağıyor!'), hp: 0.7, w: 110 },
  };
  // Difficulty level: the real level up to 80, then growing at 20% speed. Past ~100 the uncapped formulas (negative
  // gates, enemy hits, castle HP) outgrew any upgrade path: the 40-day sim hit a 17-loss wall at level 127.
  // Upgrades cost 1.6x per level, so a long-time player sits around upgrade 10-12: difficulty has to flatten too.
  const diffLv = lv => lv <= 80 ? lv : 80 + (lv - 80) * 0.2;
  const bossOf = lv => ['kale', 'dev', 'tank', 'heli', 'ejder'][(lv - 1) % 5];
  function modsOf(lv) {
    if (lv < 3) return [];
    const r = rng(lv * 3571 + 7), keys = Object.keys(MODS).filter(k => lv >= 5 || k !== 'mines');
    const a = keys[Math.floor(r() * keys.length)];
    if (lv < 10 || r() < 0.5) return [a];
    const rest = keys.filter(k => k !== a);
    return [a, rest[Math.floor(r() * rest.length)]];
  }

  function newLevel(lv) {
    const r = rng(lv * 104729 + 3), e = ease(), mods = modsOf(lv), has = k => mods.includes(k), dl = diffLv(lv);
    // Seconds of road before the boss: varies level to level (short raids, long marches).
    const length = clamp(Math.round((36 + Math.min(lv, 50) * 0.7) * (0.72 + r() * 0.56)), 30, 95);
    // Two lanes all the way: rewards on the left, the enemy flood on the right.
    const segs = [{ s0: -1e9, lay: 'two' }];
    const events = [];
    // Rewards: gates every ~3.5 s, crates every ~11 s.
    for (let t = 2.5; t < length - 3; t += 3.1 + r() * 0.8) {
      const gv = () => {
        const neg = r() < Math.min(0.55, 0.22 + lv * 0.012);
        return neg ? -(3 + Math.floor(r() * (4 + dl / 3))) : 2 + Math.floor(r() * (3 + lv / 6));
      };
      // The first gates are always generous so a fresh squad can grow before the flood thickens.
      const val = t < 8 ? Math.max(gv(), 5 + Math.floor(lv / 4)) : gv(), val2 = gv();
      events.push({ t, kind: 'gate', mul: val > 0 && r() < 0.07, val, val2, pick: r() });
    }
    if (has('mines')) for (let t = 5; t < length - 3; t += 2.2 + r() * 2) events.push({ t, kind: 'mine', off: r() });
    let first = true;
    for (let t = 4.5; t < length - 4; t += 9 + r() * 3) {
      const x = r();
      const what = first ? 'weapon' : lv >= 2 && x < 0.2 ? 'mortar' : lv >= 3 && x < 0.38 ? 'air' : x < 0.78 ? 'weapon' : 'troops';
      events.push({ t, kind: 'crate', what, pick: r() });
      first = false;
    }
    // Enemy flood: packs only ever run down enemy lanes.
    // V2: the flood is a real crowd now (players found it too thin): ~1.8x the soldiers per pack, packs a little
    // closer together. Grunts stay one-hit-ish early on, so a growing squad mows through the blob instead of stalling.
    const packGap = Math.max(1.1, 1.85 - lv * 0.013) * (has('swarm') ? 0.75 : 1);
    for (let t = 3; t < length; t += packGap * (0.8 + r() * 0.4) * (1 + e)) {
      // The first ~20 s ramp up from half size: a fresh squad gets to grow on the reward lane before the full flood.
      const cnt = Math.round((4 + Math.min(8, lv / 3.2) + r() * 3) * (1 - e * 0.6) * (has('swarm') ? 1.25 : 1) * Math.min(1, 0.5 + t / 40));
      events.push({ t, kind: 'pack', cnt, brute: lv >= 3 && r() < Math.min(0.35, 0.08 + lv * 0.01), pick: r() });
    }
    // Snipers take position up the enemy lane and shoot at the squad: parking in the reward lane is not safe.
    if (lv >= 4 || has('sniper')) {
      const gap = has('sniper') ? 5.5 : Math.max(8, 14 - lv * 0.1);
      for (let t = 6 + r() * 3; t < length - 2; t += gap * (0.8 + r() * 0.4)) events.push({ t, kind: 'snipers', cnt: has('sniper') ? 2 + Math.floor(r() * (1 + dl / 15)) : 1, pick: r() });
    }
    events.sort((a, b) => a.t - b.t);
    // Chance for each soldier of a pack to be a special type.
    const mix = {
      bomber: has('bomber') ? 0.22 : lv >= 7 ? 0.04 : 0,
      shield: has('shield') ? 0.28 : lv >= 9 ? 0.05 : 0,
      runner: has('fast') ? 0.4 : lv >= 5 ? 0.07 : 0,
    };
    const boss = bossOf(lv);
    S = {
      lv, dl, t: 0, length, events, segs, theme: worldOf(lv), r2: rng(lv * 7919 + 11), mods, mix, boss,
      mines: [], ebullets: [],
      dist: 0, rdist: 0, homeY: 170 + Math.min(60, lv * 3) + (has('fast') ? 90 : 0), homeV: 30 + Math.min(30, lv * 1.2) + (has('fast') ? 25 : 0),
      squad: { x: 112, tx: 112, n: 5 + 2 * upgLv('squad'), weapon: 0, flash: 0 },
      bullets: [], enemies: [], gates: [], crates: [], parts: [], texts: [], castle: null, ev: [], slowT: 0, clash: { n: 0, max: 0, cd: 0 },
      mortars: [], shells: [], planes: [], bombs: [], fx: [], banner: null,
      fireT: 0, fireFlash: 0, shake: 0, reviveUsed: false, lostTotal: 0, rT: 2, cT: 7,
      airT: upgLv('air') ? airEvery(upgLv('air')) * 0.6 : Infinity,
      // Support abilities (buttons under the road): reinforcement helicopter, missile strike, shield dome.
      // `cd` counts down to ready; the first use of each comes early in the level.
      sup: Object.fromEntries(Object.keys(SUP).map(k => [k, { cd: SUP[k].first }])), helis: [], missiles: [], shieldT: 0,
      castleHp: Math.round((500 + 260 * Math.min(lv, 40) + 90 * Math.max(0, dl - 40)) * (1 - e * 0.7) * BOSSES[boss].hp),
    };
    if (R3) R3.setLevel(S, { skin: skinColor() });
  }

  // ---------- Simulation ----------
  // Big squads keep getting stronger, but with diminishing returns so the fortress stays a real fight.
  const firepower = n => (n <= 25 ? n : 25 + Math.pow(n - 25, 0.72));
  const squadHalf = () => Math.min(6, S.squad.n) * 6 + 6;
  const lanesAtTop = kind => layoutAt((kind === 'r' ? S.rdist : S.dist) + 30).filter(l => l.k === kind);
  // Enemy types: grunt, brute (big), runner (fast, homes from far), bomber (explodes on contact),
  // shield (bullets do 30%), sniper (stops up the lane and shoots).
  const lvC = () => Math.min(S.lv, 60);
  function spawnEnemy(lane, kind, y) {
    const L = lvC(), base = 1 + Math.floor(L / 15);
    const hp = kind === 'brute' ? 6 + Math.floor(L / 3) : kind === 'shield' ? 4 + Math.floor(L / 5) : kind === 'sniper' ? 3 + Math.floor(L / 6) : kind === 'bomber' ? base + 1 : base;
    const speed = SCROLL + 28 + Math.random() * 12 + (kind === 'runner' ? 55 : kind === 'shield' ? -18 : kind === 'sniper' ? 20 : 0);
    S.enemies.push({ id: nextId++, x: clamp(lane.c + (Math.random() - 0.5) * (lane.w - 26), lane.a + 10, lane.b - 10), y,
      la: lane.a, lb: lane.b, hp, max: hp, kind, brute: kind === 'brute', r: kind === 'brute' ? 14 : kind === 'shield' ? 10 : 8, speed, flash: 0,
      stopY: kind === 'sniper' ? 150 + Math.random() * 150 : 0, fireT: 1 + Math.random(), holdT: 13 });
  }
  function spawnPack(lane, cnt, brute, y0) {
    const m = S.mix;
    // The flood grows with your army: a big squad faces a bigger wave.
    cnt = Math.round(cnt * (1 + Math.min(3, S.squad.n / 45)));
    for (let i = 0; i < cnt; i++) {
      const x = Math.random();
      const kind = brute && i === 0 ? 'brute' : x < m.bomber ? 'bomber' : x < m.bomber + m.shield ? 'shield' : x < m.bomber + m.shield + m.runner ? 'runner' : 'grunt';
      spawnEnemy(lane, kind, y0 - Math.random() * 60);
    }
  }
  // Soldiers lost when an enemy reaches the squad.
  // Losses scale with the army so a huge squad still feels every hit (flat minimum early on).
  const pct = (min, p) => Math.max(min, Math.ceil(S.squad.n * p));
  const contactLoss = e => (e.kind === 'brute' ? pct(4 + Math.floor(S.dl / 6), 0.03) : e.kind === 'bomber' ? pct(4 + Math.floor(S.dl / 5), 0.05) : pct(1 + Math.floor(S.dl / 12), 0.004));
  // Enemy bullet aimed at the squad (with a little spread).
  function fireAt(x, y, speed, spread) {
    const q = S.squad, a = Math.atan2(SQUAD_Y - y, q.x - x) + (Math.random() - 0.5) * (spread || 0);
    S.ebullets.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed });
  }
  function hurtSquad(loss, x, y) {
    const q = S.squad;
    loss = Math.min(q.n, loss);
    if (loss <= 0) return;
    if (S.shieldT > 0) { S.shieldHit = 1; if (Math.random() < 0.4) floatText(q.x + (Math.random() - 0.5) * 40, SQUAD_Y - 40, L('BLOCK', 'BLOK'), '#7df9ff'); return; }
    q.n -= loss; S.lostTotal += loss; q.flash = 1; S.shake = Math.max(S.shake, 5);
    floatText(q.x, SQUAD_Y - 50, '-' + loss, '#ff8a95');
    burst(x, y, skinColor(), 6, 90); Sfx.play('hit'); UI.vibrate(30);
  }
  function spawnGate(lane, val, mul) {
    // Shooting a gate raises its number. The old cap was 10 + 0.6 x level: 11 on levels 1-2 and only 22 at level 20,
    // so pumped gates sat at "+11". The cap now grows with the difficulty level and with the squad, and the gain per
    // hit tapers past +12 (hitTarget) instead of hitting a wall.
    S.gates.push({ id: nextId++, x: lane.c, y: -30, w: lane.w - 26, val, cap: Math.round(16 + 1.6 * S.dl + Math.min(40, S.squad.n * 0.25)), mul, flash: 0 });
  }
  function spawnCrate(lane, what) {
    const hp = Math.round(14 + S.dl * 2.2);
    S.crates.push({ id: nextId++, x: lane.c, y: -30, hp, max: hp, what, flash: 0 });
  }
  function spawnEvent(ev) {
    if (ev.kind === 'gate') {
      const rl = lanesAtTop('r');
      rl.forEach((l, i) => spawnGate(l, i ? ev.val2 : ev.val, !i && ev.mul));
    } else if (ev.kind === 'crate') {
      const rl = lanesAtTop('r');
      spawnCrate(rl[Math.floor(ev.pick * rl.length)], ev.what);
    } else if (ev.kind === 'mine') {
      const l = lanesAtTop('r')[0], hp = 2 + Math.floor(S.dl / 10);
      S.mines.push({ id: nextId++, x: l.a + 22 + ev.off * (l.w - 44), y: -30, hp, max: hp, flash: 0 });
    } else if (ev.kind === 'snipers') {
      const el = lanesAtTop('e');
      for (let i = 0; i < ev.cnt; i++) {
        const l = el[Math.floor(ev.pick * el.length)];
        spawnEnemy(l, 'sniper', -20 - i * 30);
        const e = S.enemies[S.enemies.length - 1], far = l.c > MID ? l.b - 14 - Math.random() * 34 : l.a + 14 + Math.random() * 34;
        e.x = far; e.la = far - 8; e.lb = far + 8;
      }
    } else {
      const el = lanesAtTop('e');
      spawnPack(el[Math.floor(ev.pick * el.length)], ev.cnt, ev.brute, -20);
    }
  }
  function burst(x, y, c, n, sp) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = (0.3 + Math.random()) * sp; S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c }); }
  }
  function floatText(x, y, txt, c, o) { S.texts.push(Object.assign({ x, y, txt, c, life: 1, max: 1 }, o)); }
  // One-shot moments for the renderer (gate burst, army clash, boss phase...): drawing only, never read by the rules.
  const fxEvent = (kind, x, y, o) => { S.ev.push(Object.assign({ kind, x, y, life: 0.5 }, o)); };
  // Deterministic jitter (keeps the simulation's Math.random() sequence untouched).
  const hash = (a, b) => frac(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);
  function banner(txt, sub, c) { S.banner = { txt, sub, c, life: 2.6 }; }

  function hitCastle(dmg, b) {
    const C = S.castle;
    if (!C || C.dead) return;
    // Tank armour: plain bullets only scratch it.
    if (C.type === 'tank' && b && !b.splash && !b.pierce) dmg *= 0.5;
    C.hp -= dmg; C.flash = 1;
    // V3 phase change at half health (presentation only: the boss's attacks are unchanged, the balance stays).
    if (!C.phase2 && C.hp > 0 && C.hp < C.max / 2) {
      C.phase2 = true; S.shake = Math.max(S.shake, 10); Sfx.play('boss');
      banner('⚡ ' + L('ENRAGED!', 'ÖFKELENDİ!'), L('Phase 2 — finish it!', '2. faz — bitir onu!'), '#ff5a5a');
      fxEvent('phase', C.x, C.y);
    }
    if (C.hp <= 0) {
      C.dead = true; C.deadAt = performance.now(); S.shake = 16; Sfx.play('boss');
      for (let k = 0; k < 6; k++) S.fx.push({ x: C.x + (Math.random() - 0.5) * C.w, y: C.y + (Math.random() - 0.5) * 40, r: 70, life: 1, delay: k * 0.12, big: true });
      burst(C.x, C.y, '#ffd23f', 60, 200);
    }
  }
  const castleHitBy = (x, y, pad) => { const C = S.castle; return C && !C.dead && Math.abs(C.x - x) < C.w / 2 + (pad || 0) && y < C.y + C.bot + (pad || 0) && y > C.y - C.top; };

  // Explosions from rockets, mortar shells and bombs.
  function explode(x, y, rad, dmg, castleDmg) {
    S.fx.push({ x, y, r: rad, life: 1, delay: 0 });
    for (const e of S.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < rad + e.r) { e.hp -= dmg; e.flash = 1; if (e.hp <= 0) killEnemy(e); }
    for (const c of S.crates) if (c.hp > 0 && Math.hypot(c.x - x, c.y - y) < rad + 16) { c.hp -= dmg; c.flash = 1; if (c.hp <= 0) openCrate(c); }
    for (const m of S.mines) if (m.hp > 0 && Math.hypot(m.x - x, m.y - y) < rad + 10) m.hp = 0;
    if (castleDmg && castleHitBy(x, y, rad * 0.5)) hitCastle(castleDmg);
    burst(x, y, '#ffb020', 10, 120);
    S.shake = Math.max(S.shake, 5); Sfx.play('boom');
  }

  // Returns true if the bullet hit something.
  function hitTarget(b) {
    for (const e of S.enemies) {
      if (e.dead || Math.abs(e.x - b.x) > e.r + 3 || Math.abs(e.y - b.y) > e.r + 6) continue;
      if (b.splash) explode(b.x, b.y, b.splash, b.dmg * 0.6, 0);
      damageEnemy(e, e.kind === 'shield' && !b.splash && !b.pierce ? b.dmg * 0.3 : b.dmg);
      return true;
    }
    if (castleHitBy(b.x, b.y)) {
      if (b.splash) S.fx.push({ x: b.x, y: b.y, r: 26, life: 1, delay: 0 });
      hitCastle(b.dmg, b);
      return true;
    }
    for (const m of S.mines) {
      if (m.hp <= 0 || Math.abs(m.x - b.x) > 14 || Math.abs(m.y - b.y) > 14) continue;
      if ((m.hp -= 1) <= 0) { S.fx.push({ x: m.x, y: m.y, r: 30, life: 1, delay: 0 }); Sfx.play('boom'); }
      m.flash = 1;
      return true;
    }
    for (const c of S.crates) {
      if (c.hp <= 0 || Math.abs(c.x - b.x) > 30 || Math.abs(c.y - b.y) > 22) continue;
      c.hp -= b.dmg; c.flash = 1;
      if (c.hp <= 0) openCrate(c);
      return true;
    }
    for (const g of S.gates) {
      if (g.used || Math.abs(g.x - b.x) > g.w / 2 || Math.abs(g.y - b.y) > 14) continue;
      if (!g.mul) { g.val = Math.min(g.cap, g.val + 0.12 * Math.min(1, 12 / Math.max(1, g.val))); g.flash = 1; }
      return true;
    }
    return false;
  }
  function damageEnemy(e, dmg) {
    e.hp -= dmg; e.flash = 1;
    if (e.hp <= 0) killEnemy(e);
  }
  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    burst(e.x, e.y, '#ff4757', e.brute ? 14 : 5, 80);
    // A shot bomber blows up its neighbours.
    if (e.kind === 'bomber') explode(e.x, e.y, 42, 3 + S.dl * 0.2, 0);
    else if (Math.random() < 0.3) Sfx.play('pop');
  }
  function openCrate(c) {
    burst(c.x, c.y, '#ffd23f', 26, 130); Sfx.play('coin'); UI.vibrate(20);
    let what = c.what;
    if (what === 'weapon' && S.squad.weapon >= WEAPONS.length - 1) what = 'troops';
    if (what === 'mortar' && S.mortars.length >= 3) what = 'air';
    if (what === 'weapon') {
      S.squad.weapon++;
      const w = WEAPONS[S.squad.weapon];
      UI.toast(w.icon + ' ' + w.name + '!'); floatText(c.x, c.y - 30, w.name.toUpperCase() + '!', '#ffe066');
    } else if (what === 'mortar') {
      S.mortars.push({ t: 0.6 + S.mortars.length * 0.8, recoil: 0, x: S.squad.x, y: SQUAD_Y });
      UI.toast(L('💣 Mortar team joined!', '💣 Havan ekibi katıldı!')); floatText(c.x, c.y - 30, L('MORTAR!', 'HAVAN!'), '#ffe066');
    } else if (what === 'air') {
      callAir(); floatText(c.x, c.y - 30, L('AIR STRIKE!', 'HAVA SALDIRISI!'), '#7df9ff');
    } else {
      const add = 6 + Math.floor(S.lv / 4) + Math.round(Math.min(30, S.squad.n * 0.08));
      S.squad.n += add; floatText(c.x, c.y - 30, '+' + add + L(' SOLDIERS', ' ASKER'), '#9dffc2');
    }
  }

  // Air strike: a bomber flies up the busiest enemy lane (or over the castle) carpet-bombing it.
  function callAir() {
    const C = S.castle;
    let x;
    if (C && !C.dead) x = C.x;
    else {
      const el = layoutAt(S.dist - 300).filter(l => l.k === 'e');
      let best = -1;
      for (const l of el) { const n = S.enemies.filter(e => e.x >= l.a && e.x < l.b && e.y > 0).length; if (n > best) { best = n; x = l.c; } }
    }
    S.planes.push({ x, y: H + 180, speed: 400, dropT: 0, bombs: 12 });
    UI.toast(L('✈️ Air strike!', '✈️ Hava saldırısı!')); Sfx.play('plane');
  }
  const supUnlocked = k => (S ? S.lv : G.level) >= SUP[k].lv;
  function useSupport(k) {
    if (mode !== 'play' || paused || !S || !S.sup[k] || S.sup[k].cd > 0 || !supUnlocked(k)) return;
    const q = S.squad;
    S.sup[k].cd = SUP[k].cd;
    if (k === 'heli') {
      const total = 6 + Math.floor(S.lv / 2) + Math.round(Math.min(40, q.n * 0.1));
      S.helis.push({ x: q.x, y: H + 260, st: 'in', t: 0, dropT: 0.4, gunT: 0.5, total, left: total, got: 0 });
      UI.toast(L('🚁 Reinforcements inbound!', '🚁 Takviye geliyor!')); Sfx.play('plane');
    } else if (k === 'strike') {
      // Targets: the densest enemy clusters still up the road, or the boss.
      const pts = [], C = S.castle;
      const live = S.enemies.filter(e => !e.dead && e.y > 60 && e.y < SQUAD_Y - 60);
      for (let i = 0; i < 8; i++) {
        if (live.length) { const e = live[(i * 7) % live.length]; pts.push({ x: e.x + (Math.random() - 0.5) * 20, y: e.y + e.speed * 0.6 }); }
        else if (C && !C.dead) pts.push({ x: C.x + (Math.random() - 0.5) * C.w * 0.8, y: C.y + 10 + Math.random() * 20 });
        else pts.push({ x: layoutAt(S.dist).find(l => l.k === 'e').c + (Math.random() - 0.5) * 120, y: 160 + Math.random() * 260 });
      }
      pts.forEach((p, i) => S.missiles.push({ x0: p.x - 160, y0: p.y - 260, tx: clamp(p.x, ROAD_L + 8, ROAD_R - 8), ty: p.y, x: p.x - 160, y: p.y - 260, h: 520, u: 0, delay: i * 0.12 }));
      UI.toast(L('🚀 Missile strike!', '🚀 Füze yağmuru!')); Sfx.play('plane');
    } else {
      S.shieldT = 6;
      UI.toast(L('🛡️ Shield up!', '🛡️ Kalkan açık!')); Sfx.play('card');
    }
    supHud();
  }
  // Ability buttons: an icon with a cooldown ring (conic gradient), dimmed until ready; locked ones show the level.
  function supHud() {
    const bar = $('sup');
    if (!bar) return;
    const show = S && mode === 'play';
    bar.style.display = show ? '' : 'none';
    if (!show) return;
    for (const k in SUP) {
      const b = bar.querySelector('[data-sup=' + k + ']');
      if (!b) continue;
      const lock = !supUnlocked(k), cd = S.sup[k].cd, f = lock ? 0 : 1 - cd / SUP[k].cd, ready = !lock && cd <= 0, act = (k === 'shield' && S.shieldT > 0) || (k === 'heli' && S.helis.length);
      b.className = 'sup' + (ready ? ' ready' : '') + (lock ? ' lock' : '') + (act ? ' act' : '');
      b.style.setProperty('--f', (Math.round(f * 1000) / 10) + '%');
      const t = b.querySelector('i');
      if (t) t.textContent = lock ? L('Lv ', 'Sv ') + SUP[k].lv : ready ? SUP[k].name : Math.ceil(cd) + L(' s', ' sn');
    }
  }
  function mortarTarget() {
    let best = null, bestN = 0;
    for (const e of S.enemies) {
      if (e.dead || e.y < 120 || e.y > SQUAD_Y - 140) continue;
      let n = e.brute ? 3 : 1;
      for (const o of S.enemies) if (o !== e && Math.abs(o.x - e.x) < 44 && Math.abs(o.y - e.y) < 44) n++;
      if (n > bestN) { bestN = n; best = e; }
    }
    if (best) return { x: best.x, y: Math.min(SQUAD_Y - 90, best.y + best.speed * 1.15) };
    const C = S.castle;
    if (C && !C.dead && C.y >= CASTLE_Y - 5) return { x: C.x + (Math.random() - 0.5) * C.w * 0.6, y: C.y + 10 };
    return null;
  }

  function update(dt) {
    S.t += dt;
    S.shake = Math.max(0, S.shake - dt * 18);
    const q = S.squad;
    q.x += (q.tx - q.x) * Math.min(1, dt * 12);
    q.flash = Math.max(0, q.flash - dt * 4);
    S.fireFlash = Math.max(0, S.fireFlash - dt);

    const C = S.castle;
    // The road (enemy side) stops once the castle is reached; the reward lane keeps delivering.
    if (!(C && C.arrived)) S.dist += SCROLL * dt;
    S.rdist += SCROLL * dt;
    while (S.events.length && S.events[0].t <= S.t) spawnEvent(S.events.shift());
    if (S.banner && (S.banner.life -= dt) <= 0) S.banner = null;

    // End of the road: the level's boss arrives on the enemy lane and fights until it falls.
    if (!C && S.t >= S.length) {
      const el = layoutAt(S.dist + 90).find(l => l.k === 'e'), B = BOSSES[S.boss];
      const box = { kale: [el.w - 16, 60, 40, CASTLE_Y], dev: [64, 80, 20, SQUAD_Y - 80], tank: [104, 40, 30, 170], heli: [92, 40, 30, 210], ejder: [110, 40, 30, 190] }[S.boss];
      S.castle = { type: S.boss, x: el.c, w: box[0], top: box[1], bot: box[2], stopY: box[3], lane: el, y: -90, hp: S.castleHp, max: S.castleHp,
        flash: 0, spawnT: 2, gunT: 4, mgT: 3, hitT: 1.2, arrived: false, t: 0 };
      banner(B.icon + ' ' + B.name.toUpperCase(), B.sub, '#ff8a95'); Sfx.play('boss');
    }
    if (C && !C.dead) {
      C.flash = Math.max(0, C.flash - dt * 6);
      C.t += dt;
      const lv = S.dl, slow = 1 + ease();
      if (C.type === 'dev') {
        // The giant keeps walking toward the squad and smashes it once it gets there.
        C.arrived = C.y >= 0;
        if (C.y < C.stopY) C.y += (C.y < 0 ? SCROLL : 15 + Math.min(lv, 60) * 0.12) * dt;
        if (C.y > 260) C.x += clamp(q.x - C.x, -1, 1) * 24 * dt;
        if (C.y >= C.stopY - 4 && (C.hitT -= dt) <= 0) {
          C.hitT = 1.6 * slow; S.shake = 12; Sfx.play('giant');
          S.fx.push({ x: C.x, y: C.y + 30, r: 60, life: 1, delay: 0 });
          if (Math.abs(q.x - C.x) < 90) hurtSquad(Math.max(3, Math.ceil(q.n * 0.14)), q.x, SQUAD_Y);
        }
      } else {
        if (C.y < C.stopY) C.y = Math.min(C.stopY, C.y + SCROLL * dt);
        C.arrived = C.y >= C.stopY;
      }
      if (C.type === 'tank' && C.arrived) C.x = MID + Math.sin(C.t * 0.45) * 130;           // sweeps across both lanes
      if (C.type === 'ejder' && C.arrived) C.x = MID + Math.sin(C.t * 0.38) * 120 + clamp(q.x - MID, -40, 40) * 0.5; // circles over the road
      if (C.type === 'heli' && C.arrived) C.x += clamp(q.x - C.x, -1, 1) * Math.min(Math.abs(q.x - C.x) * 3, 58) * dt;
      C.spawnT -= dt;
      if (C.spawnT <= 0 && C.arrived) {
        C.spawnT = (C.type === 'kale' ? Math.max(1.4, 3 - lv * 0.03) : 4) * slow;
        spawnPack(C.type === 'kale' ? C.lane : layoutAt(S.dist + 30).find(l => l.k === 'e'), Math.round((C.type === 'kale' ? 2 : 1) + Math.min(6, lv / 5)), lv >= 3 && Math.random() < 0.3, C.type === 'kale' ? C.y + 50 : -20);
      }
      // Cannon shells (castle, tank, helicopter bombs); the landing spot is marked so it can be dodged.
      if (C.type !== 'dev' && C.arrived && (C.gunT -= dt) <= 0) {
        C.gunT = (C.type === 'heli' ? 5 : C.type === 'tank' ? 2.4 : C.type === 'ejder' ? 4.2 : Math.max(1.6, 3.2 - lv * 0.02)) * slow;
        const side = Math.random() < 0.5 ? -1 : 1;
        if (C.type === 'ejder') {
          // Fire breath: three fireballs fan out over the squad's side of the road; each landing spot is marked.
          for (let k = -1; k <= 1; k++) S.shells.push({ foe: true, fire: true, x0: C.x, y0: C.y + 30, x1: clamp(q.x + k * 70 + (Math.random() - 0.5) * 20, ROAD_L + 10, ROAD_R - 10), y1: SQUAD_Y + 4, u: -0.12 * (k + 1), dur: 1.35, x: C.x, y: C.y, h: 0 });
          Sfx.play('boom');
        } else {
          S.shells.push({ foe: true, x0: C.x + side * C.w * 0.2, y0: C.y + 20, x1: clamp(q.x + (Math.random() - 0.5) * 30, ROAD_L + 10, ROAD_R - 10), y1: SQUAD_Y + 4, u: 0, dur: 1.5, x: C.x, y: C.y, h: 0 });
          Sfx.play('mortar');
        }
      }
      // Machine-gun bursts from the tank and the helicopter.
      if ((C.type === 'tank' || C.type === 'heli') && C.arrived && (C.mgT -= dt) <= 0) {
        C.mgT = (C.type === 'heli' ? 2.6 : 3.5) * slow;
        for (let k = 0; k < 6; k++) fireAt(C.x + (k - 2.5) * 5, C.y + C.bot, 250 + k * 12, 0.05);
      }
      // The drake spits a fan of embers between its breaths.
      if (C.type === 'ejder' && C.arrived && (C.mgT -= dt) <= 0) {
        C.mgT = 3.1 * slow;
        for (let k = 0; k < 5; k++) { fireAt(C.x, C.y + C.bot, 210, 0); const b = S.ebullets[S.ebullets.length - 1], a = (k - 2) * 0.16, c = Math.cos(a), sn = Math.sin(a); const vx = b.vx * c - b.vy * sn; b.vy = b.vx * sn + b.vy * c; b.vx = vx; b.ember = true; }
      }
      // Rewards keep coming down the reward lane during the siege.
      const r = S.r2;
      if ((S.rT -= dt) <= 0) {
        S.rT = 4.2 + r() * 1.2;
        for (const l of lanesAtTop('r')) spawnGate(l, r() < 0.45 ? -(3 + Math.floor(r() * (3 + S.dl / 5))) : 3 + Math.floor(r() * (4 + S.lv / 5)), false);
      }
      if ((S.cT -= dt) <= 0) {
        S.cT = 9 + r() * 3;
        const x = r(), rl = lanesAtTop('r');
        spawnCrate(rl[0], x < 0.25 ? 'mortar' : x < 0.5 ? 'air' : x < 0.8 ? 'weapon' : 'troops');
      }
    }

    // Fire: one volley = up to 12 bullets; damage scales with the squad size. The shooters are spread over the whole
    // formation (a different set of soldiers each volley) and fire from their own place in it, with a slight spread,
    // so a volley reads as a ragged salvo instead of one straight row of bullets. The jitter is a fixed hash, not
    // Math.random(), so the simulation's random sequence is unchanged.
    const w = WEAPONS[q.weapon];
    S.fireT -= dt;
    if (S.fireT <= 0 && q.n > 0) {
      S.fireT = w.rate / (1 + 0.06 * upgLv('rate'));
      S.fireFlash = 0.07;
      const k = Math.min(q.n, 12), per = w.dmg * (1 + 0.08 * upgLv('dmg')) * firepower(q.n) / k;
      const form = formation(q.n), nf = form.length, vol = S.volley = (S.volley || 0) + 1;
      for (let i = 0; i < k; i++) {
        const f = form[Math.floor((i + frac(vol * 0.618)) * nf / k) % nf], h1 = frac(Math.sin(vol * 12.9898 + i * 78.233) * 43758.5453), h2 = frac(h1 * 7.31 + i * 0.17);
        const bx = q.x + f.x + (h1 - 0.5) * 5, by = SQUAD_Y - 14 + Math.min(f.y, 44) * 0.8 - h2 * 10, jv = (h2 - 0.5) * 16;
        for (let sp = 0; sp < w.spread; sp++) {
          S.bullets.push({ x: bx, y: by, vx: (sp - (w.spread - 1) / 2) * 90 + jv, dmg: per / w.spread, speed: w.speed, splash: w.splash, pierce: w.pierce, kind: w.kind, hits: 0 });
        }
      }
      if (Math.random() < 0.5) Sfx.play('shoot');
    }
    for (const b of S.bullets) {
      b.y -= b.speed * dt; b.x += b.vx * dt;
      if (hitTarget(b) && (!b.pierce || ++b.hits > 3)) b.dead = true;
      if (b.y < -60) b.dead = true;
    }
    S.bullets = S.bullets.filter(b => !b.dead);

    // Mortar teams walk beside the squad and lob shells at the thickest part of the flood.
    const mh = squadHalf();
    S.mortars.forEach((m, i) => {
      m.x = q.x + (i % 2 ? 1 : -1) * (mh + 18); m.y = SQUAD_Y + 16 + Math.floor(i / 2) * 26;
      m.recoil = Math.max(0, m.recoil - dt * 3);
      if ((m.t -= dt) > 0) return;
      const tg = mortarTarget();
      if (!tg) { m.t = 0.5; return; }
      m.t = 2.4; m.recoil = 1;
      S.shells.push({ x0: m.x, y0: m.y - 10, x1: tg.x, y1: tg.y, u: 0, dur: 1.15, x: m.x, y: m.y, h: 0 });
      Sfx.play('mortar');
    });
    for (const s of S.shells) {
      s.u += dt / s.dur;
      const u = clamp(s.u, 0, 1);
      s.x = s.x0 + (s.x1 - s.x0) * u; s.y = s.y0 + (s.y1 - s.y0) * u; s.h = 4 * 170 * u * (1 - u) + 10 * (1 - u);
      if (s.u < 1) continue;
      s.dead = true;
      if (!s.foe) { explode(s.x1, s.y1, 48, 3 + 0.35 * Math.min(S.lv, 80), S.castleHp * 0.008); continue; }
      S.fx.push({ x: s.x1, y: s.y1, r: 40, life: 1, delay: 0 }); S.shake = Math.max(S.shake, 7); Sfx.play('boom');
      if (Math.abs(q.x - s.x1) < squadHalf() + 16) {
        hurtSquad(s.fire ? pct(2 + Math.floor(S.dl / 10), 0.05) : pct(2 + Math.floor(S.dl / 8), 0.08), s.x1, s.y1);
      }
    }
    S.shells = S.shells.filter(s => !s.dead);

    // Air support: periodic bomber from the upgrade, plus the ones from crates.
    if ((S.airT -= dt) <= 0) {
      S.airT = airEvery(upgLv('air'));
      if (S.enemies.length >= 3 || (C && !C.dead)) callAir();
    }
    for (const p of S.planes) {
      p.y -= p.speed * dt;
      if (p.bombs > 0 && p.y < SQUAD_Y - 50 && (p.dropT -= dt) <= 0) {
        p.dropT = 0.09; p.bombs--;
        S.bombs.push({ x: p.x + (Math.random() - 0.5) * 36, y: p.y, h: 120, vh: 0, vy: -p.speed * 0.45 });
      }
      if (p.y < -700) p.dead = true;
    }
    S.planes = S.planes.filter(p => !p.dead);
    for (const b of S.bombs) {
      b.vh -= 520 * dt; b.h += b.vh * dt; b.y += b.vy * dt;
      if (b.h <= 0) { b.dead = true; explode(b.x, b.y, 44, 5 + 0.5 * Math.min(S.lv, 80), S.castleHp * 0.05); }
    }
    S.bombs = S.bombs.filter(b => !b.dead);

    // Support abilities.
    for (const k in S.sup) S.sup[k].cd = Math.max(0, S.sup[k].cd - dt);
    S.shieldT = Math.max(0, S.shieldT - dt); S.shieldHit = Math.max(0, (S.shieldHit || 0) - dt * 3);
    // Reinforcement helicopter: flies in over the squad, hovers while soldiers slide down two ropes and the door
    // gunner sprays the nearest enemies, then climbs away up the road.
    for (const h of S.helis) {
      h.t += dt;
      if (h.st === 'in') { h.y += (SQUAD_Y - 40 - h.y) * Math.min(1, dt * 3); h.x += (q.x - h.x) * Math.min(1, dt * 4); if (h.t > 1.3) { h.st = 'hover'; h.t = 0; } }
      else if (h.st === 'hover') {
        h.x += (q.x - h.x) * Math.min(1, dt * 4);
        if ((h.dropT -= dt) <= 0 && h.left > 0) { h.dropT = 0.32; const k = Math.min(h.left, Math.max(1, Math.round(h.total / 12))); h.left -= k; q.n += k; h.got += k; if (h.got >= h.total / 3 || !h.left) { floatText(q.x, SQUAD_Y - 60, '+' + h.got, '#9dffc2'); h.got = 0; } Sfx.play('card'); }
        if ((h.gunT -= dt) <= 0) {
          h.gunT = 0.11;
          let tg = null;
          for (const e of S.enemies) if (!e.dead && e.y > 80 && (!tg || e.y > tg.y)) tg = e;
          const C2 = S.castle, tx = tg ? tg.x : C2 && !C2.dead ? C2.x : null, ty = tg ? tg.y : C2 && !C2.dead ? C2.y : null;
          if (tx != null) { const bx = h.x + 22, by = h.y - 10, sp = 760, ux = (tx - bx) / Math.max(40, by - ty); S.bullets.push({ x: bx, y: by, vx: clamp(ux, -1.2, 1.2) * sp, dmg: 1.2 + S.dl * 0.06, speed: sp, kind: 'bullet', hits: 0, heli: true, y0: by }); }
        }
        if (h.t > 5.2) { h.st = 'out'; h.t = 0; }
      } else { h.y -= (120 + h.t * 380) * dt; if (h.y < -400) h.dead = true; }
    }
    S.helis = S.helis.filter(h => !h.dead);
    // Missile strike: each missile falls from high up on a slant onto the densest spot it was given.
    for (const m of S.missiles) {
      if ((m.delay -= dt) > 0) continue;
      m.u += dt / 0.75;
      const u = Math.min(1, m.u); m.x = m.x0 + (m.tx - m.x0) * u; m.y = m.y0 + (m.ty - m.y0) * u; m.h = 520 * (1 - u);
      if (u >= 1) { m.dead = true; explode(m.tx, m.ty, 50, 6 + 0.6 * Math.min(S.lv, 80), S.castleHp * 0.035); }
    }
    S.missiles = S.missiles.filter(m => !m.dead);

    // Gates & crates ride the reward lane toward the squad; the squad collects gates it runs through.
    for (const g of S.gates) {
      g.y += SCROLL * dt; g.flash = Math.max(0, g.flash - dt * 6);
      if (!g.used && g.y >= SQUAD_Y - 12 && Math.abs(q.x - g.x) < g.w / 2 + 6) {
        g.used = true;
        const before = q.n;
        q.n = g.mul ? q.n * 2 : Math.max(0, q.n + Math.floor(g.val));
        const d = q.n - before;
        floatText(q.x, SQUAD_Y - 50, (g.mul ? '×2  +' : d >= 0 ? '+' : '') + d, d >= 0 ? (g.mul ? '#ffd23f' : '#9dffc2') : '#ff8a95', { big: true, life: 1.3, max: 1.3 });
        // V3: little numbers fly off the gate into the squad (one per soldier gained, capped), a flash at the gate.
        if (d > 0) for (let k = 0, nk = Math.min(10, d); k < nk; k++) {
          const hx = hash(g.id, k), hy = hash(k, g.id);
          floatText(g.x + (hx - 0.5) * g.w * 0.9, g.y - 6, '+' + Math.max(1, Math.round(d / nk)), g.mul ? '#ffe066' : '#b9ffd6', { small: true, life: 0.75, max: 0.75, fx: q.x + (hx - 0.5) * 50, fy: SQUAD_Y - 10 + hy * 20, x0: g.x + (hx - 0.5) * g.w * 0.9, y0: g.y - 6 - hy * 30 });
        }
        fxEvent('gate', g.x, g.y, { d, mul: g.mul, w: g.w });
        Sfx.play(g.mul ? 'mega' : d >= 0 ? 'card' : 'hit'); if (g.mul) { S.shake = Math.max(S.shake, 6); UI.vibrate(40); }
        if (d < 0) { q.flash = 1; S.lostTotal -= d; }
      }
    }
    S.gates = S.gates.filter(g => !g.used && g.y < H + 40);
    for (const c of S.crates) { c.y += SCROLL * dt; c.flash = Math.max(0, c.flash - dt * 6); }
    S.crates = S.crates.filter(c => c.hp > 0 && c.y < H + 40);

    // Enemies stay in their lane until they are close, then swarm the squad; contact costs soldiers.
    for (const e of S.enemies) {
      if (e.dead) continue;
      e.y += e.speed * dt; e.flash = Math.max(0, e.flash - dt * 6);
      if (e.kind === 'sniper' && e.stopY) {
        // Snipers hold position up the enemy lane and keep shooting, then charge after a while.
        if (e.y >= e.stopY) {
          e.y -= e.speed * dt;
          if ((e.fireT -= dt) <= 0) { e.fireT = 1.8 * (1 + ease()); fireAt(e.x, e.y + 8, 240, 0.12); }
          if ((e.holdT -= dt) <= 0) e.stopY = 0;
        }
        e.x = clamp(e.x, e.la + 8, e.lb - 8);
      } else if (e.y > SQUAD_Y - S.homeY) e.x += clamp((q.x - e.x) / 20, -1, 1) * S.homeV * dt;
      else e.x = clamp(e.x, e.la + 8, e.lb - 8);
      if (e.y >= SQUAD_Y - 10 && Math.abs(e.x - q.x) < squadHalf() + e.r) {
        e.dead = true;
        if (e.kind === 'bomber') { S.fx.push({ x: e.x, y: e.y, r: 44, life: 1, delay: 0 }); Sfx.play('boom'); }
        else { fxEvent('clash', e.x, SQUAD_Y - 8, { big: e.brute }); Sfx.play('clash'); }
        hurtSquad(contactLoss(e), q.x, SQUAD_Y);
      }
      if (e.y > H + 30) e.dead = true;
    }
    S.enemies = S.enemies.filter(e => !e.dead);
    // V3 clash moment: when a big wave that reached the squad is wiped out to the last man, time slows for a beat.
    { const cl = S.clash; let near = 0; cl.cd = Math.max(0, cl.cd - dt);
      for (const e of S.enemies) if (e.y > SQUAD_Y - 230 && Math.abs(e.x - q.x) < 160) near++;
      cl.max = Math.max(cl.max, near);
      if (near === 0) { if (cl.max >= 10 && cl.n > 0 && cl.cd <= 0 && q.n > 0) { S.slowT = 0.6; cl.cd = 14; fxEvent('cleared', q.x, SQUAD_Y - 120); floatText(q.x, SQUAD_Y - 120, L('WAVE CRUSHED!', 'DALGA EZİLDİ!'), '#ffe066', { big: true, life: 1.4, max: 1.4 }); Sfx.play('slow'); } cl.max = 0; }
      cl.n = near; }
    for (const v of S.ev) v.life -= dt;
    if (S.ev.length) S.ev = S.ev.filter(v => v.life > 0);
    // Enemy bullets.
    for (const b of S.ebullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (Math.abs(b.x - q.x) < squadHalf() + 2 && Math.abs(b.y - SQUAD_Y - 10) < 16) { b.dead = true; hurtSquad(pct(1 + Math.floor(S.dl / 15), 0.015), b.x, b.y); }
      if (b.y > H + 20 || b.x < -20 || b.x > W + 20) b.dead = true;
    }
    S.ebullets = S.ebullets.filter(b => !b.dead);
    // Mines ride the reward lane; running over one costs soldiers unless it was shot first.
    for (const m of S.mines) {
      m.y += SCROLL * dt; m.flash = Math.max(0, m.flash - dt * 6);
      if (m.hp > 0 && m.y >= SQUAD_Y - 10 && m.y < SQUAD_Y + 20 && Math.abs(m.x - q.x) < squadHalf() + 6) {
        m.hp = 0; S.fx.push({ x: m.x, y: m.y, r: 40, life: 1, delay: 0 }); Sfx.play('boom');
        hurtSquad(pct(3 + Math.floor(S.dl / 8), 0.06), m.x, m.y);
      }
    }
    S.mines = S.mines.filter(m => m.hp > 0 && m.y < H + 40);
    for (const p of S.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt * 1.7; }
    S.parts = S.parts.filter(p => p.life > 0);
    for (const f of S.fx) { if (f.delay > 0) f.delay -= dt; else f.life -= dt * (f.big ? 0.9 : 1.5); }
    S.fx = S.fx.filter(f => f.life > 0);
    for (const t of S.texts) {
      t.life -= dt;
      if (t.fx != null) { const u = 1 - t.life / t.max, e2 = u * u; t.x = t.x0 + (t.fx - t.x0) * e2; t.y = t.y0 + (t.fy - t.y0) * e2 - Math.sin(u * Math.PI) * 40; }
      else t.y -= (t.big ? 26 : 40) * dt;
    }
    S.texts = S.texts.filter(t => t.life > 0);

    hud();
    if (C && C.dead) win();
    else if (q.n <= 0) lose();
  }

  // ---------- Input: drag anywhere to steer the squad ----------
  let dragging = false;
  cvs.addEventListener('pointerdown', e => {
    if (mode !== 'play' || paused) return;
    dragging = true; S.squad.tx = clamp(toWorld(e).x, ROAD_L + 14, ROAD_R - 14);
    try { cvs.setPointerCapture(e.pointerId); } catch (_) { }
  });
  cvs.addEventListener('pointermove', e => { if (dragging && S) S.squad.tx = clamp(toWorld(e).x, ROAD_L + 14, ROAD_R - 14); });
  const stop = () => { dragging = false; };
  cvs.addEventListener('pointerup', stop);
  cvs.addEventListener('pointercancel', stop);
  const supBar = $('sup');
  if (supBar && supBar.addEventListener) supBar.addEventListener('pointerdown', e => {
    const b = e.target && e.target.closest ? e.target.closest('[data-sup]') : null;
    if (b) { e.stopPropagation(); if (e.preventDefault) e.preventDefault(); useSupport(b.dataset.sup); }
  });

  // ---------- Screens ----------
  function hud() {
    const lv = S && mode !== 'menu' ? S.lv : G.level;
    UI.html($('lvl'), L('Level ', 'Seviye ') + lv + '<small>' + worldOf(lv).icon + ' ' + worldOf(lv).name + '</small>');
    UI.txt($('coins'), Kit.fmt(Save.data.coins));
    if (S && mode === 'play') {
      const w = WEAPONS[S.squad.weapon];
      UI.html($('hp'), '🪖 ' + S.squad.n + ' &nbsp;·&nbsp; ' + w.icon + ' ' + w.name + (S.mortars.length ? ' &nbsp;·&nbsp; 💣' + S.mortars.length : ''));
      UI.prop($('prog'), 'width', Math.min(100, Math.round(S.t / S.length * 1000) / 10) + '%');
    } else { UI.html($('hp'), '🪖 ' + (5 + 2 * upgLv('squad'))); UI.prop($('prog'), 'width', '0%'); }
    supHud();
  }
  function panel(html, center) {
    // Redrawing an open panel (tab switch, upgrade) swaps its content only, so the pop-in animation doesn't replay.
    const ov = $('ov'), cls = 'overlay' + (center ? ' center' : ''), sh = ov.className === cls && ov.querySelector(':scope > .sheet');
    ov.className = cls;
    if (sh) sh.innerHTML = html; else ov.innerHTML = '<div class="sheet">' + html + '</div>';
    Ads.banner(true); hud();
  }
  function closePanel() { $('ov').classList.add('hidden'); Ads.banner(false); }

  const HELP =
    L('<div class="upg"><div><b>👆 Swipe</b><small>Move your squad left and right with your finger. Your soldiers fire non-stop.</small></div></div>', '<div class="upg"><div><b>👆 Kaydır</b><small>Parmağınla takımını sağa sola götür. Askerlerin sürekli ateş eder.</small></div></div>') +
    L('<div class="upg"><div><b>🟩 Reward lane</b><small>Only rewards come down here. Pass a gate to gain soldiers; shooting a gate raises its number — even minus gates turn positive!</small></div></div>', '<div class="upg"><div><b>🟩 Ödül şeridi</b><small>Buradan sadece ödül gelir. Kapıdan geçince asker kazanırsın; kapıyı vurdukça sayısı artar, eksi kapılar bile artıya döner!</small></div></div>') +
    L('<div class="upg"><div><b>📦 Crates</b><small>Shoot them open: a new weapon (pistol → rifle → machine gun → shotgun → rocket launcher → laser), 💣 mortar team, ✈️ air strike or extra soldiers.</small></div></div>', '<div class="upg"><div><b>📦 Sandıklar</b><small>Vurup kır: yeni silah (tabanca → tüfek → makineli → pompalı → roketatar → lazer), 💣 havan ekibi, ✈️ hava saldırısı ya da ek asker.</small></div></div>') +
    L('<div class="upg"><div><b>🟥 Enemy lane</b><small>The enemy flood comes down here and attacks your squad up close. 🎯 Snipers shoot from afar: switch to the enemy lane to hit them!</small></div></div>', '<div class="upg"><div><b>🟥 Düşman şeridi</b><small>Düşman seli buradan akar ve yaklaşınca takımına saldırır. 🎯 Nişancılar uzaktan ateş eder: onları vurmak için düşman şeridine geçmen gerekir!</small></div></div>') +
    L('<div class="upg"><div><b>⚠️ Level twists</b><small>Every level is different: snipers, bombers, shield bearers, fast floods, minefields, swarms…</small></div></div>', '<div class="upg"><div><b>⚠️ Seviye özellikleri</b><small>Her seviye farklı: nişancılar, bombacılar, kalkanlılar, hızlı sel, mayınlı yol, kalabalık…</small></div></div>') +
    L('<div class="upg"><div><b>👹 Bosses</b><small>At the end of the road: 🏰 castle, 👹 armoured giant, 🛡️ tank, 🚁 gunship and 🐉 fire drake in turn. The reward lane keeps flowing: power up, then charge the boss.</small></div></div>', '<div class="upg"><div><b>👹 Bosslar</b><small>Yolun sonunda sırayla 🏰 kale, 👹 zırhlı dev, 🛡️ tank, 🚁 helikopter ve 🐉 ateş ejderi. Ödül şeridi akmaya devam eder: güçlen, sonra bossa yüklen.</small></div></div>') +
    L('<div class="upg"><div><b>🚁 Support</b><small>Buttons at the bottom: 🚁 reinforcement helicopter (drops soldiers, its gunner covers you), 🚀 missile strike on the thickest enemies, 🛡️ shield dome that blocks all losses for 6 s. They recharge on their own.</small></div></div>', '<div class="upg"><div><b>🚁 Destek</b><small>Alttaki düğmeler: 🚁 takviye helikopteri (asker indirir, kapı nişancısı korur), 🚀 en kalabalık düşmanlara füze yağmuru, 🛡️ 6 sn boyunca hiç asker kaybettirmeyen kalkan. Kendiliğinden dolarlar.</small></div></div>');

  function startMenu() {
    mode = 'menu';
    newLevel(G.level);
    const coins = Save.data.coins;
    const items = Object.keys(UPG).map(k => ({ key: k, icon: UPG[k].icon, name: UPG[k].name, level: upgLv(k), max: UPG[k].max, desc: upgDesc(k), cost: upgCost(k) }));
    const tabBody = menuTab === 'shop' ? Kit.shop('suru', G, startMenu, { packSkin: L('Royal Gold', 'Kraliyet Altını'), skins: SKINS, packKey: 'kral', art: skinArt, packDesc: L('Gold armour, a crown, a red cape and a sparkle trail for your whole crowd', 'Tüm kalabalığına altın zırh, taç, kırmızı pelerin ve parıltı izi') }) : menuTab === 'skin' ? Kit.skins(SKINS, G, coins, skinArt) : menuTab === 'help' ? HELP : Kit.upgrades(items, G.gold, '💰');
    panel(Kit.hero('suru.webp', 'Crowd Surge') +
      Kit.road(G.level, () => false) +
      '<span class="chip">' + BOSSES[S.boss].icon + ' ' + BOSSES[S.boss].name + L(' · ' + S.length + ' s road', ' · ' + S.length + ' sn yol') + (S.mods.length ? ' · ' + S.mods.map(k => MODS[k].icon + ' ' + MODS[k].name).join(', ') : '') + '</span>' +
      '<button class="btn green big pulse" data-act="play">' + L('PLAY', 'OYNA') + '</button>' +
      (startGunAd ? '<span class="chip">' + L('🔥 You start with a machine gun', '🔥 Makineliyle başlıyorsun') + '</span>' : '<button class="btn purple" data-act="gunAd"><span class="ad-ico">AD</span>' + L('🔥 Start with machine gun', '🔥 Makineliyle başla') + '</button>') +
      Kit.tabs(menuTab, [{ id: 'up', label: L('⚡ Upgrade', '⚡ Geliştir') }, { id: 'skin', label: L('🎨 Outfit', '🎨 Kıyafet') }, { id: 'shop', label: L('🛒 Shop', '🛒 Mağaza') }, { id: 'help', label: L('❓ How', '❓ Nasıl') }]) +
      tabBody +
      '<div class="row" style="justify-content:center"><button class="btn gray small" data-act="home">' + L('⌂ Home', '⌂ Ana Menü') + '</button></div>');
  }
  function win() {
    mode = 'end';
    const lv = S.lv;
    pendingReward = Math.round((30 + 6 * Math.min(lv, 60) + Math.max(0, lv - 60) + Math.min(200, S.squad.n * 2)) * PlayerLv.mul()); // player level bonus
    G.level = lv + 1; G.best = Math.max(G.best, lv); G.fails = 0; Save.save();
    Ads.track('level_win', { game: 'suru', level: lv, squad: S.squad.n, weapon: S.squad.weapon, time: Math.round(S.t) });
    UI.vibrate(80); Sfx.play('win');
    const stars = S.lostTotal === 0 ? 3 : S.squad.n >= 20 ? 2 : 1;
    pendingStars = stars + (lv % 10 === 0 ? 3 : 0);
    setTimeout(() => panel(Kit.win({ title: { kale: L('CASTLE DOWN!', 'KALE DÜŞTÜ!'), dev: L('GIANT TOPPLED!', 'DEV DEVRİLDİ!'), tank: L('TANK WRECKED!', 'TANK HURDA!'), heli: L('GUNSHIP DOWN!', 'HELİKOPTER DÜŞTÜ!'), ejder: L('DRAKE SLAIN!', 'EJDER YENİLDİ!') }[S.boss], sub: L('Level ', 'Seviye ') + lv + ' · ' + S.squad.n + L(' soldiers · ', ' asker · ') + WEAPONS[S.squad.weapon].name, stars, reward: pendingReward, gems: pendingStars, ads: Kit.adsFor(G.level - 1) }), true), 2400); // V3: time for the slow-motion fall, the victory run, the treasure and the gold rain
  }
  function lose() {
    mode = 'end';
    G.fails = (G.fails || 0) + 1; Save.save();
    Ads.track('level_fail', { game: 'suru', level: S.lv, fails: G.fails, progress: Math.round(S.t / S.length * 100) });
    Sfx.play('lose');
    panel(Kit.lose({
      title: L('SQUAD DOWN', 'TAKIM DÜŞTÜ'),
      sub: L(Math.min(100, Math.round(S.t / S.length * 100)) + '% of the road', 'Yolun %' + Math.min(100, Math.round(S.t / S.length * 100)) + '\'si') + (S.castle ? ' · ' + BOSSES[S.boss].name.toLowerCase() + ' %' + Math.round(Math.max(0, S.castle.hp) / S.castle.max * 100) : ''),
      hint: ease() > 0 ? L('💡 Next try the enemies will be ' + Math.round(ease() * 100) + '% weaker.', '💡 Sonraki denemede düşmanlar %' + Math.round(ease() * 100) + ' daha zayıf olacak.') : L('💡 Collect soldiers and weapons on the reward lane first, then meet the enemy.', '💡 Önce ödül şeridinde asker ve silah topla, düşman yaklaşınca karşıla.'),
      extraButtons: (S.reviveUsed ? '' : '<button class="btn purple big" data-act="revive"><span class="ad-ico">AD</span>' + L('+15 Soldiers · Continue', '+15 Asker · Devam') + '</button>') +
        '<div class="row"><button class="btn green" data-act="retry">' + L('↻ Retry', '↻ Tekrar') + '</button><button class="btn gray" data-act="menu">' + L('Menu', 'Menü') + '</button></div>',
    }), true);
  }

  const actions = {
    play() {
      newLevel(G.level);
      if (startGunAd) { S.squad.weapon = 2; startGunAd = false; }
      closePanel(); mode = 'play'; paused = false; hud();
      if (S.mods.length) { const m = MODS[S.mods[0]]; banner(S.mods.map(k => MODS[k].icon + ' ' + MODS[k].name).join(' + '), m.sub, '#ffe066'); }
      Ads.track('level_start', { game: 'suru', level: S.lv, ease: ease() }); },
    tab(t) { menuTab = t; startMenu(); },
    async gunAd() {
      if (!(await Ads.rewarded('suru_start_gun'))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      startGunAd = true; UI.toast(L('🔥 You start the next level with a machine gun', '🔥 Sonraki seviyeye makineliyle başlarsın')); startMenu();
    },
    buy(k) {
      if (upgLv(k) >= UPG[k].max) return;
      if (G.gold < upgCost(k)) { UI.toast(L('Not enough gold', 'Yetersiz oyun altını')); return; }
      G.gold -= upgCost(k);
      G.upgrades[k] = upgLv(k) + 1; Save.save(); UI.toast(UPG[k].icon + ' ' + UPG[k].name + ' ↑'); Sfx.play('coin'); startMenu();
    },
    skin(k) { if (G.skins.includes(k)) { G.skin = k; Save.save(); startMenu(); } },
    skinBuy(k) {
      if (!Save.spend(SKINS[k].cost)) { UI.toast(L('Not enough ⭐ stars', 'Yetersiz ⭐ yıldız')); return; }
      G.skins.push(k); G.skin = k; Save.save(); UI.toast(SKINS[k].name + L(' unlocked!', ' açıldı!')); startMenu();
    },
    async skinAd(k) {
      if (!(await Ads.rewarded('suru_skin_' + k))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      G.adSkin++;
      if (G.adSkin >= SKINS[k].ads) { G.skins.push(k); G.skin = k; UI.toast(SKINS[k].name + L(' unlocked!', ' açıldı!')); }
      Save.save(); startMenu();
    },
    async claim(m) {
      if (!pendingReward) return;
      if (+m === 3 && !(await Kit.multiAd('suru_win_x3', Kit.adsFor(G.level - 1), 'win' + pendingReward, '[data-act=claim][data-arg="3"]'))) return;
      const amount = pendingReward * (+m === 3 ? 3 : 1);
      G.gold += amount; Save.addCoins(pendingStars); UI.toast('💰 +' + amount + (pendingStars ? ' · ⭐ +' + pendingStars : '')); pendingReward = 0; pendingStars = 0; Save.save(); Sfx.play('coin');
      await Ads.levelEnd(G.level - 1);
      startMenu();
    },
    async revive() {
      if (S.reviveUsed) return;
      if (!(await Ads.rewarded('suru_revive'))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      S.reviveUsed = true; S.squad.n = 15; S.enemies = []; S.ebullets = []; S.shells = S.shells.filter(x => !x.foe);
      if (S.castle && S.castle.type === 'dev') S.castle.y = Math.min(S.castle.y, 260);
      closePanel(); mode = 'play'; hud();
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
    panel('<p class="t-lg">' + L('Paused', 'Duraklatıldı') + '</p><button class="btn green big" data-act="resume">' + L('▶ Resume', '▶ Devam') + '</button><button class="btn gray" data-act="menu">' + L('Quit level', 'Seviyeden çık') + '</button>', true);
  };
  UI.onBack(() => {
    if (mode === 'play' && !paused) { $('pauseBtn').onclick(); return; }
    if (mode === 'menu') { UI.goHome('../index.html'); return; }
    startMenu();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && !paused) $('pauseBtn').onclick(); });

  // ---------- Render helpers ----------
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function outlined(t, x, y, size, fill, stroke) {
    ctx.font = '800 ' + size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.26); ctx.strokeStyle = stroke || '#1b1464'; ctx.strokeText(t, x, y);
    ctx.fillStyle = fill || '#fff'; ctx.fillText(t, x, y);
  }
  const formation = n => {
    const pts = [], cols = Math.min(6, n);
    // V2: bigger soldiers on screen need a wider grid (14 x 12.5); six columns still fit inside squadHalf().
    for (let i = 0; i < Math.min(n, 60); i++) pts.push({ x: ((i % cols) - (cols - 1) / 2) * 14, y: Math.floor(i / cols) * 12.5 });
    return pts;
  };
  const crateIcon = c => (c.what === 'weapon' ? WEAPONS[Math.min(WEAPONS.length - 1, S.squad.weapon + 1)].icon : CRATE_ICON[c.what]);

  // Labels for both renderers. P maps world -> screen (projection in 3D, identity in 2D).
  function drawLabels(P, is3D) {
    const q = S.squad, sp = P(q.x, SQUAD_Y, is3D ? 80 : 0), sy = is3D ? sp.y : sp.y - 30, w = WEAPONS[q.weapon];
    // V3: the squad counter pops when the number changes (green swell when it grows, red shake when it drops).
    const cs = S.cnt || (S.cnt = { n: q.n, pop: 0, dir: 0, en: 0, epop: 0 });
    if (cs.n !== q.n) { cs.dir = q.n > cs.n ? 1 : -1; cs.pop = 1; cs.n = q.n; }
    cs.pop = Math.max(0, cs.pop - 0.06);
    const ck = 1 + cs.pop * (cs.dir > 0 ? 0.35 : 0.2), cj = cs.dir < 0 ? Math.sin(S.t * 90) * cs.pop * 3 : 0;
    const over = !!(S.castle && S.castle.dead); // victory run: the army leaves its spot, its counters go
    if (!over) {
    ctx.save(); ctx.translate(sp.x + cj, sy); ctx.scale(ck, ck);
    ctx.fillStyle = q.flash > 0 ? '#ff4757' : cs.pop > 0.3 && cs.dir > 0 ? '#1f7a44' : 'rgba(15,10,40,.85)'; rr(-34, -14, 68, 28, 14); ctx.fill();
    ctx.strokeStyle = skinColor(); ctx.lineWidth = 3; ctx.stroke();
    outlined(String(q.n), 0, 1, 18);
    ctx.restore();
    outlined(w.icon, sp.x + 44, sy, 18);
    // V3 clash counter: the enemy wave closing in gets its own red number over its middle, ticking down as it falls.
    { let n = 0, mx = 0, my = 0;
      for (const e of S.enemies) if (e.y > SQUAD_Y - 260 && e.y < SQUAD_Y && Math.abs(e.x - q.x) < 170) { n++; mx += e.x; my += e.y; }
      if (cs.en !== n) { if (n < cs.en) cs.epop = 1; cs.en = n; }
      cs.epop = Math.max(0, cs.epop - 0.08);
      if (n >= 4) {
        const ep = P(mx / n, my / n - 20, is3D ? 70 : 0), k = 1 + cs.epop * 0.3;
        ctx.save(); ctx.translate(ep.x, is3D ? ep.y : ep.y - 30); ctx.scale(k, k);
        ctx.fillStyle = 'rgba(90,0,16,.88)'; rr(-28, -13, 56, 26, 13); ctx.fill(); ctx.strokeStyle = '#ff4757'; ctx.lineWidth = 3; ctx.stroke();
        outlined(String(n), 0, 1, 17, '#ffd0d5', '#4a000c');
        ctx.restore();
        // A crackle of "VS" sparks between the two counters while they are close.
        if (Math.abs(ep.y - sy) < 170) { ctx.globalAlpha = 0.55 + 0.45 * Math.sin(S.t * 18); outlined('⚔', (ep.x + sp.x) / 2, (ep.y + sy) / 2, 18, '#ffe066'); ctx.globalAlpha = 1; }
      } }
    }
    for (const g of S.gates) {
      const p = P(g.x, g.y, is3D ? 36 : 0), good = g.mul || g.val >= 1, txt = g.mul ? 'x2' : (g.val >= 1 ? '+' : '') + Math.floor(g.val);
      // Neon halo behind the number (a wide soft stroke: no shadowBlur, which is slow on phones).
      if (is3D) { ctx.font = '800 40px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 22; ctx.strokeStyle = g.mul ? 'rgba(255,210,63,.32)' : good ? 'rgba(59,224,122,.34)' : 'rgba(255,71,87,.36)'; ctx.strokeText(txt, p.x, p.y); }
      outlined(txt, p.x, p.y, is3D ? 40 : 22, '#fff', good ? '#0b5e29' : '#7a0f1e');
    }
    for (const c of S.crates) {
      const p = P(c.x, c.y, is3D ? 50 : 0), y = is3D ? p.y : p.y - 30;
      outlined(crateIcon(c), p.x, y - 14, 20);
      ctx.fillStyle = 'rgba(15,10,40,.85)'; rr(p.x - 26, y + 2, 52, 10, 5); ctx.fill();
      ctx.fillStyle = '#ffd23f'; rr(p.x - 24, y + 4, 48 * Math.max(0, c.hp / c.max), 6, 3); ctx.fill();
    }
    const C = S.castle;
    if (C && !C.dead) {
      const p = P(C.x, C.y, is3D ? { kale: 150, dev: 150, tank: 90, heli: 190, ejder: 200 }[C.type] : 0), y = is3D ? p.y : p.y - 60, bw = is3D ? 120 : C.w;
      ctx.fillStyle = 'rgba(15,10,40,.85)'; rr(p.x - bw / 2, y - 7, bw, 14, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ff4757'; rr(p.x - bw / 2 + 2, y - 5, (bw - 4) * Math.max(0, C.hp / C.max), 10, 5); ctx.fill();
      // Named boss bar across the top (under the HUD), with a trailing "recent damage" segment.
      if (is3D) {
        const sa = UI.safeArea(), tw = Math.min(360, innerWidth - 40), tx = innerWidth / 2 - tw / 2 + (C.flash > 0.5 ? Math.sin(S.t * 90) * 3 : 0), ty = sa.hudBottom + 22, f = Math.max(0, C.hp / C.max);
        C.lag = C.lag == null ? f : Math.max(f, C.lag - 0.004);
        const intro = Math.min(1, C.t / 0.8);
        ctx.globalAlpha = intro;
        outlined(BOSSES[C.type].icon + ' ' + BOSSES[C.type].name.toUpperCase(), innerWidth / 2, ty - 2, 17, '#ffd0d5', '#3a0010');
        ctx.fillStyle = 'rgba(15,10,40,.9)'; rr(tx, ty + 10, tw, 18, 9); ctx.fill(); ctx.strokeStyle = C.flash > 0.5 ? '#fff' : '#ff8a95'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#ffd23f'; rr(tx + 3, ty + 13, (tw - 6) * C.lag * intro, 12, 6); ctx.fill();
        ctx.fillStyle = C.flash > 0.5 ? '#ff9aa4' : '#ff3b4e'; rr(tx + 3, ty + 13, (tw - 6) * f * intro, 12, 6); ctx.fill();
        outlined(Math.ceil(Math.max(0, C.hp)) + ' / ' + C.max, innerWidth / 2, ty + 19, 11);
        ctx.globalAlpha = 1;
      } else outlined(BOSSES[C.type].icon + ' ' + Math.ceil(Math.max(0, C.hp)), p.x, y + 1, 13);
    }
    for (const e of S.enemies) if (e.kind === 'sniper' && e.stopY && e.y >= e.stopY - 2) { const p = P(e.x, e.y, is3D ? 36 : 0); outlined('🎯', p.x, is3D ? p.y : p.y - 16, 14); }
    for (const e of S.enemies) if (e.brute) { const p = P(e.x, e.y, is3D ? 48 : 0); outlined(String(Math.ceil(e.hp)), p.x, is3D ? p.y : p.y - 20, 12, '#ffd0d5', '#4a000c'); }
    // Heads-up for special enemies still far up the road (a pulsing warning over where they will come from).
    for (const e of S.enemies) if ((e.brute || e.kind === 'bomber') && e.y > -40 && e.y < 90) { const p = P(e.x, 90, is3D ? 30 : 0); ctx.globalAlpha = 0.6 + 0.4 * Math.sin(S.t * 10); outlined(e.brute ? '⚠️' : '💣', p.x, p.y, 16); ctx.globalAlpha = 1; }
    if (!is3D) {
      for (const p0 of S.parts) { ctx.globalAlpha = Math.max(0, p0.life); ctx.fillStyle = p0.c; ctx.fillRect(p0.x - 3, p0.y - 3, 6, 6); }
      ctx.globalAlpha = 1;
    }
    for (const t of S.texts) {
      const p = P(t.x, t.y, 30), u = 1 - t.life / (t.max || 1);
      ctx.globalAlpha = Math.min(1, t.life * 2.5);
      // Big numbers punch in (overshoot), small flyers shrink into the squad.
      const size = t.big ? 34 * (u < 0.15 ? 0.6 + u / 0.15 * 0.7 : u < 0.3 ? 1.3 - (u - 0.15) / 0.15 * 0.3 : 1) : t.small ? 15 * (1 - u * 0.5) : 20;
      outlined(t.txt, p.x, p.y, size, t.c);
    }
    ctx.globalAlpha = 1;
    const bx = is3D ? innerWidth / 2 : MID, by = is3D ? P(MID, 300, 0).y : 300;
    if (is3D) {
      const vw = innerWidth, vh = innerHeight;
      // V3 boss entrance: cinema bars slide in for ~2.4 s while the camera pushes in on the boss.
      if (C && !C.dead && C.t < 2.6) {
        const a = Math.min(1, C.t / 0.3, (2.6 - C.t) / 0.4), bh = vh * 0.085 * a;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, vw, bh); ctx.fillRect(0, vh - bh, vw, bh);
        ctx.globalAlpha = a; const sl = Math.min(1, C.t / 0.45);
        ctx.fillStyle = 'rgba(160,10,30,.75)'; ctx.beginPath(); ctx.moveTo(vw * (1 - sl), vh * 0.6); ctx.lineTo(vw, vh * 0.6 - 18); ctx.lineTo(vw, vh * 0.6 + 40); ctx.lineTo(vw * (1 - sl) - 30, vh * 0.6 + 58); ctx.fill();
        outlined(L('BOSS', 'BOSS'), vw - 70 * sl, vh * 0.6 + 20, 26, '#ffe066', '#3a0010');
        ctx.globalAlpha = 1;
      }
      // Final blow: a white flash, then a warm fade while the boss goes down in slow motion.
      if (C && C.dead && C.deadAt) {
        const t = (performance.now() - C.deadAt) / 1000;
        if (t < 0.5) { ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * (1 - t / 0.5)).toFixed(3) + ')'; ctx.fillRect(0, 0, vw, vh); }
        if (t > 0.2 && t < 2.2) { ctx.globalAlpha = Math.min(1, (t - 0.2) * 3, (2.2 - t) * 2); outlined(L('VICTORY!', 'ZAFER!'), vw / 2, vh * 0.3, 46, '#ffe066', '#5a2a00'); ctx.globalAlpha = 1; }
      }
      // Slow motion: a soft dark vignette with a cool edge.
      if (S.slowT > 0) {
        const g = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.25, vw / 2, vh / 2, vh * 0.75);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,20,60,' + (0.55 * Math.min(1, S.slowT * 4)).toFixed(3) + ')');
        ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
      }
    }
    if (S.banner) {
      const b = S.banner, a = Math.min(1, b.life * 2, (2.6 - b.life) * 5);
      ctx.globalAlpha = a;
      const k = b.life > 2.4 ? 1 + (b.life - 2.4) * 2 : 1;
      outlined(b.txt, bx, by, Math.min(38, 620 / Math.max(8, b.txt.length)) * k, b.c, '#1b1464');
      outlined(b.sub, bx, by + 34, 17, '#fff');
      ctx.globalAlpha = 1;
    }
    if (mode === 'play' && S.lv === 1 && S.t < 6) {
      ctx.globalAlpha = 0.7 + Math.sin(S.t * 4) * 0.3;
      outlined(L('Swipe: rewards left, enemies right!', 'Kaydır: solda ödül, sağda düşman!'), bx, by + 120, is3D ? 20 : 17);
      ctx.globalAlpha = 1;
    }
  }

  function draw2D() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#141338'; ctx.fillRect(0, 0, cvs.width, cvs.height);
    const sh = S && S.shake ? S.shake : 0;
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (ox + (Math.random() - 0.5) * sh), dpr * (oy + (Math.random() - 0.5) * sh));
    const tf = (S ? S.theme : worldOf(G.level)).field;
    ctx.fillStyle = tf[1]; rr(ROAD_L - 6, 0, ROAD_R - ROAD_L + 12, H, 14); ctx.fill();
    if (!S) return;
    // Lane tiles follow the road position so layout changes scroll in with the road.
    const TILE = 40;
    for (const kind of ['r', 'e']) {
      const D = kind === 'r' ? S.rdist : S.dist;
      for (let i = Math.floor((D - H) / TILE); i <= Math.ceil(D / TILE); i++) {
        const y = D - (i + 1) * TILE;
        ctx.fillStyle = kind === 'r' ? 'rgba(59,224,122,.16)' : 'rgba(255,71,87,.16)';
        for (const l of layoutAt((i + 0.5) * TILE)) if (l.k === kind) ctx.fillRect(l.a, y, l.w, TILE + 0.5);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = Math.floor((S.dist - H) / TILE); i <= Math.ceil(S.dist / TILE); i++) {
      const lanes = layoutAt((i + 0.5) * TILE), y = S.dist - (i + 1) * TILE;
      for (let k = 1; k < lanes.length; k++) ctx.fillRect(lanes[k].a - 3, y, 6, 22);
    }
    for (const g of S.gates) { ctx.fillStyle = (g.mul || g.val >= 1 ? '#3be07a' : '#ff4757') + (g.flash ? 'cc' : '77'); rr(g.x - g.w / 2, g.y - 12, g.w, 24, 8); ctx.fill(); }
    for (const c of S.crates) { ctx.fillStyle = c.flash ? '#fff' : '#b07a3e'; rr(c.x - 22, c.y - 16, 44, 32, 5); ctx.fill(); ctx.fillStyle = '#ffd23f'; ctx.fillRect(c.x - 22, c.y - 4, 44, 6); }
    const C = S.castle;
    if (C && !C.dead) { ctx.fillStyle = C.flash ? '#ffd5d5' : '#8a8f98'; rr(C.x - C.w / 2, C.y - C.top, C.w, C.top + C.bot, 8); ctx.fill(); }
    ctx.fillStyle = '#ff4757';
    for (const e of S.enemies) { ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#222';
    for (const m of S.mines) { ctx.beginPath(); ctx.arc(m.x, m.y, 8, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ff3030';
    for (const b of S.ebullets) ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
    ctx.fillStyle = WEAPONS[S.squad.weapon].color;
    for (const b of S.bullets) ctx.fillRect(b.x - 1.5, b.y - 5, 3, 10);
    ctx.fillStyle = '#333';
    for (const s of S.shells) { ctx.beginPath(); ctx.arc(s.x, s.y - s.h * 0.5, 5, 0, TAU); ctx.fill(); }
    for (const b of S.bombs) { ctx.beginPath(); ctx.arc(b.x, b.y - b.h * 0.3, 4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#4b5563';
    for (const p of S.planes) { ctx.fillRect(p.x - 4, p.y - 24, 8, 48); ctx.fillRect(p.x - 34, p.y - 6, 68, 10); }
    for (const f of S.fx) if (f.delay <= 0) { ctx.globalAlpha = f.life; ctx.fillStyle = '#ffb020'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.2 - f.life * 0.5), 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2d3748';
    for (const m of S.mortars) { ctx.beginPath(); ctx.arc(m.x, m.y, 7, 0, TAU); ctx.fill(); }
    ctx.fillStyle = skinColor();
    for (const p of formation(S.squad.n)) { ctx.beginPath(); ctx.arc(S.squad.x + p.x, SQUAD_Y + p.y, 6, 0, TAU); ctx.fill(); }
    if (S.shieldT > 0) { ctx.strokeStyle = '#7df9ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(S.squad.x, SQUAD_Y + 20, squadHalf() + 18, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = '#4b5563';
    for (const h of S.helis) { ctx.fillRect(h.x - 10, h.y - 30, 20, 60); ctx.fillRect(h.x - 40, h.y - 2, 80, 4); }
    ctx.fillStyle = '#ff8a3a';
    for (const m of S.missiles) if (m.delay <= 0) { ctx.beginPath(); ctx.arc(m.x, m.y - m.h * 0.3, 4, 0, TAU); ctx.fill(); }
    drawLabels((x, y) => ({ x, y }), false);
  }
  function drawOverlay3D() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (S) drawLabels((x, y, h) => R3.project(x, y, h), true);
  }

  // ---------- Loop ----------
  const rinfo = () => ({ skin: skinColor(), gear: G.skin, formation: formation(S.squad.n), weapon: WEAPONS[S.squad.weapon], layoutAt, playing: mode === 'play' && !paused });
  // Test hook: draw n frames of dt seconds right now (screenshots of timed moments on a slow headless GPU).
  window.__suru.frames = (n, dt) => { for (let i = 0; i < n; i++) { if (mode === 'play' && !paused) update(dt); if (R3 && S) R3.render(S, dt, rinfo()); } if (R3 && S) drawOverlay3D(); };
  let last = performance.now();
  function loop(t) {
    requestAnimationFrame(loop);
    if (t - last < 7) return; // follow the screen (up to 120 Hz): 60 fps looked choppy on 120 Hz phones
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    // V3 slow motion (wave crushed): the game and its drawing run at a third of the speed for a moment (real time).
    let ts = 1;
    if (S && S.slowT > 0) { ts = 0.32; if (mode === 'play' && !paused) S.slowT -= dt; }
    if (mode === 'play' && !paused) update(dt * ts);
    if (R3 && S) {
      R3.render(S, dt * ts, rinfo());
      drawOverlay3D();
    } else draw2D();
  }

  startMenu();
  // Preview/screenshot hooks: #play starts a level; #demo[:level[:steps[:extras]]] fast-forwards play.
  // extras: comma list of mortar, air, weapon=N.
  const hp = (location.hash || '').split(':');
  if (hp[0] === '#play' || hp[0] === '#demo') {
    if (hp[1]) G.level = +hp[1];
    actions.play();
  }
  if (hp[0] === '#demo') {
    const steps = +(hp[2] || 260), ex = (hp[3] || '').split(',');
    for (const x of ex) if (x.startsWith('weapon=')) S.squad.weapon = +x.slice(7);
    if (ex.includes('mortar')) for (let k = 0; k < 2; k++) S.mortars.push({ t: k * 0.7, recoil: 0, x: 0, y: 0 });
    if (ex.includes('big')) S.squad.n = 40;
    if (ex.includes('boss')) { S.t = S.length - 1; S.events = S.events.filter(e => e.kind !== 'pack'); }
    for (let i = 0; i < steps; i++) {
      const en = S.enemies.filter(e => e.y > 300), g = S.gates.filter(g => g.y > 150)[0];
      S.squad.tx = en.length > 2 ? en[en.length - 1].x : g ? g.x : S.castle ? S.castle.x : 112;
      if (ex.includes('air') && i === steps - 22) callAir();
      if (ex.includes('heli') && i === steps - 60) { S.sup.heli.cd = 0; useSupport('heli'); }
      if (ex.includes('shield') && i === steps - 30) { S.sup.strike.cd = 0; useSupport('strike'); S.sup.shield.cd = 0; S.lv = Math.max(S.lv, 3); useSupport('shield'); }
      update(0.05);
    }
  }
  Sfx.music(true);
  requestAnimationFrame(loop);
})();
