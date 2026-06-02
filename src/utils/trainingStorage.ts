import Taro from "@tarojs/taro";
import { emitUserDataChanged } from "../services/user-data/local/changeNotifier";
import { resetCloudSyncMeta } from "./cloudSyncMeta";

export type TrainingGameId =
  | "memory-challenge"
  | "rock-paper-scissors"
  | "dual-task"
  | "mental-math"
  | "twenty-four"
  | "digit-span"
  | "multiple-object-tracking"
  | "pattern-completion"
  | "number-order"
  | "head-count"
  | "memory"
  | "rps"
  | "mot"
  | "pattern";

export type TrainingOutcome = "completed" | "interrupted";
export type TrainingDifficulty = "normal" | "hard";

export interface TrainingRecord {
  id: string;
  gameId: TrainingGameId;
  score: number;
  awardedPoints: number;
  playedAt: string;
  durationSeconds?: number;
  mode?: string;
  difficulty?: TrainingDifficulty;
  outcome: TrainingOutcome;
}

export interface TrainingSummary {
  best: number;
  recent: number;
  played: boolean;
  totalSessions: number;
  lastPlayedAt: string | null;
}

export interface DashboardStats {
  todaySessions: number;
  totalSessions: number;
  streakDays: number;
  activeDaysLast7: number;
  totalAwardedPoints: number;
}

export interface AppSettings {
  version: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  reducedMotion: boolean;
  onboardingCompleted: boolean;
  privacyAccepted: boolean;
  updatedAt: string;
}

const TRAINING_STORAGE_KEY = "training_records_v1";
const SETTINGS_STORAGE_KEY = "app_settings_v1";
const SCORING_VERSION_KEY = "scoring_version";
const MAX_RECORDS = 120;
const SETTINGS_VERSION = 1;
const SCORING_VERSION = 2;
export const MAX_POINTS_PER_SESSION = 40;
export const HARD_MAX_POINTS_PER_SESSION = 60;

export const TRAINING_DIFFICULTY_LABELS: Record<TrainingDifficulty, string> = {
  normal: "普通",
  hard: "困难",
};

const TRAINING_DIFFICULTY_MULTIPLIERS: Record<TrainingDifficulty, number> = {
  normal: 1,
  hard: 1.5,
};

const TRAINING_DIFFICULTY_POINT_CAPS: Record<TrainingDifficulty, number> = {
  normal: MAX_POINTS_PER_SESSION,
  hard: HARD_MAX_POINTS_PER_SESSION,
};

const LEGACY_KEYS = [
  "memory_last_score",
  "rps_last_score",
  "rps_streak",
  "game_streak",
  "mental_math_last_score",
  "mental_math_high_score_timed",
  "mental_math_high_score_death",
  "twenty_four_best",
  "digit_span_best",
  "mot_best",
  "pattern_completion_best",
  "pet_data",
];

