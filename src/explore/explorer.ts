import { Chess } from 'chess.js';
import type { LoadedOpening, TreeNode } from '../content/loader';
import { uciToMove } from '../content/loader';
import type { Mark } from '../content/schema';
import { mainChild } from '../content/lines';

export { mainChild };

export interface Entry {
  node: TreeNode;
  fen: string;
  uci?: string; // the move actually played (may differ from node.uci after a transposition)
}

export type Mode =
  | { kind: 'tree' }
  | { kind: 'refutation'; mistake: TreeNode; step: number } // step -1 = mistake just played
  | { kind: 'offmap'; fen: string; uci: string; san: string };

export interface ExplorerState {
  path: Entry[];
  mode: Mode;
  why: number | null; // index of the visible idea step
  plan: number | null; // index of the visible key-position plan
  hint: boolean; // pulse the main move after "Show the right move"
  suggestion: string | null; // engine's better move (UCI) after an off-the-map move
  justPlayed: boolean; // a forward move just happened (drives auto-reply)
}

export type Action =
  | { type: 'play'; uci: string }
  | { type: 'forward' }
  | { type: 'back' }
  | { type: 'restart' }
  | { type: 'why' }
  | { type: 'nextWhy' }
  | { type: 'plan'; index: number | null }
  | { type: 'takeBack' }
  | { type: 'showRight' }
  | { type: 'jump'; node: TreeNode }
  | { type: 'suggest'; uci: string };

export function initialState(opening: LoadedOpening): ExplorerState {
  return {
    path: [{ node: opening.root, fen: opening.root.fen }],
    mode: { kind: 'tree' },
    why: null,
    plan: null,
    hint: false,
    suggestion: null,
    justPlayed: false,
  };
}

const reset = { why: null, plan: null, hint: false, suggestion: null } as const;

export function current(state: ExplorerState): Entry {
  return state.path[state.path.length - 1];
}

export function reducer(opening: LoadedOpening) {
  return (state: ExplorerState, action: Action): ExplorerState => {
    const here = current(state);
    const { mode } = state;

    switch (action.type) {
      case 'play': {
        if (mode.kind !== 'tree') return state;
        const child = opening.childrenOf(here.node).find((c) => c.uci === action.uci);
        if (child?.role === 'mistake') {
          return { ...state, ...reset, mode: { kind: 'refutation', mistake: child, step: -1 }, justPlayed: false };
        }
        if (child) {
          return { ...state, ...reset, path: [...state.path, { node: child, fen: child.fen, uci: child.uci }], justPlayed: true };
        }
        const chess = new Chess(here.fen);
        let san: string;
        try {
          san = chess.move(uciToMove(action.uci)).san;
        } catch {
          return state;
        }
        const fen = chess.fen();
        const transposed = opening.findByFen(fen);
        if (transposed && transposed.role !== 'mistake') {
          return { ...state, ...reset, path: [...state.path, { node: transposed, fen, uci: action.uci }], justPlayed: true };
        }
        return { ...state, ...reset, mode: { kind: 'offmap', fen, uci: action.uci, san }, justPlayed: false };
      }

      case 'forward': {
        if (mode.kind === 'refutation') {
          if (mode.step >= mode.mistake.refutation.length - 1) return state;
          return { ...state, ...reset, mode: { ...mode, step: mode.step + 1 } };
        }
        if (mode.kind === 'offmap') return state;
        const next = mainChild(opening.childrenOf(here.node));
        if (!next) return state;
        return { ...state, ...reset, path: [...state.path, { node: next, fen: next.fen, uci: next.uci }], justPlayed: true };
      }

      case 'back': {
        if (mode.kind === 'refutation' && mode.step >= 0) {
          return { ...state, ...reset, mode: { ...mode, step: mode.step - 1 } };
        }
        if (mode.kind !== 'tree') return { ...state, ...reset, mode: { kind: 'tree' }, justPlayed: false };
        if (state.path.length === 1) return state;
        return { ...state, ...reset, path: state.path.slice(0, -1), justPlayed: false };
      }

      case 'restart':
        return { ...initialState(opening) };

      case 'why': {
        if (mode.kind !== 'tree' || !here.node.idea) return state;
        return { ...state, why: state.why === null ? 0 : null, plan: null };
      }

      case 'nextWhy': {
        if (state.why === null) return state;
        const steps = here.node.idea?.steps.length ?? 0;
        return { ...state, why: state.why + 1 < steps ? state.why + 1 : null };
      }

      case 'plan':
        return { ...state, why: null, plan: state.plan === action.index ? null : action.index };

      case 'takeBack':
        return { ...state, ...reset, mode: { kind: 'tree' }, justPlayed: false };

      case 'showRight':
        return { ...state, ...reset, mode: { kind: 'tree' }, hint: true, justPlayed: false };

      case 'suggest':
        return { ...state, ...reset, mode: { kind: 'tree' }, suggestion: action.uci, justPlayed: false };

      case 'jump': {
        const chain: TreeNode[] = [];
        for (let n: TreeNode | undefined = action.node; n; n = n.parent) chain.unshift(n);
        const path = chain.map((n) => ({ node: n, fen: n.fen, uci: n.uci }));
        if (action.node.role === 'mistake') {
          return { ...state, ...reset, path: path.slice(0, -1), mode: { kind: 'refutation', mistake: action.node, step: -1 }, justPlayed: false };
        }
        return { ...state, ...reset, path, mode: { kind: 'tree' }, justPlayed: false };
      }
    }
  };
}

/** Position, last move and marks the board should show for a state. */
export function boardView(opening: LoadedOpening, state: ExplorerState) {
  const here = current(state);
  const { mode } = state;
  let fen = here.fen;
  let lastMove = here.uci;
  let marks: Mark[] = [];

  if (mode.kind === 'refutation') {
    const ply = mode.step >= 0 ? mode.mistake.refutation[mode.step] : undefined;
    fen = ply?.fen ?? mode.mistake.fen;
    lastMove = ply?.uci ?? mode.mistake.uci;
    marks = ply?.marks ?? [];
  } else if (mode.kind === 'offmap') {
    fen = mode.fen;
    lastMove = mode.uci;
  } else if (state.why !== null) {
    marks = here.node.idea?.steps[state.why]?.marks ?? [];
  } else if (state.plan !== null) {
    marks = opening.meta.plans?.[state.plan]?.marks ?? [];
  }

  return { fen, lastMove, marks };
}

/** Move number + SAN, e.g. "3. Bc4" or "3… Bc5". */
export function moveLabel(fen: string, san: string): string {
  // `fen` is the position after the move.
  const [, turn, , , , full] = fen.split(' ');
  const number = turn === 'b' ? Number(full) : Number(full) - 1;
  return turn === 'b' ? `${number}. ${san}` : `${number}… ${san}`;
}
