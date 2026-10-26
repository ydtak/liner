import type { Side } from '../content/schema';

const FILES = 'abcdefgh';

/** Transparent layer over the board that reports which square was clicked (drawing mode). */
export function SquarePicker({ orientation, onSquare }: { orientation: Side; onSquare: (square: string) => void }) {
  return (
    <div
      className="square-picker"
      onPointerDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.min(7, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * 8)));
        const y = Math.min(7, Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * 8)));
        const file = orientation === 'white' ? x : 7 - x;
        const rank = orientation === 'white' ? 8 - y : y + 1;
        onSquare(`${FILES[file]}${rank}`);
      }}
    />
  );
}
