import { describe, expect, it } from 'vitest';
import { moveAnnouncement, positionLabel, spokenSan } from './speech';

describe('spokenSan', () => {
  it.each([
    ['e4', 'pawn to e4'],
    ['Nf3', 'knight to f3'],
    ['exd5', 'pawn takes d5'],
    ['Nxe5+', 'knight takes e5, check'],
    ['Nbd7', 'knight to d7'],
    ['O-O', 'castles kingside'],
    ['O-O-O+', 'castles queenside, check'],
    ['Nd6#', 'knight to d6, checkmate'],
    ['e8=Q', 'pawn to e8, promotes to queen'],
  ])('%s → %s', (san, spoken) => {
    expect(spokenSan(san)).toBe(spoken);
  });
});

describe('labels', () => {
  it('describes the side to move and the last move', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    expect(positionLabel(fen, 'e4')).toBe('Black to move. Last move: pawn to e4.');
    expect(moveAnnouncement(fen, 'e4')).toBe('White played pawn to e4.');
  });
});
