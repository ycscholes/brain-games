import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type BirdCountDifficulty = TrainingDifficulty;
export type BirdDirection = "left" | "right";

export interface BirdCountItem {
  id: string;
  direction: BirdDirection;
  x: number;
  y: number;
  size: "small" | "medium" | "large";
}

export interface BirdCountQuestion {
  id: string;
  birds: BirdCountItem[];
  answer: number;
  options: number[];
  revealMs: number;
}

export interface BirdCountQuestionResult {
  correct: boolean;
  speedBonus: number;
  comboBonus: number;
  score: number;
}

export const BIRD_COUNT_TOTAL_QUESTIONS = 8;

const BIRD_COUNT_STEPS: Record<BirdCountDifficulty, number[]> = {
  normal: [4, 5, 5, 6, 6, 7, 7, 8],
  hard: [7, 8, 8, 9, 10, 10, 11, 12],
};

const REVEAL_MS: Record<BirdCountDifficulty, number[]> = {
  normal: [1500, 1450, 1400, 1350, 1300, 1250, 1200, 1150],
  hard: [1100, 1050, 1000, 950, 900, 850, 800, 760],
};

const POSITIONS = [
  { x: 16, y: 18 },
  { x: 36, y: 12 },
  { x: 58, y: 20 },
  { x: 78, y: 15 },
  { x: 24, y: 40 },
  { x: 48, y: 38 },
  { x: 70, y: 44 },
  { x: 86, y: 52 },
  { x: 18, y: 66 },
  { x: 42, y: 70 },
  { x: 62, y: 64 },
  { x: 80, y: 76 },
];

function clampQuestionIndex(questionIndex: number) {
  return Math.max(0, Math.min(BIRD_COUNT_TOTAL_QUESTIONS - 1, questionIndex));
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

export function getBirdCountTarget(difficulty: BirdCountDifficulty, questionIndex: number) {
  return BIRD_COUNT_STEPS[difficulty][clampQuestionIndex(questionIndex)];
}

export function getBirdCountRevealMs(difficulty: BirdCountDifficulty, questionIndex: number) {
  return REVEAL_MS[difficulty][clampQuestionIndex(questionIndex)];
}

export function createBirdCountOptions(answer: number) {
  const candidates = [answer - 2, answer - 1, answer + 1, answer + 2, answer + 3, answer - 3]
    .filter((value) => value > 0 && value !== answer);
  const options = new Set<number>([answer]);

  candidates.forEach((candidate) => {
    if (options.size < 4) {
      options.add(candidate);
    }
  });

  let fallback = 1;
  while (options.size < 4) {
    if (fallback !== answer) {
      options.add(fallback);
    }
    fallback += 1;
  }

  return shuffle([...options]);
}

export function createBirdCountQuestion(
  difficulty: BirdCountDifficulty,
  questionIndex: number,
): BirdCountQuestion {
  const safeQuestionIndex = clampQuestionIndex(questionIndex);
  const answer = getBirdCountTarget(difficulty, safeQuestionIndex);
  const positions = shuffle(POSITIONS).slice(0, answer);
  const birds = positions.map((position, index) => ({
    id: `bird-count-${difficulty}-${safeQuestionIndex + 1}-bird-${index + 1}`,
    direction: index % 2 === 0 ? "right" as const : "left" as const,
    x: position.x,
    y: position.y,
    size: index % 3 === 0 ? "large" as const : index % 3 === 1 ? "medium" as const : "small" as const,
  }));

  return {
    id: `bird-count-${difficulty}-${safeQuestionIndex + 1}`,
    birds,
    answer,
    options: createBirdCountOptions(answer),
    revealMs: getBirdCountRevealMs(difficulty, safeQuestionIndex),
  };
}

export function createBirdCountSession(difficulty: BirdCountDifficulty) {
  return Array.from({ length: BIRD_COUNT_TOTAL_QUESTIONS }, (_, index) =>
    createBirdCountQuestion(difficulty, index),
  );
}

export function scoreBirdCountQuestion(params: {
  selectedAnswer: number;
  correctAnswer: number;
  answerMs: number;
  currentCombo: number;
}): BirdCountQuestionResult {
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
    score: 4 + speedBonus + comboBonus,
  };
}

