export type Operator = "+" | "-" | "*" | "/";
export type Token =
  | { type: "number"; value: number; cardIndex: number; label: string }
  | { type: "operator"; value: Operator }
  | { type: "paren"; value: "(" | ")" };

export interface CardValue {
  value: number;
  label: string;
}

export interface GeneratedRound {
  cards: CardValue[];
  solution: string;
}

export const MIN_CARD_VALUE = 1;
export const MAX_CARD_VALUE = 10;
export const BASE_POINTS_PER_SOLVED_ROUND = 2;
export const SOLVED_ROUNDS_PER_POINT_INCREASE = 3;

const EPSILON = 1e-6;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getPrecedence(operator: Operator) {
  return operator === "+" || operator === "-" ? 1 : 2;
}

export function getPointsForSolvedRound(solvedCount: number) {
  const safeSolvedCount = Number.isFinite(solvedCount)
    ? Math.max(0, Math.floor(solvedCount))
    : 0;
  return BASE_POINTS_PER_SOLVED_ROUND
    + Math.floor(safeSolvedCount / SOLVED_ROUNDS_PER_POINT_INCREASE);
}

export function getPointsForAttempt(
  solvedCount: number,
  isCorrect: boolean,
  hintUsed: boolean,
) {
  return isCorrect && !hintUsed ? getPointsForSolvedRound(solvedCount) : 0;
}

export function solveTwentyFour(values: number[]): string | null {
  const search = (items: Array<{ value: number; expression: string }>): string | null => {
    if (items.length === 1) {
      return Math.abs(items[0].value - 24) < EPSILON ? items[0].expression : null;
    }

    for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
      for (let rightIndex = 0; rightIndex < items.length; rightIndex += 1) {
        if (leftIndex === rightIndex) continue;

        const left = items[leftIndex];
        const right = items[rightIndex];
        const rest = items.filter((_, index) => index !== leftIndex && index !== rightIndex);
        const candidates = [
          { value: left.value + right.value, expression: `(${left.expression}+${right.expression})` },
          { value: left.value - right.value, expression: `(${left.expression}-${right.expression})` },
          { value: left.value * right.value, expression: `(${left.expression}×${right.expression})` },
        ];

        if (Math.abs(right.value) > EPSILON) {
          candidates.push({
            value: left.value / right.value,
            expression: `(${left.expression}÷${right.expression})`,
          });
        }

        for (const candidate of candidates) {
          const result = search([...rest, candidate]);
          if (result) return result;
        }
      }
    }

    return null;
  };

  return search(values.map((value) => ({ value, expression: String(value) })));
}

export function generateRound(): GeneratedRound {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const values = Array.from(
      { length: 4 },
      () => randomInt(MIN_CARD_VALUE, MAX_CARD_VALUE),
    );
    const solution = solveTwentyFour(values);
    if (solution) {
      return {
        cards: values.map((value) => ({ value, label: String(value) })),
        solution,
      };
    }
  }

  return {
    cards: [3, 3, 8, 8].map((value) => ({ value, label: String(value) })),
    solution: "(8÷(3-8÷3))",
  };
}

export function evaluateExpression(tokens: Token[]): number | null {
  const values: number[] = [];
  const operators: Array<Operator | "("> = [];

  const applyOperator = () => {
    const operator = operators.pop();
    const right = values.pop();
    const left = values.pop();
    if (!operator || operator === "(" || right === undefined || left === undefined) {
      return false;
    }

    if (operator === "+") values.push(left + right);
    if (operator === "-") values.push(left - right);
    if (operator === "*") values.push(left * right);
    if (operator === "/") {
      if (Math.abs(right) < EPSILON) return false;
      values.push(left / right);
    }

    return true;
  };

  for (const token of tokens) {
    if (token.type === "number") {
      values.push(token.value);
      continue;
    }

    if (token.type === "paren") {
      if (token.value === "(") {
        operators.push("(");
      } else {
        while (operators.length > 0 && operators[operators.length - 1] !== "(") {
          if (!applyOperator()) return null;
        }
        if (operators.pop() !== "(") return null;
      }
      continue;
    }

    while (
      operators.length > 0 &&
      operators[operators.length - 1] !== "(" &&
      getPrecedence(operators[operators.length - 1] as Operator) >= getPrecedence(token.value)
    ) {
      if (!applyOperator()) return null;
    }
    operators.push(token.value);
  }

  while (operators.length > 0) {
    if (operators[operators.length - 1] === "(") return null;
    if (!applyOperator()) return null;
  }

  return values.length === 1 ? values[0] : null;
}
