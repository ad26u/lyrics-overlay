import type { NowPlaying } from '../../shared/types.ts';

export interface NowPlayingSource {
  read(): Promise<NowPlaying | null>;
  dispose(): void;
}

/** helperPath: path to win-media.exe (Windows only). */
export async function createNowPlayingSource(helperPath: string): Promise<NowPlayingSource> {
  if (process.platform === 'win32') {
    const { WindowsNowPlaying } = await import('./windows.ts');
    return new WindowsNowPlaying(helperPath);
  }
  if (process.platform === 'darwin') {
    const { MacNowPlaying } = await import('./mac.ts');
    return new MacNowPlaying();
  }
  return { read: async () => null, dispose() {} };
}
