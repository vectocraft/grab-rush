// 3D renderer for Hungry Hole (Three.js). World x -> x, world y -> z, height -> y.
// Props are Kenney models (models.js, vertex-coloured, flat shaded), instanced per model: a few dozen draw
// calls in total; only moving/falling props are rewritten each frame. Holes are real openings: each hole
// writes a stencil mask, the ground skips the masked pixels and a dark shaft is drawn there, so props are
// seen tipping over the rim and sinking inside. Delik3D.init(canvas) returns null without WebGL.
(function () {
  'use strict';
  if (!window.THREE) return;
  const T = window.THREE;

  // Decoded model geometries (shared by every level), origin at the bottom centre.
  const GEO = {};
  const SHOT = /[?&]shot/.test((typeof location !== 'undefined' && location.search) || '');
  const b64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  function modelGeo(key) {
    if (GEO[key]) return GEO[key];
    const m = window.HOLE_MODELS && window.HOLE_MODELS[key];
    if (!m) return null;
    const q = new Int16Array(b64(m.p)), p = new Float32Array(q.length);
    const cx = (m.min[0] + m.max[0]) / 2, cz = (m.min[2] + m.max[2]) / 2;
    for (let j = 0; j < q.length; j++) { const a = j % 3; p[j] = m.min[a] + (q[j] + 32768) / 65535 * (m.max[a] - m.min[a]) - (a === 0 ? cx : a === 1 ? m.min[1] : cz); }
    const c8 = new Uint8Array(b64(m.c)), cf = new Float32Array(c8.length);
    for (let j = 0; j < c8.length; j++) { const v = c8[j] / 255; cf[j] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(p, 3));
    g.setAttribute('color', new T.BufferAttribute(cf, 3));
    const tint = m.t ? Float32Array.from(new Uint8Array(b64(m.t))) : new Float32Array(p.length / 3);
    g.setAttribute('tint', new T.BufferAttribute(tint, 1));
    g.setIndex(new T.BufferAttribute(m.i32 ? new Uint32Array(b64(m.i)) : new Uint16Array(b64(m.i)), 1));
    g.userData = { w: m.max[0] - m.min[0], h: m.max[1] - m.min[1], d: m.max[2] - m.min[2] };
    return (GEO[key] = g);
  }

  window.Delik3D = {
    init(canvas) {
      let renderer;
      try { renderer = new T.WebGLRenderer({ canvas, antialias: true, stencil: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
      if (!renderer.getContext()) return null;
      const aq = { pr: Math.min(1.5, window.devicePixelRatio || 1), acc: 0, n: 0, last: 0 };
      renderer.setPixelRatio(aq.pr);
      // Adaptive quality for slow phones: frames averaging over 20 ms (under ~50 fps) lower the pixel ratio in
      // 0.25 steps down to 1. Models, shadows and effects stay as they are.
      const autoQ = () => {
        const now = performance.now(), d = now - aq.last; aq.last = now;
        if (d > 0 && d < 250) { aq.acc += d; aq.n++; }
        if (aq.acc > 2500) { const avg = aq.acc / aq.n; aq.acc = aq.n = 0; if (avg > 20 && aq.pr > 1) { aq.pr = Math.max(1, aq.pr - 0.25); renderer.setPixelRatio(aq.pr); } }
      };
      if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(46, 1, 10, 8000);
      const hemi = new T.HemisphereLight(0xffffff, 0x6a7a60, 1.9); scene.add(hemi);
      const sun = new T.DirectionalLight(0xfff2dd, 2.2); sun.position.set(-300, 600, 400); scene.add(sun);
      scene.fog = new T.Fog(0xbfe6ff, 1800, 4200);

      const tex = (w, h, draw, rep) => {
        const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
        const t = new T.CanvasTexture(c); if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace;
        if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; }
        return t;
      };
      const zebraTex = tex(64, 16, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#fff'; for (let x = 2; x < w; x += 9) g.fillRect(x, 0, 5, h); });
      const checkerTex = tex(64, 64, (g) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#ef5a6f'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32); g.fillStyle = 'rgba(239,90,111,.35)'; g.fillRect(32, 0, 32, 32); g.fillRect(0, 32, 32, 32); }, true);
      const plankTex = tex(64, 64, (g) => { g.fillStyle = '#c99a5b'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#a8783f'; for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 2); g.fillStyle = 'rgba(255,255,255,.12)'; for (let y = 4; y < 64; y += 16) g.fillRect(0, y, 64, 3); }, true);
      const waterTex = tex(64, 64, (g) => { g.fillStyle = '#2fb3e0'; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; for (let y = 8; y < 64; y += 16) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(16, y - 5, 32, y + 5, 64, y); g.stroke(); } }, true);
      // Surface detail, drawn light so the theme colour tints it: asphalt grain, paver joints, grass blades, soft blob shadow.
      const noiseFill = (g, w, h, base, amp, n) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { const v = Math.random() * amp; g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0,' : '255,255,255,') + v + ')'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } };
      const asphaltTex = tex(128, 128, (g, w, h) => { noiseFill(g, w, h, '#f2f2f2', 0.16, 2600); g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let i = 0; i < 6; i++) { x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); } }, true);
      // Plaza paving: square stone slabs with bevel highlights, joints and per-slab tone (tinted by the map's pave colour).
      const plazaTex = tex(128, 128, (g, w, h) => { g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, w, h);
        for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const v = 225 + Math.floor(Math.random() * 30), X0 = x * 64 + (y ? 32 : 0);
          for (const dx of [0, -128, 128]) { const X = X0 + dx; g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v - 4) + ')'; g.fillRect(X + 3, y * 64 + 3, 58, 58);
            g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(X + 3, y * 64 + 3, 58, 3); g.fillRect(X + 3, y * 64 + 3, 3, 58);
            g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(X + 3, y * 64 + 58, 58, 3); g.fillRect(X + 58, y * 64 + 3, 3, 58); } }
        for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0,' : '255,255,255,') + Math.random() * 0.08 + ')'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } }, true);
      const paverTex = tex(64, 64, (g, w, h) => { noiseFill(g, w, h, '#f4f4f4', 0.08, 500); g.fillStyle = 'rgba(0,0,0,.16)'; for (let y = 0; y < h; y += 16) { g.fillRect(0, y, w, 2); for (let x = (y / 16) % 2 ? 8 : 0; x < w; x += 16) g.fillRect(x, y, 2, 16); } g.fillStyle = 'rgba(255,255,255,.12)'; for (let y = 2; y < h; y += 16) g.fillRect(0, y, w, 1); }, true);
      const grassTex = tex(128, 128, (g, w, h) => { noiseFill(g, w, h, '#f0f0f0', 0.1, 900); for (let i = 0; i < 700; i++) { const x = Math.random() * w, y = Math.random() * h, l = 2 + Math.random() * 4; g.strokeStyle = Math.random() < 0.5 ? 'rgba(0,40,0,.16)' : 'rgba(255,255,220,.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 2, y - l); g.stroke(); } for (let k = 0; k < 6; k++) { const x = Math.random() * w, y = Math.random() * h, r = 10 + Math.random() * 18, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,30,0,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); } }, true);
      const blobTex = tex(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(0,0,0,.42)'); r.addColorStop(0.55, 'rgba(0,0,0,.28)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
      const glowTex = tex(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
      const shaftTex = tex(8, 128, (g) => { const r = g.createLinearGradient(0, 0, 0, 128); r.addColorStop(0, '#2a2a3a'); r.addColorStop(0.18, '#0b0b12'); r.addColorStop(1, '#000'); g.fillStyle = r; g.fillRect(0, 0, 8, 128); });
      // ---------- Effect skins: rim texture, halo glow, galaxy inside ----------
      // Ring geometries are mapped flat (UV = position), so rim art is drawn in a band near the texture edge.
      const stars = (g, n, w, big) => { for (let i = 0; i < n; i++) { const a = Math.random(); g.fillStyle = 'rgba(255,255,255,' + (0.6 + a * 0.4) + ')'; g.beginPath(); g.arc(Math.random() * w, Math.random() * w, (a < 0.85 ? 1.4 : 3) * (big || 1), 0, 7); g.fill(); } };
      const galaxyTex = tex(256, 256, (g, w) => {
        const bg = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); bg.addColorStop(0, '#3a1580'); bg.addColorStop(1, '#0a0420'); g.fillStyle = bg; g.fillRect(0, 0, w, w);
        for (let k = 0; k < 3; k++) for (let t = 0; t < 70; t++) {
          const a = t * 0.14 + k * 2.1, rr = t * 1.7, x = w / 2 + Math.cos(a) * rr, y = w / 2 + Math.sin(a) * rr, r2 = g.createRadialGradient(x, y, 0, x, y, 22);
          r2.addColorStop(0, k === 1 ? 'rgba(255,120,220,.35)' : 'rgba(170,120,255,.35)'); r2.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r2; g.fillRect(x - 22, y - 22, 44, 44);
        }
        const core = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, 46); core.addColorStop(0, 'rgba(255,245,255,1)'); core.addColorStop(0.4, 'rgba(230,180,255,.7)'); core.addColorStop(1, 'rgba(160,110,255,0)'); g.fillStyle = core; g.fillRect(0, 0, w, w);
        stars(g, 220, w, 1.4);
      });
      // Rim art: colour by angle around the ring (conic), plus extras in the ring band.
      const ringTex = (colAt, extra) => tex(256, 256, (g, w) => {
        for (let a = 0; a < 360; a += 2) { g.fillStyle = colAt(a); g.beginPath(); g.moveTo(w / 2, w / 2); g.arc(w / 2, w / 2, w / 2, a * Math.PI / 180, (a + 2.5) * Math.PI / 180); g.fill(); }
        if (extra) extra(g, w);
      });
      const bandStars = (g, w) => { for (let i = 0; i < 70; i++) { const a = Math.random() * 7, r = w / 2 * (0.86 + Math.random() * 0.12); g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2 + Math.cos(a) * r, w / 2 + Math.sin(a) * r, 1 + Math.random() * 2, 0, 7); g.fill(); } };
      const FX_TEX = {
        galaxy: { rim: ringTex(a => 'hsl(' + (265 + 45 * Math.sin(a * Math.PI / 90)) + ',85%,' + (45 + 15 * Math.sin(a * Math.PI / 30)) + '%)', bandStars), glow: '#b07bff', inside: galaxyTex },
        rainbow: { rim: ringTex(a => 'hsl(' + a + ',95%,60%)'), glow: '#ffffff' },
        lava: { rim: ringTex(a => 'hsl(' + (12 + 20 * Math.abs(Math.sin(a * Math.PI / 25))) + ',100%,' + (45 + 12 * Math.sin(a * 0.4)) + '%)'), glow: '#ff6a1a' },
        neon: { rim: ringTex(a => (Math.floor(a / 12) % 2 ? '#b9fbff' : '#22d3ee')), glow: '#22d3ee' },
        gold: { rim: ringTex(a => 'hsl(45,100%,' + (45 + 30 * Math.pow(Math.abs(Math.sin(a * Math.PI / 60)), 8)) + '%)'), glow: '#ffcf3f' },
      };
      // Halo: a plane with a soft ring of light just outside the rim.
      const haloTex = tex(256, 256, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.6, 'rgba(255,255,255,0)'); r.addColorStop(0.7, 'rgba(255,255,255,.95)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
      const mats = {};
      // Ground pieces skip the pixels inside holes (stencil 1).
      const groundStencil = m => { m.stencilWrite = true; m.stencilRef = 1; m.stencilFunc = T.NotEqualStencilFunc; m.stencilZPass = T.KeepStencilOp; return m; };
      const lam = (c, o) => (o ? groundStencil(new T.MeshLambertMaterial(Object.assign({ color: c }, o))) : mats[c] || (mats[c] = groundStencil(new T.MeshLambertMaterial({ color: c }))));
      const basic = c => mats['b' + c] || (mats['b' + c] = new T.MeshBasicMaterial({ color: c }));
      // Props: vertex colours; vertices flagged `tint` take the instance colour (e.g. roofs).
      const propMat = new T.MeshLambertMaterial({ vertexColors: true, flatShading: true });
      propMat.onBeforeCompile = sh => {
        sh.vertexShader = 'attribute float tint;\n' + sh.vertexShader.replace('#include <color_vertex>',
          'vColor = vec3(1.0);\n#ifdef USE_COLOR\nvColor *= color;\n#endif\n#ifdef USE_INSTANCING_COLOR\nvColor.xyz *= mix(vec3(1.0), instanceColor.xyz, tint);\n#endif');
      };
      // Fallback shape when a model is missing.
      const boxGeo = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      boxGeo.setAttribute('color', new T.BufferAttribute(new Float32Array(boxGeo.attributes.position.count * 3).fill(0.7), 3));
      boxGeo.setAttribute('tint', new T.BufferAttribute(new Float32Array(boxGeo.attributes.position.count).fill(1), 1));
      boxGeo.userData = { w: 1, h: 1, d: 1 };

      const world = new T.Group(); scene.add(world);
      let level = null, inst = {}, holes = [], pups = [], water = null;
      const dummy = new T.Object3D(), objM = new T.Matrix4(), tmp = new T.Matrix4(), tmpColor = new T.Color(), v3 = new T.Vector3(), zero = new T.Matrix4().makeScale(0, 0, 0);
      const white = new T.Color('#ffffff');

      function clearWorld() {
        while (world.children.length) { const c = world.children.pop(); if (c.isInstancedMesh) c.dispose(); }
        inst = {}; holes = []; pups = []; water = null; shadows = null;
      }

      // Object -> matrix: position, yaw, sinking and tilting toward the hole while it falls.
      function objMatrix(o) {
        let y = 0, tx = 0, tz = 0;
        if (o.state === 1) {
          const k = o.ft;
          y = -k * k * ((o.vh || o.h) + 18);
          tx = (o.tdy || 0) * k * 1.25; tz = -(o.tdx || 0) * k * 1.25;
        }
        dummy.position.set(o.x, y + (o.alt || 0), o.y);
        dummy.rotation.set(tx, o.rot || 0, tz, 'XZY');
        if (o.mv === 'walk') dummy.position.y += Math.abs(Math.sin(o.walk || 0)) * 0.8;
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        return dummy.matrix;
      }
      // Only the changed range of an instance buffer is uploaded (4x maps have thousands of instances per model).
      // Soft contact shadow under every prop (one instanced quad each), offset away from the sun by the prop's height.
      let shadows = null;
      function shadowMatrix(o) {
        if (o.state) return zero;
        const r = o.s * (o.type === 'person' ? 1.4 : 2.1), off = Math.min(o.h || 10, 60) * 0.18;
        dummy.position.set(o.x + off, 0.95, o.y - off * 0.6); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(r * 1.25, r, 1); dummy.updateMatrix();
        return dummy.matrix;
      }
      // Pops: a burst of light where an object tips into the hole.
      const POP_N = 24, pops = [];
      const popMat = () => new T.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
      function pop(x, y, z, color, size) {
        let p = pops.find(q => q.life <= 0);
        if (!p) { if (pops.length >= POP_N) return; p = { s: new T.Sprite(popMat()), life: 0 }; p.s.renderOrder = 5; scene.add(p.s); pops.push(p); }
        p.s.material.color.set(color); p.s.position.set(x, y, z); p.life = p.max = 0.35; p.size = size; p.s.visible = true;
      }
      function writeObj(o, dirty) {
        if (o.state === 1 && !o._popped) { o._popped = 1; const hc = (level && level.me && level.me.c) || '#ffffff'; pop(o.x, (o.vh || o.h || 10) * 0.6, o.y, hc, Math.max(14, o.s * 3)); }
        if (shadows && o.si != null) { shadows.setMatrixAt(o.si, shadowMatrix(o)); shadows.instanceMatrix.needsUpdate = true; }
        const it = inst[o.ik || o.m || o.type];
        if (!it) return;
        if (o.state === 2) it.mesh.setMatrixAt(o.ti, zero);
        else it.mesh.setMatrixAt(o.ti, tmp.multiplyMatrices(objMatrix(o), o.pm));
        const d = dirty.get(it.mesh);
        if (d) { d[0] = Math.min(d[0], o.ti); d[1] = Math.max(d[1], o.ti); } else dirty.set(it.mesh, [o.ti, o.ti]);
      }
      // Scale a model into its role: footprint radius o.s, height capped near the role's height.
      function fitMatrix(o, g) {
        const u = g.userData, ext = Math.max(u.w, u.d) || 1;
        const foot = 2 * o.s * (o.type === 'person' ? 1.6 : 1) / ext, cap = o.h * (o.type === 'tower' ? 1.8 : 1.7) / (u.h || 1);
        const k = Math.min(foot, cap);
        o.vh = u.h * k;
        return new T.Matrix4().makeScale(k, k, k);
      }

      function buildGround(S) {
        const th = S.map, M = S.M, P = S.P, RD = S.ROAD, n = S.n, flat = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
        const reset = () => { dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); };
        const flats = (geo, count, mat, y, fn) => {
          const m = new T.InstancedMesh(geo, mat, count);
          for (let i = 0; i < count; i++) { fn(i, dummy); dummy.position.y = y; dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }
          m.frustumCulled = false; world.add(m); return m;
        };
        // Outside the map: grass/snow, or the sea around the cove.
        const outerMat = th.ground === 'beach' ? lam('#ffffff', { map: waterTex }) : lam(th.edge);
        if (th.ground !== 'beach') { outerMat.map = grassTex; outerMat.needsUpdate = true; }
        const outer = new T.Mesh(flat, outerMat); outer.scale.set(M + 6000, 1, M + 6000); outer.position.set(M / 2, -0.8, M / 2); world.add(outer);
        if (th.ground === 'beach') { waterTex.repeat.set((M + 6000) / 120, (M + 6000) / 120); water = waterTex; }
        // Streets / paths / boardwalks / tablecloth under the whole map.
        const roadMat = th.ground === 'table' ? lam('#ffffff', { map: checkerTex }) : th.ground === 'beach' ? lam('#ffffff', { map: plankTex }) : lam(th.road, { map: asphaltTex });
        asphaltTex.repeat.set((M + RD) / 90, (M + RD) / 90); paverTex.repeat.set(1, 1);
        if (th.ground === 'table') checkerTex.repeat.set((M + RD) / 70, (M + RD) / 70);
        if (th.ground === 'beach') plankTex.repeat.set((M + RD) / 40, (M + RD) / 40);
        const ground = new T.Mesh(flat, roadMat); ground.scale.set(M + RD, 1, M + RD); ground.position.set(M / 2, 0, M / 2); world.add(ground);
        // Blocks: plates on the picnic table, slabs elsewhere.
        const blockGeo = th.ground === 'table' ? new T.CircleGeometry(0.5, 40).rotateX(-Math.PI / 2) : flat;
        flats(blockGeo, S.blocks.length, th.ground === 'city' ? lam(th.walk, { map: paverTex }) : lam(th.walk), 0.4, (i) => { const b = S.blocks[i]; reset(); dummy.position.set((b.i + 0.5) * P, 0, (b.j + 0.5) * P); dummy.scale.set(P - RD, 1, P - RD); });
        // Lawns get grass; plazas / downtown get their own stone paving instead of tinted grass.
        const paved = b => th.ground !== 'table' && b.kind !== 'park' && b.kind !== 'houses';
        const surf = flats(blockGeo, S.blocks.length, th.ground === 'table' ? lam('#ffffff') : lam('#ffffff', { map: grassTex }), 0.8, (i) => { const b = S.blocks[i]; reset(); dummy.position.set((b.i + 0.5) * P, 0, (b.j + 0.5) * P); const k = paved(b) ? 0.0001 : P - RD - 18; dummy.scale.set(k, 1, k); });
        S.blocks.forEach((b, i) => surf.setColorAt(i, tmpColor.set(b.col || (b.kind === 'park' ? th.park : b.kind === 'houses' ? th.lawn : th.pave))));
        const plazas = S.blocks.filter(paved);
        if (plazas.length) {
          plazaTex.repeat.set((P - RD - 18) / 24, (P - RD - 18) / 24);
          const pm = flats(flat, plazas.length, lam('#ffffff', { map: plazaTex }), 0.8, (i) => { const b = plazas[i]; reset(); dummy.position.set((b.i + 0.5) * P, 0, (b.j + 0.5) * P); dummy.scale.set(P - RD - 18, 1, P - RD - 18); });
          plazas.forEach((b, i) => pm.setColorAt(i, tmpColor.set(b.col || th.pave)));
        }
        if (th.ground !== 'city') return;
        // Lane dashes on the inner roads, between intersections.
        const dashes = [];
        for (let k = 1; k < n; k++) for (let i = 0; i < n; i++) for (let a = i * P + RD / 2 + 12; a < (i + 1) * P - RD / 2 - 8; a += 18) dashes.push([k * P, a, 0], [a, k * P, 1]);
        flats(flat, dashes.length, lam(th.line), 0.3, (i) => { const [x, z, ax] = dashes[i]; reset(); dummy.position.set(x, 0, z); dummy.scale.set(ax ? 9 : 1.4, 1, ax ? 1.4 : 9); });
        // Crosswalks on all four sides of every intersection.
        const zebra = [];
        for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) for (const [dx, dz, rot] of [[0, -1, 0], [0, 1, 0], [-1, 0, 1], [1, 0, 1]]) zebra.push([i * P + dx * (RD / 2 + 5), j * P + dz * (RD / 2 + 5), rot]);
        flats(flat, zebra.length, groundStencil(new T.MeshLambertMaterial({ map: zebraTex, transparent: true, color: th.line })), 0.35, (i) => { const [x, z, rot] = zebra[i]; reset(); dummy.position.set(x, 0, z); dummy.rotation.y = rot ? Math.PI / 2 : 0; dummy.scale.set(RD - 4, 1, 8); });
      }

      // Rim colour of animated skins.
      function rimColor(h, time) {
        switch (h.skinFx) {
          case 'rainbow': return tmpColor.setHSL((time * 0.25) % 1, 0.95, 0.6);
          case 'lava': return tmpColor.setHSL(0.03 + 0.04 * Math.sin(time * 3), 1, 0.5 + 0.08 * Math.sin(time * 5));
          case 'neon': return tmpColor.setHSL(0.52, 0.95, 0.5 + 0.18 * Math.sin(time * 6));
          case 'galaxy': return tmpColor.setHSL(0.74 + 0.04 * Math.sin(time * 2), 0.85, 0.62 + 0.1 * Math.sin(time * 7));
          default: return tmpColor.set(h.c);
        }
      }

      // Shop picture of a hole skin: the hole (rim, glow, effect inside) on a patch of street with a car tipping in,
      // rendered once per skin by a small offscreen renderer.
      const thumbs = {}; let tR = null;
      function thumb(color, fxKind) {
        const key = color + (fxKind || ''); if (thumbs[key]) return thumbs[key];
        if (!tR) { try { tR = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, stencil: true }); tR.setSize(150, 150, false); if ('outputColorSpace' in tR) tR.outputColorSpace = T.SRGBColorSpace; } catch (e) { tR = false; } }
        if (!tR) return null;
        const sc = new T.Scene(); sc.add(new T.HemisphereLight(0xffffff, 0x8890a0, 1.4)); const sl = new T.DirectionalLight(0xffffff, 1.8); sl.position.set(-30, 60, 40); sc.add(sl);
        const ground = new T.Mesh(new T.CircleGeometry(30, 40), new T.MeshLambertMaterial({ color: '#7a828e', stencilWrite: true, stencilRef: 1, stencilFunc: T.NotEqualStencilFunc })); ground.rotation.x = -Math.PI / 2; ground.position.y = 1.5; ground.renderOrder = 1; sc.add(ground);
        const stripe = new T.Mesh(new T.PlaneGeometry(52, 2.4), new T.MeshBasicMaterial({ color: '#f4f1ea', stencilWrite: true, stencilRef: 1, stencilFunc: T.NotEqualStencilFunc })); stripe.rotation.x = -Math.PI / 2; stripe.position.set(0, 1.55, 15); stripe.renderOrder = 1; sc.add(stripe);
        const g = new T.Group(); g.scale.set(14, 1, 14); sc.add(g);
        const fx = fxKind && FX_TEX[fxKind];
        const mask = new T.Mesh(new T.CircleGeometry(1, 48), new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: 1, stencilFunc: T.AlwaysStencilFunc, stencilZPass: T.ReplaceStencilOp }));
        mask.rotation.x = -Math.PI / 2; mask.position.y = 1.6; mask.renderOrder = -1; g.add(mask);
        const shaft = new T.Mesh(new T.CylinderGeometry(1, 1, 30, 48, 1, true).translate(0, -15, 0), new T.MeshBasicMaterial({ map: shaftTex, side: T.BackSide, stencilWrite: true, stencilRef: 1, stencilFunc: T.EqualStencilFunc })); shaft.renderOrder = 2; g.add(shaft);
        const rim = new T.Mesh(new T.RingGeometry(0.94, fx ? 1.16 : 1.1, 64), new T.MeshBasicMaterial(fx ? { map: fx.rim } : { color })); rim.rotation.x = -Math.PI / 2; rim.position.y = 1.7; rim.renderOrder = 4; g.add(rim);
        if (fx && fx.inside) { const sw = new T.Mesh(new T.CircleGeometry(0.98, 48), new T.MeshBasicMaterial({ map: fx.inside, stencilWrite: true, stencilRef: 1, stencilFunc: T.EqualStencilFunc })); sw.rotation.x = -Math.PI / 2; sw.position.y = -2; sw.renderOrder = 3; g.add(sw); }
        const glow = new T.Mesh(new T.PlaneGeometry(3, 3), new T.MeshBasicMaterial({ map: haloTex, color: fx ? fx.glow : color, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.7 })); glow.rotation.x = -Math.PI / 2; glow.position.y = 1.65; glow.renderOrder = 4; g.add(glow);
        // A little car tipping into the hole.
        const car = new T.Group(); car.position.set(9, 4, 4); car.rotation.set(0.5, -0.6, 0.35); sc.add(car);
        car.add(new T.Mesh(new T.BoxGeometry(9, 3, 5), new T.MeshLambertMaterial({ color: '#e23b3b' }))); const cab = new T.Mesh(new T.BoxGeometry(5, 2.4, 4.4), new T.MeshLambertMaterial({ color: '#9fd8ff' })); cab.position.set(-0.5, 2.6, 0); car.add(cab);
        const cam = new T.PerspectiveCamera(32, 1, 1, 400); cam.position.set(0, 50, 40); cam.lookAt(0, 0, 3);
        tR.clear(); tR.render(sc, cam);
        return (thumbs[key] = tR.domElement.toDataURL('image/png'));
      }
      const R = {
        thumb,
        is3D: true,
        setLevel(S) {
          clearWorld();
          level = S;
          const th = S.map;
          scene.background = new T.Color(th.sky); scene.fog.color.set(th.sky);
          hemi.intensity = th.night ? 1.2 : 1.45; sun.intensity = th.night ? 1.5 : 2.9;
          hemi.groundColor.set(th.night ? '#20243a' : '#6a7a60');
          sun.color.set(th.night ? '#9fb0ff' : '#fff2dd');
          buildGround(S);
          // Instanced props, one mesh per model. Big maps split the static props into 800-unit chunks with real
          // bounds, so the GPU only draws the chunks the camera sees (it drew all ~10k props every frame before);
          // moving props keep one mesh per model that is always drawn.
          const byModel = {}, CH = 800;
          let x0 = Infinity, x1 = -Infinity; for (const o of S.objs) { x0 = Math.min(x0, o.x); x1 = Math.max(x1, o.x); }
          const chunked = x1 - x0 > 1600;
          for (const o of S.objs) { o.ik = (o.mv ? '~' : '') + (o.m || o.type) + (chunked && !o.mv ? '|' + Math.floor(o.x / CH) + ',' + Math.floor(o.y / CH) : ''); (byModel[o.ik] = byModel[o.ik] || []).push(o); }
          for (const key in byModel) {
            const objs = byModel[key], g = modelGeo(key.replace(/^~/, '').replace(/\|.*$/, '')) || boxGeo;
            const mesh = new T.InstancedMesh(g, propMat, objs.length);
            objs.forEach((o, i) => {
              o.ti = i; o.pm = g === boxGeo ? new T.Matrix4().makeScale(o.s * 1.6, o.h, o.s * 1.6) : fitMatrix(o, g);
              mesh.setMatrixAt(i, tmp.multiplyMatrices(objMatrix(o), o.pm));
              mesh.setColorAt(i, o.tint ? tmpColor.set(o.tint) : g === boxGeo ? tmpColor.set(o.c || '#cccccc') : white);
            });
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            if (key.includes('|')) { mesh.computeBoundingSphere(); mesh.boundingSphere.radius += 30; mesh.frustumCulled = true; }
            else mesh.frustumCulled = false;
            mesh.renderOrder = 3;
            world.add(mesh);
            inst[key] = { mesh };
          }
          { const sh = S.objs.filter(o => o.type !== 'person' || o.s > 3);
            shadows = new T.InstancedMesh(new T.PlaneGeometry(1, 1), groundStencil(new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })), sh.length);
            sh.forEach((o, i) => { o.si = i; shadows.setMatrixAt(i, shadowMatrix(o)); });
            shadows.frustumCulled = false; shadows.renderOrder = 1; world.add(shadows); }
          // Raised decks (4x maps): a slab with a bright rim on four legs.
          for (const dk of S.decks || []) {
            const c = (S.map.deck || {}).color || '#8a94a6', tr = (S.map.deck || {}).trim || '#ffd23f';
            const slab = new T.Mesh(new T.CylinderGeometry(dk.r, dk.r, 3, 32), lam(c)); slab.position.set(dk.x, dk.h + 1.5, dk.y); world.add(slab);
            const rim = new T.Mesh(new T.TorusGeometry(dk.r, 1.2, 6, 40).rotateX(Math.PI / 2), lam(tr)); rim.position.set(dk.x, dk.h + 3, dk.y); world.add(rim);
            dk.meshes = [slab, rim];
            for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4, leg = new T.Mesh(new T.CylinderGeometry(2.2, 2.6, dk.h, 8).translate(0, dk.h / 2, 0), lam(c)); leg.position.set(dk.x + Math.cos(a) * (dk.r - 6), 0, dk.y + Math.sin(a) * (dk.r - 6)); world.add(leg); dk.meshes.push(leg); }
          }
          // Holes: stencil mask disc, dark shaft, coloured rim.
          for (const h of S.holes) {
            const g = new T.Group();
            const mask = new T.Mesh(new T.CircleGeometry(1, 48), new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: 1, stencilFunc: T.AlwaysStencilFunc, stencilZPass: T.ReplaceStencilOp }));
            mask.rotation.x = -Math.PI / 2; mask.position.y = 1.6; mask.renderOrder = -1; g.add(mask);
            const shaft = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 48, 1, true).translate(0, -0.5, 0), new T.MeshBasicMaterial({ map: shaftTex, side: T.BackSide, stencilWrite: true, stencilRef: 1, stencilFunc: T.EqualStencilFunc }));
            shaft.renderOrder = 2; g.add(shaft);
            const bottom = new T.Mesh(new T.CircleGeometry(1, 32), basic('#000000')); bottom.rotation.x = -Math.PI / 2; bottom.renderOrder = 2; g.add(bottom);
            const fx = h.skinFx && FX_TEX[h.skinFx];
            const rim = new T.Mesh(new T.RingGeometry(0.94, fx ? 1.16 : 1.1, 64), new T.MeshBasicMaterial(fx ? { map: fx.rim } : { color: h.c }));
            rim.rotation.x = -Math.PI / 2; rim.position.y = 1.4; rim.renderOrder = 4; g.add(rim);
            let halo = null, swirl = null;
            if (fx) {
              halo = new T.Mesh(new T.PlaneGeometry(3.4, 3.4), new T.MeshBasicMaterial({ map: haloTex, color: fx.glow, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
              halo.rotation.x = -Math.PI / 2; halo.position.y = 1.2; halo.renderOrder = 4; g.add(halo);
              if (fx.inside) {
                swirl = new T.Mesh(new T.CircleGeometry(0.98, 48), new T.MeshBasicMaterial({ map: fx.inside, stencilWrite: true, stencilRef: 1, stencilFunc: T.EqualStencilFunc }));
                swirl.rotation.x = -Math.PI / 2; swirl.position.y = -0.6; swirl.renderOrder = 3; g.add(swirl);
              }
            }
            const glow = new T.Mesh(new T.PlaneGeometry(2.9, 2.9), new T.MeshBasicMaterial({ map: haloTex, color: fx ? fx.glow : h.c, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.55 }));
            glow.rotation.x = -Math.PI / 2; glow.position.y = 1.1; glow.renderOrder = 4; g.add(glow);
            world.add(g); holes.push({ h, g, rim, shaft, bottom, halo, swirl, fx, glow });
          }
          for (let i = 0; i < 5; i++) { const m = new T.Mesh(new T.OctahedronGeometry(1, 0), basic('#ffffff')); m.visible = false; m.renderOrder = 4; world.add(m); pups.push(m); }
          camT.set(S.me.x, 0, S.me.y); camW = viewW(S);
        },
        fit() {
          const W = canvas.clientWidth || innerWidth, H = canvas.clientHeight || innerHeight;
          renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
        },
        project(x, y, h) {
          v3.set(x, h || 0, y).project(camera);
          const W = canvas.clientWidth || innerWidth, H = canvas.clientHeight || innerHeight;
          return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H };
        },
        // Test hook: eaten objects (state 2) whose instance is still drawn.
        ghosts(S) { const m = new T.Matrix4(); return S.objs.filter(o => { const it = inst[o.ik || o.m || o.type]; if (!it || o.state !== 2) return false; it.mesh.getMatrixAt(o.ti, m); return Math.abs(m.elements[0]) + Math.abs(m.elements[5]) > 1e-6; }).length; },
        render(S, dt) {
          if (S !== level) R.setLevel(S);
          const dirty = new Map(), time = performance.now() / 1000;
          for (const o of S.anim) writeObj(o, dirty);
          // A chunk the camera does not see is not drawn, so its upload waits; partial ranges from several frames would
          // overwrite each other and props a rival swallowed off screen stayed visible ("ghosts"). Culled chunks upload
          // in full (they are small); always-drawn meshes keep the cheap partial upload.
          for (const [m, [lo, hi]] of dirty) { const a = m.instanceMatrix; if (m.frustumCulled) { a.updateRange.offset = 0; a.updateRange.count = -1; } else { a.updateRange.offset = lo * 16; a.updateRange.count = (hi - lo + 1) * 16; } a.needsUpdate = true; }
          for (const dk of S.decks || []) if (dk.gone && dk.meshes && dk.meshes[0].visible) dk.meshes.forEach(m => { m.visible = false; });
          if (water) water.offset.set(time * 0.01, time * 0.006);
          for (const it of holes) {
            const h = it.h;
            let r = h.r;
            if (h.out && h.dead <= 0) r = 0;
            else if (h.dead > 0) r = h.dead > 2.3 ? h.r * (h.dead - 2.3) / 0.3 : 0;
            it.g.visible = r > 0.5;
            it.g.position.set(h.x, 0, h.y); it.g.scale.set(r, 1, r);
            const depth = r * 2.5 + 80;
            it.shaft.scale.set(1, depth, 1); it.bottom.position.y = -depth;
            if (it.fx) {
              it.rim.rotation.z = time * (h.skinFx === 'galaxy' ? 0.6 : 1.2);
              if (it.halo) it.halo.material.opacity = 0.55 + 0.35 * Math.sin(time * (h.skinFx === 'neon' ? 7 : 3));
              if (it.swirl) { it.swirl.rotation.z = -time * 0.5; it.swirl.position.y = -Math.max(0.6, r * 0.25); it.swirl.scale.setScalar(1); }
              it.rim.material.color.set(h.frozen > 0 ? '#bfefff' : '#ffffff');
            } else it.rim.material.color.copy(h.frozen > 0 ? tmpColor.set('#bfefff') : h.inv > 0 && Math.floor(h.inv * 8) % 2 ? tmpColor.set('#ffffff') : rimColor(h, time));
          }
          for (const p of pops) if (p.life > 0) { p.life -= dt; const t = 1 - p.life / p.max; p.s.scale.setScalar(p.size * (0.5 + t)); p.s.material.opacity = Math.max(0, 1 - t); if (p.life <= 0) p.s.visible = false; }
          for (const it of holes) if (it.glow) it.glow.material.opacity = 0.4 + 0.15 * Math.sin(time * 3 + it.h.x);
          pups.forEach((m, i) => {
            const p = S.pups[i];
            m.visible = !!p;
            if (!p) return;
            m.material = basic({ mag: '#ff4d6d', spd: '#ffd23f', ice: '#7dd3fc' }[p.kind]);
            m.position.set(p.x, 8 + Math.sin(time * 3 + i) * 2, p.y); m.rotation.y = time * 2; m.scale.setScalar(6);
          });
          // Camera: follows the player, zooming out as the hole grows.
          const me = S.me, k = SHOT ? 1 : Math.min(1, dt * 5);
          camT.x += (me.x - camT.x) * k; camT.z += (me.y - camT.z) * k;
          camW += (viewW(S) - camW) * (SHOT ? 1 : Math.min(1, dt * 2));
          const pitch = 52 * Math.PI / 180, hf = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
          const D = camW / 2 / Math.tan(hf) * (SHOT ? 0.62 : 1), lead = SHOT ? -0.02 : 0.08; // key art: closer, hole centred
          camera.position.set(camT.x, Math.sin(pitch) * D, camT.z + Math.cos(pitch) * D - D * lead);
          camera.lookAt(camT.x, 0, camT.z - D * lead);
          // Fog follows the zoom: a big hole pulls the camera far back, and a fixed fog would swallow the whole view.
          scene.fog.near = D * 1.7; scene.fog.far = D * 3.6; camera.far = D * 4.5; camera.updateProjectionMatrix();
          autoQ(); renderer.render(scene, camera);
        },
      };
      // Visible width: grows with the hole, but never beyond ~3/4 of the map so the city stays readable.
      const viewW = S => Math.min(250 + S.me.r * 4.6, Math.max(420, S.M * 0.72));
      const camT = new T.Vector3();
      let camW = 260;
      return R;
    },
  };
})();
