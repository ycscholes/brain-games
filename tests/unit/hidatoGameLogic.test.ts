import {
  HIDATO_CONFIG,
  applyHidatoCellClick,
  applyHidatoHint,
  areHidatoNeighbors,
  createHidatoLineSegments,
  createHidatoPuzzle,
  createInitialClickState,
  getHidatoHiddenRatio,
  hasLocallyUniqueRevealedPath,
  scoreHidatoGame,
  validateHidatoPath,
} from "../../src/pages/hidato/gameLogic";

describe("hidato game logic", () => {
  test("creates mobile-first normal and hard boards", () => {
    const normal = createHidatoPuzzle("normal");
    const hard = createHidatoPuzzle("hard");

    expect(normal.cols).toBe(5);
    expect(normal.rows).toBe(10);
    expect(normal.total).toBe(50);
    expect(hard.cols).toBe(5);
    expect(hard.rows).toBe(15);
    expect(hard.total).toBe(75);
  });

  test("fills every cell with one value from 1 to N", () => {
    const puzzle = createHidatoPuzzle("normal");
    const values = puzzle.cells.map((cell) => cell.value).sort((a, b) => a - b);

    expect(values).toHaveLength(puzzle.total);
    expect(values).toEqual(Array.from({ length: puzzle.total }, (_, index) => index + 1));
  });

  test("generates an eight-direction adjacent solution path", () => {
    const puzzle = createHidatoPuzzle("hard");

    expect(validateHidatoPath(puzzle)).toBe(true);
    for (let index = 1; index < puzzle.path.length; index += 1) {
      expect(areHidatoNeighbors(puzzle.path[index - 1], puzzle.path[index])).toBe(true);
    }
  });

  test("keeps hidden ratios and endpoint anchors within difficulty rules", () => {
    const normal = createHidatoPuzzle("normal");
    const hard = createHidatoPuzzle("hard");
    const normalRatio = getHidatoHiddenRatio(normal);
    const hardRatio = getHidatoHiddenRatio(hard);

    expect(normalRatio).toBeGreaterThanOrEqual(HIDATO_CONFIG.normal.hiddenMin);
    expect(normalRatio).toBeLessThanOrEqual(HIDATO_CONFIG.normal.hiddenMax);
    expect(hardRatio).toBeGreaterThanOrEqual(HIDATO_CONFIG.hard.hiddenMin);
    expect(hardRatio).toBeLessThanOrEqual(HIDATO_CONFIG.hard.hiddenMax);
    expect(normal.givenValues).toContain(1);
    expect(normal.givenValues).toContain(normal.total);
    expect(hard.givenValues).toContain(1);
    expect(hard.givenValues).toContain(hard.total);
  });

  test("revealed anchors keep hidden stretches locally unique", () => {
    const puzzle = createHidatoPuzzle("normal");

    expect(hasLocallyUniqueRevealedPath(puzzle)).toBe(true);
  });

  test("clicking advances only when the next number is tapped", () => {
    const puzzle = createHidatoPuzzle("normal");
    const byValue = new Map(puzzle.path.map((cell) => [cell.value, cell]));
    const initial = createInitialClickState();
    const wrong = applyHidatoCellClick(initial, byValue.get(2)!, puzzle.total);

    expect(wrong.correct).toBe(false);
    expect(wrong.state.nextValue).toBe(1);
    expect(wrong.state.mistakeCount).toBe(1);

    const first = applyHidatoCellClick(initial, byValue.get(1)!, puzzle.total);
    const second = applyHidatoCellClick(first.state, byValue.get(2)!, puzzle.total);

    expect(first.correct).toBe(true);
    expect(first.state.nextValue).toBe(2);
    expect(second.correct).toBe(true);
    expect(second.state.clickedValues).toEqual([1, 2]);
  });

  test("creates center-to-center line segments for clicked values", () => {
    const puzzle = createHidatoPuzzle("normal");
    const segments = createHidatoLineSegments(puzzle, [1, 2, 3]);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ fromValue: 1, toValue: 2 });
    segments.forEach((segment) => {
      expect(segment.width).toBeGreaterThan(0);
      expect(Number.isFinite(segment.angle)).toBe(true);
    });
  });

  test("scores completed games with mistake and hint penalties", () => {
    const cleanNormal = scoreHidatoGame({
      difficulty: "normal",
      completed: true,
      elapsedSeconds: 90,
      mistakeCount: 0,
      hintCount: 0,
    });
    const messyNormal = scoreHidatoGame({
      difficulty: "normal",
      completed: true,
      elapsedSeconds: 260,
      mistakeCount: 3,
      hintCount: 2,
    });
    const hard = scoreHidatoGame({
      difficulty: "hard",
      completed: true,
      elapsedSeconds: 140,
      mistakeCount: 0,
      hintCount: 0,
    });

    expect(cleanNormal).toBe(40);
    expect(messyNormal).toBeLessThan(cleanNormal);
    expect(hard).toBeGreaterThanOrEqual(45);
    expect(hard).toBeLessThanOrEqual(50);
    expect(scoreHidatoGame({
      difficulty: "normal",
      completed: false,
      elapsedSeconds: 60,
      mistakeCount: 0,
      hintCount: 0,
    })).toBe(0);
  });

  test("hints increment hint count without changing the next target", () => {
    const state = applyHidatoHint({
      nextValue: 12,
      clickedValues: [1, 2, 3],
      mistakeCount: 0,
      hintCount: 1,
    });

    expect(state.nextValue).toBe(12);
    expect(state.hintCount).toBe(2);
  });
});
