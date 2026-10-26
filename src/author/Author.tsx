import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Dests, Key } from 'chessground/types';
import { Board } from '../board/Board';
import { Overlay, type Candidate } from '../board/Overlay';
import { getEngine, scoreToCp, type Analysis } from '../chess/engine';
import { openings } from '../content';
import { loadOpening, uciToMove } from '../content/loader';
import type { Mark, Opening } from '../content/schema';
import { validateOpening } from '../content/validate';
import { Explore } from '../explore/Explore';
import { ICONS, Icon } from '../ui/bits';
import { spokenSan } from '../ui/speech';
import { NodeEditor, type AuthorMode } from './NodeEditor';
import { OpeningEditor } from './OpeningEditor';
import { SquarePicker } from './SquarePicker';
import {
  ARROW_TOOLS, addMove, applyTool, blankOpening, clone, fenAt, marksOf, nodeAt, patchNode,
  refutationFen, refutationStep, setMarks, toJSON, type MarkTarget, type Path, type Tool,
} from './model';
import './author.css';

const DRAFT_KEY = 'liner.authorDraft';
const HISTORY_LIMIT = 50;

const TOOLS: { tool: Tool; label: string }[] = [
  { tool: 'control', label: 'Control' },
  { tool: 'target', label: 'Target' },
  { tool: 'danger', label: 'Danger' },
  { tool: 'threat', label: 'Threat →' },
  { tool: 'defend', label: 'Defend —' },
  { tool: 'ray', label: 'Line ⋯' },
  { tool: 'plan', label: 'Plan ⇢' },
  { tool: 'ghost', label: 'Ghost' },
  { tool: 'badge', label: 'Badge' },
];
const PIECES = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'];

function loadDraft(): Opening {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw) as Opening;
  } catch {
    // Fall through to a blank draft.
  }
  return blankOpening();
}

function legalDests(fen: string): Dests {
  const dests: Dests = new Map();
  for (const m of new Chess(fen).moves({ verbose: true })) {
    dests.set(m.from as Key, [...(dests.get(m.from as Key) ?? []), m.to as Key]);
  }
  return dests;
}

/** UCI for a from/to pair, auto-queening promotions. */
function toUci(fen: string, from: string, to: string): string {
  const move = new Chess(fen).moves({ verbose: true }).find((m) => m.from === from && m.to === to);
  return from + to + (move?.promotion ? 'q' : '');
}

/**
 * Dev-only content editor: build a move tree on the board, write captions and
 * "Why?" steps, draw marks, record trap refutations, then export JSON for
 * src/content/openings. Drafts autosave in this browser.
 */
