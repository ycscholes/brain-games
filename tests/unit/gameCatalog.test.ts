import {
  ALL_GAME_ITEMS,
  GAUNTLET_CANDIDATE_GAMES,
  GAME_CATALOG,
  HOT_GAME_IDS,
} from "../../src/config/gameCatalog";

describe("gameCatalog", () => {
  test("defines the requested home hot games only", () => {
    expect(HOT_GAME_IDS).toEqual([
      "mental-math",
      "digit-span",
      "twenty-four",
      "rock-paper-scissors",
      "memory-challenge",
      "bird-count",
    ]);
  });

  test("all games includes gauntlet but excludes removed or redirect entries", () => {
    const allGameIds = ALL_GAME_ITEMS.map((game) => game.id);

    expect(allGameIds).toContain("spatial-rotation");
    expect(allGameIds).toContain("hidato");
    expect(allGameIds).toContain("game-gauntlet");
    expect(allGameIds).not.toContain("head-count");
    expect(allGameIds).not.toContain("dual-task");
    expect(allGameIds).not.toContain("signal-sprint");
  });

  test("gauntlet candidate pool includes playable single games only", () => {
    const candidateIds = GAUNTLET_CANDIDATE_GAMES.map((game) => game.id);

    expect(candidateIds).toHaveLength(13);
    expect(new Set(candidateIds).size).toBe(candidateIds.length);
    expect(candidateIds).toContain("hidato");
    expect(candidateIds).not.toContain("game-gauntlet");
    expect(candidateIds).not.toContain("head-count");
    expect(candidateIds).not.toContain("dual-task");
    expect(candidateIds).not.toContain("signal-sprint");
  });

  test("hot games carry double recommendation weight", () => {
    GAME_CATALOG.forEach((game) => {
      if (game.id === "game-gauntlet") return;
      expect(game.recommendationWeight).toBe(game.isHot ? 2 : 1);
    });
  });

  test("gauntlet mode weights count gameplay modes only", () => {
    const weights = new Map(GAME_CATALOG.map((game) => [game.id, game.gauntletModeWeight]));

    expect(weights.get("mental-math")).toBe(2);
    expect(weights.get("memory-challenge")).toBe(3);
    expect(weights.get("bird-count")).toBe(2);

    GAUNTLET_CANDIDATE_GAMES
      .filter((game) => !["mental-math", "memory-challenge", "bird-count"].includes(game.id))
      .forEach((game) => {
        expect(game.gauntletModeWeight).toBe(1);
      });
  });
});
