import type { OverlayState } from '../src/shared/types.ts';
const L: Record<string, (v: any) => void> = {};
(window as any).overlay = { onState: (c: any) => (L.s = c), onSide: (c: any) => (L.side = c), setHover() {}, onStyle() {}, onEditMode() {}, finishEdit() {} };
await import('../src/renderer/circle/main.ts');
document.documentElement.style.background = '#0b0f1a';
const q = new URLSearchParams(location.search);
const red = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#c0281c"/><circle cx="24" cy="30" r="12" fill="#f5d0a0"/></svg>');
const s: OverlayState = {
  nowPlaying: { title: 'One Minute More', artist: 'Some Band', album: 'x', durationMs: 1, positionMs: 0, playing: true, source: 'spotify', coverUrl: red },
  lyrics: null, lineIndex: -1, positionMs: 0,
  queue: [{ title: 'Ride', artist: 'Twenty One Pilots', coverUrl: red }, { title: 'Resilience', artist: 'Artist', coverUrl: red }, { title: 'Do I Wanna Know?', artist: 'Arctic Monkeys', coverUrl: red }],
};
L.side(q.get('side') ?? 'left');
L.s(s);
if (q.get('open')) document.body.classList.add('open');
