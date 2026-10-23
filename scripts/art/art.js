// Cinematic 3D key art for the hub cards, the hub logo and the launcher icon. Rendered offline in headless
// Chrome by scripts/make-art.js: art.html#<scene> at the requested window size.
(function () {
  'use strict';
  const T = THREE, TAU = Math.PI * 2;
  const [which, pw, ph] = (location.hash.slice(1) || 'suru').split(':');
  const W = +pw || innerWidth, H = +ph || innerHeight;
  const transparent = which === 'emblem';
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: transparent, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  if (transparent) renderer.setClearColor(0x000000, 0);
  document.body.appendChild(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, W / H, 1, 6000);

  // ---------- Helpers ----------
  const std = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.05 }, o || {}));
  const glow = color => new T.MeshBasicMaterial({ color, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  function mesh(geo, mat, x, y, z, parent, noShadow) {
    const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = !noShadow; m.receiveShadow = true;
    (parent || scene).add(m); return m;
  }
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  function gradientBg(stops, horizontal) {
    scene.background = canvasTex(horizontal ? 512 : 4, horizontal ? 4 : 512, (g, w, h) => {
      const grd = horizontal ? g.createLinearGradient(0, 0, w, 0) : g.createLinearGradient(0, 0, 0, h);
      stops.forEach(([o, c]) => grd.addColorStop(o, c));
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    });
  }
  function sun(color, intensity, pos, size, target) {
    const s = new T.DirectionalLight(color, intensity);
    s.position.set(...pos); s.castShadow = true;
    s.shadow.mapSize.set(4096, 4096);
    Object.assign(s.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: 4000 });
    s.shadow.bias = -0.0004; s.shadow.normalBias = 0.5;
    if (target) s.target.position.set(...target);
    scene.add(s, s.target); return s;
  }
  function label(text, bg, fg, w, h) {
    return canvasTex(w || 256, h || 128, (g, cw, ch) => {
      g.font = "800 " + Math.round(ch * 0.62) + "px Baloo, 'Arial Black', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, cw - 8, ch - 8, ch / 2 - 4); g.fill(); }
      g.lineJoin = 'round'; g.lineWidth = ch * 0.12; g.strokeStyle = '#1b1464'; g.strokeText(text, cw / 2, ch / 2 + 4);
      g.fillStyle = fg || '#fff'; g.fillText(text, cw / 2, ch / 2 + 4);
    });
  }
  function sprite(tex, x, y, z, w, h) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthWrite: false })); s.position.set(x, y, z); s.scale.set(w, h, 1); scene.add(s); return s;
  }
  // Soldier / worker figure. dir: facing (0 = toward -z).
  function figure(o) {
    const g = new T.Group(), s = o.scale || 1, ph = o.phase || 0, sw = Math.sin(ph) * (o.run === false ? 0 : 0.7);
    const legM = std(o.leg || '#2b3140'), body = std(o.body, { roughness: 0.45 }), skin = std(o.skin || '#f1c38f', { roughness: 0.7 });
    for (const k of [-1, 1]) { const l = mesh(new T.CapsuleGeometry(1.35, 4, 4, 10), legM, k * 1.7, 3.4, 0, g); l.rotation.x = sw * k; }
    mesh(new T.CapsuleGeometry(3, 4.4, 6, 16), body, 0, 9.8 + Math.abs(sw) * 0.6, 0, g).rotation.x = -0.12;
    mesh(new T.SphereGeometry(2.7, 20, 16), skin, 0, 16, -0.4, g);
    const helm = mesh(new T.SphereGeometry(3.15, 20, 12, 0, TAU, 0, Math.PI / 2), std(o.helmet || '#3d4a2a', { roughness: 0.4, metalness: o.metalHelm ? 0.6 : 0.1 }), 0, 16.6, -0.4, g);
    helm.scale.y = 0.85;
    if (o.spike) mesh(new T.ConeGeometry(1.2, 3.6, 10), std('#d6d6d6', { metalness: 0.8, roughness: 0.3 }), 0, 20.6, -0.4, g);
    if (o.lamp) { mesh(new T.CylinderGeometry(1, 1, 1, 12), glow('#fff4b0'), 0, 17.6, -3, g, true).rotation.x = Math.PI / 2; }
    if (o.pack) mesh(new T.BoxGeometry(4.6, 5, 2.4), std(o.pack), 0, 10.4, 3.3, g);
    if (o.gun) {
      const gun = mesh(new T.BoxGeometry(1.3, 1.8, 12), std('#22252b', { metalness: 0.6, roughness: 0.35 }), 2.6, 10.8, -6.5, g);
      if (o.flash) mesh(new T.SphereGeometry(1.6, 12, 10), glow('#ffd27a'), 2.6, 10.8, -14, g, true).scale.set(1, 1, 2.2);
      gun.rotation.x = 0.02;
    }
    if (o.club) { const c = mesh(new T.CylinderGeometry(1.2, 2.2, 13, 10), std('#7a4a26', { roughness: 0.9 }), 4.4, 13, -2, g); c.rotation.x = -0.8; }
    if (o.pick) {
      const p = new T.Group(); p.position.set(4, 13, -2); p.rotation.set(-0.9 + Math.sin(ph) * 0.4, 0, -0.3); g.add(p);
      mesh(new T.CylinderGeometry(0.6, 0.6, 14, 8), std('#8a5a2b'), 0, 4, 0, p);
      const head = mesh(new T.TorusGeometry(5, 0.9, 8, 20, Math.PI * 0.7), std('#c9d1e0', { metalness: 0.8, roughness: 0.25 }), 0, 9, 0, p);
      head.rotation.z = Math.PI * 0.15;
    }
    g.scale.setScalar(s); g.position.set(o.x || 0, o.y || 0, o.z || 0); g.rotation.y = o.dir || 0;
    scene.add(g); return g;
  }
  function tree(x, z, s, c) {
    const g = new T.Group();
    mesh(new T.CylinderGeometry(2.2, 3.2, 18, 8), std('#6e4424', { roughness: 0.9 }), 0, 9, 0, g);
    const leaf = std(c || '#3f9e4a', { roughness: 0.8, flatShading: true });
    mesh(new T.IcosahedronGeometry(15, 1), leaf, 0, 26, 0, g).scale.y = 0.85;
    mesh(new T.IcosahedronGeometry(10, 1), leaf, 3, 38, -2, g);
    g.position.set(x, 0, z); g.scale.setScalar(s || 1); g.rotation.y = x * 0.37; scene.add(g); return g;
  }
  function explosion(x, y, z, r) {
    mesh(new T.SphereGeometry(r, 32, 24), glow('#ff7a1a'), x, y, z, null, true);
    mesh(new T.SphereGeometry(r * 0.72, 32, 24), glow('#ffb347'), x, y + r * 0.1, z, null, true);
    mesh(new T.SphereGeometry(r * 0.42, 24, 18), glow('#fff6c8'), x, y + r * 0.1, z, null, true);
    const ring = mesh(new T.RingGeometry(r * 1.3, r * 1.6, 48), glow('#ff9a3c'), x, 1, z, null, true); ring.rotation.x = -Math.PI / 2;
    const smokeM = std('#6b6660', { transparent: true, opacity: 0.8, roughness: 1 });
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; mesh(new T.IcosahedronGeometry(r * (0.35 + (i % 3) * 0.1), 2), smokeM, x + Math.cos(a) * r * 0.9, y + r * 0.5 + (i % 2) * r * 0.4, z + Math.sin(a) * r * 0.6, null, true); }
    for (let i = 0; i < 16; i++) { const a = i * 2.4, d = r * (1.1 + (i % 4) * 0.3); mesh(new T.BoxGeometry(1.4, 1.4, 1.4), glow(i % 2 ? '#ffd23f' : '#ff6a1a'), x + Math.cos(a) * d, y + (i % 5) * r * 0.25, z + Math.sin(a) * d * 0.6, null, true); }
    const l = new T.PointLight(0xff8a3c, 6, r * 9, 1.2); l.position.set(x, y + r, z); scene.add(l);
  }
  function tracer(x, y, z, len, color) {
    mesh(new T.BoxGeometry(0.9, 0.9, len), glow(color || '#ffe066'), x, y, z, null, true);
  }

  function environment() {
    const pm = new T.PMREMGenerator(renderer), es = new T.Scene();
    es.add(new T.Mesh(new T.SphereGeometry(100, 32, 16), new T.MeshBasicMaterial({ side: T.BackSide, map: canvasTex(4, 256, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.45, '#a9d2ff'); grd.addColorStop(0.55, '#8a7a66'); grd.addColorStop(1, '#2a2018');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }) })));
    for (const [x, y, z, c] of [[-60, 50, 40, '#ffffff'], [70, 30, -40, '#ffe2b0'], [0, 80, -60, '#cfe6ff']]) {
      const m = new T.Mesh(new T.BoxGeometry(30, 18, 2), new T.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m);
    }
    scene.environment = pm.fromScene(es, 0.03).texture;
  }
  environment();

  // ---------- Scenes ----------
  const SCENES = {
    // Squad in the reward lane, enemy flood + fortress on the right lane, bomber overhead.
    suru() {
      gradientBg([[0, '#2f74d0'], [0.6, '#9fd0f5'], [1, '#e4f2fc']]);
      scene.fog = new T.Fog(0xd6ebf8, 600, 1700);
      for (let i = 0; i < 9; i++) mesh(new T.ConeGeometry(260 + (i % 3) * 80, 220 + (i % 4) * 60, 8), std('#6aa85a', { flatShading: true, roughness: 1 }), -1300 + i * 330, 60, -1500 - (i % 2) * 150);
      scene.add(new T.HemisphereLight(0xcfe8ff, 0x6a5a3a, 1.2));
      sun(0xffe2b8, 3.2, [-260, 420, 120], 520, [0, 0, -200]);
      const grass = mesh(new T.PlaneGeometry(4000, 4000), std('#5aa648', { roughness: 1 }), 0, -0.5, -800); grass.rotation.x = -Math.PI / 2;
      const road = mesh(new T.BoxGeometry(220, 2, 2000), std('#454b57', { roughness: 0.9 }), 0, 0, -700); road.receiveShadow = true;
      const lane = (x, c) => { const m = mesh(new T.PlaneGeometry(106, 2000), std(c, { transparent: true, opacity: 0.55, roughness: 0.8 }), x, 1.2, -700); m.rotation.x = -Math.PI / 2; };
      lane(-55, '#2bd47a'); lane(55, '#e8323f');
      for (let z = 60; z > -1600; z -= 36) {
        mesh(new T.BoxGeometry(4, 3, 26), std(Math.round(z / 36) % 2 ? '#f4f1ea' : '#e23b3b'), 0, 2.5, z);
        for (const sx of [-1, 1]) mesh(new T.BoxGeometry(8, 5, 36), std(Math.round(z / 36) % 2 ? '#f4f1ea' : '#d63838'), sx * 114, 2, z);
        for (let k = 0; k < 2; k++) { const ch = mesh(new T.BoxGeometry(28, 0.4, 5), glow(k ? '#ff8a8a' : '#b8ffd6'), (k ? 55 : -55), 1.6, z + 10, null, true); ch.material.opacity = 0.35; }
      }
      for (let i = 0; i < 26; i++) { const sx = i % 2 ? 1 : -1; tree(sx * (160 + (i * 37) % 120), 40 - i * 60, 1.1 + (i % 3) * 0.25, ['#3f9e4a', '#2f8a43', '#5bb04d'][i % 3]); }
      // Gate in the reward lane.
      const gz = -95;
      for (const sx of [-1, 1]) { mesh(new T.CylinderGeometry(3.2, 3.8, 48, 16), std('#f2f2f2', { metalness: 0.3, roughness: 0.3 }), -55 + sx * 48, 24, gz); mesh(new T.SphereGeometry(5, 16, 12), std('#3be07a', { emissive: '#3be07a', emissiveIntensity: 0.8 }), -55 + sx * 48, 50, gz); }
      mesh(new T.BoxGeometry(100, 5, 5), std('#3be07a', { emissive: '#3be07a', emissiveIntensity: 0.8 }), -55, 47, gz);
      const panel = mesh(new T.PlaneGeometry(94, 42), glow('#3be07a'), -55, 23, gz, null, true); panel.material.opacity = 0.45;
      sprite(label('+40', null, '#ffffff', 256, 128), -55, 27, gz + 2, 48, 24);
      // Squad.
      for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) {
        figure({ body: '#2f7bff', helmet: '#1c4aa8', pack: '#56643a', gun: true, flash: r === 0 && c % 2 === 0, scale: 1.55, x: -55 + (c - 2) * 17, z: 10 + r * 17, phase: r * 1.3 + c * 2.1 });
      }
      for (let i = 0; i < 18; i++) tracer(-80 + (i % 5) * 12, 17, -20 - i * 12 - (i % 3) * 8, 16);
      // Enemy flood.
      for (let i = 0; i < 44; i++) {
        const big = i % 13 === 0;
        figure({ body: big ? '#8e1b2a' : '#e0353d', helmet: '#2a1216', spike: true, club: big, leg: '#3a1418', skin: '#d8a27a', scale: big ? 2.6 : 1.5,
          x: 20 + (i * 29) % 70, z: -120 - Math.floor(i / 4) * 22 - (i % 3) * 5, dir: Math.PI, phase: i * 1.7 });
      }
      explosion(62, 12, -175, 16);
      explosion(38, 8, -265, 12);
      // Fortress on the enemy lane.
      const f = new T.Group(); f.position.set(55, 0, -560); scene.add(f);
      const stone = std('#8a857f', { roughness: 0.95 }), roof = std('#a3212c', { roughness: 0.5 });
      mesh(new T.BoxGeometry(130, 70, 44), stone, 0, 35, 0, f);
      for (let k = -6; k <= 6; k += 2) mesh(new T.BoxGeometry(9, 10, 46), stone, k * 9.5, 75, 0, f);
      for (const sx of [-1, 1]) {
        mesh(new T.CylinderGeometry(22, 26, 110, 20), stone, sx * 70, 55, 4, f);
        mesh(new T.ConeGeometry(28, 46, 20), roof, sx * 70, 132, 4, f);
        const fl = mesh(new T.PlaneGeometry(22, 13), std('#e23b3b', { side: T.DoubleSide }), sx * 70 + 11, 168, 4, f); fl.rotation.y = 0.3;
        mesh(new T.CylinderGeometry(0.8, 0.8, 26, 6), std('#333'), sx * 70, 162, 4, f);
      }
      mesh(new T.BoxGeometry(34, 44, 4), std('#2a1a10'), 0, 22, 23, f);
      // Bomber overhead.
      const p = new T.Group(); p.position.set(40, 120, -250); p.rotation.set(0.12, 0.15, -0.18); scene.add(p);
      const pb = std('#5f6f4c', { metalness: 0.4, roughness: 0.45 });
      mesh(new T.CapsuleGeometry(8, 56, 8, 20), pb, 0, 0, 0, p).rotation.x = Math.PI / 2;
      mesh(new T.BoxGeometry(140, 3, 24), pb, 0, -1, -4, p);
      mesh(new T.BoxGeometry(46, 2, 13), pb, 0, 1, 32, p);
      mesh(new T.BoxGeometry(2, 20, 15), pb, 0, 10, 33, p);
      mesh(new T.SphereGeometry(6, 16, 12), std('#9fd8ff', { metalness: 0.9, roughness: 0.08 }), 0, 4, -24, p).scale.set(1, 0.8, 1.6);
      for (const sx of [-1, 1]) {
        mesh(new T.CylinderGeometry(4.6, 5, 20, 16), std('#a9b3a0'), sx * 30, -3, -8, p).rotation.x = Math.PI / 2;
        const disc = mesh(new T.CircleGeometry(12, 24), new T.MeshBasicMaterial({ color: '#dddddd', transparent: true, opacity: 0.25, side: T.DoubleSide }), sx * 30, -3, -19, p, true);
        mesh(new T.CylinderGeometry(6, 6, 0.5, 20), std('#e23b3b'), sx * 50, 0.8, -4, p); disc.rotation.y = 0;
      }
      for (let i = 0; i < 4; i++) mesh(new T.CapsuleGeometry(2.6, 6, 4, 10), std('#30352a', { metalness: 0.5 }), 40 + i * 3, 95 - i * 22, -235 - i * 14);
      camera.fov = 36; camera.position.set(-60, 120, 260); camera.lookAt(0, 0, -190);
    },

    // Hex island with blue and red towers and marching columns.
    koloni() {
      gradientBg([[0, '#1d4f9e'], [0.6, '#5aa7e8'], [1, '#bfe4ff']]);
      scene.add(new T.HemisphereLight(0xdcefff, 0x335577, 1.3));
      sun(0xfff0d8, 3, [-300, 500, 250], 450);
      const sea = mesh(new T.PlaneGeometry(5000, 5000), std('#1f6fcf', { roughness: 0.15, metalness: 0.2 }), 0, -18, 0); sea.rotation.x = -Math.PI / 2;
      for (let i = 0; i < 40; i++) { const w = mesh(new T.PlaneGeometry(30 + (i % 4) * 12, 2), glow('#9fd8ff'), -600 + (i * 157) % 1200, -17, -500 + (i * 97) % 900, null, true); w.rotation.x = -Math.PI / 2; w.material.opacity = 0.35; }
      const towers = [
        { x: -150, z: 110, o: 'b', n: 42 }, { x: -40, z: 30, o: 'b', n: 18 }, { x: -170, z: -40, o: 'b', n: 25 },
        { x: 150, z: -120, o: 'r', n: 38 }, { x: 60, z: -170, o: 'r', n: 21 },
        { x: 90, z: 60, o: 'n', n: 10 }, { x: -60, z: -150, o: 'n', n: 8 }, { x: 190, z: 50, o: 'n', n: 12 },
      ];
      const COL = { b: '#4d8dff', r: '#ff5a64', n: '#e9d9b0' };
      const R = 22, hw = R * Math.sqrt(3);
      for (let q = -9; q <= 9; q++) for (let r = -7; r <= 7; r++) {
        const x = q * hw + (r % 2 ? hw / 2 : 0), z = r * R * 1.5;
        if (Math.hypot(x * 0.8, z) > 250 + Math.sin(q * 1.7 + r) * 18) continue;
        let best = towers[0], bd = 1e9;
        for (const t of towers) { const d = Math.hypot(t.x - x, t.z - z); if (d < bd) { bd = d; best = t; } }
        const h = 16 + ((q * 7 + r * 13) % 5) * 1.5;
        mesh(new T.CylinderGeometry(R - 1.2, R - 1.2, h, 6), std(COL[best.o], { roughness: 0.7 }), x, h / 2 - 16, z).rotation.y = Math.PI / 6;
        mesh(new T.CylinderGeometry(R - 0.2, R + 1, 14, 6), std('#7a5230', { roughness: 1 }), x, -20, z).rotation.y = Math.PI / 6;
      }
      const TC = { b: ['#2f6fe0', '#1c4aa8'], r: ['#e5323f', '#8e1b2a'], n: ['#c9bda0', '#8a7f68'] };
      for (const t of towers) {
        const [c1, c2] = TC[t.o], g = new T.Group(); g.position.set(t.x, 2, t.z); scene.add(g);
        const s = t.o === 'n' ? 0.8 : 1;
        mesh(new T.CylinderGeometry(20 * s, 22 * s, 6, 24), std('#b9a888'), 0, 3, 0, g);
        mesh(new T.CylinderGeometry(13 * s, 15 * s, 44 * s, 20), std(c1, { roughness: 0.5 }), 0, 26 * s, 0, g);
        for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; mesh(new T.BoxGeometry(6 * s, 7 * s, 6 * s), std(c1), Math.cos(a) * 13 * s, 50 * s, Math.sin(a) * 13 * s, g); }
        mesh(new T.ConeGeometry(15 * s, 22 * s, 20), std(c2, { roughness: 0.4 }), 0, 62 * s, 0, g);
        mesh(new T.BoxGeometry(8 * s, 12 * s, 2), std('#1d140e'), 0, 10 * s, 14 * s, g);
        sprite(label(String(t.n), t.o === 'b' ? '#1c4aa8' : t.o === 'r' ? '#8e1b2a' : '#5b5347', '#fff', 192, 128), t.x, 96 * s, t.z, 30, 20);
      }
      // Marching columns: blue from (-40,30) toward neutral (90,60); red from (60,-170) toward (-40,30).
      const march = (a, b, n, body, helm) => {
        for (let i = 0; i < n; i++) {
          const u = 0.18 + i / n * 0.64, x = a.x + (b.x - a.x) * u + ((i % 3) - 1) * 5, z = a.z + (b.z - a.z) * u + ((i % 2) - 0.5) * 6;
          figure({ body, helmet: helm, scale: 1.1, x, y: 2, z, dir: Math.atan2(-(b.x - a.x), -(b.z - a.z)), phase: i * 1.9 });
        }
      };
      march(towers[1], towers[5], 16, '#2f7bff', '#1c4aa8');
      march(towers[4], towers[1], 12, '#e0353d', '#2a1216');
      march(towers[0], towers[6], 10, '#2f7bff', '#1c4aa8');
      explosion(-8, 8, -40, 10);
      camera.fov = 34; camera.position.set(-30, 250, 360); camera.lookAt(5, -10, -25);
    },

    // Cut-away gold mine with glowing ore, miners, cart and headframe.
    maden() {
      gradientBg([[0, '#4a9be8'], [0.5, '#a6d8ff'], [1, '#ffe2b0']]);
      scene.add(new T.HemisphereLight(0xdcefff, 0x4a3018, 0.9));
      sun(0xffe6c0, 2.6, [-200, 500, 400], 500);
      const dirt = std('#5a3a20', { roughness: 1 }), dirt2 = std('#4a2f1a', { roughness: 1 }), wood = std('#8a5a2b', { roughness: 0.8 });
      mesh(new T.BoxGeometry(900, 20, 300), std('#5aa648', { roughness: 1 }), 0, 10, -100);
      mesh(new T.BoxGeometry(900, 520, 40), dirt2, 0, -260, -80);
      for (const [y, h] of [[-12.5, 25], [-140, 50], [-280, 50], [-457.5, 125]]) mesh(new T.BoxGeometry(900, h, 120), dirt, 0, y, 0);
      mesh(new T.BoxGeometry(105, 520, 120), dirt, -397.5, -260, 0);
      mesh(new T.BoxGeometry(80, 520, 120), dirt, 410, -260, 0);
      for (let i = 0; i < 40; i++) { const rk = mesh(new T.DodecahedronGeometry(6 + (i % 4) * 3, 0), std(i % 7 ? '#6e4a2c' : '#8a8f98', { roughness: 1, flatShading: true }), -440 + (i * 97) % 880, [-12, -140, -280, -430][i % 4] + ((i * 13) % 20) - 10, 60); rk.rotation.set(i, i * 2, 0); }
      const levels = [{ y: -70, c: '#ffd23f', e: '#b37a00' }, { y: -210, c: '#ff3b5c', e: '#8a0020' }, { y: -350, c: '#39e08a', e: '#006b3a' }];
      for (const [li, L] of levels.entries()) {
        const floor = mesh(new T.BoxGeometry(620, 4, 120), std('#3a2616'), 60, L.y - 45, 0);
        for (let k = 0; k < 5; k++) {
          const x = -200 + k * 120;
          for (const sx of [-1, 1]) mesh(new T.BoxGeometry(6, 88, 6), wood, x + sx * 30, L.y - 1, 40);
          mesh(new T.BoxGeometry(70, 7, 8), wood, x, L.y + 40, 40);
          mesh(new T.SphereGeometry(3, 12, 10), glow('#ffcf7a'), x, L.y + 32, 40, null, true);
          const pl = new T.PointLight(0xffb45a, 2.2, 160, 1.3); pl.position.set(x, L.y + 25, 50); scene.add(pl);
        }
        // Ore face on the right.
        mesh(new T.BoxGeometry(40, 90, 120), dirt, 350, L.y, 0);
        for (let i = 0; i < 14; i++) {
          const n = mesh(new T.OctahedronGeometry(5 + (i % 4) * 2.5, 0), std(L.c, { emissive: L.e, emissiveIntensity: 0.7, metalness: 0.5, roughness: 0.25, flatShading: true }), 330 - (i % 3) * 6, L.y - 30 + (i * 23) % 70, 50 - (i * 17) % 70);
          n.rotation.set(i, i * 2, i * 0.5);
        }
        // Miners.
        for (let k = 0; k < 3; k++) figure({ body: '#ff8a1f', helmet: '#ffd23f', leg: '#3b4a7a', lamp: true, pick: k === 0, scale: 1.8, x: 300 - k * 110 - li * 20, y: L.y - 43, z: 20, dir: -Math.PI / 2 + (k === 0 ? 0 : Math.PI), phase: k * 2 + li });
        // Ore pile at the lift.
        for (let i = 0; i < 9; i++) mesh(new T.DodecahedronGeometry(5 + (i % 3) * 2, 0), std(L.c, { emissive: L.e, emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.3, flatShading: true }), -190 + (i % 3) * 9, L.y - 38 + Math.floor(i / 3) * 6, 10 + (i % 2) * 10);
      }
      // Lift shaft + cage.
      mesh(new T.BoxGeometry(90, 520, 10), std('#1c130b'), -300, -260, -55);
      for (const sx of [-1, 1]) mesh(new T.BoxGeometry(5, 520, 5), std('#555c66', { metalness: 0.7, roughness: 0.4 }), -300 + sx * 38, -200, 50);
      const cage = new T.Group(); cage.position.set(-300, -120, 30); scene.add(cage);
      mesh(new T.BoxGeometry(64, 4, 60), std('#3a3f48', { metalness: 0.7 }), 0, -30, 0, cage);
      mesh(new T.BoxGeometry(64, 4, 60), std('#3a3f48', { metalness: 0.7 }), 0, 30, 0, cage);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(new T.BoxGeometry(3, 60, 3), std('#9aa3b0', { metalness: 0.8 }), sx * 30, 0, sz * 28, cage);
      for (let i = 0; i < 8; i++) mesh(new T.DodecahedronGeometry(7, 0), std('#ffd23f', { emissive: '#8a5a00', emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.25, flatShading: true }), -18 + (i % 4) * 12, -22 + Math.floor(i / 4) * 8, (i % 2) * 10 - 5, cage);
      // Headframe + cart on the surface.
      const hf = new T.Group(); hf.position.set(-300, 20, 0); scene.add(hf);
      for (const sx of [-1, 1]) { const b = mesh(new T.BoxGeometry(6, 170, 6), std('#4a5260', { metalness: 0.6 }), sx * 34, 80, 0, hf); b.rotation.z = sx * 0.18; }
      const wheel = mesh(new T.TorusGeometry(24, 3, 10, 32), std('#2e333c', { metalness: 0.7 }), 0, 168, 0, hf);
      for (let k = 0; k < 4; k++) { const sp = mesh(new T.BoxGeometry(46, 2.5, 2.5), std('#2e333c'), 0, 168, 0, hf); sp.rotation.z = k * Math.PI / 4; }
      wheel.rotation.y = 0.3;
      const cart = new T.Group(); cart.position.set(-120, 22, 30); scene.add(cart);
      mesh(new T.BoxGeometry(70, 30, 44), std('#6f7682', { metalness: 0.7, roughness: 0.35 }), 0, 22, 0, cart);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(new T.CylinderGeometry(8, 8, 5, 16), std('#2b2b2b'), sx * 24, 8, sz * 23, cart).rotation.x = Math.PI / 2;
      for (let i = 0; i < 12; i++) mesh(new T.DodecahedronGeometry(7 + (i % 3), 0), std('#ffd23f', { emissive: '#8a5a00', emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.25, flatShading: true }), -24 + (i % 4) * 16, 38 + Math.floor(i / 4) * 5, -12 + (i % 3) * 12, cart);
      // Bank house with coins.
      const house = new T.Group(); house.position.set(260, 20, -90); scene.add(house);
      mesh(new T.BoxGeometry(170, 110, 110), std('#b23a32', { roughness: 0.7 }), 0, 55, 0, house);
      const rf = mesh(new T.ConeGeometry(130, 60, 4), std('#6b1e1a'), 0, 140, 0, house); rf.rotation.y = Math.PI / 4; rf.scale.set(1, 1, 0.75);
      mesh(new T.PlaneGeometry(110, 26), new T.MeshBasicMaterial({ map: label('KASA', '#ffd23f', '#fff', 320, 80) }), 0, 88, 56, house, true);
      for (let i = 0; i < 16; i++) mesh(new T.CylinderGeometry(9, 9, 3, 24), std('#ffcf3f', { metalness: 0.9, roughness: 0.25, emissive: '#553300' }), -40 + (i % 5) * 14 + (i % 2) * 4, 3 + Math.floor(i / 5) * 3.2, 80 + (i % 3) * 6, house);
      for (let i = 0; i < 6; i++) tree(-460 + i * 190 + (i % 2) * 40, -210 - (i % 3) * 30, 1.6, ['#3f9e4a', '#2f8a43', '#5bb04d'][i % 3]);
      camera.fov = 38; camera.position.set(110, 10, 640); camera.lookAt(30, -120, 0);
    },

    // Stone-age fort vs future base with the clash in the middle.
    cag() {
      gradientBg([[0, '#2b2170'], [0.45, '#b05a8a'], [0.75, '#ff8a5c'], [1, '#ffcf8a']]);
      scene.fog = new T.Fog(0xf0a07a, 700, 2200);
      for (const [x, c] of [[-320, 0xff9a3c], [320, 0x39e0ff]]) { const l = new T.PointLight(c, 5, 700, 1.1); l.position.set(x, 120, 160); scene.add(l); }
      for (let i = 0; i < 9; i++) mesh(new T.ConeGeometry(260 + (i % 3) * 80, 240 + (i % 4) * 60, 8), std('#5c7a58', { flatShading: true, roughness: 1 }), -1300 + i * 330, 60, -1300 - (i % 2) * 150);
      scene.add(new T.HemisphereLight(0xffe0d0, 0x3a3060, 1.1));
      sun(0xfff0dc, 2.8, [-100, 420, 300], 500);
      const ground = mesh(new T.PlaneGeometry(4000, 4000), std('#5f9e4a', { roughness: 1 }), 0, 0, 0); ground.rotation.x = -Math.PI / 2;
      const path = mesh(new T.PlaneGeometry(1400, 120), std('#b89a6a', { roughness: 1 }), 0, 0.5, 0); path.rotation.x = -Math.PI / 2;
      // Left: palisade fort with torches.
      const fort = new T.Group(); fort.position.set(-420, 0, -40); scene.add(fort);
      for (let i = 0; i < 16; i++) { const a = -0.9 + i * 0.12; const lg = mesh(new T.CylinderGeometry(6, 7, 80 + (i % 3) * 10, 10), std('#8a5a2b', { roughness: 0.9 }), Math.cos(a) * 110 - 40, 42, Math.sin(a) * 110, fort); mesh(new T.ConeGeometry(6, 12, 10), std('#6e4424'), lg.position.x, lg.position.y + 46 + (i % 3) * 5, lg.position.z, fort); }
      mesh(new T.CylinderGeometry(60, 70, 60, 24, 1, false, 0, Math.PI), std('#a0673a', { roughness: 0.9 }), -60, 30, -30, fort);
      for (const z of [-60, 60]) { mesh(new T.CylinderGeometry(2, 2, 40, 8), std('#5b3a1e'), 50, 60, z, fort); mesh(new T.SphereGeometry(6, 16, 12), glow('#ffb020'), 50, 84, z, fort, true); const l = new T.PointLight(0xff9a3c, 3, 200, 1.2); l.position.set(-420, 84, z - 20); scene.add(l); }
      // Right: futuristic base.
      const base = new T.Group(); base.position.set(480, 0, -20); scene.add(base);
      const metal = std('#8b93b8', { metalness: 0.8, roughness: 0.3 }), dark = std('#2a2f55', { metalness: 0.7, roughness: 0.35 });
      mesh(new T.BoxGeometry(160, 90, 170), metal, 40, 45, 0, base);
      mesh(new T.SphereGeometry(70, 32, 20, 0, TAU, 0, Math.PI / 2), std('#9fe8ff', { metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.8 }), 40, 90, 0, base);
      for (let k = 0; k < 4; k++) mesh(new T.BoxGeometry(4, 14, 120), glow('#39e0ff'), -41, 20 + k * 18, 0, base, true);
      mesh(new T.CylinderGeometry(2, 2, 90, 8), dark, 90, 180, 40, base);
      mesh(new T.SphereGeometry(6, 16, 12), glow('#ff3b5c'), 90, 226, 40, base, true);
      const turret = mesh(new T.CylinderGeometry(6, 6, 60, 16), dark, -20, 110, -40, base); turret.rotation.z = Math.PI / 2 - 0.2;
      // Cavemen (blue team) charging right.
      for (let i = 0; i < 9; i++) figure({ body: '#a0673a', helmet: '#2f7bff', skin: '#e8b48a', leg: '#6e4424', club: true, scale: 2.1, x: -300 + (i % 3) * 55 + Math.floor(i / 3) * 28, z: -20 + (i % 3) * 62, dir: -Math.PI / 2, phase: i * 1.6 });
      // Robots (red team) advancing left.
      for (let i = 0; i < 7; i++) {
        const g = new T.Group(); g.position.set(140 + (i % 3) * 60 + Math.floor(i / 3) * 30, 0, -10 + (i % 3) * 58); g.rotation.y = Math.PI / 2; scene.add(g);
        for (const sx of [-1, 1]) mesh(new T.BoxGeometry(5, 16, 6), dark, sx * 5, 8, 0, g);
        mesh(new T.BoxGeometry(20, 18, 14), std('#e5323f', { metalness: 0.6, roughness: 0.3 }), 0, 25, 0, g);
        mesh(new T.BoxGeometry(14, 10, 12), metal, 0, 40, 0, g);
        mesh(new T.BoxGeometry(10, 3, 1), glow('#39e0ff'), 0, 41, -6.5, g, true);
        mesh(new T.BoxGeometry(4, 4, 18), dark, 12, 26, -8, g);
        g.scale.setScalar(1.7);
        mesh(new T.BoxGeometry(80, 1.6, 1.6), glow('#39e0ff'), g.position.x - 70, 44, g.position.z - 4, null, true);
      }
      // Hover tank.
      const tank = new T.Group(); tank.position.set(300, 18, 90); scene.add(tank);
      mesh(new T.BoxGeometry(80, 22, 50), std('#c62a3a', { metalness: 0.6, roughness: 0.3 }), 0, 12, 0, tank);
      mesh(new T.CylinderGeometry(16, 18, 14, 20), dark, 0, 30, 0, tank);
      mesh(new T.CylinderGeometry(3, 3, 50, 12), dark, -30, 32, 0, tank).rotation.z = Math.PI / 2;
      mesh(new T.BoxGeometry(84, 3, 54), glow('#39e0ff'), 0, -2, 0, tank, true);
      // Arrows flying right.
      for (let i = 0; i < 8; i++) { const a = mesh(new T.CylinderGeometry(0.7, 0.7, 26, 6), std('#6e4424'), -150 + i * 30, 70 + (i % 3) * 14, -30 + (i % 4) * 20); a.rotation.z = Math.PI / 2 + 0.25; }
      explosion(20, 22, 40, 30);
      explosion(-80, 10, 110, 14);
      const bush = std('#3d8a3a', { flatShading: true, roughness: 0.9 }), rock = std('#8a8580', { flatShading: true, roughness: 1 });
      for (let i = 0; i < 12; i++) { const x = -640 + i * 115 + (i % 3) * 20, z = 230 + (i % 4) * 30; const m = mesh(new T.IcosahedronGeometry(14 + (i % 3) * 6, 1), i % 3 ? bush : rock, x, 6, z); m.scale.y = 0.7; }
      for (let i = 0; i < 10; i++) tree(-700 + i * 150, -330 - (i % 3) * 60, 2, ['#3f9e4a', '#2f8a43', '#5bb04d'][i % 3]);
      camera.fov = 36; camera.position.set(0, 95, 400); camera.lookAt(0, 48, 0);
    },

    // Logo emblem: gold-rimmed shield split blue/red with crossed swords.
    emblem() {
      scene.add(new T.HemisphereLight(0xffffff, 0x404060, 1.3));
      const key = new T.DirectionalLight(0xfff2dc, 3); key.position.set(-120, 200, 300); scene.add(key);
      const rim = new T.DirectionalLight(0x9fd0ff, 2); rim.position.set(200, 50, -200); scene.add(rim);
      const g = new T.Group(); scene.add(g);
      const shape = new T.Shape();
      shape.moveTo(0, 110); shape.bezierCurveTo(60, 100, 90, 95, 100, 80); shape.lineTo(96, -10); shape.bezierCurveTo(90, -70, 40, -105, 0, -125);
      shape.bezierCurveTo(-40, -105, -90, -70, -96, -10); shape.lineTo(-100, 80); shape.bezierCurveTo(-90, 95, -60, 100, 0, 110);
      const ext = (s, depth, mat, z, sc) => { const m = mesh(new T.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 6, bevelSize: 5, bevelSegments: 6, curveSegments: 32 }), mat, 0, 0, z, g); m.scale.setScalar(sc || 1); return m; };
      const gold = std('#f2a81d', { metalness: 1, roughness: 0.22 });
      ext(shape, 16, gold, -8, 1.12);
      // Blue / red halves.
      const half = side => { const s = new T.Shape(); const k = side; s.moveTo(0, 104); s.bezierCurveTo(k * 55, 95, k * 82, 90, k * 90, 76); s.lineTo(k * 86, -10); s.bezierCurveTo(k * 80, -62, k * 36, -94, 0, -112); s.lineTo(0, 104); return s; };
      ext(half(-1), 10, std('#2f7bff', { metalness: 0.35, roughness: 0.3 }), 10);
      ext(half(1), 10, std('#e5323f', { metalness: 0.35, roughness: 0.3 }), 10);
      // Crossed swords.
      const sword = rot => {
        const s = new T.Group(); s.rotation.z = rot; s.position.z = 42; g.add(s);
        const steel = std('#e8edf5', { metalness: 1, roughness: 0.15 });
        const bl = new T.Shape(); bl.moveTo(-7, -40); bl.lineTo(7, -40); bl.lineTo(7, 110); bl.lineTo(0, 128); bl.lineTo(-7, 110); bl.lineTo(-7, -40);
        mesh(new T.ExtrudeGeometry(bl, { depth: 3, bevelEnabled: true, bevelThickness: 2, bevelSize: 1.5, bevelSegments: 3 }), steel, 0, 0, -1.5, s);
        mesh(new T.BoxGeometry(56, 10, 10), gold, 0, -44, 0, s);
        mesh(new T.CylinderGeometry(5, 5, 38, 16), std('#5b2e14', { roughness: 0.6 }), 0, -68, 0, s);
        mesh(new T.SphereGeometry(8, 20, 16), gold, 0, -90, 0, s);
      };
      sword(0.72); sword(-0.72);
      // Star on top.
      const st = new T.Shape();
      for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 26; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? st.lineTo(x, y) : st.moveTo(x, y); }
      const star = mesh(new T.ExtrudeGeometry(st, { depth: 6, bevelEnabled: true, bevelThickness: 3, bevelSize: 2, bevelSegments: 3 }), gold, 0, 138, 0, g);
      star.scale.setScalar(1.2);
      g.rotation.set(-0.12, 0.28, 0);
      camera.fov = 30; camera.position.set(0, 10, 620); camera.lookAt(0, 8, 0);
    },
  };

  const run = () => { SCENES[which](); renderer.render(scene, camera); document.title = 'done'; };
  if (document.fonts && document.fonts.load) document.fonts.load("800 40px 'Baloo'").then(run, run); else run();
})();
