import {
  countSelectedByAxis,
  createTentsCampSession,
  isTentSolutionCell,
  isTreeCell,
  scoreTentsCampPuzzle,
} from "../../src/pages/tents-camp/gameLogic";

describe("tents-camp game logic", () => {
  test("creates normal puzzles with row and column tent counts", () => {
    const [puzzle] = createTentsCampSession("normal");

    expect(puzzle.size).toBe(6);
    expect(puzzle.tents).toHaveLength(5);
    expect(puzzle.rowCounts.reduce((sum, count) => sum + count, 0)).toBe(5);
    expect(puzzle.colCounts.reduce((sum, count) => sum + count, 0)).toBe(5);
  });

  test("recognizes tree and solution tent cells", () => {
    const [puzzle] = createTentsCampSession("normal");

    expect(isTreeCell(puzzle, { row: 0, col: 0 })).toBe(true);
    expect(isTreeCell(puzzle, { row: 0, col: 1 })).toBe(false);
    expect(isTentSolutionCell(puzzle, { row: 0, col: 1 })).toBe(true);
  });

  test("counts selected tents by row and column", () => {
    const selected = [{ row: 0, col: 1 }, { row: 0, col: 4 }, { row: 2, col: 1 }];

    expect(countSelectedByAxis(selected, 6, "row")).toEqual([2, 0, 1, 0, 0, 0]);
    expect(countSelectedByAxis(selected, 6, "col")).toEqual([0, 2, 0, 0, 1, 0]);
  });

  test("scores exact solutions and rejects partial layouts", () => {
    const [puzzle] = createTentsCampSession("normal");

    expect(scoreTentsCampPuzzle({
      puzzle,
      selectedTents: puzzle.tents,
      answerMs: 10000,
      currentCombo: 2,
    })).toEqual({
      correct: true,
      score: 10,
      matchedTents: 5,
    });

    expect(scoreTentsCampPuzzle({
      puzzle,
      selectedTents: puzzle.tents.slice(0, 4),
      answerMs: 10000,
      currentCombo: 0,
    })).toEqual({
      correct: false,
      score: 0,
      matchedTents: 4,
    });
  });
});
