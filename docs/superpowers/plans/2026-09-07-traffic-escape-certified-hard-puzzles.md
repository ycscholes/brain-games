# Traffic Escape Certified Hard Puzzles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace runtime-generated Traffic Escape hard boards with a deterministic bank of 36 certified ten-vehicle puzzles targeting 2–3 minute expert solves.

**Architecture:** Pure TypeScript generator and quality modules create candidates from multiple solved templates, certify them with the runtime BFS semantics, and emit a generated puzzle bank during development. The mini program selects hard boards from that bank, while normal generation and state-aware hints remain available at runtime.

**Tech Stack:** TypeScript, React, Taro, Jest, Node.js 22, Bash.

---

### Task 1: Expose detailed solver evidence

**Files:**
- Modify: `src/pages/traffic-escape/gameLogic.ts:256-296`
- Modify: `tests/unit/trafficEscapeGameLogic.test.ts`

- [ ] **Step 1: Write a failing detailed-solver test**

Add `solveTrafficEscapePuzzleDetailed` to the test import and add:

```ts
test("reports shortest-path evidence without changing the public solver result", () => {
  const puzzle = createTrafficEscapePuzzle("normal", 17);
  const state = createTrafficEscapeState(puzzle);
  const detailed = solveTrafficEscapePuzzleDetailed(puzzle, state);

  expect(detailed?.moves).toEqual(solveTrafficEscapePuzzle(puzzle, state));
  expect(detailed?.visitedStateCount).toBeGreaterThan(0);
  expect(detailed?.legalFirstMoves.length).toBeGreaterThan(0);
  expect(detailed?.optimalFirstMoves.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- --runInBand tests/unit/trafficEscapeGameLogic.test.ts`

Expected: FAIL because `solveTrafficEscapePuzzleDetailed` is not exported.

- [ ] **Step 3: Implement the detailed solver result**

Add the following public shape and make BFS retain predecessor depth so all first moves reaching a shortest solved depth can be collected:

```ts
export interface TrafficEscapeSolveResult {
  moves: TrafficEscapeMove[];
  visitedStateCount: number;
  legalFirstMoves: TrafficEscapeMove[];
  optimalFirstMoves: TrafficEscapeMove[];
}

export function solveTrafficEscapePuzzleDetailed(
  puzzle: TrafficEscapePuzzle,
  initialState: TrafficEscapeState,
): TrafficEscapeSolveResult | null;

export function solveTrafficEscapePuzzle(
  puzzle: TrafficEscapePuzzle,
  initialState: TrafficEscapeState,
) {
  return solveTrafficEscapePuzzleDetailed(puzzle, initialState)?.moves ?? null;
}
```

Implement it by extending the existing queue entry with `depth` and `firstMove`. Keep a `Map<stateKey, depth>` instead of a plain visited set so another path reaching the same state at the same depth can contribute an alternative first move. After the first solved state is found, continue processing only queue entries at that same depth, collect their first moves, then return the lexicographically first shortest path as `moves`. Use the existing canonical state key and legal-displacement enumeration, deduplicate first moves by `vehicleId:delta`, preserve the 30,000-state safety ceiling, and return `null` if no solved state is found before the ceiling.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- --runInBand tests/unit/trafficEscapeGameLogic.test.ts`

Expected: PASS with the existing hint, movement and score tests unchanged.

- [ ] **Step 5: Commit the solver seam**

```bash
git add src/pages/traffic-escape/gameLogic.ts tests/unit/trafficEscapeGameLogic.test.ts
git commit -m "refactor: expose traffic escape solver evidence"
```

### Task 2: Define measurable hard-puzzle certification

**Files:**
- Create: `src/pages/traffic-escape/puzzleQuality.ts`
- Create: `tests/unit/trafficEscapePuzzleQuality.test.ts`

- [ ] **Step 1: Write failing certification tests**

Create tests that import the quality API and exercise one accepted fixture plus separate rejected fixtures:

```ts
import {
  HARD_PUZZLE_QUALITY_RULES,
  analyzeTrafficEscapePuzzle,
  certifyTrafficEscapeHardPuzzle,
  getTrafficEscapeGeometryKey,
} from "../../src/pages/traffic-escape/puzzleQuality";

