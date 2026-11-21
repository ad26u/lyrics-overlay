import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Orchestrator } from '../../src/main/orchestrator.ts';
import type { Lyrics, NowPlaying, OverlayState } from '../../src/shared/types.ts';

const flush = () => new Promise((r) => setImmediate(r));
const song = (p: Partial<NowPlaying> = {}): NowPlaying => ({
  title: 'S', artist: 'A', album: 'B', durationMs: 200000, positionMs: 1000, playing: true, source: 'spotify', ...p,
});
const LYR: Lyrics = { synced: true, lines: [
  { startMs: 0, text: 'ab cd', words: [{ text: 'ab', startMs: 0 }, { text: 'cd', startMs: 0 }] },
  { startMs: 1000, text: 'x', words: [{ text: 'x', startMs: 1000 }] },
] };

function rig(opts: { np?: NowPlaying | null; lyrics?: Lyrics | null } = {}) {
  let current: NowPlaying | null = opts.np === undefined ? song() : opts.np;
  let clock = 0;
  const log = { fetches: 0, queues: 0, timers: [] as number[], lyrics: [] as string[], circle: [] as string[], lyricsSent: [] as OverlayState[] };
  const win = (name: 'lyrics' | 'circle') => ({
    show: () => log[name].push('show'),
    hide: () => log[name].push('hide'),
    send: (s: OverlayState) => { if (name === 'lyrics') log.lyricsSent.push(s); },
  });
  const o = new Orchestrator({
    source: { read: async () => current, dispose() {} },
    fetchLyrics: async () => { log.fetches++; return opts.lyrics === undefined ? LYR : opts.lyrics; },
    getQueue: async () => { log.queues++; return [{ title: 'Q', artist: 'R' }]; },
    lyrics: win('lyrics'),
    circle: win('circle'),
    now: () => clock,
    setTimer: (_fn, ms) => { log.timers.push(ms); return 0; },
  });
  return {
    o, log,
    set: (np: NowPlaying | null) => (current = np),
    advance: (ms: number) => (clock += ms),
    tick: async () => { await o.tick(); await flush(); },
  };
}

const last = <T>(a: T[]) => a[a.length - 1];

test('idle polls every 2000 ms and keeps windows hidden', async () => {
  const r = rig({ np: null });
  await r.tick();
  assert.equal(last(r.log.timers), 2000);
  assert.ok(!r.log.lyrics.includes('show'));
  assert.ok(!r.log.circle.includes('show'));
});

test('playing polls every 1000 ms', async () => {
  const r = rig();
  await r.tick();
  assert.equal(last(r.log.timers), 1000);
});

test('song change fetches lyrics once; same song does not refetch', async () => {
  const r = rig();
  await r.tick();
  await r.tick();
  assert.equal(r.log.fetches, 1);
  r.set(song({ title: 'Other' }));
  await r.tick();
  assert.equal(r.log.fetches, 2);
});

test('words are spread before sending', async () => {
  const r = rig();
  await r.tick();
  await r.tick();
  const s = last(r.log.lyricsSent);
  assert.deepEqual(s.lyrics!.lines[0].words.map((w) => w.startMs), [0, 500]);
});

test('no lyrics: circle shown, lyrics window hidden', async () => {
  const r = rig({ lyrics: null });
  await r.tick();
  await r.tick();
  assert.equal(last(r.log.circle), 'show');
  assert.ok(!r.log.lyrics.includes('show'));
});

test('source returns null after playing: both hide on that tick', async () => {
  const r = rig();
  await r.tick();
  await r.tick();
  assert.equal(last(r.log.lyrics), 'show');
  r.set(null);
  await r.tick();
  assert.equal(last(r.log.lyrics), 'hide');
  assert.equal(last(r.log.circle), 'hide');
  assert.equal(last(r.log.timers), 2000);
});

test('paused keeps windows shown with frozen position', async () => {
  const r = rig();
  await r.tick();
  await r.tick();
  r.set(song({ playing: false, positionMs: 5000 }));
  await r.tick();
  assert.equal(last(r.log.lyrics), 'show');
  assert.equal(last(r.log.circle), 'show');
  const s = last(r.log.lyricsSent);
  assert.equal(s.positionMs, 5000);
  assert.equal(s.nowPlaying!.playing, false);
});

test('setEnabled(false) hides both and stops sending', async () => {
  const r = rig();
  await r.tick();
  await r.tick();
  r.o.setEnabled(false);
  assert.equal(last(r.log.lyrics), 'hide');
  assert.equal(last(r.log.circle), 'hide');
  const sent = r.log.lyricsSent.length;
  await r.tick();
  assert.equal(r.log.lyricsSent.length, sent);
});

test('queue refreshed on song change and every 15 s while playing', async () => {
  const r = rig();
  await r.tick();
  assert.equal(r.log.queues, 1);
  r.advance(5000);
  await r.tick();
  assert.equal(r.log.queues, 1);
  r.advance(10000);
  await r.tick();
  assert.equal(r.log.queues, 2);
  r.set(song({ title: 'New' }));
  r.advance(1000);
  await r.tick();
  assert.equal(r.log.queues, 3);
});

test('stale lyrics from previous song are ignored', async () => {
  let resolveFirst!: (l: Lyrics) => void;
  let calls = 0;
  const sent: OverlayState[] = [];
  let np: NowPlaying = song({ title: 'One' });
  const o = new Orchestrator({
    source: { read: async () => np, dispose() {} },
    fetchLyrics: () => (++calls === 1 ? new Promise((r) => (resolveFirst = r)) : Promise.resolve(null)),
    getQueue: async () => [],
    lyrics: { show() {}, hide() {}, send: (s) => sent.push(s) },
    circle: { show() {}, hide() {}, send() {} },
    now: () => 0,
    setTimer: () => 0,
  });
  await o.tick();
  np = song({ title: 'Two' });
  await o.tick();
  await flush();
  resolveFirst(LYR);
  await flush();
  assert.equal(last(sent).lyrics, null);
});
