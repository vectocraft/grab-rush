// Hand-drawn SVG icons for Arrow Legends: equipment (what the item IS), slots and skills (what the skill DOES).
// ArrowIcons.item(base), .slot(slot), .skill(key) return inline <svg> strings (64x64 view box, scale with CSS).
(function () {
  'use strict';
  const svg = body => '<svg class="aic" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  const O = '#1b1206'; // outline
  // Reusable arrow (from x1,y1 to x2,y2) with a head and fletching.
  function arrow(x1, y1, x2, y2, c, w) {
    const a = Math.atan2(y2 - y1, x2 - x1), h = 7, f = 6, ca = Math.cos(a), sa = Math.sin(a);
    const hx = x2 - ca * h, hy = y2 - sa * h, px = -sa, py = ca;
    return '<path d="M' + x1 + ' ' + y1 + 'L' + hx.toFixed(1) + ' ' + hy.toFixed(1) + '" stroke="' + O + '" stroke-width="' + ((w || 4) + 3) + '"/>' +
      '<path d="M' + x1 + ' ' + y1 + 'L' + hx.toFixed(1) + ' ' + hy.toFixed(1) + '" stroke="' + (c || '#f4e2b0') + '" stroke-width="' + (w || 4) + '"/>' +
      '<path d="M' + x2 + ' ' + y2 + 'L' + (hx + px * 5).toFixed(1) + ' ' + (hy + py * 5).toFixed(1) + 'L' + (hx - px * 5).toFixed(1) + ' ' + (hy - py * 5).toFixed(1) + 'Z" fill="#dfe8f0" stroke="' + O + '" stroke-width="2.5"/>' +
      '<path d="M' + (x1 + ca * f + px * 4).toFixed(1) + ' ' + (y1 + sa * f + py * 4).toFixed(1) + 'L' + x1 + ' ' + y1 + 'L' + (x1 + ca * f - px * 4).toFixed(1) + ' ' + (y1 + sa * f - py * 4).toFixed(1) + '" fill="none" stroke="#ff6b6b" stroke-width="3"/>';
  }
  const circle = (cx, cy, r, fill, sw) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill + '" stroke="' + O + '" stroke-width="' + (sw || 3) + '"/>';
  const path = (d, fill, sw, stroke) => '<path d="' + d + '" fill="' + (fill || 'none') + '" stroke="' + (stroke || O) + '" stroke-width="' + (sw || 3) + '"/>';
  const enemy = (cx, cy, r) => circle(cx, cy, r || 7, '#e8e0d0') + circle(cx - 2.5, cy - 1, 1.6, O, 0) + circle(cx + 2.5, cy - 1, 1.6, O, 0);
  const hero = (cx, cy) => circle(cx, cy, 7, '#46c2ff');

  const ITEMS = {
    bow: path('M20 8 Q48 32 20 56', 'none', 7) + path('M20 8 Q48 32 20 56', 'none', 4, '#b06a2a') + path('M20 8 L20 56', 'none', 2, '#f4f4f4') + arrow(14, 32, 52, 32),
    xbow: path('M10 22 Q32 10 54 22', 'none', 7) + path('M10 22 Q32 10 54 22', 'none', 4, '#9aa6b8') + path('M32 14 L32 54', 'none', 9) + path('M32 14 L32 54', 'none', 6, '#8a5a2b') + path('M12 23 L32 30 L52 23', 'none', 2, '#f4f4f4') + path('M26 48 L38 48', 'none', 5),
    staff: path('M18 56 L40 22', 'none', 8) + path('M18 56 L40 22', 'none', 5, '#8a5a2b') + circle(44, 16, 10, '#a06bff') + circle(41, 13, 3, '#e8d8ff', 0) + path('M33 22 L38 28', 'none', 4, '#ffd23f'),
    axe: path('M22 58 L42 10', 'none', 8) + path('M22 58 L42 10', 'none', 5, '#8a5a2b') + path('M36 16 Q56 12 54 34 Q46 26 32 28 Z', '#c8d2de', 3),
    blades: path('M12 54 L44 14 L50 12 L48 18 L16 58 Z', '#dfe6ee', 3) + path('M52 54 L20 14 L14 12 L16 18 L48 58 Z', '#c8d2de', 3) + path('M18 46 L24 52 M46 46 L40 52', 'none', 5, '#b06a2a'),
    vest: path('M18 14 L26 10 Q32 16 38 10 L46 14 L50 30 L46 32 L46 54 L18 54 L18 32 L14 30 Z', '#a8743c', 3) + path('M32 16 L32 54', 'none', 2.5) + circle(36, 28, 1.8, '#ffd23f', 1) + circle(36, 38, 1.8, '#ffd23f', 1),
    robe: path('M20 12 L32 18 L44 12 L50 56 L14 56 Z', '#6a4bd0', 3) + path('M32 18 L32 56', 'none', 3, '#ffd23f') + path('M20 12 Q32 26 44 12', 'none', 3),
    plate: path('M14 16 Q32 6 50 16 L50 34 Q50 50 32 58 Q14 50 14 34 Z', '#b8c4d4', 3) + path('M32 12 L32 56', 'none', 3) + path('M18 28 L46 28', 'none', 3),
    ruby: circle(32, 38, 14, 'none', 7) + '<circle cx="32" cy="38" r="14" fill="none" stroke="#ffcf3f" stroke-width="4"/>' + path('M24 18 L32 8 L40 18 L32 26 Z', '#ff3b5c', 3),
    eagle: circle(32, 38, 14, 'none', 7) + '<circle cx="32" cy="38" r="14" fill="none" stroke="#d8dee8" stroke-width="4"/>' + path('M18 18 Q26 8 32 18 Q38 8 46 18 Q38 16 32 26 Q26 16 18 18 Z', '#6a4a2a', 2.5),
    serpent: path('M20 44 Q12 30 26 24 Q40 18 44 30 Q48 42 34 46 Q24 48 26 38', 'none', 8) + path('M20 44 Q12 30 26 24 Q40 18 44 30 Q48 42 34 46 Q24 48 26 38', 'none', 5, '#3fc76a') + circle(25, 37, 2, O, 0),
    heart: path('M32 10 L32 18', 'none', 3) + path('M32 54 Q12 40 14 28 Q16 18 26 20 Q30 21 32 26 Q34 21 38 20 Q48 18 50 28 Q52 40 32 54 Z', '#ff4d6d', 3),
    wolf: path('M32 8 L32 14', 'none', 3) + path('M24 18 Q32 12 40 18 L36 56 Q32 60 28 56 Z', '#f4ecd8', 3) + path('M28 30 L36 30 M29 40 L35 40', 'none', 2),
    angel: path('M32 8 L32 14', 'none', 3) + path('M30 30 Q14 14 8 28 Q14 40 30 40 Z M34 30 Q50 14 56 28 Q50 40 34 40 Z', '#ffffff', 3) + circle(32, 36, 7, '#ffe07a') + '<ellipse cx="32" cy="22" rx="8" ry="3" fill="none" stroke="#ffcf3f" stroke-width="3"/>',
  };
  const SLOTS = { weapon: ITEMS.bow, armor: ITEMS.plate, ring: ITEMS.ruby, amulet: ITEMS.heart };

  const SKILLS = {
    front: arrow(24, 56, 24, 10) + arrow(40, 56, 40, 10),
    multi: arrow(14, 52, 14, 12) + arrow(32, 58, 32, 18) + arrow(50, 52, 50, 12),
    diag: arrow(32, 56, 32, 8) + arrow(30, 54, 10, 14) + arrow(34, 54, 54, 14),
    side: hero(32, 32) + arrow(26, 32, 4, 32) + arrow(38, 32, 60, 32),
    rear: hero(32, 22) + arrow(32, 30, 32, 60),
    ricochet: enemy(16, 18) + enemy(50, 22) + path('M8 56 L16 26 L48 30', 'none', 3, '#ffd23f') + arrow(30, 28, 46, 30, '#f4e2b0', 3),
    pierce: enemy(32, 24, 9) + enemy(32, 44, 8) + arrow(32, 62, 32, 4),
    wall: path('M50 6 L50 58', 'none', 9, '#8a7a6a') + arrow(8, 50, 44, 30) + arrow(44, 30, 14, 10),
    atk: path('M14 50 L44 14 L50 12 L48 18 L18 54 Z', '#dfe6ee', 3) + path('M12 44 L22 54', 'none', 6, '#b06a2a') + path('M50 40 L50 58 M42 48 L58 48', 'none', 5, '#3be07a'),
    spd: path('M34 6 L16 36 L30 36 L26 58 L48 26 L34 26 Z', '#ffd23f', 3),
    crit: path('M32 6 L38 24 L58 24 L42 36 L48 56 L32 44 L16 56 L22 36 L6 24 L26 24 Z', '#ff5a3c', 3) + circle(32, 32, 6, '#fff3b0', 2),
    hp: path('M32 56 Q10 40 12 26 Q14 14 26 16 Q30 17 32 22 Q34 17 38 16 Q50 14 52 26 Q54 40 32 56 Z', '#ff4d6d', 3) + path('M32 26 L32 42 M24 34 L40 34', 'none', 5, '#ffffff'),
    fire: path('M32 58 Q14 50 18 34 Q20 26 26 20 Q26 30 32 32 Q30 18 40 8 Q42 22 48 30 Q54 44 44 54 Q40 58 32 58 Z', '#ff7a1a', 3) + path('M32 54 Q24 48 28 40 Q32 44 36 38 Q42 46 36 52 Z', '#ffd23f', 2),
    ice: path('M32 6 L32 58 M10 19 L54 45 M10 45 L54 19', 'none', 9) + path('M32 6 L32 58 M10 19 L54 45 M10 45 L54 19', 'none', 5, '#9be7ff') + path('M26 10 L32 16 L38 10 M26 54 L32 48 L38 54', 'none', 3, '#9be7ff'),
    bolt: enemy(14, 46) + enemy(50, 46) + path('M14 40 L22 24 L28 32 L36 16 L42 28 L50 40', 'none', 7) + path('M14 40 L22 24 L28 32 L36 16 L42 28 L50 40', 'none', 4, '#ffe14d'),
    orbit: hero(32, 32) + '<circle cx="32" cy="32" r="20" fill="none" stroke="#ff9a3c" stroke-width="2.5" stroke-dasharray="4 5"/>' + circle(32, 12, 6, '#ff7a1a') + circle(50, 40, 6, '#ff7a1a') + circle(14, 40, 6, '#ff7a1a'),
    vamp: path('M32 8 Q44 26 44 38 Q44 52 32 52 Q20 52 20 38 Q20 26 32 8 Z', '#d6173a', 3) + path('M27 38 Q27 46 32 46', 'none', 3, '#ff8a9a') + path('M46 50 L54 58 M46 58 L54 50', 'none', 0),
    move: hero(22, 36) + path('M4 30 L12 30 M2 38 L11 38 M5 46 L13 46', 'none', 3, '#d8f4ff') + arrow(28, 30, 60, 14),
    dodge: hero(40, 32) + '<circle cx="28" cy="32" r="7" fill="#46c2ff" opacity=".45"/><circle cx="18" cy="32" r="7" fill="#46c2ff" opacity=".2"/>' + path('M8 14 L28 14 M4 50 L24 50', 'none', 3, '#d8f4ff'),
  };

  window.ArrowIcons = {
    item: b => svg(ITEMS[b] || ITEMS.bow),
    slot: s => svg(SLOTS[s] || ITEMS.bow),
    skill: k => svg(SKILLS[k] || SKILLS.front),
  };
})();
