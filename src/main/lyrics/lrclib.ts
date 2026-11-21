import type { Lyrics, NowPlaying } from '../../shared/types.ts';
import type { LyricsCache } from './cache.ts';
import { parseLrc } from './lrc.ts';

const BASE = 'https://lrclib.net';
const HEADERS = { 'User-Agent': 'LyricsOverlay/0.1 (https://github.com/ad26u)' };

type LrclibRecord = { duration?: number; syncedLyrics?: string | null; plainLyrics?: string | null };

export function cacheKey(np: NowPlaying): string {
  return `${np.artist}|${np.title}|${Math.round(np.durationMs / 1000)}`.toLowerCase();
}

function toLyrics(rec: LrclibRecord | undefined): Lyrics | null {
  if (!rec?.syncedLyrics) return null;
  const lines = parseLrc(rec.syncedLyrics);
  return lines.length ? { synced: true, lines } : null;
}

export async function fetchLyrics(
  np: NowPlaying,
  deps: { fetch: typeof fetch; cache: LyricsCache },
): Promise<Lyrics | null> {
  const key = cacheKey(np);
  const cached = deps.cache.get(key);
  if (cached !== undefined) return cached;

  const seconds = Math.round(np.durationMs / 1000);
  try {
    const get = new URL('/api/get', BASE);
    get.search = new URLSearchParams({
      track_name: np.title, artist_name: np.artist, album_name: np.album, duration: String(seconds),
    }).toString();
    const r = await deps.fetch(get, { headers: HEADERS });
    let result: Lyrics | null = null;
    if (r.ok) result = toLyrics((await r.json()) as LrclibRecord);
    else if (r.status !== 404) return null; // server trouble: don't cache, retry later

    if (!result) {
      const search = new URL('/api/search', BASE);
      search.search = new URLSearchParams({ track_name: np.title, artist_name: np.artist }).toString();
      const s = await deps.fetch(search, { headers: HEADERS });
      if (!s.ok) return null;
      const list = (await s.json()) as LrclibRecord[];
      const best = list.find((x) => x.syncedLyrics && Math.abs((x.duration ?? 0) - np.durationMs / 1000) <= 3);
      result = toLyrics(best);
    }
    deps.cache.set(key, result);
    return result;
  } catch {
    return null;
  }
}
