import {
  createLoopLineState,
  cycleLoopLineEdge,
  getLoopLineBoardStatus,
  getLoopLineHint,
  getLoopLinePuzzlePool,
  loopLineEdgeKey,
  scoreLoopLineGame,
} from "../../src/pages/loop-line/gameLogic";

describe("loop line game logic", () => {
  test("recognizes the shipped compact boards as one clue-valid closed loop", () => {
    (["normal", "hard"] as const).forEach((difficulty) => {
      getLoopLinePuzzlePool(difficulty).forEach((puzzle) => {
        const status = getLoopLineBoardStatus(puzzle, {
          selectedEdges: puzzle.solutionEdges.map(loopLineEdgeKey),
          blockedEdges: [],
        });

        expect(puzzle.size).toBe(difficulty === "hard" ? 6 : 5);
        expect(status.solved).toBe(true);
        expect(status.unsatisfiedClueKeys).toEqual([]);
        expect(status.branchNodeKeys).toEqual([]);
        expect(status.openNodeKeys).toEqual([]);
      });
    });
  });

  test("cycles an edge through line, blocked, and blank states", () => {
    const [puzzle] = getLoopLinePuzzlePool("normal");
    const edge = puzzle.solutionEdges[0];
    const initial = createLoopLineState();
    const withLine = cycleLoopLineEdge(initial, edge);
    const withBlock = cycleLoopLineEdge(withLine, edge);
    const cleared = cycleLoopLineEdge(withBlock, edge);

    expect(withLine.selectedEdges).toEqual([loopLineEdgeKey(edge)]);
    expect(withLine.blockedEdges).toEqual([]);
    expect(withBlock.selectedEdges).toEqual([]);
    expect(withBlock.blockedEdges).toEqual([loopLineEdgeKey(edge)]);
    expect(cleared).toEqual(initial);
  });

  test("keeps an incomplete segment unsolved and offers the next solution edge", () => {
    const [puzzle] = getLoopLinePuzzlePool("normal");
    const initial = createLoopLineState();
    const withOneSegment = cycleLoopLineEdge(initial, puzzle.solutionEdges[0]);

    expect(getLoopLineBoardStatus(puzzle, withOneSegment).solved).toBe(false);
    expect(getLoopLineBoardStatus(puzzle, withOneSegment).openNodeKeys).toHaveLength(2);
    expect(getLoopLineHint(puzzle, withOneSegment)).toEqual(puzzle.solutionEdges[1]);
  });

  test("rewards fast, low-hint completions while refusing unfinished boards", () => {
    expect(scoreLoopLineGame({ difficulty: "normal", elapsedSeconds: 60, hintCount: 0, completed: true })).toBe(40);
    expect(scoreLoopLineGame({ difficulty: "hard", elapsedSeconds: 120, hintCount: 0, completed: true })).toBeGreaterThanOrEqual(44);
    expect(scoreLoopLineGame({ difficulty: "hard", elapsedSeconds: 240, hintCount: 3, completed: true })).toBeLessThan(44);
    expect(scoreLoopLineGame({ difficulty: "normal", elapsedSeconds: 20, hintCount: 0, completed: false })).toBe(0);
  });
});
