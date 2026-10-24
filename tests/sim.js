// Long-run player simulation: loads the real pages in a fake browser (virtual clock, mocked
// AdMob / Play Billing / WebAudio / canvas) and plays both games like a player for N days.
// Usage: node tests/sim.js [days=120] [seed=42]
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DAYS = +process.argv[2] || 120;
const SEED = +process.argv[3] || 42;
const DAY_MS = 86400000;
const EPOCH = new Date(2026, 9, 1, 0, 0, 0).getTime(); // 1 Oct 2026, local time

function mulberry(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rand = mulberry(SEED);

// ---------- Global sim state ----------
const clock = { ms: 0 };
const persist = {};          // localStorage (survives app restarts)
let session = {};            // sessionStorage (per app launch)
let timers = [], tid = 0;
let day = 0;
const ERR = [];
const errCounts = {};
function err(msg) {
  errCounts[msg] = (errCounts[msg] || 0) + 1;
  if (errCounts[msg] <= 3) ERR.push('[gün ' + day + '] ' + msg);
}

const STATS = {
  sessions: 0, levels: { hucre: 0, suru: 0 }, wins: { hucre: 0, suru: 0 }, losses: { hucre: 0, suru: 0 },
  timeouts: [], rewardedShown: 0, rewardedEarly: 0, rewardedGranted: 0, inter: 0, bannerShows: 0,
  consentForms: 0, iapOrders: 0, daily: 0, dailyCoins: 0, maxFrameMs: { hucre: 0, suru: 0 }, frames: 0, frameMsTotal: 0,
  audioNodes: 0, maxStreak: 0, skips: 0, revives: 0, pauses: 0, history: [],
  failStreak: { hucre: { lv: 0, n: 0, max: 0, maxLv: 0 }, suru: { lv: 0, n: 0, max: 0, maxLv: 0 } },
  maxUnits: 0, maxDots: 0, bannerDuringPlay: 0, interBeforeL3: 0, interNoAds: 0,
};

// ---------- Virtual timers ----------
function setT(fn, ms, repeat) {
  const id = ++tid;
  timers.push({ id, fn, at: clock.ms + Math.max(0, ms || 0), rep: repeat ? Math.max(1, ms || 1) : 0 });
  return id;
}
function clearT(id) { timers = timers.filter(t => t.id !== id); }
function runTimers() {
  for (let guard = 0; guard < 2000; guard++) {
    let best = null;
    for (const t of timers) if (t.at <= clock.ms && (!best || t.at < best.at)) best = t;
    if (!best) return;
    if (best.rep) best.at += best.rep; else timers = timers.filter(t => t !== best);
    try { best.fn(); } catch (e) { err('timer callback threw: ' + e.message); }
  }
  err('timer loop runaway');
}
const flush = async (n = 3) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

// ---------- Fake Date ----------
const RealDate = Date;
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(EPOCH + clock.ms); else super(...a); }
  static now() { return EPOCH + clock.ms; }
}

// ---------- WebAudio mock with validation ----------
function audioParam() {
  return {
    value: 0,
    setValueAtTime(v, t) { if (!isFinite(v) || !isFinite(t)) err('audio setValueAtTime non-finite'); },
    exponentialRampToValueAtTime(v, t) { if (!(v > 0) || !isFinite(t)) err('audio expRamp invalid value ' + v); },
  };
}
class FakeAudioContext {
  constructor() { this.state = 'running'; this.sampleRate = 44100; this.destination = {}; }
  get currentTime() { return clock.ms / 1000; }
  createGain() { STATS.audioNodes++; return { gain: audioParam(), connect() { } }; }
  createOscillator() {
    STATS.audioNodes++;
    return { type: '', frequency: audioParam(), connect() { }, start(t) { if (!isFinite(t)) err('osc start non-finite'); }, stop() { } };
  }
  createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
  createBufferSource() { STATS.audioNodes++; return { buffer: null, connect() { }, start() { }, stop() { } }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, connect() { } }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
}

// ---------- Canvas mock with validation ----------
function makeCtx() {
  const t = {};
  return new Proxy(t, {
    get(_, k) {
      if (k in t) return t[k];
      return (t[k] = (...args) => {
        for (const a of args) if (typeof a === 'number' && !isFinite(a)) { err('canvas ' + String(k) + ' non-finite arg'); break; }
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return { addColorStop() { } };
        if (k === 'measureText') return { width: String(args[0]).length * 8 };
      });
    },
    set(_, k, v) { if (typeof v === 'number' && !isFinite(v)) err('canvas ' + String(k) + ' = non-finite'); return true; },
  });
}

// ---------- Native plugin mocks (live for one app launch) ----------
const IAPSTATE = { owned: false };
let native = null;
const ADSTATE = { banner: false, listeners: 0 };

