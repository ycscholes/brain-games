# Number Order Star Route Redesign

Date: 2026-05-30

## Goal

Refresh `星图排序` from a plain number-order memory test into a short, replayable `星路探索` game. The new version should improve game feel, UI clarity, and difficulty pacing while preserving the existing page route, training records, best-score storage, and pet points economy.

The approved direction is a rule-driven star route game: the player observes star clues, remembers their positions, then lights the route according to the current rule.

## Problems To Solve

- The current game is mostly one repeated rule: remember numbers, hide them, tap ascending order.
- Difficulty depends too much on point count and shorter reveal time, which can feel punishing instead of interesting.
- Feedback is thin; after a mistake the player sees little explanation of the correct route.
- The UI feels more like a static training card than a game with progression and route completion.
- Any scoring refresh must remain compatible with the existing `number-order` point conversion and difficulty caps.

## Player Experience

Each session contains 8 charts.

For each chart:

1. `观察`: show star positions, numeric clues, optional color or brightness clues, and the current route rule.
2. `回忆`: hide the clues while keeping star positions and a compact rule label visible.
3. `点亮`: the player taps stars in rule order, drawing a route as they go.
4. `回放`: show the correct route, the player's path, score gained, and a short explanation.

The player should understand each rule before answering. Rule variety is meant to add freshness, not ambiguity.

## Route Rules

The game supports five route rules.

| Rule | Label | Answer Order |
| --- | --- | --- |
| Ascending | `升序星路` | Tap numbers from small to large. |
| Descending | `降序星路` | Tap numbers from large to small. |
| Odd Even | `奇偶星路` | Tap odd numbers ascending, then even numbers ascending. |
| Color Route | `双色星路` | Tap the highlighted color group first, then the other group; sort ascending within each group. |
| Brightness Route | `亮度星路` | Tap bright stars first, then normal stars; sort ascending within each group. |

Normal starts with familiar rules. The first two charts are fixed to ascending order. The middle charts introduce descending and odd/even routes. The final charts may introduce color or brightness routes, still with only one rule per chart.

Hard can use any rule from the first chart, but each chart still has one clear rule and a short explanation.

## UI Design

### Start Screen

The start screen should present the game as `星路探索`, not only a rule list.

- Hero copy: `记住星点线索，按航线规则点亮星路。`
- Add a compact star-board preview with 4-5 stars and one lit route.
- Compress instructions into three steps: `看线索`, `记位置`, `按规则点亮`.
- Keep the Normal and Hard selector:
  - Normal: `规则逐步加入 · 观察时间更宽`
  - Hard: `多规则混合 · 星点更多`
- Preserve the best-score display for the selected difficulty.

### Play Screen

- Keep top status for chart progress, score, and combo.
- The prompt card shows the current rule title and a short explanation.
- The star board draws the tapped path while the player answers.
- Correct route segments use teal. Wrong taps use coral/red.
- During replay, show the correct route values, for example `7 -> 13 -> 2 -> 8`, plus a short explanation of why that is the route.
- Replay should last long enough for the player to understand the mistake before the next chart starts.

### Result Screen

Keep total score, best score, awarded pet points, and difficulty. Add higher-signal training feedback:

- `最佳连击`
- `完成航线`
- `掌握规则`, listing rule labels completed at least once

The result screen should help the player feel progress beyond a raw score.

## Difficulty

Difficulty should be driven by rule complexity, star count, and clue distribution more than by aggressively shortening reveal time.

### Normal

- 8 charts.
- Star count ranges from 4 to 6.
- Reveal time trends from about `2400ms` to `1800ms`.
- Charts 1-2 are ascending.
- Charts 3-5 introduce descending or odd/even.
- Charts 6-8 may introduce color or brightness.
- Each chart has one clear rule.
- Target experience: most players can complete 4-6 routes on the first session and see room to improve.

### Hard

- 8 charts.
- Star count ranges from 5 to 7.
- Reveal time trends from about `2000ms` to `1400ms`.
- Rule variants may appear from the first chart.
- Later charts may use closer numbers or more spatially spread stars.
- Do not stack multiple rule systems in one chart.
- Target experience: experienced players can chase high combos, but the rules remain readable.

