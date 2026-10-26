import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from '../board/Board';
import { Overlay } from '../board/Overlay';
import type { LoadedOpening, TreeNode } from '../content/loader';
import { mainLine } from '../content/lines';
import type { Mark } from '../content/schema';
import { LEARNED_KEY, usePrefs, useStoredSet } from '../app/prefs';
import { moveLabel } from '../explore/explorer';
import { KeyPosition } from '../ui/KeyPosition';
import { ConceptSummary, LayersPanel, useConcepts, useLayerCount } from '../ui/Layers';
import { moveAnnouncement, positionLabel } from '../ui/speech';
import { ICONS, Icon, Who, otherSide, turnOf } from '../ui/bits';
import '../explore/explore.css';
import './learn.css';

type Frame =
  | { kind: 'intro' }
  | { kind: 'move'; node: TreeNode; ply: number; step: number | null }
  | { kind: 'key'; node: TreeNode };

/** Intro, then one frame per idea step of every main-line move, then the key position. */
function buildFrames(line: TreeNode[]): Frame[] {
  const frames: Frame[] = [{ kind: 'intro' }];
  line.forEach((node, ply) => {
    const steps = node.idea?.steps.length ?? 0;
    if (steps === 0) frames.push({ kind: 'move', node, ply, step: null });
    for (let step = 0; step < steps; step++) frames.push({ kind: 'move', node, ply, step });
  });
  if (line.length) frames.push({ kind: 'key', node: line[line.length - 1] });
  return frames;
}

const MARK_DELAY = 450; // let the move animate before drawing its idea

interface LearnProps {
  opening: LoadedOpening;
  onExit: () => void;
  onExplore: () => void;
  onPractice: () => void;
}

