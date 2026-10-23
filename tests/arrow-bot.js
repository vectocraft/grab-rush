// "Normal player" balance bot for Arrow Legends (headless). Human-ish: reacts every 0.2 s, misses part of the
// threats, backs off from melee only sometimes, otherwise stands still to shoot. window.abot(ch, profile, seed)
window.abot = (ch, profile) => {
  const A = __arrow, G = A.G, RAR_MAX = [10, 20, 30, 40, 50, 60];
  const r = profile === 'strong' ? 5 : Math.min(4, Math.floor((ch - 1) / 3)), l = profile === 'strong' ? 60 : Math.min(RAR_MAX[r], 5 + ch * 2);
  G.hero = 'rogue';
  G.inv = [{ id: 901, b: 'bow', r, l }, { id: 902, b: 'vest', r, l }, { id: 903, b: 'ruby', r, l }, { id: 904, b: 'heart', r, l }];
  G.eq = { weapon: 901, armor: 902, ring: 903, amulet: 904 };
  const tl = profile === 'strong' ? 25 : ch; for (const k in G.talents) G.talents[k] = tl;
  const S = A.run(ch, 0), log = { ch, profile, power: 0, rooms: [], died: false, room: 0, cause: '', t: 0 };
  const st = A.stats(); log.power = Math.round(st.atk) + '/' + Math.round(st.hp);
  let pickStuck = 0, dec = 0, ctl = { mx: 0, mz: 0 }, roomT = 0, lastRoom = S.room, hp0 = S.p.hp;
  const w0 = performance.now();
  for (let i = 0; i < 400000; i++) {
    if (i % 500 === 0 && performance.now() - w0 > 170000) { log.timeout = true; break; }
    if (A.mode === 'pick') {
      const bs = [...document.querySelectorAll('[data-act=skill]')];
      if (bs.length) bs[Math.floor(Math.random() * bs.length)].click();
      else { const b = document.querySelector('[data-act=angel]') || [...document.querySelectorAll('#ov button, .fxr button, .fx-reveal button, body > div button')].find(x => x.offsetParent && !/AD|Reklam|reroll/i.test(x.textContent)); if (b) b.click(); else pickStuck++; }
      if (pickStuck > 50) { log.pickStuck = [...document.querySelectorAll('button')].filter(x => x.offsetParent).map(x => x.textContent.trim().slice(0, 14)).join('|'); break; }
      continue;
    }
    pickStuck = 0;
    if (A.mode !== 'play' && A.mode !== 'pick') break;
    const p = S.p;
    if (p.dead) { log.died = true; break; }
    if (S.room !== lastRoom) { log.rooms.push({ room: lastRoom, loss: Math.round((hp0 - p.hp) / p.max * 100), t: Math.round(roomT) }); lastRoom = S.room; roomT = 0; hp0 = p.hp; }
    roomT += 0.05; log.t += 0.05;
    if (roomT > 150) { log.stuck = S.room; break; }
    if (S.angel && !S.angel.used) { const a = Math.atan2(S.angel.x - p.x, S.angel.z - p.z); S.ctl = { mx: Math.sin(a), mz: Math.cos(a) }; }
    else if (S.cleared) S.ctl = null;
    else {
      if ((dec -= 0.05) <= 0) {
        dec = 0.2 + Math.random() * 0.1; ctl = { mx: 0, mz: 0 };
        let best = null, bd = 1e9;
        // Incoming shots: dodge sideways (70%).
        for (const s of S.foes) { const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz); if (d < 4.5 && (s.vx * dx + s.vz * dz) > 0 && d < bd) { bd = d; best = s; } }
        if (best && Math.random() < 0.7) { const sp = Math.hypot(best.vx, best.vz) || 1, side = Math.random() < 0.5 ? 1 : -1; ctl = { mx: -best.vz / sp * side, mz: best.vx / sp * side }; }
        else {
          // Telegraphed ground attacks: step out (75%).
          const w = (S.warns || []).find(w => !w.done && Math.hypot(p.x - w.x, p.z - w.z) < w.r + 0.6);
          if (w && Math.random() < 0.75) { const a = Math.atan2(p.x - w.x, p.z - w.z); ctl = { mx: Math.sin(a), mz: Math.cos(a) }; }
          else {
            // Melee too close: back off (60%).
            const m = S.enemies.filter(e => e.hp > 0 && e.state !== 'rise').map(e => [e, Math.hypot(e.x - p.x, e.z - p.z) - e.r]).sort((a, b) => a[1] - b[1])[0];
            if (m && m[1] < 2.2 && Math.random() < 0.6) { const a = Math.atan2(p.x - m[0].x, p.z - m[0].z) + (Math.random() - 0.5); ctl = { mx: Math.sin(a), mz: Math.cos(a) }; }
            else if (Math.random() < 0.05) { const a = Math.random() * 6.28; ctl = { mx: Math.sin(a) * 0.6, mz: Math.cos(a) * 0.6 }; }
          }
        }
      }
      S.ctl = ctl;
    }
    A.step(1);
  }
  log.room = S.room; log.mode = A.mode; log.steps = Math.round(log.t / 0.05); log.cause = S.lastHit || ''; log.dmg = Object.entries(S.dmgLog || {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ':' + Math.round(v)).join(' ');
  log.win = !log.died && !log.stuck && A.mode !== 'play';
  return log;
};
