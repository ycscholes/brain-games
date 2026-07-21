import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type InequalityGridDifficulty = TrainingDifficulty;
export type InequalitySign = "<" | ">";
export type InequalityDirection = "right" | "down";

export interface InequalityGridCell {
  row: number;
  col: number;
  value: number;
  given: boolean;
  target: boolean;
}

export interface InequalityGridComparison {
  row: number;
  col: number;
  direction: InequalityDirection;
  sign: InequalitySign;
}

export interface InequalityGridPuzzle {
  id: string;
  size: number;
  cells: InequalityGridCell[];
  comparisons: InequalityGridComparison[];
  targetCell: InequalityGridCell;
  answer: number;
  options: number[];
  timeLimitMs: number;
}

export interface InequalityGridResult {
  correct: boolean;
  speedBonus: number;
  comboBonus: number;
  score: number;
}

export const INEQUALITY_GRID_TOTAL_PUZZLES = 8;

const TIME_LIMIT_MS: Record<InequalityGridDifficulty, number[]> = {
  normal: [9800, 9500, 9200, 8900, 8600, 8300, 8000, 7700],
  hard: [8600, 8300, 8000, 7700, 7400, 7100, 6800, 6500],
};

const GRID_SIZE: Record<InequalityGridDifficulty, number> = {
  normal: 4,
  hard: 5,
};

function clampPuzzleIndex(puzzleIndex: number) {
  return Math.max(0, Math.min(INEQUALITY_GRID_TOTAL_PUZZLES - 1, puzzleIndex));
}

function rowOffset(size: number, row: number) {
  if (size === 4) {
    return [0, 2, 1, 3][row] ?? row;
  }
  return (row * 2) % size;
}

function createSolution(size: number, seed: number) {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => ((rowOffset(size, row) + col + seed) % size) + 1),
  );
}

function compareValues(left: number, right: number): InequalitySign {
  return left < right ? "<" : ">";
}

function getCellValue(cells: InequalityGridCell[], row: number, col: number, candidate?: number) {
  const cell = cells.find((item) => item.row === row && item.col === col);
  if (!cell) return null;
  if (cell.target) return candidate ?? null;
  return cell.given ? cell.value : null;
}

function createComparisons(solution: number[][], targetRow: number, targetCol: number): InequalityGridComparison[] {
  const size = solution.length;
  const comparisons: InequalityGridComparison[] = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (col < size - 1 && (row === targetRow || col === targetCol || col + 1 === targetCol)) {
        comparisons.push({
          row,
          col,
          direction: "right",
          sign: compareValues(solution[row][col], solution[row][col + 1]),
        });
      }
      if (row < size - 1 && (col === targetCol || row === targetRow || row + 1 === targetRow)) {
        comparisons.push({
          row,
          col,
          direction: "down",
          sign: compareValues(solution[row][col], solution[row + 1][col]),
        });
      }
    }
  }

  return comparisons;
}

function isGivenCell(row: number, col: number, targetRow: number, targetCol: number, puzzleIndex: number, difficulty: InequalityGridDifficulty) {
  if (row === targetRow && col === targetCol) return false;
  if (row === targetRow || col === targetCol) return true;
  const density = difficulty === "hard" ? 4 : 3;
  return (row * 2 + col + puzzleIndex) % density === 0;
}

function rotateOptions(options: number[], puzzleIndex: number, difficulty: InequalityGridDifficulty) {
  const rotation = (puzzleIndex + (difficulty === "hard" ? 2 : 1)) % options.length;
  return [...options.slice(rotation), ...options.slice(0, rotation)];
}

export function getInequalityGridTimeLimitMs(
  difficulty: InequalityGridDifficulty,
  puzzleIndex: number,
) {
  return TIME_LIMIT_MS[difficulty][clampPuzzleIndex(puzzleIndex)];
}

export function validateInequalityGridCandidate(puzzle: InequalityGridPuzzle, candidate: number) {
  if (!Number.isInteger(candidate) || candidate < 1 || candidate > puzzle.size) return false;

  const { row: targetRow, col: targetCol } = puzzle.targetCell;
  const rowValues = puzzle.cells
    .filter((cell) => cell.given && cell.row === targetRow)
    .map((cell) => cell.value);
  const colValues = puzzle.cells
    .filter((cell) => cell.given && cell.col === targetCol)
    .map((cell) => cell.value);

  if (rowValues.includes(candidate) || colValues.includes(candidate)) {
    return false;
  }

  return puzzle.comparisons.every((comparison) => {
    const leftValue = getCellValue(puzzle.cells, comparison.row, comparison.col, candidate);
    const rightValue = comparison.direction === "right"
      ? getCellValue(puzzle.cells, comparison.row, comparison.col + 1, candidate)
      : getCellValue(puzzle.cells, comparison.row + 1, comparison.col, candidate);

    if (leftValue === null || rightValue === null) return true;
    return comparison.sign === "<" ? leftValue < rightValue : leftValue > rightValue;
  });
}

export function createInequalityGridPuzzle(
  difficulty: InequalityGridDifficulty,
  puzzleIndex: number,
): InequalityGridPuzzle {
  const safePuzzleIndex = clampPuzzleIndex(puzzleIndex);
  const size = GRID_SIZE[difficulty];
  const solution = createSolution(size, safePuzzleIndex + (difficulty === "hard" ? 1 : 0));
  const targetRow = (safePuzzleIndex * 2 + (difficulty === "hard" ? 1 : 0)) % size;
  const targetCol = (safePuzzleIndex * 3 + 1) % size;
  const cells = solution.flatMap((rowValues, row) =>
    rowValues.map((value, col) => ({
      row,
      col,
      value,
      given: isGivenCell(row, col, targetRow, targetCol, safePuzzleIndex, difficulty),
      target: row === targetRow && col === targetCol,
    })),
  );
  const targetCell = cells.find((cell) => cell.target);
  if (!targetCell) {
    throw new Error("Inequality grid target cell was not generated");
  }

  const answer = solution[targetRow][targetCol];
  const wrongOptions = Array.from({ length: size }, (_, index) => index + 1)
    .filter((option) => option !== answer)
    .slice(0, 3);
  const options = rotateOptions([answer, ...wrongOptions].sort((left, right) => left - right), safePuzzleIndex, difficulty);

  return {
    id: `inequality-grid-${difficulty}-${safePuzzleIndex + 1}`,
    size,
    cells,
    comparisons: createComparisons(solution, targetRow, targetCol),
    targetCell,
    answer,
    options,
    timeLimitMs: getInequalityGridTimeLimitMs(difficulty, safePuzzleIndex),
  };
}

export function createInequalityGridSession(difficulty: InequalityGridDifficulty) {
  return Array.from({ length: INEQUALITY_GRID_TOTAL_PUZZLES }, (_, index) =>
    createInequalityGridPuzzle(difficulty, index),
  );
}

export function scoreInequalityGridPuzzle(params: {
  selectedValue: number | null;
  answer: number;
  answerMs: number;
  currentCombo: number;
}): InequalityGridResult {
  const correct = params.selectedValue === params.answer;
  if (!correct) {
    return {
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      score: 0,
    };
  }

  const speedBonus = params.answerMs <= 3600 ? 1 : 0;
  const comboBonus = params.currentCombo >= 2 ? 1 : 0;

  return {
    correct: true,
    speedBonus,
    comboBonus,
    score: 4 + speedBonus + comboBonus,
  };
}
