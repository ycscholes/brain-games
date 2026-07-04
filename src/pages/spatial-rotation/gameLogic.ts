import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type SpatialRotationDifficulty = TrainingDifficulty;
export type SpatialRotationCell = [number, number];

export interface SpatialRotationOption {
  id: string;
  cells: SpatialRotationCell[];
}

export interface SpatialRotationPuzzle {
  id: string;
  targetCells: SpatialRotationCell[];
  options: SpatialRotationOption[];
  answerOptionId: string;
  timeLimitMs: number;
}

export interface SpatialRotationResult {
  correct: boolean;
  speedBonus: number;
  comboBonus: number;
  score: number;
}

export const SPATIAL_ROTATION_GRID_SIZE = 4;
export const SPATIAL_ROTATION_TOTAL_PUZZLES = 8;

const TIME_LIMIT_MS: Record<SpatialRotationDifficulty, number[]> = {
  normal: [7200, 7000, 6800, 6600, 6400, 6200, 6000, 5800],
  hard: [6000, 5800, 5600, 5400, 5200, 5000, 4800, 4600],
};

const BASE_SHAPES: SpatialRotationCell[][] = [
  [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1]],
  [[0, 1], [1, 1], [1, 2], [2, 0], [2, 1]],
  [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2]],
  [[0, 2], [1, 0], [1, 1], [1, 2], [2, 0]],
  [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]],
];

function clampPuzzleIndex(puzzleIndex: number) {
  return Math.max(0, Math.min(SPATIAL_ROTATION_TOTAL_PUZZLES - 1, puzzleIndex));
}

function sortCells(cells: SpatialRotationCell[]) {
  return [...cells].sort((left, right) => left[0] - right[0] || left[1] - right[1]);
}

export function normalizeCells(cells: SpatialRotationCell[]): SpatialRotationCell[] {
  const minRow = Math.min(...cells.map(([row]) => row));
  const minCol = Math.min(...cells.map(([, col]) => col));
  return sortCells(cells.map(([row, col]) => [row - minRow, col - minCol]));
}

export function rotateCells(cells: SpatialRotationCell[], turns: number): SpatialRotationCell[] {
  const safeTurns = ((turns % 4) + 4) % 4;
  let nextCells = cells;

  for (let turn = 0; turn < safeTurns; turn += 1) {
    nextCells = nextCells.map(([row, col]) => [col, SPATIAL_ROTATION_GRID_SIZE - 1 - row]);
  }

  return normalizeCells(nextCells);
}

export function mirrorCells(cells: SpatialRotationCell[]): SpatialRotationCell[] {
  return normalizeCells(cells.map(([row, col]) => [row, SPATIAL_ROTATION_GRID_SIZE - 1 - col]));
}

export function cellsKey(cells: SpatialRotationCell[]) {
  return normalizeCells(cells).map(([row, col]) => `${row}:${col}`).join("|");
}

export function getSpatialRotationTimeLimitMs(
  difficulty: SpatialRotationDifficulty,
  puzzleIndex: number,
) {
  return TIME_LIMIT_MS[difficulty][clampPuzzleIndex(puzzleIndex)];
}

function getBaseShape(puzzleIndex: number) {
  return BASE_SHAPES[puzzleIndex % BASE_SHAPES.length];
}

function createOption(id: string, cells: SpatialRotationCell[]): SpatialRotationOption {
  return { id, cells: normalizeCells(cells) };
}

export function createSpatialRotationPuzzle(
  difficulty: SpatialRotationDifficulty,
  puzzleIndex: number,
): SpatialRotationPuzzle {
  const safePuzzleIndex = clampPuzzleIndex(puzzleIndex);
  const baseShape = getBaseShape(safePuzzleIndex);
  const answerTurns = (safePuzzleIndex % 3) + 1;
  const answerOption = createOption("match", rotateCells(baseShape, answerTurns));
  const mirrored = mirrorCells(baseShape);
  const decoyShape = getBaseShape(safePuzzleIndex + (difficulty === "hard" ? 2 : 1));
  const options = [
    answerOption,
    createOption("mirror", rotateCells(mirrored, answerTurns + 1)),
    createOption("neighbor", rotateCells(decoyShape, answerTurns + 2)),
    createOption("flipped-neighbor", rotateCells(mirrorCells(decoyShape), answerTurns + 3)),
  ];
  const rotation = (safePuzzleIndex + (difficulty === "hard" ? 2 : 1)) % options.length;
  const shuffledOptions = [
    ...options.slice(rotation),
    ...options.slice(0, rotation),
  ];

  return {
    id: `spatial-rotation-${difficulty}-${safePuzzleIndex + 1}`,
    targetCells: normalizeCells(baseShape),
    options: shuffledOptions,
    answerOptionId: answerOption.id,
    timeLimitMs: getSpatialRotationTimeLimitMs(difficulty, safePuzzleIndex),
  };
}

export function createSpatialRotationSession(difficulty: SpatialRotationDifficulty) {
  return Array.from({ length: SPATIAL_ROTATION_TOTAL_PUZZLES }, (_, index) =>
    createSpatialRotationPuzzle(difficulty, index),
  );
}

export function scoreSpatialRotationPuzzle(params: {
  selectedOptionId: string;
  answerOptionId: string;
  answerMs: number;
  currentCombo: number;
}): SpatialRotationResult {
  const correct = params.selectedOptionId === params.answerOptionId;
  if (!correct) {
    return {
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      score: 0,
    };
  }

  const speedBonus = params.answerMs <= 2600 ? 1 : 0;
  const comboBonus = params.currentCombo >= 2 ? 1 : 0;

  return {
    correct: true,
    speedBonus,
    comboBonus,
    score: 4 + speedBonus + comboBonus,
  };
}
