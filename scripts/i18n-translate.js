// Translates scripts/i18n/strings.json with the local Ollama model (no API quota) and writes ortak/i18n/<lang>.js.
// Incremental: finished texts are kept in scripts/i18n/<lang>.json, so a rerun only translates new/missing keys.
// Usage: node scripts/i18n-translate.js es,pt,de,fr,it,id [--model gemma3:4b] [--batch 25] [--limit N]
// gemma3:4b fits fully on the 4 GB GTX 1650 (num_gpu 99) → ~45 tok/s; qwen3:14b spills to the CPU (~2 tok/s).
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, 'i18n'), WORK = process.env.I18N_WORK || DIR, OUT = path.join(__dirname, '..', 'ortak', 'i18n');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODEL = arg('--model', 'gemma3:4b'), BATCH = +arg('--batch', 12), LIMIT = +arg('--limit', 0);
const NAMES = { es: 'Spanish (neutral Latin American)', pt: 'Brazilian Portuguese', de: 'German', fr: 'French', it: 'Italian', id: 'Indonesian' };
const langs = (process.argv[2] || '').split(',').filter(l => NAMES[l]);
if (!langs.length) { console.log('usage: node scripts/i18n-translate.js es,pt,de,fr,it,id'); process.exit(1); }

const strings = JSON.parse(fs.readFileSync(path.join(DIR, 'strings.json'), 'utf8'));
const KEEP = 'Grab Rush, Arrow Legends, Colony Clash, Crowd Surge, Hungry Hole, Gold Mine Empire, Age Wars, VIP, AD';
const system = lang => 'You translate the user interface of a casual mobile game collection from English into ' + NAMES[lang] + '.\n' +
  'Rules:\n- Short, natural, friendly game wording (buttons, labels, tips). Keep it about as short as the English.\n' +
  '- Address the player informally (du / tu / tú / você / kamu), never the formal form.\n' +
  '- Keep placeholders like {0} {1} exactly, emojis, symbols (⭐ 💰 📜 · × % + : / ✓ ▶) and numbers unchanged.\n' +
  '- Keep HTML tags like <b class="t-gold"> exactly as they are; translate only the words between them.\n' +
  '- Keep leading/trailing spaces and punctuation of each text.\n- Never translate these names: ' + KEEP + '.\n' +
  '- Texts may be fragments that get glued to numbers or other words (e.g. "Lv." or " rooms").\n' +
  '- A Turkish hint is given for meaning only; never copy Turkish words.\n' +
  '- Answer ONLY with JSON: {"items":[{"en":"<the English text copied exactly>","t":"<translation>"}, ...]} in the same order, one entry per input.';

// Each answer echoes its English source next to the translation: plain numbered batches made the small model shift
// answers by one line ("Common" → the translation of "Uncommon"). Matching goes by the echoed text, else by position.
async function ask(lang, items, note) {
  const payload = items.map(it => it.tr ? { en: it.en, tr_hint: it.tr } : { en: it.en });
  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, stream: false, ...(/qwen3/.test(MODEL) ? { think: false } : {}), format: 'json', options: { temperature: 0.2, num_ctx: 4096, num_gpu: 99 },
      messages: [{ role: 'system', content: system(lang) + (note ? '\n' + note : '') }, { role: 'user', content: JSON.stringify(payload, null, 1) }] }),
  });
  const j = await res.json();
  let o; try { o = JSON.parse(j.message.content); } catch (e) { return {}; }
  if (process.env.I18N_DEBUG) console.log(j.message.content);
  const list = Array.isArray(o) ? o : Array.isArray(o.items) ? o.items : Object.values(o).find(Array.isArray) || [];
  const val = x => typeof x === 'string' ? x : x && typeof x === 'object' ? (x.t ?? x.translation ?? x.text) : null;
  const out = {}, aligned = list.length === items.length;
  list.forEach((x, i) => {
    const hit = x && typeof x === 'object' && items.find(it => it.en === x.en || it.en.trim() === String(x.en || '').trim());
    let t = val(x);
    // Sometimes the translation lands in "en" with no "t": take it by position.
    if (typeof t !== 'string' && !hit && aligned && x && typeof x.en === 'string') t = x.en;
    if (typeof t !== 'string') return;
    const it = hit || (aligned ? items[i] : null);
    if (it && !(it.en in out)) out[it.en] = t;
  });
  return out;
}
// Restores the source's outer whitespace and rejects answers that lost or invented placeholders.
function check(en, t) {
  if (typeof t !== 'string' || !t.trim()) return null;
  const words = x => (String(x).toLowerCase().match(/[\p{L}]{2,}/gu) || []);
  if (strings[en]) { const ew = new Set(words(en)), tw = new Set(words(t)); if (words(strings[en]).some(w => !ew.has(w) && tw.has(w))) return null; } // a Turkish word leaked in
  if (strings[en] && t.trim().toLowerCase() === String(strings[en]).trim().toLowerCase() && t.trim().toLowerCase() !== en.trim().toLowerCase()) return null; // copied the Turkish
  const ph = s => (s.match(/\{\d\}/g) || []).sort().join();
  if (ph(en) !== ph(t)) return null;
  const tags = x => (x.match(/<[^>]+>/g) || []).join();
  if (tags(en) !== tags(t)) return null;
  const lead = en.match(/^\s*/)[0], trail = en.match(/\s*$/)[0];
  return lead + t.trim() + trail;
}

