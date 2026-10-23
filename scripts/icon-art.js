// Game icon artwork as SVG layers (1024x1024): a yelling blue blob hero and its minion crowd
// charging a scared red blob. Used by make-icons.js.
'use strict';

const OUT_B = '#0b2a6b';   // blue outline
const OUT_R = '#5c0a10';   // red outline

function defs() {
  return `
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="45%" r="75%">
      <stop offset="0" stop-color="#fff59a"/><stop offset="0.45" stop-color="#ffc83d"/><stop offset="1" stop-color="#ff6a13"/>
    </radialGradient>
    <radialGradient id="blue" cx="35%" cy="30%" r="80%">
      <stop offset="0" stop-color="#8fd3ff"/><stop offset="0.55" stop-color="#2f86ff"/><stop offset="1" stop-color="#1846c9"/>
    </radialGradient>
    <radialGradient id="red" cx="35%" cy="30%" r="80%">
      <stop offset="0" stop-color="#ffa3a3"/><stop offset="0.55" stop-color="#ff3b4a"/><stop offset="1" stop-color="#b3121f"/>
    </radialGradient>
    <radialGradient id="boom" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#fff36b"/><stop offset="1" stop-color="#ffb000"/>
    </radialGradient>
  </defs>`;
}

// Sunburst background.
function background() {
  let rays = '';
  const n = 18;
  for (let i = 0; i < n; i += 2) {
    const a1 = (i / n) * Math.PI * 2, a2 = ((i + 1) / n) * Math.PI * 2, R = 1100;
    const p = a => `${512 + Math.cos(a) * R},${470 + Math.sin(a) * R}`;
    rays += `<polygon points="512,470 ${p(a1)} ${p(a2)}" fill="#ffffff" opacity="0.16"/>`;
  }
  return `<rect width="1024" height="1024" fill="url(#bgGrad)"/>${rays}`;
}

function minion(x, y, r, look) {
  const ex = r * 0.28, ey = -r * 0.1, er = r * 0.2;
  return `
  <g>
    <ellipse cx="${x}" cy="${y + r * 0.95}" rx="${r * 0.8}" ry="${r * 0.16}" fill="#000" opacity="0.15"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="url(#blue)" stroke="${OUT_B}" stroke-width="${r * 0.16}"/>
    <ellipse cx="${x - r * 0.35}" cy="${y - r * 0.45}" rx="${r * 0.32}" ry="${r * 0.2}" fill="#fff" opacity="0.45"/>
    <circle cx="${x + ex * 0.2 + look}" cy="${y + ey}" r="${er}" fill="#fff" stroke="${OUT_B}" stroke-width="${r * 0.06}"/>
    <circle cx="${x + ex * 1.9 + look}" cy="${y + ey}" r="${er}" fill="#fff" stroke="${OUT_B}" stroke-width="${r * 0.06}"/>
    <circle cx="${x + ex * 0.2 + look + er * 0.35}" cy="${y + ey + er * 0.1}" r="${er * 0.5}" fill="#111"/>
    <circle cx="${x + ex * 1.9 + look + er * 0.35}" cy="${y + ey + er * 0.1}" r="${er * 0.5}" fill="#111"/>
    <path d="M${x - r * 0.05 + look} ${y - r * 0.42} L${x + r * 0.3 + look} ${y - r * 0.28} M${x + r * 0.5 + look} ${y - r * 0.3} L${x + r * 0.82 + look} ${y - r * 0.44}" stroke="${OUT_B}" stroke-width="${r * 0.13}" stroke-linecap="round"/>
    <path d="M${x + ex * 0.4} ${y + r * 0.35} Q${x + ex * 1.2} ${y + r * 0.62} ${x + ex * 2.1} ${y + r * 0.3}" fill="none" stroke="${OUT_B}" stroke-width="${r * 0.1}" stroke-linecap="round"/>
  </g>`;
}

