import { shell } from 'electron';
import type { QueueItem } from '../../shared/types.ts';
import { login } from './auth.ts';
import { SpotifyClient } from './queue.ts';

// Set at build time from .env (electron-vite exposes MAIN_VITE_* to the main process).
const CLIENT_ID: string = (import.meta as any).env?.MAIN_VITE_SPOTIFY_CLIENT_ID ?? process.env.SPOTIFY_CLIENT_ID ?? '';

/** Optional Spotify hookup: no token or no client id → empty queue. */
export function createSpotifyQueue(getToken: () => string | undefined, setToken: (t: string | undefined) => void) {
  let client: SpotifyClient | null = null;
  let clientToken: string | undefined;

  const current = () => {
    const t = getToken();
    if (!t || !CLIENT_ID) return null;
    if (!client || clientToken !== t) {
      client = new SpotifyClient(CLIENT_ID, t, fetch, (nt) => { clientToken = nt; setToken(nt); });
      clientToken = t;
    }
    return client;
  };

  return {
    queue: async (): Promise<QueueItem[]> => (await current()?.queue()) ?? [],
    login: async () => {
      if (!CLIENT_ID) return;
      try {
        setToken(await login(CLIENT_ID, (u) => void shell.openExternal(u)));
      } catch {
        /* user cancelled or timed out */
      }
    },
  };
}
