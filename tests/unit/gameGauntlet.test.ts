jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    getStorageSync: jest.fn(() => ""),
    setStorageSync: jest.fn(),
    removeStorageSync: jest.fn(),
  },
  getCurrentInstance: jest.fn(() => ({ router: { params: {} } })),
}));

import { GAUNTLET_CANDIDATE_GAMES } from "../../src/config/gameCatalog";
import {
  buildGameGauntletGameIds,
  buildGameGauntletWeightedPool,
  selectWeightedUniqueGauntletGames,
} from "../../src/utils/gameGauntlet";

describe("gameGauntlet", () => {
  test("builds a weighted pool from gameplay mode counts", () => {
    const pool = buildGameGauntletWeightedPool(GAUNTLET_CANDIDATE_GAMES);
    const counts = new Map(pool.map((game) => [
      game.id,
      pool.filter((item) => item.id === game.id).length,
    ]));

    expect(counts.get("mental-math")).toBe(2);
    expect(counts.get("memory-challenge")).toBe(3);
    expect(counts.get("bird-count")).toBe(2);
    expect(counts.get("twenty-four")).toBe(1);
  });

  test("selects unique games even when weighted games have multiple tickets", () => {
    const selectedGames = selectWeightedUniqueGauntletGames(
      GAUNTLET_CANDIDATE_GAMES,
      3,
      "stable-test-seed",
    );
    const selectedIds = selectedGames.map((game) => game.id);

    expect(selectedIds).toHaveLength(3);
    expect(new Set(selectedIds).size).toBe(3);
  });

  test("builds three unique gauntlet game ids", () => {
    const gameIds = buildGameGauntletGameIds("stable-test-seed");

    expect(gameIds).toHaveLength(3);
    expect(new Set(gameIds).size).toBe(3);
    expect(gameIds).not.toContain("game-gauntlet");
    expect(gameIds).not.toContain("head-count");
  });
});
