// Leitner-style spaced repetition. See docs/TECH.md §6.

export type Result = 'clean' | 'hinted' | 'failed';

export interface LineProgress {
  box: number; // 0 = new or relearning … 5 = long-term
  dueAt: number; // epoch ms
  lastResult?: Result;
  reviewedAt?: number;
}

const DAY = 24 * 60 * 60 * 1000;
export const MAX_BOX = 5;
/** Days until the next review for each box. */
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];

export function schedule(prev: LineProgress | undefined, result: Result, now: number): LineProgress {
  const box = prev?.box ?? 0;
  const next = result === 'clean' ? Math.min(box + 1, MAX_BOX) : result === 'hinted' ? box : 0;
  return { box: next, dueAt: now + INTERVAL_DAYS[next] * DAY, lastResult: result, reviewedAt: now };
}

/** Never-practised lines count as due. */
export function isDue(p: LineProgress | undefined, now: number): boolean {
  return !p || p.dueAt <= now;
}

/** 0–1 progress for a set of lines: each line contributes up to box 3 ("known"). */
export function progressShare(entries: (LineProgress | undefined)[]): number {
  if (!entries.length) return 0;
  const sum = entries.reduce((n, p) => n + Math.min(p?.box ?? 0, 3), 0);
  return sum / (entries.length * 3);
}

/** Human wording for when a line comes back, e.g. "tomorrow" or "in 7 days". */
export function dueLabel(p: LineProgress, now: number): string {
  const days = Math.round((p.dueAt - now) / DAY);
  if (days <= 0) return 'again soon';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}
