import type { TrainingDifficulty } from "../../utils/trainingStorage";

export type TrafficEscapeDifficulty = TrainingDifficulty;
export type TrafficVehicleOrientation = "horizontal" | "vertical";

export const TRAFFIC_VEHICLE_APPEARANCES = {
  2: ["sport", "compact-van", "city-taxi"],
  3: ["city-bus", "box-truck", "stretch-sedan"],
} as const;

export const TRAFFIC_VEHICLE_APPEARANCE_LIST = [
  ...TRAFFIC_VEHICLE_APPEARANCES[2],
  ...TRAFFIC_VEHICLE_APPEARANCES[3],
] as const;

export type TrafficVehicleAppearance = (typeof TRAFFIC_VEHICLE_APPEARANCES)[2][number]
  | (typeof TRAFFIC_VEHICLE_APPEARANCES)[3][number];

export interface TrafficVehicle {
  id: string;
  row: number;
  col: number;
  length: 2 | 3;
  orientation: TrafficVehicleOrientation;
  color: "target" | "amber" | "cyan" | "violet" | "lime" | "coral";
  appearance?: TrafficVehicleAppearance;
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

function shuffleTrafficVehicleAppearances<T>(items: readonly T[], random: () => number) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[nextIndex]] = [shuffled[nextIndex], shuffled[index]];
  }
  return shuffled;
}

