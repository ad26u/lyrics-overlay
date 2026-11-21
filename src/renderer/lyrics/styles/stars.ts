// Words become stars joined by thin lines, laid out on a zig-zag (arkcurates reel).
import type { Lyrics } from '../../../shared/types.ts';
import type { Palette } from '../colors.ts';
import { isRtl } from '../text.ts';
import { activeWord, el, retire, type LyricStyle } from './types.ts';

const SVG = 'http://www.w3.org/2000/svg';

/** Deterministic 0..1 noise so a line always gets the same shape. */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function starPositions(count: number, rtl: boolean, seed: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : 0.08 + (0.84 * i) / (count - 1);
    const zig = i % 2 === 0 ? 0.35 : 0.65;
    const y = zig + (noise(seed + i) - 0.5) * 0.25;
    pts.push({ x: rtl ? 1 - t : t, y });
  }
  return pts;
}

export class StarsStyle implements LyricStyle {
  private root!: HTMLElement;
  private lyrics: Lyrics | null = null;
  private shown = -2;
  private group: HTMLElement | null = null;
  private svg: SVGSVGElement | null = null;
  private stars: HTMLElement[] = [];
  private lines: SVGLineElement[] = [];

  mount(root: HTMLElement) {
    this.root = root;
    root.classList.add('style-stars');
  }

  setLyrics(l: Lyrics, p: Palette) {
    this.lyrics = l;
    this.shown = -2;
    this.root.style.setProperty('--accent', p.accent);
    this.root.style.setProperty('--glow', p.glow);
    this.root.style.setProperty('--primary', p.primary);
  }

  private build(index: number) {
    if (this.group) retire(this.group);
    this.group = null;
    this.stars = [];
    this.lines = [];
    const line = this.lyrics?.lines[index];
    if (!line) return;
    const rtl = isRtl(line.text);
    const pts = starPositions(line.words.length, rtl, line.startMs);
    const g = el('div', 'stars-group');
    this.svg = document.createElementNS(SVG, 'svg');
    this.svg.setAttribute('viewBox', '0 0 100 100');
    this.svg.setAttribute('preserveAspectRatio', 'none');
    g.append(this.svg);
    line.words.forEach((w, i) => {
      const s = el('div', 'star');
      s.style.left = `${pts[i].x * 100}%`;
      s.style.top = `${pts[i].y * 100}%`;
      s.append(el('span', 'glyph', '✦'), el('span', 'label', w.text));
      s.dir = rtl ? 'rtl' : 'ltr';
      g.append(s);
      this.stars.push(s);
      if (i > 0) {
        const ln = document.createElementNS(SVG, 'line');
        ln.setAttribute('x1', String(pts[i - 1].x * 100));
        ln.setAttribute('y1', String(pts[i - 1].y * 100));
        ln.setAttribute('x2', String(pts[i].x * 100));
        ln.setAttribute('y2', String(pts[i].y * 100));
        this.svg!.append(ln);
        this.lines.push(ln);
      }
    });
    this.root.append(g);
    this.group = g;
  }

  frame(positionMs: number, lineIndex: number) {
    if (lineIndex !== this.shown) {
      this.shown = lineIndex;
      this.build(lineIndex);
    }
    const line = this.lyrics?.lines[lineIndex];
    if (!line) return;
    const a = activeWord(line.words, positionMs);
    this.stars.forEach((s, i) => {
      s.classList.toggle('on', i <= a);
      s.classList.toggle('active', i === a);
    });
    this.lines.forEach((ln, i) => ln.classList.toggle('on', i + 1 <= a));
  }

  unmount() {
    this.root.classList.remove('style-stars');
    this.root.replaceChildren();
  }
}
