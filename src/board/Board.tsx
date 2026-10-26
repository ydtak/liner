import { useEffect, useRef, type ReactNode } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Color, Dests, Key } from 'chessground/types';
import { usePrefs } from '../app/prefs';
import { playMoveSound } from '../app/sound';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';
import './board.css';

interface BoardProps {
  fen: string;
  orientation: Color;
  lastMove?: string; // UCI
  check?: boolean;
  /** Legal moves for the side to move; null makes the board view-only. */
  dests: Dests | null;
  onMove?: (from: string, to: string) => void;
  /** Change to snap the board back to `fen` after a rejected move (same fen, new key). */
  syncKey?: number;
  /** Small decorative board (cards, line map): no coordinates, sound or animation. */
  preview?: boolean;
  /** Screen-reader summary of the position, e.g. "Black to move. Last move: knight to f3." */
  label?: string;
  /** Layers drawn on top of the board (overlay, ghosts). */
  children?: ReactNode;
}

const pieceCount = (fen: string) => fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;

export function Board({ fen, orientation, lastMove, check, dests, onMove, syncKey, preview, label, children }: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const viewOnly = !onMove;
  const { prefs, animationMs } = usePrefs();
  const coordinates = !preview && prefs.coordinates;
  const duration = preview ? 0 : animationMs;

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, {
      coordinates: false,
      highlight: { lastMove: true, check: true },
      movable: { free: false, showDests: true, rookCastle: false },
      premovable: { enabled: false },
      drawable: { enabled: false },
      events: { move: (orig, dest) => onMoveRef.current?.(orig, dest) },
    });
    const resize = new ResizeObserver(() => api.current?.redrawAll());
    resize.observe(el.current);
    return () => {
      resize.disconnect();
      api.current?.destroy();
      api.current = null;
    };
  }, []);

  // Coordinates are drawn when the board's elements are (re)built.
  useEffect(() => {
    if (!api.current) return;
    api.current.set({ coordinates });
    api.current.redrawAll();
  }, [coordinates]);

  useEffect(() => {
    api.current?.set({ animation: { enabled: duration > 0, duration } });
  }, [duration]);

  useEffect(() => {
    const turnColor: Color = fen.split(' ')[1] === 'b' ? 'black' : 'white';
    api.current?.set({
      fen,
      orientation,
      turnColor,
      check: check ? turnColor : false,
      lastMove: lastMove ? [lastMove.slice(0, 2) as Key, lastMove.slice(2, 4) as Key] : undefined,
      viewOnly,
      movable: { color: dests ? turnColor : undefined, dests: dests ?? new Map() },
      selected: undefined,
    });
  }, [fen, orientation, lastMove, check, dests, viewOnly, syncKey]);

  // Move sound: only when the position actually changes, not on first render.
  const prevFen = useRef(fen);
  useEffect(() => {
    if (prevFen.current === fen) return;
    if (!preview && prefs.sound && lastMove) playMoveSound(pieceCount(fen) < pieceCount(prevFen.current));
    prevFen.current = fen;
  }, [fen, lastMove, preview, prefs.sound]);

  return (
    <div className="board" role={label ? 'group' : undefined} aria-label={label ? `Chess board. ${label}` : undefined}>
      <div ref={el} className="board-cg" aria-hidden />
      {children}
    </div>
  );
}
