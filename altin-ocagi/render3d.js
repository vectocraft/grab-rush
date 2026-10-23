// 3D renderer for Altın Ocağı: a cut-away of the mine seen from the front.
// The camera looks straight at the cut face (plane z = 0) so the 2D layout (x 0..400, y down) maps exactly
// onto the screen and the 2D overlay (buttons, numbers) lines up; tunnels are real recesses into the earth.
// Mine3D.init() returns null without WebGL; the game then draws everything in 2D.
(function () {
  'use strict';
  if (!window.THREE) return;
  const T = window.THREE;
  const CX = 200, DEPTH = 64;
  const X = x => x - CX, Yw = y => -y; // 2D -> world

  window.Mine3D = {
    init(canvas) {
      let renderer;
      try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
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
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;

      const scene = new T.Scene();
      scene.background = new T.Color('#6ec3ff');
      // Grey detail textures (the theme colour tints them): soil with pebbles and strata, cracked rock, wood grain.
      const detail = (draw, rep) => { const c = document.createElement('canvas'); c.width = c.height = 128; draw(c.getContext('2d')); const t = new T.CanvasTexture(c); if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 4; return t; };
      let sd = 11; const rn = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
      const SOIL = detail(g => { g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 128, 128);
        for (let k = 0; k < 500; k++) { const v = 170 + Math.floor(rn() * 85); g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(rn() * 128, rn() * 128, 2, 2); }
        for (let y = 20; y < 128; y += 34) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, y + rn() * 6, 128, 4); }
        for (let k = 0; k < 14; k++) { const x = rn() * 128, y = rn() * 128, r = 2 + rn() * 4; g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + 1, y + 1.5, r, r * 0.55, 0, 0, Math.PI); g.fill(); } }, 3);
      const ROCK = detail(g => { g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, 128, 128);
        for (let k = 0; k < 300; k++) { const v = 150 + Math.floor(rn() * 90); g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(rn() * 128, rn() * 128, 3, 3); }
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5; for (let k = 0; k < 8; k++) { let x = rn() * 128, y = rn() * 128; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 4; s++) { x += (rn() - 0.5) * 40; y += (rn() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); } }, 2);
      const GRAIN = detail(g => { g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, 128, 128); g.strokeStyle = 'rgba(0,0,0,.18)';
        for (let k = 0; k < 26; k++) { const y = rn() * 128; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(40, y + 3, 90, y - 3, 128, y + 1); g.stroke(); } }, 1);
      const FOV = 30;
      const camera = new T.PerspectiveCamera(FOV, 1, 10, 6000);
      scene.add(new T.HemisphereLight(0xfff6e0, 0x6b5a4a, 1.25));
      const sun = new T.DirectionalLight(0xfff0d8, 1.5);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -260, right: 260, top: 520, bottom: -520, near: 10, far: 1500 });
      sun.shadow.bias = -0.002;
      scene.add(sun); scene.add(sun.target);

      const std = (color, extra) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0.02 }, extra || {}));
      // Toon look for the characters (same 3-step ramp and ink outline as the other games).
      const ramp = (() => { const t = new T.DataTexture(new Uint8Array([140, 140, 140, 255, 205, 205, 205, 255, 255, 255, 255, 255]), 3, 1); t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true; return t; })();
      const toon = (c, o) => new T.MeshToonMaterial(Object.assign({ color: c, gradientMap: ramp }, o || {}));
      const inkMat = new T.MeshBasicMaterial({ color: 0x1c120a, side: T.BackSide });
      inkMat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normal * 0.55;'); };
      const ink = m => { const o = new T.Mesh(m.geometry, inkMat); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.copy(m.scale); m.parent.add(o); return o; };
      // Soft additive glow for lanterns and ore twinkles.
      const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
      const glowMat = c => new T.SpriteMaterial({ map: glowTex, color: c, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
      const lampGlow = glowMat('#ffcf6a');
      const lam = color => new T.MeshLambertMaterial({ color });
      const tex = (m, t) => { m.map = t; return m; };
      const MAT = {
        earthA: tex(lam('#6b4a2e'), SOIL), earthB: tex(lam('#5e4027'), SOIL), back: tex(lam('#4a3120'), ROCK), shaftBack: tex(lam('#221a14'), ROCK),
        grass: lam('#5bc26b'), dirt: tex(lam('#7a5230'), SOIL), stone: tex(lam('#8d8173'), ROCK), wood: tex(lam('#8a5a2b'), GRAIN), rock: tex(lam('#7b6552'), ROCK),
        crate: lam('#b07a3e'), metal: std('#9aa3b5', { metalness: 0.5, roughness: 0.45 }), steel: std('#4b5563', { metalness: 0.4, roughness: 0.5 }),
        gold: std('#ffd23f', { metalness: 0.6, roughness: 0.3, emissive: '#5a3a00' }), cloud: new T.MeshBasicMaterial({ color: '#ffffff' }),
        red: lam('#c9504a'), roof: lam('#8c2a24'), doorDark: lam('#3a1e10'), lamp: new T.MeshBasicMaterial({ color: '#fff3b0' }),
        orange: toon('#ff9f1c'), skin: toon('#ffd9b3'), helmet: toon('#ffd23f'), eye: lam('#111111'),
        marble: std('#f3efe6', { roughness: 0.5 }), marbleDark: std('#d8d0c0', { roughness: 0.6 }), gilt: std('#f2b52a', { metalness: 0.85, roughness: 0.25, emissive: '#3a2400' }),
        rail: std('#8a93a3', { metalness: 0.7, roughness: 0.35 }), sleeper: lam('#5a3a1e'), glass: std('#9fe8ff', { metalness: 0.6, roughness: 0.1, transparent: true, opacity: 0.55 }),
        tire: lam('#1d1f24'), paint: std('#c0392b', { roughness: 0.45 }), lavaGlow: new T.MeshBasicMaterial({ color: '#ff6a1a' }), ice: std('#bfefff', { roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.8 }),
      };
      const oreMats = {};
      const oreMat = c => oreMats[c] || (oreMats[c] = std(c, { emissive: c, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.2 }));

      const box = (w, h, d, mat, x, y, z, parent, shadow) => {
        const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z); m.castShadow = shadow !== false; m.receiveShadow = true;
        (parent || scene).add(m); return m;
      };
      // Box from 2D rect (x0..x1, y0..y1) spanning depth z0..z1.
      const slab = (x0, x1, y0, y1, z0, z1, mat, parent) =>
        box(x1 - x0, y1 - y0, z1 - z0, mat, X((x0 + x1) / 2), Yw((y0 + y1) / 2), (z0 + z1) / 2, parent);

      function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

      let world = null, built = -1, W = 1, H = 1, skyCols = ['#4aa8f0', '#d4f1ff'], theme = { id: 'vadi' };
      const flick = [], twinkles = [];
      const poolMat = new T.SpriteMaterial({ map: glowTex, color: '#ff9a3c', transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false });

      // Outfit extras every miner carries (shown per outfit): overall straps, a visor, a crown, a golden shine.
      const ACC = { straps: [], visor: [], crown: [], shine: [] }, accMat = { strap: lam('#1d2a44'), visor: std('#9fe8ff', { metalness: 0.7, roughness: 0.08, transparent: true, opacity: 0.7, emissive: '#1a4a66' }),
        stripe: new T.MeshBasicMaterial({ color: '#f5f0c0' }), shine: new T.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }) };
      let outfitId = 'klasik';
      function applyAcc() {
        const on = { straps: !/^(astronot|kral)$/.test(outfitId), visor: outfitId === 'astronot', crown: outfitId === 'kral', shine: /^(altin|kral)$/.test(outfitId) };
        accMat.strap.color.set(outfitId === 'kirmizi' ? '#f5f0c0' : outfitId === 'mavi' ? '#1e3a8a' : '#1d2a44');
        for (const k in ACC) ACC[k].forEach(m => { m.visible = on[k]; });
      }
      function miner(parent) {
        const g = new T.Group();
        // Overall straps / reflective stripes on the body, then the outfit-only pieces (hidden until worn).
        for (const sx of [-1, 1]) { const s = new T.Mesh(new T.BoxGeometry(1.6, 12, 1), accMat.strap); s.position.set(sx * 3, 14, 5.6); g.add(s); ACC.straps.push(s); }
        const vis = new T.Mesh(new T.SphereGeometry(7.4, 14, 10, -Math.PI * 0.45, Math.PI * 0.9, Math.PI * 0.25, Math.PI * 0.45), accMat.visor); vis.position.y = 26; g.add(vis); ACC.visor.push(vis);
        const crown = new T.Group(); crown.position.y = 33;
        crown.add(new T.Mesh(new T.CylinderGeometry(5.2, 5.6, 3, 10, 1, true), MAT.gilt));
        for (let k = 0; k < 5; k++) { const sp = new T.Mesh(new T.ConeGeometry(1.2, 3.4, 4), MAT.gilt); const a = k / 5 * Math.PI * 2; sp.position.set(Math.sin(a) * 5.2, 2.8, Math.cos(a) * 5.2); crown.add(sp); }
        g.add(crown); ACC.crown.push(crown);
        const sh = new T.Mesh(new T.SphereGeometry(10, 12, 8), accMat.shine); sh.position.y = 18; g.add(sh); ACC.shine.push(sh);
        g.scale.setScalar(1.25); // bigger, so the outfit reads at a glance
        const body = new T.Mesh(new T.CapsuleGeometry(6, 8, 4, 10), MAT.orange); body.position.y = 12; body.castShadow = true; g.add(body); ink(body);
        const head = new T.Mesh(new T.SphereGeometry(6.5, 14, 10), MAT.skin); head.position.y = 26; head.castShadow = true; g.add(head); ink(head);
        const hat = new T.Mesh(new T.SphereGeometry(7.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.helmet); hat.position.y = 27; g.add(hat); ink(hat);
        const lamp = new T.Mesh(new T.SphereGeometry(2.2, 8, 6), MAT.lamp); lamp.position.set(0, 31, 6.5); g.add(lamp);
        const lg = new T.Sprite(lampGlow); lg.scale.setScalar(12); lg.position.set(0, 31, 8); g.add(lg);
        for (const sx of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(1.3, 6, 5), MAT.eye); e.position.set(sx * 2.4, 26.5, 6); g.add(e); }
        const pick = new T.Group(); pick.position.set(7, 18, 0);
        const handle = new T.Mesh(new T.BoxGeometry(2, 18, 2), MAT.wood); handle.position.y = 9; pick.add(handle);
        const head2 = new T.Mesh(new T.BoxGeometry(14, 3, 3), MAT.metal); head2.position.y = 18; pick.add(head2);
        g.add(pick);
        const ore = new T.Mesh(new T.OctahedronGeometry(5), MAT.gold); ore.position.set(-7, 18, 0); g.add(ore);
        parent.add(g);
        return { g, pick, ore };
      }

      function build(n, ores, SURF, ROW) {
        if (world) { scene.remove(world.root); world.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
        const root = new T.Group(); scene.add(root);
        const bottom = SURF + (n + 1) * ROW, r = rng(99);
        flick.length = 0; twinkles.length = 0;
        // Sky, sun, clouds.
        const skyTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, skyCols[0]); gr.addColorStop(1, skyCols[1]); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new T.CanvasTexture(c); if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace; return t; })();
        const sky = new T.Mesh(new T.PlaneGeometry(1400, 900), new T.MeshBasicMaterial({ map: skyTex, toneMapped: false }));
        sky.position.set(0, Yw(SURF - 46) + 450, -300); root.add(sky);
        const sunM = new T.Mesh(new T.SphereGeometry(26, 20, 16), new T.MeshBasicMaterial({ color: '#fff4a8' })); sunM.position.set(X(190), Yw(SURF - 190), -150); sunM.visible = theme.id !== 'ay'; root.add(sunM);
        for (const [cx, cy] of theme.id === 'ay' || theme.id === 'volkan' ? [] : [[80, SURF - 160], [190, SURF - 178], [300, SURF - 190]]) {
          const cl = new T.Group(); cl.position.set(X(cx), Yw(cy), -90);
          for (const [dx, dy, rr] of [[0, 0, 14], [16, 5, 17], [34, 0, 13], [18, -5, 12]]) { const s = new T.Mesh(new T.SphereGeometry(rr, 12, 10), MAT.cloud); s.position.set(dx, dy, 0); cl.add(s); }
          root.add(cl);
        }
        // Ground: grass + dirt with the elevator opening.
        slab(-120, 22, SURF - 46, SURF - 30, -DEPTH - 60, 0, MAT.grass, root); slab(108, 520, SURF - 46, SURF - 30, -DEPTH - 60, 0, MAT.grass, root);
        slab(-120, 22, SURF - 30, SURF, -DEPTH - 60, 0, MAT.dirt, root); slab(108, 520, SURF - 30, SURF, -DEPTH - 60, 0, MAT.dirt, root);
        // Rows: earth around a tunnel recess; elevator shaft gap on the left.
        for (let i = 0; i <= n; i++) {
          const top = SURF + i * ROW, t0 = top + 30, t1 = top + ROW - 14, em = i % 2 ? MAT.earthB : MAT.earthA;
          slab(-120, 22, top, top + ROW, -DEPTH, 0, em, root);
          slab(108, 112, top, top + ROW, -DEPTH, 0, em, root);
          slab(392, 520, top, top + ROW, -DEPTH, 0, em, root);
          slab(112, 392, top, t0, -DEPTH, 0, em, root);
          slab(112, 392, t1, top + ROW, -DEPTH, 0, em, root);
          const locked = i === n;
          slab(112, 392, t0, t1, -DEPTH - 6, locked ? -10 : -DEPTH, locked ? em : MAT.back, root);
          // Stones on the cut face.
          for (let k = 0; k < 6; k++) {
            const sx = r() * 400, sy = top + r() * ROW;
            if (sx > 104 && sx < 396 && sy > t0 - 4 && sy < t1 + 4) continue;
            if (sx > 18 && sx < 112) continue;
            const st = new T.Mesh(new T.DodecahedronGeometry(4 + r() * 5), MAT.stone); st.position.set(X(sx), Yw(sy), 1); st.rotation.set(r() * 3, r() * 3, 0); root.add(st);
          }
          if (locked) {
            for (let k = 0; k < 4; k++) { const p = box(290, 7, 5, MAT.wood, X(252), Yw(t0 + 14 + k * 20), -6, root); p.rotation.z = (k % 2 ? 1 : -1) * 0.06; }
            continue;
          }
          // Supports, lanterns, rock face with glowing ore, crate.
          for (const px of [190, 260, 330]) {
            box(5, t1 - t0, 5, MAT.wood, X(px), Yw((t0 + t1) / 2), -12, root);
            box(28, 5, 5, MAT.wood, X(px + 11), Yw(t0 + 3), -12, root);
            const l = new T.Mesh(new T.SphereGeometry(3, 8, 6), MAT.lamp); l.position.set(X(px + 6), Yw(t0 + 12), -8); root.add(l);
            const hl = new T.Sprite(lampGlow); hl.scale.setScalar(26); hl.position.set(X(px + 6), Yw(t0 + 12), -6); root.add(hl); flick.push(hl);
            const pool = new T.Sprite(lampGlow); pool.scale.set(70, 46, 1); pool.position.set(X(px + 6), Yw(t0 + 20), -DEPTH + 2); pool.material = poolMat; root.add(pool);
          }
          // Plank floor along the tunnel and a pair of mine-cart rails.
          box(280, 3, DEPTH - 8, MAT.wood, X(252), Yw(t1) - 1.5, -DEPTH / 2 - 4, root, false);
          for (const rz of [-40, -50]) box(240, 1.4, 1.4, MAT.rail, X(240), Yw(t1) + 0.8, rz, root, false);
          slab(352, 390, t0 + 4, t1, -DEPTH, -22, MAT.rock, root);
          const om = oreMat(ores[i % ores.length]);
          for (let k = 0; k < 6; k++) { const o = new T.Mesh(new T.OctahedronGeometry(3.5 + r() * 3), om); o.position.set(X(356 + r() * 30), Yw(t0 + 10 + r() * (t1 - t0 - 20)), -21); o.rotation.set(r() * 3, r() * 3, 0); root.add(o);
            if (k < 3) { const tw = new T.Sprite(glowMat(ores[i % ores.length])); tw.position.copy(o.position); tw.position.z += 4; tw.userData.ph = r() * 6; root.add(tw); twinkles.push(tw); } }
          box(46, 30, 34, MAT.crate, X(140), Yw(t1 - 15), -26, root);
        }
        // Bedrock below.
        slab(-120, 520, bottom, bottom + 1200, -DEPTH, 0, MAT.earthB, root);
        // Deep earth is not empty: buried boulders, glinting ore veins of the next (locked) ores and old bones,
        // fading into darkness with depth so the mine feels deep instead of ending in a flat brown wall.
        for (let k = 0; k < 34; k++) {
          const sx = -60 + r() * 520, sy = bottom + 30 + r() * 640;
          const st = new T.Mesh(new T.DodecahedronGeometry(5 + r() * 9), MAT.stone); st.position.set(X(sx), Yw(sy), 1); st.rotation.set(r() * 3, r() * 3, 0); st.scale.y = 0.7; root.add(st);
        }
        for (let k = 0; k < 14; k++) {
          const vx = r() * 400, vy = bottom + 30 + r() * 560, om = oreMat(ores[(n + 1 + k) % ores.length]);
          for (let j = 0; j < 5; j++) { const o = new T.Mesh(new T.OctahedronGeometry(2.5 + r() * 3.5), om); o.position.set(X(vx + (r() - 0.5) * 26), Yw(vy + (r() - 0.5) * 16), 2); o.rotation.set(r() * 3, r() * 3, 0); root.add(o); }
        }
        for (let k = 0; k < 2; k++) { // a fossil rib cage
          const fx = 60 + r() * 280, fy = bottom + 220 + r() * 360, bone = MAT.marbleDark;
          box(46, 3, 3, bone, X(fx), Yw(fy), 1.5, root);
          for (let j = 0; j < 5; j++) { const rib = box(3, 16 - Math.abs(j - 2) * 2, 3, bone, X(fx - 16 + j * 8), Yw(fy + 8), 1.5, root); rib.rotation.z = 0.15; }
        }
        {
          const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
          gr.addColorStop(0, 'rgba(10,6,3,0)'); gr.addColorStop(1, 'rgba(10,6,3,.85)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
          const shade = new T.Mesh(new T.PlaneGeometry(700, 760), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false }));
          shade.position.set(X(200), Yw(bottom + 20 + 380), 4); shade.renderOrder = 2; root.add(shade);
        }
        slab(22, 108, SURF - 30, bottom, -DEPTH - 8, -DEPTH, MAT.shaftBack, root);
        const GY = SURF - 46; // ground line (top of the grass)
        // Region scenery behind the buildings.
        props(root, GY, r);
        // Elite bank: marble steps, columns, pediment, golden dome and vault door.
        const bank = new T.Group(); bank.position.set(X(327), Yw(GY), -40); root.add(bank);
        const bb = (w, h, d, m, x, y, z) => box(w, h, d, m, x, y, z, bank);
        bb(140, 6, 70, MAT.marbleDark, 0, 3, 0); bb(130, 6, 64, MAT.marble, 0, 9, 2);
        bb(116, 56, 50, MAT.marble, 0, 40, -4);
        for (let k = 0; k < 4; k++) { const c = new T.Mesh(new T.CylinderGeometry(4.2, 4.8, 54, 14), MAT.marble); c.position.set(-45 + k * 30, 39, 26); c.castShadow = true; bank.add(c); bb(12, 3, 12, MAT.gilt, -45 + k * 30, 67, 26); }
        bb(126, 6, 62, MAT.marbleDark, 0, 71, 2);
        const ped = new T.Shape(); ped.moveTo(-64, 0); ped.lineTo(64, 0); ped.lineTo(0, 22); ped.closePath();
        const pm = new T.Mesh(new T.ExtrudeGeometry(ped, { depth: 58, bevelEnabled: false }), MAT.marble); pm.position.set(0, 74, -27); pm.castShadow = true; bank.add(pm);
        const dome = new T.Mesh(new T.SphereGeometry(20, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), MAT.gilt); dome.position.set(0, 92, -8); dome.castShadow = true; bank.add(dome);
        bb(3, 16, 3, MAT.gilt, 0, 118, -8);
        const vault = new T.Mesh(new T.CylinderGeometry(13, 13, 3, 24), MAT.gilt); vault.rotation.x = Math.PI / 2; vault.position.set(0, 30, 21); bank.add(vault);
        for (let k = 0; k < 6; k++) { const sp = box(2, 22, 1.5, MAT.steel, 0, 30, 23, bank); sp.rotation.z = k * Math.PI / 6; }
        const signTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#fff0b0'); gr.addColorStop(1, '#d99a1e'); g.fillStyle = gr; g.fillRect(0, 0, 256, 64); g.strokeStyle = '#6b3a00'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 58); g.font = "900 40px 'Baloo', Arial Black"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#6b3a00'; g.fillText('BANKA', 128, 35); const t = new T.CanvasTexture(c); if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace; return t; })();
        const sign = new T.Mesh(new T.PlaneGeometry(70, 17), new T.MeshBasicMaterial({ map: signTex })); sign.position.set(0, 82, 2); bank.add(sign);
        for (let k = 0; k < 8; k++) { const c = new T.Mesh(new T.CylinderGeometry(7, 7, 2.5, 16), MAT.gold); c.position.set(-60 + (k % 4) * 6, 13 + Math.floor(k / 4) * 2.6, 34 - (k % 2) * 4); bank.add(c); }
        // Surface depot next to the elevator.
        const depot = new T.Group(); depot.position.set(X(140), Yw(GY), -30); root.add(depot);
        box(50, 30, 36, MAT.wood, 0, 15, 0, depot); box(56, 4, 40, MAT.roof, 0, 32, 0, depot);
        const depoPile = new T.Group(); depot.add(depoPile);
        for (const [dx, dz] of [[-12, 20], [0, 22], [12, 20], [-6, 26], [6, 26]]) { const o = new T.Mesh(new T.OctahedronGeometry(6), oreMat(ores[0])); o.position.set(dx, 6, dz); depoPile.add(o); }
        // Rails from the depot to the bank.
        for (const rz of [-18, -2]) box(250 - 150, 1.6, 1.6, MAT.rail, X(200), Yw(GY) + 1.5, rz, root, false);
        for (let x = 152; x <= 250; x += 12) box(3, 1, 22, MAT.sleeper, X(x), Yw(GY) + 0.5, -10, root, false);
        const car = vehicle(theme.id); car.g.position.set(X(176), Yw(GY), -10); root.add(car.g);
        // Headframe + wheel over the shaft.
        const WY = SURF - 126;
        for (const [x0, x1] of [[30, 62], [100, 62]]) {
          const len = Math.hypot(x1 - x0, GY - WY), beam = box(6, len, 6, MAT.steel, X((x0 + x1) / 2), Yw((GY + WY) / 2), -40, root);
          beam.rotation.z = -Math.atan2(x1 - x0, GY - WY);
        }
        const wheel = new T.Group(); wheel.position.set(X(62), Yw(WY), -40); root.add(wheel);
        wheel.add(new T.Mesh(new T.TorusGeometry(16, 2.2, 8, 24), MAT.metal));
        for (let k = 0; k < 4; k++) { const sp = new T.Mesh(new T.BoxGeometry(32, 2, 2), MAT.metal); sp.rotation.z = k * Math.PI / 4; wheel.add(sp); }
        // Elevator cage + cable.
        const cage = new T.Group(); root.add(cage);
        box(58, 4, 40, MAT.metal, 0, -20, 0, cage); box(58, 4, 40, MAT.metal, 0, 20, 0, cage);
        for (const [sx, sz] of [[-27, -18], [27, -18], [-27, 18], [27, 18]]) box(3, 40, 3, MAT.steel, sx, 0, sz, cage);
        const load = new T.Group(); cage.add(load);
        for (const [dx, dy] of [[-10, -12], [8, -12], [-1, -6]]) { const o = new T.Mesh(new T.OctahedronGeometry(7), MAT.gold); o.position.set(dx, dy, 0); load.add(o); }
        const cable = box(1.6, 1, 1.6, MAT.steel, X(65), 0, -30, root, false);
        // Elevator operator rides the cage.
        const op = miner(cage); op.g.position.set(-14, -18, 6); op.g.scale.setScalar(0.8); op.pick.visible = false; op.ore.visible = false;
        // Miners (3 per shaft) + crate piles.
        const miners = [], piles = [];
        for (let i = 0; i < n; i++) {
          miners.push([0, 1, 2].map(() => miner(root)));
          const pile = new T.Group(); pile.position.set(X(140), Yw(SURF + i * ROW + ROW - 14 - 30), -26); root.add(pile);
          const om = oreMat(ores[i % ores.length]);
          for (const [dx, dy] of [[-10, 2], [8, 3], [0, 8]]) { const o = new T.Mesh(new T.OctahedronGeometry(7), om); o.position.set(dx, dy, 0); pile.add(o); }
          piles.push(pile);
        }
        world = { root, wheel, cage, load, cable, miners, piles, n, car, depoPile, WY };
        built = n;
      }

      // Transport vehicle per region: wagon + horse, truck, sled, mine train, moon rover.
      function vehicle(kind) {
        const g = new T.Group(), spin = [], load = new T.Group();
        const wheelAt = (x, z, r) => { const w = new T.Mesh(new T.CylinderGeometry(r, r, 3, 14), MAT.tire); w.rotation.x = Math.PI / 2; w.position.set(x, r, z); g.add(w); spin.push(w); };
        const bx = (w, h, d, m, x, y, z) => box(w, h, d, m, x, y, z, g);
        if (kind === 'col') { bx(26, 12, 20, MAT.paint, -4, 12, 0); bx(12, 14, 18, std('#e8e0d0'), 14, 14, 0); bx(8, 7, 16, MAT.glass, 16, 18, 0); [-12, 12].forEach(x => { wheelAt(x, 11, 5); wheelAt(x, -11, 5); }); load.position.set(-4, 20, 0); }
        else if (kind === 'buz') { bx(32, 10, 20, std('#7a4a2a'), 0, 9, 0); for (const z of [-9, 9]) { const r = bx(38, 2, 2, MAT.rail, 0, 3, z); r.rotation.z = 0.05; } load.position.set(0, 16, 0); }
        else if (kind === 'volkan') { bx(22, 16, 18, std('#2a2d33', { metalness: 0.6 }), 10, 12, 0); const ch = new T.Mesh(new T.CylinderGeometry(3, 4, 12, 10), std('#1a1a1a')); ch.position.set(16, 25, 0); g.add(ch); bx(20, 10, 18, std('#5a3a22'), -12, 10, 0); [-16, -6, 6, 16].forEach(x => { wheelAt(x, 10, 4); wheelAt(x, -10, 4); }); load.position.set(-12, 16, 0); }
        else if (kind === 'ay') { bx(30, 8, 22, std('#e8ecf2', { metalness: 0.4 }), 0, 12, 0); const dish = new T.Mesh(new T.SphereGeometry(6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#cfd6e0', { metalness: 0.6 })); dish.position.set(10, 20, 0); dish.rotation.x = -0.6; g.add(dish); [-11, 0, 11].forEach(x => { wheelAt(x, 12, 4); wheelAt(x, -12, 4); }); load.position.set(-6, 18, 0); }
        else {
          // Valley: wooden wagon pulled by a horse.
          bx(26, 10, 20, MAT.wood, -6, 12, 0); [-14, 2].forEach(x => { wheelAt(x, 11, 6); wheelAt(x, -11, 6); });
          const horse = std('#7a4a26');
          bx(20, 10, 8, horse, 20, 16, 0); bx(6, 10, 6, horse, 31, 22, 0); bx(8, 5, 5, horse, 35, 26, 0);
          for (const [x, z] of [[13, 3], [13, -3], [27, 3], [27, -3]]) bx(2.4, 11, 2.4, horse, x, 5.5, z);
          load.position.set(-6, 19, 0);
        }
        for (const [dx, dz] of [[-6, -4], [4, -3], [-1, 4], [6, 5]]) { const o = new T.Mesh(new T.OctahedronGeometry(4.5), MAT.gold); o.position.set(dx, 0, dz); load.add(o); }
        g.add(load);
        return { g, spin, load };
      }
      // Background scenery that makes each region look different.
      function props(root, GY, r) {
        const Z = () => -140 - r() * 120, at = (m, x, y, z) => { m.position.set(X(x), Yw(GY) + y, z); m.castShadow = true; root.add(m); return m; };
        const id = theme.id;
        for (let k = 0; k < 9; k++) {
          const x = -80 + k * 62 + r() * 30, z = Z();
          if (id === 'col') {
            if (k % 3 === 0) { const py = at(new T.Mesh(new T.ConeGeometry(60, 70, 4), std('#e0b070')), x, 35, z - 80); py.rotation.y = Math.PI / 4; }
            else { const c = std('#3f8f4a'); at(new T.Mesh(new T.CylinderGeometry(5, 6, 40, 10), c), x, 20, z); const arm = at(new T.Mesh(new T.CylinderGeometry(3, 3, 16, 8), c), x + 9, 26, z); arm.rotation.z = 0.2; }
          } else if (id === 'buz') {
            at(new T.Mesh(new T.ConeGeometry(18, 46, 8), std('#2f6f5a')), x, 23, z); at(new T.Mesh(new T.ConeGeometry(12, 20, 8), std('#ffffff')), x, 42, z);
            if (k % 2) { const c = at(new T.Mesh(new T.OctahedronGeometry(10), MAT.ice), x + 20, 10, z + 20); c.scale.y = 2; }
          } else if (id === 'volkan') {
            if (k === 4) { at(new T.Mesh(new T.ConeGeometry(120, 110, 10), std('#3a2a26')), x, 55, -320); at(new T.Mesh(new T.SphereGeometry(22, 12, 8), MAT.lavaGlow), x, 112, -320); }
            else { at(new T.Mesh(new T.DodecahedronGeometry(10 + r() * 8, 0), std('#2a1f1c')), x, 8, z); if (k % 2) { const pool = at(new T.Mesh(new T.CylinderGeometry(16, 16, 1, 16), MAT.lavaGlow), x + 18, 1, z + 30); pool.castShadow = false; } }
          } else if (id === 'ay') {
            const cr = at(new T.Mesh(new T.TorusGeometry(16 + r() * 10, 3, 6, 20), std('#9a9aa6')), x, 1, z); cr.rotation.x = Math.PI / 2;
            if (k === 3) { at(new T.Mesh(new T.SphereGeometry(40, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.glass), x, 0, z - 60); at(new T.Mesh(new T.CylinderGeometry(1.5, 1.5, 60, 6), MAT.steel), x + 50, 30, z - 40); }
          } else {
            at(new T.Mesh(new T.CylinderGeometry(3, 4, 18, 8), std('#6e4424')), x, 9, z);
            const cr = at(new T.Mesh(new T.IcosahedronGeometry(16, 1), new T.MeshLambertMaterial({ color: ['#3f9e4a', '#2f8a43', '#5bb04d'][k % 3], flatShading: true })), x, 30, z); cr.scale.y = 0.85;
          }
        }
        if (id === 'ay') for (let k = 0; k < 60; k++) { const st = new T.Mesh(new T.SphereGeometry(1.2, 4, 3), MAT.cloud); st.position.set(X(-100 + r() * 600), Yw(GY - 60 - r() * 300), -280); root.add(st); }
      }

      const R = {
        setOutfit(color, hat, id) { MAT.orange.color.set(color); MAT.helmet.color.set(hat); outfitId = id || outfitId; applyAcc(); },
        tickOutfit(t) { if (outfitId === 'altin' || outfitId === 'kral') accMat.shine.opacity = 0.25 + 0.2 * Math.sin(t * 4); },
        // Region look: sky, surface and rock colours; forces a rebuild.
        setTheme(th) {
          theme = th; skyCols = th.sky; scene.background = new T.Color(th.sky[1]);
          MAT.wood.color.set(th.support || '#8a5a2b'); MAT.lamp.color.set(th.lamp || '#fff3b0'); lampGlow.color.set(th.lamp || '#ffcf6a');
          MAT.grass.color.set(th.grass); MAT.dirt.color.set(th.dirt); MAT.earthA.color.set(th.earth[0]); MAT.earthB.color.set(th.earth[1]); MAT.back.color.set(th.back);
          built = -1;
        },
        render(st) {
          const n = st.shafts.length;
          if (built !== n) { for (const k in ACC) ACC[k].length = 0; build(n, st.ores, st.SURF, st.ROW); applyAcc(); }
          R.tickOutfit && R.tickOutfit(performance.now() / 1000);
          W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
          if (renderer.getSize(new T.Vector2()).x !== W || renderer.getSize(new T.Vector2()).y !== H) renderer.setSize(W, H, false);
          camera.aspect = W / H;
          // Map plane z=0 exactly like the 2D transform: screenY = viewTop + (y - scrollY) * sc.
          const visH = H / st.sc, yc = st.scrollY + (H / 2 - st.viewTop) / st.sc;
          const d = (visH / 2) / Math.tan(FOV * Math.PI / 360);
          camera.position.set(0, Yw(yc), d);
          camera.lookAt(0, Yw(yc), 0);
          camera.updateProjectionMatrix();
          sun.position.set(-160, Yw(yc) + 260, 420); sun.target.position.set(0, Yw(yc), 0);
          // Animate.
          world.wheel.rotation.z = st.elevOn ? -st.time * 4 : 0;
          world.cage.position.set(X(65), Yw(st.cageY + 20), -30);
          world.load.visible = st.cageLoad > 0;
          const cableTop = Yw(world.WY), cableBot = Yw(st.cageY);
          world.cable.scale.y = Math.max(1, cableTop - cableBot); world.cable.position.y = (cableTop + cableBot) / 2;
          // Transport: out to the bank with a load, back empty.
          const p = st.transP || 0, out = p < 0.5, u = out ? p * 2 : (1 - p) * 2, e = u * u * (3 - 2 * u);
          world.car.g.position.x = X(176 + e * 74);
          world.car.g.rotation.y = out ? 0 : Math.PI;
          world.car.load.visible = out && st.transLoad > 0;
          world.car.spin.forEach(w => { w.rotation.z -= (st.transOn ? 0.25 : 0); });
          world.depoPile.visible = st.depo > 0.5;
          // Lantern flicker and ore twinkle.
          const tt = performance.now() / 1000;
          for (let k = 0; k < flick.length; k++) flick[k].scale.setScalar(24 + 3 * Math.sin(tt * 9 + k * 1.7) + 2 * Math.sin(tt * 23 + k));
          for (const tw of twinkles) { const v = Math.max(0, Math.sin(tt * 2.2 + tw.userData.ph)); tw.scale.setScalar(4 + 16 * v * v * v); }
          st.shafts.forEach((s, i) => {
            world.piles[i].visible = s.st > 0;
            const t1 = st.SURF + i * st.ROW + st.ROW - 14;
            st.minerPos(i).forEach((mp, k) => {
              const m = world.miners[i][k];
              m.g.visible = !!mp;
              if (!mp) return;
              m.g.position.set(X(mp.x), Yw(t1) + (mp.bob || 0), -30 + k * 6);
              m.g.rotation.y = mp.dir > 0 ? 0.35 : Math.PI - 0.35;
              m.pick.rotation.z = mp.swing != null ? -0.9 + mp.swing * 1.8 : 0.4;
              m.ore.visible = mp.carrying;
            });
          });
          autoQ(); renderer.render(scene, camera);
        },
      };
      return R;
    },
  };
})();