function hero() {
  const x = 420, y = 610, r = 235;
  return `
  <g>
    <ellipse cx="${x}" cy="${y + 225}" rx="200" ry="34" fill="#000" opacity="0.18"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="url(#blue)" stroke="${OUT_B}" stroke-width="22"/>
    <ellipse cx="330" cy="500" rx="95" ry="52" fill="#fff" opacity="0.4" transform="rotate(-28 330 500)"/>
    <!-- eyes -->
    <ellipse cx="455" cy="565" rx="52" ry="62" fill="#fff" stroke="${OUT_B}" stroke-width="12"/>
    <ellipse cx="585" cy="555" rx="48" ry="58" fill="#fff" stroke="${OUT_B}" stroke-width="12"/>
    <circle cx="480" cy="572" r="27" fill="#111"/><circle cx="607" cy="562" r="25" fill="#111"/>
    <circle cx="490" cy="561" r="9" fill="#fff"/><circle cx="616" cy="552" r="8" fill="#fff"/>
    <!-- angry brows -->
    <path d="M392 478 L515 525" stroke="${OUT_B}" stroke-width="30" stroke-linecap="round"/>
    <path d="M548 510 L650 462" stroke="${OUT_B}" stroke-width="30" stroke-linecap="round"/>
    <!-- yelling mouth -->
    <path d="M458 660 Q540 780 648 648 Q560 690 458 660 Z" fill="#6b0f1a" stroke="${OUT_B}" stroke-width="14" stroke-linejoin="round"/>
    <path d="M520 712 Q560 735 598 704 Q565 700 520 712 Z" fill="#ff6b81"/>
    <path d="M478 668 L500 690 L522 675 L548 693 L572 676 L600 690 L628 662" fill="#fff" stroke="none" opacity="0.95"/>
  </g>`;
}

function enemy() {
  const x = 772, y = 318, r = 152;
  return `
  <g>
    <circle cx="${x}" cy="${y}" r="${r}" fill="url(#red)" stroke="${OUT_R}" stroke-width="18"/>
    <ellipse cx="720" cy="250" rx="55" ry="32" fill="#fff" opacity="0.4" transform="rotate(-28 720 250)"/>
    <!-- scared eyes looking at the hero -->
    <circle cx="722" cy="312" r="40" fill="#fff" stroke="${OUT_R}" stroke-width="10"/>
    <circle cx="818" cy="304" r="37" fill="#fff" stroke="${OUT_R}" stroke-width="10"/>
    <circle cx="708" cy="326" r="13" fill="#111"/><circle cx="804" cy="318" r="12" fill="#111"/>
    <!-- worried brows -->
    <path d="M690 262 Q715 245 748 262" fill="none" stroke="${OUT_R}" stroke-width="14" stroke-linecap="round"/>
    <path d="M792 252 Q825 236 850 256" fill="none" stroke="${OUT_R}" stroke-width="14" stroke-linecap="round"/>
    <!-- shaky mouth -->
    <path d="M722 392 q12 -14 24 0 q12 14 24 0 q12 -14 24 0 q12 14 24 0" fill="none" stroke="${OUT_R}" stroke-width="12" stroke-linecap="round"/>
    <!-- sweat drop -->
    <path d="M905 205 q22 38 0 56 q-22 -18 0 -56 Z" fill="#9be7ff" stroke="#1d6fa3" stroke-width="7"/>
  </g>`;
}

function boom(cx, cy, R, r, n) {
  let pts = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 ? r : R * (0.85 + ((i * 37) % 10) / 50);
    pts += `${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)} `;
  }
  return `<polygon points="${pts}" fill="url(#boom)" stroke="#ff8a00" stroke-width="10" stroke-linejoin="round"/>`;
}

// Characters + effects (no background).
function characters() {
  return `
    <g stroke="#fff" stroke-width="18" stroke-linecap="round" opacity="0.75">
      <path d="M60 560 L160 520"/><path d="M40 650 L150 610"/><path d="M90 760 L175 725"/>
    </g>
    <g fill="#fff" opacity="0.9">
      <circle cx="600" cy="380" r="10"/><circle cx="700" cy="470" r="8"/><circle cx="690" cy="360" r="7"/>
    </g>
    ${enemy()}
    ${boom(640, 450, 92, 48, 9)}
    ${minion(150, 700, 62, 8)}
    ${minion(210, 880, 58, 10)}
    ${minion(115, 470, 46, 8)}
    ${minion(250, 330, 42, 8)}
    ${hero()}
    ${minion(700, 820, 60, 6)}
    ${minion(835, 650, 50, 4)}`;
}

