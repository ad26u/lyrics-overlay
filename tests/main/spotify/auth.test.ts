import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pkcePair, buildAuthUrl, REDIRECT_URI } from '../../../src/main/spotify/auth.ts';

test('pkcePair: 64-char verifier and S256 challenge', () => {
  const { verifier, challenge } = pkcePair();
  assert.equal(verifier.length, 64);
  assert.match(verifier, /^[A-Za-z0-9\-._~]+$/);
  assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'));
  assert.notEqual(pkcePair().verifier, verifier);
});

test('buildAuthUrl has the right params', () => {
  const u = new URL(buildAuthUrl('cid', 'chal', 'st'));
  assert.equal(u.origin + u.pathname, 'https://accounts.spotify.com/authorize');
  assert.equal(u.searchParams.get('client_id'), 'cid');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('redirect_uri'), 'http://127.0.0.1:43821/callback');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('code_challenge'), 'chal');
  assert.equal(u.searchParams.get('state'), 'st');
  assert.equal(u.searchParams.get('scope'), 'user-read-playback-state user-read-currently-playing');
  assert.equal(REDIRECT_URI, 'http://127.0.0.1:43821/callback');
});