function makeAdmob() {
  const L = {};
  const fire = (e, d) => (L[e] || []).slice().forEach(f => f(d));
  const count = () => Object.entries(L).filter(([e]) => !/^banner/.test(e)).reduce((a, [, b]) => a + b.length, 0); // banner size hooks are permanent by design
  const names = () => Object.entries(L).filter(([, b]) => b.length).map(([e, b]) => e + '×' + b.length).join(',');
  return {
    count, names,
    initialize: async () => { },
    requestConsentInfo: async () => ({ status: 'OBTAINED', isConsentFormAvailable: true, canRequestAds: true, privacyOptionsRequirementStatus: 'REQUIRED' }),
    showConsentForm: async () => { STATS.consentForms++; },
    showPrivacyOptionsForm: async () => { },
    showBanner: async () => { ADSTATE.banner = true; STATS.bannerShows++; if (JSON.parse(persist.kapiskapis_save_v1 || '{}').noAds) err('banner shown although noAds'); },
    hideBanner: async () => { ADSTATE.banner = false; },
    addListener: async (e, f) => { (L[e] = L[e] || []).push(f); return { remove() { L[e] = L[e].filter(x => x !== f); } }; },
    prepareInterstitial: async () => ({}),
    prepareRewardVideoAd: async () => ({}),
    showInterstitial: () => {
      STATS.inter++;
      if (JSON.parse(persist.kapiskapis_save_v1 || '{}').noAds) STATS.interNoAds++;
      if (native && native.onInter) native.onInter();
      setT(() => fire('interstitialAdDismissed'), 5000);
      return Promise.resolve();
    },
    // Like the real plugin: resolves only when the reward is earned; early close only fires Dismissed.
    showRewardVideoAd: () => new Promise(res => {
      STATS.rewardedShown++;
      if (rand() < 0.88) {
        setT(() => { fire('onRewardedVideoAdReward', { type: 'coin', amount: 1 }); res({ type: 'coin', amount: 1 }); }, 15000);
        setT(() => fire('onRewardedVideoAdDismissed'), 15200);
      } else {
        STATS.rewardedEarly++;
        setT(() => fire('onRewardedVideoAdDismissed'), 4000);
      }
    }),
  };
}

function makeCdv() {
  const cbs = { approved: [], verified: [], finished: [], productUpdated: [] };
  const product = {
    id: 'remove_ads', get owned() { return IAPSTATE.owned; }, pricing: { price: '₺49,99' },
    getOffer() {
      return {
        order: async () => {
          STATS.iapOrders++;
          const tx = {
            products: [{ id: 'remove_ads' }],
            verify() { setT(() => cbs.verified.forEach(f => f({ finish() { IAPSTATE.owned = true; cbs.finished.forEach(g => g(tx)); } })), 10); },
          };
          setT(() => cbs.approved.forEach(f => f(tx)), 2000);
          return undefined;
        },
      };
    },
  };
  const when = {};
  for (const k of Object.keys(cbs)) when[k] = f => { cbs[k].push(f); return when; };
  return {
    ProductType: { NON_CONSUMABLE: 'non consumable' },
    Platform: { GOOGLE_PLAY: 'android-playstore' },
    store: {
      register() { }, when: () => when, error() { },
      initialize: async () => [],
      get: id => (id === 'remove_ads' ? product : undefined),
      restorePurchases: async () => { if (IAPSTATE.owned) cbs.productUpdated.forEach(f => f(product)); },
    },
  };
}

// ---------- Page loader ----------
const SRC = {};
const read = f => SRC[f] || (SRC[f] = fs.readFileSync(path.join(ROOT, f), 'utf8'));
const HOOK = 'let S = null; window.__S = () => S; window.__M = () => mode; window.__G = () => G; window.__P = () => paused;';

let page = null;
function storage(obj) {
  return {
    getItem: k => (k in obj ? obj[k] : null),
    setItem: (k, v) => { obj[k] = String(v); },
    removeItem: k => { delete obj[k]; },
  };
}
function makeEl(id) {
  const cls = new Set();
  const el = {
    id, innerHTML: '', textContent: '', style: { setProperty() { } }, disabled: false, dataset: {}, className: '', listeners: {},
    classList: {
      add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)),
      toggle: (c, f) => { const on = f === undefined ? !cls.has(c) : !!f; on ? cls.add(c) : cls.delete(c); return on; },
      contains: c => cls.has(c),
    },
    addEventListener(t, f) { (el.listeners[t] = el.listeners[t] || []).push(f); },
    remove() { }, appendChild() { }, querySelector: s => /sheet/.test(s) ? null : makeEl('q'), setPointerCapture() { }, getContext: () => makeCtx(),
    width: 0, height: 0, onclick: null,
  };
  return el;
}

