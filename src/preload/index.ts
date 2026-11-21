import { contextBridge, ipcRenderer } from 'electron';
import type { OverlayState, StyleName } from '../shared/types.ts';

const on = <T>(channel: string, cb: (v: T) => void) => {
  ipcRenderer.on(channel, (_e, v: T) => cb(v));
};

contextBridge.exposeInMainWorld('overlay', {
  onState: (cb: (s: OverlayState) => void) => on('overlay:state', cb),
  onStyle: (cb: (s: StyleName) => void) => on('overlay:style', cb),
  onEditMode: (cb: (on: boolean) => void) => on('overlay:edit', cb),
  onSide: (cb: (side: 'left' | 'right') => void) => on('overlay:side', cb),
  finishEdit: () => ipcRenderer.send('overlay:finish-edit'),
  resize: (factor: number) => ipcRenderer.send('overlay:resize', factor),
  setHover: (hover: boolean) => ipcRenderer.send('overlay:hover', hover),
});
