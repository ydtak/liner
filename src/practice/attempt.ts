import type { TreeNode } from '../content/loader';
import type { PracticeLine } from '../content/lines';
import type { Result } from '../progress/srs';

export type Feedback =
  | { kind: 'correct'; node: TreeNode }
  | { kind: 'alt'; node: TreeNode } // playable, but not the move this line practises
  | { kind: 'mistake'; node: TreeNode } // an authored trap
  | { kind: 'wrong' };

export interface Attempt {
  ply: number; // moves of the line played so far
  wrong: number;
  hint: number; // this move: 0 none, 1 piece, 2 piece + square, 3 arrow (answer revealed)
  maxHint: number; // most help taken on any move of the line
  feedback: Feedback | null;
  why: number | null; // idea step of the expected move being shown
  review: { mistake: TreeNode; step: number } | null; // stepping through a trap's refutation
  sync: number; // bumps to make the board snap back after a rejected move
}

export type AttemptAction =
  | { type: 'move'; uci: string }
  | { type: 'opponent' }
  | { type: 'hint' }
  | { type: 'why' }
  | { type: 'nextWhy' }
  | { type: 'review' }
  | { type: 'reviewStep'; delta: 1 | -1 }
  | { type: 'closeReview' }
  | { type: 'reset' };

export const freshAttempt: Attempt = { ply: 0, wrong: 0, hint: 0, maxHint: 0, feedback: null, why: null, review: null, sync: 0 };

export function attemptResult(a: Attempt): Result {
  if (a.maxHint >= 3 || a.wrong >= 2) return 'failed';
  if (a.maxHint > 0 || a.wrong > 0) return 'hinted';
  return 'clean';
}

export function attemptReducer(line: PracticeLine, root: TreeNode) {
  return (a: Attempt, action: AttemptAction): Attempt => {
    const expected = line.nodes[a.ply];
    const parent = a.ply === 0 ? root : line.nodes[a.ply - 1];

    switch (action.type) {
      case 'move': {
        if (!expected || a.review) return a;
        if (action.uci === expected.uci) {
          return { ...a, ply: a.ply + 1, hint: 0, feedback: { kind: 'correct', node: expected }, why: null };
        }
        const other = parent.children.find((c) => c.uci === action.uci);
        const sync = a.sync + 1;
        if (other?.role === 'mistake') return { ...a, wrong: a.wrong + 1, feedback: { kind: 'mistake', node: other }, sync };
        if (other) return { ...a, feedback: { kind: 'alt', node: other }, sync };
        return { ...a, wrong: a.wrong + 1, feedback: { kind: 'wrong' }, sync };
      }
      case 'opponent':
        if (!expected) return a;
        return { ...a, ply: a.ply + 1, feedback: a.feedback?.kind === 'correct' ? a.feedback : null };
      case 'hint': {
        const hint = Math.min(a.hint + 1, 3);
        return { ...a, hint, maxHint: Math.max(a.maxHint, hint) };
      }
      case 'why':
        if (!expected?.idea) return { ...a, hint: 3, maxHint: 3 };
        return { ...a, hint: 3, maxHint: 3, why: 0 };
      case 'nextWhy': {
        if (a.why === null || !expected?.idea) return a;
        return { ...a, why: a.why + 1 < expected.idea.steps.length ? a.why + 1 : null };
      }
      case 'review':
        if (a.feedback?.kind !== 'mistake') return a;
        return { ...a, review: { mistake: a.feedback.node, step: -1 } };
      case 'reviewStep': {
        if (!a.review) return a;
        const step = Math.max(-1, Math.min(a.review.step + action.delta, a.review.mistake.refutation.length - 1));
        return { ...a, review: { ...a.review, step } };
      }
      case 'closeReview':
        return { ...a, review: null, sync: a.sync + 1 };
      case 'reset':
        return freshAttempt;
    }
  };
}
