// One heavy line, words slide in one by one (alexcreates.exe reel).
import type { Lyrics } from '../../../shared/types.ts';
import type { Palette } from '../colors.ts';
import { isRtl } from '../text.ts';
import { activeWord, el, retire, type LyricStyle } from './types.ts';

export class BigStyle implements LyricStyle {
  private root!: HTMLElement;
  private lyrics: Lyrics | null = null;
  private shown = -2;
  private lineEl: HTMLElement | null = null;
  private words: HTMLElement[] = [];

  mount(root: HTMLElement) {
    this.root = root;
    root.classList.add('style-big');
  }

  setLyrics(l: Lyrics, p: Palette) {
    this.lyrics = l;
    this.shown = -2;
    this.root.style.setProperty('--accent', p.accent);
    this.root.style.setProperty('--glow', p.glow);
  }

  frame(positionMs: number, lineIndex: number) {
    if (lineIndex !== this.shown) {
      this.shown = lineIndex;
      if (this.lineEl) retire(this.lineEl, 400);
      this.lineEl = null;
      this.words = [];
      const line = this.lyrics?.lines[lineIndex];
      if (line) {
        const d = el('div', 'big-line');
        d.dir = isRtl(line.text) ? 'rtl' : 'ltr';
        for (const w of line.words) {
          const s = el('span', 'w', w.text);
          d.append(s, document.createTextNode(' '));
          this.words.push(s);
        }
        this.root.append(d);
        this.lineEl = d;
      }
    }
    const line = this.lyrics?.lines[lineIndex];
    if (!line) return;
    const a = activeWord(line.words, positionMs);
    this.words.forEach((w, i) => w.classList.toggle('in', i <= a));
  }

  unmount() {
    this.root.classList.remove('style-big');
    this.root.replaceChildren();
  }
}
