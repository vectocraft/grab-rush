// 3D renderer for Sürü Seli (Three.js). The game keeps 2D coordinates (x 0..400 across, y along the road,
// squad near y 610); here X = x - 200, Z = y - 360. Lanes are drawn as tiles keyed by road position so a
// widening road (2 -> 3 lanes) scrolls in with the asphalt. Suru3D.init() returns null without WebGL; the game
// then uses its 2D renderer.
(function () {
  'use strict';
  if (!window.THREE) return;
  const T = window.THREE;
  const CX = 200, CZ = 360, SQUAD_Y = 610, TILE = 60, NEAR_Y = 1050, FAR_Y = -1800;
  // MAX_F: extra marchers that only thicken the crowd on screen (the squad count in the game is unchanged).
  const MAX_S = 64, MAX_F = 96, MAX_SG = MAX_S + MAX_F, MAX_E = 360, MAX_B = 800, MAX_FX = 400;
  const TAU = Math.PI * 2;

  // ---------- Procedural textures ----------
  function tex(w, h, draw, rx, ry) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace;
    if (rx) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); }
    t.anisotropy = 4;
    return t;
  }
  function speckle(g, w, h, n, cols, sz) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = cols[i % cols.length];
      g.fillRect(Math.random() * w, Math.random() * h, sz * (0.5 + Math.random()), sz * (0.5 + Math.random()));
    }
  }
  const asphaltTex = () => tex(256, 256, (g, w, h) => {
    g.fillStyle = '#4a505c'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 5000, ['#3d424d', '#565d6a', '#444955', '#5f6673'], 2.2);
    g.strokeStyle = 'rgba(30,32,38,.5)'; g.lineWidth = 1.2;
    for (let k = 0; k < 5; k++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (Math.random() - 0.5) * 30; y += Math.random() * 18; g.lineTo(x, y); } g.stroke(); }
  }, 1, 1);
  // Lane tiles: stone paving (3 x 2 bevelled blocks with grout, per-block shade, wear and grit), lightly tinted by
  // the lane's side, with a glowing coloured rail on both edges — the reward lane cool blue, the enemy lane red with
  // hazard chevrons. Reads as a real road from the low camera instead of a flat toy runway.
  function laneTile(kind) {
    return tex(256, 256, (g, w, h) => {
      const good = kind === 'r', base = good ? [118, 136, 158] : [150, 112, 104], rail = good ? '#38b6ff' : '#ff4a4a';
      g.fillStyle = good ? '#3d4654' : '#4a3634'; g.fillRect(0, 0, w, h); // grout
      const cols = 3, rows = 2, m = 22, bw = (w - 2 * m) / cols, bh = h / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const off = r % 2 ? bw / 2 : 0, k = 0.86 + Math.random() * 0.22;
        for (const dx of off ? [-bw, 0] : [0]) {
          const x = m + c * bw + off + dx + 3, y = r * bh + 3, ww = bw - 6, hh = bh - 6;
          if (x + ww < m || x > w - m) continue;
          g.save(); g.beginPath(); g.rect(m, 0, w - 2 * m, h); g.clip();
          const gr = g.createLinearGradient(x, y, x + ww * 0.4, y + hh);
          gr.addColorStop(0, 'rgb(' + base.map(v => Math.min(255, v * k * 1.16) | 0) + ')'); gr.addColorStop(1, 'rgb(' + base.map(v => v * k * 0.9 | 0) + ')');
          g.fillStyle = gr; g.beginPath(); g.roundRect ? g.roundRect(x, y, ww, hh, 7) : g.rect(x, y, ww, hh); g.fill();
          g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 4, y + hh - 4); g.lineTo(x + 4, y + 4); g.lineTo(x + ww - 4, y + 4); g.stroke();   // bevel light
          g.strokeStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.moveTo(x + ww - 3, y + 6); g.lineTo(x + ww - 3, y + hh - 3); g.lineTo(x + 6, y + hh - 3); g.stroke();       // bevel shade
          g.restore();
        }
      }
      speckle(g, w, h, 2600, ['rgba(255,255,255,.07)', 'rgba(0,0,0,.10)', 'rgba(0,0,0,.06)'], 1.8);
      for (let k = 0; k < 6; k++) { const x = m + Math.random() * (w - 2 * m), y = Math.random() * h, r = 14 + Math.random() * 26, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
      // Faint direction chevron worn into the stone.
      g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = 12;
      const chev = (dy, col) => { g.strokeStyle = col; g.beginPath(); g.moveTo(w * 0.38, h * 0.44 + dy); g.lineTo(w * 0.5, h * 0.57 + dy); g.lineTo(w * 0.62, h * 0.44 + dy); g.stroke(); };
      chev(3, 'rgba(0,0,0,.18)'); chev(0, good ? 'rgba(190,230,255,.38)' : 'rgba(255,200,190,.30)');
      // Night is baked in: the stone is darkened toward violet (the tiles are drawn unlit, MeshBasic, which is cheaper
      // than lighting the whole road), then the rails go on top at full brightness so they glow.
      g.globalCompositeOperation = 'multiply'; g.fillStyle = good ? '#8e96d0' : '#8c6884'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
      // Edge rails: dark channel, bright coloured light strip, white core.
      for (const x of [0, w - m]) {
        g.fillStyle = '#20242c'; g.fillRect(x, 0, m, h);
        if (!good) for (let y = -16; y < h; y += 32) { g.save(); g.beginPath(); g.rect(x, 0, m, h); g.clip(); g.fillStyle = '#ffc928'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + m, y - m); g.lineTo(x + m, y + 6 - m + 10); g.lineTo(x, y + 16); g.fill(); g.restore(); }
        const cx = x === 0 ? m - 6 : x + 6;
        g.fillStyle = rail; g.fillRect(cx - 4, 0, 8, h); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(cx - 1.2, 0, 2.4, h);
      }
    });
  }
  // Sidewalk: light square pavers with darker joints.
  const paverTex = () => tex(64, 64, (g, w, h) => {
    g.fillStyle = '#9d968a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const v = 205 + Math.random() * 25 | 0; g.fillStyle = 'rgb(' + v + ',' + (v - 6) + ',' + (v - 16) + ')'; g.fillRect(x * 32 + 1.5, y * 32 + 1.5, 29, 29); }
    speckle(g, w, h, 300, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.12)'], 1.5);
  }, 1, 1);
  const waterTex = () => tex(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,40,90,.12)'; g.lineWidth = 3;
    for (let y = 8; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.25, y - 6, w * 0.6, y + 6, w, y); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * w, Math.random() * h, 5, 1.5);
  }, 1, 1);
  const curbTex = () => tex(16, 64, (g) => { g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, 16, 64); g.fillStyle = '#d23a3a'; g.fillRect(0, 0, 16, 32); }, 1, 1);
  function grassTex(base) {
    return tex(256, 256, (g, w, h) => {
      const c = new T.Color(base);
      g.fillStyle = '#' + c.getHexString(); g.fillRect(0, 0, w, h);
      const d = c.clone().multiplyScalar(0.8), l = c.clone().lerp(new T.Color('#e8ff9a'), 0.25);
      speckle(g, w, h, 2600, ['#' + d.getHexString(), '#' + l.getHexString()], 3);
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1.6, 0, TAU); g.fill(); }
    }, 1, 1);
  }
  const brickTex = () => tex(256, 128, (g, w, h) => {
    g.fillStyle = '#6f6a66'; g.fillRect(0, 0, w, h);
    const bh = 16, bw = 40;
    for (let r = 0; r < h / bh; r++) for (let c = -1; c < w / bw + 1; c++) {
      const x = c * bw + (r % 2 ? bw / 2 : 0), v = 120 + Math.floor(Math.random() * 40);
      g.fillStyle = 'rgb(' + v + ',' + (v - 6) + ',' + (v - 12) + ')';
      g.fillRect(x + 1.5, r * bh + 1.5, bw - 3, bh - 3);
    }
    speckle(g, w, h, 600, ['rgba(0,0,0,.15)', 'rgba(255,255,255,.08)'], 2);
  }, 1, 1);
  function crateTex(kind) {
    return tex(128, 128, (g, w, h) => {
      const mil = kind === 'mortar' || kind === 'air';
      g.fillStyle = kind === 'air' ? '#51637a' : mil ? '#5b6b34' : '#b8814a'; g.fillRect(0, 0, w, h);
      if (!mil) { g.strokeStyle = 'rgba(80,45,15,.55)'; g.lineWidth = 2; for (let y = 0; y < h; y += 21) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }
      speckle(g, w, h, 400, ['rgba(0,0,0,.12)', 'rgba(255,255,255,.08)'], 2);
      g.strokeStyle = mil ? '#2f3a1c' : '#6e4520'; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, h - 12);
      if (!mil) { g.lineWidth = 9; g.beginPath(); g.moveTo(12, 12); g.lineTo(w - 12, h - 12); g.moveTo(w - 12, 12); g.lineTo(12, h - 12); g.stroke(); }
      else {
        g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath();
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 11 : 26; g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); }
        g.fill();
      }
    });
  }
  const glowTex = () => tex(32, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, h, 0, 0);
    grd.addColorStop(0, 'rgba(255,255,255,.95)'); grd.addColorStop(0.55, 'rgba(255,255,255,.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.25)'; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 2);
  });
  // Dusk sky: deep navy at the top, violet toward a glowing horizon, a sprinkle of stars (all baked, zero cost).
  const skyTex = () => tex(256, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#07061c'); grd.addColorStop(0.35, '#1a1248'); grd.addColorStop(0.62, '#3c1f72'); grd.addColorStop(0.82, '#7a3a9a'); grd.addColorStop(1, '#c56aa8');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const y = Math.pow(Math.random(), 1.6) * h * 0.7, a = 0.25 + Math.random() * 0.75 * (1 - y / (h * 0.7)); g.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')'; const r = Math.random() < 0.08 ? 1.6 : 0.8; g.fillRect(Math.random() * w, y, r, r); }
    // Faint cloud bands.
    for (let i = 0; i < 9; i++) { const y = h * (0.15 + Math.random() * 0.5), r = g.createRadialGradient(Math.random() * w, y, 0, w / 2, y, w * 0.7); r.addColorStop(0, 'rgba(140,90,200,.12)'); r.addColorStop(1, 'rgba(140,90,200,0)'); g.fillStyle = r; g.fillRect(0, y - 40, w, 80); }
  });
  // Neon frame glow for the gates: a bright rounded-rect outline that fades out on both sides.
  const frameGlowTex = () => tex(256, 128, (g, w, h) => {
    for (let k = 14; k >= 1; k--) { g.strokeStyle = 'rgba(255,255,255,' + (k === 1 ? 1 : 0.05 + 0.5 / k).toFixed(3) + ')'; g.lineWidth = k * 2.2; g.beginPath(); g.roundRect ? g.roundRect(26, 22, w - 52, h - 30, 10) : g.rect(26, 22, w - 52, h - 30); g.stroke(); }
  });
  // Soft round glow (lamps, light pools, engine glows).
  const softTex = () => tex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });

  // What each squad skin wears (the shop name/price live in game.js SKINS under the same key):
  // hat: helmet | beret | plume | spike | horns | crown; cape: cape colour; fx: trail particles; glow: emissive suit.
  const GEAR = {
    mavi: { color: '#3b82f6', hat: 'helmet' },
    yesil: { color: '#22c55e', hat: 'beret', beret: '#14532d' },
    mor: { color: '#a855f7', hat: 'plume', plume: '#f0abfc', fx: 'sparkle', fxc: ['#e9b8ff', '#ffffff'] },
    altin: { color: '#fbbf24', hat: 'horns', fx: 'sparkle', fxc: ['#ffd23f', '#fff3c0'] },
    turuncu: { color: '#f97316', hat: 'spike', cape: '#7a2a06', fx: 'fire', fxc: ['#ff6a10', '#ffb43a'] },
    pembe: { color: '#ec4899', hat: 'beret', beret: '#831843', fx: 'sparkle', fxc: ['#ff9ad0', '#ffffff'] },
    beyaz: { color: '#e2e8f0', hat: 'plume', plume: '#7dd3fc', cape: '#60a5fa', fx: 'ice', fxc: ['#bfeaff', '#ffffff'], glow: 0.1 },
    kral: { color: '#ffcf3f', hat: 'crown', cape: '#b91c1c', fx: 'sparkle', fxc: ['#ffd23f', '#ffffff'], glow: 0.12 },
  };
  window.Suru3D = {
    GEAR,
    init(canvas, opts) {
      if (!window.Fx3D) return null;
      let renderer;
      try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: !!(opts && opts.alpha), preserveDrawingBuffer: !!(opts && opts.alpha) }); } catch (e) { return null; }
      if (!renderer.getContext()) return null;
      let pixelRatio = Math.min(1.5, window.devicePixelRatio || 1);
      renderer.setPixelRatio(pixelRatio);
      renderer.shadowMap.enabled = false;
      if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;

      const scene = new T.Scene();
      scene.background = skyTex();
      // Night: violet haze in the distance, a cool moon key light and a blue-violet sky fill. The road reads by its
      // own neon (emissive rails, gates, lamps) rather than by extra lights.
      scene.fog = new T.Fog(0x2a1a52, 1100, 2700);
      const camera = new T.PerspectiveCamera(46, 1, 10, 3200);
      scene.add(new T.HemisphereLight(0x9aa6ff, 0x2a1838, 1.05));
      const sun = new T.DirectionalLight(0xd8dcff, 2.0);
      sun.position.set(-220, 420, 160); sun.target.position.set(0, 0, -200);
      scene.add(sun, sun.target);
      const muzzleLight = { position: new T.Vector3(), intensity: 0 }, boomLight = { position: new T.Vector3(), intensity: 0 };
      // Shared effect system (ortak/fx3d.js): sparks, muzzle flashes, rock chips, scorch marks, lightning — all pooled
      // and animated on the GPU. One "unit" here is about a soldier's hand.
      const fx = Fx3D.create(scene, { unit: 5, particles: 1400, rocks: 64, decals: 16, bolts: 12, budget: 420 });
      const seenB = new WeakSet(), rnd = (a, b) => a + Math.random() * (b - a);
      let prevBullets = [], skyBoltT = 1.5, lowFx = false;

      const dummy = new T.Object3D(), col = new T.Color(), v3 = new T.Vector3();
      // Explosion flashes: a burst of warm light on top of the fireball.
      const flashTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        r.addColorStop(0, 'rgba(255,210,140,.6)'); r.addColorStop(0.25, 'rgba(255,150,50,.4)'); r.addColorStop(1, 'rgba(255,120,20,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(cv); })();
      const booms = [];
      function boomFlash(x, y, z, size, life) {
        let q = booms.find(f => f.life <= 0);
        if (!q) { if (booms.length >= 20) return; q = { s: new T.Sprite(new T.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending })), life: 0 }; scene.add(q.s); booms.push(q); }
        q.s.position.set(x, y, z); q.s.visible = true; q.life = q.max = life; q.size = size;
      }
      const raycaster = new T.Raycaster(), ground = new T.Plane(new T.Vector3(0, 1, 0), 0), hitPt = new T.Vector3();
      const camBase = new T.Vector3(), camTarget = new T.Vector3();
      let W = 1, H = 1, level = null, camX = 0;
      const perf = { acc: 0, n: 0 };
      let warmed = false;

      const std = (color, extra) => {
        const o = Object.assign({ color }, extra || {});
        delete o.roughness; delete o.metalness;
        return new T.MeshLambertMaterial(o);
      };
      const lam = (color, extra) => new T.MeshLambertMaterial(Object.assign({ color }, extra || {}));
      const additive = color => new T.MeshBasicMaterial({ color, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
      function add(parent, geo, mat, x, y, z, shadow) {
        const m = new T.Mesh(geo, mat); m.position.set(x, y, z);
        m.castShadow = shadow !== false; m.receiveShadow = true; parent.add(m); return m;
      }
      function inst(geo, mat, max, colored, shadow, outline) {
        const m = new T.InstancedMesh(geo, mat, max);
        m.count = 0; m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false;
        if (colored) m.setColorAt(0, new T.Color(1, 1, 1));
        m.castShadow = !!shadow; m.receiveShadow = false;
        // Ink outline: the same instances (shared matrix buffer) drawn as pushed-out back faces.
        if (outline) { const o = new T.InstancedMesh(geo, inkMat(outline), max); o.instanceMatrix = m.instanceMatrix; o.count = 0; o.frustumCulled = false; scene.add(o); m.userData.ol = o; }
        scene.add(m); return m;
      }
      const inks = {};
      function inkMat(w) {
        if (inks[w]) return inks[w];
        const m = new T.MeshBasicMaterial({ color: 0x1a1020, side: T.BackSide });
        m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normal * ' + w.toFixed(2) + ';'); };
        m.customProgramCacheKey = () => 'ink' + w; return (inks[w] = m);
      }
      // Three-step cel ramp shared by the soldiers (same look as Arrow Legends).
      const ramp = (() => { const t = new T.DataTexture(new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1); t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true; return t; })();
      const toon = (color, extra) => new T.MeshToonMaterial(Object.assign({ color, gradientMap: ramp }, extra || {}));
      function put(m, n, x, y, z, sx, sy, sz, rx, ry, rz, c) {
        dummy.position.set(x, y, z); dummy.rotation.set(rx || 0, ry || 0, rz || 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
        m.setMatrixAt(n, dummy.matrix);
        if (c && m.instanceColor) m.setColorAt(n, c);
      }
      function done(m, n) { if (!m) return; m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; if (m.userData.ol) m.userData.ol.count = n; }
      const C_ = s => new T.Color(s), WHITE = new T.Color('#ffffff');

      const blobTex = tex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 31); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(0.6, 'rgba(0,0,0,.3)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
      const blobs = inst(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }), 520, false, false);
      blobs.renderOrder = 1;
      let nBlob = 0;
      const blob = (x, z, w, d) => { if (nBlob < 520) put(blobs, nBlob++, x, 0.9, z, w, 1, d || w); };

      // ---------- Road (level independent) ----------
      const ROAD_LEN = NEAR_Y - FAR_Y, roadZ = (NEAR_Y + FAR_Y) / 2 - CZ;
      const asphalt = asphaltTex(); asphalt.repeat.set(3, ROAD_LEN / 120);
      const road = add(scene, new T.BoxGeometry(352, 4, ROAD_LEN), std('#e8eef7'), 0, -2, roadZ, false);
      const deck = add(scene, new T.BoxGeometry(372, 26, ROAD_LEN), std('#3a3448'), 0, -17, roadZ, false); // stone embankment under the road
      const curb = curbTex(); curb.repeat.set(1, ROAD_LEN / 40);
      for (const sx of [-1, 1]) add(scene, new T.BoxGeometry(10, 6, ROAD_LEN), std('#ffffff', { map: curb }), sx * 181, 1, roadZ);
      const walkMat = std('#8e8cab', { map: paverTex() }); walkMat.map.repeat.set(2, ROAD_LEN / 17); walkMat.map.shared = true;
      for (const sx of [-1, 1]) add(scene, new T.BoxGeometry(34, 3, ROAD_LEN), walkMat, sx * 203, 0.5, roadZ, false);
      // Water all around (theme sea colour), grassy banks along the road for the trees and lamps.
      const waterMap = waterTex(); waterMap.repeat.set(30, 30);
      const waterMat = std('#3aa0e8', { map: waterMap });
      const water = add(scene, new T.PlaneGeometry(4200, 4200), waterMat, 0, -24, -900, false); water.rotation.x = -Math.PI / 2;
      const grassMat = std('#6fbf57', { roughness: 1 });
      for (const sx of [-1, 1]) {
        add(scene, new T.BoxGeometry(250, 26, ROAD_LEN + 600), grassMat, sx * 345, -12, roadZ - 300, false);
        add(scene, new T.BoxGeometry(14, 22, ROAD_LEN + 600), std('#f1dfae'), sx * 476, -15, roadZ - 300, false);
      }
      // Clouds far away.
      const cloudMat = new T.MeshLambertMaterial({ color: '#4a3a7a', emissive: '#7a4ab0', emissiveIntensity: 0.4, flatShading: true });
      for (let i = 0; i < 9; i++) {
        const cl = new T.Group(); cl.position.set((i - 4) * 420 + (i * 97) % 160, 420 + (i * 53) % 180, -2300 - (i % 3) * 200);
        for (let k = 0; k < 4; k++) { const b = new T.Mesh(new T.IcosahedronGeometry(60 + k * 12, 1), cloudMat); b.position.set(k * 70 - 100, (k % 2) * 25, 0); b.scale.y = 0.6; cl.add(b); }
        scene.add(cl);
      }
      // Lane tiles and separators.
      const tileGeo = new T.PlaneGeometry(1, TILE); tileGeo.rotateX(-Math.PI / 2);
      const tilesR = inst(tileGeo, new T.MeshBasicMaterial({ map: laneTile('r') }), 160, false, false);
      const tilesE = inst(tileGeo, new T.MeshBasicMaterial({ map: laneTile('e') }), 160, false, false);
      tilesR.receiveShadow = tilesE.receiveShadow = true;
      const seps = inst(new T.BoxGeometry(1, 1, 1), lam('#ffffff'), 200, true, true);
      const sepCols = [C_('#f4f1ea'), C_('#e23b3b')];
      // Distant hills.
      const hillMat = new T.MeshLambertMaterial({ color: '#5d9d58', flatShading: true });
      const peakMat = new T.MeshLambertMaterial({ color: '#3c3a72', flatShading: true }), snowMat = new T.MeshLambertMaterial({ color: '#c9c6f2', emissive: '#5a4a9a', emissiveIntensity: 0.35, flatShading: true });
      for (let i = 0; i < 12; i++) {
        const h = add(scene, new T.ConeGeometry(220 + (i * 53) % 140, 200 + (i * 71) % 160, 7), hillMat, (i - 5.5) * 280 + ((i * 37) % 90), 70, -2150 - (i % 3) * 120, false);
        h.rotation.y = i;
      }
      // A far range of snowy peaks (bluish with distance) gives the horizon depth.
      for (let i = 0; i < 9; i++) {
        const r = 300 + (i * 97) % 200, hh = 520 + (i * 131) % 380, x = (i - 4) * 420 + ((i * 61) % 140), z = -2650 - (i % 2) * 160;
        const m = add(scene, new T.ConeGeometry(r, hh, 6), peakMat, x, hh / 2 - 40, z, false); m.rotation.y = i * 1.7;
        const cap = add(scene, new T.ConeGeometry(r * 0.36, hh * 0.36, 6), snowMat, x, hh - 40 - hh * 0.18 + 1, z, false); cap.rotation.y = i * 1.7;
      }

      // ---------- Roadside scenery (instanced, recycled by road position) ----------
      const DECO_P = NEAR_Y - FAR_Y + 200;
      const trunks = inst(new T.CylinderGeometry(2.2, 3.2, 18, 6), lam('#7a4a26'), 110, false, true);
      const crownGeo = new T.IcosahedronGeometry(1, 1);
      const crowns = inst(crownGeo, new T.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), 120, true, true);
      const rocks = inst(new T.DodecahedronGeometry(1, 0), new T.MeshLambertMaterial({ color: '#9a9aa2', flatShading: true }), 30, false, true);
      const poles = inst(new T.CylinderGeometry(1.1, 1.4, 44, 6), std('#39414d', { metalness: 0.6, roughness: 0.4 }), 24, false, true);
      const lampHeads = inst(new T.BoxGeometry(12, 2.4, 5), std('#2c333d', { emissive: '#ffe6a8', emissiveIntensity: 1.6 }), 24, false, false);
      // Lamp light without lights: a warm halo facing the camera and a pool of light on the pavement (additive).
      const soft = softTex(); soft.shared = true;
      const lampGlow = inst(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: soft, color: '#ffc870', transparent: true, depthWrite: false, blending: T.AdditiveBlending }), 24, false, false);
      const lampPool = inst(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: soft, color: '#c08a44', transparent: true, depthWrite: false, blending: T.AdditiveBlending }), 24, false, false);
      lampGlow.renderOrder = lampPool.renderOrder = 4;
      const pines = inst(new T.ConeGeometry(1, 1, 7), new T.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), 120, true, true);
      const bushes = inst(new T.IcosahedronGeometry(1, 1), new T.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), 120, true, false);
      const flagGeo = new T.PlaneGeometry(1, 1, 6, 1).translate(0.5, 0, 0);
      const flags = inst(flagGeo, new T.MeshLambertMaterial({ color: '#ffffff', side: T.DoubleSide, emissive: '#222222' }), 24, true, false);
      const flagPoles = inst(new T.CylinderGeometry(0.8, 0.8, 1, 5), std('#d9dde3'), 24, false, false);
      const FLAG_C = [C_('#2f8cff'), C_('#ff3b3b')];
      const decos = [];
      for (let i = 0; i < 56; i++) {
        const side = i % 2 ? 1 : -1, r = (i * 7919) % 1000 / 1000;
        decos.push({ kind: i % 7 === 3 ? 'rock' : 'tree', x: side * (236 + r * 170), s: i * DECO_P / 56 + r * 20, sz: 0.75 + r * 0.6,
          c: C_(['#3f9e4a', '#2f8a43', '#5bb04d', '#6aa83a', '#2c7d52'][i % 5]), rot: r * TAU });
      }
      for (let i = 0; i < 24; i++) decos.push({ kind: 'lamp', x: (i % 2 ? 1 : -1) * 196, s: Math.floor(i / 2) * DECO_P / 12, sz: 1 });
      for (let i = 0; i < 40; i++) { const side = i % 2 ? 1 : -1, r = (i * 4271) % 1000 / 1000;
        decos.push({ kind: 'pine', x: side * (250 + r * 190), s: i * DECO_P / 40 + 37 + r * 30, sz: 0.8 + r * 0.7, c: C_(['#2f6e3e', '#285f3a', '#3a7d45', '#24563a'][i % 4]) }); }
      for (let i = 0; i < 60; i++) { const side = i % 2 ? 1 : -1, r = (i * 6563) % 1000 / 1000;
        decos.push({ kind: 'bush', x: side * (226 + r * 26), s: i * DECO_P / 60 + 11, sz: 0.7 + r * 0.6, c: C_(['#4fa04a', '#62b34f', '#3f8f45', '#7cbf52'][i % 4]), rot: r * TAU }); }
      for (let i = 0; i < 24; i++) decos.push({ kind: 'flag', x: (i % 2 ? 1 : -1) * 214, s: Math.floor(i / 2) * DECO_P / 12 + DECO_P / 24, sz: 1, side: i % 2 });
      // Moonlit foliage: shift the greens toward blue-teal (the scene reads as night, the gates and soldiers pop).
      const NIGHT = C_('#1c2a66'); decos.forEach(d => { if (d.c) d.c.lerp(NIGHT, 0.3); });

      // ---------- Soldiers ----------
      function crowd(max, o) {
        // Arms hang from the shoulder (geometry shifted down) so they can swing; legs likewise from the hip.
        const limb = (r, l) => new T.CapsuleGeometry(r, l, 2, 6).translate(0, -l / 2 - r * 0.4, 0);
        return {
          legL: inst(limb(1.35, 4), toon(o.leg), max, false, true, 0.45),
          legR: inst(limb(1.35, 4), toon(o.leg), max, false, true, 0.45),
          armL: inst(limb(1.05, 3.6), toon('#ffffff'), max, true, true, 0.4),
          armR: inst(limb(1.05, 3.6), toon('#ffffff'), max, true, true, 0.4),
          torso: inst(new T.CapsuleGeometry(3, 4.4, 3, 10), toon('#ffffff'), max, true, true, 0.5),
          belt: inst(new T.CylinderGeometry(3.15, 3.15, 1.1, 12), toon('#2a2018'), max, false, false),
          head: inst(new T.SphereGeometry(2.7, 12, 10), toon(o.skin), max, false, true, 0.45),
          eyes: inst(new T.BoxGeometry(2.6, 0.7, 0.5), new T.MeshBasicMaterial({ color: '#1a1020' }), max, false, false),
          helmet: inst(new T.SphereGeometry(3.15, 12, 8, 0, TAU, 0, Math.PI / 2), toon('#ffffff'), max, true, true, 0.45),
          pack: o.pack ? inst(new T.BoxGeometry(4.6, 5, 2.4), toon(o.pack), max, false, true, 0.4) : null,
          spike: o.spike ? inst(new T.ConeGeometry(1.2, 3.4, 6), toon(o.spike), max, false, true) : null,
          club: o.club ? inst(new T.BoxGeometry(1.8, 1.8, 11), toon('#6b4423'), 40, false, true, 0.5) : null,
        };
      }
      const squad = crowd(MAX_S, { leg: '#2b3140', skin: '#f1c38f', pack: '#56643a' });
      // Skin gear on the squad (one set of instanced parts, shown per the equipped skin).
      const goldM = toon('#ffc928', { emissive: '#6a4200' });
      const hatGeo = {
        beret: new T.CylinderGeometry(3.4, 3.2, 1.2, 14).translate(0.6, 0, 0),
        plume: new T.SphereGeometry(1.2, 10, 8).scale(0.8, 3, 1.4),
        spike: new T.ConeGeometry(0.9, 3.6, 8),
        horn: new T.ConeGeometry(0.75, 3.8, 8).translate(0, 1.9, 0),
        crown: new T.CylinderGeometry(3.1, 2.8, 2.2, 10, 1, true),
        crownTip: new T.ConeGeometry(0.55, 1.6, 4),
        cape: new T.BoxGeometry(6.4, 10, 0.5).translate(0, -5, 0),
      };
      const gear = {
        beret: inst(hatGeo.beret, toon('#ffffff'), MAX_SG, true, false, 0.35),
        plume: inst(hatGeo.plume, toon('#ffffff'), MAX_SG, true, false, 0.3),
        spike: inst(hatGeo.spike, toon('#c9ced6', { emissive: '#222' }), MAX_SG, false, false, 0.3),
        horn: inst(hatGeo.horn, toon('#f3ead2'), MAX_SG * 2, false, false, 0.3),
        crown: inst(hatGeo.crown, goldM, MAX_SG, false, false, 0.3),
        crownTip: inst(hatGeo.crownTip, goldM, MAX_SG * 5, false, false),
        cape: inst(hatGeo.cape, toon('#ffffff', { side: T.DoubleSide }), MAX_SG, true, false, 0.3),
      };
      // The extra marchers: same parts and materials as the squad, minus outline, belt, eyes and pack (they stand
      // inside and behind the formation, where those never show), so the denser crowd costs a few cheap draw calls.
      const liteOf = (m, geo) => inst(geo, m.material, MAX_F, !!m.instanceColor, false);
      const liteLimb = (r, l) => new T.CapsuleGeometry(r, l, 1, 4).translate(0, -l / 2 - r * 0.4, 0);
      const lite = { legL: liteOf(squad.legL, liteLimb(1.35, 4)), legR: liteOf(squad.legR, liteLimb(1.35, 4)), armL: liteOf(squad.armL, liteLimb(1.05, 3.6)), armR: liteOf(squad.armR, liteLimb(1.05, 3.6)),
        torso: liteOf(squad.torso, new T.CapsuleGeometry(3, 4.4, 2, 7)), head: liteOf(squad.head, new T.SphereGeometry(2.7, 8, 6)), helmet: liteOf(squad.helmet, new T.SphereGeometry(3.15, 8, 5, 0, TAU, 0, Math.PI / 2)) };
      // Filler spots: the gaps of the formation grid (a hex-packed crowd), then extra back rows past 60 soldiers.
      const fillCache = { n: -1, pts: [] };
      function fillersFor(n, form) {
        if (fillCache.n === n) return fillCache.pts;
        const pts = [], cols = Math.min(6, n), rows = Math.ceil(form.length / cols);
        if (n >= 8) {
          for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) if ((r + 1) * cols + c + 1 < form.length) pts.push({ x: (c - (cols - 1) / 2) * 14 + 7, y: r * 12.5 + 6.2 });
          const extra = Math.min(MAX_F - pts.length, 44, Math.round(Math.max(0, n - 60) * 0.8));
          for (let k = 0; k < extra; k++) { const c = k % 11, r = Math.floor(k / 11); pts.push({ x: (c - 5) * 7 + (r % 2) * 3.5, y: rows * 12.5 + r * 9 }); }
        }
        pts.forEach((p, i) => { p.x += Math.sin(i * 12.9898) * 1.6; p.y += Math.cos(i * 7.233) * 1.4; });
        fillCache.n = n; fillCache.pts = pts.slice(0, MAX_F); return fillCache.pts;
      }
      gear.crown.material.side = T.DoubleSide;
      const foes = crowd(MAX_E, { leg: '#3a1418', skin: '#d8a27a', spike: '#c9c9c9', club: true });
      const foeShield = inst(new T.BoxGeometry(11, 13, 1.6), std('#9aa3b0', { emissive: '#1a1f28' }), 80, false, false);
      const foeRifle = inst(new T.BoxGeometry(1.4, 1.8, 14), std('#1c1f24'), 80, false, false);
      const foeBomb = inst(new T.SphereGeometry(3.4, 12, 10), new T.MeshBasicMaterial({ color: '#ffffff' }), 80, true, false);
      const mineBody = inst(new T.CylinderGeometry(9, 10, 4, 16), std('#3a3f36'), 60, false, false);
      const mineLight = inst(new T.SphereGeometry(2.4, 10, 8), new T.MeshBasicMaterial({ color: '#ff2a2a' }), 60, false, false);
      // Glowing streaks for every bullet: two crossed quads (visible from any angle) spanning z in [-1, 0], so the
      // bright head sits on the bullet and the tail fades out behind it. Colour glow + white-hot core.
      const streakTex = tex(32, 128, (g, w, h) => {
        for (let y = 0; y < h; y++) { const v = 1 - y / h, a = Math.pow(v, 1.6); const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,' + a.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, y, w, 1); }
      });
      const crossGeo = (() => {
        const a = new T.PlaneGeometry(1, 1).rotateX(Math.PI / 2).translate(0, 0, -0.5), b = new T.PlaneGeometry(1, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 0, -0.5);
        const g = new T.BufferGeometry(), pa = a.attributes.position.array, pb = b.attributes.position.array, ua = a.attributes.uv.array, ub = b.attributes.uv.array;
        g.setAttribute('position', new T.BufferAttribute(Float32Array.from([...pa, ...pb]), 3));
        g.setAttribute('uv', new T.BufferAttribute(Float32Array.from([...ua, ...ub]), 2));
        g.setIndex([...a.index.array, ...Array.from(b.index.array, i => i + 4)]); return g;
      })();
      const streakMat = c => new T.MeshBasicMaterial({ map: streakTex, color: c, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
      const eShots = inst(crossGeo, streakMat('#ff3030'), 300, false, false), eCore = inst(crossGeo, streakMat('#ffd0c0'), 300, false, false);
      eShots.renderOrder = eCore.renderOrder = 4;
      const gunBox = inst(new T.BoxGeometry(1, 1, 1), std('#2b2d33', { metalness: 0.5, roughness: 0.45 }), MAX_SG, false, true);
      const tubeGeo = new T.CylinderGeometry(1, 1, 1, 10); tubeGeo.rotateX(Math.PI / 2);
      const gunTube = inst(tubeGeo, std('#4d5a2a', { metalness: 0.3, roughness: 0.5 }), MAX_SG, false, true);
      // Per weapon: [kind, width, height, length, color, emissive]
      const GUNS = [
        ['box', 1.3, 1.9, 5, '#2b2d33'], ['box', 1.2, 1.7, 12, '#4a3a28'], ['box', 1.9, 2.3, 13, '#1f2328'],
        ['box', 1.6, 1.7, 10, '#6b4423'], ['tube', 2, 2, 14, '#4d5a2a'], ['tube', 1.5, 1.5, 13, '#e6edff', '#39e0ff'],
      ];

      // ---------- Projectiles & effects ----------
      const tracers = inst(crossGeo, streakMat('#ffffff'), MAX_B, false, false), tracerCore = inst(crossGeo, streakMat('#ffffff'), MAX_B, false, false);
      tracers.renderOrder = tracerCore.renderOrder = 4;
      const rockets = inst(tubeGeo, std('#dfe3e8', { metalness: 0.4, roughness: 0.4 }), 200, false, true);
      const shells = inst(new T.SphereGeometry(1, 10, 8), std('#2a2c30', { metalness: 0.6, roughness: 0.35 }), 60, false, true);
      const bombs = inst(new T.CapsuleGeometry(2.6, 6, 3, 8), std('#3a4030', { metalness: 0.5, roughness: 0.4 }), 60, false, true);
      const markers = inst(new T.RingGeometry(0.75, 1, 28).rotateX(-Math.PI / 2), additive('#ffffff'), 60, true, false);
      const MK_OWN = C_('#ffd23f'), MK_FOE = C_('#ff2a2a');
      // Attack telegraphs: filled discs (additive, so overlapping zones get brighter) and their rims.
      const zones = inst(new T.CircleGeometry(1, 36).rotateX(-Math.PI / 2), additive('#ffffff'), 40, true, false);
      const zoneRims = inst(new T.RingGeometry(0.9, 1, 44).rotateX(-Math.PI / 2), additive('#ffffff'), 40, true, false);
      zones.renderOrder = zoneRims.renderOrder = 2;
      const ZONE_FOE = C_('#ff2a2a').multiplyScalar(0.45), ZONE_OWN = C_('#ffd23f').multiplyScalar(0.35);
      const ringFx = []; let camKick = 0; const SCROLL_V = 70;
      const fire = inst(new T.IcosahedronGeometry(1, 2), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false }), MAX_FX, true, false);
      const rings = inst(new T.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: T.AdditiveBlending, depthWrite: false }), 60, true, false);
      const smoke = inst(new T.IcosahedronGeometry(1, 2), new T.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }), MAX_FX, true, false);
      const puffs = [];   // renderer-side smoke {x,y,z,vx,vy,vz,life,max,size,c}
      const seenFx = new WeakSet();
      const puff = (x, y, z, size, life, c, vy) => { if (puffs.length < MAX_FX) puffs.push({ x, y, z, vx: (Math.random() - 0.5) * 14, vy: vy == null ? 18 + Math.random() * 16 : vy, vz: (Math.random() - 0.5) * 14, life, max: life, size, c: c || C_('#8e8e8e') }); };
      const BOMB_A = C_('#ff3b1a'), BOMB_B = C_('#ffd23f');
      const SMOKE_L = C_('#b8b2aa'), SMOKE_S = C_('#9a948c'), SMOKE_M = C_('#c4beb6');
      const FIRE_A = C_('#d8923a'), FIRE_B = C_('#c8440c'), FIRE_C = C_('#3a1004'), tmpC = new T.Color();

      // ---------- Mortar teams and bombers (pooled) ----------
      const mortars = [];
      for (let i = 0; i < 3; i++) {
        const g = new T.Group(), dark = std('#2f3538', { metalness: 0.6, roughness: 0.4 });
        add(g, new T.CylinderGeometry(7, 8, 1.6, 12), dark, 0, 0.8, 0);
        const tube = new T.Group(); tube.position.set(0, 2, 0); tube.rotation.x = -0.75; g.add(tube);
        add(tube, new T.CylinderGeometry(2.2, 2.6, 22, 12), std('#3e4a2c', { metalness: 0.5, roughness: 0.45 }), 0, 11, 0);
        add(tube, new T.TorusGeometry(2.4, 0.6, 6, 12), dark, 0, 22, 0).rotation.x = Math.PI / 2;
        for (const sx of [-1, 1]) { const leg = add(g, new T.CylinderGeometry(0.6, 0.6, 14, 5), dark, sx * 4, 6, -6); leg.rotation.set(0.5, 0, sx * 0.3); }
        // Crew member kneeling behind the tube.
        const crew = new T.Group(); crew.position.set(7, 0, 8); g.add(crew);
        crew.userData.body = add(crew, new T.CapsuleGeometry(3, 3.4, 3, 8), lam('#3b82f6'), 0, 7, 0);
        add(crew, new T.SphereGeometry(2.6, 10, 8), lam('#f1c38f'), 0, 13, 0);
        add(crew, new T.SphereGeometry(3, 10, 6, 0, TAU, 0, Math.PI / 2), lam('#3d4a2a'), 0, 13.6, 0);
        add(crew, new T.BoxGeometry(6, 3, 6), lam('#2b3140'), 0, 1.6, 0);
        g.visible = false; g.scale.setScalar(1.25); scene.add(g);
        mortars.push({ g, tube, crew });
      }
      const planes = [];
      for (let i = 0; i < 3; i++) {
        const g = new T.Group(), body = std('#5f6f4c', { metalness: 0.35, roughness: 0.5 }), belly = std('#a9b3a0', { roughness: 0.6 }), dark = std('#22262b');
        const fus = add(g, new T.CapsuleGeometry(7, 52, 4, 14), body, 0, 0, 0); fus.rotation.x = Math.PI / 2;
        add(g, new T.BoxGeometry(128, 2.6, 22), body, 0, -1, -4);
        add(g, new T.BoxGeometry(44, 2, 12), body, 0, 1, 30);
        add(g, new T.BoxGeometry(2, 18, 14), body, 0, 9, 31);
        const glass = add(g, new T.SphereGeometry(5.5, 14, 10), std('#9fd8ff', { metalness: 0.9, roughness: 0.1, emissive: '#1a4a6a' }), 0, 4, -22); glass.scale.set(1, 0.8, 1.6);
        const props = [];
        for (const sx of [-1, 1]) {
          const eng = add(g, new T.CylinderGeometry(4.2, 4.8, 18, 12), belly, sx * 28, -3, -8); eng.rotation.x = Math.PI / 2;
          const p = new T.Group(); p.position.set(sx * 28, -3, -18); g.add(p);
          add(p, new T.BoxGeometry(22, 1.6, 0.8), dark, 0, 0, 0); add(p, new T.BoxGeometry(1.6, 22, 0.8), dark, 0, 0, 0);
          props.push(p);
          // Wing roundels.
          const rd = add(g, new T.CylinderGeometry(6, 6, 0.4, 16), std('#e23b3b', { emissive: '#400' }), sx * 46, 0.6, -4, false);
          add(g, new T.CylinderGeometry(3, 3, 0.5, 16), std('#ffffff'), sx * 46, 0.7, -4, false);
          rd.castShadow = false;
        }
        g.visible = false; g.scale.setScalar(1.15); scene.add(g);
        planes.push({ g, props });
      }

      function disposeLevel() {
        if (!level) return;
        scene.remove(level.root);
        level.root.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach(m => { if (m.map && !m.map.shared) m.map.dispose(); /* no m.dispose(): keeps shaders compiled */ }); });
        level = null;
      }

      // ---------- Fortress ----------
      function makeCastle(root) {
        const g = new T.Group(), bricks = brickTex(), wallMat = std('#ffffff', { map: bricks, roughness: 0.9 });
        const darkStone = std('#4a4642', { roughness: 0.9 }), roof = std('#9e1f2a', { roughness: 0.6 }), wood = std('#5b3a1e');
        const wall = add(g, new T.BoxGeometry(140, 62, 44), wallMat, 0, 31, 0);
        bricks.repeat.set(2, 1);
        for (let k = -6; k <= 6; k += 2) add(g, new T.BoxGeometry(9, 10, 46), wallMat, k * 10, 67, 0);
        const towers = [], tips = [], braziers = [];
        for (const sx of [-1, 1]) {
          const tw = add(g, new T.CylinderGeometry(22, 25, 96, 18), wallMat, sx * 74, 48, 4);
          for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; add(g, new T.BoxGeometry(8, 9, 8), wallMat, sx * 74 + Math.cos(a) * 21, 100, 4 + Math.sin(a) * 21); }
          add(g, new T.ConeGeometry(27, 40, 18), roof, sx * 74, 124, 4);
          const pole = add(g, new T.CylinderGeometry(0.8, 0.8, 22, 5), darkStone, sx * 74, 154, 4);
          const flag = add(g, new T.PlaneGeometry(20, 12), std('#e23b3b', { side: T.DoubleSide, emissive: '#300' }), sx * 74 + 10, 158, 4, false);
          towers.push({ tw, flag, pole });
          for (const y of [40, 70]) { add(g, new T.BoxGeometry(5, 10, 2), std('#1d1410', { emissive: '#ffa040', emissiveIntensity: 1.4 }), sx * 74, y, 29); glowSprite(g, '#ff9a3c', 18, sx * 74, y, 31); }
        }
        // Gate with arch, door and portcullis.
        add(g, new T.BoxGeometry(40, 44, 6), darkStone, 0, 22, 21);
        add(g, new T.CylinderGeometry(20, 20, 6, 20, 1, false, 0, Math.PI), darkStone, 0, 44, 21).rotation.set(Math.PI / 2, 0, Math.PI / 2);
        add(g, new T.BoxGeometry(30, 40, 3), wood, 0, 20, 23);
        for (let k = -2; k <= 2; k++) add(g, new T.BoxGeometry(1.4, 40, 1.4), std('#2a2a2a', { metalness: 0.8 }), k * 6, 20, 25.5, false);
        // Banners and wall cannons.
        for (const sx of [-1, 1]) {
          add(g, new T.PlaneGeometry(14, 30), std('#b91c2c', { side: T.DoubleSide }), sx * 38, 44, 22.4, false);
          add(g, new T.CircleGeometry(4.5, 16), std('#ffd23f', { emissive: '#553300' }), sx * 38, 48, 22.6, false);
          const cn = add(g, new T.CylinderGeometry(3, 4, 22, 12), std('#25282c', { metalness: 0.7, roughness: 0.35 }), sx * 30, 72, 16);
          cn.rotation.x = Math.PI / 2 - 0.25;
          add(g, new T.BoxGeometry(10, 6, 12), wood, sx * 30, 67, 10);
          const tip = new T.Object3D(); tip.position.set(sx * 30, 75, 28); g.add(tip); tips.push(tip);
          // Fire braziers by the gate.
          add(g, new T.CylinderGeometry(4, 2.5, 6, 8), darkStone, sx * 26, 3, 26);
          braziers.push(glowSprite(g, '#ff8a2a', 30, sx * 26, 10, 27));
        }
        g.visible = false; root.add(g);
        return { g, wallMat, towers, tips, braziers, smokeT: 0 };
      }

      // ---------- V2 bosses: armoured giant, siege tank, fire drake ----------
      // Cel-shaded (same ramp as the soldiers) with an ink outline on the big parts so they read from the low camera.
      function inked(parent, geo, mat, x, y, z, w) {
        const m = add(parent, geo, mat, x, y, z, false);
        const o = new T.Mesh(geo, inkMat(w || 0.9)); o.position.copy(m.position); parent.add(o); m.userData.ink = o;
        return m;
      }
      const syncInk = m => { const o = m.userData.ink; if (o) { o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.copy(m.scale); } return m; };
      const glowBasic = c => new T.MeshBasicMaterial({ color: c });

      // Armoured giant: steel plate over red skin, a glowing furnace core in the chest, a visor slit that burns orange,
      // spiked pauldrons and a rune hammer. Legs and the hammer arm animate (walk, wind-up, smash).
      function makeDev(root) {
        const g = new T.Group(), plate = toon('#8f98ab', { emissive: '#000000' }), dark = toon('#3a3f4e'), skin = toon('#8a2a2a'), trim = toon('#d9a640', { emissive: '#3a2400' });
        const hot = glowBasic('#ffb04a');
        const legs = [];
        for (const sx of [-1, 1]) {
          const leg = new T.Group(); leg.position.set(sx * 11, 34, 0); g.add(leg); legs.push(leg);
          inked(leg, new T.CapsuleGeometry(6.5, 12, 4, 10), skin, 0, -9, 0, 0.8);
          inked(leg, new T.SphereGeometry(6.5, 12, 8), plate, 0, -18, 3, 0.7);                     // knee plate
          inked(leg, new T.BoxGeometry(12, 14, 13), plate, 0, -26, 0.5, 0.8);                       // greave
          inked(leg, new T.BoxGeometry(14, 6, 18), dark, 0, -32, 3, 0.8);                           // boot
        }
        inked(g, new T.BoxGeometry(34, 12, 22), dark, 0, 38, 0, 0.9);                               // pelvis
        add(g, new T.BoxGeometry(36, 4, 23), trim, 0, 42, 0, false);                                // belt
        const body = inked(g, new T.CylinderGeometry(22, 16, 34, 10), plate, 0, 60, 0, 1);           // chest armour
        add(g, new T.CylinderGeometry(23, 23, 3, 10), trim, 0, 74, 0, false);
        // Furnace core: a hot disc with a pulsing glow (no light: an additive sprite).
        add(g, new T.CylinderGeometry(6, 6, 2, 14), hot, 0, 62, 18.5, false).rotation.x = Math.PI / 2;
        const core = glowSprite(g, '#ff7a1a', 38, 0, 62, 21);
        for (const sx of [-1, 1]) {
          inked(g, new T.SphereGeometry(12, 12, 8, 0, TAU, 0, Math.PI / 2), plate, sx * 25, 74, 0, 0.8);  // pauldron
          for (let k = -1; k <= 1; k++) { const sp = add(g, new T.ConeGeometry(2.4, 10, 6), trim, sx * (25 + k * 4), 84, k * 5, false); sp.rotation.z = -sx * 0.35; }
        }
        // Helmet: dome + jaw guard, burning visor slit, curled horns.
        inked(g, new T.SphereGeometry(11, 14, 10), plate, 0, 88, 2, 0.8);
        inked(g, new T.BoxGeometry(17, 9, 14), dark, 0, 81, 5, 0.6);
        add(g, new T.BoxGeometry(14, 2.4, 1), hot, 0, 88, 12.8, false);
        const eyes = [glowSprite(g, '#ffb020', 18, -4, 88, 14), glowSprite(g, '#ffb020', 18, 4, 88, 14)];
        for (const sx of [-1, 1]) { const h = inked(g, new T.ConeGeometry(3.2, 16, 8), toon('#efe6cf'), sx * 11, 96, 2, 0.4); h.rotation.z = -sx * 0.9; syncInk(h); }
        // Left arm: a heavy gauntlet. Right arm: the rune hammer (pivots at the shoulder).
        const armL = new T.Group(); armL.position.set(-26, 70, 0); g.add(armL);
        inked(armL, new T.CapsuleGeometry(5, 16, 4, 8), skin, 0, -12, 0, 0.6);
        inked(armL, new T.BoxGeometry(12, 12, 12), plate, 0, -26, 0, 0.6);
        const arm = new T.Group(); arm.position.set(26, 70, 0); g.add(arm);
        inked(arm, new T.CapsuleGeometry(5, 16, 4, 8), skin, 0, -12, 0, 0.6);
        inked(arm, new T.BoxGeometry(12, 12, 12), plate, 0, -24, 0, 0.6);
        const handle = add(arm, new T.CylinderGeometry(2, 2, 44, 8), toon('#5a3a22'), 0, -26, 16, false); handle.rotation.x = Math.PI / 2;
        const head = inked(arm, new T.BoxGeometry(22, 16, 16), dark, 0, -26, 38, 0.8);
        for (const sx of [-1, 1]) add(arm, new T.BoxGeometry(1, 10, 10), hot, sx * 11.2, -26, 38, false);
        const rune = glowSprite(arm, '#ff7a1a', 26, 0, -26, 47);
        g.visible = false; g.scale.setScalar(1.15); root.add(g);
        return { g, wallMat: plate, arm, armL, legs, core, eyes, rune, head, towers: [], smokeT: 0 };
      }

      // Siege tank: wide hull with reactive armour blocks, running tracks (wheels spin with the sweep), twin cannons
      // on a big turret, commander cupola with a machine gun, antenna, glowing exhaust stacks and a red sensor visor.
      function makeTank(root) {
        const g = new T.Group(), hull = toon('#5c6b3c', { emissive: '#000000' }), dark = toon('#2b2f25'), steel = toon('#7d8577'), hazard = toon('#e0b020');
        inked(g, new T.BoxGeometry(84, 22, 110), hull, 0, 22, 0, 1);
        inked(g, new T.BoxGeometry(70, 10, 30), hull, 0, 30, 46, 0.8).rotation.x = -0.35;           // sloped glacis
        for (let k = -2; k <= 2; k++) add(g, new T.BoxGeometry(12, 6, 8), steel, k * 14, 36, 54, false).rotation.x = -0.35; // reactive blocks
        for (let k = -3; k <= 3; k++) add(g, new T.BoxGeometry(6, 2, 0.6), k % 2 ? dark : hazard, k * 10, 26, 57.4, false);
        const wheels = [];
        for (const sx of [-1, 1]) {
          inked(g, new T.BoxGeometry(18, 20, 122), dark, sx * 46, 12, 0, 0.8);
          add(g, new T.BoxGeometry(20, 10, 112), hull, sx * 47, 24, 0, false);                       // side skirt
          for (let k = -4; k <= 4; k++) add(g, new T.BoxGeometry(19, 1.6, 4), steel, sx * 46, 2.2, k * 13, false); // track links
          for (let k = -2; k <= 2; k++) { const w = add(g, new T.CylinderGeometry(8, 8, 20, 10), steel, sx * 46, 10, k * 24, false); w.rotation.z = Math.PI / 2; wheels.push(w); }
          // Exhaust stacks at the back.
          add(g, new T.CylinderGeometry(3, 3.5, 16, 8), dark, sx * 26, 40, -50, false);
          glowSprite(g, '#ff7a2a', 22, sx * 26, 50, -50);
        }
        const turret = new T.Group(); turret.position.set(0, 40, -6); g.add(turret);
        inked(turret, new T.CylinderGeometry(28, 32, 20, 8), hull, 0, 0, 0, 1);
        inked(turret, new T.BoxGeometry(40, 12, 30), hull, 0, 2, 22, 0.8);
        const barrels = [];
        for (const sx of [-1, 1]) {
          const b = inked(turret, new T.CylinderGeometry(3.6, 4.4, 62, 12), dark, sx * 9, 2, 50, 0.6); b.rotation.x = Math.PI / 2; syncInk(b);
          add(turret, new T.CylinderGeometry(5.6, 5.6, 9, 12), dark, sx * 9, 2, 82, false).rotation.x = Math.PI / 2;
          barrels.push(b);
        }
        const tip = new T.Object3D(); tip.position.set(0, 2, 88); turret.add(tip);
        // Cupola + machine gun, antenna, red sensor visor.
        inked(turret, new T.CylinderGeometry(8, 9, 8, 10), hull, 14, 14, -8, 0.5);
        add(turret, new T.BoxGeometry(2, 2, 18), dark, 14, 18, 2, false);
        add(turret, new T.CylinderGeometry(0.5, 0.5, 46, 4), dark, -18, 30, -14, false);
        add(turret, new T.SphereGeometry(1.4, 6, 4), glowBasic('#ff3030'), -18, 53, -14, false);
        add(turret, new T.BoxGeometry(30, 3, 1), glowBasic('#ff2a2a'), 0, 8, 37.2, false);
        const visor = glowSprite(turret, '#ff2a2a', 46, 0, 8, 39);
        // Headlights.
        for (const sx of [-1, 1]) { add(g, new T.BoxGeometry(8, 5, 2), std('#fff2c0', { emissive: '#ffe9a0', emissiveIntensity: 1.4 }), sx * 30, 26, 56, false); glowSprite(g, '#ffe6a0', 34, sx * 30, 26, 60); }
        g.visible = false; root.add(g);
        return { g, wallMat: hull, turret, tip, barrels, wheels, visor, towers: [], smokeT: 0, lastX: null };
      }

      // Fire drake: a scaled body with a spiked spine, a long neck and horned head (jaw opens to breathe), membrane
      // wings that flap, a swaying tail, ember-glowing belly and eyes. Hovers over the enemy lane.
      function wingGeo() {
        // A bat-like membrane: a fan of triangles from the shoulder out to three finger tips.
        const P = [0, 0, 0, 90, 18, 10, 70, 6, -30, 40, 0, -46, 10, 0, -30];
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3));
        g.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4]); g.computeVertexNormals(); return g;
      }
      function makeDragon(root) {
        const g = new T.Group(), scale = toon('#9a1f2c', { emissive: '#000000' }), belly = toon('#f0a64a'), horn = toon('#f3e7c8'), dark = toon('#3a0a14');
        const memb = lam('#c23440', { side: T.DoubleSide, emissive: '#4a0a14' });
        const body = inked(g, new T.CapsuleGeometry(16, 34, 6, 14), scale, 0, 0, 0, 1); body.rotation.x = Math.PI / 2; syncInk(body);
        const bel = add(g, new T.CapsuleGeometry(12, 28, 4, 10), belly, 0, -6, 2, false); bel.rotation.x = Math.PI / 2;
        const bellyGlow = glowSprite(g, '#ff7a1a', 70, 0, -14, 4);
        for (let k = 0; k < 6; k++) { const sp = add(g, new T.ConeGeometry(3, 10 - k, 6), dark, 0, 16 - k * 0.6, 22 - k * 9, false); sp.rotation.x = -0.4; }
        // Neck (chain of spheres) and head.
        const neck = [];
        for (let k = 0; k < 4; k++) neck.push(inked(g, new T.SphereGeometry(9 - k * 0.8, 12, 8), scale, 0, 6 + k * 6, 28 + k * 9, 0.6));
        const head = new T.Group(); head.position.set(0, 32, 66); g.add(head);
        inked(head, new T.BoxGeometry(16, 12, 20), scale, 0, 0, 0, 0.7);
        inked(head, new T.BoxGeometry(12, 7, 16), scale, 0, -1, 15, 0.6);                             // snout
        const jaw = new T.Group(); jaw.position.set(0, -5, 4); head.add(jaw);
        inked(jaw, new T.BoxGeometry(11, 4, 22), dark, 0, -2, 10, 0.5);
        for (const sx of [-1, 1]) {
          const h = inked(head, new T.ConeGeometry(2.6, 16, 6), horn, sx * 6, 9, -8, 0.4); h.rotation.x = -1.0; h.rotation.z = -sx * 0.3; syncInk(h);
          add(head, new T.SphereGeometry(1.8, 8, 6), glowBasic('#ffe14a'), sx * 5, 3, 7.5, false);
        }
        const eyes = [glowSprite(head, '#ffb020', 14, -5, 3, 9), glowSprite(head, '#ffb020', 14, 5, 3, 9)];
        const mouth = glowSprite(head, '#ff6a1a', 26, 0, -3, 24); mouth.visible = false;
        const mouthTip = new T.Object3D(); mouthTip.position.set(0, -3, 26); head.add(mouthTip);
        // Wings.
        const wings = [];
        for (const sx of [-1, 1]) {
          const w = new T.Group(); w.position.set(sx * 12, 10, 10); g.add(w);
          const m = add(w, wingGeo(), memb, 0, 0, 0, false); m.scale.x = sx;
          for (const [x, y, z] of [[90, 18, 10], [70, 6, -30], [40, 0, -46]]) {
            const len = Math.hypot(x, y, z), bone = add(w, new T.CylinderGeometry(1.2, 2, len, 5), dark, 0, 0, 0, false);
            bone.position.set(sx * x / 2, y / 2, z / 2); bone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(sx * x, y, z).normalize());
          }
          wings.push({ w, sx });
        }
        // Tail.
        const tail = [];
        for (let k = 0; k < 6; k++) tail.push(inked(g, new T.SphereGeometry(8 - k * 1.1, 10, 8), scale, 0, -2 - k, -30 - k * 10, 0.5));
        const tipSpike = add(g, new T.ConeGeometry(4, 12, 6), dark, 0, -8, -94, false); tipSpike.rotation.x = -Math.PI / 2;
        // Tucked legs with claws.
        for (const sx of [-1, 1]) for (const z of [-12, 16]) { const l = add(g, new T.CapsuleGeometry(3.6, 8, 3, 6), scale, sx * 12, -16, z, false); l.rotation.x = 0.5; add(g, new T.ConeGeometry(2, 5, 5), horn, sx * 12, -24, z + 4, false).rotation.x = Math.PI * 0.8; }
        const aura = glowSprite(g, '#ff5a1a', 200, 0, 20, -30); aura.material.opacity = 0.35;
        g.visible = false; g.scale.setScalar(1.6); root.add(g);
        return { g, wallMat: scale, head, jaw, neck, wings, tail, tipSpike, eyes, mouth, mouthTip, bellyGlow, aura, breathT: 0, towers: [], smokeT: 0 };
      }
      // Gunship: armoured hull, glowing canopy, stub wings with rotary-gun pods, two engines with hot exhausts, a
      // spinning main and tail rotor, blinking navigation lights and a searchlight sweeping the road.
      const softM = c => new T.MeshBasicMaterial({ map: soft, color: c, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
      function glowSprite(parent, c, size, x, y, z) { const m = new T.Mesh(new T.PlaneGeometry(1, 1), softM(c)); m.scale.setScalar(size); m.position.set(x, y, z); m.rotation.x = -0.58; m.renderOrder = 4; parent.add(m); return m; }
      function makeHeli(root) {
        const g = new T.Group(), body = lam('#36433d'), armor = lam('#26302c'), dark = std('#121614'), metal = lam('#6d777c');
        const glassM = std('#86e6ff', { emissive: '#2a8ab0', emissiveIntensity: 1.1 });
        const fus = add(g, new T.CapsuleGeometry(16, 36, 6, 16), body, 0, 0, 0); fus.rotation.x = Math.PI / 2;
        add(g, new T.BoxGeometry(26, 10, 40), armor, 0, -9, 2);                                       // belly armour
        add(g, new T.SphereGeometry(13, 18, 12), glassM, 0, 4, 24).scale.set(1, 0.8, 1.15);            // canopy
        add(g, new T.BoxGeometry(2, 9, 16), armor, 0, 11, 22);                                         // canopy frame
        const tail = add(g, new T.BoxGeometry(7, 7, 64), body, 0, 5, -54);
        add(g, new T.BoxGeometry(2.4, 24, 14), body, 0, 14, -84);
        add(g, new T.BoxGeometry(30, 2, 8), body, 0, 6, -78);                                          // tail plane
        const tailRotor = new T.Group(); tailRotor.position.set(3.5, 16, -86); g.add(tailRotor);
        for (let k = 0; k < 3; k++) { const b = add(tailRotor, new T.BoxGeometry(1, 26, 3), dark, 0, 0, 0, false); b.rotation.x = k * Math.PI / 1.5; }
        // Engines on the roof with glowing exhausts.
        const exhaust = [];
        for (const sx of [-1, 1]) {
          const e = add(g, new T.CylinderGeometry(5, 5.5, 26, 12), metal, sx * 10, 15, -6); e.rotation.x = Math.PI / 2;
          add(g, new T.TorusGeometry(5, 1.2, 6, 14), dark, sx * 10, 15, 7);
          exhaust.push(glowSprite(g, '#ff7a2a', 20, sx * 10, 15, -21));
        }
        // Main rotor.
        const rotor = new T.Group(); rotor.position.set(0, 24, 0); g.add(rotor);
        add(rotor, new T.CylinderGeometry(4, 4, 6, 10), dark, 0, -2, 0);
        for (let k = 0; k < 4; k++) { const b = add(rotor, new T.BoxGeometry(132, 1.4, 8), dark, 0, 0, 0, false); b.rotation.y = k * Math.PI / 2; }
        const disc = add(rotor, new T.CircleGeometry(66, 32), new T.MeshBasicMaterial({ color: '#9aa6c8', transparent: true, opacity: 0.13, side: T.DoubleSide, depthWrite: false }), 0, 0.5, 0, false);
        disc.rotation.x = -Math.PI / 2;
        // Stub wings, rotary gun pods (their muzzles are where the burst flashes), rocket racks.
        const guns = [], barrels = [];
        for (const sx of [-1, 1]) {
          add(g, new T.BoxGeometry(30, 3, 14), armor, sx * 26, -4, 4);
          const pod = new T.Group(); pod.position.set(sx * 38, -9, 8); g.add(pod);
          const housing = add(pod, new T.CylinderGeometry(4.5, 4.5, 14, 12), dark, 0, 0, -2); housing.rotation.x = Math.PI / 2;
          const bar = new T.Group(); bar.position.z = 8; pod.add(bar); barrels.push(bar);
          for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, c = add(bar, new T.CylinderGeometry(0.8, 0.8, 14, 6), metal, Math.cos(a) * 2.2, Math.sin(a) * 2.2, 4, false); c.rotation.x = Math.PI / 2; }
          const tip = new T.Object3D(); tip.position.z = 12; bar.add(tip); guns.push(tip);
          const rack = add(g, new T.CylinderGeometry(3.4, 3.4, 16, 8), armor, sx * 22, -10, 6); rack.rotation.x = Math.PI / 2;
          add(g, new T.CircleGeometry(3, 8), std('#ff5a3a', { emissive: '#ff3a1a', emissiveIntensity: 0.8 }), sx * 22, -10, 14.1, false);
          add(g, new T.BoxGeometry(3, 3, 48), dark, sx * 15, -22, 0);                                   // skids
          for (const z of [-12, 12]) add(g, new T.BoxGeometry(2, 10, 2), dark, sx * 13, -17, z);
        }
        // Navigation lights (blink in render) and the searchlight.
        // A violet storm glow behind the gunship (one big additive quad) sets it against the night sky.
        const aura = glowSprite(g, '#7a2aff', 160, 0, 30, -40); aura.material.opacity = 0.55;
        const nav = [glowSprite(g, '#ff2a2a', 16, -54, -4, 4), glowSprite(g, '#2aff6a', 16, 54, -4, 4), glowSprite(g, '#ffffff', 14, 0, 16, -90)];
        const beamMat = new T.MeshBasicMaterial({ map: glow, color: '#bfe4ff', transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.22 });
        const beam = new T.Mesh(new T.CylinderGeometry(3, 34, 150, 18, 1, true).translate(0, -75, 0), beamMat);
        beam.position.set(0, -8, 30); beam.rotation.x = -0.55; beam.renderOrder = 4; g.add(beam);
        const spot = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), softM('#9fd0ff')); spot.scale.set(110, 1, 80); spot.renderOrder = 4; spot.visible = false; root.add(spot);
        g.visible = false; root.add(g); g.userData.tail = tail;
        return { g, wallMat: body, rotor, tailRotor, guns, barrels, nav, exhaust, beam, spot, aura, spin: 0, towers: [], smokeT: 0 };
      }

      // ---------- Gates & crates ----------
      const glow = glowTex(); glow.shared = true;
      const frameGlow = frameGlowTex(); frameGlow.shared = true;
      const crateTexs = { weapon: crateTex('weapon'), troops: crateTex('troops'), mortar: crateTex('mortar'), air: crateTex('air') };
      Object.values(crateTexs).forEach(t => { t.shared = true; });
      // Energy field: bright at the bottom and the frame edges, rising scan bands and a fine hex shimmer.
      const fieldMat = () => new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
        uniforms: { uC: { value: new T.Color('#3be07a') }, uT: { value: 0 }, uF: { value: 0 } },
        vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 uC; uniform float uT; uniform float uF; varying vec2 vU;' +
          'void main(){ float e = max(smoothstep(0.06, 0.0, vU.x), smoothstep(0.94, 1.0, vU.x)); float b = pow(1.0 - vU.y, 2.2);' +
          ' float band = smoothstep(0.08, 0.0, abs(fract(vU.y * 2.0 - uT * 0.7) - 0.5) - 0.42);' +
          ' float hx = 0.5 + 0.5 * sin(vU.x * 90.0 + sin(vU.y * 60.0) * 2.0) * sin(vU.y * 70.0 - uT * 3.0);' +
          ' float a = 0.12 + b * 0.42 + e * 0.8 + band * (0.22 + uF * 0.4) + hx * 0.05 + uF * 0.06; gl_FragColor = vec4(uC * (0.6 + e * 0.7), min(0.9, a * 0.85)); }' });
      const pillarMat = toon('#e9edf3'), pillarDark = toon('#3a4150');
      function makeGate(g) {
        const grp = new T.Group(), H = 46, hw = g.w / 2 + 4;
        const panel = new T.Mesh(new T.PlaneGeometry(g.w, H - 4), fieldMat()); panel.position.y = (H - 4) / 2 + 1; grp.add(panel);
        const beamMat = std('#3be07a', { emissive: '#3be07a', emissiveIntensity: 0.6 });
        add(grp, new T.BoxGeometry(g.w + 14, 6, 7), pillarDark, 0, H + 1, 0);
        add(grp, new T.BoxGeometry(g.w + 4, 2.4, 7.6), beamMat, 0, H + 1, 0, false);
        for (const sx of [-1, 1]) {
          add(grp, new T.BoxGeometry(10, 4, 10), pillarDark, sx * hw, 2, 0);
          add(grp, new T.BoxGeometry(7.5, H, 7.5), pillarMat, sx * hw, H / 2 + 2, 0);
          add(grp, new T.BoxGeometry(8.4, 3, 8.4), beamMat, sx * hw, H * 0.5, 0, false);
          add(grp, new T.OctahedronGeometry(5.2, 0), beamMat, sx * hw, H + 9, 0);
        }
        const strip = new T.Mesh(new T.PlaneGeometry(g.w + 30, 34).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: glow, color: '#3be07a', transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
        strip.position.y = 0.6; grp.add(strip);
        // Neon: a soft glowing outline around the whole frame (a pre-baked glow texture, no bloom pass).
        const halo = new T.Mesh(new T.PlaneGeometry(g.w + 56, H + 40), new T.MeshBasicMaterial({ map: frameGlow, color: '#3be07a', transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
        halo.position.set(0, H / 2 + 6, -1); halo.renderOrder = 4; grp.add(halo);
        return { g: grp, panel, beamMat, strip, halo };
      }
      function makeCrate(c) {
        const grp = new T.Group(), mat = std('#ffffff', { map: crateTexs[c.what] || crateTexs.weapon, roughness: 0.8 });
        const box = add(grp, new T.BoxGeometry(40, 34, 34), mat, 0, 17, 0);
        const metal = std(c.what === 'weapon' ? '#ffd23f' : '#c9ced6', { metalness: 0.7, roughness: 0.3, emissive: c.what === 'weapon' ? '#4a3000' : '#000' });
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(grp, new T.BoxGeometry(5, 35, 5), metal, sx * 19, 17, sz * 16);
        return { g: grp, box, mat };
      }

      // Shock landing: dust ring, cracks, stone chips, camera kick.
      function landing(x, z, r) {
        fx.crack(x, z, r * 0.14); fx.chips(x, z, 10, '#5a5060', 1.4); camKick = Math.max(camKick, 10);
        for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; puff(x + Math.cos(a) * r * 0.6, 4, z + Math.sin(a) * r * 0.5, 12, 1.2, SMOKE_L, 10); }
        if (ringFx.length < 8) ringFx.push({ x, z, r, t: 0, c: C_('#ffd8a0') });
      }
      // Danger zone on the road: a red disc that fills toward its rim as the attack lands (u 0 -> 1) + pulsing ring.
      let nZone = 0;
      function zone(x, z, r, u, foe) {
        if (nZone >= 40) return;
        const k = r * Math.max(0.05, Math.min(1, u));
        put(zones, nZone++, x, 0.9, z, k, 1, k, 0, 0, 0, foe ? ZONE_FOE : ZONE_OWN);
        if (nmkZ < 40) put(zoneRims, nmkZ++, x, 1.0, z, r, 1, r, 0, 0, 0, foe ? MK_FOE : MK_OWN);
      }
      let nmkZ = 0;
      // Boss death: the model shudders, tilts and sinks while explosions pop all over it, then one big blast.
      function dyingBoss(d, dt) {
        d.t += dt; const K = d.K, u = Math.min(1, d.t / 1.3);
        K.g.position.set(d.x + Math.sin(d.t * 60) * 2 * (1 - u), d.y0 - (d.type === 'heli' || d.type === 'ejder' ? u * u * 120 : u * 18), d.z);
        K.g.rotation.z = (d.type === 'kale' ? 0.05 : 0.5) * u * (d.x > 0 ? 1 : -1); K.g.rotation.x = 0.25 * u;
        K.wallMat.emissive.setRGB(0.5 + 0.4 * Math.sin(d.t * 30), 0.2, 0.05);
        if ((d.boomT -= dt) <= 0 && d.t < 1.2) {
          d.boomT = 0.11;
          const ex = d.x + rnd(-50, 50), ey = Math.max(10, K.g.position.y + rnd(0, 60)), ez = d.z + rnd(-20, 30);
          fx.explosion(ex, ey, ez, rnd(10, 18), { n: 14, rocks: 4, shake: 0, rockCol: '#3c3644' }); boomFlash(ex, ey, ez, 90, 0.3);
          puff(ex, ey, ez, 14, 1.6, C_('#4a4440'), 24); camKick = Math.max(camKick, 5);
        }
        if (!d.final && d.t >= 1.2) {
          d.final = true; camKick = 18;
          const fy = Math.max(10, K.g.position.y);
          fx.explosion(d.x, fy, d.z, 40, { n: 60, rocks: 24, shake: 0, rockCol: '#3c3644' }); boomFlash(d.x, fy + 20, d.z, 360, 0.6);
          fx.shower(d.x, fy + 10, d.z, 0, 1, '#ffd23f', 40); fx.crack(d.x, d.z, 14);
          for (let k = 0; k < 16; k++) puff(d.x + rnd(-70, 70), fy + rnd(0, 50), d.z + rnd(-30, 40), rnd(16, 28), rnd(1.8, 2.8), C_(k % 2 ? '#5e5650' : '#2e2a2a'), rnd(16, 40));
          ringFx.push({ x: d.x, z: d.z, r: 200, t: 0, c: C_('#ffb040') });
        }
      }

      function warmUp() {
        const hidden = [];
        scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
        try { renderer.compile(scene, camera); } catch (e) { }
        hidden.forEach(o => { o.visible = false; });
      }

      // ---------- V2 support abilities: transport helicopter, shield dome ----------
      // Transport helicopter (built on first use): olive fuselage with an open side door, a door gunner on a minigun,
      // two ropes the reinforcements slide down, spinning rotors, nav lights and a downwash ring of dust on the road.
      let transport = null;
      function makeTransport() {
        const g = new T.Group(), body = toon('#5d6b45'), dark = toon('#22272a'), metal = toon('#8a9294');
        const glassM = std('#9fe6ff', { emissive: '#2a7aa0', emissiveIntensity: 1 });
        const fus = inked(g, new T.CapsuleGeometry(15, 44, 6, 14), body, 0, 0, 0, 0.8); fus.rotation.x = Math.PI / 2; syncInk(fus);
        add(g, new T.SphereGeometry(12, 16, 10), glassM, 0, 4, 30, false).scale.set(1, 0.8, 1.1);
        add(g, new T.BoxGeometry(1, 14, 20), dark, 15.2, -2, 2, false);                                // open door (dark opening)
        const tail = inked(g, new T.BoxGeometry(6, 7, 60), body, 0, 6, -55, 0.6);
        add(g, new T.BoxGeometry(2.4, 22, 14), body, 0, 15, -84, false);
        const tailRotor = new T.Group(); tailRotor.position.set(3, 16, -86); g.add(tailRotor);
        for (let k = 0; k < 3; k++) add(tailRotor, new T.BoxGeometry(1, 22, 3), dark, 0, 0, 0, false).rotation.x = k * Math.PI / 1.5;
        const rotor = new T.Group(); rotor.position.set(0, 20, 0); g.add(rotor);
        const bladeM = new T.MeshBasicMaterial({ color: '#2a3036', transparent: true, opacity: 0.45, depthWrite: false });
        for (let k = 0; k < 4; k++) add(rotor, new T.BoxGeometry(124, 0.8, 4), bladeM, 0, 0, 0, false).rotation.y = k * Math.PI / 2;
        const disc = add(rotor, new T.CircleGeometry(62, 28), new T.MeshBasicMaterial({ color: '#c8d4e8', transparent: true, opacity: 0.12, side: T.DoubleSide, depthWrite: false }), 0, 0.5, 0, false); disc.rotation.x = -Math.PI / 2;
        for (const sx of [-1, 1]) add(g, new T.BoxGeometry(3, 3, 50), dark, sx * 13, -20, 0, false);
        // Door gunner + minigun.
        const gunner = new T.Group(); gunner.position.set(13, -4, 2); g.add(gunner);
        const crewM = toon('#3b82f6');
        add(gunner, new T.CapsuleGeometry(3, 3.4, 3, 8), crewM, 0, 0, 0, false);
        add(gunner, new T.SphereGeometry(2.6, 10, 8), toon('#f1c38f'), 0, 6, 0, false);
        add(gunner, new T.SphereGeometry(3, 10, 6, 0, TAU, 0, Math.PI / 2), toon('#3d4a2a'), 0, 6.6, 0, false);
        const mg = add(gunner, new T.CylinderGeometry(1.4, 1.4, 16, 8), metal, 6, 1, 6, false); mg.rotation.x = Math.PI / 2;
        const gunTip = new T.Object3D(); gunTip.position.set(6, 1, 15); gunner.add(gunTip);
        const nav = [glowSprite(g, '#ff2a2a', 14, -16, -4, 4), glowSprite(g, '#2aff6a', 14, 16, -4, 4), glowSprite(g, '#ffffff', 12, 0, 16, -90)];
        // Ropes (unit height, scaled to the hover altitude) and the soldiers sliding down them.
        const ropeM = toon('#d8c9a0'), ropes = [], sliders = [];
        for (const sz of [-8, 8]) {
          const r = add(scene, new T.CylinderGeometry(0.5, 0.5, 1, 4).translate(0, -0.5, 0), ropeM, 0, 0, 0, false); r.visible = false; ropes.push({ m: r, dz: sz });
          const sl = new T.Group(); scene.add(sl); sl.visible = false;
          add(sl, new T.CapsuleGeometry(3, 4.4, 3, 8), crewM, 0, 0, 0, false);
          add(sl, new T.SphereGeometry(2.7, 10, 8), toon('#f1c38f'), 0, 7, 0, false);
          add(sl, new T.SphereGeometry(3.1, 10, 6, 0, TAU, 0, Math.PI / 2), toon('#3d4a2a'), 0, 7.6, 0, false);
          for (const ax of [-1, 1]) add(sl, new T.CapsuleGeometry(1, 3.4, 2, 5), crewM, ax * 2, 7, 0, false);
          sl.scale.setScalar(2.3); sliders.push({ g: sl, dz: sz });
        }
        const wash = new T.Mesh(new T.RingGeometry(0.6, 1, 40).rotateX(-Math.PI / 2), additive('#c8d8ff')); wash.renderOrder = 2; wash.visible = false; scene.add(wash);
        g.visible = false; g.scale.setScalar(1.3); scene.add(g);
        return { g, rotor, tailRotor, nav, gunner, gunTip, ropes, sliders, wash, crewM };
      }
      // Shield dome: a hex-grid energy shell over the squad (fresnel rim, scrolling hexes, a flash on every block).
      const domeMat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
        uniforms: { uT: { value: 0 }, uA: { value: 0 }, uHit: { value: 0 }, uC: { value: new T.Color('#5ff4ff') } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec2 vU; void main(){ vU = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform float uT; uniform float uA; uniform float uHit; uniform vec3 uC; varying vec3 vN; varying vec3 vV; varying vec2 vU;' +
          'float hex(vec2 p){ p.x *= 1.1547; p.y += mod(floor(p.x), 2.0) * 0.5; p = abs(fract(p) - 0.5); return abs(max(p.x * 1.5 + p.y, p.y * 2.0) - 1.0); }' +
          'void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); float h = smoothstep(0.08, 0.0, hex(vec2(vU.x * 28.0, vU.y * 10.0 - uT * 0.4)));' +
          ' float band = smoothstep(0.06, 0.0, abs(fract(vU.y * 1.5 - uT * 0.5) - 0.5) - 0.44); float base = smoothstep(0.0, 0.12, vU.y);' +
          ' float a = (0.05 + f * 0.7 + h * 0.22 + band * 0.18 + uHit * (0.3 + h * 0.6)) * uA * (0.4 + base * 0.6); gl_FragColor = vec4(uC * (1.0 + uHit), a); }' });
      const dome = new T.Mesh(new T.SphereGeometry(1, 40, 18, 0, TAU, 0, Math.PI / 2), domeMat); dome.visible = false; dome.renderOrder = 5; scene.add(dome);
      const domeRing = new T.Mesh(new T.RingGeometry(0.92, 1, 56).rotateX(-Math.PI / 2), additive('#5ff4ff')); domeRing.visible = false; domeRing.renderOrder = 5; scene.add(domeRing);
      let shieldWas = 0;
      function support(S, info, time, dt) {
        const q = S.squad, form = info.formation, depth = form.length ? form[form.length - 1].y : 0;
        // Shield.
        const on = S.shieldT > 0;
        dome.visible = domeRing.visible = on;
        if (on) {
          const rx = Math.min(6, q.n) * 7 + 26, rz = depth / 2 + 30, cz = SQUAD_Y + depth / 2 - CZ, fade = S.shieldT < 1.2 ? (Math.sin(time * 30) > 0 ? 1 : 0.35) : 1;
          const pop = Math.min(1, (6 - S.shieldT) / 0.25);
          dome.position.set(q.x - CX, 0, cz); dome.scale.set(rx * pop, 52 * pop, rz * pop);
          domeRing.position.set(q.x - CX, 1.2, cz); domeRing.scale.set(rx * pop, 1, rz * pop);
          domeMat.uniforms.uT.value = time; domeMat.uniforms.uA.value = fade; domeMat.uniforms.uHit.value = S.shieldHit || 0;
          domeRing.material.opacity = 0.7 * fade;
          if (!shieldWas) { fx.ring(q.x - CX, 6, cz, '#5ff4ff', 6, 36, '#ffffff'); fx.star(q.x - CX, 40, cz, '#9ff8ff', 12, 0.4); }
          if ((S.shieldHit || 0) > 0.9 && Math.random() < 0.5) fx.impact(q.x - CX + rnd(-rx, rx) * 0.8, rnd(10, 40), cz - rz * 0.8, '#7df9ff', 0.8);
        } else if (shieldWas) fx.ring(q.x - CX, 6, SQUAD_Y + depth / 2 - CZ, '#5ff4ff', 4, 20);
        shieldWas = on ? 1 : 0;
        // Transport helicopter (one at a time on screen).
        const h = S.helis[0];
        if (!h && !transport) return;
        if (!transport) transport = makeTransport();
        const T0 = transport;
        T0.g.visible = !!h;
        T0.ropes.forEach(r => { r.m.visible = false; }); T0.sliders.forEach(sl => { sl.g.visible = false; }); T0.wash.visible = false;
        if (!h) return;
        const alt = h.st === 'in' ? 95 + Math.max(0, 1.3 - h.t) * 160 : h.st === 'out' ? 95 + h.t * h.t * 90 : 95 + Math.sin(time * 2.2) * 3;
        const hx = h.x - CX, hz = h.y - CZ;
        T0.g.position.set(hx, alt, hz);
        T0.g.rotation.set(h.st === 'in' ? 0.25 : h.st === 'out' ? -0.15 : 0.04, 0, Math.sin(time * 1.3) * 0.05);
        T0.rotor.rotation.y += dt * 32; T0.tailRotor.rotation.x += dt * 40;
        T0.nav[0].visible = T0.nav[1].visible = Math.sin(time * 6) > -0.3; T0.nav[2].visible = (time * 1.4) % 1 < 0.12;
        T0.crewM.color.set(info.skin);
        blob(hx, hz + 20, 120, 90);
        // Downwash: a pulsing dust ring and puffs on the road under the rotor.
        if (alt < 160) {
          T0.wash.visible = true; const k = 60 + 14 * Math.sin(time * 9); T0.wash.position.set(hx, 1.4, hz); T0.wash.scale.set(k, 1, k * 0.8); T0.wash.material.opacity = 0.35;
          if (Math.random() < dt * 14) { const a = Math.random() * TAU; puff(hx + Math.cos(a) * 60, 3, hz + Math.sin(a) * 45, 7, 0.8, SMOKE_M, 4); }
        }
        if (h.st === 'hover') {
          // Two ropes from the door to the road; a soldier slides down each, over and over while troops drop.
          for (const r of T0.ropes) { r.m.visible = true; r.m.position.set(hx + 20, alt - 8, hz + r.dz); r.m.scale.set(1, alt - 8, 1); }
          if (h.left > 0) T0.sliders.forEach((sl, i) => { const u = (h.t * 2.6 + i * 0.5) % 1; sl.g.visible = true; sl.g.position.set(hx + 20, (alt - 18) * (1 - u) + 2, hz + sl.dz); });
          T0.gunner.rotation.y = Math.sin(time * 3) * 0.3;
        }
      }

      // Skin portrait (scripts/suru-skin-art.html bakes the shop art with it): one soldier, 3/4 view, studio light.
      function portrait(key, angle) {
        const gk = GEAR[key] || GEAR.mavi, ps = new T.Scene(), g = new T.Group(), s = 1;
        ps.add(new T.HemisphereLight(0xffffff, 0x50406a, 1.3)); const kl = new T.DirectionalLight(0xfff0dc, 2.4); kl.position.set(-30, 60, 80); ps.add(kl);
        const rl = new T.DirectionalLight(0x9fc4ff, 1.4); rl.position.set(50, 40, -60); ps.add(rl);
        const part = (m, x, y, z, sx, sy, sz, rx, ry, rz, c) => {
          const mat = c ? m.material.clone() : m.material; if (c) mat.color.set(c); if (gk.glow && c && mat.emissive) mat.emissive.set(c).multiplyScalar(gk.glow);
          const me = new T.Mesh(m.geometry, mat); me.position.set(x, y, z); me.rotation.set(rx || 0, ry || 0, rz || 0); me.scale.set(sx, sy, sz); g.add(me);
          if (m.userData.ol) { const o = new T.Mesh(m.geometry, m.userData.ol.material); o.position.copy(me.position); o.rotation.copy(me.rotation); o.scale.copy(me.scale); g.add(o); }
        };
        const c = gk.color, hc = '#' + new T.Color(c).multiplyScalar(0.55).getHexString();
        part(squad.legL, -1.7, 6.6, 0, 1, 1, 1, 0.12); part(squad.legR, 1.7, 6.6, 0, 1, 1, 1, -0.12);
        part(squad.torso, 0, 9.6, 0, 1, 1, 1, -0.12, 0, 0, c); part(squad.belt, 0, 7.6, -0.25, 1, 1, 1, -0.12);
        part(squad.armL, -3.3, 12.4, 0, 1, 1, 1, 0.15, 0, -0.25, c); part(squad.armR, 3.3, 12.4, 0, 1, 1, 1, 0.6, 0, 0.3, c);
        part(squad.head, 0, 15.8, 0, 1, 1, 1); part(squad.eyes, -0.85, 15.9, 2.45, 0.28, 1.1, 1); part(squad.eyes, 0.85, 15.9, 2.45, 0.28, 1.1, 1);
        part(squad.pack, 0, 10.4, -3.3, 1, 1, 1);
        part(gunBox, 4.2, 12, 1.5, 1.6, 1.9, 11, -0.9);
        const hy = 16.4;
        if (gk.hat !== 'beret' && gk.hat !== 'crown') part(squad.helmet, 0, hy, 0, 1, 0.85, 1, 0, 0, 0, hc);
        if (gk.hat === 'beret') part(gear.beret, 0, hy + 1, 0, 1, 1, 1, 0, 0, 0.22, gk.beret);
        if (gk.hat === 'plume') part(gear.plume, 0, hy + 3.4, -1, 1, 1, 1, -0.5, 0, 0, gk.plume);
        if (gk.hat === 'spike') part(gear.spike, 0, hy + 3.4, 0, 1, 1, 1);
        if (gk.hat === 'horns') { part(gear.horn, -2.4, hy + 1, 0, 1, 1, 1, 0, 0, 0.7); part(gear.horn, 2.4, hy + 1, 0, 1, 1, 1, 0, 0, -0.7); }
        if (gk.hat === 'crown') { part(gear.crown, 0, hy + 0.2, 0, 1, 1, 1); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; part(gear.crownTip, Math.sin(a) * 2.9, hy + 1.9, Math.cos(a) * 2.9, 1, 1, 1); } }
        if (gk.cape) part(gear.cape, 0, 14.2, -4.8, 1, 1, 1, -0.25, 0, 0, gk.cape);
        g.rotation.y = angle || 0; ps.add(g);
        const W = canvas.width, H = canvas.height, cam = new T.PerspectiveCamera(28, W / H, 1, 400);
        cam.position.set(0, 13, 52); cam.lookAt(0, 11, 0);
        renderer.setClearColor(0x000000, 0); renderer.setViewport(0, 0, W, H); renderer.toneMapping = T.NoToneMapping;
        renderer.render(ps, cam); renderer.toneMapping = T.ACESFilmicToneMapping;
        return canvas.toDataURL('image/png');
      }

      const R = {
        _scene: scene, _renderer: renderer, // test hooks
        portrait,
        is3D: true,
        setLevel(S) {
          disposeLevel();
          const root = new T.Group(), th = S.theme;
          const land = new T.Color(th.land || '#7cc464').lerp(new T.Color('#3f9a45'), 0.4).lerp(new T.Color('#1a2850'), 0.42);
          if (grassMat.map) grassMat.map.dispose();
          grassMat.map = grassTex('#' + land.getHexString()); grassMat.map.repeat.set(26, 26); grassMat.color.set('#ffffff'); grassMat.needsUpdate = true;
          hillMat.color.copy(land).lerp(new T.Color('#2a2060'), 0.45);
          waterMat.color.set(th.sea || '#3aa0e8').lerp(new T.Color('#0e1440'), 0.62); waterMat.emissive.set('#140c3a');
          scene.fog.color.set('#2a1a52');
          const castle = makeCastle(root);
          const bosses = { kale: castle, dev: makeDev(root), tank: makeTank(root), heli: makeHeli(root), ejder: makeDragon(root) };
          scene.add(root);
          puffs.length = 0; prevBullets = []; fx.clear();
          level = { root, castle, bosses, gates: new Map(), crates: new Map(), S };
          R.fit();
          if (!warmed) { warmed = true; warmUp(); fx.warm(0, 20, 200); }
        },

        fit() {
          if (!level) return;
          W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
          renderer.setSize(W, H, false);
          camera.aspect = W / H; camera.updateProjectionMatrix();
          const sa = window.UI && UI.safeArea ? UI.safeArea() : { hudBottom: 90, bottom: 0 };
          const top = sa.hudBottom + 4, bottom = H - sa.bottom - 10, availH = Math.max(100, bottom - top);
          const pts = [[20, 40, 0], [380, 40, 0], [20, 715, 0], [380, 715, 0], [288, 110, 150]].map(([x, y, h]) => new T.Vector3(x - CX, h, y - CZ));
          const pitch = 33 * Math.PI / 180;
          let d = 900; camTarget.set(0, 0, 0);
          for (let it = 0; it < 30; it++) {
            camera.position.set(camTarget.x, Math.sin(pitch) * d, camTarget.z + Math.cos(pitch) * d);
            camera.lookAt(camTarget); camera.updateMatrixWorld();
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const p of pts) {
              v3.copy(p).project(camera);
              const sx = (v3.x + 1) / 2 * W, sy = (1 - v3.y) / 2 * H;
              minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
            }
            d *= Math.pow(Math.max((maxX - minX) / (W * 1.02), (maxY - minY) / availH), 0.85);
            camTarget.z += ((minY + maxY) / 2 - (top + bottom) / 2) * (650 / Math.max(1, maxY - minY)) * 0.5;
          }
          camBase.copy(camera.position);
        },

        pick(clientX, clientY) {
          raycaster.setFromCamera(new T.Vector2(clientX / W * 2 - 1, -(clientY / H) * 2 + 1), camera);
          return raycaster.ray.intersectPlane(ground, hitPt) ? { x: hitPt.x + CX, y: hitPt.z + CZ } : { x: -9999, y: -9999 };
        },
        project(x, y, h) {
          v3.set(x - CX, h || 0, y - CZ).project(camera);
          return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H };
        },

        render(S, dt, info) {
          if (!level || level.S !== S) return;
          const L = level, t = S.t, C = S.castle, time = performance.now() / 1000;
          nBlob = 0; nZone = 0; nmkZ = 0;
          // Adaptive quality: drop the resolution if the phone cannot keep up.
          perf.acc += dt; perf.n++;
          if (perf.acc > 2.5) {
            const avg = perf.acc / perf.n;
            if (avg > 1 / 45 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); R.fit(); }
            // Still slow at the lowest resolution: drop the purely decorative extras (filler marchers, lamp light pools,
            // half the effect particles). Gameplay visuals (soldiers, bullets, hits, gates) stay.
            else if (avg > 1 / 40 && pixelRatio <= 1 && !lowFx) { lowFx = true; lampPool.visible = false; fx.setBudget(200); }
            perf.acc = 0; perf.n = 0;
          }
          const D = S.dist, DR = S.rdist;
          // Road surface scrolls with the road position.
          asphalt.offset.y = D / 120; curb.offset.y = D / 40; waterMap.offset.set(Math.sin(time * 0.3) * 0.05, (D / 140 + time * 0.02) % 1); walkMat.map.offset.y = D / 17;
          if (grassMat.map) grassMat.map.offset.y = D / 130;
          // Lane tiles: reward lanes use the reward belt position (it keeps moving during the siege).
          let nr = 0, ne = 0, ns = 0;
          for (const kind of ['r', 'e']) {
            const DD = kind === 'r' ? DR : D, mesh = kind === 'r' ? tilesR : tilesE;
            let n = 0;
            for (let i = Math.floor((DD - NEAR_Y) / TILE); i <= Math.ceil((DD - FAR_Y) / TILE); i++) {
              const y = DD - (i + 0.5) * TILE;
              for (const l of info.layoutAt((i + 0.5) * TILE)) if (l.k === kind && n < 160) put(mesh, n++, l.c - CX, 0.3, y - CZ, l.w, 1, 1.002);
            }
            done(mesh, n);
            if (kind === 'r') nr = n; else ne = n;
          }
          for (let i = Math.floor((D - NEAR_Y) / TILE); i <= Math.ceil((D - FAR_Y) / TILE); i++) {
            const lanes = info.layoutAt((i + 0.5) * TILE), y = D - (i + 0.5) * TILE;
            for (let k = 1; k < lanes.length && ns < 200; k++) put(seps, ns++, lanes[k].a - CX, 2, y - CZ, 5, 4, TILE - 2, 0, 0, 0, sepCols[i & 1]);
          }
          done(seps, ns);
          // Scenery.
          let nt = 0, ncw = 0, nro = 0, npo = 0, npi = 0, nbu = 0, nfl = 0;
          for (const d of decos) {
            const y = ((D - d.s - FAR_Y) % DECO_P + DECO_P) % DECO_P + FAR_Y, z = y - CZ;
            if (d.kind === 'tree') {
              blob(d.x + 6, z + 6, 38 * d.sz, 34 * d.sz);
              put(trunks, nt++, d.x, 9 * d.sz, z, d.sz, d.sz, d.sz);
              put(crowns, ncw++, d.x, 26 * d.sz, z, 15 * d.sz, 13 * d.sz, 15 * d.sz, 0, d.rot, 0, d.c);
              put(crowns, ncw++, d.x + 2, 38 * d.sz, z - 1, 10 * d.sz, 10 * d.sz, 10 * d.sz, 0, d.rot + 1, 0, d.c);
            } else if (d.kind === 'rock') put(rocks, nro++, d.x, 3, z, 9 * d.sz, 6 * d.sz, 8 * d.sz, 0, d.rot, 0);
            else if (d.kind === 'pine') {
              blob(d.x + 5, z + 5, 30 * d.sz, 28 * d.sz);
              put(trunks, nt++, d.x, 9 * d.sz, z, d.sz * 0.8, d.sz, d.sz * 0.8);
              put(pines, npi++, d.x, 30 * d.sz, z, 15 * d.sz, 30 * d.sz, 15 * d.sz, 0, 0, 0, d.c);
              put(pines, npi++, d.x, 46 * d.sz, z, 10.5 * d.sz, 24 * d.sz, 10.5 * d.sz, 0, 1, 0, d.c);
            } else if (d.kind === 'bush') put(bushes, nbu++, d.x, 3 * d.sz, z, 8 * d.sz, 6 * d.sz, 8 * d.sz, 0, d.rot, 0, d.c);
            else if (d.kind === 'flag') {
              put(flagPoles, nfl, d.x, 24, z, 1, 48, 1);
              put(flags, nfl++, d.x, 41, z, 22, 13, 1, 0, Math.PI / 2 + (d.side ? 0.15 : -0.15) + Math.sin(time * 3 + d.s) * 0.25, 0, FLAG_C[d.side]);
            } else {
              put(poles, npo, d.x, 22, z, 1, 1, 1);
              const lx = d.x - Math.sign(d.x) * 5, fl = 1 + 0.06 * Math.sin(time * 9 + d.s);
              put(lampGlow, npo, lx, 42, z + 2, 46 * fl, 46 * fl, 1, -0.58, 0, 0);
              put(lampPool, npo, lx - Math.sign(d.x) * 8, 1.4, z, 62, 1, 48);
              put(lampHeads, npo++, lx, 44, z, 1, 1, 1);
            }
          }
          done(trunks, nt); done(crowns, ncw); done(rocks, nro); done(poles, npo); done(lampHeads, npo); done(lampGlow, npo); done(lampPool, npo); done(pines, npi); done(bushes, nbu); done(flags, nfl); done(flagPoles, nfl);

          // Gates.
          const seen = new Set();
          for (const g of S.gates) {
            seen.add(g.id);
            let m = L.gates.get(g.id);
            if (!m) { m = makeGate(g); L.gates.set(g.id, m); L.root.add(m.g); }
            const c = g.mul ? '#ffd23f' : g.val >= 1 ? '#3be07a' : '#ff4757';
            m.panel.material.uniforms.uC.value.set(c); m.panel.material.uniforms.uT.value = time; m.panel.material.uniforms.uF.value = g.flash;
            m.beamMat.color.set(c); m.beamMat.emissive.set(c); m.beamMat.emissiveIntensity = 1.1 + 0.35 * Math.sin(time * 5) + g.flash;
            for (const o of m.g.children) if (o.geometry && o.geometry.type === 'OctahedronGeometry') o.rotation.y = time * 2;
            m.strip.material.color.set(c).multiplyScalar(0.8);
            m.halo.material.color.set(c).multiplyScalar(0.75 + 0.2 * Math.sin(time * 5 + g.id) + g.flash);
            m.g.position.set(g.x - CX, 0, g.y - CZ);
          }
          for (const [id, m] of L.gates) if (!seen.has(id)) { L.root.remove(m.g); m.g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); L.gates.delete(id); /* gate material not disposed: shader stays compiled */ }
          // Crates.
          const seenC = new Set();
          for (const c of S.crates) {
            seenC.add(c.id);
            let m = L.crates.get(c.id);
            if (!m) { m = makeCrate(c); L.crates.set(c.id, m); L.root.add(m.g); }
            m.g.position.set(c.x - CX, 0, c.y - CZ);
            blob(c.x - CX + 6, c.y - CZ + 8, 64, 54);
            m.g.scale.setScalar(1 + c.flash * 0.1);
            m.mat.emissive.setRGB(c.flash * 0.5, c.flash * 0.4, c.flash * 0.2);
            m.g.rotation.y = Math.sin(time * 2 + c.id) * 0.08;
          }
          for (const [id, m] of L.crates) if (!seenC.has(id)) { L.root.remove(m.g); m.g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); L.crates.delete(id); }

          // Boss (fortress, giant, tank or helicopter).
          // A boss that just fell keeps standing for its death sequence (renderer-only: the game has already ended).
          if (C && C.dead && !L.dying && L.bosses[C.type]) L.dying = { t: 0, K: L.bosses[C.type], type: C.type, x: C.x - CX, z: C.y - CZ, boomT: 0, y0: L.bosses[C.type].g.position.y, final: false };
          for (const k in L.bosses) L.bosses[k].g.visible = !!(C && !C.dead && C.type === k) || !!(L.dying && L.dying.type === k && L.dying.t < 1.35);
          if (!C || C.dead) L.bosses.heli.spot.visible = false;
          const K = C ? L.bosses[C.type] || L.castle : L.castle;
          if (L.dying) dyingBoss(L.dying, dt);
          if (C && !C.dead) {
            K.g.position.set(C.x - CX, 0, C.y - CZ);
            // Entrance: each boss arrives in its own way during its first ~1.4 s (the game holds its attacks anyway
            // while it is still moving in). in = 0 -> 1.
            const inK = Math.min(1, C.t / 1.4), inE = 1 - Math.pow(1 - inK, 3);
            if (!K.entered && inK >= 1) { K.entered = true; }
            if (C.type === 'kale') {
              K.g.scale.setScalar(C.w / 150); blob(C.x - CX + 8, C.y - CZ + 14, C.w * 1.35, 90);
              // Rises out of the ground in a cloud of dust and stone.
              K.g.position.y = -(1 - inE) * 150;
              if (inK < 1 && Math.random() < dt * 22) { fx.chips(C.x - CX + rnd(-70, 70), C.y - CZ + rnd(10, 30), 2, '#6a6070', 1); puff(C.x - CX + rnd(-80, 80), 4, C.y - CZ + 26, 14, 1.4, SMOKE_L, 20); }
            } else if (C.type === 'dev') {
              K.g.scale.setScalar(1.15); blob(C.x - CX, C.y - CZ, 90, 64);
              // Drops from the sky and lands with a quake; then stomps toward the squad.
              const drop = C.t < 0.9 ? Math.pow(1 - C.t / 0.9, 2) * 420 : 0;
              K.g.position.y = drop + (C.t >= 0.9 ? Math.abs(Math.sin(time * 4)) * 3 : 0);
              if (C.t >= 0.9 && !K.landed) { K.landed = true; landing(C.x - CX, C.y - CZ, 70); }
              const walk = C.y < C.stopY ? Math.sin(time * 4) * 0.45 : 0;
              K.legs[0].rotation.x = walk; K.legs[1].rotation.x = -walk;
              // Wind-up telegraph: the hammer rises while a red zone fills on the road, then the smash.
              const wind = C.y >= C.stopY - 4 ? C.hitT : 9;
              K.arm.rotation.x = wind < 0.25 ? -2.4 + (0.25 - wind) * 10 : wind < 0.9 ? -2.4 * (0.9 - wind) / 0.65 : Math.sin(time * 2) * 0.2;
              K.armL.rotation.x = Math.sin(time * 2 + 1) * 0.25;
              if (wind < 0.9) zone(C.x - CX, C.y - CZ + 30, 90, 1 - wind / 0.9, true);
              if (K.lastHit != null && C.hitT > K.lastHit + 0.5) { landing(C.x - CX, C.y - CZ + 30, 90); const hp = K.head.getWorldPosition(v3); fx.explosion(hp.x, 4, hp.z + 20, 14, { n: 14, rocks: 8, shake: 0, rockCol: '#5a5060' }); }
              K.lastHit = C.hitT;
              const pulse = 0.5 + 0.5 * Math.sin(time * 5);
              K.core.scale.setScalar(32 + pulse * 14); K.rune.scale.setScalar(22 + pulse * 8 + (wind < 0.9 ? 20 : 0));
              K.eyes.forEach(e => e.scale.setScalar(14 + pulse * 6));
            } else if (C.type === 'tank') {
              K.g.scale.setScalar(1); blob(C.x - CX, C.y - CZ, 120, 140);
              K.turret.rotation.y = Math.atan2(S.squad.x - C.x, SQUAD_Y - C.y) * 0.9;
              // Wheels turn with the sweep; dust kicks up behind the tracks while it moves.
              const dx = K.lastX == null ? 0 : C.x - K.lastX; K.lastX = C.x;
              K.wheels.forEach(w => { w.rotation.x += (dx + (C.arrived ? 0 : SCROLL_V * dt)) * 0.12; });
              if ((Math.abs(dx) > 0.3 || !C.arrived) && Math.random() < dt * 14) for (const sx of [-1, 1]) puff(C.x - CX + sx * 46, 4, C.y - CZ - 58, 6, 0.9, SMOKE_L, 8);
              K.visor.scale.setScalar(40 + 8 * Math.sin(time * 6));
              K.barrels.forEach(b => { b.position.z += (50 - b.position.z) * Math.min(1, dt * 6); syncInk(b); });
            } else if (C.type === 'ejder') {
              K.g.scale.setScalar(1.6);
              const fly = 115 + Math.sin(time * 2.2) * 8 + (1 - inE) * 280;
              K.g.position.y = fly;
              K.g.rotation.z = Math.max(-0.35, Math.min(0.35, Math.cos(C.t * 0.38) * -0.3));
              blob(C.x - CX, C.y - CZ, 170, 120);
              // Wings flap (faster while climbing in), tail and neck sway, the head tracks the squad.
              const flap = Math.sin(time * (inK < 1 ? 9 : 5.5));
              K.wings.forEach(({ w, sx }) => { w.rotation.z = sx * (0.05 + flap * 0.38); w.rotation.x = 0.15 + flap * 0.06; }); // shallow flap: the membranes stay readable from the high camera
              K.tail.forEach((t0, k) => { t0.position.x = Math.sin(time * 2.4 - k * 0.6) * (k * 2.4); syncInk(t0); });
              K.tipSpike.position.x = Math.sin(time * 2.4 - 6 * 0.6) * 15;
              K.neck.forEach((n0, k) => { n0.position.x = Math.sin(time * 1.6 + k * 0.5) * k * 0.8; syncInk(n0); });
              K.head.rotation.y = Math.max(-0.6, Math.min(0.6, (S.squad.x - C.x) * 0.006)); K.head.rotation.x = 0.35;
              // Breath: the jaw opens and the throat glows just before fireballs leave.
              K.breathT = Math.max(0, K.breathT - dt);
              K.jaw.rotation.x = K.breathT > 0 ? 0.6 : 0.08 + 0.05 * Math.sin(time * 3);
              K.mouth.visible = K.breathT > 0; if (K.breathT > 0) K.mouth.scale.setScalar(26 + 10 * Math.sin(time * 30));
              K.bellyGlow.material.opacity = 0.55 + 0.25 * Math.sin(time * 4) + K.breathT;
              K.aura.material.opacity = 0.3 + 0.1 * Math.sin(time * 2);
              K.eyes.forEach(e => e.scale.setScalar(12 + 4 * Math.sin(time * 7)));
              if (Math.random() < dt * 10) { const mp = K.mouthTip.getWorldPosition(v3); fx.mote(mp.x, mp.y, mp.z, Math.random() < 0.5 ? '#ff9a3a' : '#ffd23f', 1, 0.8, 10); }
              if (inK < 1 && !K.roared && inK > 0.85) { K.roared = true; K.breathT = 0.6; const mp = K.mouthTip.getWorldPosition(v3); fx.shower(mp.x, mp.y, mp.z, 0, 1, '#ff8a2a', 16); }
            } else {
              K.g.scale.setScalar(1.4); K.g.position.y = 120 + Math.sin(time * 2) * 5 + (1 - inE) * 240;
              K.g.rotation.z = Math.max(-0.3, Math.min(0.3, (S.squad.x - C.x) * -0.004)); K.g.rotation.x = 0.08 + Math.sin(time * 1.3) * 0.03;
              K.rotor.rotation.y += dt * 30; K.tailRotor.rotation.x += dt * 40;
              K.spin = Math.max(0, K.spin - dt * 2); K.barrels.forEach(b => { b.rotation.z += dt * (4 + K.spin * 40); });
              K.nav[0].visible = K.nav[1].visible = Math.sin(time * 6) > -0.3; K.nav[2].visible = (time * 1.4) % 1 < 0.12;
              K.exhaust.forEach((e, i) => e.scale.setScalar(18 + 3 * Math.sin(time * 30 + i)));
              K.aura.material.opacity = 0.45 + 0.12 * Math.sin(time * 2.3) + K.spin * 0.25;
              // Searchlight sweeps the road ahead of the squad; its pool of light lands on the asphalt.
              const sw = Math.sin(time * 0.9) * 0.35; K.beam.rotation.set(-0.55, 0, sw); K.beam.material.opacity = 0.16 + 0.04 * Math.sin(time * 7);
              K.spot.visible = true; K.spot.position.set(C.x - CX - sw * 190, 1.6, C.y - CZ + 150);
              blob(C.x - CX, C.y - CZ, 140, 120);
              // Storm around the gunship: every so often a violet/green bolt forks through the sky beside it.
              if ((skyBoltT -= dt) <= 0 && C.arrived) {
                skyBoltT = rnd(1.4, 2.8);
                const hx = C.x - CX, hy = K.g.position.y + 30, hz = C.y - CZ, sd = Math.random() < 0.5 ? -1 : 1;
                fx.bolt(hx + sd * 40, hy + rnd(20, 60), hz - 20, hx + sd * rnd(150, 260), hy + rnd(-20, 70), hz + rnd(-80, 40), { w: 1.6, life: 0.32, branches: 2, sparks: 0, colA: Math.random() < 0.5 ? '#b04dff' : '#7dff4a', colB: '#e6c8ff' });
              }
            }
            if (C.type !== 'heli') L.bosses.heli.spot.visible = false;
            if (C.type === 'kale') K.braziers.forEach((b, i) => { b.scale.setScalar(28 + 5 * Math.sin(time * 13 + i * 2)); if (Math.random() < dt * 8) fx.mote(C.x - CX + (i ? 26 : -26) * C.w / 150, 14, C.y - CZ + 28, i ? '#ffb040' : '#ff7a2a', 1, 1.2, 9); });
            // Boss fire: a new cannon shell / bomb gets a muzzle flash at the gun and, for the gunship and the castle,
            // a short crackle of lightning (the boss "charging" its attack).
            for (const sh of S.shells) if (sh.foe && !seenFx.has(sh)) {
              seenFx.add(sh);
              let mx = sh.x0 - CX, my = 40, mz = sh.y0 - CZ;
              const gun = C.type === 'tank' ? K.tip : C.type === 'kale' ? K.tips[sh.x0 < C.x ? 0 : 1] : C.type === 'heli' ? K.guns[sh.x0 < C.x ? 0 : 1] : C.type === 'ejder' ? K.mouthTip : null;
              if (C.type === 'ejder') K.breathT = 0.7;
              if (C.type === 'tank') K.barrels.forEach(b => { b.position.z = 42; });
              if (gun) { const gp = gun.getWorldPosition(v3); mx = gp.x; my = gp.y; mz = gp.z; }
              fx.muzzle(mx, my, mz, (sh.x1 - sh.x0) * 0.2, sh.y1 - sh.y0, '#ff9a3a', 2.2); fx.shower(mx, my, mz, 0, 1, '#ffb040', 8);
              for (let k = 0; k < 4; k++) puff(mx, my, mz + 6, 6, 0.9, SMOKE_M, 10);
              if (C.type === 'heli' || C.type === 'kale') for (let k = 0; k < 2; k++) {
                const a = rnd(-1.2, 1.2); fx.bolt(mx, my, mz, mx + Math.sin(a) * rnd(60, 120), my + rnd(-10, 40), mz + Math.cos(a) * rnd(30, 70), { w: 1.1, life: 0.22, branches: 1, colA: '#b04dff', colB: '#7dff4a' });
              }
              if (C.type === 'heli') K.spin = 1;
            }
            K.wallMat.emissive.setRGB(C.flash * 0.35, C.flash * 0.15, C.flash * 0.1);
            // Hits on the boss: sparks and chips bursting off its surface (throttled), bigger for rockets/lasers.
            if (C.flash > 0.9 && (K.hitFx = (K.hitFx || 0) - dt) <= 0) {
              K.hitFx = 0.07;
              const hy = { kale: 50, dev: 70, tank: 30, heli: K.g.position.y, ejder: K.g.position.y }[C.type];
              const hx = C.x - CX + rnd(-0.4, 0.4) * C.w, hz = C.y - CZ + rnd(10, 30);
              fx.impact(hx, hy + rnd(-12, 12), hz, C.type === 'ejder' ? '#ffb04a' : '#ffe08a', 0.9, Math.random() < 0.5 ? 2 : 0, C.type === 'ejder' ? '#7a1020' : '#5a5f68');
            }
            K.towers.forEach((tw, k) => { tw.flag.rotation.y = Math.sin(time * 3 + k) * 0.35; });
            // Damaged fortress smokes.
            const dmg = 1 - C.hp / C.max;
            if (dmg > 0.3 && (K.smokeT -= dt) <= 0) {
              K.smokeT = 0.5 - dmg * 0.35;
              puff(C.x - CX + (Math.random() - 0.5) * C.w, 60 + Math.random() * 40, C.y - CZ + 10, 8 + dmg * 10, 2.2, C_(dmg > 0.65 ? '#3b3b3b' : '#7a7a7a'), 22);
            }
          }

          // Soldiers.
          const q = S.squad, gun = GUNS[info.weapon.gun || 0];
          const form = info.formation, dir = -1, s = 2.3; // V2: soldiers drawn ~30% bigger (players found them tiny)
          const bodyC = C_(q.flash > 0 ? '#ffffff' : info.skin), helmC = C_(info.skin).multiplyScalar(0.55);
          const isTube = gun[0] === 'tube', gm = isTube ? gunTube : gunBox;
          gunBox.material.color.set(gun[4]); gunTube.material.color.set(gun[4]);
          gunTube.material.emissive = gunTube.material.emissive || new T.Color(); gunTube.material.emissive.set(gun[5] || '#000000');
          let n = 0, nl = 0, ng = 0, nh = 0, nct = 0;
          const flashOn = S.fireFlash > 0 && info.playing;
          const gk = GEAR[info.gear] || GEAR.mavi, beretC = C_(gk.beret || '#ffffff'), plumeC = C_(gk.plume || '#ffffff'), capeC = C_(gk.cape || '#ffffff');
          for (const m of [squad.torso, squad.armL, squad.armR, squad.helmet]) { if (m.material.emissive) m.material.emissive.setScalar(gk.glow ? gk.glow * (0.7 + 0.3 * Math.sin(time * 3)) : 0); }
          // The squad's own soldiers (full detail), then the filler marchers (lite parts) that make the crowd look dense.
          const nDet = Math.min(form.length, MAX_S), fill = lowFx ? [] : fillersFor(q.n, form), total = nDet + fill.length;
          for (let i = 0; i < total; i++) {
            const det = i < nDet, p = det ? form[i] : fill[i - nDet], B = det ? squad : lite, k = det ? n : nl;
            const x = q.x + p.x - CX, z = SQUAD_Y + p.y - CZ, ph = time * 14 + i * 1.7, sw = info.playing ? Math.sin(ph) * 0.7 : 0;
            const bob = info.playing ? Math.abs(Math.sin(ph)) * 0.9 : 0;
            if (det) blob(x, z + 1, 11 * s * 0.9, 9 * s * 0.9);
            put(B.legL, k, x - 1.7 * s, 6.6 * s, z, s, s, s, sw, 0, 0);
            put(B.legR, k, x + 1.7 * s, 6.6 * s, z, s, s, s, -sw, 0, 0);
            put(B.torso, k, x, (9.6 + bob) * s, z, s, s, s, 0.12 * dir, 0, 0, bodyC);
            // Both arms forward on the weapon, a little recoil kick when firing.
            const kick = flashOn ? 0.15 : 0;
            put(B.armL, k, x - 3.3 * s, (12.4 + bob) * s, z, s, s, s, -1.25 - kick, 0, -0.35, bodyC);
            put(B.armR, k, x + 3.3 * s, (12.4 + bob) * s, z, s, s, s, -1.35 - kick, 0, 0.2, bodyC);
            put(B.head, k, x, (15.8 + bob) * s, z, s, s, s);
            if (det) {
              put(squad.belt, n, x, (7.6 + bob) * s, z + 0.25 * s, s, s, s, 0.12 * dir, 0, 0);
              put(squad.eyes, n, x, (15.9 + bob) * s, z - 2.45 * s, s, s, s);
              put(squad.pack, n, x, (10.4 + bob) * s, z - dir * 3.3 * s, s, s, s);
            }
            if (gk.hat !== 'beret' && gk.hat !== 'crown') put(B.helmet, k, x, (16.4 + bob) * s, z, s, 0.85 * s, s, 0, 0, 0, helmC); else put(B.helmet, k, x, -50, z, 0.01, 0.01, 0.01);
            const hy = (16.4 + bob) * s;
            if (gk.hat === 'beret') put(gear.beret, ng, x, hy + 1 * s, z, s, s, s, 0, 0, 0.22, beretC);
            else if (gk.hat === 'plume') put(gear.plume, ng, x, hy + 3.4 * s, z + 1 * s, s, s, s, 0.5, 0, 0, plumeC);
            else if (gk.hat === 'spike') put(gear.spike, ng, x, hy + 3.4 * s, z, s, s, s);
            else if (gk.hat === 'horns') { put(gear.horn, nh++, x - 2.4 * s, hy + 1 * s, z, s, s, s, 0, 0, 0.7); put(gear.horn, nh++, x + 2.4 * s, hy + 1 * s, z, s, s, s, 0, 0, -0.7); }
            else if (gk.hat === 'crown') { put(gear.crown, ng, x, hy + 0.2 * s, z, s, s, s, 0, time * 0.5, 0); for (let k2 = 0; k2 < 5; k2++) { const a = time * 0.5 + k2 / 5 * TAU; put(gear.crownTip, nct++, x + Math.sin(a) * 2.9 * s, hy + 1.9 * s, z + Math.cos(a) * 2.9 * s, s, s, s); } }
            if (gk.cape) put(gear.cape, ng, x, (14.2 + bob) * s, z + 4.8 * s, s, s, s, 0.25 + (info.playing ? 0.12 + Math.sin(ph) * 0.1 : 0), 0, 0, capeC);
            if (isTube) put(gm, ng, x + 2.8 * s, (14.2 + bob) * s, z + dir * 1.5 * s, gun[1] * s, gun[2] * s, gun[3] * s);
            else put(gm, ng, x + 2.6 * s, (10.8 + bob) * s, z + dir * (gun[3] / 2 + 1.5) * s, gun[1] * s, gun[2] * s, gun[3] * s);
            ng++; if (det) n++; else nl++;
          }
          for (const m of [squad.legL, squad.legR, squad.armL, squad.armR, squad.torso, squad.belt, squad.head, squad.eyes, squad.helmet, squad.pack]) done(m, n);
          for (const k in lite) done(lite[k], nl);
          done(gear.beret, gk.hat === 'beret' ? ng : 0); done(gear.plume, gk.hat === 'plume' ? ng : 0); done(gear.spike, gk.hat === 'spike' ? ng : 0);
          done(gear.crown, gk.hat === 'crown' ? ng : 0); done(gear.horn, nh); done(gear.crownTip, nct); done(gear.cape, gk.cape ? ng : 0);
          // Skin trail: a few particles rising off the marching squad.
          if (gk.fx && info.playing && form.length) for (let k = 0; k < 2; k++) if (Math.random() < dt * 30) {
            const f0 = form[(Math.random() * Math.min(form.length, MAX_S)) | 0], col0 = gk.fxc[(Math.random() * gk.fxc.length) | 0];
            fx.emit(q.x + f0.x - CX + (Math.random() - 0.5) * 6, gk.fx === 'ice' ? 30 : 4 + Math.random() * 20, SQUAD_Y + f0.y - CZ + 4, (Math.random() - 0.5) * 8, gk.fx === 'ice' ? -14 : gk.fx === 'fire' ? 26 : 12, gk.fx === 'fire' ? 30 : 8, 0.7 + Math.random() * 0.5, 2.4, 0.6, col0, 0.9, 0, 0, 0, gk.fx === 'sparkle' ? 1 : 0);
          }
          done(gm, ng); done(isTube ? gunBox : gunTube, 0);
          muzzleLight.intensity = flashOn ? 3.5 : 0;
          muzzleLight.position.set(q.x - CX, 24, SQUAD_Y - CZ - 18);
          // Enemy flood.
          let ne2 = 0, nclub = 0, nsh2 = 0, nri = 0, nbm = 0;
          const foeC = C_('#e0353d'), bruteC = C_('#7d1624'), hitC = C_('#ffd0d5'), foeHelm = C_('#2a1216');
          const KIND_C = { runner: C_('#ff8a2a'), sniper: C_('#6d1a24'), shield: C_('#b02a4a'), bomber: C_('#2a2a2a') };
          for (let i = 0; i < S.enemies.length && ne2 < MAX_E; i++) {
            const e = S.enemies[i], sc = e.brute ? 3.5 : 2.05, x = e.x - CX, z = e.y - CZ, ph = time * 16 + i * 1.3, sw = Math.sin(ph) * 0.8;
            const bob = Math.abs(Math.sin(ph)) * 1;
            blob(x, z, 10 * sc, 8 * sc);
            const tc = e.flash > 0 ? hitC : e.brute ? bruteC : KIND_C[e.kind] || foeC;
            put(foes.legL, ne2, x - 1.7 * sc, 6.6 * sc, z, sc, sc, sc, sw, 0, 0);
            put(foes.legR, ne2, x + 1.7 * sc, 6.6 * sc, z, sc, sc, sc, -sw, 0, 0);
            put(foes.torso, ne2, x, (9.6 + bob) * sc, z, sc, sc, sc, 0.25, 0, 0, tc);
            put(foes.belt, ne2, x, (7.6 + bob) * sc, z + 0.5 * sc, sc, sc, sc, 0.25, 0, 0);
            put(foes.armL, ne2, x - 3.3 * sc, (12.6 + bob) * sc, z + 0.9 * sc, sc, sc, sc, -sw * 1.1, 0, -0.3, tc);
            put(foes.armR, ne2, x + 3.3 * sc, (12.6 + bob) * sc, z + 0.9 * sc, sc, sc, sc, e.brute ? -1.2 : sw * 1.1, 0, 0.3, tc);
            put(foes.head, ne2, x, (15.8 + bob) * sc, z + 0.8 * sc, sc, sc, sc);
            put(foes.eyes, ne2, x, (15.9 + bob) * sc, z + 3.2 * sc, sc, sc, sc);
            put(foes.helmet, ne2, x, (16.4 + bob) * sc, z + 0.8 * sc, sc, 0.9 * sc, sc, 0, 0, 0, foeHelm);
            put(foes.spike, ne2, x, (20.4 + bob) * sc, z + 0.8 * sc, sc, sc, sc);
            if (e.brute && nclub < 40) put(foes.club, nclub++, x + 4.5 * sc, (12 + bob) * sc, z + 2 * sc, sc, sc, sc, -0.9 + Math.sin(ph * 0.5) * 0.4, 0, 0);
            if (e.kind === 'shield' && nsh2 < 80) put(foeShield, nsh2++, x, (10 + bob) * sc, z + 4.5 * sc, sc, sc, sc);
            if (e.kind === 'sniper' && nri < 80) put(foeRifle, nri++, x + 2.6 * sc, (11 + bob) * sc, z + 7 * sc, sc, sc, sc, -0.08, 0, 0);
            if (e.kind === 'bomber' && nbm < 80) { const k = sc * (1 + Math.sin(time * 14 + i) * 0.15); put(foeBomb, nbm++, x, (11 + bob) * sc, z - 3.5 * sc, k, k, k, 0, 0, 0, Math.sin(time * 14 + i) > 0 ? BOMB_A : BOMB_B); }
            ne2++;
          }
          for (const m of [foes.legL, foes.legR, foes.armL, foes.armR, foes.torso, foes.belt, foes.head, foes.eyes, foes.helmet, foes.spike]) done(m, ne2);
          done(foes.club, nclub); done(foeShield, nsh2); done(foeRifle, nri); done(foeBomb, nbm);
          // Mines and enemy bullets.
          let nmi = 0;
          for (const m of S.mines) {
            put(mineBody, nmi, m.x - CX, 2, m.y - CZ, 1, 1, 1);
            const k = Math.sin(time * 10 + m.id) > 0 ? 1.2 : 0.6;
            put(mineLight, nmi++, m.x - CX, 5, m.y - CZ, k, k, k);
          }
          done(mineBody, nmi); done(mineLight, nmi);
          let neb = 0, nEm = 0;
          const heliGuns = C && C.type === 'heli' && !C.dead ? L.bosses.heli.guns : null;
          for (const b of S.ebullets) {
            if (neb >= 300) break;
            const a = Math.atan2(b.vx, b.vy);
            put(eShots, neb, b.x - CX, 12, b.y - CZ, 8, 8, 34, 0, a, 0); put(eCore, neb++, b.x - CX, 12, b.y - CZ, 2.4, 2.4, 26, 0, a, 0);
            // A new enemy burst: muzzle flash at the gun (the helicopter's pods, or the shooter on the road).
            if (!seenB.has(b)) {
              seenB.add(b);
              if (nEm++ < 6) {
                if (heliGuns) { L.bosses.heli.spin = 1; const gp = heliGuns[nEm % 2].getWorldPosition(v3); fx.muzzle(gp.x, gp.y, gp.z, b.vx, b.vy, '#ff8a3a', 1.1); fx.shower(gp.x, gp.y, gp.z, 0, 1, '#ffb040', 3); }
                else fx.muzzle(b.x - CX, 14, b.y - CZ, b.vx, b.vy, '#ff6a3a', 0.6);
              }
            }
          }
          done(eShots, neb); done(eCore, neb);

          // Projectiles.
          const wc = info.weapon.color;
          tracers.material.color.set(wc); tracerCore.material.color.set(wc).lerp(WHITE, 0.75);
          let nb = 0, nr2 = 0, nfire = 0, nMz = 0, nImp = 0;
          // Bullets that died since the last frame hit something (the off-screen ones end beyond y -60): sparks there.
          for (const b of prevBullets) if (b.dead && b.y > -55 && b.kind !== 'rocket' && nImp++ < 10) fx.impact(b.x - CX, 14, b.y - CZ, wc, b.kind === 'laser' ? 0.45 : 0.55, Math.random() < 0.3 ? 1 : 0, '#4a4256');
          prevBullets = S.bullets;
          for (const b of S.bullets) {
            // Door-gunner rounds from the support helicopter start up at the door and dip toward the road.
            const x = b.x - CX, z = b.y - CZ, y = b.heli ? 15.5 + 80 * Math.max(0, 1 - (b.y0 - b.y) / 150) : 15.5;
            // A new bullet: muzzle flash where that soldier stands (the volley comes from the whole squad).
            if (!seenB.has(b)) { seenB.add(b); if (b.heli) fx.muzzle(x, y, z, b.vx, -b.speed, '#ffd27a', 0.9); else if (nMz++ < 14) fx.muzzle(x, y, z, b.vx, -b.speed, wc, b.kind === 'rocket' ? 1.2 : b.kind === 'pellet' ? 0.85 : 0.75); }
            if (b.kind === 'rocket') {
              if (nr2 < 200) put(rockets, nr2++, x, y, z, 1.7, 1.7, 9);
              if (nfire < MAX_FX) put(fire, nfire++, x, y, z + 6.5, 2.2, 2.2, 4 + Math.random() * 3, 0, 0, 0, FIRE_B);
              fx.trail(x, y, z + 7, '#ff8a3a', 1.6, 0.28);
              if (Math.random() < 0.25) puff(x, y, z + 8, 2.6, 0.6, SMOKE_L, 6);
            } else if (nb < MAX_B) {
              const a = Math.atan2(b.vx, -b.speed), L = b.kind === 'laser' ? 80 : b.kind === 'pellet' ? 24 : 36, w = b.kind === 'laser' ? 6 : 8;
              put(tracers, nb, x, y, z, w, w, L, 0, a, 0); put(tracerCore, nb++, x, y, z, w * 0.3, w * 0.3, L * 0.8, 0, a, 0);
            }
          }
          done(tracers, nb); done(tracerCore, nb);
          // Mortar shells with smoke trail + landing markers.
          let nsh = 0, nmk = 0;
          for (const sh of S.shells) {
            if (sh.u < 0) continue; // a queued fireball of the drake's fan
            const ss = sh.foe ? 5 : 3.2, sx0 = sh.x - CX, sy0 = sh.h + 4, sz0 = sh.y - CZ;
            if (sh.fire) {
              // Drake fireball: a burning core with a fire-and-smoke trail.
              if (nfire < MAX_FX) put(fire, nfire++, sx0, sy0, sz0, 7, 7, 7, 0, 0, 0, FIRE_A);
              if (nfire < MAX_FX) put(fire, nfire++, sx0, sy0, sz0, 4, 4, 4, 0, 0, 0, WHITE);
              fx.trail(sx0, sy0, sz0, Math.random() < 0.5 ? '#ff7a1a' : '#ffd23f', 2.2, 0.35);
              if (Math.random() < 0.5) puff(sx0, sy0, sz0, 4, 0.7, C_('#4a3a36'), 6);
            } else {
              put(shells, nsh++, sx0, sy0, sz0, ss, ss, ss);
              if (Math.random() < 0.4) puff(sx0, sy0, sz0, 2.4, 0.8, SMOKE_S, 4);
            }
            if (sh.foe) zone(sh.x1 - CX, sh.y1 - CZ, sh.fire ? 52 : 58, sh.u, true);
            else { const k = 10 + 26 * (1 - sh.u) + Math.sin(time * 18) * 2; put(markers, nmk++, sh.x1 - CX, 1.2, sh.y1 - CZ, k, 1, k, 0, 0, 0, MK_OWN); }
          }
          // Missile strike: missiles dive on a slant with a bright exhaust and smoke; yellow target zones on the road.
          let nmsl = 0;
          for (const m of S.missiles) {
            zone(m.tx - CX, m.ty - CZ, 50, m.delay > 0 ? 0.05 : m.u, false);
            if (m.delay > 0) continue;
            const mx = m.x - CX, my = m.h + 6, mz = m.y - CZ, dx = m.tx - m.x0, dz = m.ty - m.y0, len = Math.hypot(dx, 520, dz);
            dummy.position.set(mx, my, mz); dummy.quaternion.setFromUnitVectors(v3.set(0, 0, 1), new T.Vector3(dx / len, -520 / len, dz / len)); dummy.scale.set(2.4, 2.4, 14); dummy.updateMatrix();
            if (nr2 < 200) rockets.setMatrixAt(nr2++, dummy.matrix);
            const bx = mx - dx / len * 9, by = my + 520 / len * 9, bz = mz - dz / len * 9;
            if (nfire < MAX_FX) put(fire, nfire++, bx, by, bz, 3, 3, 3, 0, 0, 0, FIRE_A);
            fx.trail(bx, by, bz, '#ffb04a', 2, 0.3); if (Math.random() < 0.6) puff(bx, by, bz, 4, 1.1, SMOKE_L, 2);
            nmsl++;
          }
          done(rockets, nr2);
          done(shells, nsh);
          // Bombers.
          planes.forEach((p, i) => {
            const pl = S.planes[i];
            p.g.visible = !!pl;
            if (!pl) return;
            p.g.position.set(pl.x - CX + Math.sin(time * 1.3 + i) * 6, 150 + Math.sin(time * 2 + i) * 4, pl.y - CZ);
            blob(pl.x - CX + 60, pl.y - CZ + 60, 170, 90);
            p.g.rotation.set(0.05, 0, Math.sin(time * 1.3 + i) * 0.12);
            p.props.forEach(pr => { pr.rotation.z += dt * 40; });
          });
          let nbo = 0;
          for (const b of S.bombs) {
            put(bombs, nbo++, b.x - CX, b.h + 3, b.y - CZ, 1, 1, 1, Math.PI / 2 - Math.min(1.3, -b.vh / 400), 0, 0);
            const k = 6 + b.h / 12;
            put(markers, nmk++, b.x - CX, 1.2, b.y - CZ, k, 1, k, 0, 0, 0, MK_OWN);
          }
          done(bombs, nbo); done(markers, nmk);
          // Mortar teams.
          mortars.forEach((m, i) => {
            const mt = S.mortars[i];
            m.g.visible = !!mt;
            if (!mt) return;
            m.g.position.set(mt.x - CX, 0, mt.y - CZ);
            blob(mt.x - CX, mt.y - CZ, 30, 30);
            m.tube.position.z = mt.recoil * 3; m.tube.position.y = 2 - mt.recoil * 1.2;
            m.crew.userData.body.material.color.set(info.skin);
            if (mt.recoil > 0.97) { puff(mt.x - CX, 28, mt.y - CZ - 18, 5, 0.9, SMOKE_M, 12); if (nfire < MAX_FX) put(fire, nfire++, mt.x - CX, 28, mt.y - CZ - 18, 6, 6, 6, 0, 0, 0, FIRE_A); if (!m.fired) fx.muzzle(mt.x - CX, 30, mt.y - CZ - 18, 0, -1, '#ffb040', 1.6); m.fired = true; } else m.fired = false;
          });

          // Light flashes of the explosions (pooled additive sprites).
          for (const q of booms) if (q.life > 0) { q.life -= dt; const t = 1 - q.life / q.max; q.s.scale.setScalar(q.size * (0.6 + 0.6 * t)); q.s.material.opacity = Math.max(0, 1 - t * t); if (q.life <= 0) q.s.visible = false; }
          // Explosions: fireball + shockwave + smoke + debris.
          let nring = 0, strongest = 0, bx = 0, bz = 0;
          for (const f of S.fx) {
            if (f.delay > 0) continue;
            const x = f.x - CX, z = f.y - CZ;
            if (!seenFx.has(f)) {
              seenFx.add(f); boomFlash(x, 14, z, f.big ? f.r * 3.2 : f.r * 2.2, f.big ? 0.45 : 0.3);
              const n2 = f.big ? 10 : 5;
              for (let k = 0; k < n2; k++) puff(x + (Math.random() - 0.5) * f.r * 0.8, 6 + Math.random() * 10, z + (Math.random() - 0.5) * f.r * 0.8, f.r * (0.28 + Math.random() * 0.2), 1.6 + Math.random(), C_(k % 2 ? '#5e5650' : '#7d746c'), 16 + Math.random() * 20);
              // Flash, embers, sparks, flying stone chips and a scorch mark (the game drives the shake itself).
              fx.explosion(x, 10, z, f.r * 0.55, { n: f.big ? 22 : 12, rocks: f.big ? 10 : 5, shake: 0, rockCol: '#3c3644' });
            }
            const p = 1 - f.life, grow = 1 - Math.pow(1 - Math.min(1, p * 2.2), 3);
            const r = f.r * (0.35 + 0.75 * grow) * (1 - p * 0.25);
            tmpC.copy(FIRE_A).lerp(FIRE_B, Math.min(1, p * 2.2)).lerp(FIRE_C, Math.max(0, p * 1.6 - 0.6));
            if (nfire < MAX_FX) put(fire, nfire++, x, r * 0.55, z, r, r * 0.85, r, 0, 0, 0, tmpC);
            if (nfire < MAX_FX && p < 0.4) put(fire, nfire++, x, r * 0.2, z, r * 0.55, r * 1.5, r * 0.55, 0, 0, 0, FIRE_A);
            if (nring < 60) { const rr = f.r * (0.4 + p * 1.9); put(rings, nring++, x, 1.5, z, rr, 1, rr, 0, 0, 0, tmpC.copy(FIRE_B).multiplyScalar(Math.max(0, 1 - p * 1.4))); }
            const st = f.life * (f.big ? 2 : 1);
            if (st > strongest) { strongest = st; bx = x; bz = z; }
          }
          for (let i = ringFx.length - 1; i >= 0; i--) {
            const r0 = ringFx[i]; r0.t += dt;
            const u = r0.t / 0.6; if (u >= 1) { ringFx.splice(i, 1); continue; }
            if (nring < 60) put(rings, nring++, r0.x, 1.6, r0.z, r0.r * (0.3 + u), 1, r0.r * (0.3 + u), 0, 0, 0, tmpC.copy(r0.c).multiplyScalar(1 - u));
          }
          done(rings, nring);
          boomLight.intensity = strongest * 6; boomLight.position.set(bx, 40, bz);
          // Particles from the game (hit sparks, kills): handed to the GPU system once, when they appear.
          for (const p0 of S.parts) if (!seenFx.has(p0)) { seenFx.add(p0); fx.emit(p0.x - CX, 8, p0.y - CZ, p0.vx * 1.3, rnd(50, 130), p0.vy * 1.3, rnd(0.35, 0.6), 2.6, 0.6, p0.c, 1, 320, 3, 0.03, 2); }
          // Smoke puffs.
          let npf = 0;
          for (const p0 of puffs) {
            p0.life -= dt; p0.x += p0.vx * dt; p0.y += p0.vy * dt; p0.z += p0.vz * dt; p0.vy *= 0.97;
            // Road-fixed smoke drifts toward the camera with the road.
            if (!(C && C.arrived)) p0.z += 70 * dt;
            const a = 1 - p0.life / p0.max, k = p0.size * (0.6 + a * 1.4) * Math.min(1, p0.life * 2.5);
            if (npf < MAX_FX && k > 0) put(smoke, npf++, p0.x, p0.y, p0.z, k, k * 0.85, k, a, a * 2, 0, p0.c);
          }
          for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].life <= 0) puffs.splice(i, 1);
          done(smoke, npf); done(fire, nfire); done(blobs, nBlob);
          fx.update(dt);

          // The camera leans a little toward the squad's side of the road (parallax) and sways with the run.
          camX += ((S.squad.x - CX) * 0.1 - camX) * Math.min(1, dt * 3);
          camera.position.copy(camBase); camera.position.x += camX; if (info.playing) camera.position.y += Math.sin(time * 7) * 0.6;
          if (S.shake) camera.position.add(v3.set((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake, 0));
          // Renderer-side kicks (boss landing / death) on top of the game's shake.
          camKick = Math.max(0, camKick - dt * 30);
          if (camKick) camera.position.add(v3.set((Math.random() - 0.5) * camKick, (Math.random() - 0.5) * camKick, 0));
          done(zones, nZone); done(zoneRims, nmkZ);
          support(S, info, time, dt);
          renderer.render(scene, camera);
        },
      };
      return R;
    },
  };
})();
