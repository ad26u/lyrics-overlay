// "مرسوم": huge white hand-drawn words that "boil" like OMORI text.
// SPIKE — throwaway until the design is approved.
import type { Lyrics } from '../../../shared/types.ts';
import { isRtl } from '../text.ts';
import { activeWord, el, retire, type LyricStyle } from './types.ts';

const SVG = 'http://www.w3.org/2000/svg';
const SEEDS = [3, 17, 42];

export class DrawnStyle implements LyricStyle {
  private root!: HTMLElement;
  private lyrics: Lyrics | null = null;
  private shown = -2;
  private lineEl: HTMLElement | null = null;
  private words: HTMLElement[] = [];
  private turb: SVGFETurbulenceElement | null = null;
  private timer = 0;
  private seedIdx = 0;

  mount(root: HTMLElement) {
    this.root = root;
    root.classList.add('style-drawn');
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = `<filter id="boil" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`;
    root.append(svg);
    this.turb = svg.querySelector('feTurbulence');
    this.timer = window.setInterval(() => {
      this.seedIdx = (this.seedIdx + 1) % SEEDS.length;
      this.turb?.setAttribute('seed', String(SEEDS[this.seedIdx]));
    }, 140);
  }

  setLyrics(l: Lyrics) {
    this.lyrics = l;
    this.shown = -2;
  }

  frame(positionMs: number, lineIndex: number) {
    if (lineIndex !== this.shown) {
      this.shown = lineIndex;
      if (this.lineEl) retire(this.lineEl, 500);
      this.lineEl = null;
      this.words = [];
      const line = this.lyrics?.lines[lineIndex];
      if (line) {
        const d = el('div', 'drawn-line');
        d.dir = isRtl(line.text) ? 'rtl' : 'ltr';
        for (const w of line.words) {
          const s = el('span', 'w', w.text);
          d.append(s, document.createTextNode(' '));
          this.words.push(s);
        }
        this.root.append(d);
        this.lineEl = d;
        // shrink font until the line fits the window
        let size = Math.min(this.root.clientHeight * 0.11, this.root.clientWidth * 0.055);
        d.style.fontSize = `${size}px`;
        while (size > 18 && (d.scrollHeight > d.clientHeight || d.scrollWidth > d.clientWidth)) {
          size *= 0.9;
          d.style.fontSize = `${size}px`;
        }
      }
    }
    const line = this.lyrics?.lines[lineIndex];
    if (!line) return;
    const a = activeWord(line.words, positionMs);
    this.words.forEach((w, i) => w.classList.toggle('in', i <= a));
  }

  unmount() {
    clearInterval(this.timer);
    this.root.classList.remove('style-drawn');
    this.root.replaceChildren();
  }
}
