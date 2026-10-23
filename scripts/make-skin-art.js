// Bakes skin portraits in headless Chrome and writes ortak/img/skins/<key>.webp (24-frame turntable strip, 4800x250).
// Pages: skin-art.html (Arrow Legends outfits, default), suru-skin-art.html (Crowd Surge), cag-skin-art.html (Age Wars).
// Usage: start Chrome with --remote-debugging-port=9400 and serve the repo on :5077, then `node scripts/make-skin-art.js [page]`.
const fs = require('fs'), path = require('path'), sharp = require('sharp');
const OUT = path.join(__dirname, '..', 'ortak', 'img', 'skins');
(async () => {
  const t = await (await fetch('http://127.0.0.1:9400/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pend = {};
  await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true }); await send('Page.enable'); // cache off needs the Network domain on
  await send('Emulation.setDeviceMetricsOverride', { width: 400, height: 400, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:5077/scripts/' + (process.argv[2] || 'skin-art.html') });
  await new Promise(r => setTimeout(r, 4000));
  const r = await send('Runtime.evaluate', { expression: 'bake()', awaitPromise: true, returnByValue: true });
  const res = r.result && r.result.result && r.result.result.value;
  if (!res) { console.error('bake failed', JSON.stringify(r).slice(0, 500)); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  for (const k in res) {
    const buf = Buffer.from(res[k].split(',')[1], 'base64');
    await sharp(buf).webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(OUT, k + '.webp'));
  }
  console.log('baked', Object.keys(res).length, 'portraits →', OUT);
  await fetch('http://127.0.0.1:9400/json/close/' + t.id); ws.close(); setTimeout(() => process.exit(0), 100);
})();
