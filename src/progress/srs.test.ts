import { describe, expect, it } from 'vitest';
import { INTERVAL_DAYS, isDue, progressShare, schedule } from './srs';

const DAY = 86_400_000;

describe('schedule', () => {
  it('moves a clean line up one box with a longer interval', () => {
    const p1 = schedule(undefined, 'clean', 0);
    expect(p1).toMatchObject({ box: 1, dueAt: INTERVAL_DAYS[1] * DAY });
    const p2 = schedule(p1, 'clean', DAY);
    expect(p2).toMatchObject({ box: 2, dueAt: DAY + INTERVAL_DAYS[2] * DAY });
  });

  it('keeps the box when hinted and resets when failed', () => {
    const p = { box: 3, dueAt: 0 };
    expect(schedule(p, 'hinted', 0).box).toBe(3);
    expect(schedule(p, 'failed', 0)).toMatchObject({ box: 0, dueAt: 0 });
  });

  it('caps at the top box', () => {
    expect(schedule({ box: 5, dueAt: 0 }, 'clean', 0).box).toBe(5);
  });
});

describe('due and progress', () => {
  it('treats unseen lines as due', () => {
    expect(isDue(undefined, 0)).toBe(true);
    expect(isDue({ box: 1, dueAt: 10 }, 5)).toBe(false);
  });

  it('counts each line up to box 3', () => {
    expect(progressShare([undefined, { box: 5, dueAt: 0 }])).toBe(0.5);
  });
});
