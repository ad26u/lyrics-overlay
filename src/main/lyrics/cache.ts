import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Lyrics } from '../../shared/types.ts';

/** One JSON file per key. undefined = not cached, null = cached "no lyrics". */
export class LyricsCache {
  constructor(private dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  private file(key: string) {
    return join(this.dir, createHash('sha1').update(key).digest('hex') + '.json');
  }

  get(key: string): Lyrics | null | undefined {
    try {
      return JSON.parse(readFileSync(this.file(key), 'utf8')).value as Lyrics | null;
    } catch {
      return undefined;
    }
  }

  set(key: string, value: Lyrics | null): void {
    const f = this.file(key);
    writeFileSync(f + '.tmp', JSON.stringify({ value }));
    renameSync(f + '.tmp', f);
  }
}
