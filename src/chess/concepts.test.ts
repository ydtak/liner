import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { centreControl, conceptMarks, developmentCount, hangingPieces, kingSafety } from './concepts';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('hanging pieces', () => {
  it('flags e5 after 1.e4 e5 2.Nf3', () => {
    const chess = new Chess('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');
    expect(hangingPieces(chess)).toEqual(['e5']);
  });

  it('flags a defended piece attacked by something cheaper', () => {
    // Black knight on d5 defended by the e6 pawn, attacked by White's c4 pawn.
    const chess = new Chess('4k3/8/4p3/3n4/2P5/8/8/4K3 w - - 0 1');
    expect(hangingPieces(chess)).toContain('d5');
  });

  it('is quiet in the starting position', () => {
    expect(hangingPieces(new Chess(START))).toEqual([]);
  });
});

describe('centre control', () => {
  it('gives White d5 after 1.e4 but leaves the empty, unattacked squares out', () => {
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    const marks = centreControl(chess, 'w');
    expect(marks).toContainEqual({ type: 'centre', square: 'd5', tone: 'you' });
    expect(marks.find((m) => m.square === 'd4')).toBeUndefined();
  });
});

describe('development', () => {
  it('counts minor pieces off their home squares', () => {
    expect(developmentCount(START, 'white')).toEqual({ developed: 0, total: 4 });
    // Italian after 3.Bc4: knight and bishop out.
    expect(developmentCount('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', 'white')).toEqual({ developed: 2, total: 4 });
  });
});

describe('king safety', () => {
  it('marks the open line from Qh5 toward e8 after 1.e4 f6? 2.Qh5+', () => {
    const chess = new Chess('rnbqkbnr/ppppp1pp/5p2/7Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2');
    const exposed = kingSafety(chess).filter((m) => m.type === 'exposed').map((m) => m.square);
    expect(exposed).toEqual(expect.arrayContaining(['f7', 'g6']));
  });

  it('puts a shield on a castled king', () => {
    const chess = new Chess('r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w - - 4 6');
    expect(kingSafety(chess).filter((m) => m.type === 'shield').map((m) => m.square).sort()).toEqual(['g1', 'g8']);
  });
});

describe('conceptMarks', () => {
  it('returns nothing when every layer is off', () => {
    expect(conceptMarks(START, 'white', { centre: false, hanging: false, development: false, king: false })).toEqual([]);
  });
});
