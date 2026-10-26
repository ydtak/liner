// Authored content types. See docs/TECH.md §4.

export type Side = 'white' | 'black';
export type Role = 'main' | 'alt' | 'rare' | 'mistake';
export type Square = string; // "e4"
export type UciMove = string; // "g1f3"

export type Mark =
  | { type: 'control'; squares: Square[] }
  | { type: 'target'; squares: Square[] }
  | { type: 'danger'; squares: Square[] }
  | { type: 'threat'; from: Square; to: Square }
  | { type: 'defend'; from: Square; to: Square }
  | { type: 'ray'; from: Square; to: Square }
  | { type: 'ghost'; square: Square; piece: string } // "wP", "bN"
  | { type: 'plan'; from: Square; to: Square }
  | { type: 'badge'; square: Square; label: string };

export interface IdeaStep {
  text: string;
  marks: Mark[];
}

export interface Idea {
  steps: IdeaStep[];
}

export interface RefutationStep {
  move: UciMove;
  text: string;
  marks?: Mark[];
}

export interface Plan {
  name: string;
  text: string;
  marks: Mark[];
}

export interface MoveNode {
  move?: UciMove;
  role?: Role;
  popularity?: 1 | 2 | 3;
  name?: string;
  caption?: string;
  idea?: Idea;
  refutation?: RefutationStep[];
  lesson?: string; // mistakes only: the general takeaway
  children?: MoveNode[];
}

export interface Opening {
  id: string;
  name: string;
  side: Side;
  kind: 'opening' | 'setup';
  group: 'white' | 'black-vs-e4' | 'black-vs-d4';
  difficulty: 1 | 2 | 3;
  tagline: string;
  intro?: string;
  startFen?: string;
  /** Setups only: the learner's target formation (other side's pieces omitted). */
  setupFen?: string;
  keyPositionFen: string;
  plans?: Plan[];
  root: MoveNode;
}
