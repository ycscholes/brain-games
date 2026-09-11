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
  createSpatialRotationSession,
  type SpatialRotationPuzzle,
  type SpatialRotationResult,
} from "./gameLogic";

export interface SpatialRotationRunState {
  phase: "playing" | "feedback";
  puzzles: SpatialRotationPuzzle[];
  currentIndex: number;
  score: number;
  combo: number;
  bestCombo: number;
  correctPuzzles: number;
  selectedOptionId: string;
  lastResult: SpatialRotationResult | null;
  puzzleStartedAt: number;
}

export interface SpatialRotationRunPayload {
  difficulty: TrainingDifficulty;
  startedAt: number;
  state: SpatialRotationRunState;
}

export interface SpatialRotationRunResult {
  score: number;
  awardedPoints: number;
  durationSeconds: number;
  correctQuestions: number;
  totalQuestions: number;
  bestCombo: number;
  isNewBest: boolean;
}

export type SpatialRotationRun = GameRun<SpatialRotationRunPayload, SpatialRotationRunResult>;

export function createSpatialRotationRun(difficulty: TrainingDifficulty, startedAt = Date.now()) {
  return createGameRun("spatial-rotation", {
    difficulty,
    startedAt,
    state: {
      phase: "playing",
      puzzles: createSpatialRotationSession(difficulty),
      currentIndex: 0,
      score: 0,
      combo: 0,
      bestCombo: 0,
      correctPuzzles: 0,
      selectedOptionId: "",
      lastResult: null,
      puzzleStartedAt: startedAt,
    },
  });
}

export function readSpatialRotationRun(runId: string) {
  return readGameRun<SpatialRotationRunPayload, SpatialRotationRunResult>(
    "spatial-rotation",
    runId,
  );
}

export function updateSpatialRotationRun(runId: string, patch: Partial<SpatialRotationRunPayload>) {
  return updateGameRun<SpatialRotationRunPayload>(
    "spatial-rotation",
    runId,
    patch,
  ) as SpatialRotationRun | null;
}

export function settleSpatialRotationRun(runId: string, result: SpatialRotationRunResult) {
  return settleGameRun<SpatialRotationRunPayload, SpatialRotationRunResult>(
    "spatial-rotation",
    runId,
    result,
  );
}

export function settleSpatialRotationCompletion(
  runId: string,
  result: SpatialRotationRunResult,
  settlementInput: GameSettlementInput,
) {
  const settled = settleSpatialRotationRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(settlementInput);
  const updated = updateSettledGameRunResult<SpatialRotationRunPayload, SpatialRotationRunResult>(
    "spatial-rotation",
    runId,
    { awardedPoints: settlement.awardedPoints },
  );
  return { run: updated ?? settled, settlement };
}

export function abandonSpatialRotationRun(
  runId: string,
  settlementInput: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<SpatialRotationRunPayload>("spatial-rotation", runId)) return null;
  return settleGame(settlementInput);
}
