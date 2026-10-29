// Arrow Legends gold economy model (economy v2). node tests/arrow-economy.js
// Estimates the gold of a won run per chapter (same spawn rules as arrow-legends/game.js) and compares the income of
// ~3 run-equivalents per chapter (wins, losses, some 2x ads) with what an "average" player owns at that chapter in
// tests/arrow-bot.js: talents = chapter (capped), four items at level 5 + 2 * chapter. Ratio ~1-3 = healthy:
// the player can afford the average build but cannot max everything. Formulas come from arrow-legends/economy-rules.js.
const E = require('../arrow-legends/economy-rules.js');
const { roomsOf, goldScale, winBonus, talentCost, upCost } = E;
const stage = r => Math.floor((r - 1) / 10), sr = r => (r - 1) % 10 + 1;
const RMAX = [10, 20, 30, 40, 50];

function pickup(ch) { // kill gold of a won run (enemy average 5.5 gold, elites x3, bosses x25)
  let g = 0;
  for (let room = 1; room <= roomsOf(ch); room++) {
    if (sr(room) === 10 || sr(room) === 5) { g += 8 * 25 + (2 + stage(room)) * 4; continue; }
    const n = Math.min(14, 3 + Math.floor(sr(room) * 0.5) + Math.floor((ch - 1) * 0.5) + stage(room));
    const eliteP = ch < 2 ? 0 : Math.min(0.3, 0.08 + 0.02 * (ch - 2) + 0.03 * stage(room));
    g += n * 5.5 * (1 + 2 * eliteP);
  }
  return g * goldScale(ch);
}
let cum = 0;
console.log('ch  win run   cum income   avg build   ratio   (greed 0, player lv bonus 1)');
for (let ch = 1; ch <= 40; ch++) {
  const run = pickup(ch) + winBonus(ch); cum += 3 * run;
  let need = 0;
  for (const k of ['atk', 'hp', 'heal', 'gold', 'speed', 'crit']) for (let L = 0; L < Math.min(ch, E.talentMax(k, ch)); L++) need += talentCost(L);
  const r = Math.min(4, Math.floor((ch - 1) / 3));
  for (let l = 1; l < Math.min(RMAX[r], 5 + 2 * ch); l++) need += 4 * upCost(l, r);
  if ([1, 2, 3, 5, 8, 10, 15, 20, 25, 30, 35, 40].includes(ch))
    console.log(String(ch).padEnd(4) + String(Math.round(run)).padEnd(10) + String(Math.round(cum)).padEnd(13) + String(need).padEnd(12) + (cum / need).toFixed(2));
}
