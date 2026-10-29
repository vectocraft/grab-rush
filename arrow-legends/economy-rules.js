// Arrow Legends economy and difficulty rules, shared by game.js and the models in tests/ (arrow-economy.js,
// arrow-progress.js), so the numbers the game uses are the numbers the models check.
// Target (economy v3, 25 Oct 2026): playing ~1 hour a day reaches chapter ~10-12 in week 1, ~25 in month 1 and
// ~50 in month 3 (node tests/arrow-progress.js 60 90).
(function (root) {
  'use strict';
  const T = Object.assign({
    gold0: 0.35, // income multiplier from chapter `early` + 1 on
    early: 8, // chapters 1..early pay more (x1 at chapter 1 down to gold0): new players should fly through them
    goldK: 1.09, // kill gold growth per chapter
    bonusK: 1.11, // chapter-clear bonus growth per chapter
    enemyK: 1.012, // enemy power per step (10 steps per chapter + 4 per stage)
    enemyK2: 1.006, // gentler growth after chapter `soft`: player power is capped, so a steep tail is a wall
    soft: 12,
    talentK: 1.16, // talent cost growth per level
    capStep: 2, // Strength/Vitality cap +2 per chapter cleared past `soft`
  }, (typeof process !== 'undefined' && process.env && process.env.ARROW_T) ? JSON.parse(process.env.ARROW_T) : {});
  const roomsOf = ch => Math.min(50, 10 * ch);
  const stage = room => Math.floor((room - 1) / 10);
  const stageRoom = room => (room - 1) % 10 + 1;
  const step = (ch, room) => (ch - 1) * 10 + stageRoom(room) + stage(room) * 4;
  const softStep = step(T.soft + 1, 1);
  // Enemy strength multiplier. Measured with the 'normal player' bot: +1.9%/step grew ~10x by chapter 15 while such
  // a player's power grows ~5.5x, so +1.2%; past chapter `soft` +0.6%, so capped gear keeps pace for months.
  const enemyPower = (ch, room) => { const s = step(ch, room) - 1, a = Math.min(s, softStep - 1);
    return 0.72 * Math.pow(T.enemyK, a) * Math.pow(T.enemyK2, Math.max(0, s - a)); };
  const incomeK = ch => T.gold0 + (1 - T.gold0) * Math.max(0, 1 - (ch - 1) / T.early);
  const goldScale = ch => incomeK(ch) * Math.pow(T.goldK, ch - 1);
  const winBonus = ch => Math.round(incomeK(ch) * 150 * Math.pow(T.bonusK, ch - 1) * (roomsOf(ch) / 10));
  const BASE_MAX = { atk: 40, hp: 40, heal: 15, gold: 20, speed: 10, crit: 20 };
  // Strength and Vitality open up as the player goes deeper (cleared = highest chapter cleared), up to 100.
  const talentMax = (k, cleared) => (k === 'atk' || k === 'hp') ? Math.min(100, BASE_MAX[k] + T.capStep * Math.max(0, (cleared || 0) - T.soft)) : BASE_MAX[k];
  const talentCost = L => Math.round(150 * Math.pow(T.talentK, Math.min(L, 40)) * Math.pow(1.06, Math.max(0, L - 40)));
  const upCost = (l, r) => Math.round(80 * Math.pow(1.12, l - 1) * (1 + 0.25 * r));
  const R = { T, roomsOf, stage, stageRoom, step, enemyPower, goldScale, winBonus, talentMax, talentCost, upCost };
  if (typeof module !== 'undefined' && module.exports) module.exports = R; else root.ArrowRules = R;
})(typeof window !== 'undefined' ? window : this);
