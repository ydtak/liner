import type { Side } from '../content/schema';

export const sideName = (s: Side) => (s === 'white' ? 'White' : 'Black');
export const turnOf = (fen: string): Side => (fen.split(' ')[1] === 'w' ? 'white' : 'black');
export const otherSide = (s: Side): Side => (s === 'white' ? 'black' : 'white');

export function Who({ side }: { side: Side }) {
  return (
    <span className="who">
      <span className={`who-dot ${side}`} aria-hidden />
      {sideName(side)}
    </span>
  );
}

export function Chip({ on, onClick, tone, children }: { on: boolean; onClick: () => void; tone?: string; children: string }) {
  return (
    <button className={`chip${on ? ' on' : ''}${tone ? ` chip-${tone}` : ''}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

export function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export const ICONS = {
  back: 'M15 5l-7 7 7 7',
  forward: 'M9 5l7 7-7 7',
  restart: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4',
  lines: 'M5 6h14M5 12h9M5 18h5M17 15l3 3-3 3',
  close: 'M6 6l12 12M18 6L6 18',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  layers: 'M12 4l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16l8 4 8-4',
};
