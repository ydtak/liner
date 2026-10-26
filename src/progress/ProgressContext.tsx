import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { get, set } from 'idb-keyval';
import { schedule, type LineProgress, type Result } from './srs';

type ProgressMap = Record<string, LineProgress>;

interface ProgressApi {
  ready: boolean;
  progress: ProgressMap;
  record: (key: string, result: Result) => LineProgress;
  reset: () => void;
}

const STORE_KEY = 'liner.progress';
const ProgressContext = createContext<ProgressApi | null>(null);

export const progressKey = (openingId: string, lineId: string) => `${openingId}|${lineId}`;

/**
 * Practice progress, kept in IndexedDB. If storage is unavailable (private mode,
 * blocked site data) progress still works for the session, just not across visits.
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<ProgressMap>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    get<ProgressMap>(STORE_KEY)
      .then((stored) => {
        // Merge so nothing recorded while loading is lost.
        if (!cancelled && stored) setProgress((prev) => ({ ...stored, ...prev }));
      })
      .catch(() => {})
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror of the latest state so `record` can compute and return synchronously.
  const latest = useRef(progress);
  latest.current = progress;

  const record = useCallback((key: string, result: Result) => {
    const entry = schedule(latest.current[key], result, Date.now());
    const next = { ...latest.current, [key]: entry };
    latest.current = next;
    setProgress(next);
    set(STORE_KEY, next).catch(() => {});
    return entry;
  }, []);

  const reset = useCallback(() => {
    latest.current = {};
    setProgress({});
    set(STORE_KEY, {}).catch(() => {});
  }, []);

  return <ProgressContext.Provider value={{ ready, progress, record, reset }}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressApi {
  const api = useContext(ProgressContext);
  if (!api) throw new Error('useProgress must be used inside <ProgressProvider>');
  return api;
}
