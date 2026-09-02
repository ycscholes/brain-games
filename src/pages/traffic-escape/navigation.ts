import {
  scoreTrafficEscapeGame,
  type TrafficEscapeDifficulty,
} from "./gameLogic";
import type { TrainingDifficulty } from "../../utils/trainingStorage";

interface TrafficEscapeInterruptionInput {
  difficulty: TrainingDifficulty;
  elapsedSeconds: number;
  moveCount: number;
  hintCount: number;
}

export function createTrafficEscapeInterruption(input: TrafficEscapeInterruptionInput) {
  const difficulty = input.difficulty as TrafficEscapeDifficulty;
  const durationSeconds = Math.max(1, Math.round(input.elapsedSeconds));
  const score = scoreTrafficEscapeGame({
    difficulty,
    elapsedSeconds: durationSeconds,
    moveCount: input.moveCount,
    hintCount: input.hintCount,
    completed: false,
  });

  return {
    score,
    awardedPoints: 0,
    durationSeconds,
    difficulty: input.difficulty,
    outcome: "interrupted" as const,
  };
}
