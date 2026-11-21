import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchLyrics, cacheKey } from '../../../src/main/lyrics/lrclib.ts';
import { LyricsCache } from '../../../src/main/lyrics/cache.ts';
import type { NowPlaying } from '../../../src/shared/types.ts';

const np: NowPlaying = { title: 'Song', artist: 'Band', album: 'Alb', durationMs: 200400, positionMs: 0, playing: true, source: 'spotify' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let cache: LyricsCache;
let calls: { url: string; headers: Headers }[];
beforeEach(() => {
  cache = new LyricsCache(mkdtempSync(join(tmpdir(), 'lyr-')));
  calls = [];
});
const fakeFetch = (handler: (url: URL) => Response | Promise<Response>) =>
  (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url: url.toString(), headers: new Headers(init?.headers) });
    return handler(url);
  }) as typeof fetch;

test('uses /api/get with track_name, artist_name, album_name, duration (seconds)', async () => {
  const f = fakeFetch(() => json(200, { syncedLyrics: '[00:01.00]hi', plainLyrics: 'hi' }));
  const res = await fetchLyrics(np, { fetch: f, cache });
  const u = new URL(calls[0].url);
  assert.equal(u.pathname, '/api/get');
  assert.equal(u.searchParams.get('track_name'), 'Song');
  assert.equal(u.searchParams.get('artist_name'), 'Band');
  assert.equal(u.searchParams.get('album_name'), 'Alb');
  assert.equal(u.searchParams.get('duration'), '200');
  assert.equal(res?.synced, true);
  assert.equal(res?.lines[0].text, 'hi');
});

test('falls back to /api/search when get is 404', async () => {
  const f = fakeFetch((u) =>
    u.pathname === '/api/get'
      ? json(404, {})
      : json(200, [
          { duration: 150, syncedLyrics: '[00:01.00]wrong' },
          { duration: 202, syncedLyrics: null, plainLyrics: 'p' },
          { duration: 201, syncedLyrics: '[00:01.00]right' },
        ]),
  );
  const res = await fetchLyrics(np, { fetch: f, cache });
  const u = new URL(calls[1].url);
  assert.equal(u.pathname, '/api/search');
  assert.equal(u.searchParams.get('track_name'), 'Song');
  assert.equal(u.searchParams.get('artist_name'), 'Band');
  assert.equal(res?.lines[0].text, 'right');
});

test('returns null when only plainLyrics exist', async () => {
  const f = fakeFetch((u) => (u.pathname === '/api/get' ? json(200, { syncedLyrics: null, plainLyrics: 'x' }) : json(200, [])));
  assert.equal(await fetchLyrics(np, { fetch: f, cache }), null);
});

test('caches hits and misses', async () => {
  const hit = fakeFetch(() => json(200, { syncedLyrics: '[00:01.00]hi' }));
  await fetchLyrics(np, { fetch: hit, cache });
  const n = calls.length;
  await fetchLyrics(np, { fetch: hit, cache });
  assert.equal(calls.length, n);

  const other = { ...np, title: 'Other' };
  const miss = fakeFetch((u) => (u.pathname === '/api/get' ? json(404, {}) : json(200, [])));
  assert.equal(await fetchLyrics(other, { fetch: miss, cache }), null);
  const m = calls.length;
  assert.equal(await fetchLyrics(other, { fetch: miss, cache }), null);
  assert.equal(calls.length, m);
});

test('network error returns null and does not cache', async () => {
  const boom = fakeFetch(() => { throw new TypeError('offline'); });
  assert.equal(await fetchLyrics(np, { fetch: boom, cache }), null);
  assert.equal(cache.get(cacheKey(np)), undefined);
});

test('sets User-Agent header', async () => {
  const f = fakeFetch(() => json(200, { syncedLyrics: '[00:01.00]hi' }));
  await fetchLyrics(np, { fetch: f, cache });
  assert.equal(calls[0].headers.get('user-agent'), 'LyricsOverlay/0.1 (https://github.com/ad26u)');
});

test('cacheKey is versioned lowercase artist|title|seconds', () => {
  assert.equal(cacheKey(np), 'v2|band|song|200');
});

test('search accepts a different version up to 10 s longer and picks the closest', async () => {
  // Real case: Spotify "Kiss from a Rose" is 283.2 s, LRCLIB has 287.9 / 288 / 289 s.
  const rose = { ...np, title: 'Kiss from a Rose', artist: 'Seal', album: 'Hits', durationMs: 283173 };
  const f = fakeFetch((u) =>
    u.pathname === '/api/get'
      ? json(404, {})
      : json(200, [
          { duration: 289, syncedLyrics: '[00:01.00]far' },
          { duration: 287.89, syncedLyrics: '[00:01.00]closest' },
          { duration: 310, syncedLyrics: '[00:01.00]too far' },
        ]),
  );
  const res = await fetchLyrics(rose, { fetch: f, cache });
  assert.equal(res?.lines[0].text, 'closest');
});

test('search rejects versions more than 10 s apart', async () => {
  const f = fakeFetch((u) => (u.pathname === '/api/get' ? json(404, {}) : json(200, [{ duration: 215, syncedLyrics: '[00:01.00]x' }])));
  assert.equal(await fetchLyrics(np, { fetch: f, cache }), null);
});

test('cache survives a new instance', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lyr-'));
  new LyricsCache(dir).set('k', { synced: true, lines: [] });
  assert.deepEqual(new LyricsCache(dir).get('k'), { synced: true, lines: [] });
});
