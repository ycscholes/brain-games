# Two Brain-Age-Inspired Games Design

Date: 2026-05-27

## Goal

Add two new games to the existing brain training app, using classic Dr. Kawashima / Brain Age mechanics as inspiration while keeping this product's own names, visual treatment, scoring, and progression.

The games should feel more playful than plain drills, but remain lightweight enough for stable Taro mini program delivery.

## Selected Games

### Star Map Order

Homepage title: `星图排序`

Standard game ID: `number-order`

Category: `反应与记忆`

Inspired by the Low to High style mechanic: briefly show multiple numbers in different positions, hide the numbers, then ask the player to tap the positions from the lowest number to the highest.

### Theater Head Count

Homepage title: `小剧场清点`

Standard game ID: `head-count`

Category: `进阶专注`

Inspired by the Head Count style mechanic: show people entering and leaving a room, then ask the player how many people remain.

## Product Scope

This feature uses a game-like presentation:

- Scene-based names and visual framing.
- Lightweight animations using existing Taro `View` and `Text` primitives.
- Immediate per-question feedback.
- Final summary with score, best score, difficulty, accuracy, and pet point reward.
- Integration with the existing training records, homepage recommendation, and pet point systems.

This feature will not include:

- Original Brain Age names, art, or UI.
- New image or audio asset packs.
- Leaderboards, achievements, level maps, or social features.
- Voice, handwriting, or sensor-based input.

## Shared Game Rules

Both games use the same high-level session model:

- Fixed 8-question session.
- Supports `normal` and `hard` training difficulty.
- Only completed sessions write a training record.
- Difficulty affects game parameters and existing point multiplier behavior.
- Each game stores best score separately for normal and hard difficulty.
- Each game has deterministic validation rules that can be unit-tested without rendering the page.

## Star Map Order Rules

Each question follows this flow:

1. Show a short ready state with question number.
2. Display a cluster of numbered star points.
3. Hide the numbers while keeping the point positions visible.
4. Player taps the points in ascending numeric order.
5. Show correct or wrong feedback, then advance.

Normal difficulty:

- 4 to 6 numbers per question.
- Longer reveal time.
- Number range: 1 to 19.
- Spacious layout.

Hard difficulty:

- 5 to 7 numbers per question.
- Shorter reveal time.
- Number range: 1 to 31.
- Later questions may use a denser layout.

Generation constraints:

- Numbers must not repeat in a question.
- Positions must be distinct and tappable.
- The expected answer order must be unique.

Scoring:

- `+1` for each correctly tapped point.
- `+2` when the whole question is completed correctly.
- Consecutive fully correct questions add a small combo bonus, capped at `+2` per question.
- Expected strong normal score: about 28 to 40.
- Expected strong hard score: about 38 to 55.

Point conversion:

- Base rate: `1.0`.
- Existing hard difficulty multiplier and cap apply.

## Theater Head Count Rules

Each question follows this flow:

1. Show the initial room population.
2. Play 3 to 6 enter/leave events.
3. Hide the event sequence.
4. Present four numeric answer options.
5. Player chooses the final room population.
6. Show correct or wrong feedback, then advance.

Normal difficulty:

- Initial population: 1 to 5.
- 3 to 4 events.
- Each event changes 1 to 2 people.
- Final answer constrained to 0 to 9.
- Slower event pacing.

Hard difficulty:

- Initial population: 2 to 8.
- 4 to 6 events.
- Each event changes 1 to 3 people.
- May include repeated enter or repeated leave events.
- Faster event pacing.

Generation constraints:

- Population must never become negative.
- Final answer must be unique among the four options.
- Distractor options should be plausible and near the answer where possible.

Scoring:

- `+5` for each correct answer.
- `+0` to `+2` speed bonus for fast correct answers.
- `+1` combo bonus for consecutive correct answers.
- Expected strong normal score: about 32 to 45.
- Expected strong hard score: about 42 to 58.

Point conversion:

- Base rate: `1.0`.
- Existing hard difficulty multiplier and cap apply.

## Technical Design

### New Files

