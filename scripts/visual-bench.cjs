// Visual benchmark: 1080x1920 screenshots + per-frame render cost under 4x CPU throttling (headless Chromium,
// WebGL through SwiftShader). Serves the repo itself on a free port.
// Usage: NODE_PATH=$(npm root -g) node scripts/visual-bench.cjs <outDir> <tag> [scene,...]
// Scenes: suru-run, suru-boss, suru-wave, suru-giant, suru-tank, suru-dragon, suru-support, arrow-play, arrow-boss (+ arrow-* below). Prints one JSON line per scene.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

// BENCH_ROOT=<other checkout> measures that tree with this (newer) bench script, for before/after runs.
const ROOT = path.resolve(process.env.BENCH_ROOT || path.join(__dirname, '..'));
const [outDir = 'docs/screens-gorsel', tag = 'shot', only] = process.argv.slice(2);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

const SCENES = {
  // Mid-road firefight: big squad, machine gun, mortars.
  'suru-run': { url: 'suru-seli/index.html#demo:6:150:big,mortar,weapon=2', lang: 'tr' },
  // Level 4 = helicopter boss, fully arrived and fighting.
  'suru-boss': { url: 'suru-seli/index.html#demo:4:260:big,boss,weapon=2', lang: 'tr' },
  // V2: a dense enemy wave on the road, every boss model, and the support abilities in action.
  'suru-wave': { url: 'suru-seli/index.html#demo:12:200:big,weapon=2', lang: 'tr' },
  'suru-giant': { url: 'suru-seli/index.html#demo:2:300:big,boss,weapon=2', lang: 'tr' },
  'suru-tank': { url: 'suru-seli/index.html#demo:3:105:big,boss,weapon=0', lang: 'tr' },
  'suru-dragon': { url: 'suru-seli/index.html#demo:5:150:big,boss,weapon=2', lang: 'tr' },
  'suru-support': { url: 'suru-seli/index.html#demo:8:160:big,weapon=2,heli,shield', lang: 'tr' },
  // A normal fight room a couple of seconds in (bot-driven hero, enemies up, arrows in flight).
  'arrow-play': { url: 'arrow-legends/index.html#play', lang: 'tr', js: 'const A=window.__arrow; A.run(1, 1); A.S.auto=true; A.step(50);' },
  // Chapter 1 boss room (the bot is fast-forwarded through the earlier rooms).
  'arrow-boss': { url: 'arrow-legends/index.html#play', lang: 'tr', js: 'const A=window.__arrow; A.run(1, 9); A.S.auto=true; A.step(60);' },
  // V2: the mage (charge, orbs, nova, meteor) against necromancers; chapter-2 creatures; the ice arrow; a mage skill set;
  // the chapter-4 boss (Magma Dragon) and the chapter-1 guardian intro (telegraphs).
  'arrow-wizard': { url: 'arrow-legends/index.html#play', lang: 'tr', js: 'const A=window.__arrow; A.G.hero=\'mage\'; A.run(1, 2); Object.assign(A.S.skills,{nova:2,meteor:1}); A.spawn(\'necro\',6,-6); A.spawn(\'necro\',-6,-9); A.S.auto=true; A.step(46);' },
  'arrow-creatures': { url: 'arrow-legends/index.html#play', lang: 'tr', js: '(async()=>{LD await ld(2); const A=window.__arrow; A.run(2, 3); A.S.auto=true; A.step(24);})()'.replace('LD', 'const ld=n=>new Promise(r=>{if((ARROW_CHARS.loaded||{})[n])return r();const s=document.createElement(\'script\');s.src=\'chars-\'+n+\'.js\';s.onload=s.onerror=r;document.head.appendChild(s)});') },
  'arrow-ice': { url: 'arrow-legends/index.html#play', lang: 'tr', js: 'const A=window.__arrow; A.run(1, 3); Object.assign(A.S.skills,{ice:1,front:2,multi:1,spd:2}); A.S.auto=true; A.step(44);' },
  'arrow-skills': { url: 'arrow-legends/index.html#play', lang: 'tr', js: 'const A=window.__arrow; A.G.hero=\'mage\'; A.run(1, 3); Object.assign(A.S.skills,{orbit:2,frostaura:2,shield:1,poison:2,fire:1,hp:1,wisdom:1}); A.S.auto=true; A.step(44);' },
  'arrow-boss4': { url: 'arrow-legends/index.html#play', lang: 'tr', js: '(async()=>{LD await ld(4); await ld(7); const A=window.__arrow; A.run(4, 39); A.S.auto=true; A.step(70);})()'.replace('LD', 'const ld=n=>new Promise(r=>{if((ARROW_CHARS.loaded||{})[n])return r();const s=document.createElement(\'script\');s.src=\'chars-\'+n+\'.js\';s.onload=s.onerror=r;document.head.appendChild(s)});') },
  // V3: the hub and the other four games (generic timing: every requestAnimationFrame callback + main-thread busy %).
  'hub': { url: 'index.html', lang: 'tr' },
  'obur': { url: 'obur-delik/index.html#demo', lang: 'tr' },
  'cag': { url: 'caglar-savasi/index.html#demo', lang: 'tr' },
  'altin': { url: 'altin-ocagi/index.html#demo', lang: 'tr' },
  'koloni': { url: 'koloni-kapismasi/index.html#demo', lang: 'tr' },
  // V3: Crowd Surge gate burst, a themed level (desert, lv 15), and the win run; Arrow chest/skill/door moments.
  'suru-gate': { url: 'suru-seli/index.html#demo:15:40:big,weapon=1', lang: 'tr' },
  'suru-snow': { url: 'suru-seli/index.html#demo:25:120:big,weapon=2', lang: 'tr' },
  'suru-volcano': { url: 'suru-seli/index.html#demo:35:120:big,weapon=2', lang: 'tr' },
  'suru-neon': { url: 'suru-seli/index.html#demo:45:120:big,weapon=2', lang: 'tr' },
};

