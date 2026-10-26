import { useEffect, useId, useMemo, useReducer, useRef, useState, type FormEvent } from 'react';
import { Chess } from 'chess.js';
import type { Dests, Key } from 'chessground/types';
import { Board } from '../board/Board';
import { Overlay, type Candidate } from '../board/Overlay';
import type { Mark } from '../content/schema';
import { usePrefs } from '../app/prefs';
import { useProgress } from '../progress/ProgressContext';
import { dueLabel, type LineProgress, type Result } from '../progress/srs';
import { moveLabel } from '../explore/explorer';
import { moveAnnouncement, positionLabel } from '../ui/speech';
import { ICONS, Icon, Who, otherSide, sideName, turnOf } from '../ui/bits';
import { attemptReducer, attemptResult, freshAttempt, type Attempt } from './attempt';
import type { QueueItem } from './queue';
import '../explore/explore.css';
import './practice.css';

const OPPONENT_DELAY = 600;
const RESULT_TEXT: Record<Result, { label: string; tone: string }> = {
  clean: { label: 'Clean!', tone: 'clean' },
  hinted: { label: 'With help', tone: 'hinted' },
  failed: { label: 'Needs work', tone: 'failed' },
};

function legalDests(fen: string): Dests {
  const dests: Dests = new Map();
  for (const m of new Chess(fen).moves({ verbose: true })) {
    const list = dests.get(m.from as Key) ?? [];
    list.push(m.to as Key);
    dests.set(m.from as Key, list);
  }
  return dests;
}

interface PracticeProps {
  queue: QueueItem[];
  onExit: () => void;
  onExplore: (openingId: string) => void;
}

export function Practice({ queue, onExit, onExplore }: PracticeProps) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);

  if (index >= queue.length) {
    return <SessionDone results={results} onExit={onExit} />;
  }
  const item = queue[index];
  return (
    <LineDrill
      key={item.key + index}
      item={item}
      position={index + 1}
      total={queue.length}
      onExit={onExit}
      onExplore={() => onExplore(item.opening.meta.id)}
      onNext={(r) => {
        setResults((rs) => [...rs, r]);
        setIndex((i) => i + 1);
      }}
    />
  );
}

