# Dual Task Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `dual-task` from parallel quiz cards into a 60-second command-center game with a continuous calibration track plus short insert tasks.

**Architecture:** Move deterministic gameplay rules into `src/pages/dual-task/gameLogic.ts` and cover them with unit tests. Keep `src/pages/dual-task/index.tsx` responsible for timers, rendering, clicks, and existing training/pet storage calls. Replace the old mode selector with a normal/hard flow while preserving `gameId: "dual-task"` and route compatibility.

**Tech Stack:** Taro + React + TypeScript + SCSS + Jest.

---

## File Structure

- Create `src/pages/dual-task/gameLogic.ts`
  - Owns phases, difficulty settings, insert task generation, track position math, hit/miss judgment, scoring, recovery window, and result stats helpers.
- Create `tests/unit/dualTaskGameLogic.test.ts`
  - Unit tests for phase boundaries, task generation, track judgment, scoring, recovery, and target score bands.
- Modify `src/pages/dual-task/index.tsx`
  - Replace old `Mode`/`TaskPair` quiz flow with command-center session state.
  - Keep `usePageShare("pages/dual-task/index")`, best score storage, `addPointsToPet`, `getAwardedPoints`, and `recordTrainingSession`.
- Modify `src/pages/dual-task/index.scss`
  - Replace quiz-card layout with start screen, command track, insert card, bottom answer controls, feedback, and result layout.
- Modify `tests/unit/trainingStorage.test.ts`
  - Keep existing dual-task point conversion tests; add one assertion for hard conversion if not already present.

## Task 1: Logic Types and Difficulty Model

**Files:**
- Create: `src/pages/dual-task/gameLogic.ts`
- Test: `tests/unit/dualTaskGameLogic.test.ts`

- [ ] **Step 1: Write failing tests for phases and difficulty config**

Add:

```ts
import {
  DUAL_TASK_SESSION_MS,
  getDualTaskDifficultyConfig,
  getDualTaskPhase,
} from "../../src/pages/dual-task/gameLogic";

describe("dual-task command center logic", () => {
  test("maps elapsed time to command-center phases", () => {
    expect(getDualTaskPhase(0)).toBe("warmup");
    expect(getDualTaskPhase(14999)).toBe("warmup");
    expect(getDualTaskPhase(15000)).toBe("interference");
    expect(getDualTaskPhase(44999)).toBe("interference");
    expect(getDualTaskPhase(45000)).toBe("sprint");
    expect(getDualTaskPhase(DUAL_TASK_SESSION_MS)).toBe("sprint");
  });

  test("normal and hard difficulty expose bounded timing parameters", () => {
    const normal = getDualTaskDifficultyConfig("normal");
    const hard = getDualTaskDifficultyConfig("hard");

    expect(normal.rewardDifficulty).toBe("normal");
    expect(hard.rewardDifficulty).toBe("hard");
    expect(normal.insertIntervalMs.warmup.min).toBeGreaterThan(hard.insertIntervalMs.warmup.min);
    expect(normal.insertDurationMs.sprint).toBeGreaterThan(hard.insertDurationMs.sprint);
    expect(normal.targetWidth).toBeGreaterThan(hard.targetWidth);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --runInBand tests/unit/dualTaskGameLogic.test.ts
```

Expected: fail because `src/pages/dual-task/gameLogic.ts` does not exist.

- [ ] **Step 3: Implement types, constants, phase and difficulty helpers**

Create `src/pages/dual-task/gameLogic.ts`:

```ts
import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type DualTaskDifficulty = "normal" | "hard";
export type DualTaskPhase = "warmup" | "interference" | "sprint";
export type InsertTaskType = "odd-even" | "greater-than" | "color" | "direction" | "stroop";
export type InsertTaskGoal = "word" | "ink";
export type MainTrackJudgment = "hit" | "early" | "late" | "miss";
export type DualTaskFeedback = "idle" | "main-hit" | "insert-hit" | "sync-hit" | "miss" | "recovery";

export interface PhaseRange {
  min: number;
  max: number;
}

export interface DualTaskDifficultyConfig {
  difficulty: DualTaskDifficulty;
  rewardDifficulty: TrainingDifficulty;
  label: string;
  cursorCycleMs: Record<DualTaskPhase, number>;
  targetWidth: number;
  insertIntervalMs: Record<DualTaskPhase, PhaseRange>;
  insertDurationMs: Record<DualTaskPhase, number>;
  stroopChance: Record<DualTaskPhase, number>;
  recoveryMs: number;
}

export const DUAL_TASK_SESSION_MS = 60_000;
export const DUAL_TASK_WARMUP_END_MS = 15_000;
export const DUAL_TASK_INTERFERENCE_END_MS = 45_000;

export const DUAL_TASK_DIFFICULTY_CONFIG: Record<DualTaskDifficulty, DualTaskDifficultyConfig> = {
  normal: {
    difficulty: "normal",
    rewardDifficulty: "normal",
    label: "普通",
    cursorCycleMs: {
      warmup: 2600,
      interference: 2200,
      sprint: 1900,
    },
    targetWidth: 0.22,
    insertIntervalMs: {
      warmup: { min: 3800, max: 4500 },
      interference: { min: 3000, max: 3800 },
      sprint: { min: 2600, max: 3200 },
    },
    insertDurationMs: {
      warmup: 2500,
      interference: 2200,
      sprint: 2000,
    },
    stroopChance: {
      warmup: 0,
      interference: 0.18,
      sprint: 0.3,
    },
    recoveryMs: 2000,
  },
  hard: {
    difficulty: "hard",
    rewardDifficulty: "hard",
    label: "困难",
    cursorCycleMs: {
      warmup: 2200,
      interference: 1800,
      sprint: 1500,
    },
    targetWidth: 0.16,
    insertIntervalMs: {
      warmup: { min: 3000, max: 3600 },
      interference: { min: 2200, max: 3000 },
      sprint: { min: 1800, max: 2400 },
    },
    insertDurationMs: {
      warmup: 2100,
      interference: 1700,
      sprint: 1400,
    },
    stroopChance: {
      warmup: 0,
      interference: 0.35,
      sprint: 0.5,
    },
    recoveryMs: 2000,
  },
};

export function getDualTaskPhase(elapsedMs: number): DualTaskPhase {
  if (elapsedMs < DUAL_TASK_WARMUP_END_MS) return "warmup";
  if (elapsedMs < DUAL_TASK_INTERFERENCE_END_MS) return "interference";
  return "sprint";
}

export function getDualTaskDifficultyConfig(difficulty: DualTaskDifficulty) {
  return DUAL_TASK_DIFFICULTY_CONFIG[difficulty];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- --runInBand tests/unit/dualTaskGameLogic.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/dual-task/gameLogic.ts tests/unit/dualTaskGameLogic.test.ts
git commit -m "Add dual task command center logic model"
```

