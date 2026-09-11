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
  createWordScrambleSession,
  type WordScrambleQuestion,
  type WordScrambleQuestionResult,
} from "./gameLogic";

export interface WordScrambleRunState {
  phase: "playing" | "feedback";
  questions: WordScrambleQuestion[];
  currentIndex: number;
  selectedWord: string;
  selectedCharIds: string[];
  isHintVisible: boolean;
  score: number;
  combo: number;
  bestCombo: number;
  correctQuestions: number;
  lastResult: WordScrambleQuestionResult | null;
  questionStartedAt: number;
}

export interface WordScrambleRunPayload {
  difficulty: TrainingDifficulty;
  startedAt: number;
  state: WordScrambleRunState;
}

export interface WordScrambleRunResult {
  score: number;
  awardedPoints: number;
  durationSeconds: number;
  correctQuestions: number;
  totalQuestions: number;
  bestCombo: number;
  isNewBest: boolean;
}

export type WordScrambleRun = GameRun<WordScrambleRunPayload, WordScrambleRunResult>;

export function createWordScrambleRun(difficulty: TrainingDifficulty, startedAt = Date.now()) {
  return createGameRun("word-scramble", {
    difficulty,
    startedAt,
    state: {
      phase: "playing",
      questions: createWordScrambleSession(difficulty),
      currentIndex: 0,
      selectedWord: "",
      selectedCharIds: [],
      isHintVisible: false,
      score: 0,
      combo: 0,
      bestCombo: 0,
      correctQuestions: 0,
      lastResult: null,
      questionStartedAt: startedAt,
    },
  });
}

export function readWordScrambleRun(runId: string) {
  return readGameRun<WordScrambleRunPayload, WordScrambleRunResult>("word-scramble", runId);
}

export function updateWordScrambleRun(runId: string, patch: Partial<WordScrambleRunPayload>) {
  return updateGameRun<WordScrambleRunPayload>(
    "word-scramble",
    runId,
    patch,
  ) as WordScrambleRun | null;
}

export function settleWordScrambleRun(runId: string, result: WordScrambleRunResult) {
  return settleGameRun<WordScrambleRunPayload, WordScrambleRunResult>(
    "word-scramble",
    runId,
    result,
  );
}

export function settleWordScrambleCompletion(
  runId: string,
  result: WordScrambleRunResult,
  settlementInput: GameSettlementInput,
) {
  const settled = settleWordScrambleRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(settlementInput);
  const updated = updateSettledGameRunResult<WordScrambleRunPayload, WordScrambleRunResult>(
    "word-scramble",
    runId,
    { awardedPoints: settlement.awardedPoints },
  );
  return { run: updated ?? settled, settlement };
}

export function abandonWordScrambleRun(
  runId: string,
  settlementInput: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<WordScrambleRunPayload>("word-scramble", runId)) return null;
  return settleGame(settlementInput);
}
