import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLrc } from '../../../src/main/lyrics/lrc.ts';

test('parses line timestamps', () => {
  assert.deepEqual(parseLrc('[00:12.50]hello world'), [
    { startMs: 12500, text: 'hello world', words: [{ text: 'hello', startMs: 12500 }, { text: 'world', startMs: 12500 }] },
  ]);
});

test('parses enhanced word tags', () => {
  const [l] = parseLrc('[00:01.00]<00:01.00>a <00:01.40>b');
  assert.equal(l.text, 'a b');
  assert.deepEqual(l.words, [{ text: 'a', startMs: 1000 }, { text: 'b', startMs: 1400 }]);
});

test('multiple timestamps on one line produce one line each', () => {
  assert.deepEqual(parseLrc('[00:01.00][00:05.00]x').map((l) => l.startMs), [1000, 5000]);
});

test('ignores metadata tags and empty text', () => {
  const lines = parseLrc('[ar:x]\n[00:02.00]\n[00:03.00]y');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].startMs, 3000);
});

test('sorts by time', () => {
  assert.deepEqual(parseLrc('[00:09.00]b\n[00:01.00]a').map((l) => l.text), ['a', 'b']);
});

test('handles 3-digit ms and minutes over 59', () => {
  assert.equal(parseLrc('[61:00.123]z')[0].startMs, 61 * 60000 + 123);
});
