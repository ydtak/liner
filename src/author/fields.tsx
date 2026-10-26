import { useId, type ReactNode } from 'react';
import type { Mark } from '../content/schema';

export function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function TextField({ label, value, onChange, max, multiline, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  multiline?: boolean;
  placeholder?: string;
}) {
  const over = max !== undefined && value.length > max;
  const hint = max !== undefined ? <span className={over ? 'over' : ''}>{value.length}/{max}</span> : undefined;
  return (
    <Field label={label} hint={hint}>
      {(id) =>
        multiline ? (
          <textarea id={id} value={value} rows={2} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-invalid={over} />
        ) : (
          <input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-invalid={over} />
        )
      }
    </Field>
  );
}

export function SelectField<V extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: V;
  options: [V, string][];
  onChange: (v: V) => void;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <select
          id={id}
          value={String(value)}
          onChange={(e) => {
            const picked = options.find(([v]) => String(v) === e.target.value);
            if (picked) onChange(picked[0]);
          }}
        >
          {options.map(([v, text]) => (
            <option key={String(v)} value={String(v)}>{text}</option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function describeMark(m: Mark): string {
  switch (m.type) {
    case 'control':
    case 'target':
    case 'danger':
      return `${m.type} ${m.squares.join(' ')}`;
    case 'ghost':
      return `ghost ${m.piece} ${m.square}`;
    case 'badge':
      return `“${m.label}” ${m.square}`;
    default:
      return `${m.type} ${m.from}→${m.to}`;
  }
}

/** Removable chips for a step's marks. */
export function MarkChips({ marks, onChange }: { marks: Mark[]; onChange: (marks: Mark[]) => void }) {
  if (!marks.length) return <p className="field-hint">No marks yet.</p>;
  return (
    <ul className="mark-chips">
      {marks.map((m, i) => (
        <li key={i}>
          <span className={`mark-dot mark-dot-${m.type}`} aria-hidden />
          {describeMark(m)}
          <button onClick={() => onChange(marks.filter((_, j) => j !== i))} aria-label={`Remove ${describeMark(m)}`}>×</button>
        </li>
      ))}
    </ul>
  );
}
