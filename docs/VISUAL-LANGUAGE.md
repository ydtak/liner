# Visual Language

How information is drawn on the board. Consistency here is what makes the app feel intuitive: the same color and shape always mean the same thing.

## 1. Candidate move arrows

| Role | Look | Meaning |
|---|---|---|
| **Main** | Solid green, thick | The move to learn. |
| **Alternative** | Solid blue, medium | Also good / commonly played; leads to an authored branch. |
| **Rare / sideline** | Grey, thin | Playable but less important; may be shallow in the tree. |
| **Mistake (trap)** | Red, dashed, thin. Hidden until "Traps" is on | Looks natural, but fails. Playing it triggers the refutation. |

- **Thickness also hints at popularity** (3 buckets: common / sometimes / rare). No percentages.
- At most **3–4 arrows** at once. If more exist, the rest live behind "More moves".
- Arrows for the opponent's candidates (when exploring both sides) use the same colors at lower opacity.

## 2. "Why?" idea overlays

Ideas are built from a small set of primitives. Each has a fixed meaning:

| Primitive | Look | Used for |
|---|---|---|
| **Square highlight – control** | Soft green tint | Squares the move newly controls. |
| **Square highlight – target** | Orange ring | A weakness or target (e.g. f7). |
| **Square highlight – danger** | Red tint | A square/piece that is now under threat. |
| **Threat arrow** | Orange arrow | "This piece now attacks that." |
| **Defence line** | Thin teal line with dot ends | "This piece protects that." |
| **Line-opening** | Dotted yellow ray | A diagonal/file the move just opened (e.g. bishop's diagonal after e4). |
| **Ghost piece** | 40% opacity piece | A *future* move or plan (e.g. ghost pawn on d4 after c3). |
| **Ghost arrow** | Dashed purple arrow | A planned follow-up move. |
| **Badge** | Small pill near a square | One or two words: "weak", "pinned", "outpost", "free". |

### Multi-step ideas
A move's idea can have 1–3 steps. Each step = one sentence + its overlays, shown in sequence:

```
4.c3   Why?
 Step 1/2  "Takes away d4 from Black's knight."      → red tint on d4 near Nc6, defence line c3→d4
 Step 2/2  "Prepares d4 to build a big centre."      → ghost pawn on d4, ghost arrow d3?→d4
```

## 3. Refutation playback

When the user plays (or reveals) a mistake:

1. Red dashed arrow solidifies; caption: *"Natural, but…"*
2. Opponent's punishing reply plays with an orange threat arrow.
3. Each step pauses with a one-line caption; user taps to continue (or autoplay).
4. Ends on the losing position with the key consequence highlighted (e.g. a hanging rook in red) and a summary: *"Black loses the rook. Lesson: f6 weakens the king."*
5. Buttons: **Take back** · **Show the right move**.

## 4. Concept layers (auto-computed)

| Layer | Look |
|---|---|
| Centre control | 4 (or 16) central squares tinted green (you), purple (opponent), grey (contested) |
| Hanging pieces | Pulsing red ring on attacked + undefended pieces |
| Development | Small dot on undeveloped knights/bishops; counter in the chip |
| King safety | Shield icon on a castled king; amber tint on open files/diagonals pointing at the king |

Concept layers render *under* idea overlays and arrows so they never fight for attention.

## 5. Color & accessibility

- Arrow/overlay roles must be distinguishable **without color**: main = solid, alternative = solid thinner, mistake = dashed, plan = dashed with hollow head. Badges carry text.
- Palette tuned to stay visible on both light and dark board squares; check contrast on both.
- Colorblind-safe palette option (blue/orange instead of green/red) in Settings.
- Every overlay has an accessible text equivalent in the caption for screen readers.

## 6. Tone of captions

- One sentence, under ~12 words when possible.
- Verb first, concrete: *"Attacks the pawn on e5."* not *"This move creates pressure."*
- Name squares in words when it helps ("the weak f7 square"); coordinates appear only if the setting is on.
- Explain with principles beginners know: centre, development, king safety, attack/defend, trade.
