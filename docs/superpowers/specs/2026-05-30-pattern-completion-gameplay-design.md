# Pattern Completion Gameplay Refresh Design

Date: 2026-05-30

## Goal

Refresh `找规律` so it feels less like a static quiz and more like a short reasoning game. The new version should improve replayability, variety, and difficulty pacing while preserving the existing page, training records, best-score behavior, and pet points economy.

The approved direction is a `规律侦探` style session: the player observes first, answers, then sees the hidden rule explained.

## Problems To Solve

- The current fixed 10-question bank can be memorized after repeated play.
- The page currently explains the rule before the player answers, which makes the activity feel like execution rather than discovery.
- Most questions vary only shape and color, so the game lacks enough surprise.
- Difficulty should feel like progressive rule discovery, not a sudden jump.
- Any scoring change must remain compatible with the existing `pattern-completion` point conversion rate and difficulty caps.

## Player Experience

Each session contains 8 cases.

For each case:

1. Show the sequence, the missing slot, answer options, current progress, combo state, and remaining hints.
2. Do not show the rule explanation before the answer.
3. The player selects an option or spends a hint.
4. After selection, enter a reveal state.
5. The reveal state keeps the sequence visible, highlights the correct answer, and shows a short rule card.
6. The player continues to the next case.

Feedback copy:

- Correct answer: `识破规律`
- Wrong answer: `差一点`
- Rule card examples:
  - `颜色循环 · 形状固定`
  - `奇偶双轨`
  - `相邻差值递增`
  - `前两项相加`

The visual direction should stay light: a clean answering state and a compact rule card after each answer. It should not become a heavy story interface.

## Pattern Types

The generated question bank supports seven template families.

1. `颜色循环`: color repeats while shape stays fixed.
2. `形状循环`: shape repeats while color stays fixed.
3. `双维同步`: color and shape change together with different cycles.
4. `奇偶双轨`: odd and even positions each follow their own rule.
5. `尺寸/数量变化`: item size changes, or a cell contains 1, 2, or 3 small shapes.
6. `缺失位置变化`: the missing item can be the final item or a middle gap.
7. `数字规律`: arithmetic progression, geometric progression, increasing differences, Fibonacci-like sequences, alternating add/subtract, squares, and triangular numbers.

Numeric sequence constraints:

- Normal mode uses smaller numbers, shorter sequences, and one-layer rules.
- Hard mode may use increasing differences, interleaved subsequences, and Fibonacci-like rules.
- Numbers must stay readable on mobile and avoid large values that make the task feel like mental arithmetic instead of pattern recognition.
- Each numeric question must include a concise derivation in the reveal card, such as `差值依次为 +2、+3、+4` or `每一项等于前两项之和`.

## Difficulty Curve

Normal mode:

- Cases 1-2: basic visual rules, such as color or shape cycles.
- Cases 3-4: basic numeric rules, such as arithmetic progression or small Fibonacci-like sequences.
- Cases 5-6: synchronized two-dimensional visual rules.
- Cases 7-8: odd/even tracks, size/count changes, or a middle missing slot with clear options.

Hard mode:

- Cases 1-2: advanced visual rules.
- Cases 3-5: numeric logic, including increasing differences or interleaved subsequences.
- Cases 6-8: odd/even tracks, middle missing slots, stronger distractors, or two-layer visual rules.

Hard mode should be more demanding through rule selection and distractor quality, not through tiny visual differences or unreadable numbers.

## Hints

Each session has 2 hints.

A hint reveals the direction of the rule, not the answer:

- Visual examples: `先看颜色顺序`, `比较奇数位和偶数位`, `注意每格数量`.
- Numeric examples: `先看相邻差值`, `试试前两项的关系`, `分开看奇数位和偶数位`.

Using a hint applies a score penalty to that case but does not directly alter pet points. Pet points still come only from the final game score passed through the existing conversion function.

## Scoring

Do not change `TRAINING_POINT_RATES`; `pattern-completion` remains `1.2x`.

Game score:

- Correct answer base: `+3`
- Combo bonus: `+1` from the second consecutive correct answer, capped at `+2` per case
- Speed bonus: `+0` to `+1` for a fast correct answer
- Hint penalty: `-1` on that case, with a minimum correct-case score of `+1`
- Wrong answer: `+0`