async function loadPage(name, referrer) {
  timers = [];
  const els = {}, docL = {}, winL = {};
  const $ = id => els[id] || (els[id] = makeEl(id));
  $('ov').classList.add('hidden');
  const nav = { go: null };
  let raf = null;
  const math = Object.create(Math); math.random = rand;
  const sb = {
    console: { log() { }, warn() { }, error: (...a) => err('console.error ' + a.join(' ')) },
    Math: math, JSON, Date: FakeDate, Float32Array, Promise, Event: class { constructor(t) { this.type = t; } },
    setTimeout: setT, clearTimeout: clearT, setInterval: (f, ms) => setT(f, ms, true), clearInterval: clearT,
    innerWidth: 390, innerHeight: 844, devicePixelRatio: 3,
    addEventListener: (t, f) => (winL[t] = winL[t] || []).push(f),
    localStorage: storage(persist), sessionStorage: storage(session),
    navigator: { vibrate() { } }, performance: { now: () => clock.ms },
    requestAnimationFrame: f => { raf = f; },
    document: {
      getElementById: $, createElement: () => makeEl('dyn'), body: { appendChild() { } }, head: { appendChild() { } }, querySelector: () => makeEl('q'), querySelectorAll: () => [], hidden: false, referrer: referrer || '',
      addEventListener: (t, f) => (docL[t] = docL[t] || []).push(f),
      dispatchEvent: e => (docL[e.type] || []).forEach(f => f(e)),
    },
    location: { set href(u) { nav.go = u; }, get href() { return ''; }, replace(u) { nav.go = u; }, reload() { nav.go = 'reload'; } },
    history: { length: 2, back() { nav.go = 'back'; } },
    AudioContext: FakeAudioContext,
    MutationObserver: class { observe() { } disconnect() { } }, ResizeObserver: class { observe() { } disconnect() { } },
    Capacitor: { isNativePlatform: () => true, Plugins: { AdMob: native.admob } },
    CdvPurchase: native.cdv,
  };
  sb.window = sb;
  vm.createContext(sb);
  // 3D renderers (three.js) are not loaded: every game falls back to running without R3.
  const files = ['ortak/economy.js', 'ortak/cloud.js', 'ortak/sound.js', 'ortak/ads.js', 'ortak/iap.js', 'ortak/themes.js', 'ortak/kit.js', 'ortak/art.js'];
  sb.Fx = { reveal: () => Promise.resolve(), burst() { }, RAR: {}, at: () => ({ x: 0, y: 0 }) }; // DOM animation, not simulated
  if (name !== 'hub') { if (name === 'altin-ocagi') files.push('altin-ocagi/empire.js'); files.push(name + '/game.js'); }
  for (const f of files) {
    let code = read(f);
    if (f.endsWith('game.js') && code.includes('let S = null;')) code = code.replace('let S = null;', HOOK);
    vm.runInContext(code, sb, { filename: f });
  }
  if (name === 'hub') {
    const html = read('index.html');
    const inline = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    vm.runInContext(inline, sb, { filename: 'index.html' });
  }
  (docL.deviceready || []).forEach(f => f());
  // First user touch unlocks audio.
  (winL.pointerdown || []).forEach(f => f({}));
  await flush();
  page = { name, sb, $, els, docL, winL, nav, get raf() { return raf; } };
  return page;
}

// ---------- Frame stepping ----------
function frame(dtMs) {
  clock.ms += dtMs;
  const t0 = process.hrtime.bigint();
  try { page.raf && page.raf(clock.ms); } catch (e) { err('frame threw: ' + e.message); }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  STATS.frames++; STATS.frameMsTotal += ms;
  if (STATS.frameLog && page.name !== 'hub') STATS.frameLog.push(ms);
  const key = page.name.startsWith('koloni') ? 'hucre' : 'suru';
  if (page.name !== 'hub' && ms > STATS.maxFrameMs[key]) STATS.maxFrameMs[key] = ms;
  runTimers();
}
async function advance(ms, dt = 50) {
  for (let t = 0; t < ms; t += dt) { frame(dt); if ((t / dt) % 4 === 0) await flush(1); }
  await flush();
}

// Overlay buttons: parse data-act buttons from the panel HTML.
function buttons() {
  const html = page.$('ov').innerHTML;
  const out = [];
  const re = /<button class="([^"]*)" data-act="(\w+)"(?: data-arg="(\w+)")?([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) out.push({ cls: m[1], act: m[2], arg: m[3], disabled: /disabled/.test(m[4]) });
  return out;
}
function click(act, arg) {
  const b = buttons().find(x => x.act === act && (arg === undefined || x.arg === arg));
  if (!b) { err('button not found: ' + act + ' ' + (arg || '') + ' | mode=' + (page.sb.__M ? page.sb.__M() : '-') + ' paused=' + (page.sb.__P ? page.sb.__P() : '-') + ' buttons=' + buttons().map(x => x.act).join(',') + ' h1=' + (page.$('ov').innerHTML.match(/<h1>(.*?)<\/h1>/) || [])[1]); return false; }
  const target = { closest: () => ({ dataset: { act: b.act, arg: b.arg }, disabled: b.disabled }) };
  (page.$('ov').listeners.click || []).forEach(f => f({ target }));
  return true;
}
function tap(id) { const el = page.$(id); if (el.onclick) return el.onclick({}); }

// World (400x720) -> client coordinates, same letterboxing as the games.
function client(x, y) {
  // Same fitting as the games: Sürü Seli fits between the HUD (90px here) and the bottom; Koloni letterboxes.
  let sc, oy;
  if (page.name === 'suru-seli') { const avail = 844 - 90 - 0 - 4; sc = Math.min(390 / 400, avail / 720); oy = 90 + (avail - 720 * sc) / 2; }
  else { sc = Math.min(390 / 400, 844 / 720); oy = (844 - 720 * sc) / 2; }
  return { clientX: x * sc + (390 - 400 * sc) / 2, clientY: y * sc + oy, pointerId: 1 };
}
function trayClick(slot) { (page.$('tray').listeners.click || []).forEach(f => f({ target: { closest: () => ({ dataset: { slot } }) } })); }
function pointer(type, x, y) { (page.$('c').listeners[type] || []).forEach(f => f(client(x, y))); }

// ---------- Invariants ----------
function checkSave(where) {
  let d;
  try { d = JSON.parse(persist.kapiskapis_save_v1); } catch (e) { err('save not parseable @' + where); return; }
  if (!Number.isInteger(d.coins) || d.coins < 0) err('bad coins ' + d.coins + ' @' + where);
  for (const [g, gs] of Object.entries(d.games || {})) {
    if (!Number.isInteger(gs.level) || gs.level < 1) err('bad level ' + g + ' ' + gs.level);
    for (const [k, v] of Object.entries(gs.upgrades || {})) if (!Number.isInteger(v) || v < 0 || v > 15) err('bad upgrade ' + g + '.' + k + '=' + v);
  }
}

