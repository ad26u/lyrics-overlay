export type LyricWord = { text: string; startMs: number };
export type LyricLine = { startMs: number; text: string; words: LyricWord[] };
export type Lyrics = { synced: boolean; lines: LyricLine[] };

export type NowPlaying = {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  positionMs: number;
  playing: boolean;
  coverUrl?: string;
  coverDataUrl?: string;
  source: 'spotify' | 'music' | 'smtc';
};

export type Rect = { x: number; y: number; width: number; height: number };
export type Bounds = Rect & { displayId: number };

export type StyleName = 'stars' | 'big' | 'simple';

export type AppSettings = {
  enabled: boolean;
  style: StyleName;
  lyricsBounds?: Bounds;
  circleSide: 'left' | 'right';
  openAtLogin: boolean;
  spotify?: { refreshToken: string };
};

export type QueueItem = { title: string; artist: string; coverUrl?: string };

export type OverlayState = {
  nowPlaying: NowPlaying | null;
  lyrics: Lyrics | null;
  lineIndex: number;
  positionMs: number;
  queue: QueueItem[];
};
