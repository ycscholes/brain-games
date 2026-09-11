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
  BASE_SPEED,
  buildCircles,
  getBoardSize,
  INITIAL_TARGET_COUNT,
  type BoardSize,
  type MovingCircle,
  type MultipleObjectTrackingPhase,
} from "./gameLogic";

export interface MultipleObjectTrackingRunPayload {
  difficulty: TrainingDifficulty;
  startedAt: number;
  boardSize: BoardSize;
  phase: MultipleObjectTrackingPhase;
  phaseStartedAt: number;
  circles: MovingCircle[];
  selectedIds: number[];
  targetCount: number;
  speed: number;
  score: number;
  roundMessage: string;
  isNewBest: boolean;
}

export interface MultipleObjectTrackingRunResult {
  score: number;
  awardedPoints: number;
  durationSeconds: number;
  isNewBest: boolean;
}

export type MultipleObjectTrackingRun = GameRun<
  MultipleObjectTrackingRunPayload,
  MultipleObjectTrackingRunResult
>;

export function createMultipleObjectTrackingRun(
  difficulty: TrainingDifficulty,
  startedAt = Date.now(),
  boardSize = getBoardSize(375),
) {
  const targetCount = INITIAL_TARGET_COUNT[difficulty];
  const speed = BASE_SPEED + (difficulty === "hard" ? 0.35 : 0);
  return createGameRun("multiple-object-tracking", {
    difficulty,
    startedAt,
    boardSize,
    phase: "preview",
    phaseStartedAt: startedAt,
    circles: buildCircles(targetCount, speed, boardSize),
    selectedIds: [],
    targetCount,
    speed,
    score: 0,
    roundMessage: "记住高亮的目标圆圈",
    isNewBest: false,
  });
}

export function readMultipleObjectTrackingRun(runId: string) {
  return readGameRun<MultipleObjectTrackingRunPayload, MultipleObjectTrackingRunResult>(
    "multiple-object-tracking",
    runId,
  );
}

export function updateMultipleObjectTrackingRun(
  runId: string,
  patch: Partial<MultipleObjectTrackingRunPayload>,
) {
  return updateGameRun<MultipleObjectTrackingRunPayload>(
    "multiple-object-tracking",
    runId,
    patch,
  ) as MultipleObjectTrackingRun | null;
}

export function settleMultipleObjectTrackingRun(
  runId: string,
  result: MultipleObjectTrackingRunResult,
) {
  return settleGameRun<MultipleObjectTrackingRunPayload, MultipleObjectTrackingRunResult>(
    "multiple-object-tracking",
    runId,
    result,
  );
}

export function settleMultipleObjectTrackingCompletion(
  runId: string,
  result: MultipleObjectTrackingRunResult,
  settlementInput: GameSettlementInput,
): { run: MultipleObjectTrackingRun; settlement: GameSettlementResult } | null {
  const settled = settleMultipleObjectTrackingRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(settlementInput);
  const updated = updateSettledGameRunResult<
    MultipleObjectTrackingRunPayload,
    MultipleObjectTrackingRunResult
  >("multiple-object-tracking", runId, { awardedPoints: settlement.awardedPoints });
  return { run: updated ?? settled, settlement };
}

export function abandonMultipleObjectTrackingRun(
  runId: string,
  settlementInput: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<MultipleObjectTrackingRunPayload>("multiple-object-tracking", runId)) {
    return null;
  }
  return settleGame(settlementInput);
}
