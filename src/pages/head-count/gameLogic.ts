import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type HeadCountDifficulty = TrainingDifficulty;
export type HeadCountSpeedDifficulty = "slow" | "standard" | "fast";
export type HeadCountDirection = "enter" | "leave";

export interface HeadCountEvent {
  delta: number;
  direction: HeadCountDirection;
  afterCount: number;
}

export interface HeadCountQuestion {
  id: string;
  initialCount: number;
  events: HeadCountEvent[];
  answer: number;
  options: number[];
  eventMs: number;
}

export interface HeadCountQuestionResult {
  correct: boolean;
  speedBonus: number;
  comboBonus: number;
  score: number;
}

export const HEAD_COUNT_TOTAL_QUESTIONS = 8;
const BASE_CORRECT_SCORE = 3;

const EVENT_COUNT_STEPS: Record<HeadCountDifficulty, number[]> = {
  normal: [3, 3, 3, 4, 4, 4, 4, 4],
  hard: [4, 4, 5, 5, 5, 6, 6, 6],
};

const INITIAL_RANGES: Record<HeadCountDifficulty, { min: number; max: number }> = {
  normal: { min: 1, max: 5 },
  hard: { min: 2, max: 8 },
};

const MAX_DELTA: Record<HeadCountDifficulty, number> = {
  normal: 2,
  hard: 3,
};

const EVENT_MS: Record<HeadCountSpeedDifficulty, number> = {
  slow: 1180,
  standard: 980,
  fast: 780,
};

const EVENT_MS_STEP: Record<HeadCountSpeedDifficulty, number> = {
  slow: 18,
  standard: 22,
  fast: 26,
};

export const HEAD_COUNT_SPEED_LABELS: Record<HeadCountSpeedDifficulty, string> = {
  slow: "舒缓",
  standard: "标准",
  fast: "快速",
};

function clampQuestionIndex(questionIndex: number) {
  return Math.max(0, Math.min(HEAD_COUNT_TOTAL_QUESTIONS - 1, questionIndex));
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

export function getHeadCountEventCount(difficulty: HeadCountDifficulty, questionIndex: number) {
  return EVENT_COUNT_STEPS[difficulty][clampQuestionIndex(questionIndex)];
}

export function getHeadCountEventMs(speedDifficulty: HeadCountSpeedDifficulty, questionIndex: number) {
  const safeQuestionIndex = clampQuestionIndex(questionIndex);
  return Math.max(620, EVENT_MS[speedDifficulty] - safeQuestionIndex * EVENT_MS_STEP[speedDifficulty]);
}

export function getHeadCountRewardDifficulty(
  difficulty: HeadCountDifficulty,
  speedDifficulty: HeadCountSpeedDifficulty,
): TrainingDifficulty {
  return difficulty === "hard" || speedDifficulty === "fast" ? "hard" : "normal";
}

function createEvent(currentCount: number, difficulty: HeadCountDifficulty, previousDirection?: HeadCountDirection) {
  const canLeave = currentCount > 0;
  let direction: HeadCountDirection;

  if (!canLeave) {
    direction = "enter";
  } else if (difficulty === "normal" && previousDirection) {
    direction = previousDirection === "enter" ? "leave" : "enter";
  } else {
    direction = Math.random() > 0.5 ? "enter" : "leave";
  }

  const maxDelta = direction === "leave" ? Math.min(MAX_DELTA[difficulty], currentCount) : MAX_DELTA[difficulty];
  const delta = randomInt(1, Math.max(1, maxDelta));
  const signedDelta = direction === "enter" ? delta : -delta;
  const afterCount = currentCount + signedDelta;

  return {
    event: {
      delta,
      direction,
      afterCount,
    },
    afterCount,
  };
}

export function createHeadCountOptions(answer: number) {
  const candidates = [
    answer - 2,
    answer - 1,
    answer + 1,
    answer + 2,
    answer + 3,
    answer - 3,
  ].filter((value) => value >= 0 && value !== answer);

  const uniqueOptions = new Set<number>([answer]);
  candidates.forEach((value) => {
    if (uniqueOptions.size < 4) {
      uniqueOptions.add(value);
    }
  });

  let fallback = 0;
  while (uniqueOptions.size < 4) {
    if (fallback !== answer) {
      uniqueOptions.add(fallback);
    }
    fallback += 1;
  }

  return shuffle([...uniqueOptions]);
}

export function createHeadCountQuestion(
  difficulty: HeadCountDifficulty,
  questionIndex: number,
  speedDifficulty: HeadCountSpeedDifficulty = "slow",
): HeadCountQuestion {
  const safeQuestionIndex = clampQuestionIndex(questionIndex);
  const initialRange = INITIAL_RANGES[difficulty];
  const initialCount = randomInt(initialRange.min, initialRange.max);
  const eventCount = getHeadCountEventCount(difficulty, safeQuestionIndex);
  const events: HeadCountEvent[] = [];
  let currentCount = initialCount;
  let previousDirection: HeadCountDirection | undefined;

  for (let index = 0; index < eventCount; index += 1) {
    const next = createEvent(currentCount, difficulty, previousDirection);
    events.push(next.event);
    currentCount = next.afterCount;
    previousDirection = next.event.direction;
  }

  return {
    id: `head-count-${difficulty}-${safeQuestionIndex + 1}`,
    initialCount,
    events,
    answer: currentCount,
    options: createHeadCountOptions(currentCount),
    eventMs: getHeadCountEventMs(speedDifficulty, safeQuestionIndex),
  };
}

export function createHeadCountSession(
  difficulty: HeadCountDifficulty,
  speedDifficulty: HeadCountSpeedDifficulty = "slow",
) {
  return Array.from({ length: HEAD_COUNT_TOTAL_QUESTIONS }, (_, index) =>
    createHeadCountQuestion(difficulty, index, speedDifficulty),
  );
}

export function scoreHeadCountQuestion(params: {
  selectedAnswer: number;
  correctAnswer: number;
  answerMs: number;
  currentCombo: number;
}): HeadCountQuestionResult {
  const correct = params.selectedAnswer === params.correctAnswer;
  if (!correct) {
    return {
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      score: 0,
    };
  }

  const speedBonus = params.answerMs <= 1800 ? 1 : 0;
  const comboBonus = params.currentCombo >= 2 ? 1 : 0;

  return {
    correct: true,
    speedBonus,
    comboBonus,
    score: BASE_CORRECT_SCORE + speedBonus + comboBonus,
  };
}
