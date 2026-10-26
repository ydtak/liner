import { positionKey } from '../content/loader';
import type { Opening } from '../content/schema';
import { MarkChips, SelectField, TextField } from './fields';
import { emptyPlan, fenAt, learnerPieces, replaceAt, setMarks, type MarkTarget, type Path } from './model';
import type { AuthorMode } from './NodeEditor';

interface OpeningEditorProps {
  draft: Opening;
  path: Path;
  update: (fn: (d: Opening) => Opening) => void;
  target: MarkTarget | null;
  mode: AuthorMode;
  drawOn: (target: MarkTarget) => void;
}

/** Opening-level fields: identity, key position, plans and the setup formation. */
export function OpeningEditor({ draft, path, update, target, mode, drawOn }: OpeningEditorProps) {
  const set = <K extends keyof Opening>(key: K, value: Opening[K]) => update((d) => ({ ...d, [key]: value }));
  const fen = fenAt(draft, path);
  const atKey = positionKey(fen) === positionKey(draft.keyPositionFen);
  const plans = draft.plans ?? [];

  return (
    <div className="opening-editor">
      <div className="field-row">
        <TextField label="Name" value={draft.name} onChange={(v) => set('name', v)} />
        <TextField label="File id" value={draft.id} onChange={(v) => set('id', v.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
      </div>
      <div className="field-row">
        <SelectField label="Learner plays" value={draft.side} options={[['white', 'White'], ['black', 'Black']]} onChange={(v) => set('side', v)} />
        <SelectField label="Group" value={draft.group}
          options={[['white', 'I play White'], ['black-vs-e4', 'Black vs 1.e4'], ['black-vs-d4', 'Black vs 1.d4']]} onChange={(v) => set('group', v)} />
      </div>
      <div className="field-row">
        <SelectField label="Kind" value={draft.kind} options={[['opening', 'Opening'], ['setup', 'Setup']]} onChange={(v) => set('kind', v)} />
        <SelectField<number> label="Difficulty" value={draft.difficulty} options={[[1, '●'], [2, '●●'], [3, '●●●']]}
          onChange={(v) => set('difficulty', v as 1 | 2 | 3)} />
      </div>
      <TextField label="Tagline" value={draft.tagline} max={40} onChange={(v) => set('tagline', v)} placeholder="e.g. Fast development, aim at f7" />
      <TextField label="Intro" value={draft.intro ?? ''} multiline onChange={(v) => set('intro', v)} />

      <section className="editor-section">
        <h3>Key position</h3>
        <p className="field-hint">{atKey ? 'The board is on the key position.' : 'Learn mode ends here and the plans below are shown here.'}</p>
        <button className="btn btn-small" disabled={atKey} onClick={() => set('keyPositionFen', fen)}>
          Use the current position
        </button>
      </section>

      <section className="editor-section">
        <h3>Plans at the key position</h3>
        {plans.map((plan, i) => {
          const drawing = mode === 'draw' && target?.kind === 'plan' && target.index === i;
          return (
            <div key={i} className={`step-card${drawing ? ' drawing' : ''}`}>
              <TextField label="Plan name" value={plan.name} onChange={(name) => set('plans', replaceAt(plans, i, (p) => ({ ...p, name })))} />
              <TextField label="Explanation" value={plan.text} multiline onChange={(text) => set('plans', replaceAt(plans, i, (p) => ({ ...p, text })))} />
              <MarkChips marks={plan.marks} onChange={(marks) => update((d) => setMarks(d, path, { kind: 'plan', index: i }, marks))} />
              <div className="actions">
                <button className="btn btn-small" onClick={() => drawOn({ kind: 'plan', index: i })}>{drawing ? 'Drawing here…' : 'Draw on board'}</button>
                <button className="btn btn-small" onClick={() => set('plans', plans.filter((_, j) => j !== i))}>Remove plan</button>
              </div>
            </div>
          );
        })}
        <button className="btn btn-small" onClick={() => { set('plans', [...plans, emptyPlan()]); drawOn({ kind: 'plan', index: plans.length }); }}>
          + Add plan
        </button>
      </section>

      {draft.kind === 'setup' && (
        <section className="editor-section">
          <h3>Setup formation</h3>
          <p className="field-hint">{draft.setupFen ? 'Set.' : 'Not set yet.'} Play to the finished formation, then capture it.</p>
          <button className="btn btn-small" onClick={() => set('setupFen', learnerPieces(fen, draft.side))}>
            Use my pieces on the board now
          </button>
        </section>
      )}
    </div>
  );
}
