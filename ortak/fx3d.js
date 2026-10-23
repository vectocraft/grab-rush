// Fx3D — shared, pooled 3D effects for the Three.js games (Arrow Legends, Sürü Seli). No post-processing: every glow is
// an additive quad with a pre-baked texture, so a phone pays for a few draw calls and some overdraw, never a bloom pass.
//
//   const fx = Fx3D.create(scene, { unit: 1 });   // unit = world size of "about a hand" (Arrow 1, Sürü Seli ~12)
//   fx.update(dt, camera)                          // once per frame, before renderer.render
//
// Parts (each a single draw call, sized once at creation, nothing allocated per effect):
//   • glow particles — GPU-animated (position from start + velocity, gravity, drag, size/alpha over life), so emitting
//     only writes a few floats and moving them costs no JavaScript. Sparks stretch along their screen-space velocity.
//   • rock chunks    — small lit solids that tumble and fall (stone debris).
//   • floor decals   — cracks and scorch marks that fade out.
//   • lightning      — jagged camera-facing ribbons that re-jitter while they live (two-colour gradient, white core).
//   • shake          — camera trauma: fx.shake(k), then fx.shakeOffset() gives an offset to add to the camera.
// V2 presets: ring (flat spark ring), star (big flare), frost (ice burst + ice chunks), heal (rising spiral), charge
// (motes rushing in: spell wind-up), spiral (rising helix), flake (one slow falling flake for elemental trails).
// High-level presets (muzzle, impact, trail, explosion, chain, crack, ...) build on those.
(function () {
  'use strict';
  if (!window.THREE) return;
  const T = window.THREE, TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  // Parsed colours are cached: emitters pass the same few strings hundreds of times a second.
  const CC = new Map();
  const col = v => { if (typeof v !== 'string') return v; let c = CC.get(v); if (!c) { c = new T.Color(v); CC.set(v, c); } return c; };

  // ---------- Pre-baked textures (shared by every system) ----------
  let ATLAS = null, DECALS = null, RUNE = null;
  function canvas(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.needsUpdate = true; return t;
  }
  // Glow atlas, 4 cells of 64 px: 0 soft glow, 1 star flare, 2 hot spark, 3 soft smoke blob.
  function atlas() {
    if (ATLAS) return ATLAS;
    ATLAS = canvas(256, 64, g => {
      const rad = (cx, stops) => { const r = g.createRadialGradient(cx, 32, 0, cx, 32, 31); stops.forEach(s => r.addColorStop(s[0], s[1])); g.fillStyle = r; g.fillRect(cx - 32, 0, 64, 64); };
      rad(32, [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,.75)'], [0.5, 'rgba(255,255,255,.22)'], [1, 'rgba(255,255,255,0)']]);
      // Star: thin rays + a halo.
      g.save(); g.beginPath(); g.rect(64, 0, 64, 64); g.clip();
      rad(96, [[0, 'rgba(255,255,255,1)'], [0.15, 'rgba(255,255,255,.7)'], [0.45, 'rgba(255,255,255,.12)'], [1, 'rgba(255,255,255,0)']]);
      g.translate(96, 32);
      for (let k = 0; k < 8; k++) {
        const long = k % 2 === 0, L = long ? 31 : 18, w = long ? 2.6 : 1.6;
        const gr = g.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(0, -w); g.lineTo(L, 0); g.lineTo(0, w); g.fill(); g.rotate(Math.PI / 4);
      }
      g.restore();
      rad(160, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.9)'], [0.6, 'rgba(255,255,255,.25)'], [1, 'rgba(255,255,255,0)']]);
      // Smoke blob: a few soft lumps.
      g.save(); g.beginPath(); g.rect(192, 0, 64, 64); g.clip();
      for (let k = 0; k < 7; k++) {
        const x = 224 + Math.cos(k * 2.4) * 10, y = 32 + Math.sin(k * 2.4) * 10, r = g.createRadialGradient(x, y, 0, x, y, 20);
        r.addColorStop(0, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(192, 0, 64, 64);
      }
      g.restore();
    });
    return ATLAS;
  }
  // Decal atlas, 2 cells of 128 px: 0 cracked stone, 1 scorch mark.
  function decals() {
    if (DECALS) return DECALS;
    DECALS = canvas(256, 128, g => {
      g.translate(64, 64);
      const r = g.createRadialGradient(0, 0, 0, 0, 0, 30); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(-64, -64, 128, 128);
      g.strokeStyle = 'rgba(8,6,10,.95)'; g.lineCap = 'round'; g.lineJoin = 'round';
      const branch = (x, y, a, len, w, depth) => {
        g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
        const n = 4;
        for (let k = 0; k < n; k++) { a += rnd(-0.5, 0.5); x += Math.cos(a) * len / n; y += Math.sin(a) * len / n; g.lineTo(x, y); if (depth && Math.random() < 0.45) { g.stroke(); branch(x, y, a + rnd(-1.2, 1.2), len * 0.45, w * 0.6, depth - 1); g.lineWidth = w; g.beginPath(); g.moveTo(x, y); } }
        g.stroke();
      };
      for (let k = 0; k < 7; k++) branch(rnd(-3, 3), rnd(-3, 3), k / 7 * TAU + rnd(-0.3, 0.3), rnd(34, 58), rnd(2.6, 4), 2);
      g.translate(128, 0);
      const s = g.createRadialGradient(0, 0, 0, 0, 0, 62); s.addColorStop(0, 'rgba(10,6,4,.85)'); s.addColorStop(0.45, 'rgba(20,12,8,.55)'); s.addColorStop(1, 'rgba(20,12,8,0)'); g.fillStyle = s; g.fillRect(-64, -64, 128, 128);
      for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(0,0,0,' + rnd(0.1, 0.35) + ')'; g.beginPath(); g.arc(rnd(-40, 40), rnd(-40, 40), rnd(2, 7), 0, TAU); g.fill(); }
    });
    return DECALS;
  }
  // A rune circle (white on transparent) for floor glyphs and the hero aura.
  function rune() {
    if (RUNE) return RUNE;
    RUNE = canvas(128, 128, g => {
      g.translate(64, 64); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round';
      g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 58, 0, TAU); g.stroke();
      g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, 50, 0, TAU); g.stroke();
      g.lineWidth = 2.2;
      for (let k = 0; k < 12; k++) {
        g.save(); g.rotate(k / 12 * TAU); g.translate(0, -54);
        const v = k % 4; g.beginPath();
        if (v === 0) { g.moveTo(-2.5, -2.5); g.lineTo(2.5, 2.5); g.moveTo(2.5, -2.5); g.lineTo(-2.5, 2.5); }
        else if (v === 1) { g.moveTo(0, -3); g.lineTo(0, 3); g.moveTo(-2.5, -1); g.lineTo(2.5, -1); }
        else if (v === 2) { g.moveTo(-3, 2); g.lineTo(0, -3); g.lineTo(3, 2); }
        else { g.arc(0, 0, 2.2, 0, TAU); }
        g.stroke(); g.restore();
      }
      g.lineWidth = 2; g.beginPath();
      for (let k = 0; k <= 6; k++) { const a = k / 6 * TAU * 2 - Math.PI / 2; k ? g.lineTo(Math.cos(a) * 42, Math.sin(a) * 42) : g.moveTo(Math.cos(a) * 42, Math.sin(a) * 42); }
      g.stroke();
      g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.stroke();
    });
    return RUNE;
  }

  // ---------- GPU glow particles ----------
  const PART_VS = [
    'attribute vec3 aP; attribute vec3 aV; attribute vec4 aT; attribute vec4 aS; attribute vec4 aC;',
    'uniform float uTime; uniform float uFloor; varying vec2 vUv; varying vec4 vC;',
    'void main(){',
    '  vec2 corner = position.xy; float age = uTime - aT.x;',
    '  if (age < 0.0 || age > aT.y) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }',
    '  float u = age / aT.y, k = aT.w;',
    '  float f = k > 0.001 ? (1.0 - exp(-k * age)) / k : age;',
    '  vec3 p = aP + aV * f; p.y -= 0.5 * aT.z * age * age; p.y = max(p.y, uFloor);',
    '  vec3 vel = aV * exp(-k * age); vel.y -= aT.z * age;',
    '  vec4 mv = viewMatrix * vec4(p, 1.0);',
    '  float size = mix(aS.x, aS.y, u);',
    '  vec2 off = corner * size;',
    '  if (aS.z > 0.0) {',
    '    vec2 sv = (viewMatrix * vec4(vel, 0.0)).xy; float l = length(sv);',
    '    vec2 d = l > 1e-4 ? sv / l : vec2(0.0, 1.0);',
    '    off = d * corner.y * (size + aS.z * l) + vec2(-d.y, d.x) * corner.x * size * 0.55;',
    '  }',
    '  mv.xy += off;',
    '  gl_Position = projectionMatrix * mv;',
    '  vUv = vec2((aS.w + corner.x + 0.5) * 0.25, corner.y + 0.5);',
    '  vC = vec4(aC.rgb, aC.a * (1.0 - u * u) * min(1.0, age * 40.0 + 0.35));',
    '}'].join('\n');
  const PART_FS = [
    'uniform sampler2D map; varying vec2 vUv; varying vec4 vC;',
    'void main(){ vec4 t = texture2D(map, vUv); float a = t.a * vC.a; if (a < 0.004) discard;',
    // White-hot centre: the brightest part of every sprite leans to white, the edge keeps the colour.
    '  vec3 c = mix(vC.rgb, vec3(1.0), t.a * t.a * t.a * 0.55); gl_FragColor = vec4(linearToOutputTexel(vec4(c, 1.0)).rgb * a, a); }'].join('\n');

  function particles(scene, max, blending) {
    const g = new T.InstancedBufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const A = {};
    for (const [k, n] of [['aP', 3], ['aV', 3], ['aT', 4], ['aS', 4], ['aC', 4]]) {
      const arr = new Float32Array(max * n); if (k === 'aT') for (let i = 0; i < max; i++) arr[i * 4] = -1e6;
      A[k] = new T.InstancedBufferAttribute(arr, n); A[k].setUsage(T.DynamicDrawUsage); g.setAttribute(k, A[k]);
    }
    g.instanceCount = max;
    const mat = new T.ShaderMaterial({ vertexShader: PART_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false,
      blending: blending || T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneFactor, // premultiplied additive
      uniforms: { uTime: { value: 0 }, uFloor: { value: 0 }, map: { value: atlas() } } });
    if (blending === T.NormalBlending) { mat.blending = T.CustomBlending; mat.blendSrc = T.OneFactor; mat.blendDst = T.OneMinusSrcAlphaFactor; }
    const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; scene.add(mesh);
    let head = 0, lo = Infinity, hi = -1;
    return {
      mesh, mat, max,
      // x y z, velocity, life (s), size start/end, colour, alpha, gravity, drag, stretch (s), atlas cell.
      emit(x, y, z, vx, vy, vz, life, s0, s1, color, alpha, grav, drag, stretch, cell) {
        const i = head; head = (head + 1) % max;
        if (i < lo) lo = i; if (i > hi) hi = i;
        const c = col(color);
        const P = A.aP.array, V = A.aV.array, Ti = A.aT.array, Si = A.aS.array, Ci = A.aC.array;
        P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; V[i * 3] = vx; V[i * 3 + 1] = vy; V[i * 3 + 2] = vz;
        Ti[i * 4] = mat.uniforms.uTime.value; Ti[i * 4 + 1] = life; Ti[i * 4 + 2] = grav || 0; Ti[i * 4 + 3] = drag || 0;
        Si[i * 4] = s0; Si[i * 4 + 1] = s1; Si[i * 4 + 2] = stretch || 0; Si[i * 4 + 3] = cell || 0;
        Ci[i * 4] = c.r; Ci[i * 4 + 1] = c.g; Ci[i * 4 + 2] = c.b; Ci[i * 4 + 3] = alpha == null ? 1 : alpha;
      },
      update(time) {
        mat.uniforms.uTime.value = time;
        if (hi < 0) return;
        for (const k in A) { const a = A[k]; a.updateRange.offset = lo * a.itemSize; a.updateRange.count = (hi - lo + 1) * a.itemSize; a.needsUpdate = true; }
        lo = Infinity; hi = -1;
      },
      clear() { const Ti = A.aT.array; for (let i = 0; i < max; i++) Ti[i * 4] = -1e6; lo = 0; hi = max - 1; },
    };
  }

  // ---------- Rock chunks (lit solids, GPU-animated) ----------
  const ROCK_VS = [
    'attribute vec3 aP; attribute vec3 aV; attribute vec4 aT; attribute vec4 aR; attribute vec4 aC;',
    'uniform float uTime; uniform float uFloor; varying vec3 vC;',
    'vec3 rot(vec3 v, vec3 a, float t){ float c = cos(t), s = sin(t); return v * c + cross(a, v) * s + a * dot(a, v) * (1.0 - c); }',
    'void main(){',
    '  float age = uTime - aT.x;',
    '  if (age < 0.0 || age > aT.y) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }',
    '  float u = age / aT.y;',
    // Flight with drag, then it lands: clamp to the floor and stop spinning once down.
    '  float f = (1.0 - exp(-1.2 * age)) / 1.2;',
    '  vec3 p = aP + aV * f; p.y -= 0.5 * aT.z * age * age;',
    '  float down = step(p.y, uFloor + aC.w * 0.4); p.y = max(p.y, uFloor + aC.w * 0.4);',
    '  vec3 ax = normalize(aR.xyz); float ang = aR.w * min(age, mix(age, 0.6 * aT.y, down));',
    '  float sc = aC.w * (1.0 - smoothstep(0.7, 1.0, u));',
    '  vec3 lp = rot(position * sc, ax, ang); vec3 n = rot(normal, ax, ang);',
    '  float l = 0.45 + 0.55 * max(dot(n, normalize(vec3(-0.4, 0.85, 0.35))), 0.0);',
    '  vC = aC.rgb * l;',
    '  gl_Position = projectionMatrix * viewMatrix * vec4(p + lp, 1.0);',
    '}'].join('\n');
  function rocks(scene, max) {
    const base = new T.DodecahedronGeometry(1, 0); base.scale(1, 0.7, 0.85);
    const g = new T.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('normal', base.attributes.normal);
    const A = {};
    for (const [k, n] of [['aP', 3], ['aV', 3], ['aT', 4], ['aR', 4], ['aC', 4]]) {
      const arr = new Float32Array(max * n); if (k === 'aT') for (let i = 0; i < max; i++) arr[i * 4] = -1e6;
      A[k] = new T.InstancedBufferAttribute(arr, n); A[k].setUsage(T.DynamicDrawUsage); g.setAttribute(k, A[k]);
    }
    g.instanceCount = max;
    const mat = new T.ShaderMaterial({ vertexShader: ROCK_VS, fragmentShader: 'varying vec3 vC; void main(){ gl_FragColor = linearToOutputTexel(vec4(vC, 1.0)); }',
      uniforms: { uTime: { value: 0 }, uFloor: { value: 0 } } });
    const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; scene.add(mesh);
    let head = 0, lo = Infinity, hi = -1;
    const c = new T.Color();
    return {
      mesh, mat,
      emit(x, y, z, vx, vy, vz, life, size, color, grav) {
        const i = head; head = (head + 1) % max; if (i < lo) lo = i; if (i > hi) hi = i;
        c.copy(col(color)).multiplyScalar(rnd(0.8, 1.15));
        A.aP.array.set([x, y, z], i * 3); A.aV.array.set([vx, vy, vz], i * 3);
        A.aT.array.set([mat.uniforms.uTime.value, life, grav, 0], i * 4);
        A.aR.array.set([rnd(-1, 1), rnd(-1, 1), rnd(-1, 1) + 0.01, rnd(6, 16)], i * 4);
        A.aC.array.set([c.r, c.g, c.b, size], i * 4);
      },
      update(time) {
        mat.uniforms.uTime.value = time;
        if (hi < 0) return;
        for (const k in A) { const a = A[k]; a.updateRange.offset = lo * a.itemSize; a.updateRange.count = (hi - lo + 1) * a.itemSize; a.needsUpdate = true; }
        lo = Infinity; hi = -1;
      },
    };
  }

  // ---------- Floor decals (cracks, scorch) ----------
  const DEC_VS = [
    'attribute vec4 aD; attribute vec4 aA; uniform float uTime; uniform float uY; varying vec2 vUv; varying float vA;',
    'void main(){ float age = uTime - aA.x; if (age < 0.0 || age > aA.y) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }',
    '  float u = age / aA.y; vA = aA.w * (1.0 - smoothstep(0.55, 1.0, u)) * min(1.0, age * 14.0);',
    '  float c = cos(aD.z), s = sin(aD.z); vec2 q = position.xy * aD.w * (0.85 + 0.15 * min(1.0, age * 10.0));',
    '  vec3 p = vec3(aD.x + q.x * c - q.y * s, uY, aD.y + q.x * s + q.y * c);',
    '  vUv = vec2((aA.z + position.x + 0.5) * 0.5, position.y + 0.5);',
    '  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }'].join('\n');
  function floorDecals(scene, max, y) {
    const base = new T.PlaneGeometry(1, 1), g = new T.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position);
    const aD = new T.InstancedBufferAttribute(new Float32Array(max * 4), 4), aA = new T.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    for (let i = 0; i < max; i++) aA.array[i * 4] = -1e6;
    g.setAttribute('aD', aD); g.setAttribute('aA', aA); g.instanceCount = max;
    const mat = new T.ShaderMaterial({ vertexShader: DEC_VS, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      fragmentShader: 'uniform sampler2D map; varying vec2 vUv; varying float vA; void main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(t.rgb, t.a * vA); }',
      uniforms: { uTime: { value: 0 }, uY: { value: y }, map: { value: decals() } } });
    const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 2; scene.add(mesh);
    let head = 0;
    return {
      mesh, mat,
      emit(x, z, size, life, cell, alpha) {
        const i = head; head = (head + 1) % max;
        aD.array.set([x, z, Math.random() * TAU, size], i * 4); aA.array.set([mat.uniforms.uTime.value, life, cell || 0, alpha == null ? 1 : alpha], i * 4);
        aD.needsUpdate = aA.needsUpdate = true;
      },
      update(time) { mat.uniforms.uTime.value = time; },
    };
  }

  // ---------- Lightning ----------
  const SEG = 14;
  const BOLT_VS = [
    'attribute vec3 aNext; attribute float aSide; attribute float aU; uniform float uW; varying float vS; varying float vU;',
    'void main(){ vec4 a = modelViewMatrix * vec4(position, 1.0), b = modelViewMatrix * vec4(aNext, 1.0);',
    '  vec2 d = b.xy - a.xy; float l = length(d); d = l > 1e-5 ? d / l : vec2(1.0, 0.0);',
    '  a.xy += vec2(-d.y, d.x) * aSide * uW * (0.55 + 0.45 * sin(3.14159 * clamp(aU, 0.0, 1.0)));',
    '  vS = aSide; vU = aU; gl_Position = projectionMatrix * a; }'].join('\n');
  const BOLT_FS = [
    'uniform vec3 uA; uniform vec3 uB; uniform float uO; varying float vS; varying float vU;',
    'void main(){ float x = abs(vS); float glow = exp(-x * x * 4.0); float core = smoothstep(0.2, 0.0, x);',
    '  vec3 c = min(vec3(1.0), mix(uA, uB, vU) * (1.2 + glow * 0.6) + vec3(core * 0.85)); float a = min(1.0, (glow * 0.9 + core) * uO); gl_FragColor = vec4(linearToOutputTexel(vec4(c, 1.0)).rgb * a, a); }'].join('\n');
  function bolts(scene, max) {
    const list = [];
    for (let i = 0; i < max; i++) {
      const n = SEG + 1, g = new T.BufferGeometry();
      const pos = new Float32Array(n * 2 * 3), nxt = new Float32Array(n * 2 * 3), side = new Float32Array(n * 2), u = new Float32Array(n * 2), idx = [];
      for (let k = 0; k < n; k++) { side[k * 2] = -1; side[k * 2 + 1] = 1; u[k * 2] = u[k * 2 + 1] = k / SEG; if (k < SEG) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aNext', new T.BufferAttribute(nxt, 3));
      g.setAttribute('aSide', new T.BufferAttribute(side, 1)); g.setAttribute('aU', new T.BufferAttribute(u, 1)); g.setIndex(idx);
      const mat = new T.ShaderMaterial({ vertexShader: BOLT_VS, fragmentShader: BOLT_FS, transparent: true, depthWrite: false, side: T.DoubleSide,
        blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneFactor,
        uniforms: { uW: { value: 1 }, uA: { value: new T.Color() }, uB: { value: new T.Color() }, uO: { value: 1 } } });
      const m = new T.Mesh(g, mat); m.frustumCulled = false; m.visible = false; m.renderOrder = 6; scene.add(m);
      list.push({ m, g, pos, nxt, life: 0, max: 1, a: new T.Vector3(), b: new T.Vector3(), jag: 1, jt: 0, w: 1 });
    }
    // Midpoint displacement along the segment, sideways only (perpendicular in the horizontal plane and up).
    function shape(o) {
      const { a, b, pos, nxt } = o, dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz) || 1;
      let px = -dz / len, pz = dx / len; if (Math.abs(px) + Math.abs(pz) < 0.1) { px = 1; pz = 0; }
      const off = [0];
      for (let k = 1; k < SEG; k++) off.push((off[k - 1] * 0.45 + rnd(-1, 1)) );
      off.push(0);
      for (let k = 0; k <= SEG; k++) {
        const t = k / SEG, env = Math.sin(Math.PI * t), j = off[k] * 0.6 * o.jag * env, jy = rnd(-0.3, 0.3) * o.jag * env;
        const x = a.x + dx * t + px * j, y = a.y + dy * t + jy, z = a.z + dz * t + pz * j;
        for (const s of [0, 1]) { pos[(k * 2 + s) * 3] = x; pos[(k * 2 + s) * 3 + 1] = y; pos[(k * 2 + s) * 3 + 2] = z; }
      }
      for (let k = 0; k <= SEG; k++) {
        const q = k < SEG ? k + 1 : k - 1, sgn = k < SEG ? 1 : -1;
        for (const s of [0, 1]) {
          const i = (k * 2 + s) * 3, j = (q * 2 + s) * 3;
          // The last point looks "back", so mirror it forward to keep the ribbon direction.
          nxt[i] = sgn > 0 ? pos[j] : 2 * pos[i] - pos[j]; nxt[i + 1] = sgn > 0 ? pos[j + 1] : 2 * pos[i + 1] - pos[j + 1]; nxt[i + 2] = sgn > 0 ? pos[j + 2] : 2 * pos[i + 2] - pos[j + 2];
        }
      }
      o.g.attributes.position.needsUpdate = true; o.g.attributes.aNext.needsUpdate = true;
    }
    let head = 0;
    return {
      fire(x1, y1, z1, x2, y2, z2, w, life, colA, colB, jag, ghost) {
        const o = list[head]; head = (head + 1) % max;
        o.a.set(x1, y1, z1); o.b.set(x2, y2, z2); o.w = w; o.life = o.max = life; o.jag = jag; o.jt = 0; o.ghost = !!ghost;
        o.m.material.uniforms.uA.value.set(colA); o.m.material.uniforms.uB.value.set(colB || colA); o.m.visible = true; shape(o);
        return o;
      },
      update(dt) {
        for (const o of list) {
          if (o.life <= 0) continue;
          o.life -= dt;
          if (o.life <= 0) { o.m.visible = false; continue; }
          if ((o.jt -= dt) <= 0) { o.jt = 0.045; shape(o); }
          const t = o.life / o.max, u = o.m.material.uniforms;
          u.uO.value = o.ghost ? 0 : Math.min(1, t * 2.2) * (Math.random() < 0.12 ? 0.35 : 1); u.uW.value = o.w * (0.7 + 0.3 * t);
        }
      },
    };
  }

  window.Fx3D = {
    tex: { atlas, decals, rune },
    create(scene, opt) {
      opt = opt || {};
      const U = opt.unit || 1, floor = opt.floor || 0;
      const glow = particles(scene, opt.particles || 1600);
      glow.mat.uniforms.uFloor.value = floor + 0.05 * U;
      const rk = rocks(scene, opt.rocks || 120); rk.mat.uniforms.uFloor.value = floor;
      const dec = floorDecals(scene, opt.decals || 24, floor + 0.03 * U);
      const bl = bolts(scene, opt.bolts || 12);
      let time = 0, trauma = 0;
      const shakeV = new T.Vector3();
      // Per-frame budget: a burst of hits in one frame never floods the pools.
      let budget = 0;
      let BUDGET = opt.budget || 420;
      const E = (x, y, z, vx, vy, vz, life, s0, s1, col, a, g, d, st, cell) => { if (budget-- > 0) glow.emit(x, y, z, vx, vy, vz, life, s0, s1, col, a, g, d, st, cell); };

      const fx = {
        unit: U, glow, rocks: rk, decals: dec, bolts: bl,
        emit: E,
        get time() { return time; },
        update(dt) {
          time += dt; budget = BUDGET;
          glow.update(time); rk.update(time); dec.update(time); bl.update(dt);
          trauma = Math.max(0, trauma - dt * 2.2);
        },
        // ---- Camera shake (trauma model: offset grows with trauma², decays fast) ----
        shake(k) { trauma = Math.min(1, trauma + k); },
        shakeOffset(scale) {
          const s = trauma * trauma * (scale == null ? U * 0.6 : scale), t = time * 60;
          return shakeV.set(Math.sin(t * 1.13) * s, Math.sin(t * 1.71 + 1) * s * 0.6, Math.sin(t * 0.93 + 2) * s);
        },
        // ---- Presets (sizes in units of U) ----
        // Muzzle / bow release: a star flash, a hot core and a fan of sparks thrown forward (dx, dz = aim).
        muzzle(x, y, z, dx, dz, color, power) {
          const p = power || 1, a = Math.atan2(dx, dz);
          E(x, y, z, 0, 0, 0, 0.09, 2.6 * U * p, 3.4 * U * p, color, 1, 0, 0, 0, 1);
          E(x, y, z, 0, 0, 0, 0.07, 1.4 * U * p, 0.6 * U * p, '#ffffff', 1, 0, 0, 0, 2);
          const n = Math.round(7 * p);
          for (let k = 0; k < n; k++) {
            const b = a + rnd(-0.6, 0.6), v = rnd(10, 26) * U;
            E(x, y, z, Math.sin(b) * v, rnd(-0.2, 0.5) * v * 0.4, Math.cos(b) * v, rnd(0.1, 0.24), 0.32 * U, 0.1 * U, k % 3 ? color : '#fff4c8', 1, 6 * U, 4, 0.022, 2);
          }
        },
        // A single glowing trail dot (call per frame behind a projectile).
        trail(x, y, z, color, size, life) { E(x, y, z, 0, 0, 0, life || 0.16, (size || 0.7) * U, 0.12 * U, color, 0.9, 0, 0, 0, 0); },
        // Hit: flash + sparks; rocks > 0 throws stone chips off the floor.
        impact(x, y, z, color, power, rockN, rockCol) {
          const p = power || 1;
          E(x, y, z, 0, 0, 0, 0.1, 2.2 * U * p, 2.8 * U * p, color, 1, 0, 0, 0, 1);
          E(x, y, z, 0, 0, 0, 0.12, 1.2 * U * p, 0.4 * U * p, '#ffffff', 0.9, 0, 0, 0, 2);
          const n = Math.round(9 * p);
          for (let k = 0; k < n; k++) {
            const b = Math.random() * TAU, v = rnd(5, 15) * U * Math.sqrt(p);
            E(x, y, z, Math.sin(b) * v, rnd(2, 9) * U, Math.cos(b) * v, rnd(0.18, 0.42), 0.28 * U, 0.08 * U, k % 3 ? color : '#ffe9a8', 1, 22 * U, 2.5, 0.03, 2);
          }
          if (rockN) fx.chips(x, z, rockN, rockCol, p);
        },
        // Stone chips flying out of the floor + a little grey dust.
        chips(x, z, n, color, power) {
          const p = power || 1;
          for (let k = 0; k < n; k++) {
            const b = Math.random() * TAU, v = rnd(3, 8) * U * p;
            rk.emit(x + rnd(-0.3, 0.3) * U, floor + 0.4 * U, z + rnd(-0.3, 0.3) * U, Math.sin(b) * v, rnd(5, 11) * U * Math.sqrt(p), Math.cos(b) * v, rnd(0.8, 1.3), rnd(0.12, 0.26) * U * Math.sqrt(p), color || '#4a4650', 26 * U);
          }
          for (let k = 0; k < Math.min(3, n); k++) E(x + rnd(-0.5, 0.5) * U, floor + 0.4 * U, z + rnd(-0.5, 0.5) * U, rnd(-1, 1) * U, rnd(0.6, 1.4) * U, rnd(-1, 1) * U, rnd(0.5, 0.8), 1 * U * p, 2.4 * U * p, '#8a8090', 0.22, 0, 1.5, 0, 3);
        },
        // Cracked floor under a heavy hit (cell 0) or a scorch mark (cell 1).
        crack(x, z, size, life, cell, alpha) { dec.emit(x, z, size * U, life || 2.6, cell || 0, alpha); },
        // Explosion: white flash, fire glow, embers, sparks, chips, a scorch mark and a kick of shake.
        explosion(x, y, z, r, opts) {
          const o = opts || {}, R = r;
          E(x, y, z, 0, 0, 0, 0.14, R * 1.4, R * 2.4, '#fff2d0', 0.75, 0, 0, 0, 1);
          E(x, y, z, 0, 0, 0, 0.32, R * 1.3, R * 2, o.color || '#ff7a1a', 0.55, 0, 0, 0, 0);
          for (let k = 0; k < (o.n || 14); k++) {
            const b = Math.random() * TAU, v = rnd(0.6, 1.6) * R * 3;
            E(x, y, z, Math.sin(b) * v, rnd(0.8, 2.2) * R * 2, Math.cos(b) * v, rnd(0.35, 0.8), R * 0.09, R * 0.03, k % 3 ? '#ffb43a' : '#fff2b0', 1, R * 6, 2.2, 0.04, 2);
          }
          for (let k = 0; k < 6; k++) { const b = Math.random() * TAU, v = rnd(0.2, 0.6) * R; E(x + Math.sin(b) * R * 0.3, y, z + Math.cos(b) * R * 0.3, Math.sin(b) * v, rnd(0.4, 1) * R, Math.cos(b) * v, rnd(0.3, 0.55), R * 0.7, R * 0.2, k % 2 ? '#ff5a10' : '#ffc23a', 0.8, -R * 0.5, 2, 0, 0); }
          if (o.chips !== false) for (let k = 0; k < (o.rocks || 6); k++) { const b = Math.random() * TAU, v = rnd(0.5, 1.4) * R * 2.5; rk.emit(x, floor + R * 0.1, z, Math.sin(b) * v, rnd(1.5, 3) * R * 2, Math.cos(b) * v, rnd(0.9, 1.4), rnd(0.05, 0.11) * R, o.rockCol || '#3a3540', R * 9); }
          if (o.scorch !== false) dec.emit(x, z, R * 2.2, 3.5, 1, 0.8);
          fx.shake(o.shake == null ? 0.35 : o.shake);
        },
        // Lightning from a to b with a soft flare at both ends; branches split off for a chain look.
        bolt(x1, y1, z1, x2, y2, z2, opts) {
          const o = opts || {}, w = (o.w || 0.35) * U, ca = o.colA || '#b04dff', cb = o.colB || '#7dff4a', life = o.life || 0.22;
          const len = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
          bl.fire(x1, y1, z1, x2, y2, z2, w, life, ca, cb, o.jag == null ? Math.min(len * 0.1, 1.1 * U) : o.jag);
          const br = o.branches == null ? 1 : o.branches;
          for (let k = 0; k < br; k++) {
            const t = rnd(0.25, 0.7), mx = x1 + (x2 - x1) * t, my = y1 + (y2 - y1) * t, mz = z1 + (z2 - z1) * t, b = Math.random() * TAU, l = len * rnd(0.2, 0.4);
            bl.fire(mx, my, mz, mx + Math.sin(b) * l, my + rnd(-0.3, 0.3) * l, mz + Math.cos(b) * l, w * 0.55, life * 0.8, ca, cb, l * 0.12);
          }
          if (o.flare !== false) { E(x2, y2, z2, 0, 0, 0, 0.16, 2.4 * U, 3 * U, cb, 1, 0, 0, 0, 1); E(x1, y1, z1, 0, 0, 0, 0.12, 1.6 * U, 2 * U, ca, 0.9, 0, 0, 0, 0); }
          for (let k = 0; k < (o.sparks == null ? 8 : o.sparks); k++) { const b = Math.random() * TAU, v = rnd(4, 12) * U; E(x2, y2, z2, Math.sin(b) * v, rnd(1, 7) * U, Math.cos(b) * v, rnd(0.15, 0.35), 0.24 * U, 0.06 * U, k % 2 ? ca : cb, 1, 16 * U, 2, 0.03, 2); }
        },
        // Chain lightning through a list of points [{x,y,z}, ...].
        chain(points, opts) { for (let k = 1; k < points.length; k++) { const a = points[k - 1], b = points[k]; fx.bolt(a.x, a.y, a.z, b.x, b.y, b.z, opts); } },
        // Long-lived sparks raining down (gun pods, grinding metal).
        shower(x, y, z, dx, dz, color, n) {
          for (let k = 0; k < (n || 6); k++) { const v = rnd(3, 10) * U; E(x, y, z, dx * v + rnd(-3, 3) * U, rnd(-2, 3) * U, dz * v + rnd(-3, 3) * U, rnd(0.3, 0.7), 0.26 * U, 0.06 * U, k % 2 ? color : '#fff2b0', 1, 20 * U, 1.5, 0.035, 2); }
        },
        // Soft rising motes (embers, dust, magic).
        mote(x, y, z, color, size, life, vy) { E(x, y, z, rnd(-0.3, 0.3) * U, (vy == null ? 0.6 : vy) * U, rnd(-0.3, 0.3) * U, life || 2, (size || 0.25) * U, (size || 0.25) * U * 0.4, color, 0.8, 0, 0.3, 0, 0); },
        // A ground aura: two counter-rotating rune rings + a soft disc. Returns a mesh; call aura.tick(time) each frame.
        aura(color, size) {
          const g = new T.Group(), c = new T.Color(color);
          const glowM = new T.MeshBasicMaterial({ map: atlas(), color: c, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.55 });
          const disc = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), glowM);
          disc.geometry.attributes.uv.array.set([0, 1, 0.25, 1, 0, 0, 0.25, 0]); disc.scale.setScalar(size * 1.6); g.add(disc);
          const runeM = new T.MeshBasicMaterial({ map: rune(), color: c, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.9 });
          const r1 = new T.Mesh(new T.PlaneGeometry(size, size).rotateX(-Math.PI / 2), runeM); r1.position.y = 0.005; g.add(r1);
          const ringM = new T.MeshBasicMaterial({ color: c.clone().lerp(new T.Color('#ffffff'), 0.25), transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
          const r2 = new T.Mesh(new T.RingGeometry(size * 0.47, size * 0.5, 48).rotateX(-Math.PI / 2), ringM); r2.position.y = 0.01; g.add(r2);
          g.renderOrder = 3; g.traverse(o => { o.renderOrder = 3; });
          g.userData = { setColor(col) { c.set(col); glowM.color.copy(c); runeM.color.copy(c); ringM.color.copy(c).lerp(new T.Color('#ffffff'), 0.25); } };
          g.tick = t => { r1.rotation.y = t * 0.6; r2.scale.setScalar(1 + 0.04 * Math.sin(t * 5)); ringM.opacity = 0.65 + 0.3 * Math.sin(t * 5); glowM.opacity = 0.4 + 0.12 * Math.sin(t * 3); };
          scene.add(g); return g;
        },
        // ---- V2 presets (Arrow Legends skill/element effects; all built from the same pooled parts) ----
        // A ring of sparks flying out flat along the floor (shockwave edge, skill pick, level up).
        ring(x, y, z, color, r, n, color2) {
          const R = (r || 4) * U, N = n || 24;
          for (let k = 0; k < N; k++) { const b = k / N * TAU + rnd(-0.08, 0.08), v = R * rnd(2.2, 3.2); E(x + Math.sin(b) * 0.3 * U, y, z + Math.cos(b) * 0.3 * U, Math.sin(b) * v, rnd(0.2, 1.2) * U, Math.cos(b) * v, rnd(0.25, 0.45), 0.34 * U, 0.08 * U, k % 3 || !color2 ? color : color2, 1, 0, 3, 0.03, 2); }
        },
        // Big star flare (crit, pick-up, boss roar): a ray star over a soft glow.
        star(x, y, z, color, size, life) {
          const s = (size || 4) * U, l = life || 0.3;
          E(x, y, z, 0, 0, 0, l, s * 0.5, s, color, 1, 0, 0, 0, 1);
          E(x, y, z, 0, 0, 0, l * 0.6, s * 0.35, s * 0.15, '#ffffff', 1, 0, 0, 0, 2);
          E(x, y, z, 0, 0, 0, l * 1.4, s * 0.6, s * 1.3, color, 0.4, 0, 0, 0, 0);
        },
        // Ice: a white-blue flash, tumbling ice chunks (lit solids), drifting snowflakes and a cold mist.
        frost(x, y, z, power) {
          const p = power || 1;
          E(x, y, z, 0, 0, 0, 0.22, 2.4 * U * p, 4.2 * U * p, '#9fe8ff', 1, 0, 0, 0, 1);
          E(x, y, z, 0, 0, 0, 0.12, 1.4 * U * p, 0.5 * U * p, '#ffffff', 1, 0, 0, 0, 2);
          for (let k = 0; k < Math.round(7 * p); k++) { const b = Math.random() * TAU, v = rnd(3, 8) * U * Math.sqrt(p); rk.emit(x, y, z, Math.sin(b) * v, rnd(4, 10) * U, Math.cos(b) * v, rnd(0.7, 1.1), rnd(0.12, 0.24) * U * Math.sqrt(p), k % 2 ? '#d8f6ff' : '#8fd4ff', 24 * U); }
          for (let k = 0; k < Math.round(14 * p); k++) { const b = Math.random() * TAU, v = rnd(3, 11) * U; E(x, y, z, Math.sin(b) * v, rnd(1, 6) * U, Math.cos(b) * v, rnd(0.25, 0.5), 0.3 * U, 0.06 * U, k % 2 ? '#bff4ff' : '#ffffff', 1, 10 * U, 3, 0.025, 2); }
          for (let k = 0; k < Math.round(8 * p); k++) E(x + rnd(-1, 1) * U, y + rnd(0, 1.5) * U, z + rnd(-1, 1) * U, rnd(-0.6, 0.6) * U, rnd(-0.8, -0.2) * U, rnd(-0.6, 0.6) * U, rnd(0.9, 1.6), 0.34 * U, 0.12 * U, '#e8fbff', 0.9, 0, 0.5, 0, 1);
          for (let k = 0; k < Math.round(4 * p); k++) E(x + rnd(-0.6, 0.6) * U, y * 0.5, z + rnd(-0.6, 0.6) * U, rnd(-1, 1) * U, rnd(0.2, 0.6) * U, rnd(-1, 1) * U, rnd(0.7, 1.1), 1.2 * U * p, 3 * U * p, '#9fd8ff', 0.25, 0, 1.5, 0, 3);
        },
        // Healing: soft green motes and little stars spiralling up around a column.
        heal(x, z, color, power, color2) {
          const p = power || 1, c2 = color2 || '#ffffff';
          for (let k = 0; k < Math.round(18 * p); k++) { const a = k / (18 * p) * TAU * 2, r = rnd(0.6, 1.3) * U; E(x + Math.sin(a) * r, rnd(0.1, 0.6) * U, z + Math.cos(a) * r, Math.cos(a) * 1.5 * U, rnd(2.5, 5) * U, -Math.sin(a) * 1.5 * U, rnd(0.7, 1.2), 0.5 * U, 0.15 * U, k % 3 ? color : c2, 1, 0, 0.8, 0, k % 4 ? 0 : 1); }
          E(x, 1.2 * U, z, 0, 0, 0, 0.5, 2.5 * U * p, 4.5 * U * p, color, 0.5, 0, 0, 0, 0);
        },
        // Charge-up: motes start on a sphere of radius r and rush into the centre (spell wind-up).
        charge(x, y, z, color, r, n, life, color2) {
          const R = (r || 2) * U, l = life || 0.35;
          for (let k = 0; k < (n || 10); k++) {
            const a = Math.random() * TAU, b = Math.acos(rnd(-1, 1)), dx = Math.sin(b) * Math.sin(a), dy = Math.cos(b), dz = Math.sin(b) * Math.cos(a);
            E(x + dx * R, y + dy * R * 0.7, z + dz * R, -dx * R / l, -dy * R * 0.7 / l, -dz * R / l, l, 0.32 * U, 0.12 * U, k % 2 && color2 ? color2 : color, 1, 0, 0, 0.03, 2);
          }
        },
        // A rising helix of glows (pillar of light, level up, boss summon).
        spiral(x, z, color, r, h, n, color2) {
          const R = (r || 1.2) * U, H = (h || 5) * U, N = n || 24;
          for (let k = 0; k < N; k++) { const t = k / N, a = t * TAU * 2.5; E(x + Math.sin(a) * R, t * H * 0.3, z + Math.cos(a) * R, Math.cos(a) * R * 2, H * rnd(0.8, 1.2), -Math.sin(a) * R * 2, rnd(0.6, 0.9), 0.42 * U, 0.1 * U, k % 2 && color2 ? color2 : color, 1, 0, 1.2, 0, k % 3 ? 2 : 1); }
        },
        // One slow falling snowflake / spore / leaf (trails of ice and poison arrows).
        flake(x, y, z, color, size, life) { E(x, y, z, rnd(-0.6, 0.6) * U, rnd(-1.4, -0.4) * U, rnd(-0.6, 0.6) * U, life || 0.7, (size || 0.32) * U, 0.05 * U, color, 0.95, 0, 0.6, 0, 1); },
        clear() { glow.clear(); },
        setBudget(n) { BUDGET = n; },
        // Draw every part once, fully transparent, somewhere on screen: drivers (and SwiftShader) build the pipeline
        // for a new shader/blend/vertex layout on its first real draw, which would otherwise hitch on the first bolt.
        warm(x, y, z) {
          bl.fire(x - U, y, z, x + U, y, z, 0.2 * U, 0.12, '#000000', '#000000', 0, true);
          glow.emit(x, y, z, 0, 0, 0, 0.1, U, U, '#000000', 0, 0, 0, 0, 0);
          rk.emit(x, y - 50 * U, z, 0, 0, 0, 0.1, 0.01, '#000000', 0);
          dec.emit(x, z, 0.01, 0.1, 0, 0);
        },
      };
      return fx;
    },
  };
})();
