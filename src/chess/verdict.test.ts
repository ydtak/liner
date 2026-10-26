import { describe, expect, it } from 'vitest';
import { parseInfo, scoreToCp, type Analysis } from './engine';
import { buildVerdict, classify } from './verdict';

const an = (bestMove: string, score: Analysis['score'], pv: string[] = []): Analysis => ({ bestMove, score, pv, depth: 12 });

describe('parseInfo', () => {
  it('reads depth, centipawn score and pv', () => {
    expect(parseInfo('info depth 12 seldepth 18 multipv 1 score cp 34 nodes 9000 nps 1 pv e2e4 e7e5 g1f3')).toEqual({
      depth: 12,
      score: { cp: 34 },
      pv: ['e2e4', 'e7e5', 'g1f3'],
    });
  });

  it('reads mate scores and ignores lines without a score or for other pvs', () => {
    expect(parseInfo('info depth 5 score mate -2 pv h5f7')?.score).toEqual({ mate: -2 });
    expect(parseInfo('info string NNUE evaluation enabled')).toBeNull();
    expect(parseInfo('info depth 9 multipv 2 score cp 10 pv d2d4')).toBeNull();
  });
});

describe('scores and levels', () => {
  it('treats mates as huge, sooner mates larger', () => {
    expect(scoreToCp({ mate: 1 })).toBeGreaterThan(scoreToCp({ mate: 5 }));
    expect(scoreToCp({ mate: -1 })).toBeLessThan(-90_000);
  });

  it('maps loss to words', () => {
    expect(classify(0, true)).toBe('best');
    expect(classify(30, false)).toBe('fine');
    expect(classify(80, false)).toBe('dubious');
    expect(classify(200, false)).toBe('mistake');
    expect(classify(900, false)).toBe('blunder');
  });
});

describe('buildVerdict', () => {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('calls the top move strong', () => {
    const v = buildVerdict(START, 'e2e4', an('e2e4', { cp: 30 }), an('e7e5', { cp: -30 }));
    expect(v.level).toBe('best');
    expect(v.better).toBeUndefined();
  });

  it('names a hanging piece and a better move for a blunder', () => {
    // 1.e4 e5 2.Nf3 Nc6: White plays 3.Ng5?? into ...Qxg5.
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const v = buildVerdict(fen, 'f3g5', an('f1b5', { cp: 40 }), an('d8g5', { cp: 300 }, ['d8g5']));
    expect(v.level).toBe('blunder');
    expect(v.text).toContain('knight on g5 undefended');
    expect(v.text).toContain('queen takes g5');
    expect(v.better).toEqual({ uci: 'f1b5', san: 'Bb5' });
    expect(v.marks).toEqual([{ type: 'danger', squares: ['g5'] }, { type: 'threat', from: 'd8', to: 'g5' }]);
  });

  it('recognises checkmate', () => {
    // Scholar's mate: Qxf7#.
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    expect(buildVerdict(fen, 'h5f7', an('h5f7', { mate: 1 }), an('', { cp: 0 })).text).toBe('Checkmate!');
  });
});
