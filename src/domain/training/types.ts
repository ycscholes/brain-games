export type TrainingGameId =
  | "memory-challenge"
  | "rock-paper-scissors"
  | "mental-math"
  | "twenty-four"
  | "digit-span"
  | "multiple-object-tracking"
  | "pattern-completion"
  | "number-order"
  | "head-count"
  | "word-scramble"
  | "bird-count"
  | "color-trap"
  | "spatial-rotation"
  | "hidato"
  | "tents-camp"
  | "sumplete-grid"
  | "traffic-escape"
  | "music-theory"
  | "netwalk"
  | "loop-line"
  | "game-gauntlet"
  | "memory"
  | "rps"
  | "mot"
  | "pattern";

export type TrainingOutcome = "completed" | "interrupted";
export type TrainingDifficulty = "normal" | "hard";

export interface TrainingRewardPolicy {
  applyDifficultyMultiplier?: boolean;
  maxPoints?: number;
}

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
  musicEnabled: boolean;
  vibrationEnabled: boolean;
  reducedMotion: boolean;
  onboardingCompleted: boolean;
  privacyAccepted: boolean;
  recommendationSessionCount: number;
  updatedAt: string;
}
