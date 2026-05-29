import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type MathStageId = "G1A" | "G1B" | "G2_ADD" | "G2_MUL" | "G3_ADD" | "G4_MIXED_100" | "CUSTOM";
export type MathOperation = "add" | "subtract" | "multiply" | "divide" | "mixed";
export type CustomMathOperation = Exclude<MathOperation, "mixed">;
export type CustomMathRangeId = "within10" | "within100" | "within10000" | "unlimited";

export interface MathProblem {
  question: string;
  answer: number;
  operation: MathOperation;
}

export interface MathStage {
  id: MathStageId;
  name: string;
  shortName: string;
  summary: string;
  rangeLabel: string;
  operationsLabel: string;
  difficulty: TrainingDifficulty;
}

export interface CustomMathConfig {
  operations: CustomMathOperation[];
  rangeId: CustomMathRangeId;
}

export interface CustomMathProfile {
  coefficient: number;
  difficulty: TrainingDifficulty;
  operationsKey: string;
  rangeKey: CustomMathRangeId;
  summary: string;
  rangeLabel: string;
  operationsLabel: string;
}

export const CUSTOM_MATH_STAGE_ID: MathStageId = "CUSTOM";
export const DEFAULT_MATH_STAGE_ID: MathStageId = "G1A";

export const CUSTOM_OPERATION_OPTIONS: Array<{ id: CustomMathOperation | "all"; label: string }> = [
  { id: "add", label: "加" },
  { id: "subtract", label: "减" },
  { id: "multiply", label: "乘" },
  { id: "divide", label: "除" },
  { id: "all", label: "全选" },
];

export const CUSTOM_RANGE_OPTIONS: Array<{ id: CustomMathRangeId; label: string; max: number; coefficient: number }> = [
  { id: "within10", label: "10 以内", max: 10, coefficient: 1 },
  { id: "within100", label: "100 以内", max: 100, coefficient: 1.2 },
  { id: "within10000", label: "10000 以内", max: 10000, coefficient: 1.5 },
  { id: "unlimited", label: "不限制", max: 999999, coefficient: 2 },
];

export const DEFAULT_CUSTOM_MATH_CONFIG: CustomMathConfig = {
  operations: ["add", "subtract"],
  rangeId: "within100",
};

export const MATH_STAGES: MathStage[] = [
  {
    id: "G1A",
    name: "10以内加减",
    shortName: "基础加减",
    summary: "0-10 不进位不退位",
    rangeLabel: "0-10",
    operationsLabel: "加法、减法",
    difficulty: "normal",
  },
  {
    id: "G1B",
    name: "20以内进退位",
    shortName: "跨10加减",
    summary: "20 以内进位退位",
    rangeLabel: "0-20",
    operationsLabel: "加法、减法",
    difficulty: "normal",
  },
  {
    id: "G2_ADD",
    name: "百以内加减法",
    shortName: "100以内加减",
    summary: "100 以内非负整数加减",
    rangeLabel: "0-100",
    operationsLabel: "加法、减法",
    difficulty: "normal",
  },
  {
    id: "G2_MUL",
    name: "乘法口诀",
    shortName: "九九乘法",
    summary: "2-9 的乘法口诀",
    rangeLabel: "2-9",
    operationsLabel: "乘法",
    difficulty: "normal",
  },
  {
    id: "G3_ADD",
    name: "万以内加减法",
    shortName: "10000以内加减",
    summary: "10000 以内非负整数加减",
    rangeLabel: "0-10000",
    operationsLabel: "加法、减法",
    difficulty: "hard",
  },
  {
    id: "G4_MIXED_100",
    name: "100以内四则混合",
    shortName: "两步综合口算",
    summary: "100 以内两步整数混合运算",
    rangeLabel: "0-100",
    operationsLabel: "四则混合",
    difficulty: "hard",
  },
  {
    id: CUSTOM_MATH_STAGE_ID,
    name: "自定义训练",
    shortName: "自选范围与运算",
    summary: "自选加减乘除和数字范围",
    rangeLabel: "自定义",
    operationsLabel: "自定义",
    difficulty: "normal",
  },
];

