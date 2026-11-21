import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMacOutput } from '../../../src/main/nowplaying/parse.ts';

const SEP = '\u001f';

test('parses playing output', () => {
  const np = parseMacOutput(['playing', 'T', 'A', 'Al', '200000', '12.5', 'https://x'].join(SEP), 'spotify');
  assert.deepEqual(np, {
    title: 'T', artist: 'A', album: 'Al', durationMs: 200000, positionMs: 12500, playing: true, coverUrl: 'https://x', source: 'spotify',
  });
});

test('paused is not playing', () => {
  const np = parseMacOutput(['paused', 'T', 'A', 'Al', '200000', '3', ''].join(SEP), 'music');
  assert.equal(np?.playing, false);
  assert.equal(np?.coverUrl, undefined);
  assert.equal(np?.source, 'music');
});

test('stopped and empty give null', () => {
  assert.equal(parseMacOutput('stopped', 'spotify'), null);
  assert.equal(parseMacOutput('', 'spotify'), null);
  assert.equal(parseMacOutput('not running\n', 'spotify'), null);
});

test('handles comma decimal from localized osascript', () => {
  const np = parseMacOutput(['playing', 'T', 'A', 'Al', '200000', '12,5', ''].join(SEP), 'spotify');
  assert.equal(np?.positionMs, 12500);
});
