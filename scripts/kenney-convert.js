// Converts Kenney models (CC0, www.kenney.nl — licences next to them in scripts/kenney/<pack>/) into one
// compact script for Hungry Hole: obur-delik/models.js → window.HOLE_MODELS = { key: model }.
// Every model is merged into one geometry with its colours baked into the vertices (Kenney's colormap is a
// flat palette, so sampling it per vertex keeps the look) — the game then draws every prop with a single
// vertex-coloured material and needs no textures or glTF loader. Positions are Int16 in the model's
// bounding box (no normals: the game shades flat), colours Uint8 sRGB, indices Uint16/Uint32, all base64.
// Usage: node scripts/kenney-convert.js [manifest.json out.js GLOBAL]   (default: Hungry Hole)
//        node scripts/kenney-convert.js --all <dir> <out.js>          (every model of a folder, for previews)
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.join(__dirname, 'kenney');
// key: 'pack/model'. Keys are what obur-delik/game.js places on the maps.
const ARGS = process.argv.slice(2), CUSTOM = ARGS[0] && ARGS[0] !== '--all';
const MANIFEST = CUSTOM ? require(path.resolve(ARGS[0])) : Object.assign({}, require('./kenney-manifest.json'), require('./hole-composites.js'));
const GLOBAL = CUSTOM ? ARGS[2] : 'HOLE_MODELS';

const COMP = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array, 5121: Uint8Array, 5122: Int16Array, 5120: Int8Array };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const texCache = {};
async function texture(file) {
  if (!texCache[file]) {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    texCache[file] = { data, w: info.width, h: info.height };
  }
  return texCache[file];
}

