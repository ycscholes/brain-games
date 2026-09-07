import {
  applyTrafficEscapeMove,
  createTrafficEscapeState,
  solveTrafficEscapePuzzleDetailed,
  type TrafficEscapeMove,
  type TrafficEscapePuzzle,
  type TrafficEscapeState,
} from "./gameLogic";

export type CertifiedTrafficEscapePuzzle = TrafficEscapePuzzle;

export interface TrafficEscapePuzzleAnalysis {
  solutionMoves: TrafficEscapeMove[];
  shortestMoveCount: number;
  distinctMovedVehicleCount: number;
  dependencyDepth: number;
  legalFirstMoveCount: number;
  optimalFirstMoveCount: number;
  visitedStateCount: number;
  targetOnlyOnFinalMove: boolean;
}

export interface TrafficEscapeCertification {
  accepted: boolean;
  failures: string[];
  analysis: TrafficEscapePuzzleAnalysis | null;
}

export interface TrafficEscapePuzzleQualityRules {
  size: number;
  vehicleCount: number;
  minimumMoves: number;
  maximumMoves: number;
  minimumDistinctVehicles: number;
  minimumDependencyDepth: number;
  minimumLegalFirstMoves: number;
  maximumOptimalFirstMoves: number;
  maximumVisitedStates: number;
  requireTargetOnlyOnFinalMove: boolean;
}

export const HARD_PUZZLE_QUALITY_RULES = {
  size: 6,
  vehicleCount: 10,
  minimumMoves: 8,
  maximumMoves: 12,
  minimumDistinctVehicles: 5,
  minimumDependencyDepth: 3,
  minimumLegalFirstMoves: 4,
  maximumOptimalFirstMoves: 2,
  maximumVisitedStates: 12_000,
  requireTargetOnlyOnFinalMove: true,
} as const;

function isExactMoveLegal(
  puzzle: TrafficEscapePuzzle,
  state: TrafficEscapeState,
  move: TrafficEscapeMove,
) {
  return applyTrafficEscapeMove(puzzle, state, move).moved;
}

function getDependencyDepth(
  puzzle: TrafficEscapePuzzle,
  solutionMoves: TrafficEscapeMove[],
) {
  const depths = solutionMoves.map(() => 0);
  let state = createTrafficEscapeState(puzzle);

  solutionMoves.forEach((move, moveIndex) => {
    const result = applyTrafficEscapeMove(puzzle, state, move);
    if (!result.moved) return;

    for (let laterIndex = moveIndex + 1; laterIndex < solutionMoves.length; laterIndex += 1) {
      const laterMove = solutionMoves[laterIndex];
      const wasLegal = isExactMoveLegal(puzzle, state, laterMove);
      const isLegal = isExactMoveLegal(puzzle, result.state, laterMove);
      if (!wasLegal && isLegal) {
        depths[laterIndex] = Math.max(depths[laterIndex], depths[moveIndex] + 1);
      }
    }

    state = result.state;
  });

  return depths.length > 0 ? depths[depths.length - 1] : 0;
}

export function analyzeTrafficEscapePuzzle(
  puzzle: TrafficEscapePuzzle,
): TrafficEscapePuzzleAnalysis | null {
  const solveResult = solveTrafficEscapePuzzleDetailed(puzzle, createTrafficEscapeState(puzzle));
  if (!solveResult) return null;

  const targetId = puzzle.vehicles.find((vehicle) => vehicle.isTarget)?.id;
  const finalMove = solveResult.moves[solveResult.moves.length - 1];
  const targetOnlyOnFinalMove = Boolean(targetId)
    && finalMove?.vehicleId === targetId
    && solveResult.moves.slice(0, -1).every((move) => move.vehicleId !== targetId);

  return {
    solutionMoves: solveResult.moves,
    shortestMoveCount: solveResult.moves.length,
    distinctMovedVehicleCount: new Set(solveResult.moves.map((move) => move.vehicleId)).size,
    dependencyDepth: getDependencyDepth(puzzle, solveResult.moves),
    legalFirstMoveCount: solveResult.legalFirstMoves.length,
    optimalFirstMoveCount: solveResult.optimalFirstMoves.length,
    visitedStateCount: solveResult.visitedStateCount,
    targetOnlyOnFinalMove,
  };
}

export function certifyTrafficEscapeHardPuzzle(
  puzzle: TrafficEscapePuzzle,
  overrides: Partial<TrafficEscapePuzzleQualityRules> = {},
): TrafficEscapeCertification {
  const rules: TrafficEscapePuzzleQualityRules = {
    ...HARD_PUZZLE_QUALITY_RULES,
    ...overrides,
  };
  const failures: string[] = [];

  if (puzzle.size !== rules.size) failures.push(`size must be ${rules.size}`);
  if (puzzle.vehicles.length !== rules.vehicleCount) {
    failures.push(`vehicle count must be ${rules.vehicleCount}`);
  }

  const analysis = analyzeTrafficEscapePuzzle(puzzle);
  if (!analysis) {
    failures.push("puzzle must have a solution");
    return { accepted: false, failures, analysis: null };
  }

  if (analysis.shortestMoveCount < rules.minimumMoves) {
    failures.push(`shortest solution must have at least ${rules.minimumMoves} moves`);
  }
  if (analysis.shortestMoveCount > rules.maximumMoves) {
    failures.push(`shortest solution must have at most ${rules.maximumMoves} moves`);
  }
  if (analysis.distinctMovedVehicleCount < rules.minimumDistinctVehicles) {
    failures.push(`solution must move at least ${rules.minimumDistinctVehicles} distinct vehicles`);
  }
  if (analysis.dependencyDepth < rules.minimumDependencyDepth) {
    failures.push(`dependency depth must be at least ${rules.minimumDependencyDepth}`);
  }
  if (analysis.legalFirstMoveCount < rules.minimumLegalFirstMoves) {
    failures.push(`puzzle must have at least ${rules.minimumLegalFirstMoves} legal first moves`);
  }
  if (analysis.optimalFirstMoveCount > rules.maximumOptimalFirstMoves) {
    failures.push(`puzzle must have at most ${rules.maximumOptimalFirstMoves} optimal first moves`);
  }
  if (analysis.visitedStateCount > rules.maximumVisitedStates) {
    failures.push(`solver must visit at most ${rules.maximumVisitedStates} states`);
  }
  if (rules.requireTargetOnlyOnFinalMove && !analysis.targetOnlyOnFinalMove) {
    failures.push("target vehicle must move only on the final move");
  }

  return {
    accepted: failures.length === 0,
    failures,
    analysis,
  };
}

export function getTrafficEscapeGeometryKey(puzzle: TrafficEscapePuzzle) {
  const geometry = puzzle.vehicles
    .map((vehicle) => [
      vehicle.isTarget ? "target" : "vehicle",
      vehicle.orientation,
      vehicle.length,
      vehicle.row,
      vehicle.col,
    ].join(":"))
    .sort()
    .join("|");

  return `${puzzle.size}:${puzzle.exitRow}|${geometry}`;
}
