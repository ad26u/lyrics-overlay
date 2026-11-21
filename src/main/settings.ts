import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { AppSettings, Bounds, Rect, StyleName } from '../shared/types.ts';

export const DEFAULT_SETTINGS: AppSettings = { enabled: true, style: 'stars', circleSide: 'left', openAtLogin: false };
const STYLES: StyleName[] = ['stars', 'big', 'simple'];

export function loadSettings(file: string): AppSettings {
  let raw: Partial<AppSettings>;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  const s: AppSettings = { ...DEFAULT_SETTINGS, ...raw };
  if (!STYLES.includes(s.style)) s.style = DEFAULT_SETTINGS.style;
  if (s.circleSide !== 'left' && s.circleSide !== 'right') s.circleSide = 'left';
  return s;
}

export function saveSettings(file: string, s: AppSettings): void {
  writeFileSync(file + '.tmp', JSON.stringify(s, null, 2));
  renameSync(file + '.tmp', file);
}

function visibleFraction(b: Rect, area: Rect): number {
  const w = Math.max(0, Math.min(b.x + b.width, area.x + area.width) - Math.max(b.x, area.x));
  const h = Math.max(0, Math.min(b.y + b.height, area.y + area.height) - Math.max(b.y, area.y));
  return b.width * b.height ? (w * h) / (b.width * b.height) : 0;
}

/** Keep saved lyrics bounds on a real, visible display. */
export function clampBounds(b: Bounds, displays: { id: number; workArea: Rect }[]): Bounds {
  const own = displays.find((d) => d.id === b.displayId);
  if (own && visibleFraction(b, own.workArea) >= 0.5) {
    const wa = own.workArea;
    if (b.width <= wa.width && b.height <= wa.height) return b;
  }
  const target = own ?? displays[0];
  const wa = target.workArea;
  const width = Math.min(b.width, wa.width);
  const height = Math.min(b.height, wa.height);
  const x = Math.min(Math.max(b.x, wa.x), wa.x + wa.width - width);
  const y = Math.min(Math.max(b.y, wa.y), wa.y + wa.height - height);
  return { x, y, width, height, displayId: target.id };
}
