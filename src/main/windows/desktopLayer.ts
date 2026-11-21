/**
 * Puts a BrowserWindow on the wallpaper layer: above the wallpaper,
 * below every app window.
 *
 * Windows: the "WorkerW" trick. Sending 0x052C to Progman makes Explorer
 * create a WorkerW window that sits between the wallpaper and the icons.
 * - Windows 11 24H2+: that WorkerW is a CHILD of Progman.
 * - Older builds: it is a top-level window, the sibling right after the
 *   WorkerW that holds SHELLDLL_DefView (the icons).
 *
 * macOS: a window created with type 'desktop' already lives at desktop
 * level. Use desktopWindowOptions() when constructing it.
 */
import { BrowserWindow, screen, type BrowserWindowConstructorOptions, type Rectangle } from 'electron';
import { createRequire } from 'node:module';

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

type Win32 = {
  FindWindowW: (cls: string | null, name: string | null) => bigint | number;
  FindWindowExW: (parent: bigint | number, after: bigint | number, cls: string | null, name: string | null) => bigint | number;
  SendMessageTimeoutW: (h: bigint | number, msg: number, w: number, l: number, flags: number, timeout: number, out: [number]) => bigint | number;
  EnumWindows: (cb: unknown, l: number) => boolean;
  SetParent: (child: bigint | number, parent: bigint | number) => bigint | number;
  SetWindowPos: (h: bigint | number, after: bigint | number, x: number, y: number, cx: number, cy: number, flags: number) => boolean;
  GetSystemMetrics: (i: number) => number;
  register: (fn: (h: bigint | number, l: number) => boolean) => unknown;
  unregister: (cb: unknown) => void;
};

let win32: Win32 | null = null;

function loadWin32(): Win32 {
  if (win32) return win32;
  const require = createRequire(import.meta.url);
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  const EnumProc = koffi.proto('bool __stdcall EnumProc(intptr hwnd, intptr lParam)');
  win32 = {
    FindWindowW: user32.func('intptr __stdcall FindWindowW(str16 cls, str16 name)'),
    FindWindowExW: user32.func('intptr __stdcall FindWindowExW(intptr parent, intptr after, str16 cls, str16 name)'),
    SendMessageTimeoutW: user32.func(
      'intptr __stdcall SendMessageTimeoutW(intptr h, uint msg, uintptr w, intptr l, uint flags, uint timeout, _Out_ uintptr *result)',
    ),
    EnumWindows: user32.func('bool __stdcall EnumWindows(EnumProc *cb, intptr l)'),
    SetParent: user32.func('intptr __stdcall SetParent(intptr child, intptr parent)'),
    SetWindowPos: user32.func('bool __stdcall SetWindowPos(intptr h, intptr after, int x, int y, int cx, int cy, uint flags)'),
    GetSystemMetrics: user32.func('int __stdcall GetSystemMetrics(int i)'),
    register: (fn) => koffi.register(fn, koffi.pointer(EnumProc)),
    unregister: (cb) => koffi.unregister(cb),
  };
  return win32;
}

function hwndOf(win: BrowserWindow): bigint {
  const buf = win.getNativeWindowHandle();
  return buf.length >= 8 ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0));
}

const isNull = (h: bigint | number) => BigInt(h) === 0n;

/** Finds (creating if needed) the WorkerW we can parent into. Returns 0n on failure. */
function findDesktopWorkerW(api: Win32): bigint {
  const progman = api.FindWindowW('Progman', null);
  if (isNull(progman)) return 0n;
  const SMTO_NORMAL = 0x0;
  api.SendMessageTimeoutW(progman, 0x052c, 0xd, 0x1, SMTO_NORMAL, 1000, [0]);
  api.SendMessageTimeoutW(progman, 0x052c, 0, 0, SMTO_NORMAL, 1000, [0]);

  // 24H2+: WorkerW is a child of Progman.
  const child = api.FindWindowExW(progman, 0, 'WorkerW', null);
  if (!isNull(child)) return BigInt(child);

  // Older layout: the WorkerW right after the one hosting SHELLDLL_DefView.
  let found = 0n;
  const cb = api.register((top) => {
    const defView = api.FindWindowExW(top, 0, 'SHELLDLL_DefView', null);
    if (!isNull(defView)) {
      const next = api.FindWindowExW(0, top, 'WorkerW', null);
      if (!isNull(next)) found = BigInt(next);
    }
    return true;
  });
  try {
    api.EnumWindows(cb, 0);
  } finally {
    api.unregister(cb);
  }
  return found;
}

let lastParent = 0n;

/** Options that must be set when the window is created. */
export function desktopWindowOptions(): BrowserWindowConstructorOptions {
  return {
    transparent: true,
    frame: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    show: false,
    backgroundColor: '#00000000',
    ...(isMac ? { type: 'desktop' } : {}),
  };
}

export async function attachToDesktop(win: BrowserWindow): Promise<boolean> {
  win.setIgnoreMouseEvents(true);
  if (isMac) {
    win.setAlwaysOnTop(false);
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    return true;
  }
  if (!isWin) return false;
  const api = loadWin32();
  const worker = findDesktopWorkerW(api);
  if (worker === 0n) return false;
  const bounds = win.getBounds();
  api.SetParent(hwndOf(win), worker);
  lastParent = worker;
  placeOnDesktop(win, bounds);
  return true;
}

/** Undo attachToDesktop so the window can be moved/resized (edit mode). */
export function detachFromDesktop(win: BrowserWindow): void {
  if (isMac) {
    win.setAlwaysOnTop(true, 'floating');
  } else if (isWin && lastParent !== 0n) {
    const bounds = win.getBounds();
    loadWin32().SetParent(hwndOf(win), 0);
    win.setBounds(bounds);
  }
  win.setIgnoreMouseEvents(false);
}

/**
 * Moves an attached window. Once parented, coordinates are relative to the
 * WorkerW, which starts at the virtual-screen origin, and are physical pixels.
 */
export function placeOnDesktop(win: BrowserWindow, dip: Rectangle): void {
  if (!isWin || lastParent === 0n) {
    win.setBounds(dip);
    return;
  }
  const api = loadWin32();
  const px = screen.dipToScreenRect(win, dip);
  const vx = api.GetSystemMetrics(76); // SM_XVIRTUALSCREEN
  const vy = api.GetSystemMetrics(77); // SM_YVIRTUALSCREEN
  const SWP_NOZORDER = 0x4, SWP_NOACTIVATE = 0x10;
  api.SetWindowPos(hwndOf(win), 0, px.x - vx, px.y - vy, px.width, px.height, SWP_NOZORDER | SWP_NOACTIVATE);
}
