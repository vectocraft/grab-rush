// Converts the extra CC0 models of Çağlar Savaşı into caglar-savasi/cag-ext.js (window.CAG_EXT = { tex, models }),
// in the same quantized format as kaykit-cag.js, so the game needs no loaders and works offline:
//   - Kenney Tower Defense Kit (CC0, www.kenney.nl): turret weapons, tower parts and ammo (GLB).
//   - Quaternius Animated Mech Pack (CC0, quaternius.com): future-age robots and mechs (OBJ, static pose).
// The packs are downloaded and unzipped into scripts/ext (see the README); usage: node scripts/cag-ext-convert.js
const fs = require('fs');
const path = require('path');
const sharp = require('../node_modules/sharp');

const EXT = path.join(__dirname, 'ext');
const COMP = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array, 5121: Uint8Array };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const b64 = ta => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength).toString('base64');

function readGlb(file) {
  const b = fs.readFileSync(file), jl = b.readUInt32LE(12), g = JSON.parse(b.slice(20, 20 + jl).toString());
  const binStart = 20 + jl + 8, bin = b.slice(binStart);
  const acc = i => {
    const a = g.accessors[i], bv = g.bufferViews[a.bufferView], T = COMP[a.componentType], n = SIZE[a.type];
    const off = (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || 0;
    if (stride && stride !== n * T.BYTES_PER_ELEMENT) { const out = []; for (let k = 0; k < a.count; k++) { const v = new T(bin.buffer.slice(bin.byteOffset + off + k * stride, bin.byteOffset + off + k * stride + n * T.BYTES_PER_ELEMENT)); out.push(...v); } return out; }
    return Array.from(new T(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * n * T.BYTES_PER_ELEMENT)));
  };
  const mul = (a, c) => { const o = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let cc = 0; cc < 4; cc++) for (let k = 0; k < 4; k++) o[cc * 4 + r] += a[k * 4 + r] * c[cc * 4 + k]; return o; };
  const trs = n => {
    if (n.matrix) return n.matrix;
    const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
    return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
      2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
  };
  const P = [], N = [], U = [], I = [];
  (function visitAll() {
    const visit = (ni, parent) => {
      const node = g.nodes[ni], m = mul(parent, trs(node));
      if (node.mesh != null) for (const pr of g.meshes[node.mesh].primitives) {
        const base = P.length / 3, pos = acc(pr.attributes.POSITION), nor = acc(pr.attributes.NORMAL), uv = acc(pr.attributes.TEXCOORD_0);
        for (let v = 0; v < pos.length / 3; v++) {
          const [x, y, z] = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
          P.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
          const [a, bb, c] = [nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]], nx = m[0] * a + m[4] * bb + m[8] * c, ny = m[1] * a + m[5] * bb + m[9] * c, nz = m[2] * a + m[6] * bb + m[10] * c, l = Math.hypot(nx, ny, nz) || 1;
          N.push(nx / l, ny / l, nz / l); U.push(uv[v * 2], uv[v * 2 + 1]);
        }
        for (const i of acc(pr.indices)) I.push(base + i);
      }
      for (const c of node.children || []) visit(c, m);
    };
    for (const r of g.scenes[g.scene || 0].nodes) visit(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  })();
  return { P, N, U, I };
}

function readObj(file) {
  const v = [], vt = [], vn = [], P = [], N = [], U = [], I = [], key = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p[0] === 'v') v.push(p.slice(1, 4).map(Number));
    else if (p[0] === 'vt') vt.push(p.slice(1, 3).map(Number));
    else if (p[0] === 'vn') vn.push(p.slice(1, 4).map(Number));
    else if (p[0] === 'f') {
      const ids = p.slice(1).map(s => {
        if (!key.has(s)) { const [a, b, c] = s.split('/').map(x => parseInt(x, 10) - 1); key.set(s, P.length / 3); P.push(...v[a]); U.push(...(vt[b] ? [vt[b][0], 1 - vt[b][1]] : [0, 0])); N.push(...(vn[c] || [0, 1, 0])); }
        return key.get(s);
      });
      for (let k = 1; k < ids.length - 1; k++) I.push(ids[0], ids[k], ids[k + 1]);
    }
  }
  return { P, N, U, I };
}

function pack({ P, N, U, I }, tex) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i++) { min[i % 3] = Math.min(min[i % 3], P[i]); max[i % 3] = Math.max(max[i % 3], P[i]); }
  const q = new Int16Array(P.length);
  for (let i = 0; i < P.length; i++) { const k = i % 3, span = max[k] - min[k] || 1; q[i] = Math.round((P[i] - min[k]) / span * 65535) - 32768; }
  const n = Int8Array.from(N, x => Math.round(x * 127)), u = Uint16Array.from(U, x => Math.round(Math.min(1, Math.max(0, x)) * 65535));
  const idx = P.length / 3 > 65535 ? Uint32Array.from(I) : Uint16Array.from(I);
  return { min: min.map(x => +x.toFixed(4)), max: max.map(x => +x.toFixed(4)), p: b64(q), n: b64(n), u: b64(u), i: b64(idx), i32: idx instanceof Uint32Array ? 1 : 0, tex };
}
const png = async (file, size) => 'data:image/png;base64,' + (await sharp(file).resize(size, size).png({ palette: size > 256 }).toBuffer()).toString('base64');

(async () => {
  const models = {}, tex = {};
  const TD = path.join(EXT, 'td', 'Models', 'GLB format');
  for (const name of ['weapon-ballista', 'weapon-cannon', 'weapon-catapult', 'weapon-turret', 'weapon-ammo-arrow', 'weapon-ammo-boulder', 'weapon-ammo-bullet', 'weapon-ammo-cannonball',
    'tower-round-bottom-a', 'tower-round-middle-a', 'tower-round-top-a', 'tower-square-bottom-a', 'tower-square-middle-a', 'tower-square-top-a', 'tower-round-crystals'])
    models[name] = pack(readGlb(path.join(TD, name + '.glb')), 'td');
  tex.td = await png(path.join(TD, 'Textures', 'colormap.png'), 64);
  const MD = path.join(EXT, 'mech', 'Animated Mech Pack - March 2021');
  for (const name of ['George', 'Leela', 'Mike', 'Stan']) {
    models['mech_' + name.toLowerCase()] = pack(readObj(path.join(MD, 'OBJ', name + '.obj')), 'mech_' + name.toLowerCase());
    tex['mech_' + name.toLowerCase()] = await png(path.join(MD, 'Textures', name + '_Texture.png'), 256);
  }
  const out = path.join(__dirname, '..', 'caglar-savasi', 'cag-ext.js');
  fs.writeFileSync(out, '// Generated by scripts/cag-ext-convert.js from the Kenney Tower Defense Kit (CC0, www.kenney.nl) and the\n// Quaternius Animated Mech Pack (CC0, quaternius.com).\nwindow.CAG_EXT = ' + JSON.stringify({ tex, models }) + ';\n');
  for (const k in models) console.log(k, models[k].min.map((v, i) => (models[k].max[i] - v).toFixed(2)).join('x'));
  console.log('CAG_EXT: ' + Object.keys(models).length + ' models, ' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
})();
