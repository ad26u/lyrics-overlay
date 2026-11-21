import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

export const REDIRECT_URI = 'http://127.0.0.1:43821/callback';
export const SCOPES = 'user-read-playback-state user-read-currently-playing';
export const TOKEN_URL = 'https://accounts.spotify.com/api/token';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

export function pkcePair(): { verifier: string; challenge: string } {
  const bytes = randomBytes(64);
  const verifier = Array.from(bytes, (b) => CHARS[b % CHARS.length]).join('');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function buildAuthUrl(clientId: string, challenge: string, state: string): string {
  const u = new URL('https://accounts.spotify.com/authorize');
  u.search = new URLSearchParams({
    client_id: clientId, response_type: 'code', redirect_uri: REDIRECT_URI, scope: SCOPES,
    code_challenge_method: 'S256', code_challenge: challenge, state,
  }).toString();
  return u.toString();
}

export type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number };

export async function tokenRequest(f: typeof fetch, params: Record<string, string>): Promise<TokenResponse> {
  const r = await f(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  if (!r.ok) throw new Error(`spotify token ${r.status}`);
  return (await r.json()) as TokenResponse;
}

/** Opens the browser, waits for the redirect on 127.0.0.1:43821, returns the refresh token. */
export function login(clientId: string, openUrl: (u: string) => void, f: typeof fetch = fetch): Promise<string> {
  const { verifier, challenge } = pkcePair();
  const state = randomBytes(12).toString('hex');
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const u = new URL(req.url ?? '/', REDIRECT_URI);
      if (u.pathname !== '/callback') { res.writeHead(404).end(); return; }
      const code = u.searchParams.get('code');
      const ok = code && u.searchParams.get('state') === state;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(ok ? '<h2 dir="rtl">تم ربط Spotify. تقدر تقفل الصفحة.</h2>' : '<h2 dir="rtl">ما تم الربط.</h2>');
      server.close();
      clearTimeout(timer);
      if (!ok) return reject(new Error('spotify login cancelled'));
      try {
        const t = await tokenRequest(f, {
          grant_type: 'authorization_code', code: code!, redirect_uri: REDIRECT_URI, client_id: clientId, code_verifier: verifier,
        });
        if (!t.refresh_token) throw new Error('no refresh token');
        resolve(t.refresh_token);
      } catch (e) {
        reject(e);
      }
    });
    const timer = setTimeout(() => { server.close(); reject(new Error('spotify login timeout')); }, 5 * 60_000);
    server.on('error', reject);
    server.listen(43821, '127.0.0.1', () => openUrl(buildAuthUrl(clientId, challenge, state)));
  });
}
