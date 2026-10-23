// Visual benchmark: 1080x1920 screenshots + per-frame render cost under 4x CPU throttling (headless Chromium,
// WebGL through SwiftShader). Serves the repo itself on a free port.
// Usage: NODE_PATH=$(npm root -g) node scripts/visual-bench.cjs <outDir> <tag> [scene,...]
// Scenes: suru-run, suru-boss, arrow-play, arrow-boss. Prints one JSON line per scene.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const [outDir = 'docs/screens-gorsel', tag = 'shot', only] = process.argv.slice(2);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

const SCENES = {
  // Mid-road firefight: big squad, machine gun, mortars.
  'suru-run': { url: 'suru-seli/index.html#demo:6:150:big,mortar,weapon=2', lang: 'tr' },
  // Level 4 = helicopter boss, fully arrived and fighting.
  'suru-boss': { url: 'suru-seli/index.html#demo:4:260:big,boss,weapon=2', lang: 'tr' },
  // A normal fight room a couple of seconds in (bot-driven hero, enemies up, arrows in flight).
  'arrow-play': { url: 'arrow-legends/index.html#play', lang: 'tr', js: 'const A=window.__arrow; A.run(1, 1); A.S.auto=true; A.step(50);' },
  // Chapter 1 boss room (the bot is fast-forwarded through the earlier rooms).
  'arrow-boss': { url: 'arrow-legends/index.html#play', lang: 'tr', js: 'const A=window.__arrow; A.run(1, 9); A.S.auto=true; A.step(60);' },
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
  fs.mkdirSync(path.join(ROOT, outDir), { recursive: true });
  // One page per pass: a 1080x1920 screenshot (540x960 CSS at DPR 2), then the frame-cost run at a phone-like 393x852
  // CSS viewport at DPR 1 (SwiftShader rasterises on the CPU, so a big canvas would only measure the software GPU).
  async function open(sc, vp, dpr) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, locale: 'tr-TR' });
    const page = await ctx.newPage(), errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.addInitScript(() => {
      window.__frames = []; window.__gl = [];
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
    if (sc.js) await page.evaluate(sc.js).catch(e => errs.push(String(e)));
    await page.waitForTimeout(800);
    return { ctx, page, errs };
  }
  for (const [name, sc] of Object.entries(SCENES)) {
    if (only && !only.split(',').includes(name)) continue;
    let o = await open(sc, { width: 540, height: 960 }, 2);
    await o.page.screenshot({ path: path.join(ROOT, outDir, name + '-' + tag + '.png') });
    const errs = o.errs; await o.ctx.close();
    o = await open(sc, { width: 393, height: 852 }, 1);
    const cdp = await o.ctx.newCDPSession(o.page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await o.page.waitForTimeout(1000);
    await o.page.evaluate(() => { window.__frames.length = 0; window.__gl.length = 0; window.__t0 = performance.now(); });
    await o.page.waitForTimeout(15000);
    const r = await o.page.evaluate(() => {
      const st = a => { const f = a.slice().sort((x, y) => x - y), n = f.length; return { avg: +(f.reduce((x, y) => x + y, 0) / Math.max(1, n)).toFixed(2), p95: +(f[Math.floor(n * 0.95)] || 0).toFixed(2) }; };
      const cpu = window.__frames.map((v, i) => v - (window.__gl[i] || 0));
      return { frames: window.__frames.length, fps: +(window.__frames.length / ((performance.now() - window.__t0) / 1000)).toFixed(1), total: st(window.__frames), draw: st(window.__gl), js: st(cpu) }; });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(JSON.stringify({ scene: name, tag, ...r, errors: errs.concat(o.errs).slice(0, 3) }));
    await o.ctx.close();
  }
  await browser.close(); srv.close();
})();
