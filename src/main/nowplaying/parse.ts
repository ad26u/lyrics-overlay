import type { NowPlaying } from '../../shared/types.ts';

export const MAC_SEP = '\u001f';

/** Output of the AppleScript in mac.ts: state, title, artist, album, durationMs, positionSec, artworkUrl. */
export function parseMacOutput(raw: string, source: 'spotify' | 'music'): NowPlaying | null {
  const f = raw.replace(/\r?\n$/, '').split(MAC_SEP);
  if (f.length < 6) return null;
  const [state, title, artist, album, dur, pos, art] = f;
  if (state !== 'playing' && state !== 'paused') return null;
  const durationMs = Math.round(parseFloat(dur.replace(',', '.')));
  const positionMs = Math.round(parseFloat(pos.replace(',', '.')) * 1000);
  if (!title || !Number.isFinite(durationMs) || !Number.isFinite(positionMs)) return null;
  const np: NowPlaying = { title, artist, album, durationMs, positionMs, playing: state === 'playing', source };
  if (art) np.coverUrl = art;
  return np;
}

/** One JSON line from helpers/win-media. */
export function parseHelperLine(line: string): NowPlaying | null {
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(line);
  } catch {
    return null;
  }
  if (!o || o.none || typeof o.title !== 'string' || !o.title) return null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const np: NowPlaying = {
    title: o.title,
    artist: typeof o.artist === 'string' ? o.artist : '',
    album: typeof o.album === 'string' ? o.album : '',
    durationMs: num(o.durationMs),
    positionMs: num(o.positionMs),
    playing: o.playing === true,
    source: 'smtc',
  };
  if (typeof o.thumbnailBase64 === 'string' && o.thumbnailBase64) np.coverDataUrl = `data:image/png;base64,${o.thumbnailBase64}`;
  return np;
}
