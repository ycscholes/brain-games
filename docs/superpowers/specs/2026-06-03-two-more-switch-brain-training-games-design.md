# Two More Switch Brain Training Inspired Games

Date: 2026-06-03

## Goal

On top of the existing brain training set, add two more lightweight games inspired by Nintendo Switch Dr. Kawashima style drills while keeping original local names, visuals, scoring, and the existing pet point economy.

## Selected Games

### Word Scramble

- Page title: `词语拼盘`
- Game ID: `word-scramble`
- Category: `日常优先`
- Training focus: language reconstruction and semantic matching
- Inspiration: word rearrangement and quick language processing drills

The player sees shuffled Chinese characters plus a hint, then chooses the original word from four options.

### Bird Count

- Page title: `飞鸟速数`
- Game ID: `bird-count`
- Category: `进阶专注`
- Training focus: quick observation and instantaneous counting
- Inspiration: quick bird-counting / visual quantity drills

The player briefly sees a flock of birds, then chooses how many birds appeared from four options.

## Shared Rules

- Each session has 8 questions.
- Both games support `normal` and `hard`.
- Only completed sessions record training history and award pet points.
- Both use `getAwardedPoints(gameId, score, difficulty)` and `addPointsToPet(gameId, score, difficulty)`.
- Both store best scores separately by difficulty.
- Both have pure `gameLogic.ts` modules with Jest coverage for generation and scoring.

## Scoring

Both games use the same simple session balance:

- Correct answer: 4 points.
- Fast correct answer: +1.
- Combo after at least two current consecutive correct answers: +1.
- Wrong answer: 0.
- Strong normal sessions land around 24-40 points.
- Strong hard sessions use the existing 1.5x pet point multiplier and 60 point cap.

## Integration

Required app integration:

- Register pages in `src/app.config.ts`.
- Add homepage cards and titles in `src/pages/index/index.tsx`.
- Add visual card classes in `src/pages/index/index.scss`.
- Extend `TrainingGameId`, `TRAINING_POINT_RATES`, and `clearProductData()` in `src/utils/trainingStorage.ts`.
- Add record display names in `src/pages/training-records/index.tsx`.
- Add share paths and copy in `src/utils/share.ts`.
- Document point economy in `docs/points-economy.md`.

## Verification

The implementation should pass:

- `npm test`
- `npm run typecheck`
- `npm run build:weapp`

