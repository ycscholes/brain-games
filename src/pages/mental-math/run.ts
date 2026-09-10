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
import type { CustomMathConfig, MathStageId } from "./mathStages";

export interface MentalMathRunPayload {
  difficulty: TrainingDifficulty;
  mode: "timed" | "death";
  stageId: MathStageId;
  customConfig?: CustomMathConfig;
  startedAt: number;
}

export interface MentalMathRunResult {
  score: number;
  awardedPoints: number;
  durationSeconds: number;
  correctCount: number;
  isNewBest: boolean;
}

export type MentalMathRun = GameRun<MentalMathRunPayload, MentalMathRunResult>;

export function createMentalMathRun(
  payload: Omit<MentalMathRunPayload, "startedAt">,
  startedAt = Date.now(),
) {
  return createGameRun("mental-math", { ...payload, startedAt });
}

export function readMentalMathRun(runId: string) {
  return readGameRun<MentalMathRunPayload, MentalMathRunResult>("mental-math", runId);
}

export function updateMentalMathRun(runId: string, patch: Partial<MentalMathRunPayload>) {
  return updateGameRun<MentalMathRunPayload>("mental-math", runId, patch) as MentalMathRun | null;
}

export function settleMentalMathRun(runId: string, result: MentalMathRunResult) {
  return settleGameRun<MentalMathRunPayload, MentalMathRunResult>("mental-math", runId, result);
}

export function settleMentalMathCompletion(
  runId: string,
  result: MentalMathRunResult,
  settlementInput: GameSettlementInput,
) {
  const settled = settleMentalMathRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(settlementInput);
  const updated = updateSettledGameRunResult<MentalMathRunPayload, MentalMathRunResult>(
    "mental-math",
    runId,
    { awardedPoints: settlement.awardedPoints },
  );
  return { run: updated ?? settled, settlement };
}

export function abandonMentalMathRun(
  runId: string,
  settlementInput: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<MentalMathRunPayload>("mental-math", runId)) return null;
  return settleGame(settlementInput);
}
