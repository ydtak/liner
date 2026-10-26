import { useEffect, useRef } from 'react';
import type { Mark, Role, Side } from '../content/schema';
import type { ConceptMark } from '../chess/concepts';
import { squareCenter, squareOrigin } from './geometry';

export interface Candidate {
  id: string;
  uci: string;
  role: Role;
  popularity: 1 | 2 | 3;
  label: string; // accessible name
  dim?: boolean; // opponent's candidates
  pulse?: boolean;
}

interface OverlayProps {
  orientation: Side;
  candidates: Candidate[];
  marks: Mark[];
  /** Auto-computed principle layers, drawn underneath everything else. */
  concepts?: ConceptMark[];
  onCandidate: (c: Candidate) => void;
  /** Purely illustrative: arrows are drawn but not focusable or clickable. */
  decorative?: boolean;
}

const WIDTH = { 1: 0.1, 2: 0.15, 3: 0.2 } as const;
const MIN_MISTAKE_WIDTH = 0.15;

/** SVG layer for candidate arrows and idea marks. Only arrows receive pointer events. */
export function Overlay({ orientation, candidates, marks, concepts = [], onCandidate, decorative }: OverlayProps) {
  const at = (sq: string) => squareCenter(sq, orientation);
  const ghosts = marks.filter((m) => m.type === 'ghost');

  return (
    <>
      <GhostLayer ghosts={ghosts} orientation={orientation} />
      <svg className="overlay" viewBox="0 0 8 8" aria-hidden={candidates.length === 0}>
        <ConceptLayer concepts={concepts} orientation={orientation} />
        {/* Square tints go underneath lines and arrows. */}
        {marks.map((m, i) => {
          if (m.type !== 'control' && m.type !== 'danger') return null;
          return m.squares.map((sq) => {
            const o = squareOrigin(sq, orientation);
            return <rect key={`${i}-${sq}`} className={`mark-${m.type}`} x={o.x} y={o.y} width={1} height={1} />;
          });
        })}
        {marks.map((m, i) => {
          switch (m.type) {
            case 'target':
              return m.squares.map((sq) => {
                const c = at(sq);
                return <circle key={`${i}-${sq}`} className="mark-target" cx={c.x} cy={c.y} r={0.44} />;
              });
            case 'ray': {
              const a = at(m.from);
              const b = at(m.to);
              return (
                <g key={i} className="mark-ray">
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                  <circle cx={b.x} cy={b.y} r={0.07} />
                </g>
              );
            }
            case 'defend': {
              const a = at(m.from);
              const b = at(m.to);
              return (
                <g key={i} className="mark-defend">
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                  <circle cx={a.x} cy={a.y} r={0.09} />
                  <circle cx={b.x} cy={b.y} r={0.09} />
                </g>
              );
            }
            case 'threat':
              return <Arrow key={i} from={at(m.from)} to={at(m.to)} width={0.13} className="mark-threat" />;
            case 'plan':
              return <Arrow key={i} from={at(m.from)} to={at(m.to)} width={0.09} className="mark-plan" dashed open />;
            default:
              return null;
          }
        })}
        {candidates.map((c) => {
          const from = at(c.uci.slice(0, 2));
          const to = at(c.uci.slice(2, 4));
          return (
            <g
              key={c.id}
              className={`candidate role-${c.role}${c.dim ? ' dim' : ''}${c.pulse ? ' pulse' : ''}`}
              role={decorative ? undefined : 'button'}
              tabIndex={decorative ? -1 : 0}
              aria-label={c.label}
              onClick={() => onCandidate(c)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onCandidate(c);
                }
              }}
            >
              <Arrow
                from={from}
                to={to}
                width={c.role === 'mistake' ? Math.max(WIDTH[c.popularity], MIN_MISTAKE_WIDTH) : WIDTH[c.popularity]}
                dashed={c.role === 'mistake'}
              />
              {/* Wide invisible hit area over the second half of the arrow, so the
                  piece at the arrow's tail stays draggable. */}
              <line
                className="hit"
                x1={from.x + (to.x - from.x) * 0.45}
                y1={from.y + (to.y - from.y) * 0.45}
                x2={to.x}
                y2={to.y}
              />
            </g>
          );
        })}
        {marks.map((m, i) => (m.type === 'badge' ? <Badge key={i} at={at(m.square)} label={m.label} /> : null))}
      </svg>
    </>
  );
}