## Task 2: Track Position and Main-Line Judgment

**Files:**
- Modify: `src/pages/dual-task/gameLogic.ts`
- Modify: `tests/unit/dualTaskGameLogic.test.ts`

- [ ] **Step 1: Write failing tests for cursor, target and judgment**

Extend the existing top import in `tests/unit/dualTaskGameLogic.test.ts` with `getMainTrackFrame` and `judgeMainTrackTap`, then append these tests inside the existing `describe`:

```ts
test("computes cursor and centered target bounds for the main track", () => {
  const frame = getMainTrackFrame({
    difficulty: "normal",
    elapsedMs: 650,
    targetCenter: 0.5,
  });

  expect(frame.phase).toBe("warmup");
  expect(frame.cursorPosition).toBeGreaterThanOrEqual(0);
  expect(frame.cursorPosition).toBeLessThanOrEqual(1);
  expect(frame.targetStart).toBeCloseTo(0.39);
  expect(frame.targetEnd).toBeCloseTo(0.61);
});

test("judges main track taps around the target window", () => {
  expect(judgeMainTrackTap({ cursorPosition: 0.5, targetStart: 0.4, targetEnd: 0.6 })).toBe("hit");
  expect(judgeMainTrackTap({ cursorPosition: 0.3, targetStart: 0.4, targetEnd: 0.6 })).toBe("early");
  expect(judgeMainTrackTap({ cursorPosition: 0.7, targetStart: 0.4, targetEnd: 0.6 })).toBe("late");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --runInBand tests/unit/dualTaskGameLogic.test.ts
```

Expected: fail with missing `getMainTrackFrame` and `judgeMainTrackTap`.

- [ ] **Step 3: Implement track helpers**

Add to `gameLogic.ts`:

```ts
export interface MainTrackFrame {
  elapsedMs: number;
  phase: DualTaskPhase;
  cursorPosition: number;
  targetStart: number;
  targetEnd: number;
}

export function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function getMainTrackFrame(params: {
  difficulty: DualTaskDifficulty;
  elapsedMs: number;
  targetCenter: number;
}): MainTrackFrame {
  const config = getDualTaskDifficultyConfig(params.difficulty);
  const phase = getDualTaskPhase(params.elapsedMs);
  const cycleMs = config.cursorCycleMs[phase];
  const cycleProgress = (params.elapsedMs % cycleMs) / cycleMs;
  const cursorPosition = cycleProgress <= 0.5 ? cycleProgress * 2 : (1 - cycleProgress) * 2;
  const halfWidth = config.targetWidth / 2;
  const safeCenter = clampUnit(params.targetCenter);

  return {
    elapsedMs: params.elapsedMs,
    phase,
    cursorPosition: clampUnit(cursorPosition),
    targetStart: clampUnit(safeCenter - halfWidth),
    targetEnd: clampUnit(safeCenter + halfWidth),
  };
}

export function judgeMainTrackTap(params: {
  cursorPosition: number;
  targetStart: number;
  targetEnd: number;
}): MainTrackJudgment {
  if (params.cursorPosition >= params.targetStart && params.cursorPosition <= params.targetEnd) {
    return "hit";
  }

  return params.cursorPosition < params.targetStart ? "early" : "late";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- --runInBand tests/unit/dualTaskGameLogic.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/dual-task/gameLogic.ts tests/unit/dualTaskGameLogic.test.ts
git commit -m "Add dual task main track judgment"
```

## Task 3: Insert Task Generation and Answer Checking

**Files:**
- Modify: `src/pages/dual-task/gameLogic.ts`
- Modify: `tests/unit/dualTaskGameLogic.test.ts`

- [ ] **Step 1: Write failing tests for insert task generation**

Extend the existing top import with `createInsertTask` and `isInsertTaskAnswerCorrect`, then append:

