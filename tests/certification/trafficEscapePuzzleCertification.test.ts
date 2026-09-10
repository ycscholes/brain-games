import { CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES } from "../../src/pages/traffic-escape/hardPuzzles.generated";
import { createTrafficEscapeHardCandidate } from "../../src/pages/traffic-escape/puzzleGenerator";
import { collectCertifiedPuzzles } from "../../scripts/generate-traffic-escape-hard-puzzles";
import {
  applyTrafficEscapeMove,
  createTrafficEscapePuzzle,
  createTrafficEscapeState,
  getTrafficEscapeHint,
  getTrafficEscapeLegalMoves,
  getTrafficEscapePuzzlePool,
  isTrafficEscapeSolved,
  solveTrafficEscapePuzzleDetailed,
} from "../../src/pages/traffic-escape/gameLogic";
import {
  HARD_PUZZLE_QUALITY_RULES,
  certifyTrafficEscapeHardPuzzle,
  certifyTrafficEscapeHardPuzzleBank,
} from "../../src/pages/traffic-escape/puzzleQuality";

function getMoveKey(move: { vehicleId: string; delta: number }) {
  return `${move.vehicleId}:${move.delta}`;
}

function expectHintLeadsToCertifiedSolution(
  puzzle: (typeof CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES)[number],
  initialState: ReturnType<typeof createTrafficEscapeState>,
  openingMove: { vehicleId: string; delta: number },
) {
  const openingResult = applyTrafficEscapeMove(puzzle, initialState, openingMove);
  expect(openingResult.moved).toBe(true);

  const hint = getTrafficEscapeHint(puzzle, openingResult.state);
  expect(hint).not.toBeNull();
  const hintedResult = applyTrafficEscapeMove(puzzle, openingResult.state, hint!);
  expect(hintedResult.moved).toBe(true);
  const remainingSolve = solveTrafficEscapePuzzleDetailed(puzzle, hintedResult.state);
  expect(remainingSolve).not.toBeNull();
  expect(remainingSolve!.visitedStateCount).toBeLessThanOrEqual(
    HARD_PUZZLE_QUALITY_RULES.maximumVisitedStates * 3,
  );
}

describe("traffic-escape puzzle certification", () => {
  test("certifies every serialized runtime puzzle individually", () => {
    expect(CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES.every((puzzle) => {
      const certification = certifyTrafficEscapeHardPuzzle(puzzle);
      return certification.accepted
        && certification.analysis?.visitedStateCount <= HARD_PUZZLE_QUALITY_RULES.maximumVisitedStates;
    })).toBe(true);
  });

  test("scans the approved 2,000-seed collection range", () => {
    const selected = collectCertifiedPuzzles({ firstSeed: 1, lastSeed: 2_000, count: 36 });

    expect(selected).toHaveLength(36);
    expect(certifyTrafficEscapeHardPuzzleBank(selected).accepted).toBe(true);
  });

  test("evaluates the fixed seed corpus against the current hard quality rules", () => {
    const results = [4, 11, 20, 25].map((seed) => {
      const candidate = createTrafficEscapeHardCandidate(seed);
      return {
        candidate,
        certification: candidate ? certifyTrafficEscapeHardPuzzle(candidate.puzzle) : null,
      };
    });
    const accepted = results.filter((result) => result.certification?.accepted);

    expect(results).toHaveLength(4);
    expect(results.every(({ candidate }) => candidate !== null)).toBe(true);
    expect(accepted.length).toBeGreaterThan(0);
    expect(accepted.every(({ certification }) => {
      const analysis = certification?.analysis;
      return certification?.accepted === true
        && analysis !== null
        && analysis !== undefined
        && analysis.shortestMoveCount >= HARD_PUZZLE_QUALITY_RULES.minimumMoves
        && analysis.shortestMoveCount <= HARD_PUZZLE_QUALITY_RULES.maximumMoves
        && analysis.distinctMovedVehicleCount >= HARD_PUZZLE_QUALITY_RULES.minimumDistinctVehicles
        && analysis.dependencyDepth >= HARD_PUZZLE_QUALITY_RULES.minimumDependencyDepth
        && analysis.legalFirstMoveCount >= HARD_PUZZLE_QUALITY_RULES.minimumLegalFirstMoves
        && analysis.optimalFirstMoveCount <= HARD_PUZZLE_QUALITY_RULES.maximumOptimalFirstMoves
        && analysis.visitedStateCount <= HARD_PUZZLE_QUALITY_RULES.maximumVisitedStates;
    })).toBe(true);
  });

  test("selects every certified bank entry and no legacy hard-mode fallback", () => {
    const bankIds = CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES.map((puzzle) => puzzle.id);
    const selectedIds = Array.from({ length: bankIds.length }, (_, seed) => (
      createTrafficEscapePuzzle("hard", seed).id
    ));

    expect(new Set(selectedIds)).toEqual(new Set(bankIds));
    expect(getTrafficEscapePuzzlePool("hard").map((puzzle) => puzzle.id)).toEqual(bankIds);

    for (let seed = 1; seed <= 100; seed += 1) {
      const puzzle = createTrafficEscapePuzzle("hard", seed);
      expect(bankIds).toContain(puzzle.id);
      expect(puzzle.vehicles).toHaveLength(10);
    }
  });

  test("replays every serialized solution as legal moves", () => {
    ["normal", "hard"].forEach((difficulty) => {
      getTrafficEscapePuzzlePool(difficulty as "normal" | "hard").forEach((puzzle) => {
        let state = createTrafficEscapeState(puzzle);

        puzzle.solutionMoves.forEach((move) => {
          const result = applyTrafficEscapeMove(puzzle, state, move);
          expect(result.moved).toBe(true);
          state = result.state;
        });

        expect(isTrafficEscapeSolved(puzzle, state)).toBe(true);
      });
    });
  });

  test("keeps hints state-aware after optimal and alternate legal moves across the certified bank", () => {
    CERTIFIED_TRAFFIC_ESCAPE_HARD_PUZZLES.forEach((puzzle) => {
      const initialState = createTrafficEscapeState(puzzle);
      const optimalMove = puzzle.solutionMoves[0];
      expectHintLeadsToCertifiedSolution(puzzle, initialState, optimalMove);

      const optimalMoveKeys = new Set([getMoveKey(optimalMove)]);
      const deviation = getTrafficEscapeLegalMoves(puzzle, initialState)
        .find((move) => !optimalMoveKeys.has(getMoveKey(move)));
      expect(deviation).toBeDefined();
      expectHintLeadsToCertifiedSolution(puzzle, initialState, deviation!);
    });
  });
});
