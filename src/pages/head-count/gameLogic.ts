import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type HeadCountDifficulty = TrainingDifficulty;
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

const EVENT_MS: Record<HeadCountDifficulty, number> = {
  normal: 920,
  hard: 720,
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
    eventMs: Math.max(520, EVENT_MS[difficulty] - safeQuestionIndex * 24),
  };
}

export function createHeadCountSession(difficulty: HeadCountDifficulty) {
  return Array.from({ length: HEAD_COUNT_TOTAL_QUESTIONS }, (_, index) =>
    createHeadCountQuestion(difficulty, index),
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

  const speedBonus = params.answerMs <= 1600 ? 2 : params.answerMs <= 3000 ? 1 : 0;
  const comboBonus = params.currentCombo > 0 ? 1 : 0;

  return {
    correct: true,
    speedBonus,
    comboBonus,
    score: 5 + speedBonus + comboBonus,
  };
}