// ---------- Bots ----------
function hucreThink() {
  const S = page.sb.__S();
  const mine = S.nodes.filter(n => n.owner === 1);
  const others = S.nodes.filter(n => n.owner !== 1);
  const myPow = mine.reduce((a, n) => a + n.units, 0);
  const enemyPow = S.nodes.filter(n => n.owner >= 2).reduce((a, n) => a + n.units, 0);
  if (process.env.NOABIL) { /* no abilities */ } else if (S.energy >= 50 && enemyPow > myPow * 0.8) tap('abFreeze');
  else if (S.energy >= 90) tap('abSpeed');
  let best = null, bs = Infinity, srcs = null;
  for (const t of others) {
    const need = t.units * (t.type === 'fort' ? 2 : 1) + (t.owner >= 2 ? 6 : 2);
    if (mine[0] && mine[0].nb && !mine.some(m => m.nb.includes(t.id))) continue; // must border our territory
    const near = mine.slice().sort((a, b) => b.units - a.units);
    let sum = 0; const use = [];
    for (const m of near) { if (m.units < 3) continue; use.push(m); sum += Math.floor(m.units); if (sum > need * 1.15 + 3) break; }
    if (!use.length || sum <= need * 1.15 + 3) continue;
    const d = Math.hypot(use[0].x - t.x, use[0].y - t.y);
    const score = need + d * 0.05 - (t.type === 'core' ? 25 : t.type !== 'normal' ? 5 : 0);
    if (score < bs) { bs = score; best = t; srcs = use; }
  }
  if (!best) {
    // Feed the front: an interior region sends its troops to a neighbour that borders the enemy.
    const front = n => n.nb.some(id => S.nodes[id].owner !== 1);
    const src = mine.find(m => m.units >= 6 && m.nb && !front(m));
    const to = src && src.nb.map(id => S.nodes[id]).find(o => o.owner === 1 && front(o)) || (src && src.nb.map(id => S.nodes[id]).find(o => o.owner === 1));
    if (src && to) { pointer('pointerdown', src.x, src.y); pointer('pointermove', to.x, to.y); pointer('pointerup', to.x, to.y); }
    return { myPow, enemyPow };
  }
  pointer('pointerdown', srcs[0].x, srcs[0].y);
  for (const s of srcs.slice(1)) pointer('pointermove', s.x, s.y);
  pointer('pointermove', best.x, best.y);
  pointer('pointerup', best.x, best.y);
  return { myPow, enemyPow };
}

function suruThink(tSec) {
  // Lane shooter: meet enemies that get close, otherwise break crates / pump the best gate.
  const S = page.sb.__S(), q = S.squad;
  let aim;
  const near = S.enemies.filter(e => e.y > 330);
  // Meet the closest enemies; otherwise crates, then the best gate; at the castle, siege when nothing else to do.
  const front = near.length ? near.reduce((a, e) => (e.y > a.y ? e : a)) : null;
  const gates = S.gates.filter(g => g.y > 120 && g.y < 600), crates = S.crates.filter(c => c.y > 60);
  const grab = S.gates.find(g => (g.mul || g.val >= 4) && g.y > 470 && g.y < 606);
  if (grab && (!front || front.y < 520)) aim = grab.x;
  else if (front) aim = near.filter(e => Math.abs(e.x - front.x) < 60).reduce((a, e, _, l) => a + e.x / l.length, 0);
  else if (S.enemies.some(e => e.kind === 'sniper' && e.stopY && e.y >= e.stopY - 2)) aim = S.enemies.find(e => e.kind === 'sniper' && e.stopY && e.y >= e.stopY - 2).x;
  else if (crates.length) aim = crates[crates.length - 1].x;
  else if (gates.length && (!S.castle || S.squad.n < 60)) aim = gates.reduce((a, g) => (g.val > a.val ? g : a)).x;
  else if (S.castle) aim = S.castle.x;
  else aim = q.x;
  // Step out from under incoming castle shells.
  const shell = S.shells.find(s => s.foe && s.u > 0.3 && Math.abs(aim - s.x1) < 60);
  if (shell) aim = shell.x1 > 200 ? shell.x1 - 75 : shell.x1 + 75;
  // Dodge a gate that is still negative when it is about to be crossed.
  const bad = S.gates.find(g => !g.mul && g.val < 1 && g.y > 470 && g.y < 610 && Math.abs(aim - g.x) < g.w / 2 + 40);
  if (bad) aim = bad.x < 200 ? bad.x + bad.w / 2 + 50 : bad.x - bad.w / 2 - 50;
  if (process.env.LAZY) aim = +process.env.LAZY > 1 ? +process.env.LAZY : 112; // lazy player: parks at a fixed x (default: reward lane)
  pointer('pointerdown', aim, 600); pointer('pointermove', aim, 600); pointer('pointerup', aim, 600);
  return null;
}

