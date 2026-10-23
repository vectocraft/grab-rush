// Ad layer. In the browser it shows simulated ads; inside a Capacitor app with
// @capacitor-community/admob installed it switches to real AdMob automatically.
// Requires economy.js (Save) to be loaded first.
(function () {
  'use strict';

  // Real AdMob ad units (app "Grab Rush", ca-app-pub-5884386470505700~9317109398).
  // Google's test units, for debugging only: banner 6300978111, interstitial 1033173712, rewarded 5224354917
  // (all under ca-app-pub-3940256099942544/).
  const IDS = {
    banner: 'ca-app-pub-5884386470505700/6248837787',
    interstitial: 'ca-app-pub-5884386470505700/2309592777',
    rewarded: 'ca-app-pub-5884386470505700/7230746962',
    // Short ads (display only, no video): game enter/exit and the free golden chest. Until a display-only unit
    // exists in AdMob this falls back to the interstitial unit.
    short: '',
  };

  // Developer phones get test ads (AdMob device hash from logcat); clicking own real ads risks the account.
  const TEST_DEVICES = ['27B5AEEC48C8003F3AFD94B042B5BD90', '71A7F58D5D90AC451169972E52F74EAE', '671B33829C2A17322A1AB34E9B4795FD']; // the hash changes when the ad id is reset: re-check logcat

  // All ad pacing lives here. Unrequested ads (level-end interstitial, back-to-hub ad) share ONE global gap stored
  // in localStorage, so they never chain across pages or app restarts. Opening a game never shows an ad.
  // Rewarded and opt-in ads (free chest) are never blocked; they only push the next unrequested ad further away.
  // Every 3rd interstitial is followed (once a day) by a friendly "play without ads" offer.
  const CONFIG = {
    firstInterstitialLevel: 3,   // no interstitials for brand-new players
    interstitialEveryNEnds: 2,   // one every N won levels (never after a loss)
    minGapMs: 300000,            // at least 5 minutes between two unrequested ads, whatever their kind
    sessionGraceMs: 180000,      // nothing unrequested in the first 3 minutes after the app opens
    afterRewardedGraceMs: 120000, // don't follow a rewarded/opt-in ad with an unrequested one
    noAdsOfferEvery: 3,          // interstitials between two "remove ads" offers (max one offer a day)
    switchAfterSessions: 2,      // app sessions before back-to-hub ads start
  };

  const ss = {
    get(k, d) { try { const v = sessionStorage.getItem(k); return v == null ? d : +v; } catch (e) { return d; } },
    set(k, v) { try { sessionStorage.setItem(k, String(v)); } catch (e) { } },
  };

  // Survives page changes and app restarts (sessionStorage alone let every page start a fresh cooldown).
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : +v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { } },
  };
  // May an unrequested ad be shown now?
  function forcedAllowed() {
    const now = Date.now();
    if (now - ls.get('ads_last_forced', 0) < CONFIG.minGapMs) return false;
    if (now - ls.get('ads_last_optin', 0) < CONFIG.afterRewardedGraceMs) return false;
    if (now - ss.get('ads_sess_start', now) < CONFIG.sessionGraceMs) return false;
    return true;
  }

  function track(name, params) {
    // Hook for Firebase Analytics / GameAnalytics etc.
    try { console.log('[track]', name, params || {}); } catch (e) { }
    try { if (window.Quests) Quests.on(name, params); } catch (e) { }
  }

  // ---------- Simulated provider (browser) ----------
  function fakeFullscreen(rewarded) {
    return new Promise(resolve => {
      const secs = rewarded ? 5 : 3;
      const el = document.createElement('div');
      el.className = 'fake-ad';
      el.innerHTML =
        '<div class="fake-ad-box">' +
        '<div class="fake-ad-label">' + L('AD · SIMULATION', 'REKLAM · SİMÜLASYON') + '</div>' +
        '<div class="fake-ad-title">' + (rewarded ? L('🎁 Rewarded Ad', '🎁 Ödüllü Reklam') : L('📢 Interstitial Ad', '📢 Geçiş Reklamı')) + '</div>' +
        '<div class="fake-ad-art">🎮</div>' +
        '<div class="fake-ad-count"></div>' +
        '<button class="btn gray small">' + L('Close', 'Kapat') + '</button></div>';
      document.body.appendChild(el);
      const cnt = el.querySelector('.fake-ad-count');
      const btn = el.querySelector('button');
      let left = secs;
      const render = () => {
        if (left > 0) {
          cnt.textContent = left + L(' s', ' sn');
          btn.style.visibility = rewarded ? 'visible' : 'hidden';
          btn.textContent = rewarded ? L('Close (no reward)', 'Kapat (ödül yok)') : '';
        } else {
          cnt.textContent = rewarded ? L('Reward earned ✓', 'Ödül kazanıldı ✓') : '';
          btn.style.visibility = 'visible';
          btn.textContent = rewarded ? L('Claim reward', 'Ödülü al') : L('✕ Close', '✕ Kapat');
          btn.className = 'btn green small';
        }
      };
      render();
      const iv = setInterval(() => { left--; render(); if (left <= 0) clearInterval(iv); }, 1000);
      btn.onclick = () => { clearInterval(iv); el.remove(); resolve(!rewarded || left <= 0 ? true : 'early'); };
    });
  }

  let bannerEl = null;
  // Height of the banner at the bottom (CSS var --ad-h) so fixed bars can sit above it.
  // A solid strip behind the banner and the system navigation bar, so the game does not show through below the ad.
  let adBack = null;
  const setAdH = h => {
    try {
      document.documentElement.style.setProperty('--ad-h', h + 'px');
      if (!adBack && h > 0) { adBack = document.createElement('div'); adBack.className = 'adback'; document.body.appendChild(adBack); }
      if (adBack) adBack.style.display = h > 0 ? 'block' : 'none';
    } catch (e) { }
  };
  const MockProvider = {
    name: 'mock',
    init() { return Promise.resolve(); },
    showBanner() {
      if (!bannerEl) {
        bannerEl = document.createElement('div');
        bannerEl.className = 'banner';
        bannerEl.innerHTML = '<b>AD</b> ' + L('Banner ad slot (320×50) · simulation', 'Banner reklam alanı (320×50) · simülasyon');
        document.body.appendChild(bannerEl);
      }
      bannerEl.classList.remove('hidden');
      setAdH(52);
    },
    hideBanner() { if (bannerEl) bannerEl.classList.add('hidden'); setAdH(0); },
    showInterstitial() { return fakeFullscreen(false); },
    showRewarded() { return fakeFullscreen(true); },
  };

  // ---------- Real AdMob (Capacitor + @capacitor-community/admob) ----------
  // Shows a fullscreen ad and resolves when it closes: true if shown (interstitial) / rewarded (rewarded),
  // 'early' if a rewarded ad was closed before earning the reward, false if it could not be shown.
  async function untilClosed(p, dismissedEvt, failedEvt, rewardEvt, show) {
    let rewarded = false, dismissed = false, done = false;
    const handles = [];
    let finish;
    const result = new Promise(r => { finish = v => { if (!done) { done = true; r(v); } }; });
    const on = async (evt, fn) => { try { handles.push(await p.addListener(evt, fn)); } catch (e) { } };
    if (rewardEvt) await on(rewardEvt, () => { rewarded = true; if (dismissed) finish(true); });
    // The reward callback can land well after dismissal on slow phones; wait for it before calling it early.
    await on(dismissedEvt, () => {
      dismissed = true;
      if (!rewardEvt || rewarded) setTimeout(() => finish(true), 200);
      else setTimeout(() => finish(rewarded ? true : 'early'), 2000);
    });
    await on(failedEvt, () => finish(false));
    const timeout = setTimeout(() => finish(rewardEvt ? rewarded : true), 180000);
    show().then(() => { if (rewardEvt) { rewarded = true; if (dismissed) finish(true); } }, () => finish(false));
    const v = await result;
    clearTimeout(timeout);
    handles.forEach(h => { try { h.remove(); } catch (e) { } });
    return v;
  }

  let sizeHooked = false;
  // Native banner state on this page: 'none' (no loaded view known), 'on', 'off' (loaded but hidden).
  // Re-showing a hidden banner resumes it instead of requesting a new ad (menus that open/close often
  // used to fire a fresh ad request on every tap).
  let nat = 'none';
  function AdMobProvider(p) {
    return {
      name: 'admob',
      async init() {
      // Count app sessions (a fresh sessionStorage = a new app start) for the new-player ad protection.
      try { if (!sessionStorage.getItem('ads_sess')) { sessionStorage.setItem('ads_sess', '1'); sessionStorage.setItem('ads_sess_start', String(Date.now())); localStorage.setItem('ads_sessions', (+localStorage.getItem('ads_sessions') || 0) + 1); } } catch (e) { }
        await p.initialize({ initializeForTesting: true, testingDevices: TEST_DEVICES }); // only marks TEST_DEVICES; everyone else gets real ads
        // GDPR/UMP consent (EEA/UK users). The form is shown only where required.
        try {
          const info = await p.requestConsentInfo();
          if (info.isConsentFormAvailable && info.status === 'REQUIRED') await p.showConsentForm();
          privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
        } catch (e) { }
      },
      async showBanner() {
        // Reserve room above the banner only while one is really on screen (no empty gap when it fails to load).
        if (!sizeHooked) {
          sizeHooked = true;
          try {
            await p.addListener('bannerAdSizeChanged', i => setAdH(bannerWanted && i && i.height || 0));
            await p.addListener('bannerAdFailedToLoad', () => { nat = 'none'; setAdH(0); });
          } catch (e) { }
        }
        // The page may have asked to hide the banner while we were waiting (tap PLAY right after a menu opens):
        // never let a late show leave a banner over the game.
        if (!bannerWanted || nat === 'on') return;
        const was = nat; nat = 'on';
        if (was === 'off') { try { await p.resumeBanner(); } catch (e) { nat = 'none'; } }
        if (nat !== 'on' || was === 'none') {
          nat = 'on';
          try { await p.showBanner({ adId: IDS.banner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0 }); } catch (e) { nat = 'none'; }
        }
        if (!bannerWanted && nat === 'on') { nat = 'off'; setAdH(0); try { await p.hideBanner(); } catch (e) { } }
      },
      async hideBanner(force) {
        setAdH(0);
        if (nat !== 'on' && !force) return;
        if (nat === 'on') nat = 'off';
        try { await p.hideBanner(); } catch (e) { }
      },
      async privacyOptions() { await p.showPrivacyOptionsForm(); },
      // Both resolve only when the ad is closed, so the game stays paused while it is on screen.
      // Note: showRewardVideoAd() never settles if the user closes the ad before earning the reward,
      // so completion is driven by the Dismissed event instead.
      async showInterstitial(unit) {
        try { await p.prepareInterstitial({ adId: unit || IDS.interstitial }); } catch (e) { return false; }
        return untilClosed(p, 'interstitialAdDismissed', 'interstitialAdFailedToShow', null, () => p.showInterstitial());
      },
      async showRewarded() {
        try { await p.prepareRewardVideoAd({ adId: IDS.rewarded }); } catch (e) { return false; }
        return untilClosed(p, 'onRewardedVideoAdDismissed', 'onRewardedVideoAdFailedToShow', 'onRewardedVideoAdReward', () => p.showRewardVideoAd());
      },
    };
  }

  // A rewarded ad closed with its ✕ before the reward: we cannot block that button, so explain and offer a retry.
  function earlyCloseDialog() {
    return new Promise(res => {
      const el = document.createElement('div');
      el.className = 'noads-offer';
      el.innerHTML = '<div class="nao-box"><b>⚠️ ' + L('Ad closed early', 'Reklam erken kapatıldı') + '</b><small>' +
        L('Watch the ad to the end to get the reward.', 'Ödül için reklamı sonuna kadar izlemelisin.') + '</small>' +
        '<button class="btn green" data-ea="1"><span class="ad-ico">AD</span>' + L('Watch again', 'Tekrar izle') + '</button>' +
        '<button class="btn small gray" data-ea="0">' + L('Cancel', 'Vazgeç') + '</button></div>';
      const done = v => { el.remove(); if (window.UI && UI.popBack) UI.popBack(back); res(v); };
      const back = () => done(false);
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-ea]'); if (!b) return;
        e.stopPropagation(); done(b.dataset.ea === '1');
      }, true);
      document.body.appendChild(el);
      if (window.UI && UI.pushBack) UI.pushBack(back);
    });
  }

  // After every few interstitials (at most once a day): a small card offering to remove ads.
  function noAdsOffer() {
    try {
      const d = Save.load(), day = new Date().toDateString(), n = (d.interCount = (d.interCount || 0) + 1);
      Save.save();
      if (d.noAds || !window.IAP || n % CONFIG.noAdsOfferEvery || d.noAdsOfferDay === day) return;
      d.noAdsOfferDay = day; Save.save();
      const el = document.createElement('div');
      el.className = 'noads-offer';
      el.innerHTML = '<div class="nao-box"><b>' + L('Tired of ads?', 'Reklamlardan sıkıldın mı?') + '</b><small>' +
        L('Remove banners and interstitials in every game, forever.', 'Tüm oyunlarda banner ve geçiş reklamlarını sonsuza dek kaldır.') + '</small>' +
        '<button class="btn gold" data-nao="buy">🚫 ' + L('Remove ads · ', 'Reklamları kaldır · ') + IAP.priceOf('remove_ads') + '</button>' +
        '<button class="btn small gray" data-nao="no">' + L('Not now', 'Şimdi değil') + '</button></div>';
      el.addEventListener('click', async e => {
        const b = e.target.closest('[data-nao]'); if (!b) return;
        e.stopPropagation(); el.remove();
        if (b.dataset.nao === 'buy') { track('noads_offer_buy'); await IAP.buyNoAds(); }
      }, true);
      document.body.appendChild(el); track('noads_offer_show');
    } catch (e) { }
  }

  async function switchAd(kind, where) {
    const d = Save.load();
    if (d.noAds || busy) return false;
    let sess = 0; try { sess = +localStorage.getItem('ads_sessions') || 0; } catch (e) { }
    if (sess <= CONFIG.switchAfterSessions) return false;
    if (kind !== 'exit' || !forcedAllowed()) return false;
    ls.set('ads_last_forced', Date.now());
    return showShort('switch_' + kind + (where ? '_' + String(where).split('/')[0] : ''), true);
  }

  async function showShort(placement, forced) {
    if (busy && Date.now() - busySince < 180000) return false;
    busy = true; busySince = Date.now();
    track('short_start', { placement });
    let ok = false;
    window.Sfx && Sfx.suspend();
    try { ok = await provider.showInterstitial(IDS.short || IDS.interstitial); } catch (e) { ok = false; }
    window.Sfx && Sfx.resume();
    busy = false;
    ls.set(forced ? 'ads_last_forced' : 'ads_last_optin', Date.now());
    track(ok ? 'short_done' : 'short_fail', { placement });
    if (bannerWanted) Ads.banner(true);
    return ok;
  }

  let provider = MockProvider;
  let privacyRequired = false; // EEA users must be able to reopen the consent form
  let busy = false, busySince = 0;
  let bannerWanted = false;

  const Ads = {
    config: CONFIG,

    async init() {
      const cap = window.Capacitor;
      const admob = cap && cap.Plugins && cap.Plugins.AdMob;
      if (admob) {
        try { provider = AdMobProvider(admob); await provider.init(); } catch (e) { provider = MockProvider; }
      }
      // A native banner survives page changes: every page starts without one unless it asked for it.
      // force: the JS state is fresh on every page, but a banner from the previous page may still be on screen.
      try { if (bannerWanted && !Save.load().noAds) await provider.showBanner(); else await provider.hideBanner(true); } catch (e) { }
      track('ads_init', { provider: provider.name });
    },

    banner(show) {
      if (!!show === bannerWanted && show) return; // already up: no new request
      bannerWanted = !!show;
      if (show && !Save.load().noAds) provider.showBanner();
      else provider.hideBanner();
    },

    // Resolves true only if the user watched to the end. Closed early: offers to watch another one right away.
    async rewarded(placement) {
      // A show that never reported back (lost native event) must not block every later ad.
      if (busy && Date.now() - busySince < 180000) return false;
      busy = true; busySince = Date.now();
      track('rewarded_start', { placement });
      let ok = false;
      for (;;) {
        window.Sfx && Sfx.suspend();
        try { ok = await provider.showRewarded(); } catch (e) { ok = false; }
        window.Sfx && Sfx.resume();
        if (ok !== 'early') break;
        track('rewarded_early', { placement });
        if (!(await earlyCloseDialog())) { ok = false; break; }
        busySince = Date.now();
      }
      busy = false;
      ls.set('ads_last_optin', Date.now());
      track(ok ? 'rewarded_complete' : 'rewarded_cancel', { placement });
      if (bannerWanted) this.banner(true);
      return ok;
    },

    // Call at every level end (win claimed or retry). Decides by itself whether to show.
    async levelEnd(level) {
      if (Save.load().noAds || busy) return false;
      if (level < CONFIG.firstInterstitialLevel) return false;
      const ends = ss.get('ads_level_ends', 0) + 1;
      ss.set('ads_level_ends', ends);
      if (ends % CONFIG.interstitialEveryNEnds !== 0) return false;
      if (!forcedAllowed()) return false;
      ls.set('ads_last_forced', Date.now());
      busy = true;
      track('interstitial_show', { level });
      window.Sfx && Sfx.suspend();
      try { await provider.showInterstitial(); } catch (e) { }
      window.Sfx && Sfx.resume();
      busy = false;
      ls.set('ads_last_forced', Date.now());
      if (bannerWanted) this.banner(true);
      noAdsOffer();
      return true;
    },

    // One short (display) ad the player asked for (free chest = 2 of these): no pacing. True if it was shown.
    short(placement) { return showShort(placement, false); },
    // Opening a game never shows an ad; only remembers it so coming back to the hub may (paced) show one.
    async gameSwitch(where) {
      try { sessionStorage.setItem('ads_in_game', '1'); } catch (e) { }
      return false;
    },
    async backToHub() {
      let was = false; try { was = sessionStorage.getItem('ads_in_game') === '1'; sessionStorage.removeItem('ads_in_game'); } catch (e) { }
      return was ? switchAd('exit') : false;
    },

    // Whether a 'Privacy settings' entry must be shown (GDPR).
    privacyRequired() { return privacyRequired; },
    async privacyOptions() { try { if (provider.privacyOptions) await provider.privacyOptions(); } catch (e) { } },

    track,
  };

  window.Ads = Ads;
  Ads.init();
})();
