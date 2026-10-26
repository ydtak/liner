# Content Guide

The app is only as good as its curated content. This doc covers which openings to include, how deep to go, how to write explanations, and the authoring format.

## 1. Starter repertoire

Chosen for being **principled** (moves are explainable with beginner concepts) and **low-theory**.

| Group | Opening | Kind | Difficulty | Identity (tagline) | Version |
|---|---|---|---|---|---|
| White | **Italian Game** (1.e4 e5 2.Nf3 Nc6 3.Bc4) | opening | ● | Fast development, aim at f7 | v1 |
| White | **London System** (d4, Bf4, e3, Nf3, c3, Nbd2, Bd3) | setup | ● | Same solid setup against almost anything | v1 |
| White | Queen's Gambit (1.d4 d5 2.c4) | opening | ●● | Offer a pawn to win the centre | v1.1 |
| White | Scotch Game (1.e4 e5 2.Nf3 Nc6 3.d4) | opening | ●● | Open the centre right away | later |
| Black vs 1.e4 | **Caro-Kann** (1...c6 2...d5) | opening | ● | Solid centre, healthy pieces | v1 |
| Black vs 1.e4 | **Sicilian Defence** (1...c5, Dragon setup) | opening | ●●● | Unbalanced fight, play to win | v1 (added) |
| Black vs 1.e4 | Scandinavian (1...d5) | opening | ● | Challenge e4 on move one | v1.1 |
| Black vs 1.e4 | 1...e5 vs Italian / Scotch / Ruy Lopez | opening | ●● | Classical, mirror the centre | later |
| Black vs 1.d4 | **Queen's Gambit Declined** (1...d5 2.c4 e6) | opening | ●● | Hold d5 like a rock | v1 |
| Black vs 1.d4 | Slav (1...d5 2.c4 c6) | opening | ●● | Hold d5, keep the bishop free | v1.1 |

v1 ships the **bold** four: one for White (plus one setup), one vs 1.e4, one vs 1.d4.

## 2. Depth & breadth per opening

- **Main line:** 8–12 moves per side, until a recognisable "key position" with clear plans.
- **Learner's side:** exactly one main move per position (that's the repertoire). Optionally one alternative.
- **Opponent's side:** the 2–3 most common replies, each followed to a sensible stopping point (≈ 4–8 more moves).
- **Mistakes:** 1–2 tempting errors per opening for *each* side: natural-looking moves that fail to a short, clear refutation (≤ 5 moves).
- **Plans:** 2–3 plans at the key position.
- Target size: **30–80 nodes per opening.** Small enough to finish, big enough to be useful.

## 3. Writing explanations

**Caption** (always visible): what the move *does*, ≤ 12 words.
**Idea steps** (behind "Why?"): *why* it's good, 1–3 steps, one sentence each, each with overlays.

Rules:
1. Lead with a concrete verb: *attacks, defends, controls, opens, prepares, trades, castles*.
2. Tie every claim to something drawn on the board. If you can't draw it, rewrite it.
3. Use beginner principles: centre, development, king safety, attack/defend, piece activity, pawn weaknesses.
4. Mention the plan ahead ("prepares d4") with a ghost piece or plan arrow.
5. For mistakes, the caption is what makes it *tempting*; the refutation shows why it *fails*; the summary is the general lesson.
6. Avoid jargon. If a term is unavoidable (*fianchetto, outpost, gambit*), add a badge and a one-line tooltip.

| ❌ Avoid | ✅ Prefer |
|---|---|
| "Nf3 is the most popular continuation (54%)." | "Knight comes out and attacks the pawn on e5." |
| "Thematic move in the Giuoco Piano." | "Prepares d4 to build a big centre." |
| "Black obtains comfortable equality." | "Black's pieces are all out and the king is safe." |

## 4. Authoring format

