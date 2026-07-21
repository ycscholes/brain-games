import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type SumpleteGridDifficulty = TrainingDifficulty;
export type SumpleteCellState = "unknown" | "kept" | "removed";

export interface SumpleteGridPuzzle {
  id: string;
  size: number;
  values: number[][];
  solution: boolean[][];
  rowTargets: number[];
  colTargets: number[];
}

export interface SumpleteGridCell {
  row: number;
  col: number;
  value: number;
  state: SumpleteCellState;
}

export interface SumpleteGridEvaluation {
  complete: boolean;
  correct: boolean;
  rowSums: number[];
  colSums: number[];
  wrongCellKeys: string[];
}

const NORMAL_PUZZLES: Array<Omit<SumpleteGridPuzzle, "rowTargets" | "colTargets">> = [
  {
    id: "sumplete-grid-normal-1",
    size: 4,
    values: [
      [8, 3, 6, 2],
      [5, 7, 4, 9],
      [6, 2, 8, 3],
      [4, 9, 1, 7],
    ],
    solution: [
      [true, false, true, false],
      [false, true, true, false],
      [true, false, false, true],
      [false, true, false, true],
    ],
  },
  {
    id: "sumplete-grid-normal-2",
    size: 4,
    values: [
      [9, 4, 7, 2],
      [3, 8, 5, 6],
      [4, 6, 2, 9],
      [7, 1, 8, 5],
    ],
    solution: [
      [true, false, false, true],
      [false, true, true, false],
      [true, false, true, false],
      [false, true, false, true],
    ],
  },
  {
    id: "sumplete-grid-normal-3",
    size: 4,
    values: [
      [6, 8, 2, 5],
      [4, 7, 9, 1],
      [8, 3, 5, 6],
      [2, 9, 4, 7],
    ],
    solution: [
      [false, true, true, false],
      [true, false, true, false],
      [true, false, false, true],
      [false, true, true, false],
    ],
  },
];

const HARD_PUZZLES: Array<Omit<SumpleteGridPuzzle, "rowTargets" | "colTargets">> = [
  {
    id: "sumplete-grid-hard-1",
    size: 5,
    values: [
      [9, 4, 7, 2, 6],
      [3, 8, 5, 9, 1],
      [6, 2, 9, 4, 8],
      [5, 7, 1, 6, 3],
      [8, 3, 4, 7, 2],
    ],
    solution: [
      [true, false, true, false, true],
      [false, true, false, true, false],
      [true, false, true, false, true],
      [false, true, true, false, false],
      [true, false, false, true, true],
    ],
  },
  {
    id: "sumplete-grid-hard-2",
    size: 5,
    values: [
      [7, 9, 3, 8, 2],
      [4, 6, 8, 1, 5],
      [9, 2, 5, 7, 3],
      [6, 4, 1, 9, 8],
      [3, 8, 7, 2, 6],
    ],
    solution: [
      [false, true, true, false, true],
      [true, false, true, false, true],
      [true, false, false, true, false],
      [false, true, false, true, true],
      [true, false, true, false, true],
    ],
  },
  {
    id: "sumplete-grid-hard-3",
    size: 5,
    values: [
      [8, 5, 9, 1, 7],
      [2, 7, 4, 8, 6],
      [5, 9, 3, 6, 2],
      [7, 1, 8, 4, 9],
      [6, 3, 2, 7, 5],
    ],
    solution: [
      [true, false, true, false, true],
      [false, true, false, true, false],
      [true, true, false, false, true],
      [false, false, true, true, false],
      [true, false, false, true, true],
    ],
  },
];

function calculateTargets(
  values: number[][],
  solution: boolean[][],
  axis: "row" | "col",
) {
  const size = values.length;
  return Array.from({ length: size }, (_, index) => {
    return Array.from({ length: size }, (_unused, innerIndex) => {
      const row = axis === "row" ? index : innerIndex;
      const col = axis === "row" ? innerIndex : index;
      return solution[row][col] ? values[row][col] : 0;
    }).reduce((sum, value) => sum + value, 0);
  });
}

function hydratePuzzle(puzzle: Omit<SumpleteGridPuzzle, "rowTargets" | "colTargets">): SumpleteGridPuzzle {
  return {
    ...puzzle,
    rowTargets: calculateTargets(puzzle.values, puzzle.solution, "row"),
    colTargets: calculateTargets(puzzle.values, puzzle.solution, "col"),
  };
}

export function cellKey(row: number, col: number) {
  return `${row}:${col}`;
}

export function getSumpleteGridPuzzlePool(difficulty: SumpleteGridDifficulty) {
  return (difficulty === "hard" ? HARD_PUZZLES : NORMAL_PUZZLES).map(hydratePuzzle);
}

export function createSumpleteGridPuzzle(difficulty: SumpleteGridDifficulty) {
  const pool = getSumpleteGridPuzzlePool(difficulty);
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? pool[0];
}

export function createSumpleteGridCells(puzzle: SumpleteGridPuzzle): SumpleteGridCell[] {
  return puzzle.values.flatMap((rowValues, row) =>
    rowValues.map((value, col) => ({
      row,
      col,
      value,
      state: "unknown" as const,
    })),
  );
}

export function cycleSumpleteCellState(state: SumpleteCellState): SumpleteCellState {
  if (state === "unknown") return "kept";
  if (state === "kept") return "removed";
  return "unknown";
}

export function evaluateSumpleteGrid(
  puzzle: SumpleteGridPuzzle,
  cells: SumpleteGridCell[],
): SumpleteGridEvaluation {
  const size = puzzle.size;
  const rowSums = Array.from({ length: size }, () => 0);
  const colSums = Array.from({ length: size }, () => 0);
  const wrongCellKeys: string[] = [];
  let complete = true;

  cells.forEach((cell) => {
    if (cell.state === "unknown") {
      complete = false;
      return;
    }

    if (cell.state === "kept") {
      rowSums[cell.row] += cell.value;
      colSums[cell.col] += cell.value;
    }

    const shouldKeep = puzzle.solution[cell.row][cell.col];
    if ((cell.state === "kept") !== shouldKeep) {
      wrongCellKeys.push(cellKey(cell.row, cell.col));
    }
  });

  const targetsMatch = rowSums.every((sum, index) => sum === puzzle.rowTargets[index])
    && colSums.every((sum, index) => sum === puzzle.colTargets[index]);

  return {
    complete,
    correct: complete && targetsMatch,
    rowSums,
    colSums,
    wrongCellKeys,
  };
}

export function scoreSumpleteGrid(params: {
  difficulty: SumpleteGridDifficulty;
  elapsedSeconds: number;
  mistakes: number;
}) {
  const elapsedSeconds = Number.isFinite(params.elapsedSeconds)
    ? Math.max(1, Math.floor(params.elapsedSeconds))
    : 999;
  const mistakes = Number.isFinite(params.mistakes) ? Math.max(0, Math.floor(params.mistakes)) : 0;
  const isHard = params.difficulty === "hard";
  const baseScore = isHard ? 34 : 28;
  const fastLimit = isHard ? 210 : 140;
  const steadyLimit = isHard ? 330 : 230;
  const speedBonus = elapsedSeconds <= fastLimit ? 8 : elapsedSeconds <= steadyLimit ? 4 : 0;
  const cleanBonus = mistakes === 0 ? 4 : 0;
  const penalty = mistakes * 4;
  const maxScore = isHard ? 50 : 40;

  return Math.max(8, Math.min(maxScore, baseScore + speedBonus + cleanBonus - penalty));
}
