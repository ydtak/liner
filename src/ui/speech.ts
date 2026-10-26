// Plain-language move descriptions for screen readers ("Nxe5+" → "knight takes e5, check").

const PIECES: Record<string, string> = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight' };

export function spokenSan(san: string): string {
  let text: string;
  if (san.startsWith('O-O-O')) text = 'castles queenside';
  else if (san.startsWith('O-O')) text = 'castles kingside';
  else {
    const m = san.match(/^([KQRBN])?[a-h]?[1-8]?(x)?([a-h][1-8])(?:=([QRBN]))?/);
    if (!m) return san;
    const [, piece, capture, square, promo] = m;
    text = `${piece ? PIECES[piece] : 'pawn'} ${capture ? 'takes' : 'to'} ${square}`;
    if (promo) text += `, promotes to ${PIECES[promo]}`;
  }
  if (san.endsWith('#')) text += ', checkmate';
  else if (san.endsWith('+')) text += ', check';
  return text;
}

/** Short position summary for the board's accessible name. */
export function positionLabel(fen: string, lastSan?: string): string {
  const toMove = fen.split(' ')[1] === 'w' ? 'White' : 'Black';
  return `${toMove} to move.${lastSan ? ` Last move: ${spokenSan(lastSan)}.` : ''}`;
}

/** "White played knight to f3." for a move that has just happened. */
export function moveAnnouncement(fen: string, san: string): string {
  const mover = fen.split(' ')[1] === 'w' ? 'Black' : 'White';
  return `${mover} played ${spokenSan(san)}.`;
}