const SYM = /\p{Extended_Pictographic}|[⭐💰📜✓▶×]/gu;
const NAMES_RE = /Grab Rush|Arrow Legends|Colony Clash|Crowd Surge|Hungry Hole|Gold Mine Empire|Age Wars/g;
// strict: only shifts and lost symbols count (a word that stays English after a retry is accepted).
function suspicious(en, t, strict) {
  const sym = x => (x.match(SYM) || []).sort().join('');
  if (sym(en) !== sym(t)) return true;
  if (/[ğışĞİŞ]/.test(t) && !/[ğışĞİŞ]/.test(en)) return true; // Turkish hint leaked into the answer
  const a = en.replace(/<[^>]+>/g, '').trim(), b = t.replace(/<[^>]+>/g, '').trim();
  if (a.length >= 4 && (b.length > a.length * 2.6 + 12 || b.length < a.length * 0.35)) return true;
  if (!strict && a === b && /[a-z]{3,}.*\s.*[a-z]{3,}/i.test(a.replace(NAMES_RE, ''))) return true; // multi-word text left in English
  return false;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const lang of langs) {
    const file = path.join(WORK, lang + '.json');
    const done = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    let todo = Object.keys(strings).filter(k => !done[k]);
    if (LIMIT) todo = todo.slice(0, LIMIT);
    console.log(lang + ': ' + todo.length + ' to translate');
    const t0 = Date.now();
    for (let i = 0; i < todo.length; i += BATCH) {
      const items = todo.slice(i, i + BATCH).map(en => ({ en, tr: strings[en] }));
      let got = {}; try { got = await ask(lang, items); } catch (e) { console.log('  request failed', e.message); }
      for (const it of items) {
        let v = check(it.en, got[it.en]);
        if (v == null) { try { v = check(it.en, (await ask(lang, [it]))[it.en]); } catch (e) { } }
        if (v != null) done[it.en] = v; else console.log('  skip:', JSON.stringify(it.en));
      }
      fs.writeFileSync(file, JSON.stringify(done, null, 1));
      console.log('  ' + lang + ' ' + Math.min(i + BATCH, todo.length) + '/' + todo.length + ' (' + Math.round((Date.now() - t0) / 1000) + ' s)');
    }
    // Verify pass: the small model sometimes shifts answers inside a batch ("Armor" → another text's translation),
    // drops emojis or leaves English. Suspicious entries are translated again one at a time.
    if (process.argv.includes('--verify') || !LIMIT) {
      const bad = Object.keys(strings).filter(k => done[k] && suspicious(k, done[k]));
      console.log(lang + ': verify ' + bad.length + ' suspicious');
      for (const en of bad) {
        let v = null;
        for (let i = 0; i < 2 && v == null; i++) { try { const t = check(en, (await ask(lang, [{ en, tr: strings[en] }]))[en]); if (t != null && !suspicious(en, t, true)) v = t; } catch (e) { } }
        if (v != null) done[en] = v; else if (suspicious(en, done[en], true)) delete done[en]; // falls back to English
      }
      fs.writeFileSync(file, JSON.stringify(done, null, 1));
    }
    // Fill pass (--fill): texts the model echoed back in English get one more single-item try with an explicit nudge.
    if (process.argv.includes('--fill')) {
      const plain = x => x.replace(/<[^>]+>/g, ' ').replace(NAMES_RE, '').replace(/\b(VIP|AD|COMBO|XP|HP|Lv)\b/g, '');
      const echo = Object.keys(strings).filter(k => (!done[k] || done[k] === k) && /[a-z]{3,}/i.test(plain(k)));
      console.log(lang + ': fill ' + echo.length);
      const note = 'IMPORTANT: this text is still in English. Translate every English word into ' + NAMES[lang] + ' (only the protected names and placeholders stay).';
      let fixed = 0;
      for (const en of echo) {
        for (let i = 0; i < 2; i++) {
          let t = null; try { t = check(en, (await ask(lang, [{ en, tr: strings[en] }], note))[en]); } catch (e) { }
          if (t != null && t.trim() !== en.trim() && !suspicious(en, t, true)) { done[en] = t; fixed++; break; }
        }
      }
      fs.writeFileSync(file, JSON.stringify(done, null, 1));
      console.log(lang + ': fill fixed ' + fixed + '/' + echo.length);
    }
    // Hand-checked core terms (rarities, slots, main buttons) win over the model.
    const gl = (fs.existsSync(path.join(DIR, 'glossary.json')) ? JSON.parse(fs.readFileSync(path.join(DIR, 'glossary.json'), 'utf8')) : {})[lang] || {};
    // Pipe lists are split in code ('A|B|C'.split('|')[i]): a translation with another item count would leave holes.
    const pipes = x => x.split('|').length;
    const ok = k => done[k] && pipes(done[k]) === pipes(k) && !(pipes(k) > 1 && done[k].split('|').some(p => !p.trim()));
    const live = Object.fromEntries(Object.keys(strings).filter(k => gl[k] || ok(k)).map(k => [k, gl[k] || done[k]]));
    fs.writeFileSync(path.join(OUT, lang + '.js'), '// Generated by scripts/i18n-translate.js — do not edit by hand (edit scripts/i18n/' + lang + '.json).\nI18N.set(' + JSON.stringify(live) + ');\n');
    console.log(lang + ': ' + Object.keys(live).length + '/' + Object.keys(strings).length + ' → ortak/i18n/' + lang + '.js');
  }
})();
