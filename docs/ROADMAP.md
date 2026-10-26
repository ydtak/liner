# Roadmap

Each milestone ends with something usable on a phone.

## M0 · Skeleton ✅
- Vite + React + TS project, PWA plugin, CSS theme tokens (light/dark).
- chessground board wrapper with chess.js: make moves, back/forward, orientation.
- Deploy to a static host so it can be opened on a phone from day one. *(Not done yet: use `npm run dev:phone` on the same Wi-Fi for now.)*

**Done when:** you can play legal moves on your phone and step back/forward.

## M1 · Explore one opening (core loop) ✅
- Content schema + loader + `content:check` validation script.
- Italian Game content (main line + 2 replies + 1 mistake per side).
- Candidate arrows by role and popularity; tap arrow to play.
- Caption sheet + **Why?** with multi-step idea overlays (all Mark types).
- Refutation playback for mistakes; "Traps" toggle.
- "Off the map" message for moves outside the tree (no engine yet).

**Done when:** a beginner can walk the Italian, tap Why? on any move and understand it without help. *This is the milestone that validates the whole idea, so test it with a real beginner.*

## M2 · Library + Learn mode ✅
- Home with opening cards, groups, filters, repertoire star.
- Content for London (setup, with target-position ghosts), Caro-Kann, QGD.
- Learn mode: guided walkthrough ending on the key position and plans.
- Line map (named branches, jump to node).

## M3 · Practice + progress ✅
- Practice mode with layered hints and "What's wrong with mine?".
- Leitner scheduling, IndexedDB persistence, progress rings.
- "Due today" entry point on Home.

## M4 · Concept layers + polish ✅
- Auto-computed layers: centre control, hanging pieces, development, king safety.
- Settings (themes, notation, coordinates, colorblind palette, sound, motion).
- Accessibility pass (screen-reader captions, keyboard), Lighthouse budgets.

## M5 · Optional extras (engine + Author mode ✅)
- ✅ Stockfish WASM for plain-language verdicts on off-tree moves.
- Popularity fetch script (Lichess explorer → buckets at authoring time).
- ✅ In-app Author mode for faster content creation (dev builds: Settings → Open Author mode, or `#/author`).
- More openings (Queen's Gambit, Scandinavian, Slav, Scotch, 1...e5). *Sicilian Defence (Dragon) added in M3.*
- Import a game (PGN) and see "where you left your opening prep".

## Open questions

1. **Board library licence:** chessground (GPL-3.0, best mobile UX and arrows) vs react-chessboard (MIT, more custom overlay work). Fine either way for a personal project; matters only if you'd ever ship closed-source.
2. **Exploring both sides:** *Decided in M1:* the opponent's arrows are shown and you pick their reply (▶ plays the most common), so their traps stay discoverable. An **Auto-reply** chip auto-plays the main reply instead.
3. **Notation:** hide algebraic notation entirely by default, or show short SAN ("Nf3") as a small secondary label to help users learn it gradually? Proposal: off by default, gentle toggle.
4. **Setup openings:** *Partly decided in M2:* Explore tracks progress toward the target formation ("6 of 9 pieces in place") with faint pieces on the empty target squares, and a piece developed nearby (Bg3 for Bf4) counts. Moves are still checked against the authored tree, so other move orders show "Off the map" unless they transpose.
5. **Content scale:** how many openings do you actually want to learn first? This drives most of the effort; authoring is the long pole, not code.
6. **Engine:** *Decided in M5:* yes, opt-in. The lite build turned out to be 1.8 MB, downloaded only when the learner taps "Ask the engine" (or turns it on in Settings).
