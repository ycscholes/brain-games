import type { GameSettlementInput, GameSettlementResult } from "../../domain/training/settlement";
import type { TrainingDifficulty } from "../../domain/training/types";
import { settleGame } from "../../services/gameSettlementService";
import type { MemoryChallengeN } from "./gameLogic";
import {
  abandonGameRun,
  createGameRun,
  readGameRun,
  settleGameRun,
  updateGameRun,
  updateSettledGameRunResult,
  type GameRun,
} from "../../utils/gameFlowSession";

export interface MemoryChallengeRunPayload {
  difficulty: TrainingDifficulty;
  mode: "shape" | "pet" | "calculation";
  n: MemoryChallengeN;
  startedAt: number;
}
export interface MemoryChallengeRunResult {
  score: number;
  awardedPoints: number;
  durationSeconds: number;
  correctCount: number;
  level: number;
  isNewBest: boolean;
}
export type MemoryChallengeRun = GameRun<MemoryChallengeRunPayload, MemoryChallengeRunResult>;

export function createMemoryChallengeRun(
  payload: Omit<MemoryChallengeRunPayload, "startedAt">,
  startedAt = Date.now(),
) {
  return createGameRun("memory-challenge", { ...payload, startedAt });
}
export function readMemoryChallengeRun(runId: string) {
  return readGameRun<MemoryChallengeRunPayload, MemoryChallengeRunResult>(
    "memory-challenge",
    runId,
  );
}
export function updateMemoryChallengeRun(runId: string, patch: Partial<MemoryChallengeRunPayload>) {
  return updateGameRun<MemoryChallengeRunPayload>(
    "memory-challenge",
    runId,
    patch,
  ) as MemoryChallengeRun | null;
}
export function settleMemoryChallengeRun(runId: string, result: MemoryChallengeRunResult) {
  return settleGameRun<MemoryChallengeRunPayload, MemoryChallengeRunResult>(
    "memory-challenge",
    runId,
    result,
  );
}
export function settleMemoryChallengeCompletion(
  runId: string,
  result: MemoryChallengeRunResult,
  input: GameSettlementInput,
) {
  const settled = settleMemoryChallengeRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(input);
  const updated = updateSettledGameRunResult<MemoryChallengeRunPayload, MemoryChallengeRunResult>(
    "memory-challenge",
    runId,
    { awardedPoints: settlement.awardedPoints },
  );
  return { run: updated ?? settled, settlement };
}
export function abandonMemoryChallengeRun(
  runId: string,
  input: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<MemoryChallengeRunPayload>("memory-challenge", runId)) return null;
  return settleGame(input);
}
