import type { OverlayState, StyleName } from '../shared/types.ts';

declare global {
  interface Window {
    overlay: {
      onState(cb: (s: OverlayState) => void): void;
      onStyle(cb: (s: StyleName) => void): void;
      onEditMode(cb: (on: boolean) => void): void;
      onSide(cb: (side: 'left' | 'right') => void): void;
      finishEdit(): void;
      setHover(hover: boolean): void;
    };
  }
}
export {};
