// 3D renderer for Koloni Kapışması (Three.js). The game simulation stays in 2D map coordinates
// (x, y); here they become the ground plane (X = x - cx, Z = y - cy), Y is up.
// Koloni3D.init() returns null when WebGL is unavailable so the game falls back to its 2D renderer.
(function () {
  'use strict';
  if (!window.THREE) return;
  const T = window.THREE;

  function hexMix(a, b, t) { return new T.Color(a).lerp(new T.Color(b), t); }

  window.Koloni3D = {
    init(canvas) {
      let renderer;
      try {
        renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
      } catch (e) { return null; }
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
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;

      const scene = new T.Scene();
      // V3: the shared GPU effect system (ortak/fx3d.js) for the capture moment of a region.
      const F3 = window.Fx3D ? Fx3D.create(scene, { unit: 4, particles: 700, rocks: 30, decals: 4, bolts: 2, budget: 220 }) : null;
      const camera = new T.PerspectiveCamera(36, 1, 10, 4000);
      scene.add(new T.HemisphereLight(0xffffff, 0x9aa0d0, 1.05));
      const sun = new T.DirectionalLight(0xfff0d8, 2.9);
      sun.position.set(-160, 320, 200);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -320, right: 320, top: 360, bottom: -360, near: 10, far: 1200 });
      sun.shadow.bias = -0.0015;
      scene.add(sun);

      // Animated sea: world-space ripples, sparkling caustic lines and a deeper tone away from the coast.
      const seaMat = new T.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uC: { value: new T.Color(0x3a6fd8) } },
        vertexShader: 'varying vec2 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: [
          'uniform float uT; uniform vec3 uC; varying vec2 vW;',
          'float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
          'float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }',
          'float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * n(p); p = p * 2.07 + 5.3; a *= 0.5; } return v; }',
          'void main() {',
          '  vec2 p = vW * 0.0055; float a = fbm(p + vec2(uT * 0.04, uT * 0.025)); float c = fbm(p * 2.3 - vec2(uT * 0.06, -uT * 0.03) + a);',
          '  float caus = pow(1.0 - abs(c - 0.5) * 2.0, 10.0); float d = clamp(length(vW) / 1400.0, 0.0, 1.0);',
          '  vec3 col = mix(uC * 1.05, uC * 0.72, d) * (0.93 + 0.12 * a) + caus * vec3(0.75, 0.92, 1.0) * 0.22;',
          '  gl_FragColor = vec4(col, 1.0);',
          '}'].join('\n'),
      });
      const sea = new T.Mesh(new T.PlaneGeometry(4000, 4000), seaMat);
      sea.material.color = seaMat.uniforms.uC.value;
      sea.rotation.x = -Math.PI / 2; sea.position.y = -12; sea.receiveShadow = true;
      scene.add(sea);

      const landTex = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
        g.fillStyle = '#ececec'; g.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 1800; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0,' : '255,255,255,') + Math.random() * 0.14 + ')'; g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2); }
        for (let k = 0; k < 8; k++) { const x = Math.random() * 128, y = Math.random() * 128, r = 10 + Math.random() * 20, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,.09)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
        const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1 / 60, 1 / 60); if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace; return t;
      })();
      // Region sides: layered rock strata with cracks (the region colour tints the top, this stays earthy).
      const rockTex = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
        g.fillStyle = '#8a7a66'; g.fillRect(0, 0, 128, 128);
        for (let y = 0; y < 128; y += 10 + Math.random() * 8) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '40,30,20,' : '255,240,220,') + (0.08 + Math.random() * 0.12) + ')'; g.fillRect(0, y, 128, 3 + Math.random() * 5); }
        for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(0,0,0,' + Math.random() * 0.15 + ')'; g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1); }
        g.strokeStyle = 'rgba(30,20,10,.35)'; g.lineWidth = 1; for (let k = 0; k < 8; k++) { let x = Math.random() * 128, y = 0; g.beginPath(); g.moveTo(x, y); while (y < 128) { x += (Math.random() - 0.5) * 8; y += 6 + Math.random() * 8; g.lineTo(x, y); } g.stroke(); }
        const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1 / 40, 1 / 14); if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace; return t;
      })();
      // Region tops: soft mottling plus tiny grass strokes / pebbles so a flat colour reads as ground.
      const topTex = (() => {
        const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
        g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 256, 256);
        for (let k = 0; k < 22; k++) { const x = Math.random() * 256, y = Math.random() * 256, r = 18 + Math.random() * 40, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, Math.random() < 0.5 ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
        for (let i = 0; i < 1400; i++) { const x = Math.random() * 256, y = Math.random() * 256; g.strokeStyle = Math.random() < 0.6 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 2, y - 2 - Math.random() * 3); g.stroke(); }
        for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 1.6, 0, 7); g.fill(); }
        const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1 / 70, 1 / 70); t.anisotropy = 4; if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace; return t;
      })();
      // Toon look shared with the other games: 3-step ramp + ink outline (back faces pushed out).
      const ramp = (() => { const t = new T.DataTexture(new Uint8Array([140, 140, 140, 255, 200, 200, 200, 255, 255, 255, 255, 255]), 3, 1); t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true; return t; })();
      const toon = (c, o) => new T.MeshToonMaterial(Object.assign({ color: c, gradientMap: ramp }, o || {}));
      const inkMat = new T.MeshBasicMaterial({ color: 0x1c1420, side: T.BackSide });
      inkMat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normal * 0.9;'); };
      // Troops: little pawns (lathe profile) instead of balls.
      const unitGeo = new T.LatheGeometry([[0, 0], [3.6, 0], [3.8, 0.8], [2.4, 2.2], [1.7, 4.6], [2.9, 5.6], [2.6, 7.6], [1.4, 8.6], [0, 8.8]].map(([x, y]) => new T.Vector2(x, y - 4.2)), 12);
      const units = new T.InstancedMesh(unitGeo, toon(0xffffff), 1600);
      units.count = 0;
      units.castShadow = false;
      units.instanceMatrix.setUsage(T.DynamicDrawUsage);
      units.setColorAt(0, new T.Color());
      scene.add(units);
      // White outline shell so marching troops read against any region colour.
      const outline = new T.InstancedMesh(unitGeo, new T.MeshBasicMaterial({ color: 0xffffff, side: T.BackSide }), 1600);
      outline.count = 0; outline.instanceMatrix.setUsage(T.DynamicDrawUsage);
      scene.add(outline);
      // Direction markers: chevrons flowing from each marching column to its target, plus a pulsing ring on the target.
      const chevShape = new T.Shape();
      chevShape.moveTo(-4, 5.5); chevShape.lineTo(4.5, 0); chevShape.lineTo(-4, -5.5); chevShape.lineTo(-1.2, 0); chevShape.lineTo(-4, 5.5);
      const chevGeo = new T.ShapeGeometry(chevShape); chevGeo.rotateX(-Math.PI / 2);
      const chevrons = new T.InstancedMesh(chevGeo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }), 600);
      chevrons.count = 0; chevrons.instanceMatrix.setUsage(T.DynamicDrawUsage); chevrons.setColorAt(0, new T.Color());
      chevrons.renderOrder = 2; scene.add(chevrons);
      const ringGeo = new T.RingGeometry(0.8, 1, 36); ringGeo.rotateX(-Math.PI / 2);
      const rings = new T.InstancedMesh(ringGeo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }), 40);
      rings.count = 0; rings.instanceMatrix.setUsage(T.DynamicDrawUsage); rings.setColorAt(0, new T.Color());
      rings.renderOrder = 2; scene.add(rings);
      const TROOP_Y = 14; // above the highest lifted region (9) so troops never walk inside tiles

      let level = null;        // meshes of the current level
      let cx = 200, cy = 368;  // map center in 2D coords
      const dummy = new T.Object3D(), tmpColor = new T.Color(), dark = new T.Color(), v3 = new T.Vector3();
      const raycaster = new T.Raycaster(), groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0), hitPt = new T.Vector3();
      const camBase = new T.Vector3(), camTarget = new T.Vector3();
      let W = 1, H = 1;

      // 2D polygon (map coords) -> THREE.Shape in the XZ plane (after rotateX(-90°)).
      const toShape = poly => {
        const s = new T.Shape();
        poly.forEach(([x, y], i) => (i ? s.lineTo(x - cx, -(y - cy)) : s.moveTo(x - cx, -(y - cy))));
        return s;
      };
      const extrude = (poly, depth, bevel) => {
        const g = new T.ExtrudeGeometry(toShape(poly), bevel ? { depth: depth - bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 } : { depth, bevelEnabled: false, curveSegments: 1 });
        g.rotateX(-Math.PI / 2); // extrusion now points up (+Y), bottom at 0
        return g;
      };
      function inset(poly, d) {
        let mx = 0, my = 0;
        for (const [x, y] of poly) { mx += x; my += y; }
        mx /= poly.length; my /= poly.length;
        return poly.map(([x, y]) => { const dx = x - mx, dy = y - my, l = Math.hypot(dx, dy) || 1; const k = Math.max(0, (l - d) / l); return [mx + dx * k, my + dy * k]; });
      }

      function makeTower(type) {
        const s = 1.3 * (type === 'core' ? 1.5 : type === 'fort' ? 1.18 : type === 'factory' ? 1.08 : 1);
        const g = new T.Group();
        const body = toon(0xc9bca0), trim = toon(0x8a7a5a), stone = toon(0x9a9080);
        const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m);
          if (mat !== smokeMat) { const o = new T.Mesh(geo, inkMat); o.position.copy(m.position); g.add(o); m.userData.ol = o; } return m; };
        const smokeMat = new T.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
        add(new T.CylinderGeometry(12 * s, 13 * s, 3, 20), stone, 0, 1.5, 0);
        add(new T.CylinderGeometry(8 * s, 9.5 * s, 20 * s, 18), body, 0, 3 + 10 * s, 0);
        add(new T.CylinderGeometry(10 * s, 10 * s, 3.5 * s, 18), trim, 0, 3 + 21 * s, 0);
        const topY = 3 + 23 * s;
        if (type === 'normal' || type === 'fort') {
          for (let i = 0; i < 6; i++) {
            const a = i / 6 * Math.PI * 2;
            add(new T.BoxGeometry(4 * s, 4.5 * s, 4 * s), body, Math.cos(a) * 8 * s, topY + 2 * s, Math.sin(a) * 8 * s);
          }
        }
        if (type === 'fort') {
          const ring = add(new T.TorusGeometry(11.5 * s, 2 * s, 8, 24), trim, 0, 3 + 6 * s, 0);
          ring.rotation.x = Math.PI / 2; ring.userData.ol.rotation.x = Math.PI / 2;
        }
        let smoke = null;
        if (type === 'factory') {
          add(new T.CylinderGeometry(2.8 * s, 3.2 * s, 14 * s, 10), trim, 4 * s, topY + 6 * s, -2 * s);
          smoke = [];
          for (let i = 0; i < 3; i++) { const p = add(new T.SphereGeometry(3 * s, 8, 6), new T.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }), 4 * s, topY + 14 * s, -2 * s); p.castShadow = false; smoke.push(p); }
        }
        if (type === 'core') {
          add(new T.ConeGeometry(11 * s, 14 * s, 18), trim, 0, topY + 7 * s, 0);
          const gold = toon(0xffd23f, { emissive: 0x553300 });
          for (let i = 0; i < 5; i++) {
            const a = i / 5 * Math.PI * 2;
            add(new T.ConeGeometry(2.2 * s, 7 * s, 6), gold, Math.cos(a) * 5 * s, topY + 17 * s, Math.sin(a) * 5 * s);
          }
          add(new T.SphereGeometry(3 * s, 12, 10), gold, 0, topY + 15 * s, 0);
        }
        // Door facing the camera.
        add(new T.BoxGeometry(5 * s, 8 * s, 1.5), toon(0x2a1a10), 0, 3 + 4 * s, 9 * s);
        // Windows: two warm glowing slits.
        for (const wy of [12, 18]) add(new T.BoxGeometry(1.6 * s, 2.6 * s, 1.2), new T.MeshBasicMaterial({ color: 0xffd27a }), 0, 3 + wy * s, 9.2 * s - 0.2).userData.ol.visible = false;
        const height = type === 'core' ? topY + 22 * s : type === 'factory' ? topY + 16 * s : topY + 5 * s;
        return { group: g, body, trim, height, smoke };
      }

      function disposeLevel() {
        if (!level) return;
        scene.remove(level.root);
        level.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map && m.map.userData && m.map.userData.own) m.map.dispose(); /* materials not disposed: shaders stay compiled for the next level */ }); });
        level = null;
      }

      // ---------- Skin effects: pearl shimmer, neon pulse, gold glint, fire flicker ----------
      const white = new T.Color('#ffffff'), fxC = new T.Color(), fxE = new T.Color();
      function skinFx(kind, t) {
        if (kind === 'pearl') { fxC.setHSL((t * 0.12) % 1, 0.45, 0.86); fxE.setHSL((t * 0.12 + 0.5) % 1, 0.6, 0.5).multiplyScalar(0.12 + 0.06 * Math.sin(t * 3)); }
        else if (kind === 'neon') { const p = 0.5 + 0.5 * Math.sin(t * 7) * Math.sin(t * 2.3); fxC.setHSL(0.27, 1, 0.5 + 0.12 * p); fxE.setRGB(0.25, 0.9, 0.1).multiplyScalar(0.25 + 0.45 * p); }
        else if (kind === 'gold') { const g = Math.pow(0.5 + 0.5 * Math.sin(t * 2.4), 6); fxC.setRGB(1, 0.78 + 0.15 * g, 0.2 + 0.6 * g); fxE.setRGB(0.5, 0.32, 0).multiplyScalar(0.25 + 0.5 * g); }
        else if (kind === 'fire') { const f = 0.5 + 0.5 * Math.sin(t * 13) * Math.sin(t * 7.7); fxC.setHSL(0.03 + 0.06 * f, 1, 0.5 + 0.08 * f); fxE.setRGB(0.9, 0.25, 0).multiplyScalar(0.25 + 0.35 * f); }
        else return null;
        return { c: fxC, e: fxE };
      }
      // ---------- Theme decorations ----------
      const deco = [];
      const dm = (c, e) => new T.MeshLambertMaterial(Object.assign({ color: c, flatShading: true }, e ? { emissive: e } : {}));
      const DG = {
        cone: new T.ConeGeometry(1, 1, 6).translate(0, 0.5, 0), cyl: new T.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0),
        ball: new T.IcosahedronGeometry(1, 0), octa: new T.OctahedronGeometry(1, 0), box: new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      };
      const mesh = (g, m, x, y, z, sx, sy, sz, ry) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz); o.rotation.y = ry || 0; o.castShadow = true; return o; };
      const PROP = {
        lab: (r, p) => { const c = r() < 0.5 ? '#5ff3ff' : '#ff6bd6'; const m = mesh(DG.octa, dm(c, c), 0, 5, 0, 2.6, 6, 2.6, r() * 3); m.userData.spin = 1; p.add(m); p.add(mesh(DG.cyl, dm('#3a4060'), 0, 0, 0, 3.4, 1.6)); },
        ocean: (r, p) => { if (r() < 0.6) { p.add(mesh(DG.cyl, dm('#8a6a3a'), 0, 0, 0, 0.8, 11)); for (let k = 0; k < 4; k++) { const l = mesh(DG.cone, dm('#2fae4a'), 0, 10, 0, 1.6, 7, 1.6); l.rotation.set(1.2, k * 1.57, 0); p.add(l); } } else p.add(mesh(DG.ball, dm('#b9b2a2'), 0, 1.5, 0, 4, 2.6, 3.4, r() * 3)); },
        volcano: (r, p) => { if (r() < 0.45) { p.add(mesh(DG.cone, dm('#4a3a32'), 0, 0, 0, 7, 9)); const lv = mesh(DG.ball, dm('#ff7a1a', '#ff5a00'), 0, 9, 0, 2); lv.userData.glow = 1; p.add(lv); } else p.add(mesh(DG.ball, dm('#3d2c26'), 0, 1.5, 0, 3.6, 2.4, 3, r() * 3)); },
        glacier: (r, p) => { if (r() < 0.55) { p.add(mesh(DG.cone, dm('#2f6f5a'), 0, 0, 0, 4, 11)); p.add(mesh(DG.cone, dm('#ffffff'), 0, 6, 0, 2.6, 5)); } else p.add(mesh(DG.cone, dm('#bfe9ff', '#2a4a60'), 0, 0, 0, 2.2, 10, 2.2, r() * 3)); },
        forest: (r, p) => { if (r() < 0.75) { p.add(mesh(DG.cyl, dm('#6b4f33'), 0, 0, 0, 0.9, 4)); p.add(mesh(DG.cone, dm(r() < 0.5 ? '#2f8a3a' : '#3fa64a'), 0, 3, 0, 4.4, 10)); } else { p.add(mesh(DG.cyl, dm('#f4ecd8'), 0, 0, 0, 0.8, 3)); p.add(mesh(DG.ball, dm('#e0453a'), 0, 3.4, 0, 2.6, 1.2, 2.6)); } },
        midnight: (r, p) => { if (r() < 0.6) { p.add(mesh(DG.cyl, dm('#d6cbef'), 0, 0, 0, 0.7, 4)); const cap = mesh(DG.ball, dm('#9b6bff', '#7a3fff'), 0, 4.4, 0, 3, 1.3, 3); cap.userData.glow = 1; p.add(cap); } else p.add(mesh(DG.box, dm('#3a2f6a'), 0, 0, 0, 2, 10, 2, r())); },
      };
      const SEA = {
        lab: (r, p) => { const b = mesh(DG.ball, dm('#5ff3ff', '#2ad0ff'), 0, 1, 0, 2); b.userData.bob = 1; b.userData.glow = 1; p.add(b); },
        ocean: (r, p) => { if (r() < 0.5) { const hull = mesh(DG.box, dm('#8a5a2b'), 0, 0, 0, 10, 2.4, 4); p.add(hull); const sail = mesh(DG.cone, dm('#ffffff'), 0, 2.4, 0, 3, 9, 0.4); p.add(sail); p.userData.bob = 1; } else p.add(mesh(DG.ball, dm('#8a8478'), 0, 0, 0, 6, 3, 5, r() * 3)); },
        volcano: (r, p) => p.add(mesh(DG.ball, dm('#2a1e1a'), 0, 0, 0, 7, 3.6, 6, r() * 3)),
        glacier: (r, p) => { const ice = mesh(DG.ball, dm('#f1f8ff', '#3a5a70'), 0, 0, 0, 9, 5, 8, r() * 3); p.add(ice); p.userData.bob = 1; },
        forest: (r, p) => p.add(mesh(DG.cyl, dm('#3f9e4a'), 0, 0.2, 0, 5, 0.4)),
        midnight: (r, p) => { const l = mesh(DG.ball, dm('#ffd27a', '#ffb12a'), 0, 3, 0, 1.4); l.userData.glow = 1; p.add(l); p.userData.bob = 1; },
      };
      function decorate(root, S, theme, tiles) {
        deco.length = 0;
        const id = theme.id || 'lab', make = PROP[id], sea = SEA[id];
        let sd = S.lv * 977 + 5; const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
        const inside = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
        // On every region, away from its tower: they ride up with the region when it is captured.
        S.nodes.forEach((n, i) => {
          const tile = tiles[i]; if (!tile || !n.poly) return;
          let xs = Infinity, xe = -Infinity, ys = Infinity, ye = -Infinity; for (const [x, y] of n.poly) { xs = Math.min(xs, x); xe = Math.max(xe, x); ys = Math.min(ys, y); ye = Math.max(ye, y); }
          for (let k = 0, tries = 0; k < 3 && tries < 40; tries++) {
            const x = xs + r() * (xe - xs), y = ys + r() * (ye - ys);
            if (!inside(x, y, n.poly) || Math.hypot(x - n.x, y - n.y) < 34) continue;
            const g = new T.Group(); g.position.set(x - cx, 12, y - cy); g.scale.setScalar(2.4 + r() * 0.8); make(r, g); tile.mesh.add(g); deco.push(g); k++;
          }
        });
        // In the sea around the continent.
        const pts = S.coast;
        for (let k = 0; k < 16; k++) {
          const [x, y] = pts[Math.floor(r() * pts.length)], ang = Math.atan2(y - cy, x - cx), d = 50 + r() * 110;
          const g = new T.Group(); g.position.set(x - cx + Math.cos(ang) * d, -11, y - cy + Math.sin(ang) * d); g.rotation.y = r() * 6; g.scale.setScalar(2.2 + r()); sea(r, g); root.add(g); deco.push(g);
        }
      }
      function animDeco(t) {
        for (const g of deco) {
          if (g.userData.bob) g.position.y = -11 + Math.sin(t * 1.6 + g.position.x) * 0.8;
          g.traverse(o => { if (o.userData.spin) o.rotation.y = t * 1.2; if (o.userData.glow && o.material.emissive) o.material.emissiveIntensity = 0.7 + 0.3 * Math.sin(t * 3 + o.position.x); });
        }
      }
      // Shop picture of a colour: a tower on a slice of its region with three troops, rendered by a small
      // offscreen renderer (the effect colours use their mid tone). Cached per colour.
      const thumbs = {}; let tR = null;
      function thumb(color, fxKind) {
        const key = color + (fxKind || ''); if (thumbs[key]) return thumbs[key];
        if (!tR) { try { tR = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); tR.setSize(150, 170, false); if ('outputColorSpace' in tR) tR.outputColorSpace = T.SRGBColorSpace; tR.toneMapping = T.ACESFilmicToneMapping; } catch (e) { tR = false; } }
        if (!tR) return null;
        const sc = new T.Scene(); sc.add(new T.HemisphereLight(0xffffff, 0x9aa0d0, 1.3)); const sl = new T.DirectionalLight(0xfff0d8, 2.6); sl.position.set(-60, 120, 90); sc.add(sl);
        const fxc = fxKind ? skinFx(fxKind, 1.3) : null, c = color;
        const slab = new T.Mesh(new T.CylinderGeometry(30, 32, 10, 6), [new T.MeshLambertMaterial({ color: hexMix(c, '#5a4a3a', 0.5), map: rockTex }), new T.MeshLambertMaterial({ color: hexMix(c, '#ffffff', 0.1), map: topTex }), new T.MeshLambertMaterial({ color: '#3a3028' })]);
        slab.position.y = -5; sc.add(slab);
        const tw = makeTower('fort'); tw.body.color.set(c); tw.trim.color.set(hexMix(c, '#000000', 0.35)); if (fxc) { tw.body.emissive = fxc.e.clone(); }
        tw.group.scale.setScalar(0.85); sc.add(tw.group);
        for (let k = 0; k < 3; k++) { const pw = new T.Mesh(unitGeo, toon(hexMix(c, '#000000', 0.15))); pw.position.set(-16 + k * 16, 4.2, 22 - Math.abs(k - 1) * 4); pw.scale.setScalar(1.25); sc.add(pw);
          const ol = new T.Mesh(unitGeo, new T.MeshBasicMaterial({ color: 0xffffff, side: T.BackSide })); ol.position.copy(pw.position); ol.scale.setScalar(1.45); sc.add(ol); }
        const cam = new T.PerspectiveCamera(30, 150 / 170, 1, 1000); cam.position.set(0, 70, 120); cam.lookAt(0, 22, 0);
        tR.render(sc, cam);
        sc.traverse(o => { if (o.geometry && o.geometry !== unitGeo) o.geometry.dispose(); });
        return (thumbs[key] = tR.domElement.toDataURL('image/png'));
      }
      const R = {
        is3D: true,
        thumb,

        // ---------- Theme decorations: every region (10 levels) looks like its own land ----------
        setLevel(S, MAP, theme, palFn) {
          disposeLevel();
          cx = MAP.cx; cy = MAP.cy;
          const root = new T.Group();
          scene.background = new T.Color(theme.bottom);
          sea.material.color.set(theme.sea);
          // Continent: cliff block + sand top (visible between regions as roads).
          const cliff = new T.Mesh(extrude(S.coast, 22), [new T.MeshLambertMaterial({ color: hexMix(theme.cliff, '#000000', 0.15), map: topTex }), new T.MeshLambertMaterial({ color: theme.cliff, map: rockTex })]);
          cliff.position.y = -22.6; cliff.receiveShadow = true; root.add(cliff);
          const shoreLine = new T.LineLoop(new T.BufferGeometry().setFromPoints(S.coast.map(([x, y]) => new T.Vector3(x - cx, -11.4, y - cy))),
            new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
          root.add(shoreLine);
          const shallow = new T.Mesh(extrude(inset(S.coast, -16), 0.5), new T.MeshLambertMaterial({ color: hexMix(theme.sea, '#ffffff', 0.35), transparent: true, opacity: 0.85 }));
          shallow.position.y = -11.9; root.add(shallow);
          const foam = new T.Mesh(extrude(inset(S.coast, -7), 0.4), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
          foam.position.y = -11.6; root.add(foam); root.userData.foam = foam;
          const tiles = [], towers = [];
          for (const n of S.nodes) {
            if (!n.poly || n.poly.length < 3) { tiles.push(null); continue; }
            const mat = new T.MeshLambertMaterial({ color: theme.land, map: topTex });
            const side = new T.MeshLambertMaterial({ color: hexMix(theme.cliff, '#ffffff', 0.15), map: rockTex });
            const tile = new T.Mesh(extrude(inset(n.poly, 4.2), 12, 1.6), [mat, side]);
            tile.position.y = -12; tile.castShadow = true; tile.receiveShadow = true;
            root.add(tile);
            tiles.push({ mesh: tile, mat, side, owner: -1, lift: 0 });
            const tw = makeTower(n.type);
            tw.group.position.set(n.x - cx, 0, n.y - cy);
            root.add(tw.group);
            towers.push(Object.assign(tw, { owner: -1 }));
          }
          decorate(root, S, theme, tiles);
          scene.add(root);
          level = { root, tiles, towers, S, theme, palFn };
          R.fit(MAP);
        },

        // Place the camera so the whole continent fits between the HUD and the ability bar.
        fit() {
          if (!level) return;
          W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
          renderer.setSize(W, H, false);
          camera.aspect = W / H; camera.updateProjectionMatrix();
          const sa = window.UI && UI.safeArea ? UI.safeArea() : { hudBottom: 90, bottom: 0 };
          const top = sa.hudBottom + (level.S.boss ? 40 : 6), bottom = H - sa.bottom - 125, availH = Math.max(100, bottom - top);
          const pts = level.S.coast.map(([x, y]) => new T.Vector3(x - cx, 0, y - cy));
          level.S.nodes.forEach(n => pts.push(new T.Vector3(n.x - cx, 40, n.y - cy)));
          const pitch = 52 * Math.PI / 180;
          let d = 900; camTarget.set(0, 0, 0);
          for (let it = 0; it < 30; it++) {
            camera.position.set(camTarget.x, camTarget.y + Math.sin(pitch) * d, camTarget.z + Math.cos(pitch) * d);
            camera.lookAt(camTarget); camera.updateMatrixWorld();
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const p of pts) {
              v3.copy(p).project(camera);
              const sx = (v3.x + 1) / 2 * W, sy = (1 - v3.y) / 2 * H;
              minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
            }
            const ratio = Math.max((maxX - minX) / (W * 0.94), (maxY - minY) / (availH * 0.97));
            d *= Math.pow(ratio, 0.85);
            const dy = (minY + maxY) / 2 - (top + bottom) / 2;
            camTarget.z += dy * (level.S.coast.length ? 500 / Math.max(1, maxY - minY) : 1) * 0.5;
          }
          camBase.copy(camera.position);
        },

        pick(clientX, clientY) {
          const ndc = new T.Vector2(clientX / W * 2 - 1, -(clientY / H) * 2 + 1);
          raycaster.setFromCamera(ndc, camera);
          return raycaster.ray.intersectPlane(groundPlane, hitPt) ? { x: hitPt.x + cx, y: hitPt.z + cy } : { x: -9999, y: -9999 };
        },

        project(x, y, h) {
          v3.set(x - cx, h || 0, y - cy).project(camera);
          return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H };
        },

        // A boss tower can move (Shadow Lord): rebuild the tower mesh of one region with a new type.
        retype(i, type) {
          if (!level || !level.towers[i]) return;
          const old = level.towers[i], tw = makeTower(type);
          tw.group.position.copy(old.group.position);
          level.root.remove(old.group); level.root.add(tw.group);
          level.towers[i] = Object.assign(tw, { owner: -1 });
          if (level.tiles[i]) level.tiles[i].owner = -1; // repaint with the owner colour next frame
        },

        towerHeight(i) { return level && level.towers[i] ? level.towers[i].height : 30; },

        render(S, dt, opts) {
          if (!level || level.S !== S) return;
          const t = S.time, fx = S.skinFx ? skinFx(S.skinFx, performance.now() / 1000) : null;
          animDeco(performance.now() / 1000); seaMat.uniforms.uT.value = performance.now() / 1000;
          if (level.root.userData.foam) { const fp = performance.now() / 1000; level.root.userData.foam.material.opacity = 0.32 + 0.22 * Math.sin(fp * 1.7); level.root.userData.foam.scale.setScalar(1 + 0.012 * Math.sin(fp * 1.7)); }
          // Regions: colour by owner; owned regions rise out of the ground.
          S.nodes.forEach((n, i) => {
            const tile = level.tiles[i], tw = level.towers[i];
            if (!tile) return;
            const p = level.palFn(n.owner);
            // V3 capture: a ring of sparks in the new owner's colour, a rising helix and a star over the tower.
            if (tile.cap !== n.owner) { if (F3 && tile.cap != null && n.owner) { const x = n.x - cx, z = n.y - cy, c = p.base; F3.ring(x, 10, z, c, (n.r || 20) / 6, 30, '#ffffff'); F3.spiral(x, z, c, (n.r || 20) / 8, 10, 22, '#ffffff'); F3.star(x, 30, z, n.owner === 1 ? '#fff3b0' : c, 7, 0.4); if (n.owner === 1) F3.coins(x, 20, z, 10, 3); } tile.cap = n.owner; }
            if (tile.owner !== n.owner) {
              tile.owner = n.owner;
              tile.mat.color.set(n.owner === 0 ? level.theme.land : hexMix(p.base, '#ffffff', 0.1));
              tile.side.color.set(n.owner === 0 ? hexMix(level.theme.cliff, '#ffffff', 0.15) : hexMix(p.dark, level.theme.cliff, 0.55));
              tw.body.color.set(n.owner === 0 ? '#d8cdb2' : p.base);
              tw.trim.color.set(n.owner === 0 ? '#9c8c6c' : p.dark);
            }
            const want = n.owner === 1 ? 9 : n.owner >= 2 ? 5 : 0;
            tile.lift += (want - tile.lift) * Math.min(1, dt * 6);
            tile.mesh.position.y = -12 + tile.lift;
            tw.group.position.y = tile.lift;
            const sel = opts.sel.includes(n), hov = opts.hover === n, frozen = (S.freezeT > 0 && n.owner >= 2) || n.iceT > 0;
            const reach = !sel && opts.reach && opts.reach.has(n.id);
            const glow = sel ? 0.28 + Math.sin(t * 8) * 0.08 : hov ? 0.22 : frozen ? 0.25 : reach ? 0.32 + Math.sin(t * 6) * 0.1 : 0;
            tile.mat.emissive.set(frozen ? '#9fe8ff' : hov && n.owner !== 1 ? '#ff4a5a' : reach ? '#fff36b' : '#ffffff').multiplyScalar(glow);
            if (fx && n.owner === 1) { tile.mat.color.copy(fx.c).lerp(white, 0.2); tile.mat.emissive.add(fx.e); tw.body.color.copy(fx.c); tile.owner = -2; }
            const sc = 1 + n.pulse * 0.18;
            tw.group.scale.set(sc, sc, sc);
            if (tw.smoke && n.owner) tw.smoke.forEach((p, k) => {
              const ph = (t * 0.7 + k / 3 + i * 0.13) % 1;
              p.position.y = tw.height - 6 + ph * 20; p.position.x = 4.4 + ph * 6;
              p.scale.setScalar(0.6 + ph * 1.2); p.material.opacity = 0.8 * (1 - ph);
            });
          });
          // Troops (instanced) with an outline, bobbing as they march.
          const n = Math.min(S.dots.length, 1600);
          const groups = new Map();
          for (let i = 0; i < n; i++) {
            const d = S.dots[i];
            const y = TROOP_Y + (d.lift || 0) + Math.abs(Math.sin(t * 12 + i * 0.7)) * 1.6;
            dummy.position.set(d.x - cx, y, d.y - cy); dummy.scale.setScalar(1); dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            units.setMatrixAt(i, dummy.matrix);
            const pp = level.palFn(d.owner);
            if (fx && d.owner === 1) units.setColorAt(i, tmpColor.copy(fx.c)); else units.setColorAt(i, tmpColor.set(pp.base).lerp(dark.set(pp.dark), 0.35));
            dummy.scale.setScalar(1.22); dummy.updateMatrix();
            outline.setMatrixAt(i, dummy.matrix);
            if (d.dead || !d.to) continue;
            // Track the rear of every column (owner -> target) for the direction markers.
            const key = d.owner * 1000 + d.to.id, far = (d.x - d.to.x) ** 2 + (d.y - d.to.y) ** 2;
            const g = groups.get(key);
            if (!g) groups.set(key, { owner: d.owner, to: d.to, x: d.x, y: d.y, far });
            else if (far > g.far) { g.far = far; g.x = d.x; g.y = d.y; }
          }
          units.count = n; outline.count = n;
          units.instanceMatrix.needsUpdate = true; outline.instanceMatrix.needsUpdate = true;
          if (units.instanceColor) units.instanceColor.needsUpdate = true;
          let nc = 0, nr = 0;
          for (const g of groups.values()) {
            const to = g.to, dx = to.x - g.x, dy = to.y - g.y, len = Math.hypot(dx, dy);
            if (len < 1) continue;
            const ux = dx / len, uy = dy / len, end = Math.max(0, len - to.r - 4), rot = Math.atan2(-uy, ux);
            tmpColor.set(level.palFn(g.owner).dark);
            for (let k = (t * 55) % 22; k < end && nc < 600; k += 22) {
              dummy.position.set(g.x + ux * k - cx, TROOP_Y - 3, g.y + uy * k - cy);
              dummy.rotation.set(0, rot, 0); dummy.scale.setScalar(1.6); dummy.updateMatrix();
              chevrons.setMatrixAt(nc, dummy.matrix); chevrons.setColorAt(nc, tmpColor); nc++;
            }
            if (nr < 40) {
              const lift = to.owner === 1 ? 9 : to.owner >= 2 ? 5 : 0, pr = to.r + 10 + Math.sin(t * 8) * 3;
              dummy.position.set(to.x - cx, lift + 0.8, to.y - cy); dummy.rotation.set(0, 0, 0); dummy.scale.set(pr, 1, pr); dummy.updateMatrix();
              rings.setMatrixAt(nr, dummy.matrix); rings.setColorAt(nr, tmpColor.set(level.palFn(g.owner).base)); nr++;
            }
          }
          chevrons.count = nc; rings.count = nr;
          chevrons.instanceMatrix.needsUpdate = true; rings.instanceMatrix.needsUpdate = true;
          if (chevrons.instanceColor) chevrons.instanceColor.needsUpdate = true;
          if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
          if (F3) F3.update(dt);
          // Camera shake.
          camera.position.copy(camBase);
          if (S.shake) camera.position.add(v3.set((Math.random() - 0.5) * S.shake, 0, (Math.random() - 0.5) * S.shake));
          autoQ(); renderer.render(scene, camera);
        },
      };
      return R;
    },
  };
})();
