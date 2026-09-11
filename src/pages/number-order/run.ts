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
  createNumberOrderSession,
  type NumberOrderQuestion,
  type NumberOrderQuestionResult,
} from "./gameLogic";

export type NumberOrderRunPhase = "ready" | "revealing" | "answering" | "feedback";

export interface NumberOrderRunPayload {
  difficulty: TrainingDifficulty;
  startedAt: number;
  questions: NumberOrderQuestion[];
  currentIndex: number;
  tappedIds: string[];
  score: number;
  combo: number;
  bestCombo: number;
  correctQuestions: number;
  lastResult: NumberOrderQuestionResult | null;
  activeEchoIndex: number;
  phase: NumberOrderRunPhase;
}

export interface NumberOrderRunResult {
  score: number;
  best: number;
  awardedPoints: number;
  durationSeconds: number;
  correctQuestions: number;
  bestCombo: number;
  isNewBest: boolean;
}

export type NumberOrderRun = GameRun<NumberOrderRunPayload, NumberOrderRunResult>;

export function createNumberOrderRun(difficulty: TrainingDifficulty, startedAt = Date.now()) {
  return createGameRun("number-order", {
    difficulty,
    startedAt,
    questions: createNumberOrderSession(difficulty),
    currentIndex: 0,
    tappedIds: [],
    score: 0,
    combo: 0,
    bestCombo: 0,
    correctQuestions: 0,
    lastResult: null,
    activeEchoIndex: -1,
    phase: "ready" as const,
  });
}

export function readNumberOrderRun(runId: string) {
  return readGameRun<NumberOrderRunPayload, NumberOrderRunResult>("number-order", runId);
}

export function updateNumberOrderRun(runId: string, patch: Partial<NumberOrderRunPayload>) {
  return updateGameRun<NumberOrderRunPayload>(
    "number-order",
    runId,
    patch,
  ) as NumberOrderRun | null;
}

export function settleNumberOrderRun(runId: string, result: NumberOrderRunResult) {
  return settleGameRun<NumberOrderRunPayload, NumberOrderRunResult>("number-order", runId, result);
}

export function settleNumberOrderCompletion(
  runId: string,
  result: NumberOrderRunResult,
  settlementInput: GameSettlementInput,
): { run: NumberOrderRun; settlement: GameSettlementResult } | null {
  const settled = settleNumberOrderRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(settlementInput);
  const updated = updateSettledGameRunResult<NumberOrderRunPayload, NumberOrderRunResult>(
    "number-order",
    runId,
    { awardedPoints: settlement.awardedPoints },
  );
  return { run: updated ?? settled, settlement };
}

export function abandonNumberOrderRun(
  runId: string,
  settlementInput: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<NumberOrderRunPayload>("number-order", runId)) return null;
  return settleGame(settlementInput);
}
