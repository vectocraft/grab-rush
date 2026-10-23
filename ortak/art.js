// Shop artwork as inline SVG (crisp at any size, no image files): chests, star piles, crown, gift.
// Each function returns an <svg> string; ids are suffixed so several copies can live on one page.
(function () {
  'use strict';
  let uid = 0;
  const star = (cx, cy, r, fill, stroke, rot) => {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5 + (rot || 0), rr = i % 2 ? r * 0.48 : r;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1);
    }
    return '<path d="' + d + 'Z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (r * 0.12).toFixed(1) + '" stroke-linejoin="round"/>';
  };
  // A glossy gold star with a highlight.
  const gstar = (id, cx, cy, r, rot) => star(cx, cy, r, 'url(#sg' + id + ')', '#a85a00', rot) + star(cx - r * 0.08, cy - r * 0.12, r * 0.55, 'rgba(255,255,255,.45)', 'none', rot);
  const defs = id =>
    '<defs><linearGradient id="sg' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6b0"/><stop offset=".45" stop-color="#ffd23f"/><stop offset="1" stop-color="#f08a00"/></linearGradient>' +
    '<radialGradient id="glow' + id + '"><stop offset="0" stop-color="#fff3b0" stop-opacity=".9"/><stop offset="1" stop-color="#ffb020" stop-opacity="0"/></radialGradient></defs>';

  const Art = {
    // tier 1..4: from a single star to a heap.
    stars(tier) {
      const id = ++uid;
      const piles = [
        [[50, 52, 26, 0]],
        [[34, 60, 18, -0.2], [66, 60, 18, 0.2], [50, 40, 22, 0]],
        [[26, 66, 15, -0.3], [50, 70, 15, 0], [74, 66, 15, 0.3], [38, 48, 17, -0.1], [62, 48, 17, 0.1], [50, 28, 19, 0]],
        [[18, 72, 13, -0.3], [38, 76, 13, 0.1], [62, 76, 13, -0.1], [82, 72, 13, 0.3], [28, 56, 15, 0.2], [50, 58, 15, 0], [72, 56, 15, -0.2], [38, 38, 16, -0.1], [62, 38, 16, 0.1], [50, 20, 18, 0]],
      ][Math.max(0, Math.min(3, tier - 1))];
      return '<svg viewBox="0 0 100 100" class="art">' + defs(id) + '<circle cx="50" cy="52" r="48" fill="url(#glow' + id + ')"/>' +
        piles.map(p => gstar(id, p[0], p[1], p[2], p[3])).join('') + '</svg>';
    },
    // kind: 'gold' | 'royal'. A 3D-rendered chest (ortak/img/chest-*.webp, 7 frames lid shut → open, made by
    // scripts/make-chests.js); CSS in ui.css shows a frame, bobs it in shops and plays the lid opening on reveal.
    chest(kind, open) {
      return '<span class="art" data-c3d="' + (kind === 'royal' ? 'royal' : 'gold') + '"' + (open ? ' data-o="1"' : '') + '></span>';
    },
    crown() {
      const id = ++uid;
      return '<svg viewBox="0 0 100 100" class="art">' + defs(id) + '<circle cx="50" cy="52" r="48" fill="url(#glow' + id + ')"/>' +
        '<path d="M14 70 L10 30 L32 48 L50 18 L68 48 L90 30 L86 70 Z" fill="url(#sg' + id + ')" stroke="#a85a00" stroke-width="4" stroke-linejoin="round"/>' +
        '<rect x="14" y="68" width="72" height="14" rx="5" fill="url(#sg' + id + ')" stroke="#a85a00" stroke-width="4"/>' +
        '<circle cx="50" cy="56" r="7" fill="#ff4d6d" stroke="#8a0f2a" stroke-width="2"/><circle cx="30" cy="62" r="5" fill="#4dd2ff" stroke="#0d5a8a" stroke-width="2"/><circle cx="70" cy="62" r="5" fill="#4dff88" stroke="#0d7a3a" stroke-width="2"/>' +
        '<circle cx="10" cy="30" r="5" fill="#fff3b0"/><circle cx="50" cy="18" r="5" fill="#fff3b0"/><circle cx="90" cy="30" r="5" fill="#fff3b0"/></svg>';
    },
    noAds() {
      return '<svg viewBox="0 0 100 100" class="art"><circle cx="50" cy="50" r="40" fill="#fff" stroke="#e11d48" stroke-width="9"/>' +
        '<text x="50" y="62" text-anchor="middle" font-family="Baloo,Arial" font-weight="800" font-size="34" fill="#1e1b4b">AD</text>' +
        '<path d="M22 78 L78 22" stroke="#e11d48" stroke-width="9" stroke-linecap="round"/></svg>';
    },
    gift() {
      const id = ++uid;
      return '<svg viewBox="0 0 100 100" class="art">' + defs(id) + '<circle cx="50" cy="54" r="46" fill="url(#glow' + id + ')"/>' +
        '<rect x="18" y="44" width="64" height="42" rx="6" fill="#ff5c7a" stroke="#8a1030" stroke-width="3"/><rect x="14" y="34" width="72" height="16" rx="5" fill="#ff7b93" stroke="#8a1030" stroke-width="3"/>' +
        '<rect x="44" y="34" width="12" height="52" fill="url(#sg' + id + ')"/><path d="M50 34 C30 10 18 30 50 34 C82 30 70 10 50 34Z" fill="url(#sg' + id + ')" stroke="#a85a00" stroke-width="3"/></svg>';
    },
  };
  window.Art = Art;
})();
