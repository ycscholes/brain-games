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

export interface MainTrackFrame {
  elapsedMs: number;
  phase: DualTaskPhase;
  cursorPosition: number;
  targetStart: number;
  targetEnd: number;
}

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

const COLOR_WORDS = ["红", "蓝", "黄", "绿"] as const;
const COLOR_HEX: Record<(typeof COLOR_WORDS)[number], string> = {
  红: "#FF3B30",
  蓝: "#2563EB",
  黄: "#F59E0B",
  绿: "#16A34A",
};
const DIRECTIONS = ["左", "右"] as const;

export function getDualTaskPhase(elapsedMs: number): DualTaskPhase {
  if (elapsedMs < DUAL_TASK_WARMUP_END_MS) return "warmup";
  if (elapsedMs < DUAL_TASK_INTERFERENCE_END_MS) return "interference";
  return "sprint";
}

export function getDualTaskDifficultyConfig(difficulty: DualTaskDifficulty) {
  return DUAL_TASK_DIFFICULTY_CONFIG[difficulty];
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
  const mainHitWindowIds =
    event.type === "main-hit" && event.insertWindowId
      ? [...stats.mainHitWindowIds, event.insertWindowId]
      : stats.mainHitWindowIds;
  const insertHitWindowIds =
    event.type === "insert-hit" && event.insertWindowId
      ? [...stats.insertHitWindowIds, event.insertWindowId]
      : stats.insertHitWindowIds;
  const syncWindowId =
    event.insertWindowId &&
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
