# Traffic, Netwalk and Hidato Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the three requested visual surfaces and replace Traffic Escape's shallow fixed puzzle pool with validated, harder generated puzzles.

**Architecture:** Start screens retain page-owned phase/state and shared reward plumbing, while their page SCSS adopts the common light entry-screen tokens. Traffic Escape keeps immutable puzzle definitions but creates them from a bounded random layout generator; a pure BFS solver validates candidates and supplies a state-aware hint. Hidato changes only presentation tokens, and the catalog card returns to the base card treatment.

**Tech Stack:** React, Taro, TypeScript, Sass, Jest.

---

### Task 1: Lock generator behavior with failing logic tests

**Files:**
- Modify: `tests/unit/trafficEscapeGameLogic.test.ts`
- Modify: `src/pages/traffic-escape/gameLogic.ts`

- [ ] **Step 1: Add generated-puzzle contract tests**

```ts
import { createTrafficEscapePuzzle, solveTrafficEscapePuzzle } from "../../src/pages/traffic-escape/gameLogic";

test("generates solvable puzzles with difficulty-specific depth and density", () => {
  (["normal", "hard"] as const).forEach((difficulty) => {
    const puzzle = createTrafficEscapePuzzle(difficulty, difficulty === "normal" ? 17 : 29);
    const solution = solveTrafficEscapePuzzle(puzzle, createTrafficEscapeState(puzzle));
    expect(solution).not.toBeNull();
    expect(puzzle.vehicles.length).toBeGreaterThanOrEqual(difficulty === "hard" ? 8 : 6);
    expect(solution!.length).toBeGreaterThanOrEqual(difficulty === "hard" ? 7 : 4);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- trafficEscapeGameLogic.test.ts`

Expected: FAIL because `solveTrafficEscapePuzzle` is not exported and the old fixed pool does not meet depth/density assertions.

- [ ] **Step 3: Add pure state identity, legal-move enumeration and BFS solving**

```ts
export function solveTrafficEscapePuzzle(puzzle: TrafficEscapePuzzle, initialState: TrafficEscapeState) {
  const queue = [{ state: initialState, moves: [] as TrafficEscapeMove[] }];
  const visited = new Set([getTrafficEscapeStateKey(initialState)]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (isTrafficEscapeSolved(puzzle, current.state)) return current.moves;
    getTrafficEscapeLegalMoves(puzzle, current.state).forEach((move) => {
      const result = applyTrafficEscapeMove(puzzle, current.state, move);
      const key = getTrafficEscapeStateKey(result.state);
      if (result.moved && !visited.has(key)) {
        visited.add(key);
        queue.push({ state: result.state, moves: [...current.moves, move] });
      }
    });
  }
  return null;
}
```

`getTrafficEscapeLegalMoves` must emit each non-zero legal displacement for every vehicle. `getTrafficEscapeStateKey` must sort by vehicle id and include each coordinate so equivalent board states are deduplicated.

- [ ] **Step 4: Run focused tests and confirm they pass**

Run: `npm test -- trafficEscapeGameLogic.test.ts`

Expected: PASS.

### Task 2: Generate and select harder Traffic Escape boards

**Files:**
- Modify: `src/pages/traffic-escape/gameLogic.ts`
- Modify: `tests/unit/trafficEscapeGameLogic.test.ts`
- Modify: `docs/points-economy.md`

- [ ] **Step 1: Add a deterministic seeded random source and candidate builder**

```ts
const DIFFICULTY_REQUIREMENTS = {
  normal: { size: 5, vehicleCount: 6, minimumSolutionMoves: 4, attempts: 80 },
  hard: { size: 6, vehicleCount: 8, minimumSolutionMoves: 7, attempts: 120 },
} as const;

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}
```

Build a non-overlapping solved layout with the target at the right edge, then reverse legal moves until the target is left of the exit and at least one vertical blocker occupies its route. Solve every candidate with Task 1's BFS and accept only candidates meeting `DIFFICULTY_REQUIREMENTS`; keep a validated fallback per difficulty for bounded startup time.

- [ ] **Step 2: Replace fixed-pool selection with generated selection**

