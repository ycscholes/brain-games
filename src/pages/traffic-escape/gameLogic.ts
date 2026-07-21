import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type TrafficEscapeDifficulty = TrainingDifficulty;
export type TrafficVehicleOrientation = "horizontal" | "vertical";

export interface TrafficVehicle {
  id: string;
  row: number;
  col: number;
  length: 2 | 3;
  orientation: TrafficVehicleOrientation;
  color: "target" | "amber" | "cyan" | "violet" | "lime" | "coral";
  isTarget?: boolean;
}

export interface TrafficEscapeMove {
  vehicleId: string;
  delta: number;
}

export interface TrafficEscapePuzzle {
  id: string;
  size: number;
  exitRow: number;
  vehicles: TrafficVehicle[];
  solutionMoves: TrafficEscapeMove[];
}

export interface TrafficEscapeState {
  vehicles: TrafficVehicle[];
  moveCount: number;
}

const NORMAL_PUZZLES: TrafficEscapePuzzle[] = [
  {
    id: "traffic-escape-normal-1",
    size: 5,
    exitRow: 2,
    vehicles: [
      { id: "target", row: 2, col: 0, length: 2, orientation: "horizontal", color: "target", isTarget: true },
      { id: "cyan-1", row: 1, col: 2, length: 2, orientation: "vertical", color: "cyan" },
      { id: "amber-1", row: 0, col: 0, length: 2, orientation: "horizontal", color: "amber" },
      { id: "violet-1", row: 3, col: 3, length: 2, orientation: "vertical", color: "violet" },
    ],
    solutionMoves: [
      { vehicleId: "cyan-1", delta: -1 },
      { vehicleId: "target", delta: 3 },
    ],
  },
  {
    id: "traffic-escape-normal-2",
    size: 5,
    exitRow: 2,
    vehicles: [
      { id: "target", row: 2, col: 0, length: 2, orientation: "horizontal", color: "target", isTarget: true },
      { id: "lime-1", row: 2, col: 2, length: 2, orientation: "vertical", color: "lime" },
      { id: "coral-1", row: 0, col: 3, length: 2, orientation: "vertical", color: "coral" },
      { id: "amber-2", row: 4, col: 0, length: 2, orientation: "horizontal", color: "amber" },
    ],
    solutionMoves: [
      { vehicleId: "lime-1", delta: 1 },
      { vehicleId: "target", delta: 3 },
    ],
  },
  {
    id: "traffic-escape-normal-3",
    size: 5,
    exitRow: 2,
    vehicles: [
      { id: "target", row: 2, col: 0, length: 2, orientation: "horizontal", color: "target", isTarget: true },
      { id: "violet-2", row: 2, col: 2, length: 2, orientation: "vertical", color: "violet" },
      { id: "cyan-2", row: 0, col: 0, length: 2, orientation: "horizontal", color: "cyan" },
      { id: "lime-2", row: 3, col: 4, length: 2, orientation: "vertical", color: "lime" },
    ],
    solutionMoves: [
      { vehicleId: "violet-2", delta: 1 },
      { vehicleId: "target", delta: 3 },
    ],
  },
];

const HARD_PUZZLES: TrafficEscapePuzzle[] = [
  {
    id: "traffic-escape-hard-1",
    size: 6,
    exitRow: 2,
    vehicles: [
      { id: "target", row: 2, col: 0, length: 2, orientation: "horizontal", color: "target", isTarget: true },
      { id: "cyan-3", row: 0, col: 2, length: 3, orientation: "vertical", color: "cyan" },
      { id: "amber-3", row: 4, col: 1, length: 2, orientation: "horizontal", color: "amber" },
      { id: "violet-3", row: 3, col: 5, length: 2, orientation: "vertical", color: "violet" },
      { id: "lime-3", row: 4, col: 4, length: 2, orientation: "vertical", color: "lime" },
      { id: "coral-2", row: 0, col: 3, length: 2, orientation: "horizontal", color: "coral" },
    ],
    solutionMoves: [
      { vehicleId: "amber-3", delta: -1 },
      { vehicleId: "cyan-3", delta: 3 },
      { vehicleId: "target", delta: 4 },
    ],
  },
  {
    id: "traffic-escape-hard-2",
    size: 6,
    exitRow: 3,
    vehicles: [
      { id: "target", row: 3, col: 0, length: 2, orientation: "horizontal", color: "target", isTarget: true },
      { id: "lime-4", row: 2, col: 2, length: 2, orientation: "vertical", color: "lime" },
      { id: "amber-4", row: 0, col: 0, length: 3, orientation: "horizontal", color: "amber" },
      { id: "cyan-4", row: 0, col: 4, length: 3, orientation: "vertical", color: "cyan" },
      { id: "violet-4", row: 4, col: 3, length: 2, orientation: "horizontal", color: "violet" },
      { id: "coral-3", row: 4, col: 0, length: 2, orientation: "vertical", color: "coral" },
    ],
    solutionMoves: [
      { vehicleId: "lime-4", delta: 2 },
      { vehicleId: "target", delta: 4 },
    ],
  },
  {
    id: "traffic-escape-hard-3",
    size: 6,
    exitRow: 2,
    vehicles: [
      { id: "target", row: 2, col: 0, length: 2, orientation: "horizontal", color: "target", isTarget: true },
      { id: "violet-5", row: 1, col: 2, length: 2, orientation: "vertical", color: "violet" },
      { id: "cyan-5", row: 0, col: 0, length: 2, orientation: "horizontal", color: "cyan" },
      { id: "amber-5", row: 3, col: 3, length: 2, orientation: "vertical", color: "amber" },
      { id: "lime-5", row: 4, col: 0, length: 2, orientation: "horizontal", color: "lime" },
      { id: "coral-4", row: 4, col: 5, length: 2, orientation: "vertical", color: "coral" },
    ],
    solutionMoves: [
      { vehicleId: "violet-5", delta: -1 },
      { vehicleId: "target", delta: 4 },
    ],
  },
];

