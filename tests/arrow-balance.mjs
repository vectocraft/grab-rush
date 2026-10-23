// Arrow Legends balance run: node tests/arrow-balance.mjs "1:avg,5:avg,15:strong" (headless Chrome on :9400, repo served on :5077).
// Each case plays a chapter with tests/arrow-bot.js (a human-ish bot: reacts every ~0.25 s, misses some threats) and prints one JSON line.
import fs from 'fs';
const cases = process.argv[2].split(',').map(c => c.split(':'));
const bot = fs.readFileSync(new URL('./arrow-bot.js', import.meta.url), 'utf8');
for (const [ch, prof] of cases) {
  const t = await (await fetch('http://127.0.0.1:9400/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pend = {};
  await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Network.setCacheDisabled', { cacheDisabled: true }); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: 'http://localhost:5077/arrow-legends/?ab=' + Math.random() }); await new Promise(r => setTimeout(r, 4000));
  await send('Runtime.evaluate', { expression: bot });
  await send('Runtime.evaluate', { expression: "new Promise(r=>{const ks=[];for(let c=2;c<=7;c++)ks.push(new Promise(q=>{const s=document.createElement('script');s.src='chars-'+c+'.js';s.onload=q;document.head.appendChild(s)}));Promise.all(ks).then(()=>r(1))})", awaitPromise: true });
  const r = await send('Runtime.evaluate', { expression: 'JSON.stringify(abot(' + ch + ",'" + prof + "'))", returnByValue: true });
  const v = r.result.result.value; const o = JSON.parse(v); delete o.rooms;
  console.log(JSON.stringify(o));
  await fetch('http://127.0.0.1:9400/json/close/' + t.id); ws.close();
}
process.exit(0);