// Çağlar Savaşı commander: evolve asap, turret when rich, keep a 3:2:1 army, special on crowds.
function cagThink(f) {
  const S = page.sb.__S(), me = S.side[0];
  tap('evo');
  if (process.env.RUSH) { tap('u0'); return; } // rush test: melee spam only
  const turtle = !!process.env.TURTLE; // turtle test: only turrets, never sends troops
  const defCost = i => (i === 1 ? 220 : 110) * Math.pow(2.5, me.age);
  for (let i = 0; i < me.open; i++) {
    const d = me.slots[i];
    if ((!d || d.age < me.age) && me.gold > defCost(i) * 1.6) { tap('tur'); click('def', i + '_' + (i === 1 ? 'heavy' : 'rapid')); click('resume'); break; }
  }
  if (me.open < 3 && me.gold > [0, 350, 1200][me.open] * 2.5) { tap('tur'); click('slot', String(me.open)); click('resume'); }
  if (turtle) return;
  const enemies = S.units.filter(u => u.side === 1).length;
  if (enemies >= 4) tap('spc');
  const mine = S.units.filter(u => u.side === 0);
  const cnt = [0, 1, 2].map(t => mine.filter(u => u.type === t).length + me.queue.filter(q => q.type === t).length);
  const want = cnt[0] <= cnt[1] * 1.5 ? 0 : cnt[2] * 2 < cnt[1] ? 2 : 1;
  tap('u' + want);
}

// Obur Delik player: floating joystick toward the best food nearby; run from bigger holes, chase smaller ones.
function delikThink() {
  const S = page.sb.__S(), me = S.me;
  if (me.dead > 0) return;
  let fx = 0, fy = 0, tgt = null, best = 0;
  for (const o of S.holes) {
    if (o === me || o.dead > 0) continue;
    const d = Math.hypot(o.x - me.x, o.y - me.y) || 1;
    if (o.r > me.r * 1.15 && d < o.r + me.r + 110) { fx += (me.x - o.x) / d * (1 + 110 / d); fy += (me.y - o.y) / d * (1 + 110 / d); }
    else if (o.inv <= 0 && me.r > o.r * 1.25 && d < 240) tgt = o;
  }
  if (!tgt) for (const o of S.objs) {
    if (o.state || o.s > me.r * 0.92) continue;
    const d = Math.hypot(o.x - me.x, o.y - me.y);
    if (d > 300) continue;
    const v = o.s * o.s / (d + 40);
    if (v > best) { best = v; tgt = o; }
  }
  if (!tgt) tgt = { x: S.M / 2, y: S.M / 2 };
  let dx = tgt.x - me.x, dy = tgt.y - me.y; const d = Math.hypot(dx, dy) || 1;
  dx = dx / d + fx * 2; dy = dy / d + fy * 2; const m = Math.hypot(dx, dy) || 1;
  const L = page.$('c').listeners;
  (L.pointerup || []).forEach(f => f({}));
  (L.pointerdown || []).forEach(f => f({ clientX: 195, clientY: 500, pointerId: 1 }));
  (L.pointermove || []).forEach(f => f({ clientX: 195 + dx / m * 50, clientY: 500 + dy / m * 50, pointerId: 1 }));
}

// ---------- Menu + level flow ----------
async function menuActions(game) {
  // Buy the cheapest affordable upgrade(s), like a player tapping green buttons.
  for (let i = 0; i < 4; i++) {
    const buys = buttons().filter(b => b.act === 'buy' && b.cls.includes('green'));
    if (!buys.length || rand() < 0.2) break;
    click('buy', buys[0].arg);
  }
  if (game === 'suru') {
    const sk = buttons().find(b => b.act === 'skinBuy' && b.cls.includes('green'));
    if (sk && rand() < 0.3) click('skinBuy', sk.arg);
    const sa = buttons().find(b => b.act === 'skinAd');
    if (sa && rand() < 0.1) { click('skinAd', sa.arg); await advance(17000); }
  }
  if (game === 'hucre' && buttons().some(b => b.act === 'boost') && rand() < 0.15) { click('boost'); await advance(17000); }
}

async function playLevel(game) {
  const G = page.sb.__G();
  const lv = G.level;
  if (!click('play')) return 'noplay';
  await advance(500); // play() may wait for a reveal animation first
  if (ADSTATE.banner) STATS.bannerDuringPlay++;
  let result = 'timeout';
  const MAX = 7 * 60 * 20; // 7 minutes at 20 fps
  let bgDone = false;
  for (let f = 0; f < MAX; f++) {
    frame(50);
    const mode = page.sb.__M();
    if (mode !== 'play') { result = 'end'; break; }
    if (page.sb.__P()) continue;
    const S = page.sb.__S();
    if (game === 'hucre') STATS.maxDots = Math.max(STATS.maxDots, S.dots.length);
    else STATS.maxUnits = Math.max(STATS.maxUnits, S.squad ? S.squad.n : 0);
    if (f % 12 === 0) {
      if (game === 'hucre') {
        const r = hucreThink();
        if (r && !S.adUsed && r.myPow < r.enemyPow * 0.5 && rand() < 0.2) { tap('abAd'); await advance(17000); }
      } else if (suruThink(f / 20) === 'adcard') {
        trayClick('ad');
        await advance(17000);
      }
    }
    // Occasionally the app goes to background mid-level (phone call, notification...).
    if (!bgDone && f === 600 && rand() < 0.05) {
      bgDone = true; STATS.pauses++;
      page.sb.document.hidden = true;
      (page.docL.visibilitychange || []).forEach(fn => fn());
      page.sb.document.hidden = false;
      (page.docL.visibilitychange || []).forEach(fn => fn());
      await advance(1000);
      if (!page.sb.__P()) err('game not paused after going to background');
      click('resume');
      if (page.sb.__P()) err('game still paused after resume');
    }
  }
  STATS.levels[game]++;
  if (result === 'timeout') { STATS.timeouts.push(game + ' L' + lv + ' (gün ' + day + ')'); if (page.sb.__M() === 'play') tap('pauseBtn'); click('menu'); return 'timeout'; }
  await advance(1000); // suru shows its win panel after 700 ms
  const bs = buttons().map(b => b.act);
  const fs_ = STATS.failStreak[game];
  if (bs.includes('claim')) {
    STATS.wins[game]++;
    fs_.n = 0;
    if (page.sb.__G().level !== lv + 1) err('level not advanced after win');
    const x3 = rand() < 0.4;
    click('claim', x3 ? '3' : '1');
    await advance(x3 ? 17000 : 6000);
    if (buttons().some(b => b.act === 'claim')) { click('claim', '1'); await advance(6000); } // ad closed early
    return 'win';
  }
  STATS.losses[game]++;
  if (fs_.lv === lv) fs_.n++; else { fs_.lv = lv; fs_.n = 1; }
  if (fs_.n > fs_.max) { fs_.max = fs_.n; fs_.maxLv = lv; }
  if (bs.includes('revive') && rand() < 0.5) {
    STATS.revives++;
    click('revive'); await advance(16000);
    if (buttons().some(b => b.act === 'claim')) { STATS.wins[game]++; click('claim', '1'); await advance(6000); return 'win'; }
    if (page.sb.__M() === 'play') return playLevelContinue(game, lv);
  }
  if (bs.includes('skip') && fs_.n >= 3 && rand() < 0.5) {
    STATS.skips++;
    click('skip'); await advance(17000);
    if (buttons().some(b => b.act === 'play')) return 'skip';
  }
  if (buttons().some(b => b.act === 'retry')) { click('retry'); await advance(6000); }
  // Back to menu state for the next loop.
  if (page.sb.__M() === 'play') { tap('pauseBtn'); click('menu'); }
  else if (!buttons().some(b => b.act === 'play')) click('menu');
  return 'lose';
}

