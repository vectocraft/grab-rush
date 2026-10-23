// Composite props for Hungry Hole's premium maps (Fun Park, Castle Kingdom): several Kenney pieces merged into
// one model by scripts/kenney-convert.js. Each entry: { parts: [['pack/model', x, y, z, rotY(deg), scale], ...] }.
// Coaster circuits are laid out with a small turtle: every track piece starts where the previous one ended.

// ---------- Coasters ----------
// Track pieces start at their origin heading +z; their rails sit 1 unit below the origin, so the whole
// circuit is lifted by `lift` and stands on supports.
const PIECE = {
  S: { m: 'straight', end: [0, 4], turn: 0 },
  H: { m: 'straight-hill-complete', end: [0, 4], turn: 0 },
  B: { m: 'straight-bump-up', end: [0, 4], turn: 0 },
  C: { m: 'corner-large', end: [-4, 4], turn: -90 },
};
function circuit(style, seq, lift, opts = {}) {
  const parts = [];
  let x = 0, z = 0, h = 0;
  const rails = [];
  for (const k of seq) {
    const p = PIECE[k], a = h * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    parts.push(['coaster/coaster-' + style + '-' + p.m, x, lift, z, h]);
    if (k !== 'C') rails.push({ x, z, h });
    // Supports under straight pieces (corners hang between them).
    if (k !== 'C') for (const t of [1, 3]) {
      const sx = x + s * t, sz = z + c * t;
      for (let y = 0; y < lift - 1; y++) parts.push(['coaster/support-' + (opts.thin ? 'small' : 'large') + (y === 0 ? '-bottom' : ''), sx, y, sz, h]);
    }
    const [lx, lz] = p.end;
    x += lx * c + lz * s; z += -lx * s + lz * c; h += p.turn;
  }
  // A train on the first straight run.
  const r = rails[opts.trainAt || 0], a = r.h * Math.PI / 180;
  const cars = ['coaster/coaster-train-front', 'coaster/coaster-train', 'coaster/coaster-train'];
  cars.forEach((m, i) => parts.push([m, r.x + Math.sin(a) * (3.2 - i * 1.35), lift - 0.7, r.z + Math.cos(a) * (3.2 - i * 1.35), r.h]));
  if (opts.station) parts.push(['coaster/station', rails[1].x - 1.2, 0, rails[1].z + 2, rails[1].h], ['coaster/ride-entrance', rails[1].x - 2.2, 0, rails[1].z + 2, rails[1].h - 90]);
  return { parts };
}

// ---------- Castle ----------
const T = (x, z, floors, roof, y = 0) => { // square tower: base, mid floors, roof
  const p = [['castle/tower-square-base', x, y, z]];
  for (let f = 0; f < floors; f++) p.push(['castle/tower-square-mid' + (f % 2 ? '' : '-windows'), x, y + 1.01 * (f + 1), z]);
  p.push(['castle/' + (roof || 'tower-square-roof'), x, y + 1.01 * (floors + 1), z]);
  return p;
};
const HX = (x, z, mids, y = 0) => { // hexagonal tower
  const p = [['castle/tower-hexagon-base', x, y, z]];
  for (let f = 0; f < mids; f++) p.push(['castle/tower-hexagon-mid', x, y + 1.31 + 0.46 * f, z]);
  p.push(['castle/tower-hexagon-roof', x, y + 1.31 + 0.46 * mids, z]);
  return p;
};
const WALL = (x0, z0, x1, z1) => { // wall pieces from one tower to the next (1 unit each, axis aligned)
  const p = [], n = Math.round(Math.hypot(x1 - x0, z1 - z0)), deg = x1 !== x0 ? 90 : 0;
  for (let i = 1; i < n; i++) p.push(['castle/wall', x0 + (x1 - x0) * i / n, 0, z0 + (z1 - z0) * i / n, deg]);
  return p;
};

const shift = (c, dx, dy, dz) => c.parts.map(([m, x, y, z, r, sc]) => [m, x + dx, y + dy, z + dz, r, sc]);
const tower = (h, x = 0, z = 0) => [].concat(...Array.from({ length: h }, (_, y) => [['coaster/support-large' + (y ? '' : '-bottom'), x, y, z]]));

module.exports = {
  // Fun Park: compact, tall circuits so they read from the top-down camera.
  fp_coaster_s: circuit('steel', 'HCCHCC', 3, { thin: true }),
  fp_coaster_w: circuit('wood', 'SBCCSBCC', 4),
  fp_coaster_l: { parts: [].concat(shift(circuit('steel', 'HSCCSHCC', 6), 0, 0, 0), shift(circuit('mouse', 'SCCSCC', 2, { thin: true, station: true }), -2, 0, 2)) },
  fp_train: { parts: [['coaster/coaster-train-front', 0, 0, 0.7], ['coaster/coaster-train', 0, 0, -0.65]] },
  fp_drop: { parts: [].concat(tower(10), tower(10, 0.48, 0), [['coaster/coaster-train-safety', 0.24, 6.5, 0.35], ['coaster/station', 0.24, 0, 0.9], ['coaster/ride-entrance', 1.5, 0, 0.4, -90], ['coaster/flowers', -0.8, 0, 0.8]]) },
  // Castle Kingdom
  ck_house: { parts: [].concat(T(0, 0, 2, 'tower-square-top-roof-high'), HX(1.15, 0.2, 2), WALL(-0.5, 0.9, 0.6, 0.9)) },
  ck_hall: { parts: [].concat(T(0, 0, 1, 'tower-square-top-roof-rounded'), T(1, 0, 1, 'tower-square-top-roof-rounded'), T(0, 1, 2, 'tower-square-top-roof-high'), T(1, 1, 0, 'tower-square-roof')) },
  ck_gatehouse: { parts: [].concat(HX(-1.5, 0, 3), HX(1.5, 0, 3), T(0, 0, 1, 'tower-square-top'), [['castle/flag-banner-long', -0.75, 0.4, 0.55], ['castle/flag-banner-long', 0.75, 0.4, 0.55], ['castle/flag', 0, 2.3, 0]], WALL(-1.5, 0, 0, 0), WALL(0, 0, 1.5, 0)) },
  ck_castle: { parts: [].concat(HX(-2, -2, 4), HX(2, -2, 4), HX(-2, 2, 4), HX(2, 2, 4), WALL(-2, -2, 2, -2), WALL(-2, 2, 2, 2), WALL(-2, -2, -2, 2), WALL(2, -2, 2, 2),
    T(0, 0, 5, 'tower-square-top-roof-high'), T(-0.9, -0.6, 2, 'tower-square-roof'), [['castle/flag', 0, 7.3, 0], ['castle/flag-wide', -2, 3.6, -2], ['castle/flag-wide', 2, 3.6, 2]]) },
  ck_tent: { parts: [].concat(T(0, 0, 0, 'tower-square-roof'), [['castle/flag-banner-short', 0, 0.3, 0.52]]) },
};