function cloneVehicle(vehicle: TrafficVehicle): TrafficVehicle {
  return { ...vehicle };
}

function getVehicleCells(vehicle: TrafficVehicle) {
  return Array.from({ length: vehicle.length }, (_, index) => ({
    row: vehicle.row + (vehicle.orientation === "vertical" ? index : 0),
    col: vehicle.col + (vehicle.orientation === "horizontal" ? index : 0),
  }));
}

function isVehiclePlacementValid(puzzle: TrafficEscapePuzzle, vehicles: TrafficVehicle[]) {
  const occupied = new Set<string>();

  return vehicles.every((vehicle) => getVehicleCells(vehicle).every((cell) => {
    const key = `${cell.row}:${cell.col}`;
    const inBounds = cell.row >= 0 && cell.row < puzzle.size && cell.col >= 0 && cell.col < puzzle.size;
    if (!inBounds || occupied.has(key)) return false;
    occupied.add(key);
    return true;
  }));
}

function moveVehicleOneStep(
  puzzle: TrafficEscapePuzzle,
  vehicles: TrafficVehicle[],
  vehicleId: string,
  direction: number,
) {
  const nextVehicles = vehicles.map(cloneVehicle);
  const vehicle = nextVehicles.find((item) => item.id === vehicleId);
  if (!vehicle) return null;

  if (vehicle.orientation === "horizontal") {
    vehicle.col += direction;
  } else {
    vehicle.row += direction;
  }

  return isVehiclePlacementValid(puzzle, nextVehicles) ? nextVehicles : null;
}

export function getTrafficEscapePuzzlePool(difficulty: TrafficEscapeDifficulty) {
  return difficulty === "hard" ? HARD_PUZZLES : NORMAL_PUZZLES;
}

export function createTrafficEscapePuzzle(difficulty: TrafficEscapeDifficulty, seed = Date.now()) {
  const pool = getTrafficEscapePuzzlePool(difficulty);
  return pool[Math.abs(seed) % pool.length] ?? pool[0];
}

export function createTrafficEscapeState(puzzle: TrafficEscapePuzzle): TrafficEscapeState {
  return {
    vehicles: puzzle.vehicles.map(cloneVehicle),
    moveCount: 0,
  };
}

export function applyTrafficEscapeMove(
  puzzle: TrafficEscapePuzzle,
  state: TrafficEscapeState,
  move: TrafficEscapeMove,
) {
  const direction = Math.sign(move.delta);
  const steps = Math.abs(Math.trunc(move.delta));
  if (!direction || !steps || isTrafficEscapeSolved(puzzle, state)) {
    return { moved: false, state };
  }

  let nextVehicles = state.vehicles;
  for (let step = 0; step < steps; step += 1) {
    const nextStep = moveVehicleOneStep(puzzle, nextVehicles, move.vehicleId, direction);
    if (!nextStep) return { moved: false, state };
    nextVehicles = nextStep;
  }

  return {
    moved: true,
    state: {
      vehicles: nextVehicles,
      moveCount: state.moveCount + 1,
    },
  };
}

export function isTrafficEscapeSolved(puzzle: TrafficEscapePuzzle, state: TrafficEscapeState) {
  const target = state.vehicles.find((vehicle) => vehicle.isTarget);
  return target?.orientation === "horizontal"
    && target.row === puzzle.exitRow
    && target.col + target.length === puzzle.size;
}

export function getTrafficEscapeHint(puzzle: TrafficEscapePuzzle, state: TrafficEscapeState) {
  return puzzle.solutionMoves.find((move) => applyTrafficEscapeMove(puzzle, state, move).moved) ?? null;
}

export function scoreTrafficEscapeGame(params: {
  difficulty: TrafficEscapeDifficulty;
  elapsedSeconds: number;
  moveCount: number;
  hintCount: number;
  completed: boolean;
}) {
  if (!params.completed) return 0;

  const baseScore = params.difficulty === "hard" ? 36 : 28;
  const fastThreshold = params.difficulty === "hard" ? 90 : 60;
  const mediumThreshold = params.difficulty === "hard" ? 140 : 100;
  const speedBonus = params.elapsedSeconds <= fastThreshold ? 6 : params.elapsedSeconds <= mediumThreshold ? 4 : 0;
  const moveBonus = params.moveCount <= 6 ? 6 : params.moveCount <= 10 ? 4 : params.moveCount <= 12 ? 2 : 0;
  const maxScore = params.difficulty === "hard" ? 50 : 40;

  return Math.max(8, Math.min(maxScore, baseScore + speedBonus + moveBonus - params.hintCount * 4));
}
