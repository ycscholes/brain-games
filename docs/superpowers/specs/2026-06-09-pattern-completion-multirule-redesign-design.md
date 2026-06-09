# Pattern Completion Multirule Redesign

Date: 2026-06-09

## Goal

Redesign `找规律` from a simple sequence-completion quiz into a more demanding multirule reasoning game. The new version should improve training value, replayability, and difficulty depth while preserving the current project contracts for training records, pet points, storage, and page integration.

This spec supersedes the lighter 2026-05-30 refresh direction for the next implementation pass. The approved approach is the scoped version of option B: matrix and multidimensional rule reasoning, not a speed-first dynamic challenge.

## Current Problem

The current implementation is too easy because most questions can be solved by spotting one linear pattern:

- Fixed 8-question sessions still feel predictable after a few plays.
- Many rules are single-track sequences such as color cycle, shape cycle, or basic numeric progression.
- Hard mode mainly changes the selected templates, missing position, distractors, and speed target.
- The player rarely needs to hold multiple rules in working memory at the same time.
- Distractors are not consistently designed to test partial-rule mistakes.

The redesign should make the game train observation, abstraction, working memory, rule switching, and inhibition against plausible wrong answers.

## Non-Goals

- Do not create a new game ID.
- Do not add a new reward currency or page-level point multiplier.
- Do not turn the game into a reaction-speed challenge.
- Do not add large image assets or generated bitmap packs.
- Do not introduce new libraries.
- Do not expand the first version into every possible rule family.

## Player Experience

Each session still contains 8 cases.

For each case:

1. Show a sequence or matrix with one missing cell.
2. Show four answer options.
3. Let the player answer or spend a hint.
4. On answer, reveal the correct option and a compact rule explanation.
5. Explain why the strongest distractors are wrong when useful.
6. Move to the next case.

The player should feel that each hard question requires checking more than one condition, not just looking for the next color or shape.

## First-Version Rule Families

Limit the first version to four high-value families. This keeps implementation and tests manageable while materially improving the game.

### Dual Attribute Sequence

The visible cells form a sequence where two attributes change together or on separate tracks.

Examples:

- Shape rotates every step while color advances every two steps.
- Odd positions follow one shape track while even positions follow another color track.
- Size and count cycle at different lengths.

Training value: sustained attention and parallel-rule tracking.

### Row Column Matrix

The board is a `2x3` or `3x3` grid. The missing cell must satisfy both row and column constraints.

Examples:

- Each row contains one of each shape; each column advances color.
- Counts increase across rows while sizes cycle down columns.
- A row rule produces the visual feature, while a column rule determines count.

Training value: relational reasoning and cross-checking.

### Count Size Transform

The player infers changes in number of items, item size, or both.

Examples:

- Count cycles `1, 2, 3`.
- Size cycles `small, medium, large`.
- Count increases across a row while size decreases down a column.

Training value: quantity perception and rule composition.

### Position Shift

The symbol inside each cell moves through a fixed set of positions.

Examples:

- Position shifts left to center to right across a row.
- Position moves clockwise around four corners.
- Position and color each follow separate cycles.

Training value: spatial reasoning and visual working memory.

## Deferred Rule Families

Keep these out of the first version unless implementation proves simpler than expected:

- Numeric-visual mapping, such as number values controlling visual attributes.
- More advanced arithmetic sequences.
- Timed survival mode.
- Procedural daily challenge seeds.

Numeric-heavy patterns overlap with existing math games and can make `找规律` feel less visually distinct. If added later, they should remain a small minority.

## Difficulty Design

Do not increase hard mode to 10 questions. Keep both modes at 8 questions so the current point economy remains stable.

Normal mode:

- 2 dual-attribute sequence cases.
- 2 count-size transform cases.
- 2 basic row-column matrix cases.
- 2 mixed cases using two clear rules.
- Most cases require one or two rules.
- Distractors may include one partial-rule option.

Hard mode:

- 1 warm-up dual-attribute case.
- 2 row-column matrix cases with cross-checking.
- 2 position-shift cases.
- 2 three-attribute or rule-composition cases.
- 1 strong-distractor integrated case.
- At least 6 of 8 cases require two or more rules.
- Each hard case should include at least two partial-rule distractors.

Hard mode should be harder because the rule search space is deeper, not because visuals are tiny, timing is harsh, or numbers are large.

## Hints

Each session has 2 hints.

Hints reveal the observation direction, not the answer:

- `先分别看形状和颜色，它们不是同一步变化。`
- `先横向看一遍，再纵向检查缺口。`
- `注意数量和大小是两条不同的线索。`
- `观察图形在格子里的位置移动方向。`

Using a hint affects only the case score. Pet points remain derived from the final score through the shared point pipeline.

## Scoring

Keep the score shape simple and compatible with `docs/points-economy.md`.

Per case:

- Correct answer: `+3`
- Fast correct answer: `+1`
- Combo bonus: `+1`, capped at one combo point per case
- Hint penalty: `-1`
- Wrong answer: `0`
- Minimum correct score after hint: `1`
- Maximum case score: `5`
- Maximum session score: `40`

Do not add a separate rule-depth score in the first version. Difficulty should come from generated content, and pet-point difficulty should continue to come from the existing `normal` / `hard` multiplier.

Expected point economy:

- Normal good session: about `22-32` game score, converting to about `26-38` pet points at the current `1.2x` rate.
- Hard good session: about `22-34` game score, converting to about `39-60` pet points after the hard multiplier and cap.
- Hard perfect or near-perfect play can hit the 60-point cap.
- Ordinary normal play should not trivially hit the 40-point cap.

## Points Economy Integration

Keep all external reward behavior unchanged:

