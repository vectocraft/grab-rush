// Bakes the Arrow Legends characters into posed static meshes (flipbook frames), like scripts/kaykit-units.js:
//   heroes  — KayKit Adventurers (scripts/kaykit-cag/chars, CC0 Kay Lousberg)
//   enemies — KayKit Skeletons (scripts/kaykit-arrow/skeletons, CC0 Kay Lousberg), weapons attached to their hand slots
// Output: arrow-legends/chars.js → window.ARROW_CHARS = { tex: { key: png }, chars: { name: { tex, u, i, i32, min, max,
//   frames: [{ p, n }] } } } with frames in the order FRAMES below. Skinning happens here; the game only swaps frames.
// Usage: node scripts/arrow-bake.js
const fs = require('fs');
const path = require('path');

const ADV = path.join(__dirname, 'kaykit-cag', 'chars'), SKEL = path.join(__dirname, 'kaykit-arrow', 'skeletons');
// Quaternius RPG Character Pack + Ultimate Monsters (CC0, quaternius.com): new heroes and the monster roster.
const QR = path.join(__dirname, 'quaternius', 'rpg'), QM = path.join(__dirname, 'quaternius', 'monsters');
const OUT = path.join(__dirname, '..', 'arrow-legends', 'chars.js');
const COMP = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array, 5121: Uint8Array };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
// Frame order shared with the game: 4 run, 2 attack, idle, dead.
const FRAMES = ['run0', 'run1', 'run2', 'run3', 'atk0', 'atk1', 'idle', 'dead'];

const BODY = (p, extra) => [p + '_Body', p + '_ArmLeft', p + '_ArmRight', p + '_LegLeft', p + '_LegRight'].concat(extra);
// The mage is baked without its hat: from the top-down camera the hat hid the whole character.
// name: { dir, file, tex, meshes, run, attack: [anim, phase0, phase1], idle, dead, weapons: [[gltf file, hand node]] }
const CHARS = {
  // The angel of room 5: a knight's body without helmet or weapons; the renderer adds wings, halo and glow.
  angel: { dir: ADV, file: 'Knight', tex: 'knight', meshes: BODY('Knight', ['Knight_Head', 'Knight_Cape']), run: 'Running_A', attack: ['Spellcast_Shoot', 0.2, 0.45], idle: 'Spellcasting', dead: 'Death_A_Pose' },
  minion: { dir: SKEL, file: 'Skeleton_Minion', tex: 'skeleton', meshes: BODY('Skeleton_Minion', ['Skeleton_Minion_Head', 'Skeleton_Minion_Jaw', 'Skeleton_Minion_Eyes', 'Skeleton_Minion_Cloak']), run: 'Running_C', attack: ['1H_Melee_Attack_Chop', 0.2, 0.45], idle: 'Idle_Combat', dead: 'Death_C_Pose', weapons: [['Skeleton_Blade', 'handslot.r']] },
  warrior: { dir: SKEL, file: 'Skeleton_Warrior', tex: 'skeleton', meshes: BODY('Skeleton_Warrior', ['Skeleton_Warrior_Head', 'Skeleton_Warrior_Jaw', 'Skeleton_Warrior_Eyes', 'Skeleton_Warrior_Helmet', 'Skeleton_Warrior_Cloak']), run: 'Running_A', attack: ['1H_Melee_Attack_Chop', 0.2, 0.45], idle: 'Idle_Combat', dead: 'Death_C_Pose', weapons: [['Skeleton_Axe', 'handslot.r'], ['Skeleton_Shield_Small_A', 'handslot.l']] },
  archer: { dir: SKEL, file: 'Skeleton_Rogue', tex: 'skeleton', meshes: BODY('Skeleton_Rogue', ['Skeleton_Rogue_Head', 'Skeleton_Rogue_Jaw', 'Skeleton_Rogue_Eyes', 'Skeleton_Rogue_Hood', 'Skeleton_Rogue_Cape']), run: 'Running_B', attack: ['2H_Ranged_Shoot', 0.15, 0.4], idle: '2H_Ranged_Aiming', dead: 'Death_C_Pose', weapons: [['Skeleton_Crossbow', 'handslot.r']] },
  necro: { dir: SKEL, file: 'Skeleton_Mage', tex: 'skeleton', meshes: BODY('Skeleton_Mage', ['Skeleton_Mage_Skull', 'Skeleton_Mage_Jaw', 'Skeleton_Mage_Eyes', 'Skeleton_Mage_Hat']), run: 'Running_B', attack: ['Spellcast_Shoot', 0.2, 0.45], idle: 'Spellcasting', dead: 'Death_C_Pose', weapons: [['Skeleton_Staff', 'handslot.r']] },
};
// Heroes (height in world units, matched to the old KayKit heroes) and monsters: [key, folder, file, height, attack anims].
const Q = (dir, file, tex, height, attack) => ({ dir, file, tex, meshes: '*', height, run: ['Run', 'Fast_Flying', 'Walk', 'Flying_Idle'],
  attack: [attack || ['Weapon', 'Punch', 'Bite_Front', 'Headbutt'], 0.25, 0.5], idle: ['Idle', 'Flying_Idle', 'Idle_Attacking'], dead: ['Death'] });
