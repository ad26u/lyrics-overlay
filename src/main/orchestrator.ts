import type { Lyrics, NowPlaying, OverlayState, QueueItem } from '../shared/types.ts';
import { currentLineIndex, spreadWords } from './playback/clock.ts';
import type { NowPlayingSource } from './nowplaying/index.ts';

type Win = { show(): void; hide(): void; send(s: OverlayState): void };

export type OrchestratorDeps = {
  source: NowPlayingSource;
  fetchLyrics: (np: NowPlaying) => Promise<Lyrics | null>;
  getQueue: () => Promise<QueueItem[]>;
  lyrics: Win;
  circle: Win;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
};

export const POLL_PLAYING_MS = 1000;
export const POLL_IDLE_MS = 2000;
export const QUEUE_REFRESH_MS = 15000;

const songKey = (np: NowPlaying) => `${np.artist}|${np.title}|${Math.round(np.durationMs / 1000)}`;

function withSpreadWords(l: Lyrics): Lyrics {
  return {
    ...l,
    lines: l.lines.map((line, i) => ({ ...line, words: spreadWords(line, l.lines[i + 1]?.startMs ?? line.startMs + 4000) })),
  };
}

/** Polls the player, keeps lyrics and queue fresh, and drives both windows. */
export class Orchestrator {
  private enabled = true;
  private running = false;
  private key: string | null = null;
  private lyrics: Lyrics | null = null;
  private queue: QueueItem[] = [];
  private queueAt = -Infinity;
  private np: NowPlaying | null = null;

  constructor(private d: OrchestratorDeps) {}

  start(): void {
    this.running = true;
    void this.tick();
  }

  stop(): void {
    this.running = false;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) {
      this.d.lyrics.hide();
      this.d.circle.hide();
    } else if (this.np) {
      this.broadcast();
    }
  }

  private schedule(ms: number) {
    this.d.setTimer(() => {
      if (this.running) void this.tick();
    }, ms);
  }

  async tick(): Promise<void> {
    let np: NowPlaying | null = null;
    try {
      np = await this.d.source.read();
    } catch {
      np = null;
    }
    this.np = np;

    if (!np) {
      if (this.key !== null) {
        this.key = null;
        this.lyrics = null;
        this.queue = [];
      }
      this.d.lyrics.hide();
      this.d.circle.hide();
      this.schedule(POLL_IDLE_MS);
      return;
    }

    const key = songKey(np);
    const now = this.d.now();
    if (key !== this.key) {
      this.key = key;
      this.lyrics = null;
      this.queue = [];
      void this.loadLyrics(np, key);
      this.refreshQueue(now);
    } else if (np.playing && now - this.queueAt >= QUEUE_REFRESH_MS) {
      this.refreshQueue(now);
    }

    if (this.enabled) this.broadcast();
    this.schedule(np.playing ? POLL_PLAYING_MS : POLL_IDLE_MS);
  }

  private async loadLyrics(np: NowPlaying, key: string) {
    let l: Lyrics | null = null;
    try {
      l = await this.d.fetchLyrics(np);
    } catch {
      l = null;
    }
    if (key !== this.key) return; // song changed meanwhile
    this.lyrics = l ? withSpreadWords(l) : null;
    if (this.enabled && this.np) this.broadcast();
  }

  private refreshQueue(now: number) {
    this.queueAt = now;
    const key = this.key;
    this.d
      .getQueue()
      .catch(() => [] as QueueItem[])
      .then((q) => {
        if (key !== this.key) return;
        this.queue = q;
        if (this.enabled && this.np) this.broadcast();
      });
  }

  private broadcast() {
    const np = this.np!;
    const state: OverlayState = {
      nowPlaying: np,
      lyrics: this.lyrics,
      lineIndex: this.lyrics ? currentLineIndex(this.lyrics.lines, np.positionMs) : -1,
      positionMs: np.positionMs,
      queue: this.queue,
    };
    this.d.circle.show();
    if (this.lyrics) this.d.lyrics.show();
    else this.d.lyrics.hide();
    this.d.lyrics.send(state);
    this.d.circle.send(state);
  }
}
