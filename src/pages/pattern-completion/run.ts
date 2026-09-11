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
  generatePatternSession,
  PATTERN_HINTS_PER_SESSION,
  type PatternQuestion,
  type PatternScoreResult,
} from "./patterns";

export interface PatternCompletionRunState {
  session: PatternQuestion[];
  phase: "playing" | "reveal";
  currentIndex: number;
  correctCount: number;
  selectedOptionId: string;
  hintVisible: boolean;
  hintUsedForCurrent: boolean;
  remainingHints: number;
  currentCombo: number;
  longestCombo: number;
  lastAnswerCorrect: boolean;
  currentScoreResult: PatternScoreResult | null;
  elapsedMs: number;
  finalScore: number;
  questionStartedAt: number;
}

export interface PatternCompletionRunPayload {
  difficulty: TrainingDifficulty;
  startedAt: number;
  state: PatternCompletionRunState;
}

export interface PatternCompletionRunResult {
  score: number;
  awardedPoints: number;
  correctCount: number;
  totalQuestions: number;
  longestCombo: number;
  hintsUsed: number;
  multiruleCases: number;
  elapsedMs: number;
  best: number;
  isNewBest: boolean;
}

export type PatternCompletionRun = GameRun<PatternCompletionRunPayload, PatternCompletionRunResult>;

function createInitialState(difficulty: TrainingDifficulty, startedAt: number) {
  return {
    session: generatePatternSession(difficulty),
    phase: "playing",
    currentIndex: 0,
    correctCount: 0,
    selectedOptionId: "",
    hintVisible: false,
    hintUsedForCurrent: false,
    remainingHints: PATTERN_HINTS_PER_SESSION,
    currentCombo: 0,
    longestCombo: 0,
    lastAnswerCorrect: false,
    currentScoreResult: null,
    elapsedMs: 0,
    finalScore: 0,
    questionStartedAt: startedAt,
  } satisfies PatternCompletionRunState;
}

export function createPatternCompletionRun(difficulty: TrainingDifficulty, startedAt = Date.now()) {
  return createGameRun("pattern-completion", {
    difficulty,
    startedAt,
    state: createInitialState(difficulty, startedAt),
  });
}

export function readPatternCompletionRun(runId: string) {
  return readGameRun<PatternCompletionRunPayload, PatternCompletionRunResult>(
    "pattern-completion",
    runId,
  );
}

export function updatePatternCompletionRun(
  runId: string,
  patch: Partial<PatternCompletionRunPayload>,
) {
  return updateGameRun<PatternCompletionRunPayload>(
    "pattern-completion",
    runId,
    patch,
  ) as PatternCompletionRun | null;
}

export function settlePatternCompletionRun(runId: string, result: PatternCompletionRunResult) {
  return settleGameRun<PatternCompletionRunPayload, PatternCompletionRunResult>(
    "pattern-completion",
    runId,
    result,
  );
}

export function settlePatternCompletionCompletion(
  runId: string,
  result: PatternCompletionRunResult,
  settlementInput: GameSettlementInput,
) {
  const settled = settlePatternCompletionRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(settlementInput);
  const updated = updateSettledGameRunResult<
    PatternCompletionRunPayload,
    PatternCompletionRunResult
  >("pattern-completion", runId, { awardedPoints: settlement.awardedPoints });
  return { run: updated ?? settled, settlement };
}

export function abandonPatternCompletionRun(
  runId: string,
  settlementInput: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<PatternCompletionRunPayload>("pattern-completion", runId)) return null;
  return settleGame(settlementInput);
}
