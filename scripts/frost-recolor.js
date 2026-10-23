// Repaints the Quaternius Cleric texture in an ice palette for Arrow Legends' Frost Cleric (used by arrow-bake.js):
// the brown robe → glacier blue, white fur → snow, the beige tabard → silver blue; shading is kept, darks are left alone.
const sharp = require('sharp');
const hsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; return [h, s, l];
};
const rgb = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
};
async function frostRecolor(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = hsl(data[i], data[i + 1], data[i + 2]);
    let o = null;
    if (h >= 4 && h <= 50 && s >= 0.07 && l > 0.08 && l < 0.75) o = rgb(212, 0.62, Math.min(0.62, 0.1 + l * 1.15));            // brown robe → deep glacier blue
    else if (s < 0.08 && l > 0.55) o = rgb(198, 0.5, 0.74 + (l - 0.55) * 0.4);                                           // white fur → snow with a cyan cast
    else if (s < 0.25 && h >= 30 && h <= 110 && l > 0.38) o = rgb(206, 0.22, 0.28 + l * 0.62);                           // beige tabard → silver blue
    if (o) { data[i] = o[0]; data[i + 1] = o[1]; data[i + 2] = o[2]; }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}
module.exports = frostRecolor;
if (require.main === module) frostRecolor(require('fs').readFileSync(process.argv[2])).then(b => require('fs').writeFileSync(process.argv[3], b));
