import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type NumberOrderDifficulty = TrainingDifficulty;
export type NumberOrderRouteRuleId = "ascending" | "descending" | "odd-even" | "color-route" | "brightness-route";
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

export const NUMBER_ORDER_ROUTE_RULES: Record<NumberOrderRouteRuleId, NumberOrderRouteRule> = {
  ascending: {
    id: "ascending",
    title: "升序星路",
    shortLabel: "升序",
    description: "按数字从小到大点亮。",
    complexity: "basic",
  },
  descending: {
    id: "descending",
    title: "降序星路",
    shortLabel: "降序",
    description: "按数字从大到小点亮。",
    complexity: "medium",
  },
  "odd-even": {
    id: "odd-even",
    title: "奇偶星路",
    shortLabel: "奇偶",
    description: "先奇数升序，再偶数升序。",
    complexity: "medium",
  },
  "color-route": {
    id: "color-route",
    title: "双色星路",
    shortLabel: "双色",
    description: "先青色星，再金色星；组内升序。",
    complexity: "advanced",
  },
  "brightness-route": {
    id: "brightness-route",
    title: "亮度星路",
    shortLabel: "亮度",
    description: "先高亮星，再普通星；组内升序。",
    complexity: "advanced",
  },
};

const REVEAL_MS: Record<NumberOrderDifficulty, number[]> = {
  normal: [2400, 2320, 2240, 2140, 2040, 1960, 1880, 1800],
  hard: [2000, 1920, 1840, 1740, 1640, 1560, 1480, 1400],
};

const POINT_COUNT_STEPS: Record<NumberOrderDifficulty, number[]> = {
  normal: [4, 4, 5, 5, 5, 6, 6, 6],
  hard: [5, 5, 6, 6, 6, 7, 7, 7],
};

const MAX_VALUE: Record<NumberOrderDifficulty, number> = {
  normal: 19,
  hard: 31,
};

const NORMAL_RULE_STEPS: NumberOrderRouteRuleId[] = [
  "ascending",
  "ascending",
  "descending",
  "odd-even",
  "descending",
  "color-route",
  "brightness-route",
  "odd-even",
];

const HARD_RULE_STEPS: NumberOrderRouteRuleId[] = [
  "descending",
  "odd-even",
  "color-route",
  "brightness-route",
  "ascending",
  "odd-even",
  "color-route",
  "brightness-route",
];

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

function getRouteRuleId(difficulty: NumberOrderDifficulty, questionIndex: number) {
  const safeQuestionIndex = clampQuestionIndex(questionIndex);
  return (difficulty === "hard" ? HARD_RULE_STEPS : NORMAL_RULE_STEPS)[safeQuestionIndex];
}

function byValueAscending(left: NumberOrderPoint, right: NumberOrderPoint) {
  return left.value - right.value;
}

function byValueDescending(left: NumberOrderPoint, right: NumberOrderPoint) {
  return right.value - left.value;
}

function groupRank(point: NumberOrderPoint, routeRule: NumberOrderRouteRule) {
  if (routeRule.id === "odd-even") {
    return point.value % 2 === 1 ? 0 : 1;
  }

  if (routeRule.id === "color-route") {
    return point.colorGroup === "teal" ? 0 : 1;
  }

  if (routeRule.id === "brightness-route") {
    return point.brightness === "bright" ? 0 : 1;
  }

  return 0;
}

export function getNumberOrderPointCount(difficulty: NumberOrderDifficulty, questionIndex: number) {
  return POINT_COUNT_STEPS[difficulty][clampQuestionIndex(questionIndex)];
}

export function getRouteAnswerIds(points: NumberOrderPoint[], routeRule: NumberOrderRouteRule) {
  if (routeRule.id === "descending") {
    return [...points].sort(byValueDescending).map((point) => point.id);
  }

  return [...points]
    .sort((left, right) => {
      const groupDelta = groupRank(left, routeRule) - groupRank(right, routeRule);
      return groupDelta === 0 ? byValueAscending(left, right) : groupDelta;
    })
    .map((point) => point.id);
}

export function getRouteValues(question: NumberOrderQuestion) {
  const valueById = new Map(question.points.map((point) => [point.id, point.value]));
  return question.answerIds.map((id) => valueById.get(id)).filter((value): value is number => typeof value === "number");
}

export function createRouteReplayText(question: Pick<NumberOrderQuestion, "points" | "answerIds" | "routeRule">) {
  const valueById = new Map(question.points.map((point) => [point.id, point.value]));
  const routeValues = question.answerIds
    .map((id) => valueById.get(id))
    .filter((value): value is number => typeof value === "number")
    .join(" -> ");
  return `${question.routeRule.description} 正确路线：${routeValues}`;
}

export function createNumberOrderQuestion(
  difficulty: NumberOrderDifficulty,
  questionIndex: number,
): NumberOrderQuestion {
  const safeQuestionIndex = clampQuestionIndex(questionIndex);
  const pointCount = getNumberOrderPointCount(difficulty, safeQuestionIndex);
  const routeRule = NUMBER_ORDER_ROUTE_RULES[getRouteRuleId(difficulty, safeQuestionIndex)];
  const values = takeUniqueNumbers(pointCount, MAX_VALUE[difficulty]);
  const positions = shuffle(difficulty === "hard" ? HARD_POSITIONS : NORMAL_POSITIONS).slice(0, pointCount);
  const points = values.map((value, index) => ({
    id: `q${safeQuestionIndex + 1}-p${index + 1}`,
    value,
    x: positions[index].x,
    y: positions[index].y,
    colorGroup: index % 2 === 0 ? "teal" as const : "gold" as const,
    brightness: index < Math.ceil(pointCount / 2) ? "bright" as const : "normal" as const,
  }));
  const answerIds = getRouteAnswerIds(points, routeRule);
  const question = {
    id: `number-order-${difficulty}-${safeQuestionIndex + 1}`,
    points,
    answerIds,
    revealMs: REVEAL_MS[difficulty][safeQuestionIndex],
    routeRule,
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
