import type { GameSettlementInput, GameSettlementResult } from "../../domain/training/settlement";
import type { TrainingDifficulty } from "../../domain/training/types";
import { settleGame } from "../../services/gameSettlementService";
import {
  abandonGameRun,
  createGameRun,
  readGameRun,
  settleGameRun,
  updateGameRun,
  updateSettledGameRunResult,
  type GameRun,
} from "../../utils/gameFlowSession";

export interface TentsCampRunPayload {
  difficulty: TrainingDifficulty;
  startedAt: number;
}
export interface TentsCampRunResult {
  score: number;
  awardedPoints: number;
  durationSeconds: number;
  placedCount: number;
  correctPuzzles: number;
  bestCombo: number;
  isNewBest: boolean;
}
export type TentsCampRun = GameRun<TentsCampRunPayload, TentsCampRunResult>;

export function createTentsCampRun(
  difficulty: TrainingDifficulty = "normal",
  startedAt = Date.now(),
) {
  return createGameRun("tents-camp", { difficulty, startedAt });
}
export function readTentsCampRun(runId: string) {
  return readGameRun<TentsCampRunPayload, TentsCampRunResult>("tents-camp", runId);
}
export function updateTentsCampRun(runId: string, patch: Partial<TentsCampRunPayload>) {
  return updateGameRun<TentsCampRunPayload>("tents-camp", runId, patch) as TentsCampRun | null;
}
export function settleTentsCampRun(runId: string, result: TentsCampRunResult) {
  return settleGameRun<TentsCampRunPayload, TentsCampRunResult>("tents-camp", runId, result);
}
export function settleTentsCampCompletion(
  runId: string,
  result: TentsCampRunResult,
  input: GameSettlementInput,
) {
  const settled = settleTentsCampRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(input);
  const updated = updateSettledGameRunResult<TentsCampRunPayload, TentsCampRunResult>(
    "tents-camp",
    runId,
    { awardedPoints: settlement.awardedPoints },
  );
  return { run: updated ?? settled, settlement };
}
export function abandonTentsCampRun(
  runId: string,
  input: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<TentsCampRunPayload>("tents-camp", runId)) return null;
  return settleGame(input);
}
