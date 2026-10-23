// Copies the web game files into www/ (Capacitor's webDir), leaving out node_modules/android/etc.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'www');
const INCLUDE = ['index.html', 'gizlilik.html', 'ortak', 'koloni-kapismasi', 'suru-seli', 'altin-ocagi', 'caglar-savasi', 'obur-delik', 'arrow-legends'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const item of INCLUDE) fs.cpSync(path.join(root, item), path.join(out, item), { recursive: true });
console.log('www/ hazır:', INCLUDE.join(', '));