const CUSTOM_OPERATION_LABELS: Record<CustomMathOperation, string> = {
  add: "加法",
  subtract: "减法",
  multiply: "乘法",
  divide: "除法",
};

const CUSTOM_OPERATION_WEIGHTS: Record<CustomMathOperation, number> = {
  add: 1,
  subtract: 1,
  multiply: 1.3,
  divide: 1.5,
};

const CUSTOM_OPERATION_ORDER: CustomMathOperation[] = ["add", "subtract", "multiply", "divide"];

export function getMathStage(stageId: MathStageId) {
  return MATH_STAGES.find((stage) => stage.id === stageId) || MATH_STAGES[0];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function uniqueOperations(operations: CustomMathOperation[]): CustomMathOperation[] {
  const selected = CUSTOM_OPERATION_ORDER.filter((operation) => operations.includes(operation));
  return selected.length > 0 ? selected : DEFAULT_CUSTOM_MATH_CONFIG.operations;
}

function getCustomRange(rangeId: CustomMathRangeId) {
  return CUSTOM_RANGE_OPTIONS.find((range) => range.id === rangeId) || CUSTOM_RANGE_OPTIONS[1];
}

function formatCoefficient(coefficient: number) {
  return Number(coefficient.toFixed(2));
}

export function getCustomMathProfile(config: CustomMathConfig): CustomMathProfile {
  const operations = uniqueOperations(config.operations);
  const range = getCustomRange(config.rangeId);
  const strongestOperationWeight = Math.max(...operations.map((operation) => CUSTOM_OPERATION_WEIGHTS[operation]));
  const operationCoefficient = Math.min(1.8, strongestOperationWeight + (operations.length - 1) * 0.1);
  const coefficient = formatCoefficient(range.coefficient * operationCoefficient);
  const difficulty = coefficient >= 1.5 ? "hard" : "normal";
  const operationsLabel = operations.map((operation) => CUSTOM_OPERATION_LABELS[operation]).join("、");

  return {
    coefficient,
    difficulty,
    operationsKey: operations.join("-"),
    rangeKey: range.id,
    summary: `${range.label} · ${operationsLabel}`,
    rangeLabel: range.label,
    operationsLabel,
  };
}

function createAdditionProblem(max: number, minFirst = 0): MathProblem {
  const a = randomInt(minFirst, max);
  const b = randomInt(0, max - a);
  return { question: `${a} + ${b} = ?`, answer: a + b, operation: "add" };
}

function createSubtractionProblem(max: number, minFirst = 0): MathProblem {
  const a = randomInt(minFirst, max);
  const b = randomInt(0, a);
  return { question: `${a} - ${b} = ?`, answer: a - b, operation: "subtract" };
}

function createMultiplicationProblem(max: number, factorMin = 1, factorMax = max): MathProblem {
  const safeFactorMax = Math.max(factorMin, Math.min(factorMax, max));
  const a = randomInt(factorMin, safeFactorMax);
  const b = randomInt(factorMin, Math.max(factorMin, Math.floor(max / a)));
  return { question: `${a} × ${b} = ?`, answer: a * b, operation: "multiply" };
}

function createDivisionProblem(divisorMin: number, divisorMax: number, quotientMin: number, quotientMax: number): MathProblem {
  const divisor = randomInt(divisorMin, Math.max(divisorMin, divisorMax));
  const quotient = randomInt(quotientMin, Math.max(quotientMin, quotientMax));
  const dividend = divisor * quotient;

  return {
    question: `${dividend} ÷ ${divisor} = ?`,
    answer: quotient,
    operation: "divide",
  };
}

function createCustomDivisionProblem(max: number): MathProblem {
  const divisor = randomInt(2, Math.max(2, Math.min(max, 999)));
  const quotient = randomInt(1, Math.max(1, Math.floor(max / divisor)));
  return {
    question: `${divisor * quotient} ÷ ${divisor} = ?`,
    answer: quotient,
    operation: "divide",
  };
}

function createMixedHundredProblem(): MathProblem {
  let a: number;
  let b: number;
  let c: number;

  switch (randomInt(0, 5)) {
    case 0:
      a = randomInt(1, 40);
      b = randomInt(1, 60 - a);
      c = randomInt(0, 100 - a - b);
      return { question: `${a} + ${b} + ${c} = ?`, answer: a + b + c, operation: "mixed" };
    case 1:
      a = randomInt(20, 100);
      b = randomInt(0, a);
      c = randomInt(0, a - b);
      return { question: `${a} - ${b} - ${c} = ?`, answer: a - b - c, operation: "mixed" };
    case 2:
      a = randomInt(2, 10);
      b = randomInt(2, Math.floor(100 / a));
      c = randomInt(0, 100 - a * b);
      return { question: `${a} × ${b} + ${c} = ?`, answer: a * b + c, operation: "mixed" };
    case 3:
      a = randomInt(2, 10);
      b = randomInt(2, Math.floor(100 / a));
      c = randomInt(0, a * b);
      return { question: `${a} × ${b} - ${c} = ?`, answer: a * b - c, operation: "mixed" };
    case 4:
      b = randomInt(2, 10);
      c = randomInt(1, Math.floor(100 / b));
      a = randomInt(0, 100 - c);
      return { question: `${a} + ${b * c} ÷ ${b} = ?`, answer: a + c, operation: "mixed" };
    default:
      c = randomInt(2, 10);
      a = randomInt(0, Math.floor(100 / c));
      b = randomInt(0, Math.floor(100 / c) - a);
      return { question: `(${a} + ${b}) × ${c} = ?`, answer: (a + b) * c, operation: "mixed" };
  }
}

export function generateCustomMathProblem(config: CustomMathConfig): MathProblem {
  const operations = uniqueOperations(config.operations);
  const range = getCustomRange(config.rangeId);

  switch (pick<CustomMathOperation>(operations)) {
    case "add":
      return createAdditionProblem(range.max);
    case "subtract":
      return createSubtractionProblem(range.max);
    case "multiply":
      return createMultiplicationProblem(range.max, 1, Math.min(range.max, 999));
    case "divide":
    default:
      return createCustomDivisionProblem(range.max);
  }
}

export function generateMathProblem(stageId: MathStageId, customConfig = DEFAULT_CUSTOM_MATH_CONFIG): MathProblem {
  switch (stageId) {
    case "G1A":
      return Math.random() > 0.5 ? createAdditionProblem(10) : createSubtractionProblem(10);

    case "G1B":
      if (Math.random() > 0.5) {
        if (Math.random() > 0.5) {
          const a = randomInt(2, 9);
          const b = randomInt(10 - a, 20 - a);
          return { question: `${a} + ${b} = ?`, answer: a + b, operation: "add" };
        }
        return createAdditionProblem(20);
      }
      if (Math.random() > 0.5) {
        const a = randomInt(11, 18);
        const b = randomInt((a % 10) + 1, Math.min(a, 9));
        return { question: `${a} - ${b} = ?`, answer: a - b, operation: "subtract" };
      }
      return createSubtractionProblem(20);

    case "G2_ADD":
      return Math.random() > 0.5 ? createAdditionProblem(100) : createSubtractionProblem(100);

    case "G2_MUL":
      {
        const a = randomInt(2, 9);
        const b = randomInt(2, 9);
        return { question: `${a} × ${b} = ?`, answer: a * b, operation: "multiply" };
      }

    case "G3_ADD":
      return Math.random() > 0.5 ? createAdditionProblem(10000, 100) : createSubtractionProblem(10000, 100);

    case "G4_MIXED_100":
      return createMixedHundredProblem();

    case CUSTOM_MATH_STAGE_ID:
    default:
      return generateCustomMathProblem(customConfig);
  }
}

function getDistractorOffset(answer: number) {
  const magnitude = Math.abs(answer);
  if (magnitude <= 30) return randomInt(1, 5);
  if (magnitude <= 500) return randomInt(5, 30);
  return randomInt(50, 500);
}

export function generateMathOptions(correctAnswer: number): number[] {
  const options = [correctAnswer];

  while (options.length < 4) {
    const sign = Math.random() > 0.5 ? 1 : -1;
    const wrong = correctAnswer + sign * getDistractorOffset(correctAnswer);
    if (wrong >= 0 && !options.includes(wrong)) {
      options.push(wrong);
    }
  }

  return options.sort(() => Math.random() - 0.5);
}
