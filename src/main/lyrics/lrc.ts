import type { LyricLine, LyricWord } from '../../shared/types.ts';

const WORD_TAG = /<(\d+):(\d{1,2})(?:[.:](\d{1,3}))?>/g;

function toMs(min: string, sec: string, frac?: string): number {
  let ms = 0;
  if (frac) ms = frac.length === 1 ? +frac * 100 : frac.length === 2 ? +frac * 10 : +frac;
  return +min * 60000 + +sec * 1000 + ms;
}

function parseWords(body: string, lineStart: number): { text: string; words: LyricWord[] } {
  const words: LyricWord[] = [];
  if (WORD_TAG.test(body)) {
    WORD_TAG.lastIndex = 0;
    const parts = body.split(WORD_TAG);
    // parts: [before, m, s, f, chunk, m, s, f, chunk, ...]
    let current = lineStart;
    for (const w of parts[0].trim().split(/\s+/).filter(Boolean)) words.push({ text: w, startMs: current });
    for (let i = 1; i + 3 < parts.length + 1; i += 4) {
      current = toMs(parts[i], parts[i + 1], parts[i + 2]);
      for (const w of (parts[i + 3] ?? '').trim().split(/\s+/).filter(Boolean)) {
        words.push({ text: w, startMs: current });
      }
    }
  } else {
    for (const w of body.trim().split(/\s+/).filter(Boolean)) words.push({ text: w, startMs: lineStart });
  }
  return { text: words.map((w) => w.text).join(' '), words };
}

export function parseLrc(text: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const stamps: number[] = [];
    let rest = raw;
    let m: RegExpExecArray | null;
    // Leading timestamps only: "[t1][t2]text"
    while ((m = /^\s*\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/.exec(rest))) {
      stamps.push(toMs(m[1], m[2], m[3]));
      rest = rest.slice(m[0].length);
    }
    if (!stamps.length) continue;
    for (const start of stamps) {
      const { text: t, words } = parseWords(rest, start);
      if (!t) continue;
      out.push({ startMs: start, text: t, words });
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}
