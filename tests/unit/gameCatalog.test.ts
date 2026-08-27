import {
  ALL_GAME_ITEMS,
  GAUNTLET_CANDIDATE_GAMES,
  GAME_CATALOG,
  GAME_CATEGORIES,
  HOME_GAME_GROUPS,
  HOME_GAME_ITEMS,
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

  test("all games includes the requested games in category-first order and excludes retired entries", () => {
    const allGameIds = ALL_GAME_ITEMS.map((game) => game.id);

    expect(allGameIds).toContain("spatial-rotation");
    expect(allGameIds).not.toContain("triad-match");
    expect(allGameIds).toContain("hidato");
    expect(allGameIds).not.toContain("code-breaker");
    expect(allGameIds).not.toContain("inequality-grid");
    expect(allGameIds).toContain("tents-camp");
    expect(allGameIds).toContain("sumplete-grid");
    expect(allGameIds).toContain("traffic-escape");
    expect(allGameIds).toContain("netwalk");
    expect(allGameIds).toContain("loop-line");
    expect(allGameIds).toContain("music-theory");
    expect(allGameIds).toContain("game-gauntlet");
    expect(allGameIds).not.toContain("head-count");
    expect(allGameIds).not.toContain("dual-task");
    expect(allGameIds).not.toContain("signal-sprint");

    const idsFor = (category: string) => ALL_GAME_ITEMS
      .filter((game) => game.category === category)
      .map((game) => game.id);

    expect(idsFor("memory").slice(0, 3)).toEqual([
      "memory-challenge",
      "bird-count",
      "rock-paper-scissors",
    ]);
    expect(idsFor("reasoning").slice(0, 5)).toEqual([
      "hidato",
      "tents-camp",
      "loop-line",
      "traffic-escape",
      "netwalk",
    ]);
  });

  test("defines home groups from the all-games ordering with five reasoning games", () => {
    expect(HOME_GAME_GROUPS.map((group) => group.id)).toEqual(["math", "memory", "reasoning"]);
    expect(HOME_GAME_GROUPS.find((group) => group.id === "reasoning")?.gameIds).toEqual([
      "hidato",
      "tents-camp",
      "loop-line",
      "traffic-escape",
      "netwalk",
    ]);

    const idsFor = (category: string) => HOME_GAME_ITEMS
      .filter((game) => game.category === category)
      .map((game) => game.id);

    expect(idsFor("reasoning")).toEqual([
      "hidato",
      "tents-camp",
      "loop-line",
      "traffic-escape",
      "netwalk",
    ]);
  });

  test("gauntlet candidate pool includes playable single games only", () => {
    const candidateIds = GAUNTLET_CANDIDATE_GAMES.map((game) => game.id);

    expect(candidateIds).toHaveLength(19);
    expect(new Set(candidateIds).size).toBe(candidateIds.length);
    expect(candidateIds).not.toContain("triad-match");
    expect(candidateIds).toContain("hidato");
    expect(candidateIds).not.toContain("code-breaker");
    expect(candidateIds).not.toContain("inequality-grid");
    expect(candidateIds).toContain("tents-camp");
    expect(candidateIds).toContain("sumplete-grid");
    expect(candidateIds).toContain("traffic-escape");
    expect(candidateIds).toContain("netwalk");
    expect(candidateIds).toContain("loop-line");
    expect(candidateIds).toContain("music-theory");
    expect(candidateIds).not.toContain("game-gauntlet");
    expect(candidateIds).not.toContain("head-count");
    expect(candidateIds).not.toContain("dual-task");
    expect(candidateIds).not.toContain("signal-sprint");
  });

  test("groups games by core gameplay mode", () => {
    expect(GAME_CATEGORIES).toEqual([
      { id: "challenge", title: "综合挑战" },
      { id: "math", title: "计算与数理" },
      { id: "memory", title: "记忆与反应" },
      { id: "reasoning", title: "推理" },
      { id: "language", title: "语言" },
    ]);

    const categories = new Map(GAME_CATALOG.map((game) => [game.id, game.category]));
    expect(categories.get("pattern-completion")).toBe("reasoning");
    expect(categories.get("sumplete-grid")).toBe("math");
    expect(categories.get("traffic-escape")).toBe("reasoning");
    expect(categories.get("netwalk")).toBe("reasoning");
    expect(categories.get("loop-line")).toBe("reasoning");
    expect(categories.get("game-gauntlet")).toBe("challenge");
  });

  test("maps every gameplay category to its shared styling class", () => {
    expect(GAME_CATEGORIES.map((category) => getGameCategoryClass(category.id))).toEqual([
      "game-category-challenge",
      "game-category-math",
      "game-category-memory",
      "game-category-reasoning",
      "game-category-language",
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
