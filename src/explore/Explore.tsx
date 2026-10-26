import { useEffect, useMemo, useReducer, useState } from 'react';
import { Chess } from 'chess.js';
import type { Dests, Key } from 'chessground/types';
import { Board } from '../board/Board';
import { Overlay, type Candidate } from '../board/Overlay';
import { setupProgress } from '../chess/setup';
import { uciToMove, type LoadedOpening, type TreeNode } from '../content/loader';
import type { Side } from '../content/schema';
import { usePrefs } from '../app/prefs';
import { KeyPosition } from '../ui/KeyPosition';
import { ConceptSummary, LayersPanel, useConcepts, useLayerCount } from '../ui/Layers';
import { moveAnnouncement, positionLabel, spokenSan } from '../ui/speech';
import { Chip, ICONS, Icon, Who, otherSide, sideName, turnOf } from '../ui/bits';
import { boardView, current, initialState, mainChild, moveLabel, reducer } from './explorer';
import { LineMap } from './LineMap';
import { useVerdict, type VerdictState } from './useVerdict';
import './explore.css';

const ROLE_LABEL = { main: 'Main move', alt: 'Alternative', rare: 'Sideline', mistake: 'Trap' } as const;
const ROLE_ORDER = { main: 0, alt: 1, rare: 2, mistake: 3 } as const;

function legalDests(fen: string): Dests {
  const dests: Dests = new Map();
  for (const m of new Chess(fen).moves({ verbose: true })) {
    const list = dests.get(m.from as Key) ?? [];
    list.push(m.to as Key);
    dests.set(m.from as Key, list);
  }
  return dests;
}

