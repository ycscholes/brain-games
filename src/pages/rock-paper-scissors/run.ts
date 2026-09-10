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

export type RockPaperScissorsHand = "rock" | "paper" | "scissors";
export type RockPaperScissorsOutcome = "win" | "draw" | "lose";

export interface RockPaperScissorsRunState {
  score: number;
  streak: number;
  bestStreak: number;
  timeLeft: number;
  currentHand: RockPaperScissorsHand | null;
  targetOutcome: RockPaperScissorsOutcome | null;
  feedback: "none" | "correct" | "wrong";
  selectedHand: RockPaperScissorsHand | null;
  clockStartedAt: number;
  questionStartedAt: number;
}

export interface RockPaperScissorsRunPayload {
  difficulty: TrainingDifficulty;
  level: 1 | 2 | 3 | 4;
  rounds: 1 | 3;
  startedAt: number;
  state?: RockPaperScissorsRunState;
}
export interface RockPaperScissorsRunResult {
  score: number;
  awardedPoints: number;
  durationSeconds: number;
  correctCount: number;
  bestStreak: number;
  isNewBest: boolean;
}
export type RockPaperScissorsRun = GameRun<RockPaperScissorsRunPayload, RockPaperScissorsRunResult>;

export function createRockPaperScissorsRun(
  difficulty: TrainingDifficulty = "normal",
  rounds: 1 | 3 = difficulty === "hard" ? 3 : 1,
  level: 1 | 2 | 3 | 4 = difficulty === "hard" ? 3 : 1,
  startedAt = Date.now(),
) {
  return createGameRun("rock-paper-scissors", { difficulty, level, rounds, startedAt });
}
export function readRockPaperScissorsRun(runId: string) {
  return readGameRun<RockPaperScissorsRunPayload, RockPaperScissorsRunResult>(
    "rock-paper-scissors",
    runId,
  );
}
export function updateRockPaperScissorsRun(
  runId: string,
  patch: Partial<RockPaperScissorsRunPayload>,
) {
  return updateGameRun<RockPaperScissorsRunPayload>(
    "rock-paper-scissors",
    runId,
    patch,
  ) as RockPaperScissorsRun | null;
}
export function settleRockPaperScissorsRun(runId: string, result: RockPaperScissorsRunResult) {
  return settleGameRun<RockPaperScissorsRunPayload, RockPaperScissorsRunResult>(
    "rock-paper-scissors",
    runId,
    result,
  );
}
export function settleRockPaperScissorsCompletion(
  runId: string,
  result: RockPaperScissorsRunResult,
  input: GameSettlementInput,
) {
  const settled = settleRockPaperScissorsRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(input);
  const updated = updateSettledGameRunResult<
    RockPaperScissorsRunPayload,
    RockPaperScissorsRunResult
  >("rock-paper-scissors", runId, { awardedPoints: settlement.awardedPoints });
  return { run: updated ?? settled, settlement };
}
export function abandonRockPaperScissorsRun(
  runId: string,
  input: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<RockPaperScissorsRunPayload>("rock-paper-scissors", runId)) return null;
  return settleGame(input);
}
