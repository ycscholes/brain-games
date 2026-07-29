import {
  ALL_GAME_ITEMS,
  GAUNTLET_CANDIDATE_GAMES,
  GAME_CATALOG,
  GAME_CATEGORIES,
  HOT_GAME_IDS,
  getGameCategoryClass,
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
    expect(allGameIds).toContain("triad-match");
    expect(allGameIds).toContain("hidato");
    expect(allGameIds).not.toContain("code-breaker");
    expect(allGameIds).not.toContain("inequality-grid");
    expect(allGameIds).toContain("tents-camp");
    expect(allGameIds).toContain("sumplete-grid");
    expect(allGameIds).toContain("traffic-escape");
    expect(allGameIds).toContain("netwalk");
    expect(allGameIds).toContain("game-gauntlet");
    expect(allGameIds).not.toContain("head-count");
    expect(allGameIds).not.toContain("dual-task");
    expect(allGameIds).not.toContain("signal-sprint");
  });

  test("gauntlet candidate pool includes playable single games only", () => {
    const candidateIds = GAUNTLET_CANDIDATE_GAMES.map((game) => game.id);

    expect(candidateIds).toHaveLength(18);
    expect(new Set(candidateIds).size).toBe(candidateIds.length);
    expect(candidateIds).toContain("triad-match");
    expect(candidateIds).toContain("hidato");
    expect(candidateIds).not.toContain("code-breaker");
    expect(candidateIds).not.toContain("inequality-grid");
    expect(candidateIds).toContain("tents-camp");
    expect(candidateIds).toContain("sumplete-grid");
    expect(candidateIds).toContain("traffic-escape");
    expect(candidateIds).toContain("netwalk");
    expect(candidateIds).not.toContain("game-gauntlet");
    expect(candidateIds).not.toContain("head-count");
    expect(candidateIds).not.toContain("dual-task");
    expect(candidateIds).not.toContain("signal-sprint");
  });

  test("groups games by core gameplay mode", () => {
    expect(GAME_CATEGORIES).toEqual([
      { id: "math", title: "计算与数理" },
      { id: "memory", title: "记忆与反应" },
      { id: "reasoning", title: "推理" },
      { id: "language", title: "语言" },
      { id: "challenge", title: "综合挑战" },
    ]);

    const categories = new Map(GAME_CATALOG.map((game) => [game.id, game.category]));
    expect(categories.get("pattern-completion")).toBe("reasoning");
    expect(categories.get("traffic-escape")).toBe("reasoning");
    expect(categories.get("netwalk")).toBe("reasoning");
    expect(categories.get("game-gauntlet")).toBe("challenge");
  });

  test("maps every gameplay category to its shared styling class", () => {
    expect(GAME_CATEGORIES.map((category) => getGameCategoryClass(category.id))).toEqual([
      "game-category-math",
      "game-category-memory",
      "game-category-reasoning",
      "game-category-language",
      "game-category-challenge",
    ]);
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
