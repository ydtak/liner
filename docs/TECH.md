# Technical Spec

## 1. Constraints

- Static, client-only web app. No backend, no accounts in v1.
- Mobile-first, works offline (PWA), installable to home screen.
- Fast first load on mobile (< 200 KB JS before the board is interactive; engine is lazy-loaded).

## 2. Stack

| Concern | Choice | Notes |
|---|---|---|
| Build | **Vite + TypeScript** | Simple, fast. |
| UI | **React** (or Preact for size) | Small component tree; state is simple. |
| Chess rules | **chess.js** | Legal moves, FEN/SAN, check/mate detection. |
| Board | **chessground** (Lichess's board) | Excellent touch support, animations, and built-in arrow/circle "shapes" with custom brushes and SVG. GPL-3.0: fine for a personal/open-source app; if the app ever needs to be closed-source, swap for `react-chessboard` (MIT) + a custom SVG overlay layer. |
| Overlays | Custom SVG layer on top of the board | For ghosts, badges, tints, rays that chessground shapes don't cover. |
| Styling | Plain CSS with variables (or Tailwind) | Theme tokens for light/dark and board palettes. |
| State | React state + a small store (Zustand) | Current opening, node path, layer toggles, settings. |
| Persistence | `localStorage` for settings; **IndexedDB** (via `idb-keyval`) for progress | All wrapped in try/catch; app works without it. |
| Engine (optional) | **Stockfish WASM** (lite, single-threaded build) in a Web Worker | Lazy-loaded only for "Off the map" verdicts. |
| PWA | `vite-plugin-pwa` | Precache app shell + opening content. |
| Tests | Vitest (logic, content validation), Playwright (mobile viewport smoke tests) | |
| Hosting | Any static host (GitHub Pages, Netlify, Cloudflare Pages) | |

## 3. Architecture

```
src/
  app/              routing, layout, theme
  screens/
    Library/        opening cards, filters
    Explore/        board + caption sheet + controls
    Learn/          guided walkthrough
    Practice/       drill session
    Settings/
  board/
    Board.tsx       chessground wrapper (orientation, moves, animation)
    Overlay.tsx     SVG overlay: ghosts, tints, badges, rays
    shapes.ts       maps Idea primitives → chessground shapes + overlay items
  chess/
    position.ts     chess.js helpers (FEN in/out, SAN↔UCI, legal moves)
    concepts.ts     auto-computed layers: centre control, hanging pieces,
                    development, king safety
    engine.ts       Stockfish worker wrapper → plain-language verdict
  content/
    schema.ts       TypeScript types + runtime validation (zod)
    loader.ts       loads opening JSON, builds node index by FEN
    openings/*.json authored content
  progress/
    srs.ts          spaced-repetition scheduling
    store.ts        IndexedDB persistence
```

### Key flows

**Explore:** `currentNode` → candidates from `node.children` → `shapes.ts` draws arrows by role → user taps arrow / makes move → `loader.findChild(node, uci)` → if found, advance; if not, check transpositions by FEN; else "Off the map" (optional engine verdict).

**Why?:** `node.idea.steps[i]` → `shapes.ts` converts primitives to chessground shapes + overlay items → render; tap advances `i`.

**Refutation:** a mistake node has `refutation: Move[]` with per-step captions/overlays → played on a temporary board state, then restored on "Take back".

## 4. Data model

Content is a **move tree per opening**, authored as JSON (or YAML compiled to JSON at build time).

```ts
type Side = "white" | "black";
type Role = "main" | "alt" | "rare" | "mistake";
type Square = string;              // "e4"
type UciMove = string;             // "g1f3"

interface Opening {
  id: string;                      // "italian-game"
  name: string;                    // "Italian Game"
  side: Side;                      // side the learner plays
  kind: "opening" | "setup";
  group: "white" | "black-vs-e4" | "black-vs-d4";
  difficulty: 1 | 2 | 3;
  tagline: string;                 // "Fast development, aim at f7"
  intro?: string;                  // shown before the first move
  startFen?: string;               // default: initial position
  setupFen?: string;               // setups only: target formation (learner's pieces only)
  keyPositionFen: string;          // used for card preview + Learn ending
  plans?: Plan[];                  // shown at the key position
  root: MoveNode;                  // children = first moves
}

interface MoveNode {
  move?: UciMove;                  // absent on root
  san?: string;                    // derived at build time, used if notation is on
  role?: Role;
  popularity?: 1 | 2 | 3;          // thickness bucket
  name?: string;                   // branch name; required for alt/rare/mistake (line map)
  caption?: string;                // one-sentence "what it does"
  idea?: Idea;                     // the "Why?"
  refutation?: RefutationStep[];   // only for role = "mistake"
  lesson?: string;                 // only for role = "mistake": the general takeaway
  children?: MoveNode[];
}

interface Idea {
  steps: IdeaStep[];               // 1–3
}

interface IdeaStep {
  text: string;                    // "Prepares d4 to build a big centre."
  marks: Mark[];
}

type Mark =
  | { type: "control"; squares: Square[] }
  | { type: "target"; squares: Square[] }
  | { type: "danger"; squares: Square[] }
  | { type: "threat"; from: Square; to: Square }
  | { type: "defend"; from: Square; to: Square }
  | { type: "ray"; from: Square; to: Square }            // opened line
  | { type: "ghost"; square: Square; piece: string }     // "wP", "bN"
  | { type: "plan"; from: Square; to: Square }           // ghost arrow
  | { type: "badge"; square: Square; label: string };

interface RefutationStep {
  move: UciMove;
  text: string;
  marks?: Mark[];
}

interface Plan {
  name: string;                    // "Break with d4"
  text: string;
  marks: Mark[];
}
```

### Build-time validation (`npm run content:check`)
- Every move is legal in its position (replay through chess.js).
- Exactly one `main` child per node where the learner is to move.
- Mistakes have a refutation; refutation moves are legal.
- All squares in marks are valid; captions within length limits.
- Derive and store `san` and per-node `fen` for indexing.
- Detect transpositions across nodes (same FEN) and report them.

## 5. Popularity data

Avoid a live dependency on external APIs at runtime. Instead, a script (`scripts/fetch-popularity.ts`) queries the Lichess opening explorer for each authored node **at authoring time**, buckets the results into `popularity: 1|2|3`, and writes them into the JSON. Check Lichess's current API terms, rate limits and auth requirements before using it; respect them and cache results.

## 6. Progress & spaced repetition

```ts
interface LineProgress {
  openingId: string;
  lineId: string;          // path of UCI moves joined, or node id of the leaf
  seen: boolean;           // walked through in Learn/Explore
  box: 0 | 1 | 2 | 3 | 4 | 5;  // Leitner box
  dueAt: number;           // epoch ms
  lastResult?: "clean" | "hinted" | "failed";
}
```

- Leitner intervals: box 0 = now, 1 = 1 day, 2 = 3 days, 3 = 7 days, 4 = 14 days, 5 = 30 days.
- Clean → box+1; hinted (any hint or one wrong move) → stay; failed (answer revealed or two wrong moves) → box 0, due again next session.
- Opening progress ring = Σ min(box, 3) / (3 × lines), so every clean review moves it (a plain "share of lines in box ≥ 3" would sit at 0% for over a week).
- A "line" is any root-to-leaf path that contains a learner move; traps are never lines. Sessions take up to 8 due lines: reviews first (lowest box, most overdue), then new lines in tree order.
- Stored in IndexedDB under one key (`liner.progress`) via `idb-keyval`; if storage fails, progress lasts for the session only.

## 7. Engine use ("Off the map")

- Only when the user plays a move not in the tree, and only if enabled. The engine is opt-in: the off-the-map card offers "Ask the engine", which turns on Settings → Engine verdicts.
- *Built in M5:* Stockfish 19 lite single-threaded WASM (`stockfish` npm, GPL-3.0; 28 KB JS + 1.8 MB WASM, no cross-origin isolation needed) in a Web Worker (`src/chess/engine.ts`). A small Vite plugin serves it from node_modules at `/engine/` in dev and emits it into the build; the service worker skips precaching it and caches it on first use (CacheFirst).
- Two searches of ~0.9 s each (depth cap 18): the position after the move (which also gives the opponent's best reply) and the position before (the best move). Loss = best − played, in centipawns from the mover's side; mates count as ±100 000 minus distance.
- Words (`src/chess/verdict.ts`): engine's top move or loss ≤ 15 → *Strong move*; ≤ 40 → *Fine*; ≤ 100 → *Dubious*; ≤ 300 → *Mistake*; more → *Blunder*. Mistakes name a piece left hanging (from `concepts.ts`) and the opponent's best reply, and draw both on the board. Anything worse than strong offers "Show the better move", which takes back and pulses the engine's choice.
- Never show raw numbers to learners. Author mode's engine check does show the evaluation.

## 8. Performance & UX budgets

- Board interactive < 1.5 s on mid-range phone over 4G.
- Move + overlay render < 16 ms (no jank during animation).
- Content JSON per opening < 50 KB; load lazily per opening.
- Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95.
- *Measured in M4* (production build, Lighthouse 12.6 mobile, simulated slow 4G): Explore 98 / 100 / 100 and Home 98 / 100 / 100 (performance / accessibility / best practices); LCP 2.1 s, CLS < 0.01, JS 122 KB gzipped. Time to interactive is about 2.1 s under that throttling, so the 1.5 s board-interactive budget is not met on simulated slow 4G.

## 9. Accessibility

- All interactive controls ≥ 44×44 px (candidate arrows excepted: every move they offer is also reachable by keys 1–4 or typing).
- Keyboard: ←/→ back/forward, `W` Why?, `T` traps, `L` layers, `1`–`4` play a candidate (main move first), `H` hint in Practice, Esc closes the line map. Practice also accepts typed moves ("Nf3", "O-O").
- Screen readers: the board is a labelled group ("Black to move. Last move: knight to f3."); each move is announced in an assertive live region; the caption sheet is a polite live region; arrows are buttons named in words ("1. Main move: knight to f3. …"); concept layers have a text summary under the caption.
- Line map dialog: focus moves in on open, Tab is trapped inside, focus returns to the opener on close.
- Settings: theme, board palette (Sand, Walnut, Slate), colour-blind-safe palette (Okabe–Ito blue/orange), coordinates, notation, animation speed (System follows `prefers-reduced-motion`), move sounds (synthesized with Web Audio, no files).
- *Audited in M4:* axe-core (WCAG 2.1 A/AA + best practices) reports no violations on Home, Explore, Learn, Practice, Settings, the line map, and a trap lesson, in both light and dark themes.