async function playLevelContinue(game, lv) {
  // After a revive the same level continues.
  for (let f = 0; f < 3 * 60 * 20; f++) {
    frame(50);
    if (page.sb.__M() !== 'play') break;
    if (f % 12 === 0) suruThink(f / 20);
  }
  await advance(1000);
  if (buttons().some(b => b.act === 'claim')) { STATS.wins[game]++; click('claim', '1'); await advance(6000); return 'win'; }
  if (buttons().some(b => b.act === 'retry')) click('menu');
  return 'lose';
}

// ---------- Balance mode ----------
// node tests/sim.js balance <hucre|suru> <levels,comma> <tries> <upgradeLevel>
// Plays each level `tries` times (no ads, no revives) with all upgrades at the given level.
async function balance() {
  const [, , , game, lvList, tries = '6', upg = '0'] = process.argv;
  const folder = { hucre: 'koloni-kapismasi', suru: 'suru-seli', cag: 'caglar-savasi', delik: 'obur-delik' }[game];
  native = { admob: makeAdmob(), cdv: makeCdv() };
  STATS.frameLog = [];
  const rows = [];
  for (const lv of lvList.split(',').map(Number)) {
    let wins = 0, time = 0;
    for (let i = 0; i < +tries; i++) {
      for (const k of Object.keys(persist)) delete persist[k];
      await loadPage(folder, 'https://localhost/index.html');
      const G = page.sb.__G();
      G.level = lv;
      if (game === 'cag') { G.wars = Math.floor((lv - 1) / 5); G.war = { age: 0 }; }
      if (game === 'delik' && process.env.MODE) G.mode = process.env.MODE; // classic | battle | solo
      for (const k of Object.keys(G.upgrades)) G.upgrades[k] = Math.min(+upg, k === 'giant' ? 8 : 99);
      page.sb.Save.save();
      await loadPage(folder, 'https://localhost/index.html');
      click('play');
      let f = 0;
      for (; f < (game === 'cag' ? 25 : 7) * 60 * 20; f++) {
        frame(50);
        if (page.sb.__M() !== 'play') break;
        if (game === 'delik') { if (f % 4 === 0) delikThink(); }
        else if (f % 12 === 0) game === 'hucre' ? hucreThink() : game === 'cag' ? cagThink(f) : suruThink(f / 20);
        if (process.env.TRACE && game === 'hucre' && f % 40 === 0) { const S = page.sb.__S(); console.log('   t=' + (f / 20) + ' ' + [1, 2, 3, 4].map(o => { const ns = S.nodes.filter(n => n.owner === o); return o + ':' + ns.length + 'n/' + Math.round(ns.reduce((x, n) => x + n.units, 0)); }).join(' ') + ' dots=' + S.dots.length); }
        if (process.env.TRACE && game === 'suru' && f % 20 === 0) { const S = page.sb.__S(); console.log('   t=' + (f / 20) + ' n=' + S.squad.n + ' x=' + Math.round(S.squad.x) + ' w=' + S.squad.weapon + ' en=' + S.enemies.map(e => Math.round(e.x) + '/' + Math.round(e.y)).join(' ') + ' g=' + S.gates.map(g => Math.round(g.x) + '/' + Math.round(g.y) + ':' + Math.floor(g.val)).join(' ')); }
      }
      await advance(game === 'suru' ? 3000 : 1000); // suru: the win panel waits for the V3 victory sequence (2.4 s)
      if (process.env.WINLOG && game === 'delik' && buttons().some(b => b.act === 'claim')) { const S = page.sb.__S(); console.log('  L' + lv + ' kazandı: ' + S.holes.slice().sort((a, b) => b.score - a.score).map(h => h.name + ' ' + Math.round(h.score) + ' r' + Math.round(h.r) + ' k' + h.kills).join(' | ') + ' · yenen %' + Math.round(S.me.eaten / S.total * 100)); }
      if (process.env.WINLOG && game === 'cag') { const S = page.sb.__S(), G2 = page.sb.__G(); console.log('  L' + lv + (buttons().some(b => b.act === 'claim') ? ' KAZANDI' : ' kaybetti') + ' t=' + Math.round(f / 20) + 's çağ ' + S.side[0].age + '/' + S.side[1].age + ' seviye ' + lv + '→' + G2.level + ' üs %' + Math.round(S.side[0].hp / S.side[0].max * 100) + '/%' + Math.round(Math.max(0, S.side[1].hp) / S.side[1].max * 100)); }
      if (buttons().some(b => b.act === 'claim')) { wins++; time += f / 20; if (process.env.WINLOG && game === 'suru') { const S = page.sb.__S(); console.log('  L' + lv + ' kazandı t=' + (f / 20).toFixed(0) + ' asker ' + S.squad.n + ' silah ' + S.squad.weapon + ' kayıp ' + S.lostTotal + ' boss ' + S.boss + ' yol ' + S.length + ' mods ' + S.mods.join('+')); } }
      else if (process.env.DBG && game === 'suru') { const S = page.sb.__S(); console.log('  L' + lv + ' kayıp t=' + (f / 20).toFixed(0) + 's yol %' + Math.round(S.t / S.length * 100) + ' asker ' + S.squad.n + ' silah ' + S.squad.weapon + ' kale ' + (S.castle ? Math.round(S.castle.hp) + '/' + S.castle.max : '-') + ' düşman ' + S.enemies.length); }
      else if (process.env.DBG && game === 'delik') { const S = page.sb.__S(); console.log('  L' + lv + ' kayıp: ' + S.holes.slice().sort((a, b) => b.score - a.score).map(h => h.name + ' ' + Math.round(h.score) + ' r' + Math.round(h.r) + ' k' + h.kills).join(' | ') + ' · yenen %' + Math.round(S.me.eaten / S.total * 100)); }
      else if (process.env.DBG && game === 'cag') { const S = page.sb.__S(); const [m, e] = S.side; console.log('  L' + lv + ' kayıp t=' + (f / 20).toFixed(0) + 's çağ ' + m.age + '/' + e.age + ' üs ' + Math.round(m.hp) + '/' + Math.round(e.hp) + ' (' + Math.round(e.max) + ') altın ' + Math.round(m.gold) + '/' + Math.round(e.gold) + ' xp ' + Math.round(m.xp) + '/' + Math.round(e.xp) + ' birlik ' + S.units.filter(u => u.side === 0).length + '/' + S.units.filter(u => u.side === 1).length); }
      else if (process.env.DBG && game === 'suru') { const S = page.sb.__S(); console.log('  L' + lv + ' kayıp t=' + (f / 20).toFixed(0) + 's kale=%' + Math.round(S.base.hp / S.base.max * 100) + ' birlik=' + S.units.length + ' düşman=' + S.enemies.length + ' tip=' + S.base.type); }
    }
    rows.push({ level: lv, winRate: Math.round(wins / tries * 100) + '%', avgWinSec: wins ? Math.round(time / wins) : '-' });
  }
  const fl = (STATS.frameLog || []).sort((a, b) => a - b);
  const pct = p => fl.length ? fl[Math.floor(fl.length * p)].toFixed(2) : '-';
  console.log(game + ' · geliştirme seviyesi ' + upg + ' · kare ms p50=' + pct(0.5) + ' p99=' + pct(0.99) + ' p99.9=' + pct(0.999) + ' max=' + (fl.length ? fl[fl.length - 1].toFixed(1) : '-'));
  console.table(rows);
  console.log('HATALAR (' + ERR.length + '):'); for (const e of ERR.slice(0, 20)) console.log(' - ' + e);
}