function LineDrill({ item, position, total, onExit, onExplore, onNext }: {
  item: QueueItem;
  position: number;
  total: number;
  onExit: () => void;
  onExplore: () => void;
  onNext: (r: Result) => void;
}) {
  const { opening, line } = item;
  const learner = opening.meta.side;
  const reduce = useMemo(() => attemptReducer(line, opening.root), [line, opening.root]);
  const [a, dispatch] = useReducer(reduce, freshAttempt);
  const { record } = useProgress();
  const { prefs } = usePrefs();
  const [saved, setSaved] = useState<{ result: Result; entry: LineProgress } | null>(null);
  const [shake, setShake] = useState(false);

  const done = a.ply >= line.nodes.length;
  const last = a.ply > 0 ? line.nodes[a.ply - 1] : undefined;
  const expected = line.nodes[a.ply];
  const baseFen = last?.fen ?? opening.root.fen;
  const toMove = turnOf(baseFen);
  const learnersTurn = !done && toMove === learner;

  // Opponent replies automatically.
  useEffect(() => {
    if (done || learnersTurn || a.review) return;
    const t = setTimeout(() => dispatch({ type: 'opponent' }), OPPONENT_DELAY);
    return () => clearTimeout(t);
  }, [done, learnersTurn, a.review, a.ply]);

  // Record the result once, when the line is finished.
  const recorded = useRef(false);
  useEffect(() => {
    if (!done || recorded.current) return;
    recorded.current = true;
    const result = attemptResult(a);
    setSaved({ result, entry: record(item.key, result) });
  }, [done, a, item.key, record]);

  // Gentle shake when a move is rejected.
  useEffect(() => {
    if (a.sync === 0 || a.review) return;
    setShake(true);
    const t = setTimeout(() => setShake(false), 350);
    return () => clearTimeout(t);
  }, [a.sync, a.review]);

  let fen = baseFen;
  let lastMove = last?.uci;
  let marks: Mark[] = [];
  const candidates: Candidate[] = [];
  if (a.review) {
    const ply = a.review.step >= 0 ? a.review.mistake.refutation[a.review.step] : undefined;
    fen = ply?.fen ?? a.review.mistake.fen;
    lastMove = ply?.uci ?? a.review.mistake.uci;
    marks = ply?.marks ?? [];
  } else if (learnersTurn && expected?.uci) {
    const from = expected.uci.slice(0, 2);
    const to = expected.uci.slice(2, 4);
    if (a.why !== null) marks = expected.idea?.steps[a.why]?.marks ?? [];
    else if (a.hint === 1) marks = [{ type: 'target', squares: [from] }];
    else if (a.hint === 2) marks = [{ type: 'target', squares: [from] }, { type: 'control', squares: [to] }];
    if (a.hint >= 3 && a.why === null) {
      candidates.push({ id: expected.id, uci: expected.uci, role: 'main', popularity: 3, label: `Answer: ${expected.san}` });
    }
  }

  const dests = useMemo(() => (learnersTurn && !a.review ? legalDests(fen) : null), [fen, learnersTurn, a.review]);
  const inCheck = useMemo(() => new Chess(fen).inCheck(), [fen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
      if (a.review && e.key === 'ArrowRight') dispatch({ type: 'reviewStep', delta: 1 });
      else if (a.review && e.key === 'ArrowLeft') dispatch({ type: 'reviewStep', delta: -1 });
      else if (!a.review && learnersTurn && (e.key === 'h' || e.key === 'H')) dispatch({ type: 'hint' });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [a.review, learnersTurn]);

  return (
    <div className="explore practice">
      <header className="topbar">
        <button className="icon-btn" onClick={onExit} aria-label="End practice">
          <Icon d={ICONS.close} />
        </button>
        <h1>Practice · {position} of {total}</h1>
        <span className="topbar-spacer" />
      </header>
      <div className="progress" aria-hidden>
        <span style={{ width: `${(Math.min(a.ply, line.nodes.length) / line.nodes.length) * 100}%` }} />
      </div>

      <main className="explore-body">
        <div className={`board-wrap${shake ? ' shake' : ''}`}>
          <Board
            fen={fen}
            orientation={learner}
            lastMove={lastMove}
            check={inCheck}
            dests={dests}
            syncKey={a.sync}
            label={positionLabel(fen, a.review ? undefined : last?.san)}
            onMove={(from, to) => dispatch({ type: 'move', uci: from + to })}
          >
            <Overlay orientation={learner} candidates={candidates} marks={marks} onCandidate={(c) => dispatch({ type: 'move', uci: c.uci })} />
          </Board>
        </div>

        <div className="panel">
          <section className="sheet" aria-live="polite" tabIndex={0} aria-label="Explanation">
            <div className="sheet-head">
              <span className="pill">{opening.meta.name}</span>
              <span className="line-name">{line.title}</span>
            </div>

            {a.review ? (
              <ReviewSheet a={a} notation={prefs.notation} dispatch={dispatch} />
            ) : done ? (
              <LineSummary saved={saved} onNext={() => saved && onNext(saved.result)} onExplore={onExplore} />
            ) : (
              <DrillSheet
                a={a}
                learner={learner}
                learnersTurn={learnersTurn}
                expected={expected}
                last={last}
                notation={prefs.notation}
                dispatch={dispatch}
              />
            )}
            {learnersTurn && !a.review && <MoveInput fen={fen} onMove={(uci) => dispatch({ type: 'move', uci })} />}
          </section>
          <p className="sr-only" aria-live="assertive">
            {last && !a.review && otherSide(turnOf(last.fen)) !== learner ? moveAnnouncement(last.fen, last.san!) : ''}
          </p>
        </div>
      </main>
    </div>
  );
}

function DrillSheet({ a, learner, learnersTurn, expected, last, notation, dispatch }: {
  a: Attempt;
  learner: ReturnType<typeof turnOf>;
  learnersTurn: boolean;
  expected: QueueItem['line']['nodes'][number] | undefined;
  last: QueueItem['line']['nodes'][number] | undefined;
  notation: boolean;
  dispatch: (action: Parameters<ReturnType<typeof attemptReducer>>[1]) => void;
}) {
  const fb = a.feedback;
  const whyStep = a.why !== null ? expected?.idea?.steps[a.why] : undefined;

  return (
    <>
      {fb?.kind === 'correct' && (
        <p className="feedback feedback-good">
          <strong>✓ Right.</strong> {fb.node.caption}
        </p>
      )}
      {fb?.kind === 'alt' && learnersTurn && (
        <p className="feedback feedback-alt">
          <strong>Also playable,</strong> but this line practises a different move. Try again.
        </p>
      )}
      {fb?.kind === 'mistake' && learnersTurn && (
        <div className="feedback feedback-bad">
          <p><strong>That's a trap:</strong> {fb.node.name}. Try another move.</p>
          <button className="btn" onClick={() => dispatch({ type: 'review' })}>What's wrong with mine?</button>
        </div>
      )}
      {fb?.kind === 'wrong' && learnersTurn && (
        <p className="feedback feedback-bad"><strong>Not quite.</strong> Try again, or take a hint.</p>
      )}

      {last && otherSide(turnOf(last.fen)) !== learner && (
        <p className="caption-small">
          <Who side={otherSide(learner)} /> {notation && last.san ? `${moveLabel(last.fen, last.san)} · ` : ''}{last.caption}
        </p>
      )}

      {learnersTurn ? (
        <>
          <p className="caption">Your move{a.ply === 0 ? `: how does ${sideName(learner)} start?` : '.'}</p>
          {whyStep ? (
            <div className="why-step">
              <span className="step-count">{a.why! + 1}/{expected!.idea!.steps.length}</span>
              <p>{whyStep.text}</p>
              <button className="btn btn-primary" onClick={() => dispatch({ type: 'nextWhy' })}>
                {a.why! + 1 < expected!.idea!.steps.length ? 'Next' : 'Got it'}
              </button>
            </div>
          ) : (
            <div className="actions">
              <button className="btn btn-why" onClick={() => dispatch({ type: 'hint' })} disabled={a.hint >= 3}>
                {['Hint: which piece?', 'Hint: where to?', 'Show the move', 'Answer shown'][a.hint]}
              </button>
              {a.hint >= 3 && expected?.idea && (
                <button className="btn" onClick={() => dispatch({ type: 'why' })}>Why?</button>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="prompt">{sideName(otherSide(learner))} is replying…</p>
      )}
    </>
  );
}

/** Type a move like "Nf3" or "e4": a keyboard and screen-reader alternative to dragging. */
function MoveInput({ fen, onMove }: { fen: string; onMove: (uci: string) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const id = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const san = text.trim();
    if (!san) return;
    try {
      const move = new Chess(fen).move(san);
      setText('');
      setError('');
      onMove(move.from + move.to + (move.promotion ?? ''));
    } catch {
      setError(`“${san}” isn't a legal move here. Try notation like Nf3, e4 or O-O.`);
    }
  };

  return (
    <form className="move-input" onSubmit={submit}>
      <label htmlFor={id}>Or type your move</label>
      <div>
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Nf3"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button className="btn" type="submit">Play</button>
      </div>
      {error && <p id={`${id}-error`} className="move-input-error" role="alert">{error}</p>}
    </form>
  );
}

function ReviewSheet({ a, notation, dispatch }: {
  a: Attempt;
  notation: boolean;
  dispatch: (action: Parameters<ReturnType<typeof attemptReducer>>[1]) => void;
}) {
  const { mistake, step } = a.review!;
  const ply = step >= 0 ? mistake.refutation[step] : undefined;
  const lastStep = step === mistake.refutation.length - 1;
  return (
    <>
      <div className="sheet-head">
        <span className="pill pill-mistake">Trap</span>
        <Who side={otherSide(turnOf(ply?.fen ?? mistake.fen))} />
        {notation && <span className="san">{moveLabel(ply?.fen ?? mistake.fen, ply?.san ?? mistake.san!)}</span>}
      </div>
      <p className="caption">{ply ? ply.text : mistake.caption}</p>
      {lastStep && <div className="lesson"><strong>Lesson</strong> {mistake.lesson}</div>}
      <div className="actions">
        <button className="btn" onClick={() => dispatch({ type: 'reviewStep', delta: -1 })} disabled={step < 0}>Back</button>
        {!lastStep && <button className="btn btn-primary" onClick={() => dispatch({ type: 'reviewStep', delta: 1 })}>Next</button>}
        <button className={`btn${lastStep ? ' btn-primary' : ''}`} onClick={() => dispatch({ type: 'closeReview' })}>Back to practice</button>
      </div>
    </>
  );
}

function LineSummary({ saved, onNext, onExplore }: {
  saved: { result: Result; entry: LineProgress } | null;
  onNext: () => void;
  onExplore: () => void;
}) {
  if (!saved) return null;
  const { label, tone } = RESULT_TEXT[saved.result];
  return (
    <div className="line-summary">
      <span className={`result result-${tone}`}>{label}</span>
      <p>
        {saved.result === 'clean'
          ? 'You played every move from memory.'
          : saved.result === 'hinted'
            ? 'Almost there. This line stays at the same level.'
            : "This line will come back soon so it sticks."}{' '}
        Next review: {dueLabel(saved.entry, Date.now())}.
      </p>
      <div className="actions">
        <button className="btn btn-primary" onClick={onNext}>Continue</button>
        <button className="btn" onClick={onExplore}>Explore this opening</button>
      </div>
    </div>
  );
}

function SessionDone({ results, onExit }: { results: Result[]; onExit: () => void }) {
  const count = (r: Result) => results.filter((x) => x === r).length;
  return (
    <main className="session-done">
      <h1>{results.length ? 'Session complete' : 'All caught up'}</h1>
      {results.length > 0 ? (
        <ul>
          <li><span className="result result-clean">{count('clean')}</span> clean</li>
          <li><span className="result result-hinted">{count('hinted')}</span> with help</li>
          <li><span className="result result-failed">{count('failed')}</span> need work</li>
        </ul>
      ) : (
        <p>Nothing is due right now. Come back later, or explore an opening.</p>
      )}
      <button className="btn btn-primary" onClick={onExit}>Back to openings</button>
    </main>
  );
}