async function read(file) {
  const buf = fs.readFileSync(file);
  let g, bin;
  if (buf.readUInt32LE(0) === 0x46546c67) { // binary glTF
    const jl = buf.readUInt32LE(12);
    g = JSON.parse(buf.slice(20, 20 + jl).toString('utf8'));
    bin = buf.slice(20 + jl + 8);
  } else { g = JSON.parse(buf.toString('utf8')); bin = fs.readFileSync(path.join(path.dirname(file), g.buffers[0].uri)); }
  const acc = i => {
    const a = g.accessors[i], bv = g.bufferViews[a.bufferView], T = COMP[a.componentType], n = SIZE[a.type];
    const off = (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || n * T.BYTES_PER_ELEMENT, out = new Array(a.count * n);
    for (let v = 0; v < a.count; v++) {
      const view = new T(bin.buffer.slice(bin.byteOffset + off + v * stride, bin.byteOffset + off + v * stride + n * T.BYTES_PER_ELEMENT));
      for (let k = 0; k < n; k++) out[v * n + k] = view[k];
    }
    return out;
  };
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
  const trs = n => {
    if (n.matrix) return n.matrix;
    const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
    return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
      2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
      2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
  };
  // Colour source per material: a texture to sample, or a flat base colour.
  const mats = [];
  for (const m of g.materials || []) {
    const pbr = m.pbrMetallicRoughness || {}, f = pbr.baseColorFactor || [1, 1, 1, 1];
    let tex = null;
    if (pbr.baseColorTexture) {
      const img = g.images[g.textures[pbr.baseColorTexture.index].source];
      if (img.uri) tex = await texture(path.join(path.dirname(file), img.uri));
      else {
        const bv = g.bufferViews[img.bufferView];
        const key = file + '#' + img.bufferView;
        if (!texCache[key]) {
          const { data, info } = await sharp(bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          texCache[key] = { data, w: info.width, h: info.height };
        }
        tex = texCache[key];
      }
    }
    mats.push({ tex, f });
  }
  const P = [], N = [], C = [], I = [];
  // Skinned meshes are taken in their bind pose (vertex data as stored).
  function visit(ni, parent) {
    const node = g.nodes[ni], m = node.skin != null ? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] : mul(parent, trs(node));
    if (node.mesh != null) for (const pr of g.meshes[node.mesh].primitives) {
      const base = P.length / 3, pos = acc(pr.attributes.POSITION), nor = acc(pr.attributes.NORMAL);
      const uv = pr.attributes.TEXCOORD_0 != null ? acc(pr.attributes.TEXCOORD_0) : null;
      const mat = mats[pr.material] || { tex: null, f: [0.8, 0.8, 0.8, 1] };
      for (let v = 0; v < pos.length / 3; v++) {
        const [x, y, z] = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
        P.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
        const [a, b, c] = [nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]];
        const nx = m[0] * a + m[4] * b + m[8] * c, ny = m[1] * a + m[5] * b + m[9] * c, nz = m[2] * a + m[6] * b + m[10] * c;
        const l = Math.hypot(nx, ny, nz) || 1; N.push(nx / l, ny / l, nz / l);
        let r = mat.f[0], gg = mat.f[1], bb = mat.f[2]; // Kenney's flat colours are authored as sRGB
        if (mat.tex && uv) {
          const t = mat.tex, u = uv[v * 2] - Math.floor(uv[v * 2]), w = uv[v * 2 + 1] - Math.floor(uv[v * 2 + 1]);
          const px = Math.min(t.w - 1, Math.floor(u * t.w)), py = Math.min(t.h - 1, Math.floor(w * t.h)), o = (py * t.w + px) * 4;
          r *= t.data[o] / 255; gg *= t.data[o + 1] / 255; bb *= t.data[o + 2] / 255;
        }
        C.push(Math.round(r * 255), Math.round(gg * 255), Math.round(bb * 255));
      }
      if (pr.indices != null) for (const i of acc(pr.indices)) I.push(base + i);
      else for (let i = 0; i < pos.length / 3; i++) I.push(base + i);
    }
    for (const c of node.children || []) visit(c, m);
  }
  for (const r of g.scenes[g.scene || 0].nodes) visit(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return { P, N, C, I };
}

const b64 = ta => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength).toString('base64');
// tint: [hueMin, hueMax] — vertices of that hue become neutral and are flagged (t) so the game can recolour
// them per instance (e.g. the suburban roofs).
function pack({ P, N, C, I }, tint) {
  let T = null;
  if (tint) {
    T = new Uint8Array(C.length / 3);
    for (let v = 0; v < T.length; v++) {
      const r = C[v * 3] / 255, g = C[v * 3 + 1] / 255, b = C[v * 3 + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      if (!d || d / mx < 0.25) continue;
      let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
      if (h < tint[0] || h > tint[1]) continue;
      T[v] = 1; const gray = Math.round(Math.min(1, mx * 1.08) * 255); C[v * 3] = C[v * 3 + 1] = C[v * 3 + 2] = gray;
    }
  }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i++) { min[i % 3] = Math.min(min[i % 3], P[i]); max[i % 3] = Math.max(max[i % 3], P[i]); }
  // The game shades flat (normals come from the screen-space derivatives), so vertices that only differed
  // by normal/UV merge once quantized: about a third of the original vertex count.
  const q = [], c = [], t = [], seen = new Map(), remap = new Array(P.length / 3);
  for (let v = 0; v < P.length / 3; v++) {
    const qq = [0, 1, 2].map(k => Math.round((P[v * 3 + k] - min[k]) / (max[k] - min[k] || 1) * 65535) - 32768);
    const key = qq.join(',') + '|' + C[v * 3] + ',' + C[v * 3 + 1] + ',' + C[v * 3 + 2] + (T ? '|' + T[v] : '');
    if (!seen.has(key)) { seen.set(key, q.length / 3); q.push(...qq); c.push(C[v * 3], C[v * 3 + 1], C[v * 3 + 2]); if (T) t.push(T[v]); }
    remap[v] = seen.get(key);
  }
  const I2 = [];
  for (let i = 0; i < I.length; i += 3) { const a = remap[I[i]], b = remap[I[i + 1]], d = remap[I[i + 2]]; if (a !== b && b !== d && a !== d) I2.push(a, b, d); }
  const idx = q.length / 3 > 65535 ? Uint32Array.from(I2) : Uint16Array.from(I2);
  return { min: min.map(v => +v.toFixed(4)), max: max.map(v => +v.toFixed(4)), p: b64(Int16Array.from(q)), c: b64(Uint8Array.from(c)), i: b64(idx), i32: idx instanceof Uint32Array ? 1 : 0, t: T ? b64(Uint8Array.from(t)) : undefined };
}
// Composite model: parts = [['pack/model', x, y, z, rotY(deg), scale], ...] merged into one mesh (stacked tower
// floors, a coaster made of track pieces and supports...).
async function compose(parts) {
  const out = { P: [], N: [], C: [], I: [] };
  for (const [src, x = 0, y = 0, z = 0, deg = 0, sc = 1] of parts) {
    const m = await read(glbPath(...src.split('/'))), a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), base = out.P.length / 3;
    for (let v = 0; v < m.P.length; v += 3) {
      const px = m.P[v] * sc, py = m.P[v + 1] * sc, pz = m.P[v + 2] * sc;
      out.P.push(px * c + pz * s + x, py + y, -px * s + pz * c + z);
      out.N.push(m.N[v] * c + m.N[v + 2] * s, m.N[v + 1], -m.N[v] * s + m.N[v + 2] * c);
    }
    out.C.push(...m.C); for (const i of m.I) out.I.push(base + i);
  }
  return out;
}
module.exports = { read, compose };
const glbPath = (pack, model) => {
  for (const sub of ['', 'Models/GLB format', 'Models/GLTF format']) {
    const f = path.join(SRC, pack, sub, model + '.glb');
    if (fs.existsSync(f)) return f;
  }
  throw new Error('missing model ' + pack + '/' + model);
};

if (require.main === module) (async () => {
  const args = process.argv.slice(2);
  const models = {};
  let out = CUSTOM ? path.resolve(args[1]) : path.join(__dirname, '..', 'obur-delik', 'models.js');
  if (args[0] === '--all') {
    const dir = path.join(args[1]);
    out = args[2];
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.glb')).sort()) models[f.replace(/\.glb$/, '')] = pack(await read(path.join(dir, f)));
  } else {
    for (const key in MANIFEST) {
      const e = typeof MANIFEST[key] === 'string' ? { src: MANIFEST[key] } : MANIFEST[key];
      models[key] = pack(e.parts ? await compose(e.parts) : await read(glbPath(...e.src.split('/'))), e.tint);
    }
  }
  fs.writeFileSync(out, '// Generated by scripts/kenney-convert.js from Kenney / KayKit asset packs (CC0, www.kenney.nl, www.kaylousberg.com).\nwindow.' + GLOBAL + ' = ' + JSON.stringify(models) + ';\n');
  console.log(GLOBAL + ': ' + Object.keys(models).length + ' models, ' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB → ' + out);
})();
