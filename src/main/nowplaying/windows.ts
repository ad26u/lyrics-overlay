import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { NowPlaying } from '../../shared/types.ts';
import { parseHelperLine } from './parse.ts';
import type { NowPlayingSource } from './index.ts';

/** Runs helpers/win-media (SMTC) and keeps its latest line. */
export class WindowsNowPlaying implements NowPlayingSource {
  private child: ChildProcess | null = null;
  private latest: NowPlaying | null = null;
  private cover = new Map<string, string>(); // song key -> data URL (helper only sends it on change)
  private disposed = false;

  constructor(private exePath: string) {
    this.startHelper();
  }

  private startHelper() {
    if (this.disposed) return;
    const child = spawn(this.exePath, [], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    this.child = child;
    createInterface({ input: child.stdout! }).on('line', (line) => {
      const np = parseHelperLine(line);
      if (np) {
        const key = `${np.artist}|${np.title}`;
        if (np.coverDataUrl) {
          this.cover.clear();
          this.cover.set(key, np.coverDataUrl);
        } else if (this.cover.has(key)) np.coverDataUrl = this.cover.get(key);
      }
      this.latest = np;
    });
    child.on('exit', () => {
      this.latest = null;
      if (!this.disposed) setTimeout(() => this.startHelper(), 2000);
    });
    child.on('error', () => {}); // exit handler restarts
  }

  async read(): Promise<NowPlaying | null> {
    return this.latest;
  }

  dispose(): void {
    this.disposed = true;
    this.child?.kill();
  }
}
