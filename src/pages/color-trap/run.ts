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
  createColorTrapSession,
  type ColorTrapQuestion,
  type ColorTrapQuestionResult,
} from "./gameLogic";

export interface ColorTrapRunState {
  phase: "playing" | "feedback";
  questions: ColorTrapQuestion[];
  currentIndex: number;
  score: number;
  combo: number;
  bestCombo: number;
  correctQuestions: number;
  selectedColorId: string;
  lastResult: ColorTrapQuestionResult | null;
  questionStartedAt: number;
}

export interface ColorTrapRunPayload {
  difficulty: TrainingDifficulty;
  startedAt: number;
  state: ColorTrapRunState;
}

export interface ColorTrapRunResult {
  score: number;
  awardedPoints: number;
  durationSeconds: number;
  correctQuestions: number;
  totalQuestions: number;
  bestCombo: number;
  isNewBest: boolean;
}

export type ColorTrapRun = GameRun<ColorTrapRunPayload, ColorTrapRunResult>;

export function createColorTrapRun(difficulty: TrainingDifficulty, startedAt = Date.now()) {
  return createGameRun("color-trap", {
    difficulty,
    startedAt,
    state: {
      phase: "playing",
      questions: createColorTrapSession(difficulty),
      currentIndex: 0,
      score: 0,
      combo: 0,
      bestCombo: 0,
      correctQuestions: 0,
      selectedColorId: "",
      lastResult: null,
      questionStartedAt: startedAt,
    },
  });
}

export function readColorTrapRun(runId: string) {
  return readGameRun<ColorTrapRunPayload, ColorTrapRunResult>("color-trap", runId);
}

export function updateColorTrapRun(runId: string, patch: Partial<ColorTrapRunPayload>) {
  return updateGameRun<ColorTrapRunPayload>("color-trap", runId, patch) as ColorTrapRun | null;
}

export function settleColorTrapRun(runId: string, result: ColorTrapRunResult) {
  return settleGameRun<ColorTrapRunPayload, ColorTrapRunResult>("color-trap", runId, result);
}

export function settleColorTrapCompletion(
  runId: string,
  result: ColorTrapRunResult,
  settlementInput: GameSettlementInput,
) {
  const settled = settleColorTrapRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(settlementInput);
  const updated = updateSettledGameRunResult<ColorTrapRunPayload, ColorTrapRunResult>(
    "color-trap",
    runId,
    { awardedPoints: settlement.awardedPoints },
  );
  return { run: updated ?? settled, settlement };
}

export function abandonColorTrapRun(
  runId: string,
  settlementInput: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<ColorTrapRunPayload>("color-trap", runId)) return null;
  return settleGame(settlementInput);
}
