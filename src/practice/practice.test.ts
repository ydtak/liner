import { describe, expect, it } from 'vitest';
import { openings } from '../content';
import { loadOpening } from '../content/loader';
import { practiceLines } from '../content/lines';
import { progressKey } from '../progress/ProgressContext';
import { attemptReducer, attemptResult, freshAttempt, type AttemptAction } from './attempt';
import { buildQueue } from './queue';

const italian = loadOpening(openings.find((o) => o.id === 'italian-game')!);
const lines = practiceLines(italian);
const main = lines[0];
const reduce = attemptReducer(main, italian.root);
const run = (...actions: AttemptAction[]) => actions.reduce(reduce, freshAttempt);

describe('practice lines', () => {
  it('starts with the main line and skips mistakes', () => {
    expect(main.title).toBe('Giuoco Pianissimo');
    expect(lines.every((l) => l.nodes.every((n) => n.role !== 'mistake'))).toBe(true);
  });

  it.each(openings.map((o) => [o.id]))('%s has practice lines', (id) => {
    expect(practiceLines(loadOpening(openings.find((o) => o.id === id)!)).length).toBeGreaterThan(1);
  });
});

describe('attempt', () => {
  it('advances on the right move and stays clean', () => {
    const a = run({ type: 'move', uci: 'e2e4' }, { type: 'opponent' });
    expect(a.ply).toBe(2);
    expect(attemptResult(a)).toBe('clean');
  });

  it('counts wrong moves and snaps the board back', () => {
    const a = run({ type: 'move', uci: 'a2a3' });
    expect(a).toMatchObject({ ply: 0, wrong: 1, sync: 1, feedback: { kind: 'wrong' } });
    expect(attemptResult(a)).toBe('hinted');
    expect(attemptResult(reduce(a, { type: 'move', uci: 'h2h3' }))).toBe('failed');
  });

  it('does not penalise a playable alternative', () => {
    const a = run(...['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'].map((uci, i) =>
      (i % 2 ? { type: 'opponent' } : { type: 'move', uci }) as AttemptAction), { type: 'move', uci: 'd2d3' });
    expect(a.feedback?.kind).toBe('alt');
    expect(a.wrong).toBe(0);
  });

  it('recognises an authored trap and can review it', () => {
    // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nd4: now 4.Nxe5? is the authored trap.
    const nd4 = lines.find((l) => l.nodes.some((n) => n.san === 'Nd4'))!;
    const r = attemptReducer(nd4, italian.root);
    let a = nd4.nodes.slice(0, 6).reduce((acc, n) => r(acc, { type: 'move', uci: n.uci! }), freshAttempt);
    a = r(a, { type: 'move', uci: 'f3e5' });
    expect(a.feedback?.kind).toBe('mistake');
    expect(a.wrong).toBe(1);
    a = r(a, { type: 'review' });
    expect(a.review?.step).toBe(-1);
  });

  it('marks the answer as revealed after three hints', () => {
    const a = run({ type: 'hint' }, { type: 'hint' }, { type: 'hint' });
    expect(a.hint).toBe(3);
    expect(attemptResult(a)).toBe('failed');
  });
});

describe('queue', () => {
  it('puts reviews before new lines and respects due dates', () => {
    const now = 1_000_000;
    const reviewKey = progressKey('italian-game', lines[2].id);
    const notDueKey = progressKey('italian-game', lines[1].id);
    const q = buildQueue([italian], {
      [reviewKey]: { box: 1, dueAt: now - 1 },
      [notDueKey]: { box: 2, dueAt: now + 1 },
    }, now);
    expect(q[0].key).toBe(reviewKey);
    expect(q.map((i) => i.key)).not.toContain(notDueKey);
  });
});

describe('hints', () => {
  it('reset for the next move but still count toward the result', () => {
    const a = run({ type: 'hint' }, { type: 'hint' }, { type: 'move', uci: 'e2e4' });
    expect(a.hint).toBe(0);
    expect(attemptResult(a)).toBe('hinted');
  });
});
