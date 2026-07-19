import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type TentsCampDifficulty = TrainingDifficulty;

export interface TentsCampCoord {
  row: number;
  col: number;
}

export interface TentsCampPuzzle {
  id: string;
  size: number;
  trees: TentsCampCoord[];
  tents: TentsCampCoord[];
  rowCounts: number[];
  colCounts: number[];
  timeLimitMs: number;
}

export interface TentsCampResult {
  correct: boolean;
  score: number;
  matchedTents: number;
}

export const TENTS_CAMP_TOTAL_PUZZLES = 4;

const PUZZLES: Record<TentsCampDifficulty, TentsCampPuzzle[]> = {
  normal: [
    createPuzzle("tents-normal-1", 6, [[0, 0], [1, 3], [2, 0], [4, 2], [5, 4]], [[0, 1], [1, 4], [3, 0], [4, 3], [5, 5]], 28000),
    createPuzzle("tents-normal-2", 6, [[0, 3], [2, 2], [3, 4], [5, 3], [4, 0]], [[0, 4], [2, 1], [3, 5], [4, 3], [5, 0]], 28000),
    createPuzzle("tents-normal-3", 6, [[0, 2], [1, 5], [3, 1], [4, 4], [5, 2]], [[0, 1], [2, 5], [3, 0], [4, 3], [5, 1]], 28000),
    createPuzzle("tents-normal-4", 6, [[0, 5], [1, 1], [2, 4], [4, 1], [5, 4]], [[0, 4], [1, 0], [3, 4], [4, 2], [5, 5]], 28000),
  ],
  hard: [
    createPuzzle("tents-hard-1", 7, [[0, 0], [1, 4], [3, 3], [4, 1], [4, 6], [6, 3]], [[0, 1], [1, 5], [2, 3], [4, 0], [5, 6], [6, 2]], 24000),
    createPuzzle("tents-hard-2", 7, [[0, 3], [1, 0], [2, 5], [3, 2], [5, 1], [6, 5]], [[0, 4], [1, 1], [2, 6], [3, 3], [5, 0], [6, 4]], 24000),
    createPuzzle("tents-hard-3", 7, [[0, 1], [1, 5], [2, 2], [4, 0], [5, 4], [6, 2]], [[0, 0], [1, 6], [2, 3], [4, 1], [5, 5], [6, 3]], 24000),
    createPuzzle("tents-hard-4", 7, [[0, 5], [1, 2], [2, 6], [3, 0], [5, 3], [6, 1]], [[0, 6], [1, 1], [3, 6], [4, 0], [5, 4], [6, 2]], 24000),
  ],
};

function createPuzzle(
  id: string,
  size: number,
  treePairs: number[][],
  tentPairs: number[][],
  timeLimitMs: number,
): TentsCampPuzzle {
  const trees = treePairs.map(([row, col]) => ({ row, col }));
  const tents = tentPairs.map(([row, col]) => ({ row, col }));
  return {
    id,
    size,
    trees,
    tents,
    rowCounts: countByAxis(tents, size, "row"),
    colCounts: countByAxis(tents, size, "col"),
    timeLimitMs,
  };
}

function countByAxis(coords: TentsCampCoord[], size: number, axis: "row" | "col") {
  const counts = Array.from({ length: size }, () => 0);
  coords.forEach((coord) => {
    counts[coord[axis]] += 1;
  });
  return counts;
}

export function coordKey(coord: TentsCampCoord) {
  return `${coord.row}:${coord.col}`;
}

export function createTentsCampSession(difficulty: TentsCampDifficulty) {
  return PUZZLES[difficulty].slice(0, TENTS_CAMP_TOTAL_PUZZLES);
}

export function isTreeCell(puzzle: TentsCampPuzzle, coord: TentsCampCoord) {
  return puzzle.trees.some((tree) => tree.row === coord.row && tree.col === coord.col);
}

export function isTentSolutionCell(puzzle: TentsCampPuzzle, coord: TentsCampCoord) {
  return puzzle.tents.some((tent) => tent.row === coord.row && tent.col === coord.col);
}

export function countSelectedByAxis(
  selectedTents: TentsCampCoord[],
  size: number,
  axis: "row" | "col",
) {
  return countByAxis(selectedTents, size, axis);
}

export function scoreTentsCampPuzzle(input: {
  puzzle: TentsCampPuzzle;
  selectedTents: TentsCampCoord[];
  answerMs: number;
  currentCombo: number;
}): TentsCampResult {
  const solutionKeys = new Set(input.puzzle.tents.map(coordKey));
  const selectedKeys = new Set(input.selectedTents.map(coordKey));
  const matchedTents = input.selectedTents.filter((coord) => solutionKeys.has(coordKey(coord))).length;
  const correct = solutionKeys.size === selectedKeys.size
    && [...solutionKeys].every((key) => selectedKeys.has(key));

  if (!correct) {
    return {
      correct,
      score: 0,
      matchedTents,
    };
  }

  const speedBonus = input.answerMs <= input.puzzle.timeLimitMs * 0.55 ? 2 : input.answerMs <= input.puzzle.timeLimitMs * 0.8 ? 1 : 0;
  const comboBonus = input.currentCombo >= 2 ? 1 : 0;
  return {
    correct,
    score: 7 + speedBonus + comboBonus,
    matchedTents,
  };
}
