import { Chess } from 'chess.js';
import { START_FEN, positionKey, uciToMove } from './loader';
import type { Mark, MoveNode, Opening } from './schema';

const SQUARE = /^[a-h][1-8]$/;
const PIECE = /^[wb][PNBRQK]$/;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const MAX_CAPTION = 80;

/** Returns a list of human-readable problems; empty means the opening is valid. */
export function validateOpening(opening: Opening): string[] {
  const errors: string[] = [];
  const learner = opening.side === 'white' ? 'w' : 'b';
  const fens = new Set<string>();

  const checkMarks = (marks: Mark[], where: string) => {
    for (const mark of marks) {
      const squares =
        'squares' in mark ? mark.squares : 'square' in mark ? [mark.square] : [mark.from, mark.to];
      for (const sq of squares) if (!SQUARE.test(sq)) errors.push(`${where}: bad square "${sq}" in ${mark.type}`);
      if (mark.type === 'ghost' && !PIECE.test(mark.piece)) errors.push(`${where}: bad ghost piece "${mark.piece}"`);
    }
  };

  const walk = (node: MoveNode, fen: string, path: string) => {
    let here = fen;
    const where = path || '(root)';

    if (node.move) {
      if (!UCI.test(node.move)) errors.push(`${where}: bad UCI "${node.move}"`);
      const chess = new Chess(fen);
      try {
        chess.move(uciToMove(node.move));
      } catch {
        errors.push(`${where}: illegal move ${node.move}`);
        return;
      }
      here = chess.fen();
      if (!node.caption) errors.push(`${where}: missing caption`);
    }
    fens.add(positionKey(here));

    if (node.move && node.role && node.role !== 'main' && !node.name)
      errors.push(`${where}: ${node.role} moves need a name (shown in the line map)`);
    if (node.caption && node.caption.length > MAX_CAPTION)
      errors.push(`${where}: caption longer than ${MAX_CAPTION} chars`);
    for (const [i, step] of (node.idea?.steps ?? []).entries()) {
      if (!step.text.trim()) errors.push(`${where}: idea step ${i + 1} has no text`);
      checkMarks(step.marks, `${where} idea ${i + 1}`);
    }

    if (node.role === 'mistake') {
      if (!node.refutation?.length) errors.push(`${where}: mistake without refutation`);
      if (!node.lesson) errors.push(`${where}: mistake without lesson`);
      if (node.children?.length) errors.push(`${where}: mistakes should not have children`);
      const chess = new Chess(here);
      for (const [i, step] of (node.refutation ?? []).entries()) {
        try {
          chess.move(uciToMove(step.move));
        } catch {
          errors.push(`${where}: illegal refutation move ${i + 1} (${step.move})`);
          break;
        }
        if (!step.text.trim()) errors.push(`${where}: refutation step ${i + 1} has no text`);
        checkMarks(step.marks ?? [], `${where} refutation ${i + 1}`);
      }
    }

    const children = node.children ?? [];
    const mains = children.filter((c) => (c.role ?? 'main') === 'main').length;
    const turn = here.split(' ')[1];
    if (children.length && turn === learner && mains !== 1)
      errors.push(`${where}: learner to move needs exactly one main move (found ${mains})`);
    if (turn !== learner && mains > 1) errors.push(`${where}: more than one main reply`);

    const seen = new Set<string>();
    for (const child of children) {
      if (child.move && seen.has(child.move)) errors.push(`${where}: duplicate child ${child.move}`);
      if (child.move) seen.add(child.move);
      walk(child, here, path ? `${path} ${child.move}` : child.move ?? '?');
    }
  };

  walk(opening.root, opening.startFen ?? START_FEN, '');
  if (!fens.has(positionKey(opening.keyPositionFen))) errors.push('keyPositionFen is not reached by any line');
  for (const [i, plan] of (opening.plans ?? []).entries()) checkMarks(plan.marks, `plan ${i + 1}`);
  if (opening.kind === 'setup' && !opening.setupFen) errors.push('setups need a setupFen');
  if (opening.setupFen && !validPlacement(opening.setupFen)) errors.push('setupFen has an invalid board');
  return errors;
}

function validPlacement(fen: string): boolean {
  const ranks = fen.split(' ')[0].split('/');
  return (
    ranks.length === 8 &&
    ranks.every((rank) => {
      if (!/^[pnbrqkPNBRQK1-8]+$/.test(rank)) return false;
      return [...rank].reduce((n, ch) => n + (/\d/.test(ch) ? Number(ch) : 1), 0) === 8;
    })
  );
}
