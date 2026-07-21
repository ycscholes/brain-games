import {
  createSumpleteGridCells,
  cycleSumpleteCellState,
  evaluateSumpleteGrid,
  getSumpleteGridPuzzlePool,
  scoreSumpleteGrid,
} from "../../src/pages/sumplete-grid/gameLogic";

describe("sumplete-grid game logic", () => {
  test("hydrates row and column targets from kept cells", () => {
    const [puzzle] = getSumpleteGridPuzzlePool("normal");

    expect(puzzle.size).toBe(4);
    expect(puzzle.rowTargets).toEqual([14, 11, 9, 16]);
    expect(puzzle.colTargets).toEqual([14, 16, 10, 10]);
  });

  test("creates unknown cells and cycles through decisions", () => {
    const [puzzle] = getSumpleteGridPuzzlePool("normal");
    const cells = createSumpleteGridCells(puzzle);

    expect(cells).toHaveLength(16);
    expect(cells[0]).toEqual({ row: 0, col: 0, value: 8, state: "unknown" });
    expect(cycleSumpleteCellState("unknown")).toBe("kept");
    expect(cycleSumpleteCellState("kept")).toBe("removed");
    expect(cycleSumpleteCellState("removed")).toBe("unknown");
  });

  test("accepts the exact keep-remove solution", () => {
    const [puzzle] = getSumpleteGridPuzzlePool("normal");
    const cells = createSumpleteGridCells(puzzle).map((cell) => ({
      ...cell,
      state: puzzle.solution[cell.row][cell.col] ? "kept" as const : "removed" as const,
    }));

    expect(evaluateSumpleteGrid(puzzle, cells)).toEqual({
      complete: true,
      correct: true,
      rowSums: puzzle.rowTargets,
      colSums: puzzle.colTargets,
      wrongCellKeys: [],
    });
  });

  test("reports incomplete and wrong decisions", () => {
    const [puzzle] = getSumpleteGridPuzzlePool("normal");
    const incompleteCells = createSumpleteGridCells(puzzle);
    const wrongCells = incompleteCells.map((cell) => ({
      ...cell,
      state: "kept" as const,
    }));

    expect(evaluateSumpleteGrid(puzzle, incompleteCells).complete).toBe(false);
    expect(evaluateSumpleteGrid(puzzle, wrongCells)).toMatchObject({
      complete: true,
      correct: false,
    });
    expect(evaluateSumpleteGrid(puzzle, wrongCells).wrongCellKeys.length).toBeGreaterThan(0);
  });

  test("scores normal and hard solves inside the shared reward envelope", () => {
    expect(scoreSumpleteGrid({ difficulty: "normal", elapsedSeconds: 90, mistakes: 0 })).toBe(40);
    expect(scoreSumpleteGrid({ difficulty: "normal", elapsedSeconds: 260, mistakes: 3 })).toBe(16);
    expect(scoreSumpleteGrid({ difficulty: "hard", elapsedSeconds: 180, mistakes: 0 })).toBe(46);
    expect(scoreSumpleteGrid({ difficulty: "hard", elapsedSeconds: 500, mistakes: 20 })).toBe(8);
  });
});