function createRecordId() {
  return `training_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getTodayDateLabel(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readNumericValue(key: string) {
  const raw = Number(Taro.getStorageSync(key) || 0);
  return Number.isFinite(raw) ? raw : 0;
}

function readJsonScore(key: string) {
  const raw = Taro.getStorageSync(key);
  if (!raw) return 0;

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.score === "number" ? parsed.score : 0;
  } catch {
    return 0;
  }
}

function hasStorageValue(key: string) {
  const raw = Taro.getStorageSync(key);
  return raw !== "" && raw !== null && raw !== undefined;
}

function getDefaultSettings(): AppSettings {
  return {
    version: SETTINGS_VERSION,
    soundEnabled: true,
    vibrationEnabled: true,
    reducedMotion: false,
    onboardingCompleted: false,
    privacyAccepted: false,
    updatedAt: new Date().toISOString(),
  };
}

function readLegacySummary(gameId: TrainingGameId): TrainingSummary {
  switch (gameId) {
    case "memory": {
      let best = 0;
      let played = hasStorageValue("memory_last_score");

      for (let timeDifficulty = 1; timeDifficulty <= 4; timeDifficulty += 1) {
        for (let memoryDifficulty = 1; memoryDifficulty <= 4; memoryDifficulty += 1) {
          const key = `memory_highscore_T${timeDifficulty}M${memoryDifficulty}`;
          best = Math.max(best, readJsonScore(key));
          played = played || hasStorageValue(key);
        }
      }

      return {
        best,
        recent: readNumericValue("memory_last_score"),
        played,
        totalSessions: 0,
        lastPlayedAt: null,
      };
    }

    case "rps": {
      let best = 0;
      let played = hasStorageValue("rps_last_score");

      for (let difficulty = 1; difficulty <= 4; difficulty += 1) {
        const key = `rps_highscore_D${difficulty}`;
        best = Math.max(best, readJsonScore(key));
        played = played || hasStorageValue(key);
      }

      return {
        best,
        recent: readNumericValue("rps_last_score"),
        played,
        totalSessions: 0,
        lastPlayedAt: null,
      };
    }

    case "dual-task": {
      const modes = ["alternating", "simultaneous", "stroop"];
      let best = 0;
      let recent = 0;
      let played = false;

      modes.forEach((mode) => {
        const bestKey = `dual_task_best_${mode}`;
        const lastKey = `dual_task_last_${mode}`;
        best = Math.max(best, readNumericValue(bestKey));
        recent = Math.max(recent, readNumericValue(lastKey));
        played = played || hasStorageValue(bestKey) || hasStorageValue(lastKey);
      });

      return {
        best,
        recent,
        played,
        totalSessions: 0,
        lastPlayedAt: null,
      };
    }

    case "mental-math": {
      const best = Math.max(
        readJsonScore("mental_math_high_score_timed"),
        readJsonScore("mental_math_high_score_death"),
      );

      return {
        best,
        recent: readNumericValue("mental_math_last_score"),
        played:
          hasStorageValue("mental_math_high_score_timed") ||
          hasStorageValue("mental_math_high_score_death"),
        totalSessions: 0,
        lastPlayedAt: null,
      };
    }

    case "twenty-four":
      return {
        best: readNumericValue("twenty_four_best"),
        recent: readNumericValue("twenty_four_best"),
        played: hasStorageValue("twenty_four_best"),
        totalSessions: 0,
        lastPlayedAt: null,
      };

    case "digit-span":
      return {
        best: readNumericValue("digit_span_best"),
        recent: readNumericValue("digit_span_best"),
        played: hasStorageValue("digit_span_best"),
        totalSessions: 0,
        lastPlayedAt: null,
      };

    case "mot":
      return {
        best: readNumericValue("mot_best"),
        recent: readNumericValue("mot_best"),
        played: hasStorageValue("mot_best"),
        totalSessions: 0,
        lastPlayedAt: null,
      };

    case "pattern":
    case "pattern-completion":
      return {
        best: readNumericValue("pattern_completion_best"),
        recent: readNumericValue("pattern_completion_best"),
        played: hasStorageValue("pattern_completion_best"),
        totalSessions: 0,
        lastPlayedAt: null,
      };

    case "memory-challenge":
      return readLegacySummary("memory");
    case "rock-paper-scissors":
      return readLegacySummary("rps");
    case "multiple-object-tracking":
      return readLegacySummary("mot");

    default:
      return {
        best: 0,
        recent: 0,
        played: false,
        totalSessions: 0,
        lastPlayedAt: null,
      };
  }
}

const TRAINING_POINT_RATES: Record<string, number> = {
  "memory-challenge": 1,
  "rock-paper-scissors": 1,
  "dual-task": 1,
  "mental-math": 1,
  "twenty-four": 2,
  "digit-span": 3,
  "multiple-object-tracking": 3,
  "pattern-completion": 1.2,
  "number-order": 1,
  "head-count": 1,
  memory: 1,
  rps: 1,
  mot: 3,
  pattern: 1.2,
};

const TRAINING_GAME_ID_ALIASES: Partial<Record<TrainingGameId, TrainingGameId[]>> = {
  "memory-challenge": ["memory-challenge", "memory"],
  memory: ["memory", "memory-challenge"],
  "rock-paper-scissors": ["rock-paper-scissors", "rps"],
  rps: ["rps", "rock-paper-scissors"],
  "multiple-object-tracking": ["multiple-object-tracking", "mot"],
  mot: ["mot", "multiple-object-tracking"],
  "pattern-completion": ["pattern-completion", "pattern"],
  pattern: ["pattern", "pattern-completion"],
};

function getEquivalentTrainingGameIds(gameId: TrainingGameId): TrainingGameId[] {
  return TRAINING_GAME_ID_ALIASES[gameId] || [gameId];
}

export function normalizeTrainingDifficulty(difficulty?: string): TrainingDifficulty {
  return difficulty === "hard" ? "hard" : "normal";
}

export function getTrainingDifficultyLabel(difficulty?: string) {
  return TRAINING_DIFFICULTY_LABELS[normalizeTrainingDifficulty(difficulty)];
}

export function getAwardedPoints(gameId: string, score: number, difficulty?: TrainingDifficulty) {
  const rate = TRAINING_POINT_RATES[gameId] ?? 0;
  const safeScore = Number.isFinite(score) ? score : 0;
  const normalizedDifficulty = normalizeTrainingDifficulty(difficulty);
  const rawPoints = Math.max(
    0,
    Math.floor(safeScore * rate * TRAINING_DIFFICULTY_MULTIPLIERS[normalizedDifficulty]),
  );
  return Math.min(rawPoints, TRAINING_DIFFICULTY_POINT_CAPS[normalizedDifficulty]);
}

function runMigrationsIfNeeded() {
  const currentVersion = Number(Taro.getStorageSync(SCORING_VERSION_KEY) || 1);
  if (currentVersion >= SCORING_VERSION) return;

  if (currentVersion === 1) {
    const raw = Taro.getStorageSync(TRAINING_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const migrated = parsed.map((item) => ({
            ...item,
            score: item.awardedPoints ?? item.score,
          }));
          Taro.setStorageSync(TRAINING_STORAGE_KEY, JSON.stringify(migrated.slice(0, MAX_RECORDS)));
        }
      } catch {
        // silent fail
      }
    }
  }

  Taro.setStorageSync(SCORING_VERSION_KEY, SCORING_VERSION);
}

export function readTrainingRecords(): TrainingRecord[] {
  runMigrationsIfNeeded();
  const raw = Taro.getStorageSync(TRAINING_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is TrainingRecord => {
      return (
        typeof item?.id === "string" &&
        typeof item?.gameId === "string" &&
        typeof item?.score === "number" &&
        typeof item?.awardedPoints === "number" &&
        typeof item?.playedAt === "string" &&
        (item?.difficulty === undefined || item?.difficulty === "normal" || item?.difficulty === "hard") &&
        (item?.outcome === "completed" || item?.outcome === "interrupted")
      );
    });
  } catch {
    return [];
  }
}

export function saveTrainingRecords(
  records: TrainingRecord[],
  options?: {
    markChanged?: boolean;
  },
) {
  Taro.setStorageSync(TRAINING_STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  if (options?.markChanged !== false) {
    emitUserDataChanged();
  }
}

export function recordTrainingSession(record: Omit<TrainingRecord, "id" | "playedAt">) {
  const nextRecord: TrainingRecord = {
    ...record,
    id: createRecordId(),
    playedAt: new Date().toISOString(),
  };

  const existing = readTrainingRecords();
  saveTrainingRecords([nextRecord, ...existing]);
  return nextRecord;
}

export function readTrainingSummary(gameId: TrainingGameId): TrainingSummary {
  const gameIds = getEquivalentTrainingGameIds(gameId);
  const records = readTrainingRecords().filter((item) => gameIds.includes(item.gameId));
  const latest = records[0] ?? null;
  const best = records.reduce((max, item) => Math.max(max, item.score), 0);
  const legacy = readLegacySummary(gameId);

  return {
    best: Math.max(best, legacy.best),
    recent: latest?.score ?? legacy.recent,
    played: records.length > 0 || legacy.played,
    totalSessions: records.length,
    lastPlayedAt: latest?.playedAt ?? null,
  };
}

export function readDashboardStats(): DashboardStats {
  const records = readTrainingRecords();
  const todayLabel = getTodayDateLabel(Date.now());
  const uniqueDays = Array.from(
    new Set(records.map((item) => getTodayDateLabel(new Date(item.playedAt).getTime()))),
  );

  let streakDays = 0;
  const streakCursor = new Date();

  while (uniqueDays.includes(getTodayDateLabel(streakCursor.getTime()))) {
    streakDays += 1;
    streakCursor.setDate(streakCursor.getDate() - 1);
  }

  const recent7DayBoundary = Date.now() - 6 * 24 * 60 * 60 * 1000;
  const activeDaysLast7 = new Set(
    records
      .filter((item) => new Date(item.playedAt).getTime() >= recent7DayBoundary)
      .map((item) => getTodayDateLabel(new Date(item.playedAt).getTime())),
  ).size;

  return {
    todaySessions: records.filter((item) => getTodayDateLabel(new Date(item.playedAt).getTime()) === todayLabel)
      .length,
    totalSessions: records.length,
    streakDays,
    activeDaysLast7,
    totalAwardedPoints: records.reduce((sum, item) => sum + item.awardedPoints, 0),
  };
}

export function recommendNextGame(gameIds: TrainingGameId[]): TrainingGameId {
  const records = readTrainingRecords();
  const lastPlayedMap = new Map<TrainingGameId, number>();

  gameIds.forEach((gameId) => {
    const equivalentIds = getEquivalentTrainingGameIds(gameId);
    const latest = records.find((record) => equivalentIds.includes(record.gameId));
    if (latest) {
      lastPlayedMap.set(gameId, new Date(latest.playedAt).getTime());
    }
  });

  const neverPlayed = gameIds.find((gameId) => !lastPlayedMap.has(gameId));
  if (neverPlayed) return neverPlayed;

  return [...gameIds].sort((left, right) => {
    return (lastPlayedMap.get(left) || 0) - (lastPlayedMap.get(right) || 0);
  })[0];
}

export function readAppSettings(): AppSettings {
  const raw = Taro.getStorageSync(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return getDefaultSettings();
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      ...getDefaultSettings(),
      ...parsed,
      version: SETTINGS_VERSION,
    };
  } catch {
    return getDefaultSettings();
  }
}

export function saveAppSettings(
  settings: Partial<AppSettings> | AppSettings,
  options?: {
    markChanged?: boolean;
    replace?: boolean;
  },
) {
  const nextSettings = options?.replace
    ? {
        ...getDefaultSettings(),
        ...(settings as AppSettings),
        version: SETTINGS_VERSION,
        updatedAt: (settings as AppSettings).updatedAt || new Date().toISOString(),
      }
    : {
        ...readAppSettings(),
        ...settings,
        version: SETTINGS_VERSION,
        updatedAt: new Date().toISOString(),
      };

  Taro.setStorageSync(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  if (options?.markChanged !== false) {
    emitUserDataChanged();
  }
  return nextSettings;
}

export function clearProductData() {
  const gameSpecificKeys: string[] = [];

  for (let timeDifficulty = 1; timeDifficulty <= 4; timeDifficulty += 1) {
    for (let memoryDifficulty = 1; memoryDifficulty <= 4; memoryDifficulty += 1) {
      gameSpecificKeys.push(`memory_highscore_T${timeDifficulty}M${memoryDifficulty}`);
    }
  }

  for (let difficulty = 1; difficulty <= 4; difficulty += 1) {
    gameSpecificKeys.push(`rps_highscore_D${difficulty}`);
  }

  (["normal", "hard"] satisfies TrainingDifficulty[]).forEach((difficulty) => {
    gameSpecificKeys.push(`mental_math_high_score_timed_${difficulty}`);
    gameSpecificKeys.push(`mental_math_high_score_death_${difficulty}`);
    gameSpecificKeys.push(`twenty_four_best_${difficulty}`);
    gameSpecificKeys.push(`digit_span_best_${difficulty}`);
    gameSpecificKeys.push(`mot_best_${difficulty}`);
    gameSpecificKeys.push(`pattern_completion_best_${difficulty}`);
    gameSpecificKeys.push(`number_order_best_${difficulty}`);
    gameSpecificKeys.push(`head_count_best_${difficulty}`);

    ["slow", "standard", "fast"].forEach((speedDifficulty) => {
      gameSpecificKeys.push(`head_count_best_${difficulty}_${speedDifficulty}`);
    });
  });

  ["G1A", "G1B", "G2", "G3", "G4", "G5_6", "G2_ADD", "G2_MUL", "G3_ADD", "G4_MIXED_100", "CUSTOM"].forEach((stageId) => {
    gameSpecificKeys.push(`mental_math_high_score_timed_${stageId}`);
    gameSpecificKeys.push(`mental_math_high_score_death_${stageId}`);
  });

  ["alternating", "simultaneous", "stroop"].forEach((mode) => {
    gameSpecificKeys.push(`dual_task_best_${mode}`);
    gameSpecificKeys.push(`dual_task_last_${mode}`);
  });

  [...LEGACY_KEYS, ...gameSpecificKeys, TRAINING_STORAGE_KEY, SETTINGS_STORAGE_KEY].forEach((key) => {
    Taro.removeStorageSync(key);
  });
  resetCloudSyncMeta();
}
