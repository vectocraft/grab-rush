// Purchase feedback shared by every page: a chest-opening reveal and a sparkle burst where you tapped.
//   Fx.reveal({ title, chest: 'gold'|'royal'|null, items: [{ icon, label, sub, rarity }] }) → Promise (closed)
//   Fx.burst(x, y, colour)  — sparkles + ring at a screen point
// Rarity colours: common, great, rare, epic, legendary, mythic, celestial. Every star purchase (Save.spend) bursts at the
// last touch, so buying anything feels like something happened.
(function () {
  'use strict';
  const RAR = { common: '#b9c2d3', great: '#3fc76a', rare: '#3b8cff', epic: '#b05cff', legendary: '#ffb12a', mythic: '#ff4d5a', celestial: '#3fe8ff', star: '#ffd23f' };
  const ORDER = ['common', 'great', 'rare', 'epic', 'legendary', 'mythic', 'celestial'];
  const col = r => RAR[r] || r || RAR.star;
  let css = false;
  function style() {
    if (css) return; css = true;
    const s = document.createElement('style');
    s.textContent = `
.fxl{position:fixed;inset:0;z-index:60;pointer-events:none;overflow:hidden}
.fxp{position:absolute;width:9px;height:9px;margin:-4.5px;border-radius:50%;background:var(--c);box-shadow:0 0 10px var(--c),0 0 3px #fff;animation:fxp var(--t,.8s) cubic-bezier(.15,.7,.3,1) forwards}
@keyframes fxp{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}
.fxr{position:absolute;width:20px;height:20px;margin:-10px;border-radius:50%;border:3px solid var(--c);box-shadow:0 0 14px var(--c);animation:fxr .55s ease-out forwards}
@keyframes fxr{0%{transform:scale(.3);opacity:1}100%{transform:scale(5);opacity:0}}

/* Reveal: a full-screen stage. Every background layer is sized from the viewport, so nothing ends in a visible edge. */
.fxv{position:fixed;inset:0;z-index:55;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(8px,2.2vh,18px);
  padding:calc(env(safe-area-inset-top) + 16px) 14px calc(env(safe-area-inset-bottom) + 16px);pointer-events:auto;font-family:inherit;color:#fff;
  background:radial-gradient(120% 80% at 50% 38%,color-mix(in srgb,var(--c) 30%,#1b1040) 0%,#0d0824 55%,#04030c 100%);animation:fxbg .3s ease-out both}
@keyframes fxbg{from{opacity:0}}
.fxv>*{position:relative;z-index:1}
.fxv .bg{position:absolute;inset:0;z-index:0;pointer-events:none}
.fxv .rays{position:absolute;left:50%;top:var(--cy,38%);width:130vmax;height:130vmax;margin:-65vmax 0 0 -65vmax;opacity:0;will-change:transform;
  background:repeating-conic-gradient(from 0deg,color-mix(in srgb,var(--c) 70%,#fff) 0 6deg,transparent 6deg 18deg);
  -webkit-mask:radial-gradient(circle,#000 0,rgba(0,0,0,.55) 33%,transparent 77%);mask:radial-gradient(circle,#000 0,rgba(0,0,0,.55) 33%,transparent 77%);
  animation:fxspin 14s linear infinite,fxto .5s var(--d0) forwards;--o:.32}
.fxv .rays.r2{animation:fxspin 22s linear infinite reverse,fxto .5s var(--d0) forwards;--o:.18;background:repeating-conic-gradient(from 9deg,var(--c) 0 3deg,transparent 3deg 14deg)}
@keyframes fxspin{to{transform:rotate(360deg)}} @keyframes fxto{to{opacity:var(--o)}}
.fxv .vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,transparent 45%,rgba(0,0,0,.65) 100%)}
.fxv .mote{position:absolute;bottom:-10px;width:var(--s);height:var(--s);border-radius:50%;background:var(--c);box-shadow:0 0 8px var(--c);opacity:0;animation:fxmote var(--t) linear var(--dl) infinite}
@keyframes fxmote{0%{transform:translateY(0);opacity:0}15%{opacity:.8}100%{transform:translateY(-110vh) translateX(var(--sx));opacity:0}}
.fxv .flash{position:fixed;inset:0;background:radial-gradient(circle at 50% var(--cy,38%),#fff 0,color-mix(in srgb,var(--c) 60%,#fff) 18%,transparent 60%);opacity:0;z-index:3;pointer-events:none;animation:fxflash .7s var(--d0) ease-out}
@keyframes fxflash{0%{opacity:0}15%{opacity:1}100%{opacity:0}}

.fxv h3{margin:0;font-size:clamp(22px,7vw,30px);font-weight:900;letter-spacing:.5px;text-align:center;
  background:linear-gradient(180deg,#fff 30%,color-mix(in srgb,var(--c) 70%,#fff));-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 3px 0 rgba(0,0,0,.8)) drop-shadow(0 0 14px color-mix(in srgb,var(--c) 60%,transparent));animation:fxdrop .5s cubic-bezier(.2,1.4,.4,1) both}
@keyframes fxdrop{from{opacity:0;transform:translateY(-24px) scale(.8)}}

.fxv .ch{width:clamp(110px,34vw,150px);height:clamp(110px,34vw,150px);display:grid;place-items:center;transition:height .4s,width .4s}
.fxv .ch .art{grid-area:1/1;width:100%;height:100%;filter:drop-shadow(0 10px 14px rgba(0,0,0,.6))}
.fxv .ch .shut{animation:fxland .45s cubic-bezier(.3,1.5,.5,1) both,fxshake .5s .45s ease-in-out both,fxpop .2s calc(var(--d0) - .05s) ease-in forwards}
.fxv .ch .open{opacity:0;animation:fxopen .5s var(--d0) cubic-bezier(.2,1.6,.4,1) forwards}
.fxv .ch .open[data-c3d]{animation:fxopen .5s var(--d0) cubic-bezier(.2,1.6,.4,1) forwards,c3dopen .5s var(--d0) steps(7,jump-none) both}
@keyframes fxland{from{transform:translateY(-60vh) scale(.6)}}
@keyframes fxshake{0%,100%{transform:rotate(0) scale(1)}20%{transform:rotate(-6deg) scale(1.04,.96)}40%{transform:rotate(7deg) scale(1.06,.94)}60%{transform:rotate(-9deg) scale(1.08,.92)}80%{transform:rotate(10deg) scale(1.1,.9)}}
@keyframes fxpop{to{transform:scale(1.25);opacity:0}}
@keyframes fxopen{0%{opacity:0;transform:scale(.7)}60%{opacity:1;transform:scale(1.12)}100%{opacity:1;transform:scale(1)}}
.fxv.n .ch{height:8px}

/* Cards fly out of the chest (offset set from JS), flip from their back face and settle in a tidy grid.
   The flip is 2D (back face squeezes to nothing, front face grows out of it): Android WebView makes 3D
   rotateY + backface-visibility cards blink in and out. */
.fxv .cards{display:grid;grid-template-columns:repeat(var(--cols),var(--cw));gap:var(--gap);justify-content:center;}
.fxc{--c:#fff;position:relative;width:var(--cw);aspect-ratio:3/4;
  animation:fxfly .6s cubic-bezier(.25,1.25,.45,1) var(--dl) both}
@keyframes fxfly{0%{transform:translate(var(--fx),var(--fy)) scale(.15) rotate(-20deg);opacity:0}25%{opacity:1}
  70%{transform:translate(0,0) scale(1.08)}100%{transform:none;opacity:1}}
.fxc>div{position:absolute;inset:0;border-radius:calc(var(--cw) * .16);overflow:hidden}
.fxc .bk{animation:fxbk .6s linear var(--dl) both;border:2px solid #ffe7a0;background:repeating-linear-gradient(45deg,#3a2470 0 6px,#2a1858 6px 12px);
  box-shadow:inset 0 0 0 3px #1a0f3a,inset 0 0 18px rgba(0,0,0,.6)}
.fxc .bk::after{content:'★';position:absolute;inset:0;display:grid;place-items:center;font-size:calc(var(--cw) * .4);color:#ffd23f;text-shadow:0 2px 0 #7a4a00}
.fxc .fr{animation:fxfr .6s linear var(--dl) both;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px 3px;text-align:center;
  background:linear-gradient(180deg,color-mix(in srgb,var(--c) 45%,#241a52) 0%,#16113a 62%,#0d0a26 100%);
  border:2px solid color-mix(in srgb,var(--c) 85%,#fff);box-shadow:inset 0 0 0 2px rgba(0,0,0,.35),inset 0 2px 0 3px rgba(255,255,255,.12),0 0 16px color-mix(in srgb,var(--c) 55%,transparent)}
.fxc .fr::before{content:'';position:absolute;left:50%;top:36%;width:120%;aspect-ratio:1;transform:translate(-50%,-50%);background:radial-gradient(circle,color-mix(in srgb,var(--c) 55%,transparent),transparent 62%);pointer-events:none}
.fxc .fi{position:relative;display:grid;place-items:center;width:calc(var(--cw) * .58);height:calc(var(--cw) * .58);font-size:calc(var(--cw) * .44);line-height:1;filter:drop-shadow(0 3px 2px rgba(0,0,0,.55))}
.fxc .fi svg,.fxc .fi img{width:100%;height:100%}
.fxc b{position:relative;display:block;max-width:100%;font-size:clamp(10px,calc(var(--cw) * .15),15px);line-height:1.1;font-weight:900;text-shadow:0 2px 0 #000;overflow-wrap:anywhere}
.fxc small{position:relative;display:block;max-width:100%;font-size:clamp(8px,calc(var(--cw) * .105),11px);line-height:1.1;font-weight:700;opacity:.85;overflow-wrap:anywhere}
@keyframes fxbk{0%,30%{transform:scaleX(1)}50%,100%{transform:scaleX(0)}}
@keyframes fxfr{0%,50%{transform:scaleX(0)}80%{transform:scaleX(1.06)}100%{transform:scaleX(1)}}
.fxc .rb{position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--c);box-shadow:0 0 10px var(--c)}
.fxc.big::after{content:'';position:absolute;inset:0;border-radius:calc(var(--cw) * .16);box-shadow:0 0 30px var(--c),0 0 6px #fff;opacity:0;pointer-events:none;will-change:opacity;animation:fxglow 1.3s ease-in-out calc(var(--dl) + .6s) infinite alternate}
.fxc.big .fr::after{content:'';position:absolute;top:-20%;bottom:-20%;width:40%;left:0;transform:translateX(-150%) skewX(-20deg);will-change:transform;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);animation:fxshine 2.4s ease-in-out calc(var(--dl) + .7s) infinite}
@keyframes fxglow{to{opacity:1}}
@keyframes fxshine{0%{transform:translateX(-150%) skewX(-20deg)}55%,100%{transform:translateX(330%) skewX(-20deg)}}

.fxv .go{opacity:0;animation:fxin .35s var(--dg) both;pointer-events:auto;min-width:170px}
@keyframes fxin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.fxv .tapx{font-size:12px;font-weight:700;opacity:0;animation:fxin .3s var(--dg) forwards;color:rgba(255,255,255,.7)}
.fxv.ff *{animation-delay:0s!important}.fxv.ff .ch .shut{display:none}.fxv.ff .ch .open{opacity:1;animation:none}.fxv.ff .rays{opacity:var(--o)}
@media (prefers-reduced-motion:reduce){.fxv .rays,.fxv .mote{animation:none}}`;
    document.head.appendChild(s);
  }
  let layer = null;
  function getLayer() { style(); if (!layer || !layer.isConnected) { layer = document.createElement('div'); layer.className = 'fxl'; document.body.appendChild(layer); } return layer; }
  function burst(x, y, color, n) {
    const L0 = getLayer(), c = col(color);
    n = n || 18;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90;
      p.className = 'fxp'; p.style.cssText = 'left:' + x + 'px;top:' + y + 'px;--c:' + (i % 4 ? c : '#fff') + ';--dx:' + Math.cos(a) * d + 'px;--dy:' + (Math.sin(a) * d - 30) + 'px;--t:' + (0.5 + Math.random() * 0.5) + 's';
      L0.appendChild(p); setTimeout(() => p.remove(), 1100);
    }
    const r = document.createElement('i'); r.className = 'fxr'; r.style.cssText = 'left:' + x + 'px;top:' + y + 'px;--c:' + c; L0.appendChild(r); setTimeout(() => r.remove(), 600);
  }
  // Even rows only: 4 → 2×2, 5–6 → 3 per row, 7–8 → 4, 9–10 → 5, so a lone card never hangs under a full row.
  const colsFor = n => n <= 3 ? Math.max(1, n) : n === 4 ? 2 : n <= 6 ? 3 : n <= 8 ? 4 : 5;
  // Chest / purchase reveal. The best rarity sets the colour of the stage; cards fly out one by one, best last.
  function reveal(o) {
    style();
    return new Promise(res => {
      const items = (o.items || []).slice().sort((a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity));
      const best = items.reduce((m, it) => (ORDER.indexOf(it.rarity) > ORDER.indexOf(m) ? it.rarity : m), 'common'), c = col(o.color || best);
      const hasArt = !!(o.chest && typeof Art !== 'undefined' && Art.chest);
      const shut = hasArt ? Art.chest(o.chest) : o.art || '', open = hasArt ? Art.chest(o.chest, true) : '';
      const d0 = shut ? 1.0 : 0.1, step = items.length > 6 ? 0.1 : 0.16;
      const n = items.length, cols = colsFor(n), rows = Math.ceil(n / cols), gap = n > 6 ? 7 : 10;
      // Card width from the free width and from the height left under the chest, whichever is tighter.
      const freeW = Math.min(innerWidth, 520) - 28 - gap * (cols - 1);
      const freeH = innerHeight * (shut ? 0.46 : 0.62) - gap * (rows - 1);
      const cw = Math.floor(Math.max(54, Math.min(108, freeW / cols, freeH / rows * 0.75)));
      const dg = d0 + n * step + 0.45;
      const el = document.createElement('div');
      el.className = 'fxv' + (shut ? '' : ' n');
      el.style.cssText = '--c:' + c + ';--d0:' + d0 + 's;--dg:' + dg + 's;--cols:' + cols + ';--cw:' + cw + 'px;--gap:' + gap + 'px';
      let motes = '';
      for (let i = 0; i < 18; i++) motes += '<i class="mote" style="left:' + (Math.random() * 100).toFixed(1) + '%;--s:' + (2 + Math.random() * 4).toFixed(1) + 'px;--t:' + (4 + Math.random() * 5).toFixed(1) + 's;--dl:' + (Math.random() * 5).toFixed(1) + 's;--sx:' + (Math.random() * 60 - 30).toFixed(0) + 'px"></i>';
      el.innerHTML = '<div class="bg"><div class="rays"></div><div class="rays r2"></div>' + motes + '<div class="vig"></div></div>' +
        (o.title ? '<h3>' + o.title + '</h3>' : '') +
        '<div class="ch">' + (shut ? shut.replace('class="art"', 'class="art shut"') + (open ? open.replace('class="art"', 'class="art open"') : '') : '') + '</div>' +
        '<div class="cards">' + items.map((it, i) => {
          const big = ORDER.indexOf(it.rarity) >= 3;
          return '<div class="fxc' + (big ? ' big' : '') + '" style="--c:' + col(it.rarity) + ';--dl:' + (d0 + 0.08 + i * step).toFixed(2) + 's">' +
            '<div class="bk"></div><div class="fr"><span class="fi">' + (it.icon || '⭐') + '</span><b>' + (it.label || '') + '</b>' + (it.sub ? '<small>' + it.sub + '</small>' : '') + '<i class="rb"></i></div></div>';
        }).join('') + '</div>' +
        '<button class="btn green big go">' + (o.button || (window.L ? L('Collect', 'Topla') : 'OK')) + '</button>' +
        '<div class="tapx">' + (window.L ? L('Tap anywhere to close', 'Kapatmak için ekrana dokun') : '') + '</div>' +
        (shut ? '<div class="flash"></div>' : '');
      document.body.appendChild(el); Fx.open++;
      // Point every card's start at the chest, and the light at the chest's height.
      const chR = el.querySelector('.ch').getBoundingClientRect(), cx = chR.left + chR.width / 2, cy = chR.top + chR.height / 2;
      el.style.setProperty('--cy', (cy / innerHeight * 100).toFixed(1) + '%');
      el.querySelectorAll('.fxc').forEach(card => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--fx', (cx - (r.left + r.width / 2)).toFixed(0) + 'px');
        card.style.setProperty('--fy', (cy - (r.top + r.height / 2)).toFixed(0) + 'px');
      });
      const timers = [];
      const later = (fn, s) => timers.push(setTimeout(fn, s * 1000));
      if (window.Sfx) later(() => Sfx.play('win'), d0);
      if (shut) later(() => burst(cx, cy, c, 40), d0);
      items.forEach((it, i) => { if (ORDER.indexOf(it.rarity) >= 4) later(() => { const r = el.querySelectorAll('.fxc')[i].getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, col(it.rarity), 16); }, d0 + 0.08 + i * step + 0.45); });
      let ready = false, closed = false;
      const close = () => { if (closed) return; closed = true; Fx.open = Math.max(0, Fx.open - 1); timers.forEach(clearTimeout); el.remove(); if (window.UI && UI.popBack) UI.popBack(close); res(); };
      later(() => { ready = true; }, dg);
      el.onclick = () => { if (ready) close(); else { ready = true; timers.forEach(clearTimeout); el.classList.add('ff'); } };
      if (window.UI && UI.pushBack) UI.pushBack(close);
    });
  }
  // Every successful star purchase sparkles where the finger was.
  let lastX = innerWidth / 2, lastY = innerHeight / 2;
  addEventListener('pointerdown', e => { lastX = e.clientX; lastY = e.clientY; }, true);
  function hookSpend() {
    if (!window.Save || Save.__fxHooked) return;
    const orig = Save.spend.bind(Save);
    Save.spend = n => { const ok = orig(n); if (ok && n > 0) burst(lastX, lastY, 'star', 22); return ok; };
    Save.__fxHooked = true;
  }
  // ---------- V3 juice ----------
  // Fx.fly(n, icon, from, to): icons arc from a point (default: the last touch) to the wallet, each landing bumps it.
  const wallet = () => document.querySelector('#coins') || document.querySelector('.coin-pill, .cur');
  function fly(n, icon, from, to) { try { fly0(n, icon, from, to); } catch (e) { } }
  function fly0(n, icon, from, to) {
    style(); getLayer();
    const t = to || wallet(); if (!t || !t.getBoundingClientRect) return;
    const r = t.getBoundingClientRect(); if (!r.width) return;
    const tx = r.left + r.width / 2, ty = r.top + r.height / 2, f = from || { x: lastX, y: lastY }, cnt = Math.max(3, Math.min(12, n || 8));
    for (let i = 0; i < cnt; i++) {
      const el = document.createElement('i'); el.className = 'fxfly'; el.textContent = icon || '⭐'; layer.appendChild(el);
      const sx = f.x + (Math.random() - 0.5) * 70, sy = f.y + (Math.random() - 0.5) * 50, mx = (sx + tx) / 2 + (Math.random() - 0.5) * 120, my = Math.min(sy, ty) - 60 - Math.random() * 80;
      const kf = []; for (let k = 0; k <= 10; k++) { const u = k / 10, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u; kf.push({ transform: 'translate(' + (a * sx + b * mx + c * tx) + 'px,' + (a * sy + b * my + c * ty) + 'px) scale(' + (1.3 - 0.6 * u) + ')' }); }
      const an = el.animate ? el.animate(kf, { duration: 650 + i * 45, delay: i * 40, easing: 'cubic-bezier(.5,0,.8,.6)', fill: 'both' }) : null;
      const end = () => { el.remove(); t.classList.remove('v3bump'); void t.offsetWidth; t.classList.add('v3bump'); if (window.Sfx && i % 3 === 0) Sfx.play('cash'); };
      if (an) an.onfinish = end; else setTimeout(end, 700);
    }
  }
  // Fx.confetti(n): a shower of coloured flakes over the whole screen.
  function confetti(n) { try { confetti0(n); } catch (e) { } }
  function confetti0(n) {
    style(); getLayer();
    const C = ['#ff4d6d', '#ffd23f', '#3be07a', '#4dabff', '#c77dff', '#ffffff', '#ff9a3a'];
    for (let i = 0; i < (n || 60); i++) {
      const p = document.createElement('i'); p.className = 'fxconf';
      p.style.cssText = 'left:' + (Math.random() * 100).toFixed(1) + '%;background:' + C[i % C.length] + ';--t:' + (1.6 + Math.random() * 1.4).toFixed(2) + 's;--dl:' + (Math.random() * 0.5).toFixed(2) + 's;--dx:' + (Math.random() * 120 - 60).toFixed(0) + 'px;--r:' + (Math.random() * 1080 - 540).toFixed(0) + 'deg' + (i % 3 ? '' : ';width:6px;height:6px;border-radius:50%');
      layer.appendChild(p); setTimeout(() => p.remove(), 3600);
    }
  }
  // Fx.celebrate(title, sub): a big punch-in title over spinning rays with confetti and a fanfare (level up etc.).
  function celebrate(title, sub) {
    style(); getLayer();
    const el = document.createElement('div'); el.className = 'fxcel';
    el.innerHTML = '<div class="rays"></div><b>' + title + (sub ? '<small>' + sub + '</small>' : '') + '</b>';
    layer.appendChild(el); setTimeout(() => el.remove(), 2000);
    confetti(70); if (window.Sfx) Sfx.play('levelup');
  }
  // Every star gained (daily reward, quests, level rewards, win stars) flies into the wallet.
  function hookAdd() {
    if (!window.Save || Save.__fxAdd) return;
    const orig = Save.addCoins.bind(Save);
    Save.addCoins = n => { orig(n); if (n > 0) setTimeout(() => fly(Math.ceil(n / 2), '⭐'), 60); };
    Save.__fxAdd = true;
  }
  hookSpend(); addEventListener('DOMContentLoaded', hookSpend);
  hookAdd(); addEventListener('DOMContentLoaded', hookAdd);
  window.Fx = { reveal, burst, fly, confetti, celebrate, RAR, open: 0, at: () => ({ x: lastX, y: lastY }) };
})();
