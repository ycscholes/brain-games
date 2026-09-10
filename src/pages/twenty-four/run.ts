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

export interface TwentyFourRunPayload {
  difficulty: TrainingDifficulty;
  startedAt: number;
}
export interface TwentyFourRunResult {
  score: number;
  awardedPoints: number;
  durationSeconds: number;
  solvedCount: number;
  isNewBest: boolean;
}
export type TwentyFourRun = GameRun<TwentyFourRunPayload, TwentyFourRunResult>;

export function createTwentyFourRun(
  difficulty: TrainingDifficulty = "normal",
  startedAt = Date.now(),
) {
  return createGameRun("twenty-four", { difficulty, startedAt });
}
export function readTwentyFourRun(runId: string) {
  return readGameRun<TwentyFourRunPayload, TwentyFourRunResult>("twenty-four", runId);
}
export function updateTwentyFourRun(runId: string, patch: Partial<TwentyFourRunPayload>) {
  return updateGameRun<TwentyFourRunPayload>("twenty-four", runId, patch) as TwentyFourRun | null;
}
export function settleTwentyFourRun(runId: string, result: TwentyFourRunResult) {
  return settleGameRun<TwentyFourRunPayload, TwentyFourRunResult>("twenty-four", runId, result);
}
export function settleTwentyFourCompletion(
  runId: string,
  result: TwentyFourRunResult,
  input: GameSettlementInput,
) {
  const settled = settleTwentyFourRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(input);
  const updated = updateSettledGameRunResult<TwentyFourRunPayload, TwentyFourRunResult>(
    "twenty-four",
    runId,
    { awardedPoints: settlement.awardedPoints },
  );
  return { run: updated ?? settled, settlement };
}
export function abandonTwentyFourRun(
  runId: string,
  input: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<TwentyFourRunPayload>("twenty-four", runId)) return null;
  return settleGame(input);
}
