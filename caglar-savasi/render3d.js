// 3D renderer for Çağlar Savaşı (Three.js). The lane runs away from the camera: the player's base in the
// front, the enemy's at the far end. Lane position p (0 = player base front, L = enemy base front) maps
// to z = Z0 - p; the unit's lateral offset lx maps to x. Every age has its own bases, troops, turrets,
// projectiles and scenery. War3D.init(canvas) returns null without WebGL; the game keeps its 2D renderer.
(function () {
  'use strict';
  if (!window.THREE) return;
  const T = window.THREE, TAU = Math.PI * 2;
  const Z0 = 250, XS = 1.35;

  // What the player's army wears per skin (names/prices in game.js SKINS, same keys): a cape, a war banner on the
  // back, a crown, a glowing aura ring under every unit.
  const GEAR = {
    mavi: {},
    yesil: { cape: '#14532d' },
    mor: { cape: '#4b1a8a', aura: '#c084fc' },
    altin: { banner: '#fbbf24', crown: true },
    turuncu: { cape: '#7a3000', aura: '#ff7a1a' },
    turkuaz: { banner: '#14b8a6', aura: '#5eead4' },
    siyah: { cape: '#0b0f18', aura: '#8b5cf6' },
    pembe: { cape: '#be185d', banner: '#f9a8d4' },
    buz: { cape: '#0c4a6e', aura: '#7dd3fc' },
    kral: { cape: '#b91c1c', crown: true, banner: '#ffcf3f', aura: '#ffd23f' },
  };
  window.War3D = {
    GEAR,
    init(canvas, L) {
      let renderer;
      try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
      if (!renderer.getContext()) return null;
      let pr = Math.min(1.5, window.devicePixelRatio || 1), perfAcc = 0, perfN = 0;
      renderer.setPixelRatio(pr);
      if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(40, 1, 10, 4000);
      const hemi = new T.HemisphereLight(0xfff6e8, 0x5a5040, 1.15); scene.add(hemi);
      const sun = new T.DirectionalLight(0xfff0d8, 2.9); sun.position.set(-200, 400, 250); scene.add(sun);
      scene.fog = new T.Fog(0xcfe6f5, 900, 2200);

      const mats = {};
      const lam = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); return mats[k] || (mats[k] = new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}))); };
      const std = (c, o) => { const k = 's' + c + (o ? JSON.stringify(o) : ''); return mats[k] || (mats[k] = new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.5, metalness: 0.4 }, o || {}))); };
      const glowM = c => { const k = 'g' + c; return mats[k] || (mats[k] = new T.MeshBasicMaterial({ color: c })); };
      const addM = c => { const k = 'a' + c; return mats[k] || (mats[k] = new T.MeshBasicMaterial({ color: c, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); };
      const G = {
        box: new T.BoxGeometry(1, 1, 1), sph: new T.SphereGeometry(1, 14, 10), cyl: new T.CylinderGeometry(1, 1, 1, 12), cone: new T.ConeGeometry(1, 1, 12),
        cap: new T.CapsuleGeometry(1, 1.6, 4, 10), hemi: new T.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2), torus: new T.TorusGeometry(1, 0.12, 6, 16, Math.PI), ico: new T.IcosahedronGeometry(1, 1),
      };
      // Ink outline (back faces pushed out along the normal, in model units) for the KayKit troops and buildings.
      const inkM = w => { const m = new T.MeshBasicMaterial({ color: 0x1c140c, side: T.BackSide }); m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normal * ' + w.toFixed(3) + ';'); }; m.customProgramCacheKey = () => 'ink' + w; return m; };
      const inkUnit = inkM(0.05), inkBase = inkM(0.025);
      // Primitive helper: geometry g scaled (sx, sy, sz) at (x, y, z) in parent.
      function P(parent, g, m, sx, sy, sz, x, y, z, rx, ry, rz) {
        const o = new T.Mesh(G[g], m); o.scale.set(sx, sy, sz); o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0); parent.add(o); return o;
      }
      const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 2, 32, 32, 31); r.addColorStop(0, 'rgba(0,0,0,.5)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
      const blobM = new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
      // Ground detail (drawn light, tinted by the age colours): grass blades and soft patches, or a trodden dirt road with ruts.
      const DT = {};
      function detailTex(kind, rx, ry) {
        const key = kind + rx + ry; if (DT[key]) return DT[key];
        const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
        g.fillStyle = '#efefef'; g.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 1600; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0,' : '255,255,255,') + Math.random() * 0.13 + ')'; g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2); }
        if (kind === 'mud') { for (let i = 0; i < 26; i++) { const x = Math.random() * 128, y = Math.random() * 128, r = 3 + Math.random() * 9, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(40,30,20,.35)'); gr.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); } }
        else if (kind === 'grid') { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; for (let k = 0; k <= 128; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 128); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(128, k); g.stroke(); } }
        else if (kind === 'grass') { for (let i = 0; i < 600; i++) { const x = Math.random() * 128, y = Math.random() * 128; g.strokeStyle = Math.random() < 0.5 ? 'rgba(0,40,0,.16)' : 'rgba(255,255,220,.2)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 2, y - 2 - Math.random() * 4); g.stroke(); } }
        else { g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(30, 0, 14, 128); g.fillRect(84, 0, 14, 128); for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(80,60,40,.25)'; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2.5, 0, 7); g.fill(); } }
        const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace;
        return (DT[key] = t);
      }
      const blob = (parent, w, d) => { const b = new T.Mesh(new T.PlaneGeometry(w, d), blobM); b.rotation.x = -Math.PI / 2; b.position.y = 0.6; b.userData.deco = true; parent.add(b); return b; };

      // ---------- Troops ----------
      const SKIN = ['#d9a070', '#f1c38f', '#f1c38f', '#e8b48a', '#c8d0e0'];
      // Humanoid: torso in team colour, head, per-age headgear and weapon. Faces +z; returns animated parts.
      // ---------- KayKit characters (CC0 — kaykit-units.js, baked by scripts/kaykit-units.js) ----------
      const KU = window.KAYKIT_UNITS, kuGeo = {}, kuMat = {}, kuTex = {};
      // Seven ages; LOOK maps each to one of the five scenery/base families. KayKit characters only where their weapon
      // fits the age (axe, javelin, sword, crossbow); gunpowder/war/modern troops are built here, the future uses mechs.
      const LOOK = [0, 1, 1, 2, 3, 3, 4];
      const UNIT_OF = [['barb_axe', 'hood_throw'], ['knight_sword', 'hood_throw'], ['knight_sword', 'rogue_xbow'], null, null, null, null];
      const AGE_TINT = [null, '#f0c890', null, null, null, null, null]; // ancient: bronze
      const d64 = (b, TA) => { const str = atob(b), u = new Uint8Array(str.length); for (let i = 0; i < str.length; i++) u[i] = str.charCodeAt(i); return new TA(u.buffer); };
      function kuFrames(name) {
        if (kuGeo[name]) return kuGeo[name];
        const m = KU.units[name];
        const uv = new T.BufferAttribute(Float32Array.from(d64(m.u, Uint16Array), v => v / 65535), 2), idx = new T.BufferAttribute(d64(m.i, m.i32 ? Uint32Array : Uint16Array), 1);
        return (kuGeo[name] = m.frames.map(f => {
          const q = d64(f.p, Int16Array), pos = new Float32Array(q.length);
          for (let i = 0; i < q.length; i++) { const k = i % 3; pos[i] = m.min[k] + (q[i] + 32768) / 65535 * (m.max[k] - m.min[k]); }
          const g = new T.BufferGeometry();
          g.setAttribute('position', new T.BufferAttribute(pos, 3));
          g.setAttribute('normal', new T.BufferAttribute(Float32Array.from(d64(f.n, Int8Array), v => v / 127), 3));
          g.setAttribute('uv', uv); g.setIndex(idx);
          return g;
        }));
      }
      function kuMaterial(name, age, team) {
        const key = name + age + team.c;
        if (kuMat[key]) return kuMat[key];
        const tk = KU.units[name].tex;
        if (!kuTex[tk]) { const t = new T.TextureLoader().load(KU.tex[tk]); t.flipY = false; if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace; kuTex[tk] = t; }
        // Team tint (light) times age tint, so both sides stay readable on any age.
        const c = new T.Color('#ffffff').lerp(new T.Color(team.c), 0.3);
        if (AGE_TINT[age]) c.multiply(new T.Color(AGE_TINT[age]));
        return (kuMat[key] = new T.MeshLambertMaterial({ map: kuTex[tk], color: c }));
      }
      function kuUnit(age, type, team) {
        const g = new T.Group(), name = UNIT_OF[age][type], frames = kuFrames(name);
        const mesh = new T.Mesh(frames[0], kuMaterial(name, age, team)); mesh.scale.setScalar(13); g.add(mesh);
        const ol = new T.Mesh(frames[0], inkUnit); ol.scale.setScalar(13); g.add(ol); mesh.userData.ol = ol;
        const ring = new T.Mesh(new T.RingGeometry(7, 9.5, 20), new T.MeshBasicMaterial({ color: team.c, transparent: true, opacity: 0.85, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.7; ring.userData.deco = true; g.add(ring);
        blob(g, 12, 12);
        return { g, ku: true, mesh, frames, k: 0, h: 32 };
      }
      function humanoid(ageIn, type, team) {
        if (KU && type < 2 && UNIT_OF[ageIn]) return kuUnit(ageIn, type, team);
        if (EXT && ageIn === 6) return extUnit(type === 0 ? 'mech_leela' : 'mech_george', type === 0 ? 4.2 : 4.4, team);
        const age = LOOK[ageIn], ww = ageIn === 4;
        const g = new T.Group(), tc = lam(team.c), dark = lam(ww ? '#4a4a30' : team.d), skin = lam(SKIN[age]);
        const legL = P(g, 'cap', dark, 1.4, 2.2, 1.4, -1.7, 3.6, 0), legR = P(g, 'cap', dark, 1.4, 2.2, 1.4, 1.7, 3.6, 0);
        P(g, 'cap', tc, 3, 2.6, 2.6, 0, 10, 0);
        if (age === 1) P(g, 'box', std('#b8bec8'), 6.2, 5, 4.2, 0, 10.5, 0.3);
        if (age === 0) P(g, 'box', lam('#8a5a2b'), 6.4, 2.4, 4.4, 0, 6.6, 0);
        P(g, 'sph', skin, 2.7, 2.7, 2.7, 0, 16.2, 0);
        // Headgear.
        if (age === 0) P(g, 'hemi', lam('#3a2616'), 2.9, 2, 2.9, 0, 16.8, -0.3);
        else if (age === 1) { P(g, 'hemi', std('#9aa3b0'), 3.1, 2.8, 3.1, 0, 16.6, 0); P(g, 'box', std('#9aa3b0'), 0.6, 2.4, 0.4, 0, 16, 2.8); }
        else if (age === 2 && type === 1) { P(g, 'cyl', lam('#1f2937'), 2.8, 6, 2.8, 0, 20, 0); P(g, 'box', lam('#d4a53a'), 1.2, 1.6, 0.4, 0, 20, 2.8); P(g, 'sph', lam('#e8e0d0'), 0.9, 1.6, 0.9, 0, 23.6, 0); } // musketeer: tall shako with a plume
        else if (age === 2) { P(g, 'cyl', lam('#1f2937'), 4.2, 0.6, 4.2, 0, 18.3, 0); P(g, 'cyl', lam('#1f2937'), 2.4, 2.4, 2.4, 0, 19.6, 0); }
        else if (age === 3) { P(g, 'hemi', lam(ww ? '#6b6a3a' : '#3f4f2c'), 3.4, 2.2, 3.4, 0, 16.8, 0); if (ww) P(g, 'cyl', lam('#6b6a3a'), 4.4, 0.4, 4.4, 0, 16.9, 0); else P(g, 'box', glowM('#1b1b1b'), 3.6, 0.9, 0.6, 0, 16.2, 2.5); }
        else { P(g, 'sph', std('#dfe7f5', { metalness: 0.7 }), 3, 3, 3, 0, 16.4, 0); P(g, 'box', glowM('#39e0ff'), 4, 0.9, 1, 0, 16.6, 2.6); }
        // Weapon arm (pivot at the shoulder) so attacks can swing it.
        const arm = new T.Group(); arm.position.set(3.4, 12.5, 0); g.add(arm);
        P(arm, 'cap', tc, 1, 1.6, 1, 0, -2.2, 0);
        const W = arm;
        if (type === 0) {
          if (age === 0) P(W, 'cyl', lam('#7a4a26'), 1.1, 11, 1.1, 0, -3, 4, Math.PI / 2 - 0.3);
          else if (age === 1) { P(W, 'box', std('#e5e7eb', { metalness: 0.9 }), 0.6, 1.4, 12, 0, -4, 6); P(g, 'cyl', tc, 3.6, 0.6, 3.6, -3.6, 11, 1.2, Math.PI / 2); }
          else if (age === 2) { P(W, 'box', lam('#4a3a28'), 1, 1.4, 14, 0, -4, 5); P(W, 'box', std('#d1d5db', { metalness: 0.9 }), 0.4, 0.4, 5, 0, -4, 13); }
          else if (ww) { P(g, 'cyl', lam('#5a5a40'), 1.6, 7, 1.6, -1.2, 11, -3); P(g, 'cyl', lam('#5a5a40'), 1.6, 7, 1.6, 1.2, 11, -3); P(W, 'box', lam('#2b2b2b'), 1, 1.2, 10, 0, -4, 4); P(W, 'cyl', lam('#444'), 0.7, 3, 0.7, 0, -4, 10, Math.PI / 2); } // flamethrower + fuel tanks
          else if (age === 3) { P(W, 'box', lam('#2b2f36'), 1.2, 1.8, 10, 0, -4, 4); P(W, 'box', lam('#6b4a2a'), 1, 1.2, 4, 0, -4.4, -1); } // shotgun
          else P(W, 'box', glowM('#39e0ff'), 0.8, 0.8, 13, 0, -4, 6);
        } else {
          if (age === 0) { P(W, 'sph', lam('#6b5a4a'), 1.3, 1.3, 1.3, 0, -5, 2); }
          else if (age === 1) { const bow = P(W, 'torus', lam('#7a4a26'), 6, 6, 6, 0, -3, 3, 0, Math.PI / 2, 0); bow.rotation.z = Math.PI / 2; }
          else if (age === 2) P(W, 'box', lam('#4a3a28'), 1, 1.4, 16, 0, -4, 6);
          else if (age === 3) { P(W, 'box', lam(ww ? '#5a3f24' : '#2b2f36'), 1, 1.6, ww ? 15 : 18, 0, -4, 7); if (!ww) P(W, 'cyl', lam('#111'), 0.8, 3, 0.8, 0, -2.6, 3); }
          else { P(W, 'box', std('#dfe7f5', { metalness: 0.7 }), 1.4, 1.8, 14, 0, -4, 6); P(W, 'box', glowM('#39e0ff'), 0.8, 0.8, 1, 0, -4, 13.5); }
        }
        blob(g, 12, 12);
        return { g, legL, legR, arm, h: 21 };
      }
      function heavy(age, team) {
        const g = new T.Group(), tc = lam(team.c), dark = lam(team.d);
        const legs = [];
        if (age === 0) { // dinosaur + rider
          const dg = lam('#5fae4a');
          P(g, 'sph', dg, 9, 7, 13, 0, 13, 0);
          P(g, 'cap', dg, 3.2, 5, 3.2, 0, 21, 9, -0.7);
          P(g, 'sph', dg, 4.6, 4, 6.4, 0, 27, 14);
          P(g, 'box', lam('#fff'), 5, 1, 2, 0, 25.4, 18.6);
          P(g, 'cone', dg, 4, 16, 4, 0, 14, -16, -Math.PI / 2 - 0.3);
          for (const [x, z] of [[-5, 5], [5, 5], [-5, -5], [5, -5]]) legs.push(P(g, 'cap', dg, 2.4, 3, 2.4, x, 5, z));
          const r = humanoid(0, 0, team); r.g.scale.setScalar(0.7); r.g.position.set(0, 16, -2); g.add(r.g);
          P(g, 'box', tc, 12, 1.4, 10, 0, 19.5, -2);
          blob(g, 26, 34); return { g, legs, h: 36 };
        }
        if (age === 1) { // ancient war chariot: two horses, a cart and a spearman
          const hc = lam('#8a5a3c'), wood = lam('#a0703a');
          for (const x of [-4.5, 4.5]) { P(g, 'cap', hc, 3.2, 5, 3.2, x, 12, 12, Math.PI / 2); P(g, 'cap', hc, 1.8, 2.6, 1.8, x, 18, 20, -0.6); P(g, 'box', hc, 2.4, 3, 6, x, 20.5, 23); for (const z of [8, 16]) legs.push(P(g, 'cap', hc, 1, 3.6, 1, x, 5, z)); }
          P(g, 'box', wood, 14, 1.4, 14, 0, 7, -6); P(g, 'box', tc, 14, 7, 1.2, 0, 11, 1); for (const x of [-7, 7]) P(g, 'box', tc, 1.2, 7, 14, x, 11, -6);
          for (const x of [-8.5, 8.5]) { const w = P(g, 'cyl', lam('#5a3a1a'), 6, 1.4, 6, x, 6, -6, 0, 0, Math.PI / 2); legs.push(w); }
          P(g, 'cyl', wood, 0.5, 18, 0.5, 0, 8, 6, Math.PI / 2);
          const r = humanoid(1, 0, team); r.g.scale.setScalar(0.75); r.g.position.set(0, 7.5, -6); g.add(r.g);
          blob(g, 24, 40); return { g, legs, h: 30 };
        }
        if (age === 2) { // knight on horse
          const hc = lam('#8a5a3c');
          P(g, 'cap', hc, 5, 7, 5, 0, 13, 0, Math.PI / 2);
          P(g, 'cap', hc, 2.6, 3.4, 2.6, 0, 20, 11, -0.6); P(g, 'box', hc, 3.6, 4, 8, 0, 23, 15);
          for (const [x, z] of [[-3, 7], [3, 7], [-3, -7], [3, -7]]) legs.push(P(g, 'cap', hc, 1.3, 4, 1.3, x, 5, z));
          P(g, 'box', tc, 11, 6, 16, 0, 12, 0);
          const r = humanoid(2, 0, team); r.g.scale.setScalar(0.8); r.g.position.set(0, 14, -1); g.add(r.g);
          P(g, 'cyl', std('#d1d5db'), 0.7, 30, 0.7, 4, 24, 10, Math.PI / 2 - 0.15);
          blob(g, 20, 34); return { g, legs, h: 34 };
        }
        if (age === 3) { // cannon
          const wood = lam('#6b4423');
          for (const x of [-7, 7]) { const w = P(g, 'cyl', wood, 6, 1.6, 6, x, 6, -2, 0, 0, Math.PI / 2); legs.push(w); }
          P(g, 'box', tc, 10, 4, 16, 0, 8, -2);
          P(g, 'cyl', std('#2b2d33', { metalness: 0.8 }), 3, 20, 3, 0, 12, 6, Math.PI / 2 - 0.15);
          P(g, 'sph', std('#2b2d33', { metalness: 0.8 }), 3.6, 3.6, 3.6, 0, 12, -4);
          const r = humanoid(3, 0, team); r.g.scale.setScalar(0.75); r.g.position.set(-10, 0, -10); g.add(r.g);
          blob(g, 28, 28); return { g, legs, h: 24 };
        }
        if (age === 4 || age === 5) { // tank: riveted olive WW tank / sloped modern battle tank with a long gun
          const ww = age === 4, ol = lam(ww ? '#6b6a3a' : '#56664a'), tr = lam('#2b2f25');
          P(g, 'box', tr, 22, 7, 28, 0, 4, 0);
          P(g, 'box', ol, 18, 6, ww ? 22 : 24, 0, 10, ww ? 0 : -1);
          if (!ww) P(g, 'box', ol, 18, 4, 7, 0, 9.5, 12, -0.5); // sloped glacis
          P(g, ww ? 'box' : 'cyl', ol, ww ? 11 : 8, ww ? 6 : 5, ww ? 11 : 8, 0, 16, -2);
          P(g, 'cyl', tr, ww ? 1.6 : 1.2, ww ? 14 : 26, ww ? 1.6 : 1.2, 0, 16, ww ? 9 : 14, Math.PI / 2);
          if (!ww) P(g, 'cyl', tr, 1.8, 3, 1.8, 0, 16, 27, Math.PI / 2); // muzzle brake
          P(g, 'cyl', lam('#333'), 2, 1.6, 2, 3, 19.6, -4); // hatch
          if (ww) for (let k = -2; k <= 2; k++) P(g, 'sph', lam('#4a4a28'), 0.6, 0.6, 0.6, k * 3.6, 13.2, 11.2);
          P(g, 'box', tc, 18.4, 1.4, 6, 0, 13.6, -6);
          for (const x of [-11, 11]) for (let k = -1; k <= 1; k++) legs.push(P(g, 'cyl', lam('#444a3a'), 3, 3, 3, x, 4, k * 8, 0, 0, Math.PI / 2));
          blob(g, 30, 36); return { g, legs, h: 24 };
        }
        // mech
        if (EXT) { const m = extUnit('mech_stan', 6.4, team); m.h = 40; return m; }
        const met = std('#9aa3c8', { metalness: 0.7, roughness: 0.3 });
        for (const x of [-6, 6]) { legs.push(P(g, 'box', met, 4, 16, 5, x, 8, 0)); P(g, 'box', met, 6, 2, 9, x, 1, 1); }
        P(g, 'box', met, 20, 12, 14, 0, 22, 0);
        P(g, 'box', tc, 20.4, 3, 14.4, 0, 18, 0);
        P(g, 'box', glowM('#39e0ff'), 8, 2.4, 1, 0, 25, 7.2);
        for (const x of [-12, 12]) { P(g, 'box', met, 4, 4, 10, x, 23, 2); P(g, 'cyl', lam('#222'), 1.2, 10, 1.2, x, 23, 10, Math.PI / 2); }
        blob(g, 26, 22); return { g, legs, h: 32 };
      }
      // Skin gear on a unit model (heights follow the model: m.h is its top in model units).
      // Power mode (rewarded ad): one shared fiery ring material under every player unit while it lasts.
      const powerMat = new T.MeshBasicMaterial({ color: '#ffb020', transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
      const auraGeo = new T.RingGeometry(6, 10, 32), flagGeo = new T.PlaneGeometry(1, 1, 5, 1).translate(0.5, 0, 0);
      function dress(m, gk, heavyUnit) {
        if (!gk) return;
        const h = m.h, g = m.g, mats2 = [];
        if (gk.cape && !heavyUnit) {
          const cape = P(g, 'box', lam(gk.cape, { side: T.DoubleSide }), h * 0.36, h * 0.46, 0.5, 0, h * 0.42, -h * 0.13, 0.12);
          m.cape = cape;
        }
        if (gk.banner) {
          const bx = heavyUnit ? -h * 0.3 : -h * 0.1, bz = heavyUnit ? -h * 0.25 : -h * 0.16, top = heavyUnit ? h * 1.25 : h * 1.3;
          P(g, 'cyl', lam('#5a3a1a'), 0.45, top, 0.45, bx, top / 2, bz);
          P(g, 'sph', lam('#ffcf3f', { emissive: '#6a4200' }), 0.9, 0.9, 0.9, bx, top + 0.6, bz);
          const fl = new T.Mesh(flagGeo, lam(gk.banner, { side: T.DoubleSide, emissive: gk.banner, emissiveIntensity: 0.15 }));
          fl.scale.set(h * 0.38, h * 0.26, 1); fl.position.set(bx, top - h * 0.16, bz); fl.rotation.y = Math.PI / 2; g.add(fl); m.flag = fl;
        }
        if (gk.crown && !heavyUnit) {
          const cm = lam('#ffc928', { emissive: '#7a4a00' }), cr = new T.Group(); cr.position.set(0, h * 0.9, 0); g.add(cr);
          P(cr, 'cyl', cm, 2.6, 1.4, 2.6, 0, 0, 0);
          for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; P(cr, 'cone', cm, 0.7, 1.6, 0.7, Math.sin(a) * 2.4, 1.4, Math.cos(a) * 2.4); }
          m.crown = cr;
        }
        if (gk.aura) {
          const am = new T.MeshBasicMaterial({ color: gk.aura, transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
          const a = new T.Mesh(auraGeo, am); a.rotation.x = -Math.PI / 2; a.position.y = 0.9; a.scale.setScalar(heavyUnit ? 1.9 : 1); a.userData.deco = true; g.add(a); m.aura = a;
        }
      }
      function makeUnit(u, team, gk) {
        const m = u.type === 2 ? heavy(u.age, team) : humanoid(u.age, u.type, team);
        if (u.side === 0) dress(m, gk, u.type === 2);
        m.g.scale.multiplyScalar(u.type === 2 ? 1 : 1.25);
        m.g.rotation.y = u.side === 0 ? Math.PI : 0;
        root.add(m.g);
        return m;
      }

      // ---------- KayKit bases (CC0, Kay Lousberg — kaykit-cag.js, made by scripts/kaykit-convert.js) ----------
      // Medieval models are recoloured to the team colour (their blue banners/roofs); city and space keep theirs.
      const KC = window.KAYKIT_CAG, kcGeo = {}, kcMat = {}, kcImg = {};
      const hueOf = hex => { const c = new T.Color(hex), o = {}; c.getHSL(o); return Math.round(o.h * 360); };
      const atlas = src => { const t = src.isTexture ? src : new T.CanvasTexture(src); t.flipY = false; if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace; t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; };
      if (KC) for (const k in KC.tex) { const im = new Image(); im.onload = () => { baseAge[0] = baseAge[1] = -1; }; im.src = KC.tex[k]; kcImg[k] = im; }
      function recolor(img, hue) {
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height), p = d.data, nh = hue / 360;
        for (let i = 0; i < p.length; i += 4) {
          const r = p[i] / 255, gg = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, dd = mx - mn;
          if (dd < 0.12 || b !== mx) continue;
          const h = ((r - gg) / dd + 4) * 60;
          if (h < 185 || h > 255) continue;
          const s = dd / (1 - Math.abs(2 * l - 1)), q = l < 0.5 ? l * (1 + s) : l + s - l * s, pp = 2 * l - q;
          const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; };
          p[i] = f(nh + 1 / 3) * 255; p[i + 1] = f(nh) * 255; p[i + 2] = f(nh - 1 / 3) * 255;
        }
        g.putImageData(d, 0, 0);
        return c;
      }
      function kcMaterial(pack, team) {
        const img = kcImg[pack], ready = img && img.complete && img.width, hue = pack === 'medieval' ? hueOf(team.c) : null;
        const key = pack + (ready ? ':' + hue : ':raw');
        if (kcMat[key]) return kcMat[key];
        const map = !ready ? atlas(new T.TextureLoader().load(KC.tex[pack])) : atlas(hue == null ? img : recolor(img, hue));
        return (kcMat[key] = new T.MeshLambertMaterial({ map }));
      }
      const dec = (b, TA) => { const str = atob(b), u = new Uint8Array(str.length); for (let i = 0; i < str.length; i++) u[i] = str.charCodeAt(i); return new TA(u.buffer); };
      function kcGeometry(name) {
        if (kcGeo[name]) return kcGeo[name];
        const m = KC.models[name], q = dec(m.p, Int16Array), pos = new Float32Array(q.length);
        for (let i = 0; i < q.length; i++) { const k = i % 3; pos[i] = m.min[k] + (q[i] + 32768) / 65535 * (m.max[k] - m.min[k]); }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(pos, 3));
        g.setAttribute('normal', new T.BufferAttribute(Float32Array.from(dec(m.n, Int8Array), v => v / 127), 3));
        g.setAttribute('uv', new T.BufferAttribute(Float32Array.from(dec(m.u, Uint16Array), v => v / 65535), 2));
        g.setIndex(new T.BufferAttribute(dec(m.i, m.i32 ? Uint32Array : Uint16Array), 1));
        return (kcGeo[name] = g);
      }
      const kc = (p, team, name, sc, x, z, ry) => { const o = new T.Mesh(kcGeometry(name), kcMaterial(KC.models[name].tex, team)); o.scale.setScalar(sc); o.position.set(x || 0, 0, z || 0); o.rotation.y = ry || 0; p.add(o);
        const ol = new T.Mesh(o.geometry, inkBase); ol.scale.copy(o.scale); ol.position.copy(o.position); ol.rotation.copy(o.rotation); ol.userData.deco = true; p.add(ol); return o; };
      // Every age's base, built facing +z (the lane) and kept low enough not to hide the battlefield.
      const KBASE = [
        (g, t) => { kc(g, t, 'mine', 52, 0, -4); for (const x of [-56, 56]) kc(g, t, 'tent', 44, x, 10, x * 0.01); kc(g, t, 'trees_A_medium', 30, -42, -34, 1); kc(g, t, 'trees_A_medium', 26, 46, -36, 2); kc(g, t, 'rock_single_A', 60, 20, 26, 0.4); },
        (g, t) => { kc(g, t, 'barracks', 50, 0, -4); for (const x of [-54, 54]) kc(g, t, 'tower_A', 26, x, 4); kc(g, t, 'weaponrack', 60, -26, 26, 0.3); },
        (g, t) => { kc(g, t, 'archeryrange', 46, 0, -4); for (const x of [-54, 54]) kc(g, t, 'tower_catapult', 28, x, 4); kc(g, t, 'weaponrack', 60, 28, 26, -0.3); },
        (g, t) => { kc(g, t, 'B', 40, 0, -8); kc(g, t, 'watertower', 46, 54, -6); kc(g, t, 'car_police', 38, -52, 14, 0.4); kc(g, t, 'streetlight', 40, -30, 28); kc(g, t, 'dumpster', 40, 36, 26); },
        (g, t) => { kc(g, t, 'basemodule_A', 38, 0, -8); kc(g, t, 'windturbine_tall', 24, 58, -10); kc(g, t, 'landingpad_small', 26, -56, 4); kc(g, t, 'lander_A', 22, -56, 4, 0.6); kc(g, t, 'roofmodule_solarpanels', 30, 0, -8); kc(g, t, 'cargo_A_stacked', 24, 34, 24); },
      ];

      // ---------- Extra CC0 models: Kenney Tower Defense Kit (turrets, ammo) and Quaternius mechs (cag-ext.js) ----------
      const EXT = window.CAG_EXT, exGeo = {}, exMat = {}, exTex = {};
      function exGeometry(name) {
        if (exGeo[name]) return exGeo[name];
        const m = EXT.models[name], q = dec(m.p, Int16Array), pos = new Float32Array(q.length);
        for (let i = 0; i < q.length; i++) { const k = i % 3; pos[i] = m.min[k] + (q[i] + 32768) / 65535 * (m.max[k] - m.min[k]); }
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(pos, 3));
        g.setAttribute('normal', new T.BufferAttribute(Float32Array.from(dec(m.n, Int8Array), v => v / 127), 3));
        g.setAttribute('uv', new T.BufferAttribute(Float32Array.from(dec(m.u, Uint16Array), v => v / 65535), 2));
        g.setIndex(new T.BufferAttribute(dec(m.i, m.i32 ? Uint32Array : Uint16Array), 1));
        g.translate(-(m.min[0] + m.max[0]) / 2, -m.min[1], -(m.min[2] + m.max[2]) / 2); // centred, standing on y = 0
        return (exGeo[name] = g);
      }
      function exMaterial(name, tint) {
        const tk = EXT.models[name].tex, key = tk + (tint || '');
        if (exMat[key]) return exMat[key];
        if (!exTex[tk]) { const t = new T.TextureLoader().load(EXT.tex[tk]); t.flipY = false; if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace; if (tk === 'td') { t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; } exTex[tk] = t; }
        return (exMat[key] = new T.MeshLambertMaterial({ map: exTex[tk], color: tint || '#ffffff' }));
      }
      const ex = (p, name, sc, x, y, z, ry, tint) => { const o = new T.Mesh(exGeometry(name), exMaterial(name, tint)); o.scale.setScalar(sc); o.position.set(x || 0, y || 0, z || 0); o.rotation.y = ry || 0; p.add(o); return o; };
      // A Quaternius mech as a unit: team-coloured ring under it, a light team tint.
      function extUnit(name, sc, team) {
        const g = new T.Group(), body = new T.Group(); g.add(body);
        const tint = '#' + new T.Color('#ffffff').lerp(new T.Color(team.c), 0.25).getHexString();
        const mesh = ex(body, name, sc, 0, 0, 0, 0, tint);
        const ring = new T.Mesh(new T.RingGeometry(8, 10.5, 20), new T.MeshBasicMaterial({ color: team.c, transparent: true, opacity: 0.85, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.7; ring.userData.deco = true; g.add(ring);
        blob(g, 16, 14);
        return { g, ext: true, body, mesh, h: 30 };
      }
      // Turret = a tower (Kenney parts, per look) with the age's weapon on a turning head.
      const TOWER = [['tower-round-bottom-a', 'tower-round-middle-a'], ['tower-square-bottom-a', 'tower-square-middle-a'], ['tower-square-bottom-a', 'tower-square-middle-a'], ['tower-square-bottom-a', 'tower-square-middle-a'], ['tower-round-bottom-a', 'tower-round-crystals']];
      const TOWER_TINT = ['#c8a070', null, null, '#c0a890', '#9aa3a0', '#8a96a8', '#9a9cff'];
      const WEAPON = {
        rapid: [['weapon-catapult', 0.75], ['weapon-ballista', 1], ['weapon-ballista', 1.05], ['weapon-cannon', 0.8], ['weapon-turret', 1], ['weapon-turret', 1.1], ['weapon-turret', 1.1, '#9af6ff']],
        heavy: [['weapon-catapult', 1.05], ['weapon-catapult', 1.2], ['weapon-catapult', 1.3], ['weapon-cannon', 1.15], ['weapon-cannon', 1.1, '#8a9a6a'], ['rockets', 1], ['weapon-cannon', 1.2, '#c79bff']],
      };
      // Tower body per age (built here, so every age has its own): returns the height where the weapon sits.
      function towerBody(g, age, team) {
        const tc = lam(team.c), dark = lam('#2b2620');
        if (age === 0) { // stone age: log stilts, a lashed platform, hide roof
          const wood = lam('#7a4a26');
          for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) P(g, 'cyl', wood, 1.3, 22, 1.3, x, 11, z, (x > 0 ? 1 : -1) * 0.06, 0, (z > 0 ? 1 : -1) * 0.06);
          P(g, 'box', lam('#8a5a2b'), 18, 2.4, 18, 0, 22, 0); for (const z of [-7, 0, 7]) P(g, 'cyl', wood, 1, 18, 1, 0, 23.6, z, 0, 0, Math.PI / 2);
          P(g, 'ico', lam('#8a8378', { flatShading: true }), 5, 3, 5, -7, 1.5, 6); P(g, 'sph', lam('#e8dcc0'), 1.2, 1.2, 4, 7, 2, -7); // rock, bone
          return 24;
        }
        if (age === 1) { // ancient: fluted marble column on a plinth, bronze capital
          const mar = lam('#e8e2d4'); P(g, 'box', mar, 18, 4, 18, 0, 2, 0); P(g, 'box', mar, 15, 3, 15, 0, 5.5, 0);
          P(g, 'cyl', mar, 5.5, 20, 5.5, 0, 17, 0); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; P(g, 'box', lam('#d4ccbc'), 0.9, 20, 0.9, Math.sin(a) * 5.6, 17, Math.cos(a) * 5.6); }
          P(g, 'box', lam('#c98a3a', { emissive: '#3a2000' }), 15, 3, 15, 0, 28.5, 0); return 30;
        }
        if (age === 2) { // medieval: round stone tower, crenellations, banner
          const st = lam('#a8a29a'); P(g, 'cyl', st, 9, 26, 9, 0, 13, 0); P(g, 'cyl', lam('#8a847c'), 10.5, 3, 10.5, 0, 27, 0);
          for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; P(g, 'box', st, 3, 4, 3, Math.sin(a) * 9.5, 30.5, Math.cos(a) * 9.5); }
          P(g, 'box', dark, 2.4, 5, 0.6, 0, 16, 9.1); const ban = new T.Mesh(new T.PlaneGeometry(6, 10), new T.MeshLambertMaterial({ color: team.c, side: T.DoubleSide })); ban.position.set(0, 20, 9.3); g.add(ban);
          return 29;
        }
        if (age === 3) { // gunpowder: earthwork redoubt with gabions and a wooden gun deck
          for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; P(g, 'cyl', lam('#8a6a3a'), 3.4, 8, 3.4, Math.sin(a) * 9, 4, Math.cos(a) * 9); P(g, 'cyl', lam('#6b5a3a'), 3.2, 1, 3.2, Math.sin(a) * 9, 8.4, Math.cos(a) * 9); }
          P(g, 'cyl', lam('#9a7a4a'), 9, 9, 9, 0, 4.5, 0); P(g, 'box', lam('#6b4423'), 16, 1.6, 16, 0, 9.5, 0); return 10.5;
        }
        if (age === 4) { // world war: sandbag ring and a concrete pillbox
          P(g, 'cyl', lam('#8a8f80'), 10, 10, 10, 0, 5, 0); P(g, 'box', dark, 12, 1.6, 2, 0, 7, 9.6);
          for (let r = 0; r < 2; r++) for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + r * 0.26; P(g, 'sph', lam('#b8a070'), 3, 1.6, 2, Math.sin(a) * 12.5, 1.4 + r * 2.6, Math.cos(a) * 12.5, 0, a, 0); }
          return 10;
        }
        if (age === 5) { // modern: steel platform, camo plates, radar dish
          const steel = std('#5b6670', { metalness: 0.6 }); P(g, 'box', steel, 16, 3, 16, 0, 1.5, 0);
          for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) P(g, 'box', steel, 2, 14, 2, x, 8, z);
          P(g, 'box', lam('#6b7a5a'), 18, 3, 18, 0, 15.5, 0); P(g, 'cyl', steel, 0.5, 8, 0.5, 7, 21, -7);
          const dish = P(g, 'sph', std('#dfe3e8', { metalness: 0.4 }), 4, 1.6, 4, 7, 25, -7); dish.rotation.x = 0.8; g.userData.dish = dish; return 17;
        }
        // future: a hovering pylon with glowing rings and crystals
        const met = std('#3b3f9a', { metalness: 0.7, roughness: 0.3 }); P(g, 'cone', met, 9, 6, 9, 0, 3, 0);
        P(g, 'cyl', met, 3.5, 16, 3.5, 0, 14, 0);
        const ring = new T.Group(); ring.position.y = 12; g.add(ring); g.userData.ring = ring;
        P(ring, 'torus', glowM('#7df9ff'), 8, 8, 8, 0, 0, 0, Math.PI / 2); P(ring, 'torus', glowM('#ff4df0'), 6, 6, 6, 0, 6, 0, Math.PI / 2);
        for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; P(g, 'cone', glowM('#7df9ff'), 1.4, 6, 1.4, Math.sin(a) * 7, 3, Math.cos(a) * 7); }
        return 22;
      }
      function extTurret(kind, age, team) {
        const g = new T.Group();
        const y = towerBody(g, age, team);
        const head = new T.Group(); head.position.y = y; g.add(head);
        const [w, k, wt] = WEAPON[kind][age], S2 = 26;
        if (w === 'rockets') { // rocket pod: a block of tubes on the cannon base
          ex(head, 'weapon-cannon', S2 * 0.9, 0, 0, 0, 0, '#7a8a6a').visible = true;
          for (let i = 0; i < 4; i++) P(head, 'cyl', lam('#3a4030'), 1.6, 12, 1.6, (i % 2 - 0.5) * 4.4, 9 + Math.floor(i / 2) * 3.6, 2, Math.PI / 2 - 0.25);
        } else ex(head, w, S2 * k, 0, 0, 0, 0, wt); // barrel along the head's +z, which aims at the target (was turned back toward its own base)
        g.userData.head = head; g.userData.ground = true; g.userData.ext = true;
        return g;
      }

      // ---------- Particles: one additive point cloud (sparks, embers, dust glints) + a smoke cloud ----------
      const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new T.CanvasTexture(c); })();
      function cloud(n, size, additive) {
        const geo = new T.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
        geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
        const pts = new T.Points(geo, new T.PointsMaterial({ size, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending, opacity: additive ? 1 : 0.55 }));
        pts.frustumCulled = false; scene.add(pts);
        return { pts, pos, col, n, p: Array.from({ length: n }, () => ({ life: 0 })), i: 0 };
      }
      const sparks = cloud(900, 6, true), smoke = cloud(260, 26, false), tmpC = new T.Color();
      function emit(c, x, y, z, vx, vy, vz, life, color, grav) {
        const q = c.p[c.i]; c.i = (c.i + 1) % c.n; Object.assign(q, { x, y, z, vx, vy, vz, life, max: life, grav: grav || 0 }); tmpC.set(color); q.r = tmpC.r; q.g = tmpC.g; q.b = tmpC.b;
      }
      function stepCloud(c, dt) {
        for (let k = 0; k < c.n; k++) {
          const q = c.p[k], o = k * 3;
          if (q.life <= 0) { c.pos[o + 1] = -9999; continue; }
          q.life -= dt; q.vy -= q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
          if (q.y < 0.5 && q.grav > 0) { q.y = 0.5; q.vy *= -0.3; q.vx *= 0.6; q.vz *= 0.6; }
          const a = Math.max(0, q.life / q.max); c.pos[o] = q.x; c.pos[o + 1] = q.y; c.pos[o + 2] = q.z; c.col[o] = q.r * a; c.col[o + 1] = q.g * a; c.col[o + 2] = q.b * a;
        }
        c.pts.geometry.attributes.position.needsUpdate = true; c.pts.geometry.attributes.color.needsUpdate = true;
      }
      const rr = (a, b) => a + Math.random() * (b - a);
      // V3: the shared GPU effect system (ortak/fx3d.js) on top: flashes, spark rings, flying stone chips, star flares.
      const F3 = window.Fx3D ? Fx3D.create(scene, { unit: 7, particles: 900, rocks: 60, decals: 6, bolts: 4, budget: 260 }) : null;
      // A burst of the right kind where something lands: dust and stones, splinters, fire and smoke, energy sparks.
      function impact(kind, x, z, big) {
        const n = big ? 2 : 1;
        if (F3) {
          if (kind === 'stone' || kind === 'boulder') F3.impact(x, 6, z, '#e8c890', 0.9 * n, 6 * n, '#7a6a52');
          else if (kind === 'laser' || kind === 'plasma') { F3.impact(x, 10, z, kind === 'plasma' ? '#c79bff' : '#7df9ff', 0.8 * n, 0); F3.ring(x, 8, z, kind === 'plasma' ? '#c79bff' : '#7df9ff', 1.4 * n, 14); }
          else if (kind === 'bolt' || kind === 'arrow' || kind === 'javelin' || kind === 'bullet') F3.impact(x, 10, z, '#ffe2a8', 0.45, 0);
          else { F3.explosion(x, 8, z, big ? 26 : 16, { n: big ? 18 : 10, rocks: big ? 8 : 4, scorch: false, shake: 0, rockCol: '#4a3a2a' }); F3.ring(x, 4, z, '#ffb040', big ? 4 : 2.6, big ? 28 : 16, '#ffffff'); }
        }
        if (kind === 'stone' || kind === 'boulder') { for (let k = 0; k < 14 * n; k++) emit(smoke, x + rr(-6, 6), rr(2, 8), z + rr(-6, 6), rr(-20, 20), rr(10, 30), rr(-20, 20), rr(0.6, 1.2), '#a08a6a'); for (let k = 0; k < 10 * n; k++) emit(sparks, x, 4, z, rr(-40, 40), rr(30, 70), rr(-40, 40), rr(0.4, 0.8), '#c9b08a', 160); }
        else if (kind === 'bolt' || kind === 'arrow' || kind === 'javelin') { for (let k = 0; k < 8; k++) emit(sparks, x, 10, z, rr(-30, 30), rr(10, 40), rr(-30, 30), rr(0.2, 0.4), '#ffe2a8', 120); }
        else if (kind === 'laser' || kind === 'plasma') { for (let k = 0; k < (kind === 'plasma' ? 30 : 12); k++) emit(sparks, x, 10, z, rr(-60, 60), rr(-10, 60), rr(-60, 60), rr(0.25, 0.6), kind === 'plasma' ? (k % 2 ? '#c79bff' : '#ffffff') : '#7df9ff', 40); }
        else if (kind === 'bullet') { for (let k = 0; k < 5; k++) emit(sparks, x, 10, z, rr(-30, 30), rr(10, 40), rr(-30, 30), rr(0.15, 0.3), '#ffd23f', 120); }
        else { // ball, shell, rocket, bomb, missile: fire + smoke + debris
          for (let k = 0; k < 24 * n; k++) emit(sparks, x, rr(4, 14), z, rr(-70, 70) * n, rr(20, 90), rr(-70, 70) * n, rr(0.4, 0.9), k % 3 ? '#ff8a2a' : '#ffd23f', 120);
          for (let k = 0; k < 10 * n; k++) emit(smoke, x + rr(-10, 10) * n, rr(6, 16), z + rr(-10, 10) * n, rr(-10, 10), rr(18, 40), rr(-10, 10), rr(1, 1.8), k % 2 ? '#4a4440' : '#6a625a');
          scorch(x, z, big ? 34 : 20);
        }
      }
      // Scorch marks on the ground fade out over a few seconds.
      const scorchTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(20,14,10,.75)'); gr.addColorStop(0.6, 'rgba(30,20,12,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
      const scorches = [];
      function scorch(x, z, r) {
        if (scorches.length > 24) { const o = scorches.shift(); root.remove(o.m); /* material kept: shader stays compiled */ }
        const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.set(x, 0.6, z); m.scale.setScalar(r * 2); root.add(m); scorches.push({ m, life: 6 });
      }

      // ---------- Bases & turrets ----------
      function base(ageIn, side, team) {
        const age = LOOK[ageIn], g = new T.Group(), tc = lam(team.c);
        const flag = new T.Group();
        if (KC) KBASE[age](g, team);
        else if (age === 0) { // cave in a rock mound
          const rock = lam('#8a8378', { flatShading: true });
          const m = P(g, 'ico', rock, 60, 34, 40, 0, 10, 0); m.scale.y = 34;
          P(g, 'hemi', lam('#2b2520'), 16, 20, 10, 0, 0, 34);
          for (let k = 0; k < 5; k++) P(g, 'ico', rock, 10 + k, 8, 10, -50 + k * 25, 4, 28 - (k % 2) * 8);
          P(g, 'cyl', lam('#7a4a26'), 1.2, 20, 1.2, -24, 10, 30); P(g, 'sph', glowM('#ffb020'), 3, 4, 3, -24, 21, 30);
        } else if (age === 1) { // stone castle
          const st = lam('#b8b0a0');
          P(g, 'box', st, 110, 46, 40, 0, 23, 0);
          for (let k = -5; k <= 5; k += 2) P(g, 'box', st, 8, 8, 42, k * 10, 50, 0);
          for (const x of [-58, 58]) { P(g, 'cyl', st, 13, 64, 13, x, 32, 6); P(g, 'cone', lam('#8c2a24'), 16, 20, 16, x, 74, 6); }
          P(g, 'box', lam('#3a2a1a'), 20, 26, 2, 0, 13, 21);
        } else if (age === 2) { // fort with palisade
          const wood = lam('#8a5a2b');
          for (let k = -6; k <= 6; k++) P(g, 'cyl', wood, 3.2, 34 + (k % 2) * 4, 3.2, k * 9, 17, 20);
          P(g, 'box', lam('#b58a55'), 90, 30, 34, 0, 15, -6); P(g, 'box', lam('#6e4424'), 96, 6, 38, 0, 33, -6);
          P(g, 'box', lam('#4b3520'), 18, 20, 2, 0, 10, 21);
        } else if (age === 3) { // concrete bunker
          const con = lam('#7d8590');
          P(g, 'box', con, 110, 34, 44, 0, 17, 0);
          P(g, 'box', lam('#1f2937'), 70, 7, 2, 0, 22, 22.2);
          for (let k = 0; k < 7; k++) P(g, 'cyl', lam('#b8a070'), 5, 6, 5, -54 + k * 18, 3, 28);
          P(g, 'cyl', lam('#444'), 1.2, 30, 1.2, 40, 50, -10);
        } else { // tech tower
          const met = std('#3b3f9a', { metalness: 0.6, roughness: 0.3 });
          P(g, 'box', met, 100, 22, 40, 0, 11, 0);
          P(g, 'cyl', met, 22, 70, 22, 0, 40, -4, 0, 0, 0).scale.set(22, 70, 22);
          P(g, 'sph', glowM('#7df9ff'), 10, 10, 10, 0, 82, -4);
          for (const x of [-42, 42]) P(g, 'box', glowM('#39e0ff'), 3, 18, 1, x, 12, 20.5);
        }
        // Team flag.
        P(flag, 'cyl', lam('#333'), 0.8, 30, 0.8, 0, 15, 0);
        const cloth = new T.Mesh(new T.PlaneGeometry(16, 10), new T.MeshLambertMaterial({ color: team.c, side: T.DoubleSide })); cloth.position.set(8, 25, 0); flag.add(cloth);
        flag.position.set(46, age === 1 ? 54 : age === 4 ? 22 : 34, -10); g.add(flag); g.userData.cloth = cloth;
        blob(g, 150, 70);
        g.rotation.y = side === 0 ? Math.PI : 0;
        return g;
      }
      function turret(kind, ageIn, team) {
        if (EXT) return extTurret(kind, ageIn, team);
        const age = LOOK[ageIn];
        if (KC && age <= 2 && !EXT) { const t = new T.Group(); kc(t, team, kind === 'heavy' ? 'tower_catapult' : 'tower_A', kind === 'heavy' ? 17 : 13); t.userData.ground = true; return t; }
        const g = new T.Group(), met = std(['#8a6a4a', '#8a8a96', '#555c68', '#4b5563', '#3b3f9a'][age], { metalness: 0.5 }), tc = lam(team.c);
        P(g, 'box', met, 14, 8, 14, 0, 4, 0);
        const head = new T.Group(); head.position.y = 10; g.add(head);
        if (kind === 'heavy') { P(head, 'sph', tc, 7, 6, 7, 0, 0, 0); P(head, 'cyl', lam('#2b2b33'), 2.6, 16, 2.6, 0, 3, 8, Math.PI / 2 - 0.4); }
        else { P(head, 'box', tc, 8, 7, 8, 0, 0, 0); P(head, 'cyl', age >= 4 ? glowM('#7df9ff') : lam('#2b2b33'), 1, 14, 1, 0, 1, 8, Math.PI / 2); }
        g.userData.head = head;
        return g;
      }

      // ---------- Scenery per age ----------
      const root = new T.Group(); scene.add(root);
      const envRoot = new T.Group(); scene.add(envRoot);
      let envAge = -1;
      function buildEnv(ageDef, ageIn) {
        const age = LOOK[ageIn];
        while (envRoot.children.length) envRoot.remove(envRoot.children[0]);
        const sky = document.createElement('canvas'); sky.width = 4; sky.height = 256;
        const sg = sky.getContext('2d'), gr = sg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, ageDef.sky[0]); gr.addColorStop(1, ageDef.sky[1]); sg.fillStyle = gr; sg.fillRect(0, 0, 4, 256);
        const st = new T.CanvasTexture(sky); if ('colorSpace' in st) st.colorSpace = T.SRGBColorSpace; scene.background = st;
        scene.fog.color.set(ageDef.sky[1]);
        // Ground and road texture per age: grass, churned mud in the world war, a glowing grid in the future.
        const gk = ageIn === 4 ? 'mud' : ageIn === 6 ? 'grid' : 'grass', rk = ageIn === 6 ? 'grid' : 'road';
        const ground = new T.Mesh(new T.PlaneGeometry(3000, 3000), new T.MeshLambertMaterial({ color: ageDef.ground, map: detailTex(gk, 3000 / 90, 3000 / 90), emissive: ageIn === 6 ? '#1a1650' : '#000000' })); ground.rotation.x = -Math.PI / 2; envRoot.add(ground);
        const road = new T.Mesh(new T.PlaneGeometry(150, L + 700), new T.MeshLambertMaterial({ color: ageDef.road, map: detailTex(rk, 1, (L + 700) / 150), emissive: ageIn === 6 ? '#2a1a6a' : '#000000' })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.3, Z0 - L / 2); envRoot.add(road);
        for (const x of [-78, 78]) { const e = new T.Mesh(new T.BoxGeometry(6, 2, L + 700), ageIn === 6 ? glowM('#7df9ff') : lam(age >= 3 ? '#9aa0a8' : '#8a7a5a')); e.position.set(x, 1, Z0 - L / 2); envRoot.add(e); }
        // Every age has its own scenery: model sets (KayKit) plus pieces built here.
        const ENV = [
          [['trees_A_medium', 30], ['tree_single_B', 42], ['rock_single_A', 90], ['trees_B_large', 26], ['rock_single_A', 70]],
          [['tree_single_A', 40], ['tent', 30], ['rock_single_A', 80], ['tree_single_A', 34], ['home_A', 30]],
          [['trees_A_large', 26], ['tower_A', 12], ['home_A', 34], ['archeryrange', 22], ['flag', 30]],
          [['windmill', 30], ['home_B', 34], ['trees_B_large', 26], ['weaponrack', 30], ['box_A', 34]],
          [['box_A', 30], ['tent', 28], ['dumpster', 30], ['weaponrack', 30], ['box_A', 24]],
          [['D', 30], ['streetlight', 40], ['H', 28], ['car_police', 36], ['watertower', 22]],
          [['basemodule_A', 26], ['lander_A', 26], ['structure_tall', 24], ['windturbine_tall', 22], ['roofmodule_solarpanels', 30]],
        ];
        const EXTRA = [
          (p, k) => { if (k % 6 === 0) { P(p, 'cone', lam('#4a3a32', { flatShading: true }), 60, 70, 60, 0, 35, -30); P(p, 'sph', glowM('#ff6a10'), 10, 4, 10, 0, 70, -30); }
            else if (k % 3 === 0) for (let q = 0; q < 4; q++) { const f = P(p, 'cone', lam('#3f8f3a', { flatShading: true }), 4, 22, 4, Math.sin(q * 1.6) * 6, 10, Math.cos(q * 1.6) * 6); f.rotation.set(Math.sin(q * 1.6) * 0.6, 0, Math.cos(q * 1.6) * 0.6); } }, // volcano, ferns
          (p, k) => { if (k % 3 === 0) { const mar = lam('#ece6d6'); P(p, 'box', mar, 30, 4, 12, 0, 2, 0); for (const x of [-10, 0, 10]) P(p, 'cyl', mar, 3, 16 + ((k + x) % 3) * 8, 3, x, 10, 0); }
            else if (k % 3 === 1) P(p, 'sph', lam('#b0603a'), 4, 6, 4, 8, 6, 6); },                                                        // ruined columns, amphora
          (p, k) => { if (k % 4 === 0) { const st = lam('#a8a29a'); P(p, 'box', st, 50, 16, 8, 0, 8, 0); for (let q = -2; q <= 2; q++) P(p, 'box', st, 6, 6, 9, q * 10, 19, 0); } },               // castle wall segments
          (p, k) => { if (k % 2 === 0) { for (let q = 0; q < 4; q++) P(p, 'box', lam('#8a5a2b'), 12, 1.2, 1.2, q * 12, 6, 0); for (let q = 0; q < 5; q++) P(p, 'box', lam('#6b4423'), 1.4, 9, 1.4, q * 12 - 6, 4.5, 0); }
            else P(p, 'cyl', lam('#d9b860'), 6, 7, 6, 0, 3.5, 12, 0, 0, Math.PI / 2); },                                                    // fences, hay bales
          (p, k) => { const cr = new T.Mesh(new T.CircleGeometry(16 + (k % 3) * 6, 18), new T.MeshBasicMaterial({ color: '#2a2018', transparent: true, opacity: 0.55, depthWrite: false })); cr.rotation.x = -Math.PI / 2; cr.position.set(0, 0.5, 20); p.add(cr);
            if (k % 2) for (let q = 0; q < 6; q++) P(p, 'sph', lam('#b8a070'), 4, 2.4, 3, q * 6 - 15, 1.5, -10);
            else { P(p, 'cyl', lam('#3a3028'), 1.4, 26, 1.4, 0, 13, 0, 0.2); for (let q = 0; q < 5; q++) P(p, 'torus', lam('#555'), 3, 3, 3, q * 5 - 10, 4, 8, Math.PI / 2); } }, // craters, sandbags, dead trees, wire
          (p, k) => { if (k % 2) for (let q = 0; q < 3; q++) P(p, 'box', lam('#c9ccd1'), 10, 6, 3, q * 11 - 11, 3, 0); },                                                     // concrete barriers
          (p, k) => { P(p, 'box', std('#2a2f6a', { metalness: 0.6 }), 4, 40, 4, 0, 20, 0); P(p, 'box', glowM(k % 2 ? '#39e0ff' : '#ff4df0'), 6, 3, 6, 0, 36, 0); P(p, 'cone', glowM('#7df9ff'), 5, 14, 5, 12, 7, 6); P(p, 'box', addM('#39e0ff'), 14, 10, 0.4, 0, 52, 0); }, // neon pylons, crystals, holograms
        ];
        if (KC) {
          const neutral = { c: '#3b82f6' };
          for (let k = 0; k < 34; k++) {
            const side = k % 2 ? 1 : -1, near = age === 3 && k % 5 === 1 || age === 3 && k % 5 === 3, x = side * (near ? 96 : 118 + (k * 37) % 150), z = Z0 + 140 - (k * 47) % (L + 560);
            const [name, sc] = ENV[ageIn][k % 5], p = new T.Group(); p.position.set(x, 0, z); envRoot.add(p);
            if (KC.models[name]) kc(p, neutral, name, sc * (0.85 + ((k * 13) % 7) / 20), 0, 0, age === 3 && near ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : (k * 1.7) % 6.28);
            const q = new T.Group(); q.position.set(x + side * 40, 0, z + 20); q.rotation.y = (k * 2.3) % 6.28; envRoot.add(q); EXTRA[ageIn](q, k);
          }
          envAge = ageIn;
          return;
        }
        for (let k = 0; k < 28; k++) {
          const side = k % 2 ? 1 : -1, x = side * (110 + (k * 37) % 150), z = Z0 + 120 - (k * 53) % (L + 500), p = new T.Group(); p.position.set(x, 0, z); envRoot.add(p);
          if (age === 0) { if (k % 3) { P(p, 'cyl', lam('#6e4424'), 3, 16, 3, 0, 8, 0); P(p, 'cone', lam('#2f8a43'), 14, 30, 14, 0, 28, 0); } else P(p, 'ico', lam('#8a8378', { flatShading: true }), 12, 9, 12, 0, 5, 0); }
          else if (age === 1) { P(p, 'cyl', lam('#6e4424'), 3, 16, 3, 0, 8, 0); P(p, 'ico', lam('#3f9e4a', { flatShading: true }), 14, 13, 14, 0, 26, 0); if (k % 4 === 0) P(p, 'box', lam('#d9c9a8'), 16, 12, 12, 16, 6, 0); }
          else if (age === 2) { if (k % 2) { for (let q = 0; q < 3; q++) P(p, 'box', lam('#8a5a2b'), 14, 1.2, 1.2, q * 14, 6, 0); } else P(p, 'cyl', lam('#b58a55'), 6, 10, 6, 0, 5, 0); }
          else if (age === 3) { P(p, 'box', lam('#b8a070'), 18, 6, 6, 0, 3, 0); if (k % 3 === 0) P(p, 'cyl', lam('#444'), 1, 30, 1, 0, 15, 0); }
          else { P(p, 'box', std('#3b3f9a'), 5, 34, 5, 0, 17, 0); P(p, 'box', glowM(k % 2 ? '#39e0ff' : '#ff4df0'), 6, 3, 6, 0, 30, 0); }
        }
        envAge = ageIn;
      }

      // Projectile looks: Kenney ammo for arrows, rocks and cannonballs; glowing tracers, beams and fire for the rest.
      const ARC = { stone: 18, boulder: 46, javelin: 22, bolt: 8, arrow: 14, ball: 30, shell: 44, rocket: 16, plasma: 10 };
      function shotMesh(sh) {
        const g = new T.Group(), k = sh.kind;
        if (EXT && (k === 'bolt' || k === 'arrow')) ex(g, 'weapon-ammo-arrow', 15, 0, 0, -6, 0).rotation.x = 0;
        else if (EXT && (k === 'boulder' || k === 'stone')) ex(g, 'weapon-ammo-boulder', k === 'boulder' ? 30 : 13, 0, -3, 0);
        else if (EXT && k === 'ball') ex(g, 'weapon-ammo-cannonball', 16, 0, -2, 0);
        else if (k === 'javelin') { P(g, 'cyl', lam('#8a5a2b'), 0.45, 16, 0.45, 0, 0, 0, Math.PI / 2); P(g, 'cone', std('#c8ccd4'), 0.9, 2.6, 0.9, 0, 0, 9, Math.PI / 2); }
        else if (k === 'bullet') P(g, 'box', addM('#ffd23f'), 0.9, 0.9, 9, 0, 0, 0);
        else if (k === 'laser') P(g, 'box', addM(sh.side === 0 ? '#7df9ff' : '#ff6b9a'), 1.4, 1.4, 18, 0, 0, 0);
        else if (k === 'plasma') { P(g, 'sph', addM('#c79bff'), 4.5, 4.5, 4.5, 0, 0, 0); P(g, 'sph', glowM('#ffffff'), 2, 2, 2, 0, 0, 0); }
        else if (k === 'flame') { P(g, 'sph', addM('#ff7a1a'), 0.5, 0.5, 0.5, 0, 0, 0); P(g, 'sph', addM('#ffd23f'), 0.28, 0.28, 0.28, 0, 0, 0.2); }
        else if (k === 'rocket') { P(g, 'cyl', lam('#d9d9d9'), 1.2, 9, 1.2, 0, 0, 0, Math.PI / 2); P(g, 'cone', lam('#c0392b'), 1.2, 3, 1.2, 0, 0, 6, Math.PI / 2); P(g, 'sph', addM('#ffa53a'), 2.4, 2.4, 4, 0, 0, -6); }
        else if (k === 'shell') { P(g, 'cyl', std('#3a3a30'), 2, 5, 2, 0, 0, 0, Math.PI / 2); P(g, 'cone', std('#3a3a30'), 2, 3, 2, 0, 0, 4, Math.PI / 2); }
        else P(g, 'sph', std('#222', { metalness: 0.8 }), 4, 4, 4, 0, 0, 0);
        return g;
      }

      // ---------- State of the scene ----------
      const thumbs = {}; let thumbR = null, thumbS = null, thumbC = null;
      const unitM = new Map(), shotM = new Map(), fxM = new Map(), bases = [null, null], baseAge = [-1, -1], turrets = [[], []];
      const v3 = new T.Vector3();
      let W = 1, H = 1, camBase = new T.Vector3();
      const zOf = p => Z0 - p;
      const BASE_Z = [Z0 + 46, Z0 - L - 46];

      const R = {
        is3D: true,
        fit(top, bottom) {
          W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
          renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
          const pts = [[-80, 0, BASE_Z[0] + 30], [80, 0, BASE_Z[0] + 30], [-80, 90, BASE_Z[1] - 20], [80, 90, BASE_Z[1] - 20]].map(a => new T.Vector3(...a));
          const pitch = 42 * Math.PI / 180, target = new T.Vector3(0, 0, Z0 - L / 2);
          let d = 900;
          for (let it = 0; it < 30; it++) {
            camera.position.set(0, target.y + Math.sin(pitch) * d, target.z + Math.cos(pitch) * d); camera.lookAt(target); camera.updateMatrixWorld();
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const p of pts) { v3.copy(p).project(camera); const sx = (v3.x + 1) / 2 * W, sy = (1 - v3.y) / 2 * H; minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy); }
            d *= Math.pow(Math.max((maxX - minX) / (W * 0.98), (maxY - minY) / Math.max(100, bottom - top)), 0.85);
            target.z += ((minY + maxY) / 2 - (top + bottom) / 2) * (L / Math.max(1, maxY - minY)) * 0.5;
          }
          camBase.copy(camera.position);
        },
        project(p, lx, h) { v3.set((lx || 0) * XS, h || 0, zOf(p)).project(camera); return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H }; },
        projectBase(side, h) { v3.set(0, h || 0, BASE_Z[side]).project(camera); return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H }; },
        render(S, dt, info) {
          const time = performance.now() / 1000;
          // Adaptive resolution: slow phones (frames > 30 ms for a few seconds) drop the pixel ratio step by step.
          if (dt > 0) { perfAcc += dt; perfN++; if (perfAcc > 2.5) { const avg = perfAcc / perfN; perfAcc = 0; perfN = 0;
            if (avg > 0.0178 && pr > 1) { /* under ~56 fps (was 33) */ pr = Math.max(1, pr - 0.25); renderer.setPixelRatio(pr); renderer.setSize(W, H, false); } } }
          if (envAge !== S.side[0].age) buildEnv(info.ages[S.side[0].age], S.side[0].age);
          // Bases + turrets.
          for (let s = 0; s < 2; s++) {
            const sd = S.side[s];
            if (baseAge[s] !== sd.age) {
              if (bases[s]) root.remove(bases[s]);
              const evolved = baseAge[s] >= 0 && sd.age > baseAge[s];
              bases[s] = base(sd.age, s, info.team[s]); bases[s].position.z = BASE_Z[s]; root.add(bases[s]); baseAge[s] = sd.age;
              if (F3 && evolved) { const bz = BASE_Z[s], c = info.team[s].c; F3.spiral(0, bz, c, 6, 22, 50, '#ffffff'); F3.ring(0, 4, bz, '#ffd23f', 8, 50, c); F3.star(0, 60, bz, '#fff3b0', 18, 0.6); F3.confetti(0, 40, bz, 40, 8); }
            }
            if (bases[s].userData.cloth) bases[s].userData.cloth.rotation.y = Math.sin(time * 3 + s) * 0.3;
            // V3: a falling base goes up in a chain of blasts; an age-up (evolve) is celebrated with a pillar of light.
            if (F3 && sd.hp <= 0 && !bases[s].userData.fell) { bases[s].userData.fell = true; const bz = BASE_Z[s]; for (let k = 0; k < 4; k++) F3.explosion(rr(-40, 40), rr(20, 60), bz + rr(-20, 20), rr(22, 34), { n: 20, rocks: 10, scorch: false, shake: 0, rockCol: '#4a3a2a' }); F3.ring(0, 6, bz, '#ffd23f', 9, 60, '#ffffff'); F3.star(0, 50, bz, '#ffffff', 20, 0.6); }
            const hurt = 1 - Math.max(0, sd.hp / sd.max);
            bases[s].position.x = hurt > 0.7 ? Math.sin(time * 40) * 0.6 : 0;
            sd.slots.forEach((d, i) => {
              const key = d ? d.kind + d.age : '';
              if (!turrets[s][i] || turrets[s][i].key !== key) {
                if (turrets[s][i]) root.remove(turrets[s][i].g);
                turrets[s][i] = d ? { key, g: turret(d.kind, d.age, info.team[s]) } : { key: '' , g: new T.Group() };
                // Slots sit on top of (or just in front of) each age's base; a post underneath keeps them grounded.
                const g = turrets[s][i].g, top = (KC ? [44, 62, 58, 52, 42] : [52, 58, 40, 40, 30])[LOOK[sd.age]], front = [14, 8, 4, 12, 26][LOOK[sd.age]];
                // Ground towers stand beside the gate (left, right, outer left), never on the troops' way out.
                if (g.userData.ground) g.position.set([-92, 92, -132][i] * (s === 0 ? -1 : 1), 0, BASE_Z[s] + (s === 0 ? -1 : 1) * (front + [30, 30, 10][i]));
                else g.position.set(info.slotX[i] * 0.6 * XS * (s === 0 ? -1 : 1), top, BASE_Z[s] + (s === 0 ? -front : front));
                g.rotation.y = s === 0 ? Math.PI : 0; root.add(g);
                if (d && !g.userData.ground) P(g, 'cyl', lam('#4a4038'), 3, top, 3, 0, -top / 2, 0);
              }
              const g = turrets[s][i].g;
              if (g.userData.ring) { g.userData.ring.rotation.y = time * 1.5; g.userData.ring.position.y = 12 + Math.sin(time * 2 + i) * 1.5; }
              if (g.userData.dish) g.userData.dish.rotation.y = time * 1.2;
              if (d && g.userData.head) {
                if (g.userData.ext) {
                  let best = null; for (const u of S.units) if (!u.dead && u.side !== s && (!best || Math.abs(u.p - (s ? L : 0)) < Math.abs(best.p - (s ? L : 0)))) best = u;
                  const yaw = best ? Math.atan2(best.lx * XS - g.position.x, zOf(best.p) - g.position.z) : (s === 0 ? Math.PI : 0);
                  g.userData.head.rotation.y = yaw - g.rotation.y;
                  const kick = d.cd > (d.kind === 'heavy' ? 2.2 : 0.42) ? 1 : 0; g.userData.head.position.z = -kick * 1.6;
                } else g.userData.head.rotation.x = d.cd > (d.kind === 'heavy' ? 2.2 : 0.4) ? -0.25 : 0;
              }
            });
          }
          // Units.
          const seen = new Set();
          for (const u of S.units) {
            seen.add(u);
            let m = unitM.get(u);
            if (!m) { m = makeUnit(u, info.team[u.side], GEAR[info.gear]); unitM.set(u, m); }
            const walk = Math.sin(u.walk * 1.6), bob = Math.abs(walk) * 1.2;
            m.g.position.set(u.lx * XS, bob * (u.type === 2 ? 0.3 : 1), zOf(u.p));
            if (m.ku) { const k = u.swing > 0.05 ? 3 : Math.floor((((u.walk * 0.33) % 1) + 1) % 1 * 3); if (m.k !== k) { m.k = k; m.mesh.geometry = m.frames[k]; if (m.mesh.userData.ol) m.mesh.userData.ol.geometry = m.frames[k]; } }
            if (m.ext) { m.body.rotation.z = walk * 0.07; m.body.rotation.x = u.swing ? 0.25 : 0; m.body.position.y = bob * 0.8; }
            if (m.legL) { m.legL.rotation.x = walk * 0.6; m.legR.rotation.x = -walk * 0.6; }
            if (m.legs) m.legs.forEach((l, k) => { l.rotation.x = walk * 0.4 * (k % 2 ? 1 : -1); });
            if (m.arm) m.arm.rotation.x = u.swing ? -1.4 + (0.25 - u.swing) * 5 : 0.2;
            const k = u.hit ? 1.12 : 1; m.g.scale.setScalar((u.type === 2 ? 1 : 1.25) * k);
            if (m.flag) m.flag.rotation.y = Math.PI / 2 + Math.sin(time * 4 + u.p * 0.05) * 0.35;
            if (m.cape) m.cape.rotation.x = 0.12 + Math.abs(walk) * 0.25;
            if (m.crown) m.crown.rotation.y = time * 1.2;
            const pw = u.side === 0 && S.powerT > 0;
            if (pw && !m.pw) { m.pw = new T.Mesh(auraGeo, powerMat); m.pw.rotation.x = -Math.PI / 2; m.pw.position.y = 1.2; m.pw.scale.setScalar(u.type === 2 ? 2.2 : 1.3); m.g.add(m.pw); }
            if (m.pw) { m.pw.visible = pw; if (pw) m.pw.rotation.z = -time * 3; }
            if (m.aura) { m.aura.material.opacity = 0.45 + 0.25 * Math.sin(time * 4 + u.p * 0.03); m.aura.rotation.z = time; }
          }
          if (S.powerT > 0) powerMat.opacity = 0.55 + 0.35 * Math.sin(time * 9);
          // V3: a fallen unit leaves a puff of team-coloured sparks and a little star where it stood.
          for (const [u, m] of unitM) if (!seen.has(u)) { if (F3 && u.hp <= 0) { const p = m.g.position, c = info.team[u.side].c; F3.ring(p.x, 6, p.z, c, u.type === 2 ? 1.6 : 0.9, u.type === 2 ? 18 : 10, '#ffffff'); F3.star(p.x, 12, p.z, c, u.type === 2 ? 5 : 3, 0.25); } root.remove(m.g); unitM.delete(u); }
          // Projectiles.
          const seenS = new Set();
          for (const sh of S.shots) {
            seenS.add(sh);
            let m = shotM.get(sh);
            const isNew = !m;
            if (!m) { m = shotMesh(sh); root.add(m); shotM.set(sh, m); }
            const k = Math.min(1, sh.t / sh.dur), tx = sh.to ? sh.to.lx * XS : 0, tp = sh.to ? sh.to.p : sh.base === 1 ? L + 30 : -30;
            // Tower shots leave from the turret's head, unit shots from the unit.
            const tg = sh.tower && turrets[sh.side][sh.slot] && turrets[sh.side][sh.slot].g;
            const fx = tg ? tg.position.x : (sh.fx - 200) * XS;
            const z0 = tg ? tg.position.z : zOf(sh.from), z1 = zOf(tp);
            const y0 = tg ? (tg.userData.head ? tg.userData.head.position.y + 8 : 56) : 12, arc = ARC[sh.kind] || 4;
            m.position.set(fx + (tx - fx) * k, y0 + (12 - y0) * k + Math.sin(k * Math.PI) * arc, z0 + (z1 - z0) * k);
            m.lookAt(tx, 12, z1);
            // Muzzle flash where a gun fires, then a trail that fits the projectile.
            const kd = sh.kind, px = m.position.x, py = m.position.y, pz = m.position.z;
            if (isNew && (kd === 'ball' || kd === 'shell' || kd === 'bullet' || kd === 'rocket')) { for (let q = 0; q < (kd === 'bullet' ? 4 : 12); q++) emit(sparks, px, py, pz, rr(-30, 30), rr(0, 30), rr(-30, 30), rr(0.1, 0.25), q % 2 ? '#ffd23f' : '#ff8a2a'); if (kd !== 'bullet') for (let q = 0; q < 5; q++) emit(smoke, px, py, pz, rr(-12, 12), rr(8, 20), rr(-12, 12), rr(0.6, 1.1), '#8a847c'); }
            if (Math.random() < 0.7) {
              if (kd === 'rocket') { emit(smoke, px, py, pz, rr(-4, 4), rr(2, 8), rr(-4, 4), rr(0.6, 1), '#9a948c'); emit(sparks, px, py, pz, 0, 0, 0, 0.18, '#ffa53a'); }
              else if (kd === 'shell' || kd === 'ball') emit(smoke, px, py, pz, rr(-3, 3), rr(2, 6), rr(-3, 3), rr(0.4, 0.7), '#b0a898');
              else if (kd === 'boulder' || kd === 'stone') emit(smoke, px, py, pz, rr(-3, 3), rr(-2, 4), rr(-3, 3), rr(0.3, 0.5), '#b8a888');
              else if (kd === 'plasma') emit(sparks, px, py, pz, rr(-10, 10), rr(-10, 10), rr(-10, 10), rr(0.2, 0.4), '#c79bff');
              else if (kd === 'laser') emit(sparks, px, py, pz, 0, 0, 0, 0.15, sh.side === 0 ? '#7df9ff' : '#ff6b9a');
              else if (kd === 'bolt' || kd === 'arrow' || kd === 'javelin') emit(sparks, px, py, pz, 0, 0, 0, 0.12, '#fff3c0');
              else if (kd === 'flame') { emit(sparks, px, py, pz, rr(-10, 10), rr(5, 20), rr(-10, 10), rr(0.2, 0.4), Math.random() < 0.5 ? '#ff7a1a' : '#ffd23f'); }
            }
            if (sh.t + 0.02 >= sh.dur && !sh._hit) { sh._hit = true; impact(kd, tx, z1, sh.splash > 0 || kd === 'boulder'); }
            if (sh.kind === 'boulder' || sh.kind === 'stone') m.rotateX(sh.t * 12);
            if (sh.kind === 'flame') m.scale.setScalar(4 + k * 9);
          }
          for (const [sh, m] of shotM) if (!seenS.has(sh)) { root.remove(m); shotM.delete(sh); }
          // Special drops + explosions.
          const seenF = new Set();
          for (const f of S.fx) {
            if (f.kind === 'flash') continue;
            seenF.add(f);
            let m = fxM.get(f);
            if (!m) {
              m = new T.Group(); root.add(m); fxM.set(f, m);
              if (f.kind === 'drop') {
                // What falls depends on the age: burning rocks, fire pots, arrows, cannonballs, bombs, missiles.
                if (f.arrow) { m.userData.obj = new T.Group(); m.add(m.userData.obj); P(m.userData.obj, 'cyl', lam('#6b4423'), 0.5, 12, 0.5, 0, 0, 0); P(m.userData.obj, 'cone', std('#c8ccd4'), 1, 3, 1, 0, -7, 0, Math.PI); m.userData.trail = P(m, 'cone', addM('#fff3c0'), 0.8, 10, 0.8, 0, 10, 0); }
                else if (f.missile) { m.userData.obj = new T.Group(); m.add(m.userData.obj); P(m.userData.obj, 'cyl', lam('#e8e8e8'), 2.4, 16, 2.4, 0, 0, 0); P(m.userData.obj, 'cone', lam('#c0392b'), 2.4, 5, 2.4, 0, -10, 0, Math.PI); m.userData.trail = P(m, 'cone', addM('#ffa53a'), 4, 30, 4, 0, 24, 0); }
                else if (f.bomb) { m.userData.obj = P(m, 'cap', std('#3a4030'), 2.6, 4, 2.6, 0, 0, 0); m.userData.trail = P(m, 'cone', addM('#ffffff'), 0.1, 0.1, 0.1, 0, 0, 0); }
                else m.userData.obj = P(m, 'ico', f.age === 0 ? lam('#5a4a3a', { flatShading: true, emissive: '#3a1400' }) : f.age === 1 ? lam('#b0603a', { emissive: '#ff4a00', emissiveIntensity: 0.4 }) : std('#2b2d33'), f.big ? 10 : 6, f.big ? 10 : 6, f.big ? 10 : 6, 0, 0, 0);
                if (!m.userData.trail) m.userData.trail = P(m, 'cone', addM(f.age <= 1 ? '#ff9a3c' : '#d8d0c0'), f.big ? 8 : 5, f.big ? 40 : 24, f.big ? 8 : 5, 0, 14, 0);
              }
              if (f.kind === 'beam') { m.userData.beam = P(m, 'cyl', addM('#7df9ff'), 9, 800, 9, 0, 400, 0); m.userData.core = P(m, 'cyl', glowM('#ffffff'), 3, 800, 3, 0, 400, 0); }
              if (f.kind === 'burn') m.userData.burn = true;
              if (f.kind === 'plane') { const pl = new T.Group(); m.add(pl); m.userData.plane = pl; const body = std('#5f6f4c', { metalness: 0.3 });
                P(pl, 'cap', body, 6, 30, 6, 0, 0, 0, Math.PI / 2); P(pl, 'box', body, 90, 2, 16, 0, 0, -2); P(pl, 'box', body, 34, 2, 9, 0, 1, 24); P(pl, 'box', body, 2, 12, 10, 0, 7, 25);
                for (const sx of [-1, 1]) P(pl, 'cyl', std('#a9b3a0'), 3.4, 12, 3.4, sx * 22, -2, -6, Math.PI / 2); }
              m.userData.boom = P(m, 'sph', new T.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, blending: T.AdditiveBlending, depthWrite: false }), 1, 1, 1, 0, 0, 0); m.userData.boom.visible = false;
            }
            const x = ((f.x || 200) - 200) * XS, z = zOf(f.p || 0);
            m.position.set(x, 0, z);
            if (f.kind === 'beam') { m.position.set(0, 0, z); m.userData.beam.scale.x = m.userData.beam.scale.z = 9 + Math.sin(time * 30) * 2; for (let q = 0; q < 4; q++) emit(sparks, rr(-70, 70), 2, z + rr(-10, 10), rr(-20, 20), rr(30, 90), rr(-20, 20), rr(0.3, 0.6), q % 2 ? '#7df9ff' : '#ffffff'); continue; }
            if (f.kind === 'burn') { if (Math.random() < 0.8) emit(sparks, x + rr(-26, 26), 2, z + rr(-26, 26), rr(-6, 6), rr(20, 45), rr(-6, 6), rr(0.4, 0.8), Math.random() < 0.5 ? '#ff6a10' : '#ffd23f'); if (Math.random() < 0.2) emit(smoke, x + rr(-20, 20), 8, z + rr(-20, 20), 0, 18, 0, 1.2, '#4a3a30'); continue; }
            if (f.kind === 'plane') { const k = 1 - f.t / f.max, pz = f.side === 0 ? Z0 + 120 - k * (L + 300) : Z0 - L - 120 + k * (L + 300); m.position.set(0, 120, pz); m.userData.plane.rotation.y = f.side === 0 ? Math.PI : 0; continue; }
            if (f.kind === 'drop') {
              const falling = f.t > 0;
              m.userData.obj.visible = m.userData.trail.visible = falling;
              if (falling) { m.userData.obj.position.y = f.t * 380 + 6; m.userData.trail.position.y = f.t * 380 + 22; }
              const b = m.userData.boom; b.visible = !falling && f.boom > 0 && !f.arrow;
              if (b.visible) { const u = 1 - f.boom / 0.4, s2 = (f.missile ? 34 : f.big ? 24 : 16) * (0.4 + u); b.scale.setScalar(s2); b.position.y = s2 * 0.5; b.material.opacity = Math.max(0, 1 - u); }
              if (!falling && !m.userData.hit) { m.userData.hit = true; impact(f.arrow ? 'arrow' : f.age >= 6 ? 'plasma' : f.age <= 1 ? 'boulder' : 'shell', x, z, f.big || f.missile); }
              if (falling && Math.random() < 0.6 && !f.arrow) emit(f.age <= 1 ? sparks : smoke, x + rr(-3, 3), f.t * 380 + 20, z + rr(-3, 3), 0, 10, 0, 0.5, f.age <= 1 ? '#ff8a2a' : '#9a948c');
            } else if (m.userData.boom) { const b = m.userData.boom; b.visible = f.kind === 'boomAt'; const u = 1 - f.t / 0.35, s2 = 18 * (0.4 + u); b.scale.setScalar(s2); b.position.y = s2 * 0.5; b.position.x = 0; b.material.opacity = Math.max(0, 1 - u); }
          }
          for (const [f, m] of fxM) if (!seenF.has(f)) { root.remove(m); fxM.delete(f); }
          stepCloud(sparks, dt); stepCloud(smoke, dt); if (F3) F3.update(dt);
          for (let i = scorches.length - 1; i >= 0; i--) { const o = scorches[i]; o.life -= dt; o.m.material.opacity = Math.min(1, o.life / 2); if (o.life <= 0) { root.remove(o.m); /* material kept: shader stays compiled */ scorches.splice(i, 1); } }
          camera.position.copy(camBase);
          if (S.shake) camera.position.add(v3.set((Math.random() - 0.5) * S.shake * 2, (Math.random() - 0.5) * S.shake * 2, 0));
          renderer.render(scene, camera);
        },
        // Icon of a unit ('u', age, type) or defense ('d', age, kind) rendered from the real model; null until its
        // textures have loaded (the game shows an emoji meanwhile).
        thumb(what, age, type, team, gear) {
          const key = what + age + type + team.c + (gear || '');
          if (thumbs[key]) return thumbs[key];
          if (!thumbR) { try { thumbR = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); thumbR.setSize(112, 112, false); if ('outputColorSpace' in thumbR) thumbR.outputColorSpace = T.SRGBColorSpace; thumbS = new T.Scene(); thumbS.add(new T.HemisphereLight(0xffffff, 0x666655, 2.2)); const d = new T.DirectionalLight(0xffffff, 1.6); d.position.set(-1, 2, 2); thumbS.add(d); thumbC = new T.PerspectiveCamera(30, 1, 1, 2000); } catch (e) { thumbR = false; } }
          if (!thumbR) return null;
          const m = what === 'u' ? (type === 2 ? heavy(age, team) : humanoid(age, type, team)) : null, o = m ? m.g : turret(type, age, team);
          if (m && gear) { dress(m, GEAR[gear], type === 2); if (m.flag) m.flag.rotation.y = Math.PI / 2 + 0.3; }
          let ready = true;
          o.traverse(c => { if (c.userData.deco) c.visible = false; const mt = c.material; if (mt && mt.map && !(mt.map.image && (mt.map.image.width || mt.map.image.complete))) ready = false; });
          if (!ready) return null;
          if (o.userData.head) o.userData.head.rotation.y = 0;
          o.rotation.y = what === 'u' ? 0.5 : 0.6; thumbS.add(o); o.updateMatrixWorld(true);
          const box = new T.Box3().setFromObject(o), c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3()), r = Math.max(sz.x, sz.y, sz.z) * 0.62;
          thumbC.position.set(c.x, c.y + r * 0.9, c.z + r * 3.1); thumbC.lookAt(c); thumbC.updateProjectionMatrix();
          thumbR.render(thumbS, thumbC);
          thumbS.remove(o);
          return (thumbs[key] = thumbR.domElement.toDataURL('image/png'));
        },
        reset() {
          for (const [, m] of unitM) root.remove(m.g); unitM.clear();
          for (const [, m] of shotM) root.remove(m); shotM.clear();
          for (const [, m] of fxM) root.remove(m); fxM.clear();
          for (let s = 0; s < 2; s++) { if (bases[s]) root.remove(bases[s]); bases[s] = null; baseAge[s] = -1; turrets[s].forEach(t => t && root.remove(t.g)); turrets[s] = []; }
          envAge = -1;
        },
      };
      return R;
    },
  };
})();
