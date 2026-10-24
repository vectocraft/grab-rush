// HTML builders for the shared game UI (menus, result screens). Buttons use data-act/data-arg,
// games dispatch them from one click handler on #ov.
(function () {
  'use strict';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  // 12345 → 12.3K / 12,3B; continues through millions, billions, trillions… (Turkish: B, Mn, Mr, Tn, Kd).
  const UNITS = { en: ['K', 'M', 'B', 'T', 'Qa', 'Qi'], tr: ['B', 'Mn', 'Mr', 'Tn', 'Kd', 'Kn'] };
  const fmt = n => {
    if (n === Infinity || n > 1e300) return '∞';
    n = Math.floor(n || 0);
    if (n < 10000) return String(n);
    const units = UNITS[LANG === 'tr' ? 'tr' : 'en'];
    let u = -1;
    while (n >= 1000 && u < units.length - 1 + 26 * 26) { n /= 1000; u++; }
    let t = n >= 100 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, '');
    if (window.DEC_COMMA) t = t.replace('.', ',');
    // Past the named units: aa, ab, … (idle-game style) instead of exponent notation.
    const k = u - units.length;
    return t + (k < 0 ? units[u] : String.fromCharCode(97 + Math.floor(k / 26)) + String.fromCharCode(97 + k % 26));
  };
  // Item rarity (frame colour): given, or derived from the price.
  const RARITY = { common: () => L('Common', 'Sıradan'), rare: () => L('Rare', 'Nadir'), epic: () => L('Epic', 'Epik'), legendary: () => L('Legendary', 'Efsanevi') };
  const rarityOf = s => s.rarity || (s.ads ? 'rare' : !s.cost || s.cost <= 100 ? 'common' : s.cost <= 400 ? 'rare' : s.cost <= 1000 ? 'epic' : 'legendary');

  const Kit = {
    fmt,
    rarityOf,
    rarityName: r => (RARITY[r] || RARITY.common)(),
    coin: () => '<i class="coin"></i>',
    // Menu header: the game's 3D key art with its title over it.
    hero: (img, title) => '<div class="hero" style="background-image:url(../ortak/img/' + img + ')"><p class="t-lg">' + title + '</p></div>',

    // Speech bubble above an element (what a button or an icon does); one at a time, gone after `ms` or a tap.
    tip(el, html, ms) {
      if (!el || !document.body) return;
      const old = document.querySelector('.kit-tip'); if (old) old.remove();
      const t = document.createElement('div'); t.className = 'kit-tip'; t.innerHTML = html; document.body.appendChild(t);
      const r = el.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight, vw = innerWidth;
      const x = Math.max(8, Math.min(vw - w - 8, r.left + r.width / 2 - w / 2)), above = r.top - h - 12 > 8;
      t.style.left = x + 'px'; t.style.top = (above ? r.top - h - 12 : r.bottom + 12) + 'px';
      t.style.setProperty('--ax', Math.max(14, Math.min(w - 14, r.left + r.width / 2 - x)) + 'px'); t.classList.add(above ? 'up' : 'down');
      const kill = () => { t.remove(); removeEventListener('pointerdown', kill, true); };
      setTimeout(() => addEventListener('pointerdown', kill, true), 50); setTimeout(kill, ms || 3200);
    },
    // Long press (450 ms) on a button shows its tip instead of pressing it.
    holdTip(el, html) {
      if (!el) return; let tm = 0, held = false;
      el.addEventListener('pointerdown', () => { held = false; clearTimeout(tm); tm = setTimeout(() => { held = true; Kit.tip(el, typeof html === 'function' ? html() : html); }, 450); });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => clearTimeout(tm));
      el.addEventListener('click', e => { if (held) { held = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    },

    // Levels lv-2 .. lv+2 as a little road; boss levels get a crown.
    road(lv, isBoss) {
      let h = '<div class="road">';
      for (let i = lv - 2; i <= lv + 2; i++) {
        if (i < 1) continue;
        if (i > Math.max(1, lv - 2)) h += '<span class="link' + (i <= lv ? ' done' : '') + '"></span>';
        const cls = (i < lv ? 'done' : i === lv ? 'cur' : '') + (isBoss(i) ? ' boss' : '');
        // Long numbers (1000+) shrink instead of spilling out of the circle.
        const dg = String(i).length;
        h += '<span class="lv ' + cls + (i >= lv && dg >= 3 ? ' d' + Math.min(5, dg) : '') + '">' + (i < lv ? '✓' : i) + '</span>';
      }
      return h + '</div>';
    },

    // Tabs: the leading emoji of a label becomes an icon above the text, so every tab is laid out the same way.
    tabs(active, list) {
      return '<div class="tabs">' + list.map(t => {
        const m = /^(\S+)\s+(.*)$/.exec(t.label), ic = m && !/[A-Za-zÇĞİÖŞÜçğıöşü0-9]/.test(m[1]) ? m[1] : '', tx = ic ? m[2] : t.label;
        return '<button class="tab' + (t.id === active ? ' on' : '') + '" data-act="tab" data-arg="' + t.id + '"><span class="ti">' + (ic || '•') + '</span><span class="tt">' + tx + '</span></button>';
      }).join('') + '</div>';
    },

    // Per-game shop tab: stars → this game's gold (three sizes) and a one-time real-money pack (ortak/iap.js:
    // product "pack_<game>") with gold, stars and a skin you can only get there. refresh() redraws the menu.
    shop(game, G, refresh, opt) {
      opt = opt || {};
      shopCtx = { game, G, refresh, base: opt.base || Save.goldBase(game) };
      const coins = Save.load().coins, base = shopCtx.base;
      if (window.IAP && IAP.setPackBase) IAP.setPackBase(game, base);
      const tiers = SHOP_TIERS.map((t, i) => '<div class="kshop' + (i === 2 ? ' best' : '') + '">' + (t.tag ? '<em>' + t.tag() + '</em>' : '') + '<div class="ki">' + t.icon + '</div><b>+' + fmt(Math.round(base * t.k)) + '</b><small>' + L('game gold', 'oyun altını') + '</small>' +
        '<button class="btn small ' + (coins >= t.stars ? 'purple' : 'gray') + '" data-kshop="gold:' + i + '">⭐ ' + t.stars + '</button></div>').join('');
      const P = window.IAP && IAP.OFFERS['pack_' + game], owned = window.IAP && IAP.bought('pack_' + game);
      // The pack-only skin is shown, not just named: its preview (as in the skins tab) and what it changes.
      const ps = opt.skins && opt.packKey && opt.skins[opt.packKey];
      const prev = ps ? '<span class="kprev">' + (opt.art ? opt.art(opt.packKey, ps) : '<span class="ball' + (ps.fx ? ' fx-' + ps.fx : '') + '" style="background:' + ps.color + ';--c:' + (ps.rim || ps.color) + '"></span>') + '</span>' : '🎁';
      const pack = P ? '<div class="kpack' + (owned ? ' owned' : '') + '"><span class="badge">' + L('ONE TIME', 'TEK SEFER') + '</span><div class="kpi">' + prev + '</div><div class="kpt"><b>' + (opt.packName || L('Champion Pack', 'Şampiyon Paketi')) + '</b>' +
        '<ul><li>💰 +' + fmt(Math.round(base * P.goldK)) + ' ' + L('gold', 'altın') + '</li><li>⭐ +' + P.stars + '</li>' + (opt.packSkin ? '<li>🎨 <span class="kpn">' + opt.packSkin + '</span> ' + L('(only in this pack)', '(sadece bu pakette)') + (opt.packDesc ? '<br><small>' + opt.packDesc + '</small>' : '') + '</li>' : '') + (opt.packExtra ? '<li>' + opt.packExtra + '</li>' : '') + '</ul></div>' +
        (owned ? '<button class="btn small gray" disabled>✓ ' + L('Owned', 'Sahipsin') + '</button>' : '<button class="btn gold" data-kshop="pack">' + IAP.priceOf('pack_' + game) + '</button>') + '</div>' : '';
      return '<div class="sect"><h2>' + L('⭐ Stars → 💰 Gold', '⭐ Yıldız → 💰 Altın') + '</h2></div><div class="kshops">' + tiers + '</div>' + pack +
        '<p class="tip">' + L('Gold buys upgrades in this game. Everything stays reachable for free; the shop only saves time.', 'Altın bu oyunda geliştirme alır. Her şeye bedava da ulaşılır; mağaza sadece zaman kazandırır.') + '</p>';
    },

    // items: [{ key, icon, name, level, max, desc, cost }]
    // coins: what the player can spend; icon: the currency (games pay upgrades with their own 💰 gold).
    upgrades(items, coins, icon) {
      return (icon ? '<div class="purse">' + icon + ' ' + L('Game gold', 'Oyun altını') + ' <b>' + fmt(Math.floor(coins)) + '</b></div>' : '') + '<div class="cards">' + items.map(u => {
        const maxed = u.level >= u.max, can = !maxed && coins >= u.cost;
        const btn = maxed
          ? '<button class="btn small gray" disabled>' + L('MAX', 'MAKS') + '</button>'
          : '<button class="btn small ' + (can ? 'green' : 'gray') + '" data-act="buy" data-arg="' + u.key + '">' + (icon || Kit.coin().replace('coin"', 'coin" style="width:16px;height:16px;vertical-align:-3px"')) + ' ' + fmt(u.cost) + '</button>';
        const pips = Math.min(u.max, 10), on = Math.round(u.level / u.max * pips);
        return '<div class="ucard' + (can ? ' can' : '') + (maxed ? ' maxed' : '') + '"><span class="ulvl">' + L('Lv.', 'Sv.') + u.level + '</span><div class="uico">' + u.icon + '</div><div class="uname">' + esc(u.name) + '</div>' +
          '<div class="pips">' + Array.from({ length: pips }, (_, i) => '<i' + (i < on ? ' class="on"' : '') + '></i>').join('') + '</div>' +
          '<div class="uval">' + esc(u.desc) + '</div>' + btn + '</div>';
      }).join('') + '</div>';
    },

    // skins: { key: { name, color, cost | ads, rarity? } } — rarity-framed tiles like an item shop.
    skins(skins, save, coins, art) {
      return '<div class="skins">' + Object.keys(skins).map(k => {
        const s = skins[k], owned = save.skins.includes(k), on = save.skin === k, r = rarityOf(s);
        let act, tag;
        if (on) { act = ''; tag = '<span class="tag on">✓ ' + L('Equipped', 'Seçili') + '</span>'; }
        else if (owned) { act = 'data-act="skin" data-arg="' + k + '"'; tag = '<span class="tag use">' + L('Equip', 'Seç') + '</span>'; }
        else if (s.pack) { act = 'data-act="tab" data-arg="shop"'; tag = '<span class="tag pack">🎁 ' + L('In pack', 'Pakette') + '</span>'; }
        else if (s.ads) { act = 'data-act="skinAd" data-arg="' + k + '"'; tag = '<span class="tag ad"><span class="ad-ico">AD</span>' + save.adSkin + '/' + s.ads + '</span>'; }
        else { act = 'data-act="skinBuy" data-arg="' + k + '"'; tag = '<span class="tag price' + (coins >= s.cost ? '' : ' poor') + '">⭐ ' + fmt(s.cost) + '</span>'; }
        return '<button class="skin r-' + r + (on ? ' on' : '') + (owned ? '' : ' locked') + '" ' + act + '>' +
          '<span class="rar">' + Kit.rarityName(r) + '</span>' + (art ? '<span class="sart">' + art(k, s) + '</span>' : '<span class="ball' + (s.fx ? ' fx-' + s.fx : '') + '" style="background:' + s.color + ';--c:' + (s.rim || s.color) + '"></span>') +
          '<span class="sname">' + esc(s.name) + '</span>' + tag + '</button>';
      }).join('') + '</div>';
    },

    // Win screen: stars (1-3), reward, x3-ad and continue buttons.
    // How many rewarded ads the "3x" on the win screen costs: 1 up to level 10, 2 up to 30, then 3 (late levels pay a lot).
    adsFor: lv => lv > 30 ? 3 : lv > 10 ? 2 : 1,
    // Plays one ad of a multi-ad reward. Resolves true once all `need` ads are watched; before that it shows
    // "Ad 1/2" on the button and resolves false. `key` groups the ads of one reward (reset with a new key).
    async multiAd(placement, need, key, btn) {
      if (Kit._ma.key !== key) Kit._ma = { key, n: 0 };
      if (!(await Ads.rewarded(placement))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return false; }
      if (++Kit._ma.n >= need) { Kit._ma = { key: null, n: 0 }; return true; }
      UI.toast(L('Ad ' + Kit._ma.n + '/' + need + ' · one more!', 'Reklam ' + Kit._ma.n + '/' + need + ' · bir tane daha!'));
      const b = btn && document.querySelector(btn); if (b) { const t = b.querySelector('.adn') || b.appendChild(document.createElement('span')); t.className = 'adn'; t.textContent = ' · 📺 ' + Kit._ma.n + '/' + need; }
      return false;
    },
    _ma: { key: null, n: 0 },
    win({ title, sub, stars, reward, gems, ads }) {
      let st = '';
      // V3: once the panel is up, each earned star lands with a sparkle and a chime, then confetti falls.
      setTimeout(() => { try {
        const els = document.querySelectorAll('.stars span:not(.off)');
        els.forEach((s, i) => setTimeout(() => { const r = s.getBoundingClientRect(); if (window.Fx && r.width) Fx.burst(r.left + r.width / 2, r.top + r.height / 2, 'star', 14); if (window.Sfx) Sfx.play('star'); }, 380 + i * 250));
        if (window.Fx && Fx.confetti) setTimeout(() => Fx.confetti(stars >= 3 ? 70 : 36), 300 + stars * 250);
      } catch (e) { } }, 0);
      for (let i = 1; i <= 3; i++) st += '<span class="' + (i <= stars ? '' : 'off') + '">⭐</span>';
      return '<div class="rays"></div><div class="ribbon">' + esc(title) + '</div>' +
        '<div class="stars">' + st + '</div>' +
        '<p class="sub">' + esc(sub) + '</p>' +
        (gems ? '<p class="tip">' + L('Every star earns 1 ⭐', 'Her yıldız 1 ⭐ kazandırır') + (gems > stars ? L(' · boss bonus +', ' · boss bonusu +') + (gems - stars) : '') + '</p>' : '') +
        '<div class="loot"><div class="lootc r-rare"><b>💰</b><span>+' + fmt(reward) + '</span></div>' + (gems ? '<div class="lootc r-legendary"><b>⭐</b><span>+' + gems + '</span></div>' : '') + '</div>' +
        '<button class="btn gold big pulse" data-act="claim" data-arg="3"><span class="ad-ico">AD</span>' + L('3x CLAIM', '3x AL') + ' · 💰 +' + fmt(reward * 3) + '<span class="adn">' + (ads > 1 ? ' · 📺 ' + ads : '') + '</span></button>' +
        '<button class="btn gray" data-act="claim" data-arg="1">' + L('Continue', 'Devam') + '</button>';
    },

    lose({ title, sub, hint, extraButtons }) {
      return '<div class="ribbon lose">' + esc(title) + '</div>' +
        '<p class="sub">' + esc(sub) + '</p>' +
        (hint ? '<div class="hint">' + hint + '</div>' : '') + (extraButtons || '');
    },
  };
  window.Kit = Kit;

  // ---------- Per-game shop actions (delegated, so every game gets them without its own handlers) ----------
  const SHOP_TIERS = [
    { stars: 20, k: 1, icon: '💰' },
    { stars: 55, k: 3, icon: '💰💰', tag: () => L('+9%', '+%9') },
    { stars: 120, k: 8, icon: '🪙', tag: () => L('Best value +33%', 'En iyi değer +%33') },
  ];
  let shopCtx = null;
  document.addEventListener('click', async e => {
    const b = e.target.closest && e.target.closest('[data-kshop]');
    if (!b || !shopCtx) return;
    e.stopPropagation();
    const { game, G, refresh, base } = shopCtx, [what, arg] = b.dataset.kshop.split(':');
    if (what === 'gold') {
      const t = SHOP_TIERS[+arg], amt = Math.round(base * t.k);
      if (!Save.spend(t.stars)) { UI.toast(L('Not enough ⭐ stars', 'Yetersiz ⭐ yıldız')); return; }
      G.gold = (G.gold || 0) + amt; Save.save();
      if (window.Ads) Ads.track('game_gold_buy', { game, stars: t.stars });
      if (window.Fx) await Fx.reveal({ title: L('Gold delivered!', 'Altın geldi!'), items: [{ icon: '💰', label: '+' + fmt(amt), sub: L('game gold', 'oyun altını'), rarity: ['rare', 'epic', 'legendary'][+arg] }] });
      refresh();
    } else if (what === 'pack' && window.IAP) {
      const r = await IAP.buy('pack_' + game);
      if (r === 'unavailable') UI.toast(L('Store unavailable right now', 'Mağaza şu an kullanılamıyor'));
      refresh();
    }
  }, true);
  // A game pack bought (now or after the store dialog): show what came in and redraw.
  document.addEventListener('offer', e => {
    if (!/^pack_/.test(e.detail) || !shopCtx) return;
    if (window.Fx) Fx.reveal({ title: L('Pack unlocked!', 'Paket açıldı!'), items: [{ icon: '🎁', label: L('Pack', 'Paket'), sub: L('gold + stars + skin', 'altın + yıldız + skin'), rarity: 'legendary' }] }).then(() => shopCtx.refresh());
    else shopCtx.refresh();
  });
})();

// Shrink-to-fit for one-line labels (HUD level/map chip, menu titles, chapter names) so long map names
// or huge wallet numbers never cut them to "…". The ellipsis in CSS stays only as a last resort.
(function () {
  'use strict';
  const SEL = '.lvl-chip, .mtitle, .ctext b, .roomchip, .mapc b, .pxp b, .btn, .hname, .ubtn .nm, .sktile b';
  const MIN = 9;
  function fit(el) {
    const key = el.textContent + '|' + (el.parentNode ? el.parentNode.clientWidth : 0);
    if (el._fitKey === key && el.scrollWidth <= el.clientWidth + 1) return;
    el._fitKey = key;
    el.style.removeProperty('font-size');
    if (!el.clientWidth) return;
    let size = parseFloat(getComputedStyle(el).fontSize);
    // 'important' so a stylesheet font-size with !important cannot undo the fit.
    while (el.scrollWidth > el.clientWidth + 1 && size > MIN) { size -= 1; el.style.setProperty('font-size', size + 'px', 'important'); }
  }
  // Only labels touched by a DOM change are re-measured: games rewrite HUD numbers every frame, and re-fitting
  // every button on the page each frame (forced layout) cost Age Wars most of its frame time on the phone.
  let queued = false, full = false;
  const dirty = new Set();
  function run() {
    queued = false;
    if (full) { full = false; dirty.clear(); document.querySelectorAll(SEL).forEach(fit); return; }
    dirty.forEach(el => { if (el.isConnected) fit(el); }); dirty.clear();
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(run); } }
  const queueAll = () => { full = true; queue(); };
  function onMut(list) {
    for (const r of list) {
      const n = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      if (!n) continue;
      const c = n.closest(SEL); if (c) dirty.add(c);
      // A panel shown by a class change (".hidden" removed): its labels can be measured now.
      if (r.type === 'attributes') { if (n.matches(SEL)) dirty.add(n); n.querySelectorAll(SEL).forEach(e => dirty.add(e)); }
      else if (r.type === 'childList') for (const a of r.addedNodes) if (a.nodeType === 1) { if (a.matches(SEL)) dirty.add(a); a.querySelectorAll(SEL).forEach(e => dirty.add(e)); }
    }
    if (dirty.size) queue();
  }
  function start() {
    new MutationObserver(onMut).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    addEventListener('resize', queueAll);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueAll);
    queueAll();
  }
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);
})();
