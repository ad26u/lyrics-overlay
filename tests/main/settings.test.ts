import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSettings, saveSettings, clampBounds, DEFAULT_SETTINGS } from '../../src/main/settings.ts';

const tmp = () => join(mkdtempSync(join(tmpdir(), 'set-')), 'settings.json');

test('defaults on missing file', () => {
  assert.deepEqual(loadSettings(tmp()), { enabled: true, style: 'stars', circleSide: 'left', openAtLogin: false });
});

test('defaults on corrupt JSON', () => {
  const f = tmp();
  writeFileSync(f, '{nope');
  assert.deepEqual(loadSettings(f), DEFAULT_SETTINGS);
});

test('round-trip', () => {
  const f = tmp();
  const s = { ...DEFAULT_SETTINGS, style: 'big' as const, lyricsBounds: { x: 1, y: 2, width: 3, height: 4, displayId: 9 } };
  saveSettings(f, s);
  assert.deepEqual(loadSettings(f), s);
});

test('unknown style falls back to default', () => {
  const f = tmp();
  writeFileSync(f, JSON.stringify({ style: 'weird' }));
  assert.equal(loadSettings(f).style, 'stars');
});

const displays = [
  { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
  { id: 2, workArea: { x: 1920, y: 0, width: 2560, height: 1400 } },
];

test('clampBounds keeps visible bounds unchanged', () => {
  const b = { x: 2000, y: 100, width: 800, height: 200, displayId: 2 };
  assert.deepEqual(clampBounds(b, displays), b);
});

test('clampBounds moves bounds from a removed display onto displays[0]', () => {
  const b = { x: 5000, y: 100, width: 800, height: 200, displayId: 7 };
  const r = clampBounds(b, displays);
  assert.equal(r.displayId, 1);
  assert.ok(r.x >= 0 && r.x + r.width <= 1920);
  assert.ok(r.y >= 0 && r.y + r.height <= 1040);
  assert.equal(r.width, 800);
});

test('clampBounds moves mostly off-screen bounds', () => {
  const b = { x: 1800, y: 100, width: 800, height: 200, displayId: 1 };
  const r = clampBounds(b, [displays[0]]);
  assert.ok(r.x + r.width <= 1920);
});

test('clampBounds shrinks bounds larger than work area', () => {
  const r = clampBounds({ x: 0, y: 0, width: 5000, height: 3000, displayId: 1 }, displays);
  assert.equal(r.width, 1920);
  assert.equal(r.height, 1040);
});
