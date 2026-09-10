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

export interface NetwalkRunPayload {
  difficulty: TrainingDifficulty;
  startedAt: number;
}
export interface NetwalkRunResult {
  score: number;
  awardedPoints: number;
  durationSeconds: number;
  moveCount: number;
  hintCount: number;
  isNewBest: boolean;
}
export type NetwalkRun = GameRun<NetwalkRunPayload, NetwalkRunResult>;

export function createNetwalkRun(
  difficulty: TrainingDifficulty = "normal",
  startedAt = Date.now(),
) {
  return createGameRun("netwalk", { difficulty, startedAt });
}
export function readNetwalkRun(runId: string) {
  return readGameRun<NetwalkRunPayload, NetwalkRunResult>("netwalk", runId);
}
export function updateNetwalkRun(runId: string, patch: Partial<NetwalkRunPayload>) {
  return updateGameRun<NetwalkRunPayload>("netwalk", runId, patch) as NetwalkRun | null;
}
export function settleNetwalkRun(runId: string, result: NetwalkRunResult) {
  return settleGameRun<NetwalkRunPayload, NetwalkRunResult>("netwalk", runId, result);
}
export function settleNetwalkCompletion(
  runId: string,
  result: NetwalkRunResult,
  input: GameSettlementInput,
) {
  const settled = settleNetwalkRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(input);
  const updated = updateSettledGameRunResult<NetwalkRunPayload, NetwalkRunResult>(
    "netwalk",
    runId,
    { awardedPoints: settlement.awardedPoints },
  );
  return { run: updated ?? settled, settlement };
}
export function abandonNetwalkRun(
  runId: string,
  input: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<NetwalkRunPayload>("netwalk", runId)) return null;
  return settleGame(input);
}
