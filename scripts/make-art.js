// Renders the 3D key art (scripts/art) in headless Chrome and writes the hub card images + logo emblem.
// Usage: node scripts/make-art.js [scene...]   (requires Chrome and the devDependency "sharp")
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const IMG = path.join(root, 'ortak/img');
const JOBS = {
  suru: { w: 1440, h: 680, out: 'suru.webp' },
  koloni: { w: 1440, h: 680, out: 'koloni.webp' },
  maden: { w: 1440, h: 680, out: 'maden.webp' },
  cag: { w: 1440, h: 680, out: 'cag.webp' },
  emblem: { w: 1024, h: 1024, out: 'emblem.png' },
};

async function main() {
  const only = process.argv.slice(2);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'art-'));
  for (const [scene, j] of Object.entries(JOBS)) {
    if (only.length && !only.includes(scene)) continue;
    const raw = path.join(tmp, scene + '.png');
    execFileSync('sh', [path.join(__dirname, 'art/render.sh'), scene, raw, String(j.w), String(j.h)], { stdio: 'inherit' });
    const img = sharp(raw).extract({ left: 0, top: 0, width: j.w, height: j.h });
    const out = path.join(IMG, j.out);
    if (j.out.endsWith('.webp')) await img.resize(1080, 510).webp({ quality: 86 }).toFile(out);
    else await img.resize(512, 512).png().toFile(out);
    // Keep a full-size copy for store graphics.
    await sharp(raw).extract({ left: 0, top: 0, width: j.w, height: j.h }).png().toFile(path.join(tmp, scene + '-full.png'));
    fs.mkdirSync(path.join(root, 'store/art'), { recursive: true });
    fs.copyFileSync(path.join(tmp, scene + '-full.png'), path.join(root, 'store/art', scene + '.png'));
    console.log('✓', scene, '→', path.relative(root, out));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