```ts
test("creates answerable insert tasks for each task type", () => {
  const taskTypes = ["odd-even", "greater-than", "color", "direction", "stroop"] as const;

  taskTypes.forEach((taskType, index) => {
    const task = createInsertTask({
      type: taskType,
      seed: index + 1,
      durationMs: 2000,
      startedAtMs: 10_000,
    });

    expect(task.type).toBe(taskType);
    expect(task.prompt).toBeTruthy();
    expect(task.options.length).toBeGreaterThanOrEqual(2);
    expect(task.correctOptionIndex).toBeGreaterThanOrEqual(0);
    expect(task.correctOptionIndex).toBeLessThan(task.options.length);
    expect(isInsertTaskAnswerCorrect(task, task.correctOptionIndex)).toBe(true);
  });
});

test("stroop task declares whether player should answer word or ink", () => {
  const task = createInsertTask({
    type: "stroop",
    seed: 7,
    durationMs: 1600,
    startedAtMs: 45_000,
  });

  expect(task.goal === "word" || task.goal === "ink").toBe(true);
  expect(task.inkColor).toMatch(/^#[0-9A-F]{6}$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --runInBand tests/unit/dualTaskGameLogic.test.ts
```

Expected: fail with missing insert task functions.

- [ ] **Step 3: Implement deterministic insert tasks**

Add:

```ts
export interface InsertTask {
  id: string;
  type: InsertTaskType;
  prompt: string;
  display: string;
  options: string[];
  correctOptionIndex: number;
  startedAtMs: number;
  durationMs: number;
  goal?: InsertTaskGoal;
  inkColor?: string;
}

const COLOR_WORDS = ["红", "蓝", "黄", "绿"] as const;
const COLOR_HEX: Record<(typeof COLOR_WORDS)[number], string> = {
  红: "#FF3B30",
  蓝: "#2563EB",
  黄: "#F59E0B",
  绿: "#16A34A",
};
const DIRECTIONS = ["左", "右"] as const;

function seededInt(seed: number, min: number, max: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  const normalized = x - Math.floor(x);
  return Math.floor(normalized * (max - min + 1)) + min;
}

function pickSeeded<T>(items: readonly T[], seed: number) {
  return items[seededInt(seed, 0, items.length - 1)];
}

export function createInsertTask(params: {
  type: InsertTaskType;
  seed: number;
  durationMs: number;
  startedAtMs: number;
}): InsertTask {
  const id = `insert-${params.type}-${params.startedAtMs}-${params.seed}`;

  if (params.type === "odd-even") {
    const value = seededInt(params.seed, 10, 99);
    return {
      id,
      type: params.type,
      prompt: "判断奇偶",
      display: `${value}`,
      options: ["奇", "偶"],
      correctOptionIndex: value % 2 === 0 ? 1 : 0,
      startedAtMs: params.startedAtMs,
      durationMs: params.durationMs,
    };
  }

  if (params.type === "greater-than") {
    const value = seededInt(params.seed, 20, 80);
    return {
      id,
      type: params.type,
      prompt: "是否大于 50",
      display: `${value}`,
      options: ["是", "否"],
      correctOptionIndex: value > 50 ? 0 : 1,
      startedAtMs: params.startedAtMs,
      durationMs: params.durationMs,
    };
  }

  if (params.type === "color") {
    const color = pickSeeded(COLOR_WORDS, params.seed);
    return {
      id,
      type: params.type,
      prompt: "选择颜色",
      display: "●",
      options: [...COLOR_WORDS],
      correctOptionIndex: COLOR_WORDS.indexOf(color),
      startedAtMs: params.startedAtMs,
      durationMs: params.durationMs,
      inkColor: COLOR_HEX[color],
    };
  }

  if (params.type === "direction") {
    const direction = pickSeeded(DIRECTIONS, params.seed);
    return {
      id,
      type: params.type,
      prompt: "选择方向",
      display: direction === "左" ? "←" : "→",
      options: [...DIRECTIONS],
      correctOptionIndex: DIRECTIONS.indexOf(direction),
      startedAtMs: params.startedAtMs,
      durationMs: params.durationMs,
    };
  }

  const word = pickSeeded(COLOR_WORDS, params.seed);
  let ink = pickSeeded(COLOR_WORDS, params.seed + 3);
  if (ink === word) {
    ink = COLOR_WORDS[(COLOR_WORDS.indexOf(ink) + 1) % COLOR_WORDS.length];
  }
  const goal: InsertTaskGoal = params.seed % 2 === 0 ? "word" : "ink";
  const correctWord = goal === "word" ? word : ink;

  return {
    id,
    type: "stroop",
    prompt: goal === "word" ? "按字义" : "按字色",
    display: word,
    options: [...COLOR_WORDS],
    correctOptionIndex: COLOR_WORDS.indexOf(correctWord),
    startedAtMs: params.startedAtMs,
    durationMs: params.durationMs,
    goal,
    inkColor: COLOR_HEX[ink],
  };
}

export function isInsertTaskAnswerCorrect(task: InsertTask, optionIndex: number) {
  return optionIndex === task.correctOptionIndex;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- --runInBand tests/unit/dualTaskGameLogic.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/dual-task/gameLogic.ts tests/unit/dualTaskGameLogic.test.ts
git commit -m "Add dual task insert task generation"
```

## Task 4: Scoring, Sync Bonus, Recovery, and Score Bands

**Files:**
- Modify: `src/pages/dual-task/gameLogic.ts`
- Modify: `tests/unit/dualTaskGameLogic.test.ts`

- [ ] **Step 1: Write failing tests for scoring**

Extend the existing top import with `applyDualTaskEvent`, `createInitialDualTaskStats`, and `shouldEnterRecovery`, then append:

