import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { openings } from '../content';
import { loadOpening, type LoadedOpening } from '../content/loader';
import { Explore } from '../explore/Explore';
import { Learn } from '../learn/Learn';
import { Practice } from '../practice/Practice';
import { activeOpenings, buildQueue } from '../practice/queue';
import { ProgressProvider, useProgress } from '../progress/ProgressContext';
import { LEARNED_KEY, PrefsProvider, REPERTOIRE_KEY, useStoredSet } from './prefs';
import { Settings } from './Settings';
import { Library } from './Library';

// Dev-only content editor, split out so production never downloads it.
const Author = import.meta.env.DEV ? lazy(() => import('../author/Author').then((m) => ({ default: m.Author }))) : null;

function useHash() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

const go = (hash: string) => {
  location.hash = hash;
};

export function App() {
  return (
    <PrefsProvider>
      <ProgressProvider>
        <Routes />
      </ProgressProvider>
    </PrefsProvider>
  );
}

function Routes() {
  const loaded = useMemo(() => openings.map(loadOpening), []);
  const hash = useHash();
  const [, view, openingId] = hash.match(/^#\/(open|learn|practice)(?:\/([\w-]+))?/) ?? [];
  const opening = loaded.find((o) => o.meta.id === openingId);

  useEffect(() => {
    // Block body: newer browsers return a Promise from scrollTo, which React would treat as a cleanup.
    window.scrollTo(0, 0);
  }, [hash]);

  if (hash.startsWith('#/settings')) return <Settings onExit={() => go('#/')} onAuthor={Author ? () => go('#/author') : undefined} />;
  if (Author && hash.startsWith('#/author')) {
    return (
      <Suspense fallback={null}>
        <Author onExit={() => go('#/settings')} />
      </Suspense>
    );
  }
  if (view === 'practice') {
    return <PracticeRoute key={hash} openings={opening ? [opening] : loaded} single={!!opening} />;
  }
  if (opening && view === 'learn') {
    return (
      <Learn
        key={opening.meta.id}
        opening={opening}
        onExit={() => go('#/')}
        onExplore={() => go(`#/open/${opening.meta.id}`)}
        onPractice={() => go(`#/practice/${opening.meta.id}`)}
      />
    );
  }
  if (opening) return <Explore key={opening.meta.id} opening={opening} onExit={() => go('#/')} />;
  return (
    <Library
      openings={loaded}
      onLearn={(id) => go(`#/learn/${id}`)}
      onExplore={(id) => go(`#/open/${id}`)}
      onPractice={(id) => go(id ? `#/practice/${id}` : '#/practice')}
      onSettings={() => go('#/settings')}
    />
  );
}

/** Builds the session queue once, after saved progress has loaded. */
function PracticeRoute({ openings, single }: { openings: LoadedOpening[]; single: boolean }) {
  const { ready, progress } = useProgress();
  const starred = useStoredSet(REPERTOIRE_KEY).ids;
  const learned = useStoredSet(LEARNED_KEY).ids;
  const [queue, setQueue] = useState<ReturnType<typeof buildQueue> | null>(null);

  useEffect(() => {
    if (!ready || queue) return;
    const pool = single ? openings : activeOpenings(openings, progress, starred, learned);
    // A single opening always gets a session; the mixed queue only shows what's due.
    setQueue(buildQueue(pool, progress, Date.now(), { anyway: single }));
  }, [ready, queue, single, openings, progress, starred, learned]);

  if (!queue) return null;
  return <Practice queue={queue} onExit={() => go('#/')} onExplore={(id) => go(`#/open/${id}`)} />;
}
