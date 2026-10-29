// 3D renderer for Arrow Legends (Three.js). World: x right, z toward the camera, y up; rooms are 26 x 42 units.
// Characters (chars.js) are 8 pre-posed frames (run x4, attack x2, idle, dead) stored as morph targets of one
// geometry, so poses blend smoothly. Dungeon props (props.js) are vertex-coloured and instanced. Effects are
// pooled particles (sparks, dust, bones) fired by the game through R.fx(kind, x, z, colour, count).
// Arrow3D.init(canvas) returns null without WebGL.
(function () {
  'use strict';
  if (!window.THREE) return;
  const T = window.THREE;
  const RW = 13, RH = 21;
  // Characters are drawn larger than their collision circles so they read well on a phone (bosses a bit less).
  const VS = s => s * (s > 2 ? 1.4 : 1.85); // drawn a bit bigger than the hit circle so faces and gear read
  // Foes are drawn smaller than that (testers: they filled the room): normal ones 0.6, bosses 0.75. Hit circles unchanged.
  const FOE_K = e => e && e.boss ? 0.75 : 0.6;
  const b64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };

  // ---------- Assets ----------
  const CH = {}, PROPS = {};
  function charGeo(name) {
    if (CH[name]) return CH[name];
    const u = window.ARROW_CHARS.chars[name];
    const cx = (u.min[0] + u.max[0]) / 2, cz = (u.min[2] + u.max[2]) / 2;
    const P = u.frames.map(f => {
      const q = new Int16Array(b64(f.p)), p = new Float32Array(q.length);
      for (let j = 0; j < q.length; j++) { const a = j % 3; p[j] = u.min[a] + (q[j] + 32768) / 65535 * (u.max[a] - u.min[a]) - (a === 0 ? cx : a === 2 ? cz : 0); }
      return p;
    });
    // Centre on the feet of the idle pose (not the box of all poses: the crossbow and the death pose pushed the
    // body off centre, so the hero stood beside its dais and its collision circle).
    { const ip = P[6]; let sx = 0, sz = 0, n = 0, my = Infinity;
      for (let j = 1; j < ip.length; j += 3) my = Math.min(my, ip[j]);
      for (let j = 0; j < ip.length; j += 3) if (ip[j + 1] < my + 0.3) { sx += ip[j]; sz += ip[j + 2]; n++; }
      if (n) { sx /= n; sz /= n; for (const p of P) for (let j = 0; j < p.length; j += 3) { p[j] -= sx; p[j + 2] -= sz; } } }
    const nIdle = Float32Array.from(new Int8Array(b64(u.frames[6].n)), v => v / 127);
    const N = u.frames.map(f => f.n ? Float32Array.from(new Int8Array(b64(f.n)), v => v / 127) : nIdle);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(P[6], 3));
    g.setAttribute('normal', new T.BufferAttribute(N[6], 3));
    g.setAttribute('uv', new T.BufferAttribute(new Uint16Array(b64(u.u)), 2, true));
    g.setIndex(new T.BufferAttribute(u.i32 ? new Uint32Array(b64(u.i)) : new Uint16Array(b64(u.i)), 1));
    g.morphAttributes.position = P.map(a => new T.BufferAttribute(a, 3));
    g.morphAttributes.normal = N.map(a => new T.BufferAttribute(a, 3));
    g.morphTargetsRelative = false;
    g.boundingSphere = new T.Sphere(new T.Vector3(0, 1.3, 0), 3);
    return (CH[name] = g);
  }
  const TEX = {};
  function charTex(key) {
    if (TEX[key]) return TEX[key];
    const img = new Image(), t = new T.Texture(img);
    img.onload = () => { t.needsUpdate = true; };
    img.src = window.ARROW_CHARS.tex[key];
    t.flipY = false; if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace;
    return (TEX[key] = t);
  }
  function propGeo(key) {
    if (PROPS[key]) return PROPS[key];
    const m = window.ARROW_PROPS[key], q = new Int16Array(b64(m.p)), p = new Float32Array(q.length);
    const cx = (m.min[0] + m.max[0]) / 2, cz = (m.min[2] + m.max[2]) / 2;
    for (let j = 0; j < q.length; j++) { const a = j % 3; p[j] = m.min[a] + (q[j] + 32768) / 65535 * (m.max[a] - m.min[a]) - (a === 0 ? cx : a === 1 ? m.min[1] : cz); }
    const c8 = new Uint8Array(b64(m.c)), cf = new Float32Array(c8.length);
    for (let j = 0; j < c8.length; j++) { const v = c8[j] / 255; cf[j] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('color', new T.BufferAttribute(cf, 3));
    g.setIndex(new T.BufferAttribute(m.i32 ? new Uint32Array(b64(m.i)) : new Uint16Array(b64(m.i)), 1));
    g.userData = { w: m.max[0] - m.min[0], h: m.max[1] - m.min[1], d: m.max[2] - m.min[2] };
    return (PROPS[key] = g);
  }
  // Small canvas textures.
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; }
    return t;
  }
  const radial = stops => canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); stops.forEach(([o, c]) => r.addColorStop(o, c)); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });

  window.Arrow3D = {
    init(canvas, opts) {
      if (!window.ARROW_CHARS || !window.ARROW_PROPS) return null;
      let renderer;
      // opts.alpha: transparent canvas (scripts/skin-art.html bakes the outfit portraits with it).
      try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: !!(opts && opts.alpha), preserveDrawingBuffer: !!(opts && opts.alpha) }); } catch (e) { return null; }
      if (!renderer.getContext()) return null;
      // Sharp characters: render close to the screen's real resolution (the adaptive step below drops shadows first).
      // Pixel ratio: the adaptive step-down below remembers its result per device, so the next launch starts there
      // instead of stuttering for the first seconds again.
      let savedPr = 0; try { savedPr = +localStorage.getItem('arrow_pr') || 0; } catch (e) { }
      let pr = Math.min(savedPr || 1.75, 1.75, window.devicePixelRatio || 1); renderer.setPixelRatio(pr);
      const keepPr = () => { try { localStorage.setItem('arrow_pr', String(pr)); } catch (e) { } };
      const maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
      if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
      // Real soft shadows from the key light (one 1024 map that follows the camera) under every character and prop.
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(46, 1, 1, 400);
      const hemi = new T.HemisphereLight(0xa8c4ff, 0x2a1830, 0.62); scene.add(hemi);
      const sun = new T.DirectionalLight(0xffdcb0, 2.1); sun.position.set(-20, 60, 30); scene.add(sun, sun.target);
      sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
      Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 19, bottom: -19, near: 10, far: 140 }); sun.shadow.camera.updateProjectionMatrix();
      const aimSun = (x, z) => { sun.position.set(x - 18, 58, z + 26); sun.target.position.set(x, 0, z); sun.target.updateMatrixWorld(); };
      const rim = new T.DirectionalLight(0x6fc8ff, 0.95); rim.position.set(25, 30, -60); scene.add(rim);
      const torchL = new T.PointLight(0xffb060, 40, 22, 1.7), torchR = torchL.clone(), torchL2 = torchL.clone(), torchR2 = torchL.clone();
      scene.add(torchL, torchR); // torchL2/torchR2 kept as objects (positions are set) but not lit: four point lights cost too much on phones
      scene.fog = new T.Fog(0x1a1410, 60, 140);

      const propMat = new T.MeshLambertMaterial({ vertexColors: true, flatShading: true });
      // Instanced props get their own material + shadow depth material: sharing one between InstancedMesh and Mesh makes
      // three.js re-select the shader program for every draw (getParameters/getProgramCacheKey each frame).
      const propMatI = propMat.clone(), instDepth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
      const basic = {};
      const bmat = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); return basic[k] || (basic[k] = new T.MeshBasicMaterial(Object.assign({ color: c }, o || {}))); };
      const add = { transparent: true, depthWrite: false, blending: T.AdditiveBlending };
      const shadowTex = radial([[0, 'rgba(0,0,0,.38)'], [1, 'rgba(0,0,0,0)']]);
      const glowTex = radial([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.6)'], [1, 'rgba(255,255,255,0)']]);
      const dotTex = radial([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,.8)'], [1, 'rgba(255,255,255,0)']]);
      const shadowGeo = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), shadowMat = new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
      // Skill-effect textures, drawn once: a frost rune circle, a soft shockwave ring and a telegraph ring.
      const frostTex = canvasTex(256, 256, g => {
        const c = 128, rg = g.createRadialGradient(c, c, 0, c, c, 128);
        [[0, 'rgba(120,200,255,.32)'], [0.68, 'rgba(70,160,255,.16)'], [0.84, 'rgba(190,240,255,.8)'], [0.89, 'rgba(255,255,255,1)'], [0.94, 'rgba(140,210,255,.45)'], [1, 'rgba(0,0,0,0)']].forEach(([o, col]) => rg.addColorStop(o, col));
        g.fillStyle = rg; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(230,250,255,.9)'; g.lineCap = 'round';
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * Math.PI * 2; g.lineWidth = 4; g.beginPath(); g.moveTo(c + Math.cos(a) * 18, c + Math.sin(a) * 18); g.lineTo(c + Math.cos(a) * 92, c + Math.sin(a) * 92); g.stroke();
          g.lineWidth = 3;
          for (const t of [0.45, 0.7]) { const px = c + Math.cos(a) * 92 * t, py = c + Math.sin(a) * 92 * t; for (const s of [-1, 1]) { const b = a + s * 0.6; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(b) * 18, py + Math.sin(b) * 18); g.stroke(); } }
        }
        g.lineWidth = 2; for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2, o = k % 3 ? 108 : 118; g.beginPath(); g.moveTo(c + Math.cos(a) * 102, c + Math.sin(a) * 102); g.lineTo(c + Math.cos(a) * o, c + Math.sin(a) * o); g.stroke(); }
      });
      const shockTex = radial([[0, 'rgba(255,255,255,0)'], [0.62, 'rgba(255,255,255,0)'], [0.82, 'rgba(255,255,255,.55)'], [0.9, 'rgba(255,255,255,1)'], [0.95, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]);
      const warnTex = canvasTex(128, 128, g => {
        const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        [[0, 'rgba(255,255,255,.10)'], [0.78, 'rgba(255,255,255,.26)'], [0.86, 'rgba(255,255,255,1)'], [0.94, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']].forEach(([o, col]) => rg.addColorStop(o, col));
        g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
        g.fillStyle = 'rgba(255,255,255,.9)'; for (let k = 0; k < 4; k++) { g.save(); g.translate(64, 64); g.rotate(k * Math.PI / 2); g.beginPath(); g.moveTo(-6, -40); g.lineTo(6, -40); g.lineTo(0, -30); g.fill(); g.restore(); } // inward chevrons
      });
      // Ground zones (flame trail, poison pools): a cloudy, uneven patch instead of a plain glowing disc.
      const zoneTex = canvasTex(128, 128, g => {
        let s = 7; const rn = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        for (let k = 0; k < 14; k++) { const a = rn() * 6.28, d = rn() * 34, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, r = 16 + rn() * 22, rg = g.createRadialGradient(x, y, 0, x, y, r);
          rg.addColorStop(0, 'rgba(255,255,255,' + (0.35 + rn() * 0.3).toFixed(2) + ')'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 128, 128); }
        g.globalCompositeOperation = 'destination-out';
        for (let k = 0; k < 9; k++) { const x = 30 + rn() * 68, y = 30 + rn() * 68, r = 3 + rn() * 7; g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = 'rgba(0,0,0,.45)'; g.fill(); } // bubbles / holes
      });
      const heroPoolTex = radial([[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']]);
      const ringTex = canvasTex(64, 64, g => { g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.stroke(); g.globalAlpha = 0.25; g.fillStyle = '#fff'; g.fill(); });
      // Royal runner: woven fabric (neutral, the chapter colour tints it), gold-braided borders and a repeating
      // medallion pattern, slightly worn toward the edges.
      const carpetTex = canvasTex(128, 512, (g, w, h) => {
        g.fillStyle = '#d6cfc8'; g.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 2) { g.fillStyle = 'rgba(0,0,0,' + (0.03 + Math.random() * 0.04).toFixed(3) + ')'; g.fillRect(0, y, w, 1); } // weave
        for (let k = 0; k < 1400; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1); }
        const gold = '#f4c75a', goldD = '#8a5a12';
        for (const x of [6, w - 18]) { g.fillStyle = goldD; g.fillRect(x - 1, 0, 14, h); g.fillStyle = gold; g.fillRect(x, 0, 12, h);
          g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(x + 2, 0, 2, h); g.fillStyle = goldD; for (let y = 0; y < h; y += 10) g.fillRect(x + 4, y, 4, 4); } // braid studs
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(22, 0, 3, h); g.fillRect(w - 25, 0, 3, h);
        for (let y = 64; y < h; y += 128) { // medallion
          const cx = w / 2;
          g.fillStyle = 'rgba(70,30,10,.35)'; g.beginPath(); g.moveTo(cx, y - 46); g.lineTo(cx + 34, y); g.lineTo(cx, y + 46); g.lineTo(cx - 34, y); g.fill();
          g.strokeStyle = gold; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, y - 40); g.lineTo(cx + 28, y); g.lineTo(cx, y + 40); g.lineTo(cx - 28, y); g.closePath(); g.stroke();
          g.fillStyle = gold; g.beginPath(); g.arc(cx, y, 9, 0, 7); g.fill(); g.fillStyle = goldD; g.beginPath(); g.arc(cx, y, 4, 0, 7); g.fill();
          for (const d of [-1, 1]) { g.beginPath(); g.arc(cx, y + d * 64, 5, 0, 7); g.fillStyle = gold; g.fill(); }
        }
        const edge = g.createLinearGradient(0, 0, w, 0); edge.addColorStop(0, 'rgba(0,0,0,.25)'); edge.addColorStop(0.12, 'rgba(0,0,0,0)'); edge.addColorStop(0.88, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,.25)');
        g.fillStyle = edge; g.fillRect(0, 0, w, h);
      }, true);
      const aoTex = canvasTex(64, 128, (g, w, h) => {
        const e = (x0, y0, x1, y1) => { const r = g.createLinearGradient(x0, y0, x1, y1); r.addColorStop(0, 'rgba(10,6,4,.62)'); r.addColorStop(1, 'rgba(10,6,4,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); };
        e(0, 0, 14, 0); e(w, 0, w - 14, 0); e(0, 0, 0, 18); e(0, h, 0, h - 10);
      });
      // Procedural flagstones: rows of irregular slabs, each with its own tint, a bevel, cracks and grime; a matching
      // height map (slab = high, joint = low) drives the bump so the floor looks carved, not printed.
      // Floors are big (two ~970x1550 canvases each): keep only the last few, and free the GPU copy of the rest —
      // an unbounded cache ran the phone out of GPU memory in the 50-room chapters (white screen).
      const floorCache = new Map(), FLOOR_KEEP = 3;
      function stoneFloor(seed, base, kind) {
        const key = seed + base + kind; if (floorCache.has(key)) return floorCache.get(key);
        let sd = seed * 7919 + 17; const rn = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
        const PX = 36, W = (2 * RW + 2) * PX, H = (2 * RH + 2) * PX;
        const c = document.createElement('canvas'), b = document.createElement('canvas'); c.width = b.width = W; c.height = b.height = H;
        const g = c.getContext('2d'), h = b.getContext('2d');
        const bc = new T.Color(base), wood = /wood/.test(kind);
        const shade = (k, j) => { const q = bc.clone().multiplyScalar(k); q.offsetHSL((rn() - 0.5) * 0.02, (rn() - 0.5) * 0.06, (rn() - 0.5) * j); return '#' + q.getHexString(); };
        g.fillStyle = shade(0.42, 0); g.fillRect(0, 0, W, H);           // joints
        h.fillStyle = '#000'; h.fillRect(0, 0, W, H);
        const gap = wood ? 3 : 5;
        for (let y = 0; y < H;) {
          const rh = Math.round((wood ? 0.9 : 2.4 + rn() * 1.6) * PX);
          for (let x = -Math.round(rn() * 2 * PX); x < W;) {
            const rw = Math.round((wood ? 4 + rn() * 5 : 2 + rn() * 3.2) * PX), r = wood ? 3 : 10 + rn() * 8;
            const x0 = x + gap, y0 = y + gap, ww = rw - 2 * gap, hh = rh - 2 * gap;
            const path = ctx => { ctx.beginPath(); ctx.roundRect(x0, y0, ww, hh, r); };
            const col = shade(0.95 + rn() * 0.2, 0.08);
            const gr = g.createLinearGradient(x0, y0, x0 + ww, y0 + hh);
            gr.addColorStop(0, shade(1.18, 0.03)); gr.addColorStop(0.35, col); gr.addColorStop(1, shade(0.8, 0.03));
            path(g); g.fillStyle = gr; g.fill();
            g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.10)'; g.stroke();
            // grime and moss patches, cracks
            for (let k = 0; k < 3; k++) if (rn() < 0.5) {
              const px = x0 + rn() * ww, py = y0 + rn() * hh, pr = (0.4 + rn() * 1.1) * PX, sp = g.createRadialGradient(px, py, 0, px, py, pr);
              const moss = rn() < 0.35 && !wood;
              sp.addColorStop(0, moss ? 'rgba(70,95,40,.35)' : 'rgba(30,20,12,.28)'); sp.addColorStop(1, 'rgba(0,0,0,0)');
              g.save(); path(g); g.clip(); g.fillStyle = sp; g.fillRect(px - pr, py - pr, 2 * pr, 2 * pr); g.restore();
            }
            if (!wood && rn() < 0.3) {
              g.save(); path(g); g.clip(); g.strokeStyle = 'rgba(20,12,6,.55)'; g.lineWidth = 2; g.beginPath();
              let cx = x0 + rn() * ww, cy = y0 + rn() * hh; g.moveTo(cx, cy);
              for (let k = 0; k < 5; k++) { cx += (rn() - 0.5) * PX * 1.2; cy += (rn() - 0.5) * PX * 1.2; g.lineTo(cx, cy); }
              g.stroke(); g.restore();
            }
            if (wood) { g.save(); path(g); g.clip(); g.strokeStyle = 'rgba(40,22,10,.25)'; g.lineWidth = 1.5; for (let k = 0; k < 4; k++) { const yy = y0 + rn() * hh; g.beginPath(); g.moveTo(x0, yy); g.bezierCurveTo(x0 + ww * 0.3, yy + 4, x0 + ww * 0.7, yy - 4, x0 + ww, yy); g.stroke(); } g.restore(); }
            // height: raised slab with a soft rounded edge
            h.save(); path(h); h.fillStyle = '#9a9a9a'; h.fill(); h.lineWidth = 6; h.strokeStyle = '#5a5a5a'; h.stroke(); h.restore();
            x += rw;
          }
          y += rh;
        }
        // fine speckle so large slabs are not flat colour
        const img = g.getImageData(0, 0, W, H), d = img.data;
        for (let k = 0; k < d.length; k += 4) { const n = (rn() - 0.5) * 18; d[k] += n; d[k + 1] += n; d[k + 2] += n; }
        g.putImageData(img, 0, 0);
        const map = new T.CanvasTexture(c), bump = new T.CanvasTexture(b);
        if ('colorSpace' in map) map.colorSpace = T.SRGBColorSpace;
        map.anisotropy = bump.anisotropy = 4;
        floorCache.set(key, { map, bump });
        while (floorCache.size > FLOOR_KEEP) { const [k, old] = floorCache.entries().next().value; old.map.dispose(); old.bump.dispose(); floorCache.delete(k); }
        return floorCache.get(key);
      }
      // Animated liquid surface for pools: flowing lava with a cooling crust, rippling water with caustics,
      // glossy ice with cracks and a travelling sheen. Drawn in world space so neighbouring pools never match.
      const poolMats = {};
      function poolMat(kind) {
        if (poolMats[kind]) return poolMats[kind];
        const K = { lava: 0, water: 1, ice: 2 }[kind] || 0;
        return (poolMats[kind] = new T.ShaderMaterial({
          transparent: K !== 0, depthWrite: K === 0,
          uniforms: { uT: { value: 0 } },
          vertexShader: 'varying vec2 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
          fragmentShader: [
            'uniform float uT; varying vec2 vW;',
            'float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
            'float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }',
            'float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }',
            'void main() {',
            '  vec2 p = vW * 0.45; vec3 col; float al = 1.0;',
            '  #if ' + K + ' == 0',
            '  float a = fbm(p + vec2(uT * 0.10, uT * 0.06)); float b = fbm(p * 1.7 + a * 2.0 - vec2(uT * 0.12, -uT * 0.05));',
            '  float crust = smoothstep(0.40, 0.52, b); float vein = 1.0 - smoothstep(0.0, 0.08, abs(b - 0.5));',
            '  vec3 hot = mix(vec3(1.0, 0.78, 0.2), vec3(0.95, 0.22, 0.02), smoothstep(0.3, 0.7, a));',
            '  col = mix(hot * (1.0 + 0.25 * sin(uT * 3.0 + a * 9.0)), vec3(0.13, 0.05, 0.03), crust) + vein * vec3(1.0, 0.55, 0.1) * crust * 0.8;',
            '  #elif ' + K + ' == 1',
            '  float a = fbm(p * 1.3 + vec2(uT * 0.15, uT * 0.08)); float c = fbm(p * 2.6 - vec2(uT * 0.2, uT * 0.1) + a);',
            '  float caus = pow(1.0 - abs(c - 0.5) * 2.0, 6.0);',
            '  col = mix(vec3(0.05, 0.32, 0.5), vec3(0.12, 0.6, 0.75), a) + caus * vec3(0.55, 0.9, 1.0) * 0.7; al = 0.88;',
            '  #else',
            '  float a = fbm(p * 1.1); float cr = 1.0 - smoothstep(0.0, 0.035, abs(fbm(p * 2.4 + 3.0) - 0.5));',
            '  float sheen = smoothstep(0.85, 1.0, sin((vW.x + vW.y) * 0.35 - uT * 1.4));',
            '  col = mix(vec3(0.62, 0.84, 0.98), vec3(0.88, 0.97, 1.0), a) - cr * vec3(0.25, 0.15, 0.05) + sheen * 0.35; al = 0.9;',
            '  #endif',
            '  gl_FragColor = vec4(col, al);',
            '}'].join('\n'),
        }));
      }
      const chevTex = canvasTex(64, 64, g => { g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(12, 44); g.lineTo(32, 22); g.lineTo(52, 44); g.stroke(); });
      const portalTex = canvasTex(64, 128, (g, w, h) => { const r = g.createLinearGradient(0, h, 0, 0); r.addColorStop(0, 'rgba(160,255,200,.95)'); r.addColorStop(0.6, 'rgba(80,220,255,.45)'); r.addColorStop(1, 'rgba(80,220,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
      const beamTex = canvasTex(4, 128, (g, w, h) => { const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, 'rgba(255,240,200,0)'); r.addColorStop(0.5, 'rgba(255,240,200,.55)'); r.addColorStop(1, 'rgba(255,240,200,.05)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
      const trailTex = canvasTex(8, 64, (g, w, h) => { const r = g.createLinearGradient(0, 0, 0, h); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(1, 'rgba(255,255,255,.9)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });

      const poolTex = {
        water: canvasTex(64, 64, g => { g.fillStyle = '#1f7fae'; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(190,240,255,.45)'; g.lineWidth = 2; for (let y = 6; y < 64; y += 12) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(16, y - 5, 40, y + 5, 64, y); g.stroke(); } }, true),
        lava: canvasTex(128, 128, (g, w) => {
          const bg = g.createLinearGradient(0, 0, w, w); bg.addColorStop(0, '#ffd34a'); bg.addColorStop(0.5, '#ff7a14'); bg.addColorStop(1, '#ffb02a');
          g.fillStyle = bg; g.fillRect(0, 0, w, w);
          // Crust plates on a jittered grid, drawn 9 times so they tile seamlessly.
          let sd = 7; const rn = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
          const plates = [];
          for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) plates.push([(i + 0.2 + rn() * 0.6) * w / 5, (j + 0.2 + rn() * 0.6) * w / 5, 9 + rn() * 7, rn() * 6]);
          for (const [px, py, pr, ph] of plates) for (const ox of [-w, 0, w]) for (const oy of [-w, 0, w]) {
            g.beginPath();
            for (let k = 0; k < 7; k++) { const a = ph + k / 7 * Math.PI * 2, rr = pr * (0.8 + 0.35 * Math.sin(k * 2.3 + ph)); g.lineTo(px + ox + Math.cos(a) * rr, py + oy + Math.sin(a) * rr); }
            g.closePath();
            const cg = g.createRadialGradient(px + ox, py + oy, 1, px + ox, py + oy, pr); cg.addColorStop(0, '#2a120a'); cg.addColorStop(0.75, '#4a1c0c'); cg.addColorStop(1, '#a8350a');
            g.fillStyle = cg; g.fill();
          }
        }, true),
        ice: canvasTex(64, 64, g => { g.fillStyle = '#bfe9ff'; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.5; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(Math.random() * 64, Math.random() * 64); g.lineTo(Math.random() * 64, Math.random() * 64); g.stroke(); } }, true),
      };
      // Ambient particles per theme: colour, size, vertical speed, sideways sway, blink.
      const AMB = { dust: ['#ffe2b0', 0.22, 0.25, 0.1, 0], bubbles: ['#9fe6ff', 0.3, 1.1, 0.25, 0], wisps: ['#c28cff', 0.6, 0.15, 0.6, 0.5], embers: ['#ff8a2a', 0.28, 1.6, 0.4, 0.3], snow: ['#ffffff', 0.3, -1.2, 0.5, 0], fireflies: ['#b6ff6a', 0.35, 0.1, 0.8, 1] };
      let amb = AMB.dust, pools = [];
      // V3 weather per chapter ambience (on top of the floating dust points): [kind, rate] pairs for Fx3D.weather.
      const WX = { snow: [['snow', 26]], embers: [['embers', 14], ['ash', 10]], fireflies: [['leaves', 7], ['fireflies', 6]], wisps: [['fireflies', 5]], bubbles: [['motes', 4]] };
      let wx = null;
      // Soft, patchy mist (tileable blobs), cloned per room so each sheet scrolls on its own.
      const mistTex = canvasTex(128, 128, g => { for (let k = 0; k < 26; k++) { const x = Math.random() * 128, y = Math.random() * 128, r = 14 + Math.random() * 30; for (const ox of [-128, 0, 128]) for (const oy of [-128, 0, 128]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r); } } });
      const room = new T.Group(); scene.add(room);
      const dyn = new T.Group(); scene.add(dyn);
      // Shared effect system (ortak/fx3d.js): GPU sparks, bow flashes, arrow light trails, stone chips, floor cracks,
      // chain lightning, camera shake and the hero's rune aura. Everything pooled; nothing allocated per hit.
      const F3 = window.Fx3D ? Fx3D.create(scene, { unit: 1, particles: 2600, rocks: 140, decals: 24, bolts: 16, budget: 700 }) : null;
      const heroAura = F3 ? F3.aura('#46e0ff', 3.4) : null; if (heroAura) heroAura.visible = false;
      let rockCol = '#4a4650', runes = [], muzzleT = 0;
      // Boss spotlight: a pulsing red-violet pool under the boss and a shaft of light from above (additive, no light).
      const bossPool = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: glowTex, color: '#ff2a5a', transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.5 }));
      const bossBeam = new T.Mesh(new T.CylinderGeometry(1, 1.6, 16, 20, 1, true).translate(0, 8, 0), new T.MeshBasicMaterial({ map: beamTex, color: '#b04dff', transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, opacity: 0.5 }));
      bossPool.visible = bossBeam.visible = false; bossPool.renderOrder = 3; scene.add(bossPool, bossBeam);
      let perfAcc = 0, perfN = 0, slowShadows = false, shadowTick = 0, lowFxA = false;
      let level = null, menuKey = '', door = null, portal = null, doorArrow = null, chevrons = [], angelG = null, chestG = null, spikesM = [], flames = [], heroRing = null;
      const ents = new Map();

      // ---------- Characters (morph-blended poses) ----------
      const charMats = {};
      // Three-step cel ramp (Archero-style shading) and one shared outline material.
      const toonRamp = new T.DataTexture(new Uint8Array([128, 128, 128, 255, 208, 208, 208, 255, 255, 255, 255, 255]), 3, 1);
      toonRamp.minFilter = toonRamp.magFilter = T.NearestFilter; toonRamp.needsUpdate = true;
      const outlineMat = new T.MeshBasicMaterial({ color: 0x1b0f08, side: T.BackSide });
      outlineMat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <morphtarget_vertex>', '#include <morphtarget_vertex>\n  transformed += normal * 0.05;'); };
      // Key-art look (docs/art-target): a cool rim light and a little extra colour saturation on every character, patched
      // into the toon shader (no extra light, one shared program).
      const RIM_GLSL = 'float rimK = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.6);\n' +
        '  gl_FragColor.rgb = mix(vec3(dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114))), gl_FragColor.rgb, 1.22) + vec3(0.42, 0.72, 1.0) * rimK * 0.36;\n#include <dithering_fragment>';
      const charLook = m => { m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', RIM_GLSL); }; m.customProgramCacheKey = () => 'charLook'; return m; };
      // Creature detail (small foes read on a phone): richer colour, contact shading at the feet, a two-tone rim that
      // is brighter from above (gold on elites, the crew colour on bosses), and a sharp toon highlight that makes dark
      // glossy parts (eyes, shells) glint. One shared program; each foe's (already per-foe) material only carries
      // its own uniform values, so no extra material, texture or draw call.
      const FOE_RIM = new T.Color(0.42, 0.72, 1.0);
      const FOE_GLSL = 'vec3 fc = gl_FragColor.rgb; float fl = dot(fc, vec3(0.299, 0.587, 0.114));\n' +
        '  fc = clamp(mix(vec3(fl), fc, 1.38), 0.0, 1.0); fc = (fc - 0.5) * 1.08 + 0.52;\n' +
        '  fc *= 0.6 + 0.4 * smoothstep(0.0, uFoeH * 0.32, vFoeY);\n' +
        '  vec3 fN = normalize(normal), fV = normalize(vViewPosition);\n' +
        '  float fr = pow(1.0 - abs(dot(fN, fV)), 2.2);\n' +
        '  fc += uFoeRim * fr * uFoeRimK * (0.45 + 0.55 * clamp(fN.y * 0.5 + 0.6, 0.0, 1.0));\n' +
        '  float sp = pow(max(dot(fN, normalize(normalize(vec3(-0.35, 0.8, 0.5)) + fV)), 0.0), 48.0);\n' +
        '  fc += smoothstep(0.45, 0.6, sp) * (0.18 + 0.5 * (1.0 - fl));\n' +
        '  gl_FragColor.rgb = fc;\n#include <dithering_fragment>';
      const foeLook = m => {
        m.userData.fu = { uFoeH: { value: 3 }, uFoeRim: { value: FOE_RIM.clone() }, uFoeRimK: { value: 0.55 } };
        m.onBeforeCompile = function (sh) { // per material (the closure would point at the first one after clone())
          Object.assign(sh.uniforms, this.userData.fu);
          sh.vertexShader = 'varying float vFoeY;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vFoeY = (modelMatrix * vec4(transformed, 1.0)).y;');
          sh.fragmentShader = 'uniform float uFoeH; uniform vec3 uFoeRim; uniform float uFoeRimK; varying float vFoeY;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', FOE_GLSL);
        };
        m.customProgramCacheKey = () => 'foeLook'; return m;
      };
      // Foes are drawn at ~0.6 of the hero's scale: a slightly thinner, cooler ink line keeps their faces readable.
      const foeOutlineMat = new T.MeshBasicMaterial({ color: 0x140a16, side: T.BackSide });
      foeOutlineMat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <morphtarget_vertex>', '#include <morphtarget_vertex>\n  transformed += normal * 0.038;'); };
      function charMesh(name, scale, opts) {
        const u = window.ARROW_CHARS.chars[name];
        const foe = opts === 'foe'; if (foe) opts = null;
        const mat = (foe ? foeLook : charLook)(opts ? new T.MeshToonMaterial(Object.assign({ map: charTex(u.tex), gradientMap: toonRamp }, opts)) : (charMats[u.tex] || (charMats[u.tex] = new T.MeshToonMaterial({ map: charTex(u.tex), gradientMap: toonRamp }))).clone());
        if (mat.map && mat.map.anisotropy !== Math.min(8, maxAniso)) { mat.map.anisotropy = Math.min(8, maxAniso); const im = mat.map.image; if (im && (im.complete === undefined || (im.complete && im.naturalWidth))) mat.map.needsUpdate = true; }
        const m = new T.Mesh(charGeo(name), mat); m.scale.setScalar(scale || 1); m.castShadow = true;
        if (m.updateMorphTargets) m.updateMorphTargets();
        // Ink outline: the same morphing geometry pushed out along its normals, drawn back faces only.
        const ol = new T.Mesh(m.geometry, foe ? foeOutlineMat : outlineMat); ol.scale.copy(m.scale);
        if (ol.updateMorphTargets) ol.updateMorphTargets();
        ol.morphTargetInfluences = m.morphTargetInfluences; ol.raycast = () => {};
        const sh = new T.Mesh(shadowGeo, shadowMat); sh.scale.setScalar((foe ? 2.3 : 2.6) * (scale || 1)); sh.position.y = 0.05;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        const g = new T.Group(); g.add(m, ol, sh); g.userData = { m, hy: m.geometry.boundingBox.max.y * m.scale.y };
        if (foe) mat.userData.fu.uFoeH.value = g.userData.hy;
        pose(m, 6, 6, 0);
        return g;
      }
      // ---------- Outfits (skins.js): repainted texture, glowing parts, a crown / halo / horns and a particle signature ----------
      const SKT = {};
      function skinMaps(name, sk) {
        const u = window.ARROW_CHARS.chars[name], key = u.tex + ':' + sk.id;
        if (SKT[key]) return SKT[key];
        const mk = c => { const t = new T.CanvasTexture(c); t.flipY = false; if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace; return t; };
        // Fixed size before the first upload: WebGL texture storage cannot grow when the image loads later.
        const cv = () => { const c = document.createElement('canvas'); c.width = c.height = 512; return c; };
        const c = cv(), c2 = sk.glow ? cv() : null;
        const out = SKT[key] = { map: mk(c), emap: c2 ? mk(c2) : null };
        const paint = img => {
          const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
          const d = g.getImageData(0, 0, c.width, c.height), mask = window.ArrowSkins.recolor(d.data, sk); g.putImageData(d, 0, 0); out.map.needsUpdate = true;
          if (c2 && mask) { c2.getContext('2d').putImageData(new ImageData(mask, c.width, c.height), 0, 0); out.emap.needsUpdate = true; }
        };
        const img = charTex(u.skinTex || u.tex).image; // a hero can name a cleaner source to repaint (Frost Cleric: the original Cleric)
        if (img.complete && img.naturalWidth) paint(img); else img.addEventListener('load', () => paint(img), { once: true });
        return out;
      }
      const gold = new T.MeshToonMaterial({ color: '#ffc928', emissive: '#7a4a00', gradientMap: toonRamp });
      function topPiece(kind) {
        const g = new T.Group();
        if (kind === 'crown') {
          const band = new T.Mesh(new T.CylinderGeometry(0.34, 0.3, 0.18, 20, 1, true), gold); band.material.side = T.DoubleSide; g.add(band);
          for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, sp = new T.Mesh(new T.ConeGeometry(0.07, 0.24, 5), gold); sp.position.set(Math.sin(a) * 0.32, 0.2, Math.cos(a) * 0.32); g.add(sp);
            const gem = new T.Mesh(new T.OctahedronGeometry(0.05), new T.MeshBasicMaterial({ color: k % 2 ? '#ff3a5a' : '#3ad0ff' })); gem.position.set(Math.sin(a) * 0.345, 0, Math.cos(a) * 0.345); g.add(gem); }
        } else if (kind === 'halo') {
          g.add(new T.Mesh(new T.TorusGeometry(0.36, 0.045, 8, 36).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: '#fff0a0' })));
          const gl = new T.Mesh(new T.RingGeometry(0.22, 0.62, 36).rotateX(-Math.PI / 2), new T.MeshBasicMaterial(Object.assign({ map: glowTex, color: '#ffd23f', side: T.DoubleSide, opacity: 0.7 }, add))); g.add(gl);
        } else if (kind === 'horns') {
          const hm = new T.MeshToonMaterial({ color: '#2a1440', emissive: '#7a20c0', gradientMap: toonRamp });
          for (const sx of [-1, 1]) { const h = new T.Mesh(new T.ConeGeometry(0.09, 0.5, 8).translate(0, 0.25, 0), hm); h.position.set(sx * 0.2, -0.1, 0); h.rotation.z = -sx * 0.55; g.add(h);
            const tip = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: '#d070ff' }, add))); tip.scale.setScalar(0.35); tip.position.set(sx * 0.42, 0.3, 0); g.add(tip); }
        }
        return g;
      }
      // Dress a character group in an outfit (or back to its own clothes).
      function dress(g, name, sk) {
        const mat = g.userData.m.material, u = window.ARROW_CHARS.chars[name];
        if (g.userData.top) { g.remove(g.userData.top); g.userData.top = null; }
        for (const o of g.userData.orbs || []) g.remove(o); g.userData.orbs = null;
        g.userData.skin = sk || null;
        if (!sk) { mat.map = charTex(u.tex); mat.emissiveMap = null; mat.needsUpdate = true; return; }
        if (sk.pal) { const t = skinMaps(name, sk); mat.map = t.map; mat.emissiveMap = t.emap; mat.needsUpdate = true; }
        const geo = g.userData.m.geometry; if (!geo.boundingBox) geo.computeBoundingBox();
        g.userData.headY = geo.boundingBox.max.y * g.userData.m.scale.y;
        if (sk.fx.top) { const tp = topPiece(sk.fx.top); tp.scale.setScalar(g.userData.m.scale.y / 1.7 * 1.5); g.add(tp); g.userData.top = tp; }
        if (sk.fx.kind === 'orbs') g.userData.orbs = [0, 1, 2].map(k => { const o = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: sk.fx.cols[k % sk.fx.cols.length] }, add))); g.add(o); return o; });
      }
      // Per-frame outfit life: glow pulse, floating headpiece, orbiting motes and the outfit's particles.
      function skinFx(g, x, z, moving, dt, time) {
        const sk = g.userData.skin; if (!sk) return;
        const s = g.userData.m.scale.y / 1.7, hy = g.userData.headY || 3 * s, c = sk.fx.cols, col = () => c[(Math.random() * c.length) | 0];
        const mat = g.userData.m.material;
        if (sk.glow && mat.emissive) { const k = 0.55 + 0.35 * Math.sin(time * 3.2) + 0.1 * Math.sin(time * 11); mat.emissive.setRGB(k, k, k); }
        if (g.userData.top) { const tp = g.userData.top; tp.position.y = hy * 0.94 + 0.07 * s * Math.sin(time * 2.4); tp.rotation.y = sk.fx.top === 'horns' ? 0 : time * 0.9; }
        if (g.userData.orbs) g.userData.orbs.forEach((o, k) => { const a = time * 2.2 + k * 2.094; o.position.set(Math.sin(a) * 1.1 * s, hy * 0.55 + 0.3 * s * Math.sin(time * 3 + k), Math.cos(a) * 1.1 * s); o.scale.setScalar((0.55 + 0.12 * Math.sin(time * 6 + k)) * s);
          if (Math.random() < dt * 10) { const w = o.getWorldPosition(wv); emit(sparks, w.x, w.y, w.z, 0, 0.2, 0, 0.5, c[k % c.length]); } });
        const r = 0.7 * s, rx = () => x + rnd(-r, r), rz = () => z + rnd(-r, r), k = sk.fx.kind;
        if (k === 'embers') { if (Math.random() < dt * 22) emit(sparks, rx(), rnd(0.3, hy), rz(), rnd(-0.4, 0.4), rnd(1.5, 3.2), rnd(-0.4, 0.4), rnd(0.7, 1.3), col(), -0.6);
          if (Math.random() < dt * 3) emit(puffs, x, hy * 0.9, z, rnd(-0.2, 0.2), 1.2, rnd(-0.2, 0.2), 1, '#3a2620'); }
        else if (k === 'smoke') { if (Math.random() < dt * 7) emit(puffs, rx(), rnd(0.3, hy * 0.6), rz(), 0, rnd(0.5, 1), 0, rnd(0.8, 1.3), c[0]); if (Math.random() < dt * 10) emit(sparks, rx(), rnd(0.3, hy), rz(), 0, 0.6, 0, 0.8, '#b48cff'); }
        else if (k === 'leaves' || k === 'snow') { if (Math.random() < dt * 12) emit(sparks, x + rnd(-1.6, 1.6) * s, hy + rnd(0.5, 1.5) * s, z + rnd(-1.6, 1.6) * s, rnd(-0.5, 0.5), -rnd(0.6, 1.2), rnd(-0.5, 0.5), rnd(1.4, 2.2), col()); }
        else if (k === 'fireflies') { if (Math.random() < dt * 9) emit(sparks, x + rnd(-1.4, 1.4) * s, rnd(0.4, hy), z + rnd(-1.4, 1.4) * s, rnd(-0.6, 0.6), rnd(-0.2, 0.4), rnd(-0.6, 0.6), rnd(1.2, 2), col()); }
        else if (k === 'sparkle' || k === 'stars') { if (Math.random() < dt * 16) emit(sparks, rx(), rnd(0.2, hy * 1.05), rz(), 0, rnd(0.3, 1.2), 0, rnd(0.4, 0.9), col()); }
        else if (k === 'sparks') { if (Math.random() < dt * 14) emit(sparks, rx(), rnd(hy * 0.4, hy * 0.8), rz(), rnd(-1.5, 1.5), rnd(1.5, 3.5), rnd(-1.5, 1.5), rnd(0.4, 0.8), col(), 6); }
        // A short coloured trail at the feet while running.
        if (moving && Math.random() < dt * 18) emit(sparks, x + rnd(-0.3, 0.3), 0.2, z + rnd(-0.3, 0.3), 0, rnd(0.2, 0.6), 0, 0.5, col());
      }
      const wv = new T.Vector3();
      // Chapter bosses each get a look of their own (palette, glowing cracks or runes, a headpiece, particles), so
      // none of them reads like a big version of a normal foe; guardians and mini bosses get a crew-coloured aura.
      const BOSS_LOOK = {
        warrior: { id: 'b_bone', pal: { cloth: [275, 0.55, 0.3], leather: [270, 0.3, 0.2], light: [45, 0.25, 0.8], trim: [48, 1, 0.6] }, glow: 'trim', fx: { kind: 'smoke', cols: ['#9a5cff', '#2a1040'], top: 'crown' } },
        glubx: { id: 'b_glub', pal: { cloth: [190, 0.8, 0.25], leather: [200, 0.4, 0.18], light: [175, 0.9, 0.6], trim: [175, 1, 0.6] }, glow: 'light', fx: { kind: 'fireflies', cols: ['#3affef', '#7a8aff'], top: 'halo' } },
        mushking: { id: 'b_mush', pal: { cloth: [285, 0.6, 0.35], leather: [30, 0.4, 0.3], light: [95, 0.7, 0.55] }, glow: 'light', fx: { kind: 'smoke', cols: ['#8aff4a', '#3a5a10'], top: 'crown' } },
        dragonx: { id: 'b_magma', pal: { cloth: [10, 0.25, 0.18], leather: [10, 0.2, 0.12], light: [20, 0.2, 0.3], trim: [25, 1, 0.55] }, cracks: [22, 1, 0.55], glow: 'trim', fx: { kind: 'embers', cols: ['#ff6a10', '#ffb43a', '#ffd86a'], top: 'horns' } },
        alpakingx: { id: 'b_frost', pal: { cloth: [200, 0.6, 0.65], leather: [210, 0.4, 0.4], light: [195, 0.4, 0.9], trim: [190, 1, 0.7] }, glow: 'trim', fx: { kind: 'snow', cols: ['#ffffff', '#bfeaff'], top: 'crown' } },
        golex: { id: 'b_stone', pal: { cloth: [30, 0.08, 0.4], leather: [30, 0.06, 0.28], light: [35, 0.06, 0.6], trim: [185, 1, 0.6] }, cracks: [185, 1, 0.55], glow: 'trim', fx: { kind: 'sparks', cols: ['#5ff3ff', '#ffffff'] } },
      };
      const CREW_C = ['#b48cff', '#3affef', '#8aff4a', '#ff7a1a', '#bfeaff', '#ffd23f'];
      const bossLook = e => (!e.mid && BOSS_LOOK[e.kind]) || { id: 'g' + (e.crew || 0), fx: { kind: e.mini ? 'sparkle' : 'stars', cols: [CREW_C[(e.crew || 0) % 6], '#ffffff'], top: e.mini ? null : 'halo' } };
      function pose(m, a, b, t) {
        const inf = m.morphTargetInfluences; if (!inf) return;
        for (let i = 0; i < inf.length; i++) inf[i] = 0;
        inf[a] += 1 - t; inf[b] += t;
      }
      const frac = x => x - Math.floor(x);
      function heroPose(m, e) {
        if (e.dead) return pose(m, 6, 7, 1);
        if (e.atkT > 0) { const ph = 1 - e.atkT / 0.25; return ph < 0.4 ? pose(m, 6, 4, ph / 0.4) : pose(m, 4, 5, Math.min(1, (ph - 0.4) / 0.4)); }
        if (e.moving) { const a = Math.floor(e.anim) % 4; return pose(m, a, (a + 1) % 4, frac(e.anim)); }
        pose(m, 6, 4, 0.12 + 0.12 * Math.sin(performance.now() / 400));
      }
      function foePose(m, e) {
        if (e.state === 'dead') return pose(m, 6, 7, Math.min(1, (0.9 - e.st) * 3));
        if (e.state === 'rise') return pose(m, 6, 6, 0);
        if (e.state === 'wind' || e.state === 'aim' || e.state === 'cast' || e.state === 'summon' || e.state === 'slam') return pose(m, 6, 4, Math.min(1, 0.7 + Math.sin(e.anim * 2) * 0.3));
        if (e.state === 'atk' || e.state === 'dash') return pose(m, 4, 5, 1);
        if (e.state === 'tired') return pose(m, 6, 7, 0.25);
        if (e.moving) { const a = Math.floor(e.anim) % 4; return pose(m, a, (a + 1) % 4, frac(e.anim)); }
        pose(m, 6, 4, 0.1 + 0.1 * Math.sin(e.anim));
      }

      // ---------- Pools ----------
      function pool(make) { const list = []; return { list, get(i) { if (!list[i]) { list[i] = make(); dyn.add(list[i]); } list[i].visible = true; return list[i]; }, hide(from) { for (let i = from; i < list.length; i++) list[i].visible = false; } }; }
      // Thrown weapons are built from coloured parts (one geometry with vertex colours), lying flat so they spin like a disc.
      function weaponGeo(parts) {
        const pos = [], col = [], c = new T.Color();
        for (const [g, hex] of parts) { const n = g.toNonIndexed(), p = n.attributes.position; c.set(hex); for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); col.push(c.r, c.g, c.b); } }
        const out = new T.BufferGeometry(); out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('color', new T.Float32BufferAttribute(col, 3)); return out;
      }
      const axeGeo = (s, wood, steel) => weaponGeo([
        [new T.BoxGeometry(0.12 * s, 0.1 * s, 1.5 * s), wood],                                              // handle
        [new T.CylinderGeometry(0.42 * s, 0.42 * s, 0.08 * s, 14, 1, false, -Math.PI / 2, Math.PI).translate(0.05 * s, 0, -0.55 * s), steel], // curved blade
        [new T.BoxGeometry(0.26 * s, 0.14 * s, 0.22 * s).translate(-0.08 * s, 0, -0.55 * s), '#55575e'],    // back of the head
      ]);
      const swordGeo = weaponGeo([
        [new T.BoxGeometry(0.16, 0.06, 1.25).translate(0, 0, -0.35), '#e8f2ff'],
        [new T.ConeGeometry(0.11, 0.25, 4).rotateX(-Math.PI / 2).translate(0, 0, -1.08), '#e8f2ff'],
        [new T.BoxGeometry(0.62, 0.1, 0.1).translate(0, 0, 0.3), '#d4a53a'],
        [new T.BoxGeometry(0.1, 0.1, 0.38).translate(0, 0, 0.52), '#6b3f1d'],
      ]);
      const SHOT_GEO = {
        bolt: new T.CylinderGeometry(0.08, 0.08, 1.5, 6).rotateX(Math.PI / 2), orb: new T.SphereGeometry(0.4, 12, 8), blade: swordGeo, axe: axeGeo(1, '#8a5a2b', '#dfe6ee'),
      };
      const SHOT_COL = { bolt: '#fff1a8', orb: '#9be7ff', blade: '#ffffff', axe: '#ffffff' };
      const shotMat = {}; for (const k in SHOT_COL) shotMat[k] = k === 'blade' || k === 'axe' ? bmat(SHOT_COL[k], { vertexColors: true }) : bmat(SHOT_COL[k]);
      let shotKind = 'bolt';
      const shots = pool(() => new T.Mesh(SHOT_GEO.bolt, shotMat.bolt));
      const trailGeo = new T.PlaneGeometry(0.5, 3).rotateX(-Math.PI / 2).translate(0, 0, -1.5);
      const trails = pool(() => new T.Mesh(trailGeo, new T.MeshBasicMaterial(Object.assign({ map: trailTex, color: '#fff1a8' }, add))));
      const shotGlows = pool(() => new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: '#fff1a8' }, add))));
      const glows = pool(() => { const s = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: '#d65cff' }, add))); s.scale.setScalar(2.2); return s; });
      const foeOrb = new T.SphereGeometry(0.42, 10, 8), foeBolt = new T.CylinderGeometry(0.09, 0.09, 1.3, 5).rotateX(Math.PI / 2), foeAxe = axeGeo(1.25, '#4a3524', '#b9c0c8');
      const foes = pool(() => new T.Mesh(foeOrb, bmat('#ff4dd2')));
      const coins = pool(() => new T.Mesh(new T.CylinderGeometry(0.38, 0.38, 0.12, 12), new T.MeshLambertMaterial({ color: '#ffd23f', emissive: '#6a4a00' })));
      const lines = pool(() => new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.5), bmat('#ff3b3b', { transparent: true, opacity: 0.35, depthWrite: false })));
      const rings = pool(() => new T.Mesh(new T.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: warnTex, color: '#ff3b3b', transparent: true, opacity: 0.5, depthWrite: false })));
      const fills = pool(() => new T.Mesh(new T.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.28, depthWrite: false })));
      const shocks2 = pool(() => new T.Mesh(new T.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new T.MeshBasicMaterial(Object.assign({ map: shockTex, color: '#c9a2ff' }, add))));
      const orbs = pool(() => { const g = new T.Group(); g.add(new T.Mesh(new T.SphereGeometry(0.34, 12, 10), bmat('#fff2b0'))); // white-hot core in a flickering flame
        const s = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: '#ff7a1a' }, add))); s.scale.setScalar(2.4); g.add(s);
        const s2 = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: '#ffd23f' }, add))); s2.scale.setScalar(1.2); g.add(s2); return g; });

      // ---------- Particles ----------
      // Two point clouds: small sparks and big soft puffs. CPU-updated, additive, pooled.
      function cloud(n, size) {
        const g = new T.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
        const pts = new T.Points(g, new T.PointsMaterial(Object.assign({ size, map: dotTex, vertexColors: true, sizeAttenuation: true }, add)));
        pts.frustumCulled = false; scene.add(pts);
        return { pts, pos, col, n, p: Array.from({ length: n }, () => ({ life: 0 })), i: 0, live: true }; // live: the first step parks every particle
      }
      const sparks = cloud(1200, 0.8), puffs = cloud(260, 2.6), flamesC = cloud(500, 1.9);
      const tmpC = new T.Color();
      function emit(c, x, y, z, vx, vy, vz, life, color, grav) {
        const q = c.p[c.i]; c.i = (c.i + 1) % c.n;
        Object.assign(q, { x, y, z, vx, vy, vz, life, max: life, grav: grav || 0, dead: false }); c.live = true;
        tmpC.set(color); q.r = tmpC.r; q.g = tmpC.g; q.b = tmpC.b;
      }
      // Idle clouds cost nothing: dead particles are parked once, and a cloud with nothing alive skips the loop and
      // the buffer upload (1200+260+500 particles were walked and re-uploaded every frame).
      function stepCloud(c, dt) {
        if (!c.live) return;
        let live = false;
        for (let k = 0; k < c.n; k++) {
          const q = c.p[k], o = k * 3;
          if (q.life <= 0) { if (!q.dead) { q.dead = true; c.pos[o + 1] = -999; } continue; }
          live = true;
          q.life -= dt; q.vy -= q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
          if (q.y < 0.05 && q.grav) { q.y = 0.05; q.vy *= -0.3; q.vx *= 0.6; q.vz *= 0.6; }
          const a = Math.max(0, q.life / q.max);
          c.pos[o] = q.x; c.pos[o + 1] = q.y; c.pos[o + 2] = q.z; c.col[o] = q.r * a; c.col[o + 1] = q.g * a; c.col[o + 2] = q.b * a;
        }
        c.live = live;
        c.pts.geometry.attributes.position.needsUpdate = true; c.pts.geometry.attributes.color.needsUpdate = true;
      }
      const rnd = (a, b) => a + Math.random() * (b - a);
      const beams = [], beamPool = [], lvBeamGeo = new T.CylinderGeometry(1.2, 1.6, 12, 20, 1, true).translate(0, 6, 0);
      // Expanding shock ring on the floor (skill hits, crits).
      // Rings, shards and level-up beams are pooled: a new material per hit made three.js rebuild program parameters
      // (getParameters / getProgramCacheKey) several times a frame in busy fights.
      const ringGeo = new T.RingGeometry(0.75, 1, 40).rotateX(-Math.PI / 2), shocks = [], ringPool = [];
      function ring(x, z, color, size, life) {
        const m = ringPool.pop() || new T.Mesh(ringGeo, new T.MeshBasicMaterial(Object.assign({ side: T.DoubleSide, opacity: 1 }, add)));
        m.material.color.set(color); m.material.opacity = 1; m.visible = true;
        m.position.set(x, 0.12, z); if (!m.parent) scene.add(m); shocks.push({ m, life, max: life, size });
      }
      // ---- Cinematic layer: light flares, ice shards, jagged lightning, screen flash, camera punch ----
      const flares = [];
      const flarePool = [];
      function flare(x, y, z, color, size, life) {
        if (flares.length > 40) return;
        const sp = flarePool.pop() || new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex }, add)));
        sp.material.color.set(color); sp.material.opacity = 1; sp.visible = true;
        sp.position.set(x, y, z); sp.scale.setScalar(size * 0.4); if (!sp.parent) scene.add(sp); flares.push({ sp, life, max: life, size });
      }
      const shardGeo = new T.ConeGeometry(0.22, 0.9, 5), shards = [], shardPool = [];
      function shatter(x, z, n, color) {
        for (let k = 0; k < n; k++) {
          if (shards.length > 120) break;
          const m = shardPool.pop() || new T.Mesh(shardGeo, new T.MeshLambertMaterial({ emissive: '#2a7fb0', transparent: true, opacity: 0.9 })), a = Math.random() * Math.PI * 2, v = rnd(4, 9);
          m.material.color.set(color); m.visible = true;
          m.position.set(x, rnd(1, 2), z); m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6)); m.scale.setScalar(rnd(0.7, 1.5)); if (!m.parent) scene.add(m);
          shards.push({ m, vx: Math.sin(a) * v, vy: rnd(4, 9), vz: Math.cos(a) * v, life: rnd(0.6, 1), sx: rnd(-12, 12), sz: rnd(-12, 12) });
        }
      }
      const boltMat = new T.MeshBasicMaterial(Object.assign({ color: '#e9d4ff' }, add)), boltCore = new T.MeshBasicMaterial(Object.assign({ color: '#ffffff' }, add));
      const segGeo = new T.BoxGeometry(1, 1, 1), boltsL = [];
      function lightning(x1, y1, z1, x2, y2, z2, w) {
        const g = new T.Group(), n = 7; let px = x1, py = y1, pz = z1;
        for (let k = 1; k <= n; k++) {
          const t = k / n, j = k === n ? 0 : 0.9;
          const nx = x1 + (x2 - x1) * t + rnd(-j, j), ny = y1 + (y2 - y1) * t + rnd(-j, j) * 0.5, nz = z1 + (z2 - z1) * t + rnd(-j, j);
          const len = Math.hypot(nx - px, ny - py, nz - pz);
          for (const [mat, ww] of [[boltMat, w], [boltCore, w * 0.35]]) {
            const m = new T.Mesh(segGeo, mat); m.position.set((px + nx) / 2, (py + ny) / 2, (pz + nz) / 2); m.scale.set(ww, ww, len); m.lookAt(nx, ny, nz); g.add(m);
          }
          px = nx; py = ny; pz = nz;
        }
        scene.add(g); boltsL.push({ g, life: 0.16 });
      }
      const flashEl = document.createElement('div');
      flashEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;mix-blend-mode:screen;transition:opacity .18s ease-out';
      document.body.appendChild(flashEl);
      function screenFlash(color, a) { flashEl.style.transition = 'none'; flashEl.style.background = 'radial-gradient(circle, ' + color + ', transparent 75%)'; flashEl.style.opacity = a; void flashEl.offsetWidth; flashEl.style.transition = 'opacity .35s ease-out'; flashEl.style.opacity = 0; }
      // V3: a red edge vignette when the hero is hit (and a slow pulse while health is low). Normal blending, so the
      // red reads even on a bright floor; only its opacity changes per frame (no repaint of the gradient).
      const hurtEl = document.createElement('div');
      hurtEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;background:radial-gradient(ellipse at center, transparent 48%, rgba(255,20,40,.55) 85%, rgba(160,0,20,.85) 100%)';
      document.body.appendChild(hurtEl);
      let hurtA = 0, lastHp = -1, hitSh = 0, doorFx = false, doorT = 0, fogSheets = [];
      let punch = 0;
      const BASE_FOV = 46;
      const auraG = new T.Mesh(new T.RingGeometry(1.25, 1.6, 6, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial(Object.assign({ color: '#3b8cff', side: T.DoubleSide }, add))); auraG.visible = false; scene.add(auraG);
      const aura2 = new T.Mesh(new T.RingGeometry(1.6, 1.75, 40, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial(Object.assign({ color: '#ffd23f', side: T.DoubleSide, opacity: 0.8 }, add))); aura2.visible = false; scene.add(aura2);
      const pillar = new T.Mesh(new T.CylinderGeometry(1.1, 1.5, 9, 20, 1, true).translate(0, 4.5, 0), new T.MeshBasicMaterial(Object.assign({ map: beamTex, color: '#ff6a5a', side: T.DoubleSide, opacity: 0.2 }, add))); pillar.visible = false; scene.add(pillar);
      // Top-tier gear colours: Mythic red/gold, Celestial cyan/violet (ring, pillar and sparkles).
      const topCol = g => g.celestial ? (Math.random() < 0.5 ? '#3fe8ff' : '#d7a8ff') : Math.random() < 0.5 ? '#ff4d5a' : '#ffd23f';
      const tintTop = g => { aura2.material.color.set(g.celestial ? '#9ff6ff' : '#ffd23f'); pillar.material.color.set(g.celestial ? '#5fe0ff' : '#ff6a5a'); };
      const handG = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: '#3b8cff' }, add))); handG.visible = false; scene.add(handG);
      // Ground effects: soft glowing discs (own material each, so colours never leak between pools).
      const discGeo = new T.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
      const zoneM = pool(() => { const m = new T.Mesh(discGeo, new T.MeshBasicMaterial(Object.assign({ map: zoneTex, color: '#ff6a10' }, add))); m.renderOrder = 3; return m; });
      const auraM = new T.Mesh(new T.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new T.MeshBasicMaterial(Object.assign({ map: frostTex, color: '#8fd4ff', opacity: 0.7 }, add)));
      const iceG = new T.Group(); iceG.visible = false; scene.add(iceG);
      { const cg = new T.OctahedronGeometry(0.36, 0).scale(1, 2.2, 1), cm = new T.MeshLambertMaterial({ color: '#dff6ff', emissive: '#4fb4ff', emissiveIntensity: 0.7, transparent: true, opacity: 0.92 });
        for (let k = 0; k < 6; k++) { const c = new T.Mesh(cg, cm), gl = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: '#7fd8ff', opacity: 0.7 }, add))); gl.scale.setScalar(1.3); c.add(gl); iceG.add(c); } }
      const auraF = new T.Mesh(discGeo, new T.MeshBasicMaterial(Object.assign({ map: glowTex, color: '#3fa8ff', opacity: 0.35 }, add)));
      auraM.visible = auraF.visible = false; scene.add(auraM, auraF);
      const bladeM = pool(() => { const g = new T.Group(); const b = new T.Mesh(swordGeo, bmat('#ffffff', { vertexColors: true })); b.scale.setScalar(1.4); g.add(b);
        const gl = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: '#cfe8ff' }, add))); gl.scale.setScalar(2); g.add(gl); return g; });
      // Mana shield: bright at the rim (fresnel), a faint hex lattice and a light band sweeping up — reads as a force field.
      const bubbleMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { t: { value: 0 }, col: { value: new T.Color('#7fd0ff') } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vP = position; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }',
        fragmentShader: 'uniform float t; uniform vec3 col; varying vec3 vN; varying vec3 vV; varying vec3 vP;' +
          'float hx(vec2 p){ p.x *= 1.1547; p.y += mod(floor(p.x), 2.0) * 0.5; p = abs(fract(p) - 0.5); return abs(max(p.x * 1.5 + p.y, p.y * 2.0) - 1.0); }' +
          'void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.0); vec2 uv = vec2(atan(vP.z, vP.x) * 1.9, vP.y * 3.0); float h = smoothstep(0.1, 0.0, hx(uv));' +
          ' float sw = smoothstep(0.12, 0.0, abs(fract(vP.y * 0.5 + 0.5 - t * 0.45) - 0.5)); float a = f * 0.95 + h * (0.12 + f * 0.6) + sw * 0.22; gl_FragColor = vec4(col * (0.8 + f), a); }' });
      const bubble = new T.Mesh(new T.SphereGeometry(1, 32, 20), bubbleMat); bubble.visible = false; scene.add(bubble);
      // Passive-skill marks on the hero: wisdom motes, a rage glow, a second-wind halo, a giant-slayer hand flame.
      const wisdomS = [0, 1].map(() => { const s = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: '#6fb8ff' }, add))); s.visible = false; scene.add(s); return s; });
      const rageG = new T.Mesh(new T.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new T.MeshBasicMaterial(Object.assign({ map: glowTex, color: '#ff2a2a', opacity: 0.6 }, add))); rageG.visible = false; scene.add(rageG);
      const haloS = new T.Mesh(new T.TorusGeometry(0.42, 0.06, 8, 32).rotateX(Math.PI / 2), new T.MeshBasicMaterial(Object.assign({ color: '#ffe08a' }, add))); haloS.visible = false; scene.add(haloS);
      const giantS = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: '#ff4a2a' }, add))); giantS.visible = false; scene.add(giantS);
      const meteorS = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: '#ff8a2a' }, add))); meteorS.visible = false; scene.add(meteorS);
      // ---------- V2 effect layer ----------
      // Frost rings: the frost rune circle laid on the floor, growing and fading (ice hits, frozen foes, Freeze pick).
      const frostRings = [], frostPool = [];
      function frostRing(x, z, size, life) {
        if (frostRings.length > 24) return;
        const m = frostPool.pop() || new T.Mesh(new T.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new T.MeshBasicMaterial(Object.assign({ map: frostTex, color: '#b8ecff' }, add)));
        m.visible = true; m.position.set(x, 0.1, z); m.rotation.y = Math.random() * 6; m.renderOrder = 3; if (!m.parent) scene.add(m);
        frostRings.push({ m, life, max: life, size });
      }
      // Frozen foes: ice shell, crystals at the feet and a frost disc (shared by every frozen foe).
      const ICE = { shell: new T.IcosahedronGeometry(0.75, 0), shellM: new T.MeshLambertMaterial({ color: '#cdf3ff', emissive: '#3a9ad0', transparent: true, opacity: 0.45, flatShading: true, depthWrite: false }),
        cry: new T.ConeGeometry(0.15, 0.85, 5).translate(0, 0.42, 0), cryM: new T.MeshLambertMaterial({ color: '#e8f8ff', emissive: '#4fb4ff', emissiveIntensity: 0.7, transparent: true, opacity: 0.92, flatShading: true }),
        disc: new T.PlaneGeometry(2.8, 2.8).rotateX(-Math.PI / 2), discM: new T.MeshBasicMaterial(Object.assign({ map: frostTex, color: '#b8ecff', opacity: 0.75 }, add)) };
      let nRune = 0, frameN = 0;
      // Rune circles under casters (enemy wizards and bosses winding up a spell): pooled, one per caster.
      const runeTexV2 = window.Fx3D ? Fx3D.tex.rune() : ringTex;
      const castRunes = pool(() => { const m = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial(Object.assign({ map: runeTexV2, color: '#c77dff' }, add))); m.renderOrder = 3; return m; });
      // The hero's hands: a charging orb for the mage, speed motes for attack speed, an ember glow for attack boosts.
      const chargeS = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: '#c48bff' }, add))); chargeS.visible = false; scene.add(chargeS);
      const speedS = [0, 1].map(() => { const sp = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: '#ffe27a' }, add))); sp.visible = false; scene.add(sp); return sp; });
      const powerS = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: '#ff5a2a' }, add))); powerS.visible = false; scene.add(powerS);
      // A rune aura under the living boss in its crew colour (on top of the red-violet spotlight).
      const bossAura = F3 ? F3.aura('#ff3a5a', 7) : null; if (bossAura) bossAura.visible = false;
      // Every skill shows its own effect the moment it is picked (style, main colour, second colour); several also keep
      // a visible mark while they are active (see the hero section of render()).
      const SKILL_FX = {
        front: ['arrows', '#9ff0ff', '#ffffff'], multi: ['arrows', '#ffd27a', '#ffffff'], diag: ['arrows', '#7dffae', '#ffffff'], side: ['arrows', '#ff9ad8', '#ffffff'],
        rear: ['arrows', '#c9a2ff', '#ffffff'], pierce: ['arrows', '#ffffff', '#9ff0ff'], rain: ['arrows', '#fff1a8', '#ffb347'],
        ricochet: ['bounce', '#5fe0ff', '#ffffff'], wall: ['bounce', '#ffb347', '#ffffff'], blades: ['bounce', '#dfefff', '#9fd8ff'],
        atk: ['power', '#ff4a2a', '#ffd23f'], atkS: ['power', '#eaf6ff', '#9fd8ff'], giant: ['power', '#ff4a2a', '#ffd23f'], rage: ['power', '#ff2a1a', '#ff8a3a'],
        spd: ['speed', '#ffe27a', '#ffffff'], spdS: ['speed', '#ffe27a', '#fff6c8'],
        crit: ['star', '#ffd23f', '#ff5a3a'], headshot: ['target', '#ff3a3a', '#ffd23f'], execute: ['dark', '#c08cff', '#5a1a8a'],
        hp: ['heal', '#ffcf5a', '#fff3c0'], hpS: ['heal', '#ffcf5a', '#ffffff'], potion: ['heal', '#ff8ab0', '#ffffff'], vamp: ['heal', '#ff2a4a', '#ff8a95'],
        fire: ['fire', '#ff7a1a', '#ffd23f'], trail: ['fire', '#ff5a10', '#ffc23a'], orbit: ['fire', '#ff7a1a', '#ffd23f'], meteor: ['fire', '#ff5a10', '#ffd23f'],
        ice: ['ice', '#8fe6ff', '#ffffff'], frostaura: ['ice', '#8fd4ff', '#ffffff'], bolt: ['bolt', '#c77dff', '#7dff4a'], poison: ['poison', '#7dff4a', '#b6ff5a'],
        nova: ['arcane', '#b36bff', '#ffffff'], split: ['arcane', '#d7a8ff', '#5fe0ff'], shield: ['shield', '#8fd8ff', '#ffffff'],
        dodge: ['wind', '#e2f4ff', '#bff0ff'], move: ['wind', '#9ff0ff', '#ffffff'], boots: ['wind', '#e2f4ff', '#ffffff'],
        greed: ['gold', '#ffd23f', '#fff3a0'], wisdom: ['xp', '#6fb8ff', '#d8ecff'], second: ['holy', '#ffe08a', '#ffffff'],
      };
      function skillFx(key, x, z) {
        const d = SKILL_FX[key] || ['star', '#ffffff', '#ffd23f'], st = d[0], c1 = d[1], c2 = d[2], face = level && level.p ? level.p.face : 0;
        ring(x, z, c1, 5.5, 0.5); flare(x, 1.6, z, c1, 8, 0.35);
        if (F3) { F3.ring(x, 0.5, z, c1, 2.6, 30, c2); F3.star(x, 2.2, z, c1, 5, 0.45); F3.spiral(x, z, c1, 1.1, 4, 18, c2); }
        if (st === 'arrows' && F3) for (let k = -4; k <= 4; k++) { const a = face + k * 0.16, v = rnd(16, 24); F3.emit(x + Math.sin(a), 1.4, z + Math.cos(a), Math.sin(a) * v, 0.4, Math.cos(a) * v, 0.38, 0.45, 0.12, k % 2 ? c1 : c2, 1, 0, 1.2, 0.05, 2); }
        else if (st === 'bounce') { for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; flare(x + Math.sin(a) * 2.2, 1.2, z + Math.cos(a) * 2.2, c1, 3, 0.25); } if (F3) F3.chips(x, z, 6, rockCol, 1); }
        else if (st === 'power') { for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2; emit(flamesC, x + Math.sin(a) * 1.1, 0.3, z + Math.cos(a) * 1.1, Math.sin(a) * 0.6, rnd(3, 7), Math.cos(a) * 0.6, rnd(0.4, 0.7), k % 3 ? c1 : c2, -2); } }
        else if (st === 'speed') { if (F3) { F3.spiral(x, z, c1, 1.6, 6, 30, c2); F3.ring(x, 1.2, z, c1, 1.6, 20); } ring(x, z, c2, 3.5, 0.3); }
        else if (st === 'star') { if (F3) { F3.star(x, 2.4, z, c1, 9, 0.5); F3.star(x, 2.4, z, c2, 5, 0.3); } }
        else if (st === 'target') { if (F3) F3.charge(x, 1.4, z, c1, 3.5, 24, 0.3, c2); ring(x, z, c1, 3, 0.4); ring(x, z, c1, 6, 0.6); }
        else if (st === 'dark') { if (F3) F3.charge(x, 1.6, z, c1, 3, 26, 0.4, c2); for (let k = 0; k < 6; k++) emit(puffs, x + rnd(-1, 1), 0.8, z + rnd(-1, 1), rnd(-0.6, 0.6), rnd(0.8, 1.6), rnd(-0.6, 0.6), 0.9, '#3a1a5a'); }
        else if (st === 'heal') { if (F3) F3.heal(x, z, c1, 1.6, c2); }
        else if (st === 'fire') fx('ignite', x, z);
        else if (st === 'ice') { if (F3) F3.frost(x, 1.4, z, 1.6); frostRing(x, z, 4.5, 0.9); shatter(x, z, 10, '#cdf3ff'); }
        else if (st === 'bolt') { if (F3) { F3.bolt(x + 1, 14, z - 1, x, 0.3, z, { w: 0.7, colA: c1, colB: c2, branches: 3, life: 0.3 }); F3.crack(x, z, 3, 1.6, 1, 0.5); } screenFlash('rgba(200,150,255,.45)', 0.4); }
        else if (st === 'poison') { for (let k = 0; k < 16; k++) emit(puffs, x + rnd(-1.4, 1.4), 0.5, z + rnd(-1.4, 1.4), rnd(-0.6, 0.6), rnd(0.6, 1.4), rnd(-0.6, 0.6), rnd(0.8, 1.2), k % 2 ? '#3ad12a' : '#1f7a1a'); if (F3) for (let k = 0; k < 12; k++) F3.flake(x + rnd(-1.5, 1.5), rnd(0.2, 1), z + rnd(-1.5, 1.5), c2, 0.4, 1); }
        else if (st === 'arcane') { if (F3) { F3.charge(x, 1.6, z, c1, 3, 24, 0.35, c2); F3.ring(x, 0.6, z, c1, 4, 36, c2); } ring(x, z, c1, 9, 0.5); }
        else if (st === 'shield') { if (F3) F3.star(x, 1.6, z, c1, 8, 0.45); shatter(x, z, 6, '#dff6ff'); }
        else if (st === 'wind') { for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; emit(puffs, x + Math.sin(a), 0.4, z + Math.cos(a), Math.sin(a) * 4, 0.5, Math.cos(a) * 4, 0.5, c1); } }
        else if (st === 'gold') { for (let k = 0; k < 40; k++) { const a = Math.random() * Math.PI * 2, v = rnd(2, 6); emit(sparks, x, 1.6, z, Math.sin(a) * v, rnd(6, 11), Math.cos(a) * v, rnd(0.8, 1.3), k % 2 ? c1 : c2, 18); } }
        else if (st === 'xp') { if (F3) F3.spiral(x, z, c1, 0.9, 7, 30, c2); }
        else if (st === 'holy') { const b = beamPool.pop() || new T.Mesh(lvBeamGeo, new T.MeshBasicMaterial(Object.assign({ map: beamTex, color: '#9dffc9', side: T.DoubleSide }, add))); b.material.color.set(c1); b.visible = true; b.position.set(x, 0, z); if (!b.parent) scene.add(b); beams.push({ m: b, life: 0.9, follow: true }); }
        screenFlash(c1, 0.22);
      }
      // Bosses: each one carries a rig of its own (orbiting bones, bubbles, spores, lava crystals and fire wings, an ice
      // crown, floating rocks) so it reads as a unique creature, not a scaled-up foe. Guardians: crew-coloured crystals.
      const rigGeo = { bone: new T.BoxGeometry(0.16, 0.16, 0.9), bub: new T.SphereGeometry(0.26, 10, 8), cry: new T.OctahedronGeometry(0.28, 0).scale(1, 2.4, 1), rock: new T.DodecahedronGeometry(0.42, 0) };
      function bossRig(g, e) {
        const geo = g.userData.m.geometry; if (!geo.boundingBox) geo.computeBoundingBox();
        const hy = geo.boundingBox.max.y * g.userData.m.scale.y, R = new T.Group(), items = [], look = (!e.mid && e.kind) || 'guard';
        const crew = CREW_C[(e.crew || 0) % 6];
        const sp = (c, s) => { const o = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: c }, add))); o.scale.setScalar(s); return o; };
        const put = (mesh, k, n, r, y, spin, glowC) => { const o = new T.Group(); o.add(mesh); if (glowC) o.add(sp(glowC, 1.2)); R.add(o); items.push({ o, a: k / n * Math.PI * 2, r, y, spin }); return o; };
        if (look === 'warrior') { const bm = new T.MeshLambertMaterial({ color: '#f1ead8', emissive: '#3a2a5a' }); for (let k = 0; k < 6; k++) put(new T.Mesh(rigGeo.bone, bm), k, 6, hy * 0.42, hy * 0.55, 1.4, '#9a5cff');
          for (const sx of [-1, 1]) { const f = sp('#b36bff', hy * 0.28); f.position.set(sx * hy * 0.2, hy * 0.78, 0); R.add(f); items.push({ o: f, fire: true }); } }
        else if (look === 'glubx') { const wm = new T.MeshLambertMaterial({ color: '#7fe8ff', emissive: '#0a5a7a', transparent: true, opacity: 0.55 }); for (let k = 0; k < 8; k++) put(new T.Mesh(rigGeo.bub, wm), k, 8, hy * 0.45, hy * 0.35, 0.8, '#3affef'); }
        else if (look === 'mushking') { for (let k = 0; k < 7; k++) put(new T.Mesh(rigGeo.bub, bmat('#a8ff5a')), k, 7, hy * 0.4, hy * 0.6, 0.6, '#8aff4a'); }
        else if (look === 'dragonx') { const lm = new T.MeshLambertMaterial({ color: '#ff8a2a', emissive: '#ff4a00', emissiveIntensity: 0.9 }); for (let k = 0; k < 5; k++) put(new T.Mesh(rigGeo.cry, lm), k, 5, hy * 0.45, hy * 0.5, 2, '#ff6a10');
          // Fire wings: two big additive flame sheets behind the shoulders that flap.
          const wt = new T.MeshBasicMaterial(Object.assign({ map: glowTex, color: '#ff5a10', side: T.DoubleSide, opacity: 0.75 }, add));
          for (const sx of [-1, 1]) { const w = new T.Mesh(new T.PlaneGeometry(hy * 0.9, hy * 0.55).translate(sx * hy * 0.45, 0, 0), wt); const pv = new T.Group(); pv.position.set(sx * hy * 0.1, hy * 0.72, -hy * 0.12); pv.add(w); R.add(pv); items.push({ o: pv, wing: sx }); } }
        else if (look === 'alpakingx') { const im = new T.MeshLambertMaterial({ color: '#e8f8ff', emissive: '#4fb4ff', emissiveIntensity: 0.6, transparent: true, opacity: 0.9 }); for (let k = 0; k < 7; k++) put(new T.Mesh(rigGeo.cry, im), k, 7, hy * 0.22, hy * 1.08, 1.1, '#8fe6ff'); }
        else if (look === 'golex') { const rm = new T.MeshLambertMaterial({ color: '#7a7470', emissive: '#0a4a5a', flatShading: true }); for (let k = 0; k < 6; k++) put(new T.Mesh(rigGeo.rock, rm), k, 6, hy * 0.5, hy * 0.45, 0.5, '#5ff3ff'); }
        else { const cm = new T.MeshLambertMaterial({ color: crew, emissive: crew, emissiveIntensity: 0.5 }); for (let k = 0; k < 3; k++) put(new T.Mesh(rigGeo.cry, cm), k, 3, hy * 0.42, hy * 0.6, 1.3, crew); }
        // The rig hangs on the boss but does not turn with its facing.
        g.add(R); g.userData.rig = { R, items, hy, look };
      }
      // Build the shader programs of the V2 effects once, at the first room (a first frozen foe or rune circle used to
      // compile mid-fight: a ~1 s hitch in the benchmark).
      function warmV2(S) {
        const tmp = new T.Group(); tmp.position.set(S.p.x, -50, S.p.z);
        tmp.add(new T.Mesh(ICE.shell, ICE.shellM), new T.Mesh(ICE.cry, ICE.cryM), new T.Mesh(ICE.disc, ICE.discM), new T.Mesh(rigGeo.bone, new T.MeshLambertMaterial({ color: '#ffffff', emissive: '#222222' })),
          new T.Mesh(rigGeo.bub, new T.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 })), new T.Mesh(rigGeo.rock, new T.MeshLambertMaterial({ color: '#ffffff', flatShading: true })),
          new T.Mesh(rigGeo.cry, new T.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 })), new T.Mesh(rigGeo.cry, new T.MeshBasicMaterial(Object.assign({ map: glowTex, side: T.DoubleSide }, add))));
        const fk = (S.enemies.find(e => !e.boss) || {}).kind; if (fk && window.ARROW_CHARS.chars[fk]) tmp.add(charMesh(fk, 1, 'foe')); // foe shader
        scene.add(tmp); frostRing(S.p.x, S.p.z, 0.01, 0.01); castRunes.get(0);
        const shown = [chargeS, powerS, ...speedS, bossAura].filter(o => o && !o.visible); shown.forEach(o => { o.visible = true; });
        const dv = dyn.visible; dyn.visible = true;
        try { renderer.compile(scene, camera); } catch (e) { }
        dyn.visible = dv; shown.forEach(o => { o.visible = false; }); castRunes.hide(0); scene.remove(tmp);
      }
      function tickRig(g, e, time, dt) {
        const rg = g.userData.rig; if (!rg) return;
        rg.R.rotation.y = -g.rotation.y; rg.R.visible = e.hp > 0;
        const rage = e.rage ? 1.8 : 1;
        for (const it of rg.items) {
          if (it.fire) { it.o.scale.setScalar(rg.hy * (0.26 + 0.06 * Math.sin(time * 14 + it.o.position.x))); if (Math.random() < dt * 14) { const w = it.o.getWorldPosition(wv); emit(flamesC, w.x, w.y, w.z, 0, rnd(1, 2), 0, 0.4, '#9a5cff', -2); } continue; }
          if (it.wing) { it.o.rotation.y = it.wing * (0.35 + 0.35 * Math.sin(time * 5 * rage)); it.o.children[0].material.opacity = 0.55 + 0.2 * Math.sin(time * 9); if (Math.random() < dt * 20) { const w = it.o.getWorldPosition(wv); emit(flamesC, w.x + it.wing * rnd(0, rg.hy * 0.8), w.y + rnd(-0.5, 0.5), w.z, 0, rnd(1, 3), 0, 0.4, Math.random() < 0.5 ? '#ff5a10' : '#ffd23f', -2); } continue; }
          const a = it.a + time * it.spin * rage;
          it.o.position.set(Math.sin(a) * it.r, it.y + Math.sin(time * 2.2 + it.a) * rg.hy * 0.06, Math.cos(a) * it.r);
          it.o.rotation.set(time * 1.3 + it.a, a, time * 0.7);
        }
        if (rg.look === 'mushking' && Math.random() < dt * 6) emit(puffs, e.x + rnd(-1.5, 1.5), rnd(0.5, rg.hy), e.z + rnd(-1.5, 1.5), 0, 0.6, 0, 1.2, '#4a8a2a');
        if (rg.look === 'glubx' && F3 && Math.random() < dt * 10) F3.mote(e.x + rnd(-1.5, 1.5), 0.3, e.z + rnd(-1.5, 1.5), '#7fe8ff', 0.25, 1.4, 1.6);
      }
      // ---------- V3: elite marks and per-species deaths ----------
      // Elites wear a spinning golden crown over the head and a golden rune ring at the feet (pooled, built once).
      const eliteCrowns = pool(() => { const g = topPiece('crown'); g.scale.setScalar(1.7); return g; }), eliteG = [];
      const eliteRunes = pool(() => { const m = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial(Object.assign({ map: F3 ? Fx3D.tex.rune() : glowTex, color: '#ffc83a', opacity: 0.85 }, add))); m.renderOrder = 2; return m; });
      // Death styles by species: skeletons fall apart into bones, slimes burst in a splash of goo, casters and
      // spirits evaporate into a rising violet mist, demons and dragons burst into embers.
      const DEATH = {};
      ['minion', 'warrior', 'archer', 'orcskull'].forEach(k => { DEATH[k] = ['bone', '#efe6d2']; });
      [['greenblob', '#7dff4a'], ['pinkblob', '#ff7ad8'], ['spikyblob', '#b6ff4a'], ['glub', '#4ad8ff'], ['glubx', '#4ad8ff'], ['frog', '#6fe04a'], ['squidle', '#c77dff'], ['fishb', '#4ab0ff'], ['fish', '#4ab0ff'], ['mushnub', '#ff8a6a']].forEach(([k, c]) => { DEATH[k] = ['slime', c]; });
      [['necro', '#b36bff'], ['wizardb', '#6a8cff'], ['ghost', '#bfe8ff'], ['ghostskull', '#9fffe0'], ['bluedemon', '#5aa8ff'], ['alien', '#7dff9a']].forEach(([k, c]) => { DEATH[k] = ['mist', c]; });
      [['demon', '#ff5a1a'], ['demonf', '#ff7a2a'], ['dragon', '#ff9a3a'], ['dragonx', '#ff5a1a'], ['cactoro', '#ffb040']].forEach(([k, c]) => { DEATH[k] = ['ember', c]; });
      function speciesDeath(e) {
        const d = DEATH[e.kind], x = e.x, z = e.z, s = e.scale || 1;
        if (!d || !F3) return;
        const [st, c] = d;
        if (st === 'bone') {
          // Bones clatter apart: pale chips tumble out, a puff of grave dust, a skull-white flash.
          F3.chips(x, z, 12, '#e8dcc0', 1.3 * s); F3.star(x, 1.6 * s, z, '#fff6e0', 4, 0.25);
          for (let k = 0; k < 8; k++) emit(puffs, x + rnd(-0.7, 0.7), 0.5, z + rnd(-0.7, 0.7), rnd(-1.5, 1.5), rnd(0.4, 1.2), rnd(-1.5, 1.5), rnd(0.6, 0.9), '#b8ad98');
        } else if (st === 'slime') {
          // Goo splash: droplets arc out and fall, a wet ring and a dark splat on the floor.
          for (let k = 0; k < 26; k++) { const a = Math.random() * 6.28, v = rnd(3, 9); F3.emit(x, 0.8 * s, z, Math.sin(a) * v, rnd(4, 10), Math.cos(a) * v, rnd(0.5, 0.9), 0.55 * s, 0.2, k % 3 ? c : '#ffffff', 1, 22, 1.2, 0, 0); }
          F3.ring(x, 0.3, z, c, 2.2 * s, 22, '#ffffff'); F3.crack(x, z, 2.4 * s, 3, 1, 0.55); ring(x, z, c, 4 * s, 0.4);
        } else if (st === 'mist') {
          // Evaporates: a rising violet helix, motes drifting up and a soft glow where it stood.
          F3.spiral(x, z, c, 0.9 * s, 6, 26, '#ffffff'); F3.star(x, 1.8 * s, z, c, 5, 0.4); flare(x, 1.5, z, c, 6, 0.5);
          for (let k = 0; k < 14; k++) F3.mote(x + rnd(-0.8, 0.8), rnd(0.4, 2.4) * s, z + rnd(-0.8, 0.8), k % 2 ? c : '#ffffff', 0.35, rnd(1, 1.8), rnd(1.5, 3));
          for (let k = 0; k < 5; k++) emit(puffs, x + rnd(-0.5, 0.5), rnd(0.6, 2), z + rnd(-0.5, 0.5), 0, rnd(1, 2), 0, 0.9, c);
        } else {
          // Embers: a fiery burst, sparks thrown high and a scorch mark.
          for (let k = 0; k < 30; k++) { const a = Math.random() * 6.28, v = rnd(2, 8); emit(flamesC, x, 1 * s, z, Math.sin(a) * v, rnd(3, 9), Math.cos(a) * v, rnd(0.35, 0.7), k % 2 ? c : '#ffd23f', -3); }
          F3.crack(x, z, 2.6 * s, 3, 1, 0.7); F3.ring(x, 0.5, z, c, 2.4 * s, 24, '#ffd23f');
        }
        if (e.elite) { F3.coins(x, 1.2, z, 18, 3); F3.star(x, 2.4, z, '#ffd23f', 9, 0.45); ring(x, z, '#ffd23f', 7, 0.6); }
      }

      function fx(kind, x, z, color, n) {
        n = n || 10; color = color || '#ffe9a8';
        if (kind === 'hit') { for (let k = 0; k < n * 2; k++) emit(sparks, x, 1.4, z, rnd(-7, 7), rnd(1, 8), rnd(-7, 7), rnd(0.2, 0.5), color, 14); flare(x, 1.4, z, color, 3.8, 0.18); if (F3) { F3.impact(x, 1.4, z, color, n > 10 ? 1.4 : 1, n > 10 ? 4 : 2, rockCol); if (n > 10) F3.ring(x, 1.2, z, color, 1.4, 14); } }
        else if (kind === 'die') {
          if (F3) { F3.chips(x, z, n > 30 ? 14 : 6, rockCol, n > 30 ? 1.6 : 1.1); F3.crack(x, z, n > 30 ? 5 : 2.6, 2.6, 0, 0.75); F3.impact(x, 1.4, z, color, n > 30 ? 1.6 : 1, 0); F3.shake(n > 30 ? 0.5 : 0.12); }
          flare(x, 1.4, z, color, 7, 0.35);
          if (F3) { F3.star(x, 1.6, z, color, n > 30 ? 9 : 4.5, 0.35); F3.ring(x, 0.8, z, color, n > 30 ? 4 : 2, n > 30 ? 40 : 18, '#ffd23f'); F3.spiral(x, z, '#e8e0ff', 0.5, 3, n > 30 ? 20 : 8, '#9fd8ff'); }
          for (let k = 0; k < n * 1.5; k++) emit(sparks, x + rnd(-0.6, 0.6), rnd(0.8, 2.2), z + rnd(-0.6, 0.6), rnd(-5, 5), rnd(3, 9), rnd(-5, 5), rnd(0.6, 1.1), k % 3 ? color : '#ffd23f', 18);
          for (let k = 0; k < 6; k++) emit(puffs, x + rnd(-0.8, 0.8), 0.6, z + rnd(-0.8, 0.8), rnd(-1.2, 1.2), rnd(0.5, 1.5), rnd(-1.2, 1.2), rnd(0.5, 0.8), '#6a5a4a');
        } else if (kind === 'rise') for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; emit(puffs, x + Math.sin(a), 0.3, z + Math.cos(a), Math.sin(a) * 2, 0.8, Math.cos(a) * 2, 0.6, '#5a4a3a'); }
        else if (kind === 'blink') { if (F3) { F3.star(x, 1.4, z, '#c77dff', 4.5, 0.3); F3.spiral(x, z, '#b04dff', 0.6, 3, 10, '#ffffff'); } for (let k = 0; k < 18; k++) emit(sparks, x, rnd(0.3, 2.8), z, rnd(-3, 3), rnd(-1, 3), rnd(-3, 3), rnd(0.3, 0.7), '#c77dff'); emit(puffs, x, 1.4, z, 0, 0, 0, 0.5, '#9d4dff'); }
        else if (kind === 'hurt') for (let k = 0; k < n; k++) emit(sparks, x, 1.5, z, rnd(-4, 4), rnd(1, 5), rnd(-4, 4), 0.35, color, 12);
        else if (kind === 'slam') { for (let k = 0; k < 30; k++) { const a = k / 30 * Math.PI * 2; emit(puffs, x + Math.sin(a) * 2, 0.4, z + Math.cos(a) * 2, Math.sin(a) * 9, 1, Math.cos(a) * 9, 0.6, '#8a7a6a'); }
          if (F3) { F3.crack(x, z, 7, 3.2, 0, 0.95); F3.chips(x, z, 16, rockCol, 1.8); F3.shake(0.55); } }
        else if (kind === 'door') for (let k = 0; k < 30; k++) emit(sparks, x + rnd(-2, 2), rnd(0, 3), z + rnd(0, 1), rnd(-1, 1), rnd(1, 4), rnd(0, 2), rnd(0.6, 1.2), '#9effc8');
        else if (kind === 'levelup') {
          for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, r = rnd(0.3, 1.4); emit(sparks, x + Math.sin(a) * r, rnd(0, 1), z + Math.cos(a) * r, 0, rnd(4, 9), 0, rnd(0.6, 1), color); }
          const b = beamPool.pop() || new T.Mesh(lvBeamGeo, new T.MeshBasicMaterial(Object.assign({ map: beamTex, color: '#9dffc9', side: T.DoubleSide }, add)));
          b.material.color.set('#9dffc9'); b.visible = true; b.position.set(x, 0, z); if (!b.parent) scene.add(b); beams.push({ m: b, life: 0.9, follow: true });
          if (F3 && n >= 40) { F3.spiral(x, z, color, 1.4, 7, 40, '#ffd23f'); F3.ring(x, 0.5, z, color, 3.5, 44, '#ffffff'); F3.star(x, 2.6, z, '#ffffff', 9, 0.5); ring(x, z, color, 8, 0.6); ring(x, z, '#ffd23f', 5, 0.45); frostRing(x, z, 5, 0.8); screenFlash('rgba(140,255,190,.4)', 0.45); punch = Math.max(punch, 0.5); }
        } else if (kind === 'ignite') {
          flare(x, 1.4, z, '#ff8a1f', 7, 0.35); flare(x, 1.4, z, '#ffe08a', 3.5, 0.18);
          for (let k = 0; k < 34; k++) { const a = Math.random() * Math.PI * 2, v = rnd(2, 7); emit(flamesC, x + Math.sin(a) * 0.3, rnd(0.6, 1.8), z + Math.cos(a) * 0.3, Math.sin(a) * v, rnd(2, 8), Math.cos(a) * v, rnd(0.35, 0.75), k % 3 ? '#ff6a10' : '#ffd23f', -3); }
          for (let k = 0; k < 20; k++) emit(sparks, x, 1.4, z, rnd(-8, 8), rnd(3, 11), rnd(-8, 8), rnd(0.4, 0.9), '#ffd23f', 12);
          for (let k = 0; k < 4; k++) emit(puffs, x + rnd(-0.6, 0.6), 1.6, z + rnd(-0.6, 0.6), rnd(-0.8, 0.8), rnd(1.5, 3), rnd(-0.8, 0.8), 0.9, '#3a2a22');
          ring(x, z, '#ff7a1a', 4.2, 0.4); if (F3) { F3.ring(x, 1, z, '#ff7a1a', 1.8, 20, '#ffd23f'); F3.star(x, 1.5, z, '#ff9a3a', 5, 0.3); F3.crack(x, z, 2.6, 2, 1, 0.6); }
        } else if (kind === 'freeze') {
          flare(x, 1.4, z, '#8fe6ff', 6.5, 0.35); flare(x, 1.4, z, '#ffffff', 3, 0.15);
          shatter(x, z, 9, '#cdf3ff');
          for (let k = 0; k < 30; k++) { const a = k / 30 * Math.PI * 2; emit(sparks, x + Math.sin(a) * 0.4, rnd(0.6, 2.2), z + Math.cos(a) * 0.4, Math.sin(a) * 7, rnd(0, 3), Math.cos(a) * 7, rnd(0.4, 0.8), k % 2 ? '#bff4ff' : '#ffffff', 4); }
          ring(x, z, '#8fe6ff', 4.4, 0.45); frostRing(x, z, 3.2, 1.6);
          if (F3) { F3.frost(x, 1.4, z, 1.5); F3.ring(x, 0.6, z, '#bff4ff', 2, 26, '#ffffff'); }
        } else if (kind === 'crit') {
          if (F3) { F3.crack(x, z, 3.6, 2.8, 0, 0.9); F3.chips(x, z, 8, rockCol, 1.3); F3.impact(x, 1.5, z, '#ffd23f', 1.5, 0); F3.shake(0.28); }
          flare(x, 1.5, z, '#ffffff', 8, 0.22); flare(x, 1.5, z, '#ffb02a', 11, 0.4);
          for (let k = 0; k < 44; k++) { const a = Math.random() * Math.PI * 2, v = rnd(8, 16); emit(sparks, x, 1.4, z, Math.sin(a) * v, rnd(2, 9), Math.cos(a) * v, rnd(0.25, 0.55), k % 2 ? '#ffd23f' : '#ff5a3a', 10); }
          ring(x, z, '#ffd23f', 5.5, 0.35); ring(x, z, '#ffffff', 3, 0.2);
          // A crossed slash of light over the target and a ray star: the crit reads at a glance.
          if (F3) { F3.star(x, 1.8, z, '#ffd23f', 8, 0.32); for (const d of [-1, 1]) for (let k = 0; k < 2; k++) F3.emit(x - d * 1.3, 2.6, z, d * 26, -14, 0, 0.12, 0.7, 0.2, k ? '#ffffff' : '#ffb02a', 1, 0, 0, 0.05, 2); F3.ring(x, 1.2, z, '#ffd23f', 2.4, 26, '#ff5a3a'); }
          punch = Math.max(punch, 1); screenFlash('rgba(255,220,140,.55)', 0.6);
        } else if (kind === 'zapfx') {
          // Chain lightning: violet -> acid green, forking, jumping enemy to enemy (and a strike from above).
          if (F3) { F3.bolt(x, 1.3, z, color.x2, 1.3, color.z2, { w: 0.5, colA: '#b04dff', colB: '#7dff4a', branches: 2, life: 0.26 }); F3.bolt(color.x2, 12, color.z2, color.x2, 0.3, color.z2, { w: 0.6, colA: '#c77dff', colB: '#e8ffd0', branches: 1, life: 0.2, sparks: 4 }); F3.crack(color.x2, color.z2, 2.2, 1.6, 1, 0.5); }
          else { lightning(x, 1.3, z, color.x2, 1.3, color.z2, 0.32); lightning(color.x2, 14, color.z2, color.x2, 0.2, color.z2, 0.5); }
          flare(color.x2, 1.4, color.z2, '#c77dff', 6, 0.25); flare(x, 1.4, z, '#e9d4ff', 3, 0.15);
          for (let k = 0; k < 16; k++) emit(sparks, color.x2, 1.2, color.z2, rnd(-7, 7), rnd(2, 9), rnd(-7, 7), rnd(0.2, 0.45), k % 2 ? '#c77dff' : '#ffffff', 12);
          ring(color.x2, color.z2, '#c77dff', 3.4, 0.3); screenFlash('rgba(200,150,255,.45)', 0.45);
        } else if (kind === 'nova') {
          if (F3) { F3.crack(x, z, 6, 2.6, 1, 0.6); F3.shake(0.3); }
          flare(x, 1.4, z, '#c48bff', 9, 0.35); flare(x, 1.4, z, '#ffffff', 4, 0.15);
          for (let k = 0; k < 60; k++) { const a = k / 60 * Math.PI * 2, v = rnd(12, 18); emit(sparks, x + Math.sin(a), 1.2, z + Math.cos(a), Math.sin(a) * v, rnd(0, 2), Math.cos(a) * v, rnd(0.3, 0.5), k % 3 ? '#b36bff' : '#ffffff'); }
          ring(x, z, '#b36bff', 12, 0.45); ring(x, z, '#ffffff', 7, 0.25); screenFlash('rgba(180,120,255,.4)', 0.4); punch = Math.max(punch, 0.6);
          if (F3) { F3.ring(x, 0.8, z, '#b36bff', 5.5, 48, '#ffffff'); F3.star(x, 1.6, z, '#d7a8ff', 9, 0.35); }
        } else if (kind === 'meteorhit') {
          if (F3) F3.explosion(x, 1, z, 2.4, { rocks: 12, shake: 0.45, rockCol });
          flare(x, 1.5, z, '#ffffff', 9, 0.2); flare(x, 1.5, z, '#ff6a10', 14, 0.5);
          for (let k = 0; k < 60; k++) { const a = Math.random() * Math.PI * 2, v = rnd(4, 14); emit(flamesC, x, 1, z, Math.sin(a) * v, rnd(3, 12), Math.cos(a) * v, rnd(0.4, 0.9), k % 3 ? '#ff5a10' : '#ffd23f', 8); }
          for (let k = 0; k < 10; k++) emit(puffs, x + rnd(-1.5, 1.5), 1, z + rnd(-1.5, 1.5), rnd(-2, 2), rnd(1, 4), rnd(-2, 2), 1.2, '#2e2018');
          ring(x, z, '#ff7a1a', 8, 0.5); ring(x, z, '#ffd23f', 4.5, 0.3); screenFlash('rgba(255,150,60,.55)', 0.55); punch = Math.max(punch, 1);
          if (F3) { F3.ring(x, 0.6, z, '#ff7a1a', 4, 40, '#ffd23f'); F3.star(x, 2, z, '#ffb02a', 10, 0.4); }
        } else if (kind === 'rainhit') {
          if (F3) F3.chips(x, z, 4, rockCol, 1);
          flare(x, 1, z, '#fff1a8', 4.5, 0.2);
          for (let k = 0; k < 24; k++) emit(sparks, x + rnd(-1.6, 1.6), 0.4, z + rnd(-1.6, 1.6), rnd(-3, 3), rnd(3, 8), rnd(-3, 3), rnd(0.3, 0.6), k % 2 ? '#fff1a8' : '#ffb347', 14);
          for (let k = 0; k < 6; k++) emit(puffs, x + rnd(-1.5, 1.5), 0.5, z + rnd(-1.5, 1.5), rnd(-1, 1), 1, rnd(-1, 1), 0.6, '#6a5a4a');
          ring(x, z, '#fff1a8', 5, 0.3);
        } else if (kind === 'shieldpop') {
          flare(x, 1.5, z, '#8fd8ff', 7, 0.3); ring(x, z, '#8fd8ff', 5, 0.35); if (F3) { F3.star(x, 1.6, z, '#bfeaff', 7, 0.3); F3.ring(x, 1.4, z, '#8fd8ff', 2.4, 24, '#ffffff'); }
          for (let k = 0; k < 30; k++) { const a = Math.random() * Math.PI * 2; emit(sparks, x, rnd(0.5, 2.5), z, Math.sin(a) * 8, rnd(-1, 4), Math.cos(a) * 8, 0.4, '#bfeaff'); }
        } else if (kind === 'heal') {
          flare(x, 1.5, z, color, 5, 0.4); if (F3) F3.heal(x, z, color, 1, '#ffffff'); ring(x, z, color, 3.2, 0.4);
          for (let k = 0; k < 14; k++) { const a = Math.random() * Math.PI * 2, r = rnd(0.4, 1.2); emit(sparks, x + Math.sin(a) * r, rnd(0.2, 1.2), z + Math.cos(a) * r, 0, rnd(2.5, 5), 0, rnd(0.6, 1), k % 2 ? '#7dffae' : '#d8ffe6'); }
        } else if (kind === 'skill') skillFx(color, x, z);
        // A player shot landed: the element / class flavour on top of the plain hit.
        else if (kind === 'shothit') {
          const sk = (level && level.skills) || {}, orb = level && level.shotKind === 'orb';
          if (F3 && orb) { F3.star(x, 1.4, z, sk.fire ? '#ff9a3a' : sk.ice ? '#bff4ff' : '#c48bff', 3.4, 0.22); F3.ring(x, 1.2, z, sk.ice ? '#8fe6ff' : '#b36bff', 1.1, 12, '#5fe0ff'); }
          if (F3 && sk.ice) { if (Math.random() < 0.6) F3.frost(x, 1.3, z, 0.45); else F3.star(x, 1.3, z, '#bff4ff', 2.6, 0.18); if (Math.random() < 0.3) frostRing(x, z, 1.8, 0.7); }
          if (F3 && sk.fire) { for (let k = 0; k < 10; k++) { const a = Math.random() * Math.PI * 2, v = rnd(2, 5); emit(flamesC, x, 1.2, z, Math.sin(a) * v, rnd(2, 5), Math.cos(a) * v, rnd(0.25, 0.45), k % 2 ? '#ff6a10' : '#ffd23f', -2); } }
          if (F3 && sk.bolt) F3.bolt(x + rnd(-0.6, 0.6), 2.6, z + rnd(-0.6, 0.6), x, 0.6, z, { w: 0.3, colA: '#c77dff', colB: '#e8ffd0', branches: 0, life: 0.12, sparks: 3, flare: false });
          if (sk.poison) for (let k = 0; k < 8; k++) emit(sparks, x + rnd(-0.4, 0.4), 1.2, z + rnd(-0.4, 0.4), rnd(-3, 3), rnd(1, 4), rnd(-3, 3), rnd(0.3, 0.6), k % 2 ? '#7dff4a' : '#d8ff9a', 10);
          if (n > 1 && F3) F3.star(x, 1.6, z, '#ffd23f', 3, 0.15); // crit glint (the big crit burst comes from 'crit')
        }
        // A frozen foe dies: it bursts into ice.
        else if (kind === 'shatter') { if (F3) { F3.frost(x, 1.4, z, 2.4); F3.ring(x, 0.6, z, '#bff4ff', 3, 36, '#ffffff'); } shatter(x, z, 16, '#dff6ff'); frostRing(x, z, 4, 1.2); flare(x, 1.4, z, '#bff4ff', 8, 0.3); }
        else if (kind === 'ricochet') { flare(x, 1.3, z, '#5fe0ff', 3.4, 0.2); if (F3) { F3.ring(x, 1.3, z, '#5fe0ff', 0.9, 10, '#ffffff'); F3.star(x, 1.3, z, '#9ff0ff', 2.2, 0.15); } }
        else if (kind === 'pierce') { const pa = typeof color === 'number' ? color : 0; if (F3) for (let k = 0; k < 6; k++) F3.emit(x, 1.3, z, Math.sin(pa) * rnd(14, 24) + rnd(-2, 2), rnd(0, 1), Math.cos(pa) * rnd(14, 24) + rnd(-2, 2), 0.2, 0.5, 0.1, k % 2 ? '#ffffff' : '#9ff0ff', 1, 0, 2, 0.04, 2); flare(x, 1.3, z, '#ffffff', 2.6, 0.12); }
        else if (kind === 'wallbounce') { if (F3) { F3.impact(x, 1.3, z, '#ffb347', 0.7, 2, rockCol); F3.star(x, 1.3, z, '#ffd27a', 2.4, 0.15); } }
        else if (kind === 'split') { if (F3) { F3.star(x, 1.3, z, '#d7a8ff', 3, 0.18); F3.ring(x, 1.3, z, '#d7a8ff', 0.8, 10, '#5fe0ff'); } }
        // Bloodthirst: a red stream from the fallen foe into the hero.
        else if (kind === 'drain') { const p = color; if (F3) for (let k = 0; k < 14; k++) { const t = rnd(0.35, 0.6), ox = rnd(-0.5, 0.5), oz = rnd(-0.5, 0.5); F3.emit(x + ox, 1.4, z + oz, (p.x - x - ox) / t, rnd(0.5, 2), (p.z - z - oz) / t, t, 0.4, 0.15, k % 2 ? '#ff2a4a' : '#ff8a95', 1, 0, 0, 0.02, 0); } }
        else if (kind === 'dodge') { if (F3) { F3.star(x, 1.4, z, '#e2f4ff', 4, 0.25); F3.ring(x, 0.5, z, '#bff0ff', 1.4, 16); } for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; emit(puffs, x + Math.sin(a) * 0.6, 0.8, z + Math.cos(a) * 0.6, Math.sin(a) * 3, 0.4, Math.cos(a) * 3, 0.4, '#e2f4ff'); } }
        else if (kind === 'headshot') { ring(x, z, '#ff3a3a', 2.6, 0.35); if (F3) { F3.charge(x, 1.6, z, '#ff3a3a', 2.4, 16, 0.18, '#ffd23f'); F3.star(x, 2, z, '#ff5a3a', 6, 0.3); } }
        // A caster lets its spell go (enemy wizards, bosses): a burst at its hands.
        else if (kind === 'cast') { if (F3) { F3.star(x, 1.8, z, color, 4.5, 0.25); F3.ring(x, 1.4, z, color, 1.4, 18, '#ffffff'); } flare(x, 1.6, z, color, 4, 0.2); }
        else if (kind === 'angel') emit(sparks, x + rnd(-1.5, 1.5), rnd(0.5, 4), z + rnd(-1.5, 1.5), 0, rnd(0.5, 1.5), 0, rnd(0.8, 1.5), '#fff2b0');
      }

      // ---------- Room ----------
      function placeInst(key, list, fit) {
        const g = propGeo(key), m = new T.InstancedMesh(g, propMatI, list.length), d = new T.Object3D();
        // Floors and walls cast no shadow: walls are ~1.5-2k triangles x ~44 per room and their shadows land
        // outside the arena (the shadow pass drew them all again on every shadow update).
        m.customDepthMaterial = instDepth; m.receiveShadow = true; m.castShadow = !/^(floor|wall)/.test(key);
        list.forEach((o, i) => { d.position.set(o[0], o[1] || 0, o[2]); d.rotation.set(0, o[3] || 0, 0); d.scale.setScalar(o[4] || fit || 1); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
        m.instanceMatrix.needsUpdate = true; room.add(m); return m;
      }
      // Static room pieces (instanced walls/floors/deco, obstacles, the door) never move: compute their matrices once
      // instead of on every frame (updateMatrixWorld/compose were a visible part of the frame on the phone).
      function freezeStatic() {
        for (const o of room.children) if (o.isInstancedMesh || (o.isMesh && (o.material === propMat || o.material === propMatI))) { o.updateMatrix(); o.matrixAutoUpdate = false; }
      }
      function flame(x, y, z, c) {
        const s = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: c || '#ffae4a' }, add)));
        s.position.set(x, y, z); s.scale.setScalar(2.2); room.add(s); flames.push(s);
      }
      let dust = null;
      function makeDust() {
        if (dust) return;
        // Floating dust in the torch light.
        const n = 90, pos = new Float32Array(n * 3);
        for (let k = 0; k < n; k++) { pos[k * 3] = rnd(-RW, RW); pos[k * 3 + 1] = rnd(0.5, 7); pos[k * 3 + 2] = rnd(-RH, RH); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
        dust = new T.Points(g, new T.PointsMaterial(Object.assign({ size: 0.22, map: dotTex, color: '#ffe2b0', opacity: 0.55 }, add)));
        dust.frustumCulled = false; scene.add(dust);
      }
      // Take the last room (or menu) down and free what it made: instance buffers, per-room geometry, materials and
      // cloned textures. Shared things (prop geometry/material, pool shaders, character models) are left alone.
      function clearRoom() {
        while (room.children.length) {
          const o = room.children[0]; room.remove(o);
          o.traverse(x => {
            if (x.userData.m || x.isSkinnedMesh) return;
            if (x.isInstancedMesh) { x.dispose(); return; }
            if (!x.isMesh && !x.isSprite) return;
            if (x.geometry && !x.isSprite) x.geometry.dispose();
            for (const m of [].concat(x.material || [])) {
              if (m === propMat || m === propMatI || m.isShaderMaterial) continue;
              if (m.map && m.map.userData.own) m.map.dispose();
              // No m.dispose(): that would free the compiled shader when its last user goes, and the next room
              // (which uses the same kinds of material) would compile it again - a visible hitch on every door.
              // The material object itself is garbage collected.
            }
          });
        }
      }
      function buildRoom(S, ch) {
        clearRoom();
        spikesM = []; angelG = null; chestG = null; flames = []; chevrons = [];
        scene.background = new T.Color(ch.fog); scene.fog.color.set(ch.fog);
        for (const t of [torchL, torchR, torchL2, torchR2]) t.color.set(ch.light);
        // Floor: one hand-laid flagstone slab per room (never a repeating tile), bump-mapped so the joints catch the light,
        // then soft occlusion toward the walls and a carpet from the entrance to the door.
        const th = ch.th || { tiles: ['floor', 'floor_dirt'], wall: 'wall', wall2: 'wall_cracked', banner: 'banner', obst: [], deco: ['candles', 'rubble', 'coins', 'barrels'], fx: 'dust' };
        let s = S.chapter * 13 + S.room;
        const rr = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        { const fl = stoneFloor(S.chapter * 100 + S.room, ch.floor, th.tiles[0]);
          // A cool tint on every floor: warm torchlight against teal stone reads more cinematic.
          const floor = new T.Mesh(new T.PlaneGeometry(2 * RW + 2, 2 * RH + 2).rotateX(-Math.PI / 2), new T.MeshLambertMaterial({ map: fl.map, bumpMap: fl.bump, bumpScale: 2.2, color: '#c8e4e6' }));
          floor.receiveShadow = true; room.add(floor);
          // The floor runs on past the open front (the lower camera sees it) so no black band shows under the room.
          const apron = new T.Mesh(new T.PlaneGeometry(2 * RW + 2, 16).rotateX(-Math.PI / 2), new T.MeshLambertMaterial({ map: fl.map, color: '#d8d0c4' }));
          apron.position.set(0, -0.01, RH + 1 + 8); apron.receiveShadow = true; room.add(apron); }
        { const ao = new T.Mesh(new T.PlaneGeometry(2 * RW + 2, 2 * RH + 2).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false })); ao.position.y = 0.02; ao.renderOrder = 1; room.add(ao); }
        if (ch.carpet !== false) {
          const ct = carpetTex.clone(); ct.needsUpdate = true; ct.repeat.set(1, 3.5); ct.userData.own = true;
          const carpet = new T.Mesh(new T.PlaneGeometry(2.8, 2 * RH).rotateX(-Math.PI / 2), new T.MeshLambertMaterial({ map: ct, color: ch.carpet || '#ffffff' }));
          carpet.position.set(0, 0.05, 0); room.add(carpet);
        }
        // Water / lava / ice: irregular pools with a rim near the walls and in open spots (decoration only: they
        // never block or hurt). Lava gets a dark rock crust, a hot glow and rising embers.
        pools = [];
        if (th.pool) {
          const kind = th.pool, lava = kind === 'lava', tx = poolTex[kind];
          tx.repeat.set(lava ? 0.12 : 0.25, lava ? 0.12 : 0.25);
          const fill = poolMat(kind);
          const rimMat = new T.MeshLambertMaterial({ color: lava ? '#2b1a14' : kind === 'ice' ? '#e8f6ff' : '#3c5a5a' });
          const glowMat = lava ? new T.MeshBasicMaterial(Object.assign({ map: glowTex, color: '#ff6a1a', opacity: 0.55 }, add)) : null;
          const blob = (r, seed) => {
            const sh = new T.Shape(), n = 28;
            for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2, rr = r * (1 + 0.16 * Math.sin(3 * a + seed) + 0.09 * Math.sin(5 * a + seed * 2.3) + 0.05 * Math.sin(9 * a + seed)); k ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
            return new T.ShapeGeometry(sh, 2).rotateX(-Math.PI / 2);
          };
          const spots = [];
          for (let k = 0; k < 4; k++) spots.push([(k % 2 ? 1 : -1) * (RW - 2.6 - rr() * 1.5), -RH + 6 + k * (2 * RH - 12) / 3 + rr() * 3, 2 + rr() * 1.2]);
          for (let k = 0; k < 3; k++) spots.push([(rr() < 0.5 ? -1 : 1) * (4 + rr() * 4), -RH + 6 + rr() * (2 * RH - 14), 1.6 + rr() * 1.2]);
          for (const [x, z, r] of spots) {
            if (S.props.some(o => Math.hypot(o.x - x, o.z - z) < o.r + r + 0.6) || Math.abs(x) - r < 2.2) continue; // off the carpet
            const seed = rr() * 10, rot = rr() * 6;
            const rim = new T.Mesh(blob(r + (lava ? 0.45 : 0.25), seed), rimMat); rim.position.set(x, 0.05, z); rim.rotation.y = rot; room.add(rim);
            const m = new T.Mesh(blob(r, seed), fill); m.position.set(x, 0.07, z); m.rotation.y = rot; room.add(m);
            if (lava) { const gl = new T.Mesh(new T.PlaneGeometry(r * 3.4, r * 3.4).rotateX(-Math.PI / 2), glowMat); gl.position.set(x, 0.12, z); room.add(gl); }
            pools.push({ x, z, r, kind });
          }
          pools.tx = tx; pools.lava = lava; pools.glow = glowMat; pools.mat = fill;
        }
        // The game reads the pools too: lava burns, ice and water slow whoever walks in.
        S.hazards = pools.map(q => ({ x: q.x, z: q.z, r: q.r, kind: q.kind }));
        // Walls: back wall with the door, side walls with pillars every 8 units; the front stays open.
        const back = [], side = [], cracked = [];
        for (let ix = 0; ix < 7; ix++) if (ix !== 3) (ix % 3 === 1 ? cracked : back).push([-12 + ix * 4, 0, -RH - 0.5, 0]);
        for (let iz = 0; iz < 11; iz++) for (const sx of [-1, 1]) side.push([sx * (RW + 0.5), 0, -20 + iz * 4, Math.PI / 2]);
        // Two more courses of wall over the back wall (and the corners), with torches: the lower camera sees above it.
        for (const y of [4, 8]) for (let ix = 0; ix < 7; ix++) ((ix + y / 4) % 3 === 0 ? cracked : back).push([-12 + ix * 4, y, -RH - 0.5, 0]);
        for (const y of [4, 8]) for (const sx of [-1, 1]) for (const z of [-20, -16]) side.push([sx * (RW + 0.5), y, z, Math.PI / 2]);
        placeInst(th.wall, back.concat(side)); placeInst(th.wall2, cracked);
        placeInst('torch', [[-8, 5.6, -RH + 0.2, 0], [8, 5.6, -RH + 0.2, 0], [0, 9.6, -RH + 0.2, 0]], 1.4);
        flame(-8, 7.2, -RH + 0.6); flame(8, 7.2, -RH + 0.6); flame(0, 11.2, -RH + 0.6);
        placeInst(th.banner, [[-3.5, 5, -RH + 0.1], [3.5, 5, -RH + 0.1]], 1);
        placeInst('wall_door', [[0, 0, -RH - 0.5, 0]]);
        const pil = [[-RW - 0.5, 0, -RH - 0.5], [RW + 0.5, 0, -RH - 0.5]];
        for (const z of [-12, -4, 4, 12]) for (const sx of [-1, 1]) pil.push([sx * (RW + 0.1), 0, z]);
        placeInst('pillar_deco', pil, 0.75);
        const tor = [];
        for (const z of [-12, -4, 4, 12]) for (const sx of [-1, 1]) { tor.push([sx * (RW - 0.35), 1.7, z + 1.2, -sx * Math.PI / 2]); flame(sx * (RW - 0.75), 3.25, z + 1.2); }
        placeInst('torch', tor, 1.4);
        placeInst(th.banner, [[-6, 1, -RH + 0.1], [6, 1, -RH + 0.1]], 1);
        torchL.position.set(-RW + 2, 4, -10); torchR.position.set(RW - 2, 4, -10); torchL2.position.set(-RW + 2, 4, 8); torchR2.position.set(RW - 2, 4, 8);
        // Clutter along the walls (decoration only, kept out of the walking area).
        const deco = {};
        for (let k = 0; k < 10; k++) {
          const sx = rr() < 0.5 ? -1 : 1, z = -RH + 3 + rr() * (2 * RH - 6), kind = th.deco[Math.floor(rr() * th.deco.length)];
          (deco[kind] = deco[kind] || []).push([sx * (RW - 0.7), 0, z, rr() * 6, decoScale(kind)]);
        }
        for (const k in deco) placeInst(k, deco[k]);
        for (const k of ['candles', 'candle_lit', 'fire_basket', 'post']) (deco[k] || []).forEach(c => flame(c[0], k === 'post' ? 2.6 : 1.1, c[2], k === 'fire_basket' ? '#ff7a2a' : k === 'post' ? '#b6ff6a' : '#ffd27a'));
        // Obstacles.
        for (const o of S.props) {
          const g = propGeo(o.kind), u = g.userData, k = (o.r * 2.1) / Math.max(u.w, u.d);
          const m = new T.Mesh(g, propMat); m.castShadow = m.receiveShadow = true; m.position.set(o.x, 0, o.z); m.rotation.y = o.rot; m.scale.setScalar(Math.min(k, 2.8 / u.h)); room.add(m); // at most 2.8 tall: never hides enemies
        }
        // Floor traps match the place: spikes in crypts, fire vents over lava, ice spikes on glaciers, geysers in flooded halls.
        const trap = th.pool === 'lava' ? 'fire' : th.pool === 'ice' ? 'ice' : th.pool === 'water' ? 'geyser' : 'spikes';
        for (const sp of S.spikes) {
          const g = new T.Group(); g.position.set(sp.x, 0, sp.z); room.add(g);
          const t = { kind: trap, g, rise: null, glow: null };
          if (trap === 'spikes') { t.rise = new T.Mesh(propGeo('spikes'), propMat); g.add(t.rise); }
          else {
            // A low rocky vent ring with a dark mouth instead of a tile, so the trap sits in the floor of any theme.
            const ringC = trap === 'fire' ? '#2a1712' : trap === 'ice' ? '#bfe3f2' : '#34525a', mouthC = trap === 'fire' ? '#120604' : trap === 'ice' ? '#5aa8cf' : '#0c2a36';
            const vent = new T.Mesh(new T.CylinderGeometry(1.45, 1.75, 0.24, 9), new T.MeshLambertMaterial({ color: ringC, flatShading: true })); vent.position.y = 0.12; vent.receiveShadow = true; g.add(vent);
            const mouth = new T.Mesh(new T.CircleGeometry(1.05, 9).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: mouthC })); mouth.position.y = 0.25; g.add(mouth);
            if (trap === 'ice') {
              t.rise = new T.Group();
              const im = new T.MeshLambertMaterial({ color: '#d8f4ff', emissive: '#2a7fb0', transparent: true, opacity: 0.92, flatShading: true });
              for (let k = 0; k < 7; k++) { const c = new T.Mesh(new T.ConeGeometry(0.32, 1.6 + (k % 3) * 0.5, 5), im); const a = k / 7 * Math.PI * 2, r = k ? 1.05 : 0; c.position.set(Math.sin(a) * r, 0.8, Math.cos(a) * r); c.rotation.set(Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25); t.rise.add(c); }
              g.add(t.rise);
            } else if (trap === 'geyser') {
              t.rise = new T.Mesh(new T.CylinderGeometry(0.9, 1.3, 5, 16, 1, true).translate(0, 2.5, 0), new T.MeshBasicMaterial(Object.assign({ color: '#7fd8ff', opacity: 0.55, side: T.DoubleSide }, add)));
              g.add(t.rise);
            }
            t.glow = new T.Mesh(discGeo, new T.MeshBasicMaterial(Object.assign({ map: glowTex, color: trap === 'fire' ? '#ff5a10' : trap === 'ice' ? '#8fe6ff' : '#5fc8ff', opacity: 0 }, add)));
            t.glow.scale.setScalar(2.4); t.glow.position.y = 0.27; g.add(t.glow);
          }
          spikesM.push(t);
        }
        // Door: a barrier while closed; a glowing portal, an arrow and floor chevrons once the room is clear.
        door = new T.Mesh(propGeo('barrier'), propMat); door.position.set(0, 0, -RH + 0.4); door.scale.setScalar(0.9); room.add(door);
        portal = new T.Mesh(new T.PlaneGeometry(3.4, 4.2).translate(0, 2.1, 0), new T.MeshBasicMaterial(Object.assign({ map: portalTex, side: T.DoubleSide }, add)));
        portal.position.set(0, 0, -RH + 0.3); room.add(portal);
        doorArrow = new T.Group();
        const arrowMat = new T.MeshBasicMaterial({ color: '#7dffae' });
        doorArrow.add(new T.Mesh(new T.ConeGeometry(0.9, 1.4, 4).rotateX(Math.PI), arrowMat), new T.Mesh(new T.BoxGeometry(0.5, 1.2, 0.5).translate(0, 1.2, 0), arrowMat));
        doorArrow.position.set(0, 6, -RH + 1); room.add(doorArrow);
        for (let k = 0; k < 6; k++) { const c = new T.Mesh(new T.PlaneGeometry(2.2, 2.2).rotateX(-Math.PI / 2), new T.MeshBasicMaterial(Object.assign({ map: chevTex, color: '#7dffae' }, add))); c.position.set(0, 0.08, -RH + 3 + k * 3); room.add(c); chevrons.push(c); }
        if (S.angel) buildAngel(S.angel.x, S.angel.z);
        ents.forEach(g => dyn.remove(g)); ents.clear();
        heroRing = new T.Mesh(new T.PlaneGeometry(3, 3).rotateX(-Math.PI / 2), new T.MeshBasicMaterial(Object.assign({ map: ringTex, color: '#46e0ff' }, add)));
        heroRing.position.y = 0.07; heroRing.visible = !heroAura; room.add(heroRing);
        // Stone chips take the floor's colour; a few glowing runes are carved into the floor (off the carpet).
        rockCol = '#' + new T.Color(ch.floor || '#8d8478').multiplyScalar(0.55).getHexString();
        runes = [];
        if (F3) {
          const rc = th.pool === 'lava' ? '#ff7a2a' : th.pool === 'ice' ? '#8fe6ff' : th.pool === 'water' ? '#46e0ff' : (S.chapter % 2 ? '#46e0ff' : '#b06aff');
          for (let k = 0; k < 3; k++) {
            const x = (rr() < 0.5 ? -1 : 1) * (5 + rr() * (RW - 8)), z = -RH + 6 + rr() * (2 * RH - 12);
            if (S.props.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 2.2) || pools.some(q => Math.hypot(q.x - x, q.z - z) < q.r + 2.4)) continue;
            const m = new T.Mesh(new T.PlaneGeometry(3.4, 3.4).rotateX(-Math.PI / 2), new T.MeshBasicMaterial(Object.assign({ map: Fx3D.tex.rune(), color: rc, opacity: 0.4 }, add)));
            m.position.set(x, 0.06, z); m.rotation.y = rr() * 6; m.renderOrder = 2; room.add(m); runes.push(m);
          }
        }
        // A soft pool of light around the hero keeps dark outfits readable on the stone floor (cheaper than a light).
        const pool = new T.Mesh(new T.PlaneGeometry(7, 7).rotateX(-Math.PI / 2), new T.MeshBasicMaterial(Object.assign({ map: heroPoolTex, color: '#ffe2b0', opacity: 0.32 }, add)));
        pool.position.y = 0.06; heroRing.userData.pool = pool; room.add(pool);
        makeDust(); setAmb(th.fx);
        // V3 atmosphere: warm pools of light on the floor under every torch, two slow sheets of low mist in the room's
        // colour, and the chapter's weather (falling snow, ash and embers, drifting leaves) over the play area.
        { const lp = new T.MeshBasicMaterial(Object.assign({ map: glowTex, color: ch.light || '#ffd9a8', opacity: 0.32 }, add));
          const spots = [[-8, -RH + 2.2, 7], [8, -RH + 2.2, 7], [0, -RH + 2, 6]];
          for (const z of [-12, -4, 4, 12]) for (const sx of [-1, 1]) spots.push([sx * (RW - 1.6), z + 1.2, 6.5]);
          for (const [x, z, r] of spots) { const m = new T.Mesh(new T.PlaneGeometry(r, r).rotateX(-Math.PI / 2), lp); m.position.set(x, 0.04, z); m.renderOrder = 1; m.userData.pool3 = true; room.add(m); } }
        fogSheets = [];
        { const fc = new T.Color(ch.fog || '#1a1410').lerp(new T.Color('#c8d8e8'), 0.45);
          for (let k = 0; k < 2; k++) {
            const t = mistTex.clone(); t.needsUpdate = true; t.userData.own = true; t.wrapS = t.wrapT = T.RepeatWrapping;
            const m = new T.Mesh(new T.PlaneGeometry(2 * RW + 8, 2 * RH + 8).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: t, color: fc, transparent: true, opacity: 0.16 - k * 0.04, depthWrite: false }));
            m.position.y = 0.5 + k * 1.1; m.renderOrder = 6; m.visible = !lowFxA; room.add(m); fogSheets.push(m);
          } }
        wx = WX[th.fx] || null; doorFx = !!S.door; doorT = 0;
      }
      // Decoration of any pack drawn about 1.3 units wide (dungeon props are big, graveyard/holiday ones tiny).
      function decoScale(kind) { const u = propGeo(kind).userData, w = Math.max(u.w, u.d) || 1; return Math.max(0.5, Math.min(3, 1.1 / w)); }
      function setAmb(kind) { amb = AMB[kind] || AMB.dust; if (dust) { dust.material.color.set(amb[0]); dust.material.size = amb[1]; dust.visible = true; } }
      // Boss chest: drops from above with a bounce, glows on a golden ring under a light beam, shakes and bursts open.
      function buildChest(c) {
        const g = new T.Group(); g.position.set(c.x, 0, c.z); room.add(g);
        const box = placeInst('chest_gold', [[0, 0, 0, 0]], 1); room.remove(box); g.add(box);
        const glow = new T.Mesh(new T.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), new T.MeshBasicMaterial(Object.assign({ map: glowTex, color: '#ffb347', opacity: 0.7 }, add))); glow.position.y = 0.06; g.add(glow);
        const trim = new T.Mesh(new T.TorusGeometry(2.6, 0.09, 8, 56).rotateX(Math.PI / 2), new T.MeshBasicMaterial(Object.assign({ color: '#ffd56a', opacity: 0.9 }, add))); trim.position.y = 0.1; g.add(trim);
        const beam = new T.Mesh(new T.CylinderGeometry(1.4, 2.2, 14, 24, 1, true).translate(0, 7, 0), new T.MeshBasicMaterial(Object.assign({ map: beamTex, color: '#ffcf5a', side: T.DoubleSide, opacity: 0.35 }, add))); g.add(beam);
        const halo = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: '#ffe08a', opacity: 0.8 }, add))); halo.position.y = 1.6; halo.scale.setScalar(5); g.add(halo);
        return { g, box, glow, trim, beam, halo, landed: false, burst: false };
      }
      function animChest(c, dt) {
        const k = chestG, t = c.t, S0 = 3.1, time = performance.now() / 1000;
        // Drop: from 12 units up, bouncing twice on landing.
        const d = Math.min(1, t / 0.7), bounce = d < 0.6 ? 1 - (d / 0.6) * (d / 0.6) : d < 0.85 ? 0.12 * Math.sin((d - 0.6) / 0.25 * Math.PI) : 0.03 * Math.sin((d - 0.85) / 0.15 * Math.PI);
        k.box.position.y = Math.max(0, bounce) * (d < 0.6 ? 12 : 4);
        if (!k.landed && d >= 0.6) { k.landed = true; ring(c.x, c.z, '#ffd23f', 7, 0.7); flare(c.x, 1, c.z, '#ffe08a', 10, 0.5);
          for (let n = 0; n < 30; n++) { const a = Math.random() * 6.28; emit(sparks, c.x, 0.4, c.z, Math.sin(a) * rnd(3, 7), rnd(2, 6), Math.cos(a) * rnd(3, 7), rnd(0.5, 0.9), '#ffd23f'); } }
        const op = c.open >= 0 ? c.open : 0, sh = op > 0 && op < 0.55 ? (op / 0.55) * 0.22 : 0;
        k.box.scale.setScalar(S0 * (1 + Math.min(op, 0.55) * 0.35 + (c.open < 0 ? 0.04 * Math.sin(time * 3) : 0)));
        k.box.position.x = sh * Math.sin(time * 70); k.box.rotation.y = -0.35 + (c.open < 0 ? 0.12 * Math.sin(time * 1.3) : sh * Math.sin(time * 55));
        const pulse = 0.5 + 0.5 * Math.sin(time * 3.5);
        k.glow.material.opacity = 0.45 + 0.35 * pulse + op; k.trim.rotation.y = time * 0.8; k.trim.scale.setScalar(1 + 0.05 * pulse);
        k.beam.material.opacity = 0.22 + 0.15 * pulse + op * 0.6; k.beam.scale.set(1 + op * 0.6, 1, 1 + op * 0.6); k.halo.material.opacity = 0.5 + 0.3 * pulse + op;
        if (k.landed && Math.random() < dt * (c.open >= 0 ? 60 : 14)) emit(sparks, c.x + rnd(-1.6, 1.6), rnd(0.3, 1.5), c.z + rnd(-1.6, 1.6), 0, rnd(2, 5), 0, rnd(0.6, 1.1), Math.random() < 0.7 ? '#ffd23f' : '#fff3c0');
        if (c.open > 0.55 && !k.burst) {
          k.burst = true; ring(c.x, c.z, '#fff3c0', 9, 0.8); ring(c.x, c.z, '#ffb12a', 13, 1.1); flare(c.x, 2, c.z, '#fff6d0', 18, 0.7);
          for (let n = 0; n < 80; n++) { const a = Math.random() * 6.28, v = rnd(4, 12); emit(sparks, c.x, 1.4, c.z, Math.sin(a) * v, rnd(4, 12), Math.cos(a) * v, rnd(0.7, 1.4), ['#ffd23f', '#fff3c0', '#ff9a2a', '#3fe8ff'][n % 4], -10); }
        }
      }
      // The angel: a winged figure in white and gold with a halo and a beam of light (not a recoloured hero).
      function buildAngel(x, z) {
        const g = charMesh('angel', 1.25, { color: '#e6dcc6', emissive: '#140f04' }); // toned down: the white angel glared
        const ws = new T.Shape();
        ws.moveTo(0, 0); ws.bezierCurveTo(0.8, 0.6, 1.8, 2.2, 3, 2.8); ws.bezierCurveTo(2.7, 2.1, 2.9, 1.6, 2.6, 1.2);
        ws.bezierCurveTo(2.3, 1.0, 2.4, 0.5, 2.0, 0.3); ws.bezierCurveTo(1.6, 0.1, 1.5, -0.4, 1.0, -0.5); ws.bezierCurveTo(0.6, -0.6, 0.2, -0.3, 0, 0);
        const wingGeo = new T.ShapeGeometry(ws, 10), wingMat = new T.MeshLambertMaterial({ color: '#e8e2d6', emissive: '#241c0c', side: T.DoubleSide });
        const wings = [];
        for (const sx of [-1, 1]) { const w = new T.Mesh(wingGeo, wingMat); w.scale.set(sx, 1, 1); const pivot = new T.Group(); pivot.position.set(sx * 0.25, 2.2, -0.35); pivot.add(w); g.add(pivot); wings.push(pivot); }
        const halo = new T.Mesh(new T.TorusGeometry(0.55, 0.09, 8, 28).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: '#ffe07a' }));
        halo.position.y = 3.75; g.add(halo);
        const hs = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: glowTex, color: '#b89a50', opacity: 0.7 }, add))); hs.position.y = 3.75; hs.scale.setScalar(1.6); g.add(hs);
        g.add(new T.Mesh(new T.CylinderGeometry(1.6, 2.6, 16, 24, 1, true).translate(0, 8, 0), new T.MeshBasicMaterial(Object.assign({ map: beamTex, color: '#8a7a50', opacity: 0.5, side: T.DoubleSide }, add))));
        g.position.set(x, 0.5, z); room.add(g);
        angelG = { g, wings, halo };
      }

      // ---------- Camera ----------
      // Follow camera: shows ~21 of the 26 units of width (follows the hero sideways) and scrolls along z, but never
      // past the room's front edge or far above the back wall, so no empty band appears on tall screens.
      const HALF_W = 10.4, PITCH = 45 * Math.PI / 180; // lower than straight-down so heads and hats do not hide the bodies
      let camX = 0, camZ = 0, camD = 0, zLo = 0, zHi = 0, camKey = '';
      let cssW = innerWidth, cssH = innerHeight; // canvas CSS size, refreshed by fit() (reading it per frame forced a layout)
      const v3 = new T.Vector3();
      function placeCam(x, z) {
        camera.position.set(x, Math.sin(PITCH) * camD, z + Math.cos(PITCH) * camD + 2);
        camera.lookAt(x, 0, z + 2);
        camera.updateMatrixWorld();
      }
      function camLimits() {
        const W = cssW, H = cssH;
        camD = HALF_W / Math.tan(Math.atan(Math.tan(camera.fov * Math.PI / 360) * W / H));
        // Screen y (0 top .. 1 bottom) of a world point for a given camZ; both limits are found by bisection.
        const screenY = (z, h, cz) => { placeCam(0, cz); v3.set(0, h, z).project(camera); return (1 - v3.y) / 2; };
        const solve = (f, target) => { let a = -40, b = 40; for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (f(m) > target) a = m; else b = m; } return (a + b) / 2; };
        zHi = solve(cz => screenY(RH + 0.5, 0, cz), 1);      // camZ <= zHi: front edge at or below the screen bottom
        zLo = solve(cz => screenY(-RH - 0.5, 4, cz), 0.07);  // camZ >= zLo: back wall top no lower than the HUD
        if (zLo > zHi) zLo = zHi = (zLo + zHi) / 2;
        camKey = W + 'x' + H;
      }
      function camRoom(S, dt) {
        const W = cssW, H = cssH;
        if (camKey !== W + 'x' + H) camLimits();
        const tx = S ? Math.max(-(RW + 1 - HALF_W), Math.min(RW + 1 - HALF_W, S.p.x * 0.5)) : 0;
        // Once the room is clear the camera leans toward the door so the way out is on screen.
        const look = S && S.door && !(S.angel && !S.angel.used) ? S.p.z - 10 : S ? S.p.z - 4 : 0;
        const tz = S ? Math.max(zLo, Math.min(zHi, look)) : 0;
        if (S && S.t < 0.05 && (!S.intro || S.intro.t < 0.05)) { camX = tx; camZ = tz; }
        const k = Math.min(1, dt * 4);
        camX += (tx - camX) * k; camZ += (tz - camZ) * k;
        // Boss entrance: ease in on the boss (closer and lower), hold, ease back.
        let zi = 0;
        if (S && S.intro) { const u = S.intro.t / S.intro.dur; zi = u < 0.25 ? u / 0.25 : u > 0.8 ? (1 - u) / 0.2 : 1; zi = Math.max(0, Math.min(1, zi)); zi = zi * zi * (3 - 2 * zi); }
        const sh = S ? (S.shake || 0) * 0.7 : 0, d0 = camD;
        camD *= 1 - 0.26 * zi;
        placeCam(camX + (S && S.intro ? (S.intro.x - camX) * zi : 0) + (Math.random() - 0.5) * sh, camZ + (S && S.intro ? (S.intro.z - 3 - camZ) * zi : 0) + (Math.random() - 0.5) * sh);
        camD = d0;
        aimSun(camX, camZ - 2);
      }

      // ---------- Menu scene: the hero on a lit dais ----------
      let menuHero = null, celebT = 0;
      function buildMenu(hero, ch, tint, dim, skin) {
        aimSun(0, 0);
        clearRoom();
        ents.forEach(g => dyn.remove(g)); ents.clear(); flames = []; angelG = null; chestG = null;
        makeDust();
        scene.background = new T.Color(ch.fog); scene.fog.color.set(ch.fog);
        const th = ch.th || { tiles: ['floor', 'floor_dirt'], wall: 'wall', wall2: 'wall_cracked', banner: 'banner', obst: [], deco: ['candles', 'rubble', 'coins', 'barrels'], fx: 'dust' };
        const tiles = [];
        for (let ix = -3; ix <= 3; ix++) for (let iz = -3; iz <= 2; iz++) tiles.push([ix * 4, -0.2, iz * 4, 0]);
        placeInst(th.tiles[0], tiles);
        placeInst(th.wall, [[-12, 0, -9.5, 0], [-8, 0, -9.5, 0], [-4, 0, -9.5, 0], [4, 0, -9.5, 0], [8, 0, -9.5, 0], [12, 0, -9.5, 0]]);
        placeInst('wall_door', [[0, 0, -9.5, 0]]);
        // A tall hall behind the hero: three more rows of wall with torches and banners (no empty sky on tall phones).
        const upper = [], upperCr = [];
        for (let y = 4; y <= 16; y += 4) for (let x = -12; x <= 12; x += 4) ((x / 4 + y / 4) % 3 === 0 ? upperCr : upper).push([x, y, -9.5, 0]);
        placeInst(th.wall, upper); placeInst(th.wall2, upperCr);
        placeInst('torch', [[-6, 5.6, -8.8, 0], [6, 5.6, -8.8, 0], [-10, 9.6, -8.8, 0], [10, 9.6, -8.8, 0], [0, 13.6, -8.8, 0]], 1.4);
        flame(-6, 7.2, -8.4); flame(6, 7.2, -8.4); flame(-10, 11.2, -8.4); flame(10, 11.2, -8.4); flame(0, 15.2, -8.4);
        placeInst(th.banner, [[-2.6, 5, -8.95], [2.6, 5, -8.95], [-6, 9, -8.95], [6, 9, -8.95]], 1);
        const dk = {}; th.deco.forEach((k, i) => { (dk[k] = dk[k] || []).push([i % 2 ? 5.4 : -5.2, 0, -2.4 - i * 1.4, i, decoScale(k)]); });
        for (const k in dk) placeInst(k, dk[k]);
        setAmb(th.fx);
        placeInst('pillar_deco', [[-6, 0, -8.6], [6, 0, -8.6]], 0.8);
        placeInst('torch', [[-2.6, 1.6, -8.8, 0], [2.6, 1.6, -8.8, 0]], 1.4);
        flame(-2.6, 3.2, -8.4); flame(2.6, 3.2, -8.4);
        placeInst(th.banner, [[-4.2, 1, -8.95], [4.2, 1, -8.95]], 1);
        placeInst('chest_gold', [[4.6, 0, -4.5, -0.6]], 1); placeInst('coins', [[3.4, 0, -2.6, 0]], 0.8);
        // Dais with a glowing ring under the hero.
        const dais = new T.Mesh(new T.CylinderGeometry(2.4, 2.7, 0.5, 40), new T.MeshLambertMaterial({ color: '#4a3a30' })); dais.position.y = 0.05; dais.receiveShadow = true; room.add(dais);
        const trim = new T.Mesh(new T.TorusGeometry(2.45, 0.08, 8, 48).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: '#ffd56a' })); trim.position.y = 0.32; room.add(trim);
        const glow = new T.Mesh(new T.PlaneGeometry(7, 7).rotateX(-Math.PI / 2), new T.MeshBasicMaterial(Object.assign({ map: glowTex, color: '#ffb347', opacity: 0.6 }, add))); glow.position.y = 0.33; room.add(glow);
        torchL.position.set(-2.6, 4, -6); torchR.position.set(2.6, 4, -6); torchL2.position.set(-7, 3, 2); torchR2.position.set(7, 3, 2);
        for (const t of [torchL, torchR, torchL2, torchR2]) t.color.set(ch.light);
        const h = charMesh(hero, 2); h.userData.tinted = !!tint; if (tint) { h.userData.m.material.color.set(tint); h.userData.m.material.emissive && h.userData.m.material.emissive.set(tint).multiplyScalar(0.38); }
        if (dim) { h.userData.m.material.color.set('#2c2c3a'); h.userData.m.material.emissive && h.userData.m.material.emissive.set('#0a0a18'); } h.position.set(0, 0.3, 0); room.add(h); menuHero = h;
        if (skin && !dim) dress(h, hero, skin);
      }

      const R = {
        // Outfit portrait: the hero alone in a studio light, turned by `angle`, framed head to toe (used to bake art).
        portrait(name, skin, angle) {
          const ps = new T.Scene();
          ps.add(new T.HemisphereLight(0xffffff, 0x50406a, 1.25));
          const key = new T.DirectionalLight(0xfff0dc, 2.4); key.position.set(-3, 6, 8); ps.add(key);
          const rimL = new T.DirectionalLight(0x9fc4ff, 1.6); rimL.position.set(5, 4, -6); ps.add(rimL);
          const g = charMesh(name, 2); g.remove(g.children[2]); // no blob shadow
          if (skin) dress(g, name, skin);
          const mat = g.userData.m.material; if (skin && skin.glow && mat.emissive) mat.emissive.setRGB(0.75, 0.75, 0.75);
          pose(g.userData.m, 6, 4, 0.12); g.rotation.y = angle || 0; ps.add(g);
          if (g.userData.top) g.userData.top.position.y = g.userData.headY * 0.94;
          if (g.userData.orbs) g.userData.orbs.forEach((o, k) => { const a = k * 2.094 + 0.6; o.position.set(Math.sin(a) * 1.9, g.userData.headY * 0.5, Math.cos(a) * 1.9); o.scale.setScalar(0.9); });
          const geo = g.userData.m.geometry; if (!geo.boundingBox) geo.computeBoundingBox();
          const top = (g.userData.top ? g.userData.headY * 0.94 + 0.9 : geo.boundingBox.max.y * 2) + 0.15, W = canvas.width, H = canvas.height;
          const cam = new T.PerspectiveCamera(28, W / H, 0.5, 100), mid = top / 2, dist = (top * 0.56) / Math.tan(14 * Math.PI / 180);
          cam.position.set(0, mid + 0.6, dist); cam.lookAt(0, mid, 0);
          renderer.setClearColor(0x000000, 0); renderer.setViewport(0, 0, W, H); renderer.setScissorTest(false);
          renderer.render(ps, cam);
          return canvas.toDataURL('image/png');
        },
        mem() { return Object.assign({ floors: floorCache.size }, renderer.info.memory); }, // test hook: GPU objects alive
        dbg: () => ({ room, scene, camera, renderer, T }), // test hook: scene access for headless checks
        is3D: true,
        fit() { const W = cssW = canvas.clientWidth || innerWidth, H = cssH = canvas.clientHeight || innerHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); camKey = ''; },
        // Height of a foe's drawn head (world units), so its HP bar sits just above it whatever its size and hop.
        top(e) { const g = e && ents.get(e.key); return g ? g.position.y + g.userData.hy * g.scale.y + (e.elite ? 0.45 : 0) : 0; }, // elites: above the crown
        project(x, z, h) { v3.set(x, h || 0, z).project(camera); const W = cssW, H = cssH; return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H }; },
        setRoom(S, ch) { level = S; menuKey = ''; buildRoom(S, ch); freezeStatic(); if (F3 && !F3.warmed) { F3.warmed = true; F3.warm(S.p.x, 1.3, S.p.z); warmV2(S); } },
        setMenu(hero, ch, tint, dim, skin) { const k = hero + (tint || '') + (dim ? 'd' : '') + (skin ? skin.id : '') + ch.fog + (ch.th ? ch.th.wall + ch.th.fx : ''); if (k === menuKey) return; menuKey = k; level = null; buildMenu(hero, ch, tint, dim, skin); },
        // Outfit put on: the menu hero hops and spins in a burst of the outfit's colours.
        celebrate() {
          celebT = 1; const sk = menuHero && menuHero.userData.skin, c = sk ? sk.fx.cols : ['#ffd23f', '#fff3c0'];
          for (let k = 0; k < 90; k++) { const a = Math.random() * 6.28, v = rnd(2, 7); emit(sparks, 0, rnd(1, 4), 0, Math.sin(a) * v, rnd(1, 6), Math.cos(a) * v, rnd(0.6, 1.2), c[k % c.length], 5); }
          ring(0, 0, c[0], 7, 0.8); flare(0, 3, 0, c[0], 14, 0.7); screenFlash(c[0], 0.55);
        },
        fx,
        render(S, dt, mode) {
          const time = performance.now() / 1000;
          if (slowShadows && (shadowTick = (shadowTick + 1) % 3) === 0) renderer.shadowMap.needsUpdate = true;
          // Adaptive quality: if frames keep running long (slow phone, hot device), lower the pixel ratio, then drop shadows.
          if (dt > 0) {
            perfAcc += dt; perfN++;
            if (perfAcc > 2.5) {
              const avg = perfAcc / perfN; perfAcc = 0; perfN = 0;
              // Shadows go to every 3rd frame instead of off: switching them off recompiles every shader (a long freeze).
              // Steps, cheapest-looking first, whenever frames miss 60 fps (avg under ~56 fps): pixel ratio 1.75 → 1.5 → 1.25
              // (hard to see on a phone), then shadows every 3rd frame, then pixel ratio 1.1. Measured on a mid-range
              // phone (Oppo CPH2205): the GPU is fill-bound; at 1.5 it ran 52 fps with 15% slow frames - just above the
              // old 52 fps trigger, so it never stepped down - and at 1.25 58 fps with 4%. Effects and models are never cut.
              if (avg > 1 / 56 && pr > 1.25) { pr = Math.max(1.25, pr - 0.25); renderer.setPixelRatio(pr); R.fit(); keepPr(); }
              else if (avg > 1 / 50 && renderer.shadowMap.autoUpdate) { renderer.shadowMap.autoUpdate = false; slowShadows = true; }
              else if (avg > 1 / 45 && pr > 1.1) { pr = 1.1; renderer.setPixelRatio(pr); R.fit(); keepPr(); }
              // V3: still slow at the lowest step -> the purely atmospheric extras (weather, mist sheets) go.
              else if (avg > 1 / 34 && !lowFxA) { lowFxA = true; fogSheets.forEach(m => { m.visible = false; }); }
            }
          }
          if (F3) F3.update(dt);
          for (const f of flames) f.scale.setScalar(2.9 + Math.sin(time * 11 + f.position.z) * 0.35 + Math.sin(time * 23 + f.position.x) * 0.16);
          // Embers drifting up from the torches, and the floor runes breathing.
          if (F3 && flames.length && dt > 0 && Math.random() < dt * 9) { const f = flames[(Math.random() * flames.length) | 0]; F3.mote(f.position.x + rnd(-0.2, 0.2), f.position.y + 0.2, f.position.z + 0.2, Math.random() < 0.5 ? '#ffb04a' : '#ff6a1a', 0.16, rnd(1, 1.8), rnd(0.8, 1.6)); }
          for (let k = 0; k < runes.length; k++) runes[k].material.opacity = 0.32 + 0.22 * Math.sin(time * 1.6 + k * 2.1);
          const fl = 1 + Math.sin(time * 9) * 0.08;
          torchL.intensity = torchR.intensity = torchL2.intensity = torchR2.intensity = 40 * fl;
          if (dust) {
            const p = dust.geometry.attributes.position;
            for (let k = 0; k < p.count; k++) {
              let y = p.getY(k) + dt * amb[2]; if (y > 7) y = 0.3; if (y < 0.2) y = 7;
              p.setY(k, y); p.setX(k, p.getX(k) + Math.sin(time * 0.8 + k) * amb[3] * dt);
            }
            p.needsUpdate = true;
            dust.material.opacity = amb[4] ? 0.35 + 0.35 * Math.abs(Math.sin(time * 2.2)) : 0.6;
          }
          if (pools.mat) pools.mat.uniforms.uT.value = time;
          if (pools.tx) {
            pools.tx.offset.set((time * 0.006) % 1, (time * (pools.lava ? 0.012 : 0.03)) % 1);
            if (pools.glow) pools.glow.opacity = 0.45 + 0.15 * Math.sin(time * 2.4);
            if (pools.lava && S) for (const pl of pools) if (Math.random() < dt * 3) emit(sparks, pl.x + (Math.random() - 0.5) * pl.r, 0.2, pl.z + (Math.random() - 0.5) * pl.r, (Math.random() - 0.5) * 0.6, 2 + Math.random() * 2, (Math.random() - 0.5) * 0.6, 0.9 + Math.random() * 0.6, Math.random() < 0.5 ? '#ff8a2a' : '#ffd34a', -0.5);
          }
          stepCloud(sparks, dt); stepCloud(puffs, dt);
          for (const b of beams) { b.life -= dt; b.m.material.opacity = Math.max(0, b.life / 0.9); if (b.follow && S) b.m.position.set(S.p.x, 0, S.p.z); if (b.life <= 0) { b.m.visible = false; beamPool.push(b.m); } }
          for (let i = beams.length - 1; i >= 0; i--) if (beams[i].life <= 0) beams.splice(i, 1);
          stepCloud(flamesC, dt);
          for (let i = flares.length - 1; i >= 0; i--) {
            const f = flares[i]; f.life -= dt; const t = 1 - Math.max(0, f.life / f.max);
            f.sp.scale.setScalar(f.size * (0.4 + 0.6 * Math.sqrt(t))); f.sp.material.opacity = Math.max(0, 1 - t * t);
            if (f.life <= 0) { f.sp.visible = false; flarePool.push(f.sp); flares.splice(i, 1); }
          }
          for (let i = shards.length - 1; i >= 0; i--) {
            const q = shards[i]; q.life -= dt; q.vy -= 22 * dt; q.m.position.x += q.vx * dt; q.m.position.y = Math.max(0.15, q.m.position.y + q.vy * dt); q.m.position.z += q.vz * dt;
            q.m.rotation.x += q.sx * dt; q.m.rotation.z += q.sz * dt; if (q.m.position.y <= 0.15) { q.vx *= 0.7; q.vz *= 0.7; q.vy = Math.abs(q.vy) * 0.25; }
            if (q.life < 0.25) q.m.scale.multiplyScalar(0.85);
            if (q.life <= 0) { q.m.visible = false; shardPool.push(q.m); shards.splice(i, 1); }
          }
          for (let i = boltsL.length - 1; i >= 0; i--) { const b = boltsL[i]; b.life -= dt; b.g.visible = Math.random() < 0.85; if (b.life <= 0) { scene.remove(b.g); boltsL.splice(i, 1); } }
          punch = Math.max(0, punch - dt * 5);
          if (Math.abs(camera.fov - (BASE_FOV - punch * 5)) > 0.01) { camera.fov = BASE_FOV - punch * 5; camera.updateProjectionMatrix(); }
          for (let i = frostRings.length - 1; i >= 0; i--) {
            const k = frostRings[i]; k.life -= dt; const t = 1 - Math.max(0, k.life / k.max), e = 1 - Math.pow(1 - Math.min(1, t * 3), 3);
            k.m.scale.setScalar(k.size * (0.35 + 0.65 * e)); k.m.material.opacity = Math.max(0, 1 - t * t) * 0.9; k.m.rotation.y += dt * 0.4;
            if (k.life <= 0) { k.m.visible = false; frostPool.push(k.m); frostRings.splice(i, 1); }
          }
          for (let i = shocks.length - 1; i >= 0; i--) {
            const k = shocks[i]; k.life -= dt; const t = 1 - Math.max(0, k.life / k.max);
            k.m.scale.setScalar(0.3 + k.size * t); k.m.material.opacity = Math.max(0, 1 - t);
            if (k.life <= 0) { k.m.visible = false; ringPool.push(k.m); shocks.splice(i, 1); }
          }
          if (!S || mode === 'menu') {
            // In-run skill effects live on the scene, not the room: never let one from the last run linger on the menu hero.
            for (const o of [bubble, iceG, auraM, auraF, rageG, haloS, giantS, meteorS, bossPool, bossBeam, chargeS, powerS, ...wisdomS, ...speedS]) o.visible = false;
            if (heroAura) heroAura.visible = false; if (bossAura) bossAura.visible = false; castRunes.hide(0);
            // Legendary / mythic gear shows on the menu hero too: aura rings, a light pillar and sparkles.
            const mg = R.menuGear || {};
            auraG.visible = !!mg.aura; aura2.visible = pillar.visible = !!mg.mythic; handG.visible = false;
            if (mg.aura) { auraG.material.color.set(mg.aura); auraG.position.set(0, 0.42, 0); auraG.scale.setScalar(1.6); auraG.rotation.y = -time * 0.8; auraG.material.opacity = 0.6 + 0.2 * Math.sin(time * 3); }
            if (mg.mythic) { tintTop(mg); aura2.position.set(0, 0.43, 0); aura2.rotation.y = time * 1.3; aura2.scale.setScalar(2.1); pillar.position.set(0, 0.3, 0); pillar.scale.set(2.4, 1.3, 2.4); pillar.material.opacity = 0.55 + 0.15 * Math.sin(time * 3);
              if (menuHero && menuHero.userData.m.material.emissive) { const k = 0.14 * Math.sin(time * 4); if (mg.celestial) menuHero.userData.m.material.emissive.setRGB(0.03, 0.12 + k * 0.6, 0.2 + k); else menuHero.userData.m.material.emissive.setRGB(0.22 + k, 0.05, 0.03); } }
            else if (menuHero && menuHero.userData.m.material.emissive && !menuHero.userData.tinted) menuHero.userData.m.material.emissive.setRGB(0, 0, 0);
            else pillar.scale.set(1, 1, 1);
            if (mg.legendary && Math.random() < dt * (mg.mythic ? 40 : 15)) emit(sparks, rnd(-1.5, 1.5), rnd(0.5, 5), rnd(-1.5, 1.5), 0, rnd(1, 2.5), 0, rnd(0.6, 1), mg.mythic ? topCol(mg) : '#ffd23f');
            if (menuHero) { menuHero.rotation.y = Math.sin(time * 0.6) * 0.45; pose(menuHero.userData.m, 6, 4, 0.15 + 0.15 * Math.sin(time * 1.7));
              if (celebT > 0) { celebT = Math.max(0, celebT - dt); const t = 1 - celebT, e = 1 - Math.pow(1 - t, 3); menuHero.position.y = 0.3 + Math.sin(t * Math.PI) * 1.3; menuHero.rotation.y += e * Math.PI * 2; pose(menuHero.userData.m, 6, 5, Math.sin(t * Math.PI)); }
              skinFx(menuHero, 0, 0, false, dt, time); }
            dyn.visible = false;
            // Frame the whole hero (and the dais) inside a band of the screen between the top bar and the chapter
            // card, whatever the phone's aspect: solve the distance, then shift the image up with a view offset.
            const W = cssW, H = cssH, tf = Math.tan(camera.fov * Math.PI / 360);
            const band = R.band || { top: 0.14, bot: 0.5 }, bot = Math.max(band.top + 0.18, band.bot - 0.02), top = Math.max(band.top, bot - 0.4), mid = 2.9;
            const d = Math.max(6.2 / (2 * tf * (bot - top)), 8 / (2 * tf * camera.aspect)), pitch = 0.16;
            camera.position.set(0, mid + Math.sin(pitch) * d, Math.cos(pitch) * d); camera.lookAt(0, mid, 0);
            camera.setViewOffset(W, H, 0, Math.round((0.5 - (top + bot) / 2) * H), W, H);
            renderer.render(scene, camera); return;
          }
          dyn.visible = true;
          if (camera.view && camera.view.enabled) camera.clearViewOffset();
          if (S !== level) R.setRoom(S, { fog: '#1a1410', light: '#ffd9a8', floor: '#8d8478' });
          // Hero + enemies.
          const seen = new Set();
          const sync = (key, e, name, scale, isHero) => {
            let g = ents.get(key);
            if (!g) { g = charMesh(name, VS(scale) * (isHero ? 1 : FOE_K(e)), isHero ? undefined : 'foe'); if (isHero && S.skin) dress(g, name, S.skin); if (!isHero && e.boss) { dress(g, name, bossLook(e)); bossRig(g, e); } if (isHero && S.heroTint) { g.userData.m.material.color.set(S.heroTint); g.userData.m.material.emissive && g.userData.m.material.emissive.set(S.heroTint).multiplyScalar(0.38); } dyn.add(g); ents.set(key, g); }
            seen.add(key);
            const m = g.userData.m;
            if (isHero) heroPose(m, e); else foePose(m, e);
            let y = 0;
            if (!isHero && e.state === 'rise') y = -2.6 * Math.max(0, e.st / 0.8);
            if (!isHero && e.state === 'dead') y = -Math.max(0, 0.45 - e.st) * 2;
            g.position.set(e.x, y, e.z); g.rotation.y = e.face;
            // Creatures feel alive: a soft breathing squash, a springy pop when they rise, a squash when hit, and a
            // little hop and waddle on every step while walking (squash on landing, stretch at the top).
            if (!isHero) {
              let sy = 1 + 0.035 * Math.sin(e.anim * 0.9 + e.x * 3), sxz = 1 / Math.sqrt(sy);
              const walk = e.moving && e.hp > 0 && e.state !== 'rise' && !e.boss, stp = e.anim * Math.PI / 2;
              const hop = walk ? Math.abs(Math.sin(stp)) : 0, wb = g.userData.wb = (g.userData.wb || 0) + ((walk ? 1 : 0) - (g.userData.wb || 0)) * Math.min(1, dt * 10);
              if (wb > 0.01) { g.position.y += hop * 0.09 * g.userData.hy * wb; sy *= 1 + (hop - 0.4) * 0.11 * wb; sxz *= 1 - (hop - 0.4) * 0.05 * wb; }
              g.rotation.z = Math.sin(stp) * 0.075 * wb;
              if (e.state === 'rise') { const u = 1 - Math.max(0, e.st / 0.8); sy *= 0.6 + 0.4 * u + 0.15 * Math.sin(u * Math.PI); sxz *= 0.8 + 0.2 * u; }
              if (e.flash > 0) { const k = e.flash / 0.12; sy *= 1 - 0.14 * k; sxz *= 1 + 0.1 * k; }
              g.scale.set(sxz, sy, sxz);
            }
            const mat = m.material, wind = !isHero && (e.state === 'wind' || e.state === 'aim');
            if (mat.emissive) mat.emissive.setRGB(e.flash > 0 ? 0.9 : e.burn > 0 ? 0.35 : wind ? 0.45 + 0.25 * Math.sin(time * 30) : 0, e.flash > 0 ? 0.9 : e.slow > 0 ? 0.25 : wind ? 0.05 : 0, e.flash > 0 ? 0.9 : e.slow > 0 ? 0.5 : 0);
            // V3 elite: a golden glow pulse (status colours and the hit flash win over it), crown and rune ring below.
            if (!isHero && mat.userData.fu) { const fu = mat.userData.fu;
              if (e.elite) { fu.uFoeRim.value.setRGB(1, 0.78, 0.25); fu.uFoeRimK.value = 0.5 + 0.2 * Math.sin(time * 4 + e.x); }
              else if (e.boss) { const rc = e.rage ? '#ff2a2a' : CREW_C[(e.crew || 0) % 6]; if (g.userData.rim !== rc) { g.userData.rim = rc; fu.uFoeRim.value.set(rc); } fu.uFoeRimK.value = 0.6 + 0.2 * Math.sin(time * 2.5); }
              else fu.uFoeRimK.value = 0.55; }
            if (!isHero && e.elite && e.hp > 0) { if (mat.emissive && !(e.flash > 0) && !wind && !(e.burn > 0) && !(e.slow > 0) && !(e.psn > 0)) { const k = 0.5 + 0.5 * Math.sin(time * 4 + e.x); mat.emissive.setRGB(0.22 + 0.14 * k, 0.15 + 0.1 * k, 0.02); } elites.push(e); eliteG.push(g); }
            if (!isHero && !e.boss && e.state === 'dead' && !g.userData.died) { g.userData.died = true; speciesDeath(e); }
            // Boss look: glow pulse, headpiece and particles (a hit flash or a wind-up glow wins over the glow).
            if (!isHero && e.boss && e.hp > 0 && g.userData.skin && !(e.flash > 0) && !wind) skinFx(g, e.x, e.z, e.moving, dt, time);
            if (!isHero && e.boss) tickRig(g, e, time, dt);
            // Boss death: one huge burst, then explosions popping over the body while it glows white and sinks.
            if (!isHero && e.boss && e.state === 'dead') {
              if (!g.userData.dying) { g.userData.dying = true; const big = !e.mid;
                if (F3) { F3.explosion(e.x, 2, e.z, big ? 3.2 : 2, { rocks: 16, shake: big ? 0.9 : 0.5, rockCol }); F3.star(e.x, 2.5, e.z, '#ffffff', big ? 16 : 10, 0.6); F3.ring(e.x, 0.6, e.z, '#ffd23f', big ? 6 : 4, 60, '#ffffff'); F3.spiral(e.x, e.z, '#ffd23f', 2, 9, 40, '#ffffff'); }
                ring(e.x, e.z, '#ffd23f', 14, 0.9); ring(e.x, e.z, '#ffffff', 9, 0.6); screenFlash('rgba(255,240,200,.75)', 0.8); }
              if (F3 && e.st > 0.25 && Math.random() < dt * 14) F3.explosion(e.x + rnd(-0.6, 0.6) * e.scale, rnd(1, 3) * e.scale * 0.6, e.z + rnd(-0.5, 0.5) * e.scale, rnd(0.6, 1.1), { n: 6, rocks: 2, scorch: false, shake: 0.12, rockCol });
              if (mat.emissive) { const k = Math.min(1, (0.9 - e.st) * 1.5); mat.emissive.setRGB(k, k * 0.85, k * 0.6); }
            }
            if (isHero) g.visible = !(e.inv > 0 && Math.floor(e.inv * 16) % 2);
            // Status effects you can see: burning foes flicker and shed flames and smoke, frozen ones turn blue and drip frost.
            if (!isHero && e.hp > 0) {
              const hs = 1.6 * (scale || 1) * FOE_K(e); // effect spread follows the drawn (shrunk) body
              if (e.burn > 0) {
                if (mat.emissive && !(e.flash > 0)) mat.emissive.setRGB(0.55 + 0.3 * Math.sin(time * 22 + e.x), 0.18 + 0.1 * Math.sin(time * 17), 0);
                for (let k = 0; k < 3; k++) if (Math.random() < dt * 40) emit(flamesC, e.x + rnd(-0.45, 0.45) * hs, rnd(0.2, 1.4) * hs, e.z + rnd(-0.45, 0.45) * hs, rnd(-0.5, 0.5), rnd(2.5, 5), rnd(-0.5, 0.5), rnd(0.3, 0.6), Math.random() < 0.6 ? '#ff5a10' : '#ffc23a', -4);
                if (Math.random() < dt * 20) emit(sparks, e.x, rnd(0.5, 2) * hs, e.z, rnd(-1.5, 1.5), rnd(3, 6), rnd(-1.5, 1.5), rnd(0.4, 0.8), '#ffd23f', -1);
                if (Math.random() < dt * 4) emit(puffs, e.x, 2 * hs, e.z, rnd(-0.3, 0.3), 1.6, rnd(-0.3, 0.3), 0.7, '#3a2a22');
              }
              let crust = g.userData.crust;
              // Frozen: an ice shell, a ring of ice crystals at the feet and frost on the floor (shared geometry/materials).
              if (e.slow > 0 && !crust) { crust = g.userData.crust = new T.Group(); const sh = new T.Mesh(ICE.shell, ICE.shellM); sh.position.y = 1.0; crust.add(sh); crust.userData.sh = sh;
                for (let k = 0; k < 6; k++) { const c = new T.Mesh(ICE.cry, ICE.cryM), a = k / 6 * Math.PI * 2; c.position.set(Math.sin(a) * 0.62, 0.28, Math.cos(a) * 0.62); c.rotation.set(Math.cos(a) * 0.55, 0, -Math.sin(a) * 0.55); c.scale.setScalar(0.7 + (k % 3) * 0.25); crust.add(c); }
                const fr = new T.Mesh(ICE.disc, ICE.discM); fr.position.y = 0.1; crust.add(fr); g.add(crust); }
              if (crust) { crust.visible = e.slow > 0; if (crust.visible) { crust.scale.set(hs * 0.9 / g.scale.x, hs / g.scale.y, hs * 0.9 / g.scale.z); crust.userData.sh.scale.set(1, 1.25, 1); crust.userData.sh.rotation.y += dt * 0.5; } }
              if (e.slow > 0) {
                if (mat.emissive && !(e.flash > 0)) mat.emissive.setRGB(0.12, 0.42, 0.75);
                if (Math.random() < dt * 14) emit(sparks, e.x + rnd(-0.6, 0.6) * hs, rnd(1, 2.2) * hs, e.z + rnd(-0.6, 0.6) * hs, 0, rnd(-0.5, 0.3), 0, rnd(0.4, 0.8), Math.random() < 0.5 ? '#bff4ff' : '#ffffff', 3);
                if (F3 && Math.random() < dt * 6) F3.flake(e.x + rnd(-0.7, 0.7) * hs, rnd(1.2, 2.2) * hs, e.z + rnd(-0.7, 0.7) * hs, '#e8fbff', 0.3, 0.9);
              }
              // Shocked (chain lightning): small arcs crackle over the body. Poisoned: green tint and bubbles.
              if (e.shock > 0 && F3 && Math.random() < dt * 9) { const a = Math.random() * 6.28, r = 0.6 * hs; F3.bolt(e.x + Math.sin(a) * r, rnd(0.6, 1.6) * hs, e.z + Math.cos(a) * r, e.x - Math.sin(a) * r, rnd(0.6, 1.6) * hs, e.z - Math.cos(a) * r, { w: 0.18, colA: '#c77dff', colB: '#e8ffd0', branches: 0, life: 0.1, sparks: 2, flare: false }); }
              if (e.psn > 0) { if (mat.emissive && !(e.flash > 0)) mat.emissive.setRGB(0.12, 0.42 + 0.1 * Math.sin(time * 9), 0.05); if (Math.random() < dt * 10) emit(sparks, e.x + rnd(-0.5, 0.5) * hs, rnd(0.6, 1.8) * hs, e.z + rnd(-0.5, 0.5) * hs, 0, rnd(0.6, 1.4), 0, 0.5, Math.random() < 0.5 ? '#7dff4a' : '#d8ff9a', -0.5); }
              // Executioner: foes it can finish off are marked with a violet wisp.
              if (S.skills && S.skills.execute && !e.boss && e.hp < e.max * 0.15 && F3 && Math.random() < dt * 8) F3.mote(e.x + rnd(-0.3, 0.3), 2.6 * hs, e.z + rnd(-0.3, 0.3), '#c08cff', 0.35, 0.5, 0.8);
              // Casters (enemy wizards, bosses) wind up on a rune circle with motes rushing into their hands, then let go.
              const casting = e.state === 'cast' || e.state === 'cast2' || (e.boss && e.state === 'summon');
              if (casting) { const cc = e.boss ? CREW_C[(e.crew || 0) % 6] : '#c77dff', m2 = castRunes.get(nRune++), hx = e.x + Math.sin(e.face) * 0.7 * hs, hz = e.z + Math.cos(e.face) * 0.7 * hs;
                m2.material.color.set(cc); m2.position.set(e.x, 0.09, e.z); m2.rotation.y = time * 2.2; m2.scale.setScalar(e.r * 3.4 * (0.85 + 0.15 * Math.sin(time * 12)));
                if (F3 && dt > 0) F3.charge(hx, 1.5 * hs, hz, cc, 1.1 * hs, 2, 0.3, '#ffffff'); g.userData.cast = cc; }
              else if (g.userData.cast) { fx('cast', e.x + Math.sin(e.face) * 0.8 * hs, e.z + Math.cos(e.face) * 0.8 * hs, g.userData.cast); g.userData.cast = null; }
            }
            return g;
          };
          sync('hero', S.p, S.heroModel || S.hero, 1, true);
          if (heroRing) { heroRing.position.set(S.p.x, 0.07, S.p.z); heroRing.rotation.y = time; heroRing.userData.pool.position.set(S.p.x, 0.06, S.p.z); }
          if (heroAura) { heroAura.visible = !S.p.dead; heroAura.position.set(S.p.x, 0.08, S.p.z); heroAura.tick(time); }
          // Boss spotlight follows the living boss.
          { const b = S.enemies.find(e => e.boss && e.hp > 0 && e.state !== 'rise'); bossPool.visible = bossBeam.visible = !!b;
            if (bossAura) { bossAura.visible = !!b; if (b) { const c = b.rage ? '#ff2a2a' : CREW_C[(b.crew || 0) % 6]; if (bossAura.userData.cur !== c) { bossAura.userData.cur = c; bossAura.userData.setColor(c); } bossAura.position.set(b.x, 0.11, b.z); bossAura.scale.setScalar((b.r || 2) * 0.95); bossAura.tick(time * (b.rage ? 2 : 1)); } }
            if (b) { const r = (b.r || 2) * 2.6; bossPool.position.set(b.x, 0.1, b.z); bossPool.scale.set(r * 2.4, 1, r * 2.4); bossPool.material.opacity = 0.38 + 0.12 * Math.sin(time * 3);
              bossBeam.position.set(b.x, 0, b.z); bossBeam.scale.set(r * 0.42, 1, r * 0.42); bossBeam.material.opacity = 0.22 + 0.06 * Math.sin(time * 2.1);
              if (F3 && Math.random() < dt * 10) { const a = Math.random() * 6.28; F3.mote(b.x + Math.sin(a) * r * 0.8, 0.3, b.z + Math.cos(a) * r * 0.8, Math.random() < 0.5 ? '#c77dff' : '#ff4a7a', 0.22, rnd(1, 1.6), rnd(1.5, 3)); } } }
          // Boss entrance: motes stream into the boss as it rises, a pillar of its colour, then a shockwave on the roar.
          if (S.intro && F3 && dt > 0) {
            const I = S.intro, b = S.enemies.find(e => e.boss), c = b ? CREW_C[(b.crew || 0) % 6] : '#ff3a5a';
            if (I.t < 1.05) { F3.charge(I.x, 2, I.z, c, 7, 3, 0.5, '#ffffff'); if (Math.random() < dt * 20) emit(puffs, I.x + rnd(-3, 3), 0.4, I.z + rnd(-3, 3), 0, rnd(0.5, 1.5), 0, 0.8, '#5a4a3a'); }
            if (I.t > 0.12 && !I.v2a) { I.v2a = true; F3.crack(I.x, I.z, 8, 3, 0, 0.9); F3.spiral(I.x, I.z, c, 2.4, 12, 50, '#ffffff'); ring(I.x, I.z, c, 10, 0.8); }
            if (I.t > 1.05 && !I.v2b) { I.v2b = true; F3.ring(I.x, 0.6, I.z, c, 7, 64, '#ffffff'); F3.star(I.x, 3, I.z, c, 18, 0.6); ring(I.x, I.z, '#ffffff', 16, 0.7); ring(I.x, I.z, c, 22, 1); screenFlash(c, 0.5); }
          }
          // Gear on the hero: a coloured aura ring for good armour/jewels, a glow at the weapon hand, sparkles for legendaries.
          const gl = S.gearLook || {};
          auraG.visible = !!gl.aura; if (gl.aura) { auraG.material.color.set(gl.aura); auraG.position.set(S.p.x, 0.12, S.p.z); auraG.rotation.y = -time * 0.8; auraG.material.opacity = 0.55 + 0.15 * Math.sin(time * 3); }
          handG.visible = !!gl.weapon; if (gl.weapon) { handG.material.color.set(gl.weapon); handG.position.set(S.p.x + Math.sin(S.p.face + 0.6) * 0.9, 1.6, S.p.z + Math.cos(S.p.face + 0.6) * 0.9); handG.scale.setScalar(1.6 + 0.25 * Math.sin(time * 6)); }
          if (gl.legendary && Math.random() < dt * (gl.mythic ? 40 : 14)) emit(sparks, S.p.x + rnd(-0.8, 0.8), rnd(0.2, 2.6), S.p.z + rnd(-0.8, 0.8), 0, rnd(1, 2.5), 0, rnd(0.5, 0.9), gl.mythic ? topCol(gl) : Math.random() < 0.5 ? '#ffd23f' : '#fff3c0');
          // Mythic: a second counter-rotating ring, a pillar of light and a pulsing glow on the hero.
          aura2.visible = pillar.visible = !!gl.mythic;
          if (gl.mythic) {
            tintTop(gl); aura2.position.set(S.p.x, 0.13, S.p.z); aura2.rotation.y = time * 1.3; aura2.scale.setScalar(1.35 + 0.08 * Math.sin(time * 4));
            pillar.position.set(S.p.x, 0, S.p.z); pillar.material.opacity = 0.38 + 0.12 * Math.sin(time * 3);
            const hm = ents.get('hero'); if (hm && hm.userData.m.material.emissive && !(S.p.inv > 0)) { const k = 0.12 * Math.sin(time * 5); if (gl.celestial) hm.userData.m.material.emissive.setRGB(0.02, 0.1 + k * 0.6, 0.17 + k); else hm.userData.m.material.emissive.setRGB(0.18 + k, 0.03, 0.02); }
          }
          { const hm = ents.get('hero'); if (hm && !(S.p.inv > 0)) skinFx(hm, S.p.x, S.p.z, S.p.moving, dt, time); }
          // Skill marks at the hands: the mage's spell charging before every cast, attack-speed motes circling the hand,
          // an ember glow for attack boosts, wind at the feet for dodge, gold glints for crits.
          { const ps = S.skills || {}, f = S.p.face, hx = S.p.x + Math.sin(f + 0.5) * 0.95, hz = S.p.z + Math.cos(f + 0.5) * 0.95, live = !S.p.dead && mode === 'play';
            const charging = live && S.shotKind === 'orb' && S.p.cd > 0 && S.p.cd < 0.32 && S.enemies.some(e => e.hp > 0 && e.state !== 'rise');
            chargeS.visible = charging;
            if (charging) { const u = 1 - S.p.cd / 0.32; chargeS.position.set(hx, 1.7, hz); chargeS.scale.setScalar(0.6 + 1.6 * u + 0.15 * Math.sin(time * 30)); chargeS.material.color.set(ps.fire ? '#ff8a2a' : ps.ice ? '#9fe8ff' : ps.poison ? '#7dff4a' : '#c48bff'); if (F3 && dt > 0) F3.charge(hx, 1.7, hz, chargeS.material.color, 1.3, 2, 0.28, '#ffffff'); }
            const spd = (ps.spd || 0) + (ps.spdS || 0);
            speedS.forEach((o, k) => { o.visible = spd > 0 && live; if (o.visible) { const a = time * (6 + spd) + k * Math.PI; o.position.set(hx + Math.sin(a) * 0.45, 1.6 + Math.cos(a) * 0.3, hz + Math.cos(a) * 0.45); o.scale.setScalar(0.5 + 0.05 * spd); if (F3 && Math.random() < dt * (8 + 3 * spd)) F3.trail(o.position.x, o.position.y, o.position.z, '#ffe27a', 0.35, 0.2); } });
            const pw = (ps.atk || 0) + (ps.atkS || 0) * 0.5;
            powerS.visible = pw > 0 && live;
            if (powerS.visible) { powerS.position.set(hx, 1.5, hz); powerS.scale.setScalar(0.9 + 0.12 * pw + 0.15 * Math.sin(time * 12)); powerS.material.color.set(ps.atk ? '#ff5a2a' : '#cfe8ff'); if (Math.random() < dt * (4 + 2 * pw)) emit(flamesC, hx, 1.5, hz, rnd(-0.3, 0.3), rnd(1, 2), rnd(-0.3, 0.3), 0.35, ps.atk ? '#ff5a2a' : '#eaf6ff', -2); }
            if (ps.dodge && live && Math.random() < dt * 3 * ps.dodge) emit(puffs, S.p.x + rnd(-0.6, 0.6), 0.3, S.p.z + rnd(-0.6, 0.6), rnd(-0.6, 0.6), 0.3, rnd(-0.6, 0.6), 0.5, '#e2f4ff');
            if (ps.crit && live && F3 && Math.random() < dt * 2 * ps.crit) F3.star(hx, 1.7, hz, '#ffd23f', 1.4, 0.2); }
          bubble.visible = !!S.shieldOn; if (bubble.visible) { bubble.position.set(S.p.x, 1.5, S.p.z); bubble.scale.setScalar(2.3 + 0.08 * Math.sin(time * 5)); bubbleMat.uniforms.t.value = time; bubble.rotation.y = time * 0.3;
            if (Math.random() < dt * 6) { const a = Math.random() * 6.28, b = Math.random() * 3.14; emit(sparks, S.p.x + Math.sin(a) * Math.sin(b) * 2.3, 1.5 + Math.cos(b) * 2.3, S.p.z + Math.cos(a) * Math.sin(b) * 2.3, 0, 0.3, 0, 0.4, '#bfeaff'); } }
          // Passive skills show on the hero, in the same sparkle language as the gear glow.
          { const ps = S.skills || {}, hx = S.p.x, hz = S.p.z, mv = S.p.moving, bx = -Math.sin(S.p.face), bz = -Math.cos(S.p.face);
            if ((ps.boots || ps.move) && mv && Math.random() < dt * (10 + 6 * (ps.boots || 0))) { emit(puffs, hx + bx * 0.6 + rnd(-0.3, 0.3), 0.2, hz + bz * 0.6 + rnd(-0.3, 0.3), bx * 0.8, rnd(0.2, 0.5), bz * 0.8, 0.45, '#e2f4ff'); emit(sparks, hx + rnd(-0.4, 0.4), rnd(0.4, 1.2), hz + rnd(-0.4, 0.4), bx * 3, 0.1, bz * 3, 0.3, '#bff0ff'); }
            if ((ps.hpS || ps.hp) && Math.random() < dt * (2 + (ps.hpS || 0) + (ps.hp || 0))) { const a = Math.random() * 6.28; emit(sparks, hx + Math.sin(a) * 0.9, 0.3, hz + Math.cos(a) * 0.9, 0, rnd(2, 3.2), 0, 0.6, '#ffcf5a', -0.5); }
            if (ps.greed && Math.random() < dt * 3 * ps.greed) emit(sparks, hx + rnd(-0.7, 0.7), rnd(1, 2.4), hz + rnd(-0.7, 0.7), 0, -0.6, 0, 0.7, Math.random() < 0.5 ? '#ffd23f' : '#fff3a0', 1);
            wisdomS.forEach((s, k) => { s.visible = !!ps.wisdom; if (s.visible) { const a = time * 2.2 + k * Math.PI; s.position.set(hx + Math.sin(a) * 1.1, 2.9 + 0.25 * Math.sin(time * 3 + k), hz + Math.cos(a) * 1.1); s.scale.setScalar(0.7 + 0.15 * Math.sin(time * 6 + k)); if (Math.random() < dt * 8) emit(sparks, s.position.x, s.position.y, s.position.z, 0, -0.3, 0, 0.4, '#a8d8ff'); } });
            const raging = !!ps.rage && S.p.hp < S.p.max / 2;
            rageG.visible = raging; if (raging) { rageG.position.set(hx, 0.14, hz); rageG.scale.setScalar(2.2 + 0.3 * Math.sin(time * 9)); rageG.material.opacity = 0.45 + 0.2 * Math.sin(time * 9); if (Math.random() < dt * 22) emit(flamesC, hx + rnd(-0.6, 0.6), 0.4, hz + rnd(-0.6, 0.6), 0, rnd(1.5, 3), 0, 0.4, Math.random() < 0.5 ? '#ff2a1a' : '#ff8a3a', -2); }
            haloS.visible = !!ps.second && !S.secondUsed; if (haloS.visible) { haloS.position.set(hx, 4.1 + 0.08 * Math.sin(time * 3), hz); haloS.rotation.y = time; }
            const bossOn = !!ps.giant && S.enemies.some(e => e.boss && e.hp > 0);
            giantS.visible = bossOn; if (bossOn) { giantS.position.set(hx + Math.sin(S.p.face - 0.6) * 0.9, 1.6, hz + Math.cos(S.p.face - 0.6) * 0.9); giantS.scale.setScalar(1.5 + 0.3 * Math.sin(time * 12)); if (Math.random() < dt * 14) emit(flamesC, giantS.position.x, 1.6, giantS.position.z, 0, rnd(1, 2), 0, 0.3, '#ff5a2a', -2); }
          }
          nRune = 0; elites.length = 0; eliteG.length = 0;
          S.enemies.forEach(e => { if (!e.key) e.key = 'e' + (++uid); sync(e.key, e, e.kind, e.scale, false); });
          elites.forEach((e, i) => {
            const g = eliteG[i], hs = 1.6 * (e.scale || 1) * FOE_K(e), c = eliteCrowns.get(i), r = eliteRunes.get(i);
            c.position.set(e.x, g.position.y + g.userData.hy * g.scale.y - 0.12 + 0.06 * Math.sin(time * 3 + i), e.z); // worn on the head c.rotation.y = time * 1.5;
            r.position.set(e.x, 0.1, e.z); r.rotation.y = -time * 0.9; r.scale.setScalar((e.r || 1) * 2.5 * (1 + 0.05 * Math.sin(time * 5)));
            if (F3 && Math.random() < dt * 6) F3.mote(e.x + rnd(-0.8, 0.8), rnd(0.2, 1.6) * hs, e.z + rnd(-0.8, 0.8), Math.random() < 0.6 ? '#ffd23f' : '#fff3b0', 0.3, 1, 1.4);
          });
          eliteCrowns.hide(elites.length); eliteRunes.hide(elites.length);
          castRunes.hide(nRune);
          ents.forEach((g, k) => { if (!seen.has(k)) { dyn.remove(g); ents.delete(k); } });
          // Projectiles with light trails.
          const kind = S.shotKind || 'bolt'; frameN++;
          if (kind !== shotKind) { shotKind = kind; shots.list.forEach(m => { m.geometry = SHOT_GEO[kind]; m.material = shotMat[kind]; }); }
          // Elemental arrows: the trail and the sparks it sheds follow the element the hero has picked.
          const skl = S.skills || {}, elemCol = skl.fire ? '#ff7a1a' : skl.ice ? '#8fe6ff' : skl.bolt ? '#c77dff' : skl.poison ? '#7dff4a' : null;
          const elemCol2 = skl.fire ? '#ffd23f' : skl.ice ? '#ffffff' : skl.poison ? '#d8ff9a' : '#f2d4ff', elemUp = skl.ice && !skl.fire ? -0.5 : 1.5;
          // The arrow/orb itself takes the element's tint (ice arrows look like ice).
          if (kind === 'bolt' || kind === 'orb') shotMat[kind].color.set(skl.ice ? '#e4faff' : skl.fire ? '#ffd8a0' : skl.poison ? '#dcffb8' : skl.bolt ? '#f0dcff' : SHOT_COL[kind]);
          S.shots.forEach((s, i) => {
            const m = shots.get(i); m.geometry = SHOT_GEO[kind]; m.material = shotMat[kind]; m.position.set(s.x, 1.3, s.z); m.rotation.set(0, s.a + (kind === 'axe' || kind === 'blade' ? time * 14 : 0), 0);
            const t = trails.get(i); t.position.set(s.x, 1.3, s.z); t.rotation.set(0, s.a, 0); t.material.color.set(elemCol || (kind === 'bolt' ? '#9ff0ff' : SHOT_COL[kind])); t.scale.set(elemCol ? 1.8 : 1, 1, elemCol ? 1.7 : 1);
            const pw = 1 + 0.06 * ((skl.atk || 0) + (skl.atkS || 0));
            t.scale.z *= 1 + 0.12 * (skl.atkS || 0) + 0.08 * (skl.pierce || 0);
            const sg = shotGlows.get(i); sg.position.set(s.x, 1.3, s.z); sg.material.color.set(elemCol || (skl.atkS ? '#e6f4ff' : '#fff1a8')); sg.scale.setScalar((elemCol ? 2.8 : 1.4) * pw * (0.9 + 0.2 * Math.sin(time * 40 + i)));
            // Light trail: a glowing dot left behind every frame (GPU particles, fades in ~0.16 s).
            if (F3 && dt > 0) F3.trail(s.x - Math.sin(s.a) * 0.5, 1.3, s.z - Math.cos(s.a) * 0.5, elemCol || (i % 3 === 1 ? '#ff7ad8' : '#5fe0ff'), elemCol ? 0.75 : 0.6, 0.16);
            if (!s._seen) { s._seen = 1; flare(s.x, 1.3, s.z, elemCol || '#fff1a8', (elemCol ? 3.4 : 2) * pw, 0.12);
              // Bow release: one bright burst with a fan of sparks per volley (several arrows can leave on one frame).
              if (F3 && !s.child && muzzleT <= 0) { muzzleT = 0.06; const fa = S.p.face, mx = S.p.x + Math.sin(fa) * 1.1, mz = S.p.z + Math.cos(fa) * 1.1; F3.muzzle(mx, 1.45, mz, Math.sin(fa), Math.cos(fa), elemCol || '#ffc46a', 1.15);
                if (kind === 'orb') { F3.ring(mx, 1.45, mz, elemCol || '#c48bff', 0.7, 12, '#ffffff'); F3.star(mx, 1.45, mz, elemCol || '#d7a8ff', 3, 0.16); }
                if (skl.spd || skl.spdS) F3.ring(mx, 1.45, mz, '#ffe27a', 0.45, 8);
                if (skl.ice) F3.frost(mx, 1.45, mz, 0.35); }
              if (skl.spdS || skl.spd) for (let k = 0; k < 3; k++) emit(sparks, s.x, 1.3, s.z, rnd(-2, 2), rnd(0.5, 2), rnd(-2, 2), 0.2, '#ffe27a'); }
            if (skl.atkS && Math.random() < dt * 30) emit(sparks, s.x, 1.3, s.z, 0, 0.2, 0, 0.22, '#eaf6ff');
            if (skl.fire && Math.random() < dt * 60) emit(flamesC, s.x + rnd(-0.2, 0.2), 1.3, s.z + rnd(-0.2, 0.2), rnd(-0.5, 0.5), rnd(0.5, 1.5), rnd(-0.5, 0.5), rnd(0.15, 0.3), Math.random() < 0.5 ? '#ff6a10' : '#ffc23a', -2);
            if (F3 && dt > 0) {
              // Ice arrows shed snowflakes and frost; poison drips spores; lightning crackles along the shaft; orbs spiral.
              if (skl.ice && Math.random() < dt * 30) F3.flake(s.x + rnd(-0.25, 0.25), 1.3 + rnd(-0.2, 0.2), s.z + rnd(-0.25, 0.25), Math.random() < 0.5 ? '#e8fbff' : '#9fe8ff', 0.4, 0.8);
              if (skl.ice && (i + frameN) % 2) F3.trail(s.x - Math.sin(s.a) * 0.9, 1.3, s.z - Math.cos(s.a) * 0.9, '#6fd4ff', 0.5, 0.34);
              if (skl.poison && Math.random() < dt * 25) F3.flake(s.x, 1.3, s.z, '#9dff5a', 0.3, 0.6);
              if (skl.bolt && Math.random() < dt * 4) F3.bolt(s.x, 1.3, s.z, s.x - Math.sin(s.a) * 1.6 + rnd(-0.4, 0.4), 1.3 + rnd(-0.3, 0.3), s.z - Math.cos(s.a) * 1.6 + rnd(-0.4, 0.4), { w: 0.14, colA: '#c77dff', colB: '#e8ffd0', branches: 0, life: 0.08, sparks: 0, flare: false });
              if (kind === 'orb') for (let k = 0; k < 2; k++) { const a = time * 22 + k * Math.PI + i; F3.trail(s.x + Math.cos(s.a) * Math.sin(a) * 0.45, 1.3 + Math.cos(a) * 0.45, s.z - Math.sin(s.a) * Math.sin(a) * 0.45, k ? elemCol2 : (elemCol || '#c48bff'), 0.42, 0.24); }
            }
            if (elemCol && Math.random() < dt * 40) emit(sparks, s.x + rnd(-0.15, 0.15), 1.3 + rnd(-0.15, 0.15), s.z + rnd(-0.15, 0.15), rnd(-0.6, 0.6), elemUp, rnd(-0.6, 0.6), rnd(0.2, 0.4), Math.random() < 0.5 ? elemCol : elemCol2, elemUp < 0 ? 3 : -2);
          });
          shots.hide(S.shots.length); trails.hide(S.shots.length); shotGlows.hide(S.shots.length); muzzleT -= dt;
          S.foes.forEach((s, i) => {
            const ax = s.kind === 'axe', m = foes.get(i);
            m.geometry = ax ? foeAxe : s.kind === 'bolt' ? foeBolt : foeOrb; m.material = ax ? bmat('#ffffff', { vertexColors: true }) : bmat(s.kind === 'bolt' ? '#ff5050' : '#e07bff');
            m.position.set(s.x, 1.2, s.z); m.rotation.y = s.a + (ax ? time * 12 : 0);
            const gl = glows.get(i); gl.position.set(s.x, 1.2, s.z); gl.material.color.set(ax ? '#ff7a30' : s.kind === 'bolt' ? '#ff3030' : '#c040ff'); gl.scale.setScalar((ax ? 1.4 : s.kind === 'bolt' ? 1.6 : 2.4) * (0.9 + 0.15 * Math.sin(time * 30 + i)));
            if (F3 && dt > 0) F3.trail(s.x, 1.2, s.z, ax ? '#ff7a30' : s.kind === 'bolt' ? '#ff3030' : '#c040ff', s.kind === 'orb' ? 0.8 : 0.5, 0.2);
          });
          foes.hide(S.foes.length); glows.hide(S.foes.length);
          S.drops.forEach((d, i) => { const m = coins.get(i); m.position.set(d.x, 0.5 + Math.abs(Math.sin(time * 5 + i)) * 0.4, d.z); m.rotation.set(Math.PI / 2, time * 3, 0); });
          coins.hide(S.drops.length);
          // Telegraphs and effects.
          let li = 0, ri = 0, fi = 0, si = 0;
          for (const f of S.fx) {
            if (f.kind === 'line') { const m = lines.get(li++); m.position.set(f.x, 0.08, f.z); m.rotation.y = f.a + Math.PI; m.scale.set(f.wide ? 3.5 : f.thin ? 0.35 : 1.6, 1, f.len); m.material.opacity = 0.25 + 0.25 * Math.sin(time * 20);
              if (!f.thin && Math.random() < dt * 24) { const t = Math.random() * f.len; emit(sparks, f.x + Math.sin(f.a) * t, 0.2, f.z + Math.cos(f.a) * t, 0, rnd(1, 2.5), 0, 0.35, '#ff5a4a'); } }
            else if (f.kind === 'meteor') {
              const t = 1 - f.life / f.max, m = rings.get(ri++); m.position.set(f.x, 0.1, f.z); m.scale.set(f.r, 1, f.r); m.material.opacity = 0.4 + 0.4 * Math.sin(time * 25);
              meteorS.visible = true; meteorS.position.set(f.x - 8 * (1 - t), 1 + 22 * (1 - t), f.z - 6 * (1 - t)); meteorS.scale.setScalar(3.5 + 2 * t);
              if (F3 && dt > 0) { F3.trail(meteorS.position.x, meteorS.position.y, meteorS.position.z, '#ff7a1a', 2.2, 0.35); F3.trail(meteorS.position.x, meteorS.position.y, meteorS.position.z, '#fff2b0', 1, 0.2); }
              if (Math.random() < 0.9) emit(flamesC, meteorS.position.x, meteorS.position.y, meteorS.position.z, rnd(-1, 1), rnd(1, 3), rnd(-1, 1), rnd(0.3, 0.5), Math.random() < 0.5 ? '#ff5a10' : '#ffd23f');
              continue;
            }
            else if (f.kind === 'rain') {
              const m = rings.get(ri++); m.position.set(f.x, 0.1, f.z); m.scale.set(f.r, 1, f.r); m.material.opacity = 0.5;
              for (let k = 0; k < 3; k++) emit(sparks, f.x + rnd(-f.r, f.r), 12, f.z + rnd(-f.r, f.r), 0, -40, 0, 0.3, '#fff1a8');
              continue;
            }
            else if (f.kind === 'nova') { const m = shocks2.get(si++), t = 1 - f.life / 0.5, e = 1 - Math.pow(1 - t, 2); m.position.set(f.x, 0.12, f.z); m.scale.set(f.r * e * 1.15, 1, f.r * e * 1.15); m.material.opacity = 1 - t; continue; }
            else if (f.kind === 'zap') {
              if (!f._lit) { f._lit = 1; fx('zapfx', f.x, f.z, { x2: f.x2, z2: f.z2 }); }
              const m = lines.get(li++), dx = f.x2 - f.x, dz = f.z2 - f.z; m.position.set(f.x, 1.3 + rnd(-0.15, 0.15), f.z); m.rotation.y = Math.atan2(dx, dz) + Math.PI + rnd(-0.06, 0.06); m.scale.set(rnd(0.15, 0.45), 1, Math.hypot(dx, dz)); m.material.opacity = 0.9;
              for (let k = 0; k < 3; k++) { const t = Math.random(); emit(sparks, f.x + dx * t + rnd(-0.3, 0.3), 1.3 + rnd(-0.3, 0.3), f.z + dz * t + rnd(-0.3, 0.3), rnd(-2, 2), rnd(-1, 2), rnd(-2, 2), 0.18, Math.random() < 0.5 ? '#c77dff' : '#ffffff'); }
            }
            else {
              const m = rings.get(ri++); m.position.set(f.x, 0.1, f.z); m.material.color.set(f.c || '#ff3b3b');
              if (f.kind === 'boom') { const r = f.r * (1.05 - f.life / 0.4 * 0.45); m.scale.set(r, 1, r); m.material.opacity = 0.9; continue; }
              // Telegraph: the outline pulses and a disc fills up from the centre until the strike lands.
              m.scale.set(f.r, 1, f.r); m.material.opacity = 0.55 + 0.3 * Math.sin(time * 18);
              if (!f.max) f.max = f.life;
              const fl = fills.get(fi++), k = Math.max(0.05, 1 - f.life / f.max); fl.position.set(f.x, 0.09, f.z); fl.scale.set(f.r * k, 1, f.r * k); fl.material.color.set(f.c || '#ff3b3b'); fl.material.opacity = 0.18 + 0.2 * k;
              // About to land: the fill flickers hot and sparks rise off the rim.
              if (k > 0.8) fl.material.opacity = 0.32 + 0.22 * Math.sin(time * 45);
              if (Math.random() < dt * 8 * f.r) { const a = Math.random() * 6.28; emit(sparks, f.x + Math.sin(a) * f.r, 0.2, f.z + Math.cos(a) * f.r, 0, rnd(1.5, 3.5), 0, 0.4, f.c || '#ff3b3b'); }
            }
          }
          lines.hide(li); rings.hide(ri); fills.hide(fi); shocks2.hide(si); if (!S.fx.some(f => f.kind === 'meteor')) meteorS.visible = false;
          // Fire circle.
          const n = 2 * (S.skills.orbit || 0);
          for (let k = 0; k < n; k++) { const a = S.orbT + k / n * Math.PI * 2, m = orbs.get(k); if (F3 && dt > 0) F3.trail(S.p.x + Math.sin(a) * 2.6, 1.3, S.p.z + Math.cos(a) * 2.6, '#ff7a1a', 0.9, 0.22); m.position.set(S.p.x + Math.sin(a) * 2.6, 1.3, S.p.z + Math.cos(a) * 2.6); m.children[1].scale.setScalar(2.2 + 0.4 * Math.sin(time * 22 + k)); if (Math.random() < dt * 30) emit(flamesC, m.position.x, 1.3, m.position.z, -Math.cos(a) * 1.5, rnd(0.5, 1.5), Math.sin(a) * 1.5, rnd(0.2, 0.35), Math.random() < 0.5 ? '#ff5a10' : '#ffb03a', -1.5); if (Math.random() < dt * 25) emit(sparks, m.position.x, 1.3, m.position.z, rnd(-0.5, 0.5), rnd(1, 2.5), rnd(-0.5, 0.5), rnd(0.25, 0.45), Math.random() < 0.5 ? '#ff7a1a' : '#ffd23f', -2); }
          orbs.hide(n);
          // Ground zones, frost aura, spinning blades.
          const zs = S.zones || [];
          zs.forEach((zn, i) => {
            const m = zoneM.get(i), t = zn.life / zn.max, fire = zn.kind === 'fire';
            m.position.set(zn.x, 0.11 + i * 0.0005, zn.z); m.scale.setScalar(zn.r * 1.5 * (0.9 + 0.1 * Math.sin(time * 6 + i))); m.rotation.y = i * 1.7 + time * (fire ? 0.6 : 0.25);
            if (!fire && Math.random() < dt * 5) emit(sparks, zn.x + rnd(-0.6, 0.6) * zn.r, 0.2, zn.z + rnd(-0.6, 0.6) * zn.r, 0, rnd(0.6, 1.4), 0, 0.5, '#b6ff5a', 0.5); // poison bubbles
            m.material.color.set(fire ? '#ff5a10' : '#5dff3a'); m.material.opacity = Math.min(1, t * 2) * 0.9;
            if (Math.random() < dt * (fire ? 10 : 6)) emit(fire ? flamesC : puffs, zn.x + rnd(-0.6, 0.6) * zn.r, 0.3, zn.z + rnd(-0.6, 0.6) * zn.r, 0, fire ? rnd(1.5, 3) : 0.6, 0, fire ? rnd(0.3, 0.5) : 0.9, fire ? (Math.random() < 0.5 ? '#ff6a10' : '#ffc23a') : '#3ad12a', fire ? -2 : 0);
          });
          zoneM.hide(zs.length);
          auraM.visible = auraF.visible = !!S.auraR;
          if (S.auraR) {
            auraM.position.set(S.p.x, 0.13, S.p.z); auraM.scale.setScalar(S.auraR); auraM.rotation.y = time * 0.6;
            auraF.position.set(S.p.x, 0.12, S.p.z); auraF.scale.setScalar(S.auraR * 1.3); auraF.material.opacity = 0.3 + 0.08 * Math.sin(time * 3);
            if (Math.random() < dt * 25) { const a = Math.random() * Math.PI * 2, r = S.auraR * Math.sqrt(Math.random()); emit(sparks, S.p.x + Math.sin(a) * r, 0.3, S.p.z + Math.cos(a) * r, 0, rnd(0.8, 2), 0, rnd(0.5, 0.9), Math.random() < 0.5 ? '#bff4ff' : '#ffffff'); }
          }
          iceG.visible = !!S.auraR;
          if (S.auraR) iceG.children.forEach((c, k) => { const a = time * 1.3 + k / 6 * Math.PI * 2, r = S.auraR * 0.82; c.position.set(S.p.x + Math.sin(a) * r, 0.9 + 0.25 * Math.sin(time * 3 + k), S.p.z + Math.cos(a) * r); c.rotation.y = time * 3 + k; });
          const nb = (S.skills && S.skills.blades) ? 1 + S.skills.blades : 0;
          for (let k = 0; k < nb; k++) {
            const a = (S.bladeT || 0) + k / nb * Math.PI * 2, m = bladeM.get(k);
            m.position.set(S.p.x + Math.sin(a) * 3.6, 1.3, S.p.z + Math.cos(a) * 3.6); m.rotation.y = a + time * 12;
            if (Math.random() < dt * 20) emit(sparks, m.position.x, 1.3, m.position.z, 0, 0.5, 0, 0.25, '#dfefff');
            if (F3 && dt > 0) F3.trail(m.position.x, 1.3, m.position.z, '#bfe0ff', 0.7, 0.2);
          }
          bladeM.hide(nb);
          // Door, spikes, angel.
          const open = S.door && !(S.angel && !S.angel.used);
          if (door) door.visible = !S.door;
          if (portal) { portal.visible = !!S.door; portal.material.opacity = 0.65 + 0.3 * Math.sin(time * 4); }
          if (doorArrow) { doorArrow.visible = open; doorArrow.position.y = 6 + Math.sin(time * 4) * 0.6; doorArrow.rotation.y = time * 2; }
          chevrons.forEach((c, k) => { c.visible = open; c.material.opacity = 0.25 + 0.75 * Math.max(0, Math.sin(time * 5 + k * 0.9)); });
          if (open && Math.random() < dt * 12) fx('door', 0, -RH + 1);
          S.spikes.forEach((sp, i) => {
            const t = spikesM[i]; if (!t) return;
            const ph = sp.t % 3, warn = !sp.up && ph > 2.3, x = sp.x, z = sp.z;
            if (t.glow) t.glow.material.opacity = sp.up ? 0.9 : warn ? 0.35 + 0.35 * Math.sin(time * 30) : 0.08;
            if (t.kind === 'spikes') t.rise.position.y = sp.up ? 0 : -1.6;
            else if (t.kind === 'ice') { t.rise.position.y += ((sp.up ? 0 : -2.6) - t.rise.position.y) * Math.min(1, dt * 18); if (sp.up && Math.random() < dt * 12) emit(sparks, x + rnd(-1.5, 1.5), rnd(0.5, 2), z + rnd(-1.5, 1.5), 0, 0.5, 0, 0.5, '#e8fbff'); }
            else if (t.kind === 'geyser') { t.rise.visible = sp.up; t.rise.scale.set(1, sp.up ? 0.9 + 0.15 * Math.sin(time * 25) : 0.01, 1); if (sp.up) for (let k = 0; k < 3; k++) emit(sparks, x + rnd(-1, 1), rnd(3, 5), z + rnd(-1, 1), rnd(-3, 3), rnd(1, 4), rnd(-3, 3), rnd(0.4, 0.7), Math.random() < 0.5 ? '#bfeaff' : '#ffffff', 14); }
            else if (t.kind === 'fire' && sp.up) { for (let k = 0; k < 7; k++) emit(flamesC, x + rnd(-0.7, 0.7), 0.3, z + rnd(-0.7, 0.7), rnd(-0.8, 0.8), rnd(8, 14), rnd(-0.8, 0.8), rnd(0.35, 0.6), Math.random() < 0.6 ? '#ff5a10' : '#ffd23f', -2); }
            else if (t.kind === 'fire' && warn && Math.random() < dt * 20) emit(sparks, x + rnd(-1, 1), 0.3, z + rnd(-1, 1), 0, rnd(1, 3), 0, 0.4, '#ff8a2a');
          });
          if (angelG) {
            angelG.g.visible = !S.angel.used; angelG.g.position.y = 0.6 + Math.sin(time * 2) * 0.3;
            angelG.wings.forEach((w, k) => { w.rotation.y = (k ? -1 : 1) * (0.5 + Math.sin(time * 3) * 0.3); });
            pose(angelG.g.userData.m, 6, 6, 0);
            if (!S.angel.used && Math.random() < dt * 8) fx('angel', S.angel.x, S.angel.z);
          }
          // V3 hero hit: a red edge flash, the hero glows red and a hex shield ripples around them; low health pulses.
          { const p = S.p;
            if (lastHp >= 0 && p.hp < lastHp - 0.5 && !p.dead) { hurtA = 0.85; hitSh = 0.32; if (F3) { F3.ring(p.x, 1.2, p.z, '#ff3b4a', 1.6, 18, '#ffffff'); F3.star(p.x, 1.6, p.z, '#ff5a6a', 4, 0.2); } punch = Math.max(punch, 0.35); }
            lastHp = p.hp;
            hurtA = Math.max(0, hurtA - dt * 2.6); hitSh = Math.max(0, hitSh - dt);
            const low = !p.dead && p.hp < p.max * 0.3 ? 0.22 + 0.18 * Math.sin(time * 6) : 0;
            const ha = Math.max(hurtA, low); if (Math.abs((+hurtEl.style.opacity || 0) - ha) > 0.01) hurtEl.style.opacity = ha.toFixed(2);
            const hm = ents.get('hero'); if (hm && hitSh > 0 && hm.userData.m.material.emissive) hm.userData.m.material.emissive.setRGB(hitSh * 2.4, 0.05, 0.05); }
          if (hitSh > 0 && !S.shieldOn) { bubble.visible = true; bubbleMat.uniforms.col.value.set('#ff4a5a'); bubble.position.set(S.p.x, 1.5, S.p.z); bubble.scale.setScalar(2.1 + (0.32 - hitSh) * 2); bubbleMat.uniforms.t.value = time; }
          else bubbleMat.uniforms.col.value.set('#7fd0ff');
          // V3 door opening: the barrier blows apart in green light, chips fly, the portal grows out of the doorway.
          if (S.door && !doorFx) {
            doorFx = true; doorT = 0; const dz = -RH + 0.8;
            if (F3) { F3.explosion(0, 1.6, dz, 1.8, { color: '#5aff9a', rocks: 14, rockCol, scorch: false, shake: 0.35 }); F3.ring(0, 0.6, dz, '#7dffae', 4, 40, '#ffffff'); F3.star(0, 2.4, dz, '#c8ffe0', 12, 0.5); F3.spiral(0, dz + 0.5, '#7dffae', 1.6, 8, 30, '#ffffff'); }
            ring(0, dz + 1, '#7dffae', 9, 0.6); flare(0, 2, dz, '#9effc8', 12, 0.5); screenFlash('rgba(125,255,174,.35)', 0.4);
          }
          if (portal && S.door) { doorT += dt; const u = Math.min(1, doorT / 0.55); portal.scale.set(1, u < 1 ? u * (1.25 - 0.25 * u) : 1, 1); }
          const off = R.v3off || {}; // test hook: switch V3 extras off one by one (bench experiments)
          if (off.mist) fogSheets.forEach(m => { m.visible = false; });
          if (off.pools) room.children.forEach(m => { if (m.userData.pool3) m.visible = false; });
          if (!lowFxA && !off.wx && wx && F3 && dt > 0) for (const w of wx) F3.weather(w[0], camX, camZ - 2, 30, 34, 9, w[1], dt, 1);
          fogSheets.forEach((m, k) => { m.material.map.offset.set((time * (0.006 + k * 0.004)) % 1, (time * (0.004 - k * 0.007)) % 1); });
          if (S.chest && !chestG) chestG = buildChest(S.chest);
          if (chestG) animChest(S.chest, dt);
          camRoom(S, dt);
          if (R.artCam) { camera.position.set(-8.5, 8, 15.5); camera.lookAt(0, 0, -1.5); }
          if (F3) camera.position.add(F3.shakeOffset(0.35));
          renderer.render(scene, camera);
        },
      };
      let uid = 0; const elites = [];
      return R;
    },
  };
})();
