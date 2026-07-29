import {
  NETWALK_TEMPLATES,
  createNetwalkPuzzle,
  createNetwalkState,
  getConnectedNetwalkTileIds,
  getNetwalkHint,
  isNetwalkSolved,
  rotateNetwalkTile,
  scoreNetwalkGame,
} from "../../src/pages/netwalk/gameLogic";

describe("netwalk game logic", () => {
  test("ships three normal and three hard deterministic templates", () => {
    expect(NETWALK_TEMPLATES.filter((template) => template.difficulty === "normal")).toHaveLength(3);
    expect(NETWALK_TEMPLATES.filter((template) => template.difficulty === "hard")).toHaveLength(3);
  });

  test.each(NETWALK_TEMPLATES)("$id solves only after its connections are aligned", (template) => {
    const puzzle = createNetwalkPuzzle(template.difficulty, template.id);
    const startState = createNetwalkState(puzzle);

    expect(isNetwalkSolved(puzzle, startState)).toBe(false);
    expect(isNetwalkSolved(puzzle, { tiles: puzzle.solutionTiles, moveCount: 0 })).toBe(true);
    expect(getConnectedNetwalkTileIds(puzzle, { tiles: puzzle.solutionTiles, moveCount: 0 })).toHaveLength(
      puzzle.size * puzzle.size,
    );
  });

  test("rotates a selectable tile clockwise and leaves the server fixed", () => {
    const puzzle = createNetwalkPuzzle("normal", "netwalk-normal-a");
    const state = createNetwalkState(puzzle);
    const client = state.tiles.find((tile) => !tile.isServer);
    const server = state.tiles.find((tile) => tile.isServer);

    expect(client).toBeDefined();
    expect(server).toBeDefined();

    const rotated = rotateNetwalkTile(state, client!.id);
    const serverRotation = rotateNetwalkTile(state, server!.id);

    expect(rotated.moveCount).toBe(1);
    expect(rotated.tiles.find((tile) => tile.id === client!.id)?.connections)
      .not.toEqual(client!.connections);
    expect(serverRotation).toEqual(state);
  });

  test("hint identifies a wrong client and repeated hinted rotations solve the puzzle", () => {
    const puzzle = createNetwalkPuzzle("normal", "netwalk-normal-b");
    let state = createNetwalkState(puzzle);
    let hints = 0;

    while (!isNetwalkSolved(puzzle, state) && hints < 64) {
      const hint = getNetwalkHint(puzzle, state);
      expect(hint).not.toBeNull();
      state = rotateNetwalkTile(state, hint!.tileId);
      hints += 1;
    }

    expect(isNetwalkSolved(puzzle, state)).toBe(true);
    expect(hints).toBeGreaterThan(0);
    expect(state.moveCount).toBe(puzzle.minimumMoves);
  });

  test("rejects a disconnected state even when the server itself is valid", () => {
    const puzzle = createNetwalkPuzzle("normal", "netwalk-normal-c");
    const brokenState = {
      tiles: puzzle.solutionTiles.map((tile) => (
        tile.id === "0-0" ? { ...tile, connections: [] } : tile
      )),
      moveCount: 0,
    };

    expect(isNetwalkSolved(puzzle, brokenState)).toBe(false);
    expect(getConnectedNetwalkTileIds(puzzle, brokenState).length).toBeLessThan(puzzle.size * puzzle.size);
  });

  test("scores completed games within normal and hard reward ranges", () => {
    expect(scoreNetwalkGame({
      difficulty: "normal",
      elapsedSeconds: 30,
      moveCount: 18,
      minimumMoves: 14,
      hintCount: 0,
      completed: true,
    })).toBe(40);
    expect(scoreNetwalkGame({
      difficulty: "hard",
      elapsedSeconds: 45,
      moveCount: 24,
      minimumMoves: 18,
      hintCount: 0,
      completed: true,
    })).toBe(50);
    expect(scoreNetwalkGame({
      difficulty: "normal",
      elapsedSeconds: 150,
      moveCount: 90,
      minimumMoves: 14,
      hintCount: 5,
      completed: true,
    })).toBeGreaterThanOrEqual(5);
    expect(scoreNetwalkGame({
      difficulty: "hard",
      elapsedSeconds: 10,
      moveCount: 1,
      minimumMoves: 1,
      hintCount: 0,
      completed: false,
    })).toBe(0);
  });
});