Expected score shape:

- Theoretical 8-case maximum: about `46`
- Normal strong score: about `18-30`, converting to about `21-36` pet points
- Hard strong score: about `24-38`, converting to about `43-60` pet points after the hard multiplier and cap

This keeps good normal sessions inside the documented `10-40` target range and makes hard-mode cap scores possible only for strong play.

## Points Economy Integration

The page must continue to use the existing shared functions:

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

Training records store the game score. Pet points are derived by `getAwardedPoints`, which applies the `1.2x` game rate, difficulty multiplier, and difficulty cap.

## Technical Design

Keep the feature inside `src/pages/pattern-completion/`.

### `patterns.ts`

Replace the static fixed bank with a pure generation module.

Responsibilities:

- Define shared question types.
- Generate visual and numeric questions.
- Choose templates according to difficulty and case index.
- Generate answer options and plausible distractors.
- Guarantee a unique answer.
- Provide hint text and reveal explanation text.
- Provide scoring helpers that can be unit-tested without rendering the page.

Suggested structure:

```ts
export type PatternQuestionKind = "visual" | "numeric";
export type PatternRuleFamily =
  | "color-cycle"
  | "shape-cycle"
  | "dual-sync"
  | "odd-even"
  | "size-count"
  | "missing-position"
  | "numeric-sequence";

export interface PatternQuestion {
  id: string;
  kind: PatternQuestionKind;
  family: PatternRuleFamily;
  difficulty: number;
  sequence: PatternCell[];
  missingIndex: number;
  answer: PatternOption;
  options: PatternOption[];
  hint: string;
  explanationTitle: string;
  explanation: string;
}
```

If a generated template cannot produce a unique answer after a bounded number of attempts, fall back to a simpler template for that case.

### `index.tsx`

Keep page ownership of UI state, timers, storage, points, and navigation.

Recommended phases:

- `start`
- `playing`
- `reveal`
- `finished`

State additions:

- Remaining hints
- Whether the current case used a hint
- Current combo
- Longest combo
- Per-kind correct counts for result summary
- Per-case score details for reveal state

The start screen should update the rules copy to explain cases, hints, and the new score shape.

### `index.scss`

Reuse the current orange-accent visual language. Add styles for:

- Numeric cells
- Missing middle slots
- Hint button state
- Reveal rule card
- Correct answer highlight
- Combo and score detail chips

Do not add new image assets.

## Testing Plan

Add focused unit tests for the pure generation and scoring logic:

- Generated normal and hard sessions contain 8 questions.
- Normal and hard distributions include the expected families.
- Visual questions have exactly one correct option.
- Numeric questions have exactly one correct option.
- Distractors are unique and do not duplicate the answer.
- Numeric arithmetic progression questions produce the expected next or missing number.
- Numeric increasing-difference questions produce the expected answer.
- Numeric Fibonacci-like questions produce the expected answer.
- Hint penalty cannot reduce a correct-case score below `+1`.
- Combo bonus is capped at `+2`.
- The practical score range does not make ordinary normal play trivially hit the 40-point pet cap.

Verification after implementation:

```bash
npm test -- --runTestsByPath tests/unit/patternCompletionPatterns.test.ts
npm run typecheck
```

Run broader tests if shared storage or point conversion code changes. The current design does not require changing point conversion code.

## Acceptance Criteria

1. A session has 8 generated cases, not a memorisable fixed 10-question bank.
2. The rule explanation is hidden until after the player answers.
3. The game includes both visual and numeric pattern questions.
4. Normal mode starts approachable and progressively introduces richer rules.
5. Hard mode adds stronger logic and distractors without relying on unreadable visuals.
6. Each question has one unique correct answer.
7. Each session has exactly 2 non-answer hints.
8. Reveal feedback explains the rule in one compact card.
9. Final results show total score, solved cases, longest combo, hints used, and numeric-question accuracy.
10. Completed sessions still record `gameId: "pattern-completion"` and use `getAwardedPoints("pattern-completion", finalScore, rewardDifficulty)`.
11. The `pattern-completion` point rate remains `1.2x`.
12. Tests cover generation, answer uniqueness, numeric rules, hints, combo scoring, and score-economy fit.