```ts
test("scores main hits, insert hits, sync bonus and streak bonus", () => {
  let stats = createInitialDualTaskStats();

  stats = applyDualTaskEvent(stats, { type: "main-hit", insertWindowId: "a" });
  expect(stats.score).toBe(1);
  expect(stats.streak).toBe(1);

  stats = applyDualTaskEvent(stats, { type: "insert-hit", insertWindowId: "a" });
  expect(stats.score).toBe(4);
  expect(stats.syncCount).toBe(1);
  expect(stats.streak).toBe(2);

  stats = applyDualTaskEvent(stats, { type: "main-hit", insertWindowId: "b" });
  stats = applyDualTaskEvent(stats, { type: "main-hit", insertWindowId: "c" });
  stats = applyDualTaskEvent(stats, { type: "main-hit", insertWindowId: "d" });
  expect(stats.score).toBe(8);
  expect(stats.bestStreak).toBe(5);
});

test("misses reset streak and three consecutive misses enter recovery", () => {
  let stats = createInitialDualTaskStats();
  stats = applyDualTaskEvent(stats, { type: "miss" });
  stats = applyDualTaskEvent(stats, { type: "miss" });
  expect(shouldEnterRecovery(stats)).toBe(false);
  stats = applyDualTaskEvent(stats, { type: "miss" });
  expect(stats.streak).toBe(0);
  expect(shouldEnterRecovery(stats)).toBe(true);
});

test("typical strong play lands inside target score bands", () => {
  let normal = createInitialDualTaskStats();
  for (let i = 0; i < 8; i += 1) {
    normal = applyDualTaskEvent(normal, { type: "main-hit", insertWindowId: `n${i}` });
    normal = applyDualTaskEvent(normal, { type: "insert-hit", insertWindowId: `n${i}` });
  }

  let hard = createInitialDualTaskStats();
  for (let i = 0; i < 10; i += 1) {
    hard = applyDualTaskEvent(hard, { type: "main-hit", insertWindowId: `h${i}` });
    hard = applyDualTaskEvent(hard, { type: "insert-hit", insertWindowId: `h${i}` });
  }

  expect(normal.score).toBeGreaterThanOrEqual(20);
  expect(normal.score).toBeLessThanOrEqual(40);
  expect(hard.score).toBeGreaterThanOrEqual(30);
  expect(hard.score).toBeLessThanOrEqual(45);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --runInBand tests/unit/dualTaskGameLogic.test.ts
```

Expected: fail with missing scoring helpers.

- [ ] **Step 3: Implement scoring helpers**

Add:

```ts
export interface DualTaskStats {
  score: number;
  streak: number;
  bestStreak: number;
  mainHits: number;
  mainMisses: number;
  insertHits: number;
  insertMisses: number;
  syncCount: number;
  consecutiveErrors: number;
  completedInsertWindowIds: string[];
  mainHitWindowIds: string[];
  insertHitWindowIds: string[];
}

export type DualTaskScoreEvent =
  | { type: "main-hit"; insertWindowId?: string }
  | { type: "insert-hit"; insertWindowId?: string }
  | { type: "miss" };

export function createInitialDualTaskStats(): DualTaskStats {
  return {
    score: 0,
    streak: 0,
    bestStreak: 0,
    mainHits: 0,
    mainMisses: 0,
    insertHits: 0,
    insertMisses: 0,
    syncCount: 0,
    consecutiveErrors: 0,
    completedInsertWindowIds: [],
    mainHitWindowIds: [],
    insertHitWindowIds: [],
  };
}

function addStreakBonus(score: number, nextStreak: number) {
  return nextStreak > 0 && nextStreak % 5 === 0 ? score + 1 : score;
}

export function applyDualTaskEvent(stats: DualTaskStats, event: DualTaskScoreEvent): DualTaskStats {
  if (event.type === "miss") {
    return {
      ...stats,
      streak: 0,
      mainMisses: stats.mainMisses + 1,
      consecutiveErrors: stats.consecutiveErrors + 1,
    };
  }

  const nextStreak = stats.streak + 1;
  const baseScore = event.type === "main-hit" ? 1 : 2;
  const mainHitWindowIds = event.type === "main-hit" && event.insertWindowId
    ? [...stats.mainHitWindowIds, event.insertWindowId]
    : stats.mainHitWindowIds;
  const insertHitWindowIds = event.type === "insert-hit" && event.insertWindowId
    ? [...stats.insertHitWindowIds, event.insertWindowId]
    : stats.insertHitWindowIds;
  const syncWindowId = event.insertWindowId &&
    mainHitWindowIds.includes(event.insertWindowId) &&
    insertHitWindowIds.includes(event.insertWindowId) &&
    !stats.completedInsertWindowIds.includes(event.insertWindowId)
    ? event.insertWindowId
    : null;
  const syncBonus = syncWindowId ? 1 : 0;
  const scoreWithBase = stats.score + baseScore + syncBonus;

  return {
    ...stats,
    score: addStreakBonus(scoreWithBase, nextStreak),
    streak: nextStreak,
    bestStreak: Math.max(stats.bestStreak, nextStreak),
    mainHits: stats.mainHits + (event.type === "main-hit" ? 1 : 0),
    insertHits: stats.insertHits + (event.type === "insert-hit" ? 1 : 0),
    syncCount: stats.syncCount + (syncWindowId ? 1 : 0),
    consecutiveErrors: 0,
    completedInsertWindowIds: syncWindowId
      ? [...stats.completedInsertWindowIds, syncWindowId]
      : stats.completedInsertWindowIds,
    mainHitWindowIds,
    insertHitWindowIds,
  };
}

export function shouldEnterRecovery(stats: Pick<DualTaskStats, "consecutiveErrors">) {
  return stats.consecutiveErrors >= 3;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- --runInBand tests/unit/dualTaskGameLogic.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/dual-task/gameLogic.ts tests/unit/dualTaskGameLogic.test.ts
git commit -m "Add dual task command scoring"
```