export function Author({ onExit }: { onExit: () => void }) {
  const [draft, setDraft] = useState<Opening>(loadDraft);
  const [path, setPath] = useState<Path>([]);
  const [mode, setMode] = useState<AuthorMode>('move');
  const [target, setTarget] = useState<MarkTarget | null>(null);
  const [tool, setTool] = useState<Tool>('control');
  const [from, setFrom] = useState<string | null>(null);
  const [ghostPiece, setGhostPiece] = useState('wP');
  const [badgeLabel, setBadgeLabel] = useState('');
  const [tab, setTab] = useState<'move' | 'opening' | 'check' | 'export'>('move');
  const [preview, setPreview] = useState(false);
  const history = useRef<Opening[]>([]);

  const update = (fn: (d: Opening) => Opening) => {
    setDraft((d) => {
      history.current = [...history.current.slice(-HISTORY_LIMIT + 1), d];
      return fn(d);
    });
  };
  const undo = () => {
    const prev = history.current.pop();
    if (prev) setDraft(prev);
  };

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Autosave is a convenience; export is the real save.
    }
  }, [draft]);

  // Keep the selected path valid after deletions or loading another draft.
  const safePath = useMemo(() => {
    const p: Path = [];
    let node = draft.root;
    for (const i of path) {
      if (!node.children?.[i]) break;
      node = node.children[i];
      p.push(i);
    }
    return p;
  }, [draft, path]);

  const node = nodeAt(draft.root, safePath);
  const errors = useMemo(() => validateOpening(draft), [draft]);

  // Board position: the node, or a refutation step while recording/drawing on one.
  const refStep = target?.kind === 'refutation' ? target.step + 1 : undefined;
  const fen =
    mode === 'refute' ? refutationFen(draft, safePath)
      : refStep !== undefined && mode === 'draw' ? refutationFen(draft, safePath, refStep)
        : fenAt(draft, safePath);

  const drawing = mode === 'draw' && !!target;
  const marks: Mark[] = [...(drawing ? marksOf(draft, safePath, target) : []), ...(from ? [{ type: 'target' as const, squares: [from] }] : [])];

  const candidates: Candidate[] =
    mode === 'move'
      ? (node.children ?? []).map((c, i) => ({
          id: String(i),
          uci: c.move!,
          role: c.role ?? 'main',
          popularity: c.popularity ?? 2,
          label: `Go to ${c.move}`,
        }))
      : [];

  const drawOn = (t: MarkTarget) => {
    setTarget(t);
    setMode('draw');
    setFrom(null);
  };

  const onSquare = (square: string) => {
    if (!target) return;
    if (ARROW_TOOLS.includes(tool) && !from) {
      setFrom(square);
      return;
    }
    const label = tool === 'badge' ? badgeLabel.trim() : undefined;
    if (tool === 'badge' && !label) return;
    update((d) => setMarks(d, safePath, target, applyTool(marksOf(d, safePath, target), tool, square, from, { piece: ghostPiece, label })));
    setFrom(null);
  };

  const onMove = (orig: string, dest: string) => {
    const uci = toUci(fen, orig, dest);
    if (mode === 'refute') {
      update((d) => patchNode(d, safePath, { refutation: [...(nodeAt(d.root, safePath).refutation ?? []), refutationStep(uci)] }));
      return;
    }
    const r = addMove(draft, safePath, uci);
    if (r.draft !== draft) update(() => r.draft);
    setPath(r.path);
    setTarget(null);
  };

  const go = (p: Path) => {
    setPath(p);
    setTarget(null);
    setFrom(null);
    if (mode !== 'move') setMode('move');
  };

  const loadFrom = (value: string) => {
    if (!confirm('Replace the current draft? Export it first if you want to keep it.')) return;
    const next = value === 'blank' ? blankOpening() : clone(openings.find((o) => o.id === value)!);
    history.current = [];
    setDraft(next);
    go([]);
  };

  // Breadcrumb of the path, in SAN.
  const crumbs = useMemo(() => {
    const chess = new Chess(draft.startFen);
    let n = draft.root;
    return safePath.map((i, depth) => {
      n = n.children![i];
      const san = chess.move(uciToMove(n.move!)).san;
      const full = Number(chess.fen().split(' ')[5]);
      const white = chess.turn() === 'b';
      return { path: safePath.slice(0, depth + 1), label: white ? `${full}. ${san}` : san };
    });
  }, [draft, safePath]);

  const openPreview = () => {
    try {
      loadOpening(draft);
      setPreview(true);
    } catch (e) {
      alert(`Can't preview yet: ${(e as Error).message}`);
    }
  };

  if (preview) return <Explore opening={loadOpening(draft)} onExit={() => setPreview(false)} />;

  return (
    <div className="author">
      <header className="topbar">
        <button className="icon-btn" onClick={onExit} aria-label="Leave Author mode">
          <Icon d={ICONS.back} />
        </button>
        <h1>Author: {draft.name}</h1>
        <button className="btn btn-small" onClick={undo} disabled={!history.current.length}>Undo</button>
        <button className="btn btn-small btn-primary" onClick={openPreview}>Preview</button>
      </header>

      <main className="author-body">
        <div className="author-board-col">
          <div className="author-board">
            <Board
              fen={fen}
              orientation={draft.side}
              lastMove={mode === 'refute' ? node.refutation?.at(-1)?.move ?? node.move : node.move}
              dests={mode === 'draw' ? null : legalDests(fen)}
              onMove={mode === 'draw' ? undefined : onMove}
              label={`Editing ${draft.name}. ${mode === 'draw' ? 'Drawing mode: click squares.' : 'Make a move to add it.'}`}
            >
              <Overlay orientation={draft.side} candidates={candidates} marks={marks} onCandidate={(c) => go([...safePath, Number(c.id)])} />
              {drawing && <SquarePicker orientation={draft.side} onSquare={onSquare} />}
            </Board>
          </div>

          <div className="mode-bar" role="group" aria-label="Board mode">
            <button className={`chip${mode === 'move' ? ' on' : ''}`} aria-pressed={mode === 'move'} onClick={() => { setMode('move'); setFrom(null); }}>Add moves</button>
            <button className={`chip${mode === 'draw' ? ' on' : ''}`} aria-pressed={mode === 'draw'} disabled={!target} onClick={() => setMode('draw')}>Draw</button>
            {node.role === 'mistake' && (
              <button className={`chip${mode === 'refute' ? ' on' : ''}`} aria-pressed={mode === 'refute'} onClick={() => setMode('refute')}>Record refutation</button>
            )}
          </div>

          {drawing && (
            <div className="draw-toolbar" role="group" aria-label="Drawing tools">
              {TOOLS.map((t) => (
                <button key={t.tool} className={`chip chip-tool${tool === t.tool ? ' on' : ''}`} aria-pressed={tool === t.tool}
                  onClick={() => { setTool(t.tool); setFrom(null); }}>
                  {t.label}
                </button>
              ))}
              {tool === 'ghost' && (
                <select value={ghostPiece} onChange={(e) => setGhostPiece(e.target.value)} aria-label="Ghost piece">
                  {PIECES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
              {tool === 'badge' && (
                <input value={badgeLabel} onChange={(e) => setBadgeLabel(e.target.value)} placeholder="Badge text" aria-label="Badge text" maxLength={16} />
              )}
              <p className="field-hint">
                {ARROW_TOOLS.includes(tool) ? (from ? `From ${from}: now click the target square.` : 'Click the start square, then the end square.') : 'Click squares to add or remove.'}
              </p>
            </div>
          )}

          <nav className="crumbs" aria-label="Current line">
            <button className={`crumb${safePath.length === 0 ? ' on' : ''}`} onClick={() => go([])}>Start</button>
            {crumbs.map((c, i) => (
              <button key={i} className={`crumb${i === crumbs.length - 1 ? ' on' : ''}`} onClick={() => go(c.path)}>{c.label}</button>
            ))}
          </nav>
          {(node.children ?? []).length > 0 && mode === 'move' && (
            <p className="field-hint">Arrows show existing moves from here. Tap one to go there, or play a new move to add it.</p>
          )}
        </div>

        <div className="author-panel">
          <div className="tabs" role="tablist">
            {(['move', 'opening', 'check', 'export'] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
                {t === 'move' ? 'This move' : t === 'opening' ? 'Opening' : t === 'check' ? `Check${errors.length ? ` (${errors.length})` : ' ✓'}` : 'Export'}
              </button>
            ))}
          </div>
          <div className="tab-body" role="tabpanel">
            {tab !== 'move' && <h2 className="sr-only">{{ opening: 'Opening details', check: 'Check', export: 'Export' }[tab]}</h2>}
            {tab === 'move' && (
              <NodeEditor draft={draft} path={safePath} update={update} setPath={go} target={target} drawOn={drawOn} mode={mode} setMode={setMode} />
            )}
            {tab === 'opening' && (
              <OpeningEditor draft={draft} path={safePath} update={update} target={target} mode={mode} drawOn={drawOn} />
            )}
            {tab === 'check' && <CheckPanel errors={errors} fen={fen} />}
            {tab === 'export' && <ExportPanel draft={draft} onLoad={loadFrom} />}
          </div>
        </div>
      </main>
    </div>
  );
}

function CheckPanel({ errors, fen }: { errors: string[]; fen: string }) {
  const [analysis, setAnalysis] = useState<{ fen: string; result: Analysis } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    getEngine()
      .analyse(fen, 2000)
      .then((result) => setAnalysis({ fen, result }))
      .finally(() => setBusy(false));
  };
  const shown = analysis?.fen === fen ? analysis.result : null;
  const best = shown ? (() => { try { return new Chess(fen).move(uciToMove(shown.bestMove)).san; } catch { return shown.bestMove; } })() : null;
  const cp = shown ? scoreToCp(shown.score) : 0;
  const side = fen.split(' ')[1] === 'w' ? 'White' : 'Black';

  return (
    <div className="check-panel">
      <section className="editor-section">
        <h3>Validation</h3>
        {errors.length ? (
          <ul className="error-list">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        ) : (
          <p className="ok">✓ Everything checks out: legal moves, one main move per learner turn, traps with refutations, key position reached.</p>
        )}
      </section>
      <section className="editor-section">
        <h3>Engine check (this position)</h3>
        <p className="field-hint">Verify mistakes and refutations before shipping them.</p>
        <button className="btn btn-small" onClick={run} disabled={busy}>{busy ? 'Thinking…' : 'Analyse position'}</button>
        {shown && best && (
          <p>
            Best for {side}: <strong>{best}</strong> ({spokenSan(best)}). Evaluation for {side}:{' '}
            {'mate' in shown.score ? `mate in ${Math.abs(shown.score.mate)} ${shown.score.mate > 0 ? 'for' : 'against'} them` : `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(2)}`}
            {' '}at depth {shown.depth}.
          </p>
        )}
      </section>
    </div>
  );
}

