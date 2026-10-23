// TEMPLATE game — the smallest complete game wired into the shared Grab Rush systems:
// save + gold wallet, level road, upgrades / skins / shop tabs, win (3x ad) / lose (skip ad) screens,
// pause + Android back, interstitials between levels, 3D renderer with a headless fallback.
// Demo gameplay: drag to move, collect TARGET coins before the timer runs out. Replace update()/newLevel().
(() => {
  'use strict';

  const ID = 'sablon'; // save key; also add it to GOLD_GAMES (index.html) and PLV_GAMES (economy.js)
  const G = Save.game(ID, { gold: null, level: 1, best: 0, fails: 0, skin: 'mavi', skins: ['mavi'], adSkin: 0, upgrades: { speed: 0, time: 0 } });
  if (G.gold == null) { G.gold = 400; Save.save(); }

  const SKINS = {
    mavi: { name: L('Blue', 'Mavi'), color: '#3b82f6', cost: 0 },
    pembe: { name: L('Pink', 'Pembe'), color: '#ec4899', cost: 150 },
    kral: { name: L('Royal Gold', 'Kraliyet Altını'), color: '#ffcf3f', fx: 'gold', pack: true, rarity: 'legendary' },
    lime: { name: 'Neon', color: '#7dff3a', fx: 'neon', ads: 2 },
  };
  const UPG = {
    speed: { icon: '💨', name: L('Speed', 'Hız'), max: 10, val: l => L((100 + 8 * l) + '%', '%' + (100 + 8 * l)) },
    time: { icon: '⏱️', name: L('Time', 'Süre'), max: 10, val: l => (30 + 2 * l) + L(' s', ' sn') },
  };
  const upgCost = k => Math.round(80 * Math.pow(1.55, G.upgrades[k]));
  const upgDesc = k => { const u = UPG[k], l = G.upgrades[k]; return l >= u.max ? u.val(l) : u.val(l) + ' → ' + u.val(l + 1); };
  const isBoss = lv => lv % 10 === 0;
  const ease = () => Math.min(0.45, 0.15 * (G.fails || 0)); // each loss makes the retry easier

  const $ = id => document.getElementById(id);
  const R3 = window.Tmpl3D ? window.Tmpl3D.init($('c3d')) : null;
  let S = null, mode = 'menu', paused = false, menuTab = 'up', pendingReward = 0, pendingStars = 0;

  // ---------- Game logic (replace) ----------
  function newLevel(lv) {
    const n = 12 + Math.min(lv, 30);
    S = { lv, time: 0, limit: 30 + 2 * G.upgrades.time, got: 0, target: Math.round(n * (0.6 - ease() * 0.3)), boss: isBoss(lv),
      p: { x: 0, z: 0, vx: 0, vz: 0, moving: false }, goal: null, coins: [] };
    for (let i = 0; i < n; i++) S.coins.push({ x: (Math.random() - 0.5) * 50, z: (Math.random() - 0.5) * 50 });
  }
  function update(dt) {
    S.time += dt;
    const p = S.p, spd = 9 * (1 + 0.08 * G.upgrades.speed);
    if (S.goal) {
      const dx = S.goal.x - p.x, dz = S.goal.z - p.z, d = Math.hypot(dx, dz);
      p.moving = d > 0.3;
      if (p.moving) { p.vx = dx / d; p.vz = dz / d; const s = Math.min(d, spd * dt); p.x += p.vx * s; p.z += p.vz * s; }
    } else p.moving = false;
    p.x = Math.max(-28, Math.min(28, p.x)); p.z = Math.max(-28, Math.min(28, p.z));
    S.coins = S.coins.filter(c => {
      if (Math.hypot(c.x - p.x, c.z - p.z) > 1.4) return true;
      S.got++; Sfx.play('coin'); return false;
    });
    if (S.got >= S.target) win();
    else if (S.time >= S.limit) lose();
    hud();
  }

  // ---------- Input ----------
  const toWorld = e => (R3 ? R3.pick(e.clientX, e.clientY) : null);
  $('c3d').addEventListener('pointerdown', e => { if (mode === 'play' && !paused) S.goal = toWorld(e); });
  $('c3d').addEventListener('pointermove', e => { if (mode === 'play' && !paused && e.buttons) S.goal = toWorld(e); });

  // ---------- Screens ----------
  function hud() {
    const lv = S && mode !== 'menu' ? S.lv : G.level;
    $('lvl').innerHTML = L('Level ', 'Seviye ') + lv + (isBoss(lv) ? ' 👑' : '') + '<small>' + Themes.forLevel(lv).name + '</small>';
    $('coins').textContent = Kit.fmt(Save.data.coins);
    $('timer').textContent = S && mode === 'play' ? S.got + '/' + S.target + ' · ' + Math.max(0, Math.ceil(S.limit - S.time)) + L('s', 'sn') : '';
  }
  function panel(html, center) {
    // Redrawing an open panel (tab switch, upgrade) swaps its content only, so the pop-in animation doesn't replay.
    const ov = $('ov'), cls = 'overlay' + (center ? ' center' : ''), sh = ov.className === cls && ov.querySelector(':scope > .sheet');
    ov.className = cls;
    if (sh) sh.innerHTML = html; else ov.innerHTML = '<div class="sheet">' + html + '</div>';
    $('hud').classList.add('hidden');
    Ads.banner(true);
    hud();
  }
  function closePanel() { $('ov').classList.add('hidden'); $('hud').classList.remove('hidden'); Ads.banner(false); }

  const HELP = '<div class="upg"><div><b>' + L('👆 Drag', '👆 Sürükle') + '</b><small>' + L('Move and collect the coins before time runs out.', 'Hareket et, süre bitmeden altınları topla.') + '</small></div></div>';

  function startMenu() {
    mode = 'menu';
    newLevel(G.level); // preview behind the menu
    const items = Object.keys(UPG).map(k => ({ key: k, icon: UPG[k].icon, name: UPG[k].name, level: G.upgrades[k], max: UPG[k].max, desc: upgDesc(k), cost: upgCost(k) }));
    const body = menuTab === 'shop' ? Kit.shop(ID, G, startMenu, { packSkin: SKINS.kral.name, skins: SKINS, packKey: 'kral', packDesc: L('Your hero in shining royal gold', 'Kahramanın parlayan kraliyet altınında') })
      : menuTab === 'skin' ? Kit.skins(SKINS, G, Save.data.coins) : menuTab === 'help' ? HELP : Kit.upgrades(items, G.gold, '💰');
    panel(
      Kit.hero('arrow.webp', 'Template Game') + // TODO: ortak/img/<id>.webp key art
      Kit.road(G.level, isBoss) +
      '<button class="btn green big pulse" data-act="play">' + L('PLAY', 'OYNA') + '</button>' +
      Kit.tabs(menuTab, [{ id: 'up', label: L('⚡ Upgrade', '⚡ Geliştir') }, { id: 'skin', label: L('🎨 Color', '🎨 Renk') }, { id: 'shop', label: L('🛒 Shop', '🛒 Mağaza') }, { id: 'help', label: L('❓ How', '❓ Nasıl') }]) +
      body +
      '<div class="row" style="justify-content:center"><button class="btn gray small" data-act="home">' + L('⌂ Home', '⌂ Ana Menü') + '</button></div>'
    );
  }

  function win() {
    mode = 'end';
    const lv = S.lv;
    pendingReward = Math.round((25 + 6 * Math.min(lv, 60)) * (S.boss ? 2 : 1) * PlayerLv.mul());
    G.level = lv + 1; G.best = Math.max(G.best, lv); G.fails = 0; Save.save();
    Ads.track('level_win', { game: ID, level: lv, time: Math.round(S.time) });
    Sfx.play('win');
    const stars = 1 + (S.time < S.limit * 0.75 ? 1 : 0) + (S.time < S.limit * 0.5 ? 1 : 0);
    pendingStars = stars + (S.boss ? 3 : 0);
    panel(Kit.win({ title: L('VICTORY!', 'ZAFER!'), sub: L('Level ', 'Seviye ') + lv + ' · ' + Math.round(S.time) + L(' s', ' sn'), stars, reward: pendingReward, gems: pendingStars }), true);
  }
  function lose() {
    mode = 'end';
    G.fails = (G.fails || 0) + 1; Save.save();
    Ads.track('level_fail', { game: ID, level: S.lv, fails: G.fails });
    Sfx.play('lose');
    panel(Kit.lose({
      title: L('TIME UP', 'SÜRE BİTTİ'), sub: L('Level ', 'Seviye ') + S.lv,
      hint: L('💡 Next try needs fewer coins.', '💡 Sonraki denemede daha az altın gerekecek.'),
      extraButtons: '<button class="btn green big" data-act="retry">' + L('↻ Try Again', '↻ Tekrar Dene') + '</button>' +
        '<div class="row"><button class="btn purple small" data-act="skip"><span class="ad-ico">AD</span>' + L('Skip Level', 'Seviyeyi Atla') + '</button>' +
        '<button class="btn gray small" data-act="menu">' + L('Menu', 'Menü') + '</button></div>',
    }), true);
  }

  const actions = {
    play() { newLevel(G.level); closePanel(); mode = 'play'; paused = false; hud(); Ads.track('level_start', { game: ID, level: S.lv }); },
    tab(t) { menuTab = t; startMenu(); },
    buy(k) {
      if (G.upgrades[k] >= UPG[k].max) return;
      if (G.gold < upgCost(k)) { UI.toast(L('Not enough gold', 'Yetersiz oyun altını')); return; }
      G.gold -= upgCost(k); G.upgrades[k]++; Save.save();
      UI.toast(UPG[k].icon + ' ' + UPG[k].name + ' ↑'); Sfx.play('coin'); startMenu();
    },
    async claim(m) {
      if (!pendingReward) return;
      if (+m === 3 && !(await Ads.rewarded(ID + '_win_x3'))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      const amount = pendingReward * (+m === 3 ? 3 : 1);
      UI.toast('💰 +' + amount + (pendingStars ? ' · ⭐ +' + pendingStars : ''));
      G.gold += amount; Save.addCoins(pendingStars); pendingReward = 0; pendingStars = 0; Save.save();
      Sfx.play('coin');
      await Ads.levelEnd(G.level - 1); // interstitial with cooldown (ortak/ads.js), never on entry
      startMenu();
    },
    async skip() {
      if (!(await Ads.rewarded(ID + '_skip_level'))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      G.level = S.lv + 1; G.fails = 0; Save.save(); startMenu();
    },
    retry() { actions.play(); },
    skin(k) { if (G.skins.includes(k)) { G.skin = k; Save.save(); startMenu(); } },
    skinBuy(k) {
      if (!Save.spend(SKINS[k].cost)) { UI.toast(L('Not enough ⭐ stars', 'Yetersiz ⭐ yıldız')); return; }
      G.skins.push(k); G.skin = k; Save.save(); UI.toast(SKINS[k].name + L(' unlocked!', ' açıldı!')); Sfx.play('coin'); startMenu();
    },
    async skinAd(k) {
      if (!(await Ads.rewarded(ID + '_skin_' + k))) { UI.toast(L('Ad not completed', 'Reklam tamamlanmadı')); return; }
      G.adSkin++;
      if (G.adSkin >= SKINS[k].ads) { G.skins.push(k); G.skin = k; UI.toast(SKINS[k].name + L(' unlocked!', ' açıldı!')); }
      Save.save(); startMenu();
    },
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
    panel('<p class="t-lg">' + L('Paused', 'Duraklatıldı') + '</p><button class="btn green big" data-act="resume">' + L('▶ Resume', '▶ Devam') + '</button>' +
      '<button class="btn gray" data-act="menu">' + L('Quit level', 'Seviyeden çık') + '</button>', true);
  };
  // Android back: playing -> pause; menu -> hub; anything else -> level menu.
  UI.onBack(() => {
    if (mode === 'play' && !paused) { $('pauseBtn').onclick(); return; }
    if (mode === 'menu') { UI.goHome('../index.html'); return; }
    startMenu();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && !paused) $('pauseBtn').onclick(); });

  // ---------- Loop ----------
  let last = performance.now();
  function loop(t) {
    requestAnimationFrame(loop);
    if (t - last < 7) return; // follow the screen refresh (up to 120 Hz)
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (mode === 'play' && !paused) update(dt);
    if (R3) R3.render(S, dt, { color: (SKINS[G.skin] || SKINS.mavi).color });
  }

  window.__sablon = { get S() { return S; }, G, actions, update, get mode() { return mode; } }; // test hook
  startMenu();
  Sfx.music(true);
  requestAnimationFrame(loop);
})();