Object.assign(CHARS, {
  rogue: Q(QR, 'Rogue', 'q_rogue', 2.6, ['Dagger_Attack']),
  ranger: Q(QR, 'Ranger', 'q_ranger', 2.6, ['Bow_Shoot']),
  mage: Q(QR, 'Wizard', 'q_wizard', 2.6, ['Spell1']),
  // Frost Cleric: the Cleric repainted in an ice palette (scripts/frost-recolor.js) instead of a flat blue tint.
  frost: Q(QR, 'Cleric', 'q_frost', 2.6, ['Spell1']),
});
const MON = [
  ['greenblob', 'Blob', 'GreenBlob', 1.7], ['orcskull', 'Big', 'Orc_Skull', 2.7],
  ['frog', 'Big', 'Frog', 2.1], ['fishb', 'Blob', 'Fish', 1.7], ['squidle', 'Flying', 'Squidle', 2.0], ['fish', 'Big', 'Fish', 2.7], ['glub', 'Flying', 'Glub', 2.0], ['glubx', 'Flying', 'Glub_Evolved', 2.4],
  ['mushnub', 'Blob', 'Mushnub', 1.7], ['pinkblob', 'Blob', 'PinkBlob', 1.7], ['ghost', 'Flying', 'Ghost', 2.1], ['monkroose', 'Big', 'Monkroose', 2.7], ['ghostskull', 'Flying', 'Ghost_Skull', 2.1], ['mushking', 'Big', 'MushroomKing', 2.6],
  ['cactoro', 'Big', 'Cactoro', 2.2], ['demonf', 'Flying', 'Demon', 2.0], ['goleling', 'Flying', 'Goleling', 2.0], ['demon', 'Big', 'Demon', 2.8], ['bluedemon', 'Big', 'BlueDemon', 2.3], ['dragonx', 'Flying', 'Dragon_Evolved', 2.6],
  ['bunny', 'Big', 'Bunny', 2.0], ['pigeon', 'Flying', 'Pigeon', 1.8], ['alpaking', 'Flying', 'Alpaking', 2.1], ['yeti', 'Big', 'Yeti', 2.9], ['wizardb', 'Blob', 'Wizard', 1.9], ['alpakingx', 'Flying', 'Alpaking_Evolved', 2.5],
  ['orc', 'Big', 'Orc', 2.4], ['ninja', 'Big', 'Ninja', 2.3], ['tribal', 'Big', 'Tribal', 2.3], ['dino', 'Big', 'Dino', 2.8], ['alien', 'Big', 'Alien', 2.3], ['golex', 'Flying', 'Goleling_Evolved', 2.6],
  // Guardians and mini bosses (never ordinary foes): their own models, so no boss looks like another.
  ['hywirl', 'Flying', 'Hywirl', 2.4], ['spikyblob', 'Blob', 'GreenSpikyBlob', 2.0], ['mushx', 'Blob', 'Mushnub_Evolved', 2.1], ['dragon', 'Flying', 'Dragon', 2.5], ['birb', 'Big', 'Birb', 2.5], ['armabee', 'Flying', 'Armabee_Evolved', 2.3],
];
for (const [k, grp, file, h] of MON) CHARS[k] = Q(path.join(QM, grp, 'glTF'), file, 'q_mon_' + grp.toLowerCase(), h);
// Which file each monster goes to: chapter 1 rides in the core file, chapters 2-6 are loaded in the background.
const CHUNK = { frog: 2, fishb: 2, squidle: 2, fish: 2, glub: 2, glubx: 2, mushnub: 3, pinkblob: 3, ghost: 3, monkroose: 3, ghostskull: 3, mushking: 3,
  cactoro: 4, demonf: 4, goleling: 4, demon: 4, bluedemon: 4, dragonx: 4, bunny: 5, pigeon: 5, alpaking: 5, yeti: 5, wizardb: 5, alpakingx: 5,
  orc: 6, ninja: 6, tribal: 6, dino: 6, alien: 6, golex: 6, hywirl: 7, spikyblob: 7, mushx: 7, dragon: 7, birb: 7, armabee: 7 };

