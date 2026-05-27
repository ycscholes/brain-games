import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type NumberOrderDifficulty = TrainingDifficulty;

export interface NumberOrderPoint {
  id: string;
  value: number;
  x: number;
  y: number;
}

export interface NumberOrderQuestion {
  id: string;
  points: NumberOrderPoint[];
  answerIds: string[];
  revealMs: number;
}

export interface NumberOrderQuestionResult {
  correctCount: number;
  allCorrect: boolean;
  score: number;
  comboBonus: number;
}

export const NUMBER_ORDER_TOTAL_QUESTIONS = 8;

const REVEAL_MS: Record<NumberOrderDifficulty, number> = {
  normal: 2200,
  hard: 1700,
};

const POINT_COUNT_STEPS: Record<NumberOrderDifficulty, number[]> = {
  normal: [4, 4, 5, 5, 5, 6, 6, 6],
  hard: [5, 5, 6, 6, 6, 7, 7, 7],
};

const MAX_VALUE: Record<NumberOrderDifficulty, number> = {
  normal: 19,
  hard: 31,
};

const NORMAL_POSITIONS = [
  { x: 18, y: 18 },
  { x: 50, y: 14 },
  { x: 78, y: 24 },
  { x: 24, y: 48 },
  { x: 63, y: 48 },
  { x: 38, y: 76 },
  { x: 76, y: 76 },
];

const HARD_POSITIONS = [
  { x: 16, y: 16 },
  { x: 44, y: 12 },
  { x: 72, y: 18 },
  { x: 28, y: 40 },
  { x: 58, y: 42 },
  { x: 84, y: 52 },
  { x: 18, y: 74 },
  { x: 48, y: 78 },
  { x: 76, y: 80 },
];

function clampQuestionIndex(questionIndex: number) {
  return Math.max(0, Math.min(NUMBER_ORDER_TOTAL_QUESTIONS - 1, questionIndex));
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

function takeUniqueNumbers(count: number, maxValue: number) {
  return shuffle(Array.from({ length: maxValue }, (_, index) => index + 1)).slice(0, count);
}

export function getNumberOrderPointCount(difficulty: NumberOrderDifficulty, questionIndex: number) {
  return POINT_COUNT_STEPS[difficulty][clampQuestionIndex(questionIndex)];
}

export function createNumberOrderQuestion(
  difficulty: NumberOrderDifficulty,
  questionIndex: number,
): NumberOrderQuestion {
  const safeQuestionIndex = clampQuestionIndex(questionIndex);
  const pointCount = getNumberOrderPointCount(difficulty, safeQuestionIndex);
  const values = takeUniqueNumbers(pointCount, MAX_VALUE[difficulty]);
  const positions = shuffle(difficulty === "hard" ? HARD_POSITIONS : NORMAL_POSITIONS).slice(0, pointCount);
  const revealMs = Math.max(1100, REVEAL_MS[difficulty] - safeQuestionIndex * 80);
  const points = values.map((value, index) => ({
    id: `q${safeQuestionIndex + 1}-p${index + 1}`,
    value,
    x: positions[index].x,
    y: positions[index].y,
  }));

  return {
    id: `number-order-${difficulty}-${safeQuestionIndex + 1}`,
    points,
    answerIds: [...points].sort((left, right) => left.value - right.value).map((point) => point.id),
    revealMs,
  };
}

export function createNumberOrderSession(difficulty: NumberOrderDifficulty) {
  return Array.from({ length: NUMBER_ORDER_TOTAL_QUESTIONS }, (_, index) =>
    createNumberOrderQuestion(difficulty, index),
  );
}

export function getCorrectTapCount(question: NumberOrderQuestion, tappedIds: string[]) {
  let correctCount = 0;

  for (let index = 0; index < tappedIds.length; index += 1) {
    if (tappedIds[index] !== question.answerIds[index]) {
      break;
    }
    correctCount += 1;
  }

  return correctCount;
}

export function isCorrectTap(question: NumberOrderQuestion, tappedIds: string[]) {
  if (tappedIds.length > question.answerIds.length) {
    return false;
  }

  return getCorrectTapCount(question, tappedIds) === tappedIds.length;
}

export function scoreNumberOrderQuestion(params: {
  question: NumberOrderQuestion;
  tappedIds: string[];
  currentCombo: number;
}): NumberOrderQuestionResult {
  const correctCount = getCorrectTapCount(params.question, params.tappedIds);
  const allCorrect = correctCount === params.question.answerIds.length &&
    params.tappedIds.length === params.question.answerIds.length;
  const comboBonus = allCorrect ? Math.min(2, Math.max(0, params.currentCombo)) : 0;
  const score = correctCount + (allCorrect ? 2 : 0) + comboBonus;

  return {
    correctCount,
    allCorrect,
    comboBonus,
    score,
  };
}
