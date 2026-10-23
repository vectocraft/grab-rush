// Renders scripts/chest-art.html in headless Chrome and saves the chest sprite sheets:
// ortak/img/chest-gold.webp, ortak/img/chest-royal.webp (7 frames of 256 px, lid shut → open).
// Usage: node scripts/make-chests.js   (needs Chrome and the sharp package)
const { execFileSync } = require('child_process');
const path = require('path');
const sharp = require('sharp');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page = 'file:///' + path.join(__dirname, 'chest-art.html').replace(/\\/g, '/');
(async () => {
  for (const k of ['gold', 'royal']) {
    const dom = execFileSync(CHROME, ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files',
      '--virtual-time-budget=8000', '--dump-dom', page + '?k=' + k], { maxBuffer: 64 << 20 }).toString();
    const m = /data:image\/png;base64,([A-Za-z0-9+/=]+)/.exec(dom);
    if (!m) throw new Error('no image for ' + k);
    const out = path.join(__dirname, '..', 'ortak', 'img', 'chest-' + k + '.webp');
    await sharp(Buffer.from(m[1], 'base64')).resize(256 * 7, 256).webp({ quality: 88, alphaQuality: 90 }).toFile(out);
    console.log(out);
  }
})();
