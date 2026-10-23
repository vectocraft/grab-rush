// Arrow Legends hero outfits: bought with stars, one set per hero. An outfit repaints the hero's texture at
// runtime (cloth / leather / pale cloth & metal / gold trim, shading kept), can make one part glow (emissive
// mask, pulsing) and adds a small signature effect: particles, a floating crown or halo, orbiting motes.
// Loaded by both index.html (before render3d.js/game.js) and node tools (module.exports).
(function (root) {
  'use strict';
  const T = (en, tr) => () => (typeof L === 'function' ? L(en, tr) : en);
  // pal parts: [hue, saturation, mean lightness]; a missing part keeps the original colours.
  // glow: which part also lights up (emissive). cracks: the creases (darkest shading) of the cloth become glowing embers. fx.kind: embers | smoke | leaves | fireflies | sparkle | sparks | orbs | snow | stars.
  // fx.top: 'crown' | 'halo' | 'horns' floats over the head. sw: fallback colours. cost: stars, or ads: rewarded ads to unlock.
  const SKINS = {
    rogue: [
      { id: 'shadow', rar: 'rare', cost: 250, name: T('Shadow', 'Gölge'), sw: ['#2a2238', '#7b4bd6'],
        pal: { cloth: [268, 0.5, 0.32], leather: [255, 0.15, 0.22], light: [265, 0.25, 0.6], trim: [275, 0.8, 0.55] },
        fx: { kind: 'smoke', cols: ['#6a3fd0', '#2a1a40'] } },
      { id: 'ash', rar: 'epic', cost: 500, name: T('Ash', 'Kül'), sw: ['#3a3634', '#ff7a1a'],
        pal: { cloth: [20, 0.07, 0.3], leather: [20, 0.05, 0.2], light: [25, 0.04, 0.62], trim: [24, 1, 0.55] }, glow: 'trim', cracks: [24, 1, 0.55],
        fx: { kind: 'embers', cols: ['#ff6a10', '#ffb43a', '#ffd86a'] } },
      { id: 'royal', rar: 'legendary', cost: 1000, name: T('Golden Viper', 'Altın Engerek'), sw: ['#f6f0e0', '#e6a812'],
        pal: { cloth: [44, 0.85, 0.55], leather: [28, 0.55, 0.22], light: [45, 0.1, 0.9], trim: [48, 1, 0.6] }, glow: 'trim',
        fx: { kind: 'sparkle', cols: ['#ffd23f', '#fff3c0'], top: 'crown' } },
      { id: 'blood', rar: 'mythic', cost: 1500, name: T('Blood Moon', 'Kanlı Ay'), sw: ['#1a0a0e', '#ff2a3a'],
        pal: { cloth: [354, 0.85, 0.3], leather: [350, 0.2, 0.14], light: [0, 0.6, 0.5], trim: [356, 1, 0.5] }, glow: 'trim', cracks: [356, 1, 0.5],
        fx: { kind: 'embers', cols: ['#ff2a3a', '#ff7a5a', '#ffd0c0'], top: 'horns' } },
      { id: 'frostbite', rar: 'epic', ads: 8, name: T('Frostbite', 'Ayaz'), sw: ['#dff4ff', '#3aa0ff'],
        pal: { cloth: [205, 0.7, 0.5], leather: [210, 0.25, 0.3], light: [195, 0.35, 0.86], trim: [190, 0.9, 0.65] }, glow: 'trim',
        fx: { kind: 'snow', cols: ['#ffffff', '#bfeaff'] } },
    ],
    ranger: [
      { id: 'autumn', rar: 'rare', cost: 250, name: T('Autumn', 'Sonbahar'), sw: ['#c4561c', '#f2b13a'],
        pal: { cloth: [22, 0.8, 0.45], leather: [28, 0.5, 0.35], light: [38, 0.5, 0.7] },
        fx: { kind: 'leaves', cols: ['#e8641c', '#f2b13a', '#b8341c'] } },
      { id: 'night', rar: 'epic', cost: 500, name: T('Night Hunter', 'Gece Avcısı'), sw: ['#1a2236', '#38e0ff'],
        pal: { cloth: [222, 0.45, 0.25], leather: [225, 0.2, 0.18], light: [190, 0.8, 0.55], trim: [188, 1, 0.55] }, glow: 'light',
        fx: { kind: 'fireflies', cols: ['#5ff0ff', '#b8ffef'] } },
      { id: 'sun', rar: 'legendary', cost: 1000, name: T('Sun Warden', 'Güneş Muhafızı'), sw: ['#fff6e0', '#ffb21a'],
        pal: { cloth: [45, 0.3, 0.85], leather: [38, 0.75, 0.45], light: [48, 0.9, 0.6], trim: [42, 1, 0.6] }, glow: 'trim',
        fx: { kind: 'sparkle', cols: ['#ffcf3a', '#ffffff'], top: 'halo' } },
      { id: 'jade', rar: 'mythic', cost: 1500, name: T('Jade Emperor', 'Yeşim İmparator'), sw: ['#0f5a3a', '#ffd23f'],
        pal: { cloth: [46, 1, 0.55], leather: [152, 0.6, 0.26], light: [140, 0.45, 0.72], trim: [46, 1, 0.6] }, glow: 'trim',
        fx: { kind: 'leaves', cols: ['#3fe08a', '#ffd23f', '#9dffc2'], top: 'crown' } },
      { id: 'storm', rar: 'epic', ads: 8, name: T('Storm Rider', 'Fırtına Süvarisi'), sw: ['#9aa3ad', '#fff27a'],
        pal: { cloth: [210, 0.08, 0.6], leather: [220, 0.1, 0.3], light: [55, 1, 0.6], trim: [55, 1, 0.6] }, glow: 'light',
        fx: { kind: 'sparks', cols: ['#fff27a', '#ffffff', '#9fe6ff'] } },
    ],
    mage: [
      { id: 'crimson', rar: 'rare', cost: 250, name: T('Crimson', 'Kızıl'), sw: ['#9a1420', '#ffcf5a'],
        pal: { cloth: [356, 0.75, 0.38], light: [20, 0.12, 0.3], trim: [42, 0.95, 0.55] },
        fx: { kind: 'sparks', cols: ['#ff4a1a', '#ffb43a'] } },
      { id: 'void', rar: 'epic', cost: 500, name: T('Void', 'Boşluk'), sw: ['#24123a', '#c45cff'],
        pal: { cloth: [275, 0.6, 0.3], leather: [270, 0.25, 0.18], light: [280, 0.15, 0.22], trim: [290, 1, 0.6] }, glow: 'trim',
        fx: { kind: 'orbs', cols: ['#c45cff', '#ff8af0'], top: 'horns' } },
      { id: 'arch', rar: 'legendary', cost: 1000, name: T('Archmage', 'Başbüyücü'), sw: ['#ffffff', '#3fa0ff'],
        pal: { cloth: [40, 0.08, 0.9], trim: [46, 1, 0.6] }, glow: 'trim',
        fx: { kind: 'stars', cols: ['#7fd0ff', '#ffe27a', '#ffffff'], top: 'halo' } },
      { id: 'necro', rar: 'mythic', cost: 1500, name: T('Necromancer', 'Ölü Çağıran'), sw: ['#14181a', '#4dff8a'],
        pal: { cloth: [150, 0.25, 0.16], leather: [150, 0.15, 0.12], light: [140, 0.7, 0.55], trim: [135, 1, 0.55] }, glow: 'light',
        fx: { kind: 'smoke', cols: ['#3aff7a', '#0a3a1a'], top: 'horns' } },
      { id: 'candy', rar: 'epic', ads: 8, name: T('Candy Wizard', 'Şeker Büyücü'), sw: ['#ff8ad0', '#7affef'],
        pal: { cloth: [325, 0.75, 0.68], leather: [175, 0.5, 0.45], light: [180, 0.6, 0.85], trim: [55, 1, 0.65] },
        fx: { kind: 'sparkle', cols: ['#ff8ad0', '#7affef', '#fff27a'] } },
    ],
    // Frost Cleric outfits repaint the original Cleric texture (brown robe = leather, white hood/sleeves = light).
    frost: [
      { id: 'aurora', rar: 'rare', cost: 250, name: T('Aurora', 'Kutup Işığı'), sw: ['#1aa88a', '#ff7ad8'],
        pal: { leather: [170, 0.55, 0.32], light: [300, 0.5, 0.82], trim: [300, 0.7, 0.75] },
        fx: { kind: 'snow', cols: ['#7affd8', '#ff9ae6'] } },
      { id: 'ember', rar: 'epic', cost: 500, name: T('Ember Cleric', 'Kor Rahibi'), sw: ['#3a1410', '#ff7a1a'],
        pal: { leather: [6, 0.7, 0.27], light: [28, 1, 0.58], trim: [32, 1, 0.58] }, glow: 'light',
        fx: { kind: 'embers', cols: ['#ff6a10', '#ffb43a', '#ffd86a'] } },
      { id: 'celest', rar: 'legendary', cost: 1000, name: T('Celestial', 'Göksel'), sw: ['#2a2a7a', '#ffe27a'],
        pal: { leather: [240, 0.55, 0.28], light: [46, 0.75, 0.72], trim: [48, 1, 0.62] }, glow: 'light',
        fx: { kind: 'stars', cols: ['#ffe27a', '#b8b0ff', '#ffffff'], top: 'crown' } },
      { id: 'abyss', rar: 'mythic', cost: 1500, name: T('Abyss Oracle', 'Uçurum Kâhini'), sw: ['#06222a', '#3affef'],
        pal: { cloth: [188, 0.7, 0.2], leather: [195, 0.4, 0.14], light: [178, 0.9, 0.55], trim: [176, 1, 0.6] }, glow: 'light',
        fx: { kind: 'orbs', cols: ['#3affef', '#7a8aff'], top: 'halo' } },
      { id: 'sakura', rar: 'epic', ads: 8, name: T('Sakura', 'Sakura'), sw: ['#ffd6ea', '#ff5aa8'],
        pal: { cloth: [335, 0.6, 0.75], leather: [340, 0.35, 0.45], light: [345, 0.35, 0.9], trim: [330, 0.9, 0.62] },
        fx: { kind: 'leaves', cols: ['#ff9ac8', '#ffd6ea', '#ffffff'] } },
    ],
  };

  const hsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; return [h, s, l];
  };
  const rgb = (h, s, l) => {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  };
  // Which part of the outfit a texel belongs to. Skin tones (face, hands) and near-black stay untouched.
  function part(h, s, l) {
    if (l < 0.07) return null;
    if (h >= 8 && h <= 38 && s > 0.28 && l > 0.52 && l < 0.86) return null;                // skin
    if (h >= 38 && h <= 62 && s > 0.4 && l > 0.3) return 'trim';                             // gold / yellow trim
    if (s < 0.2) return l > 0.4 ? 'light' : 'leather';                                       // white & grey cloth, metal / dark grey
    if (h >= 12 && h <= 48 && s < 0.6 && l < 0.55) return 'leather';                         // browns
    return 'cloth';
  }
  // Repaints RGBA pixels in place; returns an emissive mask (same size, RGBA) when the outfit glows, else null.
  function recolor(data, sk) {
    const pal = sk.pal, mask = sk.glow ? new Uint8ClampedArray(data.length) : null, n = data.length / 4;
    // Pass 1: classify texels and measure each part's mean lightness, so a part can be moved to the outfit's own
    // brightness (a dark leather rogue can still wear white) while its shading (l - mean) is kept.
    const cls = new Uint8Array(n), L = new Float32Array(n), S = new Float32Array(n), sum = {}, cnt = {}, ids = ['', 'cloth', 'leather', 'light', 'trim'];
    for (let j = 0; j < n; j++) {
      const i = j * 4, [h, s, l] = hsl(data[i], data[i + 1], data[i + 2]), p = part(h, s, l);
      if (!p || !pal[p]) continue;
      cls[j] = ids.indexOf(p); L[j] = l; S[j] = s; sum[p] = (sum[p] || 0) + l; cnt[p] = (cnt[p] || 0) + 1;
    }
    for (let j = 0; j < n; j++) {
      if (!cls[j]) continue;
      const p = ids[cls[j]], q = pal[p], i = j * 4, mean = sum[p] / cnt[p];
      const nl = Math.max(0.04, Math.min(0.94, q[2] + (L[j] - mean) * 1.1)), ns = Math.min(1, q[1] * (0.8 + 0.4 * Math.min(1, S[j])));
      const ck = sk.cracks && p !== 'light' && L[j] < mean * 0.62;
      const o = ck ? rgb(sk.cracks[0], sk.cracks[1], sk.cracks[2] + (mean * 0.62 - L[j])) : rgb(q[0], ns, nl); data[i] = o[0]; data[i + 1] = o[1]; data[i + 2] = o[2];
      if (mask && (p === sk.glow || ck)) { mask[i] = o[0]; mask[i + 1] = o[1]; mask[i + 2] = o[2]; }
    }
    if (mask) for (let i = 3; i < mask.length; i += 4) mask[i] = 255;
    return mask;
  }
  const find = (hero, id) => (SKINS[hero] || []).find(s => s.id === id) || null;
  const api = { SKINS, recolor, find };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ArrowSkins = api;
})(this);
