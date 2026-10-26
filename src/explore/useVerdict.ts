import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { getEngine } from '../chess/engine';
import { buildVerdict, type Verdict } from '../chess/verdict';
import { uciToMove } from '../content/loader';

export type VerdictState =
  | { status: 'idle' }
  | { status: 'thinking' }
  | { status: 'done'; verdict: Verdict }
  | { status: 'error' };

const THINK_MS = 900; // per position; two positions per verdict

/** Engine verdict for `played` from `fenBefore`; idle unless enabled and both are set. */
export function useVerdict(enabled: boolean, fenBefore: string | null, played: string | null): VerdictState {
  const [state, setState] = useState<VerdictState>({ status: 'idle' });

  useEffect(() => {
    if (!enabled || !fenBefore || !played) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'thinking' });
    const after = new Chess(fenBefore);
    after.move(uciToMove(played));
    const engine = getEngine();
    // After-position first: it also gives the opponent's best reply for the explanation.
    const run = after.isGameOver()
      ? Promise.all([engine.analyse(fenBefore, THINK_MS), Promise.resolve({ bestMove: '', score: { cp: 0 }, pv: [], depth: 0 })])
      : engine.analyse(after.fen(), THINK_MS).then((a) => engine.analyse(fenBefore, THINK_MS).then((b) => [b, a] as const));
    run
      .then(([beforeA, afterA]) => {
        if (!cancelled) setState({ status: 'done', verdict: buildVerdict(fenBefore, played, beforeA, afterA) });
      })
      .catch(() => !cancelled && setState({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [enabled, fenBefore, played]);

  return state;
}