export function Learn({ opening, onExit, onExplore, onPractice }: LearnProps) {
  const line = useMemo(() => mainLine(opening), [opening]);
  const frames = useMemo(() => buildFrames(line), [line]);
  const [index, setIndex] = useState(0);
  const [plan, setPlan] = useState<number | null>(null);
  const [marksFor, setMarksFor] = useState(-1);
  const [layersOpen, setLayersOpen] = useState(false);
  const { prefs } = usePrefs();
  const learned = useStoredSet(LEARNED_KEY);

  const frame = frames[index];
  const meta = opening.meta;
  const plans = meta.plans ?? [];
  const isSetupIntro = frame.kind === 'intro' && !!meta.setupFen;

  const prev = frames[index - 1];
  const newMove = frame.kind === 'move' && (prev?.kind !== 'move' || prev.node !== frame.node);

  useEffect(() => {
    setPlan(null);
    if (!newMove) {
      setMarksFor(index);
      return;
    }
    const t = setTimeout(() => setMarksFor(index), MARK_DELAY);
    return () => clearTimeout(t);
  }, [index, newMove]);

  const { add: markLearned } = learned;
  useEffect(() => {
    if (frame.kind === 'key') markLearned(meta.id);
  }, [frame.kind, meta.id, markLearned]);

  const next = () => setIndex((i) => Math.min(i + 1, frames.length - 1));
  const back = () => setIndex((i) => Math.max(i - 1, 0));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') next();
      else if (e.key === 'ArrowLeft') back();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  let fen = opening.root.fen;
  let lastMove: string | undefined;
  let marks: Mark[] = [];
  if (isSetupIntro) fen = meta.setupFen!;
  if (frame.kind === 'move' || frame.kind === 'key') {
    fen = frame.node.fen;
    lastMove = frame.node.uci;
  }
  if (frame.kind === 'move' && frame.step !== null && marksFor === index) marks = frame.node.idea!.steps[frame.step].marks;
  if (frame.kind === 'key' && plan !== null) marks = plans[plan].marks;
  const inCheck = useMemo(() => !isSetupIntro && new Chess(fen).inCheck(), [fen, isSetupIntro]);
  const concepts = useConcepts(isSetupIntro ? null : fen, meta.side);
  const layerCount = useLayerCount();
  const moveSan = frame.kind === 'move' ? frame.node.san : undefined;

  const ply = frame.kind === 'move' ? frame.ply + 1 : frame.kind === 'key' ? line.length : 0;

  return (
    <div className="explore learn">
      <header className="topbar">
        <button className="icon-btn" onClick={onExit} aria-label="Back to openings">
          <Icon d={ICONS.back} />
        </button>
        <h1>Learn: {meta.name}</h1>
        <span className="topbar-spacer" />
      </header>
      <div role="region" aria-label="Lesson progress"><div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={line.length} aria-valuenow={ply} aria-label="Moves learned">
        <span style={{ width: `${(ply / Math.max(line.length, 1)) * 100}%` }} />
      </div></div>

      <main className="explore-body">
        <div className="board-wrap">
          <Board
            fen={fen}
            orientation={meta.side}
            lastMove={lastMove}
            check={inCheck}
            dests={null}
            label={isSetupIntro ? 'The target setup formation.' : positionLabel(fen, frame.kind === 'intro' ? undefined : frame.node.san)}
          >
            <Overlay orientation={meta.side} candidates={[]} marks={marks} concepts={concepts.marks} onCandidate={() => {}} />
          </Board>
        </div>

        <div className="panel">
          <div className="chips" role="group" aria-label="Display options">
            <button className={`chip${layersOpen ? ' on' : ''}`} aria-expanded={layersOpen} onClick={() => setLayersOpen((o) => !o)}>
              Layers{layerCount > 0 && <span className="chip-count" aria-label={`${layerCount} on`}>{layerCount}</span>}
            </button>
          </div>
          {layersOpen && <LayersPanel />}
          <p className="sr-only" aria-live="assertive">{moveSan && newMove ? moveAnnouncement(frame.node.fen, moveSan) : ''}</p>
          <section className="sheet" aria-live="polite" tabIndex={0} aria-label="Explanation">
            {frame.kind === 'intro' && (
              <>
                <div className="sheet-head"><span className="pill">{meta.tagline}</span></div>
                <p className="caption">{isSetupIntro ? 'This is the setup you are building.' : meta.name}</p>
                <p className="idea-text">{meta.intro}</p>
                <p className="prompt">Tap Next to play through the main line. Every move comes with its idea.</p>
              </>
            )}

            {frame.kind === 'move' && (
              <>
                <div className="sheet-head">
                  <Who side={otherSide(turnOf(frame.node.fen))} />
                  {frame.node.name && <span className="pill">{frame.node.name}</span>}
                  {prefs.notation && frame.node.san && <span className="san">{moveLabel(frame.node.fen, frame.node.san)}</span>}
                </div>
                <p className="caption">{frame.node.caption}</p>
                {frame.step !== null && (
                  <div className={`learn-idea${marksFor === index ? ' shown' : ''}`}>
                    {frame.node.idea!.steps.length > 1 && (
                      <span className="step-count">{frame.step + 1}/{frame.node.idea!.steps.length}</span>
                    )}
                    <p>{frame.node.idea!.steps[frame.step].text}</p>
                  </div>
                )}
              </>
            )}

            {frame.kind === 'key' && (
              <>
                <KeyPosition plans={plans} selected={plan} onSelect={(i) => setPlan((p) => (p === i ? null : i))} />
                <div className="actions">
                  <button className="btn btn-primary" onClick={onPractice}>Practise from memory</button>
                  <button className="btn" onClick={onExplore}>Explore the branches</button>
                  <button className="btn" onClick={() => setIndex(0)}>Start again</button>
                </div>
              </>
            )}
            <ConceptSummary summary={concepts.summary} />
          </section>

          <nav className="controls" aria-label="Lesson controls">
            <button className="ctl" onClick={back} disabled={index === 0} aria-label="Previous step">
              <Icon d={ICONS.back} />
            </button>
            <button className="ctl ctl-primary ctl-wide" onClick={next} disabled={index === frames.length - 1}>
              Next <Icon d={ICONS.forward} />
            </button>
          </nav>
        </div>
      </main>
    </div>
  );
}
