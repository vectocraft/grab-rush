// 3D renderer for Sürü Seli (Three.js). The game keeps 2D coordinates (x 0..400 across, y along the road,
// squad near y 610); here X = x - 200, Z = y - 360. Lanes are drawn as tiles keyed by road position so a
// widening road (2 -> 3 lanes) scrolls in with the asphalt. Suru3D.init() returns null without WebGL; the game
// then uses its 2D renderer.
(function () {
  'use strict';
  if (!window.THREE) return;
  const T = window.THREE;
  const CX = 200, CZ = 360, SQUAD_Y = 610, TILE = 60, NEAR_Y = 1050, FAR_Y = -1800;
  const MAX_S = 64, MAX_E = 240, MAX_B = 800, MAX_FX = 400;
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
  const skyTex = () => tex(4, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#2f86e8'); grd.addColorStop(0.5, '#7cc4ff'); grd.addColorStop(1, '#e8f6ff');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });

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
      let renderer;
      try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: !!(opts && opts.alpha), preserveDrawingBuffer: !!(opts && opts.alpha) }); } catch (e) { return null; }
      if (!renderer.getContext()) return null;
      let pixelRatio = Math.min(1.5, window.devicePixelRatio || 1);
      renderer.setPixelRatio(pixelRatio);
      renderer.shadowMap.enabled = false;
      if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;

      const scene = new T.Scene();
      scene.background = skyTex();
      scene.fog = new T.Fog(0xcfeaff, 1300, 2900);
      const camera = new T.PerspectiveCamera(46, 1, 10, 3200);
      scene.add(new T.HemisphereLight(0xd6ecff, 0x35583a, 1.2));
      const sun = new T.DirectionalLight(0xfff1dc, 2.3);
      sun.position.set(-220, 420, 160); sun.target.position.set(0, 0, -200);
      scene.add(sun, sun.target);
      const muzzleLight = { position: new T.Vector3(), intensity: 0 }, boomLight = { position: new T.Vector3(), intensity: 0 };

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
      const C_ = s => new T.Color(s);

      const blobTex = tex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 31); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(0.6, 'rgba(0,0,0,.3)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
      const blobs = inst(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }), 520, false, false);
      blobs.renderOrder = 1;
      let nBlob = 0;
      const blob = (x, z, w, d) => { if (nBlob < 520) put(blobs, nBlob++, x, 0.9, z, w, 1, d || w); };

      // ---------- Road (level independent) ----------
      const ROAD_LEN = NEAR_Y - FAR_Y, roadZ = (NEAR_Y + FAR_Y) / 2 - CZ;
      const asphalt = asphaltTex(); asphalt.repeat.set(3, ROAD_LEN / 120);
      const road = add(scene, new T.BoxGeometry(352, 4, ROAD_LEN), std('#e8eef7'), 0, -2, roadZ, false);
      const deck = add(scene, new T.BoxGeometry(372, 26, ROAD_LEN), std('#5d5650'), 0, -17, roadZ, false); // stone embankment under the road
      const curb = curbTex(); curb.repeat.set(1, ROAD_LEN / 40);
      for (const sx of [-1, 1]) add(scene, new T.BoxGeometry(10, 6, ROAD_LEN), std('#ffffff', { map: curb }), sx * 181, 1, roadZ);
      const walkMat = std('#ffffff', { map: paverTex() }); walkMat.map.repeat.set(2, ROAD_LEN / 17); walkMat.map.shared = true;
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
      const cloudMat = new T.MeshLambertMaterial({ color: '#ffffff', emissive: '#b8d8f0', emissiveIntensity: 0.35, flatShading: true });
      for (let i = 0; i < 9; i++) {
        const cl = new T.Group(); cl.position.set((i - 4) * 420 + (i * 97) % 160, 420 + (i * 53) % 180, -2300 - (i % 3) * 200);
        for (let k = 0; k < 4; k++) { const b = new T.Mesh(new T.IcosahedronGeometry(60 + k * 12, 1), cloudMat); b.position.set(k * 70 - 100, (k % 2) * 25, 0); b.scale.y = 0.6; cl.add(b); }
        scene.add(cl);
      }
      // Lane tiles and separators.
      const tileGeo = new T.PlaneGeometry(1, TILE); tileGeo.rotateX(-Math.PI / 2);
      const tilesR = inst(tileGeo, std('#ffffff', { map: laneTile('r') }), 160, false, false);
      const tilesE = inst(tileGeo, std('#ffffff', { map: laneTile('e') }), 160, false, false);
      tilesR.receiveShadow = tilesE.receiveShadow = true;
      const seps = inst(new T.BoxGeometry(1, 1, 1), lam('#ffffff'), 200, true, true);
      const sepCols = [C_('#f4f1ea'), C_('#e23b3b')];
      // Distant hills.
      const hillMat = new T.MeshLambertMaterial({ color: '#5d9d58', flatShading: true });
      const peakMat = new T.MeshLambertMaterial({ color: '#7f93b4', flatShading: true }), snowMat = new T.MeshLambertMaterial({ color: '#f4f8ff', emissive: '#9fb6d8', emissiveIntensity: 0.25, flatShading: true });
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
      const lampHeads = inst(new T.BoxGeometry(12, 2.4, 5), std('#2c333d', { emissive: '#fff2c0', emissiveIntensity: 0.25 }), 24, false, false);
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
        beret: inst(hatGeo.beret, toon('#ffffff'), MAX_S, true, false, 0.35),
        plume: inst(hatGeo.plume, toon('#ffffff'), MAX_S, true, false, 0.3),
        spike: inst(hatGeo.spike, toon('#c9ced6', { emissive: '#222' }), MAX_S, false, false, 0.3),
        horn: inst(hatGeo.horn, toon('#f3ead2'), MAX_S * 2, false, false, 0.3),
        crown: inst(hatGeo.crown, goldM, MAX_S, false, false, 0.3),
        crownTip: inst(hatGeo.crownTip, goldM, MAX_S * 5, false, false),
        cape: inst(hatGeo.cape, toon('#ffffff', { side: T.DoubleSide }), MAX_S, true, false, 0.3),
      };
      gear.crown.material.side = T.DoubleSide;
      const gearTrail = []; // renderer-side trail particles of the skin
      const foes = crowd(MAX_E, { leg: '#3a1418', skin: '#d8a27a', spike: '#c9c9c9', club: true });
      const foeShield = inst(new T.BoxGeometry(11, 13, 1.6), std('#9aa3b0', { emissive: '#1a1f28' }), 80, false, false);
      const foeRifle = inst(new T.BoxGeometry(1.4, 1.8, 14), std('#1c1f24'), 80, false, false);
      const foeBomb = inst(new T.SphereGeometry(3.4, 12, 10), new T.MeshBasicMaterial({ color: '#ffffff' }), 80, true, false);
      const mineBody = inst(new T.CylinderGeometry(9, 10, 4, 16), std('#3a3f36'), 60, false, false);
      const mineLight = inst(new T.SphereGeometry(2.4, 10, 8), new T.MeshBasicMaterial({ color: '#ff2a2a' }), 60, false, false);
      const eShots = inst(new T.BoxGeometry(1, 1, 1), additive('#ff3b3b'), 300, false, false);
      const gunBox = inst(new T.BoxGeometry(1, 1, 1), std('#2b2d33', { metalness: 0.5, roughness: 0.45 }), MAX_S, false, true);
      const tubeGeo = new T.CylinderGeometry(1, 1, 1, 10); tubeGeo.rotateX(Math.PI / 2);
      const gunTube = inst(tubeGeo, std('#4d5a2a', { metalness: 0.3, roughness: 0.5 }), MAX_S, false, true);
      const flashes = inst(new T.IcosahedronGeometry(1, 1), additive('#ffd27a'), 24, false, false);
      // Per weapon: [kind, width, height, length, color, emissive]
      const GUNS = [
        ['box', 1.3, 1.9, 5, '#2b2d33'], ['box', 1.2, 1.7, 12, '#4a3a28'], ['box', 1.9, 2.3, 13, '#1f2328'],
        ['box', 1.6, 1.7, 10, '#6b4423'], ['tube', 2, 2, 14, '#4d5a2a'], ['tube', 1.5, 1.5, 13, '#e6edff', '#39e0ff'],
      ];

      // ---------- Projectiles & effects ----------
      const tracers = inst(new T.BoxGeometry(1, 1, 1), additive('#ffffff'), MAX_B, false, false);
      const rockets = inst(tubeGeo, std('#dfe3e8', { metalness: 0.4, roughness: 0.4 }), 200, false, true);
      const shells = inst(new T.SphereGeometry(1, 10, 8), std('#2a2c30', { metalness: 0.6, roughness: 0.35 }), 60, false, true);
      const bombs = inst(new T.CapsuleGeometry(2.6, 6, 3, 8), std('#3a4030', { metalness: 0.5, roughness: 0.4 }), 60, false, true);
      const markers = inst(new T.RingGeometry(0.75, 1, 28).rotateX(-Math.PI / 2), additive('#ffffff'), 60, true, false);
      const MK_OWN = C_('#ffd23f'), MK_FOE = C_('#ff2a2a');
      const fire = inst(new T.IcosahedronGeometry(1, 2), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false }), MAX_FX, true, false);
      const rings = inst(new T.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: T.AdditiveBlending, depthWrite: false }), 60, true, false);
      const smoke = inst(new T.IcosahedronGeometry(1, 2), new T.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }), MAX_FX, true, false);
      const sparks = inst(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: '#ffffff' }), 500, true, false);
      const puffs = [];   // renderer-side smoke {x,y,z,vx,vy,vz,life,max,size,c}
      const debris = [];  // hot debris {x,y,z,vx,vy,vz,life,c}
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
        const towers = [];
        for (const sx of [-1, 1]) {
          const tw = add(g, new T.CylinderGeometry(22, 25, 96, 18), wallMat, sx * 74, 48, 4);
          for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; add(g, new T.BoxGeometry(8, 9, 8), wallMat, sx * 74 + Math.cos(a) * 21, 100, 4 + Math.sin(a) * 21); }
          add(g, new T.ConeGeometry(27, 40, 18), roof, sx * 74, 124, 4);
          const pole = add(g, new T.CylinderGeometry(0.8, 0.8, 22, 5), darkStone, sx * 74, 154, 4);
          const flag = add(g, new T.PlaneGeometry(20, 12), std('#e23b3b', { side: T.DoubleSide, emissive: '#300' }), sx * 74 + 10, 158, 4, false);
          towers.push({ tw, flag, pole });
          for (const y of [40, 70]) add(g, new T.BoxGeometry(5, 10, 2), std('#1d1410', { emissive: '#ff9a3c', emissiveIntensity: 0.35 }), sx * 74, y, 29);
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
        }
        g.visible = false; root.add(g);
        return { g, wallMat, towers, smokeT: 0 };
      }

      // Giant: a huge brute with a club.
      function makeDev(root) {
        const g = new T.Group(), skin = std('#7d1624'), dark = std('#3a1418');
        for (const sx of [-1, 1]) add(g, new T.CapsuleGeometry(6, 18, 4, 10), dark, sx * 8, 13, 0);
        const body = add(g, new T.CapsuleGeometry(15, 22, 6, 14), skin, 0, 46, 0);
        add(g, new T.SphereGeometry(10, 16, 12), std('#c98a6a'), 0, 76, 3);
        add(g, new T.SphereGeometry(11, 16, 10, 0, TAU, 0, Math.PI / 2), std('#2a1216'), 0, 79, 3);
        for (const sx of [-1, 1]) { const h = add(g, new T.ConeGeometry(3, 12, 8), std('#e8e0d0'), sx * 9, 88, 3); h.rotation.z = -sx * 0.5; }
        for (const sx of [-1, 1]) add(g, new T.SphereGeometry(2, 8, 6), new T.MeshBasicMaterial({ color: '#ffd23f' }), sx * 4, 78, 12);
        const arm = new T.Group(); arm.position.set(18, 58, 0); g.add(arm);
        add(arm, new T.CapsuleGeometry(4.5, 16, 4, 8), skin, 0, -10, 0);
        const club = add(arm, new T.CylinderGeometry(4, 8, 40, 10), std('#6b4423'), 0, -18, 16); club.rotation.x = Math.PI / 2;
        g.visible = false; root.add(g);
        return { g, wallMat: body.material, arm, towers: [], smokeT: 0 };
      }
      function makeTank(root) {
        const g = new T.Group(), hull = std('#5c6b3c'), dark = std('#2b2f25');
        add(g, new T.BoxGeometry(84, 22, 110), hull, 0, 20, 0);
        for (const sx of [-1, 1]) {
          add(g, new T.BoxGeometry(18, 20, 118), dark, sx * 46, 12, 0);
          for (let k = -2; k <= 2; k++) add(g, new T.CylinderGeometry(8, 8, 20, 12), std('#444a3a'), sx * 46, 10, k * 24).rotation.z = Math.PI / 2;
        }
        const turret = new T.Group(); turret.position.set(0, 36, -6); g.add(turret);
        add(turret, new T.CylinderGeometry(26, 30, 18, 16), hull, 0, 0, 0);
        const barrel = add(turret, new T.CylinderGeometry(4, 5, 60, 12), dark, 0, 2, 38); barrel.rotation.x = Math.PI / 2;
        add(turret, new T.BoxGeometry(12, 8, 12), dark, 14, 12, -6);
        add(g, new T.CylinderGeometry(6, 6, 0.5, 16), std('#e23b3b'), 0, 31.5, 34, false);
        g.visible = false; root.add(g);
        return { g, wallMat: hull, turret, towers: [], smokeT: 0 };
      }
      function makeHeli(root) {
        const g = new T.Group(), body = std('#3d4a3a'), dark = std('#1f2420');
        const fus = add(g, new T.CapsuleGeometry(16, 36, 6, 14), body, 0, 0, 0); fus.rotation.x = Math.PI / 2;
        add(g, new T.SphereGeometry(13, 14, 10), std('#9fd8ff', { emissive: '#113a55' }), 0, 4, 24).scale.set(1, 0.8, 1.1);
        const tail = add(g, new T.BoxGeometry(6, 6, 60), body, 0, 4, -52);
        add(g, new T.BoxGeometry(2, 20, 12), body, 0, 12, -80);
        const rotor = new T.Group(); rotor.position.set(0, 20, 0); g.add(rotor);
        for (let k = 0; k < 4; k++) { const b = add(rotor, new T.BoxGeometry(110, 1.2, 7), dark, 0, 0, 0, false); b.rotation.y = k * Math.PI / 2; b.position.set(0, 0, 0); }
        const disc = add(rotor, new T.CircleGeometry(56, 32), new T.MeshBasicMaterial({ color: '#cccccc', transparent: true, opacity: 0.18, side: T.DoubleSide, depthWrite: false }), 0, 0.5, 0, false);
        disc.rotation.x = -Math.PI / 2;
        for (const sx of [-1, 1]) { add(g, new T.BoxGeometry(3, 3, 44), dark, sx * 16, -20, 0); add(g, new T.CylinderGeometry(3, 3, 18, 8), dark, sx * 22, -6, 14).rotation.x = Math.PI / 2; }
        g.visible = false; root.add(g); g.userData.tail = tail;
        return { g, wallMat: body, rotor, towers: [], smokeT: 0 };
      }

      // ---------- Gates & crates ----------
      const glow = glowTex(); glow.shared = true;
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
        const strip = new T.Mesh(new T.PlaneGeometry(g.w + 16, 18).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: glow, color: '#3be07a', transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
        strip.position.y = 0.6; grp.add(strip);
        return { g: grp, panel, beamMat, strip };
      }
      function makeCrate(c) {
        const grp = new T.Group(), mat = std('#ffffff', { map: crateTexs[c.what] || crateTexs.weapon, roughness: 0.8 });
        const box = add(grp, new T.BoxGeometry(40, 34, 34), mat, 0, 17, 0);
        const metal = std(c.what === 'weapon' ? '#ffd23f' : '#c9ced6', { metalness: 0.7, roughness: 0.3, emissive: c.what === 'weapon' ? '#4a3000' : '#000' });
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(grp, new T.BoxGeometry(5, 35, 5), metal, sx * 19, 17, sz * 16);
        return { g: grp, box, mat };
      }

      function warmUp() {
        const hidden = [];
        scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
        try { renderer.compile(scene, camera); } catch (e) { }
        hidden.forEach(o => { o.visible = false; });
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
        _scene: scene, // test hook
        portrait,
        is3D: true,
        setLevel(S) {
          disposeLevel();
          const root = new T.Group(), th = S.theme;
          const land = new T.Color(th.land || '#7cc464').lerp(new T.Color('#3f9a45'), 0.4);
          if (grassMat.map) grassMat.map.dispose();
          grassMat.map = grassTex('#' + land.getHexString()); grassMat.map.repeat.set(26, 26); grassMat.color.set('#ffffff'); grassMat.needsUpdate = true;
          hillMat.color.copy(land).lerp(new T.Color('#9cc7e8'), 0.35);
          waterMat.color.set(th.sea || '#3aa0e8');
          scene.fog.color.set('#d9eeff');
          const castle = makeCastle(root);
          const bosses = { kale: castle, dev: makeDev(root), tank: makeTank(root), heli: makeHeli(root) };
          scene.add(root);
          puffs.length = 0; debris.length = 0;
          level = { root, castle, bosses, gates: new Map(), crates: new Map(), S };
          R.fit();
          if (!warmed) { warmed = true; warmUp(); }
        },

        fit() {
          if (!level) return;
          W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
          renderer.setSize(W, H, false);
          camera.aspect = W / H; camera.updateProjectionMatrix();
          const sa = window.UI && UI.safeArea ? UI.safeArea() : { hudBottom: 90, bottom: 0 };
          const top = sa.hudBottom + 4, bottom = H - sa.bottom - 10, availH = Math.max(100, bottom - top);
          const pts = [[20, 40, 0], [380, 40, 0], [20, 700, 0], [380, 700, 0], [288, 110, 150]].map(([x, y, h]) => new T.Vector3(x - CX, h, y - CZ));
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
          nBlob = 0;
          // Adaptive quality: drop the resolution if the phone cannot keep up.
          perf.acc += dt; perf.n++;
          if (perf.acc > 2.5) {
            const avg = perf.acc / perf.n;
            if (avg > 1 / 45 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); R.fit(); }
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
              put(lampHeads, npo++, d.x - Math.sign(d.x) * 5, 44, z, 1, 1, 1);
            }
          }
          done(trunks, nt); done(crowns, ncw); done(rocks, nro); done(poles, npo); done(lampHeads, npo); done(pines, npi); done(bushes, nbu); done(flags, nfl); done(flagPoles, nfl);

          // Gates.
          const seen = new Set();
          for (const g of S.gates) {
            seen.add(g.id);
            let m = L.gates.get(g.id);
            if (!m) { m = makeGate(g); L.gates.set(g.id, m); L.root.add(m.g); }
            const c = g.mul ? '#ffd23f' : g.val >= 1 ? '#3be07a' : '#ff4757';
            m.panel.material.uniforms.uC.value.set(c); m.panel.material.uniforms.uT.value = time; m.panel.material.uniforms.uF.value = g.flash;
            m.beamMat.color.set(c); m.beamMat.emissive.set(c); m.beamMat.emissiveIntensity = 0.55 + 0.25 * Math.sin(time * 5) + g.flash;
            for (const o of m.g.children) if (o.geometry && o.geometry.type === 'OctahedronGeometry') o.rotation.y = time * 2;
            m.strip.material.color.set(c).multiplyScalar(0.55);
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
          for (const k in L.bosses) L.bosses[k].g.visible = !!(C && !C.dead && C.type === k);
          const K = C ? L.bosses[C.type] || L.castle : L.castle;
          if (C && !C.dead) {
            K.g.position.set(C.x - CX, 0, C.y - CZ);
            if (C.type === 'kale') { K.g.scale.setScalar(C.w / 150); blob(C.x - CX + 8, C.y - CZ + 14, C.w * 1.35, 90); }
            else if (C.type === 'dev') {
              K.g.scale.setScalar(1); blob(C.x - CX, C.y - CZ, 70, 50);
              K.g.position.y = Math.abs(Math.sin(time * 4)) * 3;
              K.arm.rotation.x = C.hitT < 0.4 ? -1.6 + C.hitT * 4 : Math.sin(time * 2) * 0.2;
            } else if (C.type === 'tank') {
              K.g.scale.setScalar(1); blob(C.x - CX, C.y - CZ, 120, 140);
              K.turret.rotation.y = Math.atan2(S.squad.x - C.x, SQUAD_Y - C.y) * 0.9;
            } else {
              K.g.scale.setScalar(1); K.g.position.y = 110 + Math.sin(time * 2) * 5;
              K.g.rotation.z = Math.max(-0.3, Math.min(0.3, (S.squad.x - C.x) * -0.004));
              K.rotor.rotation.y += dt * 30;
              blob(C.x - CX, C.y - CZ, 100, 90);
            }
            K.wallMat.emissive.setRGB(C.flash * 0.35, C.flash * 0.15, C.flash * 0.1);
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
          const form = info.formation, dir = -1, s = 1.75;
          const bodyC = C_(q.flash > 0 ? '#ffffff' : info.skin), helmC = C_(info.skin).multiplyScalar(0.55);
          const isTube = gun[0] === 'tube', gm = isTube ? gunTube : gunBox;
          gunBox.material.color.set(gun[4]); gunTube.material.color.set(gun[4]);
          gunTube.material.emissive = gunTube.material.emissive || new T.Color(); gunTube.material.emissive.set(gun[5] || '#000000');
          let n = 0, nf = 0, ng = 0, nh = 0, nct = 0;
          const flashOn = S.fireFlash > 0 && info.playing;
          const gk = GEAR[info.gear] || GEAR.mavi, beretC = C_(gk.beret || '#ffffff'), plumeC = C_(gk.plume || '#ffffff'), capeC = C_(gk.cape || '#ffffff');
          for (const m of [squad.torso, squad.armL, squad.armR, squad.helmet]) { if (m.material.emissive) m.material.emissive.setScalar(gk.glow ? gk.glow * (0.7 + 0.3 * Math.sin(time * 3)) : 0); }
          for (let i = 0; i < form.length && n < MAX_S; i++) {
            const x = q.x + form[i].x - CX, z = SQUAD_Y + form[i].y - CZ, ph = time * 14 + i * 1.7, sw = info.playing ? Math.sin(ph) * 0.7 : 0;
            const bob = info.playing ? Math.abs(Math.sin(ph)) * 0.9 : 0;
            blob(x, z + 1, 11 * s * 0.9, 9 * s * 0.9);
            put(squad.legL, n, x - 1.7 * s, 6.6 * s, z, s, s, s, sw, 0, 0);
            put(squad.legR, n, x + 1.7 * s, 6.6 * s, z, s, s, s, -sw, 0, 0);
            put(squad.torso, n, x, (9.6 + bob) * s, z, s, s, s, 0.12 * dir, 0, 0, bodyC);
            put(squad.belt, n, x, (7.6 + bob) * s, z + 0.25 * s, s, s, s, 0.12 * dir, 0, 0);
            // Both arms forward on the weapon, a little recoil kick when firing.
            const kick = flashOn ? 0.15 : 0;
            put(squad.armL, n, x - 3.3 * s, (12.4 + bob) * s, z, s, s, s, -1.25 - kick, 0, -0.35, bodyC);
            put(squad.armR, n, x + 3.3 * s, (12.4 + bob) * s, z, s, s, s, -1.35 - kick, 0, 0.2, bodyC);
            put(squad.head, n, x, (15.8 + bob) * s, z, s, s, s);
            put(squad.eyes, n, x, (15.9 + bob) * s, z - 2.45 * s, s, s, s);
            if (gk.hat !== 'beret' && gk.hat !== 'crown') put(squad.helmet, n, x, (16.4 + bob) * s, z, s, 0.85 * s, s, 0, 0, 0, helmC); else put(squad.helmet, n, x, -50, z, 0.01, 0.01, 0.01);
            const hy = (16.4 + bob) * s;
            if (gk.hat === 'beret') put(gear.beret, ng, x, hy + 1 * s, z, s, s, s, 0, 0, 0.22, beretC);
            else if (gk.hat === 'plume') put(gear.plume, ng, x, hy + 3.4 * s, z + 1 * s, s, s, s, 0.5, 0, 0, plumeC);
            else if (gk.hat === 'spike') put(gear.spike, ng, x, hy + 3.4 * s, z, s, s, s);
            else if (gk.hat === 'horns') { put(gear.horn, nh++, x - 2.4 * s, hy + 1 * s, z, s, s, s, 0, 0, 0.7); put(gear.horn, nh++, x + 2.4 * s, hy + 1 * s, z, s, s, s, 0, 0, -0.7); }
            else if (gk.hat === 'crown') { put(gear.crown, ng, x, hy + 0.2 * s, z, s, s, s, 0, time * 0.5, 0); for (let k = 0; k < 5; k++) { const a = time * 0.5 + k / 5 * TAU; put(gear.crownTip, nct++, x + Math.sin(a) * 2.9 * s, hy + 1.9 * s, z + Math.cos(a) * 2.9 * s, s, s, s); } }
            if (gk.cape) put(gear.cape, ng, x, (14.2 + bob) * s, z + 4.8 * s, s, s, s, 0.25 + (info.playing ? 0.12 + Math.sin(ph) * 0.1 : 0), 0, 0, capeC);
            ng++;
            put(squad.pack, n, x, (10.4 + bob) * s, z - dir * 3.3 * s, s, s, s);
            if (isTube) put(gm, n, x + 2.8 * s, (14.2 + bob) * s, z + dir * 1.5 * s, gun[1] * s, gun[2] * s, gun[3] * s);
            else put(gm, n, x + 2.6 * s, (10.8 + bob) * s, z + dir * (gun[3] / 2 + 1.5) * s, gun[1] * s, gun[2] * s, gun[3] * s);
            if (flashOn && i < 12 && nf < 24) {
              const fz = z + dir * (isTube ? gun[3] / 2 + 3 : gun[3] + 2.5) * s, fy = (isTube ? 14.2 : 10.8) * s;
              const fs = (1.6 + Math.random() * 1.6) * (isTube ? 1.8 : 1);
              put(flashes, nf++, x + 2.7 * s, fy, fz, fs, fs, fs * 1.8);
            }
            n++;
          }
          for (const m of [squad.legL, squad.legR, squad.armL, squad.armR, squad.torso, squad.belt, squad.head, squad.eyes, squad.helmet, squad.pack]) done(m, n);
          done(gear.beret, gk.hat === 'beret' ? ng : 0); done(gear.plume, gk.hat === 'plume' ? ng : 0); done(gear.spike, gk.hat === 'spike' ? ng : 0);
          done(gear.crown, gk.hat === 'crown' ? ng : 0); done(gear.horn, nh); done(gear.crownTip, nct); done(gear.cape, gk.cape ? ng : 0);
          // Skin trail: a few particles rising off the marching squad.
          if (gk.fx && info.playing && form.length) for (let k = 0; k < 2; k++) if (Math.random() < dt * 30 && gearTrail.length < 140) {
            const f0 = form[(Math.random() * Math.min(form.length, MAX_S)) | 0], col0 = C_(gk.fxc[(Math.random() * gk.fxc.length) | 0]);
            gearTrail.push({ x: q.x + f0.x - CX + (Math.random() - 0.5) * 6, y: gk.fx === 'ice' ? 30 : 4 + Math.random() * 20, z: SQUAD_Y + f0.y - CZ + 4, vx: (Math.random() - 0.5) * 8, vy: gk.fx === 'ice' ? -14 : gk.fx === 'fire' ? 26 : 12, vz: gk.fx === 'fire' ? 30 : 8, life: 0.7 + Math.random() * 0.5, c: col0 });
          }
          done(gm, n); done(isTube ? gunBox : gunTube, 0); done(flashes, nf);
          muzzleLight.intensity = flashOn ? 3.5 : 0;
          muzzleLight.position.set(q.x - CX, 24, SQUAD_Y - CZ - 18);
          // Enemy flood.
          let ne2 = 0, nclub = 0, nsh2 = 0, nri = 0, nbm = 0;
          const foeC = C_('#e0353d'), bruteC = C_('#7d1624'), hitC = C_('#ffd0d5'), foeHelm = C_('#2a1216');
          const KIND_C = { runner: C_('#ff8a2a'), sniper: C_('#6d1a24'), shield: C_('#b02a4a'), bomber: C_('#2a2a2a') };
          for (let i = 0; i < S.enemies.length && ne2 < MAX_E; i++) {
            const e = S.enemies[i], sc = e.brute ? 2.9 : 1.65, x = e.x - CX, z = e.y - CZ, ph = time * 16 + i * 1.3, sw = Math.sin(ph) * 0.8;
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
          let neb = 0;
          for (const b of S.ebullets) {
            if (neb >= 300) break;
            put(eShots, neb++, b.x - CX, 12, b.y - CZ, 2.2, 2.2, 12, 0, Math.atan2(b.vx, b.vy), 0);
          }
          done(eShots, neb);

          // Projectiles.
          const wc = info.weapon.color;
          tracers.material.color.set(wc);
          let nb = 0, nr2 = 0, nfire = 0;
          for (const b of S.bullets) {
            const x = b.x - CX, z = b.y - CZ, y = 15.5;
            if (b.kind === 'rocket') {
              if (nr2 < 200) put(rockets, nr2++, x, y, z, 1.7, 1.7, 9);
              if (nfire < MAX_FX) put(fire, nfire++, x, y, z + 6.5, 2.2, 2.2, 4 + Math.random() * 3, 0, 0, 0, FIRE_B);
              if (Math.random() < 0.25) puff(x, y, z + 8, 2.6, 0.6, SMOKE_L, 6);
            } else if (nb < MAX_B) {
              if (b.kind === 'laser') put(tracers, nb++, x, y, z, 1.4, 1.4, 42);
              else if (b.kind === 'pellet') put(tracers, nb++, x, y, z, 1.5, 1.5, 7);
              else put(tracers, nb++, x, y, z, 1.3, 1.3, 13);
            }
          }
          done(tracers, nb); done(rockets, nr2);
          // Mortar shells with smoke trail + landing markers.
          let nsh = 0, nmk = 0;
          for (const sh of S.shells) {
            const ss = sh.foe ? 5 : 3.2;
            put(shells, nsh++, sh.x - CX, sh.h + 4, sh.y - CZ, ss, ss, ss);
            if (Math.random() < 0.4) puff(sh.x - CX, sh.h + 4, sh.y - CZ, 2.4, 0.8, SMOKE_S, 4);
            const k = 10 + 26 * (1 - sh.u) + Math.sin(time * 18) * 2;
            put(markers, nmk++, sh.x1 - CX, 1.2, sh.y1 - CZ, sh.foe ? k * 1.6 : k, 1, sh.foe ? k * 1.6 : k, 0, 0, 0, sh.foe ? MK_FOE : MK_OWN);
          }
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
            if (mt.recoil > 0.97) { puff(mt.x - CX, 28, mt.y - CZ - 18, 5, 0.9, SMOKE_M, 12); if (nfire < MAX_FX) put(fire, nfire++, mt.x - CX, 28, mt.y - CZ - 18, 6, 6, 6, 0, 0, 0, FIRE_A); }
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
              for (let k = 0; k < (f.big ? 26 : 12) && debris.length < 300; k++) {
                const a = Math.random() * TAU, v = 60 + Math.random() * 140;
                debris.push({ x, y: 6, z, vx: Math.cos(a) * v, vy: 90 + Math.random() * 160, vz: Math.sin(a) * v, life: 0.6 + Math.random() * 0.6, c: C_(k % 3 ? '#ffb020' : '#ff5a1f') });
              }
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
          done(rings, nring);
          boomLight.intensity = strongest * 6; boomLight.position.set(bx, 40, bz);
          // Particles from the game (sparks/blood) + debris.
          let nsp = 0;
          for (const p0 of S.parts) {
            if (nsp >= 500) break;
            const k = 2.2 * Math.max(0.2, p0.life);
            put(sparks, nsp++, p0.x - CX, 6 + (1 - p0.life) * 14, p0.y - CZ, k, k, k, p0.life * 5, p0.life * 3, 0, col.set(p0.c));
          }
          for (const d of debris) {
            d.vy -= 420 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.life -= dt;
            if (d.y < 1) { d.y = 1; d.vy *= -0.3; d.vx *= 0.6; d.vz *= 0.6; }
            if (nsp < 500) { const k = 1.8 * Math.min(1, d.life * 2); put(sparks, nsp++, d.x, d.y, d.z, k, k, k, d.life * 9, d.life * 7, 0, d.c); }
          }
          for (let i = debris.length - 1; i >= 0; i--) if (debris[i].life <= 0) debris.splice(i, 1);
          for (const d of gearTrail) {
            d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.life -= dt;
            if (nsp < 500) { const k = 1.5 * Math.min(1, d.life * 2); put(sparks, nsp++, d.x, d.y, d.z, k, k, k, d.life * 6, d.life * 4, 0, d.c); }
          }
          for (let i = gearTrail.length - 1; i >= 0; i--) if (gearTrail[i].life <= 0) gearTrail.splice(i, 1);
          done(sparks, nsp);
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

          // The camera leans a little toward the squad's side of the road (parallax) and sways with the run.
          camX += ((S.squad.x - CX) * 0.1 - camX) * Math.min(1, dt * 3);
          camera.position.copy(camBase); camera.position.x += camX; if (info.playing) camera.position.y += Math.sin(time * 7) * 0.6;
          if (S.shake) camera.position.add(v3.set((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake, 0));
          renderer.render(scene, camera);
        },
      };
      return R;
    },
  };
})();
