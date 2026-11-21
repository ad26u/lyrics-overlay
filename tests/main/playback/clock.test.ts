import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackClock, currentLineIndex, spreadWords } from '../../../src/main/playback/clock.ts';
import type { NowPlaying, LyricLine } from '../../../src/shared/types.ts';

const np = (p: Partial<NowPlaying>): NowPlaying => ({
  title: 't', artist: 'a', album: 'al', durationMs: 200000, positionMs: 0, playing: true, source: 'spotify', ...p,
});

test('interpolates while playing', () => {
  const c = new PlaybackClock();
  c.update(np({ positionMs: 10000, playing: true }), 0);
  assert.equal(c.positionAt(500), 10500);
});

test('freezes while paused', () => {
  const c = new PlaybackClock();
  c.update(np({ positionMs: 10000, playing: false }), 0);
  assert.equal(c.positionAt(5000), 10000);
});

test('seek resets', () => {
  const c = new PlaybackClock();
  c.update(np({ positionMs: 10000 }), 0);
  c.update(np({ positionMs: 60000 }), 1000);
  assert.equal(c.positionAt(1200), 60200);
});

test('clamps to duration', () => {
  const c = new PlaybackClock();
  c.update(np({ positionMs: 199000, durationMs: 200000 }), 0);
  assert.equal(c.positionAt(5000), 200000);
});

test('no update yet returns 0', () => {
  assert.equal(new PlaybackClock().positionAt(100), 0);
});

const line = (startMs: number, text = 'x'): LyricLine => ({ startMs, text, words: [{ text, startMs }] });

test('currentLineIndex', () => {
  const lines = [line(1000), line(5000), line(9000)];
  assert.equal(currentLineIndex(lines, 500), -1);
  assert.equal(currentLineIndex(lines, 5000), 1);
  assert.equal(currentLineIndex(lines, 99999), 2);
  assert.equal(currentLineIndex([], 100), -1);
});

test('spreadWords spaces evenly by char count', () => {
  const l: LyricLine = { startMs: 0, text: 'ab cd', words: [{ text: 'ab', startMs: 0 }, { text: 'cd', startMs: 0 }] };
  assert.deepEqual(spreadWords(l, 1000).map((w) => w.startMs), [0, 500]);
});

test('spreadWords keeps real word timings', () => {
  const l: LyricLine = { startMs: 0, text: 'a b', words: [{ text: 'a', startMs: 0 }, { text: 'b', startMs: 300 }] };
  assert.deepEqual(spreadWords(l, 1000).map((w) => w.startMs), [0, 300]);
});
