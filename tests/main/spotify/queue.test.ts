import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpotifyClient } from '../../../src/main/spotify/queue.ts';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const track = (n: string) => ({ name: n, artists: [{ name: n + '-artist' }], album: { images: [{ url: 'big' }, { url: 'small-' + n }] } });

function fake(routes: (url: string, n: number) => Response) {
  const calls: string[] = [];
  const f = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return routes(url, calls.length);
  }) as typeof fetch;
  return { f, calls };
}

test('queue maps name/artist/smallest image and returns max 4', async () => {
  const { f } = fake((url) =>
    url.includes('/api/token') ? json(200, { access_token: 'AT', expires_in: 3600 }) : json(200, { queue: ['a', 'b', 'c', 'd', 'e'].map(track) }),
  );
  const q = await new SpotifyClient('cid', 'RT', f).queue();
  assert.equal(q.length, 4);
  assert.deepEqual(q[0], { title: 'a', artist: 'a-artist', coverUrl: 'small-a' });
});

test('401 refreshes once then retries', async () => {
  let queueCalls = 0;
  let tokenCalls = 0;
  const { f } = fake((url) => {
    if (url.includes('/api/token')) { tokenCalls++; return json(200, { access_token: 'AT' + tokenCalls, expires_in: 3600 }); }
    queueCalls++;
    return queueCalls === 1 ? json(401, {}) : json(200, { queue: [track('x')] });
  });
  const q = await new SpotifyClient('cid', 'RT', f).queue();
  assert.equal(q.length, 1);
  assert.equal(tokenCalls, 2);
  assert.equal(queueCalls, 2);
});

test('refresh failure returns [] and does not throw', async () => {
  const { f } = fake(() => json(400, { error: 'invalid_grant' }));
  assert.deepEqual(await new SpotifyClient('cid', 'RT', f).queue(), []);
});

test('new refresh_token is persisted via callback', async () => {
  const saved: string[] = [];
  const { f } = fake((url) =>
    url.includes('/api/token') ? json(200, { access_token: 'AT', refresh_token: 'RT2', expires_in: 3600 }) : json(200, { queue: [] }),
  );
  await new SpotifyClient('cid', 'RT', f, (t) => saved.push(t)).queue();
  assert.deepEqual(saved, ['RT2']);
});

test('204 (no active device) gives []', async () => {
  const { f } = fake((url) => (url.includes('/api/token') ? json(200, { access_token: 'AT', expires_in: 3600 }) : new Response(null, { status: 204 })));
  assert.deepEqual(await new SpotifyClient('cid', 'RT', f).queue(), []);
});

test('access token is reused until expiry', async () => {
  const { f, calls } = fake((url) => (url.includes('/api/token') ? json(200, { access_token: 'AT', expires_in: 3600 }) : json(200, { queue: [] })));
  const c = new SpotifyClient('cid', 'RT', f);
  await c.queue();
  await c.queue();
  assert.equal(calls.filter((u) => u.includes('/api/token')).length, 1);
});
