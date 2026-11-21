import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paletteFromImage, FALLBACK_PALETTE } from '../../src/renderer/lyrics/colors.ts';

const fill = (r: number, g: number, b: number, n = 100) => {
  const a = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) a.set([r, g, b, 255], i * 4);
  return a;
};

test('all red gives red accent', () => {
  assert.equal(paletteFromImage(fill(220, 20, 20)).accent, 'hsl(0, 85%, 60%)');
});

test('all grey gives fallback', () => {
  assert.deepEqual(paletteFromImage(fill(128, 128, 128)), FALLBACK_PALETTE);
  assert.deepEqual(FALLBACK_PALETTE, { primary: '#ffffff', accent: '#ffb347', glow: '#ff8c1a' });
});

test('dominant hue wins over a few other pixels', () => {
  const a = new Uint8ClampedArray([...fill(20, 20, 220, 90), ...fill(20, 220, 20, 10)]);
  assert.equal(paletteFromImage(a).accent, 'hsl(240, 85%, 60%)');
});

test('empty buffer gives fallback', () => {
  assert.deepEqual(paletteFromImage(new Uint8ClampedArray()), FALLBACK_PALETTE);
});
