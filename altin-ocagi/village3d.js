// 3D village for the Köy tab (Three.js), laid out as a vertical town street for phones: the town hall on a
// plaza at the top, a cobbled main street down the middle with two columns of big plots, lamps and trees,
// the wall around the town with a gate at the bottom, fields outside. An orthographic camera keeps every
// building the same size, and the canvas is taller than the screen (the view scrolls). Every building is a detailed low-poly model (textured walls and roofs, doors,
// windows, props), grows with its level and carries a small badge (icon + level). The army that is home stands
// in formation in front of the rally point.
// Village3D.init(canvas) returns null without WebGL; the game then keeps the flat plot grid.
(function () {
  'use strict';
  if (!window.THREE) return;
  const T = window.THREE, TAU = Math.PI * 2;

  // Plot positions (x, z): town hall at the top, then 7 rows of two plots, the last plot by the gate.
  const ROW = 140, COL = 72, Z0 = -440;
  const PLOTS = [[0, Z0]];
  for (let r = 0; r < 7; r++) for (const sx of [-1, 1]) PLOTS.push([sx * COL, Z0 + 160 + r * ROW]);
  const ZMIN = Z0 - 100, ZMAX = Z0 + 160 + 7 * ROW + 80, GATE_PLOT = 15;
  PLOTS.push([0, ZMAX - 34]); // the wall's plot: the village gate at the end of the street
  const HALF_W = 150, PITCH = 52 * Math.PI / 180;
  // Canvas height / width so the whole street fits.
  const RATIO = ((ZMAX - ZMIN) * Math.sin(PITCH) + 90) / (2 * HALF_W);

  function canvasTex(w, h, draw, rx, ry) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace;
    if (rx) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); }
    t.anisotropy = 4;
    return t;
  }
  const noise = (g, w, h, n, cols, s) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(Math.random() * w, Math.random() * h, s, s); } };

  // The palette atlas starts decoding as soon as the page loads, and Village3D.warm() decodes the model
  // geometries in idle slices, so opening the village never shows untextured (black) or half-built buildings.
  const KK0 = window.KAYKIT, KK_IMG = KK0 ? Object.assign(new Image(), { src: KK0.tex }) : null, KK_GEO = {};
  const dec0 = (b, TA) => { const str = atob(b), u = new Uint8Array(str.length); for (let i = 0; i < str.length; i++) u[i] = str.charCodeAt(i); return new TA(u.buffer); };
  function kkDecode(name) {
    if (KK_GEO[name]) return KK_GEO[name];
    const m = KK0.models[name], q = dec0(m.p, Int16Array), pos = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) { const k = i % 3; pos[i] = m.min[k] + (q[i] + 32768) / 65535 * (m.max[k] - m.min[k]); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(Float32Array.from(dec0(m.n, Int8Array), v => v / 127), 3));
    g.setAttribute('uv', new T.BufferAttribute(Float32Array.from(dec0(m.u, Uint16Array), v => v / 65535), 2));
    g.setIndex(new T.BufferAttribute(dec0(m.i, m.i32 ? Uint32Array : Uint16Array), 1));
    g.userData.shared = true; // cached: never disposed on rebuilds
    return (KK_GEO[name] = g);
  }

  window.Village3D = {
    warm() {
      if (!KK0) return;
      const names = Object.keys(KK0.models).filter(n => !KK_GEO[n]);
      const step = () => { const t0 = performance.now(); while (names.length && performance.now() - t0 < 8) kkDecode(names.shift()); if (names.length) setTimeout(step, 30); };
      setTimeout(step, 30);
    },
    PLOTS, RATIO,
    init(canvas) {
      let renderer;
      try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
      if (!renderer.getContext()) return null;
      renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;

      const scene = new T.Scene();
      const camera = new T.OrthographicCamera(-HALF_W, HALF_W, 100, -100, 1, 4000);
      scene.add(new T.HemisphereLight(0xfff6e8, 0x5a6a4a, 1.45));
      const sun = new T.DirectionalLight(0xfff0d8, 2.3);
      sun.position.set(-220, 420, 160); sun.target.position.set(0, 0, (ZMIN + ZMAX) / 2); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
      scene.add(sun.target);
      Object.assign(sun.shadow.camera, { left: -620, right: 620, top: 620, bottom: -620, near: 10, far: 1600 });
      sun.shadow.bias = -0.0012;
      scene.add(sun);

      // ---------- Textures ----------
      const tx = {
        plaster: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#efe3c8'; g.fillRect(0, 0, w, h); noise(g, w, h, 600, ['#e4d6b8', '#f7eed8'], 2); }, 1, 1),
        timber: canvasTex(128, 128, (g, w, h) => {
          g.fillStyle = '#f1e6cc'; g.fillRect(0, 0, w, h); noise(g, w, h, 400, ['#e6d9bb'], 2);
          g.fillStyle = '#5b3a1e'; g.fillRect(0, 0, w, 8); g.fillRect(0, h - 8, w, 8); g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h); g.fillRect(w / 2 - 4, 0, 8, h);
          g.lineWidth = 7; g.strokeStyle = '#5b3a1e'; g.beginPath(); g.moveTo(8, h - 8); g.lineTo(w / 2, 8); g.moveTo(w - 8, h - 8); g.lineTo(w / 2, 8); g.stroke();
        }, 1, 1),
        planks: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#9a5a30'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { g.fillStyle = y % 32 ? '#8a4e28' : '#a0643a'; g.fillRect(0, y, w, 14); } noise(g, w, h, 300, ['rgba(0,0,0,.15)'], 2); }, 1, 1),
        redPlanks: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#a3322a'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { g.fillStyle = '#7a221c'; g.fillRect(x, 0, 2, h); } g.strokeStyle = '#f0e0c8'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); }, 1, 1),
        stone: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#6e6a64'; g.fillRect(0, 0, w, h); for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) { const v = 130 + Math.floor(Math.random() * 40); g.fillStyle = 'rgb(' + v + ',' + (v - 4) + ',' + (v - 10) + ')'; g.fillRect(c * 32 + (r % 2 ? 16 : 0) + 1, r * 16 + 1, 30, 14); } }, 1, 1),
        cobble: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#8c8478'; g.fillRect(0, 0, w, h); for (let i = 0; i < 120; i++) { const v = 150 + Math.floor(Math.random() * 50); g.fillStyle = 'rgb(' + v + ',' + (v - 8) + ',' + (v - 18) + ')'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 5 + Math.random() * 4, 4 + Math.random() * 3, Math.random() * 3, 0, TAU); g.fill(); } }, 6, 6),
        grass: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); noise(g, w, h, 900, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.3)', 'rgba(0,60,0,.08)'], 3); }, 20, 20),
      };
      const roofTex = color => canvasTex(128, 128, (g, w, h) => {
        g.fillStyle = color; g.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 12) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y + 9, w, 3); for (let x = (y / 12) % 2 ? 8 : 0; x < w; x += 16) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, y, 2, 12); } }
      }, 2, 2);

      const lam = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
      const std = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6, metalness: 0.1 }, o || {}));
      const M = {
        plaster: lam('#ffffff', { map: tx.plaster }), timber: lam('#ffffff', { map: tx.timber }), planks: lam('#ffffff', { map: tx.planks }), redPlanks: lam('#ffffff', { map: tx.redPlanks }),
        stone: lam('#ffffff', { map: tx.stone }), cobble: lam('#ffffff', { map: tx.cobble }),
        roofRed: lam('#ffffff', { map: roofTex('#b8432f') }), roofBlue: lam('#ffffff', { map: roofTex('#3b6ea8') }), roofGreen: lam('#ffffff', { map: roofTex('#3f7a3a') }),
        roofBrown: lam('#ffffff', { map: roofTex('#6e4424') }), roofPurple: lam('#ffffff', { map: roofTex('#6a3fa0') }), roofSlate: lam('#ffffff', { map: roofTex('#4a5160') }),
        wood: lam('#8a5a2b'), darkWood: lam('#4e3018'), door: lam('#5b3a1e'), window: std('#9fd8ff', { emissive: '#1a3a55', emissiveIntensity: 0.4 }), frame: lam('#f3ede0'),
        gold: std('#f2b52a', { metalness: 0.85, roughness: 0.28, emissive: '#3a2400' }), iron: std('#6b7280', { metalness: 0.7, roughness: 0.4 }), dark: lam('#2b2f36'),
        fire: new T.MeshBasicMaterial({ color: '#ff8a2a' }), glow: new T.MeshBasicMaterial({ color: '#ffd27a' }), hay: lam('#e6c35a'), dirt: lam('#b8925a'), path: lam('#cdb07a'),
        field: lam('#d9b44a'), field2: lam('#8fb84a'), leaf: lam('#3f9e4a', { flatShading: true }), trunk: lam('#6e4424'), cloth: lam('#f2ece0'), clothRed: lam('#d9453a'),
        flag: lam('#e23b3b', { side: T.DoubleSide }), smoke: lam('#c8c8c8', { transparent: true, opacity: 0.65 }), skin: lam('#f1c38f'), marble: std('#f3efe6', { roughness: 0.45 }),
        fruitR: lam('#e0453a'), fruitY: lam('#f2c032'), fruitG: lam('#6abf3a'), barrel: lam('#7a4a26'), white: lam('#ffffff'),
      };
      const grassMat = lam('#6fbf57', { map: tx.grass }), outerMat = lam('#5aa648', { map: tx.grass });
      function add(p, geo, mat, x, y, z, shadow) { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = shadow !== false; m.receiveShadow = true; p.add(m); return m; }
      const box = (p, w, h, d, m, x, y, z) => add(p, new T.BoxGeometry(w, h, d), m, x, y + h / 2, z);
      const cyl = (p, r1, r2, h, m, x, y, z, seg) => add(p, new T.CylinderGeometry(r1, r2, h, seg || 14), m, x, y + h / 2, z);
      // Gable roof with the ridge along x, sitting on top of a w×d body at height y.
      function gable(p, w, d, h, m, x, y, z) {
        const s = new T.Shape(); s.moveTo(-d / 2 - 2.5, 0); s.lineTo(d / 2 + 2.5, 0); s.lineTo(0, h); s.closePath();
        const r = add(p, new T.ExtrudeGeometry(s, { depth: w + 5, bevelEnabled: false }), m, 0, 0, 0);
        r.rotation.y = -Math.PI / 2; r.position.set(x + w / 2 + 2.5, y, z);
        // Gable ends.
        const e = new T.Shape(); e.moveTo(-d / 2, 0); e.lineTo(d / 2, 0); e.lineTo(0, h - 1); e.closePath();
        for (const sx of [-1, 1]) { const g = add(p, new T.ShapeGeometry(e), M.plaster, x + sx * (w / 2 + 0.05), y, z); g.rotation.y = sx * Math.PI / 2; }
        return r;
      }
      const pyramid = (p, r, h, m, x, y, z) => { const c = add(p, new T.ConeGeometry(r, h, 4), m, x, y + h / 2, z); c.rotation.y = Math.PI / 4; return c; };
      const door = (p, x, y, z, w, h) => { box(p, (w || 6) + 1.6, (h || 9) + 0.8, 0.8, M.frame, x, y, z); box(p, w || 6, h || 9, 1.2, M.door, x, y, z + 0.3); };
      const win = (p, x, y, z, w, h) => { box(p, (w || 4) + 1.2, (h || 4) + 1.2, 0.6, M.frame, x, y, z); box(p, w || 4, h || 4, 1, M.window, x, y + 0.6, z + 0.2); };
      function house(p, w, h, d, wallMat, roofMat, o) {
        o = o || {};
        box(p, w, h, d, wallMat, 0, 0, 0); gable(p, w, d, o.roof || h * 0.7, roofMat, 0, h, 0);
        if (o.door !== false) door(p, o.doorX || 0, 0, d / 2);
        for (const wx of o.wins || []) win(p, wx, h * 0.45, d / 2);
        if (o.chimney) { box(p, 4, h * 0.9, 4, M.stone, o.chimney, h, -d / 4); }
      }
      function flag(p, x, y, z) { cyl(p, 0.5, 0.5, 14, M.darkWood, x, y, z, 6); const f = add(p, new T.PlaneGeometry(10, 6), M.flag, x + 5, y + 11, z, false); p.userData.flags = (p.userData.flags || []).concat(f); }
      const barrel = (p, x, z) => cyl(p, 2.2, 2.2, 5, M.barrel, x, 0, z, 10);
      const crate = (p, x, z, s) => box(p, s || 4, s || 4, s || 4, M.planks, x, 0, z);
      const hay = (p, x, z) => { const h = cyl(p, 3.2, 3.2, 5, M.hay, x, 0, z, 12); h.rotation.z = Math.PI / 2; h.position.y = 3.2; };
      function horse(p, x, z, ry) { const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; p.add(g); const b = lam('#7a4a26'); box(g, 11, 5, 4, b, 0, 6, 0); box(g, 3.5, 6, 3.5, b, 6.5, 9, 0); box(g, 6, 3, 3, b, 9, 13, 0); for (const [dx, dz] of [[-4, 1.5], [-4, -1.5], [4, 1.5], [4, -1.5]]) box(g, 1.3, 6, 1.3, b, dx, 0, dz); box(g, 1, 5, 1, lam('#2a1a0e'), -6, 6, 0); }
      function person(p, x, z, c) { add(p, new T.CapsuleGeometry(1.8, 3.5, 3, 6), c || M.clothRed, x, 4.5, z); add(p, new T.SphereGeometry(1.9, 8, 6), M.skin, x, 9.3, z); }

      // ---------- Detailed building models (front faces +z, towards the camera) ----------
      const MODELS = {
        main(g) {
          house(g, 44, 20, 28, M.timber, M.roofRed, { wins: [-14, -7, 7, 14], roof: 14 });
          box(g, 16, 34, 16, M.stone, 0, 0, 4); pyramid(g, 13, 14, M.roofSlate, 0, 34, 4);
          const clock = add(g, new T.CylinderGeometry(4, 4, 1, 20), M.white, 0, 27, 12.6); clock.rotation.x = Math.PI / 2;
          const hand = box(g, 0.6, 3.2, 0.5, M.dark, 0, 26.6, 13.3); hand.rotation.z = 0.8;
          door(g, 0, 0, 12.2, 7, 11); box(g, 22, 1.5, 6, M.stone, 0, 0, 16);
          flag(g, 0, 48, 4); flag(g, -20, 34, 0); flag(g, 20, 34, 0);
        },
        rally(g) {
          box(g, 34, 0.8, 34, M.dirt, 0, 0, 0); cyl(g, 0.8, 0.8, 30, M.darkWood, 0, 0, -6, 8); flag(g, 0, 22, -6);
          for (const [x, z, m] of [[-11, 6, M.cloth], [11, 6, M.clothRed], [0, -14, M.cloth]]) { add(g, new T.ConeGeometry(7, 11, 8), m, x, 5.5, z); cyl(g, 0.4, 0.4, 13, M.darkWood, x, 0, z, 5); }
          for (let k = 0; k < 4; k++) { const sp = box(g, 0.6, 12, 0.6, M.iron, -15 + k * 2, 0, -14); sp.rotation.z = 0.12; }
          person(g, 6, 12, M.clothRed); person(g, -5, 13, lam('#3b82f6'));
        },
        barracks(g) {
          house(g, 46, 14, 20, M.timber, M.roofBlue, { wins: [-15, -8, 8, 15], roof: 10 });
          for (let k = 0; k < 5; k++) { const s = box(g, 0.6, 14, 0.6, M.iron, -20 + k * 2.5, 0, 13); s.rotation.z = 0.1; }
          for (const x of [12, 20]) { cyl(g, 0.7, 0.7, 10, M.wood, x, 0, 17, 6); add(g, new T.SphereGeometry(2.4, 8, 6), M.hay, x, 11, 17); box(g, 6, 0.8, 0.8, M.wood, x, 7, 17); }
          const sh = add(g, new T.CircleGeometry(3.5, 16), M.clothRed, -8, 10, 10.3, false); person(g, 5, 16, lam('#3b82f6'));
        },
        stable(g) {
          box(g, 40, 15, 24, M.redPlanks, 0, 0, 0); gable(g, 40, 24, 11, M.roofBrown, 0, 15, 0);
          box(g, 12, 11, 1, M.door, 0, 0, 12.3); box(g, 12, 1, 1.2, M.white, 0, 5, 12.8); win(g, 0, 16, 12.2, 5, 3);
          for (let k = 0; k < 5; k++) box(g, 0.8, 5, 0.8, M.wood, -26 + k * 6, 0, 20); box(g, 26, 0.8, 0.8, M.wood, -14, 3.5, 20);
          horse(g, -14, 22, 0.3); hay(g, 16, 16); hay(g, 22, 18);
        },
        workshop(g) {
          box(g, 34, 1, 24, M.planks, 0, 0, 0); for (const [x, z] of [[-16, -11], [16, -11], [-16, 11], [16, 11]]) cyl(g, 1, 1, 16, M.wood, x, 0, z, 6);
          gable(g, 34, 24, 8, M.roofBrown, 0, 16, 0);
          const ram = cyl(g, 2.6, 2.6, 24, M.darkWood, 0, 4, 4, 8); ram.rotation.z = Math.PI / 2; cyl(g, 3, 3, 3, M.iron, 12.5, 4, 4, 8).rotation.z = Math.PI / 2;
          for (const x of [-8, 8]) for (const z of [-2, 10]) { const w = cyl(g, 3.5, 3.5, 1.6, M.darkWood, x, 2, z, 12); w.rotation.x = Math.PI / 2; }
          for (let k = 0; k < 4; k++) { const l = cyl(g, 1.8, 1.8, 16, M.wood, -26, 1.8 + k * 1.2, -8 + k * 3.5, 8); l.rotation.x = Math.PI / 2; }
        },
        kosk(g) {
          box(g, 42, 4, 32, M.stone, 0, 0, 0); box(g, 34, 22, 24, M.marble, 0, 4, 0); pyramid(g, 25, 12, M.roofPurple, 0, 26, 0);
          add(g, new T.SphereGeometry(7, 16, 10, 0, TAU, 0, Math.PI / 2), M.gold, 0, 36, 0);
          for (const [x, z] of [[-19, -13], [19, -13], [-19, 13], [19, 13]]) { cyl(g, 5, 5.5, 34, M.marble, x, 0, z); add(g, new T.ConeGeometry(7, 12, 10), M.roofPurple, x, 40, z); }
          for (const x of [-9, -3, 3, 9]) cyl(g, 1.3, 1.5, 18, M.marble, x, 4, 13.5, 10);
          door(g, 0, 4, 12.2, 7, 11); box(g, 16, 2, 6, M.stone, 0, 0, 18); flag(g, 0, 44, 0);
        },
        wall(g) { cyl(g, 10, 11, 26, M.stone, 0, 0, 0); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; box(g, 4, 4, 4, M.stone, Math.cos(a) * 9, 26, Math.sin(a) * 9); } door(g, 0, 0, 10.2, 6, 9); flag(g, 0, 30, 0); },
        hideout(g) { const m = add(g, new T.SphereGeometry(18, 18, 10, 0, TAU, 0, Math.PI / 2), M.roofGreen, 0, 0, 0); m.scale.y = 0.55; m.material = lam('#5a8a3a'); box(g, 10, 9, 5, M.stone, 0, 0, 14); door(g, 0, 0, 16.6, 6, 8); add(g, new T.SphereGeometry(1.2, 8, 6), M.glow, 5, 8, 17); },
        demirci(g) {
          box(g, 30, 13, 22, M.stone, 0, 0, 0); gable(g, 30, 22, 9, M.roofSlate, 0, 13, 0); box(g, 5, 26, 5, M.stone, 10, 0, -6);
          box(g, 12, 8, 1, M.dark, -6, 0, 11.2); add(g, new T.SphereGeometry(3, 10, 8), M.fire, -6, 4, 11.5, false);
          box(g, 5, 3, 3, M.iron, 8, 5, 16); box(g, 3, 5, 2, M.darkWood, 8, 0, 16); barrel(g, -14, 16); barrel(g, -9, 17);
          person(g, 2, 17, lam('#4a3a2a')); g.userData.smoke = [10, 28, -6];
        },
        kuyumcu(g) {
          house(g, 28, 16, 20, M.plaster, M.roofRed, { wins: [9], doorX: -6, roof: 10 });
          box(g, 12, 7, 1, M.window, 5, 3, 10.5); box(g, 14, 1.5, 5, M.clothRed, 5, 11, 12.5);
          box(g, 14, 4, 1, M.gold, 0, 17.5, 10.8); for (let k = 0; k < 3; k++) add(g, new T.TorusGeometry(1.4, 0.45, 6, 12), M.gold, 1 + k * 4, 5, 11.2);
        },
        pazar(g) {
          box(g, 36, 0.6, 32, M.cobble, 0, 0, 0);
          for (const [x, z, c] of [[-10, -7, M.clothRed], [10, -7, lam('#3b82f6')], [-10, 10, lam('#f2c032')], [10, 10, lam('#3f9e4a')]]) {
            box(g, 14, 6, 8, M.planks, x, 0, z); for (const dx of [-6, 6]) box(g, 0.7, 12, 0.7, M.wood, x + dx, 0, z + 4);
            const aw = box(g, 16, 1, 11, c, x, 12, z + 1); aw.rotation.x = 0.25;
            for (let k = 0; k < 5; k++) add(g, new T.SphereGeometry(1.2, 8, 6), [M.fruitR, M.fruitY, M.fruitG][k % 3], x - 5 + k * 2.5, 7, z + 2);
          }
          crate(g, 0, 0, 5); barrel(g, 3, 5); person(g, -3, 2, lam('#7c3aed'));
        },
        otel(g) {
          house(g, 30, 30, 22, M.timber, M.roofGreen, { wins: [-9, 9], roof: 12, chimney: 9 });
          for (const x of [-9, 0, 9]) win(g, x, 20, 11);
          box(g, 26, 1, 5, M.wood, 0, 15, 13); for (let k = 0; k < 7; k++) box(g, 0.5, 4, 0.5, M.wood, -12 + k * 4, 16, 15.2);
          box(g, 1, 8, 1, M.darkWood, 17, 14, 12); box(g, 7, 5, 0.8, M.planks, 17, 17, 14);
        },
        tren(g) {
          box(g, 36, 4, 12, M.stone, 0, 0, -10); house(g, 22, 12, 10, M.plaster, M.roofBlue, { wins: [-7, 7], door: true, roof: 7 });
          for (const z of [8, 14]) box(g, 60, 1, 1.4, M.iron, 0, 0, z); for (let x = -28; x <= 28; x += 5) box(g, 2, 0.6, 9, M.darkWood, x, 0, 11);
          box(g, 14, 9, 7, M.dark, -8, 1, 11); cyl(g, 3.5, 3.5, 12, M.dark, 2, 3.5, 11, 12).rotation.z = Math.PI / 2; cyl(g, 1.4, 1.8, 6, M.dark, 4, 8, 11, 8);
          box(g, 12, 6, 7, M.redPlanks, 16, 1, 11);
          g.userData.smoke = [4, 15, 11];
        },
        banka(g) {
          box(g, 36, 4, 26, M.stone, 0, 0, 0); box(g, 30, 20, 20, M.marble, 0, 4, -2);
          for (const x of [-11, -4, 4, 11]) cyl(g, 1.6, 1.8, 18, M.marble, x, 4, 10, 12);
          const ped = new T.Shape(); ped.moveTo(-16, 0); ped.lineTo(16, 0); ped.lineTo(0, 7); ped.closePath();
          add(g, new T.ExtrudeGeometry(ped, { depth: 24, bevelEnabled: false }), M.marble, 0, 24, -13);
          add(g, new T.SphereGeometry(8, 16, 8, 0, TAU, 0, Math.PI / 2), M.gold, 0, 31, -2); door(g, 0, 4, 8.2, 6, 10);
        },
        rafineri(g) {
          for (const [x, z, h] of [[-12, -6, 24], [1, -8, 32], [13, 3, 20]]) { cyl(g, 6.5, 6.5, h, M.iron, x, 0, z); add(g, new T.SphereGeometry(6.5, 12, 6, 0, TAU, 0, Math.PI / 2), M.iron, x, h, z); box(g, 13.4, 1.5, 0.5, M.clothRed, x, h * 0.6, z + 6.5); }
          const pipe = cyl(g, 1.2, 1.2, 26, M.iron, 0, 14, 4, 8); pipe.rotation.z = Math.PI / 2;
          cyl(g, 2, 2.6, 40, M.stone, -20, 0, 10, 10); g.userData.smoke = [-20, 42, 10];
        },
        darphane(g) {
          box(g, 34, 18, 26, M.stone, 0, 0, 0); pyramid(g, 25, 11, M.roofSlate, 0, 18, 0);
          const c = cyl(g, 7, 7, 2, M.gold, 0, 7, 13.6, 24); c.rotation.x = Math.PI / 2; c.position.y = 11;
          box(g, 12, 9, 1, M.iron, 0, 0, 13.3);
          for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) box(g, 4, 1.8, 2.2, M.gold, 12 - (3 - r) * 2.2 + k * 4.4, r * 1.8, 18);
        },
      };
      function scaffold(g, h) {
        for (const [x, z] of [[-17, -13], [17, -13], [-17, 13], [17, 13]]) box(g, 1.2, h, 1.2, M.wood, x, 0, z);
        for (let y = 7; y < h; y += 7) { box(g, 36, 0.9, 0.9, M.wood, 0, y, 13); box(g, 36, 0.9, 0.9, M.wood, 0, y, -13); }
        box(g, 28, Math.max(4, h * 0.45), 20, M.plaster, 0, 0, 0); crate(g, 20, 16, 4); person(g, 14, 18, lam('#f2c032'));
      }

      // ---------- KayKit models (CC0, Kay Lousberg — kaykit.js, made by scripts/kaykit-convert.js) ----------
      const KK = window.KAYKIT, kkGeo = {};
      let kkMat = null;
      // Region colours: the pack's blue team colour (roofs, banners) is recoloured on a copy of the palette atlas.
      const HUE = { col: 40, buz: 150, volkan: 4, ay: 285 }, kkTex = {};
      let kkImg = null;
      const atlasTex = src => { const t = src.isTexture ? src : new T.CanvasTexture(src); t.flipY = false; if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace; t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; };
      function themeTex(id, skinHue) {
        const hue = skinHue != null ? skinHue : HUE[id];
        if (hue == null || !kkImg || !kkImg.complete || !kkImg.width) return kkTex.base;
        if (kkTex['h' + hue]) return kkTex['h' + hue];
        const c = document.createElement('canvas'); c.width = kkImg.width; c.height = kkImg.height;
        const g = c.getContext('2d'); g.drawImage(kkImg, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
        for (let i = 0; i < p.length; i += 4) {
          const r = p[i] / 255, gg = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, dd = mx - mn;
          if (dd < 0.12 || b !== mx) continue;
          let h = (r - gg) / dd + 4; h *= 60; if (h < 0) h += 360;
          if (h < 185 || h > 255) continue;
          const s = dd / (1 - Math.abs(2 * l - 1)), nh = hue / 360, q = l < 0.5 ? l * (1 + s) : l + s - l * s, pp = 2 * l - q;
          const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; };
          p[i] = f(nh + 1 / 3) * 255; p[i + 1] = f(nh) * 255; p[i + 2] = f(nh - 1 / 3) * 255;
        }
        g.putImageData(d, 0, 0);
        return (kkTex['h' + hue] = atlasTex(c));
      }
      if (KK) {
        kkImg = KK_IMG;
        kkTex.base = atlasTex(new T.Texture(kkImg));
        kkMat = new T.MeshLambertMaterial({ map: kkTex.base });
        if (!kkImg.complete) kkImg.addEventListener('load', () => { kkTex.base.needsUpdate = true; sig = ''; });
      }
      const kkGeometry = kkDecode;
      function kk(p, name, sc, x, y, z, ry) {
        const o = new T.Mesh(kkGeometry(name), kkMat); o.scale.setScalar(sc); o.position.set(x || 0, y || 0, z || 0); o.rotation.y = ry || 0;
        o.castShadow = true; o.receiveShadow = true; p.add(o); return o;
      }
      const KMODELS = KK ? {
        main: g => kk(g, 'castle', 21),
        rally: g => { for (const [x, z, sc] of [[-15, -10, 44], [14, -12, 40], [0, -26, 46]]) kk(g, 'tent', sc, x, 0, z, x * 0.04); kk(g, 'weaponrack', 34, -20, 0, 6, 0.4); kk(g, 'weaponrack', 34, 20, 0, 6, -0.4); kk(g, 'flag', 50, 0, 0, -2); kk(g, 'target', 30, 26, 0, -22, -0.5); },
        barracks: g => kk(g, 'barracks', 25),
        stable: g => { kk(g, 'home_B', 30, -8, 0, -6); horse(g, 12, 14, 0.4); horse(g, -12, 18, -0.2); hay(g, 20, 0); kk(g, 'wheelbarrow', 22, -22, 0, 12, 0.8); },
        workshop: g => kk(g, 'lumbermill', 30),
        kosk: g => kk(g, 'church', 32),
        hideout: g => { kk(g, 'home_B', 30, -4, 0, -4); kk(g, 'resource_lumber', 22, 20, 0, 8, 0.6); kk(g, 'barrel', 22, -20, 0, 12); kk(g, 'crate_A_big', 18, -14, 0, 16, 0.4); },
        demirci: g => kk(g, 'blacksmith', 32),
        kuyumcu: g => { kk(g, 'home_A', 32); kk(g, 'barrel', 24, 18, 0, 12); kk(g, 'sack', 24, -18, 0, 12); },
        pazar: g => kk(g, 'market', 32),
        otel: g => kk(g, 'tavern', 32),
        tren: g => { kk(g, 'watermill', 30); kk(g, 'crate_A_big', 20, -20, 0, 14); },
        banka: g => kk(g, 'tower_B', 30),
        rafineri: g => kk(g, 'windmill', 30),
        darphane: g => { kk(g, 'tower_A', 30); kk(g, 'crate_A_big', 20, 18, 0, 12); kk(g, 'sack', 24, -18, 0, 12); },
      } : null;
      const treeList = {};
      const kkTree = (p, x, z, i) => { const name = ['trees_A_medium', 'tree_single_A', 'tree_single_B', 'trees_B_large'][i % 4]; (treeList[name] = treeList[name] || []).push([x, z, [24, 34, 34, 20][i % 4], i * 1.3]); };

      // Small level badge (building icon + level; gold arrow while upgrading) or a "+" over an empty plot.
      function badgeTex(icon, lvl, busy, empty) {
        return canvasTex(256, 96, (g, w, h) => {
          g.fillStyle = busy ? 'rgba(150,80,0,.92)' : empty ? 'rgba(255,255,255,.82)' : 'rgba(15,12,40,.84)';
          g.beginPath(); g.roundRect(4, 6, w - 8, h - 12, 40); g.fill();
          g.lineWidth = 5; g.strokeStyle = busy ? '#ffd23f' : empty ? '#3f8a3a' : 'rgba(255,255,255,.55)'; g.stroke();
          g.textBaseline = 'middle'; g.textAlign = 'center';
          if (empty) { g.fillStyle = '#2f7a2f'; g.font = "800 66px Baloo, 'Arial Black', sans-serif"; g.fillText('+', w / 2, h / 2 + 4); return; }
          g.font = '52px sans-serif'; g.fillText(icon, 64, h / 2 + 3);
          g.fillStyle = busy ? '#fff' : '#ffc83d'; g.font = "800 54px Baloo, 'Arial Black', sans-serif";
          g.fillText(busy ? '▲' + lvl : String(lvl), 170, h / 2 + 4);
        });
      }

      // ---------- Static scenery ----------
      const root = new T.Group(); scene.add(root);
      const zc = (ZMIN + ZMAX) / 2, len = ZMAX - ZMIN;
      const ground = add(root, new T.PlaneGeometry(1400, 2600), outerMat, 0, -0.5, zc, false); ground.rotation.x = -Math.PI / 2;
      const inner = add(root, new T.PlaneGeometry(2 * 140, len), grassMat, 0, 0, zc, false); inner.rotation.x = -Math.PI / 2;
      // Plaza in front of the main building, a cobbled main street, side paths to every plot.
      const plaza = add(root, new T.CircleGeometry(92, 40), M.cobble, 0, 0.3, Z0 + 20, false); plaza.rotation.x = -Math.PI / 2;
      const street = add(root, new T.PlaneGeometry(30, len - 130), M.cobble, 0, 0.32, zc + 60, false); street.rotation.x = -Math.PI / 2;
      for (const sx of [-1, 1]) add(root, new T.BoxGeometry(4, 1.2, len - 130), M.stone, sx * 17, 0.6, zc + 60, false);
      for (let r = 0; r < 7; r++) for (const sx of [-1, 1]) { const ln = add(root, new T.PlaneGeometry(18, 14), M.path, sx * 27, 0.31, Z0 + 160 + r * ROW + 16, false); ln.rotation.x = -Math.PI / 2; }
      // Well and fountain on the plaza, lamps along the street, trees and flower beds between the plots.
      const well = new T.Group(); well.position.set(-96, 0, Z0 + 70); root.add(well);
      if (KK) kk(well, 'well', 34); else cyl(well, 7, 7, 4, M.stone, 0, 0, 0); if (!KK) { for (const x of [-5.5, 5.5]) box(well, 0.9, 11, 0.9, M.wood, x, 0, 0); gable(well, 11, 13, 5, M.roofRed, 0, 11, 0); }
      const fnt = new T.Group(); fnt.position.set(96, 0, Z0 + 70); root.add(fnt);
      cyl(fnt, 10, 11, 3, M.stone, 0, 0, 0); cyl(fnt, 9, 9, 0.6, lam('#4aa8e8'), 0, 3, 0); cyl(fnt, 2, 2.5, 9, M.stone, 0, 0, 0); add(fnt, new T.SphereGeometry(2.4, 10, 8), lam('#9fd8ff'), 0, 10, 0);
      const flowers = [lam('#ff6b8a'), lam('#ffd23f'), lam('#b388ff'), lam('#ffffff')];
      for (let r = 0; r <= 7; r++) for (const sx of [-1, 1]) {
        const z = Z0 + 95 + r * ROW, l = new T.Group(); l.position.set(sx * 20, 0, z); root.add(l);
        cyl(l, 0.6, 0.8, 16, M.dark, 0, 0, 0, 6); box(l, 3.4, 3.4, 3.4, M.glow, 0, 16, 0);
        if (KK) kkTree(root, sx * 124, z + 10, r + (sx > 0 ? 1 : 0)); else { const t = new T.Group(); t.position.set(sx * 124, 0, z + 10); cyl(t, 2.2, 3, 10, M.trunk, 0, 0, 0, 6); add(t, new T.IcosahedronGeometry(10, 1), M.leaf, 0, 17, 0).scale.y = 0.9; root.add(t); }
        for (let f = 0; f < 6; f++) add(root, new T.SphereGeometry(1.6, 6, 4), flowers[(f + r) % 4], sx * (40 + f * 11), 1, z + 4 + (f % 2) * 4, false);
      }
      // Fields and forest outside the town.
      const fieldGroup = new T.Group(); root.add(fieldGroup);
      for (let k = 0; k < 12; k++) for (const sx of [-1, 1]) {
        const x = sx * (210 + (k % 2) * 60), z = ZMIN + 40 + k * 110, alt = (k + (sx > 0 ? 1 : 0)) % 2;
        add(fieldGroup, new T.BoxGeometry(80, 1, 70), alt ? M.field : M.field2, x, 0.5, z, false);
        for (let q = -3; q <= 3; q++) add(fieldGroup, new T.BoxGeometry(78, 1.4, 2), lam(alt ? '#c49a32' : '#6f9e3a'), x, 1, z + q * 9, false);
      }
      for (let i = 0; i < 44; i++) { const sx = i % 2 ? 1 : -1; if (KK) { kkTree(root, sx * (160 + (i * 37) % 26), ZMIN + (i * 61) % len, i); continue; } const t = new T.Group(); t.position.set(sx * (158 + (i * 37) % 26), 0, ZMIN + (i * 61) % len); cyl(t, 2.4, 3.2, 12, M.trunk, 0, 0, 0, 6); add(t, new T.IcosahedronGeometry(11, 1), M.leaf, 0, 20, 0).scale.y = 0.9; add(t, new T.IcosahedronGeometry(7, 1), M.leaf, 2, 29, 1); root.add(t); }
      // Every tree of a kind is one instanced draw (with shadows that is 2 draws instead of dozens).
      if (KK) {
        const td = new T.Object3D();
        for (const name in treeList) {
          const list = treeList[name], im = new T.InstancedMesh(kkGeometry(name), kkMat, list.length);
          list.forEach(([x, z, sc, ry], i) => { td.position.set(x, 0, z); td.rotation.set(0, ry, 0); td.scale.setScalar(sc); td.updateMatrix(); im.setMatrixAt(i, td.matrix); });
          im.castShadow = true; im.receiveShadow = true; root.add(im);
        }
      }
      // Town wall: its look steps up with the level (Travian-like) and grows a little within every step:
      // garden fence (0) → wooden palisade + watchtowers (1-4) → low stone wall (5-9) → high crenellated wall with
      // red-roofed towers (10-14) → thick wall, gatehouse with portcullis, banners, extra towers (15-19) → fortress (20).
      const WX = 144, GATE = 24;
      let WS = M.stone, wallSkin = 'tas';
      // Procedural textures for the wall skins (drawn once, on first use).
      const brick = (base, vary, mortar, extra) => canvasTex(128, 128, (g, w, h) => {
        g.fillStyle = mortar; g.fillRect(0, 0, w, h);
        for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) {
          const v = Math.floor(Math.random() * vary); g.fillStyle = base(v); g.fillRect(c * 32 + (r % 2 ? 16 : 0) + 1, r * 16 + 1, 30, 14);
        }
        if (extra) extra(g, w, h);
      }, 6, 2);
      const cracks = (col, n) => (g, w, h) => { g.strokeStyle = col; g.lineWidth = 2; for (let i = 0; i < n; i++) { let x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 30; y += Math.random() * 18; g.lineTo(x, y); } g.stroke(); } };
      const WALL_FX = {
        altin: () => {
          const map = brick(v => 'rgb(' + (235 + v / 3) + ',' + (192 + v / 2) + ',' + (60 + v) + ')', 40, '#d19a2a');
          // A bright diagonal band slides along the wall (emissive map scrolled over time).
          const shine = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const gr = g.createLinearGradient(90, 0, 166, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, '#fff6c0'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, 2, 1);
          const m = new T.MeshStandardMaterial({ map, color: '#fff2b8', metalness: 0.25, roughness: 0.35, emissive: '#fff4c4', emissiveMap: shine, emissiveIntensity: 1 });
          m.userData.tick = t => { shine.offset.x = -t * 0.12; };
          return m;
        },
        lav: () => {
          const map = brick(v => 'rgb(' + (40 + v) + ',' + (30 + v / 2) + ',' + (30 + v / 3) + ')', 30, '#140a08', cracks('#3a1208', 10));
          const glow = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); cracks('#ffae42', 14)(g, w, h); }, 6, 2);
          const m = new T.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0.1, emissive: '#ff5a14', emissiveMap: glow, emissiveIntensity: 1.2 });
          m.userData.tick = t => { m.emissiveIntensity = 0.9 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.2)); };
          return m;
        },
        buz: () => {
          const map = brick(v => 'rgb(' + (170 + v) + ',' + (215 + v / 2) + ',255)', 40, '#e8f7ff', (g, w, h) => { g.fillStyle = 'rgba(255,255,255,.6)'; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * w, Math.random() * h, 6, 2); });
          const m = new T.MeshStandardMaterial({ map, color: '#d8f3ff', roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.88, emissive: '#6fd3ff', emissiveIntensity: 0.25 });
          m.userData.tick = t => { m.emissiveIntensity = 0.2 + 0.1 * Math.sin(t * 1.3); };
          return m;
        },
        obsidyen: () => {
          const map = brick(v => 'rgb(' + (28 + v) + ',' + (22 + v) + ',' + (48 + v) + ')', 25, '#0a0712');
          const veins = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); cracks('#b57bff', 8)(g, w, h); }, 6, 2);
          const m = new T.MeshStandardMaterial({ map, roughness: 0.08, metalness: 0.6, emissive: '#8b5cf6', emissiveMap: veins, emissiveIntensity: 0.8 });
          m.userData.tick = t => { m.emissiveIntensity = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.6)); veins.offset.y = t * 0.03; };
          return m;
        },
      };
      const wallMats = {};
      const wallMat = id => (WALL_FX[id] ? (wallMats[id] = wallMats[id] || WALL_FX[id]()) : M.stone);
      // Particles and extras of a skin (sparks, snow, glints, the lava moat), rebuilt with the wall.
      let wallFx = [];
      const lavaTex = canvasTex(64, 128, (g, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x += 4) { const v = Math.random(); g.fillStyle = v > 0.8 ? '#ffe066' : v > 0.4 ? '#ff7a1a' : '#c2280e'; g.fillRect(x, y, 4, 1); } }, 1, 20);
      const wallG = new T.Group(); root.add(wallG);
      let wallLv = -1;
      const RUNS = [[-WX, ZMIN, -WX, ZMAX], [WX, ZMIN, WX, ZMAX], [-WX, ZMIN, WX, ZMIN], [-WX, ZMAX, -GATE, ZMAX], [GATE, ZMAX, WX, ZMAX]];
      const wd = new T.Object3D();
      // Instanced copies of one geometry at the given points (fn places each one).
      function inst(geo, mat, pts, fn) {
        const m = new T.InstancedMesh(geo, mat, pts.length);
        pts.forEach((p, i) => { wd.position.set(0, 0, 0); wd.rotation.set(0, 0, 0); wd.scale.set(1, 1, 1); fn(p, wd, i); wd.updateMatrix(); m.setMatrixAt(i, wd.matrix); });
        m.castShadow = true; m.receiveShadow = true; wallG.add(m); return m;
      }
      // Points every `step` along the wall runs: [x, z, runsAlongZ].
      const along = step => {
        const out = [];
        for (const [x1, z1, x2, z2] of RUNS) { const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(L / step)); for (let i = 0; i <= n; i++) out.push([x1 + (x2 - x1) * i / n, z1 + (z2 - z1) * i / n, x1 === x2]); }
        return out;
      };
      function tower(tier, h, x, z) {
        const g = new T.Group(); g.position.set(x, 0, z); wallG.add(g);
        if (tier === 0) {
          for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) box(g, 1.4, h + 12, 1.4, M.darkWood, dx, 0, dz);
          box(g, 13, 1.6, 13, M.planks, 0, h + 10, 0); for (const dz of [-6, 6]) box(g, 13, 3, 0.8, M.wood, 0, h + 11.6, dz);
          pyramid(g, 9.5, 7, M.roofBrown, 0, h + 14.5, 0);
          return g;
        }
        const r = [0, 8, 9.5, 11, 13][tier], th = h + [0, 8, 12, 14, 18][tier];
        cyl(g, r, r + 1, th, WS, 0, 0, 0, 14);
        if (tier >= 2) for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; box(g, 3, 3.5, 3, WS, Math.cos(a) * (r - 1), th, Math.sin(a) * (r - 1)); }
        if (tier === 1) pyramid(g, r + 2, 9, M.roofBrown, 0, th, 0);
        else add(g, new T.ConeGeometry(r + 2, [0, 0, 14, 16, 20][tier], 12), tier === 4 ? M.roofSlate : M.roofRed, 0, th + 3.5 + [0, 0, 14, 16, 20][tier] / 2, 0);
        if (tier >= 2) win(g, 0, th * 0.55, r + 0.6, 2.4, 4);
        if (tier >= 3) flag(g, 0, th + 3.5 + [0, 0, 14, 16, 20][tier] - 1, 0);
        if (tier === 4) { add(g, new T.ConeGeometry(1.4, 7, 8), M.gold, 0, th + 3.5 + 20 + 3, 0); for (const dx of [-r - 0.5, r + 0.5]) add(g, new T.SphereGeometry(1.6, 8, 6), M.fire, dx, th * 0.75, 2, false); }
        return g;
      }
      function buildWall(l) {
        while (wallG.children.length) { const c = wallG.children.pop(); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
        wallG.userData.flags = [];
        wallFx = [];
        const tier = l <= 0 ? -1 : l >= 20 ? 4 : l >= 15 ? 3 : l >= 10 ? 2 : l >= 5 ? 1 : 0;
        if (tier < 0) {
          // No wall yet: a low garden fence.
          inst(new T.BoxGeometry(1.2, 6, 1.2), M.wood, along(14), ([x, z], d) => { d.position.set(x, 3, z); });
          for (const [x1, z1, x2, z2] of RUNS) for (const y of [1.8, 4]) { const L = Math.hypot(x2 - x1, z2 - z1); box(wallG, x1 === x2 ? 1 : L, 1, x1 === x2 ? L : 1, M.wood, (x1 + x2) / 2, y, (z1 + z2) / 2); }
          return;
        }
        const grow = (l - [1, 5, 10, 15, 20][tier]) * 0.9;
        const h = [10, 12, 18, 23, 28][tier] + grow, th = [3, 6, 7, 9, 11][tier];
        if (tier === 0) {
          // Palisade: sharpened logs of slightly different heights, a beam behind them.
          const logs = along(4.2), hl = p => h * (0.88 + ((Math.abs(p[0] * 7 + p[1] * 13) | 0) % 10) / 45);
          inst(new T.CylinderGeometry(1.9, 2.1, 1, 7), M.darkWood, logs, (p, d) => { const y = hl(p); d.position.set(p[0], y / 2, p[1]); d.scale.set(1, y, 1); });
          inst(new T.ConeGeometry(2.1, 4.5, 7), M.darkWood, logs, (p, d) => { d.position.set(p[0], hl(p) + 2.2, p[1]); });
          for (const [x1, z1, x2, z2] of RUNS) { const L = Math.hypot(x2 - x1, z2 - z1); box(wallG, x1 === x2 ? 1.6 : L, 1.6, x1 === x2 ? L : 1.6, M.wood, (x1 + x2) / 2 + (x1 === x2 ? -Math.sign(x1) * 2.4 : 0), h * 0.55, (z1 + z2) / 2 + (x1 === x2 ? 0 : z1 < 0 ? 2.4 : -2.4)); }
        } else {
          // Stone wall: one block per run, a cap stone on top, crenellations from level 10.
          for (const [x1, z1, x2, z2] of RUNS) {
            const L = Math.hypot(x2 - x1, z2 - z1), cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, v = x1 === x2;
            box(wallG, v ? th : L + th, h, v ? L + th : th, WS, cx, 0, cz);
            box(wallG, v ? th + 1.6 : L + th + 1.6, 1.4, v ? L + th + 1.6 : th + 1.6, lam('#8e8a84'), cx, h, cz);
          }
          const step = tier >= 2 ? 7 : 12, mh = tier >= 2 ? 4 : 2.4;
          inst(new T.BoxGeometry(1, 1, 1), WS, along(step), ([x, z, v], d) => { d.position.set(x, h + 1.4 + mh / 2, z); d.scale.set(v ? th * 0.9 : 3.6, mh, v ? 3.6 : th * 0.9); });
          if (tier === 4) inst(new T.SphereGeometry(1.5, 8, 6), M.fire, along(70), ([x, z], d) => { d.position.set(x, h * 0.7, z + (z < 0 ? th / 2 + 1 : -th / 2 - 1)); });
        }
        // Towers: corners always; the middle of the sides from 5; the top centre from 10; more from 15.
        const tp = [[-WX, ZMIN], [WX, ZMIN], [-WX, ZMAX], [WX, ZMAX]];
        if (tier >= 1) tp.push([-WX, zc], [WX, zc]);
        if (tier >= 2) tp.push([0, ZMIN - 2]);
        if (tier >= 3) for (const f of [0.25, 0.75]) tp.push([-WX, ZMIN + len * f], [WX, ZMIN + len * f]);
        for (const [x, z] of tp) { const g = tower(tier, h, x, z); if (g.userData.flags) wallG.userData.flags.push(...g.userData.flags); }
        wallG.userData.towers = tp;
        // Gate at the bottom of the street.
        if (tier === 0) { for (const sx of [-1, 1]) cyl(wallG, 1.8, 1.8, h + 6, M.darkWood, sx * GATE, 0, ZMAX, 7); box(wallG, 2 * GATE + 4, 2, 2, M.darkWood, 0, h + 4, ZMAX); return; }
        for (const sx of [-1, 1]) { const g = tower(tier, h + 4, sx * (GATE + 4), ZMAX); if (g.userData.flags) wallG.userData.flags.push(...g.userData.flags); }
        box(wallG, 2 * GATE, h * 0.35, th + 2, WS, 0, h * 0.65, ZMAX);
        if (tier >= 3) for (let x = -GATE + 3; x <= GATE - 3; x += 4.5) box(wallG, 0.9, h * 0.3, 0.9, M.iron, x, h * 0.35, ZMAX + th / 2 + 0.6);
        if (tier === 4) { const e = add(wallG, new T.CylinderGeometry(5, 5, 1.2, 20), M.gold, 0, h * 0.82, ZMAX + th / 2 + 1.2); e.rotation.x = Math.PI / 2; }
        addWallFx(h, th, tp);
      }
      function addWallFx(h, th, towers) {
        wallFx = [];
        if (wallSkin === 'lav') {
          // A glowing lava moat outside the wall, and sparks rising from the towers.
          const lm = new T.MeshBasicMaterial({ map: lavaTex, color: '#ffffff' });
          for (const [x1, z1, x2, z2] of RUNS) {
            const L = Math.hypot(x2 - x1, z2 - z1), v = x1 === x2, p = add(wallG, new T.PlaneGeometry(v ? 9 : L, v ? L : 9), lm, (x1 + x2) / 2 + (v ? Math.sign(x1) * (th / 2 + 6) : 0), 0.6, (z1 + z2) / 2 + (v ? 0 : (z1 < 0 ? -1 : 1) * (th / 2 + 6)), false);
            p.rotation.x = -Math.PI / 2;
          }
          lm.userData.tick = t => { lavaTex.offset.y = -t * 0.08; };
          wallFx.push({ tick: lm.userData.tick });
          for (let i = 0; i < 24; i++) { const [x, z] = towers[i % towers.length]; const s = add(wallG, new T.SphereGeometry(1.1, 6, 4), M.fire, x, h, z, false); wallFx.push({ spark: s, x, z, y0: h + 10, ph: Math.random() * 3 }); }
        } else if (wallSkin === 'buz') {
          // Snow falling over the walls.
          const n = 160, pos = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) { const along = Math.random(); const side = i % 3; pos[i * 3] = side === 2 ? (Math.random() * 2 - 1) * WX : (side ? 1 : -1) * (WX + (Math.random() - 0.5) * 30); pos[i * 3 + 1] = Math.random() * (h + 40); pos[i * 3 + 2] = side === 2 ? ZMIN + (Math.random() - 0.5) * 30 : ZMIN + along * (ZMAX - ZMIN); }
          const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
          const pts = new T.Points(g, new T.PointsMaterial({ color: '#ffffff', size: 2.6, transparent: true, opacity: 0.9, depthWrite: false })); wallG.add(pts);
          wallFx.push({ snow: g, top: h + 40 });
        } else if (wallSkin === 'altin') {
          // Glints twinkling on the tower tops.
          for (let i = 0; i < towers.length; i++) { const [x, z] = towers[i]; const s = add(wallG, new T.OctahedronGeometry(2.2, 0), M.glow, x, h + 12, z, false); wallFx.push({ glint: s, ph: i * 0.9 }); }
        }
      }
      const walkers = [];
      for (let i = 0; i < 10; i++) { const w = new T.Group(); person(w, 0, 0, [lam('#3b82f6'), M.clothRed, lam('#3f9e4a'), lam('#f2c032')][i % 4]); root.add(w); walkers.push({ g: w, x: (i % 2 ? 1 : -1) * (5 + (i % 3) * 3), z: ZMIN + 150 + (i * 137) % (len - 200), v: (i % 2 ? 1 : -1) * (10 + i * 2) }); }

      // ---------- Army at the rally point (instanced soldiers and horses) ----------
      const TCOL = { milis: '#c0392b', mizrak: '#2e6fd8', kilic: '#9aa3b0', hafif: '#b5651d', agir: '#5b6472', koc: '#6e4424', senator: '#f2b52a', kolonici: '#8a5a2b' };
      const MAXS = 80, MAXH = 24;
      const iBody = new T.InstancedMesh(new T.CylinderGeometry(1.7, 1.9, 6.5, 8), lam('#ffffff'), MAXS);
      const iHead = new T.InstancedMesh(new T.SphereGeometry(1.6, 8, 6), M.skin, MAXS);
      const iHelm = new T.InstancedMesh(new T.SphereGeometry(1.75, 8, 5, 0, TAU, 0, Math.PI / 2), M.iron, MAXS);
      const iSpear = new T.InstancedMesh(new T.BoxGeometry(0.45, 15, 0.45), M.darkWood, MAXS);
      const iShield = new T.InstancedMesh(new T.CylinderGeometry(2.2, 2.2, 0.6, 10), lam('#ffffff'), MAXS);
      const iHorse = new T.InstancedMesh(new T.BoxGeometry(3.6, 4.2, 10), lam('#6e4424'), MAXH);
      const iHorseHead = new T.InstancedMesh(new T.BoxGeometry(2.4, 5, 2.4), lam('#6e4424'), MAXH);
      for (const m of [iBody, iHead, iHelm, iSpear, iShield, iHorse, iHorseHead]) { m.castShadow = true; m.count = 0; m.frustumCulled = false; root.add(m); }
      const dm = new T.Object3D(), col = new T.Color();
      const F = 1.5; // soldiers are drawn 1.5x so the army reads at a glance
      let armySign = null;
      function placeArmy(troops, at) {
        let ns = 0, nh = 0;
        if (armySign) { root.remove(armySign); armySign.material.map.dispose(); armySign.material.dispose(); armySign = null; }
        // Positions are given relative to the rally plot and scaled by F around it.
        const put = (m, i, x, y, z, rx) => { dm.position.set(at[0] + (x - at[0]) * F, y * F, at[1] + (z - at[1]) * F); dm.rotation.set(rx || 0, 0, 0); dm.scale.set(F, F, F); dm.updateMatrix(); m.setMatrixAt(i, dm.matrix); };
        if (at) {
          const inf = [], cav = [];
          for (const k in troops) { const n = Math.floor(troops[k] || 0); if (n > 0) ((k === 'hafif' || k === 'agir') ? cav : inf).push([k, n]); }
          const show = (list, cap) => { const tot = list.reduce((a, x) => a + x[1], 0), out = []; for (const [k, n] of list) { const c = Math.max(1, Math.round(Math.min(cap, tot) * n / tot)); for (let i = 0; i < c; i++) out.push(k); } return out.slice(0, cap); };
          const soldiers = show(inf, cav.length ? 30 : 40), riders = show(cav, 7);
          // In the rally point's yard, in front of the tents: one rank of riders, foot soldiers behind.
          const [ax, az] = at, rr = riders.length ? 1 : 0;
          riders.forEach((k, i) => {
            const x = ax - 21 + (i % 7) * 7, z = az + 2;
            put(iHorse, nh, x, 5, z); put(iHorseHead, nh, x, 8.5, z + 5.5, -0.5); nh++;
            put(iBody, ns, x, 9.5, z); put(iHead, ns, x, 14.2, z); put(iHelm, ns, x, 14.6, z); put(iSpear, ns, x + 2, 13, z + 1, 0.4); put(iShield, ns, x - 2.2, 10, z, 0);
            iShield.setMatrixAt(ns, dm.matrix); iBody.setColorAt(ns, col.set(TCOL[k])); iShield.setColorAt(ns, col.set(TCOL[k])); ns++;
          });
          const total = Object.values(troops).reduce((a, b) => a + (b || 0), 0);
          if (total > 0) {
            const txt = '⚔️ ' + (total >= 1e6 ? (total / 1e6).toFixed(1) + 'M' : total >= 1e4 ? Math.round(total / 1e3) + 'K' : total >= 1e3 ? (total / 1e3).toFixed(1) + 'K' : String(total));
            armySign = new T.Sprite(new T.SpriteMaterial({ map: canvasTex(256, 80, (g, w, h) => { g.fillStyle = 'rgba(120,20,20,.9)'; g.beginPath(); g.roundRect(4, 6, w - 8, h - 12, 30); g.fill(); g.strokeStyle = '#ffd23f'; g.lineWidth = 5; g.stroke(); g.fillStyle = '#fff'; g.font = "800 46px Baloo, 'Arial Black', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 3); }), depthTest: false }));
            armySign.renderOrder = 11; armySign.position.set(ax + (ax < 0 ? -40 : 40), 30, az - 6); armySign.scale.set(46, 14.4, 1); root.add(armySign);
          }
          soldiers.forEach((k, i) => {
            const x = ax - 22 + (i % 10) * 4.9, z = az + 2 + rr * 11 + Math.floor(i / 10) * 6.5;
            put(iBody, ns, x, 3.3, z); put(iHead, ns, x, 8, z); put(iHelm, ns, x, 8.4, z); put(iSpear, ns, x + 2, 7, z);
            put(iShield, ns, x - 1.2, 4.5, z + 1.9, Math.PI / 2);
            iBody.setColorAt(ns, col.set(TCOL[k])); iShield.setColorAt(ns, col.set(TCOL[k])); ns++;
          });
        }
        for (const m of [iBody, iHead, iHelm, iSpear, iShield]) { m.count = ns; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
        for (const m of [iHorse, iHorseHead]) { m.count = nh; m.instanceMatrix.needsUpdate = true; }
      }

      let models = [], signs = [], sig = '', W = 1, H = 1, smokes = [];
      // ---------- Village theme ambience + the "apply" animation ----------
      // Bought themes live: petals, golden sparks, embers, fireflies or emerald motes over the whole village. When a
      // theme or a wall skin is applied, a ring of light sweeps out from the castle and every building it reaches
      // hops; a wall skin also sends a bright spark racing once around the wall.
      const dotTex = canvasTex(32, 32, (g2, w, h) => { const r = g2.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = r; g2.fillRect(0, 0, w, h); });
      const THEME_FX = { bahar: { c: '#ffb3dc', n: 90, mode: 'fall', s: 5 }, altin: { c: '#ffd75a', n: 110, mode: 'rise', s: 5 }, kizil: { c: '#ff6a3a', n: 80, mode: 'rise', s: 4.5 },
        gece: { c: '#c9b2ff', n: 70, mode: 'fly', s: 6 }, zumrut: { c: '#7dffc0', n: 80, mode: 'fly', s: 5 } };
      let themeFx = null, lastVid, lastWall, wave = null, wallRun = null;
      function setThemeFx(vid) {
        if (themeFx) { scene.remove(themeFx.pts); themeFx.pts.geometry.dispose(); themeFx.pts.material.dispose(); themeFx = null; }
        const d = THEME_FX[vid]; if (!d) return;
        const pos = new Float32Array(d.n * 3), ph = new Float32Array(d.n);
        for (let i = 0; i < d.n; i++) { pos[i * 3] = (Math.random() * 2 - 1) * (WX + 30); pos[i * 3 + 1] = Math.random() * 90; pos[i * 3 + 2] = ZMIN + Math.random() * (ZMAX - ZMIN); ph[i] = Math.random() * 6.28; }
        const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
        const pts = new T.Points(geo, new T.PointsMaterial({ map: dotTex, color: d.c, size: d.s, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
        pts.frustumCulled = false; pts.renderOrder = 6; scene.add(pts); themeFx = { pts, d, ph };
      }
      function tickThemeFx(t, dt) {
        if (!themeFx) return;
        const p = themeFx.pts.geometry.attributes.position, d = themeFx.d, ph = themeFx.ph;
        for (let i = 0; i < p.count; i++) {
          let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          if (d.mode === 'fall') { y -= dt * 10; x += Math.sin(t * 1.3 + ph[i]) * dt * 8; if (y < 0) y = 90; }
          else if (d.mode === 'rise') { y += dt * 12; x += Math.sin(t * 2 + ph[i]) * dt * 3; if (y > 90) y = 0; }
          else { x += Math.sin(t * 0.7 + ph[i]) * dt * 10; z += Math.cos(t * 0.6 + ph[i] * 1.3) * dt * 10; y = 12 + 10 * Math.sin(t * 1.1 + ph[i]); }
          p.setXYZ(i, x, y, z);
        }
        p.needsUpdate = true;
        themeFx.pts.material.opacity = d.mode === 'fly' ? 0.6 + 0.4 * Math.sin(t * 2) : 0.9;
      }
      const ringMat = new T.MeshBasicMaterial({ map: canvasTex(128, 128, (g2, w, h) => { const r = g2.createRadialGradient(64, 64, 40, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.75, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = r; g2.fillRect(0, 0, w, h); }),
        transparent: true, depthWrite: false, blending: T.AdditiveBlending });
      function startWave(color) {
        if (wave) scene.remove(wave.m);
        const m = new T.Mesh(new T.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), ringMat.clone()); m.material.color.set(color); m.position.set(0, 3, Z0); m.renderOrder = 7; scene.add(m);
        wave = { m, t: 0, max: Math.hypot(WX + 40, ZMAX - Z0) + 40 };
      }
      function tickWave(dt) {
        if (!wave) return;
        wave.t += dt; const k = Math.min(1, wave.t / 1.4), r = wave.max * k;
        wave.m.scale.set(r, 1, r); wave.m.material.opacity = 1 - k * k;
        for (const g of models) {
          if (g.userData.s0 == null) g.userData.s0 = g.scale.x;
          const d = Math.hypot(g.position.x - wave.m.position.x, g.position.z - wave.m.position.z), u = (r - d) / 60;
          g.scale.setScalar(g.userData.s0 * (u > 0 && u < 1 ? 1 + 0.18 * Math.sin(u * Math.PI) : 1));
        }
        if (k >= 1) { scene.remove(wave.m); wave.m.geometry.dispose(); wave.m.material.dispose(); wave = null; }
      }
      const runSpark = new T.Sprite(new T.SpriteMaterial({ map: dotTex, color: '#fff2b0', transparent: true, depthWrite: false, blending: T.AdditiveBlending })); runSpark.scale.setScalar(26); runSpark.visible = false; scene.add(runSpark);
      function tickWallRun(dt, h) {
        if (!wallRun) return;
        wallRun.t += dt; const k = Math.min(1, wallRun.t / 1.8), total = RUNS.reduce((a, r) => a + Math.hypot(r[2] - r[0], r[3] - r[1]), 0);
        let s = k * total, x = 0, z = 0;
        for (const [x1, z1, x2, z2] of RUNS) { const L = Math.hypot(x2 - x1, z2 - z1); if (s <= L) { x = x1 + (x2 - x1) * s / L; z = z1 + (z2 - z1) * s / L; break; } s -= L; }
        runSpark.visible = k < 1; runSpark.position.set(x, h + 8, z); runSpark.material.color.set(wallRun.c);
        if (k >= 1) wallRun = null;
      }
      const v3 = new T.Vector3(), ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3();

      function rebuild(st) {
        models.forEach(m => { root.remove(m); m.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); });
        signs.forEach(s => { root.remove(s); s.material.map.dispose(); s.material.dispose(); });
        models = []; signs = []; smokes = [];
        let rallyAt = null;
        st.slots.forEach((s, i) => {
          const g = new T.Group(), [x, z] = PLOTS[i], bq = (st.bqs || []).find(b => b.slot === i), busy = !!bq, info = st.info(i);
          g.position.set(x, 0, z);
          if (i === GATE_PLOT) {
            const sp = new T.Sprite(new T.SpriteMaterial({ map: badgeTex(info.icon, busy && s ? s.l + 1 : info.lvl || 1, busy, !s && !busy), depthTest: false }));
            sp.renderOrder = 10; sp.position.set(x, 4, z); sp.scale.set(!s && !busy ? 30 : 60, !s && !busy ? 11 : 22.5, 1);
            root.add(sp); signs.push(sp);
            return;
          }
          // Built plots: a hexagonal stone plinth with a grass top and props around it; empty plots stay bare earth.
          const built = !!(s || busy), R = i ? 46 : 66, PH = 3.2;
          if (built) {
            const base = add(g, new T.CylinderGeometry(R, R + 2, PH, 6), M.stone, 0, PH / 2, i ? -6 : -8); base.rotation.y = Math.PI / 6;
            const top = add(g, new T.CylinderGeometry(R - 3, R - 3, 0.6, 6), grassMat, 0, PH + 0.3, i ? -6 : -8, false); top.rotation.y = Math.PI / 6;
            if (KK && s && s.t !== 'rally' && i) {
              const props = ['barrel', 'sack', 'crate_A_big', 'resource_lumber', 'tree_single_A', 'wheelbarrow', 'rock_single_A'];
              for (let k = 0; k < 2; k++) {
                const a = (i * 2.1 + k * 2.3) % (Math.PI * 2), name = props[(i * 3 + k) % props.length];
                kk(g, name, name === 'tree_single_A' ? 15 : 11, Math.cos(a) * (R - 9), PH + 0.6, -6 + Math.sin(a) * (R - 12) * 0.85, a);
              }
            }
            // Garden details: a low fence open at the front, flower bushes and two lanterns at the entrance.
            const cz = i ? -6 : -8, fr = R - 4;
            for (let k = 0; k < 22; k++) {
              const a = k / 22 * TAU; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.42) continue; // gate gap (front, +z)
              box(g, 1, 4.2, 1, M.wood, Math.cos(a) * fr, PH + 0.6, cz + Math.sin(a) * fr * 0.92);
              const a2 = (k + 1) / 22 * TAU; if (Math.abs(Math.atan2(Math.sin(a2 - Math.PI / 2), Math.cos(a2 - Math.PI / 2))) < 0.42) continue;
              const mx = (Math.cos(a) + Math.cos(a2)) / 2 * fr, mz = cz + (Math.sin(a) + Math.sin(a2)) / 2 * fr * 0.92, rail = box(g, 2 * fr * Math.sin(Math.PI / 22) + 0.6, 0.7, 0.6, M.wood, mx, PH + 3.2, mz);
              rail.rotation.y = -Math.atan2(Math.sin(a2) * 0.92 - Math.sin(a) * 0.92, Math.cos(a2) - Math.cos(a));
            }
            const fl = [M.fruitR, M.fruitY, lam('#ff8fd1'), lam('#ffffff')];
            for (let k = 0; k < 4; k++) {
              const a = Math.PI / 2 + (k < 2 ? -1 : 1) * (0.62 + (k % 2) * 0.5), bx = Math.cos(a) * (fr - 6), bz = cz + Math.sin(a) * (fr - 6) * 0.92;
              add(g, new T.IcosahedronGeometry(3.4, 0), M.leaf, bx, PH + 2.6, bz).scale.y = 0.75;
              for (let q = 0; q < 4; q++) add(g, new T.SphereGeometry(0.75, 6, 4), fl[(i + k) % fl.length], bx + Math.cos(q * 1.7) * 2.6, PH + 4.4, bz + Math.sin(q * 1.7) * 2.2, false);
            }
            for (const sx of [-1, 1]) { const lx = sx * 9, lz = cz + fr * 0.92 + 1; cyl(g, 0.45, 0.6, 10, M.darkWood, lx, PH + 0.6, lz, 6); box(g, 2.2, 2.6, 2.2, M.glow, lx, PH + 10.4, lz, false); box(g, 3, 0.6, 3, M.darkWood, lx, PH + 13, lz); }
          } else { const yard = add(g, new T.CircleGeometry(i ? 50 : 70, 28), M.dirt, 0, 0.35, i ? -6 : -8, false); yard.rotation.x = -Math.PI / 2; yard.scale.set(1, 0.85, 1); }
          const bm = new T.Group(); bm.position.set(0, built ? PH + 0.6 : 0, i ? -12 : -16); g.add(bm);
          if (busy && !s) { if (KK) kk(bm, ['stage_A', 'stage_B', 'stage_C'][stageOf(bq)], 40); else scaffold(bm, 18); bm.scale.setScalar(1.1); }
          else if (s && MODELS[s.t]) {
            (KMODELS && KMODELS[s.t] ? KMODELS[s.t] : MODELS[s.t])(bm);
            // Buildings grow with their level (Travian-style): up to +35% at the top level, flags from half-way.
            // Smaller than before so each building sits inside its garden with room to breathe.
            const f = Math.min(1, s.l / (info.max || 20)), k = 0.9 + f * 0.25;
            bm.scale.setScalar(i ? k * 1.12 : k * 1.55);
            if (f >= 0.5 && s.t !== 'main') flag(bm, 16, 0, -12);
            if (busy) { if (KK) kk(bm, 'scaffolding', 22, 26, 0, 12); else scaffold(bm, 28); }
            if (s.t === 'rally') { rallyAt = [x, z]; bm.position.z = -30; bm.scale.multiplyScalar(0.8); }
          } else {
            for (const [dx, dz] of [[-30, -34], [30, -34], [-30, 26], [30, 26]]) box(g, 1.4, 7, 1.4, M.wood, dx, 0, dz);
            for (let k = 0; k < 4; k++) { const lg = cyl(g, 1.6, 1.6, 16, M.wood, -6, 1.6 + (k % 2) * 2.6, -8 + k * 3.4, 8); lg.rotation.z = Math.PI / 2; }
          }
          if (bm.userData.smoke) smokes.push({ g: bm, p: bm.userData.smoke, t: Math.random(), puffs: [] });
          if (bm.userData.flags) g.userData.flags = bm.userData.flags;
          root.add(g); models.push(g);
          const sp = new T.Sprite(new T.SpriteMaterial({ map: badgeTex(info.icon, busy && s ? s.l + 1 : info.lvl, busy, !s && !busy), depthTest: false }));
          sp.renderOrder = 10;
          sp.position.set(x, 4, z + (s && s.t === 'rally' ? 62 : i ? 36 : 52)); sp.scale.set(!s && !busy ? 30 : 60, !s && !busy ? 11 : 22.5, 1);
          root.add(sp); signs.push(sp);
        });
        placeArmy(st.troops || {}, rallyAt);
        const wid = st.theme.wallId || 'tas';
        if (wid !== wallSkin) { wallSkin = wid; WS = wallMat(wid); wallLv = -1; }
        if (st.wall !== wallLv) { wallLv = st.wall; buildWall(st.wall); }
        grassMat.color.set(st.theme.grass); outerMat.color.set(st.theme.grass).multiplyScalar(0.86);
        if (kkMat) { const t = themeTex(st.theme.id, st.theme.hue); if (kkMat.map !== t) { kkMat.map = t; kkMat.needsUpdate = true; } }
        // Wall skin: tint the stone and let it glow a little so gold/ice/lava read as their colour, not as dark stone.

        M.leaf.color.set(st.theme.leaf || '#3f9e4a');
      }

      const PUFF = new T.SphereGeometry(2.6, 8, 6);
      // Construction stage (0-2) from the build's progress.
      const stageOf = b => Math.max(0, Math.min(2, Math.floor(3 * (Date.now() - (b.start || Date.now())) / Math.max(1, b.done - (b.start || 0)))));
      let acc = 0;
      const R = {
        resize(w, h) {
          W = w; H = h; renderer.setSize(w, h, false);
          const halfH = HALF_W * h / w, zc = (ZMIN + ZMAX) / 2;
          Object.assign(camera, { left: -HALF_W, right: HALF_W, top: halfH, bottom: -halfH });
          camera.position.set(0, Math.sin(PITCH) * 1500, zc + Math.cos(PITCH) * 1500 + 30);
          camera.lookAt(0, 0, zc + 30);
          camera.updateProjectionMatrix();
        },
        render(st, dt) {
          acc += dt;
          if (acc < 1 / 30 || (kkImg && !kkImg.complete)) return;
          dt = Math.min(0.1, acc); acc = 0;
          const s2 = JSON.stringify(st.slots) + (st.bqs || []).map(b => b.slot + b.t + stageOf(b)).join(',') + st.wall + st.theme.grass + st.theme.hue + st.theme.wallId + JSON.stringify(st.troops || {});
          if (s2 !== sig) { sig = s2; rebuild(st); }
          const t = performance.now() / 1000;
          if (st.theme.vid !== lastVid) { if (lastVid !== undefined) startWave(st.theme.hue != null ? 'hsl(' + st.theme.hue + ',90%,65%)' : '#ffffff'); lastVid = st.theme.vid; setThemeFx(st.theme.vid); }
          if (st.theme.wallId !== lastWall) { if (lastWall !== undefined) { wallRun = { t: 0, c: { altin: '#ffe27a', buz: '#c9f1ff', lav: '#ff8a3a', obsidyen: '#b9a0ff' }[st.theme.wallId] || '#ffffff' }; startWave(wallRun.c); } lastWall = st.theme.wallId; }
          tickThemeFx(t, dt); tickWave(dt); tickWallRun(dt, 30);
          models.forEach(g => (g.userData.flags || []).forEach((f, k) => { f.rotation.y = Math.sin(t * 3 + k + g.position.x) * 0.4; }));
          (wallG.userData.flags || []).forEach((f, k) => { f.rotation.y = Math.sin(t * 3 + k) * 0.4; });
          if (WS.userData.tick) WS.userData.tick(t);
          for (const f of wallFx) {
            if (f.tick) f.tick(t);
            if (f.spark) { const k = ((t * 0.5 + f.ph) % 1); f.spark.position.set(f.x + Math.sin(t * 3 + f.ph) * 3, f.y0 + k * 30, f.z); f.spark.scale.setScalar(1 - k); }
            if (f.glint) { const k = Math.max(0, Math.sin(t * 2.5 + f.ph)); f.glint.scale.setScalar(0.2 + k * 1.2); f.glint.rotation.y = t * 2; }
            if (f.snow) { const p = f.snow.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) - dt * 14; if (y < 0) y = f.top; p.setY(i, y); } p.needsUpdate = true; }
          }
          for (const w of walkers) { w.z += w.v * dt; if (w.z > ZMAX - 40 || w.z < ZMIN + 130) w.v = -w.v; w.g.position.set(w.x, Math.abs(Math.sin(t * 8 + w.x)) * 0.8, w.z); w.g.rotation.y = w.v > 0 ? 0 : Math.PI; }
          for (const sm of smokes) {
            if ((sm.t -= dt) <= 0) { sm.t = 0.45; const p = add(sm.g, PUFF, M.smoke, sm.p[0], sm.p[1], sm.p[2], false); sm.puffs.push({ m: p, life: 2.6 }); }
            for (const p of sm.puffs) { p.life -= dt; p.m.position.y += dt * 8; p.m.position.x += dt * 2; p.m.scale.setScalar(1 + (2.6 - p.life) * 0.7); }
            sm.puffs = sm.puffs.filter(p => { if (p.life > 0) return true; sm.g.remove(p.m); return false; });
          }
          renderer.render(scene, camera);
        },
        project(i, h) { const [x, z] = PLOTS[i]; v3.set(x, h || 0, z).project(camera); return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H }; },
        pick(px, py) {
          ray.setFromCamera(new T.Vector2(px / W * 2 - 1, -(py / H) * 2 + 1), camera);
          if (!ray.ray.intersectPlane(plane, hit)) return -1;
          let best = -1, bd = 66;
          PLOTS.forEach(([x, z], i) => { const d = Math.hypot(hit.x - x, hit.z - z); if (d < bd) { bd = d; best = i; } });
          return best;
        },
      };
      return R;
    },
  };
})();
