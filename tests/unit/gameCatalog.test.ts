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

  test("all games includes gauntlet but excludes head-count redirect", () => {
    const allGameIds = ALL_GAME_ITEMS.map((game) => game.id);

    expect(allGameIds).toContain("game-gauntlet");
    expect(allGameIds).not.toContain("head-count");
  });

  test("gauntlet candidate pool includes playable single games only", () => {
    const candidateIds = GAUNTLET_CANDIDATE_GAMES.map((game) => game.id);

    expect(candidateIds).toHaveLength(12);
    expect(new Set(candidateIds).size).toBe(candidateIds.length);
    expect(candidateIds).not.toContain("game-gauntlet");
    expect(candidateIds).not.toContain("head-count");
  });

  test("hot games carry double recommendation weight", () => {
    GAME_CATALOG.forEach((game) => {
      if (game.id === "game-gauntlet") return;
      expect(game.recommendationWeight).toBe(game.isHot ? 2 : 1);
    });
  });
});
