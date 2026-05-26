# Difficulty-Based Points Design

## Context

The project currently has eight training games. Some games already expose difficulty, some increase difficulty automatically, and some have no explicit difficulty choice. Points are awarded through `getAwardedPoints(gameId, score)` and then applied to pets through `addPointsToPet(gameId, score)`. Difficulty is stored only as part of the training `mode` string in some games, so it does not affect points.

The requested change is that every existing game has at least Normal and Hard difficulty, and higher difficulty awards more points.

## Goals

- Every game exposes or maps to at least two difficulty levels: Normal and Hard.
- Game scores remain a measure of training performance, not pet economy value.
- Final awarded points use a difficulty multiplier.
- Training records and pet point gains use the same calculation.
- Existing records and legacy storage continue to read correctly.
- The points economy remains bounded enough to avoid easy point inflation.

## Non-Goals

- Redesigning each game from scratch.
- Rebalancing pet adoption cost, food prices, hunger decay, or pet death rules.
- Migrating old training records to infer historical difficulty.

## Recommended Approach

Use final-point multipliers rather than changing in-game scoring.

Normal difficulty uses a `1.0x` multiplier. Hard difficulty uses a `1.5x` multiplier. The game-specific conversion rates remain the base balancing layer, and difficulty is applied after that base conversion.

To keep rewards bounded, add a per-session cap after difficulty is applied:

| Difficulty | Multiplier | Point Cap |
| --- | ---: | ---: |
| Normal | 1.0x | 40 |
| Hard | 1.5x | 60 |

This keeps the existing "good session" reward near 10-40 points for Normal while allowing Hard to pay more without becoming unbounded.

## Data Model

Add a canonical difficulty type in `src/utils/trainingStorage.ts`:

```ts
export type TrainingDifficulty = "normal" | "hard";
```

Extend `TrainingRecord`:

```ts
difficulty?: TrainingDifficulty;
```

The field is optional for backward compatibility. Missing difficulty is treated as Normal.

Update point calculation:

```ts
getAwardedPoints(gameId: string, score: number, difficulty?: TrainingDifficulty)
```

The function should:

1. Apply the existing game-specific base rate.
2. Apply the difficulty multiplier.
3. Clamp negative or invalid scores to zero.
4. Cap the result using the difficulty-specific cap.

Update pet awarding:

```ts
addPointsToPet(gameId: string, score: number, difficulty?: TrainingDifficulty)
```

This keeps training records and pet balance aligned.

## Game Difficulty Mapping

### Existing Explicit Difficulty

- `memory-challenge`: map lower combinations to Normal and higher combinations to Hard. A simple rule is Hard when time difficulty is 3 or 4, or memory difficulty is 3 or 4.
- `rock-paper-scissors`: map difficulty 1-2 to Normal and 3-4 to Hard.
- `dual-task`: keep the existing four labels. Map `easy` and `normal` to Normal; `hard` and `expert` to Hard.

### Add Normal/Hard Selection

- `mental-math`: replace the current purely high-score-derived label with an explicit Normal/Hard selector. Normal uses the current easier generation range; Hard starts at harder problem generation and keeps the existing score-based progression inside that band.
- `twenty-four`: add Normal/Hard. Normal keeps current 90-second rounds with current card range. Hard uses a tighter timer or harder card generation while preserving one point per solved round.
- `digit-span`: add Normal/Hard. Normal keeps current start length and reveal cadence. Hard starts at a longer sequence or reduces reveal time while preserving score as maximum recalled length.
- `multiple-object-tracking`: add Normal/Hard. Normal keeps current target count, speed, preview, and tracking duration. Hard increases initial target count or speed and can shorten preview while preserving score as consecutive successful rounds.
- `pattern-completion`: add Normal/Hard. Normal can use the current full question bank. Hard should bias toward higher-difficulty questions and reduce or remove the time bonus window while preserving final score semantics.

## UI Requirements

- Each game start screen must show a Normal/Hard selector or an equivalent existing difficulty selector that clearly maps to Normal/Hard rewards.
- Result screens should display the actual awarded points using the difficulty-aware calculation.
- Training records should show a difficulty label when available, for example `困难 · 正常完成 · 5 分钟前`.
- Existing records without difficulty should display normally and behave as Normal for stats.

## Implementation Notes

- Prefer a shared utility for difficulty labels and multipliers to avoid repeating strings across pages.
- Keep the current `mode` strings for detailed game context. Add `difficulty` as the canonical reward tier.
- For games with existing high-score keys split by detailed difficulty, keep those keys unchanged.
- For games that newly add Normal/Hard, either split high-score storage by difficulty or preserve existing global high scores only if the UI makes that explicit. Splitting by difficulty is preferable for fairness.
- Update `docs/points-economy.md` after implementation to document the new multiplier and cap rules.

## Testing

Update `tests/unit/trainingStorage.test.ts` to cover:

- Normal difficulty keeps existing point values up to the Normal cap.
- Hard difficulty applies `1.5x` and caps at 60.
- Missing difficulty defaults to Normal.
- Unknown game IDs still award zero.
- Negative scores still award zero.
- Records with and without `difficulty` are both accepted.

Run the existing unit test suite after implementation.

## Acceptance Criteria

- All eight games have at least Normal and Hard reward tiers.
- Hard sessions award more points than Normal sessions for the same base score.
- Pet point gains exactly match `TrainingRecord.awardedPoints`.
- Training records remain readable after the schema addition.
- Unit tests cover the scoring changes.
- Documentation reflects the new point economy.
