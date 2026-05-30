import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type NumberOrderDifficulty = TrainingDifficulty;
export type NumberOrderRouteRuleId = "star-echo";
export type NumberOrderColorGroup = "teal" | "gold";
export type NumberOrderBrightness = "bright" | "normal";

export interface NumberOrderRouteRule {
  id: NumberOrderRouteRuleId;
  title: string;
  shortLabel: string;
  description: string;
  complexity: "basic" | "medium" | "advanced";
}

export interface NumberOrderPoint {
  id: string;
  value: number;
  x: number;
  y: number;
  colorGroup: NumberOrderColorGroup;
  brightness: NumberOrderBrightness;
}

export interface NumberOrderQuestion {
  id: string;
  points: NumberOrderPoint[];
  answerIds: string[];
  revealMs: number;
  playbackIntervalMs: number;
  routeRule: NumberOrderRouteRule;
  replayText: string;
}

export interface NumberOrderQuestionResult {
  correctCount: number;
  allCorrect: boolean;
  score: number;
  comboBonus: number;
}

export const NUMBER_ORDER_TOTAL_QUESTIONS = 8;

const STAR_ECHO_RULE: NumberOrderRouteRule = {
  id: "star-echo",
  title: "星链回响",
  shortLabel: "回响",
  description: "按刚才闪现的星链顺序依次点亮。",
  complexity: "basic",
};

const POINT_COUNT_STEPS: Record<NumberOrderDifficulty, number[]> = {
  normal: [4, 4, 5, 5, 5, 6, 6, 6],
  hard: [5, 5, 6, 6, 7, 7, 8, 8],
};

const SEQUENCE_LENGTH_STEPS: Record<NumberOrderDifficulty, number[]> = {
  normal: [3, 3, 4, 4, 4, 5, 5, 5],
  hard: [4, 4, 5, 5, 6, 6, 7, 7],
};

const PLAYBACK_INTERVAL_STEPS: Record<NumberOrderDifficulty, number[]> = {
  normal: [920, 900, 880, 850, 820, 790, 760, 730],
  hard: [720, 700, 670, 640, 610, 580, 550, 520],
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

function getQuestionPositions(difficulty: NumberOrderDifficulty, pointCount: number) {
  const positions = difficulty === "hard" ? HARD_POSITIONS : NORMAL_POSITIONS;
  return shuffle(positions).slice(0, pointCount);
}

export function getNumberOrderPointCount(difficulty: NumberOrderDifficulty, questionIndex: number) {
  return POINT_COUNT_STEPS[difficulty][clampQuestionIndex(questionIndex)];
}

export function getNumberOrderSequenceLength(difficulty: NumberOrderDifficulty, questionIndex: number) {
  return SEQUENCE_LENGTH_STEPS[difficulty][clampQuestionIndex(questionIndex)];
}

export function getNumberOrderPlaybackInterval(difficulty: NumberOrderDifficulty, questionIndex: number) {
  return PLAYBACK_INTERVAL_STEPS[difficulty][clampQuestionIndex(questionIndex)];
}

export function getRouteValues(question: NumberOrderQuestion) {
  const valueById = new Map(question.points.map((point) => [point.id, point.value]));
  return question.answerIds.map((id) => valueById.get(id)).filter((value): value is number => typeof value === "number");
}

export function createRouteReplayText(question: Pick<NumberOrderQuestion, "points" | "answerIds">) {
  const routeValues = getRouteValues({
    ...question,
    id: "replay",
    revealMs: 0,
    playbackIntervalMs: 0,
    routeRule: STAR_ECHO_RULE,
    replayText: "",
  }).join(" -> ");

  return `星链回响：${routeValues}`;
}

export function createNumberOrderQuestion(
  difficulty: NumberOrderDifficulty,
  questionIndex: number,
): NumberOrderQuestion {
  const safeQuestionIndex = clampQuestionIndex(questionIndex);
  const pointCount = getNumberOrderPointCount(difficulty, safeQuestionIndex);
  const sequenceLength = getNumberOrderSequenceLength(difficulty, safeQuestionIndex);
  const playbackIntervalMs = getNumberOrderPlaybackInterval(difficulty, safeQuestionIndex);
  const positions = getQuestionPositions(difficulty, pointCount);
  const sequencePointIndexes = shuffle(Array.from({ length: pointCount }, (_, index) => index)).slice(0, sequenceLength);
  const sequenceRankByPointIndex = new Map(sequencePointIndexes.map((pointIndex, index) => [pointIndex, index + 1]));
  const points = positions.map((position, index) => ({
    id: `number-order-${difficulty}-${safeQuestionIndex + 1}-star-${index + 1}`,
    value: sequenceRankByPointIndex.get(index) ?? 0,
    x: position.x,
    y: position.y,
    colorGroup: index % 2 === 0 ? "teal" as const : "gold" as const,
    brightness: sequenceRankByPointIndex.has(index) ? "bright" as const : "normal" as const,
  }));
  const answerIds = sequencePointIndexes.map((pointIndex) => points[pointIndex].id);
  const question = {
    id: `number-order-${difficulty}-${safeQuestionIndex + 1}`,
    points,
    answerIds,
    revealMs: playbackIntervalMs * sequenceLength,
    playbackIntervalMs,
    routeRule: STAR_ECHO_RULE,
    replayText: "",
  };

  return {
    ...question,
    replayText: createRouteReplayText(question),
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

export function isCorrectPathPrefix(question: NumberOrderQuestion, tappedIds: string[]) {
  if (tappedIds.length > question.answerIds.length) {
    return false;
  }

  return getCorrectTapCount(question, tappedIds) === tappedIds.length;
}

export function isCorrectTap(question: NumberOrderQuestion, tappedIds: string[]) {
  return isCorrectPathPrefix(question, tappedIds);
}

function getCompletionScore(sequenceLength: number) {
  return sequenceLength >= 6 ? 5 : sequenceLength >= 4 ? 4 : 3;
}

function getComboBonus(allCorrect: boolean, currentCombo: number) {
  if (!allCorrect) {
    return 0;
  }

  return Math.min(2, Math.floor(Math.max(0, currentCombo) / 3));
}

export function scoreNumberOrderQuestion(params: {
  question: NumberOrderQuestion;
  tappedIds: string[];
  currentCombo: number;
}): NumberOrderQuestionResult {
  const correctCount = getCorrectTapCount(params.question, params.tappedIds);
  const allCorrect = correctCount === params.question.answerIds.length &&
    params.tappedIds.length === params.question.answerIds.length;
  const comboBonus = getComboBonus(allCorrect, params.currentCombo);
  const score = allCorrect ? getCompletionScore(params.question.answerIds.length) + comboBonus : 0;

  return {
    correctCount,
    allCorrect,
    comboBonus,
    score,
  };
}
