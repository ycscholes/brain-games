import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type LoopLineDifficulty = TrainingDifficulty;
export type LoopLineEdgeDirection = "horizontal" | "vertical";

export interface LoopLineEdge {
  direction: LoopLineEdgeDirection;
  row: number;
  col: number;
}

export interface LoopLineClue {
  row: number;
  col: number;
  value: number;
}

export interface LoopLinePuzzle {
  id: string;
  difficulty: LoopLineDifficulty;
  size: number;
  clues: LoopLineClue[];
  solutionEdges: LoopLineEdge[];
}

export interface LoopLineState {
  selectedEdges: string[];
  blockedEdges: string[];
}

export interface LoopLineBoardStatus {
  selectedEdgeCount: number;
  unsatisfiedClueKeys: string[];
  overfilledClueKeys: string[];
  openNodeKeys: string[];
  branchNodeKeys: string[];
  solved: boolean;
}

export interface LoopLineScoreInput {
  difficulty: LoopLineDifficulty;
  elapsedSeconds: number;
  hintCount: number;
  completed: boolean;
}

interface LoopLineNode {
  row: number;
  col: number;
}

const NORMAL_PUZZLES = [
  createPuzzle(
    "loop-line-normal-1",
    "normal",
    5,
    [
      [0, 0], [0, 3], [1, 3], [1, 5], [4, 5], [4, 3],
      [5, 3], [5, 1], [3, 1], [3, 0], [0, 0],
    ],
    ["0:1", "0:2", "2:2", "2:3", "4:0", "4:2"],
  ),
  createPuzzle(
    "loop-line-normal-2",
    "normal",
    5,
    [
      [0, 1], [0, 4], [2, 4], [2, 5], [5, 5], [5, 2],
      [4, 2], [4, 0], [1, 0], [1, 1], [0, 1],
    ],
    ["0:0", "1:1", "2:1", "3:3", "4:3", "4:4"],
  ),
];

const HARD_PUZZLES = [
  createPuzzle(
    "loop-line-hard-1",
    "hard",
    6,
    [
      [0, 0], [0, 2], [1, 2], [1, 5], [0, 5], [0, 6],
      [4, 6], [4, 4], [5, 4], [5, 6], [6, 6], [6, 3],
      [4, 3], [4, 1], [6, 1], [6, 0], [3, 0], [3, 1], [1, 1], [1, 0], [0, 0],
    ],
    ["0:3", "1:3", "2:2", "2:4", "3:1", "3:3", "4:0", "4:5", "5:2", "5:4"],
  ),
  createPuzzle(
    "loop-line-hard-2",
    "hard",
    6,
    [
      [0, 0], [0, 4], [1, 4], [1, 6], [5, 6], [5, 5],
      [6, 5], [6, 2], [4, 2], [4, 1], [6, 1], [6, 0],
      [2, 0], [2, 2], [3, 2], [3, 4], [2, 4], [2, 3],
      [1, 3], [1, 0], [0, 0],
    ],
    ["0:1", "0:4", "1:2", "2:1", "2:4", "3:0", "3:3", "4:3", "5:1", "5:4"],
  ),
];

function clueKey(clue: Pick<LoopLineClue, "row" | "col">) {
  return `${clue.row}:${clue.col}`;
}

function nodeKey(node: LoopLineNode) {
  return `${node.row}:${node.col}`;
}

export function loopLineEdgeKey(edge: LoopLineEdge) {
  return `${edge.direction}:${edge.row}:${edge.col}`;
}

function edgeNodes(edge: LoopLineEdge): [LoopLineNode, LoopLineNode] {
  if (edge.direction === "horizontal") {
    return [{ row: edge.row, col: edge.col }, { row: edge.row, col: edge.col + 1 }];
  }
  return [{ row: edge.row, col: edge.col }, { row: edge.row + 1, col: edge.col }];
}

function edgesFromNodes(nodes: number[][]) {
  const edges: LoopLineEdge[] = [];

  for (let index = 0; index < nodes.length - 1; index += 1) {
    const [fromRow, fromCol] = nodes[index];
    const [toRow, toCol] = nodes[index + 1];
    if (fromRow !== toRow && fromCol !== toCol) {
      throw new Error("Loop line paths must use orthogonal segments.");
    }

    if (fromRow === toRow) {
      const start = Math.min(fromCol, toCol);
      const length = Math.abs(toCol - fromCol);
      for (let offset = 0; offset < length; offset += 1) {
        edges.push({ direction: "horizontal", row: fromRow, col: start + offset });
      }
    } else {
      const start = Math.min(fromRow, toRow);
      const length = Math.abs(toRow - fromRow);
      for (let offset = 0; offset < length; offset += 1) {
        edges.push({ direction: "vertical", row: start + offset, col: fromCol });
      }
    }
  }

  return edges;
}

function countClueEdges(row: number, col: number, selectedEdgeKeys: Set<string>) {
  const surroundingEdges: LoopLineEdge[] = [
    { direction: "horizontal", row, col },
    { direction: "horizontal", row: row + 1, col },
    { direction: "vertical", row, col },
    { direction: "vertical", row, col: col + 1 },
  ];
  return surroundingEdges.filter((edge) => selectedEdgeKeys.has(loopLineEdgeKey(edge))).length;
}

