// Dev harness: fakes window.overlay and plays a fixed LRC on a fake clock.
// Usage: open dev/harness.html?style=stars&lang=ar&t=6500
import type { OverlayState, StyleName } from '../src/shared/types.ts';
import { parseLrc } from '../src/main/lyrics/lrc.ts';
import { spreadWords } from '../src/main/playback/clock.ts';

const q = new URLSearchParams(location.search);
const LRC: Record<string, string> = {
  en: '[00:02.00]I did it for love\n[00:05.00]whatever I have done right here\n[00:09.00]you were everywhere',
  ar: '[00:02.00]يا ليل يا عين\n[00:05.00]انت عمري وانت حياتي كلها\n[00:09.00]وين ما رحت القاك',
};
const lines = parseLrc(LRC[q.get('lang') ?? 'en']);
lines.forEach((l, i) => (l.words = spreadWords(l, lines[i + 1]?.startMs ?? l.startMs + 4000)));
const t = Number(q.get('t') ?? 6500);

const listeners: Record<string, (v: any) => void> = {};
(window as any).overlay = {
  onState: (cb: any) => (listeners.state = cb),
  onStyle: (cb: any) => (listeners.style = cb),
  onEditMode: (cb: any) => (listeners.edit = cb),
  onSide: (cb: any) => (listeners.side = cb),
  finishEdit() {}, setHover() {},
};
await import('../src/renderer/lyrics/main.ts');
document.body.style.background = 'radial-gradient(circle at 50% 120%, #2b3a55, #05060a 70%)';
listeners.style(q.get('style') as StyleName);
const state: OverlayState = {
  nowPlaying: { title: 't', artist: 'a', album: 'b', durationMs: 20000, positionMs: t, playing: false, source: 'spotify' },
  lyrics: { synced: true, lines }, lineIndex: 0, positionMs: t, queue: [],
};
listeners.state(state);
if (q.get('edit')) listeners.edit(true);
