# Product Spec

## 1. Problem

Beginners and improving players want to learn a few solid openings, but the usual tools are built for strong players:

- **Explorers are data tables.** Rows of `Nf3 · 41% · 2,301,442 games · 38/29/33` force you to translate coordinates into squares and statistics into meaning.
- **"Best" doesn't mean "obvious".** An engine or database says `4.c3` is the main move, but not that it exists to prepare `d4`.
- **Everything is shown at once.** Every legal-ish continuation, every number, every variation. There's no sense of what matters *now*.
- **You learn what to play, not what to avoid.** The natural-looking mistakes, the ones a beginner would actually play, are usually missing.

## 2. Vision

> The board is the interface. Moves are arrows, ideas are drawings, and explanations are one tap away and one sentence long.

Liner is a **guided opening explorer**: a small, curated tree of moves for each opening, drawn directly on the board, with a "Why?" reveal on every move.

## 3. Target user

- Knows how the pieces move and basic tactics (forks, pins, hanging pieces).
- Roughly 400–1500 rating; plays online casually.
- Wants a **small repertoire** (one opening as White, one reply to 1.e4, one to 1.d4) and to understand it, not memorize 20 moves deep.
- Uses a phone, often in short sessions (2–10 minutes).

## 4. Design principles

1. **Board first.** Information goes *on* the board before it goes in text. Text is a caption, never a table.
2. **Progressive disclosure.** Show the minimum by default. Ideas, alternatives and numbers are revealed on request.
3. **Plain language.** "Attacks the pawn on e5" beats "Nf3 pressures e5". Coordinates are optional and off by default in prose; squares get highlighted instead.
4. **Show, then tell.** Each explanation is a visual overlay first, with a short sentence underneath.
5. **Mistakes are content.** Include the tempting wrong moves and let the user play them to see the refutation.
6. **Calm.** No streak guilt, no badges, no noise. Soft colors, generous spacing, one primary action per screen.
7. **Thumb-friendly.** Every control is reachable with one thumb on a phone in portrait.

## 5. Core concepts

| Term | Meaning |
|---|---|
| **Opening** | A named course, e.g. *Italian Game*. Has a side (White/Black), difficulty, and a move tree. |
| **Setup** | A *system* opening (e.g. London) where the goal is a target formation, not a precise move order. Shown with a "target position" ghost. |
| **Line** | One path through the tree, e.g. *Italian → Giuoco Pianissimo*. |
| **Node** | A position plus the move that reached it, with its explanation and overlays. |
| **Candidate** | A move from the current position shown as an arrow. Has a *role*: main, alternative, mistake. |
| **Idea** | The visual "why" of a move: highlights, arrows, ghost pieces, and one sentence. |
| **Refutation** | A short forced sequence that shows why a mistake fails. |

## 6. Features

### 6.1 Opening library (Home)
- Cards grouped by **"I play White"**, **"Black vs 1.e4"**, **"Black vs 1.d4"**.
- Each card: name, small static board preview of the key position, one-line identity ("Fast development, aim at f7"), difficulty dot (1–3), progress ring.
- Filter chips: *Beginner-friendly*, *Setups*, *In my repertoire*.
- "Add to repertoire" star on each card.

### 6.2 Explore mode (the heart of the app)
- Board fills the screen width, oriented to the user's side.
- From the current position, **candidate arrows** are drawn (see [VISUAL-LANGUAGE.md](VISUAL-LANGUAGE.md)):
  - main move = bold green arrow
  - playable alternatives = thinner blue arrows
  - tempting mistakes = hidden by default; toggled by a "Show traps" chip (red dashed arrows)
- **Play by tapping an arrow** (or by dragging/tapping the piece). Opponent replies animate in automatically when following a line, or show their own arrows if the user chooses to explore both sides.
- **Bottom sheet caption** shows the last move in words: *"Knight comes out and attacks the e5 pawn."* with a **Why?** button.
- **Why?** reveals the idea overlay on the board, step by step if the idea has several parts (tap to advance: "1/3 Controls the centre → 2/3 Opens the bishop → 3/3 Prepares castling").
- **"What if…?"**: play any legal move. If it's in the tree, it's explained. If it's a known mistake, the refutation plays out with overlays. If it's unknown, show a gentle "Off the map" note and (optionally) an engine-based plain-language verdict.
- **Controls** (bottom bar): ◀ back, ▶ forward (follows main line), ⟲ restart, 🔍 layers, ⋯ more.
- **Line map** (optional pull-up): a simple vertical tree of the opening with named branches, not a move list. Tapping a branch jumps there.