function load(dir, file) {
  let b = fs.existsSync(path.join(dir, file + '.glb')) ? fs.readFileSync(path.join(dir, file + '.glb')) : null, j, bin;
  if (b) { const jl = b.readUInt32LE(12); j = JSON.parse(b.slice(20, 20 + jl).toString()); bin = b.slice(20 + jl + 8); }
  else { j = JSON.parse(fs.readFileSync(path.join(dir, file + '.gltf'), 'utf8')); const u = j.buffers[0].uri; bin = /^data:/.test(u) ? Buffer.from(u.slice(u.indexOf(',') + 1), 'base64') : fs.readFileSync(path.join(dir, u)); }
  const acc = i => {
    const a = j.accessors[i], bv = j.bufferViews[a.bufferView], T = COMP[a.componentType], n = SIZE[a.type];
    const off = (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride;
    if (stride && stride !== n * T.BYTES_PER_ELEMENT) throw new Error('interleaved accessor');
    return Array.from(new T(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * n * T.BYTES_PER_ELEMENT)));
  };
  const img = j.images && j.images[0];
  let png = null;
  if (img && img.bufferView != null) { const iv = j.bufferViews[img.bufferView]; png = bin.slice(iv.byteOffset || 0, (iv.byteOffset || 0) + iv.byteLength); }
  else if (img && img.uri) png = fs.readFileSync(path.join(dir, img.uri));
  return { j, acc, png };
}

const mul = (a, b) => { const o = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const compose = (t, q, s) => {
  const [x, y, z, w] = q, [sx, sy, sz] = s;
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, t[0], t[1], t[2], 1];
};
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function pose(m, name, phase) {
  const names = Array.isArray(name) ? name : [name];
  const { j, acc } = m, anim = names.map(n => j.animations.find(a => a.name === n)).find(Boolean)
    || j.animations.find(a => /attack|bite|punch|headbutt|hit/i.test(a.name)) || j.animations.find(a => !/death/i.test(a.name));
  if (!anim) throw new Error('no animation ' + name);
  const trs = j.nodes.map(n => ({ t: (n.translation || [0, 0, 0]).slice(), r: (n.rotation || [0, 0, 0, 1]).slice(), s: (n.scale || [1, 1, 1]).slice() }));
  const dur = Math.max(...anim.samplers.map(s => j.accessors[s.input].max[0])), time = dur * phase;
  for (const ch of anim.channels) {
    const s = anim.samplers[ch.sampler], times = acc(s.input), vals = acc(s.output), n = ch.target.path === 'rotation' ? 4 : 3;
    let k = 0; while (k < times.length - 2 && times[k + 1] <= time) k++;
    const k1 = Math.min(k + 1, times.length - 1), t0 = times[k], t1 = times[k1], f = t1 > t0 ? Math.min(1, Math.max(0, (time - t0) / (t1 - t0))) : 0;
    const a = vals.slice(k * n, k * n + n), b = vals.slice(k1 * n, k1 * n + n);
    let v = a.map((x, i) => x + (b[i] - x) * (s.interpolation === 'STEP' ? 0 : f));
    if (n === 4) { const dot = a.reduce((q, x, i) => q + x * b[i], 0); if (dot < 0) v = a.map((x, i) => x + (-b[i] - x) * f); const l = Math.hypot(...v); v = v.map(x => x / l); }
    trs[ch.target.node][{ translation: 't', rotation: 'r', scale: 's' }[ch.target.path]] = v;
  }
  const world = new Array(j.nodes.length);
  const visit = (i, parent) => { world[i] = mul(parent, j.nodes[i].matrix || compose(trs[i].t, trs[i].r, trs[i].s)); for (const c of j.nodes[i].children || []) visit(c, world[i]); };
  for (const r of j.scenes[j.scene || 0].nodes) visit(r, I4);
  return world;
}

