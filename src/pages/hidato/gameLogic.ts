import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type HidatoDifficulty = TrainingDifficulty;

export interface HidatoConfig {
  rows: number;
  cols: number;
  hiddenMin: number;
  hiddenMax: number;
  anchorEvery: number;
  bonusTimeSeconds: number;
}

export interface HidatoCell {
  id: string;
  row: number;
  col: number;
  value: number;
  given: boolean;
}

export interface HidatoPuzzle {
  id: string;
  difficulty: HidatoDifficulty;
  rows: number;
  cols: number;
  total: number;
  cells: HidatoCell[];
  path: HidatoCell[];
  givenValues: number[];
}

export interface HidatoClickState {
  nextValue: number;
  clickedValues: number[];
  mistakeCount: number;
  hintCount: number;
}

export interface HidatoClickResult {
  state: HidatoClickState;
  correct: boolean;
  completed: boolean;
}

export interface HidatoLineSegment {
  fromValue: number;
  toValue: number;
  left: number;
  top: number;
  width: number;
  angle: number;
}

export interface HidatoScoreInput {
  difficulty: HidatoDifficulty;
  completed: boolean;
  elapsedSeconds: number;
  mistakeCount: number;
  hintCount: number;
}

type Position = {
  row: number;
  col: number;
};

export const HIDATO_CONFIG: Record<HidatoDifficulty, HidatoConfig> = {
  normal: {
    rows: 8,
    cols: 5,
    hiddenMin: 0.4,
    hiddenMax: 0.4,
    anchorEvery: 3,
    bonusTimeSeconds: 210,
  },
  hard: {
    rows: 10,
    cols: 6,
    hiddenMin: 0.4,
    hiddenMax: 0.5,
    anchorEvery: 4,
    bonusTimeSeconds: 270,
  },
};

const MAX_LOCAL_SOLUTIONS = 2;
const MAX_RANDOM_PATH_ATTEMPTS = 80;
const MAX_RANDOM_WALK_RESTARTS = 24;

function cellId(row: number, col: number) {
  return `r${row}c${col}`;
}

function randomInt(maxExclusive: number) {
  return Math.floor(Math.random() * maxExclusive);
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = randomInt(index + 1);
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

export function areHidatoNeighbors(a: Pick<HidatoCell, "row" | "col">, b: Pick<HidatoCell, "row" | "col">) {
  const rowDelta = Math.abs(a.row - b.row);
  const colDelta = Math.abs(a.col - b.col);
  return rowDelta <= 1 && colDelta <= 1 && rowDelta + colDelta > 0;
}

function inBounds(position: Position, rows: number, cols: number) {
  return position.row >= 0 && position.row < rows && position.col >= 0 && position.col < cols;
}

function getNeighborPositions(position: Position, rows: number, cols: number) {
  const neighbors: Position[] = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const next = {
        row: position.row + rowOffset,
        col: position.col + colOffset,
      };
      if (inBounds(next, rows, cols)) {
        neighbors.push(next);
      }
    }
  }

  return neighbors;
}

function createSerpentinePath(rows: number, cols: number) {
  const path: Position[] = [];
  const useRows = Math.random() < 0.5;

  if (useRows) {
    const topToBottom = Math.random() < 0.5;
    const leftToRightFirst = Math.random() < 0.5;
    const rowIndexes = Array.from({ length: rows }, (_, index) => topToBottom ? index : rows - 1 - index);

    rowIndexes.forEach((row, rowOrder) => {
      const leftToRight = rowOrder % 2 === 0 ? leftToRightFirst : !leftToRightFirst;
      const colIndexes = Array.from({ length: cols }, (_, index) => leftToRight ? index : cols - 1 - index);
      colIndexes.forEach((col) => {
        path.push({ row, col });
      });
    });
  } else {
    const leftToRight = Math.random() < 0.5;
    const topToBottomFirst = Math.random() < 0.5;
    const colIndexes = Array.from({ length: cols }, (_, index) => leftToRight ? index : cols - 1 - index);

    colIndexes.forEach((col, colOrder) => {
      const topToBottom = colOrder % 2 === 0 ? topToBottomFirst : !topToBottomFirst;
      const rowIndexes = Array.from({ length: rows }, (_, index) => topToBottom ? index : rows - 1 - index);
      rowIndexes.forEach((row) => {
        path.push({ row, col });
      });
    });
  }

  return path;
}

