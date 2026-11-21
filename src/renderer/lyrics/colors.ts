export type Palette = { primary: string; accent: string; glow: string };

export const FALLBACK_PALETTE: Palette = { primary: '#ffffff', accent: '#ffb347', glow: '#ff8c1a' };

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
}

/** Picks the most common saturated hue in an RGBA buffer. */
export function paletteFromImage(pixels: Uint8ClampedArray): Palette {
  const BINS = 12;
  const weight = new Array(BINS).fill(0);
  const sum = new Array(BINS).fill(0); // weighted hue offset from bin center
  let total = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const [h, s, v] = rgbToHsv(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (s < 0.35 || v < 0.25) continue;
    const bin = Math.round(h / 30) % BINS;
    let off = h - bin * 30;
    if (off > 180) off -= 360;
    weight[bin] += s;
    sum[bin] += off * s;
    total += s;
  }
  if (total < 1) return FALLBACK_PALETTE;
  const best = weight.indexOf(Math.max(...weight));
  const hue = Math.round((best * 30 + sum[best] / weight[best] + 360) % 360);
  return { primary: '#ffffff', accent: `hsl(${hue}, 85%, 60%)`, glow: `hsl(${hue}, 100%, 55%)` };
}
