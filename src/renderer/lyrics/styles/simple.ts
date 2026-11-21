// A single centered line; the current word is in the accent color.
import type { Lyrics } from '../../../shared/types.ts';
import type { Palette } from '../colors.ts';
import { isRtl } from '../text.ts';
import { activeWord, el, type LyricStyle } from './types.ts';

export class SimpleStyle implements LyricStyle {
  private root!: HTMLElement;
  private lyrics: Lyrics | null = null;
  private shown = -2;
  private words: HTMLElement[] = [];
  private lineEl!: HTMLElement;

  mount(root: HTMLElement) {
    this.root = root;
    root.classList.add('style-simple');
    this.lineEl = el('div', 'simple-line');
    root.append(this.lineEl);
  }

  setLyrics(l: Lyrics, p: Palette) {
    this.lyrics = l;
    this.shown = -2;
    this.root.style.setProperty('--accent', p.accent);
  }

  frame(positionMs: number, lineIndex: number) {
    const line = this.lyrics?.lines[lineIndex];
    if (lineIndex !== this.shown) {
      this.shown = lineIndex;
      this.words = [];
      this.lineEl.replaceChildren();
      if (line) {
        this.lineEl.dir = isRtl(line.text) ? 'rtl' : 'ltr';
        for (const w of line.words) {
          const s = el('span', 'w', w.text);
          this.lineEl.append(s, document.createTextNode(' '));
          this.words.push(s);
        }
      }
    }
    if (!line) return;
    const a = activeWord(line.words, positionMs);
    this.words.forEach((w, i) => w.classList.toggle('active', i === a));
  }

  unmount() {
    this.root.classList.remove('style-simple');
    this.root.replaceChildren();
  }
}