One JSON (or YAML) file per opening in `src/content/openings/`. Schema in [TECH.md §4](TECH.md#4-data-model). Validate with `npm run content:check`.

### Worked example: Italian Game (excerpt)

```json
{
  "id": "italian-game",
  "name": "Italian Game",
  "side": "white",
  "kind": "opening",
  "group": "white",
  "difficulty": 1,
  "tagline": "Fast development, aim at f7",
  "keyPositionFen": "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R b KQkq - 0 5",
  "root": {
    "children": [{
      "move": "e2e4", "role": "main", "popularity": 3,
      "caption": "Pawn takes a central square.",
      "idea": { "steps": [
        { "text": "Controls the centre squares d5 and f5.",
          "marks": [{ "type": "control", "squares": ["d5", "f5"] }] },
        { "text": "Opens lines for the bishop and queen.",
          "marks": [{ "type": "ray", "from": "f1", "to": "a6" },
                    { "type": "ray", "from": "d1", "to": "h5" }] }
      ]},
      "children": [{
        "move": "e7e5", "role": "main", "popularity": 3,
        "caption": "Black claims an equal share of the centre.",
        "children": [{
          "move": "g1f3", "role": "main", "popularity": 3,
          "caption": "Knight comes out and attacks the e5 pawn.",
          "idea": { "steps": [
            { "text": "Develops a piece towards the centre with a threat.",
              "marks": [{ "type": "threat", "from": "f3", "to": "e5" },
                        { "type": "danger", "squares": ["e5"] }] }
          ]},
          "children": [
            {
              "move": "b8c6", "role": "main", "popularity": 3,
              "caption": "Defends e5 while developing.",
              "idea": { "steps": [
                { "text": "Protects the pawn and brings out a piece at the same time.",
                  "marks": [{ "type": "defend", "from": "c6", "to": "e5" }] }
              ]},
              "children": [{
                "move": "f1c4", "role": "main", "popularity": 3,
                "name": "Italian Game",
                "caption": "Bishop eyes the weak f7 square.",
                "idea": { "steps": [
                  { "text": "f7 is only defended by the king, so it's a natural target.",
                    "marks": [{ "type": "ray", "from": "c4", "to": "f7" },
                              { "type": "target", "squares": ["f7"] },
                              { "type": "badge", "square": "f7", "label": "weak" }] },
                  { "text": "Clears the way to castle next.",
                    "marks": [{ "type": "ghost", "square": "g1", "piece": "wK" },
                              { "type": "ghost", "square": "f1", "piece": "wR" }] }
                ]},
                "children": [
                  {
                    "move": "f8c5", "role": "main", "popularity": 3,
                    "name": "Giuoco Piano",
                    "caption": "Black copies the idea and aims at f2.",
                    "idea": { "steps": [
                      { "text": "Mirror image: f2 is White's weak square.",
                        "marks": [{ "type": "ray", "from": "c5", "to": "f2" },
                                  { "type": "target", "squares": ["f2"] }] }
                    ]},
                    "children": [{
                      "move": "c2c3", "role": "main", "popularity": 3,
                      "caption": "Small pawn move with a big plan.",
                      "idea": { "steps": [
                        { "text": "Takes d4 away from Black's knight.",
                          "marks": [{ "type": "control", "squares": ["d4"] }] },
                        { "text": "Prepares d4 to build a big centre.",
                          "marks": [{ "type": "ghost", "square": "d4", "piece": "wP" },
                                    { "type": "plan", "from": "d2", "to": "d4" }] }
                      ]},
                      "children": [{
                        "move": "g8f6", "role": "main", "popularity": 3,
                        "caption": "Develops and attacks e4.",
                        "idea": { "steps": [
                          { "text": "Hits the e4 pawn, so White must deal with it.",
                            "marks": [{ "type": "threat", "from": "f6", "to": "e4" }] }
                        ]},
                        "children": [{
                          "move": "d2d3", "role": "main", "popularity": 3,
                          "name": "Giuoco Pianissimo",
                          "caption": "Calmly defends e4.",
                          "idea": { "steps": [
                            { "text": "Solid defence; d4 can still come later.",
                              "marks": [{ "type": "defend", "from": "d3", "to": "e4" }] }
                          ]}
                        }]
                      }]
                    }]
                  },
                  { "move": "g8f6", "role": "alt", "popularity": 2,
                    "name": "Two Knights Defence",
                    "caption": "Black attacks e4 instead of copying." }
                ]
              }]
            },
            {
              "move": "f7f6", "role": "mistake", "popularity": 1,
              "caption": "Defends e5 with a pawn. Looks safe…",
              "refutation": [
                { "move": "f3e5", "text": "White just takes! The pawn can't really defend.",
                  "marks": [{ "type": "threat", "from": "f3", "to": "e5" }] },
                { "move": "f6e5", "text": "If Black takes the knight back…" },
                { "move": "d1h5", "text": "Queen check! The f6 pawn move opened the king.",
                  "marks": [{ "type": "threat", "from": "h5", "to": "e8" },
                            { "type": "danger", "squares": ["e8"] }] },
                { "move": "g7g6", "text": "Blocking the check…" },
                { "move": "h5e5", "text": "Check, and the rook on h8 is attacked too. White wins material.",
                  "marks": [{ "type": "threat", "from": "e5", "to": "e8" },
                            { "type": "threat", "from": "e5", "to": "h8" },
                            { "type": "badge", "square": "e5", "label": "fork" }] }
              ]
            }
          ]
        }]
      }]
    }]
  }
}
```

> Deep nesting gets hard to edit by hand. If it becomes painful, switch the authoring format to a flat list of nodes keyed by id with `parent` references (or annotated PGN with a converter) and keep the nested tree as the build output.

## 5. Authoring workflow

1. Pick the main line and stopping point from a trusted source (books, Lichess studies, coach material).
2. Add the top opponent replies (check popularity via the explorer script).
3. Write captions and ideas; draw marks while looking at a real board.
4. Add 1–2 mistakes per side with short refutations; verify each with an engine.
5. Run `npm run content:check`; fix illegal moves / missing fields.
6. Review in the app on a phone: if a caption needs the board to be understood but no mark shows it, add a mark.

### Author mode (built in M5)

Run `npm run dev`, then open Settings → **Open Author mode** (or go to `#/author`). It only exists in development builds.

1. **Start** from a blank opening or a shipped one (Export tab → Start from). Drafts autosave in the browser; Undo covers the last 50 edits.
2. **Add moves** by playing them on the board. The first move from a position becomes the main move; later ones become alternatives. Existing moves show as arrows: tap one to go there. The breadcrumb jumps back along the line.
3. **This move** tab: role, popularity, branch name, caption (with an 80-character counter), and up to three *Why?* steps.
4. **Draw** marks on a step: pick a tool (control, target, danger, threat, defend, line, plan, ghost, badge), then click squares. Arrow tools take two clicks. Marks appear as chips you can remove.
5. **Traps:** set the role to *Trap*, press **Record moves**, play the refutation on the board, then give each step a sentence (and marks) and write the lesson.
6. **Opening** tab: name, file id, side, group, kind, difficulty, tagline, intro; set the key position from the current board; add plans and draw them; for setups, capture the formation from the board.
7. **Check** tab: live validation (the same rules as `npm run content:check`) and an engine check of the current position. Verify every trap with it.
8. **Preview** opens the draft in the real Explore screen.
9. **Export:** copy or download the JSON, save it as `src/content/openings/<id>.json`, add it to `src/content/index.ts`, and run the tests.

An LLM can draft first-pass captions, but every claim must be checked against the board and an engine before shipping.