// ---------- Smoke mode: every page loads and runs a few minutes without errors ----------
async function smoke() {
  native = { admob: makeAdmob(), cdv: makeCdv() };
  for (const name of ['hub', 'koloni-kapismasi', 'suru-seli', 'altin-ocagi', 'caglar-savasi', 'obur-delik']) {
    await loadPage(name, 'https://localhost/index.html');
    if (name !== 'hub' && name !== 'altin-ocagi') click('play');
    if (name === 'caglar-savasi') for (let i = 0; i < 6; i++) { tap('u0'); tap('u1'); }
    if (name === 'suru-seli') pointer('pointerdown', 200, 560);
    if (name === 'obur-delik') { for (let i = 0; i < 1800; i++) { if (i % 4 === 0) delikThink(); frame(50); if (page.sb.__M() !== 'play') break; } }
    await advance(180000);
    console.log('  ' + name + ': 3 dk çalıştı');
  }
  // Mine: hire managers via save, leave for 5 hours, come back -> offline popup.
  const d = JSON.parse(persist.kapiskapis_save_v1);
  const mr = d.games.maden.regions ? d.games.maden.regions[d.games.maden.cur || 0] : d.games.maden;
  mr.elev.m = true; mr.shafts[0].m = true; if (mr.trans) mr.trans.m = true; d.games.maden.last = EPOCH + clock.ms;
  persist.kapiskapis_save_v1 = JSON.stringify(d);
  clock.ms += 5 * 3600e3;
  await loadPage('altin-ocagi', 'https://localhost/index.html');
  const html = page.$('ov').innerHTML;
  console.log('  maden çevrimdışı: ' + (/WHILE YOU WERE AWAY|SEN YOKKEN/.test(html) ? 'popup var ✓ ' + (html.match(/\+([0-9.]+[A-Za-z]*)/) || [])[1] : 'POPUP YOK ✗'));
  if (!/WHILE YOU WERE AWAY|SEN YOKKEN/.test(html)) err('offline popup missing');
  console.log('HATALAR (' + ERR.length + '):'); for (const e of ERR) console.log(' - ' + e);
}

