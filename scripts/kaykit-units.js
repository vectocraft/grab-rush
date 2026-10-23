// Bakes KayKit Adventurers characters (CC0, Kay Lousberg — scripts/kaykit-cag/chars/LICENSE.txt) into posed static
// meshes for Çağlar Savaşı: a few frames of the walk cycle plus one attack frame per unit, played back as a flipbook.
// Output: caglar-savasi/kaykit-units.js → window.KAYKIT_UNITS = { tex: { char: png }, units: { name: {
//   tex, u, i, i32, min, max, frames: [{ p, n }] } } }  (UVs/indices shared by the frames; positions Int16 in the
//   unit's bounding box, normals Int8). Skinning is done here, so the game needs no skeleton or animation code.
// Usage: node scripts/kaykit-units.js
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'kaykit-cag', 'chars');
const OUT = path.join(__dirname, '..', 'caglar-savasi', 'kaykit-units.js');
const COMP = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array, 5121: Uint8Array };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

// name: [file, texture key, meshes to show, attack animation, attack phase 0..1]
const UNITS = {
  barb_axe: ['Barbarian', 'barbarian', ['Barbarian_Body', 'Barbarian_Head', 'Barbarian_ArmLeft', 'Barbarian_ArmRight', 'Barbarian_LegLeft', 'Barbarian_LegRight', 'Barbarian_Cape', '1H_Axe', 'Barbarian_Round_Shield'], '1H_Melee_Attack_Chop', 0.45],
  hood_throw: ['Rogue_Hooded', 'rogue', ['Rogue_Body', 'Rogue_Head_Hooded', 'Rogue_ArmLeft', 'Rogue_ArmRight', 'Rogue_LegLeft', 'Rogue_LegRight', 'Rogue_Cape', 'Throwable'], 'Throw', 0.45],
  knight_sword: ['Knight', 'knight', ['Knight_Body', 'Knight_Head', 'Knight_ArmLeft', 'Knight_ArmRight', 'Knight_LegLeft', 'Knight_LegRight', 'Knight_Cape', 'Knight_Helmet', '1H_Sword', 'Round_Shield'], '1H_Melee_Attack_Slice_Diagonal', 0.4],
  rogue_xbow: ['Rogue', 'rogue', ['Rogue_Body', 'Rogue_Head', 'Rogue_ArmLeft', 'Rogue_ArmRight', 'Rogue_LegLeft', 'Rogue_LegRight', 'Rogue_Cape', '2H_Crossbow'], '2H_Ranged_Shoot', 0.3],
  knight_2h: ['Knight', 'knight', ['Knight_Body', 'Knight_Head', 'Knight_ArmLeft', 'Knight_ArmRight', 'Knight_LegLeft', 'Knight_LegRight', 'Knight_Cape', '2H_Sword'], '2H_Melee_Attack_Chop', 0.45],
  hood_xbow: ['Rogue_Hooded', 'rogue', ['Rogue_Body', 'Rogue_Head_Hooded', 'Rogue_ArmLeft', 'Rogue_ArmRight', 'Rogue_LegLeft', 'Rogue_LegRight', '1H_Crossbow'], '1H_Ranged_Shoot', 0.3],
  mage_staff: ['Mage', 'mage', ['Mage_Body', 'Mage_Head', 'Mage_ArmLeft', 'Mage_ArmRight', 'Mage_LegLeft', 'Mage_LegRight', 'Mage_Cape', 'Mage_Hat', '2H_Staff'], 'Spellcast_Shoot', 0.4],
};
const WALK = 'Walking_A', WALK_PHASES = [0, 1 / 3, 2 / 3];

function load(file) {
  const b = fs.readFileSync(path.join(SRC, file + '.glb'));
  const jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl).toString());
  const bin = b.slice(20 + jl + 8);
  const acc = i => {
    const a = j.accessors[i], bv = j.bufferViews[a.bufferView], T = COMP[a.componentType], n = SIZE[a.type];
    const off = (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride;
    if (stride && stride !== n * T.BYTES_PER_ELEMENT) throw new Error('interleaved accessor');
    return Array.from(new T(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * n * T.BYTES_PER_ELEMENT)));
  };
  const img = j.images[0], iv = j.bufferViews[img.bufferView];
  return { j, acc, png: bin.slice(iv.byteOffset || 0, (iv.byteOffset || 0) + iv.byteLength) };
}

