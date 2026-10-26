import { useMemo, useState } from 'react';
import { Board } from '../board/Board';
import type { LoadedOpening } from '../content/loader';
import { activeOpenings, allItems, buildQueue } from '../practice/queue';
import { useProgress } from '../progress/ProgressContext';
import { dueLabel, progressShare } from '../progress/srs';
import { ICONS, Icon } from '../ui/bits';
import { LEARNED_KEY, REPERTOIRE_KEY, useStoredSet } from './prefs';
import './library.css';

const GROUPS = [
  { id: 'white', title: 'I play White' },
  { id: 'black-vs-e4', title: 'Black vs 1.e4' },
  { id: 'black-vs-d4', title: 'Black vs 1.d4' },
] as const;

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'beginner', label: 'Beginner-friendly' },
  { id: 'setup', label: 'Setups' },
  { id: 'repertoire', label: '★ My repertoire' },
] as const;
type Filter = (typeof FILTERS)[number]['id'];

interface LibraryProps {
  openings: LoadedOpening[];
  onLearn: (id: string) => void;
  onExplore: (id: string) => void;
  onPractice: (id?: string) => void;
  onSettings: () => void;
}

export function Library({ openings, onLearn, onExplore, onPractice, onSettings }: LibraryProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const repertoire = useStoredSet(REPERTOIRE_KEY);
  const learned = useStoredSet(LEARNED_KEY);
  const { ready, progress } = useProgress();

  const items = useMemo(() => allItems(openings), [openings]);
  const shareFor = (id: string) => progressShare(items.filter((i) => i.opening.meta.id === id).map((i) => progress[i.key]));

  const visible = openings.filter((o) => {
    if (filter === 'beginner') return o.meta.difficulty === 1;
    if (filter === 'setup') return o.meta.kind === 'setup';
    if (filter === 'repertoire') return repertoire.ids.has(o.meta.id);
    return true;
  });

  return (
    <main className="library">
      <header className="library-head">
        <div>
          <h1>Liner</h1>
          <p>Learn openings on the board, one idea at a time.</p>
        </div>
        <button className="icon-btn" onClick={onSettings} aria-label="Settings">
          <Icon d={ICONS.settings} />
        </button>
      </header>

      {/* Same-size placeholder while saved progress loads, so the list doesn't jump. */}
      {!ready && <div className="due-card due-placeholder" aria-hidden />}
      {ready && (
        <DueCard
          openings={openings}
          progress={progress}
          starred={repertoire.ids}
          learned={learned.ids}
          onPractice={() => onPractice()}
        />
      )}

      <div className="chips library-filters" role="group" aria-label="Filter openings">
        {FILTERS.map((f) => (
          <button key={f.id} className={`chip${filter === f.id ? ' on' : ''}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="library-empty">
          {filter === 'repertoire' ? 'Tap the ☆ on an opening to add it to your repertoire.' : 'Nothing here yet.'}
        </p>
      )}

      {GROUPS.map((group) => {
        const groupItems = visible.filter((o) => o.meta.group === group.id);
        if (!groupItems.length) return null;
        return (
          <section key={group.id} className="group">
            <h2>{group.title}</h2>
            {groupItems.map((o) => {
              const id = o.meta.id;
              const starred = repertoire.ids.has(id);
              const share = shareFor(id);
              return (
                <article key={id} className="card">
                  <button className="card-main" onClick={() => onLearn(id)} aria-label={`Learn ${o.meta.name}`}>
                    <div className="card-board" aria-hidden>
                      <Board fen={o.meta.setupFen ?? o.meta.keyPositionFen} orientation={o.meta.side} dests={null} preview />
                    </div>
                    <div className="card-text">
                      <span className="card-name">{o.meta.name}</span>
                      <span className="card-tagline">{o.meta.tagline}</span>
                      <span className="card-meta">
                        <span className="card-difficulty" aria-label={`Difficulty ${o.meta.difficulty} of 3`}>
                          {[1, 2, 3].map((n) => (
                            <span key={n} className={n <= o.meta.difficulty ? 'dot on' : 'dot'} />
                          ))}
                        </span>
                        {o.meta.kind === 'setup' && <span className="tag">Setup</span>}
                        {learned.ids.has(id) && <span className="tag tag-done">✓ Learned</span>}
                        {share > 0 && <Ring share={share} />}
                      </span>
                    </div>
                  </button>
                  <button
                    className={`star${starred ? ' on' : ''}`}
                    onClick={() => repertoire.toggle(id)}
                    aria-pressed={starred}
                    aria-label={starred ? `Remove ${o.meta.name} from repertoire` : `Add ${o.meta.name} to repertoire`}
                  >
                    {starred ? '★' : '☆'}
                  </button>
                  <div className="card-actions">
                    <button className="btn btn-primary" onClick={() => onLearn(id)}>Learn</button>
                    <button className="btn" onClick={() => onExplore(id)}>Explore</button>
                    <button className="btn" onClick={() => onPractice(id)}>Practise</button>
                  </div>
                </article>
              );
            })}
          </section>
        );
      })}
    </main>
  );
}

function DueCard({ openings, progress, starred, learned, onPractice }: {
  openings: LoadedOpening[];
  progress: ReturnType<typeof useProgress>['progress'];
  starred: Set<string>;
  learned: Set<string>;
  onPractice: () => void;
}) {
  const now = Date.now();
  const active = activeOpenings(openings, progress, starred, learned);
  if (!active.length) {
    return (
      <section className="due-card due-empty">
        <p><strong>Start here:</strong> tap <em>Learn</em> on an opening. Once you've learned or starred one, practice sessions show up here.</p>
      </section>
    );
  }
  const due = buildQueue(active, progress, now, { limit: Infinity });
  if (!due.length) {
    const upcoming = allItems(active)
      .map((i) => progress[i.key])
      .filter(Boolean)
      .sort((a, b) => a.dueAt - b.dueAt)[0];
    return (
      <section className="due-card due-done">
        <p><strong>All caught up ✓</strong>{upcoming ? ` Next review ${dueLabel(upcoming, now)}.` : ''}</p>
      </section>
    );
  }
  const openingCount = new Set(due.map((d) => d.opening.meta.id)).size;
  return (
    <section className="due-card">
      <div>
        <p className="due-count">{due.length} {due.length === 1 ? 'line' : 'lines'} to practise</p>
        <p className="due-sub">From {openingCount} {openingCount === 1 ? 'opening' : 'openings'}. A session takes a few minutes.</p>
      </div>
      <button className="btn btn-primary" onClick={onPractice}>Practise now</button>
    </section>
  );
}

function Ring({ share }: { share: number }) {
  const pct = Math.round(share * 100);
  const c = 2 * Math.PI * 9;
  return (
    <span className="ring" aria-label={`${pct}% known`} title={`${pct}% known`}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
        <circle cx="12" cy="12" r="9" className="ring-track" />
        <circle cx="12" cy="12" r="9" className="ring-fill" strokeDasharray={`${c * share} ${c}`} transform="rotate(-90 12 12)" />
      </svg>
      {pct}%
    </span>
  );
}
