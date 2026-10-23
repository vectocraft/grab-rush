// Visual themes that rotate every 10 levels, so long play sessions don't look the same.
// top/bottom/dot/field: 2D backgrounds · sea/land/cliff: 3D map (Colony Clash).
(function () {
  'use strict';
  const THEMES = [
    { id: 'lab', icon: '🧪', name: L('Lab', 'Laboratuvar'), top: '#161a3a', bottom: '#0b0c1c', dot: 'rgba(255,255,255,0.05)', field: ['#3b1d2e', '#1e293b', '#1e3a5f'], sea: '#3a6fd8', land: '#eadcb8', cliff: '#9a7b52' },
    { id: 'ocean', icon: '🌊', name: L('Deep Ocean', 'Derin Okyanus'), top: '#0c2a3f', bottom: '#04121c', dot: 'rgba(125,211,252,0.08)', field: ['#0c4a6e', '#0f2a3d', '#083344'], sea: '#1b93d1', land: '#f3e3b3', cliff: '#b08a58' },
    { id: 'volcano', icon: '🌋', name: L('Volcano', 'Volkan'), top: '#3a1414', bottom: '#140606', dot: 'rgba(252,165,165,0.07)', field: ['#7f1d1d', '#3b0f0f', '#431407'], sea: '#ff5a1f', land: '#8c776a', cliff: '#3d2c26' },
    { id: 'glacier', icon: '🏔️', name: L('Glacier', 'Buzul'), top: '#1e3a4f', bottom: '#0b1722', dot: 'rgba(224,242,254,0.09)', field: ['#334155', '#1e3a4f', '#0c4a6e'], sea: '#6fc3ea', land: '#f1f6fa', cliff: '#9fb4c6' },
    { id: 'forest', icon: '🌲', name: L('Forest', 'Orman'), top: '#14301f', bottom: '#07140c', dot: 'rgba(134,239,172,0.07)', field: ['#14532d', '#1a2e22', '#064e3b'], sea: '#2aa39a', land: '#a6d27d', cliff: '#6b4f33' },
    { id: 'midnight', icon: '🌙', name: L('Midnight', 'Gece Yarısı'), top: '#2a1640', bottom: '#0e0718', dot: 'rgba(216,180,254,0.07)', field: ['#4c1d95', '#2e1065', '#1e1b4b'], sea: '#4a37b8', land: '#d6cbef', cliff: '#6d5a9a' },
  ];
  window.Themes = {
    list: THEMES,
    forLevel(lv) { return THEMES[Math.floor((Math.max(1, lv) - 1) / 10) % THEMES.length]; },
  };
})();