Add these pages:

- `src/pages/number-order/index.tsx`
- `src/pages/number-order/index.scss`
- `src/pages/number-order/index.config.ts`
- `src/pages/head-count/index.tsx`
- `src/pages/head-count/index.scss`
- `src/pages/head-count/index.config.ts`

Add pure game logic modules:

- `src/pages/number-order/gameLogic.ts`
- `src/pages/head-count/gameLogic.ts`

The `index.tsx` files should own UI state, timers, rendering, storage calls, and navigation. The `gameLogic.ts` files should own generation, validation, scoring helpers, and difficulty parameters.

### App Integration

Update `src/app.config.ts`:

- Register both new pages.

Update `src/pages/index/index.tsx`:

- Add both games to `BASE_GAMES`.
- Add both games to `GAME_TITLES`.
- Put `number-order` under the `memory` category.
- Put `head-count` under the `advanced` category.
- Choose card classes that match the current visual system without making the palette one-note.

Update `src/utils/trainingStorage.ts`:

- Add `number-order` and `head-count` to `TrainingGameId`.
- Add both IDs to `TRAINING_POINT_RATES` with `1.0`.
- Add both games' best-score keys to `clearProductData()`.

Update `docs/points-economy.md`:

- Add both games to the point conversion table.
- Document their expected score and reward ranges.

### Storage Keys

Use these best-score keys:

- `number_order_best_normal`
- `number_order_best_hard`
- `head_count_best_normal`
- `head_count_best_hard`

Completed sessions should call:

- `getAwardedPoints(gameId, score, difficulty)`
- `addPointsToPet(gameId, score, difficulty)`
- `recordTrainingSession({ gameId, score, awardedPoints, durationSeconds, difficulty, outcome: "completed" })`

## UI Direction

### Star Map Order

Use a compact star-map board:

- Numbered points appear as bright nodes during reveal.
- During answer, numbers hide but nodes remain tappable.
- Correct taps light up the node in sequence.
- Wrong taps mark the current question and move on after feedback.

### Theater Head Count

Use a simple stage or room:

- A central room area shows current figures during the event animation.
- Left and right door areas communicate entering and leaving.
- Events can be represented with small person tokens and arrows using text/CSS, not image assets.
- The answer state uses four stable option buttons.

## Testing Plan

Add focused unit tests for pure logic:

- `number-order` question generation produces unique numbers.
- `number-order` answer order is ascending and unique.
- `number-order` scoring awards per-point, full-question, and combo points correctly.
- `head-count` event generation never creates negative population.
- `head-count` answer options include the correct answer exactly once.
- `head-count` scoring awards correctness, speed bonus, and combo bonus correctly.
- `trainingStorage` point conversion recognizes the two new game IDs.

Run verification after implementation:

- `npm run typecheck`
- Relevant Jest tests, or `npm test` if the test suite remains small.
- A Taro build command if page/style changes need build validation.

## Acceptance Criteria

1. The homepage shows `星图排序` and `小剧场清点` in the chosen categories.
2. Homepage search can find both new games by title, badge, skill, duration, and category.
3. Homepage recommendation can recommend both games.
4. Each game can complete an 8-question normal session and hard session.
5. Each completed session records score, awarded points, duration, difficulty, and `completed` outcome.
6. Dashboard totals, training records, and pet point balance update after completion.
7. Best scores are stored and read separately for normal and hard difficulty.
8. Star Map Order never generates duplicate numbers in one question.
9. Theater Head Count never generates an impossible negative population path.
10. Theater Head Count answer options contain one correct answer and plausible distractors.
11. The implementation passes typecheck and relevant tests.

## Implementation Plan

1. Add shared IDs and point-rate support in `trainingStorage`.
2. Add `number-order` pure logic and tests.
3. Build the `number-order` page and styles.
4. Add `head-count` pure logic and tests.
5. Build the `head-count` page and styles.
6. Register both pages in app config.
7. Add both cards to the homepage and recommendation pool.
8. Update point economy documentation.
9. Run verification.
10. Commit only files related to this feature.