## Task 5: Replace Page State with Command-Center Flow

**Files:**
- Modify: `src/pages/dual-task/index.tsx`

- [ ] **Step 1: Replace imports and local mode/difficulty types**

In `src/pages/dual-task/index.tsx`, remove old local `Mode`, `Difficulty`, `Task`, `TaskPair`, task factories, `MODE_CONFIG`, `DIFFICULTY_CONFIG`, and old constants. Add:

```ts
import {
  DUAL_TASK_SESSION_MS,
  applyDualTaskEvent,
  createInitialDualTaskStats,
  createInsertTask,
  getDualTaskDifficultyConfig,
  getMainTrackFrame,
  isInsertTaskAnswerCorrect,
  judgeMainTrackTap,
  shouldEnterRecovery,
  type DualTaskDifficulty,
  type DualTaskFeedback,
  type DualTaskStats,
  type InsertTask,
  type MainTrackFrame,
} from "./gameLogic";
```

- [ ] **Step 2: Replace component state**

Use this state block inside `DualTaskGame`:

```ts
const [gameStatus, setGameStatus] = useState<GameStatus>("start");
const [difficulty, setDifficulty] = useState<DualTaskDifficulty>("normal");
const [bestScore, setBestScore] = useState(0);
const [stats, setStats] = useState<DualTaskStats>(() => createInitialDualTaskStats());
const [frame, setFrame] = useState<MainTrackFrame>(() =>
  getMainTrackFrame({ difficulty: "normal", elapsedMs: 0, targetCenter: 0.5 }),
);
const [sessionTimeLeftMs, setSessionTimeLeftMs] = useState(DUAL_TASK_SESSION_MS);
const [activeInsertTask, setActiveInsertTask] = useState<InsertTask | null>(null);
const [answeredInsertTaskIds, setAnsweredInsertTaskIds] = useState<string[]>([]);
const [feedback, setFeedback] = useState<DualTaskFeedback>("idle");
const [targetCenter, setTargetCenter] = useState(0.5);
const [nextInsertAtMs, setNextInsertAtMs] = useState(3500);
const [recoveryUntilMs, setRecoveryUntilMs] = useState(0);
const startedAtRef = useRef(0);
const tickerRef = useRef<NodeJS.Timeout | null>(null);
const statsRef = useRef(stats);
```

- [ ] **Step 3: Add storage and scheduling helpers**

Add:

```ts
function getStorageKey() {
  return "dual_task_best_command-center";
}

function pickNextTargetCenter(seed: number) {
  const centers = [0.28, 0.38, 0.5, 0.62, 0.72];
  return centers[seed % centers.length];
}

function pickInsertType(elapsedMs: number, seed: number, stroopChance: number) {
  const phase = elapsedMs < 15_000 ? "warmup" : elapsedMs < 45_000 ? "interference" : "sprint";
  const baseTypes = phase === "warmup"
    ? ["odd-even", "greater-than", "color"]
    : ["odd-even", "greater-than", "color", "direction"];
  const roll = (seed % 100) / 100;
  if (roll < stroopChance) return "stroop";
  return baseTypes[seed % baseTypes.length] as InsertTask["type"];
}

function getNextInsertDelay(config: ReturnType<typeof getDualTaskDifficultyConfig>, elapsedMs: number, seed: number) {
  const phase = elapsedMs < 15_000 ? "warmup" : elapsedMs < 45_000 ? "interference" : "sprint";
  const range = config.insertIntervalMs[phase];
  return range.min + ((seed * 379) % (range.max - range.min + 1));
}
```

- [ ] **Step 4: Implement start/finish/ticker flow**

Use existing `addPointsToPet`, `getAwardedPoints`, and `recordTrainingSession`. Replace old `startGame`, `finishGame`, and timer effects with:

```ts
const difficultyConfig = getDualTaskDifficultyConfig(difficulty);

useEffect(() => {
  statsRef.current = stats;
}, [stats]);

const loadBestScore = useCallback(() => {
  const cached = Taro.getStorageSync(getStorageKey());
  setBestScore(cached ? Number(cached) : 0);
}, []);

const clearTicker = () => {
  if (tickerRef.current) {
    clearInterval(tickerRef.current);
    tickerRef.current = null;
  }
};

const finishGame = useCallback((finalStats?: DualTaskStats) => {
  clearTicker();
  const settledStats = finalStats ?? statsRef.current;
  const finalScore = Math.max(0, Math.round(settledStats.score));
  const awardedPoints = getAwardedPoints("dual-task", finalScore, difficultyConfig.rewardDifficulty);
  const durationSeconds = Math.max(1, Math.round((DUAL_TASK_SESSION_MS - sessionTimeLeftMs) / 1000));

  Taro.setStorageSync("dual_task_last_command-center", finalScore);
  addPointsToPet("dual-task", finalScore, difficultyConfig.rewardDifficulty);
  recordTrainingSession({
    gameId: "dual-task",
    score: finalScore,
    awardedPoints,
    mode: "command-center",
    difficulty: difficultyConfig.rewardDifficulty,
    durationSeconds,
    outcome: "completed",
  });

  const key = getStorageKey();
  const currentBest = Number(Taro.getStorageSync(key) || 0);
  if (finalScore > currentBest) {
    Taro.setStorageSync(key, finalScore);
    setBestScore(finalScore);
  } else {
    setBestScore(currentBest);
  }
  setGameStatus("finished");
}, [difficultyConfig.rewardDifficulty, sessionTimeLeftMs]);

const startGame = () => {
  clearTicker();
  const initialStats = createInitialDualTaskStats();
  const now = Date.now();
  startedAtRef.current = now;
  statsRef.current = initialStats;
  setStats(initialStats);
  setGameStatus("playing");
  setSessionTimeLeftMs(DUAL_TASK_SESSION_MS);
  setActiveInsertTask(null);
  setAnsweredInsertTaskIds([]);
  setFeedback("idle");
  setTargetCenter(0.5);
  setNextInsertAtMs(3200);
  setRecoveryUntilMs(0);
};

useEffect(() => {
  if (gameStatus !== "playing") return undefined;

  clearTicker();
  tickerRef.current = setInterval(() => {
    const elapsedMs = Date.now() - startedAtRef.current;
    const remainingMs = Math.max(0, DUAL_TASK_SESSION_MS - elapsedMs);
    const config = getDualTaskDifficultyConfig(difficulty);
    const nextFrame = getMainTrackFrame({ difficulty, elapsedMs, targetCenter });

    setFrame(nextFrame);
    setSessionTimeLeftMs(remainingMs);

    if (remainingMs <= 0) {
      finishGame(statsRef.current);
      return;
    }

    setActiveInsertTask((current) => {
      if (current && elapsedMs > current.startedAtMs + current.durationMs) {
        if (!answeredInsertTaskIds.includes(current.id)) {
          const nextStats = applyDualTaskEvent(statsRef.current, { type: "miss" });
          statsRef.current = nextStats;
          setStats(nextStats);
          setFeedback(shouldEnterRecovery(nextStats) ? "recovery" : "miss");
        }
        return null;
      }

      if (!current && elapsedMs >= nextInsertAtMs && elapsedMs >= recoveryUntilMs) {
        const phase = nextFrame.phase;
        const seed = Math.floor(elapsedMs / 100);
        const nextTask = createInsertTask({
          type: pickInsertType(elapsedMs, seed, config.stroopChance[phase]),
          seed,
          durationMs: config.insertDurationMs[phase],
          startedAtMs: elapsedMs,
        });
        setNextInsertAtMs(elapsedMs + getNextInsertDelay(config, elapsedMs, seed));
        return nextTask;
      }

      return current;
    });
  }, 80);

  return clearTicker;
}, [answeredInsertTaskIds, difficulty, finishGame, gameStatus, nextInsertAtMs, recoveryUntilMs, targetCenter]);
```

- [ ] **Step 5: Implement click handlers**

Add:

```ts
const handleMainTap = () => {
  if (gameStatus !== "playing") return;
  const judgment = judgeMainTrackTap(frame);

  if (judgment === "hit") {
    const nextStats = applyDualTaskEvent(statsRef.current, {
      type: "main-hit",
      insertWindowId: activeInsertTask?.id,
    });
    statsRef.current = nextStats;
    setStats(nextStats);
    setFeedback(activeInsertTask && nextStats.completedInsertWindowIds.includes(activeInsertTask.id) ? "sync-hit" : "main-hit");
    setTargetCenter(pickNextTargetCenter(nextStats.mainHits + nextStats.insertHits));
    return;
  }

  const nextStats = applyDualTaskEvent(statsRef.current, { type: "miss" });
  statsRef.current = nextStats;
  setStats(nextStats);
  setFeedback(shouldEnterRecovery(nextStats) ? "recovery" : "miss");
  if (shouldEnterRecovery(nextStats)) {
    setRecoveryUntilMs(Date.now() - startedAtRef.current + difficultyConfig.recoveryMs);
  }
};

const handleInsertAnswer = (optionIndex: number) => {
  if (gameStatus !== "playing" || !activeInsertTask || answeredInsertTaskIds.includes(activeInsertTask.id)) return;
  setAnsweredInsertTaskIds((prev) => [...prev, activeInsertTask.id]);

  if (isInsertTaskAnswerCorrect(activeInsertTask, optionIndex)) {
    const nextStats = applyDualTaskEvent(statsRef.current, {
      type: "insert-hit",
      insertWindowId: activeInsertTask.id,
    });
    statsRef.current = nextStats;
    setStats(nextStats);
    setFeedback(nextStats.completedInsertWindowIds.includes(activeInsertTask.id) ? "sync-hit" : "insert-hit");
    setActiveInsertTask(null);
    return;
  }

  const nextStats = applyDualTaskEvent(statsRef.current, { type: "miss" });
  statsRef.current = nextStats;
  setStats(nextStats);
  setFeedback(shouldEnterRecovery(nextStats) ? "recovery" : "miss");
  setActiveInsertTask(null);
};
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: TypeScript errors about render JSX still referencing old variables. They will be fixed in Task 6.

- [ ] **Step 7: Commit only if typecheck already passes**

If Task 5 is implemented together with Task 6, commit there instead. If it passes now:

```bash
git add src/pages/dual-task/index.tsx
git commit -m "Wire dual task command center state"
```

## Task 6: Replace Dual Task JSX

**Files:**
- Modify: `src/pages/dual-task/index.tsx`

- [ ] **Step 1: Replace `return` JSX with command-center screens**

Use this structure:

```tsx
return (
  <View className="dual-task-page">
    {gameStatus === "start" ? (
      <View className="start-screen">
        <View className="hero-card">
          <Text className="hero-kicker">双线专注训练</Text>
          <Text className="hero-title">多任务处理</Text>
          <Text className="hero-subtitle">稳定主线，同时处理插入指令。</Text>
          <View className="best-chip">
            <Text className="best-chip-text">双线指挥台最高分: {bestScore}</Text>
          </View>
        </View>

        <View className="panel-grid">
          <View className="panel panel-primary">
            <Text className="panel-title">难度</Text>
            <View className="chip-row">
              {(["normal", "hard"] satisfies DualTaskDifficulty[]).map((item) => {
                const config = getDualTaskDifficultyConfig(item);
                return (
                  <View
                    key={item}
                    className={`chip ${difficulty === item ? "chip-active" : ""}`}
                    onClick={() => setDifficulty(item)}
                  >
                    <Text className="chip-text">{config.label}</Text>
                    <Text className="chip-meta">
                      {config.rewardDifficulty === "hard" ? "节奏更紧 · 困难积分" : "节奏舒缓 · 普通积分"}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text className="panel-hint">盯住轨道校准，同时处理上方弹出的短指令。</Text>
          </View>
        </View>

        <View className="floating-start-action">
          <View className="primary-button" onClick={startGame}>
            <Text className="button-text">开始挑战</Text>
          </View>
        </View>
        <View className="floating-start-spacer" />
      </View>
    ) : null}

    {gameStatus === "playing" ? (
      <View className="game-screen">
        <View className="command-header">
          <View className="stat-cell">
            <Text className="stat-label">剩余</Text>
            <Text className="stat-value">{Math.ceil(sessionTimeLeftMs / 1000)}s</Text>
          </View>
          <View className="stat-cell">
            <Text className="stat-label">得分</Text>
            <Text className="stat-value">{stats.score}</Text>
          </View>
          <View className="stat-cell">
            <Text className="stat-label">连击</Text>
            <Text className="stat-value">x{stats.streak}</Text>
          </View>
        </View>

        <View className={`insert-card ${activeInsertTask ? "insert-card-active" : ""}`}>
          {activeInsertTask ? (
            <>
              <Text className="insert-prompt">{activeInsertTask.prompt}</Text>
              <Text className="insert-display" style={activeInsertTask.inkColor ? { color: activeInsertTask.inkColor } : {}}>
                {activeInsertTask.display}
              </Text>
            </>
          ) : (
            <>
              <Text className="insert-prompt">保持主线</Text>
              <Text className="insert-display">校准</Text>
            </>
          )}
        </View>

        <View className={`command-feedback command-feedback-${feedback}`}>
          <Text className="command-feedback-text">
            {feedback === "sync-hit"
              ? "同步命中 +1"
              : feedback === "main-hit"
                ? "主线命中"
                : feedback === "insert-hit"
                  ? "指令正确"
                  : feedback === "recovery"
                    ? "恢复节奏"
                    : feedback === "miss"
                      ? "节奏中断"
                      : "等待窗口"}
          </Text>
        </View>

        <View className="command-track" onClick={handleMainTap}>
          <View className="target-zone" style={{ left: `${frame.targetStart * 100}%`, width: `${(frame.targetEnd - frame.targetStart) * 100}%` }} />
          <View className="cursor-dot" style={{ left: `${frame.cursorPosition * 100}%` }} />
        </View>

        <View className="calibrate-button" onClick={handleMainTap}>
          <Text className="calibrate-button-text">校准</Text>
        </View>

        <View className="insert-options">
          {(activeInsertTask?.options ?? ["奇", "偶"]).map((option, index) => (
            <View
              key={`${activeInsertTask?.id ?? "idle"}-${option}-${index}`}
              className={`insert-option ${activeInsertTask ? "" : "insert-option-disabled"}`}
              onClick={() => handleInsertAnswer(index)}
            >
              <Text className="insert-option-text">{option}</Text>
            </View>
          ))}
        </View>
      </View>
    ) : null}

    {gameStatus === "finished" ? (
      <View className="result-screen">
        <View className="result-card">
          <Text className="result-title">本局成绩</Text>
          <Text className="result-score">{stats.score}</Text>
          <Text className="result-desc">
            主线 {stats.mainHits} 次 · 插入 {stats.insertHits} 次 · 同步 {stats.syncCount} 次
          </Text>
          <Text className="result-desc">最高连击 {stats.bestStreak}</Text>
          <Text className="result-desc">
            获得 {getAwardedPoints("dual-task", stats.score, difficultyConfig.rewardDifficulty)} 积分
          </Text>
          <Text className="result-desc">历史最高 {bestScore}</Text>
        </View>

        <View className="result-actions">
          <View className="primary-button" onClick={startGame}>
            <Text className="button-text">再来一局</Text>
          </View>
          <View className="secondary-button" onClick={() => setGameStatus("start")}>
            <Text className="button-text">返回设置</Text>
          </View>
          <View className="secondary-button" onClick={() => Taro.reLaunch({ url: "/pages/index/index" })}>
            <Text className="button-text">返回游戏主页</Text>
          </View>
        </View>
      </View>
    ) : null}
  </View>
);
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: pass. If it fails, remove remaining references to old `config.mode`, `pair`, `renderTask`, `MODE_CONFIG`, and old `DIFFICULTY_CONFIG`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/dual-task/index.tsx
git commit -m "Replace dual task page with command center"
```

## Task 7: Replace Dual Task Styles

**Files:**
- Modify: `src/pages/dual-task/index.scss`

- [ ] **Step 1: Replace old quiz-specific styles**

Keep existing base variables if desired, but add/replace these command-center classes:

```scss
.command-header {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.insert-card {
  min-height: 168px;
  padding: 24px;
  border-radius: 24px;
  background: #ffffff;
  border: 2px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
}

.insert-card-active {
  border-color: #8b5cf6;
  background: #f5f3ff;
}

.insert-prompt {
  display: block;
  font-size: 24px;
  line-height: 1.2;
  font-weight: 800;
  color: #475569;
}

.insert-display {
  display: block;
  margin-top: 14px;
  font-size: 72px;
  line-height: 1;
  font-weight: 900;
  color: #1e293b;
}

.command-feedback {
  min-height: 56px;
  margin: 14px 0;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eef2ff;
}

.command-feedback-text {
  font-size: 24px;
  line-height: 1.2;
  font-weight: 900;
  color: #4338ca;
}

.command-feedback-sync-hit {
  background: #dcfce7;
}

.command-feedback-miss,
.command-feedback-recovery {
  background: #fee2e2;
}

.command-track {
  position: relative;
  height: 112px;
  margin: 10px 0 18px;
  border-radius: 999px;
  background: linear-gradient(90deg, #e2e8f0, #f8fafc, #e2e8f0);
  border: 2px solid #cbd5e1;
  overflow: hidden;
}

.target-zone {
  position: absolute;
  top: 14px;
  bottom: 14px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.24);
  border: 2px solid rgba(34, 197, 94, 0.7);
}

.cursor-dot {
  position: absolute;
  top: 50%;
  width: 48px;
  height: 48px;
  margin-left: -24px;
  margin-top: -24px;
  border-radius: 50%;
  background: #8b5cf6;
  box-shadow: 0 0 24px rgba(139, 92, 246, 0.42);
}

.calibrate-button {
  min-height: 84px;
  border-radius: 24px;
  background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 14px 28px rgba(124, 58, 237, 0.25);
}

.calibrate-button-text {
  font-size: 34px;
  line-height: 1.2;
  font-weight: 900;
  color: #ffffff;
}

.insert-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.insert-option {
  min-height: 76px;
  border-radius: 20px;
  background: #ffffff;
  border: 2px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.insert-option-disabled {
  opacity: 0.46;
}

.insert-option-text {
  font-size: 28px;
  line-height: 1.2;
  font-weight: 900;
  color: #1e293b;
}
```

- [ ] **Step 2: Search for stale class names**

Run:

```bash
rg -n "task-card|task-stack|battle-header|mode-pill|option-btn|task-question" src/pages/dual-task
```

Expected: no output, or only old styles that should be deleted from `index.scss`.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/dual-task/index.scss
git commit -m "Style dual task command center"
```

## Task 8: Training Storage Regression

**Files:**
- Modify: `tests/unit/trainingStorage.test.ts`

- [ ] **Step 1: Add dual-task hard point assertions if missing**

In the existing `dual-task: capped score maps directly to points` test, ensure it contains:

```ts
expect(getAwardedPoints("dual-task", 30, "hard")).toBe(45);
expect(getAwardedPoints("dual-task", 50, "hard")).toBe(60);
```

- [ ] **Step 2: Run storage test**

Run:

```bash
npm test -- --runInBand tests/unit/trainingStorage.test.ts
```

Expected: pass.

- [ ] **Step 3: Commit if the file changed**

```bash
git add tests/unit/trainingStorage.test.ts
git commit -m "Cover dual task hard point rewards"
```

If the assertions were already present, do not commit.

## Task 9: Final Verification

**Files:**
- Verify all files changed in this plan.

- [ ] **Step 1: Run focused logic tests**

Run:

```bash
npm test -- --runInBand tests/unit/dualTaskGameLogic.test.ts
```

Expected: pass.

- [ ] **Step 2: Run storage regression**

Run:

```bash
npm test -- --runInBand tests/unit/trainingStorage.test.ts
```

Expected: pass.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: pass.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: pass.

- [ ] **Step 5: Inspect final diff scope**

Run:

```bash
git status --short
git diff --name-only HEAD
```

Expected changed files are limited to:

```text
src/pages/dual-task/gameLogic.ts
src/pages/dual-task/index.tsx
src/pages/dual-task/index.scss
tests/unit/dualTaskGameLogic.test.ts
tests/unit/trainingStorage.test.ts
```

Pre-existing unrelated pet/assets/mental-math worktree changes must remain unstaged.

- [ ] **Step 6: Final commit if needed**

If any verified task changes remain uncommitted:

```bash
git add src/pages/dual-task/gameLogic.ts src/pages/dual-task/index.tsx src/pages/dual-task/index.scss tests/unit/dualTaskGameLogic.test.ts tests/unit/trainingStorage.test.ts
git commit -m "Refactor dual task into command center"
```

## Self-Review

- Spec coverage: The plan covers command-center core loop, normal/hard difficulties, 60-second phases, main track, insert tasks, Stroop as interference, sync bonus, recovery, preserved `gameId`, points pipeline, UI structure, tests, and migration scope.
- Placeholder scan: No placeholder or open-ended implementation instructions remain.
- Type consistency: `DualTaskDifficulty`, `DualTaskPhase`, `InsertTask`, `MainTrackFrame`, `DualTaskStats`, and helper names are introduced before use and reused consistently.
