// Thin UCI wrapper around the Stockfish lite WASM build, running in a Web Worker.
// Loaded lazily: nothing is downloaded until the first analysis.

/** Score from the side to move's point of view. */
export type Score = { cp: number } | { mate: number };

export interface Analysis {
  bestMove: string; // UCI
  score: Score;
  pv: string[];
  depth: number;
}

const ENGINE_URL = `${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`;

/** Parse a UCI "info" line; returns null for lines without a score. */
export function parseInfo(line: string): { depth: number; score: Score; pv: string[] } | null {
  if (!line.startsWith('info') || !line.includes(' score ')) return null;
  if (/ multipv (?!1\b)\d+/.test(line)) return null; // only the best line
  const depth = Number(line.match(/ depth (\d+)/)?.[1] ?? 0);
  const cp = line.match(/ score cp (-?\d+)/);
  const mate = line.match(/ score mate (-?\d+)/);
  const score: Score | null = cp ? { cp: Number(cp[1]) } : mate ? { mate: Number(mate[1]) } : null;
  if (!score) return null;
  const pv = line.match(/ pv (.+)$/)?.[1].trim().split(/\s+/) ?? [];
  return { depth, score, pv };
}

/** Collapse a score to centipawns; mates count as huge, sooner mates bigger. */
export function scoreToCp(score: Score): number {
  if ('cp' in score) return score.cp;
  const sign = score.mate > 0 ? 1 : score.mate < 0 ? -1 : 0;
  return sign * (100_000 - Math.abs(score.mate) * 100);
}

interface Job {
  fen: string;
  movetime: number;
  resolve: (a: Analysis) => void;
  reject: (e: unknown) => void;
}

class Engine {
  private worker: Worker;
  private ready: Promise<void>;
  private queue: Job[] = [];
  private current: Job | null = null;
  private last: { depth: number; score: Score; pv: string[] } | null = null;
  private onReady: (() => void) | null = null;

  constructor() {
    this.worker = new Worker(ENGINE_URL);
    this.ready = new Promise((resolve, reject) => {
      this.onReady = resolve;
      this.worker.onerror = (e) => reject(e);
    });
    this.worker.onmessage = (e: MessageEvent<string>) => this.handle(String(e.data));
    this.send('uci');
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private handle(line: string) {
    if (line === 'uciok') {
      this.send('setoption name Hash value 16');
      this.send('isready');
    } else if (line === 'readyok') {
      this.onReady?.();
      this.onReady = null;
    } else if (line.startsWith('info')) {
      const info = parseInfo(line);
      if (info) this.last = info;
    } else if (line.startsWith('bestmove') && this.current) {
      const bestMove = line.split(/\s+/)[1];
      const job = this.current;
      const last = this.last;
      this.current = null;
      this.last = null;
      if (last) job.resolve({ bestMove, score: last.score, pv: last.pv, depth: last.depth });
      else job.reject(new Error('Engine returned no score'));
      this.next();
    }
  }

  private next() {
    if (this.current || !this.queue.length) return;
    this.current = this.queue.shift()!;
    this.send(`position fen ${this.current.fen}`);
    this.send(`go depth 18 movetime ${this.current.movetime}`);
  }

  analyse(fen: string, movetime = 1000): Promise<Analysis> {
    return this.ready.then(
      () =>
        new Promise<Analysis>((resolve, reject) => {
          this.queue.push({ fen, movetime, resolve, reject });
          this.next();
        }),
    );
  }
}

let shared: Engine | null = null;

/** The one engine instance, created (and downloaded) on first use. */
export function getEngine(): Engine {
  shared ??= new Engine();
  return shared;
}
