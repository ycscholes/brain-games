import {
  applyTrafficEscapeMove,
  createSeededRandom,
  createTrafficEscapeState,
  getTrafficEscapeLegalMoves,
  getTrafficEscapeStateKey,
  type TrafficEscapeMove,
  type TrafficEscapePuzzle,
  type TrafficEscapeState,
  type TrafficVehicle,
} from "./gameLogic";

export interface TrafficEscapeHardCandidate {
  seed: number;
  templateId: string;
  puzzle: TrafficEscapePuzzle;
  generationTrace: TrafficEscapeMove[];
}

export type TrafficEscapeHardCandidateResult = TrafficEscapeHardCandidate | null;

interface SolvedTemplateDefinition {
  puzzle: TrafficEscapePuzzle;
  gateMove: TrafficEscapeMove;
}

const BASE_SOLVED_VEHICLES: TrafficVehicle[] = [
  { id: "target", row: 2, col: 4, length: 2, orientation: "horizontal", color: "target", isTarget: true },
  { id: "v1", row: 3, col: 2, length: 3, orientation: "vertical", color: "cyan" },
  { id: "v2", row: 3, col: 5, length: 3, orientation: "vertical", color: "violet" },
  { id: "gate", row: 0, col: 3, length: 2, orientation: "vertical", color: "lime" },
  { id: "v4", row: 3, col: 0, length: 2, orientation: "vertical", color: "coral" },
  { id: "v5", row: 4, col: 3, length: 2, orientation: "horizontal", color: "amber" },
  { id: "v6", row: 5, col: 0, length: 2, orientation: "horizontal", color: "cyan" },
  { id: "v7", row: 5, col: 3, length: 2, orientation: "horizontal", color: "violet" },
  { id: "v8", row: 0, col: 4, length: 2, orientation: "horizontal", color: "lime" },
  { id: "v9", row: 0, col: 1, length: 2, orientation: "vertical", color: "coral" },
];

function cloneVehicle(vehicle: TrafficVehicle): TrafficVehicle {
  return { ...vehicle };
}

function clonePuzzle(puzzle: TrafficEscapePuzzle): TrafficEscapePuzzle {
  return {
    ...puzzle,
    vehicles: puzzle.vehicles.map(cloneVehicle),
    solutionMoves: puzzle.solutionMoves.map((move) => ({ ...move })),
  };
}

function reflectVehicleVertically(vehicle: TrafficVehicle, size: number): TrafficVehicle {
  return {
    ...vehicle,
    row: size - vehicle.row - (vehicle.orientation === "vertical" ? vehicle.length : 1),
  };
}

function createTemplateDefinition(
  id: string,
  moveUnusedVehicleLeft: boolean,
  reflectVertically: boolean,
): SolvedTemplateDefinition {
  const size = 6;
  let vehicles = BASE_SOLVED_VEHICLES.map(cloneVehicle);
  if (moveUnusedVehicleLeft) {
    vehicles = vehicles.map((vehicle) => vehicle.id === "v9" ? { ...vehicle, col: 0 } : vehicle);
  }
  if (reflectVertically) {
    vehicles = vehicles.map((vehicle) => reflectVehicleVertically(vehicle, size));
  }

  const exitRow = reflectVertically ? 3 : 2;
  return {
    puzzle: {
      id,
      size,
      exitRow,
      vehicles,
      solutionMoves: [],
    },
    gateMove: {
      vehicleId: "gate",
      delta: reflectVertically ? -1 : 2,
    },
  };
}

const SOLVED_TEMPLATE_DEFINITIONS: readonly SolvedTemplateDefinition[] = [
  createTemplateDefinition("traffic-escape-hard-template-1", false, false),
  createTemplateDefinition("traffic-escape-hard-template-2", true, false),
  createTemplateDefinition("traffic-escape-hard-template-3", false, true),
  createTemplateDefinition("traffic-escape-hard-template-4", true, true),
];

