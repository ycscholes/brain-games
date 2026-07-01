import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type ColorTrapDifficulty = TrainingDifficulty;
export type ColorTrapColorId = "red" | "blue" | "green" | "yellow";
export type ColorTrapRule = "word" | "ink";

export interface ColorTrapColor {
  id: ColorTrapColorId;
  label: string;
  hex: string;
}

export interface ColorTrapQuestion {
  id: string;
  wordColor: ColorTrapColor;
  inkColor: ColorTrapColor;
  rule: ColorTrapRule;
  answer: ColorTrapColorId;
  options: ColorTrapColor[];
  timeLimitMs: number;
}

export interface ColorTrapQuestionResult {
  correct: boolean;
  speedBonus: number;
  comboBonus: number;
  score: number;
}

export const COLOR_TRAP_TOTAL_QUESTIONS = 8;

export const COLOR_TRAP_COLORS: ColorTrapColor[] = [
  { id: "red", label: "红", hex: "#e14d43" },
  { id: "blue", label: "蓝", hex: "#3177d4" },
  { id: "green", label: "绿", hex: "#2f9b6a" },
  { id: "yellow", label: "黄", hex: "#d79a20" },
];

const TIME_LIMIT_MS: Record<ColorTrapDifficulty, number[]> = {
  normal: [5200, 5000, 4800, 4600, 4400, 4200, 4000, 3800],
  hard: [4300, 4100, 3900, 3700, 3500, 3300, 3100, 2900],
};

function clampQuestionIndex(questionIndex: number) {
  return Math.max(0, Math.min(COLOR_TRAP_TOTAL_QUESTIONS - 1, questionIndex));
}

function getColor(offset: number) {
  return COLOR_TRAP_COLORS[offset % COLOR_TRAP_COLORS.length];
}

function shuffleOptions(questionIndex: number) {
  const rotation = questionIndex % COLOR_TRAP_COLORS.length;
  return [
    ...COLOR_TRAP_COLORS.slice(rotation),
    ...COLOR_TRAP_COLORS.slice(0, rotation),
  ];
}

export function getColorTrapTimeLimitMs(
  difficulty: ColorTrapDifficulty,
  questionIndex: number,
) {
  return TIME_LIMIT_MS[difficulty][clampQuestionIndex(questionIndex)];
}

export function createColorTrapQuestion(
  difficulty: ColorTrapDifficulty,
  questionIndex: number,
): ColorTrapQuestion {
  const safeQuestionIndex = clampQuestionIndex(questionIndex);
  const wordColor = getColor(safeQuestionIndex + (difficulty === "hard" ? 1 : 0));
  const inkColor = getColor(safeQuestionIndex * 2 + 1);
  const safeInkColor = inkColor.id === wordColor.id
    ? getColor(safeQuestionIndex + 2)
    : inkColor;
  const rule: ColorTrapRule = difficulty === "hard"
    ? (safeQuestionIndex % 3 === 0 ? "word" : "ink")
    : (safeQuestionIndex % 2 === 0 ? "ink" : "word");

  return {
    id: `color-trap-${difficulty}-${safeQuestionIndex + 1}`,
    wordColor,
    inkColor: safeInkColor,
    rule,
    answer: rule === "word" ? wordColor.id : safeInkColor.id,
    options: shuffleOptions(safeQuestionIndex),
    timeLimitMs: getColorTrapTimeLimitMs(difficulty, safeQuestionIndex),
  };
}

export function createColorTrapSession(difficulty: ColorTrapDifficulty) {
  return Array.from({ length: COLOR_TRAP_TOTAL_QUESTIONS }, (_, index) =>
    createColorTrapQuestion(difficulty, index),
  );
}

export function scoreColorTrapQuestion(params: {
  selectedColorId: ColorTrapColorId | "";
  correctColorId: ColorTrapColorId;
  answerMs: number;
  currentCombo: number;
}): ColorTrapQuestionResult {
  const correct = params.selectedColorId === params.correctColorId;
  if (!correct) {
    return {
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      score: 0,
    };
  }

  const speedBonus = params.answerMs <= 1500 ? 1 : 0;
  const comboBonus = params.currentCombo >= 2 ? 1 : 0;

  return {
    correct: true,
    speedBonus,
    comboBonus,
    score: 3 + speedBonus + comboBonus,
  };
}
