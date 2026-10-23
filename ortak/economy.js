// Shared save + wallet + daily reward. Both games share one coin wallet.
(function () {
  'use strict';
  const KEY = 'kapiskapis_save_v1';
  const OLD_KEYS = ['oyunlar_save_v1']; // earlier builds
  const DAILY = [5, 8, 10, 12, 15, 20, 40]; // 7-day streak, day 7 repeats

  function dayStr(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  const Save = {
    data: null,

    load() {
      if (this.data) return this.data;
      try {
        let raw = localStorage.getItem(KEY);
        if (raw == null) {
          // Migrate once from an older key, then drop it so a reset can't resurrect old progress.
          raw = OLD_KEYS.map(k => localStorage.getItem(k)).find(v => v != null) || null;
          if (raw != null) { localStorage.setItem(KEY, raw); OLD_KEYS.forEach(k => localStorage.removeItem(k)); }
        }
        this.data = JSON.parse(raw);
      } catch (e) { this.data = null; }
      if (!this.data || typeof this.data !== 'object') this.data = {};
      this.data = Object.assign({ coins: 0, noAds: false, lastDaily: null, streak: 0, games: {} }, this.data);
      // 'hucre' was renamed to 'koloni'.
      const g = this.data.games;
      if (g.hucre && !g.koloni) { g.koloni = g.hucre; delete g.hucre; }
      return this.data;
    },

    save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* storage blocked */ } },

    // Returns the per-game save object, filling in missing defaults (one level deep for objects).
    game(id, defaults) {
      this.load();
      const cur = this.data.games[id] || {};
      const out = {};
      for (const k in defaults) {
        const dv = defaults[k];
        if (dv && typeof dv === 'object' && !Array.isArray(dv)) out[k] = Object.assign({}, dv, cur[k] || {});
        else out[k] = k in cur ? cur[k] : dv;
      }
      for (const k in cur) if (!(k in out)) out[k] = cur[k];
      this.data.games[id] = out;
      this.save();
      return out;
    },

    addCoins(n) { this.load().coins += Math.max(0, Math.round(n)); this.save(); },
    spend(n) {
      const d = this.load();
      if (d.coins < n) return false;
      d.coins -= n; this.save(); return true;
    },

    dailyStatus() {
      const d = this.load();
      const now = new Date();
      const today = dayStr(now);
      if (d.lastDaily === today) return { available: false, day: d.streak };
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const day = !d.lastDaily ? 1 : d.lastDaily === dayStr(y) ? d.streak + 1 : Math.max(1, d.streak - 2);
      return { available: true, day, amount: DAILY[Math.min(day, DAILY.length) - 1] };
    },

    claimDaily(mult) {
      const st = this.dailyStatus();
      if (!st.available) return 0;
      const d = this.data;
      d.streak = st.day;
      d.lastDaily = dayStr(new Date());
      const amount = st.amount * (mult || 1);
      d.coins += amount;
      this.save();
      return amount;
    },

    reset() { this.data = null; try { localStorage.removeItem(KEY); } catch (e) { } this.load(); },
  };

  // ?shot: art capture mode (no HUD / panels), used to render store and hub artwork from the real game.
  const SHOT = typeof location !== 'undefined' && /[?&]shot/.test(location.search || '');
  if (SHOT && document.documentElement && document.documentElement.classList) document.documentElement.classList.add('shot');

  const UI = {
    // Per-frame HUD writes: touch the DOM only when the value really changed (each write costs a style/layout pass).
    // Compared with the last source string (icons.js turns emoji into SVG, so textContent never matches it again).
    txt(el, v) { v = String(v); if (el && el._t !== v) { el._t = v; el._h = undefined; el.textContent = v; } },
    html(el, v) { if (el && el._h !== v) { el._h = v; el._t = undefined; el.innerHTML = v; } },
    prop(el, k, v) { v = String(v); const c = el && (el._p || (el._p = {})); if (el && c[k] !== v) { c[k] = v; el.style.setProperty(k, v); } },
    toast(msg) {
      const el = document.createElement('div');
      el.className = 'toast';
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1700);
    },
    // Screen-space layout of the HUD + system bars, for canvases that must avoid them.
    // Cached for half a second (and dropped on resize): games call it every frame and each call forces a layout.
    safeArea() {
      if (SHOT) return { hudBottom: 0, bottom: 0 };
      const now = Date.now();
      if (UI._sa && now - UI._saT < 500) return UI._sa;
      UI._saT = now;
      return (UI._sa = UI._safeArea());
    },
    _safeArea() {
      let probe = UI._probe;
      if (!probe && document.body && document.createElement) {
        probe = UI._probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none';
        document.body.appendChild(probe);
      }
      const hud = document.querySelector && document.querySelector('.hud');
      const r = hud && hud.getBoundingClientRect ? hud.getBoundingClientRect() : null;
      return { hudBottom: r ? r.bottom : 90, bottom: (probe && probe.offsetHeight) || 0 };
    },
    vibrate(ms) { try { if (Save.data.vib !== false && navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }, // needs android.permission.VIBRATE
    // Android hardware back button. Pages register one handler; without a native App plugin
    // (browser) this is a no-op. Without any handler Capacitor would simply close the app.
    // A popup registers its close function; the back button calls the newest one instead of leaving the page.
    pushBack(fn) { (UI._modals = UI._modals || []).push(fn); },
    popBack(fn) { if (UI._modals) UI._modals = UI._modals.filter(f => f !== fn); },
    // A popup registers its close function; the back button calls the newest one instead of leaving the page.
    pushBack(fn) { (UI._modals = UI._modals || []).push(fn); },
    popBack(fn) { if (UI._modals) UI._modals = UI._modals.filter(f => f !== fn); },
    onBack(fn) {
      UI._backFn = fn;
      const app = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
      if (app && !UI._backHooked) {
        UI._backHooked = true;
        try { app.addListener('backButton', () => { if (UI._modals && UI._modals.length) UI._modals.pop()(); else if (UI._backFn) UI._backFn(); else app.exitApp(); }); } catch (e) { }
      }
    },
    exitApp() {
      const app = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
      if (app) app.exitApp();
    },
    // Back to the hub without piling up history entries (Android back button walks history).
    goHome(hubUrl) {
      if (document.referrer && /\/index\.html$|\/$/.test(document.referrer) && history.length > 1) history.back();
      else location.replace(hubUrl);
    },
  };

  // A page restored from the back/forward cache holds a stale copy of the save in memory
  // (e.g. coins earned in the other game). Reload so it never writes stale data back.
  addEventListener('pageshow', e => { if (e.persisted) location.reload(); });

  Save.load();
  window.Save = Save;

  // ---------- Language ----------
  // Every text is written as L('English', 'Türkçe'). Other languages come from ortak/i18n/<lang>.js: a table keyed by
  // the English text (scripts/i18n-extract.js + i18n-translate.js build it with a local LLM). English text glued
  // together with numbers ('Ad ' + n + '/2') is matched against "Ad {0}/{1}" patterns from the same table.
  // The app follows the device language until the player picks one in the settings. Brand and game names stay English.
  const LANGS = { en: 'English', tr: 'Türkçe', es: 'Español', pt: 'Português', de: 'Deutsch', fr: 'Français', it: 'Italiano', id: 'Bahasa Indonesia' };
  const devLang = () => { try { const l = (navigator.language || '').slice(0, 2).toLowerCase(); return LANGS[l] ? l : 'en'; } catch (e) { return 'en'; } };
  const LANG = LANGS[Save.data.lang] ? Save.data.lang : devLang();
  if (document.documentElement) document.documentElement.lang = LANG;
  window.LANG = LANG; window.LANGS = LANGS;
  // Languages written with a decimal comma (1,5K).
  window.DEC_COMMA = LANG !== 'en';
  const I18N = { dict: null, pats: null, cache: new Map() };
  const relabel = () => { if (document.querySelectorAll) document.querySelectorAll('[data-l]').forEach(el => { const p = el.dataset.l.split('|'); el.textContent = L(p[0], p[1]); }); };
  I18N.set = d => {
    I18N.dict = d; I18N.cache.clear();
    // Pattern keys ("Ad {0}/{1} · one more!") → regex that captures the glued-in values.
    I18N.pats = Object.keys(d).filter(k => /\{\d\}/.test(k)).map(k => {
      const parts = k.split(/\{(\d)\}/), order = [];
      const src = parts.map((x, j) => j % 2 ? (order.push(+x), '([\\s\\S]+?)') : x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
      return { re: new RegExp('^' + src + '$'), order, k };
    });
    relabel();
  };
  window.I18N = I18N;
  const tx = en => {
    if (typeof en !== 'string' || !I18N.dict) return en;
    const hit = I18N.dict[en]; if (hit) return hit;
    if (I18N.cache.has(en)) return I18N.cache.get(en);
    let out = en;
    for (const p of I18N.pats) {
      const m = p.re.exec(en); if (!m) continue;
      const v = []; p.order.forEach((i, j) => { v[i] = m[j + 1]; });
      out = I18N.dict[p.k].replace(/\{(\d)\}/g, (x, i) => v[+i] != null ? v[+i] : x); break;
    }
    if (I18N.cache.size < 5000) I18N.cache.set(en, out);
    return out;
  };
  window.L = LANG === 'en' ? en => en : LANG === 'tr' ? (en, tr) => (tr != null ? tr : en) : en => tx(en);
  Save.setLang = l => { Save.load().lang = l; Save.save(); };
  // The table loads synchronously right after this file, before any game script asks for a text.
  if (LANG !== 'en' && LANG !== 'tr' && document.currentScript && document.readyState === 'loading') {
    document.write('<script src="' + document.currentScript.src.replace(/economy\.js(\?.*)?$/, 'i18n/' + LANG + '.js') + '"><\/script>');
  }
  // Static page labels: <b data-l="English|Türkçe">.
  relabel();

  // ---------- Player level (progress in every game) ----------
  // Every level: +2% gold in all games (max +50%), a level reward (stars; a Royal Chest every 5 levels) and a title
  // with an avatar frame every 5 levels.
  const PLV_GAMES = ['arrow', 'koloni', 'suru', 'cag', 'delik'];
  const TITLES = [[1, () => L('Rookie', 'Acemi'), '#9aa3b5'], [5, () => L('Explorer', 'Kâşif'), '#3fc76a'], [10, () => L('Master', 'Usta'), '#3b8cff'],
    [15, () => L('Champion', 'Şampiyon'), '#b05cff'], [20, () => L('Legend', 'Efsane'), '#ffb12a'], [30, () => L('Mythic', 'Mitik'), '#ff4d5a']];
  let mulT = 0, mulV = 1;
  const PlayerLv = {
    info() {
      const g = id => (Save.load().games[id] || {}), lvOf = id => id === 'maden' ? ((g('maden').shafts && g('maden').shafts.length) || 1) : id === 'arrow' ? (g('arrow').chapter || 1) : (g(id).level || 1);
      const xp = PLV_GAMES.reduce((a, id) => a + (lvOf(id) - 1) * (id === 'arrow' ? 3 : 1), 0) + (lvOf('maden') - 1) * 3;
      let lv = 1, need = 5, left = xp;
      while (left >= need) { left -= need; lv++; need = 5 + lv * 3; }
      return { lv, pct: left / need, left, need, xp };
    },
    titles() { return TITLES.map(t => ({ at: t[0], name: t[1](), color: t[2] })); },
    level() { return PlayerLv.info().lv; },
    // Gold multiplier for rewards in every game.
    mul() { const t = Date.now(); if (!(t - mulT < 3000)) { mulT = t; mulV = 1 + Math.min(0.5, 0.02 * (PlayerLv.level() - 1)); } return mulV; }, // cached: the mine asks every frame
    title(lv) { lv = lv || PlayerLv.level(); let t = TITLES[0]; for (const x of TITLES) if (lv >= x[0]) t = x; return { name: t[1](), color: t[2], from: t[0] }; },
    nextTitle(lv) { lv = lv || PlayerLv.level(); const x = TITLES.find(t => t[0] > lv); return x ? { at: x[0], name: x[1](), color: x[2] } : null; },
    reward(lv) { return { stars: 5 + 2 * lv, chest: lv % 5 === 0 }; },
    // Level rewards not taken yet (players who levelled up before this existed get theirs too).
    pending() { const d = Save.load(), last = d.plvClaimed || 1, lv = PlayerLv.level(), out = []; for (let k = last + 1; k <= lv; k++) out.push(k); return out; },
    claim() {
      const d = Save.load(), list = PlayerLv.pending();
      if (!list.length) return null;
      const sum = { stars: 0, chests: 0 };
      for (const k of list) { const r = PlayerLv.reward(k); sum.stars += r.stars; if (r.chest) sum.chests++; }
      d.plvClaimed = PlayerLv.level(); Save.addCoins(sum.stars); Save.save();
      return Object.assign(sum, { levels: list });
    },
  };
  window.PlayerLv = PlayerLv;

  // ---------- Star -> gold value ----------
  // One gold "base" per game ≈ 10 minutes of play at the player's current level there. Every star→gold offer
  // (in-game shop tiers, hub daily deals) is priced from it, so the rates stay comparable everywhere and a
  // bigger pack is always the better rate per star.
  Save.goldBase = id => {
    const g = Save.load().games[id] || {};
    if (id === 'arrow') return Math.round(400 * Math.pow(1.2, (g.chapter || 1) - 1) / 50) * 50;
    return 150 + 40 * (g.level || 1);
  };

  // ---------- Daily quests ----------
  // Three quests a day, picked from the date. Progress comes from the analytics events every game already
  // sends (Ads.track → Quests.on), so the games need no quest code of their own.
  const GAME_NAMES = { koloni: 'Colony Clash', suru: 'Crowd Surge', maden: 'Gold Mine Empire', cag: 'Age Wars', delik: 'Hungry Hole', arrow: 'Arrow Legends' };
  const QUESTS = [
    { id: 'win3', n: 3, stars: 7, ev: ['level_win', 'battle_win'], text: () => L('Win 3 levels in any game', 'Herhangi bir oyunda 3 seviye kazan') },
    { id: 'win6', n: 6, stars: 12, ev: ['level_win', 'battle_win'], text: () => L('Win 6 levels in any game', 'Herhangi bir oyunda 6 seviye kazan') },
    { id: 'koloni', n: 2, stars: 6, ev: ['level_start'], game: 'koloni' },
    { id: 'suru', n: 2, stars: 6, ev: ['level_start'], game: 'suru' },
    { id: 'cag', n: 2, stars: 6, ev: ['level_start'], game: 'cag' },
    { id: 'delik', n: 2, stars: 6, ev: ['level_start'], game: 'delik' },
    { id: 'arrow', n: 2, stars: 6, ev: ['level_start'], game: 'arrow' },
    { id: 'ads', n: 2, stars: 4, ev: ['rewarded_complete'], text: () => L('Watch 2 reward videos', '2 ödüllü video izle') },
    { id: 'chest', n: 1, stars: 5, ev: ['chest_open'], text: () => L('Open a chest in the Shop', 'Mağazada bir sandık aç') },
    { id: 'maden', n: 3, stars: 6, ev: ['mine_upgrade', 'mine_unlock', 'build'], text: () => L('Upgrade 3 things in Gold Mine Empire', 'Gold Mine Empire\'da 3 geliştirme yap') },
  ];
  QUESTS.forEach(q => { if (q.game) q.text = () => L('Play 2 rounds of ' + GAME_NAMES[q.game], GAME_NAMES[q.game] + ' oyununda 2 tur oyna'); });
  const Quests = {
    GAME_NAMES,
    today() {
      const d = Save.load(), day = dayStr(new Date());
      if (!d.quests || d.quests.day !== day) {
        // Deterministic pick per date: one "win" quest, one game quest, one extra.
        let h = 0; for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        const win = h % 2 ? 'win3' : 'win6', games = ['koloni', 'suru', 'cag', 'delik', 'maden', 'arrow'], extra = ['ads', 'chest'];
        d.quests = { day, list: [win, games[h % games.length], extra[(h >> 3) % extra.length]].map(id => ({ id, p: 0, done: false })), bonus: false };
        Save.save();
      }
      return d.quests.list.map(s => Object.assign({}, QUESTS.find(q => q.id === s.id), s));
    },
    on(ev, params) {
      if (!Save.data) return;
      const list = Quests.today(), st = Save.data.quests.list;
      let changed = false;
      list.forEach((q, i) => {
        if (q.done || st[i].p >= q.n || !q.ev.includes(ev) || (q.game && (!params || params.game !== q.game))) return;
        st[i].p++; changed = true;
      });
      if (changed) Save.save();
    },
    claim(i) {
      const q = Quests.today()[i];
      if (!q || q.done || q.p < q.n) return 0;
      Save.data.quests.list[i].done = true; Save.addCoins(q.stars);
      return q.stars;
    },
    bonusReady() { const l = Quests.today(); return l.every(q => q.done) && !Save.data.quests.bonus; },
    claimBonus() { if (!Quests.bonusReady()) return 0; Save.data.quests.bonus = true; Save.addCoins(10); return 10; },
    // Quests that can be claimed now (badge on the hub).
    ready() { return Quests.today().filter(q => !q.done && q.p >= q.n).length + (Quests.bonusReady() ? 1 : 0); },
  };
  window.Quests = Quests;
  window.UI = UI;
  if (window.addEventListener) addEventListener('resize', () => { UI._sa = null; });
})();
