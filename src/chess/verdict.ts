import { Chess, type Square } from 'chess.js';
import type { Mark } from '../content/schema';
import { uciToMove } from '../content/loader';
import { spokenSan } from '../ui/speech';
import { hangingPieces } from './concepts';
import { scoreToCp, type Analysis } from './engine';

// Turns two engine analyses into a plain-language verdict (docs/TECH.md §7).
// No numbers are shown by default; the loss in centipawns only picks the words.

export type VerdictLevel = 'best' | 'fine' | 'dubious' | 'mistake' | 'blunder';

export interface Verdict {
  level: VerdictLevel;
  label: string;
  text: string;
  lossCp: number;
  /** A stronger move from the position before, when the played move wasn't the best. */
  better?: { uci: string; san: string };
  /** Board drawing for the position after the move: what is loose, what the reply is. */
  marks: Mark[];
}

export const LEVEL_LABEL: Record<VerdictLevel, string> = {
  best: 'Strong move',
  fine: 'Fine',
  dubious: 'Dubious',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

export function classify(lossCp: number, isBest: boolean): VerdictLevel {
  if (isBest || lossCp <= 15) return 'best';
  if (lossCp <= 40) return 'fine';
  if (lossCp <= 100) return 'dubious';
  if (lossCp <= 300) return 'mistake';
  return 'blunder';
}

const PIECES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' };

function sanOf(fen: string, uci: string): string | undefined {
  try {
    return new Chess(fen).move(uciToMove(uci)).san;
  } catch {
    return undefined;
  }
}

/**
 * @param fenBefore position before the played move
 * @param played the move, in UCI
 * @param before analysis of fenBefore (side to move = the player)
 * @param after analysis of the position after the move (side to move = the opponent)
 */
export function buildVerdict(fenBefore: string, played: string, before: Analysis, after: Analysis): Verdict {
  const chess = new Chess(fenBefore);
  const move = chess.move(uciToMove(played));
  const fenAfter = chess.fen();

  if (chess.isCheckmate()) {
    return { level: 'best', label: LEVEL_LABEL.best, text: 'Checkmate!', lossCp: 0, marks: [] };
  }

  const bestCp = scoreToCp(before.score);
  const playedCp = chess.isStalemate() || chess.isDraw() ? 0 : -scoreToCp(after.score);
  const isBest = before.bestMove === played;
  const lossCp = Math.max(0, bestCp - playedCp);
  const level = classify(lossCp, isBest);

  const reasons: string[] = [];
  const marks: Mark[] = [];
  if (level === 'best') reasons.push(isBest ? "It's the engine's top choice here." : 'As good as the engine’s top choice.');
  if (level === 'fine') reasons.push("It's not in the course, but it keeps the balance.");
  if (level === 'dubious') reasons.push('Playable, but it gives away part of your position.');

  if (level === 'mistake' || level === 'blunder') {
    const mover = move.color;
    const loose = hangingPieces(chess).filter((sq) => chess.get(sq as Square)?.color === mover);
    if (loose.length) {
      const sq = loose[0] as Square;
      reasons.push(`It leaves your ${PIECES[chess.get(sq)!.type]} on ${sq} undefended.`);
      marks.push({ type: 'danger', squares: [sq] });
    }
    const reply = after.pv[0] && sanOf(fenAfter, after.pv[0]);
    if (reply) {
      reasons.push(`The opponent's best answer is ${spokenSan(reply)}.`);
      marks.push({ type: 'threat', from: after.pv[0].slice(0, 2), to: after.pv[0].slice(2, 4) });
    }
  }

  const better = !isBest && level !== 'best' ? { uci: before.bestMove, san: sanOf(fenBefore, before.bestMove) ?? before.bestMove } : undefined;
  if (better) reasons.push(`A stronger move was ${spokenSan(better.san)}.`);

  return { level, label: LEVEL_LABEL[level], text: reasons.join(' '), lossCp, better, marks };
}
