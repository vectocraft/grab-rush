// Arrow Legends: how far does a player get with N minutes a day? node tests/arrow-progress.js [minPerDay] [days]
// Mirrors the economy and difficulty formulas of arrow-legends/game.js (keep in sync). Player model:
// - Power index = item rarity x item level x Strength talent. Chapter c is clearable when it reaches the power the
//   balance bot clears c with (tests/arrow-bot.js "avg" build), scaled by the enemy growth of game.js power().
// - Not ready yet: farms the last cleared chapter (a win, full gold).
// - Best gear rarity follows the drops: Rare from the first boss chests, Epic around chapter 8 (obsidian chests,
//   first clears), Legendary from 25, Mythic (3-to-1 merges) from 40. A better piece restarts at level 1.
// - Watches the 2x gold ad on half of the runs, player-level bonus +20%.
// - Spends all gold on the cheapest available upgrade (talents and the 4 items).
// Chapter minutes: measured with tests/arrow-balance.mjs (25 Oct 2026) x1.5 for a human, +1 min menus/ads.
const E = require('../arrow-legends/economy-rules.js');
const MIN = +(process.argv[2] || 60), DAYS = +(process.argv[3] || 90);
const MEASURED = { 1: 4.2, 2: 9.7, 3: 12.4, 8: 21.7, 12: 17.4 };
const perRoom = Object.keys(MEASURED).reduce((a, k) => a + MEASURED[k] / E.roomsOf(+k), 0) / Object.keys(MEASURED).length;
const minutes = ch => MEASURED[ch] || perRoom * E.roomsOf(ch);
const RMAX = [10, 20, 30, 40, 50, 60, 70], MUL = [1, 1.4, 1.95, 2.7, 3.7, 5, 6.8];
const prarity = ch => ch < 8 ? 2 : ch < 25 ? 3 : ch < 40 ? 4 : ch < 50 ? 5 : 6;
const score = (r, l, tal) => MUL[r] * (1 + 0.08 * (l - 1)) * (1 + 0.03 * tal);
// The bot clears chapter c with talents = c (capped) and items of rarity min(4,(c-1)/3) at level 5 + 2c; beyond
// chapter 12 (the last measured) the requirement grows with the enemies.
const botR = c => Math.min(4, Math.floor((c - 1) / 3));
const botScore = c => score(botR(c), Math.min(RMAX[botR(c)], 5 + 2 * c), Math.min(c, E.talentMax('atk', c)));
const need = c => c <= 12 ? botScore(c) : botScore(12) * E.enemyPower(c, 1) / E.enemyPower(12, 1);
function pickup(ch) {
  const sr = r => (r - 1) % 10 + 1, stage = r => Math.floor((r - 1) / 10);
  let g = 0;
  for (let room = 1; room <= E.roomsOf(ch); room++) {
    if (sr(room) === 10 || sr(room) === 5) { g += 8 * 25 + (2 + stage(room)) * 4; continue; }
    const n = Math.min(14, 3 + Math.floor(sr(room) * 0.5) + Math.floor((ch - 1) * 0.5) + stage(room));
    const eliteP = ch < 2 ? 0 : Math.min(0.3, 0.08 + 0.02 * (ch - 2) + 0.03 * stage(room));
    g += n * 5.5 * (1 + 2 * eliteP);
  }
  return g * E.goldScale(ch);
}
function simulate(min, days, report) {
  const P = { gold: 300, ch: 1, t: { atk: 0, hp: 0, heal: 0, gold: 0, speed: 0, crit: 0 }, r: 0, l: [1, 1, 1, 1], runs: 0 };
  const ready = c => score(P.r, Math.min(...P.l), P.t.atk) >= need(c);
  const spend = () => {
    for (;;) {
      const opts = [];
      for (const k in P.t) if (P.t[k] < E.talentMax(k, P.ch - 1)) opts.push({ c: E.talentCost(P.t[k]), go: () => P.t[k]++ });
      P.l.forEach((l, i) => { if (l < RMAX[P.r]) opts.push({ c: E.upCost(l, P.r), go: () => P.l[i]++ }); });
      opts.sort((a, b) => a.c - b.c);
      if (!opts.length || opts[0].c > P.gold) return;
      P.gold -= opts[0].c; opts[0].go();
    }
  };
  const rows = [];
  for (let day = 1; day <= days; day++) {
    let left = min;
    while (left > 0) {
      if (prarity(P.ch) > P.r) { P.r = prarity(P.ch); P.l = [1, 1, 1, 1]; }
      const go = ready(P.ch) ? P.ch : Math.max(1, P.ch - 1), m = minutes(go);
      if (m > left && go === P.ch) break; // nobody starts a long chapter at the end of the session
      left -= m; P.runs++;
      P.gold += (pickup(go) + E.winBonus(go)) * (1 + 0.02 * P.t.gold) * 1.2 * 1.5;
      if (go === P.ch && ready(P.ch)) P.ch++;
      spend();
    }
    if (report.includes(day)) rows.push({ gün: day, bölüm: P.ch - 1, koşu: P.runs, yetenek: Object.values(P.t).join('/'),
      ekipman: ['Sıradan', 'Güzel', 'Nadir', 'Epik', 'Efsanevi', 'Mitik', 'Göksel'][P.r] + ' Sv.' + Math.min(...P.l), altın: Math.round(P.gold) });
  }
  return rows;
}
module.exports = simulate;
if (require.main === module) console.table(simulate(MIN, DAYS, [1, 3, 7, 14, 21, 30, 45, 60, 75, 90].filter(d => d <= DAYS)));
