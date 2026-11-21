import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHelperLine } from '../../../src/main/nowplaying/parse.ts';

test('parses helper JSON', () => {
  const np = parseHelperLine(JSON.stringify({
    title: 'T', artist: 'A', album: 'Al', durationMs: 1000, positionMs: 10, playing: true, thumbnailBase64: 'QUJD',
  }));
  assert.deepEqual(np, {
    title: 'T', artist: 'A', album: 'Al', durationMs: 1000, positionMs: 10, playing: true,
    coverDataUrl: 'data:image/png;base64,QUJD', source: 'smtc',
  });
});

test('none gives null', () => {
  assert.equal(parseHelperLine('{"none":true}'), null);
});

test('malformed gives null', () => {
  assert.equal(parseHelperLine('{oops'), null);
  assert.equal(parseHelperLine('{"title":5}'), null);
});
