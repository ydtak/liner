import { describe, expect, it } from 'vitest';
import { openings } from './index';
import { loadOpening, type LoadedOpening } from './loader';
import { lineMap, mainLine } from './lines';
import { setupProgress } from '../chess/setup';

const load = (id: string) => loadOpening(openings.find((o) => o.id === id)!);
const walk = (o: LoadedOpening, ucis: string[]) => {
  let node = o.root;
  for (const uci of ucis) {
    const next = o.childrenOf(node).find((c) => c.uci === uci);
    if (!next) throw new Error(`no ${uci} after ${node.id}`);
    node = next;
  }
  return node;
};

describe.each(openings.map((o) => [o.id] as const))('%s', (id) => {
  const o = load(id);

  it('main line ends on the key position', () => {
    expect(o.isKeyPosition(mainLine(o).at(-1)!)).toBe(true);
  });

  it('every branch and trap in the line map has a title', () => {
    const { branches, traps } = lineMap(o);
    for (const entry of [...branches, ...traps]) expect(entry.title).not.toBe('');
    expect(traps.length).toBeGreaterThan(0);
  });
});

describe('transpositions', () => {
  it('Caro-Kann Nd2 and Nc3-first lines rejoin the Classical', () => {
    const o = load('caro-kann');
    const nd2 = walk(o, ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1d2', 'd5e4', 'd2e4']);
    expect(o.childrenOf(nd2).map((c) => c.san)).toContain('Bf5');
    const nc3 = walk(o, ['e2e4', 'c7c6', 'b1c3', 'd7d5', 'd2d4']);
    expect(o.childrenOf(nc3).map((c) => c.san)).toContain('dxe4');
  });

  it('QGD Nf3 order and Elephant setup rejoin the main line', () => {
    const o = load('queens-gambit-declined');
    const nf3 = walk(o, ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'g1f3', 'g8f6', 'b1c3', 'f8e7', 'c1g5', 'e8g8', 'e2e3']);
    expect(o.childrenOf(nf3).map((c) => c.san)).toEqual(['Nbd7']);
    const elephant = walk(o, ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5', 'b8d7', 'e2e3', 'f8e7', 'g1f3', 'e8g8']);
    expect(o.childrenOf(elephant).map((c) => c.san)).toEqual(['Rc1']);
  });

  it('London vs 1...Nf6 e6/d5 rejoins the 1...d5 line', () => {
    const o = load('london-system');
    const node = walk(o, ['d2d4', 'g8f6', 'c1f4', 'e7e6', 'e2e3', 'd7d5']);
    expect(o.childrenOf(node).map((c) => c.san)).toEqual(['Nf3']);
  });
});

describe('traps end where the lesson says', () => {
  it('Caro-Kann Qe2 trick is smothered mate', () => {
    const o = load('caro-kann');
    const trap = walk(o, ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4', 'b8d7', 'd1e2', 'g8f6']);
    expect(trap.refutation.at(-1)!.san).toBe('Nd6#');
  });

  it('Elephant Trap leaves Black a piece up', () => {
    const o = load('queens-gambit-declined');
    const trap = walk(o, ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5', 'b8d7', 'c4d5', 'e6d5', 'c3d5']);
    const fen = trap.refutation.at(-1)!.fen.split(' ')[0];
    const count = (re: RegExp) => (fen.match(re) ?? []).length;
    // Material: N=3, B=3, R=5, Q=9, P=1
    const value = (s: string) => count(new RegExp(`[${s}]`, 'g'));
    const white = value('N') * 3 + value('B') * 3 + value('R') * 5 + value('Q') * 9 + value('P');
    const black = value('n') * 3 + value('b') * 3 + value('r') * 5 + value('q') * 9 + value('p');
    expect(black - white).toBeGreaterThanOrEqual(2);
  });
});

describe('setup progress', () => {
  const setupFen = openings.find((o) => o.id === 'london-system')!.setupFen!;

  it('counts only pieces that need to move, and ghosts empty targets', () => {
    const start = setupProgress(setupFen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(start.done).toBe(0);
    expect(start.total).toBe(9);
    expect(start.ghosts.map((g) => (g.type === 'ghost' ? g.square : ''))).not.toContain('d2'); // pawn still there
  });

  it('counts Bg3 as the developed f4 bishop at the key position', () => {
    const o = load('london-system');
    const end = setupProgress(setupFen, o.meta.keyPositionFen);
    expect(end.done).toBe(7); // all but the not-yet-castled king and rook
    expect(end.ghosts.map((g) => (g.type === 'ghost' ? g.square : ''))).not.toContain('f4');
  });
});

describe('sicilian traps', () => {
  const o = load('sicilian-defence');
  it('Wandering knight loses a piece', () => {
    const trap = walk(o, ['e2e4', 'c7c5', 'c2c3', 'g8f6', 'e4e5', 'f6e4']);
    expect(trap.refutation.at(-1)!.san).toBe('Bxg5');
  });
  it('Early e5 push ends with the king recapturing', () => {
    const trap = walk(o, ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'e4e5']);
    expect(trap.refutation.at(-1)!.san).toBe('Kxd1');
  });
});
