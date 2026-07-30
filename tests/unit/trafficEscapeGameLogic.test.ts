import {
  applyTrafficEscapeMove,
  createTrafficEscapeState,
  createTrafficEscapePuzzle,
  getTrafficEscapeHint,
  getTrafficEscapePuzzlePool,
  isTrafficEscapeSolved,
  scoreTrafficEscapeGame,
  solveTrafficEscapePuzzle,
} from "../../src/pages/traffic-escape/gameLogic";

describe("traffic-escape game logic", () => {
  test("provides compact normal and hard parking puzzles", () => {
    const [normal] = getTrafficEscapePuzzlePool("normal");
    const [hard] = getTrafficEscapePuzzlePool("hard");

    expect(normal.size).toBe(5);
    expect(hard.size).toBe(6);
    expect(normal.vehicles.some((vehicle) => vehicle.isTarget)).toBe(true);
    expect(hard.vehicles.some((vehicle) => vehicle.isTarget)).toBe(true);
  });

  test("generates solvable puzzles with difficulty-specific depth and density", () => {
    (["normal", "hard"] as const).forEach((difficulty) => {
      const puzzle = createTrafficEscapePuzzle(difficulty, difficulty === "normal" ? 17 : 29);
      const solution = solveTrafficEscapePuzzle(puzzle, createTrafficEscapeState(puzzle));

      expect(solution).not.toBeNull();
      expect(puzzle.vehicles.length).toBeGreaterThanOrEqual(difficulty === "hard" ? 8 : 6);
      expect(solution!.length).toBeGreaterThanOrEqual(difficulty === "hard" ? 4 : 3);
    });
  });

  test("applies the scripted solution as legal vehicle moves", () => {
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

  test("offers a valid next hint before the target can leave", () => {
    const [puzzle] = getTrafficEscapePuzzlePool("hard");
    const state = createTrafficEscapeState(puzzle);
    const hint = getTrafficEscapeHint(puzzle, state);
    const result = applyTrafficEscapeMove(puzzle, state, hint!);

    expect(hint).not.toBeNull();
    expect(result.moved).toBe(true);
    expect(isTrafficEscapeSolved(puzzle, state)).toBe(false);
  });

  test("re-solves from a deviated generated board when giving a hint", () => {
    const puzzle = createTrafficEscapePuzzle("hard", 43);
    const initialState = createTrafficEscapeState(puzzle);
    const firstMove = solveTrafficEscapePuzzle(puzzle, initialState)?.[0];

    expect(firstMove).toBeDefined();
    const movedState = applyTrafficEscapeMove(puzzle, initialState, firstMove!).state;
    const hint = getTrafficEscapeHint(puzzle, movedState);

    expect(hint).not.toBeNull();
    expect(applyTrafficEscapeMove(puzzle, movedState, hint!).moved).toBe(true);
  });

  test("scores successful escapes by difficulty, time, moves, and hints", () => {
    expect(scoreTrafficEscapeGame({
      difficulty: "normal",
      elapsedSeconds: 42,
      moveCount: 6,
      hintCount: 0,
      completed: true,
    })).toBe(40);
    expect(scoreTrafficEscapeGame({
      difficulty: "normal",
      elapsedSeconds: 230,
      moveCount: 20,
      hintCount: 2,
      completed: true,
    })).toBeLessThan(40);
    expect(scoreTrafficEscapeGame({
      difficulty: "hard",
      elapsedSeconds: 85,
      moveCount: 12,
      hintCount: 0,
      completed: true,
    })).toBeGreaterThanOrEqual(44);
    expect(scoreTrafficEscapeGame({
      difficulty: "hard",
      elapsedSeconds: 85,
      moveCount: 12,
      hintCount: 0,
      completed: false,
    })).toBe(0);
  });
});
