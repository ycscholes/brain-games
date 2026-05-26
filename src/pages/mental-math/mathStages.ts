import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type MathStageId = "G1A" | "G1B" | "G2" | "G3" | "G4" | "G5_6";
export type MathOperation = "add" | "subtract" | "multiply" | "divide" | "mixed";

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

export const MATH_STAGES: MathStage[] = [
  {
    id: "G1A",
    name: "一年级上",
    shortName: "10以内加减",
    summary: "10 以内数感入门",
    rangeLabel: "0-10",
    operationsLabel: "加法、减法",
    difficulty: "normal",
  },
  {
    id: "G1B",
    name: "一年级下",
    shortName: "20以内加减",
    summary: "20 以内进位退位",
    rangeLabel: "0-20",
    operationsLabel: "加法、减法",
    difficulty: "normal",
  },
  {
    id: "G2",
    name: "二年级",
    shortName: "百以内与口诀",
    summary: "100 以内加减和乘法口诀",
    rangeLabel: "0-100",
    operationsLabel: "加法、减法、乘法",
    difficulty: "normal",
  },
  {
    id: "G3",
    name: "三年级",
    shortName: "万以内加减与乘除",
    summary: "万以内加减，一位数乘除",
    rangeLabel: "0-10000",
    operationsLabel: "加法、减法、乘法、除法",
    difficulty: "hard",
  },
  {
    id: "G4",
    name: "四年级",
    shortName: "多位数乘除",
    summary: "两位数乘法，整除除法",
    rangeLabel: "两到四位数",
    operationsLabel: "乘法、除法",
    difficulty: "hard",
  },
  {
    id: "G5_6",
    name: "五六年级",
    shortName: "整数四则混合",
    summary: "两步整数混合运算",
    rangeLabel: "整数口算",
    operationsLabel: "四则混合",
    difficulty: "hard",
  },
];

export const DEFAULT_MATH_STAGE_ID: MathStageId = "G1A";

export function getMathStage(stageId: MathStageId) {
  return MATH_STAGES.find((stage) => stage.id === stageId) || MATH_STAGES[0];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function createDivisionProblem(
  divisorMin: number,
  divisorMax: number,
  quotientMin: number,
  quotientMax: number,
  dividendMin?: number,
  dividendMax?: number,
): MathProblem {
  let divisor = divisorMin;
  let quotient = quotientMin;
  let dividend = divisor * quotient;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    divisor = randomInt(divisorMin, divisorMax);
    quotient = randomInt(quotientMin, quotientMax);
    dividend = divisor * quotient;

    if (
      (dividendMin === undefined || dividend >= dividendMin) &&
      (dividendMax === undefined || dividend <= dividendMax)
    ) {
      break;
    }
  }

  return {
    question: `${dividend} ÷ ${divisor} = ?`,
    answer: quotient,
    operation: "divide",
  };
}

export function generateMathProblem(stageId: MathStageId): MathProblem {
  let a: number;
  let b: number;
  let c: number;

  switch (stageId) {
    case "G1A":
      if (Math.random() > 0.5) {
        a = randomInt(0, 10);
        b = randomInt(0, 10 - a);
        return { question: `${a} + ${b} = ?`, answer: a + b, operation: "add" };
      }
      a = randomInt(0, 10);
      b = randomInt(0, a);
      return { question: `${a} - ${b} = ?`, answer: a - b, operation: "subtract" };

    case "G1B":
      if (Math.random() > 0.5) {
        if (Math.random() > 0.5) {
          a = randomInt(2, 9);
          b = randomInt(10 - a, 20 - a);
        } else {
          a = randomInt(0, 20);
          b = randomInt(0, 20 - a);
        }
        return { question: `${a} + ${b} = ?`, answer: a + b, operation: "add" };
      }
      if (Math.random() > 0.5) {
        a = randomInt(11, 18);
        b = randomInt((a % 10) + 1, Math.min(a, 9));
      } else {
        a = randomInt(0, 20);
        b = randomInt(0, a);
      }
      return { question: `${a} - ${b} = ?`, answer: a - b, operation: "subtract" };

    case "G2":
      switch (pick<MathOperation>(["add", "subtract", "multiply"])) {
        case "add":
          a = randomInt(0, 100);
          b = randomInt(0, 100 - a);
          return { question: `${a} + ${b} = ?`, answer: a + b, operation: "add" };
        case "subtract":
          a = randomInt(0, 100);
          b = randomInt(0, a);
          return { question: `${a} - ${b} = ?`, answer: a - b, operation: "subtract" };
        default:
          a = randomInt(2, 9);
          b = randomInt(2, 9);
          return { question: `${a} × ${b} = ?`, answer: a * b, operation: "multiply" };
      }

    case "G3":
      switch (pick<MathOperation>(["add", "subtract", "multiply", "divide"])) {
        case "add":
          a = randomInt(100, 9999);
          b = randomInt(1, 10000 - a);
          return { question: `${a} + ${b} = ?`, answer: a + b, operation: "add" };
        case "subtract":
          a = randomInt(100, 10000);
          b = randomInt(1, a);
          return { question: `${a} - ${b} = ?`, answer: a - b, operation: "subtract" };
        case "multiply":
          a = randomInt(2, 9);
          b = randomInt(10, 999);
          return { question: `${a} × ${b} = ?`, answer: a * b, operation: "multiply" };
        default:
          return createDivisionProblem(2, 9, 10, 111, 10, 999);
      }

    case "G4":
      if (Math.random() > 0.5) {
        a = randomInt(10, 99);
        b = randomInt(10, 99);
        return { question: `${a} × ${b} = ?`, answer: a * b, operation: "multiply" };
      }
      return createDivisionProblem(2, 99, 2, 99, 100, 9999);

    case "G5_6":
    default:
      switch (randomInt(0, 5)) {
        case 0:
          a = randomInt(2, 20);
          b = randomInt(2, 20);
          c = randomInt(1, 100);
          return { question: `${a} × ${b} + ${c} = ?`, answer: a * b + c, operation: "mixed" };
        case 1:
          a = randomInt(2, 20);
          b = randomInt(2, 20);
          c = randomInt(1, Math.min(a * b, 200));
          return { question: `${a} × ${b} - ${c} = ?`, answer: a * b - c, operation: "mixed" };
        case 2:
          b = randomInt(2, 12);
          c = randomInt(2, 20);
          a = randomInt(1, 200);
          return { question: `${a} + ${b * c} ÷ ${b} = ?`, answer: a + c, operation: "mixed" };
        case 3:
          a = randomInt(1, 80);
          b = randomInt(1, 80);
          c = randomInt(2, 9);
          return { question: `(${a} + ${b}) × ${c} = ?`, answer: (a + b) * c, operation: "mixed" };
        case 4:
          a = randomInt(1, 90);
          b = randomInt(a + 1, 150);
          c = randomInt(b - a, 220);
          return { question: `${a} - ${b} + ${c} = ?`, answer: a - b + c, operation: "mixed" };
        default:
          b = randomInt(2, 12);
          c = randomInt(2, 30);
          a = randomInt(2, 20);
          return { question: `${a} × (${b * c} ÷ ${b}) = ?`, answer: a * c, operation: "mixed" };
      }
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