// Column-major 4x4 helpers.
const mul = (a, b) => { const o = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const compose = (t, q, s) => {
  const [x, y, z, w] = q, [sx, sy, sz] = s;
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, t[0], t[1], t[2], 1];
};
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// World matrices of every node with animation `name` sampled at phase (0..1 of its duration).
function pose(m, name, phase) {
  const { j, acc } = m, anim = j.animations.find(a => a.name === name);
  if (!anim) throw new Error('no animation ' + name);
  const trs = j.nodes.map(n => ({ t: (n.translation || [0, 0, 0]).slice(), r: (n.rotation || [0, 0, 0, 1]).slice(), s: (n.scale || [1, 1, 1]).slice() }));
  const dur = Math.max(...anim.samplers.map(s => j.accessors[s.input].max[0]));
  const time = dur * phase;
  for (const ch of anim.channels) {
    const s = anim.samplers[ch.sampler], times = acc(s.input), vals = acc(s.output), n = ch.target.path === 'rotation' ? 4 : 3;
    let k = 0; while (k < times.length - 2 && times[k + 1] <= time) k++;
    const t0 = times[k], t1 = times[Math.min(k + 1, times.length - 1)], f = t1 > t0 ? Math.min(1, Math.max(0, (time - t0) / (t1 - t0))) : 0;
    const a = vals.slice(k * n, k * n + n), b = vals.slice(Math.min(k + 1, times.length - 1) * n, Math.min(k + 1, times.length - 1) * n + n);
    let v = a.map((x, i) => x + (b[i] - x) * (s.interpolation === 'STEP' ? 0 : f));
    if (n === 4) { const dot = a.reduce((acc2, x, i) => acc2 + x * b[i], 0); if (dot < 0) v = a.map((x, i) => x + (-b[i] - x) * f); const l = Math.hypot(...v); v = v.map(x => x / l); }
    trs[ch.target.node][{ translation: 't', rotation: 'r', scale: 's' }[ch.target.path]] = v;
  }
  const world = new Array(j.nodes.length);
  const visit = (i, parent) => { world[i] = mul(parent, j.nodes[i].matrix || compose(trs[i].t, trs[i].r, trs[i].s)); for (const c of j.nodes[i].children || []) visit(c, world[i]); };
  for (const r of j.scenes[j.scene || 0].nodes) visit(r, I4);
  return world;
}

// One posed, merged mesh (positions + normals) of the chosen mesh nodes; uv/index are pose independent.
function bake(m, meshNames, world) {
  const { j, acc } = m, P = [], N = [], U = [], I = [];
  for (const name of meshNames) {
    const ni = j.nodes.findIndex(n => n.name === name);
    if (ni < 0) throw new Error('no mesh node ' + name);
    const node = j.nodes[ni];
    let jointM = null;
    if (node.skin != null) {
      const sk = j.skins[node.skin], ibm = acc(sk.inverseBindMatrices);
      jointM = sk.joints.map((jn, k) => mul(world[jn], ibm.slice(k * 16, k * 16 + 16)));
    }
    for (const pr of j.meshes[node.mesh].primitives) {
      const base = P.length / 3, pos = acc(pr.attributes.POSITION), nor = acc(pr.attributes.NORMAL), uv = acc(pr.attributes.TEXCOORD_0);
      const J = jointM ? acc(pr.attributes.JOINTS_0) : null, W = jointM ? acc(pr.attributes.WEIGHTS_0) : null;
      for (let v = 0; v < pos.length / 3; v++) {
        let M;
        if (jointM) { M = new Array(16).fill(0); for (let k = 0; k < 4; k++) { const w = W[v * 4 + k]; if (!w) continue; const jm = jointM[J[v * 4 + k]]; for (let e = 0; e < 16; e++) M[e] += w * jm[e]; } }
        else M = world[ni];
        const [x, y, z] = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]], [a, b, c] = [nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]];
        P.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]);
        const nx = M[0] * a + M[4] * b + M[8] * c, ny = M[1] * a + M[5] * b + M[9] * c, nz = M[2] * a + M[6] * b + M[10] * c, l = Math.hypot(nx, ny, nz) || 1;
        N.push(nx / l, ny / l, nz / l);
        U.push(uv[v * 2], uv[v * 2 + 1]);
      }
      for (const i of acc(pr.indices)) I.push(base + i);
    }
  }
  return { P, N, U, I };
}

const b64 = ta => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength).toString('base64');
const cache = {}, tex = {}, units = {};
for (const [name, [file, texKey, meshes, attack, attackPhase]] of Object.entries(UNITS)) {
  const m = cache[file] || (cache[file] = load(file));
  if (!tex[texKey]) tex[texKey] = 'data:image/png;base64,' + m.png.toString('base64');
  const frames = WALK_PHASES.map(ph => bake(m, meshes, pose(m, WALK, ph))).concat([bake(m, meshes, pose(m, attack, attackPhase))]);
  // One bounding box for all frames so they share the quantization.
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const f of frames) for (let i = 0; i < f.P.length; i++) { min[i % 3] = Math.min(min[i % 3], f.P[i]); max[i % 3] = Math.max(max[i % 3], f.P[i]); }
  const q = P => { const o = new Int16Array(P.length); for (let i = 0; i < P.length; i++) { const k = i % 3, span = max[k] - min[k] || 1; o[i] = Math.round((P[i] - min[k]) / span * 65535) - 32768; } return o; };
  const f0 = frames[0], idx = f0.P.length / 3 > 65535 ? Uint32Array.from(f0.I) : Uint16Array.from(f0.I);
  units[name] = {
    tex: texKey, min: min.map(v => +v.toFixed(4)), max: max.map(v => +v.toFixed(4)),
    u: b64(Uint16Array.from(f0.U, v => Math.round(Math.min(1, Math.max(0, v)) * 65535))), i: b64(idx), i32: idx instanceof Uint32Array ? 1 : 0,
    frames: frames.map(f => ({ p: b64(q(f.P)), n: b64(Int8Array.from(f.N, v => Math.round(v * 127))) })),
  };
  console.log(name.padEnd(13), (f0.P.length / 3) + ' verts, height ' + (max[1] - min[1]).toFixed(2));
}
fs.writeFileSync(OUT, '// Generated by scripts/kaykit-units.js from the KayKit Adventurers Character Pack (CC0, Kay Lousberg, www.kaylousberg.com).\nwindow.KAYKIT_UNITS = ' + JSON.stringify({ tex, units }) + ';\n');
console.log('KAYKIT_UNITS: ' + Object.keys(units).length + ' units, ' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB → ' + path.relative(process.cwd(), OUT));
