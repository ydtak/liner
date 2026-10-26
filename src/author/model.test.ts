import { describe, expect, it } from 'vitest';
import { openings } from '../content';
import { validateOpening } from '../content/validate';
import {
  addMove, applyTool, blankOpening, deleteNode, fenAt, learnerPieces, makeMain, marksOf,
  nodeAt, refutationFen, setMarks, patchNode,
} from './model';

describe('building a tree', () => {
  it('adds moves, reuses existing children, and defaults roles', () => {
    let d = blankOpening();
    let r = addMove(d, [], 'e2e4');
    d = r.draft;
    expect(r.path).toEqual([0]);
    expect(nodeAt(d.root, [0]).role).toBe('main');
    r = addMove(d, [], 'd2d4');
    d = r.draft;
    expect(nodeAt(d.root, [1]).role).toBe('alt');
    expect(addMove(d, [], 'e2e4').path).toEqual([0]); // already there
    expect(fenAt(d, [0]).split(' ')[0]).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR');
  });

  it('makes a sibling main and demotes the old main', () => {
    let d = addMove(blankOpening(), [], 'e2e4').draft;
    d = addMove(d, [], 'd2d4').draft;
    d = makeMain(d, [1]);
    expect(d.root.children!.map((c) => c.role)).toEqual(['alt', 'main']);
  });

  it('deletes a subtree', () => {
    let d = addMove(blankOpening(), [], 'e2e4').draft;
    d = addMove(d, [0], 'e7e5').draft;
    d = deleteNode(d, [0]);
    expect(d.root.children).toEqual([]);
  });

  it('never mutates the original draft', () => {
    const d = blankOpening();
    addMove(d, [], 'e2e4');
    expect(d.root.children).toEqual([]);
  });
});

describe('marks', () => {
  it('toggles squares and arrows', () => {
    let m = applyTool([], 'control', 'd5', null);
    m = applyTool(m, 'control', 'f5', null);
    expect(m).toEqual([{ type: 'control', squares: ['d5', 'f5'] }]);
    m = applyTool(m, 'control', 'd5', null);
    expect(m).toEqual([{ type: 'control', squares: ['f5'] }]);
    m = applyTool(m, 'threat', 'e5', 'f3');
    expect(m).toContainEqual({ type: 'threat', from: 'f3', to: 'e5' });
    m = applyTool(m, 'threat', 'e5', 'f3');
    expect(m.some((x) => x.type === 'threat')).toBe(false);
  });

  it('adds ghosts and badges', () => {
    let m = applyTool([], 'ghost', 'd4', null, { piece: 'wP' });
    m = applyTool(m, 'badge', 'f7', null, { label: 'weak' });
    expect(m).toEqual([{ type: 'ghost', square: 'd4', piece: 'wP' }, { type: 'badge', square: 'f7', label: 'weak' }]);
  });

  it('stores marks on idea steps, refutation steps and plans', () => {
    let d = addMove(blankOpening(), [], 'e2e4').draft;
    d = patchNode(d, [0], { idea: { steps: [{ text: 'x', marks: [] }] } });
    const marks = [{ type: 'control' as const, squares: ['d5'] }];
    d = setMarks(d, [0], { kind: 'idea', step: 0 }, marks);
    expect(marksOf(d, [0], { kind: 'idea', step: 0 })).toEqual(marks);
    d = { ...d, plans: [{ name: 'p', text: '', marks: [] }] };
    d = setMarks(d, [0], { kind: 'plan', index: 0 }, marks);
    expect(d.plans![0].marks).toEqual(marks);
  });
});

describe('positions', () => {
  it('replays refutations', () => {
    let d = addMove(blankOpening(), [], 'e2e4').draft;
    d = patchNode(d, [0], { role: 'mistake', refutation: [{ move: 'e7e5', text: '' }] });
    expect(refutationFen(d, [0]).split(' ')[0]).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR');
  });

  it('extracts the learner pieces for a setup', () => {
    expect(learnerPieces('rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1', 'white'))
      .toBe('8/8/8/8/3P4/8/PPP1PPPP/RNBQKBNR w - - 0 1');
  });
});

describe('round trip', () => {
  it('a shipped opening survives clone + edit helpers and still validates', () => {
    const italian = structuredClone(openings.find((o) => o.id === 'italian-game')!);
    const d = patchNode(italian, [0], { caption: 'Pawn takes a central square.' });
    expect(validateOpening(d)).toEqual([]);
  });
});