// ---------- Main ----------
if (process.argv[2] === 'smoke') { smoke().then(() => process.exit(0)); return; }
if (process.argv[2] === 'balance') { balance().then(() => process.exit(0)); return; }
(async () => {
  const t0 = Date.now();
  let prevDaily = null;
  for (day = 1; day <= DAYS; day++) {
    if (rand() < 0.12) continue; // skipped day (streak must reset)
    const sessions = 1 + Math.floor(rand() * 3);
    for (let s = 0; s < sessions; s++) {
      clock.ms = Math.max(clock.ms, (day - 1) * DAY_MS + (9 + s * 4 + rand() * 3) * 3600000);
      session = {};
      native = { admob: makeAdmob(), cdv: makeCdv() };
      STATS.sessions++;

      // Day 100: user reinstalls the app -> local data gone, purchase must be restorable.
      if (day === 100 && s === 0) {
        for (const k of Object.keys(persist)) delete persist[k];
        await loadPage('hub');
        page.sb.__hub.restore();
        await advance(3000);
        if (!JSON.parse(persist.kapiskapis_save_v1 || '{}').noAds && IAPSTATE.owned) err('restore purchases did not bring back noAds');
      }

      await loadPage('hub');
      const st = page.sb.Save.dailyStatus();
      if (st.available) {
        page.sb.__hub.dailySheet();
        const m = rand() < 0.4 ? 2 : 1;
        page.$('ov').onclick({ target: { closest: sel => (sel === '[data-m]' ? { dataset: { m: String(m) } } : null) } });
        await advance(17000);
        const d = page.sb.Save.load();
        if (d.lastDaily === prevDaily && m === 1) err('daily not recorded');
        prevDaily = d.lastDaily;
        STATS.daily++; STATS.maxStreak = Math.max(STATS.maxStreak, d.streak);
      }
      if (day === 45 && s === 0 && !IAPSTATE.owned) {
        page.sb.__hub.buyNoAds();
        await advance(5000);
        if (!JSON.parse(persist.kapiskapis_save_v1).noAds) err('IAP purchase did not grant noAds');
      }
      checkSave('hub');

      const order = rand() < 0.5 ? ['koloni-kapismasi', 'suru-seli'] : ['suru-seli', 'koloni-kapismasi'];
      for (const g of order) {
        const game = g === 'koloni-kapismasi' ? 'hucre' : 'suru';
        await loadPage(g, 'https://localhost/index.html');
        const n = 2 + Math.floor(rand() * 5);
        native.onInter = () => { const lvl = page.sb.__G().level; if (lvl <= 5) STATS.interBeforeL3++; };
        for (let i = 0; i < n; i++) {
          await menuActions(game);
          await playLevel(game);
          checkSave(game);
        }
        click('home');
        if (page.nav.go !== 'back') err('home did not use history.back from hub referrer: ' + page.nav.go);
        if (native.admob.count() > 0) err('AdMob listeners leaked: ' + native.admob.names());
      }
    }
    if (day % 10 === 0 || day === DAYS) {
      const d = JSON.parse(persist.kapiskapis_save_v1);
      STATS.history.push({
        day, hucre: d.games.koloni.level, suru: d.games.suru.level, coins: d.coins,
        upH: Object.values(d.games.koloni.upgrades).join('/'), upS: Object.values(d.games.suru.upgrades).join('/'),
        skins: d.games.suru.skins.join(','), streak: d.streak,
      });
      process.stdout.write('.');
    }
  }
  console.log('\n=== ' + DAYS + ' gün simülasyon (' + ((Date.now() - t0) / 1000).toFixed(0) + ' sn) ===');
  console.table(STATS.history);
  const avgFrame = STATS.frameMsTotal / STATS.frames;
  console.log(JSON.stringify({
    sessions: STATS.sessions, levels: STATS.levels, wins: STATS.wins, losses: STATS.losses,
    timeouts: STATS.timeouts.length, timeoutList: STATS.timeouts.slice(0, 10),
    rewarded: { shown: STATS.rewardedShown, closedEarly: STATS.rewardedEarly }, interstitials: STATS.inter,
    interBeforeL3: STATS.interBeforeL3, interWithNoAds: STATS.interNoAds, bannerDuringPlay: STATS.bannerDuringPlay,
    iapOrders: STATS.iapOrders, dailyClaims: STATS.daily, maxStreak: STATS.maxStreak, skips: STATS.skips, revives: STATS.revives,
    backgroundPauses: STATS.pauses, failStreaks: STATS.failStreak, maxDots: STATS.maxDots, maxUnits: STATS.maxUnits,
    avgFrameMs: +avgFrame.toFixed(3), maxFrameMs: STATS.maxFrameMs, audioNodes: STATS.audioNodes,
  }, null, 1));
  console.log('\nHATALAR (' + ERR.length + '):');
  for (const e of ERR) console.log(' - ' + e);
  const rep = Object.entries(errCounts).filter(([, n]) => n > 3);
  if (rep.length) console.log('Tekrar eden:', rep.map(([m, n]) => m + ' ×' + n).join('; '));
})().catch(e => { console.error('SIM CRASH day', day, e); process.exit(1); });