const wrap = (body, size = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${defs()}${body}</svg>`;

// Wide sunburst for 1440x680 banners.
function wideRays(c1, c2, c3, cx, cy) {
  let rays = '';
  const n = 22;
  for (let i = 0; i < n; i += 2) {
    const a1 = (i / n) * Math.PI * 2, a2 = ((i + 1) / n) * Math.PI * 2, R = 1600;
    const p = a => `${cx + Math.cos(a) * R},${cy + Math.sin(a) * R}`;
    rays += `<polygon points="${cx},${cy} ${p(a1)} ${p(a2)}" fill="#fff" opacity="0.16"/>`;
  }
  return `<defs><radialGradient id="wbg" cx="${cx / 14.4}%" cy="${cy / 6.8}%" r="80%"><stop offset="0" stop-color="${c1}"/><stop offset="0.45" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></radialGradient></defs>
    <rect width="1440" height="680" fill="url(#wbg)"/>${rays}`;
}
const banner = body => `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="680" viewBox="0 0 1440 680">${defs()}${body}</svg>`;

// Koloni Kapışması card: the icon scene on a wide sunburst.
function koloniBanner() {
  return banner(wideRays('#fff59a', '#ffc83d', '#ff6a13', 720, 330) +
    `<g transform="translate(720,360) scale(0.72) translate(-512,-560)">${characters()}</g>`);
}

// Cartoon castle with a face (Sürü Seli).
function castle(x, y) {
  const ink = '#4a000c';
  const block = (bx, by, bw, bh) => {
    let cren = '';
    const n = Math.max(2, Math.round(bw / 34)), cw = bw / (n * 2 - 1);
    for (let i = 0; i < n; i++) cren += `<rect x="${bx + i * cw * 2}" y="${by - 22}" width="${cw}" height="22" fill="url(#red)" stroke="${ink}" stroke-width="8"/>`;
    return cren + `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="url(#red)" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/>`;
  };
  return `<g>
    <ellipse cx="${x + 190}" cy="${y + 330}" rx="260" ry="30" fill="#000" opacity="0.2"/>
    ${block(x - 30, y - 10, 110, 340)}${block(x + 300, y - 10, 110, 340)}${block(x + 60, y + 60, 260, 270)}
    <path d="M${x + 150} ${y + 330} L${x + 150} ${y + 265} A40 40 0 0 1 ${x + 230} ${y + 265} L${x + 230} ${y + 330} Z" fill="#2b0a10" stroke="${ink}" stroke-width="10"/>
    <circle cx="${x + 145}" cy="${y + 160}" r="36" fill="#fff" stroke="${ink}" stroke-width="9"/><circle cx="${x + 235}" cy="${y + 160}" r="36" fill="#fff" stroke="${ink}" stroke-width="9"/>
    <circle cx="${x + 132}" cy="${y + 172}" r="14" fill="#111"/><circle cx="${x + 222}" cy="${y + 172}" r="14" fill="#111"/>
    <path d="M${x + 110} ${y + 110} Q${x + 145} ${y + 92} ${x + 178} ${y + 112}" fill="none" stroke="${ink}" stroke-width="12" stroke-linecap="round"/>
    <path d="M${x + 202} ${y + 112} Q${x + 235} ${y + 92} ${x + 270} ${y + 110}" fill="none" stroke="${ink}" stroke-width="12" stroke-linecap="round"/>
    <path d="M${x + 150} ${y + 230} q15 -16 30 0 q15 16 30 0 q15 -16 30 0" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/>
    <path d="M${x + 325} ${y - 60} q22 38 0 56 q-22 -18 0 -56 Z" fill="#9be7ff" stroke="#1d6fa3" stroke-width="7"/>
  </g>`;
}

// Sürü Seli card: a crowd flooding through an x2 gate into a scared castle.
function suruBanner() {
  let crowd = '';
  const pts = [[250, 560, 44], [330, 500, 40], [410, 470, 42], [360, 590, 46], [470, 420, 38], [540, 390, 40], [610, 350, 36], [520, 520, 44],
    [600, 460, 40], [680, 400, 38], [440, 600, 42], [700, 300, 34], [760, 350, 36], [780, 260, 32], [650, 540, 40]];
  for (const [x, y, r] of pts) crowd += minion(x, y, r, 6);
  return banner(wideRays('#e9ffb0', '#6fdc6f', '#138a4a', 700, 300) + `
    <g opacity="0.9">
      <rect x="520" y="80" width="36" height="300" rx="14" fill="#1f7a3f" stroke="#0b3d1f" stroke-width="8"/>
      <rect x="880" y="80" width="36" height="300" rx="14" fill="#1f7a3f" stroke="#0b3d1f" stroke-width="8"/>
      <rect x="548" y="150" width="340" height="110" rx="22" fill="#3be07a" opacity="0.55" stroke="#9dffc2" stroke-width="6"/>
      <text x="718" y="235" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="84" text-anchor="middle" fill="none" stroke="#0b3d1f" stroke-width="18" stroke-linejoin="round">+5</text>
      <text x="718" y="235" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="84" text-anchor="middle" fill="#fff">+5</text>
    </g>
    ${castle(1000, 190)}
    ${crowd}
    <g stroke="#ffe066" stroke-width="10" stroke-linecap="round" opacity="0.95">
      <path d="M560 330 L700 250"/><path d="M640 300 L790 215"/><path d="M720 280 L860 205"/><path d="M480 420 L610 350"/>
    </g>`);
}

// Altın Ocağı card: a cheerful miner on a gold pile with a cart.
function madenBanner() {
  let nuggets = '';
  const pile = [[860, 560, 60], [960, 540, 70], [1060, 565, 58], [910, 480, 52], [1010, 470, 56], [960, 410, 46], [1140, 590, 44], [790, 600, 40]];
  for (const [x, y, r] of pile) nuggets += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}" fill="#ffd23f" stroke="#8a5200" stroke-width="9"/><ellipse cx="${x - r * 0.3}" cy="${y - r * 0.3}" rx="${r * 0.28}" ry="${r * 0.18}" fill="#fff6c4"/>`;
  let sparkles = '';
  for (const [x, y, s] of [[830, 380, 1], [1110, 420, 0.8], [990, 330, 0.7], [1200, 500, 0.9]]) sparkles += `<path d="M${x} ${y - 30 * s} L${x + 8 * s} ${y - 8 * s} L${x + 30 * s} ${y} L${x + 8 * s} ${y + 8 * s} L${x} ${y + 30 * s} L${x - 8 * s} ${y + 8 * s} L${x - 30 * s} ${y} L${x - 8 * s} ${y - 8 * s} Z" fill="#fff"/>`;
  return banner(wideRays('#fff1b0', '#ffb73d', '#9a4a12', 720, 300) + `
    <rect y="600" width="1440" height="80" fill="#7a5230"/>
    <g transform="translate(180 470)">
      <rect x="0" y="40" width="260" height="120" rx="16" fill="#8a8f9f" stroke="#2e3354" stroke-width="10"/>
      <ellipse cx="80" cy="45" rx="50" ry="30" fill="#ffd23f" stroke="#8a5200" stroke-width="8"/><ellipse cx="170" cy="40" rx="55" ry="34" fill="#ffd23f" stroke="#8a5200" stroke-width="8"/>
      <circle cx="55" cy="170" r="30" fill="#3a2a1a" stroke="#161a33" stroke-width="8"/><circle cx="205" cy="170" r="30" fill="#3a2a1a" stroke="#161a33" stroke-width="8"/>
    </g>
    ${nuggets}${sparkles}
    <g>
      <ellipse cx="560" cy="615" rx="130" ry="20" fill="#000" opacity="0.25"/>
      <circle cx="560" cy="430" r="170" fill="url(#minerG)" stroke="#6b3a00" stroke-width="16"/>
      <path d="M390 400 A170 170 0 0 1 730 400 L740 360 A185 185 0 0 0 380 360 Z" fill="#ffd23f" stroke="#6b3a00" stroke-width="14"/>
      <rect x="400" y="350" width="320" height="40" rx="16" fill="#ffd23f" stroke="#6b3a00" stroke-width="12"/>
      <circle cx="560" cy="330" r="30" fill="#fff8b0" stroke="#6b3a00" stroke-width="10"/>
      <ellipse cx="505" cy="470" rx="36" ry="42" fill="#fff" stroke="#6b3a00" stroke-width="10"/><ellipse cx="615" cy="470" rx="36" ry="42" fill="#fff" stroke="#6b3a00" stroke-width="10"/>
      <circle cx="515" cy="478" r="17" fill="#111"/><circle cx="625" cy="478" r="17" fill="#111"/>
      <path d="M500 540 Q560 600 630 540" fill="#6b0f1a" stroke="#6b3a00" stroke-width="12" stroke-linejoin="round"/>
      <g transform="rotate(-35 760 420)">
        <rect x="750" y="300" width="22" height="260" rx="10" fill="#8a5a2b" stroke="#3a1e0a" stroke-width="8"/>
        <path d="M660 320 Q760 250 870 320 L860 340 Q760 290 670 340 Z" fill="#c9d1e0" stroke="#2e3354" stroke-width="10"/>
      </g>
    </g>
    <defs><radialGradient id="minerG" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#ffd08a"/><stop offset="1" stop-color="#ff8a1f"/></radialGradient></defs>`);
}

