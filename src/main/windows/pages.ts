import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserWindow } from 'electron';

const here = fileURLToPath(new URL('.', import.meta.url));

export const PRELOAD = join(here, '../preload/index.cjs');

/** Loads src/renderer/<page>/index.html in dev and prod. */
export function loadPage(win: BrowserWindow, page: 'lyrics' | 'circle'): Promise<void> {
  const dev = process.env.ELECTRON_RENDERER_URL;
  return dev ? win.loadURL(`${dev}/${page}/index.html`) : win.loadFile(join(here, `../renderer/${page}/index.html`));
}
