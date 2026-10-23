// Translates the Play Store listing (English section of store/play-console.md) and the screenshot captions
// (store/captions.json "en") with the local Ollama model → store/listing/<lang>.json + captions.json.
// Usage: node scripts/store-listing.js es,pt,de,fr,it,id [--model gemma3:4b]
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODEL = arg('--model', 'gemma3:4b');
const NAMES = { es: 'Spanish (neutral Latin American)', pt: 'Brazilian Portuguese', de: 'German', fr: 'French', it: 'Italian', id: 'Indonesian' };
const langs = (process.argv[2] || '').split(',').filter(l => NAMES[l]);
const KEEP = 'Grab Rush, Arrow Legends, Colony Clash, Crowd Surge, Hungry Hole, Gold Mine Empire, Age Wars';

const md = fs.readFileSync(path.join(ROOT, 'store', 'play-console.md'), 'utf8');
const en = md.slice(md.indexOf('### English (en-US)'), md.indexOf('## İçerik derecelendirmesi'));
const short = en.split('**Short description (80 chars):**')[1].split('**Full description:**')[0].trim();
const full = en.split('**Full description:**')[1].trim();

async function tr(lang, text, hint) {
  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, stream: false, options: { temperature: 0.3, num_ctx: 4096, num_gpu: 99 },
      messages: [{ role: 'system', content: 'You are a professional mobile game store copywriter. Translate the user text from English into ' + NAMES[lang] +
        '. ' + (hint || '') + ' Keep emojis, bullet characters (•), line breaks and numbers. Never translate these names: ' + KEEP +
        '. Address the reader informally. Answer with the translation only, no quotes or notes.' }, { role: 'user', content: text }] }),
  });
  return (await res.json()).message.content.trim().replace(/^["“]|["”]$/g, '');
}

(async () => {
  fs.mkdirSync(path.join(ROOT, 'store', 'listing'), { recursive: true });
  const capFile = path.join(ROOT, 'store', 'captions.json'), caps = JSON.parse(fs.readFileSync(capFile, 'utf8'));
  for (const lang of langs) {
    let s = await tr(lang, short, 'It is the store short description: at most 80 characters.');
    for (let i = 0; i < 3 && s.length > 80; i++) s = await tr(lang, s, 'Shorten it to at most 80 characters, same language.');
    const paras = [];
    for (const p of full.split(/\n\s*\n/)) paras.push(await tr(lang, p, 'Keep the paragraph structure; game names in headings stay in English capitals.'));
    const out = { title: 'Grab Rush: 6 Games in One', short: s, full: paras.join('\n\n') };
    if (out.full.length > 4000) console.log(lang, 'WARNING full description', out.full.length, 'chars');
    fs.writeFileSync(path.join(ROOT, 'store', 'listing', lang + '.json'), JSON.stringify(out, null, 1));
    caps[lang] = {};
    for (const [k, [t, sub]] of Object.entries(caps.en)) {
      let tt = await tr(lang, t, 'It is a short screenshot headline (max ~28 characters). Keep the *asterisks* around the translated highlighted word.');
      if (!/\*[^*]+\*/.test(tt)) tt = tt.replace(/\*/g, '');
      const parts = sub.split(' · ');
      // "Arrow Legends · Action RPG": the game name stays, only the genre is translated.
      caps[lang][k] = [tt, parts.length > 1 && KEEP.includes(parts[0]) ? parts[0] + ' · ' + (await tr(lang, parts[1], 'It is a game genre label, 1-3 words.')) : await tr(lang, sub, 'Short tagline.')];
    }
    fs.writeFileSync(capFile, JSON.stringify(caps, null, 1));
    console.log(lang, 'short', s.length, 'full', out.full.length, 'chars');
  }
})();
