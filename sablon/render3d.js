// TEMPLATE 3D renderer (Three.js). Game logic lives in game.js on a flat (x, z) plane; this file only draws it.
// Look shared with the other games: toon shading + ink outline, soft shadows, textured ground, blob shadows.
// Tmpl3D.init() returns null without WebGL; game.js then runs headless (tests/sim.js relies on that).
(function () {
  'use strict';
  if (!window.THREE) return;
  const T = window.THREE;

  // 3-step toon ramp (same values as Arrow Legends: bright, readable on small screens).
  const ramp = (() => {
    const d = new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 255, 255, 255, 255]);
    const t = new T.DataTexture(d, 3, 1, T.RGBAFormat); t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true; return t;
  })();
  const toon = color => new T.MeshToonMaterial({ color, gradientMap: ramp });
  // Ink outline: back faces pushed out along the normal.
  const inkMat = new T.MeshBasicMaterial({ color: 0x1c120a, side: T.BackSide });
  function outlined(geo, color, k = 1.08) {
    const g = new T.Group(), m = new T.Mesh(geo, toon(color)), o = new T.Mesh(geo, inkMat);
    m.castShadow = true; o.scale.setScalar(k); g.add(o, m); return g;
  }
  // Procedural ground texture: noise + soft blotches, tiles without visible repeats at this scale.
  function groundTex(base) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0,' : '255,255,255,') + Math.random() * 0.12 + ')'; g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2); }
    for (let k = 0; k < 14; k++) { const x = Math.random() * 256, y = Math.random() * 256, r = 20 + Math.random() * 40, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(6, 6); if ('colorSpace' in t) t.colorSpace = T.SRGBColorSpace; return t;
  }
  const blobTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
  })();
  const blob = r => { const m = new T.Mesh(new T.PlaneGeometry(r * 2.4, r * 2.4), new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.02; return m; };

  window.Tmpl3D = {
    init(canvas) {
      let renderer;
      try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
      if (!renderer.getContext()) return null;
      renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;

      const scene = new T.Scene();
      scene.background = new T.Color(0x7ec8ff); scene.fog = new T.Fog(0x7ec8ff, 60, 140);
      const camera = new T.PerspectiveCamera(46, 1, 0.5, 400);
      scene.add(new T.HemisphereLight(0xffffff, 0x6b7a99, 1.1));
      const sun = new T.DirectionalLight(0xfff0d8, 2.4);
      sun.position.set(-12, 30, 14); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 80 }); sun.shadow.bias = -0.0015;
      scene.add(sun);

      const ground = new T.Mesh(new T.PlaneGeometry(60, 60), new T.MeshLambertMaterial({ map: groundTex('#6fbf4a') }));
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

      // Player: capsule body + head, outlined. Replace with a baked KayKit/Quaternius character (see arrow-legends).
      const player = new T.Group();
      const body = outlined(new T.CapsuleGeometry(0.7, 0.9, 4, 12), 0x3b82f6); body.position.y = 1.15;
      const head = outlined(new T.SphereGeometry(0.55, 16, 12), 0xffd7a8); head.position.y = 2.35;
      player.add(blob(0.8), body, head); scene.add(player);

      const coinGeo = new T.CylinderGeometry(0.55, 0.55, 0.16, 20);
      const coinMat = new T.MeshToonMaterial({ color: 0xffcf3f, gradientMap: ramp, emissive: 0x6a4a00 });
      const coins = new Map(); // game coin object -> mesh

      function fit() {
        const w = innerWidth, h = innerHeight;
        renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      }
      addEventListener('resize', fit); fit();
      const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), v = new T.Vector3();

      let time = 0;
      return {
        fit,
        // Screen point -> ground (x, z).
        pick(cx, cy) {
          ray.setFromCamera({ x: cx / innerWidth * 2 - 1, y: -(cy / innerHeight) * 2 + 1 }, camera);
          return ray.ray.intersectPlane(plane, v) ? { x: v.x, z: v.z } : null;
        },
        render(S, dt, opt) {
          time += dt;
          if (opt && opt.color) body.children[1].material.color.set(opt.color); // equipped skin
          const p = S ? S.p : { x: 0, z: 0, moving: false };
          player.position.set(p.x, 0, p.z);
          // Simple procedural animation: bob + squash while moving, breathe while idle.
          const k = p.moving ? Math.sin(time * 14) : Math.sin(time * 3) * 0.3;
          body.scale.set(1 - k * 0.04, 1 + k * 0.05, 1 - k * 0.04); head.position.y = 2.35 + k * 0.08;
          if (p.moving) player.rotation.y = Math.atan2(p.vx, p.vz);
          // Sync coins (create / remove / spin).
          const live = new Set(S ? S.coins : []);
          for (const [c, m] of coins) if (!live.has(c)) { scene.remove(m); coins.delete(c); }
          for (const c of live) {
            let m = coins.get(c);
            if (!m) { m = new T.Group(); const d = new T.Mesh(coinGeo, coinMat); d.rotation.x = Math.PI / 2; d.castShadow = true; m.add(d, blob(0.5)); m.children[1].position.y = -0.9; scene.add(m); coins.set(c, m); }
            m.position.set(c.x, 1 + Math.sin(time * 3 + c.x) * 0.2, c.z); m.rotation.y = time * 3;
          }
          camera.position.set(p.x, 26, p.z + 19); camera.lookAt(p.x, 0, p.z + 1);
          renderer.render(scene, camera);
        },
      };
    },
  };
})();