// Appends the primitives of one mesh node (skinned with `world`, or rigid with matrix M) to the output arrays.
function addMesh(m, ni, world, M0, out) {
  const { j, acc } = m, node = j.nodes[ni];
  let jointM = null;
  if (node.skin != null) {
    const sk = j.skins[node.skin], ibm = acc(sk.inverseBindMatrices);
    jointM = sk.joints.map((jn, k) => mul(world[jn], ibm.slice(k * 16, k * 16 + 16)));
  }
  for (const pr of j.meshes[node.mesh].primitives) {
    const base = out.P.length / 3, pos = acc(pr.attributes.POSITION), nor = acc(pr.attributes.NORMAL), uv = acc(pr.attributes.TEXCOORD_0);
    const J = jointM ? acc(pr.attributes.JOINTS_0) : null, W = jointM ? acc(pr.attributes.WEIGHTS_0) : null;
    for (let v = 0; v < pos.length / 3; v++) {
      let M;
      if (jointM) { M = new Array(16).fill(0); for (let k = 0; k < 4; k++) { const w = W[v * 4 + k]; if (!w) continue; const jm = jointM[J[v * 4 + k]]; for (let e = 0; e < 16; e++) M[e] += w * jm[e]; } }
      else M = M0;
      const [x, y, z] = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]], [a, b, c] = [nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]];
      out.P.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]);
      const nx = M[0] * a + M[4] * b + M[8] * c, ny = M[1] * a + M[5] * b + M[9] * c, nz = M[2] * a + M[6] * b + M[10] * c, l = Math.hypot(nx, ny, nz) || 1;
      out.N.push(nx / l, ny / l, nz / l);
      out.U.push(uv[v * 2], uv[v * 2 + 1]);
    }
    for (const i of acc(pr.indices)) out.I.push(base + i);
  }
}
function bake(m, c, world, weapons) {
  const out = { P: [], N: [], U: [], I: [] };
  const nodes = c.meshes === '*' ? m.j.nodes.map((n, i) => n.mesh != null ? i : -1).filter(i => i >= 0) : c.meshes.map(name => {
    const ni = m.j.nodes.findIndex(n => n.name === name);
    if (ni < 0) throw new Error(c.file + ': no mesh node ' + name);
    return ni;
  });
  for (const ni of nodes) addMesh(m, ni, world, world[ni], out);
  // Weapons: every mesh node of the weapon file, placed at the hand slot of the posed skeleton.
  for (const [wm, slot] of weapons) {
    const si = m.j.nodes.findIndex(n => n.name === slot);
    const wworld = pose0(wm);
    wm.j.nodes.forEach((n, ni) => { if (n.mesh != null) addMesh(wm, ni, null, mul(world[si], wworld[ni]), out); });
  }
  return out;
}
// Rest-pose world matrices of a static file.
function pose0(m) {
  const { j } = m, world = new Array(j.nodes.length);
  const visit = (i, parent) => { const n = j.nodes[i]; world[i] = mul(parent, n.matrix || compose(n.translation || [0, 0, 0], n.rotation || [0, 0, 0, 1], n.scale || [1, 1, 1])); for (const c of n.children || []) visit(c, world[i]); };
  for (const r of j.scenes[j.scene || 0].nodes) visit(r, I4);
  return world;
}

