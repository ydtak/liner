import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

// Per-viewer conveniences only. Storage can be missing or throw (private mode,
// blocked site data), so every access is guarded and the app works without it.
function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the in-memory value.
  }
}

export interface Prefs {
  // Explore display
  showTraps: boolean;
  autoReply: boolean;
  showSetup: boolean;
  // Concept layers
  layerCentre: boolean;
  layerHanging: boolean;
  layerDevelopment: boolean;
  layerKing: boolean;
  // Settings
  notation: boolean;
  coordinates: boolean;
  sound: boolean;
  engine: boolean; // engine verdicts for off-the-map moves (downloads the engine once)
  theme: 'system' | 'light' | 'dark';
  board: 'sand' | 'walnut' | 'slate';
  palette: 'standard' | 'colorblind';
  motion: 'system' | 'normal' | 'fast' | 'off';
}

type BooleanKey = { [K in keyof Prefs]: Prefs[K] extends boolean ? K : never }[keyof Prefs];

const PREFS_KEY = 'liner.prefs';
export const DEFAULT_PREFS: Prefs = {
  showTraps: false,
  autoReply: false,
  showSetup: true,
  layerCentre: false,
  layerHanging: false,
  layerDevelopment: false,
  layerKing: false,
  notation: false,
  coordinates: false,
  sound: false,
  engine: false,
  theme: 'system',
  board: 'sand',
  palette: 'standard',
  motion: 'system',
};

interface PrefsApi {
  prefs: Prefs;
  set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  toggle: (key: BooleanKey) => void;
  /** Move animation length after applying the motion setting and the OS preference. */
  animationMs: number;
}

const PrefsContext = createContext<PrefsApi | null>(null);

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** One shared copy of the preferences, so every screen and the board stay in sync. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(() => ({ ...DEFAULT_PREFS, ...readJSON(PREFS_KEY, {}) }));

  const set = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((p) => {
      const next = { ...p, [key]: value };
      writeJSON(PREFS_KEY, next);
      return next;
    });
  }, []);
  const toggle = useCallback((key: BooleanKey) => {
    setPrefs((p) => {
      const next = { ...p, [key]: !p[key] };
      writeJSON(PREFS_KEY, next);
      return next;
    });
  }, []);

  const motionOff = prefs.motion === 'off' || (prefs.motion === 'system' && prefersReducedMotion());
  const animationMs = motionOff ? 0 : prefs.motion === 'fast' ? 120 : 250;

  // Theme, board palette and motion are applied as attributes on <html> for CSS.
  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = prefs.theme;
    root.dataset.board = prefs.board;
    root.dataset.palette = prefs.palette;
    root.dataset.motion = motionOff ? 'off' : 'on';
  }, [prefs.theme, prefs.board, prefs.palette, motionOff]);

  return <PrefsContext.Provider value={{ prefs, set, toggle, animationMs }}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsApi {
  const api = useContext(PrefsContext);
  if (!api) throw new Error('usePrefs must be used inside <PrefsProvider>');
  return api;
}

/** A remembered set of ids, e.g. starred or learned openings. */
export function useStoredSet(key: string) {
  const [ids, setIds] = useState<Set<string>>(() => new Set(readJSON<string[]>(key, [])));
  const update = useCallback(
    (fn: (s: Set<string>) => void) => {
      setIds((prev) => {
        const next = new Set(prev);
        fn(next);
        writeJSON(key, [...next]);
        return next;
      });
    },
    [key],
  );
  const toggle = useCallback((id: string) => update((s) => (s.has(id) ? s.delete(id) : s.add(id))), [update]);
  const add = useCallback((id: string) => update((s) => s.add(id)), [update]);
  return { ids, toggle, add };
}

export const REPERTOIRE_KEY = 'liner.repertoire';
export const LEARNED_KEY = 'liner.learned';
