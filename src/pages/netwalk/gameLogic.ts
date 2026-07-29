import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type NetwalkDirection = "up" | "right" | "down" | "left";

export interface NetwalkTile {
  id: string;
  row: number;
  col: number;
  isServer: boolean;
  connections: NetwalkDirection[];
}

export interface NetwalkTemplate {
  id: string;
  difficulty: TrainingDifficulty;
  size: number;
  serverId: string;
  edges: Array<[string, string]>;
}

export interface NetwalkPuzzle {
  id: string;
  difficulty: TrainingDifficulty;
  size: number;
  solutionTiles: NetwalkTile[];
  initialTiles: NetwalkTile[];
  minimumMoves: number;
}

export interface NetwalkState {
  tiles: NetwalkTile[];
  moveCount: number;
}

export interface NetwalkHint {
  tileId: string;
}

export interface NetwalkScoreInput {
  difficulty: TrainingDifficulty;
  elapsedSeconds: number;
  moveCount: number;
  minimumMoves: number;
  hintCount: number;
  completed: boolean;
}

const DIRECTION_ORDER: NetwalkDirection[] = ["up", "right", "down", "left"];

const OPPOSITE_DIRECTION: Record<NetwalkDirection, NetwalkDirection> = {
  up: "down",
  right: "left",
  down: "up",
  left: "right",
};

const DIRECTION_OFFSET: Record<NetwalkDirection, [number, number]> = {
  up: [-1, 0],
  right: [0, 1],
  down: [1, 0],
  left: [0, -1],
};

const NORMAL_EDGES: Array<[string, string]> = [
  ["0-0", "0-1"], ["0-0", "1-0"], ["0-1", "0-2"], ["0-2", "0-3"],
  ["0-2", "1-2"], ["1-2", "1-1"], ["1-2", "1-3"], ["1-2", "2-2"],
  ["1-0", "2-0"], ["2-0", "2-1"], ["2-1", "3-1"], ["3-1", "3-0"],
  ["2-2", "2-3"], ["2-3", "3-3"], ["3-3", "3-2"],
];

const HARD_EDGES: Array<[string, string]> = [
  ["2-2", "1-2"], ["1-2", "0-2"], ["0-2", "0-1"], ["0-1", "0-0"],
  ["0-2", "0-3"], ["0-3", "0-4"], ["2-2", "2-1"], ["2-1", "2-0"],
  ["2-0", "1-0"], ["1-0", "1-1"], ["2-2", "2-3"], ["2-3", "2-4"],
  ["2-4", "1-4"], ["1-4", "1-3"], ["2-2", "3-2"], ["3-2", "4-2"],
  ["4-2", "4-1"], ["4-1", "4-0"], ["4-2", "4-3"], ["4-3", "4-4"],
  ["3-2", "3-1"], ["3-1", "3-0"], ["3-2", "3-3"], ["3-3", "3-4"],
];

function parseTileId(id: string): [number, number] {
  const [row, col] = id.split("-").map(Number);
  return [row, col];
}

function toTileId(row: number, col: number) {
  return `${row}-${col}`;
}

function transformTileId(id: string, size: number, transform: "identity" | "flip" | "turn") {
  const [row, col] = parseTileId(id);
  if (transform === "flip") return toTileId(row, size - 1 - col);
  if (transform === "turn") return toTileId(size - 1 - row, size - 1 - col);
  return id;
}

function createTemplate(
  id: string,
  difficulty: TrainingDifficulty,
  size: number,
  serverId: string,
  edges: Array<[string, string]>,
  transform: "identity" | "flip" | "turn",
): NetwalkTemplate {
  return {
    id,
    difficulty,
    size,
    serverId: transformTileId(serverId, size, transform),
    edges: edges.map(([first, second]) => [
      transformTileId(first, size, transform),
      transformTileId(second, size, transform),
    ]),
  };
}

