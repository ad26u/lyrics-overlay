import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRtl, splitWords } from '../../src/renderer/lyrics/text.ts';

test('isRtl uses first strong character', () => {
  assert.equal(isRtl('مرحبا hello'), true);
  assert.equal(isRtl('hello مرحبا'), false);
  assert.equal(isRtl('123 ... يا ليل'), true);
  assert.equal(isRtl('שלום'), true);
  assert.equal(isRtl('...'), false);
});

test('splitWords keeps Arabic words and drops empties', () => {
  assert.deepEqual(splitWords('  يا   ليل يا عين '), ['يا', 'ليل', 'يا', 'عين']);
  assert.deepEqual(splitWords('hello\tworld'), ['hello', 'world']);
  assert.deepEqual(splitWords(''), []);
});
