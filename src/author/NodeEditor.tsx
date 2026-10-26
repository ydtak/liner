import { Chess } from 'chess.js';
import { uciToMove } from '../content/loader';
import type { IdeaStep, Opening, RefutationStep, Role } from '../content/schema';
import { moveLabel } from '../explore/explorer';
import { MarkChips, SelectField, TextField } from './fields';
import {
  deleteNode, emptyStep, fenAt, makeMain, nodeAt, patchNode, replaceAt, setMarks,
  type MarkTarget, type Path,
} from './model';

export type AuthorMode = 'move' | 'draw' | 'refute';

interface NodeEditorProps {
  draft: Opening;
  path: Path;
  update: (fn: (d: Opening) => Opening) => void;
  setPath: (p: Path) => void;
  target: MarkTarget | null;
  drawOn: (target: MarkTarget) => void;
  mode: AuthorMode;
  setMode: (m: AuthorMode) => void;
}

const MAX_CAPTION = 80;

export function NodeEditor({ draft, path, update, setPath, target, drawOn, mode, setMode }: NodeEditorProps) {
  if (!path.length) {
    return <p className="field-hint">Start position. Make the first move on the board to add it to the tree.</p>;
  }
  const node = nodeAt(draft.root, path);
  const fen = fenAt(draft, path);
  const san = new Chess(fenAt(draft, path.slice(0, -1))).move(uciToMove(node.move!)).san;
  const steps = node.idea?.steps ?? [];
  const patch = (p: Parameters<typeof patchNode>[2]) => update((d) => patchNode(d, path, p));
  const setSteps = (s: IdeaStep[]) => patch({ idea: s.length ? { steps: s } : undefined });
  const setRefutation = (r: RefutationStep[]) => patch({ refutation: r });
  const isTarget = (t: MarkTarget) =>
    mode === 'draw' && !!target && target.kind === t.kind && 'step' in target && 'step' in t && target.step === t.step;

  // SAN for each refutation move, replayed from the mistake's position.
  const refChess = new Chess(fen);
  const refSans = (node.refutation ?? []).map((s) => {
    try {
      return refChess.move(uciToMove(s.move)).san;
    } catch {
      return s.move;
    }
  });

  return (
    <div className="node-editor">
      <h2 className="node-title">{moveLabel(fen, san)}</h2>

      <div className="field-row">
        <SelectField<Role>
          label="Role"
          value={node.role ?? 'main'}
          options={[['main', 'Main'], ['alt', 'Alternative'], ['rare', 'Sideline'], ['mistake', 'Trap (mistake)']]}
          onChange={(role) => update((d) => (role === 'main' ? makeMain(d, path) : patchNode(d, path, { role })))}
        />
        <SelectField<number>
          label="Popularity"
          value={node.popularity ?? 2}
          options={[[3, 'Common'], [2, 'Sometimes'], [1, 'Rare']]}
          onChange={(v) => patch({ popularity: v as 1 | 2 | 3 })}
        />
      </div>

      <TextField label="Branch name" value={node.name ?? ''} onChange={(v) => patch({ name: v || undefined })}
        placeholder={node.role && node.role !== 'main' ? 'Required for alternatives, sidelines and traps' : 'Optional, e.g. "Giuoco Piano"'} />
      <TextField label="Caption: what the move does" value={node.caption ?? ''} max={MAX_CAPTION} onChange={(v) => patch({ caption: v })}
        placeholder="Verb first, e.g. “Attacks the pawn on e5.”" />

      {node.role !== 'mistake' && (
        <section className="editor-section">
          <h3>Why? steps</h3>
          {steps.map((step, i) => (
            <div key={i} className={`step-card${isTarget({ kind: 'idea', step: i }) ? ' drawing' : ''}`}>
              <TextField label={`Step ${i + 1}`} value={step.text} multiline onChange={(text) => setSteps(replaceAt(steps, i, (s) => ({ ...s, text })))} />
              <MarkChips marks={step.marks} onChange={(marks) => update((d) => setMarks(d, path, { kind: 'idea', step: i }, marks))} />
              <div className="actions">
                <button className="btn btn-small" onClick={() => drawOn({ kind: 'idea', step: i })}>
                  {isTarget({ kind: 'idea', step: i }) ? 'Drawing here…' : 'Draw on board'}
                </button>
                <button className="btn btn-small" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>Remove step</button>
              </div>
            </div>
          ))}
          {steps.length < 3 && (
            <button className="btn btn-small" onClick={() => { setSteps([...steps, emptyStep()]); drawOn({ kind: 'idea', step: steps.length }); }}>
              + Add step
            </button>
          )}
        </section>
      )}

      {node.role === 'mistake' && (
        <section className="editor-section">
          <h3>Refutation</h3>
          <p className="field-hint">Play the punishing moves on the board while recording. Each move becomes a step.</p>
          {(node.refutation ?? []).map((step, i) => (
            <div key={i} className={`step-card${isTarget({ kind: 'refutation', step: i }) ? ' drawing' : ''}`}>
              <TextField label={`${i + 1}. ${refSans[i]}`} value={step.text} onChange={(text) => setRefutation(replaceAt(node.refutation!, i, (s) => ({ ...s, text })))} />
              <MarkChips marks={step.marks ?? []} onChange={(marks) => update((d) => setMarks(d, path, { kind: 'refutation', step: i }, marks))} />
              <button className="btn btn-small" onClick={() => drawOn({ kind: 'refutation', step: i })}>
                {isTarget({ kind: 'refutation', step: i }) ? 'Drawing here…' : 'Draw on board'}
              </button>
            </div>
          ))}
          <div className="actions">
            <button className={`btn btn-small${mode === 'refute' ? ' btn-primary' : ''}`} onClick={() => setMode(mode === 'refute' ? 'move' : 'refute')}>
              {mode === 'refute' ? 'Stop recording' : 'Record moves'}
            </button>
            {(node.refutation ?? []).length > 0 && (
              <button className="btn btn-small" onClick={() => setRefutation(node.refutation!.slice(0, -1))}>Undo last move</button>
            )}
          </div>
          <TextField label="Lesson: the general takeaway" value={node.lesson ?? ''} multiline onChange={(v) => patch({ lesson: v })} />
        </section>
      )}

      <button
        className="btn btn-danger btn-small"
        onClick={() => {
          if (confirm('Delete this move and everything after it?')) {
            update((d) => deleteNode(d, path));
            setPath(path.slice(0, -1));
          }
        }}
      >
        Delete this move and its branch
      </button>
    </div>
  );
}
