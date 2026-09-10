import type { GameSettlementInput, GameSettlementResult } from "../../domain/training/settlement";
import type { TrainingDifficulty } from "../../domain/training/types";
import { settleGame } from "../../services/gameSettlementService";
import type { HidatoClickState, HidatoPuzzle } from "./gameLogic";
import {
  abandonGameRun,
  createGameRun,
  readGameRun,
  settleGameRun,
  updateGameRun,
  updateSettledGameRunResult,
  type GameRun,
} from "../../utils/gameFlowSession";

export interface HidatoRunState {
  puzzle: HidatoPuzzle;
  clickState: HidatoClickState;
  clockStartedAt: number;
}

export interface HidatoRunPayload {
  difficulty: TrainingDifficulty;
  startedAt: number;
  state?: HidatoRunState;
}
export interface HidatoRunResult {
  score: number;
  awardedPoints: number;
  durationSeconds: number;
  moveCount: number;
  mistakeCount: number;
  hintCount: number;
  isNewBest: boolean;
}
export type HidatoRun = GameRun<HidatoRunPayload, HidatoRunResult>;

export function createHidatoRun(difficulty: TrainingDifficulty = "normal", startedAt = Date.now()) {
  return createGameRun("hidato", { difficulty, startedAt });
}
export function readHidatoRun(runId: string) {
  return readGameRun<HidatoRunPayload, HidatoRunResult>("hidato", runId);
}
export function updateHidatoRun(runId: string, patch: Partial<HidatoRunPayload>) {
  return updateGameRun<HidatoRunPayload>("hidato", runId, patch) as HidatoRun | null;
}
export function settleHidatoRun(runId: string, result: HidatoRunResult) {
  return settleGameRun<HidatoRunPayload, HidatoRunResult>("hidato", runId, result);
}
export function settleHidatoCompletion(
  runId: string,
  result: HidatoRunResult,
  input: GameSettlementInput,
) {
  const settled = settleHidatoRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(input);
  const updated = updateSettledGameRunResult<HidatoRunPayload, HidatoRunResult>("hidato", runId, {
    awardedPoints: settlement.awardedPoints,
  });
  return { run: updated ?? settled, settlement };
}
export function abandonHidatoRun(
  runId: string,
  input: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<HidatoRunPayload>("hidato", runId)) return null;
  return settleGame(input);
}