## Scoring And Points Economy

Do not change the global points economy.

Current project rules:

- `number-order` keeps its `1.0x` base conversion rate.
- Normal pet points are `floor(score * 1.0)`, capped at `40`.
- Hard pet points are `floor(score * 1.5)`, capped at `60`.
- Training records and pet point gains must both use `getAwardedPoints("number-order", finalScore, rewardDifficulty)`.

Game score:

- Each correct consecutive tap: `+1`.
- Completing the full route: `+2`.
- Full-chart combo bonus: `+0` to `+2`, using the existing combo cap.
- Wrong taps keep only the correct prefix score for that chart.
- Wrong taps do not receive the full-route bonus or combo bonus.
- There is no extra complex-rule bonus.

Expected score shape:

- Normal strong sessions land around `30-40`, which converts to about `30-40` pet points.
- Hard strong sessions land around `36-45`, which converts to about `54-60` pet points after the hard multiplier and cap.
- Average sessions should still sit within the documented target range: Normal about `20-40`, Hard about `30-60`.

This keeps rule variety as game depth rather than a new reward multiplier.

## Technical Design

Keep the implementation inside `src/pages/number-order/`.

### `gameLogic.ts`

Upgrade the logic from fixed ascending sort to route-rule generation.

Responsibilities:

- Define route rule types and metadata.
- Generate star values, positions, colors, and brightness flags.
- Choose route rules according to difficulty and chart index.
- Calculate `answerIds` from the chosen route rule.
- Provide replay explanation text.
- Score a submitted tap sequence.
- Keep all generation and scoring functions pure enough for unit tests.

Suggested types:

```ts
export type NumberOrderRouteRuleId =
  | "ascending"
  | "descending"
  | "odd-even"
  | "color-route"
  | "brightness-route";

export interface NumberOrderRouteRule {
  id: NumberOrderRouteRuleId;
  title: string;
  shortLabel: string;
  description: string;
  complexity: "basic" | "medium" | "advanced";
}
```

`NumberOrderPoint` should gain optional clue fields:

```ts
colorGroup?: "teal" | "gold";
brightness?: "bright" | "normal";
```

### `index.tsx`

Keep page ownership of timers, storage, points, and navigation.

State changes:

- Track the current route rule through `currentQuestion`.
- Track tapped path for line rendering.
- Track `bestCombo`.
- Track completed route count.
- Track completed rule labels for the result screen.

The existing phases can stay:

- `start`
- `ready`
- `revealing`
- `answering`
- `feedback`
- `finished`

### `index.scss`

Refresh the visual language while keeping the page lightweight.

- Deep star board with readable stars and route paths.
- Teal for correct route progress.
- Gold for important clues and route preview.
- Coral/red for wrong taps.
- Avoid a one-note dark-blue palette by using light page panels, deep board contrast, and warm accent details.
- Keep fixed board and node dimensions stable so taps and labels do not shift layout.

No new image assets are required.

## Testing Plan

Update `tests/unit/numberOrderGameLogic.test.ts`.

Cover:

- Normal and Hard sessions contain 8 charts.
- Normal and Hard use expected point-count ranges.
- Generated values are unique and readable.
- Every route rule produces the expected answer order on deterministic fixtures.
- Normal early charts start with ascending rules.
- Hard can include advanced rules without stacking multiple rules in one chart.
- Replay explanation text exists for every generated rule.
- Scoring handles full route, partial prefix, wrong first tap, wrong later tap, and combo bonus.
- Scores remain aligned with the expected points economy ranges.

Verification commands:

```sh
npm test -- --runInBand tests/unit/numberOrderGameLogic.test.ts
```

If TSX or SCSS changes are made during implementation, also run the project's available build or type-check command.

## Acceptance Criteria

- The game still lives at `/pages/number-order/index`.
- Existing best-score keys and training records remain compatible.
- A session has 8 charts and supports Normal/Hard reward difficulty.
- Route rules are visible before answering and explained during replay.
- The player sees a drawn path while tapping and a correct route during feedback.
- Final score and pet points use the existing `number-order` conversion rate and difficulty caps.
- Unit tests cover route generation, scoring, and economy-aligned score ranges.