export const NETWALK_TEMPLATES: NetwalkTemplate[] = [
  createTemplate("netwalk-normal-a", "normal", 4, "0-0", NORMAL_EDGES, "identity"),
  createTemplate("netwalk-normal-b", "normal", 4, "0-0", NORMAL_EDGES, "flip"),
  createTemplate("netwalk-normal-c", "normal", 4, "0-0", NORMAL_EDGES, "turn"),
  createTemplate("netwalk-hard-a", "hard", 5, "2-2", HARD_EDGES, "identity"),
  createTemplate("netwalk-hard-b", "hard", 5, "2-2", HARD_EDGES, "flip"),
  createTemplate("netwalk-hard-c", "hard", 5, "2-2", HARD_EDGES, "turn"),
];

function sortConnections(connections: NetwalkDirection[]) {
  return [...connections].sort((first, second) => (
    DIRECTION_ORDER.indexOf(first) - DIRECTION_ORDER.indexOf(second)
  ));
}

function rotateConnections(connections: NetwalkDirection[]) {
  return sortConnections(connections.map((direction) => {
    const index = DIRECTION_ORDER.indexOf(direction);
    return DIRECTION_ORDER[(index + 1) % DIRECTION_ORDER.length];
  }));
}

function connectionKey(connections: NetwalkDirection[]) {
  return sortConnections(connections).join("|");
}

function getDirection(fromId: string, toId: string): NetwalkDirection {
  const [fromRow, fromCol] = parseTileId(fromId);
  const [toRow, toCol] = parseTileId(toId);
  if (toRow === fromRow - 1 && toCol === fromCol) return "up";
  if (toRow === fromRow && toCol === fromCol + 1) return "right";
  if (toRow === fromRow + 1 && toCol === fromCol) return "down";
  return "left";
}

function createSolutionTiles(template: NetwalkTemplate) {
  const connectionMap = new Map<string, NetwalkDirection[]>();
  for (let row = 0; row < template.size; row += 1) {
    for (let col = 0; col < template.size; col += 1) {
      connectionMap.set(toTileId(row, col), []);
    }
  }

  template.edges.forEach(([first, second]) => {
    connectionMap.get(first)?.push(getDirection(first, second));
    connectionMap.get(second)?.push(getDirection(second, first));
  });

  return Array.from(connectionMap.entries()).map(([id, connections]) => {
    const [row, col] = parseTileId(id);
    return {
      id,
      row,
      col,
      isServer: id === template.serverId,
      connections: sortConnections(connections),
    };
  });
}

function getTemplateSeed(id: string) {
  return Array.from(id).reduce((seed, character) => seed + character.charCodeAt(0), 0);
}

function rotateTileTimes(tile: NetwalkTile, count: number) {
  let connections = tile.connections;
  for (let index = 0; index < count; index += 1) {
    connections = rotateConnections(connections);
  }
  return { ...tile, connections };
}

export function createNetwalkPuzzle(difficulty: TrainingDifficulty, templateId?: string): NetwalkPuzzle {
  const candidates = NETWALK_TEMPLATES.filter((template) => template.difficulty === difficulty);
  const selectedTemplate = templateId
    ? candidates.find((template) => template.id === templateId)
    : candidates[Math.floor(Math.random() * candidates.length)];
  const template = selectedTemplate ?? candidates[0];
  const solutionTiles = createSolutionTiles(template);
  const seed = getTemplateSeed(template.id);
  const initialTiles = solutionTiles.map((tile, index) => {
    if (tile.isServer) return tile;
    const rotations = ((index + seed) % 3) + 1;
    return rotateTileTimes(tile, rotations);
  });
  const minimumMoves = initialTiles.reduce((total, tile, index) => {
    let rotations = 0;
    let connections = tile.connections;
    const solutionConnections = solutionTiles[index]?.connections ?? [];
    while (connectionKey(connections) !== connectionKey(solutionConnections) && rotations < 4) {
      connections = rotateConnections(connections);
      rotations += 1;
    }
    return total + rotations;
  }, 0);

  return {
    id: template.id,
    difficulty: template.difficulty,
    size: template.size,
    solutionTiles,
    initialTiles,
    minimumMoves,
  };
}

