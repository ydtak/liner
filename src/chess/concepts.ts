import { Chess, type Color, type Square } from 'chess.js';
import type { Side } from '../content/schema';

// Auto-computed "principle" layers (docs/PRODUCT.md §6.5). They need no authoring,
// so they also explain positions off the curated tree.

export interface LayerToggles {
  centre: boolean;
  hanging: boolean;
  development: boolean;
  king: boolean;
}

export type ConceptMark =
  | { type: 'centre'; square: string; tone: 'you' | 'them' | 'even' }
  | { type: 'hanging'; square: string }
  | { type: 'undeveloped'; square: string }
  | { type: 'shield'; square: string }
  | { type: 'exposed'; square: string }; // on an open line toward a king

const FILES = 'abcdefgh';
const CENTRE = ['d4', 'e4', 'd5', 'e5'];
const MINOR_HOMES: Record<Color, Square[]> = { w: ['b1', 'g1', 'c1', 'f1'], b: ['b8', 'g8', 'c8', 'f8'] };
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const colorOf = (side: Side): Color => (side === 'white' ? 'w' : 'b');
const enemy = (c: Color): Color => (c === 'w' ? 'b' : 'w');

/** Who controls each centre square: more attackers wins. */
export function centreControl(chess: Chess, learner: Color): ConceptMark[] {
  return CENTRE.map((sq) => {
    const mine = chess.attackers(sq as Square, learner).length;
    const theirs = chess.attackers(sq as Square, enemy(learner)).length;
    const tone: 'you' | 'them' | 'even' = mine > theirs ? 'you' : theirs > mine ? 'them' : 'even';
    return { type: 'centre' as const, square: sq, tone };
  }).filter((m) => m.tone !== 'even' || hasAttackers(chess, m.square));
}

const hasAttackers = (chess: Chess, sq: string) =>
  chess.attackers(sq as Square, 'w').length + chess.attackers(sq as Square, 'b').length > 0;

/**
 * Pieces (not kings) that are attacked and either undefended or attacked by
 * something cheaper. Pins and exchanges are ignored: this is a beginner's warning
 * light, not an engine.
 */
export function hangingPieces(chess: Chess): string[] {
  const out: string[] = [];
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.type === 'k') continue;
      const attackers = chess.attackers(piece.square, enemy(piece.color));
      if (!attackers.length) continue;
      const defenders = chess.attackers(piece.square, piece.color);
      const cheapest = Math.min(...attackers.map((sq) => VALUE[chess.get(sq)!.type]));
      if (!defenders.length || cheapest < VALUE[piece.type]) out.push(piece.square);
    }
  }
  return out;
}

/** Knights and bishops still on their starting squares. */
export function undevelopedPieces(chess: Chess, color: Color): string[] {
  return MINOR_HOMES[color].filter((sq) => {
    const p = chess.get(sq);
    const home = sq[0] === 'b' || sq[0] === 'g' ? 'n' : 'b';
    return p?.color === color && p.type === home;
  });
}

export function developmentCount(fen: string, side: Side): { developed: number; total: number } {
  const chess = new Chess(fen);
  return { developed: 4 - undevelopedPieces(chess, colorOf(side)).length, total: 4 };
}

const DIRECTIONS: [number, number, 'line' | 'diag'][] = [
  [1, 0, 'line'], [-1, 0, 'line'], [0, 1, 'line'], [0, -1, 'line'],
  [1, 1, 'diag'], [1, -1, 'diag'], [-1, 1, 'diag'], [-1, -1, 'diag'],
];

/**
 * King safety: a shield on a castled king, and the squares of any line from an
 * enemy rook, bishop or queen to the king with at most one piece in the way
 * (a check, a pin, or a discovered attack waiting to happen).
 */
export function kingSafety(chess: Chess): ConceptMark[] {
  const marks: ConceptMark[] = [];
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece?.type !== 'k') continue;
      const back = piece.color === 'w' ? '1' : '8';
      if (piece.square[1] === back && 'bcgh'.includes(piece.square[0])) marks.push({ type: 'shield', square: piece.square });

      const f0 = FILES.indexOf(piece.square[0]);
      const r0 = Number(piece.square[1]);
      for (const [df, dr, kind] of DIRECTIONS) {
        const path: string[] = [];
        let blockers = 0;
        for (let f = f0 + df, r = r0 + dr; f >= 0 && f < 8 && r >= 1 && r <= 8; f += df, r += dr) {
          const sq = `${FILES[f]}${r}` as Square;
          const p = chess.get(sq);
          if (!p) {
            path.push(sq);
            continue;
          }
          const slider = kind === 'line' ? 'rq' : 'bq';
          if (p.color !== piece.color && slider.includes(p.type)) {
            for (const s of path) marks.push({ type: 'exposed', square: s });
            break;
          }
          if (++blockers > 1) break;
          path.push(sq);
        }
      }
    }
  }
  return marks;
}

export function conceptMarks(fen: string, learner: Side, layers: LayerToggles): ConceptMark[] {
  if (!layers.centre && !layers.hanging && !layers.development && !layers.king) return [];
  const chess = new Chess(fen);
  const me = colorOf(learner);
  const marks: ConceptMark[] = [];
  if (layers.centre) marks.push(...centreControl(chess, me));
  if (layers.king) marks.push(...kingSafety(chess));
  if (layers.development) {
    for (const c of ['w', 'b'] as Color[]) for (const sq of undevelopedPieces(chess, c)) marks.push({ type: 'undeveloped', square: sq });
  }
  if (layers.hanging) for (const sq of hangingPieces(chess)) marks.push({ type: 'hanging', square: sq });
  return marks;
}