interface Point {
  x: number;
  y: number;
}

function Arrow({ from, to, width, className, dashed, open }: {
  from: Point; to: Point; width: number; className?: string; dashed?: boolean; open?: boolean;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const head = Math.max(0.3, width * 2.2);
  const halfHead = head * 0.6;
  // Start a little off the origin centre and stop just short of the target centre.
  const sx = from.x + ux * 0.2;
  const sy = from.y + uy * 0.2;
  const tipX = to.x - ux * 0.12;
  const tipY = to.y - uy * 0.12;
  const baseX = tipX - ux * head;
  const baseY = tipY - uy * head;
  const left = `${baseX - uy * halfHead},${baseY + ux * halfHead}`;
  const right = `${baseX + uy * halfHead},${baseY - ux * halfHead}`;
  return (
    <g className={className}>
      <line
        className="shaft"
        x1={sx}
        y1={sy}
        x2={open ? tipX - ux * 0.05 : baseX + ux * 0.02}
        y2={open ? tipY - uy * 0.05 : baseY + uy * 0.02}
        strokeWidth={width}
        strokeDasharray={dashed ? `${width * 1.6} ${width * 1.3}` : undefined}
      />
      {open ? (
        <polyline className="head-open" points={`${left} ${tipX},${tipY} ${right}`} strokeWidth={width} />
      ) : (
        <polygon className="head" points={`${left} ${tipX},${tipY} ${right}`} />
      )}
    </g>
  );
}

function Badge({ at, label }: { at: Point; label: string }) {
  const w = Math.min(2.4, 0.2 + label.length * 0.125);
  const x = Math.min(Math.max(at.x - w / 2, 0.02), 8 - w - 0.02);
  const y = Math.max(at.y - 0.7, 0.02);
  return (
    <g className="mark-badge">
      <rect x={x} y={y} width={w} height={0.32} rx={0.16} />
      <text x={x + w / 2} y={y + 0.225}>{label}</text>
    </g>
  );
}

function ConceptLayer({ concepts, orientation }: { concepts: ConceptMark[]; orientation: Side }) {
  if (!concepts.length) return null;
  return (
    <g className="concepts">
      {concepts.map((m, i) => {
        const o = squareOrigin(m.square, orientation);
        switch (m.type) {
          case 'centre':
            return <rect key={i} className={`concept-centre tone-${m.tone}`} x={o.x + 0.04} y={o.y + 0.04} width={0.92} height={0.92} rx={0.08} />;
          case 'exposed':
            return <rect key={i} className="concept-exposed" x={o.x} y={o.y} width={1} height={1} />;
          case 'hanging':
            return <circle key={i} className="concept-hanging" cx={o.x + 0.5} cy={o.y + 0.5} r={0.43} />;
          case 'undeveloped':
            return <circle key={i} className="concept-undeveloped" cx={o.x + 0.15} cy={o.y + 0.85} r={0.07} />;
          case 'shield':
            return (
              <path
                key={i}
                className="concept-shield"
                transform={`translate(${o.x + 0.68} ${o.y + 0.06}) scale(0.26)`}
                d="M0.5 0 L1 0.2 V0.5 C1 0.8 0.75 0.95 0.5 1 C0.25 0.95 0 0.8 0 0.5 V0.2 Z"
              />
            );
        }
      })}
    </g>
  );
}

const ROLE_NAMES: Record<string, string> = { P: 'pawn', N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king' };

/** Translucent "future" pieces, drawn with chessground's own piece sprites. */
function GhostLayer({ ghosts, orientation }: { ghosts: Extract<Mark, { type: 'ghost' }>[]; orientation: Side }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    // <piece> isn't a React-known tag, so build these imperatively.
    el.current.replaceChildren(
      ...ghosts.map((g) => {
        const o = squareOrigin(g.square, orientation);
        const piece = document.createElement('piece');
        piece.className = `${ROLE_NAMES[g.piece[1]]} ${g.piece[0] === 'w' ? 'white' : 'black'}`;
        piece.style.transform = `translate(${o.x * 100}%, ${o.y * 100}%)`;
        return piece;
      }),
    );
  }, [ghosts, orientation]);
  return <div ref={el} className="cg-wrap ghosts" aria-hidden />;
}