function createPuzzle(
  id: string,
  difficulty: LoopLineDifficulty,
  size: number,
  nodes: number[][],
  hiddenClueKeys: string[],
): LoopLinePuzzle {
  const solutionEdges = edgesFromNodes(nodes);
  const solutionEdgeKeys = new Set(solutionEdges.map(loopLineEdgeKey));
  const hiddenClues = new Set(hiddenClueKeys);
  const clues: LoopLineClue[] = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const key = `${row}:${col}`;
      if (hiddenClues.has(key)) continue;
      clues.push({ row, col, value: countClueEdges(row, col, solutionEdgeKeys) });
    }
  }

  return { id, difficulty, size, clues, solutionEdges };
}

export function createLoopLineState(): LoopLineState {
  return { selectedEdges: [], blockedEdges: [] };
}

export function getLoopLinePuzzlePool(difficulty: LoopLineDifficulty) {
  return difficulty === "hard" ? HARD_PUZZLES : NORMAL_PUZZLES;
}

export function createLoopLinePuzzle(difficulty: LoopLineDifficulty) {
  const pool = getLoopLinePuzzlePool(difficulty);
  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
}

export function cycleLoopLineEdge(state: LoopLineState, edge: LoopLineEdge): LoopLineState {
  const key = loopLineEdgeKey(edge);
  if (state.selectedEdges.includes(key)) {
    return {
      selectedEdges: state.selectedEdges.filter((item) => item !== key),
      blockedEdges: [...state.blockedEdges, key],
    };
  }
  if (state.blockedEdges.includes(key)) {
    return {
      selectedEdges: state.selectedEdges,
      blockedEdges: state.blockedEdges.filter((item) => item !== key),
    };
  }
  return { selectedEdges: [...state.selectedEdges, key], blockedEdges: state.blockedEdges };
}

export function getLoopLineBoardStatus(puzzle: LoopLinePuzzle, state: LoopLineState): LoopLineBoardStatus {
  const selectedEdgeKeys = new Set(state.selectedEdges);
  const nodeDegrees = new Map<string, number>();
  const nodeNeighbors = new Map<string, Set<string>>();

  state.selectedEdges.forEach((key) => {
    const edge = puzzle.solutionEdges.find((item) => loopLineEdgeKey(item) === key)
      ?? parseLoopLineEdgeKey(key);
    if (!edge) return;
    const [from, to] = edgeNodes(edge);
    const fromKey = nodeKey(from);
    const toKey = nodeKey(to);
    nodeDegrees.set(fromKey, (nodeDegrees.get(fromKey) ?? 0) + 1);
    nodeDegrees.set(toKey, (nodeDegrees.get(toKey) ?? 0) + 1);
    if (!nodeNeighbors.has(fromKey)) nodeNeighbors.set(fromKey, new Set());
    if (!nodeNeighbors.has(toKey)) nodeNeighbors.set(toKey, new Set());
    nodeNeighbors.get(fromKey)?.add(toKey);
    nodeNeighbors.get(toKey)?.add(fromKey);
  });

  const unsatisfiedClueKeys = puzzle.clues
    .filter((clue) => countClueEdges(clue.row, clue.col, selectedEdgeKeys) !== clue.value)
    .map(clueKey);
  const overfilledClueKeys = puzzle.clues
    .filter((clue) => countClueEdges(clue.row, clue.col, selectedEdgeKeys) > clue.value)
    .map(clueKey);
  const openNodeKeys = [...nodeDegrees.entries()]
    .filter(([, degree]) => degree === 1)
    .map(([key]) => key);
  const branchNodeKeys = [...nodeDegrees.entries()]
    .filter(([, degree]) => degree > 2)
    .map(([key]) => key);
  const activeNodes = [...nodeDegrees.keys()];
  const allNodesDegreeTwo = activeNodes.length > 0 && activeNodes.every((key) => nodeDegrees.get(key) === 2);
  const visited = new Set<string>();

  if (activeNodes[0]) {
    const queue = [activeNodes[0]];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      nodeNeighbors.get(current)?.forEach((neighbor) => {
        if (!visited.has(neighbor)) queue.push(neighbor);
      });
    }
  }

  return {
    selectedEdgeCount: state.selectedEdges.length,
    unsatisfiedClueKeys,
    overfilledClueKeys,
    openNodeKeys,
    branchNodeKeys,
    solved: allNodesDegreeTwo && visited.size === activeNodes.length && unsatisfiedClueKeys.length === 0,
  };
}

function parseLoopLineEdgeKey(key: string): LoopLineEdge | null {
  const [direction, rawRow, rawCol] = key.split(":");
  const row = Number(rawRow);
  const col = Number(rawCol);
  if ((direction !== "horizontal" && direction !== "vertical") || !Number.isInteger(row) || !Number.isInteger(col)) {
    return null;
  }
  return { direction, row, col };
}

export function getLoopLineHint(puzzle: LoopLinePuzzle, state: LoopLineState) {
  const selectedEdgeKeys = new Set(state.selectedEdges);
  return puzzle.solutionEdges.find((edge) => !selectedEdgeKeys.has(loopLineEdgeKey(edge))) ?? null;
}

export function scoreLoopLineGame(input: LoopLineScoreInput) {
  if (!input.completed) return 0;
  const baseScore = input.difficulty === "hard" ? 50 : 40;
  const bonusTime = input.difficulty === "hard" ? 150 : 90;
  const timePenalty = Math.floor(Math.max(0, input.elapsedSeconds - bonusTime) / 20) * 2;
  const hintPenalty = Math.max(0, input.hintCount) * 4;
  const minimumScore = input.difficulty === "hard" ? 16 : 12;
  return Math.max(minimumScore, baseScore - timePenalty - hintPenalty);
}
