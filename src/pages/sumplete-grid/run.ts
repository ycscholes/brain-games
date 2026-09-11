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
import {
  createSumpleteGridCells,
  createSumpleteGridPuzzle,
  type SumpleteGridCell,
  type SumpleteGridEvaluation,
  type SumpleteGridPuzzle,
} from "./gameLogic";

export interface SumpleteGridRunPayload {
  difficulty: TrainingDifficulty;
  puzzle: SumpleteGridPuzzle;
  cells: SumpleteGridCell[];
  evaluation: SumpleteGridEvaluation | null;
  mistakes: number;
  startedAt: number;
}

export interface SumpleteGridRunResult {
  score: number;
  awardedPoints: number;
  durationSeconds: number;
  mistakes: number;
  isNewBest: boolean;
}

export type SumpleteGridRun = GameRun<SumpleteGridRunPayload, SumpleteGridRunResult>;

export function createSumpleteGridRun(difficulty: TrainingDifficulty, startedAt = Date.now()) {
  const puzzle = createSumpleteGridPuzzle(difficulty);
  return createGameRun("sumplete-grid", {
    difficulty,
    puzzle,
    cells: createSumpleteGridCells(puzzle),
    evaluation: null,
    mistakes: 0,
    startedAt,
  });
}

export function readSumpleteGridRun(runId: string) {
  return readGameRun<SumpleteGridRunPayload, SumpleteGridRunResult>("sumplete-grid", runId);
}

export function updateSumpleteGridRun(runId: string, patch: Partial<SumpleteGridRunPayload>) {
  return updateGameRun<SumpleteGridRunPayload>(
    "sumplete-grid",
    runId,
    patch,
  ) as SumpleteGridRun | null;
}

export function settleSumpleteGridRun(runId: string, result: SumpleteGridRunResult) {
  return settleGameRun<SumpleteGridRunPayload, SumpleteGridRunResult>(
    "sumplete-grid",
    runId,
    result,
  );
}

export function settleSumpleteGridCompletion(
  runId: string,
  result: SumpleteGridRunResult,
  settlementInput: GameSettlementInput,
): { run: SumpleteGridRun; settlement: GameSettlementResult } | null {
  const settled = settleSumpleteGridRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(settlementInput);
  const updated = updateSettledGameRunResult<SumpleteGridRunPayload, SumpleteGridRunResult>(
    "sumplete-grid",
    runId,
    { awardedPoints: settlement.awardedPoints },
  );
  return { run: updated ?? settled, settlement };
}

export function abandonSumpleteGridRun(
  runId: string,
  settlementInput: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<SumpleteGridRunPayload>("sumplete-grid", runId)) return null;
  return settleGame(settlementInput);
}