export function Explore({ opening, onExit }: { opening: LoadedOpening; onExit: () => void }) {
  const reduce = useMemo(() => reducer(opening), [opening]);
  const [state, dispatch] = useReducer(reduce, opening, initialState);
  const [mapOpen, setMapOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const { prefs, set, toggle } = usePrefs();
  const layerCount = useLayerCount();
  const learner = opening.meta.side;
  const setupFen = opening.meta.setupFen;

  const here = current(state);
  const { mode } = state;
  const view = boardView(opening, state);
  const { fen, lastMove } = view;
  const toMove = turnOf(fen);
  const children = mode.kind === 'tree' ? opening.childrenOf(here.node) : [];
  const main = mainChild(children);
  const hiddenTraps = !prefs.showTraps && children.some((c) => c.role === 'mistake');
  const calm = mode.kind === 'tree' && state.why === null && state.plan === null;

  const verdict = useVerdict(prefs.engine, mode.kind === 'offmap' ? here.fen : null, mode.kind === 'offmap' ? mode.uci : null);

  const setup = setupFen ? setupProgress(setupFen, fen) : null;
  const marks =
    calm && setup && prefs.showSetup ? [...view.marks, ...setup.ghosts]
      : mode.kind === 'offmap' && verdict.status === 'done' ? verdict.verdict.marks
        : view.marks;

  const dests = useMemo(() => (mode.kind === 'tree' ? legalDests(fen) : null), [fen, mode.kind]);
  const inCheck = useMemo(() => new Chess(fen).inCheck(), [fen]);
  const concepts = useConcepts(fen, learner);

  // The move that produced the shown position, for the board label and announcements.
  const lastSan =
    mode.kind === 'offmap' ? mode.san
      : mode.kind === 'refutation' ? (mode.step >= 0 ? mode.mistake.refutation[mode.step].san : mode.mistake.san)
        : here.node.san;
  const announcement = lastSan ? moveAnnouncement(fen, lastSan) : '';

  // Ordered main-first so keys 1–4 match importance.
  const candidates: Candidate[] = calm
    ? children
        .filter((c) => prefs.showTraps || c.role !== 'mistake')
        .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
        .map((c, i) => ({
          id: c.id,
          uci: c.uci!,
          role: c.role,
          popularity: c.popularity,
          label: `${i + 1}. ${ROLE_LABEL[c.role]}: ${spokenSan(c.san!)}.${c.caption ? ` ${c.caption}` : ''}`,
          dim: toMove !== learner,
          pulse: (state.hint && c === main) || c.uci === state.suggestion,
        }))
    : [];
  // An engine suggestion that isn't part of the course gets its own pulsing arrow.
  if (calm && state.suggestion && !children.some((c) => c.uci === state.suggestion)) {
    const san = new Chess(fen).move(uciToMove(state.suggestion)).san;
    candidates.push({ id: 'suggestion', uci: state.suggestion, role: 'main', popularity: 2, pulse: true, label: `Engine suggestion: ${spokenSan(san)}.` });
  }

  // Auto-play the opponent's main reply right after the learner moves.
  useEffect(() => {
    if (!prefs.autoReply || !state.justPlayed || mode.kind !== 'tree' || toMove === learner || !main) return;
    const t = setTimeout(() => dispatch({ type: 'forward' }), 650);
    return () => clearTimeout(t);
  }, [prefs.autoReply, state.justPlayed, mode.kind, toMove, learner, main]);

  useEffect(() => {
    if (mapOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowLeft') dispatch({ type: 'back' });
      else if (e.key === 'ArrowRight') dispatch({ type: 'forward' });
      else if (e.key === 'w' || e.key === 'W') dispatch({ type: state.why === null ? 'why' : 'nextWhy' });
      else if (e.key === 't' || e.key === 'T') toggle('showTraps');
      else if (e.key === 'l' || e.key === 'L') setLayersOpen((o) => !o);
      else if (/^[1-4]$/.test(e.key) && candidates[Number(e.key) - 1]) {
        dispatch({ type: 'play', uci: candidates[Number(e.key) - 1].uci });
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.why, toggle, mapOpen, candidates]);

  const pickLine = (node: TreeNode) => {
    if (node.role === 'mistake') set('showTraps', true);
    dispatch({ type: 'jump', node });
    setMapOpen(false);
  };

  const canBack = mode.kind !== 'tree' || state.path.length > 1;
  const canForward =
    mode.kind === 'tree' ? !!main : mode.kind === 'refutation' && mode.step < mode.mistake.refutation.length - 1;

  return (
    <div className="explore">
      <header className="topbar">
        <button className="icon-btn" onClick={onExit} aria-label="Back to openings">
          <Icon d={ICONS.back} />
        </button>
        <h1>{opening.meta.name}</h1>
        <span className="topbar-spacer" />
      </header>

      <main className="explore-body">
        <div className="board-wrap">
          <Board
            fen={fen}
            orientation={learner}
            lastMove={lastMove}
            check={inCheck}
            dests={dests}
            label={positionLabel(fen, lastSan)}
            onMove={(from, to) => dispatch({ type: 'play', uci: from + to })}
          >
            <Overlay
              orientation={learner}
              candidates={candidates}
              marks={marks}
              concepts={concepts.marks}
              onCandidate={(c) => dispatch({ type: 'play', uci: c.uci })}
            />
          </Board>
        </div>

        <div className="panel">
          <div className="chips" role="group" aria-label="Display options">
            <Chip on={prefs.showTraps} onClick={() => toggle('showTraps')} tone="mistake">Traps</Chip>
            {setup && <Chip on={prefs.showSetup} onClick={() => toggle('showSetup')}>Setup</Chip>}
            <button className={`chip${layersOpen ? ' on' : ''}`} aria-expanded={layersOpen} onClick={() => setLayersOpen((o) => !o)}>
              Layers{layerCount > 0 && <span className="chip-count" aria-label={`${layerCount} on`}>{layerCount}</span>}
            </button>
          </div>
          {layersOpen && <LayersPanel />}

          <section className="sheet" aria-live="polite" tabIndex={0} aria-label="Explanation">
            <SheetContent
              opening={opening}
              state={state}
              here={here.node}
              fen={fen}
              learner={learner}
              toMove={toMove}
              hasMoves={children.length > 0}
              main={main}
              hiddenTraps={hiddenTraps}
              verdict={verdict}
              engineOn={prefs.engine}
              onAskEngine={() => set('engine', true)}
              autoReply={prefs.autoReply}
              notation={prefs.notation}
              setup={setup && prefs.showSetup && mode.kind === 'tree' ? setup : null}
              dispatch={dispatch}
            />
            <ConceptSummary summary={concepts.summary} />
          </section>
          <p className="sr-only" aria-live="assertive">{announcement}</p>

          <nav className="controls" aria-label="Move controls">
            <button className="ctl" onClick={() => dispatch({ type: 'back' })} disabled={!canBack} aria-label="Previous move">
              <Icon d={ICONS.back} />
            </button>
            <button className="ctl ctl-primary" onClick={() => dispatch({ type: 'forward' })} disabled={!canForward} aria-label="Next move">
              <Icon d={ICONS.forward} />
            </button>
            <button className="ctl" onClick={() => dispatch({ type: 'restart' })} disabled={state.path.length === 1 && mode.kind === 'tree'} aria-label="Restart">
              <Icon d={ICONS.restart} />
            </button>
            <button className="ctl" onClick={() => setMapOpen(true)} aria-label="Lines in this opening">
              <Icon d={ICONS.lines} />
            </button>
          </nav>
        </div>
      </main>

      {mapOpen && <LineMap opening={opening} onPick={pickLine} onClose={() => setMapOpen(false)} />}
    </div>
  );
}

interface SheetProps {
  opening: LoadedOpening;
  state: ReturnType<typeof initialState>;
  here: TreeNode;
  fen: string;
  learner: Side;
  toMove: Side;
  hasMoves: boolean;
  main?: TreeNode;
  hiddenTraps: boolean;
  autoReply: boolean;
  notation: boolean;
  setup: { done: number; total: number } | null;
  verdict: VerdictState;
  engineOn: boolean;
  onAskEngine: () => void;
  dispatch: (a: Parameters<ReturnType<typeof reducer>>[1]) => void;
}

function SheetContent(p: SheetProps) {
  const { state, here, dispatch } = p;
  const { mode } = state;

  if (mode.kind === 'offmap') {
    const v = p.verdict;
    const better = v.status === 'done' ? v.verdict.better : undefined;
    return (
      <>
        <div className="sheet-head"><span className="pill pill-muted">Off the map</span></div>
        <p className="caption">
          {p.notation ? <strong>{mode.san}</strong> : 'That move'} isn't part of this course yet.
        </p>
        {!p.engineOn && (
          <div className="engine-ask">
            <button className="btn btn-why" onClick={p.onAskEngine}>Ask the engine</button>
            <p className="engine-hint">Get a verdict in words. Downloads a 1.8 MB chess engine once.</p>
          </div>
        )}
        {v.status === 'thinking' && <p className="prompt engine-thinking">The engine is thinking…</p>}
        {v.status === 'error' && <p className="prompt">The engine couldn't run in this browser.</p>}
        {v.status === 'done' && (
          <div className={`verdict verdict-${v.verdict.level}`}>
            <span className="verdict-label">{v.verdict.label}</span>
            <p>{v.verdict.text}</p>
          </div>
        )}
        <div className="actions">
          {better && (
            <button className="btn btn-primary" onClick={() => dispatch({ type: 'suggest', uci: better.uci })}>Show the better move</button>
          )}
          <button className="btn" onClick={() => dispatch({ type: 'takeBack' })}>Take back</button>
        </div>
      </>
    );
  }

  if (mode.kind === 'refutation') {
    const { mistake, step } = mode;
    const ply = step >= 0 ? mistake.refutation[step] : undefined;
    const last = step === mistake.refutation.length - 1;
    const mover = otherSide(turnOf(ply?.fen ?? mistake.fen));
    return (
      <>
        <div className="sheet-head">
          <span className="pill pill-mistake">Trap</span>
          <Who side={mover} />
          {mistake.name && !ply && <span className="pill">{mistake.name}</span>}
          {p.notation && <span className="san">{moveLabel(ply?.fen ?? mistake.fen, ply?.san ?? mistake.san!)}</span>}
        </div>
        {ply ? <p className="caption">{ply.text}</p> : <p className="caption">{mistake.caption}</p>}
        {!ply && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => dispatch({ type: 'forward' })}>Natural, but… show me why</button>
            <button className="btn" onClick={() => dispatch({ type: 'takeBack' })}>Take back</button>
          </div>
        )}
        {ply && !last && <p className="prompt">Tap ▶ to continue ({step + 1}/{mistake.refutation.length})</p>}
        {last && (
          <>
            <div className="lesson"><strong>Lesson</strong> {mistake.lesson}</div>
            <div className="actions">
              <button className="btn" onClick={() => dispatch({ type: 'takeBack' })}>Take back</button>
              <button className="btn btn-primary" onClick={() => dispatch({ type: 'showRight' })}>Show the best move</button>
            </div>
          </>
        )}
      </>
    );
  }

  // Tree mode
  const isRoot = !here.uci;
  const idea = here.idea;
  const whyStep = state.why !== null ? idea?.steps[state.why] : undefined;
  const isKey = p.opening.isKeyPosition(here);
  const mover = otherSide(p.toMove);

  return (
    <>
      {isRoot ? (
        <>
          <div className="sheet-head"><span className="pill">{p.opening.meta.tagline}</span></div>
          <p className="caption">{p.opening.meta.intro}</p>
        </>
      ) : (
        <>
          <div className="sheet-head">
            <Who side={mover} />
            {here.name && <span className="pill">{here.name}</span>}
            {p.notation && here.san && <span className="san">{moveLabel(p.fen, here.san)}</span>}
          </div>
          <p className="caption">{here.caption}</p>
        </>
      )}

      {whyStep ? (
        <div className="why-step">
          <span className="step-count">{state.why! + 1}/{idea!.steps.length}</span>
          <p>{whyStep.text}</p>
          <button className="btn btn-primary" onClick={() => dispatch({ type: 'nextWhy' })}>
            {state.why! + 1 < idea!.steps.length ? 'Next' : 'Done'}
          </button>
        </div>
      ) : (
        idea && (
          <div className="actions">
            <button className="btn btn-why" onClick={() => dispatch({ type: 'why' })}>Why?</button>
          </div>
        )
      )}

      {!whyStep && p.setup && (
        <p className="setup-progress">
          <span className="setup-bar" aria-hidden><span style={{ width: `${(p.setup.done / p.setup.total) * 100}%` }} /></span>
          Setup: {p.setup.done} of {p.setup.total} pieces in place{p.setup.done < p.setup.total ? '. Faded pieces show where the rest go.' : '. Complete!'}
        </p>
      )}

      {!whyStep && state.suggestion && (
        <p className="prompt prompt-hint">The engine's suggestion is pulsing. Tap it to try it.</p>
      )}

      {!whyStep && state.hint && p.main && (
        <p className="prompt prompt-hint">Better: {p.main.caption}</p>
      )}

      {!whyStep && !state.hint && p.hasMoves && (
        <p className="prompt">
          {isRoot
            ? p.toMove === p.learner
              ? `Tap the green arrow to play ${sideName(p.learner)}'s first move.`
              : `${sideName(p.toMove)} moves first: tap an arrow, or ▶ for the most common.`
            : p.toMove === p.learner
              ? 'Your move: tap an arrow.'
              : p.autoReply
                ? `${sideName(p.toMove)} is replying…`
                : `${sideName(p.toMove)}'s reply: tap an arrow, or ▶ for the most common.`}
          {p.hiddenTraps && <span className="trap-note"> There's a trap here. Turn on Traps to see it.</span>}
        </p>
      )}

      {!p.hasMoves && !isRoot && (
        isKey ? (
          <KeyPosition
            plans={p.opening.meta.plans ?? []}
            selected={state.plan}
            onSelect={(i) => dispatch({ type: 'plan', index: i })}
          />
        ) : (
          <p className="prompt">End of this line. Go back ◀ or open the line map to explore others.</p>
        )
      )}
    </>
  );
}