export function assignTrafficVehicleAppearances(
  vehicles: TrafficVehicle[],
  random: () => number,
): TrafficVehicle[] {
  const assigned = vehicles.map(cloneVehicle);

  ([2, 3] as const).forEach((length) => {
    const matchingVehicles = assigned.filter((vehicle) => vehicle.length === length);
    const appearances = TRAFFIC_VEHICLE_APPEARANCES[length];
    const target = matchingVehicles.find((vehicle) => vehicle.isTarget);
    const nonTargetVehicles = matchingVehicles.filter((vehicle) => !vehicle.isTarget);

    if (target) target.appearance = "sport";

    const initialAppearances = length === 2 && target
      ? shuffleTrafficVehicleAppearances(appearances.filter((appearance) => appearance !== "sport"), random)
      : shuffleTrafficVehicleAppearances(appearances, random);
    const initiallyAssigned = target ? 1 : 0;

    nonTargetVehicles.forEach((vehicle, index) => {
      vehicle.appearance = index < appearances.length - initiallyAssigned
        ? initialAppearances[index]
        : appearances[Math.floor(random() * appearances.length)];
    });
  });

  return assigned;
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

const DIFFICULTY_REQUIREMENTS = {
  normal: { size: 6, vehicleCount: 6, minimumSolutionMoves: 3, scrambleMoves: 16, attempts: 80 },
  hard: { size: 6, vehicleCount: 8, minimumSolutionMoves: 4, scrambleMoves: 28, attempts: 120 },
} as const;

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function getTrafficEscapeStateKey(state: TrafficEscapeState) {
  return [...state.vehicles]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((vehicle) => `${vehicle.id}:${vehicle.row}:${vehicle.col}`)
    .join("|");
}

function getTrafficEscapeLegalMoves(puzzle: TrafficEscapePuzzle, state: TrafficEscapeState) {
  const moves: TrafficEscapeMove[] = [];
  state.vehicles.forEach((vehicle) => {
    for (const direction of [-1, 1]) {
      for (let distance = 1; distance < puzzle.size; distance += 1) {
        const move = { vehicleId: vehicle.id, delta: direction * distance };
        if (applyTrafficEscapeMove(puzzle, state, move).moved) moves.push(move);
      }
    }
  });
  return moves;
}

export function solveTrafficEscapePuzzle(puzzle: TrafficEscapePuzzle, initialState: TrafficEscapeState) {
  const queue: Array<{ state: TrafficEscapeState; moves: TrafficEscapeMove[] }> = [{ state: initialState, moves: [] }];
  const visited = new Set([getTrafficEscapeStateKey(initialState)]);
  const maxVisitedStates = 30_000;

  for (let cursor = 0; cursor < queue.length && visited.size <= maxVisitedStates; cursor += 1) {
    const current = queue[cursor];
    if (isTrafficEscapeSolved(puzzle, current.state)) return current.moves;

    getTrafficEscapeLegalMoves(puzzle, current.state).forEach((move) => {
      const result = applyTrafficEscapeMove(puzzle, current.state, move);
      const key = getTrafficEscapeStateKey(result.state);
      if (result.moved && !visited.has(key)) {
        visited.add(key);
        queue.push({ state: result.state, moves: [...current.moves, move] });
      }
    });
  }

  return null;
}

function createSolvedTrafficLayout(): TrafficEscapePuzzle {
  const size = 6;
  const exitRow = 2;
  const vehicles: TrafficVehicle[] = [
    { id: "target", row: exitRow, col: size - 2, length: 2, orientation: "horizontal", color: "target", isTarget: true },
    { id: "blocker", row: 0, col: 2, length: 2, orientation: "vertical", color: "cyan" },
    { id: "vehicle-1", row: 0, col: 0, length: 2, orientation: "horizontal", color: "amber" },
    { id: "vehicle-2", row: 1, col: 0, length: 2, orientation: "horizontal", color: "violet" },
    { id: "vehicle-3", row: 3, col: 0, length: 3, orientation: "horizontal", color: "lime" },
    { id: "vehicle-4", row: 4, col: 0, length: 2, orientation: "horizontal", color: "coral" },
    { id: "vehicle-5", row: 0, col: 3, length: 3, orientation: "vertical", color: "amber" },
    { id: "vehicle-6", row: 5, col: 0, length: 3, orientation: "horizontal", color: "violet" },
  ];

  return { id: "traffic-escape-solved", size, exitRow, vehicles, solutionMoves: [] };
}

function hasBlockedExit(puzzle: TrafficEscapePuzzle, state: TrafficEscapeState) {
  const target = state.vehicles.find((vehicle) => vehicle.isTarget);
  if (!target || target.col >= puzzle.size - target.length) return false;
  return state.vehicles.some((vehicle) => !vehicle.isTarget && getVehicleCells(vehicle).some((cell) => (
    cell.row === puzzle.exitRow && cell.col > target.col + target.length - 1
  )));
}

function createTrafficEscapeCandidate(
  difficulty: TrafficEscapeDifficulty,
  random: () => number,
  attempt: number,
) {
  const layout = createSolvedTrafficLayout();
  const requirements = DIFFICULTY_REQUIREMENTS[difficulty];
  const reversedVehicles = layout.vehicles.map(cloneVehicle);
  const target = reversedVehicles.find((vehicle) => vehicle.id === "target");
  const blocker = reversedVehicles.find((vehicle) => vehicle.id === "blocker");
  const upperGate = reversedVehicles.find((vehicle) => vehicle.id === "vehicle-1");
  if (!target || !blocker || !upperGate) return null;
  target.col = 0;
  blocker.row = layout.exitRow - 1;
  upperGate.col = 1;
  if (!isVehiclePlacementValid(layout, reversedVehicles)) return null;
  let state: TrafficEscapeState = { vehicles: reversedVehicles, moveCount: 0 };

  for (let moveIndex = 0; moveIndex < requirements.scrambleMoves; moveIndex += 1) {
    const legalMoves = getTrafficEscapeLegalMoves(layout, state).filter((move) => move.vehicleId !== "target");
    if (legalMoves.length === 0) break;
    const preferredMoves = moveIndex % 3 === 0
      ? legalMoves.filter((move) => move.vehicleId !== "blocker")
      : legalMoves;
    const movesToChoose = preferredMoves.length > 0 ? preferredMoves : legalMoves;
    const result = applyTrafficEscapeMove(layout, state, movesToChoose[Math.floor(random() * movesToChoose.length)]);
    if (result.moved && hasBlockedExit(layout, result.state)) state = result.state;
  }

  if (!hasBlockedExit(layout, state)) return null;
  return {
    ...layout,
    id: `traffic-escape-${difficulty}-${attempt}`,
    vehicles: assignTrafficVehicleAppearances(state.vehicles, random),
  };
}

export function getTrafficEscapePuzzlePool(difficulty: TrafficEscapeDifficulty) {
  const puzzles = difficulty === "hard" ? HARD_PUZZLES : NORMAL_PUZZLES;
  return puzzles.map((puzzle, index) => ({
    ...puzzle,
    vehicles: assignTrafficVehicleAppearances(puzzle.vehicles, createSeededRandom(index + 1)),
    solutionMoves: [...puzzle.solutionMoves],
  }));
}

export function createTrafficEscapePuzzle(difficulty: TrafficEscapeDifficulty, seed = Date.now()) {
  const random = createSeededRandom(seed);
  const requirements = DIFFICULTY_REQUIREMENTS[difficulty];

  for (let attempt = 0; attempt < requirements.attempts; attempt += 1) {
    const candidate = createTrafficEscapeCandidate(difficulty, random, attempt);
    if (!candidate) continue;
    const solutionMoves = solveTrafficEscapePuzzle(candidate, createTrafficEscapeState(candidate));
    if (solutionMoves && solutionMoves.length >= requirements.minimumSolutionMoves) {
      return { ...candidate, solutionMoves };
    }
  }

  const fallback = getTrafficEscapePuzzlePool(difficulty)[Math.abs(seed) % getTrafficEscapePuzzlePool(difficulty).length];
  return {
    ...fallback,
    vehicles: assignTrafficVehicleAppearances(fallback.vehicles, createSeededRandom(seed)),
    solutionMoves: [...fallback.solutionMoves],
  };
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
  return solveTrafficEscapePuzzle(puzzle, state)?.[0] ?? null;
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