function createRandomHamiltonianPath(rows: number, cols: number): Position[] {
  const total = rows * cols;

  for (let attempt = 0; attempt < MAX_RANDOM_PATH_ATTEMPTS; attempt += 1) {
    const start = { row: randomInt(rows), col: randomInt(cols) };
    const path: Position[] = [start];
    const visited = new Set([cellId(start.row, start.col)]);

    function onwardDegree(position: Position) {
      return getNeighborPositions(position, rows, cols)
        .filter((neighbor) => !visited.has(cellId(neighbor.row, neighbor.col)))
        .length;
    }

    let restarted = false;

    while (path.length < total) {
      const current = path[path.length - 1];
      const candidates = shuffle(getNeighborPositions(current, rows, cols))
        .filter((neighbor) => !visited.has(cellId(neighbor.row, neighbor.col)))
        .sort((a, b) => onwardDegree(a) - onwardDegree(b));

      if (candidates.length === 0) {
        restarted = true;
        break;
      }

      const lowestDegree = onwardDegree(candidates[0]);
      const bestCandidates = candidates.filter((candidate) => onwardDegree(candidate) === lowestDegree);
      const next = bestCandidates[randomInt(bestCandidates.length)];
      visited.add(cellId(next.row, next.col));
      path.push(next);
    }

    if (!restarted && path.length === total) {
      return path;
    }
  }

  for (let restart = 0; restart < MAX_RANDOM_WALK_RESTARTS; restart += 1) {
    const start = { row: randomInt(rows), col: randomInt(cols) };
    const path: Position[] = [start];
    const visited = new Set([cellId(start.row, start.col)]);

    while (path.length < total) {
      const current = path[path.length - 1];
      const candidates = shuffle(getNeighborPositions(current, rows, cols))
        .filter((neighbor) => !visited.has(cellId(neighbor.row, neighbor.col)));

      if (candidates.length === 0) break;

      const next = candidates[0];
      visited.add(cellId(next.row, next.col));
      path.push(next);
    }

    if (path.length === total) {
      return path;
    }
  }

  return createSerpentinePath(rows, cols);
}

function valueToCellMap(cells: HidatoCell[]) {
  return new Map(cells.map((cell) => [cell.value, cell]));
}

function countLocalSegmentSolutions(
  cells: HidatoCell[],
  fromValue: number,
  toValue: number,
  rows: number,
  cols: number,
) {
  const byValue = valueToCellMap(cells);
  const fromCell = byValue.get(fromValue);
  const toCell = byValue.get(toValue);
  if (!fromCell || !toCell || toValue <= fromValue) return 0;

  const endCell = toCell;
  const requiredSteps = toValue - fromValue;
  const allowedCellIds = new Set(
    Array.from({ length: requiredSteps + 1 }, (_, index) => byValue.get(fromValue + index))
      .filter((cell): cell is HidatoCell => Boolean(cell))
      .map((cell) => cell.id),
  );
  let solutions = 0;
  const visited = new Set([cellId(fromCell.row, fromCell.col)]);

  function search(position: Position, remainingSteps: number) {
    if (solutions >= MAX_LOCAL_SOLUTIONS) return;
    if (remainingSteps === 0) {
      if (position.row === endCell.row && position.col === endCell.col) {
        solutions += 1;
      }
      return;
    }

    const distanceToEnd = Math.max(Math.abs(position.row - endCell.row), Math.abs(position.col - endCell.col));
    if (distanceToEnd > remainingSteps) return;

    getNeighborPositions(position, rows, cols).forEach((neighbor) => {
      const key = cellId(neighbor.row, neighbor.col);
      if (!allowedCellIds.has(key)) return;
      const isEnd = neighbor.row === endCell.row && neighbor.col === endCell.col;
      if (visited.has(key) && !isEnd) return;
      if (isEnd && remainingSteps !== 1) return;

      visited.add(key);
      search(neighbor, remainingSteps - 1);
      visited.delete(key);
    });
  }

  search(fromCell, requiredSteps);
  return solutions;
}

export function hasLocallyUniqueRevealedPath(puzzle: Pick<HidatoPuzzle, "cells" | "givenValues" | "rows" | "cols">) {
  const anchors = [...puzzle.givenValues].sort((a, b) => a - b);

  for (let index = 0; index < anchors.length - 1; index += 1) {
    if (anchors[index + 1] - anchors[index] <= 1) continue;
    if (countLocalSegmentSolutions(puzzle.cells, anchors[index], anchors[index + 1], puzzle.rows, puzzle.cols) !== 1) {
      return false;
    }
  }

  return true;
}

function getTargetVisibleCount(total: number, config: HidatoConfig) {
  const targetHidden = config.hiddenMin + Math.random() * (config.hiddenMax - config.hiddenMin);
  return Math.max(2, Math.floor(total * (1 - targetHidden)));
}

function createGivenValues(total: number, config: HidatoConfig, cells: HidatoCell[], rows: number, cols: number) {
  const targetVisibleCount = getTargetVisibleCount(total, config);
  const maxVisibleCount = Math.floor(total * (1 - config.hiddenMin));
  const givenValues = new Set([1, total]);

  for (let value = 1; value <= total; value += config.anchorEvery) {
    givenValues.add(value);
  }

  while (givenValues.size < targetVisibleCount) {
    givenValues.add(1 + randomInt(total));
  }

  let sorted = [...givenValues].sort((a, b) => a - b);
  let guard = 0;

  while (
    guard < total &&
    sorted.length < maxVisibleCount &&
    !hasLocallyUniqueRevealedPath({ cells, givenValues: sorted, rows, cols })
  ) {
    guard += 1;
    for (let index = 0; index < sorted.length - 1; index += 1) {
      if (givenValues.size >= maxVisibleCount) break;
      const fromValue = sorted[index];
      const toValue = sorted[index + 1];
      if (toValue - fromValue <= 1) continue;
      if (countLocalSegmentSolutions(cells, fromValue, toValue, rows, cols) !== 1) {
        givenValues.add(Math.floor((fromValue + toValue) / 2));
      }
    }
    sorted = [...givenValues].sort((a, b) => a - b);
  }

  return sorted;
}