// Çağlar Savaşı card: a caveman and a robot clash across the ages.
function cagBanner() {
  return banner(`
    <defs>
      <linearGradient id="agL" x1="0" x2="1"><stop offset="0" stop-color="#8fe36b"/><stop offset="1" stop-color="#ffd35a"/></linearGradient>
      <linearGradient id="agR" x1="0" x2="1"><stop offset="0" stop-color="#6d5dfc"/><stop offset="1" stop-color="#1b1464"/></linearGradient>
    </defs>
    <polygon points="0,0 800,0 640,680 0,680" fill="url(#agL)"/>
    <polygon points="800,0 1440,0 1440,680 640,680" fill="url(#agR)"/>
    ${wideRays('#fff', '#fff', '#fff', 720, 340).replace(/<defs>[\s\S]*?<\/defs>\s*<rect[^>]*\/>/, '')}
    <g>
      <ellipse cx="400" cy="620" rx="150" ry="24" fill="#000" opacity="0.25"/>
      <circle cx="400" cy="440" r="160" fill="url(#blue)" stroke="${OUT_B}" stroke-width="16"/>
      <path d="M250 380 Q400 250 550 380 Q520 330 400 320 Q280 330 250 380 Z" fill="#8a5a2b" stroke="#3a1e0a" stroke-width="10"/>
      <ellipse cx="370" cy="450" rx="34" ry="40" fill="#fff" stroke="${OUT_B}" stroke-width="9"/><ellipse cx="470" cy="450" rx="34" ry="40" fill="#fff" stroke="${OUT_B}" stroke-width="9"/>
      <circle cx="385" cy="458" r="16" fill="#111"/><circle cx="485" cy="458" r="16" fill="#111"/>
      <path d="M330 405 L405 430 M445 428 L515 400" stroke="${OUT_B}" stroke-width="18" stroke-linecap="round"/>
      <path d="M380 530 Q430 580 490 525" fill="#6b0f1a" stroke="${OUT_B}" stroke-width="10"/>
      <g transform="rotate(35 560 350)"><rect x="545" y="200" width="36" height="220" rx="18" fill="#a0673a" stroke="#3a1e0a" stroke-width="9"/><ellipse cx="563" cy="215" rx="40" ry="46" fill="#b87a44" stroke="#3a1e0a" stroke-width="9"/></g>
    </g>
    <g>
      <ellipse cx="1050" cy="620" rx="150" ry="24" fill="#000" opacity="0.3"/>
      <rect x="900" y="290" width="300" height="300" rx="60" fill="url(#red)" stroke="#4a000c" stroke-width="16"/>
      <rect x="930" y="380" width="240" height="80" rx="30" fill="#1b1464" stroke="#4a000c" stroke-width="10"/>
      <rect x="960" y="400" width="70" height="36" rx="14" fill="#7df9ff"/><rect x="1070" y="400" width="70" height="36" rx="14" fill="#7df9ff"/>
      <rect x="1030" y="230" width="40" height="70" rx="12" fill="#9aa3c8" stroke="#4a000c" stroke-width="9"/><circle cx="1050" cy="220" r="22" fill="#7df9ff" stroke="#4a000c" stroke-width="9"/>
      <path d="M990 520 q15 -14 30 0 q15 14 30 0 q15 -14 30 0 q15 14 30 0" fill="none" stroke="#4a000c" stroke-width="10" stroke-linecap="round"/>
      <rect x="770" y="410" width="140" height="44" rx="16" fill="#9aa3c8" stroke="#4a000c" stroke-width="9"/><rect x="740" y="418" width="40" height="28" rx="8" fill="#7df9ff"/>
    </g>
    ${boom(700, 330, 110, 55, 10)}
    <text x="700" y="360" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="88" text-anchor="middle" fill="none" stroke="#1b1464" stroke-width="18" stroke-linejoin="round">VS</text>
    <text x="700" y="360" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="88" text-anchor="middle" fill="#fff">VS</text>`);
}

module.exports = {
  koloniBanner, suruBanner, madenBanner, cagBanner,
  full: () => wrap(background() + characters()),
  background: () => wrap(background()),
  // Adaptive-icon foreground: launchers show only the central ~66%, so shrink the art toward the center.
  foreground: () => wrap(`<g transform="translate(512,512) scale(0.64) translate(-512,-540)">${characters()}</g>`),
  characters, background: () => wrap(background()), wrap, defs,
};
