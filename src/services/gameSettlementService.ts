import type {
  GameSettlementInput,
  GameSettlementResult,
} from "../domain/training/settlement";
import { addPointsToPet } from "../utils/petStorage";
import {
  getAwardedPoints,
  recordTrainingSession,
} from "../utils/trainingStorage";
import { completeGauntletLegIfNeeded } from "../utils/gameGauntlet";

export function settleGame(input: GameSettlementInput): GameSettlementResult {
  const awardedPoints = getAwardedPoints(
    input.gameId,
    input.score,
    input.difficulty,
    input.rewardPolicy,
  );
  const gauntletHandled = completeGauntletLegIfNeeded({
    gameId: input.gameId,
    score: input.score,
    awardedPoints,
    difficulty: input.difficulty,
    mode: input.mode,
    outcome: input.outcome,
  });

  if (gauntletHandled) {
    return {
      awardedPoints,
      gauntletHandled: true,
      record: null,
    };
  }

  addPointsToPet(input.gameId, input.score, input.difficulty, input.rewardPolicy);
  const record = recordTrainingSession({
    gameId: input.gameId,
    score: input.score,
    awardedPoints,
    durationSeconds: input.durationSeconds,
    mode: input.mode,
    difficulty: input.difficulty,
    outcome: input.outcome,
  });

  return {
    awardedPoints,
    gauntletHandled: false,
    record,
  };
}
