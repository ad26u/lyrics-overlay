import type { QueueItem } from '../../shared/types.ts';
import { tokenRequest } from './auth.ts';

type SpotifyTrack = { name?: string; artists?: { name: string }[]; album?: { images?: { url: string }[] }; show?: { images?: { url: string }[] } };

export class SpotifyClient {
  private access: string | null = null;
  private expiresAt = 0;

  constructor(
    private clientId: string,
    private refreshToken: string,
    private f: typeof fetch = fetch,
    private onRefreshToken: (t: string) => void = () => {},
  ) {}

  private async token(force = false): Promise<string> {
    if (!force && this.access && Date.now() < this.expiresAt - 30_000) return this.access;
    const t = await tokenRequest(this.f, { grant_type: 'refresh_token', refresh_token: this.refreshToken, client_id: this.clientId });
    this.access = t.access_token;
    this.expiresAt = Date.now() + (t.expires_in ?? 3600) * 1000;
    if (t.refresh_token && t.refresh_token !== this.refreshToken) {
      this.refreshToken = t.refresh_token;
      this.onRefreshToken(t.refresh_token);
    }
    return this.access;
  }

  async queue(): Promise<QueueItem[]> {
    try {
      let r = await this.f('https://api.spotify.com/v1/me/player/queue', { headers: { Authorization: `Bearer ${await this.token()}` } });
      if (r.status === 401) {
        r = await this.f('https://api.spotify.com/v1/me/player/queue', { headers: { Authorization: `Bearer ${await this.token(true)}` } });
      }
      if (!r.ok || r.status === 204) return [];
      const body = (await r.json()) as { queue?: SpotifyTrack[] };
      return (body.queue ?? []).slice(0, 4).map((t) => {
        const imgs = t.album?.images ?? t.show?.images ?? [];
        const item: QueueItem = { title: t.name ?? '', artist: t.artists?.[0]?.name ?? '' };
        const url = imgs[imgs.length - 1]?.url;
        if (url) item.coverUrl = url;
        return item;
      });
    } catch {
      return [];
    }
  }
}
