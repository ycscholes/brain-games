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

export interface DigitSpanRunPayload {
  difficulty: TrainingDifficulty;
  startedAt: number;
}
export interface DigitSpanRunResult {
  score: number;
  awardedPoints: number;
  durationSeconds: number;
  maxLength: number;
  isNewBest: boolean;
}
export type DigitSpanRun = GameRun<DigitSpanRunPayload, DigitSpanRunResult>;

export function createDigitSpanRun(
  difficulty: TrainingDifficulty = "normal",
  startedAt = Date.now(),
) {
  return createGameRun("digit-span", { difficulty, startedAt });
}
export function readDigitSpanRun(runId: string) {
  return readGameRun<DigitSpanRunPayload, DigitSpanRunResult>("digit-span", runId);
}
export function updateDigitSpanRun(runId: string, patch: Partial<DigitSpanRunPayload>) {
  return updateGameRun<DigitSpanRunPayload>("digit-span", runId, patch) as DigitSpanRun | null;
}
export function settleDigitSpanRun(runId: string, result: DigitSpanRunResult) {
  return settleGameRun<DigitSpanRunPayload, DigitSpanRunResult>("digit-span", runId, result);
}
export function settleDigitSpanCompletion(
  runId: string,
  result: DigitSpanRunResult,
  input: GameSettlementInput,
) {
  const settled = settleDigitSpanRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(input);
  const updated = updateSettledGameRunResult<DigitSpanRunPayload, DigitSpanRunResult>(
    "digit-span",
    runId,
    { awardedPoints: settlement.awardedPoints },
  );
  return { run: updated ?? settled, settlement };
}
export function abandonDigitSpanRun(
  runId: string,
  input: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<DigitSpanRunPayload>("digit-span", runId)) return null;
  return settleGame(input);
}
