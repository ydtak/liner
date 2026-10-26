import { useMemo } from 'react';
import { Chess, type Square } from 'chess.js';
import { conceptMarks, developmentCount, type ConceptMark } from '../chess/concepts';
import type { Side } from '../content/schema';
import { usePrefs } from '../app/prefs';
import { sideName } from './bits';

const PIECE_NAMES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

const LAYERS = [
  { key: 'layerCentre', label: 'Centre' },
  { key: 'layerHanging', label: 'Undefended' },
  { key: 'layerDevelopment', label: 'Development' },
  { key: 'layerKing', label: 'King safety' },
] as const;

/** Toggle chips for the four concept layers. */
export function LayersPanel() {
  const { prefs, toggle } = usePrefs();
  return (
    <div className="chips layers-panel" role="group" aria-label="Concept layers">
      {LAYERS.map((l) => (
        <button key={l.key} className={`chip chip-layer${prefs[l.key] ? ' on' : ''}`} aria-pressed={prefs[l.key]} onClick={() => toggle(l.key)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

export function useLayerCount() {
  const { prefs } = usePrefs();
  return LAYERS.filter((l) => prefs[l.key]).length;
}

/**
 * Concept marks for a position, plus a plain-language summary of each active
 * layer. The summary is the text equivalent of the board drawing.
 */
export function useConcepts(fen: string | null, learner: Side): { marks: ConceptMark[]; summary: string[] } {
  const { prefs } = usePrefs();
  const { layerCentre: centre, layerHanging: hanging, layerDevelopment: development, layerKing: king } = prefs;

  return useMemo(() => {
    // null: not a real game position (e.g. a setup formation without kings).
    if (!fen) return { marks: [], summary: [] };
    const marks = conceptMarks(fen, learner, { centre, hanging, development, king });
    const summary: string[] = [];
    if (!centre && !hanging && !development && !king) return { marks, summary };
    const chess = new Chess(fen);
    const them = learner === 'white' ? 'black' : 'white';
    const squares = (type: ConceptMark['type'], pick?: (m: ConceptMark) => boolean) =>
      marks.filter((m) => m.type === type && (!pick || pick(m))).map((m) => m.square);

    if (centre) {
      const you = squares('centre', (m) => m.type === 'centre' && m.tone === 'you');
      const opp = squares('centre', (m) => m.type === 'centre' && m.tone === 'them');
      const parts = [you.length && `you control ${you.join(', ')}`, opp.length && `${sideName(them)} controls ${opp.join(', ')}`].filter(Boolean);
      summary.push(`Centre: ${parts.length ? parts.join('; ') : 'evenly balanced'}.`);
    }
    if (hanging) {
      const list = squares('hanging').map((sq) => {
        const p = chess.get(sq as Square)!;
        return `${p.color === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[p.type]} on ${sq}`;
      });
      summary.push(list.length ? `Undefended or under-protected: ${list.join(', ')}.` : 'Undefended: nothing is hanging.');
    }
    if (development) {
      const mine = developmentCount(fen, learner);
      const theirs = developmentCount(fen, them);
      summary.push(`Developed: you ${mine.developed} of ${mine.total} minor pieces, ${sideName(them)} ${theirs.developed} of ${theirs.total}.`);
    }
    if (king) {
      const shields = squares('shield').map((sq) => (chess.get(sq as Square)!.color === 'w' ? 'White' : 'Black'));
      const exposed = squares('exposed');
      const parts = [shields.length && `${shields.join(' and ')} castled`, exposed.length && `open lines toward a king through ${exposed.join(', ')}`].filter(Boolean);
      summary.push(`King safety: ${parts.length ? parts.join('; ') : 'no castled kings, no open lines yet'}.`);
    }
    return { marks, summary };
  }, [fen, learner, centre, hanging, development, king]);
}

/** Text version of the active layers, shown under the caption. */
export function ConceptSummary({ summary }: { summary: string[] }) {
  if (!summary.length) return null;
  return (
    <ul className="concept-summary" aria-label="Concept layers">
      {summary.map((line) => <li key={line}>{line}</li>)}
    </ul>
  );
}
