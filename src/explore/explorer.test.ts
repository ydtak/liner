import { describe, expect, it } from 'vitest';
import { openings } from '../content';
import { loadOpening } from '../content/loader';
import { boardView, current, initialState, reducer, type Action, type ExplorerState } from './explorer';

const opening = loadOpening(openings.find((o) => o.id === 'italian-game')!);
const reduce = reducer(opening);
const run = (...actions: Action[]): ExplorerState => actions.reduce(reduce, initialState(opening));
const play = (...ucis: string[]): Action[] => ucis.map((uci) => ({ type: 'play', uci }));

describe('explorer', () => {
  it('follows the main line with forward', () => {
    const s = run({ type: 'forward' }, { type: 'forward' }, { type: 'forward' });
    expect(current(s).node.san).toBe('Nf3');
  });

  it('enters and leaves a refutation for a mistake', () => {
    let s = run(...play('e2e4', 'e7e5', 'g1f3', 'f7f6'));
    expect(s.mode.kind).toBe('refutation');
    expect(s.path).toHaveLength(4); // mistake is not added to the path
    s = [{ type: 'forward' } as Action, { type: 'forward' } as Action].reduce(reduce, s);
    expect(s.mode).toMatchObject({ kind: 'refutation', step: 1 });
    expect(boardView(opening, s).lastMove).toBe('f6e5');
    s = reduce(s, { type: 'showRight' });
    expect(s.mode.kind).toBe('tree');
    expect(s.hint).toBe(true);
  });

  it('flags moves outside the course as off the map', () => {
    const s = run(...play('a2a3'));
    expect(s.mode).toMatchObject({ kind: 'offmap', san: 'a3' });
    expect(reduce(s, { type: 'back' }).mode.kind).toBe('tree');
  });

  it('follows a transposition from a move order that is not authored', () => {
    // 3...Bc5 4.d3 Nf6 5.c3 is authored, so it reaches the main-line continuation.
    const s = run(...play('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'd2d3', 'g8f6', 'c2c3'));
    expect(s.mode.kind).toBe('tree');
    expect(opening.childrenOf(current(s).node).map((c) => c.san)).toEqual(['d6']);
  });

  it('steps through Why? and closes after the last step', () => {
    let s = run({ type: 'forward' }, { type: 'why' });
    expect(s.why).toBe(0);
    expect(boardView(opening, s).marks[0]).toMatchObject({ type: 'control' });
    s = reduce(reduce(s, { type: 'nextWhy' }), { type: 'nextWhy' });
    expect(s.why).toBeNull();
  });
});

describe('jump', () => {
  it('jumps to a branch with the full path', () => {
    const target = opening.childrenOf(current(run(...play('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'))).node).find((c) => c.san === 'Nf6')!;
    const s = run({ type: 'jump', node: target });
    expect(s.path.map((e) => e.node.san ?? '')).toEqual(['', 'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6']);
  });

  it('jumps into a trap refutation', () => {
    const mistake = opening.childrenOf(current(run(...play('e2e4', 'e7e5', 'g1f3'))).node).find((c) => c.role === 'mistake')!;
    const s = run({ type: 'jump', node: mistake });
    expect(s.mode).toMatchObject({ kind: 'refutation', step: -1 });
    expect(current(s).node.san).toBe('Nf3');
  });
});