export function createNetwalkState(puzzle: NetwalkPuzzle): NetwalkState {
  return {
    tiles: puzzle.initialTiles.map((tile) => ({ ...tile, connections: [...tile.connections] })),
    moveCount: 0,
  };
}

export function rotateNetwalkTile(state: NetwalkState, tileId: string): NetwalkState {
  const tile = state.tiles.find((item) => item.id === tileId);
  if (!tile || tile.isServer) return state;
  return {
    moveCount: state.moveCount + 1,
    tiles: state.tiles.map((item) => (
      item.id === tileId ? { ...item, connections: rotateConnections(item.connections) } : item
    )),
  };
}

export function getNetwalkHint(puzzle: NetwalkPuzzle, state: NetwalkState): NetwalkHint | null {
  const solutionById = new Map(puzzle.solutionTiles.map((tile) => [tile.id, tile]));
  const tile = state.tiles.find((item) => (
    !item.isServer && connectionKey(item.connections) !== connectionKey(solutionById.get(item.id)?.connections ?? [])
  ));
  return tile ? { tileId: tile.id } : null;
}

function getReciprocalNeighbor(
  puzzle: NetwalkPuzzle,
  tilesById: Map<string, NetwalkTile>,
  tile: NetwalkTile,
  direction: NetwalkDirection,
) {
  const [rowOffset, colOffset] = DIRECTION_OFFSET[direction];
  const neighbor = tilesById.get(toTileId(tile.row + rowOffset, tile.col + colOffset));
  if (!neighbor || tile.row + rowOffset < 0 || tile.row + rowOffset >= puzzle.size
    || tile.col + colOffset < 0 || tile.col + colOffset >= puzzle.size) {
    return null;
  }
  return neighbor.connections.includes(OPPOSITE_DIRECTION[direction]) ? neighbor : null;
}

export function getConnectedNetwalkTileIds(puzzle: NetwalkPuzzle, state: NetwalkState) {
  const tilesById = new Map(state.tiles.map((tile) => [tile.id, tile]));
  const server = state.tiles.find((tile) => tile.isServer);
  if (!server) return [];

  const visited = new Set<string>([server.id]);
  const queue = [server];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    current.connections.forEach((direction) => {
      const neighbor = getReciprocalNeighbor(puzzle, tilesById, current, direction);
      if (neighbor && !visited.has(neighbor.id)) {
        visited.add(neighbor.id);
        queue.push(neighbor);
      }
    });
  }
  return Array.from(visited);
}

export function isNetwalkSolved(puzzle: NetwalkPuzzle, state: NetwalkState) {
  if (state.tiles.length !== puzzle.size * puzzle.size) return false;
  const tilesById = new Map(state.tiles.map((tile) => [tile.id, tile]));
  const hasInvalidConnection = state.tiles.some((tile) => tile.connections.some((direction) => (
    !getReciprocalNeighbor(puzzle, tilesById, tile, direction)
  )));
  return !hasInvalidConnection && getConnectedNetwalkTileIds(puzzle, state).length === state.tiles.length;
}

export function scoreNetwalkGame({
  difficulty,
  elapsedSeconds,
  moveCount,
  minimumMoves,
  hintCount,
  completed,
}: NetwalkScoreInput) {
  if (!completed) return 0;
  const isHard = difficulty === "hard";
  const base = isHard ? 25 : 20;
  const speedBonus = elapsedSeconds <= (isHard ? 60 : 45)
    ? (isHard ? 13 : 10)
    : elapsedSeconds <= (isHard ? 110 : 90) ? (isHard ? 7 : 5) : 3;
  const efficiencyBonus = moveCount <= minimumMoves + (isHard ? 6 : 4)
    ? (isHard ? 12 : 10)
    : moveCount <= minimumMoves + (isHard ? 14 : 10) ? (isHard ? 6 : 4) : 0;
  const maxScore = isHard ? 50 : 40;
  return Math.max(5, Math.min(maxScore, base + speedBonus + efficiencyBonus - hintCount * 5));
}
