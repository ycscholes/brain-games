import type { TrainingDifficulty } from "../../utils/trainingStorage";
import {
  createGameRun,
  readGameRun,
  settleGameRun,
  updateGameRun,
  type GameRun,
} from "../../utils/gameFlowSession";
import {
  createTrafficEscapePuzzle,
  createTrafficEscapeState,
  type TrafficEscapeMove,
  type TrafficEscapePuzzle,
  type TrafficEscapeState,
} from "./gameLogic";

export interface TrafficEscapeRunPayload {
  difficulty: TrainingDifficulty;
  puzzle: TrafficEscapePuzzle;
  trafficState: TrafficEscapeState;
  selectedVehicleId: string;
  hintMove: TrafficEscapeMove | null;
  hintCount: number;
  startedAt: number;
}

export interface TrafficEscapeRunResult {
  score: number;
  awardedPoints: number;
  durationSeconds: number;
  moveCount: number;
  hintCount: number;
  isNewBest: boolean;
}

export type TrafficEscapeRun = GameRun<TrafficEscapeRunPayload, TrafficEscapeRunResult>;

export function createTrafficEscapeRun(difficulty: TrainingDifficulty, seed = Date.now(), startedAt = Date.now()) {
  const puzzle = createTrafficEscapePuzzle(difficulty, seed);
  return createGameRun("traffic-escape", {
    difficulty,
    puzzle,
    trafficState: createTrafficEscapeState(puzzle),
    selectedVehicleId: "target",
    hintMove: null,
    hintCount: 0,
    startedAt,
  });
}

export function readTrafficEscapeRun(runId: string) {
  return readGameRun<TrafficEscapeRunPayload, TrafficEscapeRunResult>("traffic-escape", runId);
}

export function updateTrafficEscapeRun(runId: string, patch: Partial<TrafficEscapeRunPayload>) {
  return updateGameRun<TrafficEscapeRunPayload>("traffic-escape", runId, patch) as TrafficEscapeRun | null;
}

export function settleTrafficEscapeRun(runId: string, result: TrafficEscapeRunResult) {
  return settleGameRun<TrafficEscapeRunPayload, TrafficEscapeRunResult>("traffic-escape", runId, result);
}
