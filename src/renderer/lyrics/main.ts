import type { OverlayState, StyleName } from '../../shared/types.ts';
import { currentLineIndex } from '../../main/playback/clock.ts';
import { FALLBACK_PALETTE, paletteFromImage, type Palette } from './colors.ts';
import type { LyricStyle } from './styles/types.ts';
import { StarsStyle } from './styles/stars.ts';
import { BigStyle } from './styles/big.ts';
import { SimpleStyle } from './styles/simple.ts';
import { DrawnStyle } from './styles/drawn.ts';

const STYLES: Record<StyleName, () => LyricStyle> = {
  stars: () => new StarsStyle(),
  big: () => new BigStyle(),
  simple: () => new SimpleStyle(),
  drawn: () => new DrawnStyle(),
};

const root = document.getElementById('stage')!;
let style: LyricStyle = STYLES.stars();
style.mount(root);

let state: OverlayState | null = null;
let receivedAt = 0;
let palette: Palette = FALLBACK_PALETTE;
let lyricsRef: unknown = null;
let coverRef: string | undefined;
let raf = 0;

function loadPalette(src: string | undefined): Promise<Palette> {
  if (!src) return Promise.resolve(FALLBACK_PALETTE);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 32;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0, 32, 32);
        resolve(paletteFromImage(ctx.getImageData(0, 0, 32, 32).data));
      } catch {
        resolve(FALLBACK_PALETTE); // tainted canvas (no CORS)
      }
    };
    img.onerror = () => resolve(FALLBACK_PALETTE);
    img.src = src;
  });
}

function position(now: number): number {
  if (!state?.nowPlaying) return 0;
  const p = state.positionMs + (state.nowPlaying.playing ? now - receivedAt : 0);
  return Math.min(p, state.nowPlaying.durationMs || Infinity);
}

function tick() {
  raf = 0;
  if (!state?.lyrics) return;
  const pos = position(performance.now());
  style.frame(pos, currentLineIndex(state.lyrics.lines, pos));
  if (state.nowPlaying?.playing) raf = requestAnimationFrame(tick);
}

function kick() {
  if (!raf) raf = requestAnimationFrame(tick);
}

window.overlay.onState(async (s) => {
  state = s;
  receivedAt = performance.now();
  const cover = s.nowPlaying?.coverDataUrl ?? s.nowPlaying?.coverUrl;
  if (cover !== coverRef) {
    coverRef = cover;
    palette = await loadPalette(cover);
    lyricsRef = null; // re-apply palette
  }
  if (s.lyrics && s.lyrics !== lyricsRef && JSON.stringify(s.lyrics) !== JSON.stringify(lyricsRef)) {
    lyricsRef = s.lyrics;
    style.setLyrics(s.lyrics, palette);
  }
  kick();
});

window.overlay.onStyle((name) => {
  style.unmount();
  style = (STYLES[name] ?? STYLES.stars)();
  style.mount(root);
  if (state?.lyrics) style.setLyrics(state.lyrics, palette);
  kick();
});

window.overlay.onEditMode((on) => document.body.classList.toggle('edit', on));
document.getElementById('done')!.addEventListener('click', () => window.overlay.finishEdit());
document.querySelectorAll<HTMLButtonElement>('#editbar [data-f]').forEach((b) =>
  b.addEventListener('click', () => window.overlay.resize(Number(b.dataset.f))),
);