```ts
export function createTrafficEscapePuzzle(difficulty: TrafficEscapeDifficulty, seed = Date.now()) {
  const random = createSeededRandom(seed);
  const requirements = DIFFICULTY_REQUIREMENTS[difficulty];
  for (let attempt = 0; attempt < requirements.attempts; attempt += 1) {
    const candidate = createTrafficEscapeCandidate(difficulty, random, attempt);
    const solutionMoves = solveTrafficEscapePuzzle(candidate, createTrafficEscapeState(candidate));
    if (solutionMoves && solutionMoves.length >= requirements.minimumSolutionMoves) {
      return { ...candidate, solutionMoves };
    }
  }
  return createValidatedTrafficEscapeFallback(difficulty);
}
```

Do not alter `scoreTrafficEscapeGame` caps or its shared reward pipeline. Update the difficulty wording in `docs/points-economy.md` to describe normal's multi-step route and hard's dense, longer route.

- [ ] **Step 3: Make hints state-aware and add a deviation test**

```ts
export function getTrafficEscapeHint(puzzle: TrafficEscapePuzzle, state: TrafficEscapeState) {
  return solveTrafficEscapePuzzle(puzzle, state)?.[0] ?? null;
}
```

Test that after a legal non-solution move, `getTrafficEscapeHint` returns a legal move that the move reducer accepts.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- trafficEscapeGameLogic.test.ts`

Expected: PASS, including generated normal/hard puzzles, fallback and deviation hint coverage.

### Task 3: Make entry screens use the common light start-screen treatment

**Files:**
- Modify: `src/pages/traffic-escape/index.scss`
- Modify: `src/pages/netwalk/index.scss`
- Test: `npm run typecheck`

- [ ] **Step 1: Replace start-screen-only theme overrides**

```scss
.traffic-escape-page .start-screen,
.netwalk-page .start-screen {
  min-height: calc(100vh - 84px);
  max-height: calc(100vh - 84px);
  overflow-y: auto;
  gap: 0;
}
```

Use page-scoped equivalents of the 24 点 `header-section`, `logo-icon`, `game-title`, `game-subtitle`, `high-score-badge`, `rules-card`, `summary-card`, `summary-grid`, `summary-item`, `floating-start-action`, and spacer rules. Do not change their gameplay/finish selectors or JSX state flow.

- [ ] **Step 2: Run type checking**

Run: `npm run typecheck`

Expected: PASS.

### Task 4: Harmonize Hidato path color and card treatment

**Files:**
- Modify: `src/pages/hidato/index.scss`
- Modify: `src/styles/game-list.scss`
- Test: `npm run lint`

- [ ] **Step 1: Change only the completed-path presentation token**

```scss
.hidato-line-segment {
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.92), rgba(124, 58, 237, 0.94));
  box-shadow: 0 4px 10px rgba(79, 70, 229, 0.2);
}
```

- [ ] **Step 2: Remove Hidato-only card and badge visual overrides**

Delete `.card-hidato` and `.card-hidato .game-badge` rules, leaving the catalog's `cardClass` intact so the generic card layout continues to render it.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: PASS.

### Task 5: Verify integration and commit implementation

**Files:**
- Modify: `docs/points-economy.md`
- Modify: `src/pages/traffic-escape/gameLogic.ts`
- Modify: `src/pages/traffic-escape/index.tsx`
- Modify: `src/pages/traffic-escape/index.scss`
- Modify: `src/pages/netwalk/index.scss`
- Modify: `src/pages/hidato/index.scss`
- Modify: `src/styles/game-list.scss`
- Modify: `tests/unit/trafficEscapeGameLogic.test.ts`

- [ ] **Step 1: Run the full quality gate**

Run: `npm test && npm run typecheck && npm run lint && npm run build:weapp && npm run secrets:check && git diff --check`

Expected: all commands succeed; a successful WeChat build may still print the known non-blocking `punycode` deprecation warning.

- [ ] **Step 2: Review the exact task diff**

Run: `git diff -- src/pages/traffic-escape src/pages/netwalk/index.scss src/pages/hidato/index.scss src/styles/game-list.scss tests/unit/trafficEscapeGameLogic.test.ts docs/points-economy.md`

Expected: only the requested visual refinements, generator/solver behavior, tests, and difficulty documentation appear.

- [ ] **Step 3: Commit task files only**

```bash
git add src/pages/traffic-escape src/pages/netwalk/index.scss src/pages/hidato/index.scss src/styles/game-list.scss tests/unit/trafficEscapeGameLogic.test.ts docs/points-economy.md
git commit -m "feat: deepen traffic escape puzzles and align game screens"
```

Do not stage the unrelated `project.config.json` modification.