const b64 = ta => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength).toString('base64');
const tex = {}, chars = {}, texOf = {};
for (const [name, c] of Object.entries(CHARS)) {
  const m = load(c.dir, c.file), weapons = (c.weapons || []).map(([f, slot]) => [load(c.dir, f), slot]);
  if (!tex[c.tex]) tex[c.tex] = m.png; texOf[name] = c.tex;
  const poses = [[c.run, 0], [c.run, 0.25], [c.run, 0.5], [c.run, 0.75], [c.attack[0], c.attack[1]], [c.attack[0], c.attack[2]], [c.idle, 0.3], [c.dead, 0.99]];
  const frames = poses.map(([a, ph]) => bake(m, c, pose(m, a, ph), weapons));
  if (c.height) {
    const ip = frames[6].P; let lo = Infinity, hi = -Infinity; for (let i = 1; i < ip.length; i += 3) { lo = Math.min(lo, ip[i]); hi = Math.max(hi, ip[i]); }
    const k = c.height / (hi - lo); for (const f of frames) for (let i = 0; i < f.P.length; i++) f.P[i] = (i % 3 === 1 ? f.P[i] - lo : f.P[i]) * k;
  }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const f of frames) for (let i = 0; i < f.P.length; i++) { min[i % 3] = Math.min(min[i % 3], f.P[i]); max[i % 3] = Math.max(max[i % 3], f.P[i]); }
  const q = P => { const o = new Int16Array(P.length); for (let i = 0; i < P.length; i++) { const k = i % 3, span = max[k] - min[k] || 1; o[i] = Math.round((P[i] - min[k]) / span * 65535) - 32768; } return o; };
  const f0 = frames[0], idx = f0.P.length / 3 > 65535 ? Uint32Array.from(f0.I) : Uint16Array.from(f0.I);
  chars[name] = {
    tex: c.tex, min: min.map(v => +v.toFixed(4)), max: max.map(v => +v.toFixed(4)),
    u: b64(Uint16Array.from(f0.U, v => Math.round(Math.min(1, Math.max(0, v)) * 65535))), i: b64(idx), i32: idx instanceof Uint32Array ? 1 : 0,
    frames: frames.map((f, fi) => (c.height && fi !== 6 ? { p: b64(q(f.P)) } : { p: b64(q(f.P)), n: b64(Int8Array.from(f.N, v => Math.round(v * 127))) })),
  };
  console.log(name.padEnd(10), (f0.P.length / 3) + ' verts, height ' + (max[1] - min[1]).toFixed(2));
}
(async () => {
  const sharp = require('sharp');
  for (const k of Object.keys(tex)) {
    const big = /^q_(rogue|ranger|wizard|frost)$/.test(k);
    // Outfits repaint the original Cleric texture: the ice one is nearly a single hue, so every part would get one colour.
    if (k === 'q_frost') { tex.q_frost_src = 'data:image/png;base64,' + (await sharp(tex[k]).resize(512, 512).png({ compressionLevel: 9 }).toBuffer()).toString('base64'); tex[k] = await require('./frost-recolor')(tex[k]); }
    const buf = big ? await sharp(tex[k]).resize(512, 512).png({ compressionLevel: 9 }).toBuffer() : tex[k];
    tex[k] = 'data:image/png;base64,' + buf.toString('base64');
  }
  const head = '// Generated by scripts/arrow-bake.js from the KayKit Adventurers and Skeletons packs (CC0, Kay Lousberg) and the Quaternius RPG Characters and Ultimate Monsters packs (CC0, quaternius.com).\n// Frames: ' + FRAMES.join(', ') + '\n';
  if (chars.frost && tex.q_frost_src) chars.frost.skinTex = 'q_frost_src';
  const pick = ch => { const c = {}, t = {}; for (const k in chars) if ((CHUNK[k] || 1) === ch) { c[k] = chars[k]; t[texOf[k]] = tex[texOf[k]]; if (chars[k].skinTex) t[chars[k].skinTex] = tex[chars[k].skinTex]; } return { c, t }; };
  const core = pick(1);
  fs.writeFileSync(OUT, head + 'window.ARROW_CHARS = ' + JSON.stringify({ tex: core.t, chars: core.c }) + ';\n');
  for (let ch = 2; ch <= 7; ch++) { // 2-6: chapter crews, 7: guardians and mini bosses
    const { c, t } = pick(ch), f = OUT.replace(/chars\.js$/, 'chars-' + ch + '.js');
    fs.writeFileSync(f, head + '(function (A) { Object.assign(A.tex, ' + JSON.stringify(t) + '); Object.assign(A.chars, ' + JSON.stringify(c) + '); A.loaded = A.loaded || {}; A.loaded[' + ch + '] = true; })(window.ARROW_CHARS);\n');
    console.log('chapter ' + ch + ': ' + (fs.statSync(f).size / 1024).toFixed(0) + ' KB');
  }
  console.log('core: ' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
})();
