import type { GameSettlementInput, GameSettlementResult } from "../../domain/training/settlement";
import type { TrainingDifficulty } from "../../domain/training/types";
import { settleGame } from "../../services/gameSettlementService";
import type { LoopLinePuzzle, LoopLineState } from "./gameLogic";
import {
  abandonGameRun,
  createGameRun,
  readGameRun,
  settleGameRun,
  updateGameRun,
  updateSettledGameRunResult,
  type GameRun,
} from "../../utils/gameFlowSession";

export interface LoopLineRunState {
  puzzle: LoopLinePuzzle;
  boardState: LoopLineState;
  hintCount: number;
  elapsedSeconds: number;
  feedback: string;
  clockStartedAt: number;
}

export interface LoopLineRunPayload {
  difficulty: TrainingDifficulty;
  startedAt: number;
  state?: LoopLineRunState;
}
export interface LoopLineRunResult {
  score: number;
  awardedPoints: number;
  durationSeconds: number;
  moveCount: number;
  hintCount: number;
  isNewBest: boolean;
}
export type LoopLineRun = GameRun<LoopLineRunPayload, LoopLineRunResult>;

export function createLoopLineRun(
  difficulty: TrainingDifficulty = "normal",
  startedAt = Date.now(),
) {
  return createGameRun("loop-line", { difficulty, startedAt });
}
export function readLoopLineRun(runId: string) {
  return readGameRun<LoopLineRunPayload, LoopLineRunResult>("loop-line", runId);
}
export function updateLoopLineRun(runId: string, patch: Partial<LoopLineRunPayload>) {
  return updateGameRun<LoopLineRunPayload>("loop-line", runId, patch) as LoopLineRun | null;
}
export function settleLoopLineRun(runId: string, result: LoopLineRunResult) {
  return settleGameRun<LoopLineRunPayload, LoopLineRunResult>("loop-line", runId, result);
}
export function settleLoopLineCompletion(
  runId: string,
  result: LoopLineRunResult,
  input: GameSettlementInput,
) {
  const settled = settleLoopLineRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(input);
  const updated = updateSettledGameRunResult<LoopLineRunPayload, LoopLineRunResult>(
    "loop-line",
    runId,
    { awardedPoints: settlement.awardedPoints },
  );
  return { run: updated ?? settled, settlement };
}
export function abandonLoopLineRun(
  runId: string,
  input: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<LoopLineRunPayload>("loop-line", runId)) return null;
  return settleGame(input);
}
