# Liner

A minimal, mobile-first web app for learning chess openings **visually**: pick an opening, explore it on the board with arrows and highlights instead of tables of coordinates and percentages, and tap **"Why?"** to see *why* a move is good, shown on the board.

## Docs

| Doc | What's in it |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | Vision, principles, features, screens, interaction design |
| [docs/VISUAL-LANGUAGE.md](docs/VISUAL-LANGUAGE.md) | How moves, ideas and "why" are drawn on the board |
| [docs/TECH.md](docs/TECH.md) | Stack, architecture, data model, storage |
| [docs/CONTENT.md](docs/CONTENT.md) | Starter openings, authoring format, a fully worked example |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Milestones, scope per version, open questions |

## One-paragraph pitch

Opening explorers show you *what* strong players play. Liner shows you *what the move is trying to do*. Every move in a curated opening is a colored arrow on the board; tapping **Why?** reveals the idea as board overlays (squares it controls, the threat it makes, the plan it prepares) plus one sentence in plain English. Tempting-but-wrong moves are included on purpose, so you can play them and watch the punishment.

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
npm run dev:phone    # also reachable from your phone on the same Wi-Fi
npm test             # content validation + explorer logic
npm run build        # production build (PWA, works offline)
```

Content lives in `src/content/openings/*.json`; `npm run content:check` validates every move, mark and refutation.

**Author mode** (development only): run `npm run dev`, then Settings → Open Author mode to build or edit an opening on the board and export its JSON. See [docs/CONTENT.md](docs/CONTENT.md#author-mode-built-in-m5).

The optional engine is [Stockfish](https://stockfishchess.org/) (GPL-3.0) via the `stockfish` npm package; the board is [chessground](https://github.com/lichess-org/chessground) (GPL-3.0).
