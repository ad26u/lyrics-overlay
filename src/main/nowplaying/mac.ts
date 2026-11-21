import { execFile } from 'node:child_process';
import type { NowPlaying } from '../../shared/types.ts';
import { parseMacOutput } from './parse.ts';
import type { NowPlayingSource } from './index.ts';

// Each script checks "is running" first so we never launch the app.
const SEP = 'ASCII character 31';
const SPOTIFY = `
if application "Spotify" is running then
  tell application "Spotify"
    set s to (player state as string)
    if s is "stopped" then return "stopped"
    set t to current track
    return s & ${SEP} & (name of t) & ${SEP} & (artist of t) & ${SEP} & (album of t) & ${SEP} & ((duration of t) as integer) & ${SEP} & (player position) & ${SEP} & (artwork url of t)
  end tell
end if
return "not running"`;

const MUSIC = `
if application "Music" is running then
  tell application "Music"
    set s to (player state as string)
    if s is not "playing" and s is not "paused" then return "stopped"
    set t to current track
    return s & ${SEP} & (name of t) & ${SEP} & (artist of t) & ${SEP} & (album of t) & ${SEP} & ((round ((duration of t) * 1000)) as integer) & ${SEP} & (player position) & ${SEP} & ""
  end tell
end if
return "not running"`;

function run(script: string): Promise<string> {
  return new Promise((resolve) => {
    execFile('osascript', ['-e', script], { timeout: 1500 }, (err, stdout) => resolve(err ? '' : stdout));
  });
}

export class MacNowPlaying implements NowPlayingSource {
  async read(): Promise<NowPlaying | null> {
    const [sp, mu] = await Promise.all([run(SPOTIFY), run(MUSIC)]);
    const candidates = [parseMacOutput(sp, 'spotify'), parseMacOutput(mu, 'music')].filter(Boolean) as NowPlaying[];
    return candidates.find((c) => c.playing) ?? candidates[0] ?? null;
  }
  dispose(): void {}
}