function ExportPanel({ draft, onLoad }: { draft: Opening; onLoad: (value: string) => void }) {
  const json = toJSON(draft);
  const [copied, setCopied] = useState(false);
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${draft.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="export-panel">
      <section className="editor-section">
        <h3>Export</h3>
        <p className="field-hint">
          Save as <code>src/content/openings/{draft.id}.json</code>, add it to <code>src/content/index.ts</code>, then run <code>npm run content:check</code>.
        </p>
        <div className="actions">
          <button className="btn btn-small btn-primary" onClick={() => navigator.clipboard.writeText(json).then(() => setCopied(true))}>
            {copied ? 'Copied ✓' : 'Copy JSON'}
          </button>
          <button className="btn btn-small" onClick={download}>Download .json</button>
        </div>
        <textarea className="json-out" readOnly value={json} aria-label="Opening JSON" rows={12} />
      </section>
      <section className="editor-section">
        <h3>Start from</h3>
        <select defaultValue="" onChange={(e) => e.target.value && onLoad(e.target.value)} aria-label="Load a draft">
          <option value="" disabled>Choose…</option>
          <option value="blank">A blank opening</option>
          {openings.map((o) => <option key={o.id} value={o.id}>{o.name} (shipped)</option>)}
        </select>
      </section>
    </div>
  );
}
