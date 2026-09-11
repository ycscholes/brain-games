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
  createStaffPlacementLevels,
  selectMusicTheoryQuestions,
  type MusicTheoryPhase,
  type MusicTheoryQuestion,
  type StaffPlacementLevel,
} from "./gameLogic";

export interface MusicTheoryRunState {
  phase: MusicTheoryPhase;
  index: number;
  selected: number | null;
  quizCorrect: number;
  placementCorrect: number;
  hintCount: number;
  chosenNote: string | null;
}

export interface MusicTheoryRunPayload {
  difficulty: TrainingDifficulty;
  questions: MusicTheoryQuestion[];
  levels: StaffPlacementLevel[];
  startedAt: number;
  state: MusicTheoryRunState;
}

export interface MusicTheoryRunResult {
  score: number;
  awardedPoints: number;
  durationSeconds: number;
  quizCorrectCount: number;
  placementCorrectCount: number;
  hintCount: number;
  isNewBest: boolean;
}

export type MusicTheoryRun = GameRun<MusicTheoryRunPayload, MusicTheoryRunResult>;

export function createMusicTheoryRun(difficulty: TrainingDifficulty, startedAt = Date.now()) {
  const seed = `${startedAt}`;
  return createGameRun("music-theory", {
    difficulty,
    questions: selectMusicTheoryQuestions(difficulty, seed),
    levels: createStaffPlacementLevels(difficulty, seed),
    startedAt,
    state: {
      phase: "quiz",
      index: 0,
      selected: null,
      quizCorrect: 0,
      placementCorrect: 0,
      hintCount: 0,
      chosenNote: null,
    },
  });
}

export function readMusicTheoryRun(runId: string) {
  return readGameRun<MusicTheoryRunPayload, MusicTheoryRunResult>("music-theory", runId);
}

export function updateMusicTheoryRun(runId: string, patch: Partial<MusicTheoryRunPayload>) {
  return updateGameRun<MusicTheoryRunPayload>(
    "music-theory",
    runId,
    patch,
  ) as MusicTheoryRun | null;
}

export function settleMusicTheoryRun(runId: string, result: MusicTheoryRunResult) {
  return settleGameRun<MusicTheoryRunPayload, MusicTheoryRunResult>("music-theory", runId, result);
}

export function settleMusicTheoryCompletion(
  runId: string,
  result: MusicTheoryRunResult,
  settlementInput: GameSettlementInput,
) {
  const settled = settleMusicTheoryRun(runId, result);
  if (!settled) return null;
  const settlement = settleGame(settlementInput);
  const updated = updateSettledGameRunResult<MusicTheoryRunPayload, MusicTheoryRunResult>(
    "music-theory",
    runId,
    { awardedPoints: settlement.awardedPoints },
  );
  return { run: updated ?? settled, settlement };
}

export function abandonMusicTheoryRun(
  runId: string,
  settlementInput: GameSettlementInput,
): GameSettlementResult | null {
  if (!abandonGameRun<MusicTheoryRunPayload>("music-theory", runId)) return null;
  return settleGame(settlementInput);
}