export function createHidatoPuzzle(difficulty: HidatoDifficulty): HidatoPuzzle {
  const config = HIDATO_CONFIG[difficulty];
  const total = config.rows * config.cols;
  const pathPositions = createRandomHamiltonianPath(config.rows, config.cols);
  const baseCells = pathPositions.map((position, index) => ({
    id: cellId(position.row, position.col),
    row: position.row,
    col: position.col,
    value: index + 1,
    given: false,
  }));
  const givenValues = createGivenValues(total, config, baseCells, config.rows, config.cols);
  const givenValueSet = new Set(givenValues);
  const cells = baseCells
    .map((cell) => ({
      ...cell,
      given: givenValueSet.has(cell.value),
    }))
    .sort((a, b) => a.row === b.row ? a.col - b.col : a.row - b.row);

  return {
    id: `hidato-${difficulty}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    difficulty,
    rows: config.rows,
    cols: config.cols,
    total,
    cells,
    path: [...cells].sort((a, b) => a.value - b.value),
    givenValues,
  };
}

export function createInitialClickState(): HidatoClickState {
  return {
    nextValue: 1,
    clickedValues: [],
    mistakeCount: 0,
    hintCount: 0,
  };
}

export function applyHidatoCellClick(state: HidatoClickState, cell: Pick<HidatoCell, "value">, total: number): HidatoClickResult {
  if (cell.value !== state.nextValue) {
    return {
      state: {
        ...state,
        mistakeCount: state.mistakeCount + 1,
      },
      correct: false,
      completed: false,
    };
  }

  const clickedValues = [...state.clickedValues, cell.value];
  const nextValue = cell.value + 1;

  return {
    state: {
      ...state,
      clickedValues,
      nextValue,
    },
    correct: true,
    completed: clickedValues.length === total,
  };
}

export function applyHidatoHint(state: HidatoClickState): HidatoClickState {
  return {
    ...state,
    hintCount: state.hintCount + 1,
  };
}

export function createHidatoLineSegments(puzzle: Pick<HidatoPuzzle, "path" | "rows" | "cols">, clickedValues: number[]) {
  const clickedSet = new Set(clickedValues);
  const byValue = valueToCellMap(puzzle.path);
  const segments: HidatoLineSegment[] = [];

  for (let value = 2; value <= clickedValues.length; value += 1) {
    if (!clickedSet.has(value - 1) || !clickedSet.has(value)) continue;
    const fromCell = byValue.get(value - 1);
    const toCell = byValue.get(value);
    if (!fromCell || !toCell) continue;

    const fromX = fromCell.col + 0.5;
    const fromY = fromCell.row + 0.5;
    const toX = toCell.col + 0.5;
    const toY = toCell.row + 0.5;
    const deltaX = toX - fromX;
    const deltaY = toY - fromY;

    segments.push({
      fromValue: value - 1,
      toValue: value,
      left: (fromX / puzzle.cols) * 100,
      top: (fromY / puzzle.rows) * 100,
      width: (Math.sqrt(deltaX * deltaX + deltaY * deltaY) / puzzle.cols) * 100,
      angle: Math.atan2(deltaY, deltaX) * 180 / Math.PI,
    });
  }

  return segments;
}

export function validateHidatoPath(puzzle: Pick<HidatoPuzzle, "path" | "total">) {
  if (puzzle.path.length !== puzzle.total) return false;

  for (let index = 1; index < puzzle.path.length; index += 1) {
    if (puzzle.path[index].value !== index + 1) return false;
    if (!areHidatoNeighbors(puzzle.path[index - 1], puzzle.path[index])) return false;
  }

  return puzzle.path[0]?.value === 1;
}

export function getHidatoHiddenRatio(puzzle: Pick<HidatoPuzzle, "cells">) {
  const hiddenCount = puzzle.cells.filter((cell) => !cell.given).length;
  return hiddenCount / puzzle.cells.length;
}

export function scoreHidatoGame(input: HidatoScoreInput) {
  if (!input.completed) return 0;

  const config = HIDATO_CONFIG[input.difficulty];
  const baseScore = input.difficulty === "hard" ? 34 : 28;
  const speedBonus = Math.max(0, Math.round((config.bonusTimeSeconds - input.elapsedSeconds) / 30));
  const cleanBonus = Math.max(0, 8 - input.mistakeCount * 2 - input.hintCount * 3);
  const maxScore = input.difficulty === "hard" ? 50 : 40;

  return Math.max(1, Math.min(maxScore, baseScore + speedBonus + cleanBonus));
}