function hasBlockedExit(puzzle: TrafficEscapePuzzle, state: TrafficEscapeState) {
  const target = state.vehicles.find((vehicle) => vehicle.isTarget);
  if (!target) return false;

  const targetEnd = target.col + target.length - 1;
  return state.vehicles.some((vehicle) => {
    if (vehicle.isTarget) return false;
    if (vehicle.orientation === "horizontal") {
      return vehicle.row === puzzle.exitRow
        && vehicle.col + vehicle.length - 1 > targetEnd
        && vehicle.col < puzzle.size;
    }
    return vehicle.col > targetEnd
      && vehicle.row <= puzzle.exitRow
      && vehicle.row + vehicle.length > puzzle.exitRow;
  });
}

function isImmediateReverse(previousMove: TrafficEscapeMove | undefined, move: TrafficEscapeMove) {
  return previousMove?.vehicleId === move.vehicleId && previousMove.delta === -move.delta;
}

function shuffleMoves(moves: TrafficEscapeMove[], random: () => number) {
  const shuffled = moves.map((move) => ({ ...move }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[nextIndex]] = [shuffled[nextIndex], shuffled[index]];
  }
  return shuffled;
}

function createReverseWalk(
  puzzle: TrafficEscapePuzzle,
  initialState: TrafficEscapeState,
  initialTrace: TrafficEscapeMove[],
  moveCount: number,
  random: () => number,
) {
  const trace = initialTrace.map((move) => ({ ...move }));
  const visitedKeys = new Set([getTrafficEscapeStateKey(initialState)]);
  let state = initialState;

  for (let moveIndex = trace.length - 1; moveIndex < moveCount; moveIndex += 1) {
    const previousMove = trace[trace.length - 1];
    const candidates = shuffleMoves(
      getTrafficEscapeLegalMoves(puzzle, state).filter((move) => (
        move.vehicleId !== "target" && !isImmediateReverse(previousMove, move)
      )),
      random,
    );

    const accepted = candidates.find((move) => {
      const result = applyTrafficEscapeMove(puzzle, state, move);
      return result.moved
        && hasBlockedExit(puzzle, result.state)
        && !visitedKeys.has(getTrafficEscapeStateKey(result.state));
    });
    if (!accepted) return null;

    const result = applyTrafficEscapeMove(puzzle, state, accepted);
    if (!result.moved) return null;
    state = result.state;
    trace.push(accepted);
    visitedKeys.add(getTrafficEscapeStateKey(state));
  }

  return { state, trace };
}

export function getTrafficEscapeHardSolvedTemplates() {
  return SOLVED_TEMPLATE_DEFINITIONS.map(({ puzzle }) => clonePuzzle(puzzle));
}

export function createTrafficEscapeHardCandidate(seed: number): TrafficEscapeHardCandidateResult {
  const random = createSeededRandom(seed);
  const templateIndex = Math.abs(Math.trunc(seed)) % SOLVED_TEMPLATE_DEFINITIONS.length;
  const definition = SOLVED_TEMPLATE_DEFINITIONS[templateIndex];
  const puzzle = clonePuzzle(definition.puzzle);
  const target = puzzle.vehicles.find((vehicle) => vehicle.isTarget);
  if (!target) throw new Error(`Template ${puzzle.id} has no target vehicle`);

  const targetReverseMove = { vehicleId: target.id, delta: -target.col };
  target.col = 0;
  let state = createTrafficEscapeState(puzzle);
  const gateResult = applyTrafficEscapeMove(puzzle, state, definition.gateMove);
  if (!gateResult.moved || !hasBlockedExit(puzzle, gateResult.state)) {
    throw new Error(`Template ${puzzle.id} cannot establish a blocked exit`);
  }
  state = gateResult.state;

  const nonTargetMoveCount = 48 + Math.floor(random() * 25);
  const initialTrace = [targetReverseMove, definition.gateMove];
  let walk = createReverseWalk(puzzle, state, initialTrace, nonTargetMoveCount, random);
  for (let retry = 0; !walk && retry < 31; retry += 1) {
    walk = createReverseWalk(puzzle, state, initialTrace, nonTargetMoveCount, random);
  }
  if (!walk) return null;

  return {
    seed,
    templateId: puzzle.id,
    puzzle: {
      ...puzzle,
      id: `traffic-escape-hard-seed-${seed}`,
      vehicles: walk.state.vehicles.map(cloneVehicle),
      solutionMoves: [],
    },
    generationTrace: walk.trace,
  };
}
