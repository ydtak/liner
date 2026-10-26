import { useId } from 'react';
import { Board } from '../board/Board';
import { Overlay, type Candidate } from '../board/Overlay';
import type { Mark } from '../content/schema';
import { useProgress } from '../progress/ProgressContext';
import { ICONS, Icon } from '../ui/bits';
import { usePrefs } from './prefs';
import './settings.css';

// After 1.e4 e5 2.Nf3: shows a main arrow, an alternative, a trap, and a few marks.
const PREVIEW_FEN = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
const PREVIEW_ARROWS: Candidate[] = [
  { id: 'main', uci: 'b8c6', role: 'main', popularity: 3, label: 'Main move' },
  { id: 'alt', uci: 'g8f6', role: 'alt', popularity: 2, label: 'Alternative' },
  { id: 'trap', uci: 'f7f6', role: 'mistake', popularity: 1, label: 'Trap' },
];
const PREVIEW_MARKS: Mark[] = [
  { type: 'threat', from: 'f3', to: 'e5' },
  { type: 'danger', squares: ['e5'] },
  { type: 'control', squares: ['d4'] },
];

export function Settings({ onExit, onAuthor }: { onExit: () => void; onAuthor?: () => void }) {
  const { prefs, set, toggle } = usePrefs();
  const { reset } = useProgress();

  const resetProgress = () => {
    if (confirm('Reset all practice progress? Lines will start again from new. This cannot be undone.')) reset();
  };

  return (
    <main className="settings">
      <header className="topbar">
        <button className="icon-btn" onClick={onExit} aria-label="Back to openings">
          <Icon d={ICONS.back} />
        </button>
        <h1>Settings</h1>
        <span className="topbar-spacer" />
      </header>

      <div className="settings-body">
        <div className="settings-preview" aria-hidden>
          <Board fen={PREVIEW_FEN} orientation="white" lastMove="g1f3" dests={null}>
            <Overlay orientation="white" candidates={PREVIEW_ARROWS} marks={PREVIEW_MARKS} onCandidate={() => {}} decorative />
          </Board>
        </div>

        <section className="settings-group">
          <h2>Appearance</h2>
          <Segmented label="Theme" value={prefs.theme} onChange={(v) => set('theme', v)}
            options={[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]} />
          <Segmented label="Board" value={prefs.board} onChange={(v) => set('board', v)}
            options={[['sand', 'Sand'], ['walnut', 'Walnut'], ['slate', 'Slate']]} />
          <Segmented label="Colours" value={prefs.palette} onChange={(v) => set('palette', v)}
            options={[['standard', 'Standard'], ['colorblind', 'Colour-blind friendly']]}
            hint="Blue and orange instead of green and red. Arrows also differ by shape: traps are dashed." />
        </section>

        <section className="settings-group">
          <h2>Board</h2>
          <Switch label="Coordinates" hint="Show a–h and 1–8 on the board edges." on={prefs.coordinates} onChange={() => toggle('coordinates')} />
          <Switch label="Move notation" hint="Show moves like “Nf3” next to captions." on={prefs.notation} onChange={() => toggle('notation')} />
          <Segmented label="Animations" value={prefs.motion} onChange={(v) => set('motion', v)}
            options={[['system', 'System'], ['normal', 'Normal'], ['fast', 'Fast'], ['off', 'Off']]}
            hint="“System” follows your device's reduce-motion setting." />
          <Switch label="Move sounds" on={prefs.sound} onChange={() => toggle('sound')} />
        </section>

        <section className="settings-group">
          <h2>Explore</h2>
          <Switch label="Auto-reply" hint="The opponent's most common reply plays automatically after your move." on={prefs.autoReply} onChange={() => toggle('autoReply')} />
          <Switch label="Engine verdicts" hint="When you play a move that isn't in the course, a chess engine says in words whether it's good. Downloads a 1.8 MB engine the first time, then works offline." on={prefs.engine} onChange={() => toggle('engine')} />
        </section>

        <section className="settings-group">
          <h2>Data</h2>
          <p className="settings-note">Everything stays on this device. Nothing is sent anywhere.</p>
          <button className="btn btn-danger" onClick={resetProgress}>Reset practice progress</button>
        </section>

        {onAuthor && (
          <section className="settings-group">
            <h2>Content (dev only)</h2>
            <p className="settings-note">Build and edit openings on the board, then export JSON for src/content/openings.</p>
            <button className="btn" onClick={onAuthor}>Open Author mode</button>
          </section>
        )}
      </div>
    </main>
  );
}

function Segmented<V extends string>({ label, value, options, onChange, hint }: {
  label: string;
  value: V;
  options: [V, string][];
  onChange: (v: V) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="setting">
      <span className="setting-label" id={id}>{label}</span>
      <div className="segmented" role="radiogroup" aria-labelledby={id}>
        {options.map(([v, text]) => (
          <button key={v} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
      {hint && <p className="setting-hint">{hint}</p>}
    </div>
  );
}

function Switch({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: () => void }) {
  const id = useId();
  return (
    <div className="setting setting-row">
      <div>
        <span className="setting-label" id={id}>{label}</span>
        {hint && <p className="setting-hint">{hint}</p>}
      </div>
      <button role="switch" aria-checked={on} aria-labelledby={id} className={`switch${on ? ' on' : ''}`} onClick={onChange}>
        <span />
      </button>
    </div>
  );
}

