import type { Side } from '../content/schema';

/** Centre of a square in an 8×8 viewBox, respecting orientation. */
export function squareCenter(square: string, orientation: Side): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  return orientation === 'white'
    ? { x: file + 0.5, y: 8 - rank + 0.5 }
    : { x: 7 - file + 0.5, y: rank - 1 + 0.5 };
}

/** Top-left corner of a square in an 8×8 viewBox. */
export function squareOrigin(square: string, orientation: Side): { x: number; y: number } {
  const c = squareCenter(square, orientation);
  return { x: c.x - 0.5, y: c.y - 0.5 };
}
