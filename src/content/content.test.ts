import { describe, expect, it } from 'vitest';
import { openings } from './index';
import { loadOpening, positionKey } from './loader';
import { validateOpening } from './validate';

describe.each(openings.map((o) => [o.id, o] as const))('%s', (_id, opening) => {
  it('passes content validation', () => {
    expect(validateOpening(opening)).toEqual([]);
  });

  it('loads into a tree', () => {
    const loaded = loadOpening(opening);
    expect(loaded.root.children.length).toBeGreaterThan(0);
  });
});

describe('italian game transpositions', () => {
  const loaded = loadOpening(openings.find((o) => o.id === 'italian-game')!);
  const walk = (ucis: string[]) => {
    let node = loaded.root;
    for (const uci of ucis) node = loaded.childrenOf(node).find((c) => c.uci === uci)!;
    return node;
  };

  it('Two Knights with d3/Bc5/c3 continues into the main line', () => {
    const tk = walk(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5', 'c2c3']);
    const main = walk(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d3']);
    expect(positionKey(tk.fen)).toBe(positionKey(main.fen));
    expect(loaded.childrenOf(tk).map((c) => c.uci)).toEqual(['d7d6']);
  });

  it('reaches the key position', () => {
    const end = walk(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d3', 'd7d6',
      'e1g1', 'e8g8', 'f1e1', 'a7a6', 'c4b3', 'c5a7', 'b1d2']);
    expect(loaded.isKeyPosition(end)).toBe(true);
  });

  it('the Blackburne Shilling refutation ends in mate', () => {
    const trap = walk(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'c6d4', 'f3e5']);
    expect(trap.refutation.at(-1)!.san).toBe('Nf3#');
  });
});