function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]));
      fs.readFile(p.endsWith('/') ? p + 'index.html' : p, (e, d) => {
        if (e) { r.writeHead(404); return r.end(); }
        r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(d);
      });
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  const srv = await serve(), port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  fs.mkdirSync(path.resolve(ROOT, outDir), { recursive: true });
  // One page per pass: a 1080x1920 screenshot (540x960 CSS at DPR 2), then the frame-cost run at a phone-like 393x852
  // CSS viewport at DPR 1 (SwiftShader rasterises on the CPU, so a big canvas would only measure the software GPU).
  async function open(sc, vp, dpr) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, locale: 'tr-TR' });
    const page = await ctx.newPage(), errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.addInitScript(() => {
      window.__frames = []; window.__gl = []; window.__raf = [];
      // Generic cost: every requestAnimationFrame callback (game update + draw), for pages without a wrapped renderer.
      const rq = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = cb => rq(t => { const s = performance.now(); try { cb(t); } finally { window.__raf.push(performance.now() - s); } });
      // Time every game renderer call (scene update + draw), and inside it three.js' own render (scene traversal and
      // WebGL command submission): "js" = the rest = the game's per-frame effect/animation code.
      // three.js defines render() per instance, so the constructor is wrapped as soon as the build defines it.
      let g = 0, three;
      Object.defineProperty(window, 'THREE', { configurable: true, get: () => three, set(v) {
        three = v; let W;
        Object.defineProperty(v, 'WebGLRenderer', { configurable: true, enumerable: true, get: () => W, set(C) {
          W = function () { const r = new C(...arguments), or = r.render; r.render = function () { const t = performance.now(); const x = or.apply(this, arguments); g += performance.now() - t; return x; }; return r; };
          W.prototype = C.prototype;
        } });
      } });
      const wrap = () => {
        const R = (window.__suru && window.__suru.R3) || (window.__arrow && window.__arrow.R3);
        if (!R || R.__wrapped) return;
        const o = R.render; R.__wrapped = true;
        R.render = function () { g = 0; const t = performance.now(); const v = o.apply(this, arguments); window.__frames.push(performance.now() - t); window.__gl.push(g); return v; };
      };
      setInterval(wrap, 50);
    });
    await page.goto('http://127.0.0.1:' + port + '/' + sc.url, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    if (process.env.PREJS) await page.evaluate(process.env.PREJS).catch(e => errs.push(String(e)));
    if (sc.js) await page.evaluate(sc.js).catch(e => errs.push(String(e)));
    await page.waitForTimeout(800);
    return { ctx, page, errs };
  }
  for (const [name, sc] of Object.entries(SCENES)) {
    if (only && !only.split(',').includes(name)) continue;
    let o = await open(sc, { width: 540, height: 960 }, 2);
    await o.page.screenshot({ path: path.join(path.resolve(ROOT, outDir), name + '-' + tag + '.png') });
    const errs = o.errs; await o.ctx.close();
    o = await open(sc, { width: 393, height: 852 }, 1);
    const cdp = await o.ctx.newCDPSession(o.page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await o.page.waitForTimeout(1000);
    await cdp.send('Performance.enable');
    const busy = async () => { const m = (await cdp.send('Performance.getMetrics')).metrics; const g = k => (m.find(x => x.name === k) || {}).value || 0; return { task: g('TaskDuration'), ts: g('Timestamp') }; };
    await o.page.evaluate(() => { window.__frames.length = 0; window.__gl.length = 0; window.__raf.length = 0; window.__t0 = performance.now(); });
    const b0 = await busy();
    await o.page.waitForTimeout(15000);
    const b1 = await busy();
    const r = await o.page.evaluate(() => {
      const st = a => { const f = a.slice().sort((x, y) => x - y), n = f.length; return { avg: +(f.reduce((x, y) => x + y, 0) / Math.max(1, n)).toFixed(2), p50: +(f[Math.floor(n * 0.5)] || 0).toFixed(2), p95: +(f[Math.floor(n * 0.95)] || 0).toFixed(2), max: +(f[n - 1] || 0).toFixed(1) }; };
      const cpu = window.__frames.map((v, i) => v - (window.__gl[i] || 0));
      return { frames: window.__frames.length, fps: +(window.__frames.length / ((performance.now() - window.__t0) / 1000)).toFixed(1), total: st(window.__frames), draw: st(window.__gl), js: st(cpu), raf: { n: window.__raf.length, ...st(window.__raf) } }; });
    r.busy = +(100 * (b1.task - b0.task) / Math.max(1e-6, b1.ts - b0.ts)).toFixed(1);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(JSON.stringify({ scene: name, tag, ...r, errors: errs.concat(o.errs).slice(0, 3) }));
    await o.ctx.close();
  }
  await browser.close(); srv.close();
})();
