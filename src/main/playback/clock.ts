import type { LyricLine, LyricWord, NowPlaying } from '../../shared/types.ts';

/** Tracks song position between polls so lyrics move smoothly. */
export class PlaybackClock {
  private basePos = 0;
  private baseAt = 0;
  private playing = false;
  private duration = Infinity;

  update(np: NowPlaying, atMs: number): void {
    this.basePos = np.positionMs;
    this.baseAt = atMs;
    this.playing = np.playing;
    this.duration = np.durationMs > 0 ? np.durationMs : Infinity;
  }

  positionAt(nowMs: number): number {
    const pos = this.playing ? this.basePos + (nowMs - this.baseAt) : this.basePos;
    return Math.max(0, Math.min(pos, this.duration));
  }
}

/** Index of the last line whose start is <= position, or -1. */
export function currentLineIndex(lines: LyricLine[], positionMs: number): number {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].startMs <= positionMs) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

/** If a line has no per-word timings, spread words across the line by character count. */
export function spreadWords(line: LyricLine, nextStartMs: number): LyricWord[] {
  const { words } = line;
  if (words.length < 2 || words.some((w) => w.startMs !== line.startMs)) return words;
  const span = Math.max(0, nextStartMs - line.startMs);
  const total = words.reduce((n, w) => n + w.text.length, 0) || 1;
  let acc = 0;
  return words.map((w) => {
    const startMs = Math.round(line.startMs + (span * acc) / total);
    acc += w.text.length;
    return { text: w.text, startMs };
  });
}