test("hard certification encodes the two-to-three-minute target", () => {
  expect(HARD_PUZZLE_QUALITY_RULES).toEqual({
    size: 6,
    vehicleCount: 10,
    minimumMoves: 8,
    maximumMoves: 12,
    minimumDistinctVehicles: 5,
    minimumDependencyDepth: 3,
    minimumLegalFirstMoves: 4,
    maximumOptimalFirstMoves: 2,
    maximumVisitedStates: 12_000,
    requireTargetOnlyOnFinalMove: true,
  });
});

test.each([
  ["seven-step route", certifiedFixture, { minimumMoves: 9 }],
  ["too many optimal openings", certifiedFixture, { maximumOptimalFirstMoves: 0 }],
  ["shallow dependency chain", certifiedFixture, { minimumDependencyDepth: 4 }],
])("rejects %s", (_label, puzzle, override) => {
  expect(certifyTrafficEscapeHardPuzzle(puzzle, override).accepted).toBe(false);
});

test("geometry keys ignore ids, colors, and appearances", () => {
  expect(getTrafficEscapeGeometryKey(certifiedFixture))
    .toBe(getTrafficEscapeGeometryKey(relabelPuzzle(certifiedFixture)));
});
```

The fixture must be a complete local `TrafficEscapePuzzle` with ten non-overlapping vehicles and a known 8–12 move solution. Do not mock the solver.

- [ ] **Step 2: Run the new suite and verify RED**

Run: `npm test -- --runInBand tests/unit/trafficEscapePuzzleQuality.test.ts`

Expected: FAIL because `puzzleQuality.ts` does not exist.

- [ ] **Step 3: Implement the quality analyzer**

Define these exported interfaces and constants:

```ts
export interface TrafficEscapePuzzleAnalysis {
  solutionMoves: TrafficEscapeMove[];
  shortestMoveCount: number;
  distinctMovedVehicleCount: number;
  dependencyDepth: number;
  legalFirstMoveCount: number;
  optimalFirstMoveCount: number;
  visitedStateCount: number;
  targetOnlyOnFinalMove: boolean;
}

export interface TrafficEscapeCertification {
  accepted: boolean;
  failures: string[];
  analysis: TrafficEscapePuzzleAnalysis | null;
}

export const HARD_PUZZLE_QUALITY_RULES = {
  size: 6,
  vehicleCount: 10,
  minimumMoves: 8,
  maximumMoves: 12,
  minimumDistinctVehicles: 5,
  minimumDependencyDepth: 3,
  minimumLegalFirstMoves: 4,
  maximumOptimalFirstMoves: 2,
  maximumVisitedStates: 12_000,
  requireTargetOnlyOnFinalMove: true,
} as const;
```

`analyzeTrafficEscapePuzzle` must use `solveTrafficEscapePuzzleDetailed`. Replay the shortest path and build dependency edges only when an exact later move changes from illegal before a move to legal immediately after it; `dependencyDepth` is the longest such chain ending at the final target move. `certifyTrafficEscapeHardPuzzle` returns every failed rule rather than stopping at the first failure.

- [ ] **Step 4: Run quality and existing logic tests**

Run: `npm test -- --runInBand tests/unit/trafficEscapePuzzleQuality.test.ts tests/unit/trafficEscapeGameLogic.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit certification logic**

```bash
git add src/pages/traffic-escape/puzzleQuality.ts tests/unit/trafficEscapePuzzleQuality.test.ts
git commit -m "feat: certify traffic escape puzzle depth"
```

### Task 3: Build the deterministic offline generator

**Files:**
- Create: `src/pages/traffic-escape/puzzleGenerator.ts`
- Create: `scripts/generate-traffic-escape-hard-puzzles.ts`
- Create: `scripts/generate-traffic-escape-hard-puzzles.sh`
- Create: `tests/unit/trafficEscapePuzzleGenerator.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing generator invariants**

```ts
import {
  createTrafficEscapeHardCandidate,
  getTrafficEscapeHardSolvedTemplates,
} from "../../src/pages/traffic-escape/puzzleGenerator";
import { certifyTrafficEscapeHardPuzzle } from "../../src/pages/traffic-escape/puzzleQuality";

