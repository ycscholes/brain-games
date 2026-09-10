import type {
  TrainingDifficulty,
  TrainingGameId,
  TrainingOutcome,
  TrainingRecord,
  TrainingRewardPolicy,
} from "./types";

export interface GameSettlementInput {
  gameId: TrainingGameId;
  score: number;
  rewardScore?: number;
  difficulty?: TrainingDifficulty;
  durationSeconds?: number;
  mode?: string;
  outcome: TrainingOutcome;
  rewardPolicy?: TrainingRewardPolicy;
}

export interface GameSettlementResult {
  awardedPoints: number;
  gauntletHandled: boolean;
  record: TrainingRecord | null;
}
