import { Chess } from 'chess.js';
import { START_FEN, uciToMove } from '../content/loader';
import type { IdeaStep, Mark, MoveNode, Opening, Plan, RefutationStep } from '../content/schema';

// Pure helpers for editing an Opening draft. Nodes are addressed by a path of
// child indices from the root, and every edit returns a new draft.

export type Path = number[];

/** Where newly drawn marks go. */
export type MarkTarget =
  | { kind: 'idea'; step: number }
  | { kind: 'refutation'; step: number }
  | { kind: 'plan'; index: number };

export function blankOpening(): Opening {
  return {
    id: 'new-opening',
    name: 'New opening',
    side: 'white',
    kind: 'opening',
    group: 'white',
    difficulty: 1,
    tagline: '',
    intro: '',
    keyPositionFen: START_FEN,
    plans: [],
    root: { children: [] },
  };
}

export const clone = <T>(value: T): T => structuredClone(value);

export function nodeAt(root: MoveNode, path: Path): MoveNode {
  return path.reduce((node, i) => node.children![i], root);
}

/** Returns a new root with the node at `path` replaced by `fn(node)`. */
export function updateAt(root: MoveNode, path: Path, fn: (node: MoveNode) => MoveNode): MoveNode {
  if (!path.length) return fn(root);
  const [i, ...rest] = path;
  const children = [...(root.children ?? [])];
  children[i] = updateAt(children[i], rest, fn);
  return { ...root, children };
}

export function withRoot(draft: Opening, root: MoveNode): Opening {
  return { ...draft, root };
}

/** Position after the moves along `path`. */
export function fenAt(draft: Opening, path: Path): string {
  const chess = new Chess(draft.startFen ?? START_FEN);
  let node = draft.root;
  for (const i of path) {
    node = node.children![i];
    chess.move(uciToMove(node.move!));
  }
  return chess.fen();
}

/** Position after a mistake node's refutation moves (all, or the first `upTo`). */
export function refutationFen(draft: Opening, path: Path, upTo?: number): string {
  const chess = new Chess(fenAt(draft, path));
  const steps = nodeAt(draft.root, path).refutation ?? [];
  for (const step of steps.slice(0, upTo ?? steps.length)) chess.move(uciToMove(step.move));
  return chess.fen();
}

/** Learner to move at this node? (Decides whether a new child defaults to "main".) */
export function learnerToMove(draft: Opening, path: Path): boolean {
  const turn = fenAt(draft, path).split(' ')[1];
  return (turn === 'w') === (draft.side === 'white');
}

/**
 * Adds a move under `path`, or returns the existing child's path if it's already
 * there. The first child is "main"; later ones default to "alt".
 */
export function addMove(draft: Opening, path: Path, uci: string): { draft: Opening; path: Path } {
  const parent = nodeAt(draft.root, path);
  const existing = (parent.children ?? []).findIndex((c) => c.move === uci);
  if (existing >= 0) return { draft, path: [...path, existing] };
  const role = (parent.children ?? []).some((c) => (c.role ?? 'main') === 'main') ? 'alt' : 'main';
  const child: MoveNode = { move: uci, role, popularity: role === 'main' ? 3 : 2, caption: '' };
  const root = updateAt(draft.root, path, (n) => ({ ...n, children: [...(n.children ?? []), child] }));
  return { draft: withRoot(draft, root), path: [...path, (parent.children ?? []).length] };
}

export function deleteNode(draft: Opening, path: Path): Opening {
  if (!path.length) return draft;
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  return withRoot(draft, updateAt(draft.root, parentPath, (n) => ({ ...n, children: n.children!.filter((_, i) => i !== index) })));
}

export function patchNode(draft: Opening, path: Path, patch: Partial<MoveNode>): Opening {
  return withRoot(draft, updateAt(draft.root, path, (n) => ({ ...n, ...patch })));
}

/** Makes this node the main move and demotes its siblings' "main" to "alt". */
export function makeMain(draft: Opening, path: Path): Opening {
  if (!path.length) return draft;
  const index = path[path.length - 1];
  return withRoot(
    draft,
    updateAt(draft.root, path.slice(0, -1), (n) => ({
      ...n,
      children: n.children!.map((c, i) =>
        i === index ? { ...c, role: 'main' } : (c.role ?? 'main') === 'main' ? { ...c, role: 'alt' } : c,
      ),
    })),
  );
}

