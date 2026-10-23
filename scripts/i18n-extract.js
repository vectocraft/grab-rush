// Collects every English UI text for translation: the first argument of each L('English', 'Türkçe') call and the
// English half of data-l="English|Türkçe" labels. Text glued to values ('Ad ' + n + '/2') becomes a pattern key
// "Ad {0}/2" that ortak/economy.js matches at runtime. Output: scripts/i18n/strings.json ({ key: turkishHint }).
// Usage: node scripts/i18n-extract.js [--report]
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DIRS = ['ortak', 'arrow-legends', 'koloni-kapismasi', 'suru-seli', 'obur-delik', 'altin-ocagi', 'caglar-savasi'];
const files = ['index.html'];
for (const d of DIRS) for (const f of fs.readdirSync(path.join(ROOT, d))) if (/\.(js|html)$/.test(f) && !/^chars|^models|^props/.test(f)) files.push(d + '/' + f);

// Reads one JS argument starting at i: returns { end, parts } where parts are top-level '+' operands as source text.
function readArg(s, i) {
  const parts = []; let depth = 0, start = i;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"' || c === '`') { i = skipStr(s, i); continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth--; }
    else if (depth === 0 && c === ',') break;
    else if (depth === 0 && c === '+' && s[i + 1] !== '+' && s[i - 1] !== '+') { parts.push(s.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(s.slice(start, i).trim());
  return { end: i, parts };
}
function skipStr(s, i) {
  const q = s[i];
  for (i++; i < s.length; i++) { if (s[i] === '\\') { i++; continue; } if (s[i] === q) return i; }
  return i;
}
const isLit = p => /^'(?:[^'\\]|\\.)*'$/.test(p) || /^"(?:[^"\\]|\\.)*"$/.test(p) || /^`[^`$]*`$/.test(p);
// eslint-disable-next-line no-eval
const val = p => eval(p);

const out = {}, report = { literal: 0, pattern: 0, skipped: [] };
const add = (k, tr) => { if (!/[A-Za-z]/.test(k.replace(/\{\d\}/g, ''))) return; if (!(k in out) || (!out[k] && tr)) out[k] = tr || ''; };
for (const f of files) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  // skins.js wraps L in T(en, tr); the mine's ore names are an English list passed to L by index.
  const re = f.endsWith('skins.js') ? /(^|[^\w.$])[LT]\(/g : /(^|[^\w.$])L\(/g; let m;
  for (const o of s.matchAll(/ORE_EN = '([^']*)'\.split\('\|'\)/g)) o[1].split('|').forEach(k => add(k, ''));
  while ((m = re.exec(s))) {
    const a = readArg(s, m.index + m[0].length);
    let tr = '';
    if (s[a.end] === ',') { const b = readArg(s, a.end + 1); if (b.parts.length === 1 && isLit(b.parts[0])) tr = val(b.parts[0]); }
    const ps = a.parts;
    if (ps.length === 1 && isLit(ps[0])) { add(val(ps[0]), tr); report.literal++; continue; }
    if (ps.length === 1) { report.skipped.push(f + ': ' + ps[0].slice(0, 80)); continue; }
    // Glued text: literals stay, runs of other operands become one placeholder each.
    let key = '', n = 0, lastVar = false;
    for (const p of ps) {
      if (isLit(p)) { key += val(p); lastVar = false; }
      else if (!lastVar) { key += '{' + n++ + '}'; lastVar = true; }
    }
    if (n === 0) add(key, tr);
    else if (key.replace(/\{\d\}/g, '').replace(/[^A-Za-z]/g, '').length >= 2) { add(key, tr); report.pattern++; }
    else report.skipped.push(f + ': ' + ps.join(' + ').slice(0, 80));
  }
  if (f.endsWith('.html')) for (const d of s.matchAll(/data-l="([^"|]*)\|([^"]*)"/g)) add(d[1], d[2]);
}
fs.mkdirSync(path.join(__dirname, 'i18n'), { recursive: true });
const sorted = Object.fromEntries(Object.keys(out).sort().map(k => [k, out[k]]));
fs.writeFileSync(path.join(__dirname, 'i18n', 'strings.json'), JSON.stringify(sorted, null, 1));
console.log('keys', Object.keys(out).length, '| literal calls', report.literal, '| pattern calls', report.pattern, '| skipped', report.skipped.length);
if (process.argv.includes('--report')) console.log(report.skipped.join('\n'));
