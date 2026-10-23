// Generates Android launcher icons (legacy + adaptive), splash screens and Play Store graphics.
// The emblem is the 3D render from scripts/make-art.js (store/art/emblem.png, run that first); the navy backdrop is SVG.
// Usage: node scripts/make-icons.js   (requires devDependency "sharp")
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const RES = path.join(root, 'android/app/src/main/res');
const STORE = path.join(root, 'store');
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const FONT = 'Arial Black, Arial, Helvetica, sans-serif';

const buf = s => Buffer.from(s);
const render = (svg, w, h) => sharp(buf(svg), { density: 300 }).resize(w, h || w).png().toBuffer();

async function writePng(svg, size, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, await render(svg, size));
}

// Cartoon title: thick dark outline under a white fill.
function title(text, x, y, size, anchor = 'middle', fill = '#ffffff') {
  const t = (extra) => `<text x="${x}" y="${y}" font-family="${FONT}" font-weight="900" font-size="${size}" text-anchor="${anchor}" ${extra}>${text}</text>`;
  return t(`fill="none" stroke="#1b1464" stroke-width="${size * 0.22}" stroke-linejoin="round"`) + t(`fill="${fill}"`);
}

const svgBox = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// Deep navy backdrop with a warm glow behind the emblem.
const backdrop = (w, h) => svgBox(w, h,
  `<defs><radialGradient id="g" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="#3a3596"/><stop offset="0.55" stop-color="#17154d"/><stop offset="1" stop-color="#0b0a24"/></radialGradient>` +
  `<radialGradient id="w" cx="50%" cy="45%" r="35%"><stop offset="0" stop-color="#ffb020" stop-opacity=".45"/><stop offset="1" stop-color="#ffb020" stop-opacity="0"/></radialGradient></defs>` +
  `<rect width="${w}" height="${h}" fill="url(#g)"/><rect width="${w}" height="${h}" fill="url(#w)"/>`);
async function backgroundCover(w, h) { return render(backdrop(w, h), w, h); }
const EMBLEM = path.join(root, 'store/art/emblem.png');
// Emblem trimmed to its bounding box, scaled to `size` px tall.
const emblem = async size => sharp(await sharp(EMBLEM).trim().png().toBuffer()).resize({ height: size, width: size, fit: 'inside' }).png().toBuffer();
// Emblem centered on the backdrop, emblem height = frac of the side.
async function iconSquare(size, frac, radius) {
  const e = await emblem(Math.round(size * frac)), m = await sharp(e).metadata();
  let img = sharp(await backgroundCover(size, size)).composite([{ input: e, left: Math.round((size - m.width) / 2), top: Math.round((size - m.height) / 2) }]);
  const buf = await img.png().toBuffer();
  if (!radius) return buf;
  const mask = Buffer.from(radius === 'round' ? svgBox(size, size, `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/>`) : svgBox(size, size, `<rect width="${size}" height="${size}" rx="${size * 0.19}"/>`));
  return sharp(buf).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

async function main() {

  for (const [d, m] of Object.entries(DENSITIES)) {
    const dir = path.join(RES, 'mipmap-' + d);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), await iconSquare(Math.round(48 * m), 0.78, 'square'));
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), await iconSquare(Math.round(48 * m), 0.72, 'round'));
    // Adaptive foreground: launchers show only the central ~66%, so the emblem stays inside that.
    const fs_ = Math.round(108 * m), e = await emblem(Math.round(fs_ * 0.56)), em = await sharp(e).metadata();
    await sharp({ create: { width: fs_, height: fs_, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: e, left: Math.round((fs_ - em.width) / 2), top: Math.round((fs_ - em.height) / 2) }]).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
    fs.writeFileSync(path.join(dir, 'ic_launcher_background.png'), await backgroundCover(fs_, fs_));
  }
  // Adaptive icon: sunburst bitmap as background layer, characters as foreground layer.
  const adaptive = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n' +
    '    <background android:drawable="@mipmap/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n';
  const anydpi = path.join(RES, 'mipmap-anydpi-v26');
  fs.mkdirSync(anydpi, { recursive: true });
  fs.writeFileSync(path.join(anydpi, 'ic_launcher.xml'), adaptive);
  fs.writeFileSync(path.join(anydpi, 'ic_launcher_round.xml'), adaptive);
  fs.writeFileSync(path.join(RES, 'values/ic_launcher_background.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#17154D</color>\n</resources>\n');

  // Splash screens: sunburst + characters + title, keeping every existing splash.png size.
  const splashes = [];
  (function walk(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) walk(p); else if (f.name === 'splash.png') splashes.push(p);
    }
  })(RES);
  for (const p of splashes) {
    const { width: w, height: h } = await sharp(p).metadata();
    const s = Math.round(Math.min(w, h) * 0.78);
    const titleSize = Math.round(Math.min(w, h) * 0.12);
    const layers = [
      await (async () => { const e = await emblem(Math.round(s * 0.62)), em = await sharp(e).metadata(); return { input: e, left: Math.round((w - em.width) / 2), top: Math.round(h / 2 - em.height * 0.8) }; })(),
      { input: buf(svgBox(w, h, title('Grab Rush', w / 2, Math.min(h - titleSize * 0.6, h / 2 + s * 0.42), titleSize, 'middle', '#ffd35a'))), left: 0, top: 0 },
    ];
    await sharp(await backgroundCover(w, h)).composite(layers).png().toFile(p + '.tmp');
    fs.renameSync(p + '.tmp', p);
  }

  // Play Store graphics.
  fs.mkdirSync(STORE, { recursive: true });
  fs.writeFileSync(path.join(STORE, 'icon-512.png'), await iconSquare(512, 0.78));
  const fw = 1024, fh = 500;
  await sharp(await backgroundCover(fw, fh))
    .composite([
      { input: await emblem(400), left: 90, top: 50 },
      {
        input: buf(svgBox(fw, fh,
          title('Grab Rush', 752, 160, 70, 'middle', '#ffd35a') +
          title('Arrow Legends · Colony Clash', 752, 228, 27, 'middle', '#ffb4a3') +
          title('Crowd Surge · Hungry Hole', 752, 270, 27, 'middle', '#bfe3ff') +
          title('Gold Mine · Age Wars', 752, 312, 27, 'middle', '#ffe7a3') +
          `<rect x="532" y="350" width="440" height="52" rx="26" fill="#1b1464" opacity="0.88"/>` +
          `<text x="752" y="384" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="22" fill="#fff" text-anchor="middle">6 games in one · Play offline</text>`)),
        left: 0, top: 0,
      },
    ])
    .png().toFile(path.join(STORE, 'feature-graphic.png'));
  console.log('Kart görselleri ve amblem: node scripts/make-art.js');

  console.log('İkonlar:', Object.keys(DENSITIES).length * 4, '· splash:', splashes.length, '· store: icon-512.png, feature-graphic.png');
}

main().catch(e => { console.error(e); process.exit(1); });
