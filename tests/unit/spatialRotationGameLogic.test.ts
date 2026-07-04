import {
  SPATIAL_ROTATION_GRID_SIZE,
  SPATIAL_ROTATION_TOTAL_PUZZLES,
  cellsKey,
  createSpatialRotationPuzzle,
  createSpatialRotationSession,
  getSpatialRotationTimeLimitMs,
  mirrorCells,
  normalizeCells,
  rotateCells,
  scoreSpatialRotationPuzzle,
} from "../../src/pages/spatial-rotation/gameLogic";

describe("spatial-rotation game logic", () => {
  test("creates 8-puzzle normal and hard sessions", () => {
    expect(createSpatialRotationSession("normal")).toHaveLength(SPATIAL_ROTATION_TOTAL_PUZZLES);
    expect(createSpatialRotationSession("hard")).toHaveLength(SPATIAL_ROTATION_TOTAL_PUZZLES);
  });

  test("puzzles include four options and one matching answer", () => {
    createSpatialRotationSession("normal").forEach((puzzle, index) => {
      expect(puzzle.id).toBeTruthy();
      expect(puzzle.targetCells).toHaveLength(5);
      expect(puzzle.options).toHaveLength(4);
      expect(puzzle.options.map((option) => option.id)).toContain(puzzle.answerOptionId);
      expect(puzzle.timeLimitMs).toBe(getSpatialRotationTimeLimitMs("normal", index));

      puzzle.options.forEach((option) => {
        option.cells.forEach(([row, col]) => {
          expect(row).toBeGreaterThanOrEqual(0);
          expect(row).toBeLessThan(SPATIAL_ROTATION_GRID_SIZE);
          expect(col).toBeGreaterThanOrEqual(0);
          expect(col).toBeLessThan(SPATIAL_ROTATION_GRID_SIZE);
        });
      });
    });
  });

  test("hard mode uses tighter timing and clamps out-of-range indexes", () => {
    const hardPuzzle = createSpatialRotationPuzzle("hard", 99);

    expect(hardPuzzle.id).toBe("spatial-rotation-hard-8");
    expect(hardPuzzle.timeLimitMs).toBe(4600);
    expect(getSpatialRotationTimeLimitMs("hard", 99)).toBe(4600);
    expect(getSpatialRotationTimeLimitMs("hard", 0)).toBeLessThan(getSpatialRotationTimeLimitMs("normal", 0));
  });

  test("normalizes rotations and mirrors deterministically", () => {
    const shape = normalizeCells([[1, 1], [1, 2], [2, 1]]);
    const rotatedFourTimes = rotateCells(shape, 4);

    expect(cellsKey(rotatedFourTimes)).toBe(cellsKey(shape));
    expect(cellsKey(mirrorCells(mirrorCells(shape)))).toBe(cellsKey(shape));
  });

  test("scores correct answers with speed and combo bonuses", () => {
    expect(scoreSpatialRotationPuzzle({
      selectedOptionId: "match",
      answerOptionId: "match",
      answerMs: 1800,
      currentCombo: 2,
    })).toEqual({
      correct: true,
      speedBonus: 1,
      comboBonus: 1,
      score: 6,
    });

    expect(scoreSpatialRotationPuzzle({
      selectedOptionId: "mirror",
      answerOptionId: "match",
      answerMs: 900,
      currentCombo: 4,
    })).toEqual({
      correct: false,
      speedBonus: 0,
      comboBonus: 0,
      score: 0,
    });
  });
});
