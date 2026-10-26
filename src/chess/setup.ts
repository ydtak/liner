import type { Mark } from '../content/schema';
import { START_FEN } from '../content/loader';

const FILES = 'abcdefgh';

/** Square → piece code ("wP", "bN") for a FEN's placement field. */
export function piecesFromFen(fen: string): Map<string, string> {
  const pieces = new Map<string, string>();
  fen.split(' ')[0].split('/').forEach((row, i) => {
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        file += Number(ch);
        continue;
      }
      const color = ch === ch.toUpperCase() ? 'w' : 'b';
      pieces.set(`${FILES[file]}${8 - i}`, color + ch.toUpperCase());
      file++;
    }
  });
  return pieces;
}

const distance = (a: string, b: string) =>
  Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1])));

/**
 * Progress toward a setup formation. Only squares that differ from the starting
 * position count. A developed piece standing off-target (e.g. Bg3 instead of Bf4)
 * fills the nearest unmet target of its kind. Ghosts mark unmet, empty targets.
 */
export function setupProgress(setupFen: string, fen: string): { done: number; total: number; ghosts: Mark[] } {
  const target = piecesFromFen(setupFen);
  const start = piecesFromFen(START_FEN);
  const now = piecesFromFen(fen);
  const squaresOf = (map: Map<string, string>, piece: string) => [...map].filter(([, p]) => p === piece).map(([sq]) => sq);

  let done = 0;
  let total = 0;
  const ghosts: Mark[] = [];
  for (const piece of new Set(target.values())) {
    const targets = squaresOf(target, piece).filter((sq) => start.get(sq) !== piece);
    if (!targets.length) continue;
    total += targets.length;
    const current = squaresOf(now, piece);
    const unmet = targets.filter((sq) => !current.includes(sq));
    done += targets.length - unmet.length;

    // Pawns must be exactly placed; pieces developed elsewhere still count.
    if (piece[1] !== 'P') {
      const startSquares = squaresOf(start, piece);
      const free = current.filter((sq) => !targets.includes(sq) && !startSquares.includes(sq));
      for (const sq of free) {
        if (!unmet.length) break;
        unmet.sort((a, b) => distance(sq, a) - distance(sq, b));
        unmet.shift();
        done++;
      }
    }
    for (const square of unmet) if (!now.has(square)) ghosts.push({ type: 'ghost', square, piece });
  }
  return { done, total, ghosts };
}