test("uses multiple valid ten-vehicle solved templates", () => {
  const templates = getTrafficEscapeHardSolvedTemplates();
  expect(templates).toHaveLength(4);
  expect(templates.every((puzzle) => puzzle.size === 6 && puzzle.vehicles.length === 10)).toBe(true);
  expect(new Set(templates.map((puzzle) => getTrafficEscapeGeometryKey(puzzle))).size).toBe(4);
});

test("candidate generation is deterministic and never immediately reverses a move", () => {
  const first = createTrafficEscapeHardCandidate(20260907);
  const second = createTrafficEscapeHardCandidate(20260907);
  expect(first).toEqual(second);
  expect(first.generationTrace.some((move, index, trace) => index > 0
    && move.vehicleId === trace[index - 1].vehicleId
    && move.delta === -trace[index - 1].delta)).toBe(false);
});

test("a fixed seed corpus contains certifiable candidates", () => {
  const accepted = Array.from({ length: 500 }, (_, index) => index + 1)
    .map(createTrafficEscapeHardCandidate)
    .filter((candidate) => certifyTrafficEscapeHardPuzzle(candidate.puzzle).accepted);
  expect(accepted.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the generator suite and verify RED**

Run: `npm test -- --runInBand tests/unit/trafficEscapePuzzleGenerator.test.ts`

Expected: FAIL because `puzzleGenerator.ts` does not exist.

- [ ] **Step 3: Implement templates and reverse walk**

`createTrafficEscapeHardCandidate(seed)` must:

1. Pick one of four valid solved templates from the seed.
2. Move the target left through a legal reverse move.
3. Perform 48–72 legal non-target reverse moves.
4. Reject moves that immediately reverse the preceding move or revisit a state key.
5. Preserve a blocker in the exit lane.
6. Return the puzzle and generation trace without assigning visual appearances.

Use the same seeded linear-congruential random function already used by `gameLogic.ts`. Extract and export the helper instead of copying its implementation.

- [ ] **Step 4: Implement atomic bank generation**

The CLI must scan seeds `1..20_000`, certify and geometry-deduplicate candidates, sort accepted puzzles by geometry key, take exactly 36, serialize them as a typed constant, and write through a sibling temporary file followed by `renameSync`:

```ts
const OUTPUT_PATH = resolve("src/pages/traffic-escape/hardPuzzles.generated.ts");
const TEMP_PATH = `${OUTPUT_PATH}.tmp`;
const selected = collectCertifiedPuzzles({ firstSeed: 1, lastSeed: 20_000, count: 36 });

if (selected.length !== 36) {
  throw new Error(`Expected 36 certified puzzles, received ${selected.length}`);
}

writeFileSync(TEMP_PATH, serializeCertifiedPuzzles(selected), "utf8");
renameSync(TEMP_PATH, OUTPUT_PATH);
```

The generated source must start with a “generated file, do not edit” comment and export `CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES` using `satisfies readonly CertifiedTrafficEscapePuzzle[]`.

- [ ] **Step 5: Add the dependency-free TypeScript runner**

Create a Bash wrapper that compiles only the generator dependency graph into a `mktemp -d` directory, runs the compiled CLI, and removes the directory through `trap`. Add:

```json
"traffic-escape:puzzles": "bash scripts/generate-traffic-escape-hard-puzzles.sh"
```

to `package.json` scripts.

- [ ] **Step 6: Run generator tests and create the bank**

Run: `npm test -- --runInBand tests/unit/trafficEscapePuzzleGenerator.test.ts tests/unit/trafficEscapePuzzleQuality.test.ts`

Expected: PASS.

Run: `npm run traffic-escape:puzzles`

Expected: writes exactly 36 certified puzzles to `src/pages/traffic-escape/hardPuzzles.generated.ts` and prints the accepted seed range and metric ranges.

- [ ] **Step 7: Verify deterministic output**

Run: `shasum -a 256 src/pages/traffic-escape/hardPuzzles.generated.ts`

Record the hash, run `npm run traffic-escape:puzzles` again, then run the same `shasum` command.

Expected: both hashes are identical and `git diff --exit-code -- src/pages/traffic-escape/hardPuzzles.generated.ts` succeeds after the second run.

- [ ] **Step 8: Commit the offline generator and generated bank**

```bash
git add package.json src/pages/traffic-escape/gameLogic.ts src/pages/traffic-escape/puzzleGenerator.ts src/pages/traffic-escape/puzzleQuality.ts src/pages/traffic-escape/hardPuzzles.generated.ts scripts/generate-traffic-escape-hard-puzzles.ts scripts/generate-traffic-escape-hard-puzzles.sh tests/unit/trafficEscapePuzzleGenerator.test.ts
git commit -m "feat: generate certified traffic escape puzzles"
```

### Task 4: Switch hard mode to the certified bank

**Files:**
- Modify: `src/pages/traffic-escape/gameLogic.ts:362-453`
- Modify: `src/pages/traffic-escape/index.tsx:45-47`
- Modify: `tests/unit/trafficEscapeGameLogic.test.ts`
- Modify: `docs/points-economy.md:88`

- [ ] **Step 1: Write failing runtime-bank tests**

```ts
import { CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES } from "../../src/pages/traffic-escape/hardPuzzles.generated";
import { certifyTrafficEscapeHardPuzzle } from "../../src/pages/traffic-escape/puzzleQuality";

test("ships 36 certified hard puzzles", () => {
  expect(CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES).toHaveLength(36);
  CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES.forEach((puzzle) => {
    expect(certifyTrafficEscapeHardPuzzle(puzzle).accepted).toBe(true);
  });
});

test("hard mode selects only certified bank entries", () => {
  for (let seed = 1; seed <= 100; seed += 1) {
    const puzzle = createTrafficEscapePuzzle("hard", seed);
    expect(CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES.some((item) => item.id === puzzle.id)).toBe(true);
    expect(puzzle.vehicles).toHaveLength(10);
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --runInBand tests/unit/trafficEscapeGameLogic.test.ts`

Expected: FAIL because hard mode still builds runtime candidates.

- [ ] **Step 3: Route hard selection to the bank**

Change `createTrafficEscapePuzzle` so hard mode selects by normalized seed index, clones every vehicle and solution move, then applies appearance assignment. Leave the normal branch on the existing runtime generator:

```ts
if (difficulty === "hard") {
  const source = CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES[
    Math.abs(seed) % CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES.length
  ];
  return {
    ...source,
    vehicles: assignTrafficVehicleAppearances(source.vehicles, createSeededRandom(seed)),
    solutionMoves: source.solutionMoves.map((move) => ({ ...move })),
  };
}
```

Remove the old hard fallback constants after no runtime or test references remain. Do not change normal puzzle generation.

- [ ] **Step 4: Align hard-mode copy and scoring time**

Change the difficulty copy to `6×6 · 十车深度车阵 · 8–12步`.

In `scoreTrafficEscapeGame`, change only hard thresholds:

```ts
const fastThreshold = params.difficulty === "hard" ? 150 : 60;
const mediumThreshold = params.difficulty === "hard" ? 210 : 100;
```

Extend score tests to prove 150 seconds receives the full speed bonus and 151–210 seconds receives the medium bonus. Keep hard base score 36, maximum 50, move bonus rules and hint penalty unchanged.

- [ ] **Step 5: Verify state-aware hints on deviations**

For every certified puzzle, apply the first optimal move and one different legal move when available. Assert that `getTrafficEscapeHint` either returns a legal move leading to a solvable state or returns `null` only when the deviated state is proven unsolvable. Assert every detailed solve stays within 30,000 visited states.

- [ ] **Step 6: Update the points economy**

Update the Traffic Escape paragraph in `docs/points-economy.md` with: 36 certified ten-car hard puzzles, 8–12 minimum route length, at least five involved vehicles, three-level dependency depth, 150/210-second speed thresholds, unchanged 50 game-score cap, unchanged 1.5x hard pet-points multiplier and unchanged 60 pet-points cap.

- [ ] **Step 7: Run focused tests**

Run: `npm test -- --runInBand tests/unit/trafficEscapeGameLogic.test.ts tests/unit/trafficEscapePuzzleQuality.test.ts tests/unit/trafficEscapePuzzleGenerator.test.ts tests/unit/trainingStorage.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit runtime integration**

```bash
git add src/pages/traffic-escape/gameLogic.ts src/pages/traffic-escape/index.tsx tests/unit/trafficEscapeGameLogic.test.ts docs/points-economy.md
git commit -m "feat: use certified traffic escape hard puzzles"
```

### Task 5: Validate package, runtime cost and device experience

**Files:**
- Verify: `src/pages/traffic-escape/hardPuzzles.generated.ts`
- Verify: `dist/pages/traffic-escape/index.*`
- Verify and adjust only from recorded device evidence: `src/pages/traffic-escape/puzzleQuality.ts`
- Verify and adjust only from recorded device evidence: `docs/points-economy.md`

- [ ] **Step 1: Run the full automated quality gate**

Run: `npm test -- --runInBand`

Expected: all suites pass.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS with zero warnings.

Run: `npm run build:weapp`

Expected: `Compiled successfully`; the known Taro `punycode` deprecation warning is non-blocking.

Run: `npm run secrets:check`

Expected: `Secret check passed`.

Run: `git diff --check`

Expected: no output and exit code 0.

- [ ] **Step 2: Inspect package impact**

Run: `wc -c src/pages/traffic-escape/hardPuzzles.generated.ts dist/pages/traffic-escape/index.js`

Expected: record both sizes in the task handoff; if the generated source exceeds 80 KB, remove redundant certification metadata from runtime output while keeping it in generator logs and tests.

- [ ] **Step 3: Check hint-search work deterministically**

Run the certified-bank Jest test with logging enabled by `TRAFFIC_ESCAPE_REPORT_METRICS=1`.

Expected: every initial state visits at most 12,000 states, every sampled deviated state stays below the solver's 30,000-state ceiling, and the report lists min/median/max visited states.

- [ ] **Step 4: Perform WeChat visual and interaction acceptance**

In WeChat Developer Tools, start at least six distinct hard puzzles and confirm each board contains ten fully visible, selectable vehicles; movements remain aligned to the 6 x 6 grid; hints remain responsive after both optimal and non-optimal moves; and completion, score, training record, share entry and gauntlet return all work.

Repeat at least three hard puzzles on a physical device. Record completion seconds and move counts. The median skilled completion time must be 120–180 seconds; do not claim this acceptance from unit tests or the simulator alone.

- [ ] **Step 5: Adjust only evidence-backed thresholds if needed**

If the device median is below 120 seconds, raise `minimumDependencyDepth` from 3 to 4 before raising vehicle count. If the median exceeds 180 seconds, reduce `minimumMoves` from 8 to 7 or increase `maximumOptimalFirstMoves` from 2 to 3, changing one threshold at a time and regenerating the complete bank after each change.

Rerun Tasks 3–5 after any threshold change.

- [ ] **Step 6: Review and commit remaining scoped changes**

Run: `git diff -- src/pages/traffic-escape scripts/generate-traffic-escape-hard-puzzles.ts scripts/generate-traffic-escape-hard-puzzles.sh tests/unit/trafficEscapeGameLogic.test.ts tests/unit/trafficEscapePuzzleQuality.test.ts tests/unit/trafficEscapePuzzleGenerator.test.ts package.json docs/points-economy.md`

Expected: only certified-puzzle generation, runtime selection, tests, copy and scoring documentation appear. Keep the unrelated untracked `output/` directory unstaged.

If Task 5 required changes, commit them:

```bash
git add src/pages/traffic-escape scripts/generate-traffic-escape-hard-puzzles.ts scripts/generate-traffic-escape-hard-puzzles.sh tests/unit/trafficEscapeGameLogic.test.ts tests/unit/trafficEscapePuzzleQuality.test.ts tests/unit/trafficEscapePuzzleGenerator.test.ts package.json docs/points-economy.md
git commit -m "test: validate certified traffic escape difficulty"
```
