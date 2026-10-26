import type { LoadedOpening } from '../content/loader';
import { practiceLines, type PracticeLine } from '../content/lines';
import { progressKey } from '../progress/ProgressContext';
import { isDue, type LineProgress } from '../progress/srs';

export interface QueueItem {
  opening: LoadedOpening;
  line: PracticeLine;
  key: string;
}

export const SESSION_SIZE = 8;

export function allItems(openings: LoadedOpening[]): QueueItem[] {
  return openings.flatMap((opening) =>
    practiceLines(opening).map((line) => ({ opening, line, key: progressKey(opening.meta.id, line.id) })),
  );
}

/**
 * Lines due now: reviews first (lowest box, most overdue), then new lines in tree
 * order so the main line comes before its sidelines. With `anyway`, falls back to
 * the soonest-due lines when nothing is due.
 */
export function buildQueue(
  openings: LoadedOpening[],
  progress: Record<string, LineProgress>,
  now: number,
  { anyway = false, limit = SESSION_SIZE } = {},
): QueueItem[] {
  const items = allItems(openings);
  const due = items.filter((i) => isDue(progress[i.key], now));
  const reviews = due
    .filter((i) => progress[i.key])
    .sort((a, b) => progress[a.key].box - progress[b.key].box || progress[a.key].dueAt - progress[b.key].dueAt);
  const fresh = due.filter((i) => !progress[i.key]);
  const queue = [...reviews, ...fresh];
  if (!queue.length && anyway) {
    const dueAt = (i: QueueItem) => progress[i.key]?.dueAt ?? 0;
    return [...items].sort((a, b) => dueAt(a) - dueAt(b)).slice(0, limit);
  }
  return queue.slice(0, limit);
}

/** Openings the learner has engaged with: starred, learned, or practised. */
export function activeOpenings(
  openings: LoadedOpening[],
  progress: Record<string, LineProgress>,
  starred: Set<string>,
  learned: Set<string>,
): LoadedOpening[] {
  const practised = new Set(Object.keys(progress).map((k) => k.split('|')[0]));
  return openings.filter((o) => starred.has(o.meta.id) || learned.has(o.meta.id) || practised.has(o.meta.id));
}
