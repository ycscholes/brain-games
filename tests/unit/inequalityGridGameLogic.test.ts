import {
  INEQUALITY_GRID_TOTAL_PUZZLES,
  createInequalityGridPuzzle,
  createInequalityGridSession,
  getInequalityGridTimeLimitMs,
  scoreInequalityGridPuzzle,
  validateInequalityGridCandidate,
} from "../../src/pages/inequality-grid/gameLogic";

describe("inequality-grid game logic", () => {
  test("creates 8-puzzle normal and hard sessions", () => {
    expect(createInequalityGridSession("normal")).toHaveLength(INEQUALITY_GRID_TOTAL_PUZZLES);
    expect(createInequalityGridSession("hard")).toHaveLength(INEQUALITY_GRID_TOTAL_PUZZLES);
  });

  test("normal and hard puzzles use expected board sizes and four options", () => {
    const normalPuzzle = createInequalityGridPuzzle("normal", 0);
    const hardPuzzle = createInequalityGridPuzzle("hard", 0);

    expect(normalPuzzle.size).toBe(4);
    expect(hardPuzzle.size).toBe(5);
    expect(normalPuzzle.options).toHaveLength(4);
    expect(hardPuzzle.options).toHaveLength(4);
    expect(normalPuzzle.cells).toHaveLength(16);
    expect(hardPuzzle.cells).toHaveLength(25);
  });

  test("each puzzle has exactly one valid option and enough visible clues", () => {
    createInequalityGridSession("hard").forEach((puzzle) => {
      const validOptions = puzzle.options.filter((option) => validateInequalityGridCandidate(puzzle, option));
      const givenCount = puzzle.cells.filter((cell) => cell.given).length;

      expect(validOptions).toEqual([puzzle.answer]);
      expect(givenCount).toBeGreaterThanOrEqual(puzzle.size * 2 - 2);
      expect(puzzle.comparisons.length).toBeGreaterThanOrEqual(puzzle.size * 2);
    });
  });

  test("hard mode uses tighter timing and clamps out-of-range indexes", () => {
    const hardPuzzle = createInequalityGridPuzzle("hard", 99);

    expect(hardPuzzle.id).toBe("inequality-grid-hard-8");
    expect(hardPuzzle.timeLimitMs).toBe(6500);
    expect(getInequalityGridTimeLimitMs("hard", 99)).toBe(6500);
    expect(getInequalityGridTimeLimitMs("hard", 0)).toBeLessThan(getInequalityGridTimeLimitMs("normal", 0));
  });

  test("scores correct answers with speed and combo bonuses", () => {
    expect(scoreInequalityGridPuzzle({
      selectedValue: 3,
      answer: 3,
      answerMs: 2400,
      currentCombo: 2,
    })).toEqual({
      correct: true,
      speedBonus: 1,
      comboBonus: 1,
      score: 6,
    });

    expect(scoreInequalityGridPuzzle({
      selectedValue: 2,
      answer: 3,
      answerMs: 1200,
      currentCombo: 4,
    })).toEqual({
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      score: 0,
    });
  });
});
