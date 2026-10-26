import { Chess } from 'chess.js';
import type { Idea, Mark, MoveNode, Opening, Role } from './schema';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface RefutationPly {
  uci: string;
  san: string;
  fen: string;
  text: string;
  marks: Mark[];
}

/** A content node enriched with positions, ids and parent links. */
export interface TreeNode {
  id: string; // path of UCI moves, "" for root
  uci?: string;
  san?: string;
  role: Role;
  popularity: 1 | 2 | 3;
  name?: string;
  caption?: string;
  idea?: Idea;
  lesson?: string;
  refutation: RefutationPly[];
  fen: string; // position after this move
  children: TreeNode[];
  parent?: TreeNode;
}

export interface LoadedOpening {
  meta: Opening;
  root: TreeNode;
  /** Children for a node, following transpositions when the node itself is a leaf. */
  childrenOf(node: TreeNode): TreeNode[];
  /** Best node for a position (one with children wins), used for transpositions. */
  findByFen(fen: string): TreeNode | undefined;
  isKeyPosition(node: TreeNode): boolean;
}

/** FEN without move counters, so transpositions compare equal. */
export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

export function uciToMove(uci: string) {
  return uci.length > 4
    ? { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }
    : { from: uci.slice(0, 2), to: uci.slice(2, 4) };
}

export function loadOpening(opening: Opening): LoadedOpening {
  const byKey = new Map<string, TreeNode>();

  const index = (node: TreeNode) => {
    const key = positionKey(node.fen);
    const existing = byKey.get(key);
    if (!existing || (existing.children.length === 0 && node.children.length > 0)) byKey.set(key, node);
  };

  const build = (raw: MoveNode, fen: string, parent: TreeNode | undefined): TreeNode => {
    let uci: string | undefined;
    let san: string | undefined;
    let nodeFen = fen;
    if (raw.move) {
      const chess = new Chess(fen);
      const move = chess.move(uciToMove(raw.move)); // throws on illegal moves
      uci = raw.move;
      san = move.san;
      nodeFen = chess.fen();
    }

    const refutation: RefutationPly[] = [];
    if (raw.refutation) {
      const chess = new Chess(nodeFen);
      for (const step of raw.refutation) {
        const move = chess.move(uciToMove(step.move));
        refutation.push({ uci: step.move, san: move.san, fen: chess.fen(), text: step.text, marks: step.marks ?? [] });
      }
    }

    const node: TreeNode = {
      id: parent ? (parent.id ? `${parent.id} ${uci}` : uci!) : '',
      uci,
      san,
      role: raw.role ?? 'main',
      popularity: raw.popularity ?? 2,
      name: raw.name,
      caption: raw.caption,
      idea: raw.idea,
      lesson: raw.lesson,
      refutation,
      fen: nodeFen,
      children: [],
      parent,
    };
    node.children = (raw.children ?? []).map((child) => build(child, nodeFen, node));
    index(node);
    return node;
  };

  const root = build(opening.root, opening.startFen ?? START_FEN, undefined);
  const keyPosition = positionKey(opening.keyPositionFen);

  return {
    meta: opening,
    root,
    childrenOf(node) {
      if (node.children.length || node.role === 'mistake') return node.children;
      return byKey.get(positionKey(node.fen))?.children ?? [];
    },
    findByFen(fen) {
      return byKey.get(positionKey(fen));
    },
    isKeyPosition(node) {
      return positionKey(node.fen) === keyPosition;
    },
  };
}