```ts
const awardedPoints = getAwardedPoints("pattern-completion", finalScore, rewardDifficulty);

addPointsToPet("pattern-completion", finalScore, rewardDifficulty);

recordTrainingSession({
  gameId: "pattern-completion",
  score: finalScore,
  awardedPoints,
  durationSeconds,
  difficulty: rewardDifficulty,
  outcome: "completed",
});
```

Do not change `TRAINING_POINT_RATES` unless test results show the new score range no longer fits the documented economy. The expected design keeps `pattern-completion` at `1.2x`.

## Resource Constraints

Use CSS-rendered shapes and existing Taro components. Do not add new reusable bitmap image packs.

If future iterations add generated image assets, follow the project image workflow:

- Generate with the built-in Codex `image_gen` tool.
- Store package-size-sensitive app images under `asset-backups/cloudbase-images/`.
- Load remote copies through existing remote asset paths.
- Run `npm run assets:check`.
- Run `npm run assets:upload` only when refreshing CloudBase copies is required and credentials are available.

The first version should not need any of that.

## Technical Design

Keep the feature inside `src/pages/pattern-completion/`.

### Data Model

Extend the question model to support both sequence and grid layouts.

Suggested concepts:

```ts
export type PatternLayout = "sequence" | "grid";
export type PatternRuleFamily =
  | "dual-attribute-sequence"
  | "row-column-matrix"
  | "count-size-transform"
  | "position-shift";

export interface PatternQuestion {
  id: string;
  layout: PatternLayout;
  family: PatternRuleFamily;
  difficulty: number;
  title: string;
  prompt: string;
  cells: PatternCell[];
  columns: number;
  missingIndex: number;
  answer: PatternOption;
  options: PatternOption[];
  hint: string;
  ruleSummary: string;
  explanation: string;
  distractorExplanations?: Record<string, string>;
}
```

The page should not need to know how the answer was derived. It should render cells, options, hints, and explanations.

### Game Logic Module

`patterns.ts` should own pure logic:

- Generate normal and hard sessions.
- Generate each rule family.
- Build plausible distractors.
- Guarantee option uniqueness.
- Guarantee the answer is present exactly once.
- Provide rule summaries and explanations.
- Score each answer.

Use bounded fallback behavior. If a complex template cannot produce a unique option set, fall back to a simpler template for that case rather than producing an invalid question.

### Page Component

`index.tsx` should keep ownership of:

- Page phases: `start`, `playing`, `reveal`, `finished`.
- Timers.
- Selected option.
- Hint usage.
- Combo state.
- Best score storage.
- Pet points and training record calls.

The page should add rendering support for grid questions while keeping sequence rendering.

### Styling

`index.scss` should support:

- Stable sequence cells.
- Stable `2x3` and `3x3` grid cells.
- Missing-cell state.
- Option cards with visual tokens.
- Correct, wrong, and partial-rule reveal states.
- Compact rule explanation card.

Do not create a card-inside-card layout. Keep the mobile layout dense and readable.

## Testing Plan

Update `tests/unit/patternCompletionPatterns.test.ts` to cover the new generator.

Required tests:

- Normal session has exactly 8 questions.
- Hard session has exactly 8 questions.
- Every question has 4 options.
- Every question includes the answer exactly once.
- Every missing index is valid and points to a missing cell.
- Every generated option has a stable ID.
- Normal mode includes the expected first-version rule families.
- Hard mode includes at least 6 questions with two or more rules, represented by metadata or rule descriptors.
- Hard questions include at least two partial-rule distractors where supported.
- Row-column matrix questions satisfy both row and column derivation checks.
- Position-shift questions derive the expected missing position.
- Count-size transform questions derive the expected missing count and size.
- Scoring returns 0 for wrong answers.
- Scoring caps combo at 1 point per case.
- Hint penalty cannot reduce a correct answer below 1 point.
- Practical normal scores do not trivially hit the 40-point pet cap.
- Strong hard scores can reach but not exceed the 60-point pet cap.

Verification after implementation:

```bash
npm test -- --runTestsByPath tests/unit/patternCompletionPatterns.test.ts
npm run typecheck
```

Run `npm test` if shared scoring, training storage, or pet point utilities change.

## Acceptance Criteria

1. The game keeps `gameId: "pattern-completion"`.
2. Normal and hard sessions each contain 8 cases.
3. The game supports both sequence and grid-style questions.
4. The first implementation includes dual-attribute sequence, row-column matrix, count-size transform, and position-shift families.
5. Hard mode has at least 6 of 8 cases requiring two or more rules.
6. Each hard-mode case includes at least two meaningful partial-rule distractors when the family supports them.
7. Each question has exactly one correct answer among four options.
8. Hints reveal observation direction but not the answer.
9. Reveal feedback explains the complete rule and, where useful, why strong distractors are wrong.
10. Per-case scoring uses only base, speed, combo, and hint penalty.
11. Single-case maximum score is 5 and session maximum score is 40.
12. Pet points still flow only through `getAwardedPoints()` and `addPointsToPet()`.
13. `docs/points-economy.md` is updated in the implementation task if score ranges or difficulty behavior change.
14. Unit tests cover generation, uniqueness, rule derivation, distractors, scoring, and point-economy fit.

## Implementation Recommendation

Implement in one focused gameplay task:

1. Refactor `patterns.ts` around the new layout-capable question model.
2. Add the four approved rule families and metadata needed for tests.
3. Update page rendering for grid questions.
4. Keep the existing training record and pet point calls.
5. Update copy, styles, tests, and point-economy documentation.

Do not split out a separate engine package unless `patterns.ts` becomes hard to test or reason about. The current project size favors a local pure logic module with strong unit coverage.
