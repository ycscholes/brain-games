import {
  applyTrafficEscapeMove,
  assignTrafficVehicleAppearances,
  createTrafficEscapeState,
  createTrafficEscapePuzzle,
  getTrafficEscapeHint,
  getTrafficEscapePuzzlePool,
  isTrafficEscapeSolved,
  scoreTrafficEscapeGame,
  solveTrafficEscapePuzzle,
  TRAFFIC_VEHICLE_APPEARANCES,
} from "../../src/pages/traffic-escape/gameLogic";

describe("traffic-escape game logic", () => {
  test("provides compact normal and hard parking puzzles", () => {
    const normal = createTrafficEscapePuzzle("normal", 17);
    const hard = createTrafficEscapePuzzle("hard", 29);

    expect(normal.size).toBe(6);
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

  test("assigns every two-cell and three-cell appearance before repeating", () => {
    const vehicles = [
      { id: "target", row: 0, col: 0, length: 2 as const, orientation: "horizontal" as const, color: "target" as const, isTarget: true },
      { id: "short-1", row: 1, col: 0, length: 2 as const, orientation: "horizontal" as const, color: "amber" as const },
      { id: "short-2", row: 2, col: 0, length: 2 as const, orientation: "horizontal" as const, color: "cyan" as const },
      { id: "short-3", row: 3, col: 0, length: 2 as const, orientation: "horizontal" as const, color: "violet" as const },
      { id: "short-4", row: 4, col: 0, length: 2 as const, orientation: "horizontal" as const, color: "lime" as const },
      { id: "long-1", row: 5, col: 0, length: 3 as const, orientation: "horizontal" as const, color: "violet" as const },
      { id: "long-2", row: 6, col: 0, length: 3 as const, orientation: "horizontal" as const, color: "lime" as const },
      { id: "long-3", row: 7, col: 0, length: 3 as const, orientation: "horizontal" as const, color: "coral" as const },
      { id: "long-4", row: 8, col: 0, length: 3 as const, orientation: "horizontal" as const, color: "amber" as const },
      { id: "long-5", row: 9, col: 0, length: 3 as const, orientation: "horizontal" as const, color: "cyan" as const },
    ];

    const assigned = assignTrafficVehicleAppearances(vehicles, () => 0.4);
    const twoCellAppearances = assigned.filter((vehicle) => vehicle.length === 2).map((vehicle) => vehicle.appearance);
    const threeCellAppearances = assigned.filter((vehicle) => vehicle.length === 3).map((vehicle) => vehicle.appearance);

    expect(TRAFFIC_VEHICLE_APPEARANCES[2]).toEqual([
      "sport", "compact-van", "city-taxi", "pink-sport", "offroad-suv",
    ]);
    expect(TRAFFIC_VEHICLE_APPEARANCES[3]).toEqual([
      "city-bus", "box-truck", "stretch-sedan", "camper-rv", "tanker-truck",
    ]);
    expect(assigned.find((vehicle) => vehicle.isTarget)?.appearance).toBe("sport");
    expect(assigned.filter((vehicle) => vehicle.appearance === "pink-sport")).toHaveLength(1);
    expect(new Set(twoCellAppearances)).toEqual(new Set(TRAFFIC_VEHICLE_APPEARANCES[2]));
    expect(new Set(threeCellAppearances)).toEqual(new Set(TRAFFIC_VEHICLE_APPEARANCES[3]));
  });

  test("generates every vehicle form in each difficulty", () => {
    (["normal", "hard"] as const).forEach((difficulty) => {
      const puzzle = createTrafficEscapePuzzle(difficulty, difficulty === "normal" ? 17 : 29);
      const twoCellAppearances = puzzle.vehicles
        .filter((vehicle) => vehicle.length === 2)
        .map((vehicle) => vehicle.appearance);
      const threeCellAppearances = puzzle.vehicles
        .filter((vehicle) => vehicle.length === 3)
        .map((vehicle) => vehicle.appearance);

      expect(new Set(twoCellAppearances)).toEqual(new Set(TRAFFIC_VEHICLE_APPEARANCES[2]));
      expect(new Set(threeCellAppearances).size).toBe(threeCellAppearances.length);
      expect(threeCellAppearances.every((appearance) => TRAFFIC_VEHICLE_APPEARANCES[3].includes(appearance!))).toBe(true);
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
