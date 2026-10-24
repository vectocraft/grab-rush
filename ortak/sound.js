// Synthesized SFX + generative background music (WebAudio, no asset files).
// Audio mode is saved: 2 = sfx + music, 1 = sfx only, 0 = muted. Requires economy.js.
(function () {
  'use strict';
  const d = Save.load();
  if (d.audio == null) d.audio = 2;

  let ac = null, master = null, sfxGain = null, musGain = null, noiseBuf = null;
  const last = {};
  const THROTTLE = { cash: 3, shoot: 0.05, gate: 0.04, thud: 0.06, send: 0.05, pop: 0.05, hit: 0.08, boom: 0.07, mortar: 0.15, clash: 0.09, star: 0.05 };

  function ensure() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain(); master.connect(ac.destination);
    sfxGain = ac.createGain(); sfxGain.connect(master);
    musGain = ac.createGain(); musGain.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    apply();
    return ac;
  }

  function apply() {
    if (!ac) return;
    const m = Save.data.audio;
    sfxGain.gain.value = m >= 1 ? 0.5 : 0;
    musGain.gain.value = m === 2 ? 0.1 : 0;
  }

  function tone(f, dur, type, vol, f2, delay, dest) {
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function noise(dur, vol, freq, delay) {
    const t = ac.currentTime + (delay || 0);
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf;
    f.type = 'bandpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t); src.stop(t + dur + 0.03);
  }

  const SOUNDS = {
    click() { tone(600, 0.05, 'square', 0.12); },
    send() { tone(300, 0.12, 'triangle', 0.22, 600); },
    pop() { tone(500, 0.08, 'square', 0.16, 900); tone(900, 0.1, 'triangle', 0.18, 1400, 0.06); },
    hit() { noise(0.15, 0.4, 300); tone(160, 0.2, 'sawtooth', 0.22, 60); },
    power() { tone(400, 0.3, 'sawtooth', 0.18, 1200); },
    freeze() { tone(1400, 0.4, 'sine', 0.2, 500); tone(2000, 0.3, 'triangle', 0.1, 900, 0.05); },
    shoot() { tone(220 + Math.random() * 40, 0.05, 'square', 0.06, 120); },
    gate() { tone(700 + Math.random() * 200, 0.06, 'triangle', 0.08, 1200); },
    thud() { noise(0.08, 0.25, 200); },
    giant() { tone(90, 0.35, 'sawtooth', 0.3, 45); noise(0.2, 0.3, 150); },
    card() { tone(520, 0.08, 'triangle', 0.22); tone(780, 0.12, 'triangle', 0.22, null, 0.07); },
    cash() { tone(1175, 0.07, 'triangle', 0.05); tone(1568, 0.12, 'triangle', 0.04, null, 0.05); }, // soft, for repeated income ticks
    coin() { tone(988, 0.08, 'square', 0.14); tone(1319, 0.25, 'square', 0.14, null, 0.08); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.28, null, i * 0.11)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.16, null, i * 0.16)); },
    boom() { noise(0.45, 0.5, 90 + Math.random() * 60); tone(70, 0.4, 'sawtooth', 0.25, 30); },
    mortar() { tone(140, 0.12, 'sine', 0.35, 60); noise(0.1, 0.25, 400); },
    plane() { tone(95, 1.6, 'sawtooth', 0.12, 150); tone(190, 1.6, 'square', 0.04, 260); },
    boss() { tone(110, 0.8, 'sawtooth', 0.28, 55); noise(0.6, 0.3, 120); },
    // V3 juice: x2 gate burst, army clash thud, slow-motion whoosh, star chime, level-up fanfare.
    mega() { noise(0.3, 0.35, 700); [523, 784, 1047, 1568].forEach((f, i) => tone(f, 0.16, 'square', 0.12, f * 1.5, i * 0.05)); },
    clash() { noise(0.12, 0.3, 160 + Math.random() * 80); tone(120, 0.1, 'square', 0.1, 70); },
    slow() { tone(320, 0.7, 'sine', 0.22, 70); noise(0.5, 0.18, 260); },
    star() { tone(1319, 0.12, 'triangle', 0.18, 1760); tone(2093, 0.25, 'sine', 0.1, null, 0.08); },
    levelup() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, 'triangle', 0.22, null, i * 0.07)); noise(0.25, 0.12, 2000); },
  };

  // ---------- Music: 4-bar chord loop, bass + arpeggio ----------
  const PROG = [[110, 220, 261.6, 329.6], [87.31, 174.6, 220, 261.6], [130.8, 261.6, 329.6, 392], [98, 196, 246.9, 293.7]];
  const ARP = [1, 2, 3, 2, 1, 3, 2, 3];
  const STEP = 0.2727;
  let step = 0, nextT = 0, timer = null;

  function schedule() {
    if (!ac || ac.state !== 'running' || Save.data.audio !== 2) return;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.02;
    while (nextT < ac.currentTime + 0.3) {
      const ch = PROG[Math.floor(step / 8) % 4], s = step % 8, dl = nextT - ac.currentTime;
      if (s === 0 || s === 4) tone(ch[0], 0.4, 'triangle', 0.5, null, dl, musGain);
      tone(ch[ARP[s]] * 2, 0.18, 'sine', 0.22, null, dl, musGain);
      step++; nextT += STEP;
    }
  }

  // Short vibrations on the big moments (works with the sound muted; off in the hub settings: Save.data.vib === false).
  const BUZZ = { boss: [40, 60, 50], win: [30, 50, 70], lose: 160, mega: [20, 30, 40], levelup: [30, 40, 60] }, buzzAt = {}; // hits vibrate from the games (UI.vibrate)
  const buzz = name => {
    const pat = BUZZ[name]; if (!pat || Save.data.vib === false || !navigator.vibrate) return;
    const now = performance.now(); if (now - (buzzAt[name] || 0) < 140) return; buzzAt[name] = now;
    try { navigator.vibrate(pat); } catch (e) { }
  };
  const Sfx = {
    buzz,
    play(name) {
      buzz(name);
      if (Save.data.audio < 1 || !ensure() || ac.state !== 'running') return;
      const th = THROTTLE[name];
      if (th) { if (ac.currentTime - (last[name] || 0) < th) return; last[name] = ac.currentTime; }
      try { SOUNDS[name] && SOUNDS[name](); } catch (e) { }
    },
    music(on) {
      if (on) { if (!timer) timer = setInterval(schedule, 100); }
      else if (timer) { clearInterval(timer); timer = null; }
    },
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state === 'suspended' && !document.hidden) ac.resume(); },
    icon() { return ['🔇', '🔈', '🔊'][Save.data.audio]; },
    // Cycles all → sfx only → mute. Returns a short label for a toast.
    toggle() {
      Save.data.audio = (Save.data.audio + 2) % 3;
      Save.save();
      apply();
      return Sfx.label();
    },
    label() { return [L('Sound off', 'Ses kapalı'), L('Effects only', 'Sadece efektler'), L('Effects + music', 'Efektler + müzik')][Save.data.audio]; },
  };

  // Browsers only allow audio after a user gesture.
  addEventListener('pointerdown', () => { if (ensure() && ac.state === 'suspended' && !document.hidden) ac.resume(); }, true);
  document.addEventListener('visibilitychange', () => { document.hidden ? Sfx.suspend() : Sfx.resume(); });

  window.Sfx = Sfx;
})();
