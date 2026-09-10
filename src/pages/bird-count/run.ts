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

export interface BirdCountRunPayload {
  difficulty: TrainingDifficulty;
  mode: "speed" | "yard";
  yardSpeed?: "slow" | "standard" | "fast";
  startedAt: number;
}
export interface BirdCountRunResult {
  score: number;
  awardedPoints: number;
  durationSeconds: number;
  correctCount: number;
  bestCombo: number;
  isNewBest: boolean;
}
export type BirdCountRun = GameRun<BirdCountRunPayload, BirdCountRunResult>;

export function createBirdCountRun(
  payload: Omit<BirdCountRunPayload, "startedAt">,
  startedAt = Date.now(),
) {
  return createGameRun("bird-count", { ...payload, startedAt });
}
export function readBirdCountRun(runId: string) {
  return readGameRun<BirdCountRunPayload, BirdCountRunResult>("bird-count", runId);
}
export function updateBirdCountRun(runId: string, patch: Partial<BirdCountRunPayload>) {
  return updateGameRun<BirdCountRunPayload>("bird-count", runId, patch) as BirdCountRun | null;
}
export function settleBirdCountRun(runId: string, result: BirdCountRunResult) {
  return settleGameRun<BirdCountRunPayload, BirdCountRunResult>("bird-count", runId, result);
}
export function settleBirdCountCompletion(
  runId: string,
  result: BirdCountRunResult,
  input: GameSettlementInput,
) {
  const settled = settleBirdCountRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(input);
  const updated = updateSettledGameRunResult<BirdCountRunPayload, BirdCountRunResult>(
    "bird-count",
    runId,
    { awardedPoints: settlement.awardedPoints },
  );
  return { run: updated ?? settled, settlement };
}
export function abandonBirdCountRun(
  runId: string,
  input: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<BirdCountRunPayload>("bird-count", runId)) return null;
  return settleGame(input);
}
