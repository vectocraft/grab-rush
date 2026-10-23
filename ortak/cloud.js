// Cloud save via Google Play Games Saved Games (native CloudSave plugin; Android only, a no-op in the browser).
// The whole shared save is one snapshot. Every page uploads it when the app goes to the background; the hub
// offers a restore on a fresh install (until this device has decided once) and manual backup/restore in Settings.
// Requires economy.js (Save, PlayerLv, L).
(function () {
  'use strict';
  const KEY = 'kapiskapis_save_v1';
  const DECIDED = 'gr_cloud_decided', LAST = 'gr_cloud_last', BEST = 'gr_cloud_xp';
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { } },
  };
  const plugin = () => {
    const c = window.Capacitor;
    return c && c.isNativePlatform && c.isNativePlatform() && c.Plugins && c.Plugins.CloudSave;
  };
  const xpOf = () => { try { return PlayerLv.info().xp; } catch (e) { return 0; } };
  let signedIn = false, sent = '';

  function pack() {
    const d = Save.load();
    return { v: 1, t: Date.now(), xp: xpOf(), lv: PlayerLv.level(), coins: d.coins || 0, save: JSON.stringify(d) };
  }

  const Cloud = {
    available: () => !!plugin(),
    signedIn: () => signedIn,
    lastBackup: () => +ls.get(LAST) || 0,

    async status() {
      const p = plugin(); if (!p) return false;
      try { signedIn = !!(await p.status()).signedIn; } catch (e) { signedIn = false; }
      return signedIn;
    },
    async signIn() {
      const p = plugin(); if (!p) return false;
      try { signedIn = !!(await p.signIn()).signedIn; } catch (e) { signedIn = false; }
      return signedIn;
    },
    // The cloud copy ({ xp, lv, coins, t, save }) or null.
    async fetch() {
      const p = plugin(); if (!p || !signedIn) return null;
      try {
        const r = await p.load();
        const o = r && r.data ? JSON.parse(r.data) : null;
        if (o && o.save) { ls.set(BEST, Math.max(+ls.get(BEST) || 0, o.xp || 0)); return o; }
      } catch (e) { }
      return null;
    },
    // force: manual backup (may replace a more advanced cloud copy).
    async backup(force) {
      const p = plugin(); if (!p || !signedIn) return false;
      if (!force && ls.get(DECIDED) == null) return false; // never overwrite before the restore question
      const o = pack();
      if (!force && o.xp < (+ls.get(BEST) || 0)) return false; // a reset/fresh save must not replace better progress
      const json = JSON.stringify(o);
      if (!force && json.slice(json.indexOf('"save"')) === sent) return true;
      try {
        await p.save({ data: json, description: L('Level ', 'Seviye ') + o.lv + ' · ⭐ ' + o.coins, progress: o.xp });
        sent = json.slice(json.indexOf('"save"'));
        ls.set(LAST, Date.now()); ls.set(BEST, Math.max(+ls.get(BEST) || 0, o.xp));
        return true;
      } catch (e) { return false; }
    },
    restore(o) {
      try { localStorage.setItem(KEY, o.save); } catch (e) { return false; }
      ls.set(DECIDED, 1); ls.set(BEST, Math.max(+ls.get(BEST) || 0, o.xp || 0));
      Save.data = null; location.reload();
      return true;
    },
    decided() { ls.set(DECIDED, 1); },
    // Hub start: returns the cloud copy when it is worth offering a restore (better than this device), else null.
    async check() {
      if (!(await Cloud.status())) return null;
      const o = await Cloud.fetch();
      if (ls.get(DECIDED) != null) return null;
      if (!o || (o.xp || 0) <= xpOf()) { ls.set(DECIDED, 1); return null; }
      return o;
    },
  };

  // Upload when the app goes to the background (Android pauses the WebView there).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && signedIn) Cloud.backup(false);
  });
  if (plugin()) Cloud.status();
  window.Cloud = Cloud;
})();
