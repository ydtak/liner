import { useEffect, useMemo, useRef } from 'react';
import { Board } from '../board/Board';
import type { LoadedOpening, TreeNode } from '../content/loader';
import { lineMap, mainLineNames } from '../content/lines';
import { ICONS, Icon, otherSide, turnOf } from '../ui/bits';

interface LineMapProps {
  opening: LoadedOpening;
  onPick: (node: TreeNode) => void;
  onClose: () => void;
}

/** Overview of the opening's named branches and traps; tapping one jumps there. */
export function LineMap({ opening, onPick, onClose }: LineMapProps) {
  const { branches, traps } = useMemo(() => lineMap(opening), [opening]);
  const side = opening.meta.side;

  const dialog = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus moves into the dialog, Tab stays inside it, and focus returns to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key !== 'Tab' || !dialog.current) return;
      const focusables = dialog.current.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])');
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, []);

  const item = (node: TreeNode, title: string, subtitle: string | undefined, depth: number, trap = false) => {
    const mover = otherSide(turnOf(node.fen));
    return (
      <li key={node.id || 'root'} style={{ paddingLeft: `${Math.max(depth - 1, 0) * 16}px` }}>
        <button className={`line-item${trap ? ' trap' : ''}`} onClick={() => onPick(node)}>
          <span className="line-board" aria-hidden>
            <Board fen={node.fen} orientation={side} lastMove={node.uci} dests={null} preview />
          </span>
          <span className="line-text">
            <span className="line-title">{title}</span>
            {subtitle && <span className="line-sub">{subtitle}</span>}
            {node.uci && (
              <span className="line-who">
                {mover === side ? 'Your move' : `${mover === 'white' ? 'White' : 'Black'}'s choice`}
              </span>
            )}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={dialog} className="modal" role="dialog" aria-modal="true" aria-label="Lines in this opening" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Lines</h2>
          <button ref={closeBtn} className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon d={ICONS.close} />
          </button>
        </div>
        <div className="modal-body">
          <ul className="line-list">
            {item(opening.root, 'Main line', mainLineNames(opening) || opening.meta.tagline, 0)}
            {branches.map((b) => item(b.node, b.title, b.subtitle, b.depth))}
          </ul>
          {traps.length > 0 && (
            <>
              <h3 className="line-section">Traps</h3>
              <ul className="line-list">{traps.map((t) => item(t.node, t.title, t.subtitle, 0, true))}</ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
