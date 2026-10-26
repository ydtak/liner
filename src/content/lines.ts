import type { LoadedOpening, TreeNode } from './loader';

/** The main continuation, falling back to the first non-mistake move. */
export function mainChild(children: TreeNode[]): TreeNode | undefined {
  return children.find((c) => c.role === 'main') ?? children.find((c) => c.role !== 'mistake');
}

/** Nodes of the main line from the first move to its end, following transpositions. */
export function mainLine(opening: LoadedOpening): TreeNode[] {
  const line: TreeNode[] = [];
  const seen = new Set<TreeNode>();
  let node = mainChild(opening.childrenOf(opening.root));
  while (node && !seen.has(node)) {
    seen.add(node);
    line.push(node);
    node = mainChild(opening.childrenOf(node));
  }
  return line;
}

export interface LineEntry {
  node: TreeNode;
  title: string;
  subtitle?: string;
  depth: number; // how many side branches deep
}

/** Named side branches and traps, in tree order, for the line map. */
export function lineMap(opening: LoadedOpening): { branches: LineEntry[]; traps: LineEntry[] } {
  const branches: LineEntry[] = [];
  const traps: LineEntry[] = [];

  const walk = (node: TreeNode, depth: number) => {
    for (const child of node.children) {
      if (child.role === 'mistake') {
        traps.push({ node: child, title: child.name ?? child.san ?? '', subtitle: child.caption, depth });
        continue;
      }
      const branchDepth = child.role === 'main' ? depth : depth + 1;
      if (child.role !== 'main') {
        branches.push({ node: child, title: child.name ?? child.san ?? '', subtitle: child.caption, depth: branchDepth });
      }
      walk(child, branchDepth);
    }
  };
  walk(opening.root, 0);
  return { branches, traps };
}

/** Names met along the main line, e.g. "Italian Game → Giuoco Piano → Giuoco Pianissimo". */
export function mainLineNames(opening: LoadedOpening): string {
  return mainLine(opening)
    .map((n) => n.name)
    .filter(Boolean)
    .join(' → ');
}

export interface PracticeLine {
  id: string; // leaf node id
  nodes: TreeNode[]; // first move … leaf
  title: string;
}

/**
 * Every root-to-leaf path the learner can practise. Mistakes are not lines, and a
 * line must include at least one move by the learner.
 */
export function practiceLines(opening: LoadedOpening): PracticeLine[] {
  const learner = opening.meta.side;
  const lines: PracticeLine[] = [];
  const walk = (node: TreeNode, path: TreeNode[]) => {
    const next = node.children.filter((c) => c.role !== 'mistake');
    if (!next.length && path.length) {
      const learnerMoves = path.some((n) => (turnOfFen(n.fen) === 'white' ? 'black' : 'white') === learner);
      const named = [...path].reverse().find((n) => n.name);
      if (learnerMoves) lines.push({ id: node.id, nodes: path, title: named?.name ?? opening.meta.name });
      return;
    }
    for (const child of next) walk(child, [...path, child]);
  };
  walk(opening.root, []);
  return lines;
}

const turnOfFen = (fen: string) => (fen.split(' ')[1] === 'w' ? 'white' : 'black');
