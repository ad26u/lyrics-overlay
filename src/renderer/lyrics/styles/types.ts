import type { Lyrics } from '../../../shared/types.ts';
import type { Palette } from '../colors.ts';

export interface LyricStyle {
  mount(root: HTMLElement): void;
  setLyrics(l: Lyrics, palette: Palette): void;
  frame(positionMs: number, lineIndex: number): void;
  unmount(): void;
}

/** Index of the last word whose start <= position, or -1. */
export function activeWord(words: { startMs: number }[], positionMs: number): number {
  let i = -1;
  for (let k = 0; k < words.length; k++) if (words[k].startMs <= positionMs) i = k;
  return i;
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Fades a node out, then removes it. */
export function retire(node: HTMLElement | SVGElement, ms = 600): void {
  node.classList.add('out');
  setTimeout(() => node.remove(), ms);
}
