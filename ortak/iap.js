// In-app purchases via cordova-plugin-purchase / Google Play Billing. Every product id must exist in the Play
// Console (store/market-plan.md). In a plain browser there is no store, so buying is simulated (demo).
// Requires economy.js. What each product grants lives in GRANT below; the shop UI is in index.html.
(function () {
  'use strict';
  const NOADS = 'remove_ads', PREMIUM = 'premium_bundle';
  // Star packs: the first purchase of each pack gives double stars.
  const STAR_PACKS = [
    { id: 'stars_s', n: 80, fallback: '$0.99' },
    { id: 'stars_m', n: 500, fallback: '$4.99', tag: L('+25% bonus', '+%25 bonus') },
    { id: 'stars_l', n: 1100, fallback: '$9.99', tag: L('Popular', 'Popüler') },
    { id: 'stars_xl', n: 2400, fallback: '$19.99', tag: L('Best value', 'En iyi değer') },
  ];
  // Other consumables (one-off offers) and non-consumables.
  const OFFERS = {
    starter_pack: { fallback: '$1.99', stars: 300, gold: 2000 },
    star_card_30: { fallback: '$4.99', stars: 300, daily: 60, days: 30 },
    premium_bundle: { fallback: '$5.99', stars: 500, daily: 10 },
    remove_ads: { fallback: '$2.99' },
    // One-time pack inside each game (Kit.shop): gold (x base of that game), stars and a pack-only skin.
    pack_koloni: { fallback: '$1.99', stars: 150, goldK: 25, skin: 'kral' },
    pack_suru: { fallback: '$1.99', stars: 150, goldK: 25, skin: 'kral' },
    pack_cag: { fallback: '$1.99', stars: 150, goldK: 25, skin: 'kral' },
    pack_delik: { fallback: '$1.99', stars: 150, goldK: 25, skin: 'kral' },
    pack_arrow: { fallback: '$1.99', stars: 150, goldK: 25, scrolls: 10 },
    // Gold Mine: the game turns the pending pack into 12 h of income, 5 manager chests and the royal outfit.
    pack_maden: { fallback: '$1.99', stars: 150, goldK: 0, pending: true },
  };
  const GAME_IDS = ['arrow', 'koloni', 'suru', 'cag', 'delik'];
  const packOf = id => STAR_PACKS.find(p => p.id === id);
  const iapData = () => { const d = Save.load(); return d.iap || (d.iap = { first: {}, bought: {} }); };
  const firstBonus = id => !!packOf(id) && !iapData().first[id];

  function giveStars(n) { Save.addCoins(n); document.dispatchEvent(new CustomEvent('stars', { detail: n })); }
  function giveNoAds() {
    const d = Save.load();
    if (d.noAds) return;
    d.noAds = true; Save.save();
    if (window.Ads) Ads.banner(false);
    document.dispatchEvent(new Event('noads'));
  }
  const GRANT = {
    remove_ads: giveNoAds,
    premium_bundle() {
      const d = Save.load(), a = iapData();
      if (a.bought.premium_bundle) { giveNoAds(); return; } // restore: no second star grant
      a.bought.premium_bundle = Date.now(); d.premium = true; Save.save();
      giveNoAds(); giveStars(OFFERS.premium_bundle.stars);
    },
    starter_pack() {
      const d = Save.load(), o = OFFERS.starter_pack;
      iapData().bought.starter_pack = Date.now();
      for (const id of GAME_IDS) { const g = d.games[id] || (d.games[id] = {}); g.gold = (g.gold || 0) + o.gold; }
      Save.save(); giveStars(o.stars);
      document.dispatchEvent(new CustomEvent('offer', { detail: 'starter_pack' }));
    },
    star_card_30() {
      const d = Save.load(), o = OFFERS.star_card_30, c = d.starCard;
      // A new card extends a running one.
      const from = c && c.until > Date.now() ? c.until : Date.now();
      d.starCard = { until: from + o.days * 864e5, claimed: c && c.until > Date.now() ? c.claimed : '' };
      Save.save(); giveStars(o.stars);
      document.dispatchEvent(new CustomEvent('offer', { detail: 'star_card_30' }));
    },
  };
  // Game packs: the gold is scaled by the base the game's shop showed (stored when the shop opened).
  function grantPack(id) {
    const d = Save.load(), o = OFFERS[id], game = id.slice(5), g = d.games[game] || (d.games[game] = {}), a = iapData();
    if (a.bought[id]) return;
    a.bought[id] = Date.now();
    g.gold = (g.gold || 0) + Math.round((a.base && a.base[game] || 200) * o.goldK);
    if (o.skin) { g.skins = g.skins || []; if (!g.skins.includes(o.skin)) g.skins.push(o.skin); g.skin = o.skin; }
    if (o.scrolls && g.scrolls) for (const k in g.scrolls) g.scrolls[k] += o.scrolls;
    if (o.pending) g.packPending = (g.packPending || 0) + 1;
    Save.save(); giveStars(o.stars);
    document.dispatchEvent(new CustomEvent('offer', { detail: id }));
  }
  function grant(id) {
    if (/^pack_/.test(id)) return grantPack(id);
    if (GRANT[id]) return GRANT[id]();
    const p = packOf(id);
    if (!p) return;
    const a = iapData(), n = p.n * (a.first[id] ? 1 : 2);
    a.first[id] = Date.now(); Save.save();
    giveStars(n);
  }

  let store = null, ready = false;
  const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const NON_CONSUMABLE = [NOADS, PREMIUM];
  const ALL = STAR_PACKS.map(p => p.id).concat(Object.keys(OFFERS));

  async function init() {
    const C = window.CdvPurchase;
    if (!C) return;
    store = C.store;
    store.register(ALL.map(id => ({ id, type: NON_CONSUMABLE.includes(id) ? C.ProductType.NON_CONSUMABLE : C.ProductType.CONSUMABLE, platform: C.Platform.GOOGLE_PLAY })));
    store.when()
      .approved(t => t.verify())
      .verified(r => r.finish())
      .finished(t => { t.products.forEach(p => grant(p.id)); })
      .productUpdated(p => { if (NON_CONSUMABLE.includes(p.id) && p.owned) grant(p.id); });
    store.error(e => console.warn('[iap]', e && e.message));
    await store.initialize([C.Platform.GOOGLE_PLAY]);
    ready = true;
    for (const id of NON_CONSUMABLE) { const p = store.get(id); if (p && p.owned) grant(id); }
    document.dispatchEvent(new Event('iapready'));
  }

  // Resolves 'owned' (granted now), 'pending' (store dialog opened; the grant arrives through events) or 'unavailable'.
  async function buy(id) {
    if (window.Ads) Ads.track('iap_start', { product: id });
    if (!isNative()) { grant(id); return 'owned'; } // browser demo
    if (!ready) return 'unavailable';
    const p = store.get(id), offer = p && p.getOffer();
    if (!offer) return 'unavailable';
    const err = await offer.order();
    return err ? 'unavailable' : 'pending';
  }

  window.IAP = {
    STAR_PACKS, OFFERS,
    // Localized store price, or the placeholder (browser / store not ready).
    priceOf(id) { const p = ready && store.get(id); return p && p.pricing ? p.pricing.price : (packOf(id) || OFFERS[id]).fallback; },
    price() { return IAP.priceOf(NOADS); },
    firstBonus,
    bought: id => !!iapData().bought[id],
    setPackBase(game, base) { const a = iapData(); a.base = a.base || {}; if (a.base[game] !== base) { a.base[game] = base; Save.save(); } },
    buy,
    buyStars: buy,
    buyNoAds: () => buy(NOADS),
    async restore() {
      if (!ready) return false;
      await store.restorePurchases();
      for (const id of NON_CONSUMABLE) { const p = store.get(id); if (p && p.owned) grant(id); }
      return !!Save.data.noAds;
    },
  };
  document.addEventListener('deviceready', () => { init().catch(e => console.warn('[iap] init', e)); }, false);
})();
