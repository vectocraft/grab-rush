// Play Store screenshots for every language: plays each game in headless Chrome with a prepared save (some progress,
// no ad banner), captures 1080×2220, then frames it under a translated caption → store/shots/<lang>/<n>-<id>.png (1080×1920).
// Needs: python -m http.server 5077 (repo root). Usage: node scripts/store-shots.mjs [en,tr,es,...] [--only arrow,hub] [--raw]
import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process'; import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:5077/', PORT = 9402;
const langs = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'en,tr,es,pt,de,fr,it,id').split(',');
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const rawOnly = process.argv.includes('--raw');
const CAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'store', 'captions.json'), 'utf8'));

// One prepared save for all shots: mid-game progress, modest wallets, ads removed (no simulated banner).
const save = lang => ({
  coins: 1250, noAds: true, lang, lastDaily: new Date().toDateString(), streak: 3, plvClaimed: 99,
  games: {
    arrow: { chapter: 12, gold: 18400, best: { 11: 50 } },
    koloni: { level: 20, best: 20, gold: 2400, upgrades: { prod: 6, start: 6, speed: 5 } },
    suru: { level: 14, best: 14, gold: 3100, upgrades: { squad: 6, dmg: 6, rate: 5, air: 2 } },
    delik: { level: 9, best: 9, gold: 1900, upgrades: { size: 5, speed: 4, time: 4 } },
    cag: { level: 6, best: 6, gold: 2600, upgrades: { income: 5, wall: 4, drill: 4 } },
    maden: { cash: 4.2e6, earned: 9e6, shafts: [{ l: 60, m: true, st: 0 }, { l: 52, m: true, st: 0 }, { l: 44, m: true, st: 0 }, { l: 31, m: true, st: 0 }, { l: 18, m: true, st: 0 }], elev: { l: 60, m: true }, trans: { l: 40, m: true } },
  },
});
const click = sel => `(document.querySelector(${JSON.stringify(sel)}) || {click(){}}).click()`;
const SHOTS = [
  { id: 'hub', page: 'index.html', wait: 2500 },
  { id: 'arrow', page: 'arrow-legends/index.html', act: [click('[data-act=start]')], wait: 7000 },
  { id: 'colony', page: 'koloni-kapismasi/index.html', act: [click('[data-act=play]')], wait: 9000 },
  { id: 'crowd', page: 'suru-seli/index.html', act: [click('[data-act=play]')], wait: 10000 },
  { id: 'hole', page: 'obur-delik/index.html', act: [click('[data-act=play]')], wait: 9000 },
  { id: 'mine', page: 'altin-ocagi/index.html', wait: 5000 },
  { id: 'ages', page: 'caglar-savasi/index.html', act: [click('[data-act=play]')], wait: 12000, every: `['u0', 'u1', 'u0'].forEach(k => { const b = document.getElementById(k); if (b && !b.disabled) b.click(); })` },
];

const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'storeshots-' + Date.now()), 'about:blank'], { stdio: 'ignore' });
const sleep = t => new Promise(r => setTimeout(r, t));
let pg; for (let i = 0; i < 40 && !pg; i++) { await sleep(250); try { pg = (await (await fetch('http://localhost:' + PORT + '/json')).json()).find(p => p.type === 'page'); } catch (e) { } }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const send = (method, params = {}) => new Promise(r => { const i = ++id; const h = m => { const d = JSON.parse(m.data); if (d.id === i) { ws.removeEventListener('message', h); r(d.result); } }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = e => send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
const go = async url => { await send('Page.navigate', { url }); await sleep(1500); };
const snap = async file => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(s.data, 'base64')); };
await send('Page.enable');

for (const lang of langs) {
  for (const [n, s] of SHOTS.entries()) {
    if (only && !only.includes(s.id)) continue;
    const raw = path.join(ROOT, 'store', 'shots', 'raw', lang, n + '-' + s.id + '.png');
    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 3, mobile: true });
    await go(BASE + 'gizlilik.html');
    await ev(`localStorage.clear(); localStorage.setItem('kapiskapis_save_v1', ${JSON.stringify(JSON.stringify(save(lang)))}); 1`);
    await go(BASE + s.page); await sleep(1500);
    for (const a of s.act || []) { await ev(a); await sleep(400); }
    for (let t = 0; t < s.wait; t += 1000) { if (s.every) await ev(s.every); await sleep(1000); }
    await snap(raw);
    if (rawOnly) { console.log(lang, s.id, 'raw'); continue; }
    // Frame: caption on top, the screenshot below with rounded corners.
    const c = (CAP[lang] || CAP.en)[s.id];
    await send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false });
    await go(BASE + 'scripts/store-frame.html?img=' + encodeURIComponent('../store/shots/raw/' + lang + '/' + n + '-' + s.id + '.png') + '&t=' + encodeURIComponent(c[0]) + '&s=' + encodeURIComponent(c[1] || '') + '&g=' + s.id);
    await sleep(800);
    await snap(path.join(ROOT, 'store', 'shots', lang, n + '-' + s.id + '.png'));
    console.log(lang, s.id, 'ok');
  }
}
ws.close(); chrome.kill();