### 6.3 Learn mode (guided walk-through)
- A linear, story-like path through the main line of an opening, one move per step.
- Each step: the move animates → caption → idea overlay plays automatically.
- Ends on a **"Key position"** card: the position you should recognise, with 2–3 plans listed as arrows ("Plan A: d4 break", "Plan B: kingside attack with Ng5").

### 6.4 Practice mode (play it from memory)
- App plays the opponent; user must find their side's moves.
- On a wrong move: gentle shake, show the correct arrow faintly, offer "Why?" for the correct move *and* "What's wrong with mine?" (if it's an authored mistake).
- Hints are layered: 1st hint highlights the piece to move, 2nd shows the target area, 3rd shows the arrow.
- Lines are scheduled with simple spaced repetition (see TECH.md §6).
- Opponent varies between authored replies weighted by popularity so the user meets common deviations.

### 6.5 Concept layers (auto-computed, always available)
Toggleable overlays from the 🔍 menu, computed from the position, no authoring needed:
- **Centre control**: tint on d4/d5/e4/e5 (and extended centre) by who controls each square more.
- **Attacked & undefended**: pieces that are attacked and not defended get a pulsing ring.
- **Development**: small marker on undeveloped minor pieces; counter "Developed: 3/4".
- **King safety**: shield icon if castled; warning tint on open lines to the king.

These teach *general principles* that explain most opening moves even off the curated tree.

### 6.6 Settings
- Board theme (2–3 calm palettes), piece set, coordinates on/off, notation in captions (none / short "Nf3" / both), sound on/off, animation speed, light/dark/system.
- *Built in M4:* everything above except a piece-set choice (only one set is bundled) and the three-way notation option (it is on/off). Auto-reply also lives here now; haptics were not added.

## 7. Key screens (mobile, portrait)

```
┌─────────────────────────┐   ┌─────────────────────────┐
│ Liner              ⚙    │   │ ←  Italian Game     ⋯   │
│                         │   │ ┌─────────────────────┐ │
│ I play White            │   │ │                     │ │
│ ┌─────┐ Italian Game    │   │ │    [ chess board ]  │ │
│ │ ▦▦  │ Aim at f7 fast  │   │ │  green arrow  ──▶   │ │
│ └─────┘ ●○○   ◔ 40%  ☆  │   │ │  blue arrow   ─▶    │ │
│ ┌─────┐ London System   │   │ │                     │ │
│ │ ▦▦  │ Same setup vs.. │   │ └─────────────────────┘ │
│ └─────┘ ●○○   ◯  0%  ☆  │   │ [Traps] [Centre] [Dev]  │
│                         │   │ ─────────────────────── │
│ Black vs 1.e4           │   │ Bishop eyes the weak    │
│ ┌─────┐ Caro-Kann       │   │ f7 square.              │
│ │ ▦▦  │ Solid & simple  │   │            [ Why? ]     │
│ └─────┘ ●●○   ◔ 10%  ★  │   │ ─────────────────────── │
│ …                       │   │  ◀     ▶     ⟲     🗺   │
└─────────────────────────┘   └─────────────────────────┘
        Home / Library                  Explore
```

On wide screens (≥ 900px) the caption/sheet moves to a side panel to the right of the board.

## 8. Interaction details

- **Tap an arrow** → play that move. **Long-press an arrow** → peek at its caption without playing.
- **Swipe left/right on the board area below** (or on the caption) → back/forward.
- **Tap empty board** → hide overlays (return to clean board).
- **Undo is always available** and free; exploring should never feel risky.
- Animations: 200–300 ms piece moves, overlays fade in 150 ms; respect `prefers-reduced-motion`.
- Haptic tick on move (where supported), off by default with sound.

## 9. What we deliberately don't show (by default)

- Win/draw/loss percentages and game counts (available under "Details" long-press only).
- Engine evaluation numbers. When an engine is used, results are translated to words: *Good*, *Fine*, *Dubious*, *Mistake*.
- Full move lists in algebraic notation (the Line map uses names and mini boards).

## 10. Success criteria

- A new user can open an opening and play through its main line **without reading instructions**.
- After one Learn session, the user can explain in their own words why the first 3–5 moves are played.
- After a week of Practice, the user can play their repertoire's main lines from memory.
- The app is fully usable on a 360px-wide phone, one-handed, offline.

## 11. Non-goals (v1)

- Playing full games vs. an engine or people.
- Accounts, sync, social features.
- Middlegame/endgame training.
- A complete opening encyclopedia. Depth over breadth: a few openings done well.
