// Koloni Kapışması — State.io-like territory game played on a continent map.
// Each tower owns a Voronoi region of the continent; capturing the tower paints the region.
// Twist: special towers (factory / fort), energy abilities (freeze / speed), drag through several towers,
// tap-to-reinforce, boss levels every 10 levels with a giant core that launches waves.
(() => {
  'use strict';

  const G = Save.game('koloni', { gold: null, level: 1, best: 0, fails: 0, skin: 'mavi', skins: ['mavi'], adSkin: 0, upgrades: { prod: 0, start: 0, speed: 0 } });
  // Each game has its own 💰 gold for upgrades; ⭐ stars (top right) are the scarce shared currency.
  if (G.gold == null) { G.gold = 400 + 60 * (G.level || 1); Save.save(); }
  const SKINS = {
    mavi: { name: L('Blue', 'Mavi'), color: '#3b82f6', cost: 0 },
    turkuaz: { name: L('Turquoise', 'Turkuaz'), color: '#06b6d4', cost: 60 },
    pembe: { name: L('Pink', 'Pembe'), color: '#ec4899', cost: 150 },
    beyaz: { name: L('Pearl', 'İnci'), color: '#e2e8f0', fx: 'pearl', cost: 300, rarity: 'epic' },
    ates: { name: L('Wildfire', 'Ateş'), color: '#ff5a1f', fx: 'fire', cost: 450, rarity: 'epic' },
    kral: { name: L('Royal Gold', 'Kraliyet Altını'), color: '#ffcf3f', fx: 'gold', pack: true, rarity: 'legendary' },
    lime: { name: 'Neon', color: '#7dff3a', fx: 'neon', ads: 2 },
  };
  // Upgrade cards show real numbers (players complained that upgrades in rival games don't do what they promise).
  const UPG = {
    prod: { icon: '🏭', name: L('Production', 'Üretim'), max: 15, val: l => (1 + 0.1 * l).toFixed(1) + L('/s', '/sn') },
    start: { icon: '🎯', name: L('Starting Army', 'Başlangıç Ordusu'), max: 15, val: l => (12 + 5 * l) + L(' troops', ' birlik') },
    speed: { icon: '💨', name: L('Troop Speed', 'Birlik Hızı'), max: 10, val: l => L((100 + 8 * l) + '%', '%' + (100 + 8 * l)) },
  };
  const upgCost = k => Math.round(80 * Math.pow(1.55, G.upgrades[k]));
  const upgDesc = k => { const u = UPG[k], l = G.upgrades[k]; return l >= u.max ? u.val(l) : u.val(l) + ' → ' + u.val(l + 1); };
  // Dynamic difficulty: each loss on the same level makes the next attempt a bit easier (max 30%).
  const ease = () => Math.min(0.45, 0.15 * (G.fails || 0));

  const COLORS = ['#b8ab8a', '#3b82f6', '#ef4444', '#f59e0b', '#a855f7'];
  const applySkin = () => { COLORS[1] = (SKINS[G.skin] || SKINS.mavi).color; };
  applySkin();
  const CAP = { normal: 50, factory: 60, fort: 80, core: 150 };
  const isBoss = lv => lv % 10 === 0;
  // Five bosses take turns every 10 levels (then the round repeats, a bit faster each time). Each has its own island,
  // colours and one skill on a timer; the skill is announced 1-2 s ahead (ring / line on the target) so it can be read.
  const BOSSES = [
    { id: 'golem', icon: '🗿', name: L('Stone Giant', 'Taş Dev'), shape: 'kıta', every: 14, warn: 1.8,
      skill: L('Earthquake: 2 of your regions lose 30% of their troops', "Deprem: 2 bölgen askerlerinin %30'unu kaybeder"),
      theme: { id: 'lab', icon: '🪨', name: L('Rocky Wastes', 'Kayalık Çorak'), sea: '#3f7fb0', land: '#cdb68c', cliff: '#6e5a44', top: '#2a2018', bottom: '#120c08' } },
    { id: 'ice', icon: '❄️', name: L('Ice Queen', 'Buz Kraliçe'), shape: 'yarımada', every: 16, warn: 1.5,
      skill: L('Freeze: your strongest region is iced for 5 s (no troops out, no production)', 'Dondurma: en güçlü bölgen 5 sn donar (asker çıkmaz, üretmez)'),
      theme: { id: 'glacier', icon: '🧊', name: L('Frozen Isle', 'Donmuş Ada'), sea: '#7cc8f0', land: '#eef6ff', cliff: '#a6bed2', top: '#1e3a4f', bottom: '#0b1722' } },
    { id: 'shadow', icon: '👻', name: L('Shadow Lord', 'Gölge Lord'), shape: 'ikiz', every: 18, warn: 1.4,
      skill: L('Blink: the main tower jumps to another of its regions', 'Işınlanma: ana kule başka bir bölgesine sıçrar'),
      theme: { id: 'midnight', icon: '🌑', name: L('Shadow Isles', 'Gölge Adaları'), sea: '#2c2370', land: '#c4b8e0', cliff: '#4a3f73', top: '#1a0f2e', bottom: '#07040f' } },
    { id: 'hive', icon: '🐝', name: L('Hive Mother', 'Kovan Ana'), shape: 'yonca', every: 12, warn: 1.0,
      skill: L('Swarm: free broods fly out to the 2 nearest regions', 'Sürü: en yakın 2 bölgeye bedava yavru birlik yollar'),
      theme: { id: 'forest', icon: '🍯', name: L('Hive Meadow', 'Kovan Çayırı'), sea: '#3a9a6a', land: '#d2dc84', cliff: '#5d6b2f', top: '#1d2a10', bottom: '#0a1206' } },
    { id: 'dragon', icon: '🐉', name: L('Dragon', 'Ejder'), shape: 'kanyon', every: 15, warn: 1.8,
      skill: L('Fire breath: burns half of your troops on the marked line', 'Ateş nefesi: işaretli hattaki askerlerinin yarısını yakar'),
      theme: { id: 'volcano', icon: '🌋', name: L('Dragon Canyon', 'Ejder Kanyonu'), sea: '#ff5a1f', land: '#8c6f60', cliff: '#3d2620', top: '#3a1414', bottom: '#140606' } },
  ];
  const bossOf = lv => BOSSES[(Math.floor(lv / 10) - 1) % BOSSES.length];
  const bossRound = lv => Math.floor((Math.floor(lv / 10) - 1) / BOSSES.length);
  const themeOf = lv => isBoss(lv) ? Object.assign({}, Themes.forLevel(lv), bossOf(lv).theme) : Themes.forLevel(lv);
  const TAU = Math.PI * 2;
  const W = 400, H = 720;
  const MAP = { cx: 200, cy: 368, rx: 180, ry: 246 }; // refitted to the screen on each level (fitMap)
  const COST_FREEZE = 50, COST_SPEED = 40;
  const FONT = "'Baloo', system-ui, sans-serif";

  const $ = id => document.getElementById(id);
  const cvs = $('c'), ctx = cvs.getContext('2d');
  // 3D renderer when WebGL is available; otherwise (old devices, tests) the 2D renderer below is used.
  const R3 = window.Koloni3D ? window.Koloni3D.init($('c3d')) : null;
  if (!R3 && $('c3d') && $('c3d').style) $('c3d').style.display = 'none';
  let dpr = 1, sc = 1, ox = 0, oy = 0;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cvs.width = Math.round(innerWidth * dpr);
    cvs.height = Math.round(innerHeight * dpr);
    sc = Math.min(innerWidth / W, innerHeight / H);
    ox = (innerWidth - W * sc) / 2;
    oy = (innerHeight - H * sc) / 2;
  }
  addEventListener('resize', () => { resize(); if (R3 && S) R3.fit(); });
  resize();
  const toWorld = e => (R3 ? R3.pick(e.clientX, e.clientY) : { x: (e.clientX - ox) / sc, y: (e.clientY - oy) / sc });
  // Use the whole height between the HUD and the ability buttons (tall phones would otherwise waste it).
  function fitMap() {
    const sa = UI.safeArea();
    const top = (sa.hudBottom + 14 - oy) / sc, bottom = (innerHeight - sa.bottom - 140 - oy) / sc;
    MAP.cy = (top + bottom) / 2;
    MAP.ry = Math.max(200, Math.min(330, (bottom - top) / 2 - 10));
  }
  const at = (fx, fy) => [MAP.cx + fx * MAP.rx, MAP.cy + fy * MAP.ry];
  if (document.fonts && document.fonts.load) document.fonts.load("800 14px 'Baloo'").catch(() => { });

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------- Color helpers ----------
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16), t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    const f = v => Math.round((t - v) * p + v);
    return '#' + ((1 << 24) + (f(n >> 16) << 16) + (f(n >> 8 & 255) << 8) + f(n & 255)).toString(16).slice(1);
  }
  const palCache = {};
  // Colour tab / pack: a 3D tower in that colour (Koloni3D.thumb), the plain ball without WebGL.
  const skinArt = (k, s) => { const u = R3 && R3.thumb && R3.thumb(s.color, s.fx); return u ? '<img class="cthumb" src="' + u + '" alt="">' : '<span class="ball" style="background:' + s.color + '"></span>'; };
  function pal(owner) {
    const c = COLORS[owner];
    return palCache[c] || (palCache[c] = {
      base: c, light: shade(c, 0.35), dark: shade(c, -0.35), deep: shade(c, -0.6),
      land: owner === 0 ? '#e6d9b8' : shade(c, 0.22),
    });
  }

  // ---------- Geometry ----------
  function inPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function edgeDist(x, y, poly) {
    let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j], [bx, by] = poly[i];
      const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l));
      best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
    return best;
  }
  // Keep the part of `poly` on the side of the half-plane closer to the owner (Sutherland–Hodgman).
  function clipHalf(poly, ax, ay, nx, ny) {
    const out = [], side = p => (p[0] - ax) * nx + (p[1] - ay) * ny;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], sa = side(a), sb = side(b);
      if (sa <= 0) out.push(a);
      if ((sa <= 0) !== (sb <= 0)) { const t = sa / (sa - sb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  // Continent outline: an ellipse distorted by a few harmonics; shape varies per level.
  function makeCoast(r, shape) {
    const k = shape === 'ikiz' ? [0.2, 0.03, 0.05, 0.025] : shape === 'yarımada' ? [0.05, 0.13, 0.06, 0.03] : shape === 'dişli' ? [0.04, 0.04, 0.05, 0.09] : shape === 'kanyon' ? [0.16, 0.1, 0.03, 0.05] : shape === 'yonca' ? [0.03, 0.04, 0.15, 0.02] : [0.06, 0.05, 0.08, 0.03];
    const ph = [r() * TAU, r() * TAU, r() * TAU, r() * TAU];
    const norm = 1 + k[0] + k[1] + k[2] + k[3];
    const pts = [];
    for (let i = 0; i < 80; i++) {
      const t = i / 80 * TAU;
      const f = (1 + k[0] * Math.cos(2 * t + ph[0]) + k[1] * Math.sin(3 * t + ph[1]) + k[2] * Math.sin(5 * t + ph[2]) + k[3] * Math.sin(9 * t + ph[3])) / norm * 1.08;
      pts.push([MAP.cx + Math.cos(t) * MAP.rx * Math.min(1, f), MAP.cy + Math.sin(t) * MAP.ry * Math.min(1, f)]);
    }
    return pts;
  }

  let S = null;
  let mode = 'menu'; // menu | play | end
  let paused = false;
  let boostStart = false;
  let pendingReward = 0, pendingStars = 0;
  let menuTab = 'up';

  // ---------- Level ----------
  function newLevel(lv) {
    fitMap();
    const r = rng(lv * 7919 + 13);
    const boss = isBoss(lv);
    const aiCount = boss ? 1 : Math.min(3, 1 + Math.floor((lv - 1) / 4));
    const total = Math.min(19, 7 + Math.floor(lv * 0.5) + aiCount);
    const shape = boss ? bossOf(lv).shape : lv < 3 ? 'kıta' : lv < 11 ? ['kıta', 'ikiz', 'yarımada'][Math.floor(r() * 3)] : ['kıta', 'ikiz', 'yarımada', 'dişli', 'kanyon', 'yonca'][Math.floor(r() * 6)];
    const coast = makeCoast(r, shape);
    // Mirrored left/right for variety. Never upside down: the player's home always sits at the bottom, under the thumb
    // (the extra r() keeps every level's random sequence as it was).
    r(); const rot = false, flip = lv >= 11 && r() < 0.5;
    const atR = (fx, fy) => at(flip !== rot ? -fx : fx, rot ? -fy : fy);
    const ok = (x, y, m) => inPoly(x, y, coast) && edgeDist(x, y, coast) >= m;
    const place = (x, y) => {
      for (let i = 0; i < 60 && !ok(x, y, 26); i++) { x += (MAP.cx - x) * 0.07; y += (MAP.cy - y) * 0.07; }
      return [x, y];
    };
    const nodes = [];
    const add = (p, type, owner, units) =>
      nodes.push({ id: nodes.length, x: p[0], y: p[1], type, owner, units, r: type === 'core' ? 24 : 16, pulse: 0, poly: null, tone: r() });

    add(place(...atR(0, 0.94)), 'normal', 1, 12 + G.upgrades.start * 5 + (boostStart ? 15 : 0));
    const aiPos = [[atR(0, -0.93)], [atR(-0.58, -0.78), atR(0.58, -0.78)], [atR(-0.67, -0.54), atR(0, -0.95), atR(0.67, -0.54)]][aiCount - 1];
    // Rival strength keeps growing after level 30 (players keep buying upgrades).
    const aiStart = Math.round((10 + 0.5 * Math.min(lv, 30) + 0.6 * Math.max(0, lv - 30)) * (1 - ease()));
    if (boss) {
      // Boss: giant core guarded by two neutral forts; it hits anywhere on the map with waves.
      add(place(...atR(0, -0.88)), 'core', 2, Math.round((50 + lv * 1.6) * (1 - ease())));
      add(place(...atR(-0.53, -0.46)), 'fort', 0, 15 + Math.floor(lv / 2));
      add(place(...atR(0.53, -0.46)), 'fort', 0, 15 + Math.floor(lv / 2));
    } else {
      // Late levels: rivals start at least half as big as the player's (upgraded) start, so it can't snowball in seconds.
      const meStart = nodes[0].units, st = lv >= 25 ? Math.max(aiStart, Math.round(meStart * 0.5 * (1 - ease()))) : aiStart;
      aiPos.forEach((p, i) => add(place(p[0], p[1]), 'normal', i + 2, st));
    }
    let guard = 0;
    while (nodes.length < total && guard++ < 4000) {
      const x = MAP.cx + (r() * 2 - 1) * MAP.rx, y = MAP.cy + (r() * 2 - 1) * MAP.ry;
      if (!ok(x, y, 24)) continue;
      if (nodes.some(n => Math.hypot(n.x - x, n.y - y) < 68)) continue;
      const t = r();
      const type = t < 0.14 ? 'factory' : t < 0.27 ? 'fort' : 'normal';
      add([x, y], type, 0, 3 + Math.floor(r() * 8) + Math.floor(Math.min(lv, 45) / 4) + Math.floor(Math.max(0, lv - 45) / 6));
    }
    // Voronoi regions clipped to the coast.
    for (const n of nodes) {
      let poly = coast;
      for (const o of nodes) {
        if (o === n) continue;
        poly = clipHalf(poly, (n.x + o.x) / 2, (n.y + o.y) / 2, o.x - n.x, o.y - n.y);
        if (poly.length < 3) break;
      }
      n.poly = poly;
    }
    // Troops can only march to regions that share a border with their own region.
    for (const n of nodes) n.nb = [];
    for (const n of nodes) for (const o of nodes) {
      if (o.id <= n.id || !n.poly || !o.poly) continue;
      const shared = n.poly.filter(([x, y]) => edgeDist(x, y, o.poly) < 1.5).length;
      if (shared >= 2) { n.nb.push(o.id); o.nb.push(n.id); }
    }

    // From level 5 rivals start with a second region, so one sniping move can't knock them out.
    const extra = boss ? 0 : lv >= 40 ? 2 : lv >= 5 ? 1 : 0;
    for (let k = 0; k < extra; k++) for (let o = 2; o < 2 + aiCount; o++) {
      const home = nodes.filter(n => n.owner === o);
      // The one behind their lines (farthest from the player), never a foothold toward the player.
      const me = nodes[0], far = n => Math.hypot(n.x - me.x, n.y - me.y);
      const cand = nodes.filter(n => n.owner === 0 && n.type === 'normal' && home.some(h => h.nb.includes(n.id))).sort((x, y) => far(y) - far(x))[0];
      if (cand) { cand.owner = o; cand.units = Math.round(home[0].units * 0.6); }
    }
    S = {
      lv, nodes, coast, shape, dots: [], streams: [], parts: [], texts: [], time: 0, theme: themeOf(lv), skinFx: (SKINS[G.skin] || {}).fx || null,
      newRegion: lv > 1 && Themes.forLevel(lv) !== Themes.forLevel(lv - 1),
      energy: 20, freezeT: 0, speedT: 0, adUsed: false, boss, bossT: 18, lost: 0, sent: false,
      bossK: boss ? bossOf(lv) : null, skillT: boss ? bossOf(lv).every * 0.75 : 0, warn: null, introT: boss ? 3.2 : 0,
      ai: [], sel: [], tapSel: false, drag: null, checkT: 0, shake: 0, shareT: 0,
      // Rival production: grows to 1.4x by level 20, then keeps pace with the player's upgrades (about 2.6x at level 80, close to a fully upgraded player).
      aiMul: (Math.min(1.4, 0.75 + 0.045 * Math.min(lv, 20)) + Math.min(1.6, 0.02 * Math.max(0, lv - 20))) * (1 - ease()),
      aiThink: Math.max(lv > 40 ? 1.7 : 2, 3.2 - lv * 0.05), // human-paced: difficulty comes from smarter moves, not speed
      aiMargin: Math.max(1.15, 1.8 - lv * 0.025),
      aiDefend: Math.min(0.9, 0.45 + lv * 0.03) * (1 - ease()),
      aiPool: lv < 4 ? 1 : lv < 12 ? 2 : 3,
      aiGarrison: Math.min(0.9, 0.4 + lv * 0.02),
    };
    for (let i = 0; i < aiCount; i++) S.ai.push({ owner: i + 2, t: 3 + i * 0.7 }); // a moment to read the map first
    if (R3) R3.setLevel(S, MAP, S.theme, pal);
  }

  // ---------- Simulation ----------
  function prodRate(n) {
    const b = n.type === 'core' ? 1.6 : n.type === 'factory' ? 2 : 1;
    return n.owner === 1 ? b * (1 + 0.1 * G.upgrades.prod) : b * S.aiMul * (S.boss && n.type !== 'core' ? 0.8 : 1);
  }

  // A colour's connected regions form one territory: a tower can send troops to any region that borders
  // its territory (they march through friendly land), or to any tower of the same territory.
  function territory(n) {
    const seen = new Set([n.id]), stack = [n];
    while (stack.length) for (const id of stack.pop().nb) { const o = S.nodes[id]; if (o.owner === n.owner && !seen.has(id)) { seen.add(id); stack.push(o); } }
    return seen;
  }
  function adjacent(a, b) {
    const t = territory(a);
    if (b.owner === a.owner) return t.has(b.id);
    for (const id of t) if (S.nodes[id].nb.includes(b.id)) return true;
    return false;
  }
  // A region is on the front if it borders anything that is not its owner's.
  const frontline = n => n.nb.some(id => S.nodes[id].owner !== n.owner);
  function send(from, to, owner, count) {
    const n = Math.floor(Math.min(from.units, count || Infinity));
    if (n < 1 || from === to || !adjacent(from, to)) return;
    if (from.iceT > 0) { if (owner === 1) floatText(from.x, from.y - 34, L('❄️ Frozen!', '❄️ Donmuş!'), '#bfeaff'); return; }
    from.units -= n;
    S.streams.push({ from, to, owner, left: n, t: 0 });
  }

  function emitDot(s) {
    const f = s.from, dx = s.to.x - f.x, dy = s.to.y - f.y, d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d, off = (Math.random() - 0.5) * 12;
    S.dots.push({ x: f.x + ux * f.r - uy * off, y: f.y + uy * f.r + ux * off, to: s.to, owner: s.owner, dead: false });
  }

  function dotSpeed(owner) {
    if (owner === 1) return 78 * (1 + 0.08 * G.upgrades.speed) * (S.speedT > 0 ? 1.8 : 1);
    return 78 * (1 + Math.min(0.3, S.lv * 0.01) + Math.min(0.5, Math.max(0, S.lv - 30) * 0.008)) * (S.freezeT > 0 ? 0.35 : 1);
  }

  function burst(x, y, c, n, sp) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = (0.3 + Math.random()) * sp;
      S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c });
    }
  }
  function floatText(x, y, txt, c) { S.texts.push({ x, y, txt, c, life: 1 }); }

  function arrive(d) {
    const n = d.to;
    if (n.owner === d.owner) { n.units += 1; return; }
    n.units -= n.type === 'fort' ? 0.5 : n.type === 'core' ? 0.6 : 1;
    n.pulse = 1;
    if (n.units < 0) {
      const prev = n.owner;
      n.owner = d.owner;
      n.units = Math.abs(n.units);
      burst(n.x, n.y, COLORS[d.owner], 22, 120);
      if (d.owner === 1) { S.energy = Math.min(100, S.energy + 12); UI.vibrate(15); Sfx.play('pop'); floatText(n.x, n.y - 30, L('CAPTURED!', 'ALINDI!'), '#fff36b'); }
      if (prev === 1) { S.shake = 6; S.lost++; UI.vibrate(40); Sfx.play('hit'); }
      if (n.type === 'core' && prev === 2 && S.boss) {
        // Core falls: the whole boss colony collapses to neutral.
        for (const o of S.nodes) if (o.owner === 2) { o.owner = 0; o.units = Math.floor(o.units / 2); burst(o.x, o.y, COLORS[2], 12, 90); }
        S.streams = S.streams.filter(s => s.owner !== 2);
        S.shake = 10;
        Sfx.play('boss');
        UI.toast(L('👑 The main tower fell!', '👑 Ana kule düştü!'));
      }
    }
  }

  // Troops on their way to each node, by owner (dots in flight + streams still leaving).
  function incomingMap() {
    const inc = new Map();
    const add = (n, owner, k) => { let r = inc.get(n); if (!r) inc.set(n, r = {}); r[owner] = (r[owner] || 0) + k; };
    for (const d of S.dots) add(d.to, d.owner, 1);
    for (const s of S.streams) add(s.to, s.owner, s.left);
    return inc;
  }
  const hostile = (r, owner) => { let h = 0; if (r) for (const o in r) if (+o !== owner) h += r[o]; return h; };

  function aiThink(ai) {
    const mine = S.nodes.filter(n => n.owner === ai.owner);
    if (!mine.length) return;
    { // how far ahead the player is: their regions vs the strongest rival's
      const cnt = {}; for (const n of S.nodes) cnt[n.owner] = (cnt[n.owner] || 0) + 1;
      let top = 0; for (const o in cnt) if (+o > 1) top = Math.max(top, cnt[o]);
      S.huntP = S.lv < 6 ? 0 : (cnt[1] || 0) > top * 1.2 ? 5 + Math.min(6, S.lv * 0.08) : 1;
    }
    const inc = incomingMap(), own = n => (inc.get(n) || {})[ai.owner] || 0;
    const threat = n => hostile(inc.get(n), ai.owner) * (n.type === 'fort' ? 0.5 : 1) - n.units - own(n);
    // Garrison: what the strongest hostile neighbour could throw at a region, so the AI never strips it bare.
    const keep = m => { let k = 0; for (const id of m.nb) { const o = S.nodes[id]; if (o.owner !== 0 && o.owner !== ai.owner) k = Math.max(k, o.units); } return Math.min(m.units - 1, k * S.aiGarrison / (m.type === 'fort' ? 2 : 1)); };
    const spare = m => Math.floor(m.units - keep(m));
    // 1) Defend: a region about to fall gets reinforcements from the safest, richest regions of the territory.
    if (Math.random() < S.aiDefend) {
      const danger = mine.filter(n => threat(n) > -2).sort((a, b) => threat(b) - threat(a))[0];
      if (danger) {
        const helper = mine.filter(m => m !== danger && m.type !== 'core' && m.units >= 6 && threat(m) < -m.units * 0.5 && adjacent(m, danger))
          .sort((a, b) => b.units - a.units)[0];
        if (helper) { send(helper, danger, ai.owner, Math.max(spare(helper), threat(danger) + 4)); return; }
      }
    }
    // 2) Attack, pooling up to three regions when one alone is not enough.
    const srcs = mine.filter(m => spare(m) >= 5 && m.type !== 'core' && threat(m) < -4).sort((a, b) => spare(b) - spare(a)); // core only attacks through waves
    let best = null, bs = Infinity;
    for (const t of S.nodes) {
      if (t.owner === ai.owner) continue;
      const near = srcs.filter(m => adjacent(m, t));
      if (!near.length) continue;
      // Neutral regions don't produce, so a thin margin is enough; owned ones keep growing while troops march.
      const need = (t.units + hostile(inc.get(t), ai.owner) * 0.5) * (t.type === 'fort' ? 2 : t.type === 'core' ? 1.7 : 1) * (t.owner === 0 ? 1.1 : S.aiMargin) + 2 - own(t);
      if (need <= 0) continue;
      const use = [];
      let sum = 0;
      for (const m of near) { if (use.length >= S.aiPool) break; use.push(m); sum += spare(m); if (sum > need) break; }
      if (sum <= need) continue;
      const d = Math.min(...use.map(m => Math.hypot(t.x - m.x, t.y - m.y)));
      // Rivals fight each other, but gang up on a player who is running away with the map, and pounce on emptied regions.
      const score = need + d * 0.06 + use.length * 4 - (t.type !== 'normal' ? 6 : 0) - (t.owner === 1 ? S.huntP + (t.units < 4 ? 6 : 0) : 0);
      if (score < bs) { bs = score; best = { t, use, need }; }
    }
    if (best) { let left = best.need * 1.15 + 3; for (const m of best.use) { const k = Math.min(spare(m), Math.ceil(left)); send(m, best.t, ai.owner, k); left -= k; } return; }
    // Nothing to attack: move troops from interior regions toward the front.
    for (const m of mine) {
      if (m.units < 5 || m.type === 'core' || frontline(m)) continue;
      const to = m.nb.map(id => S.nodes[id]).filter(o => o.owner === ai.owner).sort((a, b) => (frontline(b) ? 1 : 0) - (frontline(a) ? 1 : 0))[0];
      if (to) { send(m, to, ai.owner); return; }
    }
  }

  function bossWave(dt) {
    const core = S.nodes.find(n => n.type === 'core' && n.owner === 2);
    if (!core) return;
    S.bossT -= dt * (S.freezeT > 0 ? 0.3 : 1);
    if (S.bossT > 0) return;
    S.bossT = Math.max(7, 12 - S.lv * 0.05);
    if (core.units < 10) return;
    // The boss strikes anywhere (no border needed): the player region it can take most cheaply, the biggest one
    // otherwise; with no player land in reach it grabs neutral land to grow.
    const waves = S.lv >= 70 ? 2 : 1, budget = Math.floor(core.units * 0.3);
    const inc = incomingMap(), mineInc = n => (inc.get(n) || {})[2] || 0;
    for (let w = 0; w < waves; w++) {
      const n = Math.floor(budget / waves);
      const cands = S.nodes.filter(t => t.owner !== 2 && mineInc(t) === 0);
      const cost = t => (t.units + 1) * (t.type === 'fort' ? 2 : 1);
      const pl = cands.filter(t => t.owner === 1);
      let target = pl.filter(t => cost(t) < n).sort((a, b) => (b.type !== 'normal') - (a.type !== 'normal') || cost(a) - cost(b))[0]
        || (pl.length ? pl.sort((a, b) => b.units - a.units)[0] : cands.sort((a, b) => cost(a) - cost(b))[0]);
      if (!target) break;
      core.units -= n;
      S.streams.push({ from: core, to: target, owner: 2, left: n, t: 0 });
      inc.set(target, { 2: n });
    }
    core.pulse = 1;
    Sfx.play('boss');
    UI.toast(L('👑 Boss wave incoming!', '👑 Boss dalgası geliyor!'));
  }

  // ---------- Boss skills ----------
  function bossSkill(dt) {
    const core = S.nodes.find(n => n.type === 'core' && n.owner === 2), k = S.bossK;
    if (!core || !k) { S.warn = null; return; }
    if (S.warn) { if ((S.warn.t -= dt) <= 0) { const w = S.warn; S.warn = null; skillHit(w, core); } return; }
    S.skillT -= dt * (S.freezeT > 0 ? 0 : 1); // your Freeze power stops the boss's skill timer too
    if (S.skillT > 0) return;
    S.skillT = k.every * Math.max(0.7, 1 - 0.1 * bossRound(S.lv));
    const mine = S.nodes.filter(n => n.owner === 1), big = (a, b) => b.units - a.units;
    const near = (a, b) => Math.hypot(a.x - core.x, a.y - core.y) - Math.hypot(b.x - core.x, b.y - core.y);
    let nodes = [];
    if (k.id === 'golem') nodes = mine.sort(big).slice(0, 2);
    else if (k.id === 'ice') nodes = mine.filter(n => !(n.iceT > 0)).sort(big).slice(0, 1);
    else if (k.id === 'shadow') {
      // Jump away from the player: to the boss or neutral region farthest from the player's land (a neutral one is taken).
      const dist = n => mine.reduce((m, o) => Math.min(m, Math.hypot(n.x - o.x, n.y - o.y)), Infinity);
      nodes = S.nodes.filter(n => n !== core && (n.owner === 2 || n.owner === 0) && n.type === 'normal').sort((a, b) => dist(b) - dist(a)).slice(0, 1);
    } else if (k.id === 'hive') nodes = S.nodes.filter(n => n.owner !== 2).sort((a, b) => (b.owner === 1) - (a.owner === 1) || near(a, b)).slice(0, 2);
    else if (k.id === 'dragon') nodes = mine.sort(near).slice(0, 1);
    if (!nodes.length) { S.skillT = 3; return; }
    S.warn = { kind: k.id, nodes, t: k.warn, max: k.warn, from: core };
    Sfx.play('boss');
  }
  function skillHit(w, core) {
    const rnd = bossRound(S.lv);
    if (w.kind === 'golem') {
      for (const n of w.nodes) {
        if (n.owner !== 1) continue;
        const loss = Math.floor(n.units * 0.3); n.units -= loss; n.pulse = 1;
        burst(n.x, n.y, '#8a6a44', 26, 140); if (loss) floatText(n.x, n.y - 30, '-' + loss, '#ffb36b');
      }
      S.shake = 14; UI.vibrate(60); Sfx.play('hit');
    } else if (w.kind === 'ice') {
      const n = w.nodes[0];
      if (n.owner === 1) { n.iceT = 5; n.pulse = 1; burst(n.x, n.y, '#bfeaff', 24, 110); floatText(n.x, n.y - 30, L('FROZEN', 'DONDU'), '#bfeaff'); UI.vibrate(30); }
    } else if (w.kind === 'shadow') {
      const to = w.nodes[0];
      if (to.owner === 1 || to.type !== 'normal') return;
      if (to.owner === 0) { to.owner = 2; to.units = 0; }
      // The tower moves with most of its garrison; the region left behind becomes an ordinary one.
      const i = S.nodes.indexOf(core), j = S.nodes.indexOf(to), move = Math.floor(core.units * 0.6);
      core.type = 'normal'; core.r = 16; core.units -= move;
      to.type = 'core'; to.r = 24; to.units += move; to.pulse = 1;
      burst(core.x, core.y, '#a78bfa', 26, 120); burst(to.x, to.y, '#a78bfa', 30, 140);
      if (R3 && R3.retype) { R3.retype(i, 'normal'); R3.retype(j, 'core'); }
      floatText(to.x, to.y - 40, L('BLINK!', 'IŞINLANDI!'), '#d8b4fe');
    } else if (w.kind === 'hive') {
      const n = 5 + Math.floor(S.lv / 6) + rnd * 3;
      for (const t of w.nodes) if (t.owner !== 2) S.streams.push({ from: core, to: t, owner: 2, left: n, t: 0 });
      burst(core.x, core.y, '#facc15', 20, 100);
    } else if (w.kind === 'dragon') {
      const t = w.nodes[0], ax = core.x, ay = core.y, bx = t.x - ax, by = t.y - ay, L2 = bx * bx + by * by || 1;
      let burned = 0;
      for (const d of S.dots) {
        if (d.owner !== 1 || d.dead) continue;
        const u = Math.max(0, Math.min(1, ((d.x - ax) * bx + (d.y - ay) * by) / L2)), ex = ax + bx * u - d.x, ey = ay + by * u - d.y;
        if (ex * ex + ey * ey < 38 * 38 && Math.random() < 0.5) { d.dead = true; burned++; }
      }
      if (t.owner === 1) { const loss = Math.floor(t.units * 0.25); t.units -= loss; burned += loss; t.pulse = 1; }
      for (let k = 0; k <= 10; k++) burst(ax + bx * k / 10, ay + by * k / 10, k % 2 ? '#ff7a1a' : '#ffd23f', 5, 70);
      if (burned) floatText(t.x, t.y - 30, '🔥 -' + burned, '#ffb36b');
      S.shake = 10; UI.vibrate(40); Sfx.play('hit');
    }
  }

  function update(dt) {
    S.time += dt;
    S.freezeT -= dt; S.speedT -= dt;
    S.shake = Math.max(0, S.shake - dt * 20);
    S.energy = Math.min(100, S.energy + dt * 1.2);

    for (const n of S.nodes) {
      n.pulse = Math.max(0, n.pulse - dt * 4);
      if (n.iceT > 0) { n.iceT -= dt; continue; } // frozen by the Ice Queen
      if (n.owner === 0 || (n.owner !== 1 && S.freezeT > 0)) continue;
      // Production stops at the cap; troops brought in above it stay (stockpiling is allowed).
      const cap = CAP[n.type];
      if (n.units < cap) n.units = Math.min(cap, n.units + prodRate(n) * dt);
    }

    for (const s of S.streams) {
      s.t -= dt;
      while (s.t <= 0 && s.left > 0) { emitDot(s); s.left--; s.t += 0.055; }
    }
    S.streams = S.streams.filter(s => s.left > 0);

    for (const d of S.dots) {
      const dx = d.to.x - d.x, dy = d.to.y - d.y, dist = Math.hypot(dx, dy);
      if (dist < d.to.r) { arrive(d); d.dead = true; continue; }
      const sp = dotSpeed(d.owner) * dt;
      d.x += dx / dist * sp; d.y += dy / dist * sp;
    }

    // Opposing dots annihilate each other (spatial hash).
    const grid = new Map(), CELL = 10;
    for (const d of S.dots) {
      if (d.dead) continue;
      const k = ((d.x / CELL) | 0) * 128 + ((d.y / CELL) | 0);
      let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(d);
    }
    for (const d of S.dots) {
      if (d.dead) continue;
      const cx = (d.x / CELL) | 0, cy = (d.y / CELL) | 0;
      outer: for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const a = grid.get((cx + i) * 128 + cy + j);
        if (!a) continue;
        for (const o of a) {
          if (o.dead || o.owner === d.owner) continue;
          const ex = o.x - d.x, ey = o.y - d.y;
          if (ex * ex + ey * ey < 30) {
            o.dead = d.dead = true;
            if (Math.random() < 0.3) burst(d.x, d.y, '#ffffff', 2, 40);
            break outer;
          }
        }
      }
    }
    S.dots = S.dots.filter(d => !d.dead);

    if (S.boss) { bossWave(dt); bossSkill(dt); }
    S.introT = Math.max(0, S.introT - dt);

    for (const ai of S.ai) {
      ai.t -= dt;
      if (ai.t > 0) continue;
      ai.t = S.aiThink * (0.7 + Math.random() * 0.6) * (S.freezeT > 0 ? 2 : 1);
      aiThink(ai);
    }

    S.shareT -= dt;
    if (S.shareT <= 0) { S.shareT = 0.25; updateShare(); }

    S.checkT -= dt;
    if (S.checkT <= 0) {
      S.checkT = 0.4;
      const alive = new Set();
      S.nodes.forEach(n => n.owner && alive.add(n.owner));
      S.dots.forEach(d => alive.add(d.owner));
      S.streams.forEach(s => alive.add(s.owner));
      if (!alive.has(1)) lose();
      else if (![...alive].some(o => o >= 2)) win();
    }
  }

  function updateParts(dt) {
    if (!S) return;
    for (const p of S.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt * 1.6; }
    S.parts = S.parts.filter(p => p.life > 0);
    for (const t of S.texts) { t.y -= 30 * dt; t.life -= dt * 0.9; }
    S.texts = S.texts.filter(t => t.life > 0);
  }

  // ---------- Input ----------
  // Any point inside a region selects its tower (much easier to hit than a small circle).
  function hit(p) {
    for (const n of S.nodes) if (n.poly && inPoly(p.x, p.y, n.poly)) return n;
    let best = null, bd = 34;
    for (const n of S.nodes) { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < bd) { bd = d; best = n; } }
    return best;
  }

  function reachable() {
    const out = new Set();
    for (const n of S.sel) for (const id of territory(n)) for (const nb of S.nodes[id].nb) if (S.nodes[nb].owner !== n.owner) out.add(nb);
    return out;
  }
  function sendSelection(target) {
    let sent = 0, far = 0;
    for (const n of S.sel) {
      if (n === target || n.owner !== 1 || n.units < 1) continue;
      if (!adjacent(n, target)) { far++; continue; }
      sent += Math.floor(n.units); send(n, target, 1);
    }
    if (!sent && far) { floatText(target.x, target.y - 34, L('No border!', 'Sınır yok!'), '#ff8a95'); UI.toast(L('You can only send troops to neighbouring regions', 'Sadece komşu bölgelere asker gönderebilirsin')); Sfx.play('hit'); }
    if (sent) {
      target.pulse = 1; S.sent = true;
      Sfx.play('send');
      floatText(target.x, target.y - 34, (target.owner === 1 ? '+' : '') + sent, target.owner === 1 ? '#9dffc2' : '#ffd0d5');
    }
    S.sel = []; S.tapSel = false;
  }

  cvs.addEventListener('pointerdown', e => {
    if (mode !== 'play' || paused) return;
    const p = toWorld(e), n = hit(p);
    if (!n) { S.sel = []; S.tapSel = false; return; }
    if (n.owner === 1) {
      const prev = S.tapSel ? S.sel.slice() : [];
      S.sel = [n]; S.tapSel = false;
      S.drag = { x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false, prev, start: n };
      try { cvs.setPointerCapture(e.pointerId); } catch (_) { }
    } else if (S.sel.length) {
      sendSelection(n); // tap-tap attack
    } else {
      S.sel = [];
    }
  });

  cvs.addEventListener('pointermove', e => {
    if (!S || !S.drag) return;
    const p = toWorld(e);
    S.drag.x = p.x; S.drag.y = p.y;
    if (Math.hypot(p.x - S.drag.sx, p.y - S.drag.sy) > 10) S.drag.moved = true;
    const n = hit(p);
    if (n && n.owner === 1 && !S.sel.includes(n)) S.sel.push(n);
  });

  function endDrag(e) {
    if (!S || !S.drag) return;
    const d = S.drag, p = toWorld(e), n = hit(p);
    S.drag = null;
    if (!d.moved) {
      if (d.prev.length && !d.prev.includes(d.start)) { S.sel = d.prev; sendSelection(d.start); } // tap own tower = reinforce it
      else if (d.prev.includes(d.start)) { S.sel = []; S.tapSel = false; } // tap again = deselect
      else S.tapSel = true; // first tap selects
      return;
    }
    if (!n) { S.sel = []; return; }
    if (n.owner !== 1) { sendSelection(n); return; }
    // Released on an own tower: reinforce it from every other tower the finger passed.
    const src = S.sel.filter(s => s !== n);
    if (src.length) { S.sel = src; sendSelection(n); } else S.sel = [];
  }
  cvs.addEventListener('pointerup', endDrag);
  cvs.addEventListener('pointercancel', () => { if (S) { S.drag = null; S.sel = []; S.tapSel = false; } });

  // ---------- Abilities ----------
  // Short labels under the buttons; holding one explains it.
  $('lbFreeze').textContent = L('Freeze', 'Dondur'); $('lbSpeed').textContent = L('Rush', 'Hücum'); $('lbAd').textContent = L('Reinforce', 'Takviye');
  if (window.Kit && Kit.holdTip) {
    Kit.holdTip($('abFreeze'), () => '<b>❄️ ' + L('Freeze', 'Dondur') + '</b> · ⚡' + COST_FREEZE + '<small>' + L('Every rival tower stops producing and its troops stand still for 4.5 s.', 'Rakip kuleler 4,5 sn boyunca üretmez, askerleri yerinde durur.') + '</small>');
    Kit.holdTip($('abSpeed'), () => '<b>💨 ' + L('Rush', 'Hücum') + '</b> · ⚡' + COST_SPEED + '<small>' + L('Your marching troops move much faster for 5 s.', 'Yürüyen askerlerin 5 sn boyunca çok daha hızlı gider.') + '</small>');
    $('energy').style.pointerEvents = 'auto'; $('energy').addEventListener('click', () => Kit.tip($('energy'), '<b>⚡ ' + L('Energy', 'Enerji') + '</b><small>' + L('Fills up over time. Freeze and Rush spend it.', 'Zamanla dolar. Dondur ve Hücum bunu harcar.') + '</small>'));
    Kit.holdTip($('abAd'), () => '<b>📺 ' + L('Reinforce', 'Takviye') + '</b><small>' + L('Watch an ad once per level: +10 troops to every tower you own.', 'Seviye başına bir kez reklam izle: sahip olduğun her kuleye +10 asker.') + '</small>');
  }
  $('abFreeze').onclick = () => {
    if (mode !== 'play' || paused || S.energy < COST_FREEZE) return;
    S.energy -= COST_FREEZE; S.freezeT = 4.5;
    UI.toast(L('❄️ Rivals frozen!', '❄️ Rakipler donduruldu!'));
    Sfx.play('freeze');
    Ads.track('ability', { type: 'freeze', level: S.lv });
  };
  $('abSpeed').onclick = () => {
    if (mode !== 'play' || paused || S.energy < COST_SPEED) return;
    S.energy -= COST_SPEED; S.speedT = 5;
    UI.toast(L('💨 Your troops sped up!', '💨 Birliklerin hızlandı!'));
    Sfx.play('power');
    Ads.track('ability', { type: 'speed', level: S.lv });
  };
  $('abAd').onclick = async () => {
    if (mode !== 'play' || paused || S.adUsed) return;
    paused = true;
    const ok = await Ads.rewarded('koloni_reinforce');
    paused = false;
    if (!ok) return;
    S.adUsed = true;
    S.nodes.forEach(n => { if (n.owner === 1) { n.units += 10; n.pulse = 1; burst(n.x, n.y, '#3be07a', 10, 80); floatText(n.x, n.y - 34, '+10', '#9dffc2'); } });
    UI.toast(L('+10 troops to every tower!', '+10 takviye her kuleye!'));
    Sfx.play('power');
  };

  function setAbility(el, cost) {
    const p = Math.min(100, S.energy / cost * 100);
    UI.prop(el, '--p', p.toFixed(0));
    if (el.disabled !== S.energy < cost) el.disabled = S.energy < cost;
    el.classList.toggle('ready', S.energy >= cost);
  }
  function updateAbilityUI() {
    if (mode !== 'play') return;
    setAbility($('abFreeze'), COST_FREEZE);
    setAbility($('abSpeed'), COST_SPEED);
    if ($('abAd').disabled !== !!S.adUsed) $('abAd').disabled = !!S.adUsed;
    UI.txt($('energy'), '⚡ ' + Math.floor(S.energy));
  }

  // Live territory share bar (player first, neutral last).
  const shareEls = [];
  function updateShare() {
    const bar = $('share');
    if (!shareEls.length) {
      for (const o of [1, 2, 3, 4, 0]) { const i = document.createElement('i'); i.dataset.o = o; shareEls.push(i); if (bar.appendChild) bar.appendChild(i); }
    }
    const cnt = [0, 0, 0, 0, 0];
    for (const n of S.nodes) cnt[n.owner]++;
    for (const i of shareEls) {
      const o = +i.dataset.o;
      i.style.flexGrow = cnt[o];
      i.style.background = o === 0 ? 'rgba(230,217,184,.55)' : COLORS[o];
    }
  }

  // ---------- Screens ----------
  function hud() {
    const lv = S && mode !== 'menu' ? S.lv : G.level;
    $('lvl').innerHTML = L('Level ', 'Seviye ') + lv + (isBoss(lv) ? ' ' + bossOf(lv).icon : '') + '<small>' + (isBoss(lv) ? bossOf(lv).name : Themes.forLevel(lv).name) + '</small>';
    $('coins').textContent = Kit.fmt(Save.data.coins);
  }

  function panel(html, center) {
    // Redrawing an open panel (tab switch, upgrade) swaps its content only, so the pop-in animation doesn't replay.
    const ov = $('ov'), cls = 'overlay' + (center ? ' center' : ''), sh = ov.className === cls && ov.querySelector(':scope > .sheet');
    ov.className = cls;
    if (sh) sh.innerHTML = html; else ov.innerHTML = '<div class="sheet">' + html + '</div>';
    $('abil').classList.add('hidden');
    Ads.banner(true);
    hud();
  }
  function closePanel() {
    $('ov').classList.add('hidden');
    Ads.banner(false);
  }

  const HELP =
    L('<div class="upg"><div><b>👆 Drag</b><small>Drag from your tower to a <b>neighbouring</b> region (they glow when selected). Reach far regions step by step.</small></div></div>', '<div class="upg"><div><b>👆 Sürükle</b><small>Kulenden <b>sınır komşusu</b> bir bölgeye sürükle (seçince parlayan bölgeler). Uzaktaki bölgelere komşu komşu ilerleyerek ulaşırsın.</small></div></div>') +
    L('<div class="upg"><div><b>🛡️ Reinforce</b><small>Tap your tower, then a neighbouring tower of yours: that is how you move troops to the front.</small></div></div>', '<div class="upg"><div><b>🛡️ Takviye</b><small>Kulene dokun, sonra komşu kulene dokun: askerleri cepheye böyle taşırsın.</small></div></div>') +
    L('<div class="upg"><div><b>🏭 Factory · 🏰 Fort</b><small>A factory produces twice as fast, a fort holds twice as long against attacks.</small></div></div>', '<div class="upg"><div><b>🏭 Fabrika · 🏰 Kale</b><small>Fabrika 2 kat üretir, kale saldırılara 2 kat dayanır.</small></div></div>') +
    L('<div class="upg"><div><b>⚡ Energy</b><small>Fills up as you conquer: ❄️ Freeze stops your rivals, 💨 Speed makes your troops fly.</small></div></div>', '<div class="upg"><div><b>⚡ Enerji</b><small>Fetih yaptıkça dolar: ❄️ Dondur rakibi durdurur, 💨 Hız birliklerini uçurur.</small></div></div>') +
    L('<div class="upg"><div><b>👑 Boss</b><small>A giant main tower every 10 levels. Take it and the whole colony collapses.</small></div></div>', '<div class="upg"><div><b>👑 Boss</b><small>Her 10 seviyede dev ana kule. Onu alırsan tüm koloni çöker.</small></div></div>');

  function startMenu() {
    mode = 'menu';
    newLevel(G.level); // map preview behind the menu
    const coins = Save.data.coins;
    const items = Object.keys(UPG).map(k => ({ key: k, icon: UPG[k].icon, name: UPG[k].name, level: G.upgrades[k], max: UPG[k].max, desc: upgDesc(k), cost: upgCost(k) }));
    const tabBody = menuTab === 'shop' ? Kit.shop('koloni', G, startMenu, { packSkin: L('Royal Gold', 'Kraliyet Altını'), skins: SKINS, packKey: 'kral', art: skinArt, packDesc: L('Your cells, towers and troops in shining royal gold', 'Hücrelerin, kulelerin ve birliklerin parlayan kraliyet altını') }) : menuTab === 'skin' ? Kit.skins(SKINS, G, coins, skinArt) : menuTab === 'help' ? HELP : Kit.upgrades(items, G.gold, '💰');
    panel(
      Kit.hero('koloni.webp', 'Colony Clash') +
      Kit.road(G.level, isBoss) +
      '<span class="chip">' + (themeOf(G.level).icon || '🗺️') + ' ' + themeOf(G.level).name + ' · ' + S.nodes.length + L(' regions', ' bölge') + (isBoss(G.level) ? ' · <b class="t-gold">BOSS</b>' : '') + '</span>' +
      (() => { const nx = Math.floor((G.level - 1) / 10) * 10 + 11, th = Themes.forLevel(nx); return '<p class="tip" style="margin:0">' + L('Next region at level ' + nx + ': ', nx + '. seviyede yeni bölge: ') + (th.icon || '') + ' ' + th.name + '</p>'; })() +
      (isBoss(G.level) ? (() => { const b = bossOf(G.level); return '<div class="bosscard"><b class="bi">' + b.icon + '</b><div><b>' + L('Boss: ', 'Boss: ') + b.name + '</b><small>⚡ ' + b.skill + '</small><small>' + L('Capture the main tower and the whole colony collapses! (2x reward)', 'Ana kuleyi al, bütün koloni çöker! (2x ödül)') + '</small></div></div>'; })() : '') +
      '<button class="btn green big pulse" data-act="play">' + L('PLAY', 'OYNA') + '</button>' +
      (boostStart
        ? '<button class="btn gray small" disabled>' + L('✓ Starting boost ready (+15)', '✓ Başlangıç takviyesi hazır (+15)') + '</button>'
        : '<button class="btn purple small" data-act="boost"><span class="ad-ico">AD</span>' + L('Start with +15 troops', 'Başlangıç +15 birlik') + '</button>') +
      Kit.tabs(menuTab, [{ id: 'up', label: L('⚡ Upgrade', '⚡ Geliştir') }, { id: 'skin', label: L('🎨 Color', '🎨 Renk') }, { id: 'shop', label: L('🛒 Shop', '🛒 Mağaza') }, { id: 'help', label: L('❓ How', '❓ Nasıl') }]) +
      tabBody +
      '<div class="row" style="justify-content:center"><button class="btn gray small" data-act="home">' + L('⌂ Home', '⌂ Ana Menü') + '</button></div>'
    );
  }

  function win() {
    mode = 'end';
    const lv = S.lv;
    pendingReward = Math.round((25 + 6 * Math.min(lv, 60) + Math.max(0, lv - 60)) * (S.boss ? 2 : 1) * PlayerLv.mul()); // player level bonus
    G.level = lv + 1;
    G.best = Math.max(G.best, lv);
    G.fails = 0;
    Save.save();
    Ads.track('level_win', { game: 'koloni', level: lv, boss: S.boss, time: Math.round(S.time) });
    Sfx.play('win');
    // Rating: few regions lost and a quick win. Par time grows with the map size.
    const par = 25 + S.nodes.length * 4, stars = 1 + (S.lost <= 1 ? 1 : 0) + (S.time <= par || S.lost === 0 ? 1 : 0);
    pendingStars = stars + (lv % 10 === 0 ? 3 : 0);
    panel(Kit.win({
      title: S.boss ? L('BOSS DEFEATED!', 'BOSS YENİLDİ!') : L('VICTORY!', 'ZAFER!'),
      sub: L('Level ', 'Seviye ') + lv + ' · ' + Math.round(S.time) + L(' s', ' sn') + (S.lost ? L(' · ' + S.lost + ' regions lost', ' · ' + S.lost + ' bölge kaybı') : L(' · flawless!', ' · kayıpsız!')) + L(' · target ' + par + ' s', ' · hedef ' + par + ' sn'),
      stars, reward: pendingReward, gems: pendingStars, ads: Kit.adsFor(G.level - 1),
    }), true);
  }

  function lose() {
    mode = 'end';
    G.fails = (G.fails || 0) + 1;
    Save.save();
    Ads.track('level_fail', { game: 'koloni', level: S.lv, fails: G.fails, time: Math.round(S.time) });
    Sfx.play('lose');
    panel(Kit.lose({
      title: L('DEFEATED', 'YENİLDİN'),
      sub: L('Level ', 'Seviye ') + S.lv,
      hint: ease() > 0 ? L('💡 Next try your rivals will be ' + Math.round(ease() * 100) + '% weaker.', '💡 Sonraki denemede rakipler %' + Math.round(ease() * 100) + ' daha zayıf olacak.') : L('💡 Combine your towers and attack at once: swipe over several towers.', '💡 Kulelerini birleştirip tek seferde saldır: parmağını birkaç kulenin üstünden geçir.'),
      extraButtons:
        '<button class="btn green big" data-act="retry">' + L('↻ Try Again', '↻ Tekrar Dene') + '</button>' +
        '<div class="row"><button class="btn purple small" data-act="skip"><span class="ad-ico">AD</span>' + L('Skip Level', 'Seviyeyi Atla') + '</button>' +
        '<button class="btn gray small" data-act="menu">' + L('Menu', 'Menü') + '</button></div>',
    }), true);
  }

  const actions = {
    play() {
      newLevel(G.level);
      const th = S.theme;
      if (S.newRegion && G.seenRegion !== th.id && window.Fx) {
        G.seenRegion = th.id; Save.save();
        Fx.reveal({ title: L('NEW REGION!', 'YENİ BÖLGE!'), button: L('Start', 'Başla'), items: [{ icon: th.icon || '🗺️', label: th.name, sub: L('New lands, new looks', 'Yeni topraklar, yeni görünüm'), rarity: 'legendary' }] }).then(() => actions.play());
        return;
      }
      boostStart = false;
      closePanel();
      mode = 'play';
      paused = false;
      $('abil').classList.remove('hidden');
      updateShare();
      hud();
      Ads.track('level_start', { game: 'koloni', level: S.lv, shape: S.shape, ease: ease() });
      if (S.boss) { Sfx.play('boss'); UI.toast(L('👑 Boss level!', '👑 Boss seviyesi!')); }
    },
    async boost() {
      if (await Ads.rewarded('koloni_start_boost')) { boostStart = true; UI.toast(L('Boost ready: +15 troops', 'Takviye hazır: +15 birlik')); }
      startMenu();
    },
    tab(t) { menuTab = t; startMenu(); },
    buy(k) {
      if (G.upgrades[k] >= UPG[k].max) return;
      if (G.gold < upgCost(k)) { UI.toast(L('Not enough gold', 'Yetersiz oyun altını')); return; }
      G.gold -= upgCost(k);
      G.upgrades[k]++;
      Save.save();
      UI.toast(UPG[k].icon + ' ' + UPG[k].name + ' ↑');
      Sfx.play('coin');
      startMenu();
    },
    async claim(m) {
      if (!pendingReward) return;
      if (+m === 3 && !(await Kit.multiAd('koloni_win_x3', Kit.adsFor(G.level - 1), 'win' + pendingReward, '[data-act=claim][data-arg="3"]'))) return;
      const amount = pendingReward * (+m === 3 ? 3 : 1);
      UI.toast('💰 +' + amount + (pendingStars ? ' · ⭐ +' + pendingStars : ''));
      G.gold += amount; Save.addCoins(pendingStars); pendingReward = 0; pendingStars = 0; Save.save();
      Sfx.play('coin');
      await Ads.levelEnd(G.level - 1);
      startMenu();
    },
    async skip() {
      if (!(await Ads.rewarded('koloni_skip_level'))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      G.level = S.lv + 1;
      G.fails = 0;
      Save.save();
      startMenu();
    },
    retry() { actions.play(); },
    skin(k) { if (G.skins.includes(k)) { G.skin = k; applySkin(); Save.save(); startMenu(); } },
    skinBuy(k) {
      if (!Save.spend(SKINS[k].cost)) { UI.toast(L('Not enough ⭐ stars', 'Yetersiz ⭐ yıldız')); return; }
      G.skins.push(k); G.skin = k; applySkin(); Save.save();
      UI.toast(SKINS[k].name + L(' unlocked!', ' açıldı!')); Sfx.play('coin');
      startMenu();
    },
    async skinAd(k) {
      if (!(await Ads.rewarded('koloni_skin_' + k))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      G.adSkin++;
      if (G.adSkin >= SKINS[k].ads) { G.skins.push(k); G.skin = k; applySkin(); UI.toast(SKINS[k].name + L(' unlocked!', ' açıldı!')); }
      Save.save();
      startMenu();
    },
    menu() { startMenu(); },
    resume() { paused = false; closePanel(); $('abil').classList.remove('hidden'); },
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
    panel('<p class="t-lg">' + L('Paused', 'Duraklatıldı') + '</p>' +
      '<button class="btn green big" data-act="resume">' + L('▶ Resume', '▶ Devam') + '</button>' +
      '<button class="btn gray" data-act="menu">' + L('Quit level', 'Seviyeden çık') + '</button>', true);
  };

  // Android back: playing -> pause; pause/result/game menu -> level menu or hub.
  UI.onBack(() => {
    if (mode === 'play' && !paused) { $('pauseBtn').onclick(); return; }
    if (mode === 'menu') { UI.goHome('../index.html'); return; }
    startMenu();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'play' && !paused) $('pauseBtn').onclick();
  });

  // ---------- Render ----------
  function polyPath(poly, dx, dy) {
    ctx.beginPath();
    ctx.moveTo(poly[0][0] + (dx || 0), poly[0][1] + (dy || 0));
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0] + (dx || 0), poly[i][1] + (dy || 0));
    ctx.closePath();
  }

  function drawSea(th) {
    ctx.strokeStyle = th.dot; ctx.lineWidth = 2;
    const t = S ? S.time : performance.now() / 1000;
    for (let row = -4; row < 22; row++) {
      const y = 40 + row * 50, off = (t * 12 + row * 37) % 60;
      ctx.beginPath();
      for (let x = -60 + off; x < W + 60; x += 60) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 15, y - 6, x + 30, y); }
      ctx.stroke();
    }
  }

  function drawMap() {
    const coast = S.coast;
    // Cliff (3D extrusion) + shore foam.
    ctx.fillStyle = 'rgba(0,0,0,.35)'; polyPath(coast, 0, 22); ctx.fill();
    ctx.fillStyle = '#7a5f3e'; polyPath(coast, 0, 13); ctx.fill();
    ctx.fillStyle = '#5c472e';
    for (let k = 0; k < 2; k++) { polyPath(coast, 0, 6 + k * 4); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 7; polyPath(coast, 0, 3); ctx.stroke();

    // Regions.
    for (const n of S.nodes) {
      if (!n.poly || n.poly.length < 3) continue;
      const p = pal(n.owner);
      ctx.fillStyle = n.owner === 0 ? (n.tone > 0.5 ? '#e9ddbd' : '#e1d3b0') : p.land;
      polyPath(n.poly); ctx.fill();
      if (S.freezeT > 0 && n.owner >= 2) { ctx.fillStyle = 'rgba(190,240,255,.45)'; ctx.fill(); }
    }
    // Borders: thin inner lines, thicker between different owners.
    ctx.lineJoin = 'round';
    for (const n of S.nodes) {
      if (!n.poly || n.poly.length < 3) continue;
      ctx.strokeStyle = n.owner === 0 ? 'rgba(120,95,60,.45)' : pal(n.owner).dark;
      ctx.lineWidth = n.owner === 0 ? 1.5 : 2.5;
      polyPath(n.poly); ctx.stroke();
    }
    ctx.strokeStyle = '#5c472e'; ctx.lineWidth = 3; polyPath(coast); ctx.stroke();

    // Selection glow.
    for (const n of S.sel) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.18 + Math.sin(S.time * 8) * 0.06) + ')';
      polyPath(n.poly); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
    }
    if (S.drag && S.drag.moved) {
      const t = hit(S.drag);
      if (t && !S.sel.includes(t)) {
        ctx.fillStyle = t.owner === 1 ? 'rgba(157,255,194,.35)' : 'rgba(255,90,100,.3)';
        polyPath(t.poly); ctx.fill();
        ctx.strokeStyle = t.owner === 1 ? '#9dffc2' : '#ff5a64'; ctx.lineWidth = 4; ctx.stroke();
      }
    }
  }

  function drawDots() {
    for (let o = 1; o < COLORS.length; o++) {
      const p = pal(o);
      ctx.beginPath();
      let any = false;
      for (const d of S.dots) if (d.owner === o) { ctx.moveTo(d.x + 3.6, d.y); ctx.arc(d.x, d.y, 3.6, 0, TAU); any = true; }
      if (!any) continue;
      ctx.fillStyle = p.base; ctx.fill();
      ctx.strokeStyle = p.deep; ctx.lineWidth = 1.2; ctx.stroke();
    }
  }

  function drawTower(n) {
    const p = pal(n.owner);
    const s = (n.type === 'core' ? 1.5 : n.type === 'fort' ? 1.15 : n.type === 'factory' ? 1.08 : 1) * (1 + n.pulse * 0.18);
    const x = n.x, y = n.y + 6, w = 11 * s, h = 18 * s, ry = 4.2 * s;
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(x + 3, y + 2, w + 5, ry + 2, 0, 0, TAU); ctx.fill();
    // Body (cylinder).
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, p.dark); g.addColorStop(0.4, p.light); g.addColorStop(1, p.dark);
    ctx.fillStyle = g; ctx.strokeStyle = p.deep; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - w, y - h); ctx.lineTo(x - w, y);
    ctx.ellipse(x, y, w, ry, 0, Math.PI, 0, true);
    ctx.lineTo(x + w, y - h); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = p.light;
    ctx.beginPath(); ctx.ellipse(x, y - h, w, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (n.type === 'normal' || n.type === 'fort') {
      // Crenellations.
      ctx.fillStyle = p.base;
      for (const bx of [-0.75, 0, 0.75]) {
        ctx.fillRect(x + bx * w - 2.6 * s, y - h - 6 * s, 5.2 * s, 6 * s);
        ctx.strokeRect(x + bx * w - 2.6 * s, y - h - 6 * s, 5.2 * s, 6 * s);
      }
    }
    if (n.type === 'fort') {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = p.deep;
      ctx.beginPath(); ctx.moveTo(x, y - h + 4 * s); ctx.lineTo(x + 5 * s, y - h + 6 * s); ctx.lineTo(x + 4.5 * s, y - 4 * s);
      ctx.lineTo(x, y - 1.5 * s); ctx.lineTo(x - 4.5 * s, y - 4 * s); ctx.lineTo(x - 5 * s, y - h + 6 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (n.type === 'factory') {
      ctx.fillStyle = p.dark;
      ctx.fillRect(x + w * 0.2, y - h - 11 * s, 5 * s, 11 * s); ctx.strokeRect(x + w * 0.2, y - h - 11 * s, 5 * s, 11 * s);
      if (n.owner) {
        const t = (S.time * 0.8 + n.id * 0.3) % 1;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * (1 - t)) + ')';
        ctx.beginPath(); ctx.arc(x + w * 0.2 + 2.5 * s + t * 6, y - h - 13 * s - t * 14, 3 * s + t * 4, 0, TAU); ctx.fill();
      }
    }
    if (n.type === 'core') {
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#8a5200'; ctx.lineWidth = 2;
      const cy = y - h - 4 * s;
      ctx.beginPath(); ctx.moveTo(x - 9 * s, cy); ctx.lineTo(x - 9 * s, cy - 9 * s); ctx.lineTo(x - 4.5 * s, cy - 4 * s); ctx.lineTo(x, cy - 11 * s);
      ctx.lineTo(x + 4.5 * s, cy - 4 * s); ctx.lineTo(x + 9 * s, cy - 9 * s); ctx.lineTo(x + 9 * s, cy); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // Unit badge.
    const txt = String(Math.floor(n.units));
    ctx.font = '800 14px ' + FONT;
    const tw = Math.max(22, ctx.measureText(txt).width + 12), by = y - h - (n.type === 'core' ? 34 : n.type === 'factory' ? 30 : 22) * (s > 1.2 ? 1.1 : 1);
    ctx.fillStyle = n.owner === 0 ? 'rgba(60,45,25,.85)' : p.deep;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - tw / 2, by - 10, tw, 20, 10) : ctx.rect(x - tw / 2, by - 10, tw, 20); ctx.fill();
    ctx.strokeStyle = n.owner === 0 ? '#e6d9b8' : p.light; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, by + 1);
  }

  function drawBadge(x, by, n, scale) {
    const p = pal(n.owner), txt = String(Math.floor(n.units)), k = scale || 1;
    ctx.font = '800 ' + Math.round(14 * k) + 'px ' + FONT;
    const tw = Math.max(22 * k, ctx.measureText(txt).width + 12 * k), h = 20 * k;
    ctx.fillStyle = n.owner === 0 ? 'rgba(60,45,25,.88)' : p.deep;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - tw / 2, by - h / 2, tw, h, h / 2) : ctx.rect(x - tw / 2, by - h / 2, tw, h); ctx.fill();
    ctx.strokeStyle = n.owner === 0 ? '#e6d9b8' : p.light; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, by + 1);
  }

  // Screen-space overlay on top of the 3D scene: unit badges, drag arrows, effects, tutorial.
  function drawOverlay3D() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (!S) return;
    const P = (x, y, h) => R3.project(x, y, h);
    const lift = n => (n.owner === 1 ? 9 : n.owner >= 2 ? 5 : 0);
    const order = S.nodes.map((n, i) => [n, i]).sort((a, b) => a[0].y - b[0].y);
    for (const [n, i] of order) { const p = P(n.x, n.y, R3.towerHeight(i) + lift(n) + 7); drawBadge(p.x, p.y, n); }
    if (S.drag && S.drag.moved) {
      const t = hit(S.drag), tp = t ? P(t.x, t.y, 14) : P(S.drag.x, S.drag.y, 0);
      // Grey arrow = no shared border, the troops can't go there.
      for (const n of S.sel) if (n !== t) { const sp = P(n.x, n.y, 14), ok = !t || adjacent(n, t); arrow(sp.x, sp.y, tp.x, tp.y, !ok ? 'rgba(160,160,170,.6)' : t && t.owner !== 1 ? '#ff6b75' : '#ffffff'); }
    }
    for (const p of S.parts) {
      const q = P(p.x, p.y, 14 + (1 - p.life) * 10);
      ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.fillRect(q.x - 3, q.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of S.texts) {
      const q = P(t.x, t.y, 40);
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = '800 20px ' + FONT; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = '#1b1464'; ctx.strokeText(t.txt, q.x, q.y);
      ctx.fillStyle = t.c; ctx.fillText(t.txt, q.x, q.y);
    }
    ctx.globalAlpha = 1;
    if (S.boss) drawBossFx(P);
    if (mode === 'play' && S.lv === 1 && !S.sent) {
      const me = S.nodes.find(n => n.owner === 1);
      const tgt = me && S.nodes.filter(n => n.owner === 0).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
      if (me && tgt) {
        const a = P(me.x, me.y, 12), b = P(tgt.x, tgt.y, 12);
        ctx.globalAlpha = 0.6 + Math.sin(S.time * 5) * 0.3; arrow(a.x, a.y, b.x, b.y, '#fff36b'); ctx.globalAlpha = 1;
        const ty = UI.safeArea().hudBottom + 30;
        ctx.font = '800 22px ' + FONT; ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = '#1b1464';
        ctx.strokeText(L('Drag from your tower!', 'Kulenden sürükle!'), innerWidth / 2, ty); ctx.fillStyle = '#fff'; ctx.fillText(L('Drag from your tower!', 'Kulenden sürükle!'), innerWidth / 2, ty);
      }
    }
  }

  // Boss visuals on the overlay: its emblem over the main tower, frozen regions, the skill warning (pulsing ring on
  // the targets, or the fire line), a timer chip under the HUD and the intro title.
  function drawBossFx(P) {
    const k = S.bossK, core = S.nodes.find(n => n.type === 'core' && n.owner === 2), t = S.time;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const n of S.nodes) if (n.iceT > 0) {
      const q = P(n.x, n.y, 30); ctx.font = '26px ' + FONT; ctx.globalAlpha = 0.8 + 0.2 * Math.sin(t * 6); ctx.fillText('❄️', q.x, q.y - 34); ctx.globalAlpha = 1;
    }
    if (core) { const q = P(core.x, core.y, 70); ctx.font = (34 + 3 * Math.sin(t * 3)) + 'px ' + FONT; ctx.fillText(k.icon, q.x, q.y - 30); }
    const w = S.warn;
    if (w) {
      const a = 0.55 + 0.45 * Math.sin(t * 16), fill = 1 - w.t / w.max;
      ctx.globalAlpha = a;
      if (w.kind === 'dragon') {
        const p1 = P(w.from.x, w.from.y, 12), p2 = P(w.nodes[0].x, w.nodes[0].y, 12);
        ctx.setLineDash([14, 10]); ctx.lineCap = 'round'; ctx.strokeStyle = '#ff3b1f'; ctx.lineWidth = 10 + 10 * fill;
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); ctx.setLineDash([]);
      }
      const col = { golem: '#ffb36b', ice: '#9fe8ff', shadow: '#c084fc', hive: '#facc15', dragon: '#ff5a3a' }[w.kind];
      for (const n of w.nodes) {
        const q = P(n.x, n.y, 6), r = 34 + 10 * (1 - fill);
        ctx.beginPath(); ctx.ellipse(q.x, q.y, r, r * 0.62, 0, 0, TAU); ctx.strokeStyle = '#1b1464'; ctx.lineWidth = 10; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.stroke();
        ctx.font = '24px ' + FONT; ctx.fillText(k.icon, q.x, q.y - r * 0.62 - 14);
      }
      ctx.globalAlpha = 1;
    }
    // Timer chip: boss + skill name and seconds to the next cast.
    const top = UI.safeArea().hudBottom + 8, lbl = k.icon + ' ' + k.name + ' · ' + (w ? '⚠️ ' + L('NOW!', 'ŞİMDİ!') : '⚡ ' + Math.ceil(Math.max(0, S.skillT)) + L('s', 'sn'));
    ctx.font = '800 15px ' + FONT; const tw = ctx.measureText(lbl).width + 26;
    ctx.fillStyle = 'rgba(30,10,50,.78)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(innerWidth / 2 - tw / 2, top, tw, 26, 13) : ctx.rect(innerWidth / 2 - tw / 2, top, tw, 26); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#1b1464'; ctx.strokeText(lbl, innerWidth / 2, top + 13); ctx.fillStyle = w ? '#ff8a6b' : '#fff'; ctx.fillText(lbl, innerWidth / 2, top + 13);
    if (S.introT > 0) {
      const y = innerHeight * 0.4; ctx.globalAlpha = Math.min(1, S.introT);
      ctx.font = '800 34px ' + FONT; ctx.lineWidth = 8; ctx.strokeStyle = '#1b1464';
      ctx.strokeText(k.icon + ' ' + k.name, innerWidth / 2, y); ctx.fillStyle = '#ffd23f'; ctx.fillText(k.icon + ' ' + k.name, innerWidth / 2, y);
      ctx.font = '800 15px ' + FONT; ctx.lineWidth = 5;
      const sk = k.skill, mw = innerWidth - 40; let size = 15; while (size > 10 && ctx.measureText(sk).width > mw) { size--; ctx.font = '800 ' + size + 'px ' + FONT; }
      ctx.strokeText(sk, innerWidth / 2, y + 34); ctx.fillStyle = '#fff'; ctx.fillText(sk, innerWidth / 2, y + 34);
      ctx.globalAlpha = 1;
    }
  }

  function arrow(x1, y1, x2, y2, color) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    if (L < 20) return;
    const cx = (x1 + x2) / 2 - dy * 0.18, cy = (y1 + y2) / 2 + dx * 0.18;
    const a = Math.atan2(y2 - cy, x2 - cx), ex = x2 - Math.cos(a) * 12, ey = y2 - Math.sin(a) * 12;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.strokeStyle = 'rgba(20,15,60,.6)'; ctx.lineWidth = 12; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - Math.cos(a - 0.5) * 20, y2 - Math.sin(a - 0.5) * 20);
    ctx.lineTo(x2 - Math.cos(a + 0.5) * 20, y2 - Math.sin(a + 0.5) * 20); ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = 'rgba(20,15,60,.7)'; ctx.lineWidth = 3; ctx.stroke();
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const th = S ? S.theme : Themes.forLevel(G.level);
    const g = ctx.createLinearGradient(0, 0, 0, cvs.height);
    g.addColorStop(0, th.top); g.addColorStop(1, th.bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, cvs.width, cvs.height);

    const sx = S && S.shake ? (Math.random() - 0.5) * S.shake : 0;
    const sy = S && S.shake ? (Math.random() - 0.5) * S.shake : 0;
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (ox + sx), dpr * (oy + sy));
    drawSea(th);
    if (!S) return;

    drawMap();
    drawDots();
    const order = S.nodes.slice().sort((a, b) => a.y - b.y); // draw back to front
    for (const n of order) drawTower(n);

    if (S.drag && S.drag.moved) {
      const t = hit(S.drag), tx = t ? t.x : S.drag.x, ty = t ? t.y : S.drag.y;
      for (const n of S.sel) if (n !== t) arrow(n.x, n.y - 8, tx, ty - 8, t && !adjacent(n, t) ? 'rgba(160,160,170,.6)' : t && t.owner !== 1 ? '#ff6b75' : '#ffffff');
    }

    for (const p of S.parts) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of S.texts) {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = '800 18px ' + FONT;
      ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = '#1b1464'; ctx.strokeText(t.txt, t.x, t.y);
      ctx.fillStyle = t.c; ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    // Level 1 tutorial: a pulsing arrow to the nearest neutral region until the first send.
    if (mode === 'play' && S.lv === 1 && !S.sent) {
      const me = S.nodes.find(n => n.owner === 1);
      const tgt = me && S.nodes.filter(n => n.owner === 0).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
      if (me && tgt) {
        ctx.globalAlpha = 0.6 + Math.sin(S.time * 5) * 0.3;
        arrow(me.x, me.y + 6, tgt.x, tgt.y - 4, '#fff36b');
        ctx.globalAlpha = 1;
        ctx.font = '800 20px ' + FONT; ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = '#1b1464';
        const ty = MAP.cy - MAP.ry - 26;
        ctx.strokeText(L('Drag from your tower!', 'Kulenden sürükle!'), W / 2, ty); ctx.fillStyle = '#fff'; ctx.fillText(L('Drag from your tower!', 'Kulenden sürükle!'), W / 2, ty);
      }
    }
  }

  // ---------- Loop ----------
  let last = performance.now();
  function loop(t) {
    requestAnimationFrame(loop);
    if (t - last < 7) return; // follow the screen (up to 120 Hz): 60 fps looked choppy on 120 Hz phones
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (mode === 'play' && !paused) { update(dt); updateAbilityUI(); }
    updateParts(dt);
    if (R3 && S) {
      R3.render(S, dt, { sel: S.sel, hover: S.drag && S.drag.moved ? hit(S.drag) : null, reach: reachable() });
      drawOverlay3D();
    } else draw();
  }

  window.__koloni = { get S() { return S; }, G, newLevel, update, aiThink, setMode: m => { mode = m; } }; // test hook
  startMenu();
  // Preview/screenshot hooks: #play starts a level, #demo fast-forwards a short battle.
  if (location.hash === '#play' || location.hash === '#demo') actions.play();
  if (location.hash === '#demo') {
    const me = S.nodes.find(n => n.owner === 1);
    for (let i = 0; i < 262; i++) {
      if (i % 40 === 0 || i === 250) {
        const t = S.nodes.filter(n => n.owner !== 1).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
        S.sel = S.nodes.filter(n => n.owner === 1); if (t) sendSelection(t);
      }
      update(0.05);
    }
    S.sel = S.nodes.filter(n => n.owner === 1).slice(0, 2);
    S.drag = { x: MAP.cx + 60, y: MAP.cy - 80, sx: 0, sy: 0, moved: true, prev: [], start: S.sel[0] };
  }
  Sfx.music(true);
  requestAnimationFrame(loop);
})();