/** Steps (idea, refutation or plan) that a target points to, for reading marks. */
export function marksOf(draft: Opening, path: Path, target: MarkTarget | null): Mark[] {
  if (!target) return [];
  const node = nodeAt(draft.root, path);
  if (target.kind === 'idea') return node.idea?.steps[target.step]?.marks ?? [];
  if (target.kind === 'refutation') return node.refutation?.[target.step]?.marks ?? [];
  return draft.plans?.[target.index]?.marks ?? [];
}

export function setMarks(draft: Opening, path: Path, target: MarkTarget, marks: Mark[]): Opening {
  if (target.kind === 'plan') {
    const plans = [...(draft.plans ?? [])];
    plans[target.index] = { ...plans[target.index], marks };
    return { ...draft, plans };
  }
  return patchNode(draft, path, target.kind === 'idea'
    ? { idea: { steps: replaceAt(nodeAt(draft.root, path).idea?.steps ?? [], target.step, (s) => ({ ...s, marks })) } }
    : { refutation: replaceAt(nodeAt(draft.root, path).refutation ?? [], target.step, (s) => ({ ...s, marks })) });
}

/**
 * Applies a click on `square` with a drawing tool. Square tools toggle the square;
 * arrow tools need `from` (the first click) and add or remove the arrow.
 */
export function applyTool(marks: Mark[], tool: Tool, square: string, from: string | null, extra?: { piece?: string; label?: string }): Mark[] {
  if (tool === 'control' || tool === 'target' || tool === 'danger') {
    const i = marks.findIndex((m) => m.type === tool);
    if (i < 0) return [...marks, { type: tool, squares: [square] }];
    const m = marks[i] as Extract<Mark, { squares: string[] }>;
    const squares = m.squares.includes(square) ? m.squares.filter((s) => s !== square) : [...m.squares, square];
    return squares.length ? replaceAt(marks, i, () => ({ ...m, squares })) : marks.filter((_, j) => j !== i);
  }
  if (tool === 'ghost') {
    const others = marks.filter((m) => !(m.type === 'ghost' && m.square === square));
    return others.length < marks.length ? others : [...marks, { type: 'ghost', square, piece: extra?.piece ?? 'wP' }];
  }
  if (tool === 'badge') {
    const others = marks.filter((m) => !(m.type === 'badge' && m.square === square));
    return others.length < marks.length || !extra?.label ? others : [...marks, { type: 'badge', square, label: extra.label }];
  }
  if (!from || from === square) return marks;
  const same = (m: Mark) => m.type === tool && 'from' in m && m.from === from && m.to === square;
  return marks.some(same) ? marks.filter((m) => !same(m)) : [...marks, { type: tool, from, to: square } as Mark];
}

export type Tool = 'control' | 'target' | 'danger' | 'threat' | 'defend' | 'ray' | 'plan' | 'ghost' | 'badge';
export const ARROW_TOOLS: Tool[] = ['threat', 'defend', 'ray', 'plan'];

export function replaceAt<T>(items: T[], index: number, fn: (item: T) => T): T[] {
  return items.map((item, i) => (i === index ? fn(item) : item));
}

export const emptyStep = (): IdeaStep => ({ text: '', marks: [] });
export const emptyPlan = (): Plan => ({ name: 'New plan', text: '', marks: [] });
export const refutationStep = (move: string): RefutationStep => ({ move, text: '', marks: [] });

/** Pieces of the learner's colour in a FEN, as a placement-only FEN for setupFen. */
export function learnerPieces(fen: string, side: Opening['side']): string {
  const keep = side === 'white' ? /[a-z]/g : /[A-Z]/g;
  const placement = fen.split(' ')[0].replace(keep, '1');
  // Re-compress runs of empty squares ("11" → "2").
  const rows = placement.split('/').map((row) => row.replace(/\d+/g, (run) => String([...run].reduce((n, d) => n + Number(d), 0))));
  return `${rows.join('/')} w - - 0 1`;
}

/** Stable, readable JSON for committing to src/content/openings. */
export function toJSON(draft: Opening): string {
  return JSON.stringify(draft, null, 2) + '\n';
}
